// ============================================================================
// Notifikasi Push (FCM) — hanya aktif di aplikasi Android (Capacitor).
// Di web handler ini diam total: tidak ada plugin, tidak ada efek samping.
// Alur: setelah login & settings termuat -> minta izin notifikasi ->
// daftarkan perangkat ke FCM -> simpan token ke Firebase
// (settings/pushTokens) supaya Ren bisa mengirim push dari server.
// ============================================================================
(function () {
  const Cap = window.Capacitor;
  if (!Cap || typeof Cap.isNativePlatform !== "function" || !Cap.isNativePlatform()) return;
  const PN = Cap.Plugins && Cap.Plugins.PushNotifications;
  if (!PN) return;

  let started = false;

  async function saveToken(token) {
    try {
      if (!window.FirebaseService || typeof window.FirebaseService.updateSettings !== "function") return;
      const map = {};
      map[token] = { platform: "android", updatedAt: new Date().toISOString() };
      await window.FirebaseService.updateSettings({ pushTokens: map });
      console.log("[Push] Token perangkat tersimpan.");
    } catch (e) {
      console.warn("[Push] Gagal menyimpan token:", e);
    }
  }

  async function initPush() {
    if (started) return;
    started = true;
    try {
      PN.addListener("registration", (token) => {
        if (token && token.value) saveToken(token.value);
      });
      PN.addListener("registrationError", (err) => {
        console.warn("[Push] Registrasi gagal:", err);
      });
      // Push yang tiba saat aplikasi sedang terbuka tidak tampil sebagai
      // notifikasi sistem oleh Android — tampilkan sebagai toast aplikasi.
      PN.addListener("pushNotificationReceived", (notif) => {
        try {
          if (typeof window.showToast === "function") {
            const title = (notif && notif.title) || "AuraFi";
            const body = (notif && notif.body) || "";
            window.showToast(title + (body ? ": " + body : ""));
          }
        } catch (e) { /* diamkan */ }
      });

      let perm = await PN.checkPermissions();
      if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
        perm = await PN.requestPermissions();
      }
      if (perm.receive !== "granted") {
        console.log("[Push] Izin notifikasi tidak diberikan; push nonaktif.");
        return;
      }
      await PN.register();
    } catch (e) {
      console.warn("[Push] Inisialisasi gagal:", e);
    }
  }

  // Tunggu sampai pengguna login dan settings termuat (pola yang sama
  // dengan handler lain), lalu mulai sekali per peluncuran aplikasi.
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    const ready =
      window.AuraState &&
      window.AuraState.user &&
      window.AuraState.user.uid &&
      window.AuraState.data &&
      window.AuraState.data.settings;
    if (ready) {
      clearInterval(timer);
      initPush();
    } else if (tries > 90) {
      clearInterval(timer);
    }
  }, 1000);
})();
