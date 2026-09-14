import { renderEquation } from "./customEquation";
import { isNonlinearModel, nonlinearModels } from "./nonlinearModels";
import { parameterNames, type FitRequest, type FitSettings } from "./schema";
import type { FitResult } from "./solve";

export type ExportGraphMode = "linear" | "log-x" | "log-y" | "log-log";

export interface CodeExportView {
  mode: ExportGraphMode;
  xRange: readonly [number, number];
  yRange: readonly [number, number] | null;
  showResiduals: boolean;
  showErrorBars: boolean;
  showGuides: boolean;
}

export interface CodeExportDescription {
  title: string;
  xLabel: string;
  yLabel: string;
  xUnit: string | null;
  yUnit: string | null;
  rowIds: string[];
  x: (number | null)[];
  y: (number | null)[];
  included: boolean[];
  sigma: (number | null)[];
  knownSigma: boolean;
  settings: FitSettings;
  dataToolFit: number[];
  view: CodeExportView;
  fileStem: string;
  inference: FitResult["inference"];
}

export function codeExportFileName(
  description: CodeExportDescription,
  target: "python" | "root",
) {
  return target === "python"
    ? `${description.fileStem}-scipy.py`
    : `data_tool_${description.fileStem.replaceAll("-", "_")}_root.C`;
}

export function buildCodeExportDescription(
  request: FitRequest,
  settings: FitSettings,
  result: FitResult,
  view: CodeExportView,
): CodeExportDescription {
  const excluded = new Set(settings.excludedIds);
  const uncertainty = request.uncertainty;
  const stem = request.dataset.label
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80)
    .replace(/-$/g, "");
  return {
    title: request.dataset.label,
    xLabel: request.dataset.xColumn.label,
    yLabel: request.dataset.yColumn.label,
    xUnit: request.dataset.xColumn.unit,
    yUnit: request.dataset.yColumn.unit,
    rowIds: request.dataset.rows.map((row) => row.id),
    x: request.dataset.rows.map((row) => row.x),
    y: request.dataset.rows.map((row) => row.y),
    included: request.dataset.rows.map(
      (row) => row.included && !excluded.has(row.id),
    ),
    sigma: request.dataset.rows.map((row) =>
      uncertainty.kind === "supplied-common"
        ? uncertainty.sigmaY
        : uncertainty.kind === "supplied-per-row"
          ? (uncertainty.sigmaByRow[row.id] ?? null)
          : null,
    ),
    knownSigma: uncertainty.kind !== "unknown-equal",
    settings,
    dataToolFit: result.coefficients.slice(),
    view,
    fileStem: stem || "data-tool-fit",
    inference: result.inference,
  };
}

function number(value: number) {
  if (Object.is(value, -0)) return "-0.0";
  const text = String(value);
  const exponent = text.search(/e/i);
  if (exponent >= 0) {
    const mantissa = text.slice(0, exponent);
    return `${mantissa.includes(".") ? mantissa : `${mantissa}.0`}${text.slice(exponent)}`;
  }
  if (Number.isInteger(value)) return `${value}.0`;
  return text;
}

function pythonArray(values: readonly (number | null)[]) {
  return `[${values.map((value) => (value === null ? "np.nan" : number(value))).join(", ")}]`;
}

function pythonString(value: string) {
  return JSON.stringify(value)
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function pythonStrings(values: readonly string[]) {
  return `[${values.map(pythonString).join(", ")}]`;
}

function pythonExpression(settings: FitSettings) {
  if (settings.model === "custom")
    return renderEquation(settings.custom!, "python", (i) => `p[${i}]`);
  const suppliedPeriod = number(settings.sinePeriod ?? 2 * Math.PI);
  const shape = number(
    settings.shape ?? (settings.model === "exponential" ? -1 : 2),
  );
  const expressions: Record<Exclude<FitSettings["model"], "custom">, string> = {
    line: "p[0] + p[1]*x",
    quadratic: "p[0] + p[1]*x + p[2]*x**2",
    cubic: "p[0] + p[1]*x + p[2]*x**2 + p[3]*x**3",
    quartic: "p[0] + p[1]*x + p[2]*x**2 + p[3]*x**3 + p[4]*x**4",
    logarithmic: "p[0] + p[1]*np.log(x)",
    sine: `p[0] + p[1]*np.sin(2*np.pi*x/${suppliedPeriod}) + p[2]*np.cos(2*np.pi*x/${suppliedPeriod})`,
    "sine-free-period":
      "p[0] + p[1]*np.sin(2*np.pi*x/p[3]) + p[2]*np.cos(2*np.pi*x/p[3])",
    exponential: `p[0] + p[1]*np.exp(${shape}*x)`,
    "power-law": `p[0] + p[1]*x**${shape}`,
    reciprocal: "p[0] + p[1]/x",
    "constant-acceleration": "p[0] + p[1]*x + 0.5*p[2]*x**2",
    "exponential-decay": "p[0] + p[1]*np.exp(-x/p[2])",
    "power-law-free": "p[0] + p[1]*x**p[2]",
    gaussian: "p[0] + p[1]*np.exp(-0.5*((x-p[2])/p[3])**2)",
    "damped-sine":
      "p[0] + np.exp(-x/p[4])*(p[1]*np.sin(2*np.pi*x/p[3]) + p[2]*np.cos(2*np.pi*x/p[3]))",
    lorentzian: "p[0] + p[1]/(1 + ((x-p[2])/p[3])**2)",
  };
  return expressions[settings.model];
}

function parameterBounds(settings: FitSettings) {
  const lower = settings.parameters.map(() => "-np.inf");
  const upper = settings.parameters.map(() => "np.inf");
  if (isNonlinearModel(settings.model))
    for (const index of nonlinearModels[settings.model].positive)
      lower[index] = "np.finfo(float).tiny";
  if (settings.model === "sine-free-period") {
    lower[3] = number(settings.periodMin!);
    upper[3] = number(settings.periodMax!);
  }
  return { lower, upper };
}

function axisLabel(label: string, unit: string | null) {
  return unit ? `${label} [${unit}]` : label;
}

/** Standalone, readable SciPy demonstration generated from exact canonical inputs. */
export function generatePythonCode(description: CodeExportDescription) {
  const { settings, view } = description;
  const names = parameterNames(settings.model, settings.custom);
  const starts = settings.parameters.map((parameter) =>
    number(parameter.value),
  );
  const free = settings.parameters.flatMap((parameter, i) =>
    parameter.fixed ? [] : [i],
  );
  const bounds = parameterBounds(settings);
  const lower = free.map((i) => bounds.lower[i]);
  const upper = free.map((i) => bounds.upper[i]);
  const logX = view.mode === "log-x" || view.mode === "log-log";
  const logY = view.mode === "log-y" || view.mode === "log-log";
  const yRange = view.yRange
    ? `ax_data.set_ylim(${number(view.yRange[0])}, ${number(view.yRange[1])})`
    : "";
  const guideCode =
    view.showGuides && settings.model === "damped-sine"
      ? `
amplitude = np.hypot(fitted[1], fitted[2])
envelope = amplitude*np.exp(-curve_x/fitted[4])
ax_data.plot(curve_x, np.full_like(curve_x, fitted[0]), "--", color="0.45", linewidth=1.1, label="baseline")
ax_data.plot(curve_x, fitted[0] + envelope, "--", color="0.55", linewidth=1.0, label="envelope")
ax_data.plot(curve_x, fitted[0] - envelope, "--", color="0.55", linewidth=1.0)`
      : "";
  return `#!/usr/bin/env python3
"""Reproduce this Data Tool 2027 view with NumPy, SciPy, and Matplotlib.

Generated code starts from the saved starting values and refits the observations.
SciPy and Data Tool use different optimizers, so nonlinear local minima and small
roundoff differences can differ. Statistical output is conditional on the recorded
Gaussian/independence/model assumptions; Data Tool classified it as ${description.inference}.
"""
import numpy as np
import matplotlib.pyplot as plt
from scipy.optimize import curve_fit

title = ${pythonString(description.title)}
row_ids = ${pythonStrings(description.rowIds)}
x_all = np.array(${pythonArray(description.x)}, dtype=float)
y_all = np.array(${pythonArray(description.y)}, dtype=float)
included = np.array([${description.included.map((value) => (value ? "True" : "False")).join(", ")}], dtype=bool)
sigma_all = np.array(${pythonArray(description.sigma)}, dtype=float)
use = included & np.isfinite(x_all) & np.isfinite(y_all)
excluded = ~included & np.isfinite(x_all) & np.isfinite(y_all)

parameter_names = ${pythonStrings(names)}
start = np.array([${starts.join(", ")}], dtype=float)
free_index = np.array([${free.join(", ")}], dtype=int)
lower_bound = np.array([${lower.join(", ")}], dtype=float)
upper_bound = np.array([${upper.join(", ")}], dtype=float)
data_tool_fit = np.array([${description.dataToolFit.map(number).join(", ")}], dtype=float)

def model(x, *p):
    return ${pythonExpression(settings)}

def free_model(x, *free):
    p = start.copy()
    p[free_index] = free
    return model(x, *p)

x_fit = x_all[use]
y_fit = y_all[use]
sigma_fit = sigma_all[use] if ${description.knownSigma ? "True" : "False"} else None
fitted = start.copy()
covariance = np.zeros((len(start), len(start)), dtype=float)
if len(free_index):
    fitted_free, covariance_free = curve_fit(
        free_model,
        x_fit,
        y_fit,
        p0=np.clip(start[free_index], lower_bound, upper_bound),
        sigma=sigma_fit,
        absolute_sigma=${description.knownSigma ? "True" : "False"},
        bounds=(lower_bound, upper_bound),
        maxfev=200000,
    )
    fitted[free_index] = fitted_free
    covariance[np.ix_(free_index, free_index)] = covariance_free

residual = y_fit - model(x_fit, *fitted)
sse = float(residual @ residual)
df = len(x_fit) - len(free_index)
if ${description.knownSigma ? "True" : "False"}:
    chi2 = float(np.sum((residual/sigma_fit)**2))
    print(f"chi2 = {chi2:.12g}; chi2/df = {chi2/df:.12g}" if df > 0 else f"chi2 = {chi2:.12g}; df = 0")
else:
    scatter = np.sqrt(sse/df) if df > 0 else np.nan
    print(f"SSE = {sse:.12g}; residual scatter = {scatter:.12g}; df = {df}")
print("SciPy fit (standard error):")
for i, name in enumerate(parameter_names):
    suffix = "fixed" if i not in free_index else f"SE={np.sqrt(max(0.0, covariance[i, i])):.12g}"
    print(f"  {name} = {fitted[i]:.17g} ({suffix})")
print("Data Tool fit:", data_tool_fit)
print("maximum absolute coefficient difference:", np.max(np.abs(fitted - data_tool_fit)))

${view.showResiduals ? 'fig, (ax_data, ax_residual) = plt.subplots(2, 1, sharex=True, gridspec_kw={"height_ratios": [3, 1]}, figsize=(8, 6))' : "fig, ax_data = plt.subplots(figsize=(8, 5))"}
if ${view.showErrorBars && description.knownSigma ? "True" : "False"}:
    ax_data.errorbar(x_fit, y_fit, yerr=sigma_fit, fmt="o", label="included data", capsize=2)
else:
    ax_data.plot(x_fit, y_fit, "o", label="included data")
if np.any(excluded):
    ax_data.plot(x_all[excluded], y_all[excluded], "x", color="0.55", label="excluded data")
curve_x = ${logX ? `np.geomspace(${number(view.xRange[0])}, ${number(view.xRange[1])}, 800)` : `np.linspace(${number(view.xRange[0])}, ${number(view.xRange[1])}, 800)`}
ax_data.plot(curve_x, model(curve_x, *fitted), color="#cc9550", linewidth=2, label="SciPy fit")${guideCode}
ax_data.set_title(title)
ax_data.set_ylabel(${pythonString(axisLabel(description.yLabel, description.yUnit))})
ax_data.set_xscale(${pythonString(logX ? "log" : "linear")})
ax_data.set_yscale(${pythonString(logY ? "log" : "linear")})
ax_data.set_xlim(${number(view.xRange[0])}, ${number(view.xRange[1])})
${yRange}
ax_data.grid(alpha=0.25)
ax_data.legend()
${
  view.showResiduals
    ? `ax_residual.axhline(0, color="0.5", linestyle="--", linewidth=1)
ax_residual.plot(x_fit, residual, "o")
ax_residual.set_ylabel("Residual")
ax_residual.set_xlabel(${pythonString(axisLabel(description.xLabel, description.xUnit))})
ax_residual.set_xscale(${pythonString(logX ? "log" : "linear")})
ax_residual.grid(alpha=0.25)`
    : `ax_data.set_xlabel(${pythonString(axisLabel(description.xLabel, description.xUnit))})`
}
fig.tight_layout()
fig.savefig(${pythonString(`${description.fileStem}-scipy.png`)}, dpi=160)
plt.show()
`;
}

function cppString(value: string) {
  let literal = '"';
  for (const character of value) {
    const point = character.codePointAt(0)!;
    if (character === '"') literal += '\\"';
    else if (character === "\\") literal += "\\\\";
    else if (character === "\n") literal += "\\n";
    else if (character === "\r") literal += "\\r";
    else if (character === "\t") literal += "\\t";
    else if (point < 32 || point === 127)
      literal += `\\x${point.toString(16).padStart(2, "0")}""`;
    else if (point > 0xffff)
      literal += `\\U${point.toString(16).padStart(8, "0")}`;
    else if (point > 126)
      literal += `\\u${point.toString(16).padStart(4, "0")}`;
    else literal += character;
  }
  return literal + '"';
}

function cppArray(values: readonly (number | null)[]) {
  return `{${values.map((value) => (value === null ? "NAN" : number(value))).join(", ")}}`;
}

function rootExpression(settings: FitSettings) {
  if (settings.model === "custom")
    return renderEquation(settings.custom!, "root", (i) => `p[${i}]`);
  const suppliedPeriod = number(settings.sinePeriod ?? 2 * Math.PI);
  const shape = number(
    settings.shape ?? (settings.model === "exponential" ? -1 : 2),
  );
  const expressions: Record<Exclude<FitSettings["model"], "custom">, string> = {
    line: "p[0] + p[1]*x",
    quadratic: "p[0] + p[1]*x + p[2]*x*x",
    cubic: "p[0] + p[1]*x + p[2]*x*x + p[3]*x*x*x",
    quartic: "p[0] + p[1]*x + p[2]*x*x + p[3]*x*x*x + p[4]*x*x*x*x",
    logarithmic: "p[0] + p[1]*std::log(x)",
    sine: `p[0] + p[1]*std::sin(2*TMath::Pi()*x/${suppliedPeriod}) + p[2]*std::cos(2*TMath::Pi()*x/${suppliedPeriod})`,
    "sine-free-period":
      "p[0] + p[1]*std::sin(2*TMath::Pi()*x/p[3]) + p[2]*std::cos(2*TMath::Pi()*x/p[3])",
    exponential: `p[0] + p[1]*std::exp(${shape}*x)`,
    "power-law": `p[0] + p[1]*std::pow(x, ${shape})`,
    reciprocal: "p[0] + p[1]/x",
    "constant-acceleration": "p[0] + p[1]*x + 0.5*p[2]*x*x",
    "exponential-decay": "p[0] + p[1]*std::exp(-x/p[2])",
    "power-law-free": "p[0] + p[1]*std::pow(x, p[2])",
    gaussian: "p[0] + p[1]*std::exp(-0.5*std::pow((x-p[2])/p[3], 2))",
    "damped-sine":
      "p[0] + std::exp(-x/p[4])*(p[1]*std::sin(2*TMath::Pi()*x/p[3]) + p[2]*std::cos(2*TMath::Pi()*x/p[3]))",
    lorentzian: "p[0] + p[1]/(1 + std::pow((x-p[2])/p[3], 2))",
  };
  return expressions[settings.model];
}

/** Self-contained ROOT macro; run with: root -l -q file.C */
export function generateRootCode(description: CodeExportDescription) {
  const { settings, view } = description;
  const names = parameterNames(settings.model, settings.custom);
  const logX = view.mode === "log-x" || view.mode === "log-log";
  const logY = view.mode === "log-y" || view.mode === "log-log";
  const free = settings.parameters.filter(
    (parameter) => !parameter.fixed,
  ).length;
  const graphDrawOption =
    view.showErrorBars && description.knownSigma ? "AP" : "APX";
  const parameterSetup = settings.parameters
    .map((parameter, i) => {
      const lines = [
        `  model.SetParameter(${i}, ${number(parameter.value)});`,
        `  model.SetParName(${i}, ${cppString(names[i])});`,
      ];
      if (parameter.fixed)
        lines.push(`  model.FixParameter(${i}, ${number(parameter.value)});`);
      else if (settings.model === "sine-free-period" && i === 3)
        lines.push(
          `  model.SetParLimits(3, ${number(settings.periodMin!)}, ${number(settings.periodMax!)});`,
        );
      else if (
        isNonlinearModel(settings.model) &&
        (
          nonlinearModels[settings.model].positive as readonly number[]
        ).includes(i)
      )
        lines.push(`  model.SetParLimits(${i}, 1e-300, 1e300);`);
      return lines.join("\n");
    })
    .join("\n");
  const guideCode =
    view.showGuides && settings.model === "damped-sine"
      ? `
  TF1 baseline("fitted_baseline", "[0]", x_min, x_max);
  baseline.SetParameter(0, model.GetParameter(0));
  baseline.SetLineColor(kGray+2); baseline.SetLineStyle(2); baseline.Draw("same");
  TF1 upper("upper_envelope", "[0]+sqrt([1]*[1]+[2]*[2])*exp(-x/[3])", x_min, x_max);
  TF1 lower("lower_envelope", "[0]-sqrt([1]*[1]+[2]*[2])*exp(-x/[3])", x_min, x_max);
  for (TF1 *guide : {&upper, &lower}) {
    guide->SetParameters(model.GetParameter(0), model.GetParameter(1), model.GetParameter(2), model.GetParameter(4));
    guide->SetLineColor(kGray+1); guide->SetLineStyle(2); guide->Draw("same");
  }`
      : "";
  const yLimits = view.yRange
    ? `\n  graph.SetMinimum(${number(view.yRange[0])}); graph.SetMaximum(${number(view.yRange[1])});`
    : "";
  const residualPanel = view.showResiduals
    ? `
  canvas.cd(2); gPad->SetGrid();${logX ? " gPad->SetLogx();" : ""}
  std::vector<double> residual(data_x.size()), residual_error(data_x.size());
  for (size_t i=0; i<data_x.size(); ++i) {
    residual[i] = data_y[i] - model.Eval(data_x[i]);
    residual_error[i] = data_ey[i];
  }
  TGraphErrors residuals(data_x.size(), data_x.data(), residual.data(), data_ex.data(), residual_error.data());
  residuals.SetName("residuals"); residuals.SetTitle(";${axisLabel(description.xLabel, description.xUnit)};Residual");
  residuals.SetMarkerStyle(20); residuals.Draw("${graphDrawOption}");
  residuals.GetXaxis()->SetLimits(x_min, x_max);
  TLine zero(x_min, 0, x_max, 0); zero.SetLineStyle(2); zero.SetLineColor(kGray+2); zero.Draw();`
    : "";
  return `// Data Tool 2027 ROOT demonstration.
// Run: root -l -q '${codeExportFileName(description, "root")}'
// The macro refits exact canonical inputs from the original starting values.
// ROOT and Data Tool use different nonlinear optimizers; local minima and roundoff can differ.
#include <TF1.h>
#include <TFile.h>
#include <TFitResult.h>
#include <TGraph.h>
#include <TGraphErrors.h>
#include <TLegend.h>
#include <TLine.h>
#include <TMath.h>
#include <TCanvas.h>
#include <TPad.h>
#include <algorithm>
#include <cmath>
#include <iostream>
#include <string>
#include <vector>

void data_tool_${description.fileStem.replaceAll("-", "_")}_root() {
  const std::vector<std::string> row_ids = {${description.rowIds.map(cppString).join(", ")}};
  const std::vector<double> x_all = ${cppArray(description.x)};
  const std::vector<double> y_all = ${cppArray(description.y)};
  const std::vector<double> sigma_all = ${cppArray(description.sigma)};
  const std::vector<int> included = {${description.included.map(Number).join(", ")}};
  std::vector<double> data_x, data_y, data_ex, data_ey, excluded_x, excluded_y;
  for (size_t i=0; i<x_all.size(); ++i) {
    if (!std::isfinite(x_all[i]) || !std::isfinite(y_all[i])) continue;
    if (included[i]) {
      data_x.push_back(x_all[i]); data_y.push_back(y_all[i]); data_ex.push_back(0.0);
      data_ey.push_back(${description.knownSigma ? "sigma_all[i]" : "1.0"});
    } else { excluded_x.push_back(x_all[i]); excluded_y.push_back(y_all[i]); }
  }
  const double x_min = ${number(view.xRange[0])}, x_max = ${number(view.xRange[1])};
  const auto fit_bounds = std::minmax_element(data_x.begin(), data_x.end());
  const double fit_x_min = *fit_bounds.first, fit_x_max = *fit_bounds.second;
  TGraphErrors graph(data_x.size(), data_x.data(), data_y.data(), data_ex.data(), data_ey.data());
  graph.SetName("included_data");
  graph.SetTitle(${cppString(`${description.title};${axisLabel(description.xLabel, description.xUnit)};${axisLabel(description.yLabel, description.yUnit)}`)});
  graph.SetMarkerStyle(20);
  TF1 model("fit_model", [](double *xx, double *p) {
    const double x = xx[0];
    return ${rootExpression(settings)};
  }, fit_x_min, fit_x_max, ${settings.parameters.length});
${parameterSetup}
  TFitResultPtr fit_result = graph.Fit(&model, "SQREX0");
${
  description.knownSigma
    ? ""
    : `  // Data Tool estimates one common scatter parameter with s=sqrt(SSE/df).
  // Refit with that uniform error so ROOT's covariance uses the same scale.
  double preliminary_sse = 0.0;
  for (size_t i=0; i<data_x.size(); ++i) preliminary_sse += std::pow(data_y[i]-model.Eval(data_x[i]), 2);
  const int df = static_cast<int>(data_x.size()) - ${free};
  if (df > 0 && preliminary_sse > 0) {
    const double scatter = std::sqrt(preliminary_sse/df);
    for (size_t i=0; i<data_ey.size(); ++i) { data_ey[i]=scatter; graph.SetPointError(i, 0.0, scatter); }
    fit_result = graph.Fit(&model, "SQREX0");
  }`
}
  model.SetRange(x_min, x_max); // Display zoom never changes the fitted sample.
  std::cout << "ROOT fit (standard error):\\n";
  const double data_tool_fit[] = {${description.dataToolFit.map(number).join(", ")}};
  double max_difference = 0.0;
  for (int i=0; i<${settings.parameters.length}; ++i) {
    std::cout << "  " << model.GetParName(i) << " = " << model.GetParameter(i)
              << " (SE=" << model.GetParError(i) << ")\\n";
    max_difference = std::max(max_difference, std::abs(model.GetParameter(i)-data_tool_fit[i]));
  }
  std::cout << "chi2 = " << model.GetChisquare() << "; ndf = " << model.GetNDF()
            << "; max coefficient difference from Data Tool = " << max_difference << "\\n";

  TCanvas canvas("data_tool_canvas", ${cppString(description.title)}, 900, ${view.showResiduals ? 700 : 520});
  ${view.showResiduals ? "canvas.Divide(1, 2); canvas.cd(1);" : "canvas.cd();"}
  gPad->SetGrid();${logX ? " gPad->SetLogx();" : ""}${logY ? " gPad->SetLogy();" : ""}
  graph.Draw("${graphDrawOption}"); graph.GetXaxis()->SetLimits(x_min, x_max);${yLimits}
  model.SetLineColor(kOrange+7); model.SetLineWidth(3); model.Draw("same");${guideCode}
  TGraph excluded_graph(excluded_x.size(), excluded_x.data(), excluded_y.data());
  excluded_graph.SetName("excluded_data"); excluded_graph.SetMarkerStyle(5); excluded_graph.SetMarkerColor(kGray+1); excluded_graph.Draw("P SAME");
${residualPanel}
  canvas.SaveAs(${cppString(`${description.fileStem}-root.pdf`)});
  TFile output(${cppString(`${description.fileStem}-root.root`)}, "RECREATE");
  graph.Write(); excluded_graph.Write(); model.Write();${view.showResiduals ? " residuals.Write();" : ""} canvas.Write(); fit_result->Write("fit_result");
  output.Close();
}
`;
}
