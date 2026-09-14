import { strToU8, zipSync } from "fflate";
import type { CodeExportBundle } from "../core/fit/codeExport";

/** Encode text artifacts under one safe containing directory. */
export function encodeCodeExportBundle(bundle: CodeExportBundle) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(bundle.directoryName))
    throw new Error("Analysis bundle directory name is invalid.");
  return zipSync(
    Object.fromEntries(
      Object.entries(bundle.files).map(([name, contents]) => {
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name))
          throw new Error("Analysis bundle contains an invalid filename.");
        return [`${bundle.directoryName}/${name}`, strToU8(contents)];
      }),
    ),
    { level: 6 },
  );
}
