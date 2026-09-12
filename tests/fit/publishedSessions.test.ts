import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import { sessionSchema } from "../../src/core/fit/schema";
import { fit } from "../../src/core/fit/solve";
import { parseDelimited, suggestImport } from "../../src/core/fit/dataInput";
const dir = "examples/data/published";
const files = readdirSync(dir).filter((f) => f.endsWith(".trksess"));
it.each(files)(
  "published session %s validates, preserves its CSV observations and fits",
  (file) => {
    const session = sessionSchema.parse(
      JSON.parse(readFileSync(`${dir}/${file}`, "utf8")),
    );
    const text = readFileSync(
      `${dir}/${file.replace(/\.trksess$/, ".csv")}`,
      "utf8",
    );
    const suggestion = suggestImport(text);
    const rows = parseDelimited(text, suggestion.delimiter).slice(
      suggestion.headerRows,
    );
    const chamber = file.includes("ion-chamber");
    expect(session.request.dataset.rows).toHaveLength(rows.length);
    session.request.dataset.rows.forEach((row, i) => {
      expect(row.x).toBe(Number(rows[i][chamber ? 5 : 0]));
      expect(row.y).toBe(Number(rows[i][1]));
      const u = session.request.uncertainty;
      if (u.kind === "supplied-per-row")
        expect(u.sigmaByRow[row.id]).toBe(Number(rows[i][2]));
      else expect(u.kind).toBe("unknown-equal");
    });
    const result = fit(session.request, session.settings);
    expect(result.coefficients.every(Number.isFinite)).toBe(true);
  },
);
