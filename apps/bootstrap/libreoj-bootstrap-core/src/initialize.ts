import type { ApplicationConfig } from "./config";
import type { ResponseDataForRegion } from "./index";
import { md5 } from "./utils";

import configString from "inline:../../config.out.json";

export interface Cache {
  set: <T>(key: string, value: T) => Promise<void>;
  get: <T>(key: string) => Promise<T>;
}

interface BuildInfo {
  buildTime: string;
  buildCommit: string;
}
export let buildInfo: BuildInfo = null;

type PreparedResponseData = Record<string, ResponseDataForRegion>;
let responseDataForRegion: PreparedResponseData = {};
const DEFAULT_REGION = "";

export let initialized = false;
let initializationError: Error = null;

async function doInitialize(cache: Cache) {
  if (initialized) return;

  const overallConfig: {
    html: string;
    applicationConfig: ApplicationConfig;
    buildInfo: BuildInfo;
  } = JSON.parse(configString);
  buildInfo = overallConfig.buildInfo;
  const config = overallConfig.applicationConfig;

  const cacheKey = await md5(configString);
  const cached = await cache.get<PreparedResponseData>(cacheKey);
  if (cached) {
    responseDataForRegion = cached;
    return;
  }

  try {
    const cdnRoot = config.cdnRoot;

    responseDataForRegion[DEFAULT_REGION] = {
      html: overallConfig.html,
      eTag: null
    };

    const replaces: Record<string, string> = {
      __api_endpoint__: config.apiEndpoint,
      __polyfill_service__: config.polyfillServiceEndpoint,
      __default_title__: config.defaultTitle,
      __public_path__: config.webpackPublicPath || cdnRoot,
      __favicon__: config.favicon
    };

    let previouslyDefaultRegionHtml: string;
    // value is in the form of CN=domain1.com;US=domain2.com;domain3.com
    for (const [placeholder, value] of Object.entries(replaces)) {
      if (!value) continue;
      previouslyDefaultRegionHtml = responseDataForRegion[DEFAULT_REGION].html;

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

        const valueForRegion = valuesMap.get(region) || valuesMap.get(DEFAULT_REGION);
        responseDataForRegion[region].html = responseDataForRegion[region].html.replace(
          placeholder,
          JSON.stringify(valueForRegion)
        );
      }
    }

    for (const responseData of Object.values(responseDataForRegion)) responseData.eTag = await md5(responseData.html);

    await cache.set(cacheKey, responseDataForRegion);
  } catch (e) {
    initializationError = e;
  }
}

export let initializationPromise: Promise<void> = null;
export function initialize(cache: Cache) {
  if (!initializationPromise) {
    initializationPromise = doInitialize(cache).then(() => {
      initialized = true;
    });
  }

  return initializationPromise;
}

export function getResponseDataForRegion(region: string) {
  if (!initialized) throw new Error(`Initialization not finished yet`);
  if (initializationError) throw initializationError;

  return responseDataForRegion[region] || responseDataForRegion[DEFAULT_REGION];
}
