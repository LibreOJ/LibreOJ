import fs from "fs";
import toml from "@iarna/toml";

if (!process.env.CLOUDFLARE_WORKER_NAME || !process.env.CLOUDFLARE_ACCOUNT_ID) {
  console.error("Please provide worker name and account ID with environment variables.");
  process.exit(1);
}

fs.writeFileSync(
  "wrangler.toml",
  toml.stringify({
    name: process.env.CLOUDFLARE_WORKER_NAME,
    type: "javascript",
    account_id: process.env.CLOUDFLARE_ACCOUNT_ID,
    workers_dev: true,
    route: ""
  })
);
