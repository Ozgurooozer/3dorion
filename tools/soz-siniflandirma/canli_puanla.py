#!/usr/bin/env python3
"""canli_puanla.py — Tur 4 (b) canlı koşusunu V1-V8'e göre puanlar (ön kayıt: docs/olcum-soz-siniflandirma.md).
Girdi: sonuc/canli-dusun.jsonl (hizmet günlüğü), sonuc/canli-karar.jsonl (Orion karar günlüğü), canli-zaman.txt, canli_kos.sh (söz listesi)."""
import hashlib
import json
import os
import re
import sys

import numpy as np

AYNI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AYNI)
for _a in (sys.stdout, sys.stderr):
    try:
        _a.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass
import olc  # noqa: E402

S = olc.SONUC
GERCEK_HAFIZA = os.path.join(os.environ["APPDATA"], "3dorion", "orion-hafiza.json")
HAFIZA_ONCE = "87e8a365087f2099"   # ön kayıtta donmuş
GUNLUK_ONCE = 257451               # 2026-10-02.jsonl boyutu (ön kayıt anı)


def satirlar(yol):
    return [json.loads(x) for x in open(yol, encoding="utf-8") if x.strip()]


def main():
    betik = open(os.path.join(S, "canli_kos.sh"), encoding="utf-8").read()
    sozler = [p.rsplit("@", 1)[0] for p in re.search(r'SOZ="([^"]+)"', betik).group(1).split("|")]
    n = len(sozler)
    hiz = satirlar(os.path.join(S, "canli-dusun.jsonl"))
    kar = satirlar(os.path.join(S, "canli-karar.jsonl"))
    zaman = open(os.path.join(S, "canli-zaman.txt"), encoding="utf-8").read()
    print("# Tur 4 (b) — canlı köprü (canli_puanla.py)")
    print("enjekte: %d söz | hizmet /dusun: %d istek | günlük satırı: %d" % (n, len(hiz), len(kar)))

    # V1: alınan /dusun sayısı (söz içeren istekler)
    sozlu = [h for h in hiz if h["sozler"]]
    print("\nV1 hizmet söz içeren /dusun aldı: %d/%d (toplam istek %d)" % (len(sozlu), n, len(hiz)))
    # V2: çıkarılan söz birebir
    alinan = [s for h in sozlu for s in h["sozler"]]
    esl = [s for s in sozler if s in alinan]
    eksik = [s for s in sozler if s not in alinan]
    print("V2 çıkarılan söz birebir: %d/%d (eksik: %s) | çoklu-söz içeren istek: %d" % (len(esl), n, eksik, sum(1 for h in sozlu if len(h["sozler"]) > 1)))
    # V3: sınıf = çevrimdışı B0
    uyumsuz = [(x["soz"], x["sinif"], olc.b0(x["soz"])[0]) for h in sozlu for x in h["siniflandirma"] if x["sinif"] != olc.b0(x["soz"])[0]]
    print("V3 hizmet sınıfı == çevrimdışı B0: %d/%d (uyumsuz: %s)" % (sum(len(h["siniflandirma"]) for h in sozlu) - len(uyumsuz), sum(len(h["siniflandirma"]) for h in sozlu), uyumsuz))
    # V4: enjeksiyon -> hizmete varış gecikmesi
    algi = {a["soz"]["metin"]: a["t"] for a in kar if a.get("tur") == "algi" and a.get("algi") == "duydum" and isinstance(a.get("soz"), dict)}
    gec = []
    for h in sozlu:
        for s in h["sozler"]:
            if s in algi:
                gec.append(h["t"] - algi[s])
    if gec:
        print("V4 enjeksiyon → hizmete varış: p50 %.0f ms · p95 %.0f ms · min %.0f · max %.0f · n=%d" % (np.percentile(gec, 50), np.percentile(gec, 95), min(gec), max(gec), len(gec)))
    # V5: günlükte 20 duydum, soz.metin birebir
    dy = [a for a in kar if a.get("tur") == "algi" and a.get("algi") == "duydum"]
    metinler = [a["soz"]["metin"] for a in dy if isinstance(a.get("soz"), dict)]
    print("V5 günlükte duydum: %d satır, soz.metin birebir eşleşen: %d/%d" % (len(dy), sum(1 for s in sozler if s in metinler), n))
    # V6: davranış değişmedi
    uy = [a for a in kar if a.get("tur") == "uyanis"]
    niyet = sum(len(a.get("niyetler", [])) for a in uy)
    cagri = sum(len(a.get("cagrilar", [])) for a in uy)
    hata = [a.get("hata") for a in uy if a.get("hata")]
    print("V6 uyanış %d · beden niyeti %d · LLM çağrısı %d · hata %s" % (len(uy), niyet, cagri, hata[:3]))
    # V7: gerçek hafıza ve günlük
    h = hashlib.sha256(open(GERCEK_HAFIZA, "rb").read()).hexdigest()[:16]
    g = os.path.getsize(os.path.join(os.environ["APPDATA"], "3dorion", "karar-kaydi", "2026-10-02.jsonl"))
    print("V7 gerçek hafıza özeti %s (önce %s) %s · gerçek günlük %d bayt (önce %d) %s" % (
        h, HAFIZA_ONCE, "AYNI" if h == HAFIZA_ONCE else "DEĞİŞTİ", g, GUNLUK_ONCE, "AYNI" if g == GUNLUK_ONCE else "DEĞİŞTİ"))
    # V8: kendiliğinden kapanış
    m = re.search(r"BASLA (\d+)", zaman)
    k = re.search(r"ELECTRON-CIKIS (\d+) (\d+)", zaman)
    print("V8 Orion çıkış kodu %s, süre %.1f sn (smoke 68 sn)" % (k.group(1), (int(k.group(2)) - int(m.group(1))) / 1000))
    # Sınıflandırma tablosu (bilgi): söz → B0 sınıfı, ms
    print("\nSöz → hizmet sınıfı (etiket):")
    etiket = {"sandalyenin yanına git": "hareket", "tahtaya bir şiir yaz": "yaz", "odada ne var": "sorgu", "günün nasıl geçiyor": "sohbet",
              "sakın oturma": "emin_degil", "buraya gel": "hareket", "ayağa kalk": "hareket", "tahtada ne yazıyor": "sorgu",
              "iyi akşamlar": "sohbet", "bak": "emin_degil", "go next to the table": "hareket", "write welcome on the board": "yaz",
              "where is the window": "sorgu", "how is your day going": "sohbet", "do not sit down": "emin_degil", "come over here": "hareket",
              "get up": "hareket", "what do you see now": "sorgu", "good evening": "sohbet", "go": "emin_degil"}
    dog = yan = 0
    for h2 in sozlu:
        for x in h2["siniflandirma"]:
            e = etiket.get(x["soz"], "?")
            dog += x["sinif"] == e
            yan += (x["sinif"] in olc.YOL and x["sinif"] != e)
            print("  %-28s → %-10s (%s) hedef=%s etiket=%s %s" % (x["soz"], x["sinif"], x["kaynak"], x["hedef"], e, "✓" if x["sinif"] == e else ("YANLIŞ YOL" if x["sinif"] in olc.YOL else "·")))
    print("doğru sınıf %d/%d | LLM'siz yanlış yola giden %d" % (dog, len(sozlu), yan))


if __name__ == "__main__":
    main()
