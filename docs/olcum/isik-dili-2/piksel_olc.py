# docs/olcum/isik-dili-2/piksel_olc.py — Işık dili adım 2 (ön kayıt: docs/olcum/on-kayit-isik-dili-2.md) piksel ölçüsü.
#
# Bölgeler (0–255; ilk 70 satır HUD yazısı + sağ üst rozet: ölçüye girmez):
#   S (sıcak bölge)   = ΔR > 25 VE Δ(R−B) > 20   (Δ = sonra − önce)
#   G (soğuk gölge)   = önce luma alt %40 VE S dışı
#   W (şehir ışığı)   = karenin üst %65'inde sonra R ≥ 140, R−B ≥ 50, önce R−B < 20
#   alt35             = karenin alt %35'i, ortalama |Δ| (T4: ofis içi)
# Gürültü = aynı kod, aynı ortam iki önce koşusu (A → B).
# Kullanım: python piksel_olc.py   (bu klasörde koşar; önce-*/sonra-* png'leri)
import os
import sys
import numpy as np
from PIL import Image

KLASOR = os.path.dirname(os.path.abspath(__file__))
HUD = 70


def oku(ad):
    return np.asarray(Image.open(os.path.join(KLASOR, ad + ".png")).convert("RGB"), dtype=np.float64)


def olc(ad_once, ad_sonra):
    a, b = oku(ad_once), oku(ad_sonra)
    h = a.shape[0]
    gecerli = np.zeros(a.shape[:2], bool)
    gecerli[HUD:] = True
    d = b - a
    S = gecerli & (d[..., 0] > 25) & ((d[..., 0] - d[..., 2]) > 20)
    l = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    G = gecerli & (l <= np.percentile(l[gecerli], 40)) & ~S
    ust = np.zeros_like(gecerli)
    ust[HUD:int(h * 0.65)] = True
    W = ust & (b[..., 0] >= 140) & ((b[..., 0] - b[..., 2]) >= 50) & ((a[..., 0] - a[..., 2]) < 20)
    alt = np.zeros_like(gecerli)
    alt[int(h * 0.65):] = True
    rb = lambda x, m: float((x[..., 0] - x[..., 2])[m].mean()) if m.any() else float("nan")
    br = lambda x, m: float((x[..., 2] - x[..., 0])[m].mean()) if m.any() else float("nan")
    return {
        "S%": 100.0 * S.sum() / gecerli.sum(),
        "S_RB_once": rb(a, S), "S_RB_sonra": rb(b, S),
        "G_BR_once": br(a, G), "G_BR_sonra": br(b, G),
        "W": int(W.sum()),
        "alt35": float(np.abs(d[alt]).mean()),
    }


GURULTU = {"P1s": ("once-P1s-A", "once-P1s-B"), "P3s": ("once-P3s-A", "once-P3s-B"), "P2t": ("once-P2t-A", "once-P2t-B")}
CIFTLER = {
    "P1s": ("once-P1s-A", "sonra-P1s"), "P2s": ("once-P2s", "sonra-P2s"), "P3s": ("once-P3s-A", "sonra-P3s"),
    "P1t": ("once-P1t", "sonra-P1t"), "P2t": ("once-P2t-A", "sonra-P2t"), "P3t": ("once-P3t", "sonra-P3t"),
    "P2t-ufuk0": ("once-P2t-A", "sonra-P2t-ufuk0"), "duz (ek, tahminsiz)": ("once-duz", "sonra-duz"),
}


def yaz(ad, v):
    print(f"  {ad:22s} S={v['S%']:6.2f}%  S(R-B) önce={v['S_RB_once']:7.1f} sonra={v['S_RB_sonra']:7.1f}  "
          f"G(B-R) önce={v['G_BR_once']:6.1f} sonra={v['G_BR_sonra']:6.1f}  W={v['W']:6d}  alt35|Δ|={v['alt35']:5.2f}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")   # Windows konsolu cp1254
    g = {}
    print("gürültü (önce-A → önce-B):")
    for ad, (x, y) in GURULTU.items():
        g[ad] = olc(x, y)
        yaz(ad, g[ad])
    gS = max(v["S%"] for v in g.values())
    gW = max(v["W"] for v in g.values())
    print(f"  en büyük gürültü: S={gS:.3f}%  W={gW}")
    print("çiftler (önce → sonra):")
    s = {}
    for ad, (x, y) in CIFTLER.items():
        if not os.path.exists(os.path.join(KLASOR, y + ".png")):
            print(f"  {ad}: {y}.png yok")
            continue
        s[ad] = olc(x, y)
        yaz(ad, s[ad])
    print("tahminler:")
    for ad in ("P1s", "P2s", "P1t", "P2t"):
        if ad not in s: continue
        v = s[ad]
        ok = v["S%"] >= 1.0 and v["S%"] >= 10 * gS and v["S_RB_sonra"] >= 20 and v["S_RB_once"] <= 0
        print(f"  T1 {ad}: {'GEÇTİ' if ok else 'KALDI'}  (S {v['S%']:.2f}% ≥ 1 ve ≥ {10 * gS:.2f}; R−B sonra {v['S_RB_sonra']:.1f} ≥ 20; önce {v['S_RB_once']:.1f} ≤ 0)")
    for ad in ("P1s", "P2s", "P3s", "P1t", "P2t", "P3t"):
        if ad not in s: continue
        v = s[ad]
        ok = v["G_BR_sonra"] > 0 and v["G_BR_sonra"] >= v["G_BR_once"] - 5
        print(f"  T2 {ad}: {'GEÇTİ' if ok else 'KALDI'}  (G B−R sonra {v['G_BR_sonra']:.1f} > 0 ve ≥ önce {v['G_BR_once']:.1f} − 5)")
    for ad in ("P2s", "P3s", "P2t", "P3t", "P1s", "P1t"):
        if ad not in s: continue
        esik = 30 if ad.startswith("P1") else max(150, 5 * gW)
        ok = s[ad]["W"] >= esik and (ad.startswith("P1") or s[ad]["W"] >= 5 * gW)
        print(f"  T3 {ad}: {'GEÇTİ' if ok else 'KALDI'}  (W {s[ad]['W']} ≥ {esik})")
    for ad in ("P3s", "P3t"):
        if ad not in s: continue
        esik = g["P3s"]["alt35"] + 1.5
        print(f"  T4 {ad}: {'GEÇTİ' if s[ad]['alt35'] <= esik else 'KALDI'}  (alt35 |Δ| {s[ad]['alt35']:.2f} ≤ {esik:.2f})")
    if "P2t-ufuk0" in s:
        v = s["P2t-ufuk0"]
        ok = v["S%"] <= 3 * gS + 0.05 and v["W"] <= 3 * gW + 20
        print(f"  T5 P2t-ufuk0: {'GEÇTİ' if ok else 'KALDI'}  (S {v['S%']:.3f}% ≤ {3 * gS + 0.05:.3f}; W {v['W']} ≤ {3 * gW + 20})")
