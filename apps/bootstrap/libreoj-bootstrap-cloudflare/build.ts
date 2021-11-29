import esbuild from "esbuild";
import inlineImportPlugin from "esbuild-plugin-inline-import";

import "../config.ts";

esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  outfile: "dist/index.js",
  logLevel: "info",
  plugins: [inlineImportPlugin()]
});
