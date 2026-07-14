import esbuild from "esbuild";
import url from "url";
import path from "path";

const dirname = path.dirname(url.fileURLToPath(import.meta.url));

esbuild.build({
  entryPoints: ["installer.ts", "service-worker.ts"].map(file => path.resolve(dirname, "src", file)),
  bundle: true,
  platform: "node",
  outdir: path.resolve(dirname, "dist"),
  logLevel: "info",
  minify: true,
  minifyIdentifiers: true
});
