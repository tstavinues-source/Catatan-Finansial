// Menerapkan ikon aplikasi (maskot Shiba) ke proyek Android hasil generate.
// Dijalankan otomatis oleh Capacitor lewat hook "capacitor:sync:after"
// (lihat package.json) setiap kali `cap sync` berjalan — termasuk di CI.
// Folder android/ tidak disimpan di repo, jadi ikon harus diterapkan ulang
// setiap platform dibuat; sumbernya resources/icon.png (1024px+).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (!existsSync(join(root, "android"))) {
  console.log("apply-android-branding: folder android/ belum ada, dilewati.");
  process.exit(0);
}
const iconPath = join(root, "resources", "icon.png");
if (!existsSync(iconPath)) {
  // Di repo, ikon disimpan sebagai teks base64 (resources/icon.png.b64)
  // karena pipeline push tidak menerima file biner. Urai dulu di sini.
  const b64Path = join(root, "resources", "icon.png.b64");
  if (existsSync(b64Path)) {
    const b64 = readFileSync(b64Path, "utf8").replace(/\s+/g, "");
    writeFileSync(iconPath, Buffer.from(b64, "base64"));
    console.log("apply-android-branding: resources/icon.png diurai dari icon.png.b64.");
  }
}
if (!existsSync(iconPath)) {
  console.log("apply-android-branding: resources/icon.png tidak ditemukan, dilewati.");
  process.exit(0);
}

execSync(
  "npx capacitor-assets generate --android --assetPath resources" +
    " --iconBackgroundColor '#16222e' --iconBackgroundColorDark '#16222e'",
  { cwd: root, stdio: "inherit" }
);
console.log("apply-android-branding: ikon Shiba diterapkan ke proyek Android.");
