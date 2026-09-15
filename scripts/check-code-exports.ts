import extendedReference from "../tests/fit/extended-model-reference.json";
import peakReference from "../tests/fit/peak-shape-reference.json";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import {
  buildCodeExportDescription,
  generateCodeExportBundle,
} from "../src/core/fit/codeExport";
import { encodeCodeExportBundle } from "../src/fit/codeExportArchive";
import {
  parameterNames,
  initialSettings,
  sessionSchema,
  type FitRequest,
  type FitSettings,
} from "../src/core/fit/schema";
import { fit } from "../src/core/fit/solve";
import { syntheticRequest } from "../tests/support/synthetic";

const inputs = [
  "examples/data/ball-toss.trksess",
  "examples/fit/equal-weights-comparison.trksess",
  "examples/fit/custom-session.trksess",
  "examples/fit/nonlinear-session.trksess",
  "examples/data/published/dyfeo3-spin-wave.trksess",
];
const directory = mkdtempSync(join(tmpdir(), "data-tool-code-export-"));
const scenarios: {
  input: string;
  session: { request: FitRequest; settings: FitSettings };
  unavailable?: boolean;
}[] = inputs.map((input) => ({
  input,
  session: sessionSchema.parse(JSON.parse(readFileSync(input, "utf8"))),
}));
for (const name of [
  "literal-division",
  "constant",
  "constant-fixed",
  "zero-scatter",
  "zero-df",
  "quoted-label",
  "descriptive",
]) {
  const request = syntheticRequest(),
    settings = initialSettings("custom");
  settings.custom = {
    expression: "b",
    variable: "x",
    names: ["b"],
    units: ["m"],
  };
  settings.parameters = [{ value: 0, fixed: name === "constant-fixed" }];
  request.dataset.rows.forEach((row, i) => {
    row.y = 2 + 0.01 * Math.sin(i);
  });
  if (name === "literal-division") {
    settings.custom = {
      expression: "b+(1/2)*a*x",
      variable: "x",
      names: ["b", "a"],
      units: ["m", "m/s"],
    };
    settings.parameters.push({ value: 2, fixed: true });
    request.dataset.rows.forEach((row) => {
      row.y = 2 + row.x!;
    });
  }
  if (name === "zero-scatter" || name === "zero-df") {
    settings.custom.expression = "b+0*x";
    request.dataset.rows.forEach((row) => {
      row.y = 0;
    });
    request.uncertainty = {
      kind: "unknown-equal",
      errorStructure: "uncorrelated",
    };
    if (name === "zero-df")
      request.dataset.rows = request.dataset.rows.slice(0, 1);
  }
  if (name === "quoted-label") {
    request.source.context =
      'Comments: "quoted", mH\r\n# extra line\n\nlast line';
    request.dataset.xColumn.label = 'Time "sample"';
    request.dataset.xColumn.unit = "s\\sample";
    request.dataset.rows[0].id = 'row,"quoted"\n# next';
  }
  scenarios.push({
    input: name,
    session: { request, settings },
    unavailable: name.startsWith("zero-"),
  });
}
for (const [name, model, parameters, signal] of [
  [
    "decay",
    "exponential-decay",
    [0.5, 2, 1],
    (x: number) => 1 + 3 * Math.exp(-x / 2),
  ],
  [
    "lorentzian",
    "lorentzian",
    [0.2, 2, 3, 1],
    (x: number) => 0.4 + 3 / (1 + ((x - 3) / 1.2) ** 2),
  ],
  [
    "power",
    "power-law-free",
    [0.2, 2, 1.2],
    (x: number) => 0.3 + 1.7 * x ** 1.3,
  ],
] as const) {
  const request = syntheticRequest(),
    settings = initialSettings(model);
  request.dataset.rows.forEach((row, i) => {
    row.x = 0.2 + i / 10;
    row.y = signal(row.x) + 0.01 * Math.sin(i * 1.7);
  });
  settings.parameters = parameters.map((value) => ({ value, fixed: false }));
  scenarios.push({ input: name, session: { request, settings } });
}
for (const fixture of extendedReference.fixtures) {
  const request = syntheticRequest(),
    settings = initialSettings(fixture.model as FitSettings["model"]);
  request.dataset.rows = fixture.x.map((x, i) => ({
    id: String(i),
    x,
    y: fixture.y[i],
    included: true,
    missingReason: null,
  }));
  settings.parameters = fixture.start.map((value) => ({ value, fixed: false }));
  scenarios.push({ input: fixture.model, session: { request, settings } });
}
for (const fixture of peakReference.cases) {
  const request = syntheticRequest(),
    settings = initialSettings("gaussian-shape");
  request.dataset.rows = fixture.x.map((x, i) => ({
    id: String(i),
    x,
    y: fixture.y[i],
    included: true,
    missingReason: null,
  }));
  request.uncertainty = {
    kind: "supplied-common",
    errorStructure: "uncorrelated",
    sigmaY: fixture.sigma,
    provenance: {
      kind: "user-asserted",
      description: "Independent peak reference",
    },
  };
  settings.parameters = fixture.start.map((value, i) => ({
    value,
    fixed: fixture.fixed.includes(i),
  }));
  scenarios.push({
    input: `peak-shape-${fixture.name}`,
    session: { request, settings },
  });
}

for (const kind of ["supplied-per-row", "unknown-equal"] as const) {
  const request = syntheticRequest(),
    settings = initialSettings("line");
  request.dataset.rows.forEach((row, i) => {
    row.y = 1.4 + 2.1 * row.x! + 0.03 * Math.sin(i);
  });
  request.dataset.rows[0].included = false;
  settings.excludedIds = [request.dataset.rows[2].id];
  request.uncertainty =
    kind === "unknown-equal"
      ? { kind, errorStructure: "uncorrelated" }
      : {
          kind,
          errorStructure: "uncorrelated",
          sigmaByRow: Object.fromEntries(
            request.dataset.rows.map((r, i) => [r.id, 0.02 + i / 200]),
          ),
          provenance: { kind: "user-asserted", description: "Export check" },
        };
  scenarios.push({ input: `linear-${kind}`, session: { request, settings } });
}
const reserved = syntheticRequest(),
  reservedSettings = initialSettings("custom");
reservedSettings.custom = {
  expression: "lambda+np*x",
  variable: "x",
  names: ["lambda", "np"],
  units: ["m", "m/s"],
};
reservedSettings.parameters = [
  { value: 1, fixed: false },
  { value: 2, fixed: false },
];
reserved.dataset.rows.forEach((r, i) => {
  r.y = 1 + 2 * r.x! + 0.01 * Math.sin(i);
});
scenarios.push({
  input: "reserved-parameter-names",
  session: { request: reserved, settings: reservedSettings },
});

const rootProbe = spawnSync("root", ["--version"], { encoding: "utf8" });
const hasRoot = !rootProbe.error;
if (!hasRoot && (rootProbe.error as NodeJS.ErrnoException).code !== "ENOENT")
  throw rootProbe.error;
if (!hasRoot)
  console.log("ROOT is not installed; actual macro checks skipped.");
const environment = { ...process.env, MPLBACKEND: "Agg" };
let complete = false;
try {
  for (const { input, session, unavailable } of scenarios) {
    const result = fit(session.request, session.settings);
    const usedX = result.residuals.map((r) => r.x);
    const description = buildCodeExportDescription(
      session.request,
      session.settings,
      result,
      {
        mode: "linear",
        xRange: [Math.min(...usedX), Math.max(...usedX)],
        yRange: null,
        showResiduals: true,
        showErrorBars: true,
        showGuides: true,
      },
    );
    if (input === "descriptive") description.inference = "descriptive";
    const bundle = generateCodeExportBundle(description);
    const archived = unzipSync(encodeCodeExportBundle(bundle));
    const prefix = `${bundle.directoryName}/`;
    for (const [path, contents] of Object.entries(archived)) {
      if (!path.startsWith(prefix))
        throw Error(`Archive path escaped: ${path}`);
      writeFileSync(join(directory, path.slice(prefix.length)), contents);
    }
    const numericRows = bundle.files["data.csv"]
      .trim()
      .split(/\r?\n/)
      .filter((l) => !l.startsWith("#"))
      .map((l) => l.split(",").map(Number));
    if (
      numericRows.length !== result.n ||
      numericRows.some(
        (r, i) =>
          r[0] !== result.residuals[i].x || r[1] !== result.residuals[i].y,
      )
    )
      throw Error(`${input}: selected observations changed`);
    const expected = description.knownSigma
      ? result.weightedObjective.value!
      : result.sse;
    const names = parameterNames(
      session.settings.model,
      session.settings.custom,
    );
    function checkFit(output: string, language: string) {
      const statistic = output.match(
        /(?:chi2|SSE|Weighted residual sum) =\s*([\d.eE+-]+)\s*; df =\s*(\d+)/,
      );
      if (
        !statistic ||
        Number(statistic[2]) !== result.df ||
        Math.abs(Number(statistic[1]) - expected) >
          2e-6 * (1 + Math.abs(expected))
      )
        throw Error(`${input}: ${language} objective/df changed\n${output}`);
      const tolerance =
        input.includes("dyfeo3") ||
        ["decay", "lorentzian", "power"].includes(input)
          ? 1e-3
          : 1e-6;
      names.forEach((name, i) => {
        const line = output.split("\n").find((l) => l.startsWith(`${name} = `));
        const coefficient = Number(line?.split(" = ")[1].split(" (")[0]);
        if (
          !Number.isFinite(coefficient) ||
          Math.abs(coefficient - result.coefficients[i]) > tolerance
        )
          throw Error(
            `${input}: ${language} ${name} = ${coefficient}, expected ${result.coefficients[i]}`,
          );
        if (session.settings.parameters[i].fixed && !line?.includes("(fixed)"))
          throw Error(`${input}: fixed flag lost`);
        if (
          !session.settings.parameters[i].fixed &&
          (unavailable || input === "descriptive") &&
          !line?.includes("SE=unavailable")
        )
          throw Error(`${input}: invented ${language} uncertainty`);
        if (
          input.startsWith("linear-") &&
          result.standardErrors[i].value !== null
        ) {
          const se = Number(line?.match(/SE=([\d.eE+-]+)/)?.[1]);
          if (
            !Number.isFinite(se) ||
            Math.abs(se - result.standardErrors[i].value!) >
              1e-4 * result.standardErrors[i].value!
          )
            throw Error(`${input}: ${language} covariance scale changed`);
        }
      });
    }
    const output = execFileSync("python3", ["fit_scipy.py"], {
      cwd: directory,
      env: environment,
      encoding: "utf8",
      timeout: 60000,
    });
    checkFit(output, "SciPy");
    const image = join(directory, `${description.fileStem}-scipy.png`);
    if (!existsSync(image) || statSync(image).size === 0)
      throw Error(`${input}: missing SciPy PNG`);
    execFileSync("python3", ["-m", "py_compile", "fit_scipy.py"], {
      cwd: directory,
    });
    if (hasRoot) {
      const rootOutput = execFileSync(
        "root",
        ["-l", "-b", "-q", "fit_root.C"],
        { cwd: directory, encoding: "utf8", timeout: 60000 },
      );
      checkFit(rootOutput, "ROOT");
      const pdf = join(directory, `${description.fileStem}-root.pdf`);
      if (!existsSync(pdf) || statSync(pdf).size === 0)
        throw Error(`${input}: missing ROOT PDF`);
    }
    if (input === inputs[0]) {
      const imported = execFileSync(
        "python3",
        ["-c", "import fit_scipy; print('imported without running')"],
        { cwd: directory, env: environment, encoding: "utf8" },
      );
      if (imported.trim() !== "imported without running")
        throw Error("Importing source ran analysis");
      writeFileSync(join(directory, "alternate.csv"), bundle.files["data.csv"]);
      execFileSync(
        "python3",
        [
          "-c",
          "from fit_scipy import *; data=load_data('alternate.csv'); fit_data(*data)",
        ],
        { cwd: directory, env: environment },
      );
      if (hasRoot)
        checkFit(
          execFileSync(
            "root",
            ["-l", "-b", "-q", 'fit_root.C("alternate.csv")'],
            { cwd: directory, encoding: "utf8" },
          ),
          "alternate ROOT",
        );
      writeFileSync(join(directory, "invalid.csv"), "1,2,-0.1\n");
      const invalid = spawnSync(
        "python3",
        ["-c", "from fit_scipy import load_data; load_data('invalid.csv')"],
        { cwd: directory, env: environment, encoding: "utf8" },
      );
      if (invalid.status === 0 || !/positive/.test(invalid.stderr))
        throw Error("Invalid uncertainty accepted");
    }
    console.log(
      `PASS ${input}: selected observations, coefficients, objective and df${hasRoot ? " (SciPy and ROOT)" : " (SciPy)"}`,
    );
  }
  complete = true;
  console.log(
    `${scenarios.length} executable export cases passed${hasRoot ? " with actual ROOT" : " (ROOT unavailable)"}.`,
  );
} finally {
  if (complete) rmSync(directory, { recursive: true, force: true });
  else console.error(`Failed export evidence retained in ${directory}`);
}
