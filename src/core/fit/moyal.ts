// The two roots of z + exp(-z) = 1 + 2*ln(2), computed once.
export const MOYAL_HALF_MAX_LEFT = -1.3063401677698052;
export const MOYAL_HALF_MAX_RIGHT = 2.284465930025749;
export const MOYAL_FWHM = MOYAL_HALF_MAX_RIGHT - MOYAL_HALF_MAX_LEFT;

/** Unit-area standard Moyal density, with its mode at zero.
 * f(z) = exp(-(z + exp(-z))/2)/sqrt(2*pi).
 * The far-left guard is beyond double-precision underflow for both f and f'.
 */
export function moyalValueDerivative(z: number) {
  if (Number.isNaN(z)) return { value: NaN, derivative: NaN };
  if (!Number.isFinite(z) || z < -8) return { value: 0, derivative: 0 };
  const logValue = -0.5 * (z + Math.exp(-z)) - 0.5 * Math.log(2 * Math.PI);
  const slope = 0.5 * Math.expm1(-z);
  return {
    value: Math.exp(logValue),
    // Evaluate in log space to retain tiny derivatives when f underflows.
    derivative:
      slope === 0
        ? 0
        : Math.sign(slope) * Math.exp(logValue + Math.log(Math.abs(slope))),
  };
}

/** b + A/w * moyal((x-mpv)/w); A is signed area above background. */
export function moyalValueGradient(x: number, p: readonly number[]) {
  const [b, A, mpv, w] = p;
  if (!(w > 0)) return { value: NaN, gradient: p.map(() => NaN) };
  const z = (x - mpv) / w;
  const { value, derivative } = moyalValueDerivative(z);
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
