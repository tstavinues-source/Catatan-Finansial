// ============================================================================
// IKON KATEGORI PER TEMA (Visual Identity System) — setiap tampilan punya
// objek ikonnya sendiri untuk kategori yang sama (aset assets/ikon/<tema>/
// kat-<slug>.webp.b64, pola yang sama dengan latar Net Worth di motion.js).
// Modul ini hanya mengganti ISI chip ikon pada kartu transaksi. Bila aset
// gagal dimuat, ikon Font Awesome bawaan kartu tetap tampil.
// Tema ikon: kulit luxury/cyber/brutal/clay memakai setnya sendiri; Slate
// mengikuti varian data-theme (midnight=Tembaga, sakura=Sage, serenity=Frost).
// ============================================================================
(function () {
  "use strict";

  const IKON_BY_SKIN = { luxury: "luxury", cyber: "cyber", brutal: "brutal", clay: "clay" };
  const IKON_BY_THEME = { midnight: "tembaga", sakura: "sage", serenity: "frost" };
  const SLUG = {
    "Makanan": "makanan", "Minuman": "minuman", "Transportasi": "transportasi",
    "Tagihan & Utilitas": "tagihan", "Belanja Pribadi": "belanja",
    "Hiburan & Hobi": "hiburan", "Elektronik": "elektronik",
    "Bahan Pokok": "bahanpokok", "Camilan": "camilan", "Istri": "istri",
    "Kas Apato": "kasapato", "Admin": "admin", "Pemasukan": "pemasukan",
    "Lainnya": "lainnya"
  };
  const SLUGS = Object.keys(SLUG).map(function (k) { return SLUG[k]; });
  // Sub-kategori (grup Makanan): ikon TANPA latar (alfa), latar diatur chip.
  const SUB_SLUG = {
    "Makanan": "makanan", "Buah": "buah", "Sayuran": "sayuran",
    "Daging": "daging", "Bumbu/Bahan Masakan": "bumbu",
    "Bahan Pokok": "bahanpokok", "Camilan": "camilan"
  };
  const SUB_SLUGS = Object.keys(SUB_SLUG).map(function (k) { return SUB_SLUG[k]; });
  const urlCache = {};  // tema -> { slug: blobUrl }
  const subUrlCache = {};  // tema -> { slugSub: blobUrl }
  const loading = {};   // tema -> true selama memuat

  function temaKey() {
    const skin = document.documentElement.getAttribute("data-skin");
    if (skin && IKON_BY_SKIN[skin]) return IKON_BY_SKIN[skin];
    const th = document.documentElement.getAttribute("data-theme") || "midnight";
    return IKON_BY_THEME[th] || "tembaga";
  }

  // Dipakai tampilan Analisa: slug ikon untuk nama kategori, atau null.
  window.AuraIkonSlugKategori = function (kategori) {
    return SLUG[kategori || "Lainnya"] || null;
  };

  // Dipakai renderer kartu: slug ikon untuk sebuah transaksi, atau null bila
  // jenisnya memakai ikon gerakan (mutasi / tarik-setor / brankas).
  window.AuraIkonSlug = function (t) {
    if (!t) return null;
    if (t.tipe !== "pengeluaran" && t.tipe !== "pemasukan") return null;
    return SLUG[t.kategori || "Lainnya"] || null;
  };

  // Peta pencarian sub tidak peka huruf: aplikasi menulis ulang nama sub
  // per kata ("Bumbu/Bahan Masakan" tampil sebagai "Bumbu/bahan Masakan"),
  // jadi pencocokan dilakukan dalam huruf kecil.
  const SUB_SLUG_CI = {};
  Object.keys(SUB_SLUG).forEach(function (k) { SUB_SLUG_CI[k.toLowerCase()] = SUB_SLUG[k]; });

  // Dipakai tampilan Analisa: slug ikon sub untuk nama sub-kategori, atau null.
  window.AuraIkonSlugSub = function (namaSub) {
    return SUB_SLUG_CI[String(namaSub || "").trim().toLowerCase()] || null;
  };

  async function loadTema(tema) {
    if (urlCache[tema] || loading[tema]) return;
    loading[tema] = true;
    const map = {};
    await Promise.all(SLUGS.map(async function (slug) {
      try {
        const teks = await (await fetch("assets/ikon/" + tema + "/kat-" + slug + ".webp.b64")).text();
        const bin = atob(teks.replace(/\s/g, ""));
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        map[slug] = URL.createObjectURL(new Blob([u8], { type: "image/webp" }));
      } catch (e) { /* aset ikon gagal — chip memakai ikon bawaan */ }
    }));
    urlCache[tema] = map;
    const subMap = {};
    await Promise.all(SUB_SLUGS.map(async function (slug) {
      try {
        const teks = await (await fetch("assets/ikon-sub/" + tema + "/sub-" + slug + ".webp.b64")).text();
        const bin = atob(teks.replace(/\s/g, ""));
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        subMap[slug] = URL.createObjectURL(new Blob([u8], { type: "image/webp" }));
      } catch (e) { /* aset sub gagal — baris memakai ikon bawaan */ }
    }));
    subUrlCache[tema] = subMap;
    applyAll();
  }

  function applyAll() {
    const tema = temaKey();
    const map = urlCache[tema];
    if (!map) { loadTema(tema); return; }
    document.querySelectorAll("[data-ikon]").forEach(function (slot) {
      const url = map[slot.getAttribute("data-ikon")];
      if (!url) return;
      if (slot.getAttribute("data-ikon-url") === url) return;
      slot.setAttribute("data-ikon-url", url);
      slot.innerHTML = '<img class="ikon-tema-img" src="' + url + '" alt="">';
    });
    const subMapNow = subUrlCache[tema];
    if (subMapNow) {
      document.querySelectorAll("[data-ikon-sub]").forEach(function (slot) {
        const url = subMapNow[slot.getAttribute("data-ikon-sub")];
        if (!url) return;
        if (slot.getAttribute("data-ikon-url") === url) return;
        slot.setAttribute("data-ikon-url", url);
        slot.innerHTML = '<img class="ikon-sub-img" src="' + url + '" alt="">';
      });
    }
  }
  window.AuraIkonRefresh = applyAll;

  // Kartu dirender ulang berkali-kali; amati DOM agar chip baru ikut terisi,
  // dan amati atribut tema agar ikon ikut berganti saat tampilan berubah.
  let queued = false;
  function queueApply() {
    if (queued) return;
    queued = true;
    setTimeout(function () { queued = false; applyAll(); }, 120);
  }
  function boot() {
    loadTema(temaKey());
    if (document.body) {
      new MutationObserver(queueApply).observe(document.body, { childList: true, subtree: true });
    }
    new MutationObserver(function () { loadTema(temaKey()); applyAll(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["data-skin", "data-theme"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
