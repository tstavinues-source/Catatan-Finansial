// ============================================================
// HACHI — maskot yang tinggal di atas kartu Net Worth (dashboard).
// Panggungnya #hachi-stage di index.html, tepat di tepi atas #living-core:
// kaki Hachi menapak di garis atas kartu, badannya di ruang kosong di atasnya.
//
// Perilaku (sesuai mockup yang disetujui pemilik, 2026-10-30):
// koreografi MENYAMBUNG — posisi selalu berlanjut dari titik terakhir,
// arah boleh berbalik di tengah jalan (tidak harus ujung ke ujung),
// tidak ada loncatan/pindah sisi tiba-tiba. Selama sebuah gerakan
// berlangsung, pergeseran badannya mengikuti kurva geser gerakan itu
// (diukur dari video sumbernya; mis. membungkuk = merayap maju).
//
// MENAMBAH GERAKAN BARU — cukup 3 langkah:
//   1. Siapkan WebP animasi (latar transparan, bingkai 240ms, tinggi ±96–160px).
//      Karena jalur unggah repo ini hanya menerima berkas teks, WebP disimpan
//      sebagai teks base64: assets/hachi/<nama>.webp.b64 — mesin di bawah
//      mendekodenya kembali menjadi gambar saat aplikasi dibuka.
//      Gerakan panjang boleh dipecah menjadi beberapa berkas dan ditulis
//      sebagai array — mesin memainkannya berurutan seolah satu gerakan
//      (lihat 'kupu').
//   2. Tambah satu entri di GERAKAN di bawah.
//   3. Sisipkan namanya di KOREOGRAFI bila ingin ikut tampil.
// Mesinnya yang mengurus posisi, arah hadap, dan sambungan antar gerakan.
// ============================================================

const GERAKAN = {
  // durasi: ms satu putaran gerakan. geser: kurva perpindahan badan selama
  // gerakan, dalam % lebar panggung, positif = maju searah hadap.
  // Kosongkan geser bila gerakannya diam di tempat.
  // berkas boleh berupa string atau { b, t }: t = tinggi tampil (px) yang
  // menyeimbangkan ukuran BADAN antar gerakan — kanvas tiap gerakan terisi
  // badan dalam kadar berbeda (lambai 96%, kupu hanya ±74%), jadi tinggi
  // gambar disetel per berkas: t = 56 x 0,96 / kadar-isi-badan gerakan itu
  // (diukur dari bingkai asetnya). Tanpa t, badan Hachi tampak mengecil
  // pada gerakan yang kanvasnya longgar.
  lambai:  { berkas: { b: 'assets/hachi/lambai.webp',  t: 56 }, durasi: 5760, geser: [] },
  jalan:   { berkas: { b: 'assets/hachi/jalan.webp',   t: 55 }, durasi: 0,    geser: [] }, // durasi dihitung dari jarak tempuh
  bungkuk: { berkas: { b: 'assets/hachi/bungkuk.webp', t: 64 }, durasi: 6000, geser: [0, 0.4, 1.0, 1.8, 2.6] },
  kupu:    { berkas: [{ b: 'assets/hachi/kupu-a.webp', t: 74 }, { b: 'assets/hachi/kupu-b.webp', t: 71 }], durasi: 9600, geser: [0, 0.7, 1.6, 1.9, 0.5, -0.2, 0.1, 1.1, 2.9, 2.2] },
};

// Urutan tampil, berputar terus. 'ke' hanya untuk gerakan jalan:
// posisi tujuan sebagai titik tengah badan (0..1 selebar panggung).
const KOREOGRAFI = [
  { gerakan: 'lambai' },
  { gerakan: 'jalan', ke: 0.68 },
  { gerakan: 'bungkuk' },
  { gerakan: 'jalan', ke: 0.49 },
  { gerakan: 'kupu' },
  { gerakan: 'jalan', ke: 0.84 },
  { gerakan: 'lambai' },
  { gerakan: 'jalan', ke: 0.36 },
];

const KECEPATAN_JALAN = 7;   // % lebar panggung per detik (tempo mockup yang disetujui)
const POSISI_AWAL = 0.36;    // titik tengah awal, sama dengan titik pulang koreografi

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

  async function mulai() {
    const stage = document.getElementById('hachi-stage');
    const img = document.getElementById('hachi-img');
    if (!stage || !img) return;

    // Dekode semua berkas gerakan (base64 -> WebP) sebelum tampil,
    // supaya pergantian antar gerakan tidak berkedip.
    const urlAset = {};
    const pathBerkas = (e) => (typeof e === 'string' ? e : e.b);
    async function siapkanAset() {
      const namaUnik = new Set();
      Object.values(GERAKAN).forEach((g) => {
        (Array.isArray(g.berkas) ? g.berkas : [g.berkas]).forEach((e) => namaUnik.add(pathBerkas(e)));
      });
      await Promise.all([...namaUnik].map(async (b) => {
        const teks = await (await fetch(b + '.b64')).text();
        const bin = atob(teks.replace(/\s/g, ''));
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        urlAset[b] = URL.createObjectURL(new Blob([u8], { type: 'image/webp' }));
      }));
    }
    try { await siapkanAset(); } catch (e) { return; } // aset gagal dimuat — Hachi tidak tampil, aplikasi tetap jalan

    const state = { tengah: POSISI_AWAL, hadap: 1, berkasAktif: '' };

    const lebarPanggung = () => stage.clientWidth || stage.parentElement.clientWidth || 360;
    const lebarBadan = () => img.clientWidth || 50;
    // left (px) agar titik tengah badan berada di fraksi `tengah` panggung.
    const leftUntuk = (tengah) => tengah * lebarPanggung() - lebarBadan() / 2;
    const batasi = (tengah) => {
      const setengah = (lebarBadan() / 2 + 4) / lebarPanggung();
      return Math.min(Math.max(tengah, setengah), 1 - setengah);
    };

    function setBerkas(e) {
      const b = pathBerkas(e);
      if (state.berkasAktif !== b) { img.src = urlAset[b]; state.berkasAktif = b; }
      if (typeof e === 'object' && e.t) img.style.height = e.t + 'px';
      img.style.transform = 'scaleX(' + state.hadap + ')';
    }

    function pasangPosisi(transisiMs) {
      img.style.transition = transisiMs ? 'left ' + transisiMs + 'ms linear' : 'none';
      img.style.left = leftUntuk(batasi(state.tengah)) + 'px';
    }

    async function aktivitas(nama) {
      const g = GERAKAN[nama];
      const bagian = Array.isArray(g.berkas) ? g.berkas : [g.berkas];
      const arah = state.hadap;
      // Pergeseran badan selama gerakan berjalan bersamaan dengan pergantian
      // bagian; posisi akhirnya SELALU dicatat supaya langkah berikutnya
      // berlanjut dari titik terakhirnya (tidak diam di titik lama).
      let animSelesai = null;
      if (g.geser.length > 1 && typeof img.animate === 'function') {
        const lebar = lebarPanggung();
        const keyframes = g.geser.map((v) => ({
          transform: 'translateX(' + (v / 100) * lebar * arah + 'px) scaleX(' + arah + ')',
        }));
        animSelesai = img.animate(keyframes, { duration: g.durasi, easing: 'linear' }).finished.catch(() => {});
      }
      const perBagian = g.durasi / bagian.length;
      for (let i = 0; i < bagian.length; i++) {
        setBerkas(bagian[i]);
        pasangPosisi(0);
        if (i < bagian.length - 1) await tunggu(perBagian);
      }
      if (animSelesai) await animSelesai;
      else await tunggu(perBagian);
      if (g.geser.length > 1) {
        state.tengah = batasi(state.tengah + (g.geser[g.geser.length - 1] / 100) * arah);
        pasangPosisi(0);
      }
    }

    async function jalan(ke) {
      const tujuan = batasi(ke);
      const jarak = Math.abs(tujuan - state.tengah);
      if (jarak < 0.005) return;
      state.hadap = tujuan > state.tengah ? 1 : -1;
      const durasi = ((jarak * 100) / KECEPATAN_JALAN) * 1000; // jarak fraksi -> % dulu, baru dibagi kecepatan (%/detik)
      setBerkas(GERAKAN.jalan.berkas);
      pasangPosisi(0);                       // jangkar di titik berangkat
      void img.offsetWidth;                  // paksa reflow agar transisi berjalan
      img.style.transition = 'left ' + durasi + 'ms linear';
      img.style.left = leftUntuk(tujuan) + 'px';
      state.tengah = tujuan;
      await tunggu(durasi + 30);
      img.style.transition = 'none';
    }

    async function tampil() {
      img.style.display = 'block';
      setBerkas(Array.isArray(GERAKAN.lambai.berkas) ? GERAKAN.lambai.berkas[0] : GERAKAN.lambai.berkas);
      pasangPosisi(0);
      for (;;) {
        for (const langkah of KOREOGRAFI) {
          while (document.hidden) await tunggu(2000); // jeda saat aplikasi di latar
          if (langkah.gerakan === 'jalan') await jalan(langkah.ke);
          else await aktivitas(langkah.gerakan);
        }
      }
    }

    tampil();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai);
  else mulai();
})();
