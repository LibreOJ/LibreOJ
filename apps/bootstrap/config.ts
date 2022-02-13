import getGitRepoInfo from "git-repo-info";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import url from "url";
import crypto from "crypto";
import cheerio from "cheerio";
import * as terser from "terser";
import { createRequire } from "module";

import "service-worker/build.ts";

const require = createRequire(import.meta.url);
const dirname = path.dirname(url.fileURLToPath(import.meta.url));

type ValueForRegions = string | Record<string, string>;

interface ApplicationConfig {
  env: Record<string, string>;
  bootstrapCdnRoot: string;
  htmlTemplate: string;
  substitution: Record<string, ValueForRegions>;
}

const applicationConfig: ApplicationConfig = require("./config.json");

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
  const originalHtmlFile = await response.text();

  const serviceWorkerInstallerPath = require.resolve("service-worker/dist/installer");

  const $ = cheerio.load(originalHtmlFile);
  const script = $("<script>");
  script.html(fs.readFileSync(serviceWorkerInstallerPath, "utf-8"));
  $("body").append(script);

  return $.html();
}

async function postProcessHtml(html: string) {
  const $ = cheerio.load(html);
  await Promise.all(
    $("script")
      .toArray()
      .map(async script => {
        const scriptText = $(script).html();
        const terserOutput = await terser.minify(scriptText);
        $(script).html(terserOutput.code);
      })
  );

  return $.html();
}

export interface ResponseDataForRegion {
  body: string;
  contentType: string;
  cacheControl: string;
  eTag: string;
}

function makeResponseData(body: string, contentType: string, cacheControl: string): ResponseDataForRegion {
  return {
    body,
    contentType,
    cacheControl,
    eTag: crypto.createHash("md5").update(body).digest("hex")
  };
}

async function prepareResponseDataForRegion(html: string): Promise<Record<string, ResponseDataForRegion>> {
  const responseDataForRegion: Record<string, string> = {};

  responseDataForRegion[""] = html;

  let previouslyDefaultRegionHtml: string;
  for (const [placeholder, value] of Object.entries(applicationConfig.substitution)) {
    if (!value) continue;
    previouslyDefaultRegionHtml = responseDataForRegion[""];

    const entries: [string, string][] = typeof value === "string" ? [["", value]] : Object.entries(value);
    const regions = new Set([...entries.map(([region]) => region), ...Object.keys(responseDataForRegion)]);
    const valuesMap = new Map(entries.map(([key, value]) => [key, applyEnv(value)]));
    for (const region of regions) {
      if (!responseDataForRegion[region]) responseDataForRegion[region] = previouslyDefaultRegionHtml;

      const valueForRegion = valuesMap.get(region) || valuesMap.get("");
      responseDataForRegion[region] = responseDataForRegion[region].replace(
        placeholder,
        JSON.stringify(valueForRegion)
      );
    }
  }

  for (const region in responseDataForRegion) {
    responseDataForRegion[region] = await postProcessHtml(responseDataForRegion[region]);
  }

  return Object.fromEntries(
    Object.entries(responseDataForRegion).map(([region, body]) => [
      region,
      makeResponseData(body, "text/html; charset=utf-8", "public, max-age=60")
    ])
  );
}

const config = {
  responseDataForRegion: await prepareResponseDataForRegion(await fetchHtmlTemplate()),
  serviceWorker: makeResponseData(
    fs.readFileSync(require.resolve("service-worker/dist/service-worker"), "utf-8"),
    "text/javascript",
    "public, max-age=604800"
  ),
  buildInfo: {
    buildTime: new Date().toISOString(),
    buildCommit: getGitRepoInfo().sha
  }
};

fs.writeFileSync(path.resolve(dirname, "config.out.json"), JSON.stringify(config));
