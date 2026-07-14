import "../config.ts";

// @ts-ignore
const config = (await import("../config.out.json")).default;

console.log(
  JSON.stringify({
    environment: process.argv[2],
    data: {
      "index.html": config.responseDataForRegion["CN"].body,
      "sw.js": config.serviceWorker.body
    }
  })
);
