import { parseDelimited } from "../../src/core/fit/dataInput";
import { expect, it } from "vitest";
import { analysisFromTable } from "../../src/core/fit/dataTable";
import { initialSettings, type DataTable } from "../../src/core/fit/schema";
import {
  checkIntervalRanges,
  fitInterval,
  intervalReport,
  intervalRequests,
  type IntervalConfig,
} from "../../src/core/fit/intervals";
import { fit } from "../../src/core/fit/solve";
const table: DataTable = {
  cells: [
    ["Time", "A", "B", "C", "D"],
    ...Array.from({ length: 81 }, (_, i) => {
      const t = i / 20;
      return [
        t,
        ...[1, 2, 3, 4].map(
          (n) => n + 2 * n * t + 0.003 * Math.sin(i * 1.3 + n),
        ),
      ].map(String);
    }),
  ],
  rowIds: Array.from({ length: 82 }, (_, i) => `row-${i}`),
  headerRows: 1,
  x: 0,
  y: 1,
  sigma: null,
  units: ["s", "m", "m", "m", "m"],
};
const source = () =>
  analysisFromTable(structuredClone(table), "Synthetic intervals");
const config = (count = 1): IntervalConfig => ({
  x: 0,
  columns: Array.from({ length: count }, (_, i) => i + 1),
  sigmas: Array(count).fill(null),
  conditional: true,
  intervals: [
    {
      name: "Before",
      range: [0, 1.5],
      settings: Array.from({ length: count }, () => initialSettings("line")),
    },
    {
      name: "After",
      range: [2.5, 4],
      settings: Array.from({ length: count }, () => initialSettings("line")),
    },
  ],
});
for (const count of [1, 2, 3, 4])
  it(`${count} curves: fits only the chosen interval without changing observations`, () => {
    const s = source(),
      c = config(count),
      original = JSON.stringify(s),
      before = JSON.stringify(c);
    const results = fitInterval(s, c, 0);
    expect(results).toHaveLength(count);
    results.forEach((r, i) => {
      expect(r.result!.coefficients[1]).toBeCloseTo(2 * (i + 1), 2);
      expect(r.result!.n).toBe(31);
      expect(r.result!.inference).toBe("conditional");
    });
    expect(JSON.stringify(s)).toBe(original);
    expect(JSON.stringify(c)).toBe(before);
    expect(intervalReport(c, [results, null])).toContain("Not fitted");
  });
it("requires student ranges, allows overlap and caps intervals at three", () => {
  const c = config();
  c.intervals[0].range = null;
  expect(() => fitInterval(source(), c, 0)).toThrow(/Select this interval/);
  expect(fitInterval(source(), c, 1)[0].result).not.toBeNull();
  c.intervals[0].range = [1, 3];
  expect(fitInterval(source(), c, 0)[0].result!.n).toBe(41);
  c.intervals[0].range = [1, 2.5];
  expect(fitInterval(source(), c, 0)[0].result!.residuals.at(-1)!.x).toBe(2.5);
  expect(fitInterval(source(), c, 1)[0].result!.residuals[0].x).toBe(2.5);
  c.intervals[0].range = [1, 1];
  expect(() => checkIntervalRanges(c.intervals)).toThrow(/increasing/);
  expect(() => checkIntervalRanges(Array(4).fill(c.intervals[1]))).toThrow(
    /three/,
  );
});
it("each interval can use a different equation with independent fixed parameters and weighted covariance", () => {
  const s = source(),
    c = config(2);
  c.sigmas = [0.003, 0.006];
  c.intervals[1].settings = c.intervals[1].settings.map(() => ({
    ...initialSettings("quadratic"),
    parameters: [
      { value: 0, fixed: false },
      { value: 0, fixed: false },
      { value: 0, fixed: true },
    ],
  }));
  const rows = fitInterval(s, c, 1);
  rows.forEach((entry) => {
    const expected = fit(entry.request, entry.settings);
    expect(entry.result).toEqual(expected);
    expect(entry.result!.df).toBe(entry.result!.n - 2);
    expect(entry.result!.standardErrors[2].reason).toBe("fixed");
    expect(entry.result!.covariance).not.toBeNull();
  });
  expect(fitInterval(s, c, 0)[0].settings.model).toBe("line");
});
it("supports sine and custom equations and reports partial failures by curve", () => {
  const s = source(),
    c = config(2);
  c.intervals[0].settings = c.intervals[0].settings.map(() =>
    initialSettings("sine"),
  );
  expect(fitInterval(s, c, 0).every((r) => r.result)).toBe(true);
  c.intervals[0].settings = c.intervals[0].settings.map(() =>
    initialSettings("custom"),
  );
  c.intervals[0].settings[1].parameters[1] = { value: 2, fixed: true };
  const custom = fitInterval(s, c, 0);
  expect(custom[0].result!.coefficients[1]).toBeCloseTo(2, 2);
  expect(custom[1].result!.standardErrors[1].reason).toBe("fixed");
  const sparse = structuredClone(table);
  sparse.cells = sparse.cells.map((row, i) =>
    i > 0 && i < 32 ? [...row.slice(0, 2), "", ...row.slice(3)] : row,
  );
  const results = fitInterval(
    analysisFromTable(sparse, "missing"),
    config(2),
    0,
  );
  expect(results[0].result).not.toBeNull();
  expect(results[1].error).toContain("No included observations");
});
it("preserves known false assumptions and rejects invalid mappings or uncertainty", () => {
  const s = source(),
    c = config();
  s.request.dataset.assumptions.exactX = "known-false";
  expect(fitInterval(s, c, 0)[0].result!.inference).toBe("descriptive");
  expect(() => intervalRequests(s, { ...c, columns: [0] })).toThrow(
    /different column/,
  );
  expect(() => intervalRequests(s, { ...c, sigmas: [0] })).toThrow(/positive/);
});

it("copies full reports side by side with blank columns and intact quoted metadata", () => {
  const s = source(),
    c = config(2);
  s.request.source.context = '=notes\twith "quotes"\nand newlines';
  c.intervals[1].range = [3, 4];
  const first = fitInterval(s, c, 0),
    second = fitInterval(s, c, 1);
  second[1] = { ...second[1], result: null, error: "Unavailable" };
  const rows = parseDelimited(intervalReport(c, [first, second]), "\t");
  expect(rows[3].filter((v) => v === "Interval")).toHaveLength(4);
  for (const row of rows.slice(3)) {
    expect(row).toHaveLength(23);
    expect([row[5], row[11], row[17]]).toEqual(["", "", ""]);
  }
  for (const offset of [0, 6, 12]) {
    expect(rows.find((r) => r[offset] === "Source notes")![offset + 1]).toBe(
      "'" + s.request.source.context,
    );
    expect(rows.find((r) => r[offset] === "Statistic")![offset + 1]).toBe(
      "Value",
    );
    const start = rows.findIndex((r) => r[offset] === "Row");
    expect(Number(rows[start + 1][offset + 4])).toBe(
      (offset === 12 ? second[0] : first[offset / 6]).result!.residuals[0]
        .residual,
    );
  }
  expect(rows.find((r) => r[18] === "Fit unavailable")![19]).toBe(
    "Unavailable",
  );
});
