# olc_hibrit.py — Tur 2: B0 (kalıp) önce, C3 (multilingual-e5 kNN) yalnız B0'ın EŞLEŞMEDİĞİ yerde.
# Ön kayıt: docs/olcum-soz-siniflandirma.md "Tur 2". olc.py (donmuş, özet 1e5c51482c41f2ea) DEĞİŞTİRİLMEDİ;
# metrikler, kNN ve B0 kalıpları ondan içe aktarılır, ölçü aynı kalır.
#
#   python tools/soz-siniflandirma/olc_hibrit.py
#
# Hibrit H1 (donmuş tanım):
#   1. B0 bir KURALA eşleşirse sınıfı B0 verir (güven 1.0). Bu, sohbet/emin_degil bekçi kurallarını da kapsar:
#      bekçi eşleşmesi LLM'e düşmenin KESİN nedenidir, C3 onu ezemez.
#   2. B0 hiçbir kurala eşleşmezse C3 kNN'nin (sınıf, güven) çıktısı kullanılır.
#   3. LLM'siz yol: tahmin ∈ {hareket, sorgu} ve güven ≥ τ. τ, kalibrasyon kümesinde TÜM boru hattının (B0+C3)
#      kesinliği ≥ %98 olan en küçük eşik (olc.tau_sec); bulunamazsa 1.01 -> yalnız B0 yola gider.
import os
import sys

import numpy as np

AYNI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AYNI)
import olc  # noqa: E402


def b0_ayrintili(soz):
    t = olc.tr_katla(soz)
    for sinif, desen in olc.B0_DERLI:
        if desen.search(t):
            return sinif, True
    return "emin_degil", False


def hibrit(ornekler, E, idx):
    knn = olc.knn_logo(E, ornekler, idx)
    cikti, kaynak = {}, {}
    for i in idx:
        o = ornekler[i]
        sinif, eslesti = b0_ayrintili(o["soz"])
        if eslesti:
            cikti[o["id"]], kaynak[o["id"]] = (sinif, 1.0), "b0"
        else:
            cikti[o["id"]], kaynak[o["id"]] = tuple(knn[o["id"]]), "knn"
    return cikti, kaynak


def main():
    ornekler = olc.yukle()
    E = np.load(os.path.join(olc.SONUC, "c3.npy"))
    gercek = [i for i, o in enumerate(ornekler) if o["kaynak"] == "gercek"]
    tohum = olc.tohum_gruplari(ornekler)
    kal = [i for i, o in enumerate(ornekler) if o["grup"] in tohum]
    gercek_soz_grup = {o["grup"]: o["soz"] for o in ornekler if o["kaynak"] == "gercek"}
    turev = [i for i, o in enumerate(ornekler) if olc.turev_tipi(o, gercek_soz_grup)]
    tum = sorted(set(gercek) | set(kal) | set(turev))
    dogru = [o["etiket"] for o in ornekler]
    tartisma = {i for i in gercek if "TARTIŞMALI" in ornekler[i]["not"]}

    h, kaynak = hibrit(ornekler, E, tum)
    b = {ornekler[i]["id"]: olc.b0(ornekler[i]["soz"]) for i in tum}
    P = lambda s, ids: [tuple(s[ornekler[i]["id"]]) for i in ids]
    D = lambda ids: [dogru[i] for i in ids]

    tau = olc.tau_sec(P(h, kal), D(kal))
    esik = tau if tau is not None else 1.01
    print("# Tur 2 karnesi (olc_hibrit.py)")
    print("olc.py %s | olc_hibrit.py %s | etiketli %s | τ_H1 = %s" % (
        olc.sha(os.path.join(AYNI, "olc.py")), olc.sha(os.path.abspath(__file__)), olc.sha(olc.ETIKET), tau))

    # KONTROL (ölçü doğrulaması): τ > 1 iken H1'in yola gidenleri B0'ınkiyle BİREBİR aynı olmalı.
    k_h = olc.yol_olcusu(P(h, gercek), D(gercek), 1.01)
    k_b = olc.yol_olcusu(P(b, gercek), D(gercek), 0.5)
    assert (k_h["gidenler"], k_h["dogru"]) == (k_b["gidenler"], k_b["dogru"]), ("KONTROL TUTMADI", k_h, k_b)
    print("kontrol: τ=1.01'de H1 ≡ B0 (yola giden %d, doğru %d) TAMAM" % (k_h["gidenler"], k_h["dogru"]))

    def satir(ad, s, esk, ids):
        m = olc.yol_olcusu(P(s, ids), D(ids), esk)
        return m, "| %s | %d | %d | %d | %s | %s |" % (
            ad, m["gidenler"], m["dogru"], len(m["yanlis"]),
            "-" if m["precision"] is None else "%d%%" % round(100 * m["precision"]),
            "-" if m["coverage"] is None else "%d%%" % round(100 * m["coverage"]))

    print("\n## Gerçek sözler (kapsama paydası: etiketi hareket/sorgu olan %d söz)" % k_b["yol_sozu_sayisi"])
    print("| sistem | yola giden | doğru | yanlış | kesinlik | kapsama |\n|---|---|---|---|---|---|")
    mb, l1 = satir("B0", b, 0.5, gercek)
    mh, l2 = satir("H1", h, esik, gercek)
    print(l1), print(l2)
    ids_t = [i for i in gercek if i not in tartisma]
    print(satir("B0 (tartışmasız)", b, 0.5, ids_t)[1]), print(satir("H1 (tartışmasız)", h, esik, ids_t)[1])
    print("H1'in B0'a EKLEDİĞİ doğru yol: %d | eklediği yanlış yol: %d" % (mh["dogru"] - mb["dogru"], len(mh["yanlis"]) - len(mb["yanlis"])))
    print("H1 yanlış yola giden:", [(ornekler[gercek[j]]["soz"], P(h, gercek)[j][0], ornekler[gercek[j]]["etiket"]) for j in mh["yanlis"]])
    ek = [ornekler[i]["soz"] for i in gercek if ornekler[i]["etiket"] in olc.YOL
          and P(h, [i])[0][0] == ornekler[i]["etiket"] and P(h, [i])[0][1] >= esik and P(b, [i])[0][0] != ornekler[i]["etiket"]]
    print("H1'in kurtardığı (B0 kaçırdı) gerçek sözler:", ek)
    kac = [ornekler[i]["soz"] for i in gercek if ornekler[i]["etiket"] in olc.YOL
           and not (P(h, [i])[0][0] == ornekler[i]["etiket"] and P(h, [i])[0][1] >= esik)]
    print("H1'in hâlâ kaçırdığı gerçek sözler:", kac)

    print("\n## Türevler: etiketi hareket/sorgu olan türevlerin DOĞRU yola gitme oranı ve yanlış yola gidenler")
    print("| tür | sistem | yola giden | doğru | yanlış | doğru yol oranı |\n|---|---|---|---|---|---|")
    for tip in ("ascii", "yazim"):
        ids = [i for i in turev if olc.turev_tipi(ornekler[i], gercek_soz_grup) == tip]
        for ad, s, esk in (("B0", b, 0.5), ("H1", h, esik)):
            m = olc.yol_olcusu(P(s, ids), D(ids), esk)
            print("| %s | %s | %d | %d | %d | %s |" % (tip, ad, m["gidenler"], m["dogru"], len(m["yanlis"]),
                                                       "-" if m["coverage"] is None else "%d%%" % round(100 * m["coverage"])))
    kn = sum(1 for i in gercek if kaynak[ornekler[i]["id"]] == "knn")
    print("\nKaynak: gerçek sözlerin %d/%d'sinde B0 eşleşmedi, C3 devreye girdi." % (kn, len(gercek)))


if __name__ == "__main__":
    main()
