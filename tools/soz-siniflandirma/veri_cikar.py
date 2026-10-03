# veri_cikar.py — karar kaydındaki GERÇEK sözleri (duydum algıları) ve zayıf etiketlerini çıkarır.
#
# Neden: söz→kategori etiketi hiçbir yerde yok (docs/olcum-soz-siniflandirma.md). Elimizdeki
# tek gerçek tohum karar kaydı: her `duydum` algısının metni + onu işleyen `uyanis` satırının
# `niyetler[].tur` / `cagrilar` alanı. Bu ZAYIF etiket: LLM'in o söze verdiği cevap, Ozyn'un
# onayı değil. Çıktı bir İNCELEME tablosu — fixtures/soz/etiketli.json'a ancak Ozyn onayından
# sonra girer; zayıf etiket doğrudan test etiketi olamaz.
#
# Kullanım: python tools/soz-siniflandirma/veri_cikar.py [kayit_klasoru] > tablo.tsv
import glob
import json
import os
import re
import sys
from collections import defaultdict

KAYIT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ["APPDATA"], "3dorion", "karar-kaydi")

# Eski satırlar sözü `ozet` içinde taşır ('Ozyn said: "merhaba"'), spec 10 sonrakiler `soz.metin`'de.
OZET_SOZ = re.compile(r'^Ozyn said: "(.*)"$', re.S)

# Niyet türü -> yol (protocol/niyet.ts; kategori tanımı plan dosyasında). Burada yalnız ÖNERİ.
YOL = {
    "git": "hareket", "otur": "hareket", "kalk": "hareket", "dur": "hareket",
    "yaz": "yaz", "komut": "yaz",
    "sor": "sorgu",
    "soyle": "sohbet",
}


def soz_metni(a):
    soz = a.get("soz")
    if isinstance(soz, dict) and soz.get("metin"):
        return soz["metin"]
    m = OZET_SOZ.match(a.get("ozet", ""))
    return m.group(1) if m else None


def oku():
    algilar = {}  # (oturum, id) -> (metin, gün)
    uyanislar = defaultdict(list)  # (oturum, algı id) -> [uyanis]
    for f in sorted(glob.glob(os.path.join(KAYIT, "*.jsonl"))):
        gun = os.path.basename(f)[:10]
        with open(f, encoding="utf-8", errors="replace") as fh:
            for ln in fh:
                ln = ln.strip()
                if not ln:
                    continue
                try:
                    d = json.loads(ln)
                except ValueError:
                    continue
                if d.get("tur") == "algi" and d.get("algi") == "duydum":
                    m = soz_metni(d)
                    if m:
                        algilar[(d["o"], d["id"])] = (m, gun)
                elif d.get("tur") == "uyanis":
                    for aid in d.get("algilar", []):
                        uyanislar[(d["o"], aid)].append(d)
    return algilar, uyanislar


def zayif_yol(uyanis_listesi):
    """Sözü işleyen uyanışlardaki niyet türlerinden önerilen yol. Hata veya niyetsiz -> None."""
    turler = []
    for u in uyanis_listesi:
        if u.get("hata"):
            continue
        turler += [n.get("tur") for n in u.get("niyetler", [])]
    yollar = {YOL[t] for t in turler if t in YOL}
    return turler, yollar


def main():
    algilar, uyanislar = oku()
    toplam = defaultdict(lambda: {"sayi": 0, "gunler": set(), "turler": set(), "yollar": set()})
    for (o, aid), (metin, gun) in algilar.items():
        k = metin.strip()
        turler, yollar = zayif_yol(uyanislar.get((o, aid), []))
        t = toplam[k]
        t["sayi"] += 1
        t["gunler"].add(gun)
        t["turler"].update(x for x in turler if x)
        t["yollar"].update(yollar)
    print("soz\tsayi\tgunler\tniyet_turleri\toneri_yol")
    for k in sorted(toplam, key=lambda s: (-toplam[s]["sayi"], s)):
        t = toplam[k]
        print("%s\t%d\t%s\t%s\t%s" % (
            k.replace("\t", " ").replace("\n", " "), t["sayi"], ",".join(sorted(t["gunler"])),
            ",".join(sorted(t["turler"])) or "-", ",".join(sorted(t["yollar"])) or "-"))
    print("# tekil söz: %d, toplam duydum: %d" % (len(toplam), sum(t["sayi"] for t in toplam.values())), file=sys.stderr)


if __name__ == "__main__":
    main()
