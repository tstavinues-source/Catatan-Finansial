// ============================================================================
// LAPORAN TUTUP BUKU — analisis jujur otomatis + grafik + PDF.
// Menggantikan alur lama yang hanya menghasilkan narasi teks dari AI:
// kini laporan berisi angka nyata, grafik, dan analisis aturan-berbasis-data
// yang jujur (termasuk menyebut pengeluaran tak tercatat bila ada). Narasi AI
// tetap tersedia sebagai pelengkap opsional. Laporan juga tersimpan otomatis
// ke Brankas Arsip saat siklus gajian baru mulai.
// Ekspor PDF: pengguna memilih bagian lewat centang (ringkasan, grafik,
// pemasukan, pengeluaran dengan/tanpa item, rekap harian, perbandingan).
// ============================================================================
(function () {
  "use strict";

  let charts = [];
  let current = null; // { rep, prev, name, aiText }

  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    window.AuraUtils && AuraUtils.escapeHtml
      ? AuraUtils.escapeHtml(String(s == null ? "" : s))
      : String(s == null ? "" : s);
  const fmt = (v) =>
    typeof window.convertAndFormatCurrency === "function"
      ? window.convertAndFormatCurrency(v)
      : "¥" + Math.round(v).toLocaleString("ja-JP");
  const fmtPlain = (v) => "¥" + Math.round(v).toLocaleString("ja-JP");
  const PALETTE = ["#e08a4c", "#a3b86b", "#7fb2d9", "#e26d6d", "#c792ea", "#f2c14e", "#4ecdc4", "#ff9f68", "#95e1d3", "#f38181"];

  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function localTs(dateStr) {
    const p = String(dateStr).split("-").map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1).getTime();
  }
  function tglIndo(ts) {
    return new Date(ts).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }

  // ---------- perhitungan laporan ----------
  function computeReport(start, end) {
    const txs = (window.AuraState && AuraState.data && AuraState.data.transactions) || [];
    const rep = {
      start, end, income: 0, expense: 0, personal: 0, obligation: 0, savings: 0,
      unrecorded: 0, unrecordedCount: 0, byCategory: {}, byItemCategory: {}, byMerchant: {},
      daily: {}, expenseTx: [], incomeTx: [], largest: null,
    };
    rep.days = Math.max(1, Math.round((end - start) / 86400000) + 1);
    for (let t = start; t <= end; t += 86400000) rep.daily[dayKey(t)] = { expense: 0, income: 0 };

    txs.forEach((trx) => {
      if (!trx || trx.is_deleted) return;
      const tTime = new Date(trx.tanggal || trx.createdAt).getTime();
      if (isNaN(tTime) || tTime < start || tTime > end) return;
      const cur = trx.mata_uang || "JPY";
      const val = AuraUtils.convertCurrency(trx.nominal || 0, cur);
      const key = dayKey(tTime);
      if (trx.tipe === "pemasukan") { // mutasi antar dompet BUKAN pemasukan — jangan menggelembungkan laporan
        rep.income += val;
        rep.incomeTx.push(trx);
        if (rep.daily[key]) rep.daily[key].income += val;
      } else if (trx.tipe === "pengeluaran") {
        rep.expense += val;
        rep.expenseTx.push(trx);
        if (rep.daily[key]) rep.daily[key].expense += val;
        const cat = trx.kategori || "Lainnya";
        rep.byCategory[cat] = (rep.byCategory[cat] || 0) + val;
        const merchant = String(trx.merchantName || trx.storeName || "Tanpa Nama").trim() || "Tanpa Nama";
        rep.byMerchant[merchant] = (rep.byMerchant[merchant] || 0) + val;
        if (!rep.largest || val > rep.largest.val) {
          rep.largest = { val, merchant, tanggal: trx.tanggal, kategori: cat };
        }
        if (merchant.toUpperCase() === "TIDAK TERCATAT") {
          rep.unrecorded += val;
          rep.unrecordedCount++;
        }
        const items = trx.items || [];
        if (!items.length) {
          if (cat !== "Penyesuaian Saldo") rep.personal += val;
        } else {
          items.forEach((it) => {
            const iv = AuraUtils.convertCurrency((Number(it.harga) || 0) * (Number(it.qty) || 1), cur);
            const ic = it.kategori_barang || "Lainnya";
            rep.byItemCategory[ic] = (rep.byItemCategory[ic] || 0) + iv;
            if (cat === "Penyesuaian Saldo") return;
            if (it.kelompok === "Kewajiban Terpisah") rep.obligation += iv;
            else rep.personal += iv;
          });
        }
      } else if (trx.tipe === "nabung") {
        rep.savings += val;
      }
    });

    rep.surplus = rep.income - rep.expense;
    rep.activeDays = Object.values(rep.daily).filter((d) => d.expense > 0).length;
    rep.dailyAverage = rep.expense / rep.days;
    return rep;
  }

  function prevRangeFor(range) {
    if (range && typeof range.prevStart === "number" && typeof range.prevEnd === "number" && range.prevEnd > range.prevStart) {
      return { start: range.prevStart, end: range.prevEnd };
    }
    const span = range.end - range.start;
    return { start: range.start - span - 86400000, end: range.start - 86400000 };
  }

  function pctChange(now, before) {
    if (!before) return null;
    return ((now - before) / before) * 100;
  }

  // ---------- analisis jujur (aturan berbasis data) ----------
  function buildInsights(rep, prev) {
    const out = [];
    const add = (tone, icon, text) => out.push({ tone, icon, text });

    if (rep.income > 0) {
      const ratio = (rep.expense / rep.income) * 100;
      if (rep.surplus >= 0) {
        add("good", "fa-circle-check",
          `Siklus ini surplus ${fmt(rep.surplus)}. Pengeluaranmu ${ratio.toFixed(0)}% dari pemasukan — masih ada sisa untuk ditabung atau dialihkan.`);
      } else {
        add("bad", "fa-triangle-exclamation",
          `Siklus ini defisit ${fmt(Math.abs(rep.surplus))}: pengeluaran ${ratio.toFixed(0)}% dari pemasukan. Ini pola yang tidak bisa diulang tiap siklus tanpa menggerus saldo.`);
      }
      if (ratio > 90 && rep.surplus >= 0) {
        add("warn", "fa-gauge-high",
          `Rasionya tipis: ${ratio.toFixed(0)}% pemasukan habis untuk pengeluaran. Satu pengeluaran tak terduga bisa membalikkan siklus ini jadi defisit.`);
      }
    }

    if (prev) {
      const dPersonal = pctChange(rep.personal, prev.personal);
      if (dPersonal !== null && Math.abs(dPersonal) >= 10) {
        add(dPersonal > 0 ? "warn" : "good", "fa-chart-line",
          `Belanja pribadi ${dPersonal > 0 ? "naik" : "turun"} ${Math.abs(dPersonal).toFixed(0)}% dibanding siklus lalu (${fmt(prev.personal)} → ${fmt(rep.personal)}).`);
      }
      const dExpense = pctChange(rep.expense, prev.expense);
      if (dExpense !== null && Math.abs(dExpense) >= 10) {
        add(dExpense > 0 ? "warn" : "good", "fa-scale-balanced",
          `Total pengeluaran ${dExpense > 0 ? "naik" : "turun"} ${Math.abs(dExpense).toFixed(0)}% dari siklus lalu (${fmt(prev.expense)} → ${fmt(rep.expense)}).`);
      }
    }

    const cats = Object.entries(rep.byCategory).sort((a, b) => b[1] - a[1]);
    if (cats.length && rep.expense > 0) {
      const [name, val] = cats[0];
      add("info", "fa-basket-shopping",
        `Kategori terbesar: ${name} sebesar ${fmt(val)} (${((val / rep.expense) * 100).toFixed(0)}% dari seluruh pengeluaran).`);
    }
    if (rep.expense > 0 && rep.obligation > 0) {
      add("info", "fa-file-invoice",
        `${((rep.obligation / rep.expense) * 100).toFixed(0)}% pengeluaranmu adalah kewajiban terpisah (${fmt(rep.obligation)}) — istri, sewa, asuransi, pajak, dan utilitas. Belanja pribadimu sendiri ${fmt(rep.personal)}.`);
    }
    if (rep.largest) {
      add("info", "fa-receipt",
        `Pengeluaran tunggal terbesar: ${rep.largest.merchant} sebesar ${fmt(rep.largest.val)} pada ${esc(rep.largest.tanggal || "")} (${rep.largest.kategori}).`);
    }
    const merchants = Object.entries(rep.byMerchant).sort((a, b) => b[1] - a[1]);
    if (merchants.length) {
      add("info", "fa-store",
        `Pedagang teratas: ${merchants.slice(0, 3).map(([m, v]) => `${m} ${fmt(v)}`).join(", ")}.`);
    }
    add("info", "fa-calendar-day",
      `Rata-rata pengeluaran ${fmt(rep.dailyAverage)} per hari, dengan pengeluaran tercatat di ${rep.activeDays} dari ${rep.days} hari.`);
    if (rep.unrecorded > 0) {
      add("warn", "fa-eye-slash",
        `Jujur saja: ada ${fmt(rep.unrecorded)} dari ${rep.unrecordedCount} catatan "tidak tercatat" — uang keluar tanpa rincian. Selama ini ada, laporanmu belum 100% utuh.`);
    }
    if (rep.savings > 0) {
      add("good", "fa-piggy-bank",
        `Kamu menyisihkan ${fmt(rep.savings)} ke Brankas siklus ini. Konsistensi seperti ini yang membuat saldo tumbuh.`);
    } else if (rep.surplus > 0) {
      add("warn", "fa-piggy-bank",
        `Belum ada setoran ke Brankas siklus ini, padahal ada surplus ${fmt(rep.surplus)}. Sisihkan dulu sebelum sisanya terasa seperti uang bebas.`);
    }
    return out;
  }

  // ---------- grafik ----------
  function destroyCharts() {
    charts.forEach((c) => { try { c.destroy(); } catch (e) {} });
    charts = [];
  }
  function makeChart(id, config) {
    const el = $(id);
    if (!el || typeof window.Chart === "undefined") return null;
    try {
      const c = new window.Chart(el, config);
      charts.push(c);
      return c;
    } catch (e) {
      return null;
    }
  }
  function renderCharts(rep, prev) {
    destroyCharts();
    const days = Object.keys(rep.daily).sort();
    makeChart("lap-chart-harian", {
      type: "bar",
      data: {
        labels: days.map((d) => d.slice(8) + "/" + d.slice(5, 7)),
        datasets: [
          { type: "line", label: "Rata-rata", data: days.map(() => Math.round(rep.dailyAverage)), borderColor: "#f2c14e", borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5 },
          { type: "bar", label: "Pengeluaran", data: days.map((d) => Math.round(rep.daily[d].expense)), backgroundColor: "rgba(224,138,76,0.75)", borderRadius: 4 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { maxTicksLimit: 8, font: { size: 9 } } }, y: { ticks: { font: { size: 9 } } } } },
    });

    const cats = Object.entries(rep.byCategory).sort((a, b) => b[1] - a[1]);
    const top = cats.slice(0, 7);
    const rest = cats.slice(7).reduce((s, [, v]) => s + v, 0);
    if (rest > 0) top.push(["Lainnya", rest]);
    makeChart("lap-chart-kategori", {
      type: "doughnut",
      data: { labels: top.map(([k]) => k), datasets: [{ data: top.map(([, v]) => Math.round(v)), backgroundColor: PALETTE, borderWidth: 1, borderColor: "rgba(0,0,0,0.35)" }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right", labels: { boxWidth: 9, font: { size: 9 } } } } },
    });

    if (prev) {
      makeChart("lap-chart-banding", {
        type: "bar",
        data: {
          labels: ["Pemasukan", "Pengeluaran", "Pribadi", "Kewajiban"],
          datasets: [
            { label: "Siklus lalu", data: [prev.income, prev.expense, prev.personal, prev.obligation].map(Math.round), backgroundColor: "rgba(127,178,217,0.7)", borderRadius: 4 },
            { label: "Siklus ini", data: [rep.income, rep.expense, rep.personal, rep.obligation].map(Math.round), backgroundColor: "rgba(224,138,76,0.85)", borderRadius: 4 },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 9, font: { size: 9 } } } }, scales: { x: { ticks: { font: { size: 9 } } }, y: { ticks: { font: { size: 9 } } } } },
      });
    }
  }

  // ---------- modal laporan ----------
  function summaryCard(label, value, cls) {
    return `<div class="bg-black/30 border border-[var(--border-glass)] rounded-xl p-3">
      <p class="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">${label}</p>
      <p class="font-mono font-bold text-sm mt-1 ${cls || "text-white"}">${value}</p></div>`;
  }

  function openReport(range, name) {
    const rep = computeReport(range.start, range.end);
    if (rep.income === 0 && rep.expense === 0) {
      if (window.showToast) window.showToast("Tidak ada transaksi pada rentang ini untuk dilaporkan.", true);
      return;
    }
    const pr = prevRangeFor(range);
    const prev = computeReport(pr.start, pr.end);
    const hasPrev = prev.income > 0 || prev.expense > 0;
    current = { rep, prev: hasPrev ? prev : null, name, aiText: "" };

    const insights = buildInsights(rep, current.prev);
    current.insights = insights;

    $("lap-title-name").textContent = name;
    $("lap-title-period").textContent = tglIndo(rep.start) + " — " + tglIndo(rep.end);
    $("lap-summary").innerHTML =
      summaryCard("Pemasukan", fmt(rep.income), "text-emerald-400") +
      summaryCard("Pengeluaran", fmt(rep.expense), "text-rose-400") +
      summaryCard("Sisa", fmt(rep.surplus), rep.surplus >= 0 ? "text-emerald-400" : "text-rose-400") +
      summaryCard("Rata-rata Harian", fmt(rep.dailyAverage));
    $("lap-split").innerHTML =
      summaryCard("Belanja Pribadi", fmt(rep.personal), "text-amber-300") +
      summaryCard("Kewajiban Terpisah", fmt(rep.obligation), "text-sky-300") +
      summaryCard("Setoran Brankas", fmt(rep.savings), "text-violet-300") +
      summaryCard("Hari Aktif Belanja", rep.activeDays + " / " + rep.days + " hari");
    $("lap-insights").innerHTML = insights
      .map((i) => {
        const color = i.tone === "good" ? "text-emerald-400" : i.tone === "warn" ? "text-amber-400" : i.tone === "bad" ? "text-rose-400" : "text-sky-300";
        return `<div class="flex gap-3 bg-black/20 border border-[var(--border-glass)] rounded-xl p-3">
          <i class="fa-solid ${i.icon} ${color} mt-0.5"></i>
          <p class="text-[11px] leading-relaxed text-[var(--text-main)]">${esc(i.text)}</p></div>`;
      })
      .join("");
    const aiBox = $("lap-ai-box");
    if (aiBox) aiBox.classList.add("hidden");
    const bandingWrap = $("lap-banding-wrap");
    if (bandingWrap) bandingWrap.classList.toggle("hidden", !hasPrev);

    if (typeof window.showModal === "function") window.showModal("modal-laporan");
    setTimeout(() => renderCharts(rep, current.prev), 60);
  }

  window.openClosingReport = function () {
    const range = AuraUtils.getPeriodRange();
    const defName = "Siklus " + tglIndo(range.start);
    openReport(range, defName);
  };

  // Gantikan alur lama (tombol Tutup Buku memanggil ini).
  window.closeAccountingBook = window.openClosingReport;

  window.requestReportAI = async function () {
    if (!current) return;
    const rep = current.rep;
    const btn = $("lap-btn-ai");
    if (btn) btn.disabled = true;
    try {
      const topCats = Object.entries(rep.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 4)
        .map((c) => `${c[0]} (${fmtPlain(c[1])})`).join(", ");
      const sysPrompt = `Kamu adalah Auditor Finansial Profesional dan Wealth Manager pribadi dari pengguna AuraFi OS.
TUGAS: Buat narasi evaluasi Laporan Tutup Buku untuk "${current.name}".
DATA FAKTUAL:
- Total Pemasukan: ${fmtPlain(rep.income)}
- Total Pengeluaran: ${fmtPlain(rep.expense)}
- Sisa Dana: ${fmtPlain(rep.surplus)}
- Belanja Pribadi: ${fmtPlain(rep.personal)}; Kewajiban Terpisah: ${fmtPlain(rep.obligation)}
- Top Kategori: ${topCats || "Tidak ada"}
ATURAN: 3 paragraf narasi yang elegan, analitis, blak-blakan; bahas rasio pengeluaran vs pemasukan dan beri saran konkrit siklus depan. Output murni teks, boleh markdown **bold**.`;
      const text = await window.executeAIWithFallback([{ role: "user", content: "Buat narasi evaluasi sekarang." }], sysPrompt, false);
      current.aiText = text || "";
      const box = $("lap-ai-box");
      const body = $("lap-ai-text");
      if (box && body) {
        body.textContent = current.aiText;
        box.classList.remove("hidden");
      }
      if (window.showToast) window.showToast("Narasi AI selesai.");
    } catch (e) {
      if (window.showToast) window.showToast("Narasi AI gagal — laporan angka & analisis tetap lengkap.", true);
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.saveClosingReport = async function () {
    if (!current) return;
    const rep = current.rep;
    try {
      const lines = (current.insights || []).map((i) => "- " + i.text).join("\n");
      await window.FirebaseService.saveArchive({
        name: current.name,
        startDate: new Date(rep.start).toISOString(),
        endDate: new Date(rep.end).toISOString(),
        income: rep.income,
        expense: rep.expense,
        report: "Ringkasan analisis otomatis:\n" + lines + (current.aiText ? "\n\nNarasi AI:\n" + current.aiText : ""),
        summary: {
          personal: rep.personal, obligation: rep.obligation, savings: rep.savings,
          surplus: rep.surplus, dailyAverage: Math.round(rep.dailyAverage),
          byCategory: rep.byCategory,
        },
        createdAt: new Date().toISOString(),
      });
      if (window.showToast) window.showToast("Laporan tersimpan di Brankas Arsip.");
    } catch (e) {
      if (window.showToast) window.showToast("Gagal menyimpan laporan.", true);
    }
  };

  // ---------- PDF ----------
  window.openPdfOptions = function () {
    if (!current) return;
    if (typeof window.showModal === "function") window.showModal("modal-pdf-opsi");
  };

  function loadJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = () => (window.jspdf && window.jspdf.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error("jsPDF kosong")));
      s.onerror = () => reject(new Error("CDN jsPDF tidak terjangkau"));
      document.head.appendChild(s);
    });
  }

  window.generateReportPDF = async function () {
    if (!current) return;
    const sec = {
      ringkasan: $("pdf-sec-ringkasan") && $("pdf-sec-ringkasan").checked,
      grafik: $("pdf-sec-grafik") && $("pdf-sec-grafik").checked,
      pemasukan: $("pdf-sec-pemasukan") && $("pdf-sec-pemasukan").checked,
      pengeluaranItem: $("pdf-sec-pengeluaran-item") && $("pdf-sec-pengeluaran-item").checked,
      pengeluaranRingkas: $("pdf-sec-pengeluaran-ringkas") && $("pdf-sec-pengeluaran-ringkas").checked,
      harian: $("pdf-sec-harian") && $("pdf-sec-harian").checked,
      perbandingan: $("pdf-sec-perbandingan") && $("pdf-sec-perbandingan").checked,
    };
    if (typeof window.closeModal === "function") window.closeModal("modal-pdf-opsi");
    if (window.showToast) window.showToast("Menyusun PDF...");

    let jsPDF;
    try {
      jsPDF = await loadJsPDF();
    } catch (e) {
      if (window.showToast) window.showToast("Gagal memuat pustaka PDF — periksa koneksi internet.", true);
      return;
    }

    const rep = current.rep;
    const prev = current.prev;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 40;
    let y = 0;

    function newPage() { doc.addPage(); y = M; }
    function ensure(space) { if (y + space > H - M) newPage(); }
    function title(text, size, gap) {
      ensure(size + (gap || 8));
      doc.setFont("helvetica", "bold"); doc.setFontSize(size); doc.setTextColor(30, 41, 59);
      doc.text(text, M, y + size); y += size + (gap || 8);
    }
    function line(text, size, opts) {
      size = size || 10;
      const wrapped = doc.splitTextToSize(String(text), W - M * 2);
      ensure(wrapped.length * (size + 2) + 4);
      doc.setFont("helvetica", (opts && opts.bold) ? "bold" : "normal"); doc.setFontSize(size);
      doc.setTextColor(51, 65, 85);
      wrapped.forEach((w) => { doc.text(w, M, y + size); y += size + 2; });
      y += 4;
    }
    function row(cols, widths, bold) {
      ensure(14);
      doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(9); doc.setTextColor(51, 65, 85);
      let x = M;
      cols.forEach((c, i) => {
        const txt = doc.splitTextToSize(String(c), widths[i] - 4)[0] || "";
        doc.text(txt, x, y + 10);
        x += widths[i];
      });
      y += 14;
    }

    // Sampul ringkas
    doc.setFillColor(224, 138, 76); doc.rect(0, 0, W, 64, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(255, 255, 255);
    doc.text("AuraFi — Laporan Tutup Buku", M, 30);
    doc.setFontSize(11); doc.setFont("helvetica", "normal");
    doc.text(current.name + " • " + tglIndo(rep.start) + " — " + tglIndo(rep.end), M, 50);
    y = 88;
    line("Dibuat otomatis pada " + new Date().toLocaleString("id-ID") + ". Mata uang ditampilkan sesuai pengaturan aplikasi; angka dasar dalam JPY.", 8);

    if (sec.ringkasan) {
      title("Ringkasan", 14);
      row(["Pemasukan", fmt(rep.income)], [180, 200], true);
      row(["Pengeluaran", fmt(rep.expense)], [180, 200], true);
      row(["Sisa (surplus/defisit)", fmt(rep.surplus)], [180, 200], true);
      row(["Belanja pribadi", fmt(rep.personal)], [180, 200]);
      row(["Kewajiban terpisah", fmt(rep.obligation)], [180, 200]);
      row(["Setoran Brankas", fmt(rep.savings)], [180, 200]);
      row(["Rata-rata pengeluaran harian", fmt(rep.dailyAverage)], [180, 200]);
      y += 4;
      title("Analisis Jujur Otomatis", 12);
      (current.insights || []).forEach((i) => line("• " + i.text, 10));
      if (current.aiText) {
        title("Narasi AI", 12);
        line(current.aiText.replace(/\*\*/g, ""), 10);
      }
    }

    if (sec.grafik && charts.length) {
      title("Grafik", 14);
      const labels = ["Pengeluaran Harian", "Pengeluaran per Kategori", "Perbandingan Siklus"];
      charts.forEach((c, i) => {
        try {
          const img = c.toBase64Image();
          const w = W - M * 2, h = w * 0.45;
          ensure(h + 22);
          doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(30, 41, 59);
          doc.text(labels[i] || "Grafik", M, y + 10); y += 16;
          doc.addImage(img, "PNG", M, y, w, h); y += h + 10;
        } catch (e) {}
      });
    }

    if (sec.perbandingan && prev) {
      title("Perbandingan dengan Siklus Sebelumnya", 14);
      const w4 = [150, 130, 130, 105];
      row(["Ukuran", "Siklus lalu", "Siklus ini", "Selisih"], w4, true);
      [["Pemasukan", prev.income, rep.income], ["Pengeluaran", prev.expense, rep.expense],
       ["Belanja pribadi", prev.personal, rep.personal], ["Kewajiban", prev.obligation, rep.obligation]
      ].forEach(([label, a, b]) => {
        const d = pctChange(b, a);
        row([label, fmt(a), fmt(b), d === null ? "—" : (d >= 0 ? "+" : "") + d.toFixed(0) + "%"], w4);
      });
      y += 4;
    }

    if (sec.harian) {
      title("Rekap Harian", 14);
      const w3 = [120, 180, 180];
      row(["Tanggal", "Pemasukan", "Pengeluaran"], w3, true);
      Object.keys(rep.daily).sort().forEach((d) => {
        const v = rep.daily[d];
        row([d, v.income ? fmt(v.income) : "—", v.expense ? fmt(v.expense) : "—"], w3);
      });
      y += 4;
    }

    if (sec.pemasukan && rep.incomeTx.length) {
      title("Pemasukan Lengkap", 14);
      const w4 = [70, 200, 110, 100];
      row(["Tanggal", "Sumber", "Kategori", "Jumlah"], w4, true);
      rep.incomeTx.slice().sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal))).forEach((t) => {
        row([t.tanggal || "", t.merchantName || t.storeName || "", t.kategori || "", fmt(AuraUtils.convertCurrency(t.nominal || 0, t.mata_uang || "JPY"))], w4);
      });
      y += 4;
    }

    if (sec.pengeluaranRingkas && rep.expenseTx.length) {
      title("Pengeluaran (Tanpa Item)", 14);
      const w4 = [70, 200, 110, 100];
      row(["Tanggal", "Merchant", "Kategori", "Jumlah"], w4, true);
      rep.expenseTx.slice().sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal))).forEach((t) => {
        row([t.tanggal || "", t.merchantName || t.storeName || "", t.kategori || "", fmt(AuraUtils.convertCurrency(t.nominal || 0, t.mata_uang || "JPY"))], w4);
      });
      y += 4;
    }

    if (sec.pengeluaranItem && rep.expenseTx.length) {
      title("Pengeluaran Lengkap Beserta Item", 14);
      rep.expenseTx.slice().sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal))).forEach((t) => {
        const val = AuraUtils.convertCurrency(t.nominal || 0, t.mata_uang || "JPY");
        line(`${t.tanggal || ""} • ${t.merchantName || t.storeName || ""} • ${t.kategori || ""} • ${fmt(val)}`, 10, { bold: true });
        (t.items || []).forEach((it) => {
          const iv = AuraUtils.convertCurrency((Number(it.harga) || 0) * (Number(it.qty) || 1), t.mata_uang || "JPY");
          line(`    - ${it.nama_barang || "Item"} (${it.qty || 1} x) — ${fmt(iv)}`, 9);
        });
      });
    }

    // Kaki halaman
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
      doc.text("AuraFi • Laporan Tutup Buku • Halaman " + i + " dari " + pages, M, H - 18);
    }

    const fileName = "Laporan-AuraFi-" + current.name.replace(/[^a-zA-Z0-9]+/g, "-") + ".pdf";
    try {
      const Cap = window.Capacitor;
      if (Cap && Cap.Plugins && Cap.Plugins.Filesystem && Cap.Plugins.Share) {
        const dataUri = doc.output("datauristring");
        const base64 = dataUri.split(",")[1];
        const written = await Cap.Plugins.Filesystem.writeFile({ path: fileName, data: base64, directory: "CACHE" });
        await Cap.Plugins.Share.share({ title: fileName, url: written.uri, dialogTitle: "Simpan / bagikan laporan PDF" });
      } else {
        doc.save(fileName);
      }
      if (window.showToast) window.showToast("PDF laporan dibuat.");
    } catch (e) {
      try { doc.save(fileName); if (window.showToast) window.showToast("PDF laporan dibuat."); }
      catch (e2) { if (window.showToast) window.showToast("Gagal membuat PDF di perangkat ini.", true); }
    }
  };

  // ---------- otomatis saat siklus baru mulai ----------
  let autoChecked = false;
  function autoReportCheck() {
    if (autoChecked) return;
    const S = (window.AuraState && AuraState.data && AuraState.data.settings) || {};
    const anchors = Array.isArray(S.cycleAnchors) ? S.cycleAnchors.slice().sort() : [];
    if (!window.AuraState || !AuraState.user || !AuraState.user.uid || anchors.length < 2) return;
    if (!Array.isArray(AuraState.data.transactions)) return;
    autoChecked = true;

    const last = anchors[anchors.length - 1];
    const prevAnchor = anchors[anchors.length - 2];
    if (S.lastAutoReportAnchor === last) return;

    const start = localTs(prevAnchor);
    const end = localTs(last) - 1;
    const rep = computeReport(start, end);
    const finish = (saved) => {
      if (typeof FirebaseService !== "undefined" && FirebaseService.updateSettings) {
        FirebaseService.updateSettings({ lastAutoReportAnchor: last }).catch(() => {});
      }
      if (saved && window.showToast) {
        window.showToast("Siklus baru mulai — laporan tutup buku siklus lalu tersimpan di Brankas Arsip.");
      }
    };
    if (rep.income === 0 && rep.expense === 0) { finish(false); return; }

    const pr = { start: start - (end - start) - 86400000, end: start - 1 };
    const prev = computeReport(pr.start, pr.end);
    const hasPrev = prev.income > 0 || prev.expense > 0;
    const insights = buildInsights(rep, hasPrev ? prev : null);
    const lines = insights.map((i) => "- " + i.text).join("\n");
    if (typeof FirebaseService !== "undefined" && FirebaseService.saveArchive) {
      FirebaseService.saveArchive({
        name: "Siklus " + prevAnchor,
        startDate: new Date(start).toISOString(),
        endDate: new Date(end).toISOString(),
        income: rep.income, expense: rep.expense,
        report: "Ringkasan analisis otomatis:\n" + lines,
        summary: {
          personal: rep.personal, obligation: rep.obligation, savings: rep.savings,
          surplus: rep.surplus, dailyAverage: Math.round(rep.dailyAverage), byCategory: rep.byCategory,
        },
        auto: true,
        createdAt: new Date().toISOString(),
      }).then(() => finish(true)).catch(() => {});
    }
  }
  setInterval(autoReportCheck, 1500);
})();
