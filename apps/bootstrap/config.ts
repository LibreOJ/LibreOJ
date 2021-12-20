import getGitRepoInfo from "git-repo-info";
import fetch from "node-fetch";
import fs from "fs";
import url from "url";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";

type ValueForRegions = string | Record<string, string>;

interface ApplicationConfig {
  env: Record<string, string>;
  htmlTemplate: string;
  substitution: Record<string, ValueForRegions>;
}

const applicationConfig: ApplicationConfig = createRequire(import.meta.url)("./config.json");

const applyEnv = (() => {
  const env = Object.entries(applicationConfig.env);
  function applyEnv(string: string, envEntries: [string, string][] = env) {
    for (const [key, value] of envEntries) string = string.split("${" + key + "}").join(value);
    return string;
  }

  // Initialize env
  for (const i of env.keys()) env[i][1] = applyEnv(env[i][1], env.slice(0, i));

  return applyEnv;
})();

async function fetchHtmlTemplate() {
  const response = await fetch(applyEnv(applicationConfig.htmlTemplate));
  return response.text();
}

export interface ResponseDataForRegion {
  html: string;
  eTag: string;
}

function prepareResponseDataForRegion(html: string) {
  const responseDataForRegion: Record<string, ResponseDataForRegion> = {};

  responseDataForRegion[""] = {
    html: html,
    eTag: null
  };

  let previouslyDefaultRegionHtml: string;
  for (const [placeholder, value] of Object.entries(applicationConfig.substitution)) {
    if (!value) continue;
    previouslyDefaultRegionHtml = responseDataForRegion[""].html;

    const entries: [string, string][] = typeof value === "string" ? [["", value]] : Object.entries(value);
    const regions = new Set([...entries.map(([region]) => region), ...Object.keys(responseDataForRegion)]);
    const valuesMap = new Map(entries.map(([key, value]) => [key, applyEnv(value)]));
    for (const region of regions) {
      if (!responseDataForRegion[region])
        responseDataForRegion[region] = {
          html: previouslyDefaultRegionHtml,
          eTag: null
        };

      const valueForRegion = valuesMap.get(region) || valuesMap.get("");
      responseDataForRegion[region].html = responseDataForRegion[region].html.replace(
        placeholder,
        JSON.stringify(valueForRegion)
      );
    }
  }

  const md5 = (data: string) => crypto.createHash("md5").update(data).digest("hex");
  for (const responseData of Object.values(responseDataForRegion)) responseData.eTag = md5(responseData.html);

  return responseDataForRegion;
}

const config = {
  responseDataForRegion: prepareResponseDataForRegion(await fetchHtmlTemplate()),
  buildInfo: {
    buildTime: new Date().toISOString(),
    buildCommit: getGitRepoInfo().sha
  }
};

fs.writeFileSync(path.dirname(url.fileURLToPath(import.meta.url)) + "/config.out.json", JSON.stringify(config));
