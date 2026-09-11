import { readFileSync, existsSync } from "node:fs";
import { expect, it } from "vitest";
import reference from "./published-reference.json";
import { parseDelimited, suggestImport } from "../../src/core/fit/dataInput";
import { analysisFromTable } from "../../src/core/fit/dataTable";
import { initialSettings } from "../../src/core/fit/schema";
import { inspectEquation } from "../../src/core/fit/customEquation";
import { fit } from "../../src/core/fit/solve";

it.each(reference.fits)(
  "published CSV: $id agrees with independent weighted fit",
  (f) => {
    const text = readFileSync(`examples/data/${f.file}`, "utf8");
    const suggestion = suggestImport(text);
    const cells = parseDelimited(text, suggestion.delimiter);
    const analysis = analysisFromTable(
      {
        cells,
        rowIds: cells.map((_, i) => `row-${i}`),
        headerRows: suggestion.headerRows,
        x: f.xColumn,
        y: 1,
        sigma: f.sigmaColumn,
        units: [],
      },
      f.file,
    );
    const names = inspectEquation(f.expression, "x").names;
    const settings = {
      ...initialSettings("custom"),
      custom: {
        expression: f.expression,
        variable: "x",
        names,
        units: names.map(() => ""),
      },
      parameters: f.startingValues.map((value, i) => ({
        value,
        fixed: f.fixed.some((index: number) => index === i),
      })),
      conditionalInference: true,
      excludedIds: analysis.request.dataset.rows
        .filter(
          (r) =>
            (f.minX !== undefined && r.x! < f.minX) ||
            (f.maxX !== undefined && r.x! > f.maxX),
        )
        .map((r) => r.id),
    };
    const result = fit(analysis.request, settings);
    result.coefficients.forEach((value, i) =>
      expect(Math.abs(value - f.expected.coefficients[i])).toBeLessThan(
        2e-6 * Math.max(1, Math.abs(f.expected.coefficients[i])),
      ),
    );
    let j = 0;
    result.standardErrors.forEach((error, i) => {
      if (f.fixed.some((index: number) => index === i)) return;
      const expected = f.expected.standardErrors[j++];
      expect(error.value).not.toBeNull();
      expect(Math.abs(error.value! - expected)).toBeLessThan(
        2e-4 * Math.max(1e-6, expected),
      );
    });
    expect(result.reducedObjective.value).toBeCloseTo(
      f.expected.reducedChiSquare,
      7,
    );
    expect(existsSync(`examples/data/${f.file.replace(/\.csv$/, ".md")}`)).toBe(
      true,
    );
    expect(text).toContain("see documentation:");
  },
);
