import { expect, it } from "vitest";
import {
  buildCodeExportDescription,
  generatePythonCode,
  generateRootCode,
} from "../../src/core/fit/codeExport";
import { initialSettings } from "../../src/core/fit/schema";
import { fit } from "../../src/core/fit/solve";
import { syntheticRequest } from "../support/synthetic";

it("generates standalone SciPy and ROOT programs with exact inputs and fit settings", () => {
  const request = syntheticRequest();
  const settings = initialSettings("quadratic");
  settings.parameters[0] = { value: 1.2345678901234567, fixed: true };
  settings.excludedIds = [request.dataset.rows[2].id];
  const result = fit(request, settings);
  const description = buildCodeExportDescription(request, settings, result, {
    mode: "log-x",
    xRange: [0.01, 2.1],
    yRange: [0.5, 8],
    showResiduals: true,
    showErrorBars: true,
    showGuides: false,
  });
  const python = generatePythonCode(description);
  expect(python).toContain("from scipy.optimize import curve_fit");
  expect(python).toContain("1.2345678901234567");
  expect(python).toContain("absolute_sigma=True");
  expect(python).toContain("free_index = np.array([1, 2]");
  expect(python).toContain("p0=np.clip(start[free_index]");
  expect(python).toContain('ax_data.set_xscale("log")');
  expect(python).toContain("ax_data.set_ylim(0.5, 8.0)");
  expect(python).toContain("fig.savefig");

  const root = generateRootCode(description);
  expect(root).toContain("#include <TFitResult.h>");
  expect(root).toContain('graph.Fit(&model, "SQREX0")');
  expect(root).toContain("fit_x_min = *fit_bounds.first");
  expect(root).toContain("model.SetRange(x_min, x_max)");
  expect(root).toContain('graph.Draw("AP")');
  expect(root).toContain("model.FixParameter(0, 1.2345678901234567)");
  expect(root).toContain("gPad->SetLogx()");
  expect(root).toContain("residuals.Write()");
  expect(root).toContain("fit_result->Write");
});

it("writes round-trippable scientific literals without invalid exponent suffixes", () => {
  const request = syntheticRequest();
  request.dataset.rows[0].x = 1e21;
  request.dataset.rows[0].y = 1e-21;
  const settings = initialSettings("line");
  settings.parameters = settings.parameters.map((parameter) => ({
    ...parameter,
    fixed: true,
  }));
  const result = fit(request, settings);
  const description = buildCodeExportDescription(request, settings, result, {
    mode: "linear",
    xRange: [0, 1e21],
    yRange: null,
    showResiduals: false,
    showErrorBars: false,
    showGuides: false,
  });
  for (const source of [
    generatePythonCode(description),
    generateRootCode(description),
  ]) {
    expect(source).toContain("1.0e+21");
    expect(source).toContain("1.0e-21");
    expect(source).not.toContain("e+21.0");
  }
});

it("emits damped guides and the two-pass unknown-scatter ROOT covariance", () => {
  const request = syntheticRequest();
  request.dataset.rows = request.dataset.rows.map((row) => ({
    ...row,
    y:
      1 +
      Math.exp(-row.x! / 3) *
        (2 * Math.sin((2 * Math.PI * row.x!) / 0.8) +
          Math.cos((2 * Math.PI * row.x!) / 0.8)),
  }));
  request.uncertainty = {
    kind: "unknown-equal",
    errorStructure: "uncorrelated",
  };
  const settings = initialSettings("damped-sine");
  settings.parameters = [1, 2, 1, 0.8, 3].map((value) => ({
    value,
    fixed: true,
  }));
  const result = fit(request, settings);
  const description = buildCodeExportDescription(request, settings, result, {
    mode: "linear",
    xRange: [0, 2],
    yRange: null,
    showResiduals: false,
    showErrorBars: false,
    showGuides: true,
  });
  const python = generatePythonCode(description);
  expect(python).toContain("envelope = amplitude*np.exp");
  expect(python).toContain("absolute_sigma=False");
  const root = generateRootCode(description);
  expect(root).toContain("preliminary_sse");
  expect(root).toContain("upper_envelope");
  expect(root).toContain('graph.Draw("APX")');
  expect(root).not.toContain("residuals.Write()");
});

it("translates custom equations from the validated AST for both targets", () => {
  const request = syntheticRequest();
  const settings = initialSettings("custom");
  settings.custom = {
    expression: "b+a*ln(x)+c^2",
    variable: "x",
    names: ["b", "a", "c"],
    units: ["m", "m", "m"],
  };
  settings.parameters = [1, 2, 0.5].map((value) => ({
    value,
    fixed: true,
  }));
  request.dataset.rows = request.dataset.rows.map((row) => ({
    ...row,
    x: row.x! + 1,
    y: 1 + 2 * Math.log(row.x! + 1) + 0.25,
  }));
  const result = fit(request, settings);
  const description = buildCodeExportDescription(request, settings, result, {
    mode: "linear",
    xRange: [1, 3],
    yRange: null,
    showResiduals: true,
    showErrorBars: true,
    showGuides: false,
  });
  expect(generatePythonCode(description)).toContain("np.log(x)");
  const root = generateRootCode(description);
  expect(root).toContain("std::log(x)");
  expect(root).toContain("std::pow(p[2], 2)");
});

it("keeps hostile labels inert and exported filenames bounded", () => {
  const request = syntheticRequest();
  request.dataset.label = `${"Very long title ".repeat(20)}\u2028print('not code')`;
  request.dataset.xColumn.label = 'x"\\n';
  const settings = initialSettings("line");
  const result = fit(request, settings);
  const description = buildCodeExportDescription(request, settings, result, {
    mode: "linear",
    xRange: [0, 2],
    yRange: null,
    showResiduals: false,
    showErrorBars: false,
    showGuides: false,
  });
  expect(description.fileStem.length).toBeLessThanOrEqual(80);
  const python = generatePythonCode(description);
  expect(python).toContain("\\u2028print('not code')");
  expect(python).not.toContain("\u2028");
  expect(generateRootCode(description)).toContain("\\u2028");
});
