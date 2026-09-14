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
  "examples/fit/custom-session-v3.trksess",
  "examples/fit/nonlinear-session-v2.trksess",
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
    request.dataset.xColumn.label = 'Time "sample"';
    request.dataset.xColumn.unit = "s\\sample";
    request.dataset.rows[0].id = 'row,"quoted"\nnext';
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
const rootProbe = spawnSync("root", ["--version"], { encoding: "utf8" });
const hasRoot = !rootProbe.error;
if (!hasRoot && (rootProbe.error as NodeJS.ErrnoException).code !== "ENOENT")
  throw rootProbe.error;
if (!hasRoot)
  console.log("ROOT is not installed; actual macro checks skipped.");
function expectFailure(command: string, args: string[], pattern: RegExp) {
  const result = spawnSync(command, args, {
    cwd: directory,
    env: { ...process.env, MPLBACKEND: "Agg" },
    encoding: "utf8",
    timeout: 60000,
  });
  if (result.error) throw result.error;
  if (result.status === 0 || !pattern.test(result.stdout + result.stderr))
    throw Error(
      `Expected rejection matching ${pattern}: ${result.stdout}\n${result.stderr}`,
    );
}
let complete = false;
try {
  for (const { input, session, unavailable } of scenarios) {
    const result = fit(session.request, session.settings);
    const usedX = result.residuals.map((row) => row.x);
    const xRange: [number, number] = [Math.min(...usedX), Math.max(...usedX)];
    if (xRange[0] === xRange[1]) {
      xRange[0] -= 1;
      xRange[1] += 1;
    }
    const description = buildCodeExportDescription(
      session.request,
      session.settings,
      result,
      {
        mode: "linear",
        xRange,
        yRange: null,
        showResiduals: true,
        showErrorBars: true,
        showGuides: true,
      },
    );
    const bundle = generateCodeExportBundle(description);
    const archived = unzipSync(encodeCodeExportBundle(bundle));
    const prefix = `${bundle.directoryName}/`;
    for (const [path, contents] of Object.entries(archived)) {
      if (!path.startsWith(prefix))
        throw Error(`archive entry escaped its directory: ${path}`);
      writeFileSync(join(directory, path.slice(prefix.length)), contents);
    }
    const pythonName = "fit_scipy.py";
    const output = execFileSync("python3", [pythonName], {
      cwd: directory,
      env: { ...process.env, MPLBACKEND: "Agg" },
      encoding: "utf8",
    });
    process.stdout.write(output);
    const difference = output.match(
      /maximum absolute coefficient difference:\s*([\d.eE+-]+)/,
    );
    if (!difference) throw Error(`${pythonName} did not report a comparison`);
    const tolerance =
      input.includes("dyfeo3") ||
      ["decay", "lorentzian", "power"].includes(input)
        ? 1e-3
        : 1e-6;
    if (!(Number(difference[1]) <= tolerance))
      throw Error(`${pythonName} exceeded coefficient tolerance ${tolerance}`);
    if (unavailable && !output.includes("SE=unavailable"))
      throw Error(`${input}: Python invented standard errors`);
    const image = join(directory, `${description.fileStem}-scipy.png`);
    if (!existsSync(image) || statSync(image).size === 0)
      throw Error(`${pythonName} did not create its plotted PNG`);
    execFileSync("python3", ["-m", "py_compile", pythonName], {
      cwd: directory,
    });

    if (hasRoot) {
      const rootOutput = execFileSync(
        "root",
        ["-l", "-b", "-q", "fit_root.C"],
        { cwd: directory, encoding: "utf8", timeout: 60000 },
      );
      process.stdout.write(rootOutput);
      const delta = Number(
        rootOutput.match(
          /max coefficient difference from Data Tool =\s*([\d.eE+-]+)/,
        )?.[1],
      );
      if (!(delta <= tolerance))
        throw Error(
          `${input}: ROOT coefficient difference ${delta} exceeds ${tolerance}`,
        );
      const covariance = session.settings.parameters.some((p) => !p.fixed)
        ? "3"
        : "[0-3]";
      if (
        !new RegExp(`fit status = 0; covariance status = ${covariance}`).test(
          rootOutput,
        )
      )
        throw Error(`${input}: invalid ROOT fit status`);
      if (unavailable && !rootOutput.includes("SE=unavailable"))
        throw Error(`${input}: ROOT invented standard errors`);
      for (const extension of ["pdf", "root"]) {
        const path = join(
          directory,
          `${description.fileStem}-root.${extension}`,
        );
        if (!existsSync(path) || statSync(path).size === 0)
          throw Error(`${input}: ROOT did not create ${extension}`);
      }
    }

    if (input === inputs[0]) {
      const alternate = join(directory, "alternate.csv");
      const alternateImage = join(directory, "alternate.png");
      writeFileSync(alternate, bundle.files["data.csv"]);
      const alternateOutput = execFileSync(
        "python3",
        [pythonName, "--data", alternate, "--output", alternateImage],
        {
          cwd: directory,
          env: { ...process.env, MPLBACKEND: "Agg" },
          encoding: "utf8",
        },
      );
      if (!alternateOutput.includes("comparison omitted for alternate inputs"))
        throw Error(
          "alternate CSV did not suppress the stored-result comparison",
        );
      if (!existsSync(alternateImage) || statSync(alternateImage).size === 0)
        throw Error("alternate CSV did not create its requested PNG");
      if (hasRoot) {
        const alternateRoot = execFileSync(
          "root",
          ["-l", "-b", "-q", 'fit_root.C("alternate.csv","alternate")'],
          { cwd: directory, encoding: "utf8" },
        );
        if (!alternateRoot.includes("comparison omitted for alternate inputs"))
          throw Error("alternate ROOT CSV claimed a reference comparison");
      }
      const original = JSON.parse(bundle.files["analysis.json"]);
      const model = structuredClone(original);
      model.fit.model = "quadratic";
      const reordered = structuredClone(original);
      reordered.fit.parameters.reverse();
      for (const [i, metadata] of [model, reordered].entries()) {
        const name = `incompatible-${i}.json`;
        writeFileSync(join(directory, name), JSON.stringify(metadata));
        expectFailure(
          "python3",
          [pythonName, "--analysis", name],
          /do not match this generated program/,
        );
      }
      writeFileSync(
        join(directory, "malformed.csv"),
        "row_id,x,y,sigma,included,missing_reason\nrow,1,2,.1,true,,extra\n",
      );
      expectFailure(
        "python3",
        [pythonName, "--data", "malformed.csv"],
        /wrong number of fields/i,
      );
      if (hasRoot)
        expectFailure(
          "root",
          ["-l", "-b", "-q", 'fit_root.C("malformed.csv","malformed")'],
          /Wrong number of fields/,
        );
      writeFileSync(
        join(directory, "short.csv"),
        "row_id,x,y,sigma,included,missing_reason\nrow,1,2,.1,true,\n",
      );
      if (hasRoot) {
        expectFailure(
          "root",
          ["-l", "-b", "-q", 'fit_root.C("short.csv","failed")'],
          /Fewer observations than free parameters/,
        );
        if (
          existsSync(join(directory, "failed.pdf")) ||
          existsSync(join(directory, "failed.root"))
        )
          throw Error("Failed ROOT fit wrote success artifacts");
      }
    }
  }

  const rootName = "fit_root.C";
  const rootSource = readFileSync(join(directory, rootName), "utf8");
  const helperStart = rootSource.indexOf("bool data_tool_csv_record");
  const helperEnd = rootSource.indexOf("void fit_root");
  if (helperStart < 0 || helperEnd <= helperStart)
    throw Error("ROOT CSV reader was not generated");
  const parserSource = `#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>
${rootSource.slice(helperStart, helperEnd)}
int main(int argc, char **argv) {
  if (argc != 2) return 2;
  std::ifstream input(argv[1], std::ios::binary);
  std::vector<std::string> fields;
  if (!data_tool_csv_record(input, fields) || fields.size() != 6) return 3;
  if (!data_tool_csv_record(input, fields) || fields.size() != 6) return 4;
  if (fields[0].find("quoted") == std::string::npos || fields[0].find('\\n') == std::string::npos) return 5;
  if (data_tool_csv_record(input, fields)) return 6;
  return 0;
}
`;
  const parserName = join(directory, "root-csv-reader.cpp");
  const parserBinary = join(directory, "root-csv-reader");
  const parserCsv = join(directory, "root-csv-reader.csv");
  writeFileSync(parserName, parserSource);
  writeFileSync(
    parserCsv,
    'row_id,x,y,sigma,included,missing_reason\r\n"row,""quoted""\r\nnext",1,2,,true,\r\n',
  );
  try {
    execFileSync("c++", ["-std=c++17", parserName, "-o", parserBinary]);
    execFileSync(parserBinary, [parserCsv]);
  } catch (cause) {
    const missing =
      cause instanceof Error && "code" in cause && cause.code === "ENOENT";
    if (!missing) throw cause;
    console.log(
      "A C++ compiler is not installed; ROOT CSV reader check skipped.",
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
