import crypto from "node:crypto";
import fs from "fs-extra";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const frontendIndex = require.resolve("@libreoj/frontend/index.html");
const frontendDirectory = path.dirname(frontendIndex);
const outputDirectory = path.resolve("dist");

fs.emptyDirSync(outputDirectory);

for (const entry of fs.readdirSync(frontendDirectory)) {
  if (entry === "index.html") continue;
  fs.copySync(path.join(frontendDirectory, entry), path.join(outputDirectory, entry));
}

const collectFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(absolutePath) : [absolutePath];
  });

const files = collectFiles(outputDirectory)
  .map(absolutePath => ({
    path: path.relative(outputDirectory, absolutePath),
    size: fs.statSync(absolutePath).size,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex")
  }))
  .sort((a, b) => a.path.localeCompare(b.path));

fs.writeJsonSync(path.join(outputDirectory, "manifest.json"), { files }, { spaces: 2 });
