#!/usr/bin/env python3
"""hizmet.py — söz sınıflandırıcı (B0) HTTP hizmeti; dış beyin sözleşmesine (spec 04) uyar. GÖLGE: ÇAĞRI ÜRETMEZ.

NEDEN VAR: Tur 1-3'te sınıflandırıcıyı çevrimdışı ölçtük. Bu dosya aynı B0'ı Orion'un gerçek sınırına (HTTP) koyar,
böylece (a) sözleşme uyumu, (b) çevrimdışı ile HTTP sonucunun birebirliği, (c) gecikme, (d) canlı köprüden gelen
`duydum` biçimi ölçülür. ÜRETİM beyni DEĞİL: `/dusun` her zaman boş `cagrilar` döner (davranışı değiştirmez; yetki
Tur sonuçlarına göre ayrı karar). Yalnız stdlib + olc.py (B0 kalıp tablosu, tek kaynak).

    python tools/soz-siniflandirma/hizmet.py [--port 4700] [--gunluk yol.jsonl]
    python tools/soz-siniflandirma/hizmet.py kalibre

  GET  /saglik        -> 200 {"durum":"ok"}
  POST /siniflandir   {"soz": "..."}  -> {soz, sinif, guven, kaynak, yol, hedef, ms}
  POST /dusun         BeyinGirdisi    -> {metin:"", cagrilar:[], bilgi:{siniflandirma:[...]}}   (spec 04; gölge)

`yol`: "llmsiz" (sinif ∈ hareket/sorgu: LLM'e GİTMEDEN yönlenebilir) | "llm" (her şey; emin_degil dahil).
`kaynak`: "b0" (bir kurala eşleşti) | "yok" (hiçbir kurala eşleşmedi -> LLM'e düşer).
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

for _akis in (sys.stdout, sys.stderr):
    try:
        _akis.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

AYNI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AYNI)
import olc  # noqa: E402  (B0_DERLI ve tr_katla'nın TEK kaynağı)

# Sözün iki yazımı: köprünün güncel biçimi (`Ozyn dedi: "..."`, fixtures/beyin/002) ve eski günlükteki (`Ozyn said: "..."`).
SOZ_OZETI = re.compile(r'^Ozyn (?:dedi|said): "(.*)"$', re.S)

# Hedef (çapa) çıkarımı: katlanmış metinde ÖNEK/kök eşleşmesi (Türkçe ek: masaya, masanın, tahtaya...). Sıra önemli:
# açık çapa adı, oyuncuya gönderen kelimelerden önce gelir.
HEDEF_KURALLARI = [
    ("masa", r"\bmasa\w*|\btable\b"),
    ("tahta", r"\btahta\w*|\bboard\b|\bwhiteboard\b"),
    ("pencere", r"\bpencere\w*|\bwindow\b"),
    ("sandalye", r"\bsandalye\w*|\bkoltu\w*|\bchair\b|\bseat\b"),
    ("monitor", r"\bbilgisayar\w*|\bmonitor\w*|\bekran\w*|\bcomputer\b|\bscreen\b"),
    ("oyuncu", r"\bbana\b|\byanima\b|\bburaya\b|\bme\b|\bhere\b"),
]
HEDEF_DERLI = [(ad, re.compile(d)) for ad, d in HEDEF_KURALLARI]


def hedef_cikar(soz):
    t = olc.tr_katla(soz)
    for ad, d in HEDEF_DERLI:
        if d.search(t):
            return ad
    return None


def siniflandir(soz):
    t0 = time.perf_counter()
    t = olc.tr_katla(soz)
    sinif, kaynak = "emin_degil", "yok"
    for s, d in olc.B0_DERLI:
        if d.search(t):
            sinif, kaynak = s, "b0"
            break
    return {"soz": soz, "sinif": sinif, "guven": 1.0 if kaynak == "b0" else 0.0, "kaynak": kaynak,
            "yol": "llmsiz" if sinif in olc.YOL else "llm", "hedef": hedef_cikar(soz),
            "ms": round((time.perf_counter() - t0) * 1000, 3)}


def sozleri_cikar(ozetler):
    """BeyinGirdisi.ozetler içinden Ozyn'in sözleri (terminal/olay özetleri atlanır)."""
    cikti = []
    for o in ozetler or []:
        m = SOZ_OZETI.match(str(o).strip())
        if m:
            cikti.append(m.group(1))
    return cikti


class Isleyici(BaseHTTPRequestHandler):
    gunluk_yolu = None

    def _json(self, durum, govde):
        b = json.dumps(govde, ensure_ascii=False).encode("utf-8")
        self.send_response(durum)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _gunluk(self, satir):
        if Isleyici.gunluk_yolu:
            with open(Isleyici.gunluk_yolu, "a", encoding="utf-8") as f:
                f.write(json.dumps(satir, ensure_ascii=False) + "\n")

    def log_message(self, *a):  # konsolu sustur (her istek bir satır olmasın)
        pass

    def do_GET(self):
        if self.path == "/saglik":
            return self._json(200, {"durum": "ok", "hizmet": "soz-siniflandirma", "golge": True})
        self._json(404, {"hata": "yok"})

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length", "0"))
            g = json.loads(self.rfile.read(n).decode("utf-8")) if n else {}
        except (ValueError, UnicodeDecodeError):
            return self._json(400, {"hata": "geçersiz JSON"})
        if self.path == "/siniflandir":
            soz = g.get("soz")
            if not isinstance(soz, str):
                return self._json(400, {"hata": "soz (string) gerekli"})
            return self._json(200, siniflandir(soz))
        if self.path == "/dusun":
            alinma = time.time()
            sozler = sozleri_cikar(g.get("ozetler"))
            sonuc = [siniflandir(s) for s in sozler]
            self._gunluk({"t": int(alinma * 1000), "sozler": sozler, "siniflandirma": sonuc,
                          "ozet_sayisi": len(g.get("ozetler") or [])})
            return self._json(200, {"metin": "", "cagrilar": [], "bilgi": {"siniflandirma": sonuc, "golge": True}})
        self._json(404, {"hata": "yok"})


def kalibre():
    """Bilinen girdiler: söz çıkarma iki biçimde, terminal özeti söz sayılmaz; hedef çıkarımı; B0 ile birebirlik."""
    assert sozleri_cikar(['Ozyn dedi: "tahtaya git"']) == ["tahtaya git"]
    assert sozleri_cikar(['Ozyn said: "otur"']) == ["otur"]
    assert sozleri_cikar(["Ozyn'in terminalinde, komut HATA ile bitti (çıkış kodu 1)"]) == []
    assert sozleri_cikar(['Ozyn dedi: "iki\nsatır"']) == ["iki\nsatır"]
    assert sozleri_cikar(None) == []
    beklenen = {"masaya git": "masa", "tahtaya yaz": "tahta", "bana gel": "oyuncu", "come here": "oyuncu",
                "otur": None, "önündeki bilgisayarı aç": "monitor", "take a seat": "sandalye",
                "pencerenin yanına git": "pencere", "terminale dir yaz": None, "Masanın yanına git": "masa"}
    for s, h in beklenen.items():
        assert hedef_cikar(s) == h, (s, hedef_cikar(s))
    for s in ["otur", "oturabilir misin?", "ne görüyorsun", "blabla", "masaya git ve otur"]:
        assert siniflandir(s)["sinif"] == olc.b0(s)[0], s  # tek kaynak: HTTP hizmeti B0 ile birebir
    assert siniflandir("blabla")["kaynak"] == "yok" and siniflandir("otur")["yol"] == "llmsiz"
    assert siniflandir("oturabilir misin?")["yol"] == "llm"
    print("hizmet kalibre: TAMAM (söz çıkarma iki biçim, terminal özeti, hedef çıkarımı, B0 ile birebirlik)")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "kalibre":
        kalibre()
        sys.exit(0)
    port, gunluk = 4700, None
    a = sys.argv[1:]
    while a:
        k = a.pop(0)
        if k == "--port":
            port = int(a.pop(0))
        elif k == "--gunluk":
            gunluk = a.pop(0)
    Isleyici.gunluk_yolu = gunluk
    srv = ThreadingHTTPServer(("127.0.0.1", port), Isleyici)
    print("söz sınıflandırma hizmeti (GÖLGE) http://127.0.0.1:%d" % port, flush=True)
    srv.serve_forever()
