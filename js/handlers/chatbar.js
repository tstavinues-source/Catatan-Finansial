// ============================================================================
// Kotak chat AI bisa disembunyikan agar layar lega. Pilihan tersimpan di
// perangkat (localStorage) sehingga berlaku setiap aplikasi dibuka; tombol
// melayang kecil memunculkannya kembali.
// ============================================================================
(function () {
  "use strict";
  const KEY = "aurafi_chat_hidden";

  function apply() {
    const bar = document.getElementById("chat-bar");
    const showBtn = document.getElementById("chat-show-btn");
    let hidden = false;
    try {
      hidden = localStorage.getItem(KEY) === "1";
    } catch (e) {}
    if (bar) bar.classList.toggle("hidden", hidden);
    const fabWrap = document.querySelector(".fab-manual-wrap");
    if (fabWrap) fabWrap.classList.toggle("chat-tersembunyi", hidden);
    if (showBtn) {
      showBtn.classList.toggle("hidden", !hidden);
      showBtn.classList.toggle("flex", hidden);
    }
  }

  window.toggleChatBar = function (hide) {
    try {
      localStorage.setItem(KEY, hide ? "1" : "0");
    } catch (e) {}
    apply();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
})();
