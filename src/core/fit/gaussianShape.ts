import { normalQuadratureRules } from "./normalQuadrature";

/** Jones–Pewsey sinh–arcsinh normal, recentered at its mode and scaled to unit height.
 * The affine recentering leaves standardized skewness and kurtosis unchanged.
 */
function shapeSlope(u: number) {
  const sh = Math.sinh(u),
    ch = Math.cosh(u);
  return { g: Math.tanh(u) - sh * ch, gp: 1 / (ch * ch) - Math.cosh(2 * u) };
}

export function gaussianShapeMode(skew: number, tail: number) {
  // In t = asinh(z), the log-density derivative is strictly decreasing.
  // Its unique zero lies between 0 and skew/tail.
  let lo = Math.min(0, skew / tail),
    hi = Math.max(0, skew / tail);
  for (let i = 0; i < 64 && lo !== hi; i++) {
    const t = lo / 2 + hi / 2;
    if (tail * shapeSlope(tail * t - skew).g - Math.tanh(t) > 0) lo = t;
    else hi = t;
  }
  const t = lo / 2 + hi / 2,
    z = Math.sinh(t),
    ch = Math.cosh(t);
  const { g, gp } = shapeSlope(tail * t - skew);
  const denominator = tail * tail * gp - 1 / (ch * ch);
  return {
    t,
    z,
    skewDerivative: (ch * tail * gp) / denominator,
    tailDerivative: (-ch * (g + tail * gp * t)) / denominator,
  };
}

function logShape(z: number, skew: number, tail: number) {
  const t = Math.asinh(z),
    u = tail * t - skew;
  const a = Math.abs(u);
  const logCosh = a + Math.log1p(Math.exp(-2 * a)) - Math.LN2;
  return logCosh - 0.5 * Math.sinh(u) ** 2 - Math.log(Math.hypot(1, z));
}

/** Analytic derivatives in [b, A, mu, w, skew, tail] coordinates. */
export function gaussianShapeValueGradient(x: number, p: readonly number[]) {
  const [b, A, mu, w, skew, tail] = p;
  if (!(w > 0 && tail > 0) || p.some((v) => !Number.isFinite(v)))
    return { value: NaN, gradient: Array(6).fill(NaN) as number[] };
  const mode = gaussianShapeMode(skew, tail);
  const offset = (x - mu) / w,
    z = offset + mode.z;
  const logQ = logShape(z, skew, tail) - logShape(mode.z, skew, tail);
  const q =
    skew === 0 && tail === 1
      ? Math.exp(-0.5 * offset * offset)
      : Math.exp(logQ);
  if (q === 0) return { value: b, gradient: [1, 0, 0, 0, 0, 0] };
  const t = Math.asinh(z),
    norm = Math.hypot(1, z);
  const g = shapeSlope(tail * t - skew).g;
  const gm = shapeSlope(tail * mode.t - skew).g;
  const logSlope = (tail * g) / norm - z / norm / norm;
  return {
    value: b + A * q,
    gradient: [
      1,
      q,
      (-A * q * logSlope) / w,
      (-A * q * logSlope * offset) / w,
      A * q * (logSlope * mode.skewDerivative - g + gm),
      A * q * (logSlope * mode.tailDerivative + g * t - gm * mode.t),
    ],
  };
}

function momentsWithRule(
  skew: number,
  tail: number,
  rule: readonly (readonly number[])[],
) {
  const values = rule.map(([z]) => Math.sinh((Math.asinh(z) + skew) / tail));
  const scale = Math.max(...values.map(Math.abs));
  if (!(scale > 0) || !Number.isFinite(scale)) return null;
  const normalized = values.map((v) => v / scale);
  const mean = normalized.reduce((sum, v, i) => sum + v * rule[i][1], 0);
  let m2 = 0,
    m3 = 0,
    m4 = 0;
  normalized.forEach((v, i) => {
    const d = v - mean,
      w = rule[i][1];
    m2 += w * d * d;
    m3 += w * d ** 3;
    m4 += w * d ** 4;
  });
  const result = {
    skewness: skew === 0 ? 0 : m3 / m2 ** 1.5,
    excessKurtosis: m4 / (m2 * m2) - 3,
  };
  return Object.values(result).every(Number.isFinite) ? result : null;
}

/** Standardized moments of the normalized peak, excluding its background.
 * Agreement of 128- and 256-point normal quadrature is required before reporting.
 */
export function gaussianShapeMoments(skew: number, tail: number) {
  if (!Number.isFinite(skew) || !Number.isFinite(tail) || !(tail > 0))
    return null;
  if (skew === 0 && tail === 1) return { skewness: 0, excessKurtosis: 0 };
  const a = momentsWithRule(skew, tail, normalQuadratureRules[0]);
  const b = momentsWithRule(skew, tail, normalQuadratureRules[1]);
  if (!a || !b) return null;
  return (["skewness", "excessKurtosis"] as const).every(
    (key) => Math.abs(a[key] - b[key]) <= 1e-8 * (1 + Math.abs(b[key])),
  )
    ? b
    : null;
}
