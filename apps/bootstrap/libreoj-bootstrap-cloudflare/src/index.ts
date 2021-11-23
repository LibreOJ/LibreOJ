/// <reference no-default-lib="true"/>
/// <reference lib="WebWorker" />

import { initialize, initialized, Cache, handleRequest } from "libreoj-bootstrap-core";

declare var self: ServiceWorkerGlobalScope & typeof globalThis;

// Implement a generic K-V cache with Web Cache API
const cache = ((): Cache => {
  const cacheSet = "CACHE";
  const getCacheKey = (key: string) => `https://cache.example.com/${encodeURIComponent(key)}`;
  return {
    set: async (key, value) => {
      const cache = await caches.open(cacheSet);
      await cache.put(
        getCacheKey(key),
        new Response(JSON.stringify(value), {
          headers: { "Content-Type": "application/json" }
        })
      );
    },
    get: async key => {
      const cache = await caches.open(cacheSet);
      const response = await cache.match(getCacheKey(key));
      return response && (await response.json());
    }
  };
})();

self.addEventListener("fetch", (event: FetchEvent) => {
  event.respondWith(
    (async () => {
      if (!initialized) {
        await initialize(cache);
      }
      const request = event.request;
      return handleRequest(request, {
        ip: request.headers.get("CF-Connecting-IP") || "127.0.0.1",
        ipRegion: request.headers.get("CF-IPCountry")
      });
    })()
  );
});
