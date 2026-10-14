# docs/olcum/isik-dili-1/piksel_olc.py — Işık dili adım 1 (ön kayıt: docs/olcum/on-kayit-isik-dili-1.md) piksel ölçüsü.
#
# Bölgeler ÖNCE görüntüsünün luma'sından: koyu = alt %40, parlak = üst %20. Bölge başına ortalama Δ = sonra − önce
# (R, G, B; 0–255) ve ortalama |Δ|. Gürültü tabanı = ova önce-A ile önce-B (aynı kod, aynı ortam; çim rüzgârı vb.).
# Ayrıca her görüntüde koyu bölgenin mutlak ortalama rengi (B > R mi: soğuk gölge).
# Kullanım: python piksel_olc.py   (bu klasörde koşar)
import os
import sys
import numpy as np
from PIL import Image

KLASOR = os.path.dirname(os.path.abspath(__file__))


def oku(ad):
    return np.asarray(Image.open(os.path.join(KLASOR, ad + ".png")).convert("RGB"), dtype=np.float64)


def bolgeler(once):
    l = 0.2126 * once[..., 0] + 0.7152 * once[..., 1] + 0.0722 * once[..., 2]
    return l <= np.percentile(l, 40), l >= np.percentile(l, 80)


def kiyas(ad_once, ad_sonra):
    a, b = oku(ad_once), oku(ad_sonra)
    koyu, parlak = bolgeler(a)
    d = b - a
    sonuc = {}
    for ad, m in (("koyu", koyu), ("parlak", parlak)):
        sonuc[ad] = {
            "ortΔ": d[m].mean(axis=0).round(2).tolist(),
            "ort|Δ|": np.abs(d[m]).mean(axis=0).round(2).tolist(),
            "once_ort": a[m].mean(axis=0).round(1).tolist(),
            "sonra_ort": b[m].mean(axis=0).round(1).tolist(),
        }
    return sonuc


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")   # Windows konsolu cp1254: "→" ve "Δ" yazılamıyordu
    for ad, (x, y) in {
        "gurultu (ova once-A → once-B)": ("ova22-once-A", "ova22-once-B"),
        "ova@22 (once-A → sonra)": ("ova22-once-A", "ova22-sonra"),
        "siberpunk@22 (once → sonra)": ("siber22-once", "siber22-sonra"),
    }.items():
        print(ad)
        for bolge, v in kiyas(x, y).items():
            print(f"  {bolge:6s} ortΔ(RGB)={v['ortΔ']}  ort|Δ|={v['ort|Δ|']}  once={v['once_ort']}  sonra={v['sonra_ort']}")
