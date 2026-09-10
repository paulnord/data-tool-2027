import { readFile, readdir, writeFile } from "node:fs/promises";
import { zipSync } from "fflate";
// Ordinary files for downloading and opening with the browser's file chooser.
const files = {};
for (const name of (await readdir("examples/data")).sort())
  files[`Data Tool examples/${name}`] = new Uint8Array(
    await readFile(`examples/data/${name}`),
  );
await writeFile("dist/examples.zip", zipSync(files));
await writeFile("dist/.nojekyll", "");
