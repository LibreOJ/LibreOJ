/// <reference no-default-lib="true" />
/// <reference lib="es2020" />
/// <reference lib="DOM" />

// The keyword __bootstrap_cdn_root__ and __bootstrap_cdn_root_staging__ will be replaced
declare var __bootstrap_cdn_root_staging__: string;
declare var __bootstrap_cdn_root__: string;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register(
      "/sw.js?o=" +
        (location.hostname.includes("staging")
          ? __bootstrap_cdn_root_staging__ || location.hostname
          : __bootstrap_cdn_root__)
    );
  });
}
