// Menjalankan semua penyesuaian proyek Android setelah `cap sync`:
// 1) Ikon maskot — lewat scripts/apply-android-branding.mjs bila file itu
//    sudah ada di repo (dijaga existsSync supaya urutan merge PR bebas).
// 2) Konfigurasi FCM — menyalin android-config/google-services.json ke
//    android/app/ supaya plugin google-services aktif dan notifikasi push
//    bisa jalan. Tanpa file itu build tetap aman (push nonaktif).
// 3) Widget saldo — menyalin sumber native dari android-widget/ ke proyek
//    dan mendaftarkan receiver-nya di AndroidManifest.xml (idempoten).
// Folder android/ tidak disimpan di repo, jadi langkah ini wajib diulang
// setiap platform dibuat — termasuk di GitHub Actions.
import { existsSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

// --- Widget saldo (native, ditulis dalam Java supaya cocok dengan
// templat Capacitor yang berbasis Java — tanpa tambalan Gradle) ---
const widgetSrc = join(root, "android-widget");
const appMain = join(root, "android", "app", "src", "main");
if (existsSync(widgetSrc) && existsSync(appMain)) {
  const copies = [
    ["BalanceWidgetProvider.java", join(appMain, "java", "id", "my", "aurafinance", "BalanceWidgetProvider.java")],
    ["widget_balance.xml", join(appMain, "res", "layout", "widget_balance.xml")],
    ["widget_bg.xml", join(appMain, "res", "drawable", "widget_bg.xml")],
    ["widget_balance_info.xml", join(appMain, "res", "xml", "widget_balance_info.xml")],
    ["widget_strings.xml", join(appMain, "res", "values", "widget_strings.xml")],
  ];
  for (const [name, dst] of copies) {
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(join(widgetSrc, name), dst);
  }
  const manifestPath = join(appMain, "AndroidManifest.xml");
  let manifest = readFileSync(manifestPath, "utf8");
  if (!manifest.includes("BalanceWidgetProvider")) {
    const receiver = [
      "        <receiver",
      '            android:name=".BalanceWidgetProvider"',
      '            android:exported="false"',
      '            android:label="@string/widget_label">',
      "            <intent-filter>",
      '                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />',
      "            </intent-filter>",
      "            <meta-data",
      '                android:name="android.appwidget.provider"',
      '                android:resource="@xml/widget_balance_info" />',
      "        </receiver>",
      "",
    ].join("\n");
    manifest = manifest.replace("    </application>", receiver + "    </application>");
    writeFileSync(manifestPath, manifest);
  }
  console.log("apply-android-extras: widget saldo terpasang.");
}
