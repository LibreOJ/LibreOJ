import config from "../../config.out.json";

export interface ResponseDataForRegion {
  body: string;
  contentType: string;
  cacheControl: string;
}

interface ClientInfo {
  ip: string;
  ipRegion: string;
}

const {
  responseDataForRegion,
  serviceWorker,
  buildInfo
}: {
  responseDataForRegion: Record<string, ResponseDataForRegion>;
  serviceWorker: ResponseDataForRegion;
  buildInfo: {
    buildTime: string;
    buildCommit: string;
  };
} = config;

function getResponseDataForRegion(region: string) {
  return responseDataForRegion[region] || responseDataForRegion[""];
}

export function handleRequest(request: Request, clientInfo: ClientInfo): Response {
  const baseResponseHeaders: Record<string, string> = {};
  if (request.headers.get("X-Verbose")) {
    baseResponseHeaders["X-Build-Time"] = buildInfo.buildTime;
    baseResponseHeaders["X-Build-Commit"] = buildInfo.buildCommit;
  }

  const url = new URL(request.url);

  try {
    let data: ResponseDataForRegion;
    if (url.pathname === "/sw.js") {
      data = serviceWorker;
    } else {
      data = getResponseDataForRegion(clientInfo.ipRegion);
    }

    return new Response(data.body, {
      headers: {
        ...baseResponseHeaders,
        "Content-Type": data.contentType,
        "Cache-Control": data.cacheControl,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "*"
      }
    });
  } catch (e) {
    return new Response(e.stack, {
      status: 500,
      headers: {
        ...baseResponseHeaders,
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }
}
