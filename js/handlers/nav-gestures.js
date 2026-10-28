// ============================================================================
// Gestur & tombol kembali:
// - Tombol back Android: menutup modal/laci teratas terlebih dahulu, lalu
//   kembali ke Beranda, dan hanya keluar aplikasi bila sudah di Beranda
//   tanpa modal terbuka. (Di web peramban blok ini tidak aktif.)
// - Geser horizontal pada konten: berpindah tab sesuai urutan tab bar,
//   tanpa merebut geseran dari daftar yang memang bisa digeser menyamping.
// - Laci pengaturan: geser ke kanan untuk menutup.
// ============================================================================
(function () {
  "use strict";
  const TAB_ORDER = ["dashboard", "transactions", "analytics", "budgets", "oracle"];
  const NO_CLOSE = new Set(["modal-login"]);

  function visibleModals() {
    return Array.from(document.querySelectorAll('[id^="modal-"]')).filter(
      (el) => !el.classList.contains("hidden")
    );
  }

  function topModal() {
    let best = null;
    let bestZ = -1;
    visibleModals().forEach((el) => {
      const z = parseInt(window.getComputedStyle(el).zIndex || "0", 10) || 0;
      if (z >= bestZ) {
        bestZ = z;
        best = el;
      }
    });
    return best;
  }

  function currentView() {
    for (const name of TAB_ORDER) {
      const v = document.getElementById("view-" + name);
      if (v && window.getComputedStyle(v).display !== "none") return name;
    }
    return "dashboard";
  }

  // --- Tombol back Android (plugin App) ---
  const Cap = window.Capacitor;
  if (Cap && Cap.Plugins && Cap.Plugins.App && typeof Cap.Plugins.App.addListener === "function") {
    Cap.Plugins.App.addListener("backButton", () => {
      const m = topModal();
      if (m) {
        if (NO_CLOSE.has(m.id)) {
          Cap.Plugins.App.exitApp();
          return;
        }
        if (typeof window.closeModal === "function") window.closeModal(m.id);
        return;
      }
      if (currentView() !== "dashboard" && typeof window.switchView === "function") {
        window.switchView("dashboard");
        return;
      }
      Cap.Plugins.App.exitApp();
    });
  }

  // --- Geser layar untuk pindah tab ---
  const container = document.getElementById("view-container");
  if (container) {
    let sx = 0;
    let sy = 0;
    let active = false;
    container.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) {
          active = false;
          return;
        }
        const t = e.touches[0];
        sx = t.clientX;
        sy = t.clientY;
        active = true;
      },
      { passive: true }
    );
    container.addEventListener(
      "touchend",
      (e) => {
        if (!active) return;
        active = false;
        if (visibleModals().length) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - sx;
        const dy = t.clientY - sy;
        if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
        let el = e.target;
        if (el && el.tagName === "CANVAS") return;
        while (el && el !== container) {
          if (el.id && el.id.indexOf("view-") === 0) break;
          const ox = window.getComputedStyle(el).overflowX;
          if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth) return;
          el = el.parentElement;
        }
        const idx = TAB_ORDER.indexOf(currentView());
        if (idx < 0) return;
        const next = dx < 0 ? idx + 1 : idx - 1;
        if (next < 0 || next >= TAB_ORDER.length) return;
        if (typeof window.switchView === "function") window.switchView(TAB_ORDER[next]);
      },
      { passive: true }
    );
  }

  // --- Laci pengaturan: geser ke kanan untuk menutup ---
  const card = document.querySelector(".settings-drawer-card");
  if (card) {
    let sx = 0;
    let sy = 0;
    let dx = 0;
    let tracking = false;
    card.addEventListener(
      "touchstart",
      (e) => {
        const t = e.touches[0];
        sx = t.clientX;
        sy = t.clientY;
        dx = 0;
        tracking = true;
      },
      { passive: true }
    );
    card.addEventListener(
      "touchmove",
      (e) => {
        if (!tracking) return;
        const t = e.touches[0];
        dx = t.clientX - sx;
        const dy = Math.abs(t.clientY - sy);
        if (dx > 0 && dx > dy) card.style.transform = "translateX(" + dx + "px)";
      },
      { passive: true }
    );
    const end = () => {
      if (!tracking) return;
      tracking = false;
      if (dx > 80) {
        card.style.transform = "";
        if (typeof window.closeModal === "function") window.closeModal("modal-settings");
      } else if (dx > 0) {
        card.style.transition = "transform .2s ease";
        card.style.transform = "";
        setTimeout(() => {
          card.style.transition = "";
        }, 220);
      }
      dx = 0;
    };
    card.addEventListener("touchend", end);
    card.addEventListener("touchcancel", end);
  }
})();
