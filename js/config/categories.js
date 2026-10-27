/**
 * Categories & Staple Trackers Configuration
 * Menyimpan data kategori bawaan sistem.
 */

export const DEFAULT_SYSTEM_CATEGORIES = {
    // --- Pemasukan ---
    "cat_sys_13": { name: "Pemasukan", icon: "fa-money-bill-wave", color: "#82b366", type: "income", isSystem: true },
    "cat_sys_15": { name: "Gaji", icon: "fa-yen-sign", color: "#82b366", type: "income", isSystem: true },
    // --- Makanan & Minuman ---
    "cat_sys_1": { name: "Makanan", icon: "fa-utensils", color: "#cf8a5f", type: "expense", isSystem: true },
    "cat_sys_2": { name: "Minuman", icon: "fa-mug-hot", color: "#7ea6c9", type: "expense", isSystem: true },
    "cat_sys_3": { name: "Bahan Pokok", icon: "fa-basket-shopping", color: "#a3b86b", type: "expense", isSystem: true },
    "cat_sys_16": { name: "Buah", icon: "fa-apple-whole", color: "#cf7d6f", type: "expense", isSystem: true },
    "cat_sys_17": { name: "Sayuran", icon: "fa-carrot", color: "#93b06a", type: "expense", isSystem: true },
    "cat_sys_18": { name: "Daging", icon: "fa-drumstick-bite", color: "#bf7355", type: "expense", isSystem: true },
    "cat_sys_19": { name: "Bumbu/Bahan Masakan", icon: "fa-pepper-hot", color: "#c08a3e", type: "expense", isSystem: true },
    "cat_sys_20": { name: "Camilan", icon: "fa-cookie-bite", color: "#c9a25e", type: "expense", isSystem: true },
    // --- Tagihan & Kewajiban ---
    "cat_sys_21": { name: "Tagihan & Utilitas", icon: "fa-file-invoice-dollar", color: "#7fb2d9", type: "expense", isSystem: true },
    "cat_sys_4": { name: "Utilitas", icon: "fa-toolbox", color: "#8fb0cc", type: "expense", isSystem: true },
    "cat_sys_22": { name: "Listrik, Air & Gas", icon: "fa-bolt", color: "#d3ac55", type: "expense", isSystem: true },
    "cat_sys_23": { name: "Kas Apato", icon: "fa-building", color: "#8ea6bd", type: "expense", isSystem: true },
    "cat_sys_24": { name: "Apato (Sewa)", icon: "fa-house", color: "#7e97ad", type: "expense", isSystem: true },
    "cat_sys_25": { name: "Asuransi", icon: "fa-shield-halved", color: "#7d9dbd", type: "expense", isSystem: true },
    "cat_sys_26": { name: "Nenkin", icon: "fa-coins", color: "#6f8faf", type: "expense", isSystem: true },
    "cat_sys_27": { name: "Pajak", icon: "fa-file-invoice", color: "#a08bb4", type: "expense", isSystem: true },
    "cat_sys_28": { name: "Pajak Penghasilan", icon: "fa-percent", color: "#9783b0", type: "expense", isSystem: true },
    "cat_sys_29": { name: "Pajak Konsumsi", icon: "fa-receipt", color: "#b09bc0", type: "expense", isSystem: true },
    "cat_sys_30": { name: "Admin Pengiriman", icon: "fa-truck", color: "#93a3b1", type: "expense", isSystem: true },
    // --- Keluarga & Belanja ---
    "cat_sys_31": { name: "Keluarga", icon: "fa-heart", color: "#cf7d7d", type: "expense", isSystem: true },
    "cat_sys_32": { name: "Istri", icon: "fa-ring", color: "#d18a9e", type: "expense", isSystem: true },
    "cat_sys_33": { name: "Belanja Pribadi", icon: "fa-bag-shopping", color: "#9d8bc4", type: "expense", isSystem: true },
    "cat_sys_8": { name: "Belanja Online", icon: "fa-box-open", color: "#a390c9", type: "expense", isSystem: true },
    "cat_sys_9": { name: "Belanja Offline", icon: "fa-store", color: "#8f80ba", type: "expense", isSystem: true },
    "cat_sys_12": { name: "Elektronik", icon: "fa-laptop", color: "#8b98a8", type: "expense", isSystem: true },
    "cat_sys_11": { name: "Pakaian", icon: "fa-shirt", color: "#c48bb0", type: "expense", isSystem: true },
    "cat_sys_34": { name: "Sabun", icon: "fa-soap", color: "#7fb5a8", type: "expense", isSystem: true },
    "cat_sys_35": { name: "Hair Care", icon: "fa-scissors", color: "#86b8ad", type: "expense", isSystem: true },
    "cat_sys_6": { name: "Kesehatan", icon: "fa-kit-medical", color: "#d48a8a", type: "expense", isSystem: true },
    "cat_sys_36": { name: "Pengemasan & Penyimpanan", icon: "fa-box", color: "#a89a85", type: "expense", isSystem: true },
    // --- Lainnya ---
    "cat_sys_5": { name: "Transportasi", icon: "fa-train", color: "#6fa8a0", type: "expense", isSystem: true },
    "cat_sys_37": { name: "Hiburan & Hobi", icon: "fa-gamepad", color: "#a58bd4", type: "expense", isSystem: true },
    "cat_sys_7": { name: "Hiburan", icon: "fa-film", color: "#9d8bc4", type: "expense", isSystem: true },
    "cat_sys_10": { name: "Pendidikan", icon: "fa-graduation-cap", color: "#7ea8c4", type: "expense", isSystem: true },
    "cat_sys_38": { name: "Tabungan", icon: "fa-piggy-bank", color: "#cbb26a", type: "expense", isSystem: true },
    "cat_sys_39": { name: "Admin", icon: "fa-gear", color: "#8b98a8", type: "expense", isSystem: true },
    "cat_sys_40": { name: "Diskon", icon: "fa-tags", color: "#bd9a55", type: "expense", isSystem: true },
    "cat_sys_41": { name: "Belanja Tunai Tak Tercatat", icon: "fa-money-bill", color: "#8a8f98", type: "expense", isSystem: true },
    "cat_sys_42": { name: "Pengeluaran Tidak Tercatat", icon: "fa-circle-question", color: "#8a8f98", type: "expense", isSystem: true },
    "cat_sys_14_default": { name: "Lainnya", icon: "fa-tag", color: "#6b7280", type: "both", isSystem: true }
};

export const DEFAULT_STAPLES_TRACKERS = {
    "beras": { name: "Beras", keywords: ["beras", "rice", "gohan", "nasi"] },
    "minyak": { name: "Minyak", keywords: ["minyak", "oil", "abura", "cooking oil", "goreng"] },
    "sabun": { name: "Sabun/Cuci", keywords: ["sabun", "soap", "deterjen", "rinso", "shampoo", "wash", "sunlight", "mama lemon"] }
};