/**
 * Expo config plugin: copies the bundled WebGL viewer (assets/viewer) into the
 * native Android project's assets folder during `expo prebuild`, so the
 * WebView can load it from file:///android_asset/viewer/index.html offline.
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

module.exports = function withViewerAssets(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const src = path.join(cfg.modRequest.projectRoot, "assets", "viewer");
      if (!fs.existsSync(path.join(src, "viewer.js"))) {
        throw new Error("assets/viewer is empty - run `npm run build:viewer` before prebuild");
      }
      const dst = path.join(cfg.modRequest.platformProjectRoot, "app", "src", "main", "assets", "viewer");
      copyDir(src, dst);
      return cfg;
    },
  ]);
};
