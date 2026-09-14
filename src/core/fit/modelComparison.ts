import type { FitRequest, FitSettings } from "./schema";
import type { FitResult, Statistic } from "./solve";

export interface ComparisonCandidate {
  id: string;
  label: string;
  request: FitRequest;
  settings: FitSettings;
  result: FitResult;
}

type ComparableFit = Pick<
  ComparisonCandidate,
  "label" | "request" | "settings"
>;

export interface ComparisonMetrics {
  id: string;
  label: string;
  model: FitSettings["model"];
  n: number;
  modelParameters: number;
  likelihoodParameters: number;
  objective: number;
  logLikelihood: Statistic;
  aic: Statistic;
  aicc: Statistic;
  deltaAicc: Statistic;
  akaikeWeight: Statistic;
  bic: Statistic;
  inference: FitResult["inference"];
  warnings: string[];
}

export interface ModelComparison {
  compatible: boolean;
  reasons: string[];
  metrics: ComparisonMetrics[];
}

function observations(candidate: ComparableFit) {
  const excluded = new Set(candidate.settings.excludedIds);
  return candidate.request.dataset.rows.flatMap((row) => {
    if (
      !row.included ||
      excluded.has(row.id) ||
      row.x === null ||
      row.y === null
    )
      return [];
    const uncertainty = candidate.request.uncertainty;
    const sigma =
      uncertainty.kind === "supplied-common"
        ? uncertainty.sigmaY
        : uncertainty.kind === "supplied-per-row"
          ? uncertainty.sigmaByRow[row.id]
          : null;
    return [[row.x, row.y, sigma] as const];
  });
}

/** Explain every mismatch instead of silently comparing different likelihoods. */
export function comparisonCompatibility(
  reference: ComparableFit,
  candidate: ComparableFit,
) {
  const reasons: string[] = [];
  const a = reference.request;
  const b = candidate.request;
  if (
    a.dataset.xColumn.id !== b.dataset.xColumn.id ||
    a.dataset.xColumn.label !== b.dataset.xColumn.label ||
    a.dataset.xColumn.unit !== b.dataset.xColumn.unit ||
    a.dataset.yColumn.id !== b.dataset.yColumn.id ||
    a.dataset.yColumn.label !== b.dataset.yColumn.label ||
    a.dataset.yColumn.unit !== b.dataset.yColumn.unit
  )
    reasons.push("x/y assignments or units differ");
  const knownA = a.uncertainty.kind !== "unknown-equal";
  const knownB = b.uncertainty.kind !== "unknown-equal";
  if (knownA !== knownB) reasons.push("noise-scale treatments differ");
  if (a.uncertainty.errorStructure !== b.uncertainty.errorStructure)
    reasons.push("error-structure assumptions differ");
  if (
    reference.settings.conditionalInference !==
    candidate.settings.conditionalInference
  )
    reasons.push("conditional-inference acceptance differs");
  if (
    JSON.stringify(a.dataset.assumptions) !==
    JSON.stringify(b.dataset.assumptions)
  )
    reasons.push("fit assumptions differ");
  if (
    JSON.stringify(observations(reference)) !==
    JSON.stringify(observations(candidate))
  )
    reasons.push(
      "included observations, exclusions, or supplied uncertainties differ",
    );
  return reasons;
}

const unavailable = (reason: string): Statistic => ({ value: null, reason });
const available = (value: number): Statistic => ({ value, reason: null });

export function compareModels(
  candidates: readonly ComparisonCandidate[],
): ModelComparison {
  if (candidates.length < 2)
    return {
      compatible: false,
      reasons: ["At least two fitted candidates are required"],
      metrics: [],
    };
  const reasons = [
    ...new Set(
      candidates
        .slice(1)
        .flatMap((candidate) =>
          comparisonCompatibility(candidates[0], candidate).map(
            (reason) => `${candidate.label}: ${reason}`,
          ),
        ),
    ),
  ];
  if (reasons.length) return { compatible: false, reasons, metrics: [] };
  const metrics = candidates.map((candidate): ComparisonMetrics => {
    const { request, settings, result } = candidate;
    const unknownScale = request.uncertainty.kind === "unknown-equal";
    const modelParameters = settings.parameters.filter((p) => !p.fixed).length;
    const likelihoodParameters = modelParameters + Number(unknownScale);
    const formalReason =
      result.inference === "descriptive"
        ? "unsupported-or-unaccepted-assumptions"
        : result.rank !== modelParameters
          ? "rank-deficient-fit"
          : unknownScale && !(result.sse > 0)
            ? "zero-residual-variance"
            : null;
    let logLikelihood: Statistic;
    if (formalReason) logLikelihood = unavailable(formalReason);
    else if (unknownScale) {
      logLikelihood = available(
        (-result.n / 2) *
          (Math.log(2 * Math.PI) + 1 + Math.log(result.sse / result.n)),
      );
    } else {
      const normalizer = observations(candidate).reduce(
        (sum, row) => sum + Math.log(2 * Math.PI * row[2]! * row[2]!),
        0,
      );
      logLikelihood = available(
        -0.5 * (result.weightedObjective.value! + normalizer),
      );
    }
    const aic =
      logLikelihood.value === null
        ? unavailable(logLikelihood.reason!)
        : available(2 * likelihoodParameters - 2 * logLikelihood.value);
    const aicc =
      aic.value === null
        ? unavailable(aic.reason!)
        : result.n <= likelihoodParameters + 1
          ? unavailable("insufficient-sample-for-aicc")
          : available(
              aic.value +
                (2 * likelihoodParameters * (likelihoodParameters + 1)) /
                  (result.n - likelihoodParameters - 1),
            );
    const bic =
      logLikelihood.value === null
        ? unavailable(logLikelihood.reason!)
        : available(
            likelihoodParameters * Math.log(result.n) - 2 * logLikelihood.value,
          );
    return {
      id: candidate.id,
      label: candidate.label,
      model: settings.model,
      n: result.n,
      modelParameters,
      likelihoodParameters,
      objective: unknownScale ? result.sse : result.weightedObjective.value!,
      logLikelihood,
      aic,
      aicc,
      deltaAicc: unavailable("not-yet-ranked"),
      akaikeWeight: unavailable("not-yet-ranked"),
      bic,
      inference: result.inference,
      warnings: result.warnings.slice(),
    };
  });
  const valid = metrics.filter((metric) => metric.aicc.value !== null);
  if (valid.length >= 2) {
    const minimum = Math.min(...valid.map((metric) => metric.aicc.value!));
    const relative = valid.map((metric) =>
      Math.exp(-0.5 * (metric.aicc.value! - minimum)),
    );
    const total = relative.reduce((sum, value) => sum + value, 0);
    valid.forEach((metric, i) => {
      metric.deltaAicc = available(metric.aicc.value! - minimum);
      metric.akaikeWeight = available(relative[i] / total);
    });
  } else if (valid.length === 1) {
    valid[0].deltaAicc = unavailable("fewer-than-two-comparable-aicc");
    valid[0].akaikeWeight = unavailable("fewer-than-two-comparable-aicc");
  }
  for (const metric of metrics) {
    if (metric.aicc.value === null) {
      metric.deltaAicc = unavailable(metric.aicc.reason!);
      metric.akaikeWeight = unavailable(metric.aicc.reason!);
    }
  }
  return { compatible: true, reasons: [], metrics };
}
