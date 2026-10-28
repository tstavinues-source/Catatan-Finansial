// Menjalankan semua penyesuaian proyek Android setelah `cap sync`:
// 1) Ikon maskot — lewat scripts/apply-android-branding.mjs bila file itu
//    sudah ada di repo (dijaga existsSync supaya urutan merge PR bebas).
// 2) Konfigurasi FCM — menyalin android-config/google-services.json ke
//    android/app/ supaya plugin google-services aktif dan notifikasi push
//    bisa jalan. Tanpa file itu build tetap aman (push nonaktif).
// Folder android/ tidak disimpan di repo, jadi langkah ini wajib diulang
// setiap platform dibuat — termasuk di GitHub Actions.
import { existsSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (!existsSync(join(root, "android"))) {
  console.log("apply-android-extras: folder android/ belum ada, dilewati.");
  process.exit(0);
}

const branding = join(root, "scripts", "apply-android-branding.mjs");
if (existsSync(branding)) {
  // Kegagalan branding (ikon) tidak boleh menggagalkan build keseluruhan.
  try {
    execSync(`node "${branding}"`, { cwd: root, stdio: "inherit" });
  } catch (e) {
    console.warn("apply-android-extras: branding ikon gagal, dilanjutkan tanpa ikon khusus.");
  }
}

const gsSrc = join(root, "android-config", "google-services.json");
const gsDst = join(root, "android", "app", "google-services.json");
if (existsSync(gsSrc)) {
  copyFileSync(gsSrc, gsDst);
  console.log("apply-android-extras: google-services.json terpasang (FCM aktif).");
} else {
  console.log("apply-android-extras: android-config/google-services.json belum ada, FCM nonaktif.");
}
