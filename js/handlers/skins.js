// ============================================================================
// KULIT TEMA (data-skin) — Luxury / Neon Cyber / Neo-Brutal / Clay 3D.
// Mengganti seluruh rasa aplikasi (palet, font, radius, bayangan, border,
// ikon) lewat atribut data-skin di <html>; definisi visualnya ada di
// css/style.css paling akhir. "slate" = tampilan sekarang (atribut dihapus,
// varian data-theme Tembaga/Sage/Frost berlaku seperti biasa).
// Pilihan tersimpan lokal (aurafi_active_skin) + cloud (settings.skin).
// ============================================================================
(function () {
  "use strict";

  const SKINS = {
    slate: "Slate (Sekarang)",
    luxury: "Luxury",
    cyber: "Neon Cyber",
    brutal: "Neo-Brutal",
    clay: "Clay 3D",
  };
  let cloudApplied = false;

  function syncPicker(skin) {
    document.querySelectorAll("[data-skin-btn]").forEach((btn) => {
      const active = btn.getAttribute("data-skin-btn") === skin;
      btn.classList.toggle("ring-2", active);
      btn.classList.toggle("ring-[var(--accent-primary)]", active);
      btn.classList.toggle("border-[var(--accent-primary)]", active);
    });
  }

  window.applySkin = function (skinKey, skipSave) {
    if (!SKINS[skinKey]) skinKey = "slate";
    const root = document.documentElement;
    if (skinKey === "slate") {
      root.removeAttribute("data-skin");
      // Kembalikan aksen varian slate (ditulis inline oleh applyAndSaveTheme).
      if (typeof window.applyAndSaveTheme === "function") {
        window.applyAndSaveTheme(localStorage.getItem("aurafi_active_theme") || "tembaga", true);
      }
    } else {
      root.setAttribute("data-skin", skinKey);
      // Aksen kulit hidup di stylesheet; properti inline dari varian slate
      // harus dicabut agar tidak menimpanya.
      root.style.removeProperty("--accent-primary");
      root.style.removeProperty("--accent-glow");
    }
    localStorage.setItem("aurafi_active_skin", skinKey);
    syncPicker(skinKey);

    if (!skipSave && window.AuraState && AuraState.user && AuraState.user.uid && window.FirebaseService) {
      window.FirebaseService.updateSettings({ skin: skinKey })
        .then(() => { if (window.showToast) window.showToast("Kulit tema: " + SKINS[skinKey]); })
        .catch(() => {});
    }
  };

  function currentSkin() {
    return document.documentElement.getAttribute("data-skin") || "slate";
  }

  // Terapkan dari lokal secepat mungkin, lalu jaga agar properti aksen
  // inline dari boot utama tidak menimpa aksen kulit.
  function bootLocal() {
    const saved = localStorage.getItem("aurafi_active_skin") || "slate";
    if (saved !== "slate") window.applySkin(saved, true);
    let tries = 0;
    const guard = setInterval(() => {
      tries++;
      const skin = currentSkin();
      if (skin !== "slate" && document.documentElement.style.getPropertyValue("--accent-primary")) {
        document.documentElement.style.removeProperty("--accent-primary");
        document.documentElement.style.removeProperty("--accent-glow");
      }
      if (tries >= 8) clearInterval(guard);
    }, 400);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootLocal);
  else bootLocal();

  // Sinkron dari cloud sekali per sesi (perangkat lain / instal ulang).
  const cloudTimer = setInterval(() => {
    const S = (window.AuraState && AuraState.data && AuraState.data.settings) || null;
    if (!window.AuraState || !AuraState.user || !AuraState.user.uid || !S) return;
    if (typeof S.skin === "string" && SKINS[S.skin] && S.skin !== currentSkin()) {
      window.applySkin(S.skin, true);
    }
    cloudApplied = true;
    clearInterval(cloudTimer);
  }, 1500);
  setTimeout(() => clearInterval(cloudTimer), 90000);
})();
