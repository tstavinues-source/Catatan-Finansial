// ============================================================================
// AURA MOTION ENGINE — Tahap 1 (Entrance + Interaction + Financial dasar)
// + Tahap 2: MONEY FLOW PENUH. Saat saldo dompet berubah, sebuah chip
// nominal TERBANG mengikuti kejadiannya: dari kartu dompet asal ke kartu
// tujuan pada mutasi, masuk dari atas pada pemasukan, keluar ke bawah pada
// pengeluaran — dan angka saldo baru bergerak tepat saat chip mendarat.
// "Satu logika, ekspresi per kulit." Gerakan selalu mengikuti DATA: angka
// menghitung ke nilai sebenarnya, saldo yang berubah ditween dari nilai lama
// ke nilai baru (dihitung ulang dari AuraState dengan rumus yang sama persis
// dengan reCalculateAll), kartu transaksi baru meluncur masuk, dan kartu
// mutasi gabungan menampilkan aliran chevron. Data selalu disimpan & tampil
// lebih dulu — animasi hanya memutar ulang perubahannya, tidak pernah
// menahan angka akhir (aturan lintas-tema no. 2).
// Karakter per kulit hidup di css/style.css (blok AURA MOTION ENGINE):
// bayangan/tekan mengikuti variabel kulit yang aktif.
// Kurangi Gerakan: Pengaturan → Tampilan & Tema, tersimpan lokal
// (aurafi_reduce_motion) + cloud (settings.reduceMotion); juga menghormati
// prefers-reduced-motion dari sistem operasi.
// ============================================================================
(function () {
  "use strict";

  // ---------------- Kurangi Gerakan ----------------
  let reduceLocal = localStorage.getItem("aurafi_reduce_motion") === "1";
  const mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function osReduced() { return !!(mq && mq.matches); }
  function reduced() { return reduceLocal || osReduced(); }
  window.AuraMotionReduced = reduced;

  function applyReduceClass() {
    document.documentElement.classList.toggle("aura-reduce-motion", reduced());
    const cb = document.getElementById("set-reduce-motion");
    if (cb) cb.checked = reduceLocal;
  }
  window.AuraMotionSetReduce = function (on) {
    reduceLocal = !!on;
    localStorage.setItem("aurafi_reduce_motion", reduceLocal ? "1" : "0");
    applyReduceClass();
    if (window.AuraState && AuraState.user && AuraState.user.uid && window.FirebaseService) {
      window.FirebaseService.updateSettings({ reduceMotion: reduceLocal }).catch(function () {});
    }
    if (window.showToast) window.showToast(reduceLocal ? "Gerakan dikurangi: animasi dimatikan" : "Gerakan penuh aktif");
  };
  if (mq && mq.addEventListener) mq.addEventListener("change", applyReduceClass);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyReduceClass);
  else applyReduceClass();

  // Sinkron dari cloud sekali per sesi (pola yang sama dengan skins.js).
  const cloudTimer = setInterval(function () {
    const S = (window.AuraState && AuraState.data && AuraState.data.settings) || null;
    if (!window.AuraState || !AuraState.user || !AuraState.user.uid || !S) return;
    if (typeof S.reduceMotion === "boolean" && S.reduceMotion !== reduceLocal) {
      reduceLocal = S.reduceMotion;
      localStorage.setItem("aurafi_reduce_motion", reduceLocal ? "1" : "0");
      applyReduceClass();
    }
    clearInterval(cloudTimer);
  }, 1600);
  setTimeout(function () { clearInterval(cloudTimer); }, 90000);

  // ---------------- Pembantu angka ----------------
  function fmt(n) {
    return window.formatAuraCurrencyCompact ? window.formatAuraCurrencyCompact(n) : String(Math.round(n));
  }
  function tweenNum(el, from, to, ms) {
    if (!el) return;
    if (el._auraTween) cancelAnimationFrame(el._auraTween);
    if (reduced() || ms <= 0 || from === to) { el.textContent = fmt(to); el._auraTween = null; return; }
    const t0 = performance.now();
    const step = function (t) {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (p < 1) el._auraTween = requestAnimationFrame(step);
      else el._auraTween = null;
    };
    el._auraTween = requestAnimationFrame(step);
  }
  function chip(cardEl, delta) {
    if (!cardEl || reduced() || !delta) return;
    const c = document.createElement("span");
    c.className = "aura-chip";
    c.textContent = (delta > 0 ? "+" : "−") + fmt(Math.abs(delta));
    c.style.color = delta > 0 ? "var(--color-income)" : "var(--color-expense)";
    cardEl.appendChild(c);
    setTimeout(function () { c.remove(); }, 1700);
  }

  // ---------------- Saldo: cermin persis perhitungan reCalculateAll --------
  function computeBalances() {
    const S = window.AuraState && AuraState.data;
    if (!S || !S.wallets || !window.AuraUtils) return null;
    const wallets = S.wallets;
    const allTx = S.transactions || [];
    const bal = {};
    Object.keys(wallets).forEach(function (k) { bal[k] = 0; });
    let legacyCash = 0, legacyCashless = 0;
    for (let i = 0; i < allTx.length; i++) {
      const trx = allTx[i];
      const val = AuraUtils.convertCurrency(trx.nominal || 0, trx.mata_uang || "JPY");
      const feeVal = AuraUtils.convertCurrency(Number(trx.admin_fee || 0), trx.mata_uang || "JPY");
      const wId = trx.wallet_id;
      const isLegacyCash = trx.metode_pembayaran === "tunai";
      if (trx.tipe === "pemasukan" || trx.tipe === "mutasi_masuk") {
        if (wId && bal[wId] !== undefined) bal[wId] += val;
        else { if (isLegacyCash) legacyCash += val; else legacyCashless += val; }
      } else if (trx.tipe === "pengeluaran" || trx.tipe === "mutasi_keluar") {
        if (wId && bal[wId] !== undefined) bal[wId] -= val;
        else { if (isLegacyCash) legacyCash -= val; else legacyCashless -= val; }
      } else if (trx.tipe === "tarik_tunai") {
        if (wId && bal[wId] !== undefined) bal[wId] -= (val + feeVal);
        else legacyCashless -= (val + feeVal);
        legacyCash += val;
      } else if (trx.tipe === "setor_tunai") {
        if (wId && bal[wId] !== undefined) bal[wId] -= (val + feeVal);
        else legacyCash -= (val + feeVal);
        legacyCashless += val;
      } else if (trx.tipe === "nabung") {
        if (wId && bal[wId] !== undefined) bal[wId] -= val;
        else { if (isLegacyCash) legacyCash -= val; else legacyCashless -= val; }
      }
    }
    let total = legacyCash + legacyCashless;
    Object.keys(wallets).forEach(function (k) { if (!wallets[k].is_hidden) total += bal[k]; });
    return { per: bal, total: total };
  }

  // ---------------- Skeleton singkat di kartu Net Worth -------------------
  let skelEl = null;
  function showSkeleton() {
    if (skelEl || reduced()) return;
    const lc = document.getElementById("living-core");
    if (!lc) return;
    skelEl = document.createElement("div");
    skelEl.className = "aura-skel";
    lc.appendChild(skelEl);
  }
  function removeSkeleton() { if (skelEl) { skelEl.remove(); skelEl = null; } }
  setTimeout(function () { if (!last) showSkeleton(); }, 300);

  // ---------------- Pengamat perubahan ------------------------------------
  let last = null;
  let entered = false;
  let trxPrimed = false;
  const knownTrx = new Set();

  function entrance() {
    if (entered) return;
    entered = true;
    if (reduced()) return;
    const targets = [];
    const lc = document.getElementById("living-core");
    if (lc) targets.push(lc);
    document.querySelectorAll("#dash-wallets > *").forEach(function (el) { targets.push(el); });
    targets.forEach(function (el, i) {
      el.classList.add("aura-enter");
      el.style.animationDelay = (i * 110) + "ms";
    });
    setTimeout(function () {
      targets.forEach(function (el) { el.classList.remove("aura-enter"); el.style.animationDelay = ""; });
    }, 1400);
  }

  function markNewTrxCards() {
    document.querySelectorAll("[data-trx-card]").forEach(function (el) {
      const id = el.getAttribute("data-trx-card");
      if (!trxPrimed) { knownTrx.add(id); return; }
      if (!knownTrx.has(id)) {
        knownTrx.add(id);
        if (!reduced()) {
          el.classList.add("aura-enter");
          setTimeout(function () { el.classList.remove("aura-enter"); }, 800);
        }
      }
    });
    trxPrimed = true;
  }

  // ---------------- Money Flow: chip terbang mengikuti perubahan saldo -----
  let flowBusy = false;
  function cardCenter(wId) {
    const el = document.querySelector('[data-wallet-card="' + wId + '"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function planFlow(changes) {
    if (flowBusy || !changes.length || changes.length > 2) return null;
    if (changes.length === 2) {
      const neg = changes[0].delta < 0 ? changes[0] : changes[1];
      const pos = changes[0].delta > 0 ? changes[0] : changes[1];
      if (!neg || !pos || neg.delta >= 0 || pos.delta <= 0) return null;
      const a = cardCenter(neg.wId), b = cardCenter(pos.wId);
      if (!a || !b) return null;
      const amt = Math.min(Math.abs(neg.delta), Math.abs(pos.delta));
      return { kind: "transfer", from: a, to: b, label: fmt(amt), dur: 750, cls: "" };
    }
    const c = changes[0];
    const ctr = cardCenter(c.wId);
    if (!ctr) return null;
    if (c.delta < 0) return { kind: "out", from: ctr, to: { x: ctr.x, y: ctr.y + 160 }, label: "−" + fmt(Math.abs(c.delta)), dur: 620, cls: "out" };
    return { kind: "in", from: { x: ctr.x, y: ctr.y - 170 }, to: ctr, label: "+" + fmt(c.delta), dur: 800, cls: "in" };
  }
  function flyFlow(plan) {
    flowBusy = true;
    const el = document.createElement("div");
    el.className = "aura-fly-chip" + (plan.cls ? " " + plan.cls : "");
    el.textContent = plan.label;
    el.style.left = plan.from.x + "px";
    el.style.top = plan.from.y + "px";
    document.body.appendChild(el);
    const mx = (plan.from.x + plan.to.x) / 2;
    const my = plan.kind === "out" ? (plan.from.y + plan.to.y) / 2 : Math.min(plan.from.y, plan.to.y) - 64;
    const t0 = performance.now();
    const step = function (t) {
      const p = Math.min(1, (t - t0) / plan.dur);
      const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const x = (1 - e) * (1 - e) * plan.from.x + 2 * (1 - e) * e * mx + e * e * plan.to.x;
      const y = (1 - e) * (1 - e) * plan.from.y + 2 * (1 - e) * e * my + e * e * plan.to.y;
      el.style.left = x + "px";
      el.style.top = y + "px";
      el.style.opacity = p > .9 ? String(1 - (p - .9) / .1) : "1";
      if (p < 1) requestAnimationFrame(step);
      else { el.remove(); flowBusy = false; }
    };
    requestAnimationFrame(step);
  }

  function check() {
    const b = computeBalances();
    if (!b) return;
    removeSkeleton();
    if (!last) {
      entrance();
      tweenNum(document.getElementById("dash-total-balance"), 0, b.total, 1100);
      Object.keys(b.per).forEach(function (wId) {
        tweenNum(document.querySelector('[data-wallet-bal="' + wId + '"]'), 0, b.per[wId], 1000);
      });
      last = b;
      markNewTrxCards();
      return;
    }
    const prev = last;
    const changes = [];
    Object.keys(b.per).forEach(function (wId) {
      if (b.per[wId] !== prev.per[wId]) changes.push({ wId: wId, delta: b.per[wId] - prev.per[wId] });
    });
    const plan = reduced() ? null : planFlow(changes);
    let delay = 0;
    if (plan) {
      // Selama chip terbang, tampilan angka dikembalikan ke nilai lama —
      // saldo bergerak tepat saat chip mendarat, bukan sebelumnya.
      changes.forEach(function (c) {
        const el = document.querySelector('[data-wallet-bal="' + c.wId + '"]');
        if (el) { if (el._auraTween) cancelAnimationFrame(el._auraTween); el.textContent = fmt(prev.per[c.wId]); }
      });
      if (b.total !== prev.total) {
        const tEl = document.getElementById("dash-total-balance");
        if (tEl) { if (tEl._auraTween) cancelAnimationFrame(tEl._auraTween); tEl.textContent = fmt(prev.total); }
      }
      flyFlow(plan);
      delay = plan.dur;
    }
    const applyAll = function () {
      if (b.total !== prev.total) {
        tweenNum(document.getElementById("dash-total-balance"), prev.total, b.total, 700);
      }
      changes.forEach(function (c) {
        tweenNum(document.querySelector('[data-wallet-bal="' + c.wId + '"]'), prev.per[c.wId], b.per[c.wId], 650);
        const card = document.querySelector('[data-wallet-card="' + c.wId + '"]');
        chip(card, c.delta);
        if (card && !reduced()) {
          card.classList.remove("aura-pulse");
          void card.offsetWidth;
          card.classList.add("aura-pulse");
        }
      });
    };
    if (delay > 0) setTimeout(applyAll, delay); else applyAll();
    last = b;
    markNewTrxCards();
  }

  let schedTimer = null;
  function schedule(ms) {
    if (schedTimer) clearTimeout(schedTimer);
    schedTimer = setTimeout(check, ms);
  }

  // Kaitkan ke jalur render yang sudah ada: setiap perhitungan ulang jadwal-
  // kan pemeriksaan; versi debounce diberi jeda lebih panjang dari debounce-nya.
  if (typeof window.reCalculateAll === "function") {
    const origRecalc = window.reCalculateAll;
    window.reCalculateAll = function () {
      const r = origRecalc.apply(this, arguments);
      schedule(60);
      return r;
    };
  }
  if (typeof window.debouncedCalculateAll === "function") {
    const origDeb = window.debouncedCalculateAll;
    window.debouncedCalculateAll = function () {
      const r = origDeb.apply(this, arguments);
      schedule(600);
      return r;
    };
  }
  setTimeout(check, 1200);
  setInterval(check, 3000);
})();
