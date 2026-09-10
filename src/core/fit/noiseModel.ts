import type { FitRequest, FitSettings } from "./schema";
/** Preserve the supplied row uncertainties as session inputs while comparing
 * weighting choices. The retained data belongs only to this request/session. */
export function switchNoiseModel(
  request: FitRequest,
  settings: FitSettings,
  kind: FitRequest["uncertainty"]["kind"],
): { request: FitRequest; settings: FitSettings } {
  if (request.uncertainty.kind === kind) return { request, settings };
  const retained =
    request.uncertainty.kind === "supplied-per-row"
      ? request.uncertainty
      : settings.retainedPerRowUncertainty;
  if (kind === "supplied-per-row" && !retained)
    throw Error(
      "No supplied per-observation uncertainties are available for this dataset",
    );
  const uncertainty: FitRequest["uncertainty"] =
    kind === "supplied-per-row"
      ? retained!
      : kind === "unknown-equal"
        ? { kind, errorStructure: request.uncertainty.errorStructure }
        : {
            kind,
            errorStructure: request.uncertainty.errorStructure,
            sigmaY: 0.02,
            provenance: {
              kind: "user-asserted",
              description: "Common sigma explicitly selected in fit window",
            },
          };
  return {
    request: { ...request, uncertainty },
    settings: retained
      ? { ...settings, retainedPerRowUncertainty: retained }
      : settings,
  };
}
