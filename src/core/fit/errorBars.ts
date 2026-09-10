import type { FitRequest } from "./schema";
export interface YErrorBar {
  id: string;
  x: number;
  lower: number;
  upper: number;
  sigma: number;
}
/** Supplied marginal +/-1 sigma in the original y units. These do not depend
 * on the fit, independence assumptions or its residual-estimated scatter. */
export function suppliedYErrorBars(request: FitRequest): {
  bars: YErrorBar[];
  unavailable: number;
} {
  const bars: YErrorBar[] = [];
  let unavailable = 0;
  const uncertainty = request.uncertainty;
  if (uncertainty.kind === "unknown-equal") return { bars, unavailable: 0 };
  for (const row of request.dataset.rows) {
    if (row.x === null || row.y === null) continue;
    const sigma =
      uncertainty.kind === "supplied-common"
        ? uncertainty.sigmaY
        : uncertainty.sigmaByRow[row.id];
    // Source-excluded rows may legitimately lack a supplied per-row sigma.
    if (sigma === undefined && !row.included) continue;
    if (!(sigma > 0) || !Number.isFinite(sigma))
      throw Error("Error bars require finite positive supplied uncertainty");
    const lower = row.y - sigma,
      upper = row.y + sigma;
    if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
      unavailable++;
      continue;
    }
    bars.push({ id: row.id, x: row.x, lower, upper, sigma });
  }
  return { bars, unavailable };
}
