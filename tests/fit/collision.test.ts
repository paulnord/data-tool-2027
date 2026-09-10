import { expect, it } from "vitest";
import {
  collisionFits,
  collisionRequests,
  collisionReport,
  type CollisionConfig,
} from "../../src/core/fit/collision";
import { analysisFromTable } from "../../src/core/fit/dataTable";
import type { DataTable } from "../../src/core/fit/schema";
const table: DataTable = {
  cells: [
    ["t", "x1", "y1", "x2", "y2"],
    ...Array.from({ length: 21 }, (_, i) => {
      const t = i / 5;
      return [
        t,
        ...[1, 2, 3, 4].map(
          (s, j) =>
            s * Math.min(t, 2) -
            s * Math.max(0, t - 2) +
            0.001 * Math.sin(i + j),
        ),
      ].map(String);
    }),
  ],
  rowIds: Array.from({ length: 22 }, (_, i) => `r${i}`),
  headerRows: 1,
  x: 0,
  y: 1,
  sigma: null,
  units: ["s", "m", "m", "m", "m"],
};
const config: CollisionConfig = {
  time: 0,
  columns: [1, 2, 3, 4],
  sigmas: [null, null, null, null],
  before: [0, 1.6],
  after: [2.4, 4],
  conditional: true,
};
it("computes eight independent slopes, inclusive disjoint windows and original-unit uncertainty without mutation", () => {
  const source = analysisFromTable(table, "test"),
    original = JSON.stringify(source);
  const channels = collisionFits(source, config);
  expect(JSON.stringify(source)).toBe(original);
  channels.forEach((c, i) => {
    expect(c.before.result!.coefficients[1]).toBeCloseTo(i + 1, 2);
    expect(c.after.result!.coefficients[1]).toBeCloseTo(-i - 1, 2);
    expect(c.before.result!.n).toBe(9);
    expect(c.after.result!.n).toBe(9);
    expect(c.before.result!.standardErrors[1].value).toBeGreaterThan(0);
    expect(c.before.result!.inference).toBe("conditional");
    expect(c.before.result!.rank).toBe(2);
  });
  const report = collisionReport(channels);
  expect(report).toContain("m/s");
  expect(report).toContain("Before".toLowerCase());
  expect(report).toContain("Rank");
  expect(report).toContain("selection");
});
it("keeps valid channels when one interval lacks enough data, and respects missing rows by channel", () => {
  const source = analysisFromTable(
    {
      ...table,
      cells: table.cells.map((r, i) =>
        i > 1 && i < 10 ? r.map((s, j) => (j === 2 ? "" : s)) : r,
      ),
    },
    "missing",
  );
  const result = collisionFits(source, config);
  expect(result[0].before.result).not.toBeNull();
  expect(result[1].before.result).toBeNull();
  expect(result[1].before.error).toBeTruthy();
  expect(result[1].after.result).not.toBeNull();
});
it("rejects overlapping intervals, repeated columns and invalid uncertainties", () => {
  const source = analysisFromTable(table, "test");
  expect(() => collisionFits(source, { ...config, after: [1.6, 4] })).toThrow(
    /intervals/,
  );
  expect(() =>
    collisionFits(source, { ...config, columns: [1, 1, 3, 4] }),
  ).toThrow(/different/);
  expect(() =>
    collisionFits(source, { ...config, sigmas: [0, null, null, null] }),
  ).toThrow(/positive/);
});
it("does not silently accept assumptions or inherit a single-fit exclusion", () => {
  const source = analysisFromTable(table, "test");
  source.settings.excludedIds = ["r1"];
  const result = collisionFits(source, { ...config, conditional: false });
  expect(result[0].before.result!.n).toBe(9);
  expect(result[0].before.result!.standardErrors[1].value).toBeNull();
  source.request.dataset.assumptions.exactX = "known-false";
  expect(collisionFits(source, config)[0].before.result!.inference).toBe(
    "descriptive",
  );
});
it("uses each channel's supplied sigma without sharing scales between components", () => {
  const source = analysisFromTable(table, "test");
  const requests = collisionRequests(source, {
    ...config,
    sigmas: [0.1, 0.2, 0.3, 0.4],
  });
  requests.forEach((r, i) =>
    expect(r.uncertainty).toMatchObject({
      kind: "supplied-common",
      sigmaY: (i + 1) / 10,
    }),
  );
  const result = collisionFits(source, {
    ...config,
    sigmas: [0.1, 0.2, 0.3, 0.4],
  });
  expect(result[1].before.result!.standardErrors[1].value!).toBeCloseTo(
    2 * result[0].before.result!.standardErrors[1].value!,
    10,
  );
});
