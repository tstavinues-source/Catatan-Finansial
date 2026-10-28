// ============================================================================
// Hachi — maskot hidup AuraFi.
// Mengisi gelembung sapaan di dasbor (#hachi-text) dari data pengguna sendiri:
// prioritasnya (1) kewajiban siklus yang belum tercatat, (2) hari gajian,
// (3) laju pengeluaran melewati siklus lalu, (4) kemajuan misi tabungan,
// (5) sapaan hangat sesuai jam + info kas. Ketuk Hachi untuk lompatan kecil
// dan kalimat penyemangat berganti. Murni tampilan: tidak menulis data apa pun.
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

  // --- Hachi keliling: stiker ikon asli berjalan bebas di semua tab ---
  // Bukan lagi kartu di dasbor: Hachi adalah sosok fixed yang berjalan di
  // tepi bawah layar, berhenti, berbalik arah, dan menyapa lewat gelembung
  // di sampingnya. Ia minggir sendiri saat modal/keyboard terbuka.
  const PET_W = 124;
  const reducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let pet = null, flipEl = null, imgEl = null, bubbleEl = null;
  let posX = 24, dir = 1, targetX = 140, mode = "pause", pauseUntil = 0, lastTs = 0;
  let bubbleTimer = null, kbOpen = false, started = false;

  // Gambar asli karya Gmr (js/hachi-art.js): bingkai siklus berjalan.
  // Saat berhenti, Hachi bertumpu pada bingkai 3 (kedua kaki menapak).
  const WALK_FRAMES = (window.HACHI_ART && Array.isArray(window.HACHI_ART.walk)) ? window.HACHI_ART.walk : [];
  const IDLE_FRAME = 2;
  let frameIdx = IDLE_FRAME;
  function setFrame(i) {
    if (!imgEl || !WALK_FRAMES.length) return;
    frameIdx = ((i % WALK_FRAMES.length) + WALK_FRAMES.length) % WALK_FRAMES.length;
    imgEl.src = WALK_FRAMES[frameIdx];
  }

  function maxX() { return Math.max(12, window.innerWidth - PET_W - 12); }
  function pickTarget() {
    targetX = 12 + Math.random() * Math.max(10, maxX() - 12);
    dir = targetX >= posX ? 1 : -1;
  }
  function laneBottom() {
    const inp = document.getElementById("main-input-field");
    return (inp && inp.offsetParent !== null) ? 150 : 94;
  }
  function modalOpen() {
    const ms = document.querySelectorAll('[id^="modal-"]');
    for (let i = 0; i < ms.length; i++) {
      if (!ms[i].classList.contains("hidden")) return true;
    }
    return false;
  }
  function showBubble(text, holdMs) {
    if (!bubbleEl) return;
    if (text) { bubbleEl.textContent = text; lastText = text; }
    const vw = window.innerWidth;
    bubbleEl.classList.toggle("hachi-bubble-left", posX < 100);
    bubbleEl.classList.toggle("hachi-bubble-right", posX > vw - 210);
    bubbleEl.classList.add("hachi-bubble-show");
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { bubbleEl.classList.remove("hachi-bubble-show"); }, holdMs || 6000);
  }
  function render() {
    const msg = computeMessage();
    if (msg && msg.text && msg.text !== lastText) showBubble(msg.text, 6500);
  }
  function onTap() {
    if (!imgEl) return;
    imgEl.classList.remove("hachi-jump");
    void imgEl.offsetWidth;
    imgEl.classList.add("hachi-jump");
    motivasiIdx = (motivasiIdx === null ? 0 : motivasiIdx + 1) % MOTIVASI.length;
    const msg = computeMessage();
    showBubble(msg && msg.text ? msg.text : MOTIVASI[motivasiIdx], 6000);
  }
  function tick(ts) {
    setInterval(() => {
      if (mode === "walk" && pet && !pet.classList.contains("hachi-pet-hidden") && !reducedMotion) {
        setFrame(frameIdx + 1);
      }
    }, 150);
    requestAnimationFrame(tick);
    if (!pet) return;
    const dt = Math.min(0.05, lastTs ? (ts - lastTs) / 1000 : 0.016);
    lastTs = ts;
    if (reducedMotion || pet.classList.contains("hachi-pet-hidden")) return;
    const now = performance.now();
    if (mode === "walk") {
      posX += dir * 30 * dt;
      if ((dir > 0 && posX >= targetX) || (dir < 0 && posX <= targetX)) {
        mode = "pause";
        pauseUntil = now + 2600 + Math.random() * 3400;
        imgEl.classList.remove("hachi-walking");
        setFrame(IDLE_FRAME);
      }
    } else if (now >= pauseUntil) {
      pickTarget();
      mode = "walk";
      imgEl.classList.add("hachi-walking");
    }
    posX = Math.max(6, Math.min(posX, maxX()));
    pet.style.transform = "translate3d(" + posX.toFixed(1) + "px,0,0)";
    flipEl.style.transform = "scaleX(" + dir + ")";
  }
  function buildPet() {
    pet = document.createElement("div");
    pet.id = "hachi-pet";
    pet.title = "Hachi";
    flipEl = document.createElement("div");
    flipEl.className = "hachi-pet-flip";
    imgEl = document.createElement("img");
    imgEl.className = "hachi-pet-img";
    imgEl.alt = "Hachi, maskot AuraFi";
    imgEl.draggable = false;
    setFrame(IDLE_FRAME);
    flipEl.appendChild(imgEl);
    bubbleEl = document.createElement("div");
    bubbleEl.id = "hachi-bubble";
    pet.appendChild(bubbleEl);
    pet.appendChild(flipEl);
    document.body.appendChild(pet);
    pet.addEventListener("click", onTap);
    pet.style.bottom = laneBottom() + "px";
    if (reducedMotion) {
      posX = maxX() - 6;
      pet.style.transform = "translate3d(" + posX + "px,0,0)";
    }
  }
  function init() {
    buildPet();
    render();
    setInterval(render, 45000);
    setInterval(() => {
      if (!pet) return;
      pet.classList.toggle("hachi-pet-hidden", modalOpen() || kbOpen);
      pet.style.bottom = laneBottom() + "px";
    }, 800);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", () => {
        kbOpen = (window.innerHeight - window.visualViewport.height) > 120;
      });
    }
    setInterval(() => {
      if (mode === "walk" && pet && !pet.classList.contains("hachi-pet-hidden") && !reducedMotion) {
        setFrame(frameIdx + 1);
      }
    }, 150);
    requestAnimationFrame(tick);
  }

  const timer = setInterval(() => {
    const ready = window.AuraState && window.AuraState.user && window.AuraState.user.uid &&
      window.AuraState.data && Array.isArray(window.AuraState.data.transactions);
    if (ready && !started) {
      started = true;
      clearInterval(timer);
      init();
    }
  }, 1000);
  setTimeout(() => clearInterval(timer), 90000);
})();
