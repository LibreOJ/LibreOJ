import fs from "fs-extra";
import path from "path";

import packageJson from "./package.json";

fs.rmSync("deploy", { force: true, recursive: true });
fs.mkdirSync("deploy");

const copyList = ["../yarn.lock", "entry", "dist", "host.json", "proxies.json"];

for (const file of copyList) fs.copySync(file, path.resolve("deploy", path.basename(file)));

delete packageJson.devDependencies;
packageJson.scripts = {
  build: "true"
};

fs.writeFileSync("deploy/package.json", JSON.stringify(packageJson, null, 2));
