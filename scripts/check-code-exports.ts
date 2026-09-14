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
import {
  buildCodeExportDescription,
  codeExportFileName,
  generatePythonCode,
  generateRootCode,
} from "../src/core/fit/codeExport";
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
    rootDescription ??= description;
    const pythonName = codeExportFileName(description, "python");
    writeFileSync(join(directory, pythonName), generatePythonCode(description));
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
  }

  const rootName = codeExportFileName(rootDescription!, "root");
  writeFileSync(join(directory, rootName), generateRootCode(rootDescription!));
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
