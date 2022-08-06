/// <reference no-default-lib="true" />
/// <reference lib="es2021" />
/// <reference lib="WebWorker" />

const sw = self as unknown as ServiceWorkerGlobalScope & typeof globalThis;

const bootstrapCdnRoot = "https://" + new URL(sw.location.href).searchParams.get("o");

if (!Promise.any) {
  Promise.any = <T>(promises: Iterable<T | Promise<T>>): Promise<Awaited<T>> => {
    return Promise.all(
      [...promises].map(promise => {
        return new Promise((resolve, reject) =>
          Promise.resolve(promise)
            // When a promise fulfilled, we call reject to bail out Promise.all
            // When a promise rejected, we call resolve to continue Promise.all
            .then(reject, resolve)
        );
      })
    ).then(
      // The resolved are actually aggregated errors
      errors => Promise.reject(errors),
      // The reject is the first fulfilled promise (which causes the bail out)
      fastest => Promise.resolve<Awaited<T>>(fastest)
    );
  };
}

sw.addEventListener("install", event => {
  event.waitUntil(sw.skipWaiting());
});

sw.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== sw.origin) {
    return;
  }

  const abortEvent = new Event("abortFetch");
  const eventTarget = new EventTarget();
  const withAbort = <F extends (...args: any[]) => Promise<Response>>(
    fetchWithSignal: (signal: AbortSignal) => F
  ): ((...args: Parameters<F>) => Promise<Response>) => {
    // Abort other doFetch()-es when the first doFetch() resolved with true
    const abortController = typeof AbortController === "function" && new AbortController();

    // When the abort event triggered, don't abort the current fetch() if `fetchSucceed` is true
    let fetchSucceed = false;
    if (abortController) {
      eventTarget.addEventListener(abortEvent.type, () => {
        if (!fetchSucceed) abortController.abort();
      });
    }

    const doFetch = fetchWithSignal(abortController ? abortController.signal : undefined);
    return async (...args: Parameters<F>) => {
      const response = await doFetch(...args);
      if (response) {
        // Abort other fetch()-es
        fetchSucceed = true;
        eventTarget.dispatchEvent(abortEvent);
        return response;
      }
    };
  };

  const fetchOrigin = withAbort(signal => async () => {
    const resp = await fetch(event.request, { signal });
    return resp;
  });
  const fetchRedirected = withAbort(signal => async () => {
    // Intercept the request of main HTML page and service worker script
    const newUrl = new URL(bootstrapCdnRoot);
    newUrl.pathname = url.pathname.endsWith(".js") ? url.pathname : "/";
    if (newUrl.origin === url.origin) throw null;

    const fetchOptions: RequestInit = {
      redirect: "follow",
      signal
    };

    let response = await fetch(newUrl, fetchOptions);

    if (!response.ok) {
      // Oops! the service worker CDN may not available now
      // Fallback to the original URL

      // This error won't be used, just to indicate the fetch failed
      throw null;
    }

    return response;
  });

  event.respondWith(Promise.any([fetchOrigin(), fetchRedirected()]));
});
