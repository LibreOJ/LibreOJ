import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import geoip from "geoip-country";
import { handleRequest } from "core";

const initializationPromise = (async () => {
  // Polyfills for Web interfaces
  const nodeFetch = await import("node-fetch"); // node-fetch is a ESM only package
  global.fetch = nodeFetch.default as any;
  global.Headers = nodeFetch.Headers as any;
  global.Request = nodeFetch.Request as any;
  global.Response = nodeFetch.Response as any;
})();

function getClientIp(xForwardedForList: string[]) {
  if (xForwardedForList.length >= 1) return xForwardedForList[0].trim().split(":")[0];
  return "127.0.0.1";
}

const httpTrigger: AzureFunction = async (context: Context, req: HttpRequest) => {
  await initializationPromise;

  const url = new URL(req.url);
  const headers = { ...req.headers };

  // Proxy host
  headers["host"] = headers["x-original-host"];
  delete headers["x-original-host"];

  // Proxy URL path
  url.pathname = "/" + req.params.proxyPath;
  url.host = headers["host"];

  // Remove first X-Forwarded-For host since it's prepended by proxy
  const xForwardedForList = headers["x-forwarded-for"].split(",").filter(host => !host.startsWith("127."));
  if (xForwardedForList.length > 0) {
    headers["x-forwarded-for"] = xForwardedForList.join(",");
  } else {
    delete headers["x-forwarded-for"];
  }

  // Get region code
  const clientIp = getClientIp(xForwardedForList);
  const clientIpRegion = geoip.lookup(clientIp)?.country;

  const response = handleRequest(
    new Request(url.toString(), {
      headers: headers,
      method: req.method,
      body: req.body
    }),
    {
      ip: clientIp,
      ipRegion: clientIpRegion
    }
  );

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  context.res = {
    status: response.status,
    body: Buffer.from(await response.arrayBuffer()),
    headers: responseHeaders
  };
};

export default httpTrigger;
