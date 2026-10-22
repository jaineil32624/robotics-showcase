// Copies the Blender export (GLB + JSON catalogues + renders) into the website.
//   node scripts/sync-assets.mjs [path/to/export]
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..");
const src = resolve(process.argv[2] ?? join(root, "assets", "model"));
const web = resolve(import.meta.dirname, "..");
if (!existsSync(join(src, "argo_q4.glb"))) {
  console.error(`No argo_q4.glb in ${src}`);
  process.exit(1);
}
mkdirSync(join(web, "public", "models"), { recursive: true });
cpSync(join(src, "argo_q4.glb"), join(web, "public", "models", "argo_q4.glb"));
for (const f of ["parts.json", "clips.json"]) cpSync(join(src, f), join(web, "src", "data", f));
const renders = join(root, "renders");
if (existsSync(renders)) {
  mkdirSync(join(web, "public", "renders"), { recursive: true });
  for (const f of readdirSync(renders)) if (/\.(png|jpe?g|webp)$/i.test(f)) cpSync(join(renders, f), join(web, "public", "renders", f));
}
console.log("Assets synced from", src);
