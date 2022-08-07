import fs from "fs-extra";
import path from "path";
import child_process from "child_process";
import util from "util";
import { temporaryDirectoryTask } from "tempy";

const VERSION_EXPIRE_TIME = 30 * 24 * 60 * 60 * 1000; // 1 month

const packageName = process.argv[2];
const destDir = process.argv[3];

async function fetchVersionList() {
  const versionsOutput: Record<string, string> = JSON.parse(child_process.execSync(`npm view ${packageName} time --json`).toString());
  delete versionsOutput["created"];
  delete versionsOutput["modified"];

  const versions = Object.entries(versionsOutput)
    .sort(([, date1], [, date2]) => Date.parse(date2) - Date.parse(date1))
    .filter(([, date]) => Date.now() - Date.parse(date) < VERSION_EXPIRE_TIME)
    .map(([version]) => version);
  ``
  return versions;
}

async function downloadVersion(version: string) {
  await temporaryDirectoryTask(async tempDir => {
    try {
      await util.promisify(child_process.exec)(`npm install ${packageName}@${version} --ignore-scripts`, {
        cwd: tempDir
      });
    } catch (e) {
      console.log(e);
    }

    const packageDir = path.join(tempDir, "node_modules", ...packageName.split("/"), "dist");
    fs.readdirSync(packageDir).forEach(filename => {
      if (filename === "index.html") return;

      fs.copySync(path.join(packageDir, filename), path.join(destDir, filename), { recursive: true, overwrite: false });
    });
  });
}

const versions = await fetchVersionList();
console.log("Versions:", versions);

fs.ensureDirSync(destDir);
fs.emptyDirSync(destDir);
for (const version of versions) {
  console.log("Downloading version:", version);
  await downloadVersion(version);
}
