// Bundles the offline WebGL renderer for the Android app.
//
//   node scripts/build-viewer.mjs
//
// Output (assets/viewer/):
//   index.html  – shell page
//   viewer.js   – three.js + shared RobotController + renderer (IIFE, minified)
//   model.js    – argo_q4.glb embedded as base64 (no network or file XHR needed)
import { build } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, "..");
const repo = resolve(app, "..");
const out = join(app, "assets", "viewer");
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [join(app, "viewer", "main.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["chrome90"],
  outfile: join(out, "viewer.js"),
  // the shared core lives in website/src; resolve its "three" import from this app
  nodePaths: [join(app, "node_modules")],
  legalComments: "none",
  logLevel: "info",
});

copyFileSync(join(app, "viewer", "index.html"), join(out, "index.html"));
const glb = readFileSync(join(repo, "assets", "model", "argo_q4.glb"));
writeFileSync(join(out, "model.js"), `window.ARGO_MODEL_B64="${glb.toString("base64")}";`);

// keep the native shell's catalogues in sync with the exported model
for (const f of ["parts.json", "clips.json"]) copyFileSync(join(repo, "assets", "model", f), join(app, "src", "data", f));

const kb = (f) => (statSync(join(out, f)).size / 1024).toFixed(0) + " KB";
console.log(`viewer.js ${kb("viewer.js")} · model.js ${kb("model.js")}`);
