import type { FitRequest, FitSettings } from "./schema";
export const nonlinearModelIds = [
  "exponential-decay",
  "power-law-free",
  "gaussian",
  "damped-sine",
  "lorentzian",
] as const;
export type NonlinearModel = (typeof nonlinearModelIds)[number];
export const nonlinearModels = {
  "exponential-decay": {
    label: "Exponential · fit decay time",
    names: ["b", "A", "tau"],
    positive: [2],
    linear: 2,
    equation: "y = b + A exp(−x/τ)",
    defaults: [0, 1, 1],
  },
  "power-law-free": {
    label: "Power law · fit exponent",
    names: ["b", "A", "n"],
    positive: [],
    linear: 2,
    equation: "y = b + A (x/xref)ⁿ; xref = 1 x-unit",
    defaults: [0, 1, 2],
  },
  gaussian: {
    label: "Gaussian peak",
    names: ["b", "A", "mu", "sigma"],
    positive: [3],
    linear: 2,
    equation: "y = b + A exp[−½((x−μ)/σ)²]",
    defaults: [0, 1, 0, 1],
  },
  "damped-sine": {
    label: "Damped oscillation",
    names: ["b", "s", "c", "T", "tau"],
    positive: [3, 4],
    linear: 3,
    equation: "y = b + exp(−x/τ)[s sin(2πx/T) + c cos(2πx/T)]",
    defaults: [0, 1, 0, 1, 3],
  },
  lorentzian: {
    label: "Lorentzian peak",
    names: ["b", "A", "mu", "gamma"],
    positive: [3],
    linear: 2,
    equation: "y = b + A/[1 + ((x−μ)/γ)²]",
    defaults: [0, 1, 0, 1],
  },
} satisfies Record<
  NonlinearModel,
  {
    label: string;
    names: string[];
    positive: number[];
    linear: number;
    equation: string;
    defaults: number[];
  }
>;
export function isNonlinearModel(model: string): model is NonlinearModel {
  return Object.hasOwn(nonlinearModels, model);
}
/** Value and analytic derivatives in the user's physical parameter basis. */
export function nonlinearValueGradient(
  x: number,
  model: NonlinearModel,
  p: readonly number[],
) {
  const [b, A, c, d, e] = p;
  let value: number, gradient: number[];
  switch (model) {
    case "exponential-decay": {
      const q = Math.exp(-x / c);
      value = b + A * q;
      gradient = [1, q, (A * q * x) / (c * c)];
      break;
    }
    case "power-law-free": {
      const q = x > 0 ? Math.exp(c * Math.log(x)) : NaN;
      value = b + A * q;
      gradient = [1, q, A * q * Math.log(x)];
      break;
    }
    case "gaussian": {
      const z = (x - c) / d,
        q = Math.exp(-0.5 * z * z);
      value = b + A * q;
      gradient = [1, q, (A * q * z) / d, (A * q * z * z) / d];
      break;
    }
    case "lorentzian": {
      const z = (x - c) / d,
        q = 1 / (1 + z * z);
      value = b + A * q;
      gradient = [1, q, (2 * A * z * q * q) / d, (2 * A * z * z * q * q) / d];
      break;
    }
    case "damped-sine": {
      const phase = (2 * Math.PI * x) / d,
        sn = Math.sin(phase),
        cs = Math.cos(phase),
        q = Math.exp(-x / e),
        wave = A * sn + c * cs;
      value = b + q * wave;
      gradient = [
        1,
        q * sn,
        q * cs,
        ((q * 2 * Math.PI * x) / (d * d)) * (c * sn - A * cs),
        (q * wave * x) / (e * e),
      ];
      break;
    }
  }
  return { value, gradient };
}
export function nonlinearParameterUnit(
  model: NonlinearModel,
  i: number,
  xUnit: string | null,
  yUnit: string | null,
) {
  if (model === "power-law-free" && i === 2) return "1";
  return i < nonlinearModels[model].linear ? (yUnit ?? "?") : (xUnit ?? "?");
}
/** Suggestions are created only when the user explicitly chooses a model; never fit on import. */
export function suggestedParameters(
  model: NonlinearModel,
  request: FitRequest,
  excludedIds: string[],
): number[] {
  const rows = request.dataset.rows
    .filter(
      (r) =>
        r.included &&
        r.x !== null &&
        r.y !== null &&
        !excludedIds.includes(r.id),
    )
    .slice()
    .sort((a, b) => a.x! - b.x!);
  if (rows.length < 2) return nonlinearModels[model].defaults.slice();
  const lo = rows[0].x!,
    hi = rows.at(-1)!.x!,
    span = hi - lo || 1;
  const min = rows.reduce((a, r) => Math.min(a, r.y!), Infinity),
    max = rows.reduce((a, r) => Math.max(a, r.y!), -Infinity),
    amplitude = max - min || 1;
  if (model === "gaussian" || model === "lorentzian") {
    const baseline = (rows[0].y! + rows.at(-1)!.y!) / 2;
    const peak = rows.reduce((a, r) =>
      Math.abs(r.y! - baseline) > Math.abs(a.y! - baseline) ? r : a,
    );
    return [baseline, peak.y! - baseline || 1, peak.x!, span / 6];
  }
  if (model === "exponential-decay") {
    const tau = span / 2;
    return [
      rows.at(-1)!.y!,
      (rows[0].y! - rows.at(-1)!.y!) * Math.exp(lo / tau) || 1,
      tau,
    ];
  }
  if (model === "power-law-free")
    return [0, rows.at(-1)!.y! / (hi > 0 ? hi : 1) || 1, 1];
  const mean = rows.reduce((s, r) => s + r.y! / rows.length, 0);
  const crossings = rows
    .slice(1)
    .flatMap((r, i) =>
      rows[i].y! <= mean && r.y! > mean
        ? [
            rows[i].x! +
              ((r.x! - rows[i].x!) * (mean - rows[i].y!)) / (r.y! - rows[i].y!),
          ]
        : [],
    );
  const T =
    crossings.length >= 2
      ? (crossings.at(-1)! - crossings[0]) / (crossings.length - 1)
      : span / 3;
  return [mean, amplitude / 2, amplitude / 4, T, span];
}
export function nonlinearIsFree(settings: FitSettings) {
  return (
    isNonlinearModel(settings.model) &&
    settings.parameters.some(
      (p, i) =>
        !p.fixed &&
        i >= nonlinearModels[settings.model as NonlinearModel].linear,
    )
  );
}
