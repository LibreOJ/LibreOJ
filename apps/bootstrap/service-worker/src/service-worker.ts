/// <reference no-default-lib="true" />
/// <reference lib="es2020" />
/// <reference lib="WebWorker" />

const sw = self as unknown as ServiceWorkerGlobalScope & typeof globalThis;

const bootstrapCdnRoot = "https://" + new URL(sw.location.href).searchParams.get("o");

sw.addEventListener("install", event => {
  event.waitUntil(sw.skipWaiting());
});

sw.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== sw.origin) {
    return;
  }

  // Intercept the request of main HTML page and service worker script
  const newUrl = new URL(bootstrapCdnRoot);
  newUrl.pathname = url.pathname.endsWith(".js") ? url.pathname : "/";

  event.respondWith(
    (async () => {
      const response = await fetch(newUrl.toString());
      if (!response.ok) {
        // Oops! the service worker CDN may not available now
        // Fallback to the original URL
        return fetch(event.request);
      }

      return response;
    })()
  );
});
