import { polynomialDegree } from "./polynomialModels";

export const polynomialBasisKinds = ["power", "taylor", "chebyshev"] as const;
export type PolynomialBasisKind = (typeof polynomialBasisKinds)[number];

export type PolynomialBasis =
  | { kind: "power" }
  | { kind: "taylor"; center: number }
  | { kind: "chebyshev"; center: number; scale: number };

export const DEFAULT_POLYNOMIAL_BASIS: PolynomialBasis = { kind: "power" };

export const fourierHarmonicCounts = [1, 2, 3, 4, 5] as const;
export type FourierHarmonics = (typeof fourierHarmonicCounts)[number];

/**
 * A Fourier period and origin are part of the declared model, not fitted
 * parameters. Keeping them here also prevents a later exclusion from silently
 * changing the basis in which the coefficients are reported.
 */
export interface FourierSeriesSettings {
  harmonics: FourierHarmonics;
  period: number;
  origin: number;
}

export const DEFAULT_FOURIER_SETTINGS: FourierSeriesSettings = {
  harmonics: 1,
  period: 2 * Math.PI,
  origin: 0,
};

export function effectivePolynomialBasis(
  basis?: PolynomialBasis,
): PolynomialBasis {
  return basis ?? DEFAULT_POLYNOMIAL_BASIS;
}

/** All three bases span exactly the same degree-n polynomial model space. */
export function polynomialBasisValues(
  x: number,
  degree: number,
  configured?: PolynomialBasis,
): number[] {
  if (!Number.isInteger(degree) || degree < 0 || degree > 10)
    throw Error("Polynomial degree must be an integer from 0 through 10");
  const basis = effectivePolynomialBasis(configured);
  if (basis.kind === "power")
    return Array.from({ length: degree + 1 }, (_, i) => x ** i);
  if (basis.kind === "taylor") {
    const z = x - basis.center;
    const values = [1];
    for (let i = 1; i <= degree; i++) values.push((values[i - 1] / i) * z);
    return values;
  }
  const difference = x - basis.center;
  const z = Number.isFinite(difference)
    ? difference / basis.scale
    : x / basis.scale - basis.center / basis.scale;
  const values = [1];
  if (degree === 0) return values;
  values.push(z);
  for (let i = 2; i <= degree; i++)
    values.push(2 * z * values[i - 1] - values[i - 2]);
  return values;
}

export function fourierBasisValues(
  x: number,
  settings: FourierSeriesSettings,
): number[] {
  const phase = fourierPhase(x, settings.period, settings.origin);
  return [
    1,
    ...Array.from({ length: settings.harmonics }, (_, i) => i + 1).flatMap(
      (harmonic) => [Math.sin(harmonic * phase), Math.cos(harmonic * phase)],
    ),
  ];
}

/**
 * Reduce each coordinate before subtracting so every finite declared X,
 * origin, and positive period reaches trigonometric functions with a small
 * argument. Forming either 2*pi*(x-origin) or (x-origin)/period first can
 * overflow or lose whole-period invariance at large offsets.
 */
export function fourierPhase(
  x: number,
  period: number,
  origin: number,
): number {
  const cycles = (x % period) / period - (origin % period) / period;
  return 2 * Math.PI * (cycles - Math.round(cycles));
}

export function seriesBasisValues(
  x: number,
  model: string,
  polynomialBasis?: PolynomialBasis,
  fourier?: FourierSeriesSettings,
): number[] | null {
  const degree = polynomialDegree(model);
  if (degree !== undefined)
    return polynomialBasisValues(x, degree, polynomialBasis);
  if (model === "fourier")
    return fourierBasisValues(x, fourier ?? DEFAULT_FOURIER_SETTINGS);
  return null;
}

export function fourierParameterNames(harmonics: FourierHarmonics): string[] {
  return [
    "b",
    ...Array.from({ length: harmonics }, (_, i) => i + 1).flatMap(
      (harmonic) => [`s${harmonic}`, `c${harmonic}`],
    ),
  ];
}

export function polynomialParameterNames(degree: number): string[] {
  return Array.from({ length: degree + 1 }, (_, i) => `c${i}`);
}

export function polynomialExpression(
  degree: number,
  basis: PolynomialBasis = DEFAULT_POLYNOMIAL_BASIS,
  coefficient = (i: number) => `c${i}`,
  variable = "x",
): string {
  const centered = centeredExpression(
    variable,
    basis.kind === "power" ? 0 : basis.center,
  );
  if (basis.kind === "power")
    return Array.from({ length: degree + 1 }, (_, i) =>
      i === 0 ? coefficient(i) : `${coefficient(i)}*${variable}^${i}`,
    ).join("+");
  if (basis.kind === "taylor")
    return Array.from({ length: degree + 1 }, (_, i) => {
      if (i === 0) return coefficient(i);
      const term = `${coefficient(i)}*${centered}^${i}`;
      return i === 1 ? term : `${term}/${factorial(i)}`;
    }).join("+");
  const z = `(${centeredExpression(variable, basis.center)}/${numberExpression(
    basis.scale,
  )})`;
  const chebyshev = chebyshevPolynomialCoefficients(degree);
  return Array.from({ length: degree + 1 }, (_, i) =>
    i === 0
      ? coefficient(i)
      : `${coefficient(i)}*(${powerExpression(chebyshev[i], z)})`,
  ).join("+");
}

/** Evaluation form used when a Taylor polynomial becomes a custom equation.
 * Horner evaluation scales each derivative coefficient before multiplying by
 * the centered coordinate, avoiding an overflowing z^i intermediate. */
export function polynomialEvaluationExpression(
  degree: number,
  basis: PolynomialBasis = DEFAULT_POLYNOMIAL_BASIS,
  coefficient = (i: number) => `c${i}`,
  variable = "x",
): string {
  if (basis.kind !== "taylor")
    return polynomialExpression(degree, basis, coefficient, variable);
  const centered = centeredExpression(variable, basis.center);
  let expression = coefficient(degree);
  if (degree > 1) expression += `/${factorial(degree)}`;
  for (let i = degree - 1; i >= 0; i--) {
    const term = `${coefficient(i)}${i > 1 ? `/${factorial(i)}` : ""}`;
    expression = `${term}+${centered}*(${expression})`;
  }
  return expression;
}

export function fourierExpression(
  settings: FourierSeriesSettings,
  variable = "x",
): string {
  const period = numberExpression(settings.period),
    origin = numberExpression(settings.origin),
    // The restricted custom-expression language renders % as floating-point
    // remainder. Separate remainders avoid overflowing x-origin and keep the
    // eventual trigonometric argument small without needing a round function.
    cycles = `(((${variable}%${period})/${period})-((${origin}%${period})/${period}))`,
    phase = `(2*pi*${cycles})`;
  return [
    "b",
    ...Array.from({ length: settings.harmonics }, (_, i) => i + 1).flatMap(
      (harmonic) => [
        `s${harmonic}*sin(${harmonic}*${phase})`,
        `c${harmonic}*cos(${harmonic}*${phase})`,
      ],
    ),
  ].join("+");
}

export function seriesEquation(
  model: string,
  polynomialBasis?: PolynomialBasis,
  fourier?: FourierSeriesSettings,
): string | null {
  const degree = polynomialDegree(model);
  if (degree !== undefined)
    return `y = ${polynomialExpression(degree, effectivePolynomialBasis(polynomialBasis))}`;
  if (model === "fourier") {
    if (!fourier) throw Error("Fourier settings are required");
    return `y = ${fourierExpression(fourier)}`;
  }
  return null;
}

function factorial(n: number): number {
  let value = 1;
  for (let i = 2; i <= n; i++) value *= i;
  return value;
}

/** Coefficients of T_n(z), ascending in powers of z. */
function chebyshevPolynomialCoefficients(degree: number): number[][] {
  const values: number[][] = [[1]];
  if (degree === 0) return values;
  values.push([0, 1]);
  for (let order = 2; order <= degree; order++) {
    const next = Array(order + 1).fill(0) as number[];
    for (let power = 0; power < values[order - 1].length; power++)
      next[power + 1] += 2 * values[order - 1][power];
    for (let power = 0; power < values[order - 2].length; power++)
      next[power] -= values[order - 2][power];
    values.push(next);
  }
  return values;
}

function powerExpression(coefficients: readonly number[], variable: string) {
  const terms: string[] = [];
  coefficients.forEach((coefficient, power) => {
    if (coefficient === 0) return;
    const magnitude = Math.abs(coefficient),
      variablePower = power === 1 ? variable : `${variable}^${power}`,
      term =
        power === 0
          ? numberExpression(magnitude)
          : magnitude === 1
            ? variablePower
            : `${numberExpression(magnitude)}*${variablePower}`;
    terms.push(`${coefficient < 0 ? "-" : terms.length ? "+" : ""}${term}`);
  });
  return terms.join("") || "0";
}

function centeredExpression(variable: string, center: number) {
  return center < 0
    ? `(${variable}+${numberExpression(-center)})`
    : `(${variable}-${numberExpression(center)})`;
}

function numberExpression(value: number): string {
  return Object.is(value, -0) ? "0" : String(value);
}
