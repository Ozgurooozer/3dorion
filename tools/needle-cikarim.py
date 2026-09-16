# tools/needle-cikarim.py — Needle 2'nin ASIL yeri burasi mi?
#
# Refleks sinavinda 4/6 aldi ama refleks girdisini ZATEN BIZ URETIYORUZ:
# tamamen sayilabilir bir kume, orada kurallar 0 ms'de kazaniyor.
#
# Kurallarin YAPAMADIGI iki is var:
#   1. extract() — dagınık terminal blogundan YAPISAL bilgi cikarmak
#   2. embed()   — hafiza ilgisi icin gomme (Jaccard esanlamliyi kaciriyor)
#
# Bu sonda ikisini de olcer. Deger buradaysa Needle "refleks beyni" degil
# "cikarim ve gomme organi" olarak yerini alir.
#
# Kullanim: .venv-needle/Scripts/python.exe tools/needle-cikarim.py

import time

from needle import Needle, Field, extract
from typing import Optional

try:
    from pydantic import BaseModel
except ImportError:  # pydantic yoksa dict semasi kullanilir
    BaseModel = None


# ── 1) YAPISAL CIKARIM ────────────────────────────────────────────────────
# Gercek PowerShell hata bloklari (bu makineden yakalandi).

BLOKLAR = [
    (
        "PS C:\\Users\\ozigo> gti status\n"
        "gti : The term 'gti' is not recognized as the name of a cmdlet, function, script file,\n"
        "or operable program. Check the spelling of the name, or if a path was included, verify\n"
        "that the path is correct and try again.\n"
        "At line:1 char:1\n+ gti status\n+ ~~~\n"
        "    + CategoryInfo          : ObjectNotFound: (gti:String) [], CommandNotFoundException\n"
        "    + FullyQualifiedErrorId : CommandNotFoundException",
        "gti",
    ),
    (
        "PS C:\\Users\\ozigo> npm tset\n"
        "npm error code EUNKNOWNCOMMAND\n"
        "npm error Unknown command: \"tset\"\n"
        "npm error Did you mean this?\n"
        "npm error   npm test",
        "npm tset",
    ),
    (
        "PS C:\\Users\\ozigo\\proje> python bild.py\n"
        "python: can't open file 'C:\\\\Users\\\\ozigo\\\\proje\\\\bild.py': "
        "[Errno 2] No such file or directory",
        "python bild.py",
    ),
]

SEMA = {
    "type": "object",
    "properties": {
        "failed_command": {"type": "string", "description": "The command that failed"},
        "error_kind": {"type": "string", "description": "Short error category, e.g. command-not-found, file-not-found"},
        "suggested_fix": {"type": "string", "description": "A corrected single-line command, if obvious"},
    },
    "required": ["failed_command", "error_kind"],
}

SISTEM_CIKARIM = (
    "Extract structured information from a terminal error block. "
    "Return only what is present in the text."
)


def cikarim_sinavi() -> None:
    print("=" * 62)
    print("1) YAPISAL CIKARIM — dagınık terminal blogundan")
    sureler = []
    dogru = 0
    for blok, beklenen_komut in BLOKLAR:
        t = time.time()
        try:
            sonuc = extract(blok, SEMA, system=SISTEM_CIKARIM, strict=False)
        except Exception as e:  # noqa: BLE001 - sonda
            print(f"   HATA: {type(e).__name__}: {str(e)[:90]}")
            continue
        ms = int((time.time() - t) * 1000)
        sureler.append(ms)
        d = sonuc if isinstance(sonuc, dict) else getattr(sonuc, "__dict__", {})
        komut = str(d.get("failed_command", ""))
        tur = str(d.get("error_kind", ""))
        duzeltme = str(d.get("suggested_fix", ""))
        isabet = beklenen_komut.split()[0] in komut
        if isabet:
            dogru += 1
        print(f"   [{'GECTI' if isabet else 'KALDI'}] {ms:5d} ms  komut='{komut[:32]}' tur='{tur[:26]}'")
        if duzeltme:
            print(f"        onerilen duzeltme: '{duzeltme[:56]}'")
    ort = int(sum(sureler) / len(sureler)) if sureler else 0
    print(f"   --> {dogru}/{len(BLOKLAR)} dogru, ortalama {ort} ms")


# ── 2) GOMME: hafiza ilgisi ───────────────────────────────────────────────
# Jaccard'in kacirdigi esanlamli/ilgili ciftleri yakalayabiliyor mu?

CIFTLER = [
    ("terminal suzgeci uzerinde calisiyorum", "suzgec nasil gidiyor", True),
    ("terminal suzgeci uzerinde calisiyorum", "kahve ictim", False),
    ("beyaz tahtaya not yazdim", "tahtada ne yaziyor", True),
    ("beyaz tahtaya not yazdim", "hava bugun guzel", False),
    # Jaccard'in KESIN kacirdigi cift: ortak kelime YOK ama konu ayni.
    ("komut bulunamadi hatasi aldim", "terminalde bir sorun var mi", True),
]


def kosinus(a, b) -> float:
    nokta = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    return nokta / (na * nb) if na and nb else 0.0


def gomme_sinavi() -> None:
    print("=" * 62)
    print("2) GOMME — hafiza ilgisi (Jaccard'in kacirdigini yakaliyor mu?)")
    ajan = Needle()
    t0 = time.time()
    sonuclar = []
    for a, b, ilgili in CIFTLER:
        va = ajan.embed(a)
        vb = ajan.embed(b)
        s = kosinus(va, vb)
        sonuclar.append((s, ilgili, a, b))
    ms = int((time.time() - t0) * 1000)

    ilgililer = [s for s, i, *_ in sonuclar if i]
    ilgisizler = [s for s, i, *_ in sonuclar if not i]
    for s, i, a, b in sonuclar:
        print(f"   {s:.3f}  {'ILGILI ' if i else 'ilgisiz'}  '{a[:30]}' <-> '{b[:30]}'")
    if ilgililer and ilgisizler:
        ayrim = min(ilgililer) - max(ilgisizler)
        print(f"   --> ayrim payi: {ayrim:+.3f}  (pozitif = gomme ilgiyi AYIRT EDIYOR)")
    print(f"   --> {len(CIFTLER) * 2} gomme, toplam {ms} ms")
    ajan.close()


if __name__ == "__main__":
    cikarim_sinavi()
    print()
    gomme_sinavi()
