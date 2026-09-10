import { it, expect } from "vitest";
import { rectangleExclusions } from "../../src/core/fit/selection";
import { syntheticRequest } from "../support/synthetic";
it("selects by both physical coordinates, includes edges and works in either direction", () => {
  const rows = syntheticRequest()
    .dataset.rows.slice(0, 4)
    .map((r, i) => ({ ...r, x: i, y: i === 2 ? 20 : i }));
  const before = JSON.stringify(rows),
    box = { x0: 1, y0: 1, x1: 3, y1: 3 };
  expect(rectangleExclusions(rows, box)).toEqual(["row-0", "row-2"]);
  expect(rectangleExclusions(rows, { x0: 3, y0: 3, x1: 1, y1: 1 })).toEqual([
    "row-0",
    "row-2",
  ]);
  expect(JSON.stringify(rows)).toBe(before);
});
it("allows empty selections and preserves missing/source-excluded rows", () => {
  const rows = syntheticRequest().dataset.rows.slice(0, 3);
  rows[0].included = false;
  rows[1] = {
    ...rows[1],
    x: null,
    included: false,
    missingReason: "missing-value",
  };
  expect(
    rectangleExclusions(rows, { x0: 100, x1: 200, y0: 100, y1: 200 }),
  ).toEqual(["row-2"]);
  expect(() =>
    rectangleExclusions(rows, { x0: NaN, x1: 0, y0: 0, y1: 1 }),
  ).toThrow();
});

it("combines disjoint regions and subtracts bad intervals without changing source data", () => {
  const rows = syntheticRequest()
    .dataset.rows.slice(0, 7)
    .map((r, i) => ({ ...r, x: i, y: i }));
  rows[6].included = false;
  const before = JSON.stringify(rows);
  const left = { x0: 0, x1: 1, y0: -1, y1: 10 };
  const right = { x0: 4, x1: 6, y0: -1, y1: 10 };
  const first = rectangleExclusions(rows, left);
  const combined = rectangleExclusions(rows, right, first, "add");
  expect(first).toEqual(["row-2", "row-3", "row-4", "row-5"]);
  expect(combined).toEqual(["row-2", "row-3"]);
  expect(rectangleExclusions(rows, left, combined, "add")).toEqual(combined);
  expect(rectangleExclusions(rows, left, combined, "subtract")).toEqual([
    "row-0",
    "row-1",
    "row-2",
    "row-3",
  ]);
  expect(
    rectangleExclusions(rows, { x0: 2, x1: 3, y0: -1, y1: 10 }, [], "subtract"),
  ).toEqual(combined);
  expect(rectangleExclusions(rows, right, first, "replace")).toEqual([
    "row-0",
    "row-1",
    "row-2",
    "row-3",
  ]);
  expect(JSON.stringify(rows)).toBe(before);
});
