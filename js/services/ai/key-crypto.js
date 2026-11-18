/**
 * Key Crypto Helper — penyimpanan kunci API AI pengguna (Groq & Gemini).
 *
 * Tiga generasi format hidup berdampingan di settings pengguna:
 *  - WARISAN XOR (pra-r90): kunci di-XOR dengan UID lalu base64. Hanya
 *    DIBACA untuk migrasi, tidak pernah ditulis lagi.
 *  - WARISAN AES r90: CryptoJS AES (format OpenSSL "Salted__", frasa sandi
 *    = UID) lewat EncryptionService. Hanya DIBACA untuk migrasi.
 *  - FORMAT v2 (satu-satunya yang ditulis sejak v3.2.12): WebCrypto
 *    AES-GCM-256. Kunci diturunkan PBKDF2-SHA-256 (210.000 iterasi) dari
 *    UID sebagai frasa sandi + salt acak per-pengguna yang disimpan di
 *    settings.aiKeySalt (base64, 16 byte). IV acak 12 byte per enkripsi.
 *    Bentuk tersimpan: "AFK2:" + base64(IV || ciphertext+tag) — penanda
 *    "AFK2:" adalah penanda versi formatnya.
 *
 * Migrasi malas: entri warisan yang berhasil dibaca ditulis ulang sebagai
 * v2 oleh pemanggil lewat migrateStoredKeys — pengguna tidak perlu
 * memasukkan ulang kuncinya. Entri yang tidak terbaca sama sekali
 * dipertahankan apa adanya (data pengguna tidak pernah dibuang diam-diam).
 *
 * Fail closed: tanpa UID, tanpa salt, atau tanpa WebCrypto, enkripsi v2
 * GAGAL (null) dan dekripsi v2 mengembalikan null — tidak ada fallback
 * konstan dan tidak ada penulisan format lemah. Fallback hardcoded lama
 * ("aura_secret_fallback") sudah dibuang sejak r90 dan tidak kembali.
 *
 * Catatan kejujuran batas: UID bersifat publik dan salt tersimpan di
 * basis data yang sama, jadi enkripsi ini bukan brankas melawan pihak
 * yang sudah bisa membaca subpohon pengguna — perlindungan utama kunci
 * tetap aturan RTDB owner-only. Yang diperbaiki v2: XOR generasi pertama
 * sepele dibalik siapa pun yang mengetahui UID, dan KDF MD5 satu putaran
 * milik format OpenSSL/CryptoJS diganti PBKDF2 berkekuatan penuh +
 * enkripsi terautentikasi (AES-GCM) dengan salt dan IV acak.
 */

import { EncryptionService } from '../encryption.js';

const V2_PREFIX = 'AFK2:';
const PBKDF2_ITERATIONS = 210000;

// --- Util base64 untuk byte array (berpotong agar aman di tumpukan) ---
function bytesToBase64(bytes) {
    let text = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        text += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(text);
}

function base64ToBytes(b64) {
    const text = atob(b64);
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
    return out;
}

// Dekode format warisan XOR + base64. Read-only, khusus migrasi.
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

// Penanda format v2 (yang ditulis sekarang).
export function isCurrentFormatEntry(stored) {
    return typeof stored === 'string' && stored.startsWith(V2_PREFIX);
}

// Awalan base64 keluaran CryptoJS mode frasa sandi ("Salted__") — format
// warisan r90. Dipakai untuk mengenali generasi itu saat dekripsi.
export function looksLikeAesEntry(stored) {
    return typeof stored === 'string' && stored.startsWith('U2FsdGVkX1');
}

// Salt acak per-pengguna untuk penurunan kunci v2 (disimpan pemanggil di
// settings.aiKeySalt). 16 byte acak kriptografis, base64.
export function generateKeySalt() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return bytesToBase64(bytes);
}

// Kunci AES-GCM diturunkan sekali per (UID, salt) lalu disimpan di memori
// modul selama sesi — PBKDF2 210 ribu iterasi tidak diulang untuk setiap
// kunci di pool. Kegagalan penurunan di-cache sebagai null (fail closed).
const derivedKeyCache = new Map();
async function deriveV2Key(uid, saltB64) {
    const cacheKey = uid + '|' + saltB64;
    if (derivedKeyCache.has(cacheKey)) return derivedKeyCache.get(cacheKey);
    const promise = (async () => {
        const subtle = globalThis.crypto && globalThis.crypto.subtle;
        if (!subtle) return null;
        try {
            const base = await subtle.importKey(
                'raw', new TextEncoder().encode(uid), 'PBKDF2', false, ['deriveKey']
            );
            return await subtle.deriveKey(
                { name: 'PBKDF2', salt: base64ToBytes(saltB64), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
                base,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
        } catch (e) {
            return null;
        }
    })();
    derivedKeyCache.set(cacheKey, promise);
    return promise;
}

async function decryptV2(stored, uid, saltB64) {
    if (!saltB64) return null;
    const subtle = globalThis.crypto && globalThis.crypto.subtle;
    if (!subtle) return null;
    const key = await deriveV2Key(uid, saltB64);
    if (!key) return null;
    try {
        const packed = base64ToBytes(stored.slice(V2_PREFIX.length));
        if (packed.length <= 12) return null;
        const plainBytes = await subtle.decrypt(
            { name: 'AES-GCM', iv: packed.subarray(0, 12) },
            key,
            packed.subarray(12)
        );
        return new TextDecoder().decode(plainBytes) || null;
    } catch (e) {
        return null;
    }
}

// Enkripsi satu kunci polos ke format v2. Null bila tidak bisa diamankan
// (tidak ada UID / salt / WebCrypto) — pemanggil WAJIB membatalkan
// penyimpanan daripada menulis kunci dalam bentuk lemah.
export async function encryptApiKeyForStorage(plainKey, uid, saltB64) {
    if (!plainKey || !uid || !saltB64) return null;
    const subtle = globalThis.crypto && globalThis.crypto.subtle;
    if (!subtle) return null;
    const key = await deriveV2Key(uid, saltB64);
    if (!key) return null;
    try {
        const iv = new Uint8Array(12);
        crypto.getRandomValues(iv);
        const cipher = new Uint8Array(await subtle.encrypt(
            { name: 'AES-GCM', iv }, key, new TextEncoder().encode(plainKey)
        ));
        const packed = new Uint8Array(iv.length + cipher.length);
        packed.set(iv, 0);
        packed.set(cipher, iv.length);
        return V2_PREFIX + bytesToBase64(packed);
    } catch (e) {
        return null;
    }
}

// Dekripsi satu entri tersimpan dari generasi mana pun: v2 (WebCrypto),
// AES r90 (CryptoJS), atau XOR warisan. isValidPlain menapis hasil
// dekripsi (mis. awalan 'gsk_' untuk Groq) supaya dekripsi coba-coba yang
// menghasilkan sampah tidak dianggap berhasil. Mengembalikan
// { plain, format: 'v2' | 'aes' | 'legacy' } atau null. Entri berpenanda
// v2 TIDAK pernah jatuh ke jalur warisan — penandanya tegas.
export async function decryptStoredApiKey(stored, uid, saltB64, isValidPlain) {
    if (!stored || typeof stored !== 'string' || !uid) return null;
    const valid = typeof isValidPlain === 'function' ? isValidPlain : (p) => !!p;

    if (isCurrentFormatEntry(stored)) {
        const plain = await decryptV2(stored, uid, saltB64);
        return plain && valid(plain) ? { plain, format: 'v2' } : null;
    }

    const aesPlain = EncryptionService.decryptApiKey(stored, uid);
    if (aesPlain && valid(aesPlain)) return { plain: aesPlain, format: 'aes' };

    const legacyPlain = legacyDecode(stored, uid);
    if (legacyPlain && valid(legacyPlain)) return { plain: legacyPlain, format: 'legacy' };

    return null;
}

// Migrasi daftar kunci: entri warisan (XOR maupun AES r90) yang terbaca
// ditulis ulang ke format v2; entri v2 dibiarkan; entri yang tidak
// terbaca sama sekali dipertahankan apa adanya. Tanpa salt, entri warisan
// tetap terbaca tetapi tidak bisa ditulis ulang — daftar dikembalikan
// apa adanya untuk entri itu. Mengembalikan { list, changed }.
export async function migrateStoredKeys(rawList, uid, saltB64, isValidPlain) {
    const list = Array.isArray(rawList) ? rawList.slice() : Object.values(rawList || {});
    let changed = false;
    const migrated = [];
    for (const entry of list) {
        const dec = await decryptStoredApiKey(entry, uid, saltB64, isValidPlain);
        if (dec && dec.format !== 'v2') {
            const reEncrypted = await encryptApiKeyForStorage(dec.plain, uid, saltB64);
            if (reEncrypted) {
                changed = true;
                migrated.push(reEncrypted);
                continue;
            }
        }
        migrated.push(entry);
    }
    return { list: migrated, changed };
}
