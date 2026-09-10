import {
  customValueGradient,
  customIsLinear,
  type CustomEquation,
} from "./customEquation";
import {
  nonlinearValueGradient,
  isNonlinearModel,
  nonlinearIsFree,
} from "./nonlinearModels";
import { nonlinearSolve } from "./nonlinearSolve";
import { searchPeriod } from "./periodSearch";
import {
  requestSchema,
  sessionSchema,
  sessionVersion,
  sessionEngine,
  type FitRequest,
  type FitSettings,
} from "./schema";
import { gammaQ, studentCritical95 } from "./probability";
export const ENGINE = "qr-vp-sine-2" as const;
export { RANK_TOLERANCE } from "./qr";
import { qr, RANK_TOLERANCE } from "./qr";
export type Statistic = { value: number | null; reason: string | null };
const stat = (
  value: number | null,
  reason: string | null = null,
): Statistic => ({ value, reason });
export interface FitResult {
  engine: "qr-vp-sine-2" | "qr-lm-3" | "qr-expression-4";
  coefficients: number[];
  covariance: number[][] | null;
  standardErrors: Statistic[];
  intervals: ([number, number] | null)[];
  residuals: {
    id: string;
    x: number;
    y: number;
    predicted: number;
    residual: number;
  }[];
  n: number;
  rank: number;
  df: number;
  sse: number;
  rms: number;
  scatter: Statistic;
  weightedObjective: Statistic;
  reducedObjective: Statistic;
  q: Statistic;
  rSquared: Statistic;
  inference: "supported" | "conditional" | "descriptive";
  warnings: string[];
  rankTolerance: number;
  diagonalRatio: number;
}
export function basis(
  x: number,
  model: FitSettings["model"],
  sinePeriod = 2 * Math.PI,
  shape?: number,
): number[] {
  if (model === "custom" || isNonlinearModel(model))
    throw Error("Nonlinear models require parameter-dependent evaluation");
  switch (model) {
    case "line":
      return [1, x];
    case "quadratic":
      return [1, x, x * x];
    case "cubic":
      return [1, x, x * x, x ** 3];
    case "quartic":
      return [1, x, x * x, x ** 3, x ** 4];
    // x is normalized by one declared x-unit, so the logarithm is dimensionless.
    case "exponential":
      return [1, Math.exp((shape ?? -1) * x)];
    case "power-law":
      return [1, x > 0 ? x ** (shape ?? 2) : NaN];
    case "reciprocal":
      return [1, x > 0 ? 1 / x : NaN];
    case "sine-free-period":
    case "sine":
      return [
        1,
        Math.sin((2 * Math.PI * x) / sinePeriod),
        Math.cos((2 * Math.PI * x) / sinePeriod),
      ];
    case "logarithmic":
      return [1, x > 0 ? Math.log(x) : NaN];
    case "constant-acceleration":
      return [1, x, 0.5 * x * x];
  }
}
export function predict(
  x: number,
  model: FitSettings["model"],
  coefficients: readonly number[],
  sinePeriod = 2 * Math.PI,
  shape?: number,
  custom?: CustomEquation,
) {
  if (model === "custom")
    return custom ? customValueGradient(x, custom, coefficients).value : NaN;
  if (isNonlinearModel(model))
    return nonlinearValueGradient(x, model, coefficients).value;
  if (model === "sine-free-period")
    return (
      coefficients[0] +
      coefficients[1] * Math.sin((2 * Math.PI * x) / coefficients[3]) +
      coefficients[2] * Math.cos((2 * Math.PI * x) / coefficients[3])
    );
  return basis(x, model, sinePeriod, shape).reduce(
    (sum, v, i) => sum + v * coefficients[i],
    0,
  );
}
export function modelGradient(
  x: number,
  settings: FitSettings,
  coefficients: readonly number[],
) {
  if (settings.model === "custom")
    return customValueGradient(x, settings.custom!, coefficients).gradient.map(
      (v, i) => (settings.parameters[i].fixed ? 0 : v),
    );
  if (isNonlinearModel(settings.model))
    return nonlinearValueGradient(x, settings.model, coefficients).gradient;
  if (settings.model !== "sine-free-period")
    return basis(x, settings.model, settings.sinePeriod, settings.shape);
  const [b, s, c, T] = coefficients;
  void b;
  const phase = (2 * Math.PI * x) / T;
  return [
    1,
    Math.sin(phase),
    Math.cos(phase),
    ((2 * Math.PI * x) / (T * T)) * (c * Math.sin(phase) - s * Math.cos(phase)),
  ];
}
export function fit(request: FitRequest, settings: FitSettings): FitResult {
  sessionSchema.parse({
    format: "tracker-fit-session",
    version: sessionVersion(settings),
    request,
    settings,
    engine: sessionEngine(settings),
  });
  if (
    settings.model === "constant-acceleration" &&
    !settings.physicalTimeConfirmed
  )
    throw Error(
      "Confirm that the independent variable represents physical time",
    );
  const excluded = new Set(settings.excludedIds);
  const rows = request.dataset.rows.filter(
    (row) => row.included && !excluded.has(row.id),
  );
  if (!rows.length) throw Error("No included observations");
  const u = request.uncertainty,
    known = u.kind !== "unknown-equal";
  const sigma = rows.map((row) =>
    u.kind === "supplied-common"
      ? u.sigmaY
      : u.kind === "supplied-per-row"
        ? u.sigmaByRow[row.id]
        : 1,
  );
  const free = settings.parameters.flatMap((p, i) => (p.fixed ? [] : [i]));
  if (
    ["logarithmic", "power-law", "power-law-free", "reciprocal"].includes(
      settings.model,
    ) &&
    rows.some((row) => row.x! <= 0)
  )
    throw Error(
      "This model requires x > 0 for every included observation. Exclude nonpositive rows or select another model.",
    );
  const coefficients = settings.parameters.map((p) => p.value);
  const linearSolve = (period?: number) => {
    const isSine = settings.model === "sine-free-period";
    const design = rows.map((row) =>
      basis(
        row.x!,
        isSine ? "sine" : settings.model,
        period ?? settings.sinePeriod,
        settings.shape,
      ),
    );
    const linearFree = free.filter((j) => !isSine || j < 3);
    const response = rows.map(
      (row, i) =>
        (row.y! -
          design[i].reduce(
            (sum, v, j) =>
              sum + (settings.parameters[j].fixed ? v * coefficients[j] : 0),
            0,
          )) /
        sigma[i],
    );
    const columns = linearFree.map((j) =>
      design.map((row, i) => row[j] / sigma[i]),
    );
    if ([...response, ...columns.flat()].some((v) => !Number.isFinite(v)))
      throw Error("Numerical overflow in weighted design");
    const solved = qr(columns, response);
    const values = coefficients.slice();
    linearFree.forEach((j, k) => (values[j] = solved.coefficients[k]));
    if (isSine) values[3] = period!;
    const objective = rows.reduce(
      (sum, row, i) =>
        sum +
        ((row.y! -
          predict(
            row.x!,
            settings.model,
            values,
            settings.sinePeriod,
            settings.shape,
          )) /
          sigma[i]) **
          2,
      0,
    );
    return { solved, values, objective };
  };
  const nonlinear =
    (settings.model === "sine-free-period" && !settings.parameters[3].fixed) ||
    nonlinearIsFree(settings) ||
    (settings.model === "custom" && !customIsLinear(settings.custom!, free));
  let searchIssue: string | null = null;
  let solved: ReturnType<typeof qr>;
  if (settings.model === "custom") {
    const evaluate = (x: number, p: readonly number[]) =>
      customValueGradient(x, settings.custom!, p);
    for (const row of rows) {
      const point = evaluate(row.x!, coefficients);
      if (
        !Number.isFinite(point.value) ||
        free.some((j) => !Number.isFinite(point.gradient[j]))
      )
        throw Error(
          `Equation is undefined or has an invalid derivative at x = ${row.x} (row ${row.id}). Check its domain and starting values.`,
        );
    }
    if (nonlinear)
      coefficients.splice(
        0,
        coefficients.length,
        ...nonlinearSolve(
          evaluate,
          rows.map((r) => r.x!),
          rows.map((r) => r.y!),
          sigma,
          coefficients,
          free,
        ),
      );
    else {
      const base = coefficients.map((v, i) => (free.includes(i) ? 0 : v));
      const points = rows.map((r) => evaluate(r.x!, base));
      const linear = qr(
        free.map((j) => points.map((p, i) => p.gradient[j] / sigma[i])),
        rows.map((r, i) => (r.y! - points[i].value) / sigma[i]),
      );
      free.forEach((j, i) => (coefficients[j] = linear.coefficients[i]));
    }
    const points = rows.map((r) => evaluate(r.x!, coefficients));
    solved = qr(
      free.map((j) => points.map((p, i) => p.gradient[j] / sigma[i])),
      rows.map(() => 0),
    );
  } else if (isNonlinearModel(settings.model)) {
    coefficients.splice(
      0,
      coefficients.length,
      ...nonlinearSolve(
        settings.model,
        rows.map((r) => r.x!),
        rows.map((r) => r.y!),
        sigma,
        coefficients,
        free,
      ),
    );
    const jacobian = rows.map((row) =>
      modelGradient(row.x!, settings, coefficients),
    );
    solved = qr(
      free.map((j) => jacobian.map((row, i) => row[j] / sigma[i])),
      rows.map(() => 0),
    );
  } else if (settings.model === "sine-free-period") {
    let period = coefficients[3];
    if (nonlinear) {
      let work = 0;
      const xs = rows.map((r) => r.x!);
      const span =
        xs.reduce((a, b) => Math.max(a, b), -Infinity) -
        xs.reduce((a, b) => Math.min(a, b), Infinity);
      const search = searchPeriod(
        settings.periodMin!,
        settings.periodMax!,
        span,
        (T) => {
          work += rows.length;
          if (work > 20000000)
            throw Error(
              "Period search work limit exceeded; narrow the range or use fewer observations",
            );
          try {
            return linearSolve(T).objective;
          } catch (e) {
            if (String(e).includes("Rank deficient")) return Infinity;
            throw e;
          }
        },
      );
      period = search.period;
      const best = linearSolve(period);
      const noiseScale = known
        ? 1
        : best.objective / Math.max(1, rows.length - free.length);
      if (search.boundary) searchIssue = "period-at-search-boundary";
      else if (
        search.competing.some(
          (c) => c.objective - best.objective <= Math.max(1e-12, noiseScale),
        )
      )
        searchIssue = "competing-period-minima";
    }
    coefficients.splice(0, coefficients.length, ...linearSolve(period).values);
    if (
      nonlinear &&
      Math.hypot(coefficients[1], coefficients[2]) <=
        64 * Number.EPSILON * Math.max(1, Math.abs(coefficients[0]))
    )
      throw Error(
        "Sine period is unidentifiable: fitted oscillation amplitude is zero",
      );
    const jacobian = rows.map((row) =>
      modelGradient(row.x!, settings, coefficients),
    );
    solved = qr(
      free.map((j) => jacobian.map((row, i) => row[j] / sigma[i])),
      rows.map(() => 0),
    );
  } else {
    const result = linearSolve();
    solved = result.solved;
    coefficients.splice(0, coefficients.length, ...result.values);
  }
  const residuals = rows.map((row) => {
    const predicted = predict(
      row.x!,
      settings.model,
      coefficients,
      settings.sinePeriod,
      settings.shape,
      settings.custom,
    );
    return {
      id: row.id,
      x: row.x!,
      y: row.y!,
      predicted,
      residual: row.y! - predicted,
    };
  });
  const sse = residuals.reduce((s, r) => s + r.residual * r.residual, 0),
    n = rows.length,
    df = n - free.length;
  const objective = residuals.reduce(
    (s, r, i) => s + (r.residual / sigma[i]) ** 2,
    0,
  );
  if (
    !Number.isFinite(sse + objective) ||
    coefficients.some((v) => !Number.isFinite(v))
  )
    throw Error("Numerical overflow in fit result");
  const assumptions = Object.values(request.dataset.assumptions);
  const falseAssumption =
    assumptions.includes("known-false") ||
    u.errorStructure === "known-correlated";
  const unknown =
    assumptions.includes("unknown") || u.errorStructure === "unknown";
  const inference =
    falseAssumption || (unknown && !settings.conditionalInference)
      ? "descriptive"
      : unknown
        ? "conditional"
        : "supported";
  const reason = searchIssue
    ? searchIssue
    : inference === "descriptive"
      ? "unsupported-assumptions"
      : !known && df === 0
        ? "zero-degrees-of-freedom"
        : !known && sse === 0
          ? "zero-residual-scale"
          : null;
  const covariance = reason
    ? null
    : Array.from(
        { length: coefficients.length },
        () => Array(coefficients.length).fill(0) as number[],
      );
  if (covariance)
    free.forEach((j, a) =>
      free.forEach(
        (k, b) =>
          (covariance[j][k] = solved.covariance[a][b] * (known ? 1 : sse / df)),
      ),
    );
  if (covariance?.flat().some((v) => !Number.isFinite(v)))
    throw Error("Numerical overflow in covariance");
  const standardErrors = settings.parameters.map((p, j) =>
    p.fixed
      ? stat(null, "fixed")
      : reason
        ? stat(null, reason)
        : stat(Math.sqrt(covariance![j][j])),
  );
  const critical = reason
    ? 0
    : known
      ? 1.959963984540054
      : df > 0
        ? studentCritical95(df)
        : 0;
  const intervals = standardErrors.map((e, j): [number, number] | null =>
    e.value === null
      ? null
      : [
          coefficients[j] - critical * e.value,
          coefficients[j] + critical * e.value,
        ],
  );
  const mean = rows.reduce((s, r) => s + r.y! / n, 0),
    sst = rows.reduce((s, r) => s + (r.y! - mean) ** 2, 0);
  const warnings: string[] = [];
  if (
    nonlinear &&
    (settings.model === "custom" || isNonlinearModel(settings.model))
  )
    warnings.push(
      "Nonlinear fit uses a local optimizer from the stated starting values; other minima may exist. Errors, parameter intervals and mean bands use a local linear approximation, not exact linear-model coverage. Q is unavailable. Try different starting values, especially for oscillations.",
    );
  else if (nonlinear)
    warnings.push(
      "Period fitted by bounded frequency search. Errors and bands use a local linear approximation, not exact linear-model coverage; Q is unavailable. Aliases outside the range are not tested.",
    );
  if (searchIssue)
    warnings.push(
      searchIssue === "period-at-search-boundary"
        ? "Best period is at a search limit: widen or reconsider the range. Parameter errors and bands are unavailable."
        : "Competing period minima: the period is ambiguous. Parameter errors and bands are unavailable.",
    );
  if (inference === "descriptive")
    warnings.push(
      "Descriptive only: inference assumptions are unsupported or unaccepted.",
    );
  if (inference === "conditional")
    warnings.push(
      "Inference is conditional on the assumptions you accepted; they are not verified.",
    );
  if (settings.selectionAfterInspection)
    warnings.push(
      "Nominal intervals do not account for selection after inspecting data or residuals.",
    );
  if (reason === "zero-residual-scale")
    warnings.push(
      "Zero residual scatter does not establish perfect experimental precision.",
    );
  if (solved.diagonalRatio > 1e8)
    warnings.push(
      "Poorly conditioned design: interpret coefficient precision cautiously.",
    );
  return {
    engine: sessionEngine(settings),
    coefficients,
    covariance,
    standardErrors,
    intervals,
    residuals,
    n,
    rank: free.length,
    df,
    sse,
    rms: Math.sqrt(sse / n),
    scatter:
      !known && df > 0
        ? stat(Math.sqrt(sse / df))
        : stat(
            null,
            known ? "supplied-uncertainty" : "zero-degrees-of-freedom",
          ),
    weightedObjective: known
      ? stat(objective)
      : stat(null, "unknown-noise-scale"),
    reducedObjective:
      known && df > 0
        ? stat(objective / df)
        : stat(null, known ? "zero-degrees-of-freedom" : "unknown-noise-scale"),
    q:
      known && df > 0 && inference !== "descriptive" && !nonlinear
        ? stat(gammaQ(df / 2, objective / 2))
        : stat(
            null,
            nonlinear
              ? "nonlinear-reference-distribution"
              : !known
                ? "unknown-noise-scale"
                : df === 0
                  ? "zero-degrees-of-freedom"
                  : "unsupported-assumptions",
          ),
    rSquared: sst > 0 ? stat(1 - sse / sst) : stat(null, "zero-variance"),
    inference,
    warnings,
    rankTolerance: RANK_TOLERANCE,
    diagonalRatio: solved.diagonalRatio,
  };
}
// Boundary convenience for callers receiving untrusted JSON.
export function parseRequest(value: unknown) {
  return requestSchema.parse(value);
}
