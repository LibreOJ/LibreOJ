import configString from "inline:../../config.out.json";

export interface ResponseDataForRegion {
  html: string;
  eTag: string;
}

interface ClientInfo {
  ip: string;
  ipRegion: string;
}

const {
  responseDataForRegion,
  buildInfo
}: {
  responseDataForRegion: Record<string, ResponseDataForRegion>;
  buildInfo: {
    buildTime: string;
    buildCommit: string;
  };
} = JSON.parse(configString as unknown as string);

function getResponseDataForRegion(region: string) {
  return responseDataForRegion[region] || responseDataForRegion[""];
}

export function handleRequest(request: Request, clientInfo: ClientInfo): Response {
  const baseResponseHeaders: Record<string, string> = {};
  if (request.headers.get("X-Verbose")) {
    baseResponseHeaders["X-Build-Time"] = buildInfo.buildTime;
    baseResponseHeaders["X-Build-Commit"] = buildInfo.buildCommit;
  }

  try {
    const data = getResponseDataForRegion(clientInfo.ipRegion);

    if (request.headers.get("If-None-Match") === data.eTag) {
      return new Response(null, {
        status: 204
      });
    }

    return new Response(data.html, {
      headers: {
        ...baseResponseHeaders,
        ETag: data.eTag,
        "Content-Type": "text/html; charset=utf-8"
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
