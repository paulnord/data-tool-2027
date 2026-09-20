import { polynomialDegree, polynomialExpressions } from "./polynomialModels";
import { renderEquation } from "./customEquation";
import { isNonlinearModel, nonlinearModels } from "./nonlinearModels";
import { effectivePolynomialBasis } from "./seriesModels";
import {
  pythonPeakModelHelpers,
  rootPeakModelHelpers,
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
  rowLabels: (string | null)[];
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
    rowLabels: request.dataset.rows.map((row) => row.label ?? null),
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
export function generateObservationArchiveCsv(
  description: CodeExportDescription,
) {
  const rows = description.rowIds.map((rowId, index) =>
    [
      rowId,
      description.rowLabels[index] ?? "",
      description.x[index] === null
        ? ""
        : Object.is(description.x[index], -0)
          ? "-0"
          : String(description.x[index]),
      description.y[index] === null
        ? ""
        : Object.is(description.y[index], -0)
          ? "-0"
          : String(description.y[index]),
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
    [
      ...comments,
      "row_id,row_label,x,y,sigma,included,missing_reason",
      ...rows,
    ].join("\r\n") + "\r\n"
  );
}

/** Numeric fit inputs, already selected and validated by the application. */
export function generateCodeExportCsv(description: CodeExportDescription) {
  const comments =
    description.source.context
      ?.split(/\r\n|\r|\n/)
      .map((line) => `# ${line}`) ?? [];
  const rows = description.x.flatMap((x, i) => {
    const y = description.y[i];
    if (!description.included[i] || x === null || y === null) return [];
    return [
      [x, y, ...(description.knownSigma ? [description.sigma[i]] : [])]
        .map((v) => (Object.is(v, -0) ? "-0" : String(v)))
        .join(","),
    ];
  });
  const labels = [
    axisLabel(description.xLabel, description.xUnit),
    axisLabel(description.yLabel, description.yUnit),
  ];
  if (description.knownSigma)
    labels.push(axisLabel("sigma_y", description.yUnit));
  return (
    [
      ...comments,
      ...labels.map(
        (label, i) => `# Column ${i + 1}: ${JSON.stringify(label)}`,
      ),
      `# ${description.knownSigma ? "x,y,sigma_y" : "x,y"}`,
      ...rows,
    ].join("\r\n") + "\r\n"
  );
}

function pythonExpression(settings: FitSettings) {
  if (settings.model === "custom")
    return renderEquation(settings.custom!, "python", (i) => `p[${i}]`);
  const degree = polynomialDegree(settings.model);
  if (degree !== undefined) {
    const basis = effectivePolynomialBasis(settings.polynomialBasis);
    if (basis.kind === "taylor") {
      const centered = `(x-(${number(basis.center)}))`;
      const coefficients = Array.from({ length: degree + 1 }, (_, i) =>
        i < 2 ? `p[${i}]` : `p[${i}]/${number(factorial(i))}`,
      ).join(", ");
      return `np.polynomial.polynomial.polyval(${centered}, np.array([${coefficients}]))`;
    }
    if (basis.kind === "chebyshev") {
      const coefficients = Array.from(
        { length: degree + 1 },
        (_, i) => `p[${i}]`,
      ).join(", ");
      return `np.polynomial.chebyshev.chebval(polynomial_coordinate(x), np.array([${coefficients}]))`;
    }
  }
  if (settings.model === "fourier") {
    const fourier = settings.fourier!;
    const phase = "fourier_phase(x)";
    return [
      "p[0]",
      ...Array.from({ length: fourier.harmonics }, (_, i) => i + 1).flatMap(
        (harmonic) => [
          `p[${2 * harmonic - 1}]*np.sin(${harmonic}*${phase})`,
          `p[${2 * harmonic}]*np.cos(${harmonic}*${phase})`,
        ],
      ),
    ].join(" + ");
  }
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
    fourier: "p[0]",
  };
  return expressions[settings.model];
}

function factorial(value: number) {
  let result = 1;
  for (let i = 2; i <= value; i++) result *= i;
  return result;
}

function pythonPolynomialHelper(settings: FitSettings) {
  const degree = polynomialDegree(settings.model);
  const basis = effectivePolynomialBasis(settings.polynomialBasis);
  if (degree === undefined || basis.kind !== "chebyshev") return "";
  return `def polynomial_coordinate(x):
    x = np.asarray(x, dtype=float)
    with np.errstate(over="ignore", invalid="ignore"):
        difference = x - (${number(basis.center)})
        return np.where(np.isfinite(difference), difference/${number(basis.scale)}, x/${number(basis.scale)} - (${number(basis.center)})/${number(basis.scale)})

`;
}

function pythonFourierHelper(settings: FitSettings) {
  if (settings.model !== "fourier") return "";
  const fourier = settings.fourier!;
  return `def fourier_phase(x):
    x = np.asarray(x, dtype=float)
    cycles = np.fmod(x, ${number(fourier.period)})/${number(fourier.period)} - np.fmod(${number(fourier.origin)}, ${number(fourier.period)})/${number(fourier.period)}
    return 2*np.pi*(cycles - np.rint(cycles))

`;
}

/** Full analytic design matrix for the generated linear-series models. */
function pythonSeriesJacobian(settings: FitSettings) {
  const degree = polynomialDegree(settings.model);
  if (degree !== undefined) {
    const basis = effectivePolynomialBasis(settings.polynomialBasis);
    if (basis.kind === "chebyshev")
      return `def model_jacobian(x):
    x = np.asarray(x, dtype=float)
    return np.polynomial.chebyshev.chebvander(polynomial_coordinate(x), ${degree})
`;
    if (basis.kind === "taylor")
      return `def model_jacobian(x):
    x = np.asarray(x, dtype=float)
    centered = x - (${number(basis.center)})
    columns = [np.ones_like(x)]
    for order in range(1, ${degree + 1}):
        columns.append((columns[-1]/order)*centered)
    return np.column_stack(columns)
`;
    const columns = Array.from({ length: degree + 1 }, (_, i) =>
      i === 0 ? "np.ones_like(x)" : `x**${i}`,
    );
    return `def model_jacobian(x):
    x = np.asarray(x, dtype=float)
    return np.column_stack([${columns.join(", ")}])
`;
  }
  if (settings.model === "fourier") {
    const fourier = settings.fourier!;
    const phase = "fourier_phase(x)";
    const columns = [
      "np.ones_like(x)",
      ...Array.from({ length: fourier.harmonics }, (_, i) => i + 1).flatMap(
        (harmonic) => [
          `np.sin(${harmonic}*${phase})`,
          `np.cos(${harmonic}*${phase})`,
        ],
      ),
    ];
    return `def model_jacobian(x):
    x = np.asarray(x, dtype=float)
    return np.column_stack([${columns.join(", ")}])
`;
  }
  return "";
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

export function generateCodeExportMetadata(
  description: CodeExportDescription,
  target: CodeExportTarget = "both",
) {
  const names = parameterNames(
    description.settings.model,
    description.settings.custom,
    description.settings.fourier,
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
          values: "data.csv:sigma_y",
        };
  return `${JSON.stringify(
    {
      format: "data-tool-analysis-bundle",
      version: 2,
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
        rowCount: description.rowIds.filter(
          (_, i) =>
            description.included[i] &&
            description.x[i] !== null &&
            description.y[i] !== null,
        ).length,
        sourceRowCount: description.rowIds.length,
        dataFile: "data.csv",
        columns: description.knownSigma ? ["x", "y", "sigma_y"] : ["x", "y"],
        fitRowIds: description.rowIds.filter(
          (_, i) =>
            description.included[i] &&
            description.x[i] !== null &&
            description.y[i] !== null,
        ),
        observationArchive: "observations.csv",
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
            }
          : {}),
      },
    },
    null,
    2,
  )}\n`;
}

/** A standalone program specialized to this model and its selected observations. */
export function generatePythonCode(description: CodeExportDescription) {
  const { settings, knownSigma } = description;
  const names = parameterNames(
    settings.model,
    settings.custom,
    settings.fourier,
  );
  const reserved = new Set(
    "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield x np p gaussian_peak".split(
      " ",
    ),
  );
  const aliases = names.map((name, i) =>
    reserved.has(name) ? `p_${i}` : name,
  );
  // Use indexed arguments when custom names collide with generated local identifiers.
  const named = new Set(aliases).size === aliases.length;
  const expression =
    settings.model === "gaussian-shape"
      ? `gaussian_peak(x, [${aliases.join(", ")}])`
      : pythonExpression(settings).replace(
          /p\[(\d+)\]/g,
          (_, i) => aliases[Number(i)],
        );
  const free = settings.parameters.flatMap((p, i) => (p.fixed ? [] : [i]));
  const partial = free.length > 0 && free.length < names.length;
  const bounds = parameterBounds(settings);
  const lower = free.map((i) =>
    bounds[i].lower === null
      ? "-np.inf"
      : bounds[i].lowerExclusive
        ? "np.nextafter(0.0, 1.0)"
        : number(bounds[i].lower!),
  );
  const upper = free.map((i) =>
    bounds[i].upper === null ? "np.inf" : number(bounds[i].upper!),
  );
  const bounded = bounds.some((b) => b.lower !== null || b.upper !== null);
  const hasSeriesJacobian =
    polynomialDegree(settings.model) !== undefined ||
    settings.model === "fourier";
  const jac = hasSeriesJacobian
    ? `        # Update model_jacobian if editing the series equation.
        jac=lambda x, *p: model_jacobian(x)[:, [${free.join(", ")}]],\n`
    : settings.model === "gaussian-shape"
      ? '        jac="3-point",\n'
      : "";
  const curveSampling =
    settings.model === "fourier"
      ? `    effective_cycles = (x.max() - x.min()) * ${settings.fourier!.harmonics} / ${number(settings.fourier!.period)}
    if not np.isfinite(effective_cycles) or effective_cycles < 0 or effective_cycles > 800:
        raise ValueError("Refusing to plot more than 800 effective Fourier cycles")
    curve_count = max(160, int(np.ceil(effective_cycles * 40)) + 1)
    curve_x = np.linspace(x.min(), x.max(), curve_count)`
      : "    curve_x = np.linspace(x.min(), x.max(), 800)";
  return `"""Run: python3 fit_scipy.py. See README.md for assumptions and data columns."""
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt
from scipy.optimize import curve_fit


${pythonPolynomialHelper(settings)}${pythonFourierHelper(settings)}
def model(x, ${named ? aliases.join(", ") : "*p"}):
    value = ${named ? expression : pythonExpression(settings)}
    return np.broadcast_to(value, np.shape(x))  # Also handles constant equations.
${pythonSeriesJacobian(settings)}
${settings.model === "gaussian-shape" ? pythonPeakModelHelpers : ""}

def load_data(filename):
    data = np.loadtxt(filename, delimiter=",", ndmin=2)
    if data.shape[1] != ${knownSigma ? 3 : 2} or not np.all(np.isfinite(data)):
        raise ValueError("Expected finite ${knownSigma ? "x,y,sigma_y" : "x,y"} columns")
${knownSigma ? '    if np.any(data[:, 2] <= 0):\n        raise ValueError("Supplied y uncertainties must be positive")\n' : ""}    return data.T


def load_model():
    # Starting values, in equation order: ${names.join(", ")}
    return np.array([${settings.parameters.map((p) => number(p.value)).join(", ")}])


def fit_data(x, y${knownSigma ? ", sigma_y" : ""}):
    start = load_model()
${
  partial
    ? `    free = np.array([${free.join(", ")}])  # Other parameters remain fixed at their starting values.
    def free_model(x, *values):
        p = start.copy()
        p[free] = values
        return model(x, *p)
`
    : ""
}${
    free.length
      ? `    # ${knownSigma ? "Absolute supplied y uncertainties; weights are 1/sigma_y**2." : "Equal weights; covariance is scaled by residual SSE / (n - free parameters)."}
    fitted, covariance = curve_fit(
        ${partial ? "free_model" : "model"}, x, y, p0=${partial ? "start[free]" : "start"},
        sigma=${knownSigma ? "sigma_y" : "None"}, absolute_sigma=${knownSigma ? "True" : "False"},
${bounded ? `        bounds=([${lower.join(", ")}], [${upper.join(", ")}]),\n` : ""}${jac}        maxfev=200000,
    )
${
  partial
    ? `    start[free] = fitted
    full_covariance = np.zeros((len(start), len(start)))
    full_covariance[np.ix_(free, free)] = covariance
    fitted, covariance = start, full_covariance
`
    : ""
}`
      : `    # All parameters are fixed; evaluate without optimization.
    fitted, covariance = start, np.zeros((len(start), len(start)))
`
  }    return fitted, covariance


def report_fit(x, y, fitted, covariance${knownSigma ? ", sigma_y" : ""}):
    residual = y - model(x, *fitted)
    if not np.all(np.isfinite(fitted)) or not np.all(np.isfinite(residual)):
        raise ValueError("Fit produced non-finite parameters or predictions")
    df = len(x) - ${free.length}
    ${knownSigma ? `print("${description.inference === "descriptive" ? "Weighted residual sum" : "chi2"} =", np.sum((residual / sigma_y)**2), "; df =", df)` : 'print("SSE =", residual @ residual, "; df =", df)'}
    errors_available = ${description.inference === "descriptive" ? "False" : "np.all(np.isfinite(covariance))"}${knownSigma ? "" : " and df > 0 and residual @ residual > 0"}
    for i, name in enumerate(${JSON.stringify(names)}):
        error = "fixed" if i not in ${JSON.stringify(free)} else f"SE={np.sqrt(covariance[i, i]):.12g}" if errors_available else "SE=unavailable"
        print(f"{name} = {fitted[i]:.17g} ({error})")


def plot_fit(x, y, fitted${knownSigma ? ", sigma_y" : ""}):
${curveSampling}
    fig, ax = plt.subplots()
    ax.${knownSigma ? 'errorbar(x, y, yerr=sigma_y, fmt=".", label="Data")' : 'plot(x, y, ".", label="Data")'}
    ax.plot(curve_x, model(curve_x, *fitted), label="Fit")
    ax.set(xlabel=${JSON.stringify(axisLabel(description.xLabel, description.xUnit))}, ylabel=${JSON.stringify(axisLabel(description.yLabel, description.yUnit))})
    ax.legend()
    fig.tight_layout()
    fig.savefig(Path(__file__).with_name(${JSON.stringify(description.fileStem + "-scipy.png")}), dpi=150)
    plt.show()


def main():
    x, y${knownSigma ? ", sigma_y" : ""} = load_data(Path(__file__).with_name("data.csv"))
    fitted, covariance = fit_data(x, y${knownSigma ? ", sigma_y" : ""})
    report_fit(x, y, fitted, covariance${knownSigma ? ", sigma_y" : ""})
    plot_fit(x, y, fitted${knownSigma ? ", sigma_y" : ""})


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
  const degree = polynomialDegree(settings.model);
  if (degree !== undefined) {
    const basis = effectivePolynomialBasis(settings.polynomialBasis);
    if (basis.kind === "taylor") return "taylor_series(x, p)";
    if (basis.kind === "chebyshev") return "chebyshev_series(x, p)";
  }
  if (settings.model === "fourier") {
    const fourier = settings.fourier!;
    const phase = "fourier_phase(x)";
    return [
      "p[0]",
      ...Array.from({ length: fourier.harmonics }, (_, i) => i + 1).flatMap(
        (harmonic) => [
          `p[${2 * harmonic - 1}]*std::sin(${harmonic}*${phase})`,
          `p[${2 * harmonic}]*std::cos(${harmonic}*${phase})`,
        ],
      ),
    ].join(" + ");
  }
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
    fourier: "p[0]",
  };
  return expressions[settings.model];
}

function rootSeriesHelper(settings: FitSettings) {
  const degree = polynomialDegree(settings.model);
  const basis = effectivePolynomialBasis(settings.polynomialBasis);
  if (degree === undefined) return "";
  if (basis.kind === "taylor") {
    const inverseFactorials = Array.from({ length: degree + 1 }, (_, i) =>
      number(1 / factorial(i)),
    ).join(", ");
    return `double taylor_series(double x, const double *p) {
  const double inverse_factorial[] = {${inverseFactorials}};
  const double z=x-(${number(basis.center)});
  double value=p[${degree}]*inverse_factorial[${degree}];
  for (int i=${degree - 1}; i>=0; --i)
    value=value*z+p[i]*inverse_factorial[i];
  return value;
}
`;
  }
  if (basis.kind !== "chebyshev") return "";
  return `double chebyshev_series(double x, const double *p) {
  const double difference=x-(${number(basis.center)});
  const double z=std::isfinite(difference) ? difference/${number(basis.scale)}
    : x/${number(basis.scale)}-(${number(basis.center)})/${number(basis.scale)};
  double t0=1.0, t1=z, value=p[0]+p[1]*t1;
  for (int i=2; i<=${degree}; ++i) {
    const double next=2*z*t1-t0;
    value+=p[i]*next; t0=t1; t1=next;
  }
  return value;
}
`;
}

function rootFourierHelper(settings: FitSettings) {
  if (settings.model !== "fourier") return "";
  const fourier = settings.fourier!;
  return `double fourier_phase(double x) {
  double cycles=std::fmod(x, ${number(fourier.period)})/${number(fourier.period)}
    -std::fmod(${number(fourier.origin)}, ${number(fourier.period)})/${number(fourier.period)};
  cycles-=std::nearbyint(cycles);
  return 2*TMath::Pi()*cycles;
}
`;
}

/** ROOT macro for the bundle's external CSV input. */
export function generateRootCode(description: CodeExportDescription) {
  const { settings, knownSigma } = description;
  const names = parameterNames(
    settings.model,
    settings.custom,
    settings.fourier,
  );
  const bounds = parameterBounds(settings);
  const free = settings.parameters.filter((p) => !p.fixed).length;
  const setup = settings.parameters
    .map((p, i) => {
      let line = `  model.SetParName(${i}, ${cppString(names[i])});\n  model.${p.fixed ? "FixParameter" : "SetParameter"}(${i}, ${number(p.value)});`;
      if (!p.fixed && (bounds[i].lower !== null || bounds[i].upper !== null))
        line += `\n  model.SetParLimits(${i}, ${bounds[i].lowerExclusive ? "std::nextafter(0.0, 1.0)" : number(bounds[i].lower!)}, ${bounds[i].upper === null ? "std::numeric_limits<double>::infinity()" : number(bounds[i].upper!)});`;
      return line;
    })
    .join("\n");
  const curveSampling =
    settings.model === "fourier"
      ? `  const double effective_cycles=(model.GetXmax()-model.GetXmin())*${settings.fourier!.harmonics}/${number(settings.fourier!.period)};
  if (!std::isfinite(effective_cycles) || effective_cycles<0 || effective_cycles>800)
    throw std::runtime_error("Refusing to plot more than 800 effective Fourier cycles");
  int curve_points=static_cast<int>(std::ceil(effective_cycles*40))+1;
  if (curve_points<160) curve_points=160;
  model.SetNpx(curve_points);`
      : "  model.SetNpx(800);";
  return `// Run: root -l fit_root.C. See README.md for assumptions and data columns.
#include <TF1.h>
#include <TFitResult.h>
#include <TGraphErrors.h>
#include <TCanvas.h>
#include <TMath.h>
#include <Math/MinimizerOptions.h>
#include <cmath>
#include <limits>
#include <iostream>
#include <iomanip>
#include <stdexcept>
${settings.model === "gaussian-shape" ? "\ndouble gaussian_peak(double x, const double *p);\n" : ""}
${rootSeriesHelper(settings)}
${rootFourierHelper(settings)}
// Parameter order: ${names.join(", ")}
double model_function(double *xx, double *p) {
  const double x = xx[0];
  return ${rootExpression(settings)};
}
${settings.model === "gaussian-shape" ? rootPeakModelHelpers : ""}
TGraphErrors load_data(const char *filename) {
  TGraphErrors data(filename, "${knownSigma ? "%lg,%lg,%lg" : "%lg,%lg"}");  // ${knownSigma ? "x, y, sigma_y" : "x, y; equal weights"}
  if (data.GetN() == 0) throw std::runtime_error("No observations loaded");
  for (int i=0; i<data.GetN(); ++i)
    if (!std::isfinite(data.GetX()[i]) || !std::isfinite(data.GetY()[i])${knownSigma ? " || !std::isfinite(data.GetErrorY(i)) || data.GetErrorY(i)<=0" : ""})
      throw std::runtime_error("Expected finite observations${knownSigma ? " and positive y uncertainties" : ""}");
  return data;
}

TF1 load_model(const TGraphErrors &data) {
  double xmin=TMath::MinElement(data.GetN(), data.GetX());
  double xmax=TMath::MaxElement(data.GetN(), data.GetX());
  if (xmin==xmax) { xmin-=0.5; xmax+=0.5; }
  TF1 model("fitted_model", model_function, xmin, xmax, ${names.length});
${setup}
  return model;
}

TFitResultPtr fit_data(TGraphErrors &data, TF1 &model) {
${
  free
    ? `  if (data.GetN() < ${free}) throw std::runtime_error("Fewer observations than free parameters");
  ROOT::Math::MinimizerOptions::SetDefaultTolerance(1e-6);
  ROOT::Math::MinimizerOptions::SetDefaultMaxFunctionCalls(200000);
  // ${knownSigma ? "Fit with the supplied absolute y uncertainties (weights = 1/sigma_y^2)." : "Equal weights; ROOT scales covariance by residual SSE / (n - free parameters)."}
  auto result=data.Fit(&model, "SNQ");  // Return result, draw separately, quiet.
  if (int(result)!=0 || !result.Get() || !result->IsValid() || result->CovMatrixStatus()!=3)
    throw std::runtime_error("Fit failed or covariance is rank deficient");
  return result;`
    : `  // All parameters are fixed; evaluate without optimization.
  return TFitResultPtr();`
}
}

void report_fit(const TGraphErrors &data, TF1 &model, const TFitResultPtr &result) {
  double sum=0;
  for (int i=0; i<data.GetN(); ++i) {
    const double r=(data.GetY()[i]-model.Eval(data.GetX()[i]))${knownSigma ? "/data.GetErrorY(i)" : ""};
    sum+=r*r;
  }
  if (!std::isfinite(sum)) throw std::runtime_error("Fit produced non-finite residuals");
  const int df=data.GetN()-${free};
  std::cout<<std::setprecision(17)<<"${knownSigma ? (description.inference === "descriptive" ? "Weighted residual sum" : "chi2") : "SSE"} = "<<sum<<"; df = "<<df<<"\\n";
  const bool errors_available=${description.inference === "descriptive" ? "false" : "true"}${knownSigma ? "" : " && df>0 && sum>0"};
  const bool fixed[]={${settings.parameters.map((p) => p.fixed).join(", ")}};
  for (int i=0; i<model.GetNpar(); ++i) {
    std::cout<<model.GetParName(i)<<" = "<<model.GetParameter(i);
    if (fixed[i]) std::cout<<" (fixed)\\n";
    else if (errors_available) std::cout<<" (SE="<<result->ParError(i)<<")\\n";
    else std::cout<<" (SE=unavailable)\\n";
  }
}

void plot_fit(TGraphErrors &data, TF1 &model) {
  auto canvas=new TCanvas("fit_canvas", "Fit", 800, 600);
  data.SetTitle(${cppString(";" + axisLabel(description.xLabel, description.xUnit) + ";" + axisLabel(description.yLabel, description.yUnit))});
  data.SetMarkerStyle(20);
  data.DrawClone("AP");
  model.SetLineColor(kRed);
${curveSampling}
  model.DrawClone("same");
  canvas->SaveAs(${cppString(description.fileStem + "-root.pdf")});
}

void fit_root(const char *filename="data.csv") {
  auto data=load_data(filename);
  auto model=load_model(data);
  auto result=fit_data(data, model);
  report_fit(data, model, result);
  plot_fit(data, model);
}
`;
}

export function generateCodeExportReadme(
  description: CodeExportDescription,
  target: CodeExportTarget = "both",
) {
  return `# Data Tool 2027 analysis bundle

Start with ${target === "root" ? "fit_root.C" : "fit_scipy.py"}. The equation is the first
function, followed by data loading, model setup, fitting, reporting and plotting.
Edit the equation and starting/fixed parameters directly in that file.

${
  target !== "root"
    ? `## Python / SciPy

Install the libraries, then run from this directory:

\`\`\`sh
python3 -m pip install -r requirements.txt
python3 fit_scipy.py
\`\`\`

The script displays the plot and saves ${description.fileStem}-scipy.png.
Importing it only defines functions. For another compatible file, call
\`load_data("another-run.csv")\` or change the filename in main().
Use \`MPLBACKEND=Agg python3 fit_scipy.py\` for a headless run.

`
    : ""
}${
    target !== "scipy"
      ? `## C++ / ROOT

With ROOT installed, run from this directory:

\`\`\`sh
root -l fit_root.C
\`\`\`

The graph stays open; quit ROOT with .q. The macro also saves
${description.fileStem}-root.pdf. Use \`root -l -b -q fit_root.C\` for batch output.
For another compatible file: \`root -l 'fit_root.C("another-run.csv")'\`.

`
      : ""
  }## Data and assumptions

- data.csv contains only the selected, finite observations, in original order.
  Its numeric columns are ${description.knownSigma ? "x, y, sigma_y" : "x, y"}. Every numeric row is fitted.
- observations.csv preserves row labels, stable identities, inclusion flags,
  supplied uncertainties and missing-value reasons for the complete record.
- Both CSVs preserve source comments as leading # lines. Units are in the
  data.csv comments and analysis.json.
- analysis.json records the original model, starts, fixed flags, selected row IDs,
  assumptions, display settings and Data Tool coefficients. It is reference
  material; the programs read their settings from source code.

${description.knownSigma ? "Supplied y uncertainties are absolute: fitting weights are 1/sigma_y^2, and the\ncovariance is not rescaled to force reduced chi-square to one." : "Fitting uses equal weights. Parameter covariance is scaled using the residual\nvariance SSE/(n - free parameters); no measurement error bars are invented."}
Inference in this export is ${description.inference}. Parameter standard errors
are unavailable when the assumptions are unsupported or residual scatter cannot
be estimated. Fixed parameters are labeled fixed.

The plot is a basic view of the selected data, supplied error bars and fitted
curve. Use the application's report and figure exports for residual panels,
fit guides, derived quantities and the full diagnostics. A Gaussian shape model
includes the additional mathematics needed to evaluate its skew and tail shape.

Nonlinear fits use local optimizers; starting values, stopping rules and library
versions can affect the result. SciPy uses a local Jacobian covariance; ROOT uses
the objective's local curvature. Neither gives exact nonlinear coverage.

The numeric reader assumes the documented exported layout. Keep headers as #
comments and supply exactly the listed columns when adapting data. The ROOT
library reader can skip malformed lines; check the reported df after editing.

Methods: [SciPy curve_fit](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.curve_fit.html),
[ROOT TGraphErrors](https://root.cern.ch/doc/master/classTGraphErrors.html),
[ROOT fit conventions](https://root.cern.ch/doc/master/HFitImpl_8cxx_source.html).
The fuller reference generator remains in scripts/reference/fullCodeExport.ts
in the Data Tool repository for inspection and validation.
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
      "observations.csv": generateObservationArchiveCsv(description),
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
