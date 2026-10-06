import { minusCoefficients, plusCoefficients } from "./landauCoefficients";

/** Mode of the scale-one Boost/SciPy Landau, before ROOT scale conversion. */
export const LANDAU_BOOST_MODE = -0.42931452986133525017;
export const LANDAU_SCALE = 2 / Math.PI;
export const LANDAU_ROOT_MODE =
  LANDAU_BOOST_MODE / LANDAU_SCALE + Math.log(Math.PI / 2);

function polynomial(x: number, coefficients: readonly number[]) {
  let value = coefficients.at(-1)!,
    derivative = 0;
  for (let i = coefficients.length - 2; i >= 0; --i) {
    derivative = derivative * x + value;
    value = value * x + coefficients[i];
  }
  return { value, derivative };
}

function rational(
  x: number,
  pair: readonly [readonly number[], readonly number[]],
) {
  const p = polynomial(x, pair[0]),
    q = polynomial(x, pair[1]);
  const value = p.value / q.value;
  return { value, derivative: (p.derivative - value * q.derivative) / q.value };
}

/** Boost.Math's 53-bit piecewise rational PDF, with analytic derivatives.
 * No finite-difference derivatives or per-evaluation numerical integration.
 * Copyright Takuma Yoshimura 2024 and Matt Borland 2024; Boost license.
 */
function boostLandau(x: number): { value: number; derivative: number } {
  if (Number.isNaN(x)) return { value: NaN, derivative: NaN };
  if (!Number.isFinite(x) || x < -5.1328125) return { value: 0, derivative: 0 };
  if (x < 0) {
    if (x >= -1) return rational(x + 1, minusCoefficients[0]);
    if (x >= -2) return rational(x + 2, minusCoefficients[1]);
    const index = x >= -4 ? 2 : 3;
    const r = rational(-x - (index === 2 ? 2 : 4), minusCoefficients[index]);
    const sigma = Math.exp((-x * Math.PI) / 2 - (Math.log(Math.PI / 2) + 1));
    // Combine exponents to preserve subnormal values in the far left tail.
    const value = Math.exp(-sigma + 0.5 * Math.log(sigma) + Math.log(r.value));
    return {
      value,
      derivative:
        value * ((Math.PI / 2) * (sigma - 0.5) - r.derivative / r.value),
    };
  }
  const limits = [1, 2, 4, 8, 16, 32, 64];
  for (let i = 0; i < limits.length; ++i)
    if (x < limits[i])
      return rational(x - (i === 0 ? 0 : limits[i - 1]), plusCoefficients[i]);
  const powers = [8, 16, 32, 64];
  for (let i = 0; i < powers.length; ++i) {
    if (x < 2 ** powers[i]) {
      const t = Math.log2(x) - (i === 0 ? 6 : powers[i - 1]);
      const r = rational(t, plusCoefficients[7 + i]);
      return {
        value: r.value / x / x,
        derivative: (r.derivative / Math.LN2 - 2 * r.value) / x / x / x,
      };
    }
  }
  const value = LANDAU_SCALE / x / x;
  return { value, derivative: (-2 * value) / x };
}

/** Unit-area, mode-zero Landau with ROOT's width convention.
 * landau(z) = (2/pi) * scipy.stats.landau.pdf((2/pi)*z + BOOST_MODE).
 * Equivalent to TMath::Landau(z + ROOT_MODE, 0, 1, true), up to ROOT's
 * approximation error. Mean, variance, skewness and kurtosis are undefined.
 */
export function landauValueDerivative(z: number) {
  const result = boostLandau(LANDAU_SCALE * z + LANDAU_BOOST_MODE);
  return {
    value: LANDAU_SCALE * result.value,
    derivative: LANDAU_SCALE * LANDAU_SCALE * result.derivative,
  };
}

/** b + A/w * landau((x-mpv)/w); A is signed area above background. */
export function landauValueGradient(x: number, p: readonly number[]) {
  const [b, A, mpv, w] = p;
  if (!(w > 0)) return { value: NaN, gradient: p.map(() => NaN) };
  const z = (x - mpv) / w;
  const { value, derivative } = landauValueDerivative(z);
  const scaled = value / w;
  return {
    value: b + A * scaled,
    gradient: [
      1,
      scaled,
      -(A / w) * (derivative / w),
      -(A / w) * ((value + (derivative === 0 ? 0 : z * derivative)) / w),
    ],
  };
}
