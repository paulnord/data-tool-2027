import { it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import { z } from "zod/v4";
import {
  initialSettings,
  sessionSchema,
  analysisSchema,
  type MultiIntervalWorkspace,
} from "../../src/core/fit/schema";
import { tableForAnalysis } from "../../src/core/fit/dataTable";
import { parseDelimited } from "../../src/core/fit/dataInput";
import { fitInterval } from "../../src/core/fit/intervals";
import { syntheticRequest } from "../support/synthetic";
const examplePath = "examples/data/cavendish/";
const example = () =>
  sessionSchema.parse(
    JSON.parse(
      readFileSync(examplePath + "cavendish-multi-interval.trksess", "utf8"),
    ),
  );
export function multiSession() {
  const request = syntheticRequest();
  const settings = initialSettings("line");
  const dataTable = tableForAnalysis({ request, settings });
  const w: MultiIntervalWorkspace = {
    kind: "multi-interval",
    x: 0,
    columns: [1],
    sigmas: [0.03],
    uncertainty: "supplied",
    conditional: true,
    intervals: [
      { name: "First", range: [0, 1], settings: [settings] },
      { name: "Second", range: null, settings: [initialSettings("custom")] },
    ],
    intervalCount: 2,
    activeInterval: 1,
    activeCurve: 0,
    xRange: [-1, 4],
    yRanges: [[-2, 10]],
    includeDetails: true,
  };
  return sessionSchema.parse({
    format: "tracker-fit-session",
    version: 7,
    request,
    settings,
    dataTable,
    engine: "qr-vp-sine-2",
    workspace: w,
    view: { showResiduals: false, showGuides: true, showErrorBars: true },
  });
}
it("Cavendish preserves every source field, missing row and elapsed-time assignment", () => {
  const s = example();
  const csv = readFileSync(examplePath + "Cavendish.csv");
  expect(createHash("sha256").update(csv).digest("hex")).toBe(
    "0380dd44f812bb372369a01fe73021e115bd843b188e4c6647e632adf621996b",
  );
  expect(s.dataTable!.cells).toEqual(parseDelimited(csv.toString(), ","));
  expect(s.request.dataset.rows).toHaveLength(919);
  expect(s.request.dataset.rows.filter((r) => r.included)).toHaveLength(907);
  expect(s.request.dataset.xColumn.unit).toBe("s");
  expect(s.request.dataset.yColumn.unit).toBe("m");
  expect(sessionSchema.parse(JSON.parse(JSON.stringify(s)))).toEqual(s);
});
it("the Cavendish saved starting values reproduce both independent damped fits in seconds", () => {
  const s = example();
  if (s.workspace.kind !== "multi-interval") throw Error("Wrong workspace");
  const w = s.workspace;
  for (const [i, baseline, period, decay, n] of [
    [0, 0.61555314496, 633.76503396, 994.32945998, 279],
    [1, 0.82498039271, 638.74881769, 969.692946, 536],
  ]) {
    const result = fitInterval(
      s,
      { ...w, sigmas: w.columns.map(() => null) },
      i,
    )[0];
    expect(result.error).toBeNull();
    expect(result.result!.coefficients[0]).toBeCloseTo(baseline, 7);
    expect(result.result!.coefficients[3]).toBeCloseTo(period, 4);
    expect(result.result!.coefficients[4]).toBeCloseTo(decay, 4);
    expect(result.result!.n).toBe(n);
    expect(result.result!.inference).toBe("descriptive");
  }
});
it("current structural schema is reproducible and independently validates the example", () => {
  const published = JSON.parse(
    readFileSync("schemas/tracker-fit-session.v7.json", "utf8"),
  );
  const { title: _, $comment: __, ...actual } = published;
  expect(actual).toEqual(z.toJSONSchema(sessionSchema, { target: "draft-7" }));
  const validate = new Ajv({ strict: false, validateFormats: false }).compile(
    published,
  );
  expect(validate(example()), JSON.stringify(validate.errors)).toBe(true);
  expect(validate({ ...example(), result: {} })).toBe(false);
});
it("workspace round trips preserve hidden intervals, separate curve units, constraints and uncertainty entries", () => {
  const s = multiSession();
  if (s.workspace.kind !== "multi-interval") throw Error("Wrong workspace");
  const w = s.workspace;
  s.dataTable!.cells.forEach((row, i) =>
    row.push(i ? String(i / 1000) : "Second Y"),
  );
  s.dataTable!.units = ["s", "m", "mH"];
  w.columns.push(2);
  w.sigmas.push(0.007);
  w.yRanges.push(null);
  for (const interval of w.intervals)
    interval.settings.push(structuredClone(interval.settings[0]));
  w.intervals[0].settings[1].parameters[0] = { value: 1.25, fixed: true };
  w.intervals[1].settings[1].custom!.units = ["mH", "mH/s"];
  w.intervals[1].settings[0].excludedIds = [s.request.dataset.rows[0].id];
  w.intervalCount = 1;
  w.activeInterval = 0;
  w.activeCurve = 1;
  expect(sessionSchema.parse(JSON.parse(JSON.stringify(s)))).toEqual(s);
});
const invalidCases: [
  string,
  (s: ReturnType<typeof multiSession>, w: MultiIntervalWorkspace) => void,
][] = [
  ["duplicate columns", (_, w) => (w.columns = [0])],
  ["unavailable column", (_, w) => (w.columns = [99])],
  ["missing sigma", (_, w) => (w.sigmas = [null])],
  ["nonpositive sigma", (_, w) => (w.sigmas = [0])],
  ["wrong sigma count", (_, w) => (w.sigmas = [])],
  ["unordered interval", (_, w) => (w.intervals[0].range = [2, 1])],
  [
    "unknown excluded row",
    (_, w) => (w.intervals[0].settings[0].excludedIds = ["not-a-row"]),
  ],
  ["missing curve settings", (_, w) => (w.intervals[0].settings = [])],
  ["active hidden interval", (_, w) => (w.intervalCount = 1)],
  ["active absent curve", (_, w) => (w.activeCurve = 1)],
  [
    "nonfinite start",
    (_, w) => (w.intervals[0].settings[0].parameters[0].value = NaN),
  ],
  ["blank name", (_, w) => (w.intervals[0].name = " ")],
  ["changed source cell", (s) => (s.dataTable!.cells[1][0] = "123")],
  ["source engine mismatch", (s) => (s.engine = "qr-lm-3")],
  ["bad axis limits", (_, w) => (w.xRange = [1, 1])],
];
it.each(invalidCases)(
  "rejects %s before replacing or saving work",
  (_, mutate) => {
    const s = multiSession();
    if (s.workspace.kind !== "multi-interval") throw Error("Wrong workspace");
    mutate(s, s.workspace);
    expect(sessionSchema.safeParse(s).success).toBe(false);
  },
);
it("comparison retains full candidate snapshots, built-in/custom engines and the active candidate", () => {
  const s = multiSession();
  const base = analysisSchema.parse({
    request: s.request,
    settings: s.settings,
    dataTable: s.dataTable,
    engine: s.engine,
  });
  const custom = analysisSchema.parse({
    ...base,
    settings: initialSettings("custom"),
    engine: "qr-expression-4",
  });
  const comparison = {
    ...s,
    workspace: {
      kind: "model-comparison",
      activeCandidate: 1,
      candidates: [
        { label: "Line", analysis: base },
        { label: "Custom", analysis: custom },
      ],
    },
  };
  expect(sessionSchema.parse(JSON.parse(JSON.stringify(comparison)))).toEqual(
    comparison,
  );
  custom.settings.excludedIds = ["missing"];
  expect(sessionSchema.safeParse(comparison).success).toBe(false);
});
it("collision sessions validate channel assignments and ordered separated windows", () => {
  const s = multiSession();
  s.dataTable!.cells.forEach((r, i) =>
    r.push(...(i ? ["1", "2", "3"] : ["y2", "y3", "y4"])),
  );
  s.dataTable!.units.push("m", "m", "m");
  const collision = {
    ...s,
    workspace: {
      kind: "collision",
      time: 0,
      columns: [1, 2, 3, 4],
      uncertainty: "estimate",
      sigmas: [null, null, null, null],
      conditional: false,
      before: [0, 1],
      after: [2, 3],
      details: true,
      includeDetails: false,
      xRange: null,
      yRanges: [null, null, null, null],
    },
  };
  expect(sessionSchema.parse(JSON.parse(JSON.stringify(collision)))).toEqual(
    collision,
  );
  collision.workspace.after = [0.5, 3];
  expect(sessionSchema.safeParse(collision).success).toBe(false);
});
