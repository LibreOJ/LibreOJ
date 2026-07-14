import esbuild from "esbuild";
import inlineImportPlugin from "esbuild-plugin-inline-import";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  outfile: "dist/index.js",
  logLevel: "info",
  plugins: [inlineImportPlugin()]
});
