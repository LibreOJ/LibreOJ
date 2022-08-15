import OSS from "ali-oss";

import "../config.ts";

// @ts-ignore
const config = (await import("../config.out.json")).default;

if (
  !process.env.ALIYUN_ACCESS_KEY_ID ||
  !process.env.ALIYUN_ACCESS_KEY_SECRET ||
  !process.env.ALIYUN_OSS_BUCKET ||
  !process.env.ALIYUN_OSS_ENDPOINT
) {
  console.error(
    "Please provide ALIYUN_ACCESS_KEY_ID, ALIYUN_ACCESS_KEY_SECRET, ALIYUN_OSS_BUCKET and ALIYUN_OSS_ENDPOINT via env."
  );
  process.exit(1);
}

const oss = new OSS({
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
  bucket: process.env.ALIYUN_OSS_BUCKET,
  endpoint: process.env.ALIYUN_OSS_ENDPOINT
});

const files = {
  "index.html": config.responseDataForRegion["CN"],
  "sw.js": config.serviceWorker
};

for (const [filename, file] of Object.entries(files)) {
  console.log(`Uploading file ${JSON.stringify(filename)}...`);

  await oss.put(filename, Buffer.from(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": file.cacheControl,
      ETag: file.eTag
    }
  });
}
