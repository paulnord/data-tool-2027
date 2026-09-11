import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, posix, relative, sep } from "node:path";
import { zipSync } from "fflate";

// Ordinary files for downloading and opening with the browser's file chooser.
// Preserve nested folders such as examples/data/published/ in the archive.
const files = {};
const root = "examples/data";

async function addDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await addDirectory(path);
      continue;
    }
    if (!entry.isFile()) continue;
    const rel = relative(root, path).split(sep).join(posix.sep);
    files[`Data Tool examples/${rel}`] = new Uint8Array(await readFile(path));
  }
}

await addDirectory(root);
await writeFile("dist/examples.zip", zipSync(files));
await writeFile("dist/.nojekyll", "");
