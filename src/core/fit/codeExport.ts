import { polynomialDegree, polynomialExpressions } from "./polynomialModels";
import { renderEquation } from "./customEquation";
import { isNonlinearModel, nonlinearModels } from "./nonlinearModels";
import {
  pythonPeakShapeHelpers,
  rootPeakShapeHelpers,
} from "./gaussianShapeCodeExport";
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
  requestId: string;
  snapshotId: string;
  source: FitRequest["source"];
  datasetId: string;
  title: string;
  xLabel: string;
  yLabel: string;
  xUnit: string | null;
  yUnit: string | null;
  assumptions: FitRequest["dataset"]["assumptions"];
  uncertainty: FitRequest["uncertainty"];
  rowIds: string[];
  x: (number | null)[];
  y: (number | null)[];
  included: boolean[];
  sigma: (number | null)[];
  missingReasons: FitRequest["dataset"]["rows"][number]["missingReason"][];
  knownSigma: boolean;
  settings: FitSettings;
  dataToolFit: number[];
  view: CodeExportView;
  fileStem: string;
  inference: FitResult["inference"];
}

export type CodeExportTarget = "scipy" | "root" | "both";

export interface CodeExportBundle {
  archiveName: string;
  directoryName: string;
  files: Record<string, string>;
}

export function codeExportBundleFileName(
  description: CodeExportDescription,
  target: CodeExportTarget = "both",
) {
  return `${description.fileStem}${target === "both" ? "" : `-${target}`}-analysis-bundle.zip`;
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
    requestId: request.requestId,
    snapshotId: request.snapshotId,
    source: request.source,
    datasetId: request.dataset.id,
    title: request.dataset.label,
    xLabel: request.dataset.xColumn.label,
    yLabel: request.dataset.yColumn.label,
    xUnit: request.dataset.xColumn.unit,
    yUnit: request.dataset.yColumn.unit,
    assumptions: request.dataset.assumptions,
    uncertainty: request.uncertainty,
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
    missingReasons: request.dataset.rows.map((row) => row.missingReason),
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

function csvField(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Stable, language-neutral inputs for both generated programs. */
export function generateCodeExportCsv(description: CodeExportDescription) {
  const rows = description.rowIds.map((rowId, index) =>
    [
      rowId,
      description.x[index] === null ? "" : String(description.x[index]),
      description.y[index] === null ? "" : String(description.y[index]),
      description.sigma[index] === null ? "" : String(description.sigma[index]),
      description.included[index] ? "true" : "false",
      description.missingReasons[index] ?? "",
    ]
      .map(csvField)
      .join(","),
  );
  const comments =
    description.source.context
      ?.split(/\r\n|\r|\n/)
      .map((line) => `# ${line}`) ?? [];
  return (
    [...comments, "row_id,x,y,sigma,included,missing_reason", ...rows].join(
      "\r\n",
    ) + "\r\n"
  );
}

function pythonExpression(settings: FitSettings) {
  if (settings.model === "custom")
    return renderEquation(settings.custom!, "python", (i) => `p[${i}]`);
  const suppliedPeriod = number(settings.sinePeriod ?? 2 * Math.PI);
  const shape = number(
    settings.shape ?? (settings.model === "exponential" ? -1 : 2),
  );
  const expressions: Record<Exclude<FitSettings["model"], "custom">, string> = {
    ...polynomialExpressions((i) => (i === 0 ? "p[0]" : `p[${i}]*x**${i}`)),
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
    "exponential-growth": "p[0] + p[1]*np.exp(x/p[2])",
    sigmoid: "p[0] + p[1]*np.exp(-np.logaddexp(0.0, -(x-p[2])/p[3]))",
    "power-law-free": "p[0] + p[1]*x**p[2]",
    gaussian: "p[0] + p[1]*np.exp(-0.5*((x-p[2])/p[3])**2)",
    "gaussian-shape": "gaussian_peak(x, p)",
    "damped-sine":
      "p[0] + np.exp(-x/p[4])*(p[1]*np.sin(2*np.pi*x/p[3]) + p[2]*np.cos(2*np.pi*x/p[3]))",
    lorentzian: "p[0] + p[1]/(1 + ((x-p[2])/p[3])**2)",
  };
  return expressions[settings.model];
}

function parameterBounds(settings: FitSettings) {
  const bounds = settings.parameters.map(() => ({
    lower: null as number | null,
    upper: null as number | null,
    lowerExclusive: false,
  }));
  if (isNonlinearModel(settings.model)) {
    for (const index of nonlinearModels[settings.model].positive) {
      bounds[index].lower = 0;
      bounds[index].lowerExclusive = true;
    }
  }
  if (settings.model === "sine-free-period") {
    bounds[3] = {
      lower: settings.periodMin!,
      upper: settings.periodMax!,
      lowerExclusive: false,
    };
  }
  return bounds;
}

function axisLabel(label: string, unit: string | null) {
  return unit ? `${label} [${unit}]` : label;
}

/** These fields determine the executable expression, rather than editable starts/view. */
function executableIdentity(settings: FitSettings) {
  return {
    model: settings.model,
    parameterNames: parameterNames(settings.model, settings.custom),
    customEquation: settings.custom
      ? {
          expression: settings.custom.expression,
          variable: settings.custom.variable,
          names: settings.custom.names,
        }
      : null,
    options:
      settings.model === "sine"
        ? { sinePeriod: settings.sinePeriod }
        : ["exponential", "power-law"].includes(settings.model)
          ? { shape: settings.shape }
          : {},
  };
}

export function generateCodeExportMetadata(
  description: CodeExportDescription,
  target: CodeExportTarget = "both",
) {
  const names = parameterNames(
    description.settings.model,
    description.settings.custom,
  );
  const bounds = parameterBounds(description.settings);
  const {
    model: _model,
    parameters: _parameters,
    custom: _customEquation,
    excludedIds: _excludedIds,
    retainedPerRowUncertainty: _retainedPerRowUncertainty,
    ...fitOptions
  } = description.settings;
  const uncertainty =
    description.uncertainty.kind === "unknown-equal"
      ? {
          kind: description.uncertainty.kind,
          errorStructure: description.uncertainty.errorStructure,
        }
      : {
          kind: description.uncertainty.kind,
          errorStructure: description.uncertainty.errorStructure,
          provenance: description.uncertainty.provenance,
          values: "data.csv:sigma",
        };
  return `${JSON.stringify(
    {
      format: "data-tool-analysis-bundle",
      version: 1,
      generator: "Data Tool 2027",
      request: {
        requestId: description.requestId,
        snapshotId: description.snapshotId,
        source: description.source,
      },
      dataset: {
        id: description.datasetId,
        title: description.title,
        x: { label: description.xLabel, unit: description.xUnit },
        y: { label: description.yLabel, unit: description.yUnit },
        assumptions: description.assumptions,
        rowCount: description.rowIds.length,
        dataFile: "data.csv",
        columns: ["row_id", "x", "y", "sigma", "included", "missing_reason"],
      },
      uncertainty,
      fit: {
        model: description.settings.model,
        customEquation: description.settings.custom ?? null,
        options: fitOptions,
        inference: description.inference,
        parameters: description.settings.parameters.map((parameter, index) => ({
          name: names[index],
          start: parameter.value,
          fixed: parameter.fixed,
          lowerBound: bounds[index].lower,
          upperBound: bounds[index].upper,
          lowerExclusive: bounds[index].lowerExclusive,
          dataToolValue: description.dataToolFit[index],
        })),
      },
      view: description.view,
      programs: {
        ...(target !== "root" ? { scipy: "fit_scipy.py" } : {}),
        ...(target !== "scipy" ? { root: "fit_root.C" } : {}),
      },
      outputs: {
        ...(target !== "root"
          ? { scipyFigure: `${description.fileStem}-scipy.png` }
          : {}),
        ...(target !== "scipy"
          ? {
              rootFigure: `${description.fileStem}-root.pdf`,
              rootObjects: `${description.fileStem}-root.root`,
            }
          : {}),
      },
    },
    null,
    2,
  )}\n`;
}

/** Readable SciPy program for the bundle's external CSV and JSON inputs. */
export function generatePythonCode(description: CodeExportDescription) {
  const polynomialJac =
    description.settings.model === "gaussian-shape"
      ? '            jac="3-point", # Central differences include the mode recentering.\n'
      : polynomialDegree(description.settings.model) === undefined
        ? ""
        : "            # Analytic polynomial derivatives; update these if editing model().\n            jac=lambda x, *free: np.column_stack([x**i for i in free_index]),\n";
  const meanGuide = `
if view["showGuides"]:
    ax_data.axhline(fitted[0], linestyle="--", color="0.45", linewidth=1.1, label="mean position b")`;
  const centerGuide = `
if view["showGuides"] and curve_x[0] <= fitted[2] <= curve_x[-1]:
    ax_data.axvline(fitted[2], linestyle="--", color="0.45", linewidth=1.1, label="center")`;
  const otherGuides: Partial<Record<FitSettings["model"], string>> = {
    sine: meanGuide,
    "sine-free-period": meanGuide,
    gaussian: centerGuide,
    "gaussian-shape": centerGuide,
    lorentzian: centerGuide,
    sigmoid:
      centerGuide +
      `
if view["showGuides"]:
    ax_data.axhline(fitted[0], linestyle="--", color="0.45", linewidth=1.1, label="asymptote b")
    ax_data.axhline(fitted[0]+fitted[1], linestyle="--", color="0.55", linewidth=1.1, label="asymptote b+A")`,
  };
  const guideCode =
    description.settings.model === "damped-sine"
      ? `
if view["showGuides"]:
    amplitude = np.hypot(fitted[1], fitted[2])
    envelope = amplitude*np.exp(-curve_x/fitted[4])
    ax_data.plot(curve_x, np.full_like(curve_x, fitted[0]), "--", color="0.45", linewidth=1.1, label="baseline")
    ax_data.plot(curve_x, fitted[0] + envelope, "--", color="0.55", linewidth=1.0, label="envelope")
    ax_data.plot(curve_x, fitted[0] - envelope, "--", color="0.55", linewidth=1.0)`
      : (otherGuides[description.settings.model] ?? "");
  return `#!/usr/bin/env python3
"""Refit a Data Tool 2027 CSV with NumPy, SciPy, and Matplotlib.

Measurements are inputs in data.csv, not literals in this source file. The
default analysis.json records the model setup and the original Data Tool result.
Pass --data to apply the same generated fit program to another compatible CSV.
SciPy and Data Tool use different optimizers, so nonlinear local minima and small
roundoff differences can differ.
"""
import argparse
import csv
import json
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import matplotlib.pyplot as plt
from scipy.optimize import curve_fit

BUNDLE_DIR = Path(__file__).resolve().parent
DEFAULT_DATA = BUNDLE_DIR / "data.csv"
DEFAULT_ANALYSIS = BUNDLE_DIR / "analysis.json"

# The fitted function: edit the equation here when adapting this program.
def model(x, *p):
    value = ${pythonExpression(description.settings)}
    # Constant custom equations are scalars; callers need one prediction per X.
    return np.broadcast_to(np.asarray(value, dtype=float), np.shape(x))
${description.settings.model === "gaussian-shape" ? pythonPeakShapeHelpers : ""}

def fit_data(data, analysis):
    fit_metadata = analysis["fit"]
    row_ids, x_all, y_all, sigma_all, included = data
    use = included & np.isfinite(x_all) & np.isfinite(y_all)
    excluded = ~included & np.isfinite(x_all) & np.isfinite(y_all)
    if not np.any(use):
        raise ValueError(f"CSV: no finite included observations")

    parameter_metadata = fit_metadata["parameters"]
    parameter_names = [parameter["name"] for parameter in parameter_metadata]
    start = np.asarray([parameter["start"] for parameter in parameter_metadata], dtype=float)
    if not np.all(np.isfinite(start)) or any(type(parameter["fixed"]) is not bool for parameter in parameter_metadata):
        raise ValueError(f"Model metadata: starts must be finite and fixed flags must be boolean")
    free_index = np.asarray(
        [index for index, parameter in enumerate(parameter_metadata) if not parameter["fixed"]],
        dtype=int,
    )

    def lower_bound(parameter):
        lower = parameter["lowerBound"]
        if lower is None:
            return -np.inf
        if parameter.get("lowerExclusive") and float(lower) == 0:
            return np.nextafter(0.0, 1.0)
        return float(lower)

    lower = np.asarray([lower_bound(parameter_metadata[index]) for index in free_index], dtype=float)
    upper = np.asarray([
        np.inf if parameter_metadata[index]["upperBound"] is None else float(parameter_metadata[index]["upperBound"])
        for index in free_index
    ], dtype=float)
    if np.any(np.isnan(lower)) or np.any(np.isnan(upper)) or np.any(lower >= upper):
        raise ValueError(f"Model metadata: invalid parameter bounds")
    data_tool_fit = np.asarray([parameter["dataToolValue"] for parameter in parameter_metadata], dtype=float)
    known_sigma = analysis["uncertainty"]["kind"] != "unknown-equal"

    def free_model(x, *free):
        p = start.copy()
        p[free_index] = free
        return model(x, *p)

    x_fit = x_all[use]
    y_fit = y_all[use]
    sigma_fit = sigma_all[use] if known_sigma else None
    if known_sigma and not np.all(np.isfinite(sigma_fit) & (sigma_fit > 0)):
        raise ValueError(f"CSV: every included row needs a positive finite sigma")

    fitted = start.copy()
    covariance = np.zeros((len(start), len(start)), dtype=float)
    if len(free_index):
        fitted_free, covariance_free = curve_fit(
            free_model,
            x_fit,
            y_fit,
            p0=np.clip(start[free_index], lower, upper),
            sigma=sigma_fit,
            absolute_sigma=known_sigma,
${polynomialJac}            bounds=(lower, upper),
            maxfev=200000,
        )
        fitted[free_index] = fitted_free
        covariance[np.ix_(free_index, free_index)] = covariance_free

    residual = y_fit - model(x_fit, *fitted)
    if not np.all(np.isfinite(fitted)) or not np.all(np.isfinite(residual)):
        raise ValueError("Fit did not produce finite coefficients and predictions")
    sse = float(residual @ residual)
    if not np.isfinite(sse):
        raise ValueError("Residual sum of squares overflowed")
    df = len(x_fit) - len(free_index)
    uncertainty_reason = None
    if not known_sigma and (df <= 0 or sse == 0):
        uncertainty_reason = "residual scatter cannot be estimated (zero SSE or nonpositive degrees of freedom)"
    elif fit_metadata["inference"] == "descriptive":
        uncertainty_reason = "statistical assumptions are not supported"
    elif not np.all(np.isfinite(covariance)):
        uncertainty_reason = "finite parameter covariance is unavailable"
    if uncertainty_reason:
        covariance[np.ix_(free_index, free_index)] = np.nan
    return SimpleNamespace(
        fitted=fitted,
        covariance=covariance,
        free_index=free_index,
        parameter_names=parameter_names,
        data_tool_fit=data_tool_fit,
        uncertainty_reason=uncertainty_reason,
        known_sigma=known_sigma,
        residual=residual,
        sigma_fit=sigma_fit,
        sse=sse,
        df=df,
        x_fit=x_fit,
        y_fit=y_fit,
        x_all=x_all,
        y_all=y_all,
        excluded=excluded,
    )


def load_model(path):
    with path.open(encoding="utf-8") as handle:
        analysis = json.load(handle)
    if analysis.get("format") != "data-tool-analysis-bundle" or analysis.get("version") != 1:
        raise ValueError(f"{path}: unsupported analysis metadata")

    # The model function above is generated from a validated equation. Alternate metadata
    # may change starts, fixed flags, uncertainty, or view, but cannot change that code.
    expected_identity = json.loads(${JSON.stringify(JSON.stringify(executableIdentity(description.settings)))})
    fit_metadata = analysis["fit"]
    custom = fit_metadata.get("customEquation")
    identity = {
        "model": fit_metadata["model"],
        "parameterNames": [parameter["name"] for parameter in fit_metadata["parameters"]],
        "customEquation": {key: custom[key] for key in ("expression", "variable", "names")} if custom else None,
        "options": {key: fit_metadata["options"].get(key) for key in expected_identity["options"]},
    }
    if identity != expected_identity:
        raise ValueError(f"{path}: model, parameter order, or equation options do not match this generated program")

    return analysis


def read_number(value, row_number, column):
    value = value.strip()
    if not value:
        return np.nan
    try:
        result = float(value)
    except ValueError as cause:
        raise ValueError(f"CSV row {row_number} has invalid {column}") from cause
    if not np.isfinite(result):
        raise ValueError(f"CSV row {row_number} has non-finite {column}")
    return result

def load_data(path):
    row_ids, x, y, sigma, included = [], [], [], [], []
    expected = ["row_id", "x", "y", "sigma", "included", "missing_reason"]
    with path.open(newline="", encoding="utf-8-sig") as handle:
        # Only the preamble is comments; quoted multiline CSV fields stay intact.
        while True:
            position = handle.tell()
            line = handle.readline()
            if not line.startswith("#"):
                handle.seek(position)
                break
        reader = csv.DictReader(handle)
        if reader.fieldnames != expected:
            raise ValueError(f"{path}: expected CSV columns {', '.join(expected)}")
        for row_number, row in enumerate(reader, start=2):
            if None in row or any(value is None for value in row.values()):
                raise ValueError(f"{path}: row {row_number} has the wrong number of fields")
            flag = row["included"].strip().lower()
            if flag not in {"true", "false", "1", "0"}:
                raise ValueError(f"{path}: row {row_number} has invalid included flag")
            row_ids.append(row["row_id"])
            x.append(read_number(row["x"], row_number, "x"))
            y.append(read_number(row["y"], row_number, "y"))
            sigma.append(read_number(row["sigma"], row_number, "sigma"))
            included.append(flag in {"true", "1"})
    if not row_ids:
        raise ValueError(f"{path}: no observations")
    return (
        row_ids,
        np.asarray(x, dtype=float),
        np.asarray(y, dtype=float),
        np.asarray(sigma, dtype=float),
        np.asarray(included, dtype=bool),
    )

def report_fit(result, reference_inputs):
    fitted = result.fitted
    covariance = result.covariance
    free_index = result.free_index
    parameter_names = result.parameter_names
    data_tool_fit = result.data_tool_fit
    uncertainty_reason = result.uncertainty_reason
    known_sigma = result.known_sigma
    residual = result.residual
    sigma_fit = result.sigma_fit
    sse = result.sse
    df = result.df
    if uncertainty_reason:
        print(f"Standard errors unavailable: {uncertainty_reason}")
    if known_sigma:
        chi2 = float(np.sum((residual/sigma_fit)**2))
        print(f"chi2 = {chi2:.12g}; chi2/df = {chi2/df:.12g}" if df > 0 else f"chi2 = {chi2:.12g}; df = 0")
    else:
        scatter = np.sqrt(sse/df) if df > 0 else np.nan
        print(f"SSE = {sse:.12g}; residual scatter = {scatter:.12g}; df = {df}")
    print("SciPy fit (standard error):")
    for index, name in enumerate(parameter_names):
        suffix = "fixed" if index not in free_index else "SE=unavailable" if uncertainty_reason else f"SE={np.sqrt(max(0.0, covariance[index, index])):.12g}"
        print(f"  {name} = {fitted[index]:.17g} ({suffix})")
${description.settings.model === "gaussian-shape" ? "    report_peak_moments(fitted, covariance, free_index, uncertainty_reason)\n" : ""}

    if reference_inputs:
        print("Data Tool fit:", data_tool_fit)
        print("maximum absolute coefficient difference:", np.max(np.abs(fitted - data_tool_fit)))
    else:
        print("Data Tool coefficient comparison omitted for alternate inputs.")


def plot_fit(analysis, result, output=None, show=False):
    fitted = result.fitted
    known_sigma = result.known_sigma
    residual = result.residual
    sigma_fit = result.sigma_fit
    x_fit = result.x_fit
    y_fit = result.y_fit
    x_all = result.x_all
    y_all = result.y_all
    excluded = result.excluded
    dataset = analysis["dataset"]
    view = analysis["view"]
    show_residuals = bool(view["showResiduals"])
    if show_residuals:
        fig, (ax_data, ax_residual) = plt.subplots(
            2, 1, sharex=True, gridspec_kw={"height_ratios": [3, 1]}, figsize=(8, 6)
        )
    else:
        fig, ax_data = plt.subplots(figsize=(8, 5))

    if view["showErrorBars"] and known_sigma:
        ax_data.errorbar(x_fit, y_fit, yerr=sigma_fit, fmt="o", label="included data", capsize=2)
    else:
        ax_data.plot(x_fit, y_fit, "o", label="included data")
    if np.any(excluded):
        ax_data.plot(x_all[excluded], y_all[excluded], "x", color="0.55", label="excluded data")

    x_min, x_max = map(float, view["xRange"])
    log_x = view["mode"] in {"log-x", "log-log"}
    log_y = view["mode"] in {"log-y", "log-log"}
    curve_x = np.geomspace(x_min, x_max, 800) if log_x else np.linspace(x_min, x_max, 800)
    ax_data.plot(curve_x, model(curve_x, *fitted), color="#cc9550", linewidth=2, label="SciPy fit")${guideCode.replaceAll("\n", "\n    ")}

    def axis_label(axis):
        return f'{axis["label"]} [{axis["unit"]}]' if axis["unit"] else axis["label"]

    ax_data.set_title(dataset["title"])
    ax_data.set_ylabel(axis_label(dataset["y"]))
    ax_data.set_xscale("log" if log_x else "linear")
    ax_data.set_yscale("log" if log_y else "linear")
    ax_data.set_xlim(x_min, x_max)
    if view["yRange"] is not None:
        ax_data.set_ylim(*map(float, view["yRange"]))
    ax_data.grid(alpha=0.25)
    ax_data.legend()

    if show_residuals:
        ax_residual.axhline(0, color="0.5", linestyle="--", linewidth=1)
        ax_residual.plot(x_fit, residual, "o")
        ax_residual.set_ylabel("Residual")
        ax_residual.set_xlabel(axis_label(dataset["x"]))
        ax_residual.set_xscale("log" if log_x else "linear")
        ax_residual.grid(alpha=0.25)
    else:
        ax_data.set_xlabel(axis_label(dataset["x"]))

    fig.tight_layout()
    output = output or (BUNDLE_DIR / analysis["outputs"]["scipyFigure"])
    output.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output, dpi=160)
    print(f"saved figure: {output}")
    if show:
        plt.show()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA, help="CSV input (default: bundled data.csv)")
    parser.add_argument("--analysis", type=Path, default=DEFAULT_ANALYSIS, help="analysis metadata (default: bundled analysis.json)")
    parser.add_argument("--output", type=Path, help="PNG output path")
    parser.add_argument("--show", action="store_true", help="open the Matplotlib window after saving")
    args = parser.parse_args()

    analysis = load_model(args.analysis)
    data = load_data(args.data)
    result = fit_data(data, analysis)
    reference_inputs = args.data.resolve() == DEFAULT_DATA.resolve() and args.analysis.resolve() == DEFAULT_ANALYSIS.resolve()
    report_fit(result, reference_inputs)
    plot_fit(analysis, result, args.output, args.show)


if __name__ == "__main__":
    main()
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

function rootExpression(settings: FitSettings) {
  if (settings.model === "custom")
    return renderEquation(settings.custom!, "root", (i) => `p[${i}]`);
  const suppliedPeriod = number(settings.sinePeriod ?? 2 * Math.PI);
  const shape = number(
    settings.shape ?? (settings.model === "exponential" ? -1 : 2),
  );
  const expressions: Record<Exclude<FitSettings["model"], "custom">, string> = {
    ...polynomialExpressions((i) =>
      i === 0 ? "p[0]" : `p[${i}]*std::pow(x, ${i})`,
    ),
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
    "exponential-growth": "p[0] + p[1]*std::exp(x/p[2])",
    sigmoid:
      "p[0] + p[1]*((x-p[2])/p[3] >= 0 ? 1/(1+std::exp(-(x-p[2])/p[3])) : std::exp((x-p[2])/p[3])/(1+std::exp((x-p[2])/p[3])))",
    "power-law-free": "p[0] + p[1]*std::pow(x, p[2])",
    gaussian: "p[0] + p[1]*std::exp(-0.5*std::pow((x-p[2])/p[3], 2))",
    "gaussian-shape": "gaussian_peak(x, p)",
    "damped-sine":
      "p[0] + std::exp(-x/p[4])*(p[1]*std::sin(2*TMath::Pi()*x/p[3]) + p[2]*std::cos(2*TMath::Pi()*x/p[3]))",
    lorentzian: "p[0] + p[1]/(1 + std::pow((x-p[2])/p[3], 2))",
  };
  return expressions[settings.model];
}

/** ROOT macro for the bundle's external CSV input. */
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
      return lines.join("\n");
    })
    .join("\n");
  const fitterParameterSetup = settings.parameters
    .map((parameter, i) => {
      if (parameter.fixed)
        return `    fitter.Config().ParSettings(${i}).Fix();`;
      if (settings.model === "sine-free-period" && i === 3)
        return `    fitter.Config().ParSettings(${i}).SetLimits(${number(settings.periodMin!)}, ${number(settings.periodMax!)});`;
      if (
        isNonlinearModel(settings.model) &&
        (
          nonlinearModels[settings.model].positive as readonly number[]
        ).includes(i)
      )
        return `    fitter.Config().ParSettings(${i}).SetLowerLimit(std::nextafter(0.0, 1.0));`;
      return "";
    })
    .filter(Boolean)
    .join("\n");
  const meanGuide = `
  TF1 baseline("fitted_baseline", "[0]", x_min, x_max);
  baseline.SetParameter(0, model.GetParameter(0));
  baseline.SetLineColor(kGray+2); baseline.SetLineStyle(2); baseline.Draw("same");`;
  const centerGuide = `
  gPad->Update();
  TLine center;
  if (model.GetParameter(2) >= x_min && model.GetParameter(2) <= x_max${logX ? " && model.GetParameter(2) > 0" : ""}) {
    center.SetX1(model.GetParameter(2)); center.SetX2(model.GetParameter(2));
    center.SetY1(${logY ? "std::pow(10.0, gPad->GetUymin())" : "gPad->GetUymin()"});
    center.SetY2(${logY ? "std::pow(10.0, gPad->GetUymax())" : "gPad->GetUymax()"});
    center.SetLineColor(kGray+2); center.SetLineStyle(2); center.Draw("same");
  }`;
  const otherGuides: Partial<Record<FitSettings["model"], string>> = {
    sine: meanGuide,
    "sine-free-period": meanGuide,
    gaussian: centerGuide,
    "gaussian-shape": centerGuide,
    lorentzian: centerGuide,
    sigmoid:
      meanGuide +
      `
  TF1 asymptote("fitted_asymptote", "[0]", x_min, x_max);
  asymptote.SetParameter(0, model.GetParameter(0)+model.GetParameter(1));
  asymptote.SetLineColor(kGray+1); asymptote.SetLineStyle(2); asymptote.Draw("same");` +
      centerGuide,
  };
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
      : view.showGuides
        ? (otherGuides[settings.model] ?? "")
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
  residuals.SetName("residuals"); residuals.SetTitle(${cppString(`;${axisLabel(description.xLabel, description.xUnit)};Residual`)});
  residuals.SetMarkerStyle(20); residuals.Draw("${graphDrawOption}");
  residuals.GetXaxis()->SetLimits(x_min, x_max);
  TLine zero(x_min, 0, x_max, 0); zero.SetLineStyle(2); zero.SetLineColor(kGray+2); zero.Draw();`
    : "";
  return `// Data Tool 2027 ROOT demonstration.
// Run with bundled data: root -l fit_root.C
// Alternate data: root -l 'fit_root.C("another.csv","another-fit")'
// Measurements are read from CSV rather than compiled into this macro.
// ROOT and Data Tool use different nonlinear optimizers; local minima and roundoff can differ.
#include <TF1.h>
#include <Fit/Fitter.h>
#include <TFile.h>
#include <TFitResult.h>
#include <TROOT.h>
#include <TGraph.h>
#include <TGraphErrors.h>
#include <TLegend.h>
#include <TLine.h>
#include <TMath.h>
#include <TCanvas.h>
#include <TPad.h>
#include <TSystem.h>
#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdlib>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>
#include <utility>
${settings.model === "gaussian-shape" ? "double gaussian_peak(double x, const double *p);" : ""}

// The fitted function: the equation is the first function in this file.
double model_function(double *xx, double *p) {
  const double x = xx[0];
  return ${rootExpression(settings)};
}
${settings.model === "gaussian-shape" ? rootPeakShapeHelpers : ""}

struct Data {
  std::vector<double> data_x, data_y, data_ex, data_ey, excluded_x, excluded_y;
};

struct FitOutcome {
  TFitResult fit_result;
  std::string uncertainty_reason;
};

FitOutcome fit_data(Data &data, TF1 &model) {
  auto &data_x = data.data_x;
  auto &data_y = data.data_y;
  auto &data_ey = data.data_ey;
  // Fit in physical parameter coordinates. One-sided limits avoid Minuit's
  // unstable transformation of an enormous two-sided positive interval.
  auto run_fit = [&]() {
    ROOT::Fit::Fitter fitter;
    auto chi2 = [&](const double *p) {
      double sum = 0.0;
      for (size_t i=0; i<data_x.size(); ++i) {
        double x = data_x[i];
        const double residual = (data_y[i]-model.EvalPar(&x, p))/data_ey[i];
        sum += residual*residual;
        if (!std::isfinite(sum)) return std::numeric_limits<double>::max();
      }
      return sum;
    };
    fitter.SetFCN(model.GetNpar(), chi2, model.GetParameters(), data_x.size(), 1);
    fitter.Config().SetMinimizer("Minuit2", "Migrad");
    fitter.Config().MinimizerOptions().SetTolerance(1e-6);
    fitter.Config().MinimizerOptions().SetMaxFunctionCalls(200000);
    fitter.Config().SetNormErrors(false); // Scale unknown scatter explicitly below.
    for (int i=0; i<model.GetNpar(); ++i)
      fitter.Config().ParSettings(i).SetName(model.GetParName(i));
${fitterParameterSetup}
    const bool success = fitter.FitFCN();
    TFitResult result(fitter.Result());
    if (!success || !result.IsValid() || result.Status() != 0 || !std::isfinite(result.Chi2()))
      throw std::runtime_error("ROOT fit failed (status " + std::to_string(result.Status()) + "); no successful fit artifacts were written");
    if (${free} > 0 && result.CovMatrixStatus() != 3)
      throw std::runtime_error("ROOT could not determine a full-rank parameter covariance");
    for (int i=0; i<model.GetNpar(); ++i) {
      if (!std::isfinite(result.Parameter(i)) || !std::isfinite(result.ParError(i)))
        throw std::runtime_error("ROOT fit produced non-finite parameters or errors");
      model.SetParameter(i, result.Parameter(i)); model.SetParError(i, result.ParError(i));
    }
    for (double x : data_x)
      if (!std::isfinite(model.Eval(x))) throw std::runtime_error("ROOT fit produced non-finite predictions");
    model.SetChisquare(result.Chi2()); model.SetNDF(result.Ndf());
    return result;
  };
  TFitResult fit_result = run_fit();
  const int df = static_cast<int>(data_x.size()) - ${free};
  std::string uncertainty_reason;
${
  description.knownSigma
    ? ""
    : `  // Data Tool estimates one common scatter parameter with s=sqrt(SSE/df).
  // Refit with that uniform error so ROOT's covariance uses the same scale.
  double preliminary_sse = 0.0;
  for (size_t i=0; i<data_x.size(); ++i) preliminary_sse += std::pow(data_y[i]-model.Eval(data_x[i]), 2);
  if (!std::isfinite(preliminary_sse)) throw std::runtime_error("Residual sum of squares overflowed");
  if (df > 0 && preliminary_sse > 0) {
    const double scatter = std::sqrt(preliminary_sse/df);
    for (size_t i=0; i<data_ey.size(); ++i) { data_ey[i]=scatter; }
    fit_result = run_fit();
  } else {
    uncertainty_reason = "residual scatter cannot be estimated (zero SSE or nonpositive degrees of freedom)";
  }`
}
  if (uncertainty_reason.empty() && ${cppString(description.inference)} == std::string("descriptive"))
    uncertainty_reason = "statistical assumptions are not supported";
  const bool errors_available = uncertainty_reason.empty();
  const bool fixed_parameters[] = {${settings.parameters.map((parameter) => String(parameter.fixed)).join(", ")}};
  if (!errors_available) {
    std::cout << "Standard errors unavailable: " << uncertainty_reason << "\\n";
    for (int i=0; i<model.GetNpar(); ++i)
      if (!fixed_parameters[i]) model.SetParError(i, std::numeric_limits<double>::quiet_NaN());
  }
  return {fit_result, uncertainty_reason};
}

TF1 load_model(const Data &data) {
  const auto &data_x = data.data_x;
  const auto fit_bounds = std::minmax_element(data_x.begin(), data_x.end());
  const double fit_x_min = *fit_bounds.first, fit_x_max = *fit_bounds.second;
  TF1 model("fit_model", model_function, fit_x_min, fit_x_max, ${settings.parameters.length});
${parameterSetup}
  return model;
}

bool data_tool_csv_record(std::istream &input, std::vector<std::string> &fields) {
  fields.clear();
  std::string field;
  bool quoted = false, closed = false, any = false;
  while (true) {
    const int raw = input.get();
    if (raw == EOF) {
      if (quoted) throw std::runtime_error("Unclosed quoted CSV field");
      if (!any && field.empty() && fields.empty()) return false;
      fields.push_back(field);
      return true;
    }
    any = true;
    const char c = static_cast<char>(raw);
    if (quoted) {
      if (c == '"') {
        if (input.peek() == '"') { input.get(); field.push_back('"'); }
        else { quoted = false; closed = true; }
      } else {
        field.push_back(c);
      }
    } else if (c == ',') {
      fields.push_back(field); field.clear(); closed = false;
    } else if (c == '\\n' || c == '\\r') {
      if (c == '\\r' && input.peek() == '\\n') input.get();
      fields.push_back(field);
      return true;
    } else if (c == '"' && field.empty() && !closed) {
      quoted = true;
    } else {
      if (closed || c == '"') throw std::runtime_error("Malformed quoted CSV field");
      field.push_back(c);
    }
  }
}

std::string data_tool_trim(const std::string &value) {
  size_t first = 0, last = value.size();
  while (first < last && std::isspace(static_cast<unsigned char>(value[first]))) ++first;
  while (last > first && std::isspace(static_cast<unsigned char>(value[last-1]))) --last;
  return value.substr(first, last-first);
}

double data_tool_number(const std::string &cell, size_t row, const char *column) {
  const std::string value = data_tool_trim(cell);
  if (value.empty()) return NAN;
  char *end = nullptr;
  // strtod preserves representable subnormals; stod throws on ERANGE even when
  // the rounded result is finite and nonzero.
  const double result = std::strtod(value.c_str(), &end);
  if (end == value.c_str() || end != value.c_str()+value.size() || !std::isfinite(result))
    throw std::runtime_error("Invalid " + std::string(column) + " in CSV row " + std::to_string(row));
  return result;
}

bool data_tool_included(const std::string &cell, size_t row) {
  std::string value = data_tool_trim(cell);
  std::transform(value.begin(), value.end(), value.begin(),
                 [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  if (value == "true" || value == "1") return true;
  if (value == "false" || value == "0") return false;
  throw std::runtime_error("Invalid included flag in CSV row " + std::to_string(row));
}

Data load_data(const std::string &csv_path) {
  std::ifstream input(csv_path);
  if (!input) throw std::runtime_error("Cannot open CSV input: " + csv_path);
  if (input.peek() == 0xef) {
    char bom[3] = {}; input.read(bom, 3);
    if (input.gcount() != 3 || static_cast<unsigned char>(bom[1]) != 0xbb || static_cast<unsigned char>(bom[2]) != 0xbf)
      throw std::runtime_error("Invalid UTF-8 byte order mark");
  }

  while (input.peek() == '#') {
    std::string comment; std::getline(input, comment);
  }

  const std::vector<std::string> expected = {
    "row_id", "x", "y", "sigma", "included", "missing_reason"
  };
  std::vector<std::string> fields;
  if (!data_tool_csv_record(input, fields) || fields != expected)
    throw std::runtime_error("CSV needs columns: row_id,x,y,sigma,included,missing_reason");

  std::vector<std::string> row_ids;
  std::vector<double> x_all, y_all, sigma_all;
  std::vector<int> included;
  size_t csv_row = 1;
  while (data_tool_csv_record(input, fields)) {
    ++csv_row;
    if (fields.size() != expected.size())
      throw std::runtime_error("Wrong number of fields in CSV row " + std::to_string(csv_row));
    row_ids.push_back(fields[0]);
    x_all.push_back(data_tool_number(fields[1], csv_row, "x"));
    y_all.push_back(data_tool_number(fields[2], csv_row, "y"));
    sigma_all.push_back(data_tool_number(fields[3], csv_row, "sigma"));
    included.push_back(data_tool_included(fields[4], csv_row));
  }
  if (row_ids.empty()) throw std::runtime_error("CSV contains no observations");

  Data data;
  auto &data_x = data.data_x;
  auto &data_y = data.data_y;
  auto &data_ex = data.data_ex;
  auto &data_ey = data.data_ey;
  auto &excluded_x = data.excluded_x;
  auto &excluded_y = data.excluded_y;

  for (size_t i=0; i<x_all.size(); ++i) {
    if (!std::isfinite(x_all[i]) || !std::isfinite(y_all[i])) continue;
    if (included[i]) {
      data_x.push_back(x_all[i]); data_y.push_back(y_all[i]); data_ex.push_back(0.0);
${
  description.knownSigma
    ? `      if (!std::isfinite(sigma_all[i]) || sigma_all[i] <= 0)
        throw std::runtime_error("Every included row needs a positive finite sigma");
      data_ey.push_back(sigma_all[i]);`
    : "      data_ey.push_back(1.0);"
}
    } else { excluded_x.push_back(x_all[i]); excluded_y.push_back(y_all[i]); }
  }
  if (data_x.empty()) throw std::runtime_error("CSV has no finite included observations");
  if (data_x.size() < ${free}) throw std::runtime_error("Fewer observations than free parameters");

  return data;
}

void report_fit(TF1 &model, FitOutcome &result, bool reference_inputs) {
  auto &fit_result = result.fit_result;
  const auto &uncertainty_reason = result.uncertainty_reason;
  const bool errors_available = uncertainty_reason.empty();
  const bool fixed_parameters[] = {${settings.parameters.map((parameter) => String(parameter.fixed)).join(", ")}};
  std::cout << std::setprecision(17);
  std::cout << "fit status = " << fit_result.Status() << "; covariance status = " << fit_result.CovMatrixStatus() << "\\n";
  std::cout << "ROOT fit (standard error):\\n";
  for (int i=0; i<${settings.parameters.length}; ++i) {
    std::cout << "  " << model.GetParName(i) << " = " << model.GetParameter(i);
    if (fixed_parameters[i]) std::cout << " (fixed)\\n";
    else if (errors_available) std::cout << " (SE=" << model.GetParError(i) << ")\\n";
    else std::cout << " (SE=unavailable)\\n";
  }
  std::cout << "chi2 = " << model.GetChisquare() << "; ndf = " << model.GetNDF() << "\\n";
${settings.model === "gaussian-shape" ? "  report_peak_moments(model, fit_result, fixed_parameters, errors_available);\n" : ""}

  if (reference_inputs) {
    const double data_tool_fit[] = {${description.dataToolFit.map(number).join(", ")}};
    double max_difference = 0.0;
    for (int i=0; i<${settings.parameters.length}; ++i)
      max_difference = std::max(max_difference, std::abs(model.GetParameter(i)-data_tool_fit[i]));
    std::cout << "max coefficient difference from Data Tool = " << max_difference << "\\n";
  } else {
    std::cout << "Data Tool coefficient comparison omitted for alternate inputs.\\n";
  }

}

void plot_fit(Data &data, TF1 &model, FitOutcome &result, const char *output_stem) {
  auto &data_x = data.data_x;
  auto &data_y = data.data_y;
  auto &data_ex = data.data_ex;
  auto &data_ey = data.data_ey;
  auto &excluded_x = data.excluded_x;
  auto &excluded_y = data.excluded_y;
  auto &fit_result = result.fit_result;
  const auto &uncertainty_reason = result.uncertainty_reason;
  const bool errors_available = uncertainty_reason.empty();
  const double x_min = ${number(view.xRange[0])}, x_max = ${number(view.xRange[1])};
  TGraphErrors graph(data_x.size(), data_x.data(), data_y.data(), data_ex.data(), data_ey.data());
  graph.SetName("included_data");
  graph.SetTitle(${cppString(
    `${description.title};${axisLabel(description.xLabel, description.xUnit)};${axisLabel(description.yLabel, description.yUnit)}`,
  )});
  graph.SetMarkerStyle(20);
  model.SetRange(x_min, x_max); // Display zoom never changes the fitted sample.
  TCanvas canvas("data_tool_canvas", ${cppString(description.title)}, 900, ${view.showResiduals ? 700 : 520});
  ${view.showResiduals ? "canvas.Divide(1, 2); canvas.cd(1);" : "canvas.cd();"}
  gPad->SetGrid();${logX ? " gPad->SetLogx();" : ""}${logY ? " gPad->SetLogy();" : ""}
  graph.Draw("${graphDrawOption}"); graph.GetXaxis()->SetLimits(x_min, x_max);${yLimits}
  model.SetLineColor(kOrange+7); model.SetLineWidth(3); model.Draw("same");${guideCode}
  TGraph excluded_graph(excluded_x.size(), excluded_x.data(), excluded_y.data());
  excluded_graph.SetName("excluded_data"); excluded_graph.SetMarkerStyle(5); excluded_graph.SetMarkerColor(kGray+1);
  if (!excluded_x.empty()) excluded_graph.Draw("P SAME");
${residualPanel}
  const std::string output_base =
    output_stem && *output_stem ? output_stem : ${cppString(`${description.fileStem}-root`)};
  canvas.SaveAs((output_base + ".pdf").c_str());
  TFile output((output_base + ".root").c_str(), "RECREATE");
  graph.Write(); excluded_graph.Write(); model.Write();${view.showResiduals ? " residuals.Write();" : ""} canvas.Write();
  // Keep an unavailable covariance explicitly separate from statistical errors.
  if (!errors_available) fit_result.SetTitle(("Numerical minimizer result; standard errors unavailable: " + uncertainty_reason).c_str());
  fit_result.Write(errors_available ? "fit_result" : "numerical_fit_result");
  output.Close();
  // Clone while stack-owned plot objects are alive so the interactive window survives.
  if (!gROOT->IsBatch()) canvas.DrawClone();
}
// ROOT calls this entry point automatically, like main() in a standalone program.
void fit_root(const char *data_path = "",
              const char *output_stem = ${cppString(`${description.fileStem}-root`)}) {
  const bool reference_inputs = !data_path || !*data_path;
  const std::string csv_path = reference_inputs
    ? std::string(gSystem->DirName(__FILE__)) + "/data.csv"
    : std::string(data_path);
  Data data = load_data(csv_path);
  TF1 model = load_model(data);
  FitOutcome result = fit_data(data, model);
  report_fit(model, result, reference_inputs);
  plot_fit(data, model, result, output_stem);
}

`;
}

export function generateCodeExportReadme(
  description: CodeExportDescription,
  target: CodeExportTarget = "both",
) {
  return `# Data Tool 2027 analysis bundle

This archive keeps measurements in \`data.csv\`, separate from executable source.
The generated programs refit the included finite rows from the original starting
values. See \`analysis.json\` for the model setup, assumptions, units, display
choices, and the original Data Tool coefficients.

${
  target !== "root"
    ? `## Python / SciPy

Requires Python 3. Install NumPy, SciPy, and Matplotlib from the included
\`requirements.txt\` (optionally activate a virtual environment first):

\`\`\`bash
python3 -m pip install -r requirements.txt
python3 fit_scipy.py
\`\`\`

The script saves \`${description.fileStem}-scipy.png\`. Add \`--show\` to open the
plot window. Apply the same generated model to another compatible table with:

\`\`\`bash
python3 fit_scipy.py --data another-run.csv --output another-fit.png
\`\`\`

The optional \`--analysis\` metadata may change starting values, fixed flags,
uncertainty, and display choices. Its model, parameter order, custom expression,
and supplied equation constants must match the generated program; incompatible
metadata is rejected.

The equation is the first function, \`model\`. The \`main()\` routine calls
\`load_model\`, \`load_data\`, \`fit_data\`, \`report_fit\`, and \`plot_fit\`.
Importing the file does not run an analysis.

`
    : ""
}${
    target !== "scipy"
      ? `## C++ / ROOT

Run from this directory with ROOT:

\`\`\`bash
root -l fit_root.C
\`\`\`

The graph window stays open after the macro finishes. Quit ROOT with \`.q\`.
For a run without a window, use \`root -l -b -q fit_root.C\`.

The macro saves \`${description.fileStem}-root.pdf\` and
\`${description.fileStem}-root.root\`. Supply another table and output stem with:

\`\`\`bash
root -l 'fit_root.C("another-run.csv","another-fit")'
\`\`\`

The equation is the first function, \`model_function\`. The \`fit_root()\`
entry point acts as main: \`load_data\` → \`load_model\` → \`fit_data\` →
\`report_fit\` → \`plot_fit\`. Model settings are explicit in \`load_model\`;
\`analysis.json\` records them for reference and is not read by ROOT.

`
      : ""
  }## CSV contract

Source notes are preserved as leading \`# \` comment lines. Both programs skip
this preamble before reading the required header:

\`\`\`text
row_id,x,y,sigma,included,missing_reason
\`\`\`

Blank X, Y, or sigma cells represent missing values. \`included\` accepts
\`true\`, \`false\`, \`1\`, or \`0\`. Supplied-uncertainty analyses require a
positive finite sigma for every included finite row. Unknown-equal-scatter
analyses leave sigma blank and estimate one residual scatter.

The Data Tool coefficient comparison applies only to the bundled \`data.csv\`
and \`analysis.json\`. Alternate CSV files are refit without claiming that the
stored Data Tool solution is their reference result.

Different solver versions, stopping rules, roundoff, and nonlinear basins can
produce different results. Statistical interpretation remains conditional on
the assumptions recorded in \`analysis.json\`.

Standard errors are reported as unavailable when statistical assumptions are
unsupported or residual scatter cannot be estimated. ROOT preserves such a raw
minimizer result as \`numerical_fit_result\`, with an explanatory title, rather
than presenting its provisional covariance as statistical uncertainty. Failed
or rank-deficient ROOT optimizations stop before writing fit artifacts.
`;
}

export function generateCodeExportBundle(
  description: CodeExportDescription,
  target: CodeExportTarget = "both",
): CodeExportBundle {
  return {
    archiveName: codeExportBundleFileName(description, target),
    directoryName: `${description.fileStem}${target === "both" ? "" : `-${target}`}-analysis`,
    files: {
      "data.csv": generateCodeExportCsv(description),
      "analysis.json": generateCodeExportMetadata(description, target),
      ...(target !== "root"
        ? {
            "fit_scipy.py": generatePythonCode(description),
            "requirements.txt": "numpy\nscipy\nmatplotlib\n",
          }
        : {}),
      ...(target !== "scipy"
        ? { "fit_root.C": generateRootCode(description) }
        : {}),
      "README.md": generateCodeExportReadme(description, target),
    },
  };
}
