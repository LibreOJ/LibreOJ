import esbuild from "esbuild";
import { nodeExternalsPlugin } from "esbuild-node-externals";
import inlineImportPlugin from "esbuild-plugin-inline-import";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  outfile: "dist/index.js",
  logLevel: "info",
  plugins: [
    nodeExternalsPlugin({
      allowList: ["@libreoj/bootstrap-core"]
    }),
    inlineImportPlugin()
  ]
});
