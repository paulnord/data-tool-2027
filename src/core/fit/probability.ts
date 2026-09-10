// Lanczos log-gamma; series/continued fractions use binary64 relative convergence.
// Validated against independent analytic and published quantiles in tests.
export function logGamma(z: number): number {
  const c = [
    676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.13857109526572012,
    9.984369578019572e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5)
    return (
      Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z)
    );
  z -= 1;
  let x = 0.9999999999998099;
  c.forEach((v, i) => (x += v / (z + i + 1)));
  const t = z + 7.5;
  return (
    0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
  );
}
export function gammaQ(a: number, x: number): number {
  if (!(a > 0) || !(x >= 0) || !Number.isFinite(a + x))
    throw Error("Invalid gamma arguments");
  if (x === 0) return 1;
  const factor = Math.exp(-x + a * Math.log(x) - logGamma(a));
  if (x < a + 1) {
    let term = 1 / a,
      sum = term;
    for (let n = 1; n < 10000; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 2e-15)
        return Math.max(0, Math.min(1, 1 - sum * factor));
    }
  } else {
    let b = x + 1 - a,
      c = 1e300,
      d = 1 / b,
      h = d;
    for (let i = 1; i < 10000; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c;
      if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < 2e-15)
        return Math.max(0, Math.min(1, h * factor));
    }
  }
  throw Error("Gamma probability did not converge");
}
function betaFraction(a: number, b: number, x: number) {
  let c = 1,
    d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < 1e-300) d = 1e-300;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < 10000; m++) {
    for (const aa of [
      (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m)),
      (-(a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1)),
    ]) {
      d = 1 + aa * d;
      if (Math.abs(d) < 1e-300) d = 1e-300;
      c = 1 + aa / c;
      if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (aa < 0 && Math.abs(delta - 1) < 2e-15) return h;
    }
  }
  throw Error("Beta probability did not converge");
}
export function betaI(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const f = Math.exp(
    logGamma(a + b) -
      logGamma(a) -
      logGamma(b) +
      a * Math.log(x) +
      b * Math.log1p(-x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (f * betaFraction(a, b, x)) / a
    : 1 - (f * betaFraction(b, a, 1 - x)) / b;
}
export function studentCritical95(df: number): number {
  if (!(df > 0)) throw Error("Positive degrees of freedom required");
  let lo = 0,
    hi = 64;
  for (let i = 0; i < 70; i++) {
    const mid = (lo + hi) / 2;
    const tail = 0.5 * betaI(df / (df + mid * mid), df / 2, 0.5);
    if (tail > 0.025) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
