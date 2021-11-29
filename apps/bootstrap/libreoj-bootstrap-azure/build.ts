import esbuild from "esbuild";
import { nodeExternalsPlugin } from "esbuild-node-externals";
import inlineImportPlugin from "esbuild-plugin-inline-import";

import workspaceRoot from "../package.json";

import "../config.ts";

esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  outfile: "dist/index.js",
  logLevel: "info",
  plugins: [
    nodeExternalsPlugin({
      allowList: workspaceRoot.workspaces
    }),
    inlineImportPlugin()
  ]
});
