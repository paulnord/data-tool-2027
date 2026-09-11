import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
const classroomExamples = readdirSync("examples/data").filter((file) =>
  file.endsWith(".csv"),
);
import { parseDelimited, suggestImport } from "../../src/core/fit/dataInput";
import { analysisFromTable, tableCsv } from "../../src/core/fit/dataTable";
import { fit } from "../../src/core/fit/solve";
import { initialSettings, sessionSchema } from "../../src/core/fit/schema";

it.each(classroomExamples)(
  "ordinary classroom file %s imports and round trips without preloaded fit assumptions",
  (file) => {
    const text = readFileSync(`examples/data/${file}`, "utf8");
    const suggestion = suggestImport(text);
    const cells = parseDelimited(text, suggestion.delimiter);
    const analysis = analysisFromTable(
      {
        cells,
        rowIds: cells.map((_, i) => `row-${i}`),
        headerRows: suggestion.headerRows,
        x: suggestion.x,
        y: suggestion.y,
        sigma: null,
        units: [],
      },
      file,
      undefined,
      file,
    );
    expect(analysis.request.dataset.rows.length).toBeGreaterThanOrEqual(8);
    expect(analysis.request.dataset.rows.every((r) => r.included)).toBe(true);
    expect(analysis.request.uncertainty).toEqual({
      kind: "unknown-equal",
      errorStructure: "unknown",
    });
    expect(analysis.request.dataset.assumptions).toEqual({
      exactX: "unknown",
      gaussianIndependent: "unknown",
      correctModel: "unknown",
    });
    if (file === "MillikanData.csv") {
      expect(analysis.request.source.context ?? "").not.toContain(
        "Synthetic classroom data",
      );
      expect(analysis.request.dataset.xColumn.unit).toBe("s");
      expect(analysis.request.dataset.yColumn.unit).toBe("mm");
    } else if (file.startsWith("published-")) {
      expect(analysis.request.source.context).toContain("Published data:");
      expect(analysis.request.source.context).not.toContain(
        "Synthetic classroom data",
      );
    } else {
      expect(analysis.request.source.context).toContain(
        "Synthetic classroom data",
      );
    }
    const saved = sessionSchema.parse(
      JSON.parse(
        JSON.stringify({
          format: "tracker-fit-session",
          version: 1,
          ...analysis,
          engine: "qr-vp-sine-2",
        }),
      ),
    );
    expect(saved.dataTable?.cells).toEqual(cells);
    expect(
      parseDelimited(tableCsv(analysis.dataTable!), ",").slice(
        suggestion.headerRows,
      ),
    ).toEqual(cells.slice(suggestion.headerRows));
    // A descriptive line is always a valid baseline; students explicitly choose more suitable models.
    const result = fit(analysis.request, initialSettings("line"));
    expect(result.rank).toBe(2);
    expect(result.coefficients.every(Number.isFinite)).toBe(true);
    expect(result.inference).toBe("descriptive");
  },
);
