import { parseDelimited } from "../../src/core/fit/dataInput";
import { expect, it } from "vitest";
import {
  analysisFromTable,
  columnHeading,
  tableCsv,
  insertTableColumn,
  tableForAnalysis,
} from "../../src/core/fit/dataTable";
import {
  initialSettings,
  sessionSchema,
  type DataTable,
} from "../../src/core/fit/schema";
import { syntheticRequest } from "../support/synthetic";
import { switchNoiseModel } from "../../src/core/fit/noiseModel";
const table: DataTable = {
  cells: [
    ["id", "time", "height", "sigma"],
    ["a", "0", "2", ".1"],
    ["b", "1", "3", ".2"],
    ["c", "2", "4", ".3"],
  ],
  rowIds: ["header", "a", "b", "c"],
  headerRows: 1,
  x: 1,
  y: 2,
  sigma: 3,
  units: ["", "s", "m", "m"],
};
it("retains all source columns and assignments through a validated session round trip", () => {
  const a = analysisFromTable(table, "lab");
  const saved = sessionSchema.parse(
    JSON.parse(
      JSON.stringify({
        format: "tracker-fit-session",
        version: 1,
        ...a,
        engine: "qr-vp-sine-2",
      }),
    ),
  );
  expect(tableForAnalysis(saved)).toEqual(table);
  expect(() =>
    sessionSchema.parse({
      ...saved,
      dataTable: { ...table, units: ["", "cm", "m", "m"] },
    }),
  ).toThrow();
  expect(() =>
    sessionSchema.parse({
      ...saved,
      dataTable: {
        ...table,
        cells: table.cells.map((r, i) => (i === 1 ? ["a", "0", "2", ".9"] : r)),
      },
    }),
  ).toThrow();
  expect(saved.request.dataset.rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  expect(() =>
    sessionSchema.parse({
      ...saved,
      dataTable: {
        ...table,
        cells: table.cells.map((r, i) =>
          i === 1 ? ["a", "99", "2", ".1"] : r,
        ),
      },
    }),
  ).toThrow(/does not match/);
  expect(() =>
    sessionSchema.parse({ ...saved, dataTable: { ...table, derived: 1 } }),
  ).toThrow();
});
it("swapping axes follows column units and clears previous Y uncertainty and constraints", () => {
  const base = analysisFromTable(table, "lab");
  base.settings = {
    ...initialSettings("quadratic"),
    parameters: [
      { value: 2, fixed: true },
      { value: 1, fixed: false },
      { value: 0, fixed: false },
    ],
    physicalTimeConfirmed: true,
  };
  const swapped = analysisFromTable(
    { ...table, x: 2, y: 1, sigma: null },
    "lab",
    base,
  );
  expect(swapped.request.dataset.rows[0]).toMatchObject({
    id: "a",
    x: 2,
    y: 0,
  });
  expect(swapped.request.dataset.xColumn).toMatchObject({
    label: "height",
    unit: "m",
  });
  expect(swapped.request.dataset.yColumn).toMatchObject({
    label: "time",
    unit: "s",
  });
  expect(swapped.request.uncertainty.kind).toBe("unknown-equal");
  expect(swapped.settings.model).toBe("line");
  expect(swapped.settings.parameters.every((p) => !p.fixed)).toBe(true);
  expect(swapped.settings.physicalTimeConfirmed).toBe(false);
  expect(table.cells[1]).toEqual(["a", "0", "2", ".1"]);
});
it("reopening equal weighting keeps retained point errors, stable IDs and exclusions through edits", () => {
  const original = analysisFromTable(table, "lab");
  const equal = {
    ...original,
    ...switchNoiseModel(original.request, original.settings, "unknown-equal"),
  };
  equal.settings = { ...equal.settings, excludedIds: ["b", "c"] };
  const editedTable = {
    ...table,
    cells: table.cells
      .slice(0, 3)
      .map((row, i) => (i === 1 ? ["a", "0", "2", ".4"] : row)),
    rowIds: table.rowIds.slice(0, 3),
  };
  const edited = analysisFromTable(editedTable, "lab", equal);
  expect(edited.request.uncertainty.kind).toBe("unknown-equal");
  expect(edited.settings.retainedPerRowUncertainty?.sigmaByRow).toEqual({
    a: 0.4,
    b: 0.2,
  });
  expect(edited.settings.excludedIds).toEqual(["b"]);
  const reopen = sessionSchema.parse(
    JSON.parse(
      JSON.stringify({
        format: "tracker-fit-session",
        version: 1,
        ...edited,
        engine: "qr-vp-sine-2",
      }),
    ),
  );
  expect(tableForAnalysis(reopen)).toEqual(editedTable);
});
it("older sessions reconstruct a table without changing common uncertainty or model", () => {
  const base = {
    request: syntheticRequest(),
    settings: initialSettings("quadratic"),
  };
  const t = tableForAnalysis(base),
    result = analysisFromTable(t, "lab", base);
  expect(result.request.dataset.rows).toEqual(base.request.dataset.rows);
  expect(result.request.uncertainty).toEqual(base.request.uncertainty);
  expect(result.settings.model).toBe("quadratic");
});

it("copies preamble records to source context and preserves edited notes on reopen", () => {
  const withComments = {
    ...table,
    cells: [["# Experiment"], ["# Second comment"], ...table.cells],
    rowIds: ["comment1", "comment2", ...table.rowIds],
    headerRows: 3,
  };
  const a = analysisFromTable(withComments, "comments.csv");
  expect(a.request.source.context).toBe(
    "comments.csv\n# Experiment\n# Second comment",
  );
  const edited = {
    ...a,
    request: {
      ...a.request,
      source: { ...a.request.source, context: "My edited notes\nSecond line" },
    },
  };
  const reopened = sessionSchema.parse(
    JSON.parse(
      JSON.stringify({
        format: "tracker-fit-session",
        version: 1,
        ...edited,
        engine: "qr-vp-sine-2",
      }),
    ),
  );
  expect(
    analysisFromTable(withComments, "comments.csv", reopened).request.source
      .context,
  ).toBe("My edited notes\nSecond line");
  expect(reopened.dataTable?.cells[0]).toEqual(["# Experiment"]);
});

it("retains an explicit source filename through title edits and session round trips", () => {
  const a = analysisFromTable(table, "lab.csv", undefined, "lab.csv");
  const edited = analysisFromTable(table, "A different title", a);
  const saved = sessionSchema.parse(
    JSON.parse(
      JSON.stringify({
        format: "tracker-fit-session",
        version: 1,
        ...edited,
        engine: "qr-vp-sine-2",
      }),
    ),
  );
  expect(saved.request.source.fileName).toBe("lab.csv");
  expect(
    analysisFromTable(table, "Pasted data").request.source.fileName,
  ).toBeNull();
  const legacy = {
    ...saved,
    request: { ...saved.request, source: { ...saved.request.source } },
  };
  delete legacy.request.source.fileName;
  expect(sessionSchema.parse(legacy).request.source.fileName).toBeUndefined();
});

it("reads explicit CSV heading units, preserving numbers and session round trips", () => {
  expect(columnHeading("Height (cm)")).toEqual({ label: "Height", unit: "cm" });
  expect(columnHeading("Speed (m/s)", "")).toEqual({
    label: "Speed",
    unit: "",
  });
  expect(columnHeading("Trial (left) height")).toEqual({
    label: "Trial (left) height",
    unit: "",
  });
  const input: DataTable = {
    cells: [
      ["Time (s)", "Height (cm)"],
      ["0", "200"],
      ["1", "300"],
    ],
    rowIds: ["h", "a", "b"],
    headerRows: 1,
    x: 0,
    y: 1,
    sigma: null,
    units: [],
  };
  const result = analysisFromTable(input, "CSV units");
  expect(result.request.dataset.yColumn).toMatchObject({
    label: "Height",
    unit: "cm",
  });
  expect(result.request.dataset.rows[0].y).toBe(200);
  expect(result.dataTable?.cells).toEqual(input.cells);
  expect(result.dataTable?.units).toEqual(["s", "cm"]);
  expect(
    analysisFromTable(
      JSON.parse(JSON.stringify(result.dataTable)),
      "CSV units",
      result,
    ).request.dataset,
  ).toEqual(result.request.dataset);
});

it("CSV preserves comments, unused text, missing cells and exact digits with updated units", () => {
  const input: DataTable = {
    cells: [
      ["# source, with commas"],
      ["Time (s)", "Height (m)", "note"],
      ["0", "1.2345678901234567", 'a "quoted"\nline'],
      ["1", "", "unused"],
    ],
    rowIds: ["c", "h", "a", "b"],
    headerRows: 2,
    x: 0,
    y: 1,
    sigma: null,
    units: ["ms", "cm", ""],
  };
  const rows = parseDelimited(tableCsv(input), ",");
  expect(rows).toEqual([
    input.cells[0],
    ["Time (ms)", "Height (cm)", "note"],
    ...input.cells.slice(2),
  ]);
  expect(input.cells[1][0]).toBe("Time (s)");
  expect(
    tableCsv({ ...input, headerRows: 0, cells: [["0", "1"]], units: [] }),
  ).toBe("0,1\r\n");
  expect(
    parseDelimited(
      tableCsv({
        ...input,
        headerRows: 0,
        cells: [["0", "1"]],
        units: ["s", "m"],
      }),
      ",",
    )[0],
  ).toEqual(["Column 1 (s)", "Column 2 (m)"]);
});

it("column insertion preserves row identity, units and analysis assignments", () => {
  const next = insertTableColumn(table, 2);
  expect(next.cells[1]).toEqual(["a", "0", "", "2", ".1"]);
  expect(next.rowIds).toBe(table.rowIds);
  expect(next).toMatchObject({
    x: 1,
    y: 3,
    sigma: 4,
    units: ["", "s", "", "m", "m"],
  });
  expect(analysisFromTable(next, "lab").request.dataset.rows).toEqual(
    analysisFromTable(table, "lab").request.dataset.rows,
  );
  expect(table.cells[1]).toEqual(["a", "0", "2", ".1"]);
  expect(insertTableColumn(table, 4).cells[1]).toEqual([
    "a",
    "0",
    "2",
    ".1",
    "",
  ]);
  expect(() => insertTableColumn(table, -1)).toThrow();
});
