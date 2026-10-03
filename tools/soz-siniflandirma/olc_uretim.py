#!/usr/bin/env python3
"""olc_uretim.py — Tur 5: ÜRETİM komut sözlüğü (mind/komutSozlugu.ts `komutCoz`) benim veri setlerimde.
Ön kayıt: docs/olcum-soz-siniflandirma.md "Tur 5". olc.py ve diğer donmuş dosyalar değişmedi.

  python tools/soz-siniflandirma/olc_uretim.py kalibre
  python tools/soz-siniflandirma/olc_uretim.py puanla

Kapsam: sözlük yalnız beden komutu (hareket) programları içerir; bu yüzden metrik YALNIZ `hareket` yoludur:
  - yola giden = sözlük (P) ya da B0 (sınıf hareket) eşleşti;
  - pozitif   = etiketi hareket;   nötr = etiketi emin_degil VE bileşik (ve/and/then/sonra: sözlüğün bilerek
    zincir programı yazdığı "masaya git ve otur" türü, yanlış sayılmaz);   negatif = geri kalan her şey.
  - kapsama = eşleşen pozitif / tüm pozitif;  yanlış = eşleşen negatif.
Veri setleri sözlüğün yazarlarının (başka oturum) GÖRMEDİĞİ metinlerdir; gerçek 71 söz hariç (onlar kalıplar
yazılırken görüldü, spec 13 Faz 2b'nin kendi notu).
"""
import json
import os
import re
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
import olc_cift  # noqa: E402

BILESIK = re.compile(r"\b(ve|and|then|sonra)\b")
CANLI_ETIKET = {"sandalyenin yanına git": "hareket", "tahtaya bir şiir yaz": "yaz", "odada ne var": "sorgu", "günün nasıl geçiyor": "sohbet",
                "sakın oturma": "emin_degil", "buraya gel": "hareket", "ayağa kalk": "hareket", "tahtada ne yazıyor": "sorgu",
                "iyi akşamlar": "sohbet", "bak": "emin_degil", "go next to the table": "hareket", "write welcome on the board": "yaz",
                "where is the window": "sorgu", "how is your day going": "sohbet", "do not sit down": "emin_degil", "come over here": "hareket",
                "get up": "hareket", "what do you see now": "sorgu", "good evening": "sohbet", "go": "emin_degil"}


def rol(etiket, soz):
    """pozitif / notr / negatif"""
    if etiket == "hareket":
        return "poz"
    if etiket == "emin_degil" and BILESIK.search(olc.tr_katla(soz)):
        return "notr"
    return "neg"


def olcu(satirlar):
    """satirlar: [(soz, etiket, eslesti)] -> sayılar."""
    poz = [s for s in satirlar if rol(s[1], s[0]) == "poz"]
    neg = [s for s in satirlar if rol(s[1], s[0]) == "neg"]
    notr = [s for s in satirlar if rol(s[1], s[0]) == "notr"]
    return {"n": len(satirlar), "poz": len(poz), "kapsanan": sum(1 for s in poz if s[2]),
            "yanlis": [s[0] for s in neg if s[2]], "notr_eslesen": sum(1 for s in notr if s[2]),
            "kacan": [s[0] for s in poz if not s[2]]}


def uretim_coz(metinler):
    benzersiz = sorted(set(metinler))
    yol = os.path.join(olc.SONUC, "uretim_girdi.json")
    json.dump(benzersiz, open(yol, "w", encoding="utf-8"), ensure_ascii=False)
    p = subprocess.run(["node", "--experimental-strip-types", os.path.join(AYNI, "uretim_sozluk.ts"), yol],
                       cwd=olc.KOK, capture_output=True, text=True, encoding="utf-8", timeout=120)
    assert p.returncode == 0, p.stderr[-500:]
    sonuc = {x["soz"]: x["program"] for x in json.loads(p.stdout)}
    os.remove(yol)
    return sonuc


def kalibre():
    s = [("otur", "hareket", True), ("bana gel", "hareket", True), ("ayağa kalk", "hareket", False),
         ("oturabilir misin?", "sohbet", False), ("oturma", "emin_degil", True),
         ("masaya git ve otur", "emin_degil", True), ("kalk ve masaya git", "emin_degil", False)]
    o = olcu(s)
    assert o["poz"] == 3 and o["kapsanan"] == 2 and o["yanlis"] == ["oturma"] and o["notr_eslesen"] == 1 and o["kacan"] == ["ayağa kalk"], o
    assert rol("emin_degil", "go and sit") == "notr" and rol("emin_degil", "oturma") == "neg" and rol("sohbet", "merhaba") == "neg"
    # tek kaynak: B0'ın "hareket" kararı olc.b0 ile aynı
    assert olc.b0("otur")[0] == "hareket"
    # üretim sözlüğü sarmalayıcısı çalışıyor ve bilinen girdileri doğru çözüyor
    r = uretim_coz(["otur", "bana gel", "kalk", "oturabilir misin?", "blabla"])
    assert r["otur"] and r["bana gel"] and r["kalk"] and r["oturabilir misin?"] is None and r["blabla"] is None, r
    print("olc_uretim kalibre: TAMAM (rol, ölçü, bileşik nötr, sarmalayıcı)")


def puanla():
    ornekler = olc.yukle()
    tutulan, _atilan, _ = olc_cift.yukle_cift()
    kume = {}
    kume["gercek 71 (sözlük yazarları gördü)"] = [(o["soz"], o["etiket"]) for o in ornekler if o["kaynak"] == "gercek"]
    kume["tohum orijinal (benim, 163)"] = [(o["soz"], o["etiket"]) for o in ornekler if o["kaynak"] == "uretilmis" and "türev" not in o["not"]]
    kume["tohum türev (ASCII/yazım)"] = [(o["soz"], o["etiket"]) for o in ornekler if o["kaynak"] == "uretilmis" and "türev" in o["not"]]
    for k in olc_cift.KOSULLAR:
        kume["çift " + k] = [(olc_cift.kosul_metinleri(c)[k], c["etiket"]) for c in tutulan]
    kume["canlı 20"] = list(CANLI_ETIKET.items())

    hepsi = [s for v in kume.values() for s, _ in v]
    prod = uretim_coz(hepsi)
    print("# Tur 5 karnesi (olc_uretim.py) — üretim komut sözlüğü (P) vs benim B0'ım")
    print("olc_uretim.py %s | uretim_sozluk.ts %s | mind/komutSozlugu.ts %s | etiketli %s | cift %s" % (
        olc.sha(os.path.abspath(__file__)), olc.sha(os.path.join(AYNI, "uretim_sozluk.ts")),
        olc.sha(os.path.join(olc.KOK, "mind", "komutSozlugu.ts")), olc.sha(olc.ETIKET), olc.sha(olc_cift.CIFT)))
    print("\n| küme | n | pozitif | P kapsama | P yanlış | P nötr | B0 kapsama | B0 yanlış |\n|---|---|---|---|---|---|---|---|")
    ayrinti = {}
    for ad, v in kume.items():
        p = olcu([(s, e, prod[s] is not None) for s, e in v])
        b = olcu([(s, e, olc.b0(s)[0] == "hareket") for s, e in v])
        ayrinti[ad] = (p, b)
        yz = lambda x: "%d%%" % round(100 * x["kapsanan"] / x["poz"]) if x["poz"] else "-"
        print("| %s | %d | %d | %d/%d (%s) | %d | %d | %d/%d (%s) | %d |" % (
            ad, p["n"], p["poz"], p["kapsanan"], p["poz"], yz(p), len(p["yanlis"]), p["notr_eslesen"], b["kapsanan"], b["poz"], yz(b), len(b["yanlis"])))
    print("\nP yanlış eşleşmeler (negatif sözde program çalıştı):")
    any_y = False
    for ad, (p, b) in ayrinti.items():
        if p["yanlis"]:
            any_y = True
            print("  %s: %s" % (ad, p["yanlis"]))
    if not any_y:
        print("  (yok)")
    print("\nP'nin KAÇIRDIĞI pozitif sözler (genişletme adayı):")
    for ad in ("çift tr", "çift en", "canlı 20", "tohum orijinal (benim, 163)"):
        print("  %s: %s" % (ad, ayrinti[ad][0]["kacan"]))
    print("\nP'nin YAKALADIĞI (her kümede pozitifler, tekil):")
    yak = sorted({s for v in kume.values() for s, e in v if rol(e, s) == "poz" and prod[s] is not None})
    print("  ", yak)


if __name__ == "__main__":
    {"kalibre": kalibre, "puanla": puanla}[sys.argv[1]]()
