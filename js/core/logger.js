/**
 * Enterprise Logger System
 * Menangani semua pencatatan console (info, error, warning)
 */

export const Logger = {
    // PERBAIKAN: sebelumnya di-hardcode true permanen — semua Logger.info/warn/error
    // di seluruh app (yang membawa data transaksi, saldo, dll) selalu tercetak ke
    // console, bisa dilihat siapa saja yang buka DevTools di device yang sama, bahkan
    // di production. Sekarang otomatis mengikuti environment (aktif di localhost),
    // dengan jalan pintas manual lewat localStorage untuk debugging production sesekali:
    // jalankan `localStorage.setItem('aurafi_debug', 'true')` di console lalu reload.
    ENABLE_DEBUG: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ||
                  (localStorage.getItem('aurafi_debug') === 'true'),
    
    _formatTime: function() {
        const d = new Date();
        const hr = d.getHours().toString().padStart(2, '0');
        const min = d.getMinutes().toString().padStart(2, '0');
        const sec = d.getSeconds().toString().padStart(2, '0');
        const ms = d.getMilliseconds().toString().padStart(3, '0');
        return `${hr}:${min}:${sec}.${ms}`;
    },
    
    info: function(module, message, data = null) {
        if (!this.ENABLE_DEBUG) return;
        console.log(`%c[INFO | ${this._formatTime()}] [${module}]`, 'color: #38bdf8; font-weight: bold;', message, data !== null ? data : '');
    },
    
    success: function(module, message, data = null) {
        if (!this.ENABLE_DEBUG) return;
        console.log(`%c[SUCCESS | ${this._formatTime()}] [${module}]`, 'color: #10b981; font-weight: bold;', message, data !== null ? data : '');
    },
    
    warn: function(module, message, data = null) {
        if (!this.ENABLE_DEBUG) return;
        console.warn(`%c[WARN | ${this._formatTime()}] [${module}]`, 'color: #facc15; font-weight: bold;', message, data !== null ? data : '');
    },
    
    error: function(module, message, error = null) {
        console.error(`%c[ERROR | ${this._formatTime()}] [${module}]`, 'color: #f43f5e; font-weight: bold;', message);
        if (error) console.error(error);
    }
};

// Legacy binding untuk memastikan kompatibilitas
window.AuraOS = window.AuraOS || {}; 
window.AuraOS.Logger = Logger;
