/**
 * ONE-OFF MIGRATION TOOL: Mengubah transaksi mutasi lawas menjadi tipe 'mutasi_keluar' dan 'mutasi_masuk'
 */
import { AuraState } from '../core/state.js';
import { FirebaseService } from '../services/firebase.js';

export const runMutasiMigration = async () => {
    const transactions = AuraState.data.transactions || [];
    let toUpdate = [];

    // 1. Pindai dan siapkan data yang akan dimigrasi
    transactions.forEach(trx => {
        // Abaikan yang tipenya sudah benar
        if (trx.tipe !== 'mutasi_keluar' && trx.tipe !== 'mutasi_masuk') {
            let newType = null;
            
            if (trx.merchantName && trx.merchantName.startsWith('Mutasi ke ')) {
                newType = 'mutasi_keluar';
            } else if (trx.merchantName && trx.merchantName.startsWith('Mutasi dari ')) {
                newType = 'mutasi_masuk';
            }

            if (newType) {
                toUpdate.push({
                    id: trx.id,
                    merchantName: trx.merchantName,
                    oldType: trx.tipe,
                    newType: newType,
                    nominal: trx.nominal
                });
            }
        }
    });

    // 2. Jika tidak ada yang perlu diubah
    if (toUpdate.length === 0) {
        console.log("✅ Tidak ada transaksi lawas yang perlu dimigrasi.");
        if (window.showToast) window.showToast("Tidak ada transaksi mutasi lawas yang ditemukan.");
        return;
    }

    // 3. Tampilkan Preview di Console
    console.group("PREVIEW MIGRASI MUTASI LAWAS");
    console.table(toUpdate);
    console.groupEnd();

    // 4. Minta Konfirmasi Eksekusi (Menggunakan UI bawaan Anda)
    const confirmed = await window.AuraConfirm(
        `Ditemukan <b>${toUpdate.length}</b> transaksi mutasi lawas.<br>` +
        `Cek <i>Console</i> browser Anda untuk melihat detail preview data.<br><br>` +
        `Eksekusi perubahan tipe data ke Cloud sekarang?`
    );

    if (!confirmed) {
        console.log("❌ Migrasi dibatalkan oleh user.");
        return;
    }

    // 5. Eksekusi ke Firebase
    if (window.setProcessingStatus) window.setProcessingStatus(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of toUpdate) {
        try {
            await FirebaseService.updateTransaction(item.id, { tipe: item.newType });
            successCount++;
        } catch (e) {
            console.error(`Gagal update transaksi ID: ${item.id}`, e);
            failCount++;
        }
    }

    if (window.setProcessingStatus) window.setProcessingStatus(false);
    
    const resultMsg = `Migrasi Selesai! 🎉<br>Sukses: ${successCount}<br>Gagal: ${failCount}`;
    console.log(resultMsg.replace(/<br>/g, '\n'));
    
    // Tampilkan hasil akhir
    if (window.showToast) window.showToast(`Migrasi sukses: ${successCount} data diperbarui.`);
};

// Ekspos ke global agar bisa dipanggil dari Console browser dengan: window.runMutasiMigration()
window.runMutasiMigration = runMutasiMigration;
