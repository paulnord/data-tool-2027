import { expect, it } from "vitest";
import { analysisFromTable } from "../../src/core/fit/dataTable";
import { parseDelimited } from "../../src/core/fit/dataInput";
import {
  collisionFits,
  type CollisionConfig,
} from "../../src/core/fit/collision";
import { collisionWorksheet } from "../../src/core/fit/collisionWorksheet";
import type { DataTable } from "../../src/core/fit/schema";

const table: DataTable = {
  cells: [
    ["t", "x1", "y1", "x2", "y2"],
    ...Array.from({ length: 15 }, (_, i) => [
      String(i / 10),
      ...[1, 2, 3, 4].map((s) => String(s * i + Math.sin(i) / 100)),
    ]),
  ],
  rowIds: Array.from({ length: 16 }, (_, i) => `r${i}`),
  headerRows: 1,
  x: 0,
  y: 1,
  sigma: null,
  units: ["s", "m", "m", "m", "m"],
};
const config: CollisionConfig = {
  time: 0,
  columns: [1, 2, 3, 4],
  before: [0, 0.4],
  after: [1, 1.4],
  sigmas: [null, null, null, null],
  conditional: true,
};
function exported(t = table, c = config) {
  const source = analysisFromTable(t, "source");
  const channels = collisionFits(source, c);
  const original = JSON.stringify({ source, channels, c });
  const result = parseDelimited(collisionWorksheet(channels, source, c), "\t");
  expect(JSON.stringify({ source, channels, c })).toBe(original);
  return { result, channels, source };
}
it("matches the eight-column velocity block, phase-major row order, actual R² and unrounded values", () => {
  const { result, channels } = exported();
  expect(result[0].slice(0, 8)).toEqual([
    "Object",
    "Phase",
    "vx (m/s)",
    "σ(vx) (m/s)",
    "R² x",
    "vy (m/s)",
    "σ(vy) (m/s)",
    "R² y",
  ]);
  expect(result.slice(1, 5).map((r) => r.slice(0, 2))).toEqual([
    ["Object 1", "Before"],
    ["Object 2", "Before"],
    ["Object 1", "After"],
    ["Object 2", "After"],
  ]);
  for (const [row, object, phase] of [
    [1, 0, "before"],
    [2, 1, "before"],
    [3, 0, "after"],
    [4, 1, "after"],
  ] as const) {
    for (let axis = 0; axis < 2; axis++) {
      const r = channels[object * 2 + axis][phase].result!;
      expect(result[row].slice(2 + axis * 3, 5 + axis * 3)).toEqual(
        [r.coefficients[1], r.standardErrors[1].value, r.rSquared.value].map(
          String,
        ),
      );
    }
  }
  expect(result[0][16]).toBe("Collision fit report");
  expect(result[2][36]).toBe("R²");
});
it("preserves raw source order and precision, inclusive windows, and a whole collision gap", () => {
  const { result } = exported();
  expect(result[7].slice(0, 6)).toEqual([
    "Time (s)",
    "Object 1 x (m)",
    "Object 1 y (m)",
    "Object 2 x (m)",
    "Object 2 y (m)",
    "Phase",
  ]);
  expect(result.slice(8).map((r) => r.slice(0, 5))).toEqual(
    table.cells.slice(1),
  );
  expect(result.slice(8).map((r) => r[5])).toEqual([
    ...Array(5).fill("Before"),
    ...Array(5).fill("Exclude"),
    ...Array(5).fill("After"),
  ]);
  expect(result[10].slice(9, 11)).toEqual(["Raw data rows", "15"]);
  expect(result[7].slice(9, 12)).toEqual(["Before", "0", "0.4"]);
  expect(result[8].slice(9, 12)).toEqual(["After", "1", "1.4"]);
});
it("keeps axis-specific missing values without falsely excluding other components", () => {
  const changed = structuredClone(table);
  changed.cells[2][2] = "";
  changed.cells[8][0] = "";
  const { result, channels } = exported(changed);
  expect(result[9].slice(0, 6)).toEqual([...changed.cells[2], "Before"]);
  expect(result[15][5]).toBe("Exclude");
  expect(channels[0].before.result!.n).toBe(5);
  expect(channels[1].before.result!.n).toBe(4);
  expect(result[5][0]).toContain("excluded independently");
});
it("labels supplied versus residual sigma truthfully and preserves unavailable uncertainty", () => {
  const { result } = exported(table, {
    ...config,
    sigmas: [0.1, null, 0.2, null],
    conditional: false,
  });
  expect(result[1][13]).toBe("Supplied position precision");
  expect(result[1][14]).toBe("0.1");
  expect(result[2][13]).toContain("Residual-based");
  expect(result[2][14]).toBe("");
  expect(result[1][3]).toBe("Unavailable");
  expect(result.map((r) => r.join(" ")).join(" ")).toContain(
    "Required inference assumptions",
  );
});
it("does not fabricate R² for constant positions or slopes for failed fits", () => {
  const changed = structuredClone(table);
  changed.cells.slice(1).forEach((r, i) => {
    r[1] = "2";
    if (i < 5) r[2] = "";
  });
  const { result } = exported(changed);
  expect(result[1][4]).toBe("Unavailable");
  expect(result[1].slice(5, 8)).toEqual([
    "Unavailable",
    "Unavailable",
    "Unavailable",
  ]);
});
it("keeps true mixed/unknown units and warns instead of relabeling or converting to SI", () => {
  const changed = { ...table, units: ["s", "cm", "m", "m", ""] };
  const { result, channels } = exported(changed);
  expect(result[0][2]).toBe("vx (Object 1: cm/s; Object 2: m/s)");
  expect(result[1][2]).toBe(String(channels[0].before.result!.coefficients[1]));
  expect(result[5][0]).toContain("Unit warning");
  expect(result[7][1]).toBe("Object 1 x (cm)");
});
it("rejects overlapping or divergent selections rather than inventing one phase", () => {
  const { channels, source } = exported();
  channels[0].after.interval[0] = 0.3;
  expect(() => collisionWorksheet(channels, source, config)).toThrow(
    /Overlapping/,
  );
  channels[0].after.interval[0] = 1;
  channels[1].before.settings.excludedIds.push("r1");
  expect(() => collisionWorksheet(channels, source, config)).toThrow(
    /identical time selections/,
  );
});
it("escapes labels as text, retains negative numbers, and retains more than100 raw rows", () => {
  const changed = structuredClone(table);
  changed.cells[0][1] = "=1+1";
  changed.cells[1][1] = "-1.2345678901234567";
  for (let i = 15; i < 120; i++) {
    changed.cells.push([String(i), "1", "2", "3", "4"]);
    changed.rowIds.push(`r${i + 1}`);
  }
  const { result } = exported(changed);
  expect(result[1][11]).toBe("'=1+1");
  expect(result[8][1]).toBe("-1.2345678901234567");
  expect(result[10][10]).toBe("120");
  expect(result.length).toBe(128);
});
it("keeps a short raw block distinct from metadata and diagnostics", () => {
  const changed = {
    ...table,
    cells: table.cells.slice(0, 5),
    rowIds: table.rowIds.slice(0, 5),
  };
  const { result } = exported(changed, {
    ...config,
    before: [0, 0.1],
    after: [0.2, 0.3],
  });
  expect(result[10][10]).toBe("4");
  expect(result.slice(8, 12).map((r) => r.slice(0, 5))).toEqual(
    changed.cells.slice(1),
  );
  expect(result[12].slice(0, 6)).toEqual(Array(6).fill(""));
});
it("honors reordered position assignments and missing values in the first channel", () => {
  const changed = structuredClone(table);
  changed.cells[2][3] = "";
  const { result, channels } = exported(changed, {
    ...config,
    columns: [3, 4, 1, 2],
  });
  expect(result[1][11]).toBe("x2");
  expect(result[9].slice(0, 6)).toEqual([
    changed.cells[2][0],
    "",
    changed.cells[2][4],
    changed.cells[2][1],
    changed.cells[2][2],
    "Before",
  ]);
  expect(result[1][2]).toBe(String(channels[0].before.result!.coefficients[1]));
  expect(channels[0].before.result!.n).toBe(4);
  expect(channels[1].before.result!.n).toBe(5);
});
