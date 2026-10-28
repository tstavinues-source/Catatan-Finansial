// Menyalin aset web AuraFi ke folder www/ untuk dibungkus Capacitor.
// Folder www/ adalah hasil salinan (tercantum di .gitignore) — jangan edit manual.
import { cpSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const www = join(root, "www");

const FILES = ["index.html", "manifest.json", "service-worker.js", "icon-192.png", "icon-512.png"];
const DIRS = ["css", "js", "assets"];

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

for (const f of FILES) {
  const src = join(root, f);
  if (existsSync(src)) cpSync(src, join(www, f));
}
for (const d of DIRS) {
  const src = join(root, d);
  if (existsSync(src)) cpSync(src, join(www, d), { recursive: true });
}

console.log("sync-www: aset web tersalin ke www/");
