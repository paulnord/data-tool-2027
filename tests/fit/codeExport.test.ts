import { expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import {
  buildCodeExportDescription,
  generateCodeExportBundle,
  generateCodeExportCsv,
  generateCodeExportMetadata,
  generateObservationArchiveCsv,
  generatePythonCode,
  generateRootCode,
} from "../../src/core/fit/codeExport";
import { parseDelimited } from "../../src/core/fit/dataInput";
import { encodeCodeExportBundle } from "../../src/fit/codeExportArchive";
import { initialSettings } from "../../src/core/fit/schema";
import { fit } from "../../src/core/fit/solve";
import { syntheticRequest } from "../support/synthetic";

function describe(
  request = syntheticRequest(),
  settings = initialSettings("line"),
) {
  return buildCodeExportDescription(request, settings, fit(request, settings), {
    mode: "linear",
    xRange: [0, 2],
    yRange: null,
    showResiduals: true,
    showErrorBars: true,
    showGuides: true,
  });
}

it("exports selected numeric observations and separately preserves the complete record", () => {
  const request = syntheticRequest(),
    settings = initialSettings("quadratic");
  request.source.context =
    'Imported notes: "copper", mH\r\n# second line\n\nlast line';
  request.dataset.rows[0].id = 'row,"quoted"\nnext';
  request.dataset.rows[0].included = false;
  settings.excludedIds = [request.dataset.rows[2].id];
  settings.parameters[0] = { value: 1.2345678901234567, fixed: true };
  const description = describe(request, settings);
  const csv = generateCodeExportCsv(description);
  expect(csv).toMatch(
    /^# Imported notes: "copper", mH\r\n# # second line\r\n# \r\n# last line\r\n/,
  );
  const selected = csv
    .trim()
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("#"))
    .map((line) => line.split(",").map(Number));
  expect(selected).toEqual(
    request.dataset.rows
      .filter((_, i) => i !== 0 && i !== 2)
      .map((row) => [
        row.x,
        row.y,
        description.sigma[request.dataset.rows.indexOf(row)],
      ]),
  );
  const original = generateObservationArchiveCsv(description);
  const records = parseDelimited(
    original.slice(original.indexOf("row_id,")),
    ",",
  );
  expect(records).toHaveLength(request.dataset.rows.length + 1);
  expect(records[1][0]).toBe('row,"quoted"\nnext');
  expect(records[1][4]).toBe("false");
  expect(records[3][4]).toBe("false");
  const metadata = JSON.parse(generateCodeExportMetadata(description));
  expect(metadata).toMatchObject({
    format: "data-tool-analysis-bundle",
    version: 2,
    dataset: {
      columns: ["x", "y", "sigma_y"],
      observationArchive: "observations.csv",
    },
  });
  expect(metadata.dataset.fitRowIds).toEqual(
    description.rowIds.filter((_, i) => i !== 0 && i !== 2),
  );
  expect(metadata.fit.parameters[0]).toMatchObject({
    start: 1.2345678901234567,
    fixed: true,
  });
  expect(metadata.dataset.rowCount).toBe(selected.length);
  expect(metadata.dataset.sourceRowCount).toBe(request.dataset.rows.length);
  expect(metadata.uncertainty.values).toBe("data.csv:sigma_y");
  expect(generatePythonCode(description)).toContain("free = np.array([1, 2])");
  expect(generateRootCode(description)).toContain(
    "model.FixParameter(0, 1.2345678901234567)",
  );
});

it("creates one small standalone program per target without runtime metadata or helper files", () => {
  const description = describe();
  const python = generatePythonCode(description),
    root = generateRootCode(description);
  expect(python).toContain("def model(x, b, m):");
  expect(python).toContain("value = b + m*x");
  expect(python).toContain("np.loadtxt");
  expect(python).toContain("absolute_sigma=True");
  expect(python).toContain("plt.show()");
  expect(python).not.toMatch(
    /import (json|csv|argparse)|fit_support|data_tool_fit/,
  );
  expect(python.split("\n").length).toBeLessThan(85);
  expect(root.split("\n").length).toBeLessThan(110);
  expect(root).toContain('data.Fit(&model, "SNQ")');
  expect(root).toContain('TGraphErrors data(filename, "%lg,%lg,%lg")');
  expect(root).toContain('data.DrawClone("AP")');
  expect(root).not.toMatch(/Fit::Fitter|std::ifstream|fit_support/);
  expect(python.indexOf("def model(")).toBeLessThan(
    python.indexOf("def load_data("),
  );
  expect(root.indexOf("double model_function(")).toBeLessThan(
    root.indexOf("TGraphErrors load_data("),
  );
  expect(python).toContain('if __name__ == "__main__":');
  for (const target of ["scipy", "root"] as const) {
    const bundle = generateCodeExportBundle(description, target);
    expect(Object.keys(bundle.files).sort()).toEqual([
      "README.md",
      "analysis.json",
      "data.csv",
      ...(target === "scipy" ? ["fit_scipy.py"] : ["fit_root.C"]),
      "observations.csv",
      ...(target === "scipy" ? ["requirements.txt"] : []),
    ]);
    expect(bundle.files["README.md"]).toContain("another-run.csv");
    expect(bundle.files["README.md"]).toContain("fullCodeExport.ts");
    const archive = unzipSync(encodeCodeExportBundle(bundle));
    expect(strFromU8(archive[`${bundle.directoryName}/data.csv`])).toBe(
      bundle.files["data.csv"],
    );
    expect(
      Object.keys(JSON.parse(bundle.files["analysis.json"]).programs),
    ).toEqual([target]);
  }
});

it("keeps unknown scatter distinct from supplied errors and withholds unsupported inference", () => {
  const request = syntheticRequest();
  request.uncertainty = {
    kind: "unknown-equal",
    errorStructure: "uncorrelated",
  };
  const description = describe(request);
  expect(generateCodeExportCsv(description)).toContain("# x,y\r\n");
  const python = generatePythonCode(description);
  expect(python).toContain("sigma=None, absolute_sigma=False");
  expect(python).toContain("df > 0 and residual @ residual > 0");
  const root = generateRootCode(description);
  expect(root).toContain('TGraphErrors data(filename, "%lg,%lg")');
  expect(root).toContain("df>0 && sum>0");
  description.inference = "descriptive";
  expect(generatePythonCode(description)).toContain("errors_available = False");
  expect(generateRootCode(description)).toContain("errors_available=false");
});

it("translates custom equations including fractional constants and constant predictions", () => {
  const request = syntheticRequest(),
    settings = initialSettings("custom");
  settings.custom = {
    expression: "b+(1/2)*a*x",
    variable: "x",
    names: ["b", "a"],
    units: ["m", "m/s"],
  };
  settings.parameters = [
    { value: 1, fixed: false },
    { value: 2, fixed: true },
  ];
  const description = describe(request, settings);
  expect(generateRootCode(description)).toContain("(1.0 / 2.0)");
  expect(generatePythonCode(description)).toContain(
    "np.broadcast_to(value, np.shape(x))",
  );
  settings.custom = {
    expression: "lambda+np*x",
    variable: "x",
    names: ["lambda", "np"],
    units: ["m", "m/s"],
  };
  const escaped = generatePythonCode(describe(request, settings));
  expect(escaped).toContain("def model(x, p_0, p_1):");
  expect(escaped).toContain("value = (p_0 + (p_1 * x))");
});

it("includes only necessary peak mathematics and preserves physical bounds", () => {
  for (const model of ["gaussian", "gaussian-shape"] as const) {
    const settings = initialSettings(model);
    settings.parameters = (
      model === "gaussian" ? [0, 1, 1, 0.5] : [0, 1, 1, 0.5, 0, 1]
    ).map((value) => ({ value, fixed: true }));
    const description = describe(syntheticRequest(), settings);
    description.settings.parameters[3].fixed = false;
    const root = generateRootCode(description),
      python = generatePythonCode(description);
    expect(root).toContain(
      "model.SetParLimits(3, std::nextafter(0.0, 1.0), std::numeric_limits<double>::infinity())",
    );
    expect(root).toContain("result->CovMatrixStatus()!=3");
    if (model === "gaussian-shape") {
      expect(python).toContain("def peak_mode(");
      expect(root).toContain("double peak_mode(");
      expect(root).not.toContain("peak_moments(");
      expect(python).not.toContain("peak_moments(");
    }
  }
});

it("preserves extreme observations and keeps labels out of executable syntax", () => {
  const description = describe();
  description.x[0] = 1e21;
  description.y[0] = 1e-21;
  description.xLabel = 'x"\\n\u2028';
  const csv = generateCodeExportCsv(description);
  expect(csv).toContain("1e+21,1e-21");
  expect(csv).not.toContain("e+21.0");
  expect(generateRootCode(description)).toContain('x\\"\\\\n\\u2028');
  expect(generatePythonCode(description)).toContain(
    JSON.stringify('x"\\n\u2028 [s]'),
  );
});

it("archives separate candidate directories without allowing traversal paths", () => {
  const bundle = {
    archiveName: "comparison.zip",
    directoryName: "comparison",
    files: {
      "candidate-1/data.csv": "# preserved notes\r\nx,y\r\n1,2\r\n",
      "candidate-2/data.csv": "x,y\r\n1,2\r\n",
    },
  };
  const archive = unzipSync(encodeCodeExportBundle(bundle));
  expect(strFromU8(archive["comparison/candidate-1/data.csv"])).toBe(
    bundle.files["candidate-1/data.csv"],
  );
  for (const path of [
    "../outside",
    "candidate-1/../../outside",
    "/absolute",
    "candidate-1//data.csv",
    "candidate-1/./data.csv",
  ]) {
    expect(() =>
      encodeCodeExportBundle({ ...bundle, files: { [path]: "test" } }),
    ).toThrow("invalid filename");
  }
});
