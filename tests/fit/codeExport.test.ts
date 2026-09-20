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
import {
  generatePythonCode as generateReferencePythonCode,
  generateRootCode as generateReferenceRootCode,
} from "../../scripts/reference/fullCodeExport";
import { parseDelimited } from "../../src/core/fit/dataInput";
import { encodeCodeExportBundle } from "../../src/fit/codeExportArchive";
import { initialSettings, settingsSchema } from "../../src/core/fit/schema";
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
  request.dataset.rows[0].label = 'Trial "A"';
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
  expect(records[1][1]).toBe('Trial "A"');
  expect(records[0]).toEqual([
    "row_id",
    "row_label",
    "x",
    "y",
    "sigma",
    "included",
    "missing_reason",
  ]);
  expect(records[1][5]).toBe("false");
  expect(records[3][5]).toBe("false");
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
  settings.custom = {
    expression: "b+sin(2*pi*(x%2)/2)",
    variable: "x",
    names: ["b"],
    units: ["m"],
  };
  settings.parameters = [{ value: 1, fixed: false }];
  const periodic = describe(request, settings);
  expect(generatePythonCode(periodic)).toContain("np.fmod(x, 2)");
  expect(generateRootCode(periodic)).toContain("std::fmod(x, 2.0)");
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

it("exports basis-aware polynomial and fixed-period Fourier evaluators", () => {
  const request = syntheticRequest();
  const cases = [
    settingsSchema.parse({
      ...initialSettings("cubic"),
      polynomialBasis: { kind: "taylor", center: -1.25 },
    }),
    settingsSchema.parse({
      ...initialSettings("quartic"),
      polynomialBasis: {
        kind: "chebyshev",
        center: -0.75,
        scale: 2.5,
      },
    }),
    settingsSchema.parse({
      ...initialSettings("fourier"),
      fourier: { harmonics: 2, period: 3.75, origin: -0.5 },
      parameters: Array.from({ length: 5 }, () => ({
        value: 0,
        fixed: false,
      })),
    }),
  ];
  for (const settings of cases) {
    const description = describe(request, settings);
    const python = generatePythonCode(description);
    const root = generateRootCode(description);
    expect(python).toContain("def model_jacobian(x):");
    expect(python).toContain("jac=lambda x, *p: model_jacobian(x)");
    expect(python).not.toContain("x--");
    expect(root).not.toContain("x--");
    const metadata = JSON.parse(generateCodeExportMetadata(description));
    expect(metadata.fit.options).toMatchObject(
      settings.model === "fourier"
        ? { fourier: settings.fourier }
        : { polynomialBasis: settings.polynomialBasis },
    );
  }
  const chebyshev = generateRootCode(describe(request, cases[1]));
  expect(chebyshev).toContain("double chebyshev_series(");
  expect(chebyshev).toContain("const double next=2*z*t1-t0");
  expect(chebyshev).toContain("std::isfinite(difference)");
  const taylorDescription = describe(request, cases[0]);
  const taylorPython = generatePythonCode(taylorDescription);
  const taylorRoot = generateRootCode(taylorDescription);
  expect(taylorPython).toContain("np.polynomial.polynomial.polyval");
  expect(taylorPython).toContain(
    "columns.append((columns[-1]/order)*centered)",
  );
  expect(taylorRoot).toContain("double taylor_series(");
  expect(taylorRoot).not.toContain("std::pow((x-");
  const chebyshevPython = generatePythonCode(describe(request, cases[1]));
  expect(chebyshevPython).toContain("def polynomial_coordinate(x):");
  expect(chebyshevPython).toContain("x/2.5 - (-0.75)/2.5");
  const fourier = generateCodeExportMetadata(describe(request, cases[2]));
  expect(fourier).toContain('"name": "s2"');
  expect(fourier).toContain('"name": "c2"');

  const fourierDescription = describe(request, cases[2]);
  const quickPython = generatePythonCode(fourierDescription);
  const quickRoot = generateRootCode(fourierDescription);
  expect(quickPython).toContain("cycles = np.fmod(x, 3.75)/3.75");
  expect(quickPython).toContain("cycles - np.rint(cycles)");
  expect(quickPython).toContain("np.sin(1*fourier_phase(x))");
  expect(quickRoot).toContain("cycles=std::fmod(x, 3.75)/3.75");
  expect(quickRoot).toContain("cycles-=std::nearbyint(cycles)");
  expect(quickRoot).toContain("std::sin(1*fourier_phase(x))");
  expect(quickPython).toContain(
    "effective_cycles = (x.max() - x.min()) * 2 / 3.75",
  );
  expect(quickPython).toContain(
    "curve_count = max(160, int(np.ceil(effective_cycles * 40)) + 1)",
  );
  expect(quickPython).toContain(
    'raise ValueError("Refusing to plot more than 800 effective Fourier cycles")',
  );
  expect(quickRoot).toContain(
    "effective_cycles=(model.GetXmax()-model.GetXmin())*2/3.75",
  );
  expect(quickRoot).toContain(
    "curve_points=static_cast<int>(std::ceil(effective_cycles*40))+1",
  );
  expect(quickRoot).toContain("model.SetNpx(curve_points)");

  fourierDescription.view = {
    ...fourierDescription.view,
    mode: "log-x",
    xRange: [0.1, 100],
  };
  const referencePython = generateReferencePythonCode(fourierDescription);
  const referenceRoot = generateReferenceRootCode(fourierDescription);
  expect(referencePython).toContain("cycles = np.fmod(x, 3.75)/3.75");
  expect(referencePython).toContain("np.cos(2*fourier_phase(x))");
  expect(referenceRoot).toContain("cycles=std::fmod(x, 3.75)/3.75");
  expect(referenceRoot).toContain("std::cos(2*fourier_phase(x))");
  expect(referencePython).toContain(
    "effective_cycles = (x_max - x_min) * 2 / 3.75",
  );
  expect(referencePython).toContain(
    "display_x = np.geomspace(x_min, x_max, 160)",
  );
  expect(referencePython).toContain(
    "curve_x = np.unique(np.concatenate((phase_x, display_x)))",
  );
  expect(referenceRoot).toContain("effective_cycles=(x_max-x_min)*2/3.75");
  expect(referenceRoot).toContain(
    "curve_x.push_back(std::exp(log_x_min+(log_x_max-log_x_min)*i/159.0))",
  );
  expect(referenceRoot).toContain('fitted_curve.Draw("L SAME")');

  const referencePower = generateReferencePythonCode(
    describe(request, initialSettings("quadratic")),
  );
  expect(referencePower).toContain(
    '\\"options\\":{\\"polynomialBasis\\":null}',
  );
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
