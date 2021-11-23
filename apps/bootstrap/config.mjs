import getGitRepoInfo from "git-repo-info";
import fetch from "node-fetch";
import fs from "fs";
import url from "url";
import path from "path";

import applicationConfig from "./config.json";

async function fetchIndexHtml() {
  const response = await fetch(applicationConfig.cdnRoot + "/index.html");
  return response.text();
}

const config = {
  applicationConfig,
  html: await fetchIndexHtml(),
  buildInfo: {
    buildTime: new Date().toISOString(),
    buildCommit: getGitRepoInfo().sha
  }
};

fs.writeFileSync(path.dirname(url.fileURLToPath(import.meta.url)) + "/config.out.json", JSON.stringify(config));
