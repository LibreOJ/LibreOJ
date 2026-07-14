import esbuild from "esbuild";
import path from "node:path";
import url from "node:url";

const dirname = path.dirname(url.fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: ["installer.ts", "service-worker.ts"].map(file => path.resolve(dirname, "src", file)),
  bundle: true,
  platform: "browser",
  outdir: path.resolve(dirname, "dist"),
  logLevel: "info",
  minify: true,
  minifyIdentifiers: true
});
