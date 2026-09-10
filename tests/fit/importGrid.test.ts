import { expect, it } from "vitest";
import {
  alignRowNameHeading,
  cellProblem,
  importRecords,
  missingCornerHeading,
  pasteGrid,
  copyGridColumns,
} from "../../src/core/fit/importGrid";
import { suggestImport, importData } from "../../src/core/fit/dataInput";
import { initialSettings } from "../../src/core/fit/schema";
it("grows pasted blocks without truncation and leaves original cells untouched", () => {
  const original = [
    ["0", "2"],
    ["1", "3"],
  ];
  expect(
    pasteGrid(original, 1, 1, [
      ["4", ".2"],
      ["5", ".3"],
    ]),
  ).toEqual([
    ["0", "2", ""],
    ["1", "4", ".2"],
    ["", "5", ".3"],
  ]);
  expect(original).toEqual([
    ["0", "2"],
    ["1", "3"],
  ]);
  expect(() => pasteGrid([], 100001, 0, [["a"]])).toThrow(/limit/);
});
it("preserves irregular R-style headings until explicitly aligned", () => {
  const rows = [
    ["x", "y"],
    ["one", "0", "2"],
    ["two", "1", "3"],
  ];
  expect(pasteGrid([], 0, 0, rows)).toEqual(rows);
  expect(missingCornerHeading(rows, 1)).toBe(true);
  const aligned = alignRowNameHeading(rows, 1);
  expect(aligned[0]).toEqual(["", "x", "y"]);
  expect(rows[0]).toEqual(["x", "y"]);
  expect(missingCornerHeading(pasteGrid(rows, 1, 2, [["3"]]), 1)).toBe(true);
  expect(suggestImport("x\ty\none\t0\t2\ntwo\t1\t3")).toMatchObject({
    x: 1,
    y: 2,
    header: true,
  });
  expect(() => alignRowNameHeading(aligned, 1)).toThrow();
});
it("keeps finite numeric contracts stable with inf, NA, and NaN", () => {
  for (const token of ["inf", "-Inf", "Infinity", "NaN", "NA"]) {
    expect(suggestImport(`x,y,sigma\n0,${token},.1\n1,3,.2`)).toMatchObject({
      x: 0,
      y: 1,
    });
    expect(suggestImport(`${token},${token}\n1,3`).header).toBe(false);
    expect(cellProblem(token, 1, { x: 0, y: 1, sigma: 2 })).toContain(
      "not a finite number",
    );
    expect(cellProblem(token, 3, { x: 0, y: 1, sigma: 2 })).toBeNull();
  }
  expect(cellProblem("", 1, { x: 0, y: 1, sigma: 2 })).toBeNull();
  expect(cellProblem("0", 2, { x: 0, y: 1, sigma: 2 })).toContain("positive");
  expect(cellProblem("1e-3", 1, { x: 0, y: 1, sigma: null })).toBeNull();
});
it("uses explicitly selected multiple heading rows and retains the first observation", () => {
  const grid = [["Experiment"], ["time", "height"], ["0", "2"], ["1", "3"]];
  const records = importRecords(grid, 2);
  const request = importData(
    records,
    {
      header: true,
      x: 0,
      y: 1,
      sigma: null,
      label: "lab",
      xLabel: "time",
      yLabel: "height",
      xUnit: "",
      yUnit: "",
    },
    "00000000-0000-4000-8000-000000000001",
    "paste",
    initialSettings("line"),
  );
  expect(request.dataset.rows.map((r) => [r.x, r.y])).toEqual([
    [0, 2],
    [1, 3],
  ]);
  expect(() => importRecords(grid, 4)).toThrow();
});

it("copies rectangular blocks losslessly and supports repeated doubling", async () => {
  const { copyGridRange } = await import("../../src/core/fit/importGrid");
  const { parseDelimited } = await import("../../src/core/fit/dataInput");
  let grid = [[".02"]];
  for (const count of [1, 2, 4, 8]) {
    const copied = copyGridRange(grid, {
      anchor: { row: count - 1, column: 0 },
      end: { row: 0, column: 0 },
    });
    grid = pasteGrid(grid, count, 0, parseDelimited(copied, "\t"));
    expect(grid).toHaveLength(count * 2);
    expect(grid.every((row) => row[0] === ".02")).toBe(true);
  }
  const quoted = [
    ["a\tb", 'say "yes"'],
    ["line\nbreak", ""],
    ["carriage\rreturn", "windows\r\nnewline"],
  ];
  expect(
    parseDelimited(
      copyGridRange(quoted, {
        anchor: { row: 0, column: 0 },
        end: { row: 2, column: 1 },
      }),
      "\t",
    ),
  ).toEqual(quoted);
});

it("copies disjoint columns in source order with exact values and quoted blanks", () => {
  const grid = [
    ["id", "x", "notes"],
    ["a", "0", 'quoted "text"'],
    ["b", "1"],
    ["c", "2", "two\tfields"],
  ];
  const original = JSON.stringify(grid);
  expect(copyGridColumns(grid, [2, 0, 2])).toBe(
    'id\tnotes\na\t"quoted ""text"""\nb\t""\nc\t"two\tfields"',
  );
  expect(JSON.stringify(grid)).toBe(original);
  expect(copyGridColumns(grid, [])).toBe("");
  expect(() => copyGridColumns(grid, [-1])).toThrow();
  expect(() => copyGridColumns(grid, [1.5])).toThrow();
});
