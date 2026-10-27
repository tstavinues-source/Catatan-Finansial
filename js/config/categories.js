/**
 * Categories & Staple Trackers Configuration
 * Menyimpan data kategori bawaan sistem.
 */

export const DEFAULT_SYSTEM_CATEGORIES = {
    // --- Pemasukan ---
    "cat_sys_13": { name: "Pemasukan", icon: "fa-money-bill-wave", color: "#10b981", type: "income", isSystem: true },
    "cat_sys_15": { name: "Gaji", icon: "fa-yen-sign", color: "#2dd4bf", type: "income", isSystem: true },
    // --- Makanan & Minuman ---
    "cat_sys_1": { name: "Makanan", icon: "fa-utensils", color: "#f97316", type: "expense", isSystem: true },
    "cat_sys_2": { name: "Minuman", icon: "fa-mug-hot", color: "#38bdf8", type: "expense", isSystem: true },
    "cat_sys_3": { name: "Bahan Pokok", icon: "fa-basket-shopping", color: "#a3e635", type: "expense", isSystem: true },
    "cat_sys_16": { name: "Buah", icon: "fa-apple-whole", color: "#fb7185", type: "expense", isSystem: true },
    "cat_sys_17": { name: "Sayuran", icon: "fa-carrot", color: "#4ade80", type: "expense", isSystem: true },
    "cat_sys_18": { name: "Daging", icon: "fa-drumstick-bite", color: "#ef4444", type: "expense", isSystem: true },
    "cat_sys_19": { name: "Bumbu/Bahan Masakan", icon: "fa-pepper-hot", color: "#fbbf24", type: "expense", isSystem: true },
    "cat_sys_20": { name: "Camilan", icon: "fa-cookie-bite", color: "#f472b6", type: "expense", isSystem: true },
    // --- Tagihan & Kewajiban ---
    "cat_sys_21": { name: "Tagihan & Utilitas", icon: "fa-file-invoice-dollar", color: "#3b82f6", type: "expense", isSystem: true },
    "cat_sys_4": { name: "Utilitas", icon: "fa-toolbox", color: "#6366f1", type: "expense", isSystem: true },
    "cat_sys_22": { name: "Listrik, Air & Gas", icon: "fa-bolt", color: "#facc15", type: "expense", isSystem: true },
    "cat_sys_23": { name: "Kas Apato", icon: "fa-building", color: "#60a5fa", type: "expense", isSystem: true },
    "cat_sys_24": { name: "Apato (Sewa)", icon: "fa-house", color: "#2563eb", type: "expense", isSystem: true },
    "cat_sys_25": { name: "Asuransi", icon: "fa-shield-halved", color: "#06b6d4", type: "expense", isSystem: true },
    "cat_sys_26": { name: "Nenkin", icon: "fa-coins", color: "#14b8a6", type: "expense", isSystem: true },
    "cat_sys_27": { name: "Pajak", icon: "fa-file-invoice", color: "#a855f7", type: "expense", isSystem: true },
    "cat_sys_28": { name: "Pajak Penghasilan", icon: "fa-percent", color: "#9333ea", type: "expense", isSystem: true },
    "cat_sys_29": { name: "Pajak Konsumsi", icon: "fa-receipt", color: "#c084fc", type: "expense", isSystem: true },
    "cat_sys_30": { name: "Admin Pengiriman", icon: "fa-truck", color: "#65a30d", type: "expense", isSystem: true },
    // --- Keluarga & Belanja ---
    "cat_sys_31": { name: "Keluarga", icon: "fa-heart", color: "#f43f5e", type: "expense", isSystem: true },
    "cat_sys_32": { name: "Istri", icon: "fa-ring", color: "#ec4899", type: "expense", isSystem: true },
    "cat_sys_33": { name: "Belanja Pribadi", icon: "fa-bag-shopping", color: "#a78bfa", type: "expense", isSystem: true },
    "cat_sys_8": { name: "Belanja Online", icon: "fa-box-open", color: "#7c3aed", type: "expense", isSystem: true },
    "cat_sys_9": { name: "Belanja Offline", icon: "fa-store", color: "#818cf8", type: "expense", isSystem: true },
    "cat_sys_12": { name: "Elektronik", icon: "fa-laptop", color: "#22d3ee", type: "expense", isSystem: true },
    "cat_sys_11": { name: "Pakaian", icon: "fa-shirt", color: "#db2777", type: "expense", isSystem: true },
    "cat_sys_34": { name: "Sabun", icon: "fa-soap", color: "#67e8f9", type: "expense", isSystem: true },
    "cat_sys_35": { name: "Hair Care", icon: "fa-scissors", color: "#a5b4fc", type: "expense", isSystem: true },
    "cat_sys_6": { name: "Kesehatan", icon: "fa-kit-medical", color: "#fb4d6d", type: "expense", isSystem: true },
    "cat_sys_36": { name: "Pengemasan & Penyimpanan", icon: "fa-box", color: "#fdba74", type: "expense", isSystem: true },
    // --- Lainnya ---
    "cat_sys_5": { name: "Transportasi", icon: "fa-train", color: "#0284c7", type: "expense", isSystem: true },
    "cat_sys_37": { name: "Hiburan & Hobi", icon: "fa-gamepad", color: "#d946ef", type: "expense", isSystem: true },
    "cat_sys_7": { name: "Hiburan", icon: "fa-film", color: "#e879f9", type: "expense", isSystem: true },
    "cat_sys_10": { name: "Pendidikan", icon: "fa-graduation-cap", color: "#4f46e5", type: "expense", isSystem: true },
    "cat_sys_38": { name: "Tabungan", icon: "fa-piggy-bank", color: "#eab308", type: "expense", isSystem: true },
    "cat_sys_39": { name: "Admin", icon: "fa-gear", color: "#94a3b8", type: "expense", isSystem: true },
    "cat_sys_40": { name: "Diskon", icon: "fa-tags", color: "#6ee7b7", type: "expense", isSystem: true },
    "cat_sys_41": { name: "Belanja Tunai Tak Tercatat", icon: "fa-money-bill", color: "#9ca3af", type: "expense", isSystem: true },
    "cat_sys_42": { name: "Pengeluaran Tidak Tercatat", icon: "fa-circle-question", color: "#9ca3af", type: "expense", isSystem: true },
    "cat_sys_14_default": { name: "Lainnya", icon: "fa-tag", color: "#6b7280", type: "both", isSystem: true }
};

export const DEFAULT_STAPLES_TRACKERS = {
    "beras": { name: "Beras", keywords: ["beras", "rice", "gohan", "nasi"] },
    "minyak": { name: "Minyak", keywords: ["minyak", "oil", "abura", "cooking oil", "goreng"] },
    "sabun": { name: "Sabun/Cuci", keywords: ["sabun", "soap", "deterjen", "rinso", "shampoo", "wash", "sunlight", "mama lemon"] }
};