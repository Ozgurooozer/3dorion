#!/usr/bin/env python3
"""http_dene.py — Tur 4 (a): B0 hizmetini HTTP sınırında ölçer. Ön kayıt: docs/olcum-soz-siniflandirma.md "Tur 4".

  python tools/soz-siniflandirma/http_dene.py     (hizmeti kendisi başlatır ve kapatır)

Ölçülenler: U1 sözleşme (projenin kendi `tools/beyin-tekrar.ts --beyin=dis` istemcisiyle fixtures/beyin), U2 /dusun
söz çıkarma (3 fixture), U3 HTTP == çevrimdışı B0 (71 gerçek + 325 çift metni), U4 gecikme (istemci tarafı, loopback),
U5 hedef çıkarımı doğruluğu (hareket/yaz etiketli gerçek + çift sözler).
"""
import json
import os
import subprocess
import sys
import time
import urllib.request

AYNI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AYNI)
for _akis in (sys.stdout, sys.stderr):
    try:
        _akis.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass
import numpy as np  # noqa: E402
import hizmet  # noqa: E402
import olc  # noqa: E402
import olc_cift  # noqa: E402

PORT = 4700
ADRES = "http://127.0.0.1:%d" % PORT
GUNLUK = os.path.join(olc.SONUC, "http-dusun-gunlugu.jsonl")


def post(yol, govde, zaman_asimi=10):
    r = urllib.request.Request(ADRES + yol, json.dumps(govde).encode("utf-8"), {"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(r, timeout=zaman_asimi))


def main():
    os.makedirs(olc.SONUC, exist_ok=True)
    if os.path.exists(GUNLUK):
        os.remove(GUNLUK)
    srv = subprocess.Popen([sys.executable, os.path.join(AYNI, "hizmet.py"), "--port", str(PORT), "--gunluk", GUNLUK],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                if json.load(urllib.request.urlopen(ADRES + "/saglik", timeout=1))["durum"] == "ok":
                    break
            except Exception:
                time.sleep(0.1)
        else:
            sys.exit("hizmet açılmadı")
        print("# Tur 4 (a) — HTTP sınırı (http_dene.py)")
        print("hizmet.py %s | http_dene.py %s | olc.py %s | etiketli %s | cift %s" % (
            olc.sha(os.path.join(AYNI, "hizmet.py")), olc.sha(os.path.abspath(__file__)), olc.sha(os.path.join(AYNI, "olc.py")),
            olc.sha(olc.ETIKET), olc.sha(olc_cift.CIFT)))

        # --- U3 + U4: tüm metinler
        ornekler = olc.yukle()
        gercek = [o for o in ornekler if o["kaynak"] == "gercek"]
        tutulan, _atilan, _ = olc_cift.yukle_cift()
        metinler = [(o["soz"], o["etiket"], o["hedef"]) for o in gercek]
        for c in tutulan:
            for k, m in olc_cift.kosul_metinleri(c).items():
                metinler.append((m, c["etiket"], c["hedef"] if k in ("tr", "en", "tr_ascii", "tr_yazim", "en_yazim") else None))
        post("/siniflandir", {"soz": "ısınma"})
        sure, uyumsuz = [], []
        sonuc = []
        for soz, et, hd in metinler:
            t0 = time.perf_counter()
            r = post("/siniflandir", {"soz": soz})
            sure.append((time.perf_counter() - t0) * 1000)
            sonuc.append(r)
            if r["sinif"] != olc.b0(soz)[0]:
                uyumsuz.append((soz, r["sinif"], olc.b0(soz)[0]))
        print("\nU3 uyum: %d/%d HTTP == çevrimdışı B0 (uyumsuz: %s)" % (len(metinler) - len(uyumsuz), len(metinler), uyumsuz[:5]))
        print("U4 gecikme (istemci, loopback, her istek yeni bağlantı): p50 %.2f ms · p95 %.2f ms · p99 %.2f ms · n=%d" % (
            np.percentile(sure, 50), np.percentile(sure, 95), np.percentile(sure, 99), len(sure)))
        print("   hizmet içi (ms) p50 %.3f · max %.3f" % (np.percentile([r["ms"] for r in sonuc], 50), max(r["ms"] for r in sonuc)))

        # --- U5: hedef çıkarımı (etiketi hareket/yaz olanlar; hedefsiz olanlar için None beklenir)
        hd_say = hd_dog = 0
        yanlis = []
        for (soz, et, hd), r in zip(metinler, sonuc):
            if et in ("hareket", "yaz"):
                hd_say += 1
                if r["hedef"] == hd:
                    hd_dog += 1
                else:
                    yanlis.append((soz, r["hedef"], hd))
        print("U5 hedef çıkarımı: %d/%d (%d%%) | yanlışlar: %s" % (hd_dog, hd_say, round(100 * hd_dog / hd_say), yanlis[:10]))

        # --- U2: /dusun söz çıkarma (gerçek kayıtlı girdiler)
        print("\nU2 /dusun (fixtures/beyin):")
        beklenen = {"001-komut": 0, "002-soyle": 1, "003-sessiz": None}
        for ad in beklenen:
            d = json.load(open(os.path.join(olc.KOK, "fixtures", "beyin", ad + ".json"), encoding="utf-8"))
            r = post("/dusun", d["girdi"])
            ok = isinstance(r.get("metin"), str) and isinstance(r.get("cagrilar"), list) and r["cagrilar"] == []
            ss = r["bilgi"]["siniflandirma"]
            print("  %s: biçim %s · çıkarılan söz %d · sınıf %s" % (ad, "geçerli" if ok else "BOZUK", len(ss), [(x["soz"][:40], x["sinif"], x["yol"]) for x in ss]))

        # --- U1: projenin kendi istemcisi (gerçek DisBeyin) — Electron'suz
        print("\nU1 beyin-tekrar.ts --beyin=dis:")
        p = subprocess.run(["node", "--experimental-strip-types", os.path.join(olc.KOK, "tools", "beyin-tekrar.ts"),
                            "--beyin=dis", "--adres=" + ADRES], cwd=olc.KOK, capture_output=True, text=True, encoding="utf-8", timeout=120)
        cikti = (p.stdout or "") + (p.stderr or "")
        print("  çıkış kodu %d" % p.returncode)
        for ln in cikti.strip().splitlines()[-14:]:
            if "ExperimentalWarning" not in ln:
                print("  " + ln[:200])
    finally:
        srv.terminate()
        try:
            srv.wait(timeout=5)
        except Exception:
            srv.kill()


if __name__ == "__main__":
    main()
