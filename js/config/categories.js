/**
 * Categories & Staple Trackers Configuration
 * Menyimpan data kategori bawaan sistem.
 */

export const DEFAULT_SYSTEM_CATEGORIES = {
    "cat_sys_1": { name: "Makanan", icon: "fa-burger", color: "#fb923c", type: "expense", isSystem: true },
    "cat_sys_2": { name: "Minuman", icon: "fa-mug-hot", color: "#60a5fa", type: "expense", isSystem: true },
    "cat_sys_3": { name: "Bahan Pokok", icon: "fa-basket-shopping", color: "#4ade80", type: "expense", isSystem: true },
    "cat_sys_4": { name: "Utilitas", icon: "fa-file-invoice-dollar", color: "#facc15", type: "expense", isSystem: true },
    "cat_sys_5": { name: "Transportasi", icon: "fa-train", color: "#34d399", type: "expense", isSystem: true },
    "cat_sys_6": { name: "Kesehatan", icon: "fa-kit-medical", color: "#fb7185", type: "expense", isSystem: true },
    "cat_sys_7": { name: "Hiburan", icon: "fa-gamepad", color: "#c084fc", type: "expense", isSystem: true },
    "cat_sys_8": { name: "Belanja Online", icon: "fa-box-open", color: "#f472b6", type: "expense", isSystem: true },
    "cat_sys_9": { name: "Belanja Offline", icon: "fa-shop", color: "#818cf8", type: "expense", isSystem: true },
    "cat_sys_10": { name: "Pendidikan", icon: "fa-graduation-cap", color: "#22d3ee", type: "expense", isSystem: true },
    "cat_sys_11": { name: "Pakaian", icon: "fa-shirt", color: "#e879f9", type: "expense", isSystem: true },
    "cat_sys_12": { name: "Elektronik", icon: "fa-laptop", color: "#94a3b8", type: "expense", isSystem: true },
    "cat_sys_13": { name: "Pemasukan", icon: "fa-money-bill-wave", color: "#10b981", type: "income", isSystem: true },
    "cat_sys_14_default": { name: "Lainnya", icon: "fa-tag", color: "#52525b", type: "both", isSystem: true }
};

export const DEFAULT_STAPLES_TRACKERS = {
    "beras": { name: "Beras", keywords: ["beras", "rice", "gohan", "nasi"] },
    "minyak": { name: "Minyak", keywords: ["minyak", "oil", "abura", "cooking oil", "goreng"] },
    "sabun": { name: "Sabun/Cuci", keywords: ["sabun", "soap", "deterjen", "rinso", "shampoo", "wash", "sunlight", "mama lemon"] }
};