// ============================================================================
// Hachi — maskot hidup AuraFi.
// Mengisi kartu sapaan diam di dasbor (#hachi-card) dari data pengguna sendiri:
// prioritasnya (1) kewajiban siklus yang belum tercatat, (2) hari gajian,
// (3) laju pengeluaran melewati siklus lalu, (4) kemajuan misi tabungan,
// (5) sapaan hangat sesuai jam + info kas. Ketuk Hachi untuk lompatan kecil
// dan kalimat penyemangat berganti. Murni tampilan: tidak menulis data apa pun.
// Maskot keliling dihapus atas keputusan user (2026-10-29): menghalangi layar.
// ============================================================================
(function () {
  const MOTIVASI = [
    "Sedikit demi sedikit, lama-lama jadi bukit. Hachi temani terus.",
    "Uang yang tercatat adalah uang yang terkendali.",
    "Kamu rajin mencatat. Itu kebiasaan orang yang menang pelan-pelan.",
    "Delapan itu tanpa putus, seperti rezeki yang kamu jaga. Semangat!",
    "Hari ini catat satu hal kecil saja, itu sudah kemajuan.",
    "Brankas yang terisi pelan lebih kuat daripada dompet yang bocor cepat.",
  ];
  const POS = { pemasukan: 1, mutasi_masuk: 1, setor_tunai: 1 };
  const NEG = { pengeluaran: 1, mutasi_keluar: 1, tarik_tunai: 1, nabung: 1 };
  let motivasiIdx = null;
  let lastText = "";

  function fmt(n) {
    if (typeof window.formatAuraCurrency === "function") {
      try { return window.formatAuraCurrency(n); } catch (e) { /* abaikan */ }
    }
    return "¥" + Math.round(n || 0).toLocaleString("ja-JP");
  }

  function todayStr(d) {
    const p = (x) => String(x).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function cycleRange() {
    const S = (window.AuraState && AuraState.data && AuraState.data.settings) || {};
    const anchors = (Array.isArray(S.cycleAnchors) ? S.cycleAnchors.slice() : []).sort();
    const today = todayStr(new Date());
    let start = null, prevStart = null;
    for (const a of anchors) {
      if (a <= today) { prevStart = start; start = a; }
    }
    if (!start) {
      start = today.slice(0, 8) + "01";
      prevStart = null;
    }
    return { start: start, prevStart: prevStart, today: today };
  }

  function kasTunai() {
    const data = AuraState.data || {};
    const walletsRaw = data.wallets;
    const wallets = Array.isArray(walletsRaw) ? walletsRaw : (walletsRaw && typeof walletsRaw === "object" ? Object.values(walletsRaw) : []);
    const dw =
      wallets.find((w) => w && typeof w.name === "string" && w.name.toLowerCase().includes("dompet hidup")) ||
      wallets.find((w) => w && (w.type === "tunai" || w.tipe === "tunai"));
    if (!dw) return null;
    let bal = 0;
    (data.transactions || []).forEach((t) => {
      if (!t || t.is_deleted || t.wallet_id !== dw.id) return;
      if (POS[t.tipe]) bal += Number(t.nominal) || 0;
      else if (NEG[t.tipe]) bal -= Number(t.nominal) || 0;
    });
    return bal;
  }

  function computeMessage() {
    const data = AuraState.data || {};
    const S = data.settings || {};
    const txs = (data.transactions || []).filter((t) => t && !t.is_deleted);
    const range = cycleRange();

    // 1) Kewajiban siklus yang belum tercatat — aturan cocok yang sama
    // dengan reminderMatch di reconcile.js (merchantName bila ada,
    // selain itu kategori transaksi).
    const remsRaw = S.obligationReminders;
    const rems = Array.isArray(remsRaw) ? remsRaw : remsRaw && typeof remsRaw === "object" ? Object.values(remsRaw) : [];
    for (const r of rems) {
      const merch = String(r.merchantName || "").trim().toLowerCase();
      const paid = txs.some((t) => {
        if (t.tanggal < range.start || t.tipe !== "pengeluaran") return false;
        if (merch) return String(t.merchantName || t.storeName || "").trim().toLowerCase() === merch;
        return t.kategori === r.kategori;
      });
      if (!paid) {
        return {
          mood: "ingat",
          text: "Jangan lupa ya, " + r.name + " " + fmt(r.amount) + " belum tercatat di siklus ini. Hachi ingatkan supaya tidak menumpuk di akhir.",
        };
      }
    }

    // 2) Hari gajian (hari ini atau kemarin)
    const anchors = Array.isArray(S.cycleAnchors) ? S.cycleAnchors : [];
    const kem = new Date(); kem.setDate(kem.getDate() - 1);
    if (anchors.includes(range.today) || anchors.includes(todayStr(kem))) {
      return {
        mood: "senang",
        text: "Gajian! Kerja kerasmu akhirnya terbayar. Sisihkan sedikit untuk brankas selagi hangat, ya?",
      };
    }

    // 3) Laju pengeluaran PRIBADI melewati siklus lalu (kewajiban terpisah
    // tidak dihitung — memakai uraian per item seperti dashboard).
    if (range.prevStart) {
      const personalOf = (t) => {
        if (t.kategori === "Penyesuaian Saldo") return 0;
        const items = Array.isArray(t.items) ? t.items : [];
        if (!items.length) return Number(t.nominal) || 0;
        let s = 0;
        items.forEach((it) => {
          if (it.kelompok !== "Kewajiban Terpisah") s += (Number(it.harga) || 0) * (Number(it.qty) || 1);
        });
        return s;
      };
      let cur = 0, prev = 0;
      txs.forEach((t) => {
        if (t.tipe !== "pengeluaran") return;
        if (t.tanggal >= range.start) cur += personalOf(t);
        else if (t.tanggal >= range.prevStart && t.tanggal < range.start) prev += personalOf(t);
      });
      if (prev > 0 && cur > prev * 1.15) {
        return {
          mood: "khawatir",
          text: "Belanja pribadimu siklus ini " + fmt(cur) + ", sudah melewati siklus lalu (" + fmt(prev) + "). Pelan-pelan ya, Hachi temani.",
        };
      }
    }

    // 4) Kemajuan misi tabungan
    const goalsRaw = data.goals;
    const goals = Array.isArray(goalsRaw) ? goalsRaw : (goalsRaw && typeof goalsRaw === "object" ? Object.values(goalsRaw) : []);
    for (const g of goals) {
      const target = Number(g.targetAmount) || 0;
      const saved = Number(g.savedAmount) || 0;
      if (target > 0 && saved >= target) {
        return { mood: "senang", text: "Hebat! Misi \"" + g.name + "\" sudah mencapai target " + fmt(target) + ". Hachi bangga padamu!" };
      }
      if (target > 0 && saved / target >= 0.5) {
        return {
          mood: "senang",
          text: "Misi \"" + g.name + "\" sudah " + Math.round((saved / target) * 100) + "% (" + fmt(saved) + " dari " + fmt(target) + "). Sedikit lagi!",
        };
      }
    }

    // 5) Sapaan sesuai jam + kas + motivasi
    const h = new Date().getHours();
    const sapa = h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 19 ? "Selamat sore" : "Selamat malam";
    if (motivasiIdx === null) {
      motivasiIdx = Math.floor(Date.now() / 86400000) % MOTIVASI.length;
    }
    const kas = kasTunai();
    const kasInfo = kas !== null ? " Kas di tanganmu " + fmt(kas) + "." : "";
    return { mood: "ramah", text: sapa + "! " + MOTIVASI[motivasiIdx] + kasInfo };
  }

  // --- Kartu sapaan diam di dasbor (pengganti maskot keliling) ---
  // Hachi kini duduk manis di satu kartu ringkas di dasbor: gambar diam
  // karya Gmr (bingkai bertumpu), teks dari mesin sapaan yang sama, dan
  // ketukan pada kartu mengganti kalimat penyemangat. Tidak ada lagi
  // sosok bergerak yang menutupi layar.
  const WALK_FRAMES = (window.HACHI_ART && Array.isArray(window.HACHI_ART.walk)) ? window.HACHI_ART.walk : [];
  const IDLE_FRAME = 2;
  let cardStarted = false;

  function renderHachiCard() {
    const img = document.getElementById("hachi-card-img");
    const txt = document.getElementById("hachi-card-text");
    if (!txt) return;
    if (img && WALK_FRAMES.length && !img.getAttribute("src")) {
      img.src = WALK_FRAMES[Math.min(IDLE_FRAME, WALK_FRAMES.length - 1)];
    }
    let m = null;
    try { m = computeMessage(); } catch (e) { /* abaikan */ }
    if (m && m.text && txt.textContent !== m.text) txt.textContent = m.text;
  }

  window.hachiCardTap = function () {
    motivasiIdx = (motivasiIdx === null ? 0 : motivasiIdx + 1) % MOTIVASI.length;
    renderHachiCard();
  };

  function initHachiCard() {
    if (cardStarted) return;
    cardStarted = true;
    const iv = setInterval(function () {
      if (window.AuraState && AuraState.data && Array.isArray(AuraState.data.transactions)) renderHachiCard();
    }, 1500);
    setTimeout(function () { clearInterval(iv); }, 120000);
    setInterval(renderHachiCard, 60000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initHachiCard);
  else initHachiCard();
})();
