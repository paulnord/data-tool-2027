import { qr } from "./qr";
import {
  nonlinearModels,
  nonlinearValueGradient,
  type NonlinearModel,
} from "./nonlinearModels";
/** Scaled damped Gauss–Newton steps solved as augmented least squares by QR.
 * Never form normal equations. Positive widths/times are enforced on every trial.
 * A local optimizer: starts are explicit, no claim of global optimality. */
export function nonlinearSolve(
  model:
    | NonlinearModel
    | ((
        x: number,
        p: readonly number[],
      ) => { value: number; gradient: number[] }),
  x: number[],
  y: number[],
  sigma: number[],
  initial: number[],
  free: number[],
) {
  const positive: readonly number[] =
    typeof model === "function" ? [] : nonlinearModels[model].positive;
  let work = 0;
  const evaluate = (p: number[]) => {
    work += x.length;
    if (work > 20_000_000)
      throw Error(
        "Nonlinear work limit exceeded; use fewer observations or improve starting values",
      );
    if (positive.some((j) => !(p[j] > 0)) || p.some((v) => !Number.isFinite(v)))
      return null;
    const points = x.map((v) =>
      typeof model === "function"
        ? model(v, p)
        : nonlinearValueGradient(v, model, p),
    );
    const residual = points.map((r, i) => (y[i] - r.value) / sigma[i]);
    const columns = free.map((j) =>
      points.map((r, i) => r.gradient[j] / sigma[i]),
    );
    const objective = residual.reduce((a, b) => a + b * b, 0);
    return Number.isFinite(objective) &&
      columns.every((c) => c.every(Number.isFinite))
      ? { residual, columns, objective }
      : null;
  };
  let p = initial.slice(),
    current = evaluate(p);
  if (!current)
    throw Error("Invalid nonlinear starting values or numerical overflow");
  if (!free.length) return p;
  if (x.length < free.length)
    throw Error(
      `Rank deficient: at most ${x.length} independent columns for ${free.length} free parameters`,
    );
  let lambda = 1e-3;
  for (let iteration = 0; iteration < 300; iteration++) {
    const scales = current.columns.map((c) =>
      c.reduce((s, v) => Math.hypot(s, v), 0),
    );
    const gradient = current.columns.map(
      (c, j) =>
        c.reduce((a, v, i) => a + v * current!.residual[i], 0) /
        (scales[j] || 1),
    );
    if (
      current.objective === 0 ||
      Math.max(...gradient.map(Math.abs)) <=
        1e-10 * Math.sqrt(current.objective)
    )
      return p;
    // If an undamped Gauss–Newton step cannot reduce the sum by more than
    // floating-point accumulation error, stricter objective comparisons stall.
    // Check the full projected residual, including column correlations.
    try {
      const gn = qr(current.columns, current.residual).coefficients;
      const reduction = x.reduce((sum, _, i) => {
        const change = current!.columns.reduce(
          (s, c, j) => s + c[i] * gn[j],
          0,
        );
        return sum + change * change;
      }, 0);
      if (reduction <= 32 * Number.EPSILON * current.objective) return p;
    } catch (error) {
      if (!String(error).includes("Rank deficient")) throw error;
      // Damping may escape an initially singular Jacobian. The final rank is
      // always assessed on the undamped physical Jacobian by the caller.
    }
    let accepted = false;
    for (let trial = 0; trial < 30; trial++) {
      const columns = current.columns.map((c, j) => [
        ...c.map((v) => v / (scales[j] || 1)),
        ...free.map((_, k) => (j === k ? Math.sqrt(lambda) : 0)),
      ]);
      const step = qr(columns, [
        ...current.residual,
        ...free.map(() => 0),
      ]).coefficients.map((v, j) => v / (scales[j] || 1));
      const candidate = p.slice();
      free.forEach((j, k) => (candidate[j] += step[k]));
      const next = evaluate(candidate);
      if (next && next.objective < current.objective) {
        const small = step.every(
          (v, j) =>
            Math.abs(v) <=
            1e-10 * (Math.abs(p[free[j]]) + 1 / (scales[j] || 1)),
        );
        p = candidate;
        current = next;
        lambda = Math.max(1e-12, lambda / 3);
        accepted = true;
        if (small) return p;
        break;
      }
      // Floating-point stationarity only after a small *undamped* step.
      if (
        lambda <= 1e-6 &&
        step.every(
          (v, j) =>
            Math.abs(v) <=
            1e-10 * (Math.abs(p[free[j]]) + 1 / (scales[j] || 1)),
        )
      )
        return p;
      lambda *= 10;
      if (!Number.isFinite(lambda)) break;
    }
    if (!accepted)
      throw Error(
        "Nonlinear fit did not converge; revise starting values or fix weakly determined parameters",
      );
  }
  throw Error("Nonlinear iteration limit exceeded; revise starting values");
}
