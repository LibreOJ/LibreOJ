import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const native = require("../../build/Release/builtin_checkers.node");

const workingDirectory = await mkdtemp(join(tmpdir(), "libreoj-builtin-checker-"));

try {
  const outputFile = join(workingDirectory, "output.txt");
  const answerFile = join(workingDirectory, "answer.txt");
  await Promise.all([writeFile(outputFile, "1 2 3\n"), writeFile(answerFile, "1 2 3\n")]);

  const message = await new Promise((resolve, reject) => {
    native.runBuiltinChecker(outputFile, answerFile, { type: "integers" }, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });

  assert.equal(message, 'ok 3 number(s): "1 2 3"\n');
} finally {
  await rm(workingDirectory, { recursive: true });
}
