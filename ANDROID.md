# AuraFi untuk Android

AuraFi kini bisa dibungkus menjadi aplikasi Android asli memakai
[Capacitor](https://capacitorjs.com). Kode web-nya tetap satu — aplikasi
Android memakai aset yang sama persis dengan versi web di aurafinance.my.id,
jadi setiap perbaikan di web ikut terbawa ke aplikasi saat APK dibangun ulang.

## Cara mendapatkan APK

1. Buka repositori GitHub **Catatan-Finansial** → tab **Actions**.
2. Pilih run **"Bangun APK Android"** yang terbaru dan berstatus sukses (✓).
3. Di bagian **Artifacts** di bawah halaman run, unduh **AuraFi-APK**
   (berisi `app-debug.apk`).
4. Pindahkan file APK ke HP, lalu buka untuk memasang. Android akan meminta
   izin "pasang dari sumber tidak dikenal" untuk browser/pengelola file yang
   dipakai — izinkan sekali untuk pemasangan ini.

APK ini adalah build *debug* untuk pemakaian pribadi (ditandatangani kunci
debug standar). Belum melalui Play Store.

## Cara kerja pembangunan

- `package.json` + `capacitor.config.json` — konfigurasi Capacitor
  (appId `id.my.aurafinance`, nama "AuraFi").
- `scripts/sync-www.mjs` — menyalin aset web (`index.html`, `css/`, `js/`,
  `assets/`) ke folder `www/` yang dibaca Capacitor.
- `.github/workflows/android-apk.yml` — setiap push ke `main` membangun APK
  baru di GitHub Actions dan menyimpannya sebagai artifact.
- Folder `android/`, `www/`, dan `node_modules/` tidak disimpan di repo
  (ada di `.gitignore`); platform Android dibuat ulang otomatis di CI.

## Pengembangan lokal (opsional)

```bash
npm install
npm run android:setup   # salin aset + buat platform + sinkron
npm run android:sync    # setelah mengubah aset web
```

## Notifikasi Push (FCM)

Aplikasi Android mendukung push notification dari server Ren (pengingat
gajian, kurs, dan kabar penting lain) lewat Firebase Cloud Messaging:

- Plugin `@capacitor/push-notifications` + handler `js/handlers/push.js`
  (hanya aktif di aplikasi native; web tidak terpengaruh). Setelah login,
  aplikasi meminta izin notifikasi, mendaftar ke FCM, dan menyimpan token
  perangkat ke Firebase `settings/pushTokens`.
- File `android-config/google-services.json` (dari Firebase Console, proyek
  agrivision-574be, package `id.my.aurafinance`) disalin otomatis ke
  `android/app/` oleh hook `capacitor:sync:after`
  (`scripts/apply-android-extras.mjs`). Tanpa file itu build tetap jalan,
  push saja yang nonaktif.
- Pengiriman dilakukan Ren dari server memakai kunci service account yang
  tersimpan di Secure Vault (bukan di repo).

## Widget Saldo (layar utama)

Widget Android menampilkan Kas Tunai dan Total Saldo sekilas:

- Sumber native disimpan di `android-widget/` (ditulis dalam Java agar cocok
  dengan templat Capacitor berbasis Java, tanpa tambalan Gradle) dan disalin
  ke proyek oleh hook yang sama (`scripts/apply-android-extras.mjs`), yang
  juga mendaftarkan receiver-nya di AndroidManifest.xml.
- Aplikasi menulis angka ringkas ke Capacitor Preferences (kunci
  `aurafi_widget`) lewat `js/handlers/widget-sync.js` setiap ada perubahan
  saldo; widget membacanya dari SharedPreferences "CapacitorStorage".
- Android membatasi penyegaran widget berkala (paling cepat ±30 menit);
  angka selalu disertai cap waktu "Diperbarui …". Ketuk widget membuka
  aplikasi.

## Hachi — maskot hidup

Hachi (shiba) tampil sebagai karakter SVG beranimasi di kartu "Hachi menyapa"
pada dasbor (`js/handlers/hachi.js`): berkedip, telinga bergerak, melompat
saat diketuk. Gelembung ucapannya dihitung dari data pengguna sendiri —
pengingat kewajiban belum tercatat (aturan cocok yang sama dengan checklist
di `reconcile.js`), hari gajian, laju belanja pribadi antar-siklus, kemajuan
misi tabungan, dan sapaan sesuai jam plus info kas. Di widget layar utama
Hachi tampil lewat ikon aplikasi dan satu baris pesan singkat (kunci
`pesan` pada data widget yang sama).

## Langkah berikutnya (belum termasuk di tahap ini)

- Ikon aplikasi khusus (saat ini masih ikon bawaan Capacitor).
- Notifikasi push (pengingat tagihan, gajian, checklist kewajiban).
- Widget layar utama untuk saldo.
- Build rilis bertandatangan + Play Store, bila nanti diperlukan.

## Kunci build tetap

Semua build CI ditandatangani dengan kunci debug yang sama
(`resources/debug.keystore.b64`, didekode oleh
`scripts/apply-android-extras.mjs` ke proyek Android). Berkat itu APK hasil
build baru selalu bisa dipasang **menimpa** aplikasi lama sebagai pembaruan.
Tanpa kunci tetap, tiap mesin build memakai kunci acaknya sendiri dan
Android menolak pembaruan dengan pesan "Aplikasi tidak diinstal".

## Hachi keliling

Maskot tampil sebagai stiker gambar ikon asli (`js/hachi-sprite.js`, data
URI WebP 512px) yang berjalan bebas di tepi bawah semua tab lewat
`js/handlers/hachi.js` — bukan lagi kartu di dasbor. Gelembung sapaannya
memakai mesin pesan yang sama dari data pengguna; Hachi menyingkir sendiri
saat modal atau keyboard terbuka.

## Hachi karakter kartun

Hachi kini karakter SVG beranimasi penuh di `js/handlers/hachi.js`:
berjalan dengan langkah kaki (tampak profil), duduk menghadap pengguna
saat berhenti, ekspresi mengikuti isi pesannya (senang, khawatir,
mengantuk), ekor bergoyang, mata berkedip. Stiker ikon bulat sebelumnya
sudah digantikan.
