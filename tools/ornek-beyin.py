#!/usr/bin/env python3
"""ornek-beyin.py — Orion'un beyni, Python'da. Bağımlılıksız (yalnızca stdlib).

NEDEN VAR: "beyni ayrı bir süreçte, başka bir dilde yazalım" fikrinin ÇALIŞAN
kanıtı. Bu dosya `bridge/disBeyin.ts` ile konuşur ve mevcut hiçbir şeyi
değiştirmeden Orion'un beyni olur.

    python tools/ornek-beyin.py
    3dorion.bat                      (ORION_BEYIN=dis ile)

Buradan sonrası SENİN alanın: PyTorch, NumPy, transformers, ne istersen.
Sözleşme değişmez, yalnızca `dusun()` içi değişir.

── SÖZLEŞME ──────────────────────────────────────────────────────────────────
GET  /saglik  → 200
POST /dusun   → gövde: BeyinGirdisi   yanıt: BeyinCikti

BeyinGirdisi (gelen):
    talimat  str   bu tur için kurulmuş sistem talimatı
    dunya    str   dünyanın sıkıştırılmış anlık durumu
    ozetler  [str] bu turda süzgeçten geçen algılar
    anilar   [str] uzun vadeli hafızadan getirilenler
    gecmis   [{rol, metin}]  son konuşma turları
    araclar  [{ad, aciklama, sema}]  çağrılabilecek dünya araçları

BeyinCikti (dönen):
    metin    str   günlüğe/panele yazılacak düz metin (SESLENDİRİLMEZ)
    cagrilar [{ad, girdi}]  dünyada yapılacak eylemler
    bilgi    {}    tanı bilgisi (isteğe bağlı)

ÖNEMLİ: konuşmak bir EYLEMDİR. `metin` alanı duyulmaz; sesin çıkması için
`{"ad": "dunya_soyle", "girdi": {"metin": "..."}}` çağrısı göndermelisin.

── LLM'DEN FARKI ─────────────────────────────────────────────────────────────
Burada satır sözleşmesi (`KOMUT:` / `TAHTA:` / `BAK:`) YOK. O sözleşme, bir
LLM'e metin yazdırıp geri ayrıştırmak zorunda olduğumuz için var. Yerel bir
süreç çağrıları doğrudan yapısal olarak döner — soyutlamanın kazancı bu.
"""
from __future__ import annotations

import json
import re
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

# Windows konsolu varsayılan olarak cp1252: Türkçe karakter ve okları
# yazdırmaya çalışınca UnicodeEncodeError atıyor ve bu, yanıtı 500'e
# çeviriyordu (ölçüldü: "'charmap' codec can't encode '→'").
# Günlük satırı yüzünden beynin cevabını kaybetmek kabul edilemez.
for _akis in (sys.stdout, sys.stderr):
    try:
        _akis.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass                                   # eski Python / yönlendirilmiş akış

PORT = 4700

# Sık kullanılan komutlar — yazım hatası düzeltmesi bunlara göre yapılır.
# (TypeScript tarafındaki `mind/yerelTepki.ts` ile aynı fikir; burada Python'da
#  nasıl yapıldığını göstermek için tekrarlanıyor.)
BILINEN = ["git", "npm", "node", "npx", "python", "pip", "cargo", "go",
           "ls", "dir", "cd", "cat", "echo", "curl", "tsc", "docker"]

TANINMAYAN = [
    re.compile(r"The term ['\"`]([^'\"`]+)['\"`] is not recognized", re.I),
    re.compile(r"['\"`]?([\w.-]+)['\"`]?\s*:\s*command not found", re.I),
]


def mesafe(a: str, b: str) -> int:
    """Damerau-Levenshtein: yer değiştirme TEK işlem sayılır.

    Düz Levenshtein'da `gti` → `git` mesafe 2 çıkar ve eşiğin dışında kalır —
    oysa klavyede en sık yapılan hata tam olarak iki harfin yer değiştirmesi.
    """
    if a == b:
        return 0
    onceki = list(range(len(b) + 1))
    iki_once: list[int] = []
    for i in range(1, len(a) + 1):
        simdiki = [i] + [0] * len(b)
        for j in range(1, len(b) + 1):
            bedel = 0 if a[i - 1] == b[j - 1] else 1
            simdiki[j] = min(simdiki[j - 1] + 1, onceki[j] + 1, onceki[j - 1] + bedel)
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                simdiki[j] = min(simdiki[j], iki_once[j - 2] + 1)
        iki_once, onceki = onceki, simdiki
    return onceki[len(b)]


def duzeltme_oner(yanlis: str) -> str | None:
    """Yalnızca ÇOK EMİNSEK öner: tek işlemlik fark ve tek aday."""
    k = yanlis.lower()
    if len(k) < 2 or k in BILINEN:
        return None
    adaylar = sorted(((mesafe(k, b), b) for b in BILINEN))
    if not adaylar or adaylar[0][0] != 1:
        return None
    if len(adaylar) > 1 and adaylar[1][0] == 1:
        return None                       # berabere → sus
    return adaylar[0][1]


def dusun(girdi: dict) -> dict:
    """ASIL İŞ BURADA. Şu an kuralcı; yerine ne koyarsan koy.

    Sen buraya PyTorch modeli, connectome simülasyonu ya da başka ne istersen
    koyabilirsin — dışarıdaki sözleşme aynı kalır.
    """
    ozetler: list[str] = girdi.get("ozetler") or []
    gecmis: list[dict] = girdi.get("gecmis") or []
    cagrilar: list[dict] = []
    notlar: list[str] = []

    # 1) Terminalde tanınmayan komut → düzeltme ÖNER (çalıştırma değil!).
    #    Öneri onay kapısına düşer; Ozyn onaylamadan hiçbir komut çalışmaz.
    for o in ozetler:
        for kalip in TANINMAYAN:
            m = kalip.search(o)
            if not m:
                continue
            yanlis = m.group(1)
            dogru = duzeltme_oner(yanlis)
            if dogru:
                cagrilar.append({"ad": "dunya_komut", "girdi": {
                    "metin": dogru,
                    "gerekce": f"'{yanlis}' tanınmadı; '{dogru}' yazım hatası düzeltmesi",
                }})
                notlar.append(f"{yanlis}→{dogru}")
            else:
                cagrilar.append({"ad": "dunya_bak",
                                 "girdi": {"hedef": {"tip": "capa", "ad": "monitor"}}})
                notlar.append(f"{yanlis}: düzeltme bilinmiyor")
            break

    # 2) Ozyn konuştuysa CEVAP VER — susmak kabul değil.
    son = gecmis[-1] if gecmis else None
    if son and son.get("rol") == "kullanici":
        soz = (son.get("metin") or "").lower()
        if "ne görüyorsun" in soz or "önünde ne" in soz or "odada ne" in soz:
            # Algı hizmetine sor: cevabı bir sonraki turda `ozetler`de gelir.
            cagrilar.append({"ad": "dunya_sor", "girdi": {"ne": "onumde"}})
            cagrilar.append({"ad": "dunya_soyle", "girdi": {"metin": "Bakıyorum."}})
        else:
            cagrilar.append({"ad": "dunya_soyle",
                             "girdi": {"metin": "Buradayım — şu an Python beyniyle çalışıyorum."}})

    return {
        "metin": " | ".join(notlar),
        "cagrilar": cagrilar,
        "bilgi": {"kaynak": "ornek-beyin.py", "ozet_sayisi": len(ozetler)},
    }


class Sunucu(BaseHTTPRequestHandler):
    def _yanit(self, kod: int, govde: dict | None = None) -> None:
        ham = json.dumps(govde or {}, ensure_ascii=False).encode("utf-8")
        self.send_response(kod)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(ham)))
        self.end_headers()
        self.wfile.write(ham)

    def do_GET(self) -> None:                       # noqa: N802 (http.server API)
        if self.path == "/saglik":
            self._yanit(200, {"durum": "hazir"})
        else:
            self._yanit(404, {"hata": "bilinmeyen yol"})

    def do_POST(self) -> None:                      # noqa: N802
        if self.path != "/dusun":
            self._yanit(404, {"hata": "bilinmeyen yol"})
            return
        try:
            n = int(self.headers.get("Content-Length") or 0)
            girdi = json.loads(self.rfile.read(n) or b"{}")
            cikti = dusun(girdi)
            ozet = ", ".join(c["ad"] for c in cikti["cagrilar"]) or "(eylem yok)"
            print(f"[beyin] ozet={len(girdi.get('ozetler') or [])} → {ozet}", flush=True)
            self._yanit(200, cikti)
        except Exception as e:                      # dünya donmasın: hata da yanıttır
            print(f"[beyin] HATA: {e}", file=sys.stderr, flush=True)
            self._yanit(500, {"hata": str(e)})

    def log_message(self, *_a) -> None:             # varsayılan erişim günlüğü gürültü
        pass


if __name__ == "__main__":
    print(f"[beyin] http://127.0.0.1:{PORT} dinleniyor (Ctrl+C ile çık)", flush=True)
    HTTPServer(("127.0.0.1", PORT), Sunucu).serve_forever()
