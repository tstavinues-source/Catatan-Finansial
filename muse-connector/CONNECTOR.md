# Muse Connector — AuraFi

Lets a user's own Muse work with their AuraFi finance ledger: read
transactions, wallets, savings goals and settings, record new transactions,
and send a short greeting through the Hachi mascot.

## How identity works (read this first)

AuraFi has no shared "admin" credential for users. In the app, each user
generates a personal **connection code** (Pengaturan → Hubungkan ke Muse →
Tampilkan Kode Koneksi). The code carries that user's own Firebase Auth
refresh token plus the app's public config. Whoever holds the code acts as
that user — treat it like a house key:

- The user pastes the code only into Muse's **Secure Vault** flow, never
  into ordinary chat.
- The helper (`bin/aurafi.py`) exchanges the refresh token for a 1-hour
  access token at call time and only ever addresses
  `aurafi_ledger/<the code's uid>/…`. Paths outside the known top-level
  nodes (transactions, settings, goals, wallets, archives, audit_logs,
  oracleChats) are refused by the helper itself.
- The user can revoke access at any time by changing their AuraFi account
  password (this invalidates the refresh token).

## Setup

1. Copy this `muse-connector/` folder to `~/workspace/custom-connectors/custom.aurafi/`
   on the Muse machine.
2. Ask the user for their connection code through the Secure Vault API-access
   flow (see `connector.yaml`). Save the returned credential reference; never
   print the code.
3. At call time, write the code to a temporary file (mode 600) and pass it
   with `--code-file`, or set `AURAFI_CODE`. Delete the file afterwards.

## Commands

```bash
python3 bin/aurafi.py --code-file /path/code.txt whoami
python3 bin/aurafi.py --code-file /path/code.txt balances
python3 bin/aurafi.py --code-file /path/code.txt get transactions
python3 bin/aurafi.py --code-file /path/code.txt get transactions/<id>
python3 bin/aurafi.py --code-file /path/code.txt post transactions '<json>'
python3 bin/aurafi.py --code-file /path/code.txt patch transactions/<id> '<json>'
python3 bin/aurafi.py --code-file /path/code.txt delete transactions/<id>
python3 bin/aurafi.py --code-file /path/code.txt say --mood senang --text "Target brankas tercapai!"
```

`say` writes `settings/mascotDirective` — a short message the in-app mascot
shows with top priority. Keep it brief, warm, and factual.

## Data shape (transactions)

A transaction record looks like:

```json
{
  "merchantName": "COSMOS", "storeName": "COSMOS",
  "tanggal": "2026-10-28", "createdAt": "2026-10-28T10:56:00.000Z",
  "nominal": 3059, "mata_uang": "JPY",
  "wallet_id": "<wallet id>", "metode_pembayaran": "tunai",
  "tipe": "pengeluaran", "kategori": "Belanja Harian",
  "description": "", "isCustomDescription": false, "is_deleted": false,
  "items": [{"itemId": "itm_x", "nama_barang": "Susu 1L", "harga": 258,
             "qty": 1, "kategori_barang": "Minuman", "kelompok": "Pribadi",
             "tax_rate": 0, "paymentMethod": "tunai", "timestamp": 0}],
  "admin_fee": 0, "user_id": "<nickname>"
}
```

Wallet balances are not stored; they are computed from transactions:
pemasukan/mutasi_masuk add; pengeluaran/mutasi_keluar/nabung subtract;
tarik_tunai/setor_tunai subtract amount + admin_fee. `balances` in the
helper already applies this rule.
