import esbuild from "esbuild";
import { nodeExternalsPlugin } from "esbuild-node-externals";

import workspaceRoot from "../package.json";

esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  outfile: "dist/index.js",
  logLevel: "info",
  plugins: [
    nodeExternalsPlugin({
      allowList: workspaceRoot.workspaces
    })
  ]
});
