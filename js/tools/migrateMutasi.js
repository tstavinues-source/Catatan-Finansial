/**
 * ONE-OFF MIGRATION TOOL: Mengubah transaksi mutasi lawas menjadi tipe 'mutasi_keluar' dan 'mutasi_masuk'
 * (STERIL DARI BACKTICK MULTI-BARIS)
 */
import { AuraState } from '../core/state.js';
import { FirebaseService } from '../services/firebase.js';

export const runMutasiMigration = async () => {
    const transactions = AuraState.data.transactions || [];
    let toUpdate = [];

    transactions.forEach(trx => {
        if (trx.tipe !== 'mutasi_keluar' && trx.tipe !== 'mutasi_masuk') {
            let newType = null;
            
            if (trx.merchantName && trx.merchantName.indexOf('Mutasi ke ') === 0) {
                newType = 'mutasi_keluar';
            } else if (trx.merchantName && trx.merchantName.indexOf('Mutasi dari ') === 0) {
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

    if (toUpdate.length === 0) {
        console.log("✅ Tidak ada transaksi lawas yang perlu dimigrasi.");
        if (window.showToast) window.showToast("Tidak ada transaksi mutasi lawas yang ditemukan.");
        return;
    }

    console.group("PREVIEW MIGRASI MUTASI LAWAS");
    console.table(toUpdate);
    console.groupEnd();

    const msg = "Ditemukan <b>" + toUpdate.length + "</b> transaksi mutasi lawas.<br>" +
                "Cek <i>Console</i> browser Anda untuk melihat detail preview data.<br><br>" +
                "Eksekusi perubahan tipe data ke Cloud sekarang?";
                
    const confirmed = await window.AuraConfirm(msg);

    if (!confirmed) {
        console.log("❌ Migrasi dibatalkan oleh user.");
        return;
    }

    if (window.setProcessingStatus) window.setProcessingStatus(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < toUpdate.length; i++) {
        const item = toUpdate[i];
        try {
            await FirebaseService.updateTransaction(item.id, { tipe: item.newType });
            successCount++;
        } catch (e) {
            console.error("Gagal update transaksi ID: " + item.id, e);
            failCount++;
        }
    }

    if (window.setProcessingStatus) window.setProcessingStatus(false);
    console.log("Migrasi Selesai! Sukses: " + successCount + " | Gagal: " + failCount);
    if (window.showToast) window.showToast("Migrasi sukses: " + successCount + " data diperbarui.");
};

window.runMutasiMigration = runMutasiMigration;
