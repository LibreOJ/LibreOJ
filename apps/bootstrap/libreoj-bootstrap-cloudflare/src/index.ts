/// <reference no-default-lib="true"/>
/// <reference lib="WebWorker" />

import { handleRequest } from "libreoj-bootstrap-core";

declare var self: ServiceWorkerGlobalScope & typeof globalThis;

self.addEventListener("fetch", (event: FetchEvent) => {
  const request = event.request;
  event.respondWith(
    handleRequest(request, {
      ip: request.headers.get("CF-Connecting-IP") || "127.0.0.1",
      ipRegion: request.headers.get("CF-IPCountry")
    })
  );
});
