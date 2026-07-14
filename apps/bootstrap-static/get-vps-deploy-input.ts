import config from "@libreoj/bootstrap-config/config.json";

console.log(
  JSON.stringify({
    environment: process.argv[2],
    data: {
      "index.html": config.responseDataForRegion["CN"].body,
      "sw.js": config.serviceWorker.body
    }
  })
);
