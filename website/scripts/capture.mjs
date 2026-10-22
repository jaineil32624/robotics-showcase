// CI smoke test: serves the static export, opens every page in headless
// Chromium (SwiftShader WebGL), fails on uncaught exceptions and saves
// screenshots to ./capture for review.
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import handler from "serve-handler";
import { chromium } from "playwright";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const outDir = resolve(import.meta.dirname, "..", "out");
const capDir = resolve(import.meta.dirname, "..", "capture");
mkdirSync(capDir, { recursive: true });

const server = createServer((req, res) => {
  if (base && req.url.startsWith(base)) req.url = req.url.slice(base.length) || "/";
  return handler(req, res, { public: outDir, trailingSlash: true });
});
await new Promise((r) => server.listen(4173, r));
const origin = `http://localhost:4173${base}`;

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

const pages = [
  ["home", "/", 9000],
  ["viewer", "/viewer/", 12000],
  ["viewer-walk", "/viewer/?clip=walk", 14000],
  ["viewer-exploded", "/viewer/?clip=exploded", 15000],
  ["specs", "/specs/", 1500],
  ["animations", "/animations/", 10000],
  ["build", "/build/", 2000],
  ["about", "/about/", 1000],
];
const viewports = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
];

const errors = [];
const log = [];
for (const [vpName, viewport] of viewports) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  for (const [name, path, wait] of pages) {
    if (vpName === "mobile" && !["home", "viewer", "specs"].includes(name)) continue;
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${vpName}/${name}: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") log.push(`${vpName}/${name} console.error: ${m.text()}`);
    });
    const resp = await page.goto(origin + path, { waitUntil: "networkidle", timeout: 90000 });
    if (!resp || !resp.ok()) errors.push(`${vpName}/${name}: HTTP ${resp?.status()}`);
    await page.waitForTimeout(wait);
    if (path.startsWith("/viewer")) {
      const canvas = await page.$("canvas");
      if (!canvas) errors.push(`${vpName}/${name}: no WebGL canvas`);
    }
    await page.screenshot({ path: join(capDir, `${vpName}-${name}.png`), fullPage: !path.startsWith("/viewer") });
    log.push(`ok ${vpName}/${name}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
server.close();

writeFileSync(join(capDir, "report.txt"), [...log, "", "ERRORS:", ...errors].join("\n"));
console.log(log.join("\n"));
if (errors.length) {
  console.error("Page errors:\n" + errors.join("\n"));
  process.exit(1);
}
