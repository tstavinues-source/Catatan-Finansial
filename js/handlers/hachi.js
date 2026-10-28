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
    const wallets = data.wallets || [];
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
    const goals = Array.isArray(data.goals) ? data.goals : [];
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

  // --- Hachi karakter kartun: berjalan dengan langkah kaki (profil),
  // duduk menghadapmu saat berhenti, ekspresi mengikuti isi pesannya
  // (senang/khawatir/ngantuk), ekor bergoyang, mata berkedip. Bebas di
  // semua tab; minggir sendiri saat modal/keyboard terbuka. ---
  const PET_W = 122;
  const HACHI_SVG = `<svg class="hachi-svg2" viewBox="0 0 220 190" width="122" height="105" aria-label="Hachi, maskot AuraFi">
  <g class="hachi-g-walk">
    <path class="hachi-tail-w" d="M58,88 C30,84 22,58 36,44 C46,34 60,38 62,48 C63,56 56,60 51,56" fill="none" stroke="#E08A4C" stroke-width="14" stroke-linecap="round"/>
    <circle cx="50" cy="55" r="7" fill="#FFEFD6"/>
    <g class="leg leg-b" transform="translate(80,118)"><rect x="-7" y="0" width="14" height="32" rx="7" fill="#C5712F"/><ellipse cx="3" cy="33" rx="9" ry="5" fill="#C5712F"/></g>
    <g class="leg leg-a" transform="translate(126,118)"><rect x="-7" y="0" width="14" height="32" rx="7" fill="#C5712F"/><ellipse cx="3" cy="33" rx="9" ry="5" fill="#C5712F"/></g>
    <g class="hachi-body-bob">
      <ellipse cx="106" cy="102" rx="49" ry="31" fill="#E08A4C"/>
      <ellipse cx="114" cy="116" rx="29" ry="17" fill="#FFEFD6"/>
      <g class="hachi-head-w">
        <polygon points="126,36 136,10 150,30" fill="#C5712F"/>
        <circle cx="154" cy="56" r="31" fill="#E08A4C"/>
        <polygon points="140,32 155,4 168,28" fill="#E08A4C"/>
        <polygon points="147,26 155,13 162,25" fill="#FFEFD6"/>
        <ellipse cx="160" cy="40" rx="4.6" ry="3" fill="#FFEFD6"/>
        <ellipse cx="172" cy="66" rx="17" ry="12" fill="#FFEFD6"/>
        <ellipse cx="186" cy="60" rx="6" ry="4.6" fill="#33231A"/>
        <path d="M172,72 q7,5 13,2" stroke="#33231A" stroke-width="2" fill="none" stroke-linecap="round"/>
        <circle cx="160" cy="50" r="4.2" fill="#33231A"/>
        <circle cx="161.5" cy="48.5" r="1.3" fill="#FFFFFF"/>
        <ellipse cx="148" cy="68" rx="6" ry="4" fill="#F2A65A" opacity="0.55"/>
      </g>
      <polygon points="124,78 170,84 148,104" fill="#A3B86B"/>
      <circle cx="126" cy="82" r="5.5" fill="#8CA85A"/>
      <polygon points="126,82 114,96 126,98" fill="#A3B86B"/>
      <g class="hachi-pouch" transform="translate(144,98)">
        <path d="M0,-11 C9,-11 13,-4 13,3 C13,12 7,17 0,17 C-7,17 -13,12 -13,3 C-13,-4 -9,-11 0,-11 Z" fill="#EFA85C"/>
        <rect x="-6" y="-12" width="12" height="4" rx="2" fill="#D98E3B"/>
        <circle cx="0" cy="-14" r="5.5" fill="#F2C14E" stroke="#D9A62E" stroke-width="1.5"/>
      </g>
    </g>
    <g class="leg leg-a" transform="translate(90,120)"><rect x="-7" y="0" width="14" height="32" rx="7" fill="#E08A4C"/><ellipse cx="3" cy="33" rx="9" ry="5" fill="#FFEFD6"/></g>
    <g class="leg leg-b" transform="translate(136,120)"><rect x="-7" y="0" width="14" height="32" rx="7" fill="#E08A4C"/><ellipse cx="3" cy="33" rx="9" ry="5" fill="#FFEFD6"/></g>
  </g>
  <g class="hachi-g-sit">
    <path class="hachi-tail-s" d="M160,140 C184,136 190,116 178,106 C168,98 156,104 158,114 C159,121 166,122 169,117" fill="none" stroke="#E08A4C" stroke-width="12" stroke-linecap="round"/>
    <circle cx="169" cy="116" r="6" fill="#FFEFD6"/>
    <g class="hachi-sit-bob">
      <path d="M100,86 C130,86 148,108 148,134 C148,152 134,162 100,162 C66,162 52,152 52,134 C52,108 70,86 100,86 Z" fill="#E08A4C"/>
      <ellipse cx="100" cy="133" rx="23" ry="19" fill="#FFEFD6"/>
      <ellipse cx="50" cy="156" rx="13" ry="6" transform="rotate(-16 50 156)" fill="#E08A4C"/>
      <ellipse cx="150" cy="156" rx="13" ry="6" transform="rotate(16 150 156)" fill="#E08A4C"/>
      <rect x="83" y="116" width="11" height="30" rx="5.5" fill="#E08A4C"/>
      <rect x="106" y="116" width="11" height="30" rx="5.5" fill="#E08A4C"/>
      <rect x="83" y="136" width="11" height="10" rx="5" fill="#FFEFD6"/>
      <rect x="106" y="136" width="11" height="10" rx="5" fill="#FFEFD6"/>
      <ellipse cx="88.5" cy="152" rx="10" ry="5" fill="#FFEFD6"/>
      <ellipse cx="111.5" cy="152" rx="10" ry="5" fill="#FFEFD6"/>
      <g class="hachi-arm-l"><path d="M64,102 q-10,16 -4,30" stroke="#E08A4C" stroke-width="11" fill="none" stroke-linecap="round"/></g>
      <g class="hachi-arm-r"><path d="M136,102 q10,16 4,30" stroke="#E08A4C" stroke-width="11" fill="none" stroke-linecap="round"/></g>
      <polygon points="66,96 134,96 100,120" fill="#A3B86B"/>
      <circle cx="131" cy="99" r="5.5" fill="#8CA85A"/>
      <polygon points="131,99 141,110 129,112" fill="#A3B86B"/>
      <g class="hachi-pouch" transform="translate(100,124) scale(1.05)">
        <path d="M0,-11 C9,-11 13,-4 13,3 C13,12 7,17 0,17 C-7,17 -13,12 -13,3 C-13,-4 -9,-11 0,-11 Z" fill="#EFA85C"/>
        <rect x="-6" y="-12" width="12" height="4" rx="2" fill="#D98E3B"/>
        <circle cx="0" cy="-14" r="5.5" fill="#F2C14E" stroke="#D9A62E" stroke-width="1.5"/>
      </g>
      <g class="hachi-ear-l"><polygon points="68,40 78,8 98,30" fill="#E08A4C"/><polygon points="74,32 79,17 90,28" fill="#FFEFD6"/></g>
      <g class="hachi-ear-r"><polygon points="132,40 122,8 102,30" fill="#E08A4C"/><polygon points="126,32 121,17 110,28" fill="#FFEFD6"/></g>
      <circle cx="100" cy="62" r="37" fill="#E08A4C"/>
      <ellipse cx="100" cy="44" rx="12" ry="14" fill="#FFEFD6" opacity="0.95"/>
      <ellipse cx="83" cy="50" rx="5" ry="3.2" fill="#FFEFD6"/>
      <ellipse cx="117" cy="50" rx="5" ry="3.2" fill="#FFEFD6"/>
      <g class="brow-worried"><path d="M76,43 l13,4" stroke="#FFEFD6" stroke-width="3" stroke-linecap="round"/><path d="M124,43 l-13,4" stroke="#FFEFD6" stroke-width="3" stroke-linecap="round"/></g>
      <ellipse cx="100" cy="79" rx="23" ry="15" fill="#FFEFD6"/>
      <g class="eyes-normal"><g class="hachi-blink"><circle cx="85" cy="62" r="4.6" fill="#33231A"/><circle cx="115" cy="62" r="4.6" fill="#33231A"/></g><circle cx="86.5" cy="60.3" r="1.4" fill="#FFFFFF"/><circle cx="116.5" cy="60.3" r="1.4" fill="#FFFFFF"/></g>
      <g class="eyes-happy"><path d="M77,63 q8,-9 16,0" stroke="#33231A" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M107,63 q8,-9 16,0" stroke="#33231A" stroke-width="3.2" fill="none" stroke-linecap="round"/></g>
      <g class="eyes-sleepy"><path d="M77,61 q8,6 16,0" stroke="#33231A" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M107,61 q8,6 16,0" stroke="#33231A" stroke-width="3" fill="none" stroke-linecap="round"/></g>
      <ellipse cx="100" cy="73" rx="6.5" ry="5" fill="#33231A"/>
      <circle cx="98" cy="71" r="1.6" fill="#FFFFFF" opacity="0.8"/>
      <path class="mouth-normal" d="M100,79 v3 M100,82 q-4,5 -9,2 M100,82 q4,5 9,2" stroke="#33231A" stroke-width="2" fill="none" stroke-linecap="round"/>
      <g class="mouth-happy"><path d="M89,80 q11,11 22,0 q-2,10 -11,10 q-9,0 -11,-10 Z" fill="#7A3B2E"/><ellipse cx="100" cy="87" rx="5.5" ry="3.4" fill="#F28BA8"/></g>
      <circle class="mouth-worry" cx="100" cy="86" r="3.2" fill="none" stroke="#33231A" stroke-width="2"/>
      <ellipse cx="72" cy="74" rx="5.5" ry="3.4" fill="#F2A65A" opacity="0.5"/>
      <ellipse cx="128" cy="74" rx="5.5" ry="3.4" fill="#F2A65A" opacity="0.5"/>
    </g>
    <g class="hachi-zzz"><text x="140" y="36" class="hachi-z1">Z</text><text x="154" y="24" class="hachi-z2">Z</text></g>
  </g>
</svg>`;
  const reducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  let pet = null, flipEl = null, charEl = null, bubbleEl = null;
  let posX = 24, dir = 1, targetX = 140, mode = "pause", pauseUntil = 0, pauseStart = 0, lastTs = 0;
  let bubbleTimer = null, kbOpen = false, started = false, happyTimer = null;

  function maxX() { return Math.max(12, window.innerWidth - PET_W - 12); }
  function pickTarget() {
    targetX = 12 + Math.random() * Math.max(10, maxX() - 12);
    dir = targetX >= posX ? 1 : -1;
  }
  function laneBottom() {
    const inp = document.getElementById("main-input-field");
    return (inp && inp.offsetParent !== null) ? 158 : 100;
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
    bubbleEl.classList.toggle("hachi-bubble-left", posX < 110);
    bubbleEl.classList.toggle("hachi-bubble-right", posX > vw - 240);
    bubbleEl.classList.add("hachi-bubble-show");
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { bubbleEl.classList.remove("hachi-bubble-show"); }, holdMs || 6000);
  }
  function render() {
    const msg = computeMessage();
    if (!msg) return;
    if (pet && msg.mood) pet.dataset.mood = msg.mood;
    if (msg.text && msg.text !== lastText) showBubble(msg.text, 6500);
  }
  function onTap() {
    if (!charEl) return;
    pet.classList.remove("is-sleepy");
    charEl.classList.remove("hachi-jump");
    void charEl.offsetWidth;
    charEl.classList.add("hachi-jump");
    if (pet) {
      pet.classList.add("flash-happy");
      if (happyTimer) clearTimeout(happyTimer);
      happyTimer = setTimeout(() => { pet.classList.remove("flash-happy"); }, 1400);
    }
    motivasiIdx = (motivasiIdx === null ? 0 : motivasiIdx + 1) % MOTIVASI.length;
    const msg = computeMessage();
    showBubble(msg && msg.text ? msg.text : MOTIVASI[motivasiIdx], 6000);
  }
  function setState(s) {
    if (pet) pet.dataset.state = s;
  }
  function tick(ts) {
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
        pauseStart = now;
        pauseUntil = now + 3000 + Math.random() * 3800;
        setState("sit");
      }
    } else {
      if (now - pauseStart > 22000 && pet.dataset.mood === "ramah") pet.classList.add("is-sleepy");
      if (now >= pauseUntil) {
        pet.classList.remove("is-sleepy");
        pickTarget();
        mode = "walk";
        setState("walk");
      }
    }
    posX = Math.max(6, Math.min(posX, maxX()));
    pet.style.transform = "translate3d(" + posX.toFixed(1) + "px,0,0)";
    flipEl.style.transform = "scaleX(" + dir + ")";
  }
  function buildPet() {
    pet = document.createElement("div");
    pet.id = "hachi-pet";
    pet.title = "Hachi";
    pet.dataset.state = "sit";
    pet.dataset.mood = "ramah";
    flipEl = document.createElement("div");
    flipEl.className = "hachi-flip";
    charEl = document.createElement("div");
    charEl.className = "hachi-char";
    charEl.innerHTML = HACHI_SVG;
    flipEl.appendChild(charEl);
    bubbleEl = document.createElement("div");
    bubbleEl.id = "hachi-bubble";
    pet.appendChild(bubbleEl);
    pet.appendChild(flipEl);
    document.body.appendChild(pet);
    pet.addEventListener("click", onTap);
    pet.style.bottom = laneBottom() + "px";
    pauseStart = performance.now();
    pauseUntil = pauseStart + 2500;
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

