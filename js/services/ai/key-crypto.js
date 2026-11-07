/**
 * Key Crypto Helper — penyimpanan kunci API AI pengguna (Groq & Gemini).
 *
 * Format BARU: AES (CryptoJS) lewat EncryptionService yang sudah ada,
 * dengan frasa sandi = UID pengguna.
 * Format LAMA (warisan): XOR dengan UID lalu base64 — hanya DIBACA untuk
 * migrasi, tidak pernah ditulis lagi.
 * Fallback hardcoded lama ("aura_secret_fallback") SENGAJA dibuang: tanpa
 * sesi login (tanpa UID), kunci tidak bisa dienkripsi/didekripsi sama sekali.
 *
 * Catatan kejujuran batas: enkripsi sisi-klien berfrasa-sandi-UID menaikkan
 * standar jauh di atas XOR yang sepele dibalik siapa pun, tetapi UID bukan
 * rahasia — perlindungan utama kunci tetap aturan RTDB owner-only.
 */

import { EncryptionService } from '../encryption.js';

// Dekode format warisan (XOR + base64). Read-only, khusus migrasi.
function legacyDecode(stored, uid) {
    try {
        const text = atob(stored);
        let result = '';
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ uid.charCodeAt(i % uid.length));
        }
        return result || null;
    } catch (e) {
        return null;
    }
}

// Enkripsi satu kunci polos ke format baru. Null bila tidak bisa diamankan
// (tidak ada UID / CryptoJS tidak tersedia) — pemanggil WAJIB membatalkan
// penyimpanan daripada menulis kunci dalam bentuk lemah.
export function encryptApiKeyForStorage(plainKey, uid) {
    if (!plainKey || !uid) return null;
    return EncryptionService.encryptApiKey(plainKey, uid);
}

// Dekripsi satu entri tersimpan, menerima format baru (AES) maupun lama
// (XOR). isValidPlain menapis hasil dekripsi (mis. awalan 'gsk_' untuk
// Groq) supaya dekripsi coba-coba yang menghasilkan sampah tidak dianggap
// berhasil. Mengembalikan { plain, format: 'aes' | 'legacy' } atau null.
export function decryptStoredApiKey(stored, uid, isValidPlain) {
    if (!stored || typeof stored !== 'string' || !uid) return null;
    const valid = typeof isValidPlain === 'function' ? isValidPlain : (p) => !!p;

    const aesPlain = EncryptionService.decryptApiKey(stored, uid);
    if (aesPlain && valid(aesPlain)) return { plain: aesPlain, format: 'aes' };

    const legacyPlain = legacyDecode(stored, uid);
    if (legacyPlain && valid(legacyPlain)) return { plain: legacyPlain, format: 'legacy' };

    return null;
}

// Migrasi daftar kunci: entri format lama yang terbaca ditulis ulang ke
// format baru; entri format baru dibiarkan; entri yang tidak terbaca sama
// sekali dipertahankan apa adanya (data pengguna tidak pernah dibuang
// diam-diam). Mengembalikan { list, changed }.
export function migrateStoredKeys(rawList, uid, isValidPlain) {
    const list = Array.isArray(rawList) ? rawList.slice() : Object.values(rawList || {});
    let changed = false;
    const migrated = list.map((entry) => {
        const dec = decryptStoredApiKey(entry, uid, isValidPlain);
        if (dec && dec.format === 'legacy') {
            const reEncrypted = encryptApiKeyForStorage(dec.plain, uid);
            if (reEncrypted) {
                changed = true;
                return reEncrypted;
            }
        }
        return entry;
    });
    return { list: migrated, changed };
}

// Awalan base64 keluaran CryptoJS mode frasa sandi ("Salted__"). Dipakai
// sebagai saringan murah untuk memastikan tidak ada entri lama sebelum
// menjalankan migrasi penuh.
export function looksLikeAesEntry(stored) {
    return typeof stored === 'string' && stored.startsWith('U2FsdGVkX1');
}
