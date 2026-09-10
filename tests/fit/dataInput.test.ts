import { describe, expect, it } from "vitest";
import {
  draftRows,
  editData,
  importData,
  mappedRows,
  numericCell,
  parseDelimited,
  pasteCells,
  type ColumnMapping,
} from "../../src/core/fit/dataInput";
import { initialSettings, sessionSchema } from "../../src/core/fit/schema";
import { switchNoiseModel } from "../../src/core/fit/noiseModel";
const mapping: ColumnMapping = {
  header: true,
  x: 0,
  y: 1,
  sigma: 2,
  label: "Lab",
  xLabel: "Time",
  yLabel: "Height",
  xUnit: "s",
  yUnit: "m",
};
const settings = initialSettings("line");
const id = "00000000-0000-4000-8000-000000000001";
const make = () =>
  importData(
    parseDelimited("t,y,sigma\n0,2,.1\n1,3,.2\n2,4,.3", ","),
    mapping,
    id,
    "lab.csv",
    settings,
  );
describe("delimited input and immutable corrections", () => {
  it("recognizes record terminators without changing quoted source text", () => {
    for (const delimiter of [",", "\t"] as const) {
      for (const ending of ["\n", "\r", "\r\n"]) {
        expect(
          parseDelimited(
            `"a\rb\r\nc\nd"${delimiter}""${ending}1${delimiter}2${ending}`,
            delimiter,
          ),
        ).toEqual([
          ["a\rb\r\nc\nd", ""],
          ["1", "2"],
        ]);
      }
    }
  });
  it("enforces row and column limits at record terminators and end of input", () => {
    for (const delimiter of [",", "\t"] as const) {
      const widest = Array(1000).fill("1").join(delimiter);
      expect(parseDelimited(widest, delimiter)[0]).toHaveLength(1000);
      for (const ending of ["", "\n", "\r", "\r\n"]) {
        for (const last of ["", "1", '""']) {
          expect(() =>
            parseDelimited(`${widest}${delimiter}${last}${ending}`, delimiter),
          ).toThrow(/Too many rows or columns/);
        }
      }
    }
    const tallest = "1\n".repeat(100001);
    expect(parseDelimited(tallest, ",")).toHaveLength(100001);
    for (const last of ["1", '""', "\n", "1\r\n"]) {
      expect(() => parseDelimited(tallest + last, ",")).toThrow(
        /Too many rows or columns/,
      );
    }
  });
  it("preserves quoted delimiters, embedded newlines, escaped quotes, BOM and blanks", () => {
    expect(
      parseDelimited('\uFEFF"a,b","a""b"\r\n"two\nlines",\r\n', ","),
    ).toEqual([
      ["a,b", 'a"b'],
      ["two\nlines", ""],
    ]);
    expect(parseDelimited("0\t1\n2\t3\n", "\t")).toEqual([
      ["0", "1"],
      ["2", "3"],
    ]);
    for (const value of ['"open', 'a"b', '"a"b'])
      expect(() => parseDelimited(value, ",")).toThrow();
  });
  it("rejects nondecimal, nonfinite and malformed fields rather than silently dropping rows", () => {
    for (const value of ["NaN", "Infinity", "0x10", "1e999", "1,000", "--1"])
      expect(() => numericCell(value)).toThrow();
    expect(numericCell(" -2.3e-4 ")).toBe(-0.00023);
    expect(numericCell(" ")).toBeNull();
    expect(() =>
      mappedRows(
        [
          ["x", "y", "s"],
          ["1", "2"],
        ],
        mapping,
      ),
    ).toThrow(/columns/);
    expect(() =>
      importData(
        [
          ["x", "y", "s"],
          ["1", "2", ""],
        ],
        mapping,
        id,
        "source",
        settings,
      ),
    ).toThrow(/positive/);
    expect(() =>
      mappedRows([["a", "b"]], { ...mapping, sigma: null, y: 0 }),
    ).toThrow(/distinct/);
  });
  it("keeps missing rows and unspecified assumptions, with explicit units only", () => {
    const r = importData(
      [
        ["t", "y", "s"],
        ["1", "", ".2"],
      ],
      { ...mapping, xUnit: "" },
      id,
      "source",
      settings,
    );
    expect(r.dataset.rows[0]).toMatchObject({
      x: 1,
      y: null,
      included: false,
      missingReason: "missing-value",
    });
    expect(r.dataset.xColumn.unit).toBeNull();
    expect(r.dataset.assumptions.exactX).toBe("unknown");
  });
  it("pastes atomically and keeps full precision, identities, originals and retained uncertainties", () => {
    const original = make();
    const before = JSON.stringify(original);
    const equal = switchNoiseModel(original, settings, "unknown-equal");
    const drafts = draftRows(equal.request, equal.settings);
    const pasted = pasteCells(
      drafts,
      0,
      1,
      [
        ["2.123456789012345", ".4"],
        ["3.5", ".5"],
      ],
      3,
    );
    const edited = editData(
      equal.request,
      equal.settings,
      pasted.filter((r) => r.id !== "row-3"),
    );
    expect(edited.request.dataset.rows[0].y).toBe(2.123456789012345);
    expect(edited.settings.retainedPerRowUncertainty?.sigmaByRow).toEqual({
      "row-1": 0.4,
      "row-2": 0.5,
    });
    const restored = switchNoiseModel(
      edited.request,
      edited.settings,
      "supplied-per-row",
    );
    expect(restored.request.uncertainty).toMatchObject({
      sigmaByRow: { "row-1": 0.4, "row-2": 0.5 },
    });
    expect(JSON.stringify(original)).toBe(before);
    expect(drafts[0].y).toBe("2");
    expect(() => pasteCells(drafts, 2, 1, [["2"], ["3"]], 3)).toThrow(
      /exceeds/,
    );
    const session = sessionSchema.parse(
      JSON.parse(
        JSON.stringify({
          format: "tracker-fit-session",
          version: 1,
          ...edited,
          originalRequest: original,
          engine: "qr-vp-sine-2",
        }),
      ),
    );
    expect(session.originalRequest).toEqual(original);
    expect(session.request.dataset.rows).toHaveLength(2);
  });
  it("repairs missing rows, adds rows and prunes deleted exclusions without fabricating sigma", () => {
    const r = make();
    const drafts = draftRows(r, settings);
    expect(() =>
      editData(r, settings, [
        ...drafts,
        { id: "new", x: "3", y: "4", sigma: "" },
      ]),
    ).toThrow(/positive/);
    const missing = editData(r, settings, [
      ...drafts,
      { id: "new", x: "", y: "", sigma: "" },
    ]);
    const repaired = editData(
      missing.request,
      { ...settings, excludedIds: ["row-1"] },
      draftRows(missing.request, settings)
        .filter((r) => r.id !== "row-1")
        .map((r) =>
          r.id === "new" ? { ...r, x: "3", y: "4", sigma: ".1" } : r,
        ),
    );
    expect(repaired.settings.excludedIds).toEqual([]);
    expect(repaired.request.dataset.rows.at(-1)).toMatchObject({
      included: true,
      missingReason: null,
    });
    expect(() =>
      sessionSchema.parse({
        format: "tracker-fit-session",
        version: 1,
        ...repaired,
        originalRequest: { ...r, derived: 1 },
        engine: "qr-vp-sine-2",
      }),
    ).toThrow();
  });
});

it("suggests columns without consuming a headerless first measurement or assuming uncertainty", async () => {
  const { suggestImport } = await import("../../src/core/fit/dataInput");
  expect(suggestImport("Time\tHeight\n0\t2\n1\t3")).toEqual({
    delimiter: "\t",
    header: true,
    headerRows: 1,
    x: 0,
    y: 1,
  });
  expect(suggestImport("0,2\n1,3")).toEqual({
    delimiter: ",",
    header: false,
    headerRows: 0,
    x: 0,
    y: 1,
  });
  expect(suggestImport("id,x,y,sigma\na,0,2,.1\nb,1,3,.2")).toEqual({
    delimiter: ",",
    header: true,
    headerRows: 1,
    x: 1,
    y: 2,
  });
  expect(suggestImport('"Time, seconds",Height\n0,2')).toMatchObject({
    delimiter: ",",
    header: true,
    headerRows: 1,
  });
});

it("suggests headings after explicit leading comments without hiding bad data", async () => {
  const { suggestImport } = await import("../../src/core/fit/dataInput");
  expect(
    suggestImport("# Comment\n# Another\nid,time,height\na,0,2\nb,1,inf"),
  ).toMatchObject({ headerRows: 3, x: 1, y: 2 });
  expect(suggestImport("# Comment\ntime\theight\n0\t2\n1\toops")).toMatchObject(
    { delimiter: "\t", headerRows: 2, x: 0, y: 1 },
  );
  expect(suggestImport("0,2\n# unexpected comment\n1,5").headerRows).toBe(0);
  expect(suggestImport("inf,2\n1,5").headerRows).toBe(0);
});
