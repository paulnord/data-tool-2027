import { expect, it } from "vitest";
import { analysisFromTable } from "../../src/core/fit/dataTable";
import { parseDelimited } from "../../src/core/fit/dataInput";
import {
  collisionFits,
  type CollisionConfig,
} from "../../src/core/fit/collision";
import {
  collisionPositions,
  collisionFitTable,
} from "../../src/core/fit/collisionWorksheet";
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
  const positions = parseDelimited(
    collisionPositions(channels, source, c),
    "\t",
  );
  const fits = parseDelimited(collisionFitTable(channels), "\t");
  expect(JSON.stringify({ source, channels, c })).toBe(original);
  return { positions, fits, channels, source };
}
it("exports one long row per fit with exact coefficients, counts and intervals", () => {
  const { fits, channels } = exported();
  expect(fits).toHaveLength(9);
  expect(fits[1][13]).toContain("conditional");
  expect(fits[1][13]).toContain("selection after inspecting");
  expect(fits[0]).toEqual([
    "Object",
    "Phase",
    "Axis",
    "N",
    "Velocity (m/s)",
    "Velocity σ (m/s)",
    "Intercept (m)",
    "R²",
    "From (s)",
    "To (s)",
    "Uncertainty method",
    "Position σ (m)",
    "Source column",
    "Notes",
  ]);
  for (let i = 0; i < 8; i++) {
    const c = channels[i % 4],
      phase = i < 4 ? "before" : "after",
      r = c[phase].result!;
    expect(fits[i + 1].slice(0, 10)).toEqual(
      [
        `Object ${Math.floor((i % 4) / 2) + 1}`,
        i < 4 ? "Before" : "After",
        i % 2 ? "y" : "x",
        r.n,
        r.coefficients[1],
        r.standardErrors[1].value,
        r.coefficients[0],
        r.rSquared.value,
        ...c[phase].interval,
      ].map(String),
    );
  }
});
it("preserves every raw row, source precision, and inclusive phase membership", () => {
  const { positions } = exported();
  expect(positions[0]).toEqual([
    "Time (s)",
    "Object 1 x (m)",
    "Object 1 y (m)",
    "Object 2 x (m)",
    "Object 2 y (m)",
    "Phase",
  ]);
  expect(positions.slice(1).map((r) => r.slice(0, 5))).toEqual(
    table.cells.slice(1),
  );
  expect(positions.slice(1).map((r) => r[5])).toEqual([
    ...Array(5).fill("Before"),
    ...Array(5).fill("Exclude"),
    ...Array(5).fill("After"),
  ]);
});
it("keeps missing axes independent and invalid times excluded", () => {
  const changed = structuredClone(table);
  changed.cells[2][2] = "";
  changed.cells[8][0] = "";
  const { positions, fits } = exported(changed);
  expect(positions[2]).toEqual([...changed.cells[2], "Before"]);
  expect(positions[8][5]).toBe("Exclude");
  expect(fits[1][3]).toBe("5");
  expect(fits[2][3]).toBe("4");
});
it("preserves uncertainty methods and unavailable statistics instead of zero", () => {
  const { fits } = exported(table, {
    ...config,
    sigmas: [0.1, null, 0.2, null],
    conditional: false,
  });
  expect(fits[1][10]).toBe("Supplied position precision");
  expect(fits[1][11]).toBe("0.1");
  expect(fits[2][10]).toBe("Residual-based");
  expect(fits[2][11]).toBe("Not supplied");
  expect(fits[1][5]).toBe("Unavailable");
  expect(fits[1][13]).toContain("Required inference assumptions");
});
it("explains failed fits and constant-axis unavailable R²", () => {
  const changed = structuredClone(table);
  changed.cells.slice(1).forEach((r, i) => {
    r[1] = "2";
    if (i < 5) r[2] = "";
  });
  const { fits } = exported(changed);
  expect(fits[1][7]).toBe("Unavailable");
  expect(fits[1][13]).not.toBe("");
  expect(fits[2].slice(3, 8)).toEqual(Array(5).fill("Unavailable"));
  expect(fits[2][13]).not.toBe("");
});
it("uses explicit per-row units only for genuinely mixed units, never converts", () => {
  const { fits, positions, channels } = exported({
    ...table,
    units: ["s", "cm", "m", "m", ""],
  });
  expect(fits[0][4]).toBe("Velocity (source units)");
  expect(fits[0].slice(14)).toEqual([
    "Velocity unit",
    "Position unit",
    "Time unit",
  ]);
  expect(fits[1].slice(14)).toEqual(["cm/s", "cm", "s"]);
  expect(fits[1][4]).toBe(String(channels[0].before.result!.coefficients[1]));
  expect(positions[0][1]).toBe("Object 1 x (cm)");
});
it("rejects overlapping and divergent shared selections", () => {
  const { channels, source } = exported();
  channels[0].after.interval[0] = 0.3;
  expect(() => collisionPositions(channels, source, config)).toThrow(
    /Overlapping/,
  );
  channels[0].after.interval[0] = 1;
  channels[1].before.settings.excludedIds.push("r1");
  expect(() => collisionPositions(channels, source, config)).toThrow(
    /identical time selections/,
  );
});
it("escapes source labels, preserves negative numbers and more than100 raw rows", () => {
  const changed = structuredClone(table);
  changed.cells[0][1] = "=1+1";
  changed.cells[1][1] = "-1.2345678901234567";
  for (let i = 15; i < 120; i++) {
    changed.cells.push([String(i), "1", "2", "3", "4"]);
    changed.rowIds.push(`r${i + 1}`);
  }
  const { positions, fits } = exported(changed);
  expect(fits[1][12]).toBe("'=1+1");
  expect(positions[1][1]).toBe("-1.2345678901234567");
  expect(positions).toHaveLength(121);
});
it("honors reordered assignments", () => {
  const { positions, fits } = exported(table, {
    ...config,
    columns: [3, 4, 1, 2],
  });
  expect(fits[1][12]).toBe("x2");
  expect(positions[2].slice(0, 5)).toEqual([
    table.cells[2][0],
    table.cells[2][3],
    table.cells[2][4],
    table.cells[2][1],
    table.cells[2][2],
  ]);
});
