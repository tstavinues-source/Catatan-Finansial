// ============================================================================
// Sinkronisasi widget layar utama (Android) — hanya aktif di aplikasi native.
// Menulis angka ringkas {kas, total, updatedAt} ke Capacitor Preferences
// (SharedPreferences "CapacitorStorage", kunci "aurafi_widget") yang dibaca
// BalanceWidgetProvider untuk widget saldo. Di web handler ini diam total.
// Saldo dihitung dengan aturan tanda yang sama seperti dashboard:
// pemasukan/mutasi_masuk/setor_tunai menambah, pengeluaran/mutasi_keluar/
// tarik_tunai/nabung mengurangi, selalu per dompet.
// ============================================================================
(function () {
  const Cap = window.Capacitor;
  if (!Cap || typeof Cap.isNativePlatform !== "function" || !Cap.isNativePlatform()) return;
  const Prefs = Cap.Plugins && Cap.Plugins.Preferences;
  if (!Prefs) return;

  const POS = { pemasukan: 1, mutasi_masuk: 1, setor_tunai: 1 };
  const NEG = { pengeluaran: 1, mutasi_keluar: 1, tarik_tunai: 1, nabung: 1 };
  const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  let lastFingerprint = "";

  function compute() {
    const data = (window.AuraState && window.AuraState.data) || {};
    const txs = data.transactions || [];
    const wallets = data.wallets || [];
    const perWallet = {};
    txs.forEach((t) => {
      if (!t || t.is_deleted || !t.wallet_id) return;
      let sign = 0;
      if (POS[t.tipe]) sign = 1;
      else if (NEG[t.tipe]) sign = -1;
      else return;
      perWallet[t.wallet_id] = (perWallet[t.wallet_id] || 0) + sign * (Number(t.nominal) || 0);
    });
    let total = 0;
    Object.keys(perWallet).forEach((k) => { total += perWallet[k]; });
    let kas = 0;
    const dw =
      wallets.find((w) => w && typeof w.name === "string" && w.name.toLowerCase().includes("dompet hidup")) ||
      wallets.find((w) => w && (w.type === "tunai" || w.tipe === "tunai"));
    if (dw) kas = perWallet[dw.id] || 0;
    return { kas: kas, total: total, count: txs.length };
  }

  function computePesan(kas) {
    // Pesan singkat Hachi untuk widget — logika ringan dari data yang sama:
    // kewajiban belum tercatat lebih dulu, sisanya sapaan + keadaan kas.
    try {
      const data = (window.AuraState && window.AuraState.data) || {};
      const S = data.settings || {};
      const txs = (data.transactions || []).filter((t) => t && !t.is_deleted);
      const anchors = (Array.isArray(S.cycleAnchors) ? S.cycleAnchors.slice() : []).sort();
      const now = new Date();
      const p = (x) => String(x).padStart(2, "0");
      const today = now.getFullYear() + "-" + p(now.getMonth() + 1) + "-" + p(now.getDate());
      let start = null;
      for (const a of anchors) if (a <= today) start = a;
      const remsRaw = S.obligationReminders;
      const rems = Array.isArray(remsRaw) ? remsRaw : remsRaw && typeof remsRaw === "object" ? Object.values(remsRaw) : [];
      for (const r of rems) {
        const merch = String(r.merchantName || "").trim().toLowerCase();
        const paid = txs.some((t) => {
          if (!start || t.tanggal < start || t.tipe !== "pengeluaran") return false;
          if (merch) return String(t.merchantName || t.storeName || "").trim().toLowerCase() === merch;
          return t.kategori === r.kategori;
        });
        if (!paid) return "Jangan lupa: " + r.name + " belum tercatat siklus ini.";
      }
      const h = now.getHours();
      const sapa = h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 19 ? "Selamat sore" : "Selamat malam";
      return sapa + "! Kas ¥" + Math.round(kas).toLocaleString("ja-JP") + " — tetap semangat mencatat.";
    } catch (e) {
      return "Tetap semangat mencatat!";
    }
  }

  async function syncOnce() {
    try {
      if (!window.AuraState || !window.AuraState.user || !window.AuraState.user.uid) return;
      const r = compute();
      const pesan = computePesan(r.kas);
      const fp = r.kas + "|" + r.total + "|" + r.count + "|" + pesan;
      if (fp === lastFingerprint) return;
      lastFingerprint = fp;
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const label = now.getDate() + " " + BULAN[now.getMonth()] + " " + hh + ":" + mm;
      await Prefs.set({
        key: "aurafi_widget",
        value: JSON.stringify({ kas: r.kas, total: r.total, updatedAt: label, pesan: pesan }),
      });
    } catch (e) {
      console.warn("[Widget] Sinkronisasi gagal:", e);
    }
  }

  setInterval(syncOnce, 15000);
  setTimeout(syncOnce, 4000);
})();
