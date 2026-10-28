#!/usr/bin/env python3
"""AuraFi connector helper for Muse.

Talks to the AuraFi Firebase Realtime Database AS THE USER who generated a
connection code in the app (Pengaturan -> Hubungkan ke Muse). The code holds
that user's own Firebase Auth refresh token; this helper exchanges it for a
short-lived access token and only ever touches the subtree
aurafi_ledger/<that user's uid>. It never sees or needs any project-level
secret (no database secret, no service account).

Connection code sources (first hit wins):
  1. --code-file PATH   (a file containing the code; how a vault-backed
                         Muse setup should hand it over)
  2. AURAFI_CODE        (environment variable)

Usage:
  aurafi.py whoami
  aurafi.py get transactions
  aurafi.py get transactions/<id>
  aurafi.py balances
  aurafi.py put settings/mascotDirective '{"mood":"senang","text":"..."}'
  aurafi.py patch settings '{"displayCurrency":"IDR"}'
  aurafi.py post transactions '<transaction json>'
  aurafi.py delete transactions/<id>
  aurafi.py say --mood senang --text "Selamat, target brankas tercapai!"

Paths are relative to aurafi_ledger/<uid>/ and are restricted to the app's
known top-level nodes. Output is JSON on stdout.
"""
import base64
import json
import os
import sys
import urllib.parse
import urllib.request

ALLOWED_TOP = {
    "transactions", "settings", "goals", "wallets",
    "archives", "audit_logs", "oracleChats",
}


def load_code():
    code = None
    args = sys.argv[1:]
    if "--code-file" in args:
        i = args.index("--code-file")
        with open(args[i + 1], "r", encoding="utf-8") as fh:
            code = fh.read().strip()
        del args[i:i + 2]
        sys.argv = [sys.argv[0]] + args
    if not code:
        code = os.environ.get("AURAFI_CODE", "").strip()
    if not code:
        raise SystemExit("Kode koneksi tidak ditemukan. Berikan lewat --code-file atau variabel AURAFI_CODE.")
    if code.startswith("AURAFI1:"):
        code = code[len("AURAFI1:"):]
    pad = "=" * (-len(code) % 4)
    payload = json.loads(base64.urlsafe_b64decode(code + pad).decode("utf-8"))
    for key in ("apiKey", "databaseURL", "uid", "refreshToken"):
        if not payload.get(key):
            raise SystemExit(f"Kode koneksi tidak lengkap: kolom {key} kosong.")
    return payload


def http(method, url, body=None, headers=None):
    data = None
    hdrs = dict(headers or {})
    if body is not None:
        data = body if isinstance(body, bytes) else body.encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            text = resp.read().decode("utf-8")
            return resp.status, json.loads(text) if text else None
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8", "replace")
        return e.code, text


class AuraFi:
    def __init__(self, cfg):
        self.cfg = cfg
        self._token = None

    def token(self):
        if self._token:
            return self._token
        body = urllib.parse.urlencode({
            "grant_type": "refresh_token",
            "refresh_token": self.cfg["refreshToken"],
        })
        status, data = http(
            "POST",
            f"https://securetoken.googleapis.com/v1/token?key={self.cfg['apiKey']}",
            body=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if status != 200 or not isinstance(data, dict) or not data.get("id_token"):
            raise SystemExit(f"Penukaran token gagal (HTTP {status}): {data}")
        if data.get("user_id") and data["user_id"] != self.cfg["uid"]:
            raise SystemExit("Token tidak cocok dengan uid pada kode koneksi.")
        self._token = data["id_token"]
        return self._token

    def url(self, path):
        parts = [p for p in path.strip("/").split("/") if p]
        if not parts or parts[0] not in ALLOWED_TOP:
            raise SystemExit(f"Jalur ditolak: hanya {sorted(ALLOWED_TOP)} di bawah akun pengguna sendiri.")
        safe = "/".join(urllib.parse.quote(p, safe="") for p in parts)
        return f"{self.cfg['databaseURL']}/aurafi_ledger/{self.cfg['uid']}/{safe}.json?auth={self.token()}"

    def call(self, method, path, payload=None):
        body = json.dumps(payload) if payload is not None else None
        headers = {"Content-Type": "application/json"} if body else None
        status, data = http(method, self.url(path), body=body, headers=headers)
        if status >= 300:
            raise SystemExit(f"{method} {path} gagal (HTTP {status}): {data}")
        return data


def compute_balances(client):
    wallets = client.call("GET", "wallets") or {}
    txs = client.call("GET", "transactions") or {}
    if isinstance(wallets, dict):
        wallet_list = [dict(v, id=k) if isinstance(v, dict) else {"id": k} for k, v in wallets.items()]
    else:
        wallet_list = wallets
    balances = {w["id"]: 0 for w in wallet_list}
    names = {w["id"]: w.get("name", w["id"]) for w in wallet_list}
    for t in (txs.values() if isinstance(txs, dict) else txs):
        if not isinstance(t, dict) or t.get("is_deleted"):
            continue
        wid = t.get("wallet_id")
        if wid not in balances:
            continue
        val = float(t.get("nominal") or 0)
        fee = float(t.get("admin_fee") or 0)
        tipe = t.get("tipe")
        if tipe in ("pemasukan", "mutasi_masuk"):
            balances[wid] += val
        elif tipe in ("pengeluaran", "mutasi_keluar", "nabung"):
            balances[wid] -= val
        elif tipe == "tarik_tunai":
            balances[wid] -= val + fee
        elif tipe == "setor_tunai":
            balances[wid] -= val + fee
    return {names[k]: round(v, 2) for k, v in balances.items()}


def main():
    cfg = load_code()
    client = AuraFi(cfg)
    args = sys.argv[1:]
    if not args:
        raise SystemExit(__doc__)
    cmd = args[0]
    if cmd == "whoami":
        client.token()
        print(json.dumps({"ok": True, "uid": cfg["uid"], "database": cfg["databaseURL"]}))
    elif cmd == "balances":
        print(json.dumps(compute_balances(client), ensure_ascii=False))
    elif cmd == "say":
        mood, text = "ramah", ""
        rest = args[1:]
        for i, a in enumerate(rest):
            if a == "--mood" and i + 1 < len(rest):
                mood = rest[i + 1]
            if a == "--text" and i + 1 < len(rest):
                text = rest[i + 1]
        if not text:
            raise SystemExit('say membutuhkan --text "..."')
        import time
        out = client.call("PUT", "settings/mascotDirective",
                          {"mood": mood, "text": text, "at": int(time.time() * 1000)})
        print(json.dumps({"ok": True, "written": out}, ensure_ascii=False))
    elif cmd in ("get", "delete"):
        print(json.dumps(client.call(cmd.upper(), args[1]), ensure_ascii=False))
    elif cmd in ("put", "patch", "post"):
        payload = json.loads(args[2])
        print(json.dumps(client.call(cmd.upper(), args[1], payload), ensure_ascii=False))
    else:
        raise SystemExit(f"Perintah tidak dikenal: {cmd}")


if __name__ == "__main__":
    main()
