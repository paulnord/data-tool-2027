import { it, expect } from "vitest";
import {
  fitReportRows,
  fitReportTable,
  fitReportTsv,
  nameSavedSession,
} from "../../src/core/fit/report";
import { syntheticRequest } from "../support/synthetic";
import { initialSettings, sessionSchema } from "../../src/core/fit/schema";
import { parseDelimited } from "../../src/core/fit/dataInput";
import { fit } from "../../src/core/fit/solve";
import { statisticReasonText } from "../../src/core/fit/diagnosticText";
const settings = () => ({ ...initialSettings(), physicalTimeConfirmed: true });
it("puts scalar summary statistics in separate adjacent spreadsheet cells", () => {
  const r = syntheticRequest(),
    s = settings(),
    f = fit(r, s),
    rows = fitReportRows(r, s, f);
  expect(new Set(rows.map((row) => row[0])).size).toBe(rows.length);
  const table = new Map(rows);
  expect(table.get("n")).toBe(61);
  expect(table.get("rank")).toBe(3);
  expect(table.get("df")).toBe(58);
  expect(table.get("SSE")).toBe(f.sse);
  expect(table.get("Q")).toBe(f.q.value);
  expect(table.get("Centered R²")).toBe(f.rSquared.value);
  expect(rows.every((row) => row.length === 2)).toBe(true);
});
it("retains rectangular parameter and observation tables around the statistics block", () => {
  const r = syntheticRequest(),
    s = settings(),
    f = fit(r, s),
    tsv = fitReportTsv(r, s, f);
  const sections = tsv
    .trimEnd()
    .split("\r\n\r\n")
    .map((block) => block.split("\r\n").map((row) => row.split("\t")));
  expect(sections[1][0]).toEqual([
    "Parameter",
    "Value",
    "Standard error",
    "95% lower",
    "95% upper",
  ]);
  expect(sections[1].every((row) => row.length === 5)).toBe(true);
  expect(Number(sections[1][3][1])).toBe(f.coefficients[2]);
  expect(sections[2][0]).toEqual(["Statistic", "Value"]);
  expect(sections[2].every((row) => row.length === 2)).toBe(true);
  expect(sections[3][0]).toEqual(["Row", "x", "y", "predicted", "residual"]);
  expect(sections[3]).toHaveLength(62);
  expect(sections[3].every((row) => row.length === 5)).toBe(true);
  expect(Number(sections[3][1][4])).toBe(f.residuals[0].residual);
  expect(tsv).not.toContain("observation.");
  expect(tsv).not.toContain("parameter.a.value");
});

it("numbers observations by original input position while preserving stable identities and gaps", () => {
  const request = syntheticRequest();
  request.dataset.rows[0].id = "cb814d73-b347-4f7c-8cb3-a9ebbe71421b";
  request.dataset.rows[2].id = "specimen-A";
  request.dataset.rows[1].included = false;
  request.dataset.rows[3] = {
    ...request.dataset.rows[3],
    y: null,
    included: false,
    missingReason: "missing-value",
  };
  const s = { ...settings(), excludedIds: [request.dataset.rows[6].id] };
  const session = sessionSchema.parse({
    format: "tracker-fit-session",
    version: 1,
    request,
    settings: s,
    engine: "qr-vp-sine-2",
  });
  const result = fit(session.request, session.settings);
  const before = JSON.stringify({ session, result });
  const table = fitReportTable(session.request, session.settings, result);
  const start = table.findIndex((row) => row[0] === "Row");
  const observations = table.slice(
    start + 1,
    start + result.residuals.length + 1,
  );
  expect(observations.slice(0, 5).map((row) => row[0])).toEqual([
    1, 3, 5, 6, 8,
  ]);
  expect(observations.at(-1)?.[0]).toBe(61);
  expect(observations[1].slice(1)).toEqual([
    result.residuals[1].x,
    result.residuals[1].y,
    result.residuals[1].predicted,
    result.residuals[1].residual,
  ]);
  expect(result.residuals[1].id).toBe("specimen-A");
  expect(JSON.stringify({ session, result })).toBe(before);
  expect(sessionSchema.parse(JSON.parse(JSON.stringify(session)))).toEqual(
    session,
  );
});

it("does not invent an input association for an unknown residual identity", () => {
  const request = syntheticRequest(),
    s = settings(),
    result = fit(request, s);
  const unmatched = {
    ...result,
    residuals: [{ ...result.residuals[0], id: "not-an-input-row" }],
  };
  const table = fitReportTable(request, s, unmatched);
  const start = table.findIndex((row) => row[0] === "Row");
  expect(table[start + 1]).toEqual([
    null,
    unmatched.residuals[0].x,
    unmatched.residuals[0].y,
    unmatched.residuals[0].predicted,
    unmatched.residuals[0].residual,
  ]);
});
it("keeps unavailable statistics empty with separate explanations and quotes cell text", () => {
  const r = syntheticRequest(),
    s = settings();
  r.uncertainty = { kind: "unknown-equal", errorStructure: "uncorrelated" };
  r.dataset.label = 'two\tcolumns\nand "quotes"';
  const f = fit(r, s),
    rows = new Map(fitReportRows(r, s, f)),
    tsv = fitReportTsv(r, s, f);
  expect(rows.get("Q")).toBeNull();
  expect(rows.get("Q unavailable reason")).toBe(
    "No absolute y uncertainty was supplied",
  );
  expect(f.q.reason).toBe("unknown-noise-scale");
  expect(tsv).toContain("Q\t\r\n");
  expect(tsv).toContain('Dataset\t"two\tcolumns\nand ""quotes"""');
});

it("explains fixed and unsupported parameter uncertainty without changing diagnostic codes", () => {
  const request = syntheticRequest(),
    s = settings();
  request.dataset.assumptions.correctModel = "unknown";
  s.parameters[0] = { value: 2, fixed: true };
  const result = fit(request, s),
    before = JSON.stringify({ request, s, result }),
    report = fitReportTable(request, s, result),
    header = report.findIndex((row) => row[0] === "Parameter");
  expect(report[header + 1][2]).toBe("Fixed parameter");
  expect(report[header + 2][2]).toBe(
    "Required inference assumptions are unconfirmed or contradicted",
  );
  expect(report[header + 2][1]).toBe(result.coefficients[1]);
  expect(report[header + 2].slice(3)).toEqual([null, null]);
  expect(result.standardErrors.map((error) => error.reason)).toEqual([
    "fixed",
    "unsupported-assumptions",
    "unsupported-assumptions",
  ]);
  expect(JSON.stringify({ request, s, result })).toBe(before);
});

it("retains an unfamiliar diagnostic instead of inventing an explanation", () => {
  expect(statisticReasonText("future-diagnostic")).toBe("future-diagnostic");
  expect(statisticReasonText("constructor")).toBe("constructor");
  expect(statisticReasonText(null)).toBe("Unavailable");
});

it("copies filename and multiline provenance into adjacent spreadsheet cells", () => {
  const r = syntheticRequest(),
    s = settings();
  r.dataset.label = "An editable title";
  r.source.fileName = "import-curiosities.csv";
  r.source.context =
    'import-curiosities.csv\n# Repeat experiment\nOperator\t"A"\n\n=This is a comment';
  const result = fit(r, s);
  const rows = parseDelimited(fitReportTsv(r, s, result), "\t");
  expect(rows.find((row) => row[0] === "Dataset")).toEqual([
    "Dataset",
    "An editable title",
  ]);
  expect(rows.find((row) => row[0] === "Source application")).toEqual([
    "Source application",
    r.source.application,
  ]);
  expect(rows.find((row) => row[0] === "Source notes")).toEqual([
    "Source notes",
    r.source.context,
  ]);
  expect(rows[0]).toEqual(["Dataset", "An editable title"]);
  const start = rows.findIndex((row) => row[0] === "Row");
  expect(rows.findIndex((row) => row[0] === "Source notes")).toBeGreaterThan(
    start + result.residuals.length,
  );
  r.source.fileName = null;
  const pasted = parseDelimited(fitReportTsv(r, s, result), "\t");
  expect(pasted[0]).toEqual(["Dataset", "An editable title"]);
  for (const heading of ["Parameter", "Statistic", "Row"])
    expect(pasted.findIndex((row) => row[0] === heading)).toBe(
      rows.findIndex((row) => row[0] === heading),
    );

  expect(
    rows.slice(start + 1, start + 62).every((row) => row.length === 5),
  ).toBe(true);
  expect(Number(rows[start + 1][4])).toBe(result.residuals[0].residual);
  r.source.context = '=HYPERLINK("example")';
  expect(
    parseDelimited(fitReportTsv(r, s, result), "\t").find(
      (row) => row[0] === "Source notes",
    )?.[1],
  ).toBe("'" + r.source.context);
  r.source.context = null;
  expect(
    parseDelimited(fitReportTsv(r, s, result), "\t").find(
      (row) => row[0] === "Source notes",
    ),
  ).toEqual(["Source notes", ""]);
});

it("uses the saved session basename only for generically named pasted datasets", () => {
  const request = syntheticRequest();
  request.dataset.label = "Pasted data";
  request.source.fileName = null;
  const session = sessionSchema.parse({
    format: "tracker-fit-session",
    version: 1,
    request,
    settings: settings(),
    engine: "qr-vp-sine-2",
  });
  const named = nameSavedSession(session, "/tmp/Trial 12.trksess");
  expect(named.request.dataset.label).toBe("Trial 12");
  expect(session.request.dataset.label).toBe("Pasted data");
  expect(named.request.dataset.rows).toBe(session.request.dataset.rows);
  expect(
    sessionSchema.parse(JSON.parse(JSON.stringify(named))).request.dataset
      .label,
  ).toBe("Trial 12");
  expect(nameSavedSession(named, "another.trksess")).toBe(named);
  expect(
    nameSavedSession(
      {
        ...session,
        request: {
          ...request,
          source: { ...request.source, fileName: "measurements.csv" },
        },
      },
      "another.trksess",
    ).request.dataset.label,
  ).toBe("Pasted data");
});
