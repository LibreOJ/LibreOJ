import getGitRepoInfo from "git-repo-info";
import fetch from "node-fetch";
import fs from "fs";
import url from "url";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";

interface ApplicationConfig {
  cdnRoot: string;
  apiEndpoint: string;
  polyfillServiceEndpoint: string;
  defaultTitle: string;
  webpackPublicPath?: string;
  favicon: string;
}

const applicationConfig: ApplicationConfig = createRequire(import.meta.url)("./config.json");

async function fetchIndexHtml() {
  const response = await fetch(applicationConfig.cdnRoot + "/index.html");
  return response.text();
}

export interface ResponseDataForRegion {
  html: string;
  eTag: string;
}

function prepareResponseDataForRegion(html: string) {
  const responseDataForRegion: Record<string, ResponseDataForRegion> = {};

  const cdnRoot = applicationConfig.cdnRoot;

  responseDataForRegion[""] = {
    html: html,
    eTag: null
  };

  const replaces: Record<string, string> = {
    __api_endpoint__: applicationConfig.apiEndpoint,
    __polyfill_service__: applicationConfig.polyfillServiceEndpoint,
    __default_title__: applicationConfig.defaultTitle,
    __public_path__: applicationConfig.webpackPublicPath || cdnRoot,
    __favicon__: applicationConfig.favicon
  };

  let previouslyDefaultRegionHtml: string;
  // value is in the form of CN=domain1.com;US=domain2.com;domain3.com
  for (const [placeholder, value] of Object.entries(replaces)) {
    if (!value) continue;
    previouslyDefaultRegionHtml = responseDataForRegion[""].html;

    const entries = value
      .split(";")
      .map(item => (item.indexOf("=") === -1 ? ["", item] : item.split("=")) as [string, string]);
    const regions = new Set([...entries.map(([region]) => region), ...Object.keys(responseDataForRegion)]);
    const valuesMap = new Map(entries);
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
  responseDataForRegion: prepareResponseDataForRegion(await fetchIndexHtml()),
  buildInfo: {
    buildTime: new Date().toISOString(),
    buildCommit: getGitRepoInfo().sha
  }
};

fs.writeFileSync(path.dirname(url.fileURLToPath(import.meta.url)) + "/config.out.json", JSON.stringify(config));
