import { requestSchema, type FitRequest } from "./schema";
/** No example observations or assumed uncertainty in a new analysis. */
export function emptyRequest(
  requestId: string,
  snapshotId: string,
): FitRequest {
  return requestSchema.parse({
    format: "tracker-fit-request",
    version: 1,
    requestId,
    snapshotId,
    source: {
      application: "Data Tool 2027",
      version: "0.2.0",
      context: null,
      fileName: null,
    },
    dataset: {
      id: requestId,
      label: "Untitled data",
      xColumn: { id: "x", label: "X", unit: null },
      yColumn: { id: "y", label: "Y", unit: null },
      assumptions: {
        exactX: "unknown",
        gaussianIndependent: "unknown",
        correctModel: "unknown",
      },
      rows: [],
    },
    uncertainty: { kind: "unknown-equal", errorStructure: "unknown" },
  });
}
