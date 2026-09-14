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
  delta: Statistic;
  akaikeWeight: Statistic;
  bic: Statistic;
  inference: FitResult["inference"];
  warnings: string[];
}

export interface ModelComparison {
  compatible: boolean;
  rankingCriterion: "AIC" | "AICc" | null;
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
const available = (value: number): Statistic =>
  Number.isFinite(value)
    ? { value, reason: null }
    : unavailable("nonfinite-comparison-statistic");

export function compareModels(
  candidates: readonly ComparisonCandidate[],
): ModelComparison {
  if (candidates.length < 2)
    return {
      compatible: false,
      rankingCriterion: null,
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
  if (reasons.length)
    return { compatible: false, rankingCriterion: null, reasons, metrics: [] };
  const rankingCriterion =
    candidates[0].request.uncertainty.kind === "unknown-equal" ? "AICc" : "AIC";
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
          (Math.log(2 * Math.PI) +
            1 +
            Math.log(result.sse) -
            Math.log(result.n)),
      );
    } else {
      const normalizer = observations(candidate).reduce(
        (sum, row) => sum + Math.log(2 * Math.PI) + 2 * Math.log(row[2]!),
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
    // This regression correction estimates the bias from an unknown variance.
    // Supplied known variances use AIC directly, without that extra penalty.
    const aicc = !unknownScale
      ? unavailable("not-applicable-known-variance")
      : aic.value === null
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
      delta: unavailable("not-yet-ranked"),
      akaikeWeight: unavailable("not-yet-ranked"),
      bic,
      inference: result.inference,
      warnings: result.warnings.slice(),
    };
  });
  const criterion = (metric: ComparisonMetrics) =>
    rankingCriterion === "AIC" ? metric.aic : metric.aicc;
  const valid = metrics.filter((metric) => criterion(metric).value !== null);
  if (valid.length >= 2) {
    const minimum = Math.min(
      ...valid.map((metric) => criterion(metric).value!),
    );
    const relative = valid.map((metric) =>
      Math.exp(-0.5 * (criterion(metric).value! - minimum)),
    );
    const total = relative.reduce((sum, value) => sum + value, 0);
    valid.forEach((metric, i) => {
      metric.delta = available(criterion(metric).value! - minimum);
      metric.akaikeWeight = available(relative[i] / total);
    });
  } else if (valid.length === 1) {
    valid[0].delta = unavailable("fewer-than-two-comparable-criteria");
    valid[0].akaikeWeight = unavailable("fewer-than-two-comparable-criteria");
  }
  for (const metric of metrics) {
    if (criterion(metric).value === null) {
      metric.delta = unavailable(criterion(metric).reason!);
      metric.akaikeWeight = unavailable(criterion(metric).reason!);
    }
  }
  return { compatible: true, rankingCriterion, reasons: [], metrics };
}
