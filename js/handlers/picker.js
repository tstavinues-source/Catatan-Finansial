// ============================================================================
// Pemilih ala tema (bottom sheet) — menggantikan dropdown bawaan peramban
// pada formulir utama. Elemen <select> asli tetap menjadi pemegang data
// (hanya disembunyikan), jadi seluruh logika formulir yang membaca nilainya
// tidak berubah. Sebuah tombol bergaya kolom menampilkan pilihan saat ini;
// mengetuknya membuka lembar bawah berisi daftar pilihan, seperti pemilih
// kategori yang sudah ada. Opsi yang terisi belakangan (mis. daftar dompet
// dari Firebase) terpantau lewat MutationObserver.
// ============================================================================
(function () {
  const TARGETS = [
    "staging-trx-wallet", "manual-trx-wallet", "edit-global-wallet",
    "transfer-source", "transfer-dest", "new-rec-wallet", "rem-wallet",
    "topup-goal-source", "staging-trx-type", "manual-trx-type",
    "edit-global-type", "new-rec-method", "manual-trx-curr",
    "edit-global-curr", "goal-jenis", "wallet-form-type",
  ];
  let currentSelect = null;

  function ensureSheet() {
    let modal = document.getElementById("modal-aura-picker");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "modal-aura-picker";
    modal.className = "fixed inset-0 z-[500] bg-black/85 flex items-end justify-center hidden opacity-0 transition-all duration-300";
    modal.innerHTML =
      '<div class="glass-panel w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[72vh] flex flex-col shadow-2xl overflow-hidden border-t-2 border-accent">' +
        '<div class="flex justify-between items-center p-4 border-b border-[var(--border-glass)] bg-black/40 shrink-0">' +
          '<h3 id="aura-picker-title" class="font-bold text-sm text-accent font-display">Pilih</h3>' +
          '<button type="button" id="aura-picker-close" class="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 rounded-full transition active:scale-90 text-[var(--text-muted)]"><i class="fa-solid fa-xmark text-sm"></i></button>' +
        "</div>" +
        '<div id="aura-picker-list" class="flex-1 overflow-y-auto p-3 space-y-2 hide-scrollbar bg-black/20"></div>' +
      "</div>";
    document.body.appendChild(modal);
    modal.querySelector("#aura-picker-close").addEventListener("click", () => {
      if (typeof window.closeModal === "function") window.closeModal("modal-aura-picker");
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal && typeof window.closeModal === "function") window.closeModal("modal-aura-picker");
    });
    return modal;
  }

  function openPicker(sel) {
    currentSelect = sel;
    const modal = ensureSheet();
    modal.querySelector("#aura-picker-title").textContent = sel.getAttribute("data-picker-title") || "Pilih Salah Satu";
    const list = modal.querySelector("#aura-picker-list");
    list.innerHTML = "";
    Array.from(sel.options).forEach((opt) => {
      const row = document.createElement("button");
      row.type = "button";
      const selected = opt.value === sel.value;
      row.className = "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-left transition active:scale-[0.99] " +
        (selected
          ? "bg-accent/15 border-accent/50 text-white"
          : "bg-white/[0.03] border-[var(--border-glass)] text-[var(--text-main)] hover:bg-white/[0.07]");
      const label = document.createElement("span");
      label.className = "text-xs font-bold truncate";
      label.textContent = opt.textContent;
      row.appendChild(label);
      if (selected) {
        const check = document.createElement("i");
        check.className = "fa-solid fa-check text-accent text-xs shrink-0";
        row.appendChild(check);
      }
      row.addEventListener("click", () => {
        sel.value = opt.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        syncTrigger(sel);
        if (typeof window.closeModal === "function") window.closeModal("modal-aura-picker");
      });
      list.appendChild(row);
    });
    if (!list.children.length) {
      list.innerHTML = '<p class="text-xs text-center text-[var(--text-muted)] py-6">Belum ada pilihan tersedia.</p>';
    }
    if (typeof window.showModal === "function") window.showModal("modal-aura-picker");
  }

  function syncTrigger(sel) {
    const btn = sel.nextElementSibling;
    if (!btn || !btn.classList || !btn.classList.contains("aura-picker-btn")) return;
    const label = btn.querySelector(".aura-picker-label");
    const opt = sel.options[sel.selectedIndex];
    if (label) label.textContent = opt ? opt.textContent : "— Pilih —";
  }

  function enhance(sel) {
    if (!sel || sel.dataset.auraPicker === "1") return;
    sel.dataset.auraPicker = "1";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = (sel.className || "") + " aura-picker-btn flex items-center justify-between gap-2 text-left cursor-pointer";
    btn.innerHTML = '<span class="aura-picker-label truncate"></span><i class="fa-solid fa-chevron-down text-[10px] opacity-60 shrink-0"></i>';
    btn.addEventListener("click", () => openPicker(sel));
    sel.style.display = "none";
    sel.parentNode.insertBefore(btn, sel.nextSibling);
    new MutationObserver(() => syncTrigger(sel)).observe(sel, { childList: true });
    sel.addEventListener("change", () => syncTrigger(sel));
    syncTrigger(sel);
  }

  function init() {
    TARGETS.forEach((id) => enhance(document.getElementById(id)));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
