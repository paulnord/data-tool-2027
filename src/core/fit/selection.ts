import type { FitRequest } from "./schema";
export interface SelectionRectangle {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export type SelectionMode = "replace" | "add" | "subtract";
/** Inclusive data-coordinate bounds. Combine selections by stable row identity;
 * source-excluded/missing rows never become manufactured usable observations. */
export function rectangleExclusions(
  rows: FitRequest["dataset"]["rows"],
  box: SelectionRectangle,
  previousExclusions: readonly string[] = [],
  mode: SelectionMode = "replace",
): string[] {
  if (!Object.values(box).every(Number.isFinite))
    throw Error("Selection bounds must be finite");
  const xmin = Math.min(box.x0, box.x1),
    xmax = Math.max(box.x0, box.x1),
    ymin = Math.min(box.y0, box.y1),
    ymax = Math.max(box.y0, box.y1);
  const previous = new Set(previousExclusions);
  return rows
    .filter((row) => {
      if (!row.included || row.x === null || row.y === null) return false;
      const inside =
        row.x >= xmin && row.x <= xmax && row.y >= ymin && row.y <= ymax;
      if (mode === "add") return previous.has(row.id) && !inside;
      if (mode === "subtract") return previous.has(row.id) || inside;
      return !inside;
    })
    .map((row) => row.id);
}
