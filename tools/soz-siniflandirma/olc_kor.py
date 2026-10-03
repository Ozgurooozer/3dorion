#!/usr/bin/env python3
"""olc_kor.py — Tur 6: komut sözlüğü (mind/komutSozlugu.ts `komutCoz`) BAĞIMSIZ YAZARIN kör setinde (fixtures/soz/kor.json).
Ön kayıt: docs/olcum-soz-siniflandirma.md "Tur 6". Aynı betik genişletmeden ÖNCE ve SONRA koşar; fark = genişletmenin etkisi.

  python tools/soz-siniflandirma/olc_kor.py [--onceki-kayit sonuc/kor-once.json] [--kaydet sonuc/kor-once.json]

Roller: pozitif = etiket hareket; nötr = emin_degil/bilesik (sözlüğün bilerek zincir yazdığı tür); SORU kovası = emin_degil/soru (komut sorusu
biçimi: karar Ozyn'ın, yanlış da doğru da SAYILMAZ, ayrı raporlanır); negatif = geri kalan her şey (eşleşirse YANLIŞ).
"""
import argparse
import json
import os
import subprocess
import sys

AYNI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AYNI)
for _a in (sys.stdout, sys.stderr):
    try:
        _a.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass
import olc  # noqa: E402

KOR = os.path.join(olc.KOK, "fixtures", "soz", "kor.json")


def rol(o):
    if o["etiket"] == "hareket":
        return "poz"
    if o["etiket"] == "emin_degil" and o.get("alt") == "bilesik":
        return "notr"
    if o["etiket"] == "emin_degil" and o.get("alt") == "soru":
        return "soru"
    return "neg"


def coz(sozler):
    yol = os.path.join(olc.SONUC, "kor_girdi.json")
    json.dump(sorted(set(sozler)), open(yol, "w", encoding="utf-8"), ensure_ascii=False)
    p = subprocess.run(["node", "--experimental-strip-types", os.path.join(AYNI, "uretim_sozluk.ts"), yol],
                       cwd=olc.KOK, capture_output=True, text=True, encoding="utf-8", timeout=120)
    os.remove(yol)
    assert p.returncode == 0, p.stderr[-500:]
    return {x["soz"]: x["program"] for x in json.loads(p.stdout)}


def olcu(kor, prog):
    cikti = {}
    for dil in ("hepsi", "tr", "en"):
        sub = [o for o in kor if dil == "hepsi" or o["dil"] == dil]
        poz = [o for o in sub if rol(o) == "poz"]
        neg = [o for o in sub if rol(o) == "neg"]
        soru = [o for o in sub if rol(o) == "soru"]
        notr = [o for o in sub if rol(o) == "notr"]
        cikti[dil] = {"n": len(sub), "poz": len(poz), "kapsanan": sum(1 for o in poz if prog[o["soz"]]),
                      "kacan": [o["soz"] for o in poz if not prog[o["soz"]]],
                      "neg": len(neg), "yanlis": [(o["soz"], o["etiket"], o.get("alt", "")) for o in neg if prog[o["soz"]]],
                      "soru": len(soru), "soru_eslesen": [o["soz"] for o in soru if prog[o["soz"]]],
                      "notr_eslesen": sum(1 for o in notr if prog[o["soz"]])}
    return cikti


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kaydet")
    ap.add_argument("--onceki")
    ap.add_argument("--kor", default=KOR, help="kör set dosyası (varsayılan fixtures/soz/kor.json; Tur 6b: kor2.json)")
    a = ap.parse_args()
    kor = json.load(open(a.kor, encoding="utf-8"))["sozler"]
    prog = coz([o["soz"] for o in kor])
    r = olcu(kor, prog)
    print("# Tur 6 — kör set (olc_kor.py)")
    print("%s %s | mind/komutSozlugu.ts %s | n=%d" % (os.path.basename(a.kor), olc.sha(a.kor), olc.sha(os.path.join(olc.KOK, "mind", "komutSozlugu.ts")), len(kor)))
    print("\n| dil | n | pozitif | kapsama | negatif | YANLIŞ eşleşme | soru kovası eşleşen | bileşik eşleşen |\n|---|---|---|---|---|---|---|---|")
    for dil, x in r.items():
        print("| %s | %d | %d | %d/%d (%d%%) | %d | %d | %d/%d | %d |" % (
            dil, x["n"], x["poz"], x["kapsanan"], x["poz"], round(100 * x["kapsanan"] / x["poz"]) if x["poz"] else 0,
            x["neg"], len(x["yanlis"]), len(x["soru_eslesen"]), x["soru"], x["notr_eslesen"]))
    print("\nYANLIŞ eşleşmeler:", r["hepsi"]["yanlis"] or "(yok)")
    print("Soru kovasında eşleşenler (Ozyn kararı):", r["hepsi"]["soru_eslesen"] or "(yok)")
    print("KAÇAN pozitifler (tr):", r["tr"]["kacan"])
    print("KAÇAN pozitifler (en):", r["en"]["kacan"])
    if a.kaydet:
        json.dump(r, open(a.kaydet, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if a.onceki:
        o = json.load(open(a.onceki, encoding="utf-8"))
        print("\nÖNCE → SONRA kapsama: hepsi %d→%d, tr %d→%d, en %d→%d (pozitif %d)" % (
            o["hepsi"]["kapsanan"], r["hepsi"]["kapsanan"], o["tr"]["kapsanan"], r["tr"]["kapsanan"], o["en"]["kapsanan"], r["en"]["kapsanan"], r["hepsi"]["poz"]))


if __name__ == "__main__":
    main()
