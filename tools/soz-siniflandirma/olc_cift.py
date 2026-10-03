# olc_cift.py — Tur 3: eşleşmiş TR/EN çiftleri ve iki-model (Türkçe + İngilizce encoder) hibriti H2.
# Ön kayıt: docs/olcum-soz-siniflandirma.md "Tur 3". olc.py ve olc_hibrit.py DEĞİŞTİRİLMEDİ.
#
#   python tools/soz-siniflandirma/olc_cift.py kalibre   saf fonksiyonların kendi testi (model yok)
#   python tools/soz-siniflandirma/olc_cift.py kos       gömmeleri hesapla (yavaş) -> sonuc/cift_<aday>.npz
#   python tools/soz-siniflandirma/olc_cift.py puanla    karne (markdown) -> sonuc/karne-tur3.md
#
# H2 (donmuş tanım):
#   1. B0 bir kurala eşleşirse sınıfı B0 verir (kaynak "b0", güven 1.0).
#   2. Eşleşmezse dil tespit edilir (dil_tespit). TR -> Türkçe encoder (C1) kNN, EN -> İngilizce encoder kNN
#      (e1/e2'den KALİBRASYON kümesinde EN doğruluğu yüksek olan; test'e bakılmaz). Bellek = YALNIZ aynı
#      dilde tespit edilen uretilmis örnekler, değerlendirilen örneğin grubu hariç.
#   3. LLM'siz yol: tahmin ∈ {hareket, sorgu} VE (kaynak "b0" VEYA kNN güveni ≥ τ). τ = kalibrasyonda tüm hattın
#      kesinliği ≥ %98 veren en küçük eşik; yoksa kNN hiçbir zaman yola göndermez (yalnız B0 gider).
import argparse
import json
import os
import random
import sys
import time

import numpy as np

AYNI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AYNI)
import olc  # noqa: E402
import veri_kur  # noqa: E402

CIFT = os.path.join(olc.KOK, "fixtures", "soz", "cift.json")
SINIFLAR, YOL, K = olc.SINIFLAR, olc.YOL, olc.K
# aday: (model, önek, havuzlama)
ADAY = {
    "c1": ("ytu-ce-cosmos/modernbert-tr-base", "", "mean"),
    "c3": ("intfloat/multilingual-e5-base", "query: ", "mean"),
    "e1": ("sentence-transformers/all-MiniLM-L6-v2", "", "mean"),
    "e2": ("BAAI/bge-small-en-v1.5", "", "cls"),
}
KOSULLAR = ["tr", "en", "tr_ascii", "tr_yazim", "en_yazim"]

# ----------------------------------------------------------------------------- dil tespiti (sezgi, donmuş)
EN_SOZ = set(("the to go you what is are can do dont don t your name a on at open sit stand come here me look write "
              "clear how who where i am tell thanks hello good morning stop that there this around front of use u see "
              "seeing want now wanna one day city weather joke screen whats it not board table window computer monitor "
              "run type erase put over after wait then and next toward head take seat freeze get up in out about "
              "have question for nice talking lovely today did thinking favorite color bored tired sleep goodbye "
              "evening introduce yourself recite poem day going quote near people room written says say left "
              "something more touch right please").split())


def dil_tespit(soz):
    t = olc.tr_katla(soz).split()
    if not t:
        return "tr"
    en = sum(1 for w in t if w in EN_SOZ)
    return "en" if en >= max(1, len(t) / 2) else "tr"


# ----------------------------------------------------------------------------- veri
def yukle_cift():
    cift = json.load(open(CIFT, encoding="utf-8"))["cift"]
    ornekler = olc.yukle()
    bellekte = {olc.tr_katla(o["soz"]) for o in ornekler}
    tutulan, atilan = [], []
    for c in cift:
        if olc.tr_katla(c["tr"]) in bellekte or olc.tr_katla(c["en"]) in bellekte:
            atilan.append(c["id"])
        else:
            tutulan.append(c)
    return tutulan, atilan, ornekler


def kosul_metinleri(c):
    """Her çift için 5 koşul; aynı rnd tohumuyla yazım hatası (TR ve EN aynı mekanizma)."""
    rnd = random.Random("tur3-" + c["id"])
    m = {"tr": c["tr"], "en": c["en"], "tr_ascii": olc.ASCII and c["tr"].translate(olc.ASCII)}
    m["tr_yazim"] = veri_kur.yazim_hatasi(c["tr"], rnd)
    m["en_yazim"] = veri_kur.yazim_hatasi(c["en"], rnd)
    return m


# ----------------------------------------------------------------------------- gömme
def gomme(model_id, onek, havuz, metinler):
    import torch
    from transformers import AutoModel, AutoTokenizer
    tok = AutoTokenizer.from_pretrained(model_id)
    model = AutoModel.from_pretrained(model_id).eval()

    def don(ms):
        b = tok([onek + m for m in ms], padding=True, truncation=True, max_length=64, return_tensors="pt")
        b.pop("token_type_ids", None)
        with torch.no_grad():
            h = model(**b).last_hidden_state
        if havuz == "cls":
            v = h[:, 0]
        else:
            m = b["attention_mask"].unsqueeze(-1).to(h.dtype)
            v = (h * m).sum(1) / m.sum(1).clamp(min=1)
        return torch.nn.functional.normalize(v, dim=-1).numpy()

    E = np.concatenate([don(metinler[i:i + 32]) for i in range(0, len(metinler), 32)]).astype(np.float32)
    for m in metinler[:5]:
        don([m])
    gec = []
    for m in metinler[-130:]:  # çift koşul metinleri (son 130): tek söz gecikmesi
        t0 = time.perf_counter()
        don([m])
        gec.append((time.perf_counter() - t0) * 1000)
    return E, np.array(gec), sum(p.numel() for p in model.parameters())


def tum_metinler(tutulan, ornekler):
    bellek = [o["soz"] for o in ornekler]
    cift = [(c["id"], k, kosul_metinleri(c)[k]) for c in tutulan for k in KOSULLAR]
    return bellek, cift


def kos():
    tutulan, atilan, ornekler = yukle_cift()
    bellek, cift = tum_metinler(tutulan, ornekler)
    metinler = bellek + [m for (_, _, m) in cift]
    os.makedirs(olc.SONUC, exist_ok=True)
    print("çift: %d tutuldu, %d atıldı (belleğe örtüşme) %s | gömülecek metin %d" % (len(tutulan), len(atilan), atilan, len(metinler)))
    for a, (mid, onek, havuz) in ADAY.items():
        E, gec, par = gomme(mid, onek, havuz, metinler)
        np.savez(os.path.join(olc.SONUC, "cift_%s.npz" % a), E=E, gec=gec, par=par,
                 kod=olc.sha(os.path.abspath(__file__)), cift_sha=olc.sha(CIFT), etiketli_sha=olc.sha(olc.ETIKET))
        print("%s tamam | p50=%.1f ms p95=%.1f ms | %.0fM" % (a, np.percentile(gec, 50), np.percentile(gec, 95), par / 1e6))


# ----------------------------------------------------------------------------- kNN
def knn_oy(Em, lab, q, k=K):
    sim = Em @ q
    en = np.argsort(-sim)[:k]
    w = np.clip(sim[en], 0, None)
    oy = np.zeros(len(SINIFLAR))
    for a, ag in zip(en, w):
        oy[lab[a]] += ag
    t = oy.sum()
    if t <= 0:
        return "emin_degil", 0.0
    j = int(oy.argmax())
    return SINIFLAR[j], float(oy[j] / t)


def bellek_etiket(ornekler):
    no = {s: j for j, s in enumerate(SINIFLAR)}
    return np.array([no[o["etiket"]] for o in ornekler])


def knn_logo_dil(E, ornekler, idx, dil_kisit):
    """olc.knn_logo ile aynı (uretilmis, grup hariç) + isteğe bağlı dil kısıtı: bellek yalnız o örnekle AYNI dilde."""
    lab = bellek_etiket(ornekler)
    dil = [dil_tespit(o["soz"]) for o in ornekler]
    cikti = {}
    for i in idx:
        g = ornekler[i]["grup"]
        bel = np.array([j for j, o in enumerate(ornekler)
                        if o["kaynak"] == "uretilmis" and o["grup"] != g and (not dil_kisit or dil[j] == dil[i])])
        assert all(ornekler[j]["kaynak"] == "uretilmis" and ornekler[j]["grup"] != g for j in bel), "SIZINTI"
        cikti[ornekler[i]["id"]] = knn_oy(E[bel], lab[bel], E[i]) if len(bel) else ("emin_degil", 0.0)
    return cikti


# ----------------------------------------------------------------------------- hat metrikleri (kaynağa duyarlı)
def hat_olcusu(tahmin, dogru, tau):
    """tahmin: [(sinif, guven, kaynak)]. Yola gider: sinif ∈ YOL ve (kaynak=="b0" veya tau!=None ve guven>=tau)."""
    gid = [i for i, (s, c, k) in enumerate(tahmin) if s in YOL and (k == "b0" or (tau is not None and c >= tau))]
    dg = [i for i in gid if tahmin[i][0] == dogru[i]]
    yl = [i for i in gid if tahmin[i][0] != dogru[i]]
    pay = sum(1 for d in dogru if d in YOL)
    return {"gidenler": len(gid), "dogru": len(dg), "yanlis": yl, "yol_sozu_sayisi": pay,
            "precision": len(dg) / len(gid) if gid else None, "coverage": len(dg) / pay if pay else None}


def hat_tau(tahmin, dogru):
    for tau in olc.TAU_IZGARA:
        m = hat_olcusu(tahmin, dogru, tau)
        if m["gidenler"] and m["precision"] >= olc.HEDEF_KESINLIK:
            return tau
    return None


def eslesmis_fark(tr_ok, en_ok, tohum=0, n_boot=2000):
    """Çift başına doğruluk farkı (EN - TR): ortalama, bootstrap %95 AA, ayrık çiftler."""
    d = np.array(en_ok, float) - np.array(tr_ok, float)
    rnd = np.random.default_rng(tohum)
    ort = [rnd.choice(d, len(d), replace=True).mean() for _ in range(n_boot)]
    return {"fark": float(d.mean()), "aa": (float(np.percentile(ort, 2.5)), float(np.percentile(ort, 97.5))),
            "yalniz_en": int((d > 0).sum()), "yalniz_tr": int((d < 0).sum())}


# ----------------------------------------------------------------------------- kalibre
def kalibre():
    # dil tespiti: bilinen cümleler
    for s, d in {"go to the table": "en", "masaya git": "tr", "nasilsin": "tr", "what do you see": "en",
                 "come to me please": "en", "tahtaya yaz": "tr", "stop": "en", "kalk ve pencereye git": "tr"}.items():
        assert dil_tespit(s) == d, (s, dil_tespit(s))
    # hat metrikleri: B0-kaynaklılar eşiğe bakmaz; kNN-kaynaklılar tau'ya bağlı; tau=None -> kNN hiç gitmez
    dog = ["hareket", "hareket", "sorgu", "sohbet"]
    t = [("hareket", 1.0, "b0"), ("hareket", 0.9, "knn"), ("hareket", 0.4, "knn"), ("hareket", 0.95, "knn")]
    m = hat_olcusu(t, dog, None)
    assert m["gidenler"] == 1 and m["dogru"] == 1 and m["yanlis"] == [], m  # sentinel hatası düzeltildi: yalnız b0
    m = hat_olcusu(t, dog, 0.9)
    assert m["gidenler"] == 3 and m["dogru"] == 2 and m["yanlis"] == [3], m
    assert hat_tau(t, dog) == 0.96  # 0.96'dan itibaren hiçbir kNN geçmez: hat = yalnız B0 (kesinlik 1.0)
    t2 = t + [("hareket", 1.0, "knn")]  # oybirliğiyle YANLIŞ kNN (etiket sohbet): hiçbir eşik onu dışlayamaz
    assert hat_tau(t2, dog + ["sohbet"]) is None
    # eşleşmiş fark: bilinen girdi
    r = eslesmis_fark([1, 1, 0, 0], [1, 1, 1, 1])
    assert r["fark"] == 0.5 and r["yalniz_en"] == 2 and r["yalniz_tr"] == 0, r
    assert eslesmis_fark([1, 0, 1], [1, 0, 1])["fark"] == 0.0
    assert eslesmis_fark([1, 0, 0, 1], [0, 1, 1, 0], tohum=3) == eslesmis_fark([1, 0, 0, 1], [0, 1, 1, 0], tohum=3)  # deterministik
    # dil kısıtlı bellek: İngilizce örnek yalnız İngilizce belleği görür
    orn = [{"id": "a", "soz": "go to the table", "kaynak": "uretilmis", "grup": "g1", "etiket": "hareket"},
           {"id": "b", "soz": "come here", "kaynak": "uretilmis", "grup": "g2", "etiket": "hareket"},
           {"id": "c", "soz": "masaya git", "kaynak": "uretilmis", "grup": "g3", "etiket": "sohbet"}]
    E = np.array([[1, 0], [0.9, 0.1], [0.95, 0.05]], dtype=np.float32)
    E /= np.linalg.norm(E, axis=1, keepdims=True)
    s = knn_logo_dil(E, orn, [0], True)
    assert s["a"][0] == "hareket", s  # c (TR, sohbet) kısıtla dışlanır; en yakın b
    s2 = knn_logo_dil(E, orn, [0], False)
    assert s2["a"][0] == "sohbet" or s2["a"][1] < 1.0, s2  # kısıtsız: c de oy verir
    # koşul metinleri: aynı çift için deterministik
    c = {"id": "x1", "tr": "masaya git", "en": "go to the table"}
    assert kosul_metinleri(c) == kosul_metinleri(c)
    print("kalibre: TAMAM (dil tespiti, hat metrikleri/sentinel, eşleşmiş fark, dil kısıtlı bellek, determinizm)")


# ----------------------------------------------------------------------------- puanla
def puanla():
    tutulan, atilan, ornekler = yukle_cift()
    bellek, cift = tum_metinler(tutulan, ornekler)
    nb = len(bellek)
    emb = {}
    for a in ADAY:
        z = np.load(os.path.join(olc.SONUC, "cift_%s.npz" % a))
        assert str(z["cift_sha"]) == olc.sha(CIFT) and str(z["etiketli_sha"]) == olc.sha(olc.ETIKET), a + ": veri koşudan sonra değişmiş"
        emb[a] = (z["E"], z["gec"], int(z["par"]))
    lab = bellek_etiket(ornekler)
    et_cift = {c["id"]: c["etiket"] for c in tutulan}
    gercek = [i for i, o in enumerate(ornekler) if o["kaynak"] == "gercek"]
    tohum = olc.tohum_gruplari(ornekler)
    kal = [i for i, o in enumerate(ornekler) if o["grup"] in tohum]
    uret_idx = [i for i, o in enumerate(ornekler) if o["kaynak"] == "uretilmis"]
    dogru = [o["etiket"] for o in ornekler]
    cift_idx = {(cid, k): nb + j for j, (cid, k, _m) in enumerate(cift)}
    cift_metin = {(cid, k): m for (cid, k, m) in cift}
    rapor = []
    P = rapor.append

    P("# Tur 3 karnesi (olc_cift.py)")
    P("olc_cift.py %s | cift.json %s | etiketli %s | çift: %d tutuldu, %d atıldı %s" % (
        olc.sha(os.path.abspath(__file__)), olc.sha(CIFT), olc.sha(olc.ETIKET), len(tutulan), len(atilan), atilan))

    # --- dil tespiti (T6)
    ok = {k: sum(1 for c in tutulan if dil_tespit(cift_metin[(c["id"], k)]) == ("en" if k.startswith("en") else "tr")) for k in KOSULLAR}
    n = len(tutulan)
    P("\n## Dil tespiti (T6): doğru oran, koşul bazında")
    P("| " + " | ".join(KOSULLAR) + " | genel |\n|" + "---|" * (len(KOSULLAR) + 1))
    P("| " + " | ".join("%d%%" % round(100 * ok[k] / n) for k in KOSULLAR) + " | %d%% |" % round(100 * sum(ok.values()) / (n * len(KOSULLAR))))

    # --- B0 ve kNN adayları, koşul bazında
    def b0_tah(k):
        return [olc.b0(cift_metin[(c["id"], k)])[0] for c in tutulan]
    dog = [et_cift[c["id"]] for c in tutulan]
    tah = {"b0": {k: b0_tah(k) for k in KOSULLAR}}
    for a, (E, _g, _p) in emb.items():
        Em, labm = E[np.array(uret_idx)], lab[np.array(uret_idx)]
        tah[a] = {k: [knn_oy(Em, labm, E[cift_idx[(c["id"], k)]])[0] for c in tutulan] for k in KOSULLAR}

    P("\n## Eşleşmiş çiftler: doğruluk (65 çift; belleğin tamamı, dil kısıtsız)")
    P("| aday | " + " | ".join(KOSULLAR) + " | EN−TR fark [95% AA] | yalnız EN doğru / yalnız TR doğru |\n|---|" + "---|" * len(KOSULLAR) + "---|---|")
    fark = {}
    for a, t in tah.items():
        acc = {k: sum(1 for x, y in zip(t[k], dog) if x == y) / n for k in KOSULLAR}
        f = eslesmis_fark([x == y for x, y in zip(t["tr"], dog)], [x == y for x, y in zip(t["en"], dog)])
        fark[a] = (acc, f)
        P("| %s | %s | %+.0f [%+.0f, %+.0f] | %d / %d |" % (a, " | ".join("%d%%" % round(100 * acc[k]) for k in KOSULLAR),
                                                          100 * f["fark"], 100 * f["aa"][0], 100 * f["aa"][1], f["yalniz_en"], f["yalniz_tr"]))
    P("\nmakro-F1 (tr / en): " + ", ".join("%s %.2f/%.2f" % (a, olc.makro_f1(t["tr"], dog), olc.makro_f1(t["en"], dog)) for a, t in tah.items()))

    # --- İngilizce encoder seçimi: KALİBRASYON kümesinde EN doğruluğu (teste bakılmaz)
    ing = {}
    for a in ("e1", "e2"):
        E = emb[a][0]
        s = knn_logo_dil(E, ornekler, kal, False)
        en_kal = [i for i in kal if dil_tespit(ornekler[i]["soz"]) == "en"]
        ing[a] = sum(1 for i in en_kal if s[ornekler[i]["id"]][0] == dogru[i]) / len(en_kal)
    sec = max(ing, key=ing.get)
    P("\nİngilizce encoder seçimi (kalibrasyon EN doğruluğu, n=%d): %s → seçilen **%s**" % (
        len([i for i in kal if dil_tespit(ornekler[i]["soz"]) == "en"]), {a: "%d%%" % round(100 * v) for a, v in ing.items()}, sec))

    # --- H2 hattı: B0 → dil → encoder (dil kısıtlı bellek), kalibrasyon + gerçek + çiftler
    Etr, Een = emb["c1"][0], emb[sec][0]
    hepsi = sorted(set(gercek) | set(kal))
    knn_tr = knn_logo_dil(Etr, ornekler, hepsi, True)
    knn_en = knn_logo_dil(Een, ornekler, hepsi, True)

    def hat(i):
        o = ornekler[i]
        s, esl = None, False
        for sinif, desen in olc.B0_DERLI:
            if desen.search(olc.tr_katla(o["soz"])):
                return (sinif, 1.0, "b0")
        d = dil_tespit(o["soz"])
        s, c = (knn_tr if d == "tr" else knn_en)[o["id"]]
        return (s, c, "knn")

    kal_tah = [hat(i) for i in kal]
    tau = hat_tau(kal_tah, [dogru[i] for i in kal])
    P("\n## H2 (B0 → dil → TR: C1 / EN: %s), τ_H2 = %s" % (sec, tau))
    kb = hat_olcusu(kal_tah, [dogru[i] for i in kal], tau)
    P("kalibrasyon: yola giden %d, doğru %d, yanlış %d, kesinlik %s" % (kb["gidenler"], kb["dogru"], len(kb["yanlis"]),
                                                                    "-" if kb["precision"] is None else "%.1f%%" % (100 * kb["precision"])))
    g_tah = [hat(i) for i in gercek]
    g_b0 = [(olc.b0(ornekler[i]["soz"])[0], 1.0, "b0") for i in gercek]
    gd = [dogru[i] for i in gercek]
    mh, mb = hat_olcusu(g_tah, gd, tau), hat_olcusu(g_b0, gd, None)
    tart = [j for j, i in enumerate(gercek) if "TARTIŞMALI" in ornekler[i]["not"]]
    P("\n### Gerçek sözler (71; etiketler onaysız)")
    P("| sistem | yola giden | doğru | yanlış | kesinlik | kapsama |\n|---|---|---|---|---|---|")
    for ad, m in (("B0", mb), ("H2", mh)):
        P("| %s | %d | %d | %d | %s | %s |" % (ad, m["gidenler"], m["dogru"], len(m["yanlis"]),
                                              "-" if m["precision"] is None else "%d%%" % round(100 * m["precision"]),
                                              "-" if m["coverage"] is None else "%d%%" % round(100 * m["coverage"])))
    P("H2'nin B0'a eklediği doğru yol: %d | eklediği yanlış yol: %d" % (mh["dogru"] - mb["dogru"], len(mh["yanlis"]) - len(mb["yanlis"])))
    P("H2 yanlış yola giden: %s" % [(ornekler[gercek[j]]["soz"], g_tah[j][0], gd[j]) for j in mh["yanlis"]])
    P("H2'nin kurtardığı (B0 kaçırdı): %s" % [ornekler[gercek[j]]["soz"] for j in range(len(gercek))
                                              if gd[j] in YOL and g_tah[j][0] == gd[j] and g_tah[j][2] == "knn" and (g_tah[j][1] >= (tau if tau is not None else 9))])
    gt = [j for j in range(len(gercek)) if j not in tart]
    mh2 = hat_olcusu([g_tah[j] for j in gt], [gd[j] for j in gt], tau)
    mb2 = hat_olcusu([g_b0[j] for j in gt], [gd[j] for j in gt], None)
    P("tartışmasız (%d söz): B0 doğru %d / H2 doğru %d, H2 yanlış %d" % (len(gt), mb2["dogru"], mh2["dogru"], len(mh2["yanlis"])))

    # --- H2 ve B0 çift koşullarında (T8): LLM'siz yol doğru-yol oranı
    def cift_hat(cid, k):
        m = cift_metin[(cid, k)]
        for sinif, desen in olc.B0_DERLI:
            if desen.search(olc.tr_katla(m)):
                return (sinif, 1.0, "b0")
        d = dil_tespit(m)
        E, bel_dil = (Etr, "tr") if d == "tr" else (Een, "en")
        bel = np.array([j for j in uret_idx if dil_tespit(ornekler[j]["soz"]) == d])
        s, c = knn_oy(E[bel], lab[bel], E[cift_idx[(cid, k)]]) if len(bel) else ("emin_degil", 0.0)
        return (s, c, "knn")

    P("\n### Çift koşulları: etiketi hareket/sorgu olan çiftlerde LLM'siz DOĞRU yol oranı (yanlış yol sayısı)")
    P("| sistem | " + " | ".join(KOSULLAR) + " |\n|---|" + "---|" * len(KOSULLAR))
    sat_b, sat_h = [], []
    for k in KOSULLAR:
        tb = [(olc.b0(cift_metin[(c["id"], k)])[0], 1.0, "b0") for c in tutulan]
        th = [cift_hat(c["id"], k) for c in tutulan]
        mb_, mh_ = hat_olcusu(tb, dog, None), hat_olcusu(th, dog, tau)
        sat_b.append("%d%% (%d)" % (round(100 * mb_["coverage"]), len(mb_["yanlis"])))
        sat_h.append("%d%% (%d)" % (round(100 * mh_["coverage"]), len(mh_["yanlis"])))
    P("| B0 | " + " | ".join(sat_b) + " |")
    P("| H2 | " + " | ".join(sat_h) + " |")

    # --- gecikme (T9)
    P("\n## Gecikme (tek söz, 130 çift metni; p50 / p95 ms) ve parametre")
    for a, (E, g, p) in emb.items():
        P("- %s: %.1f / %.1f ms, %.0fM" % (a, np.percentile(g, 50), np.percentile(g, 95), p / 1e6))
    out = "\n".join(rapor)
    open(os.path.join(olc.SONUC, "karne-tur3.md"), "w", encoding="utf-8").write(out + "\n")
    print(out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("komut", choices=["kalibre", "kos", "puanla"])
    a = ap.parse_args()
    {"kalibre": kalibre, "kos": kos, "puanla": puanla}[a.komut]()
