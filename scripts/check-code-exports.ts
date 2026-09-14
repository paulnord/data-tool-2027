import { execFileSync } from "node:child_process";
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
import { sessionSchema } from "../src/core/fit/schema";
import { fit } from "../src/core/fit/solve";

const inputs = [
  "examples/data/ball-toss.trksess",
  "examples/fit/equal-weights-comparison.trksess",
  "examples/fit/custom-session-v3.trksess",
  "examples/fit/nonlinear-session-v2.trksess",
  "examples/data/published/dyfeo3-spin-wave.trksess",
];
const directory = mkdtempSync(join(tmpdir(), "data-tool-code-export-"));
try {
  let rootDescription: ReturnType<typeof buildCodeExportDescription> | null =
    null;
  for (const input of inputs) {
    const session = sessionSchema.parse(
      JSON.parse(readFileSync(input, "utf8")),
    );
    const result = fit(session.request, session.settings);
    const usedX = result.residuals.map((row) => row.x);
    const xRange: [number, number] = [Math.min(...usedX), Math.max(...usedX)];
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
    rootDescription = description;
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
    const tolerance = input.includes("dyfeo3") ? 1e-3 : 1e-6;
    if (!(Number(difference[1]) <= tolerance))
      throw Error(`${pythonName} exceeded coefficient tolerance ${tolerance}`);
    const image = join(directory, `${description.fileStem}-scipy.png`);
    if (!existsSync(image) || statSync(image).size === 0)
      throw Error(`${pythonName} did not create its plotted PNG`);
    execFileSync("python3", ["-m", "py_compile", pythonName], {
      cwd: directory,
    });

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

  try {
    execFileSync("root", ["-l", "-b", "-q", rootName], {
      cwd: directory,
      stdio: "inherit",
    });
    for (const extension of ["pdf", "root"]) {
      const output = join(
        directory,
        `${rootDescription!.fileStem}-root.${extension}`,
      );
      if (!existsSync(output) || statSync(output).size === 0)
        throw Error(`${rootName} did not create ${output}`);
    }
  } catch (cause) {
    const missing =
      cause instanceof Error && "code" in cause && cause.code === "ENOENT";
    if (!missing) throw cause;
    console.log("ROOT is not installed; macro execution skipped.");
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
