# olc.py — söz sınıflandırma çevrimdışı ölçümü (ön kayıt: docs/olcum-soz-siniflandirma.md).
#
#   python tools/soz-siniflandirma/olc.py kalibre            ölçünün KENDİ testi (model yok; bilinen girdiler)
#   python tools/soz-siniflandirma/olc.py kos <aday>         aday: b0 | laya | c1 | c2 | c3 -> sonuc/<aday>.json
#   python tools/soz-siniflandirma/olc.py puanla             sonuc/*.json + etiketli.json -> karne (markdown + sonuc/karne.json)
#
# Neden böyle bölündü: `kos` yavaş (model yükler), `puanla` saniyeler sürer. Etiketler Ozyn onayından
# sonra değişirse yalnız `puanla` yeniden koşar — gömmeler diskte.
#
# Sızıntı bekçisi: bellek (kNN'nin "eğitimi") YALNIZ kaynak=uretilmis örneklerden oluşur ve değerlendirilen
# örneğin grubunu İÇERMEZ (grup-dışarıda-bırak). Gerçek sözler hiçbir zaman belleğe girmez. Bu iki kural
# `knn_logo` içinde assert; ihlal = ölçü geçersiz (kalibre'de ayrıca denenir).
import argparse
import hashlib
import json
import os
import random
import re
import subprocess
import sys
import time

import numpy as np

KLASOR = os.path.dirname(os.path.abspath(__file__))
KOK = os.path.dirname(os.path.dirname(KLASOR))
ETIKET = os.path.join(KOK, "fixtures", "soz", "etiketli.json")
SONUC = os.path.join(KLASOR, "sonuc")
SINIFLAR = ["hareket", "yaz", "sorgu", "sohbet", "emin_degil"]
YOL = ("hareket", "sorgu")  # LLM'siz yollar: yanlış gitmenin bedeli bedene yanlış eylem
K = 5
TAU_IZGARA = [round(0.50 + 0.01 * i, 2) for i in range(51)]  # 0.50 .. 1.00
HEDEF_KESINLIK = 0.98
GOMME_ADAYLARI = {
    "c1": ("ytu-ce-cosmos/modernbert-tr-base", ""),
    "c2": ("alphaedge-ai/mmBERT-base-tur-16384", ""),
    "c3": ("intfloat/multilingual-e5-base", "query: "),  # model kartı: kısa metne "query: " öneki
}

ASCII = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")


# ----------------------------------------------------------------------------- veri

def yukle():
    belge = json.load(open(ETIKET, encoding="utf-8"))
    assert belge["siniflar"] == SINIFLAR, "etiketli.json sınıfları ile olc.py sınıfları ayrıştı"
    return belge["ornekler"]


def sha(yol):
    return hashlib.sha256(open(yol, "rb").read()).hexdigest()[:16]


def git_basi():
    try:
        return subprocess.check_output(["git", "-C", KOK, "rev-parse", "--short", "HEAD"], text=True).strip()
    except Exception:
        return "?"


def tohum_gruplari(ornekler):
    """Kalibrasyon grupları: gerçek üyesi OLMAYAN gruplar (benim yazdığım tohumlar + türevleri)."""
    gercekli = {o["grup"] for o in ornekler if o["kaynak"] == "gercek"}
    return {o["grup"] for o in ornekler} - gercekli


# ----------------------------------------------------------------------------- B0: regex taban çizgisi
# Elle yazılmış, sözcük listesi değil GENEL kalıplar. DİKKAT (ön kayıtta yanlılık olarak yazıldı): yazarı
# gerçek söz listesini gördü; bu B0'a hafif avantaj verir -> ML'e karşı TUTUCU bir taban çizgisi.

def tr_katla(s):
    s = s.replace("İ", "i").replace("I", "ı").lower().translate(ASCII)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


_HEDEF = r"(masa|tahta|pencere|sandalye|bilgisayar|monitor)\w*"
_EN_HEDEF = r"(table|board|window|chair|computer|monitor)"
B0_KURALLAR = [
    # (sınıf, desen) — SIRA önemlidir: ilk eşleşen kazanır.
    ("sohbet", r"(abilir misin|ebilir misin|abilirmisin|ebilirmisin|can you|could you|\bneden\b|\bwhy\b)"),
    ("emin_degil", r"(\bve\b|\band\b|\bthen\b|\bsonra\b)"),
    ("emin_degil", r"^(oturma|kalkma|gitme|yazma|don t|dont|do not)\b"),
    ("emin_degil", r"\b(bunu|sunu|suna|buna|oraya|buraya|there|that|this)\b"),
    ("hareket", r"^(otur|kalk|dur|stop|sit|sit down|stand|stand up)( (lutfen|ayaga|orada|please))?$"),
    ("hareket", r"^(bana|yanima)( dogru)? gel$|^come (here|to me)$"),
    ("hareket", r"^" + _HEDEF + r"( yanina)? (git|yuru)$|^(go|walk) to the " + _EN_HEDEF + r"$"),
    ("hareket", r"^" + _HEDEF + r" bak$|^look at the " + _EN_HEDEF + r"$"),
    ("hareket", r"^(onundeki )?(bilgisayari|monitoru|bilgisayar) ac$|^open the (computer|monitor)$"),
    ("yaz", r"^(beyaz )?tahtaya .*\byaz$|^write .* on the board$|^(tahtayi temizle|clear the board)$"),
    ("yaz", r"^(terminal\w* .+|run .+|.+ calistir)$"),
    ("sorgu", r"^(ne|neyi) goruyorsun$|^(etrafta|yakinda|onunde|karsinda) ne var$|^neredesin$|^ben nerede(yim| duruyorum)$"),
    ("sorgu", r"^what (do you |u )?see(ing)?$|^where am i$|^what is in front of you$|^what s around$"),
    ("sorgu", r"^" + _HEDEF + r" nerede$|^where is the " + _EN_HEDEF + r"$"),
    ("sohbet", r"^(merhaba|selam|naber|nasilsin|gunaydin|iyi geceler|tesekkurler|hello|hi|hey|thanks|good morning|how are you)\b"),
]
B0_DERLI = [(sinif, re.compile(desen)) for sinif, desen in B0_KURALLAR]


def b0(soz):
    t = tr_katla(soz)
    for sinif, desen in B0_DERLI:
        if desen.search(t):
            return sinif, 1.0
    return "emin_degil", 1.0  # eşleşmeyen = LLM'e düşer


# ----------------------------------------------------------------------------- B1: Laya sıfır atış

LAYA_SORU = {"yol": {
    "type": "choice",
    "instructions": "Which route should this user message to? Hangi yola gitmeli?",
    "criteria": {
        "hareket": "body action / beden eylemi: go, sit, stand, come here, look at, open the computer (git, otur, kalk, gel, bak, bilgisayarı aç)",
        "yaz": "write on the board or run a terminal command / tahtaya yaz, terminal komutu",
        "sorgu": "ask what the agent sees or where things are / ne görüyorsun, neredesin",
        "sohbet": "chat, greeting, question about abilities / sohbet, selam, yetenek sorusu",
        "emin_degil": "unclear, negated, compound or context-dependent / belirsiz, olumsuz, bileşik",
    },
}}


def kos_laya(ornekler):
    from laya import Router
    r = Router()
    cikti, gecikme = {}, []
    for i, o in enumerate(ornekler):
        t0 = time.perf_counter()
        sonuc = r.predict(o["soz"], LAYA_SORU, model="multilingual")
        dt = (time.perf_counter() - t0) * 1000
        if i >= 3:  # ilk üç çağrı ısınma (çekirdek derleme, ilk yükleme)
            gecikme.append(dt)
        p = sonuc["answers"]["yol"]["probabilities"]
        sinif = max(p, key=p.get)
        cikti[o["id"]] = [sinif, float(p[sinif])]
    return cikti, gecikme, None


# ----------------------------------------------------------------------------- C1-C3: gömme + kNN

def gomme_hesapla(model_id, onek, ornekler, gercek_idx):
    import torch
    from transformers import AutoModel, AutoTokenizer
    tok = AutoTokenizer.from_pretrained(model_id)
    model = AutoModel.from_pretrained(model_id).eval()
    parametre = sum(p.numel() for p in model.parameters())

    def don(metinler):
        b = tok([onek + m for m in metinler], padding=True, truncation=True, max_length=64, return_tensors="pt")
        b.pop("token_type_ids", None)
        with torch.no_grad():
            h = model(**b).last_hidden_state
        m = b["attention_mask"].unsqueeze(-1).to(h.dtype)
        v = (h * m).sum(1) / m.sum(1).clamp(min=1)
        return torch.nn.functional.normalize(v, dim=-1).numpy()

    metinler = [o["soz"] for o in ornekler]
    parcalar = [don(metinler[i:i + 32]) for i in range(0, len(metinler), 32)]
    E = np.concatenate(parcalar).astype(np.float32)
    # Gecikme: tek söz, tek seferde (canlı kullanımın biçimi), gerçek sözler üzerinde; 5 ısınma.
    for m in metinler[:5]:
        don([m])
    gecikme = []
    for i in gercek_idx:
        t0 = time.perf_counter()
        don([metinler[i]])
        gecikme.append((time.perf_counter() - t0) * 1000)
    return E, gecikme, parametre


# ----------------------------------------------------------------------------- kNN (grup-dışarıda-bırak)

def knn_logo(E, ornekler, eval_idx, k=K):
    """Her değerlendirilen örnek için (sınıf, güven). Bellek = yalnız uretilmis, kendi grubu HARİÇ."""
    bellek_tum = np.array([i for i, o in enumerate(ornekler) if o["kaynak"] == "uretilmis"])
    sinif_no = {s: j for j, s in enumerate(SINIFLAR)}
    etiket = np.array([sinif_no[o["etiket"]] for o in ornekler])
    cikti = {}
    for i in eval_idx:
        g = ornekler[i]["grup"]
        bellek = np.array([j for j in bellek_tum if ornekler[j]["grup"] != g])
        assert all(ornekler[j]["kaynak"] == "uretilmis" and ornekler[j]["grup"] != g for j in bellek), "SIZINTI"
        sim = E[bellek] @ E[i]
        en = np.argsort(-sim)[:k]
        w = np.clip(sim[en], 0, None)
        oy = np.zeros(len(SINIFLAR))
        for a, ag in zip(en, w):
            oy[etiket[bellek[a]]] += ag
        toplam = oy.sum()
        if toplam <= 0:
            cikti[ornekler[i]["id"]] = ["emin_degil", 0.0]
            continue
        j = int(oy.argmax())
        cikti[ornekler[i]["id"]] = [SINIFLAR[j], float(oy[j] / toplam)]
    return cikti


# ----------------------------------------------------------------------------- metrikler (saf)

def yol_olcusu(tahmin, dogru, tau):
    """tahmin/dogru: [(sinif)], guven ayrı. LLM'siz yola gidenler: tahmin ∈ YOL ve güven ≥ tau.
    precision = doğru yola gidenler / yola gidenler (yola giden yoksa None); coverage = doğru yola
    gidenler / doğru etiketi YOL'da olanlar. yanlis = yanlış yola gidenlerin indeksleri."""
    gidenler = [i for i, (p, c) in enumerate(tahmin) if p in YOL and c >= tau]
    dogru_gidenler = [i for i in gidenler if tahmin[i][0] == dogru[i]]
    yanlis = [i for i in gidenler if tahmin[i][0] != dogru[i]]
    pay = sum(1 for d in dogru if d in YOL)
    return {
        "gidenler": len(gidenler),
        "dogru": len(dogru_gidenler),
        "precision": (len(dogru_gidenler) / len(gidenler)) if gidenler else None,
        "coverage": (len(dogru_gidenler) / pay) if pay else None,
        "yanlis": yanlis,
        "yol_sozu_sayisi": pay,
    }


def tau_sec(tahmin, dogru):
    """Kalibrasyon kümesinde kesinlik ≥ HEDEF olan EN KÜÇÜK eşik (= en çok kapsama). Yoksa None."""
    for tau in TAU_IZGARA:
        m = yol_olcusu(tahmin, dogru, tau)
        if m["gidenler"] and m["precision"] >= HEDEF_KESINLIK:
            return tau
    return None


def makro_f1(tahmin_sinif, dogru):
    f = []
    for s in SINIFLAR:
        tp = sum(1 for p, d in zip(tahmin_sinif, dogru) if p == s and d == s)
        fp = sum(1 for p, d in zip(tahmin_sinif, dogru) if p == s and d != s)
        fn = sum(1 for p, d in zip(tahmin_sinif, dogru) if p != s and d == s)
        f.append(0.0 if tp == 0 else 2 * tp / (2 * tp + fp + fn))
    return sum(f) / len(f)


def yuzdelik(x, p):
    return float(np.percentile(x, p)) if x else None


# ----------------------------------------------------------------------------- kalibre

def kalibre():
    """Ölçünün kendi testi: bilinen girdilerde beklenen değer. Tutmazsa araç onarılır, kod değil."""
    # Tavan: hep doğru söyleyen -> kesinlik 1, kapsama 1, makro-F1 1
    dogru = ["hareket"] * 6 + ["sorgu"] * 4 + ["yaz"] * 5 + ["sohbet"] * 8 + ["emin_degil"] * 3
    m = yol_olcusu([(d, 1.0) for d in dogru], dogru, 0.5)
    assert m["precision"] == 1.0 and m["coverage"] == 1.0 and not m["yanlis"], m
    assert makro_f1(dogru, dogru) == 1.0
    # Hep "hareket": 6 hareket doğru, 4 sorgu yanlış yola, diğer 16 hareket'e yanlış -> precision = 6/26
    m = yol_olcusu([("hareket", 1.0)] * len(dogru), dogru, 0.5)
    assert m["gidenler"] == 26 and m["dogru"] == 6 and abs(m["precision"] - 6 / 26) < 1e-12, m
    assert abs(m["coverage"] - 6 / 10) < 1e-12, m  # kapsama paydası: etiketi YOL'da olan 10 söz
    # Hep LLM'e düşen (emin_degil): kimse yola gitmez -> precision None, kapsama 0
    m = yol_olcusu([("emin_degil", 1.0)] * len(dogru), dogru, 0.5)
    assert m["gidenler"] == 0 and m["precision"] is None and m["coverage"] == 0.0, m
    # Sorgu'ya giden hareket sözü = yanlış yol (kesinliği düşürür, kapsamaya girmez)
    m = yol_olcusu([("sorgu", 1.0)], ["hareket"], 0.5)
    assert m["dogru"] == 0 and m["yanlis"] == [0], m
    # Eşik, güveni olan ayırıcıyı bulur: doğrular güven 0.9, yanlışlar 0.6 -> tau 0.61..0.9 arası kesinlik 1
    tah = [("hareket", 0.9)] * 5 + [("hareket", 0.6)] * 5
    dog = ["hareket"] * 5 + ["sohbet"] * 5
    assert tau_sec(tah, dog) == 0.61, tau_sec(tah, dog)
    # Ayırıcı yoksa (her güven aynı, yarısı yanlış) eşik bulunamaz -> hiçbir şey yola gitmez
    assert tau_sec([("hareket", 0.9)] * 10, ["hareket"] * 5 + ["sohbet"] * 5) is None
    # Rastgele taban: 5 sınıf üzerinde makro-F1 ≈ 0.2, yola gidenlerin kesinliği ≈ yol payı
    rnd = random.Random(0)
    d = [rnd.choice(SINIFLAR) for _ in range(4000)]
    t = [(rnd.choice(SINIFLAR), 1.0) for _ in d]
    assert abs(makro_f1([x[0] for x in t], d) - 0.2) < 0.03
    assert yol_olcusu(t, d, 0.5)["precision"] < 0.35
    # Sızıntı bekçisi: aynı gruptan örnek belleğe girerse knn_logo assert eder; girmemesini deneriz
    orn = [{"id": "a", "kaynak": "gercek", "grup": "g1", "etiket": "hareket"},
           {"id": "b", "kaynak": "uretilmis", "grup": "g1", "etiket": "hareket"},
           {"id": "c", "kaynak": "uretilmis", "grup": "g2", "etiket": "sohbet"}]
    E = np.array([[1.0, 0.0], [1.0, 0.0], [0.6, 0.8]], dtype=np.float32)  # c: benzerlik 0.6 > 0 (ortogonal olsa ağırlık 0 -> güven 0)
    s = knn_logo(E, orn, [0, 1], k=2)
    assert s["a"][0] == "sohbet" and s["b"][0] == "sohbet", s  # kendi grubu (b) bellekte yok: tek komşu c
    # B0 kalıp tablosu: bilinen girdiler (ASCII + yazım + zor vakalar)
    beklenen = {"otur": "hareket", "Masaya git": "hareket", "bana gel": "hareket", "tahtaya merhaba yaz": "yaz",
                "ne görüyorsun": "sorgu", "nasilsin orion": "sohbet", "oturabilir misin?": "sohbet",
                "masaya git ve otur": "emin_degil", "oturma": "emin_degil", "oraya git": "emin_degil",
                "blabla": "emin_degil"}
    for soz, sinif in beklenen.items():
        assert b0(soz)[0] == sinif, (soz, b0(soz))
    print("kalibre: TAMAM (tavan, hep-hareket, hep-LLM, yanlış-yol, eşik, ayırıcısız, rastgele, sızıntı, b0 kalıpları)")


# ----------------------------------------------------------------------------- kos

def kos(aday):
    ornekler = yukle()
    gercek_idx = [i for i, o in enumerate(ornekler) if o["kaynak"] == "gercek"]
    os.makedirs(SONUC, exist_ok=True)
    kayit = {"aday": aday, "kod": {"olc_py": sha(os.path.abspath(__file__)), "etiketli": sha(ETIKET), "git": git_basi()}}
    if aday == "b0":
        t0 = time.perf_counter()
        kayit["ornek"] = {o["id"]: list(b0(o["soz"])) for o in ornekler}
        kayit["gecikme_ms"] = [(time.perf_counter() - t0) * 1000 / len(ornekler)]
        kayit["parametre"] = 0
    elif aday == "laya":
        kayit["ornek"], kayit["gecikme_ms"], kayit["parametre"] = kos_laya(ornekler)
    elif aday in GOMME_ADAYLARI:
        model_id, onek = GOMME_ADAYLARI[aday]
        E, gecikme, parametre = gomme_hesapla(model_id, onek, ornekler, gercek_idx)
        np.save(os.path.join(SONUC, aday + ".npy"), E)
        kayit.update({"model": model_id, "gomme": aday + ".npy", "gecikme_ms": gecikme, "parametre": parametre})
    else:
        sys.exit("bilinmeyen aday: " + aday)
    json.dump(kayit, open(os.path.join(SONUC, aday + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
    g = kayit["gecikme_ms"]
    print("%s: tamam | gecikme p50=%.1f ms p95=%.1f ms | parametre=%s" % (aday, yuzdelik(g, 50), yuzdelik(g, 95), kayit["parametre"]))


# ----------------------------------------------------------------------------- puanla

def turev_tipi(o, gercek_soz_grup):
    if o["kaynak"] != "uretilmis" or o["grup"] not in gercek_soz_grup:
        return None
    return "ascii" if o["soz"] == gercek_soz_grup[o["grup"]].translate(ASCII) else "yazim"


def puanla(sadece_onayli=False):
    ornekler = yukle()
    idx = {o["id"]: i for i, o in enumerate(ornekler)}
    gercek = [i for i, o in enumerate(ornekler) if o["kaynak"] == "gercek" and (o["onay"] or not sadece_onayli)]
    onaysiz = sum(1 for i in gercek if not ornekler[i]["onay"])
    tartisma = {i for i in gercek if "TARTIŞMALI" in ornekler[i]["not"]}
    tohum = tohum_gruplari(ornekler)
    kalib = [i for i, o in enumerate(ornekler) if o["grup"] in tohum]
    gercek_soz_grup = {o["grup"]: o["soz"] for o in ornekler if o["kaynak"] == "gercek"}
    turev = [i for i, o in enumerate(ornekler) if turev_tipi(o, gercek_soz_grup)]
    dogru = [o["etiket"] for o in ornekler]

    print("# Karne (puanla)")
    print("etiketli.json: %s | gerçek söz: %d (onaysız: %d) | tartışmalı: %d | kalibrasyon örneği: %d | türev: %d" % (
        sha(ETIKET), len(gercek), onaysiz, len(tartisma), len(kalib), len(turev)))
    if onaysiz:
        print("!! GERÇEK SÖZLERİN %d'inin ETİKETİ OZYN TARAFINDAN ONAYLANMADI — sonuçlar GEÇİCİ etiketlerle." % onaysiz)
    karne = {}
    for aday in ["b0", "laya", "c1", "c2", "c3"]:
        yol = os.path.join(SONUC, aday + ".json")
        if not os.path.exists(yol):
            continue
        kayit = json.load(open(yol, encoding="utf-8"))
        assert kayit["kod"]["etiketli"] == sha(ETIKET), "%s: etiketli.json koşudan sonra değişmiş; gömme eski etikete bağlı" % aday
        if "gomme" in kayit:
            E = np.load(os.path.join(SONUC, kayit["gomme"]))
            tah_id = knn_logo(E, ornekler, sorted(set(gercek) | set(kalib) | set(turev)))
        else:
            tah_id = kayit["ornek"]
        tah = lambda ids: [tuple(tah_id[ornekler[i]["id"]]) for i in ids]
        d = lambda ids: [dogru[i] for i in ids]
        tau = tau_sec(tah(kalib), d(kalib))
        esik = tau if tau is not None else 1.01  # eşik bulunamadı -> hiçbir şey yola gitmez
        kapi = yol_olcusu(tah(gercek), d(gercek), esik)
        kapi_tartismasiz = yol_olcusu(tah([i for i in gercek if i not in tartisma]), d([i for i in gercek if i not in tartisma]), esik)
        arg = [t[0] for t in tah(gercek)]
        satir = {
            "tau": tau, "kapi": kapi, "kapi_tartismasiz": kapi_tartismasiz,
            "makro_f1": makro_f1(arg, d(gercek)), "dogruluk": sum(1 for a, b in zip(arg, d(gercek)) if a == b) / len(gercek),
            "gecikme_p50": yuzdelik(kayit["gecikme_ms"], 50), "gecikme_p95": yuzdelik(kayit["gecikme_ms"], 95),
            "parametre": kayit["parametre"],
            "yanlis_yola_giden": [(ornekler[gercek[j]]["soz"], tah(gercek)[j][0], ornekler[gercek[j]]["etiket"]) for j in kapi["yanlis"]],
        }
        for tip in ("ascii", "yazim"):
            ids = [i for i in turev if turev_tipi(ornekler[i], gercek_soz_grup) == tip]
            tt = tah(ids)
            satir["turev_" + tip] = sum(1 for t, i in zip(tt, ids) if t[0] == dogru[i]) / len(ids) if ids else None
        karne[aday] = satir
    json.dump(karne, open(os.path.join(SONUC, "karne.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    f = lambda x, p=1: "-" if x is None else ("%.*f" % (p, x))
    pct = lambda x: "-" if x is None else "%d%%" % round(100 * x)
    print("\n| aday | eşik τ | yola giden | yanlış | kesinlik | kapsama | tartışmasız kapsama | makro-F1 | doğruluk | ASCII türev | yazım türev | p50 ms | p95 ms | parametre |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for a, s in karne.items():
        k = s["kapi"]
        print("| %s | %s | %d | %d | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s |" % (
            a, f(s["tau"], 2), k["gidenler"], len(k["yanlis"]), pct(k["precision"]), pct(k["coverage"]),
            pct(s["kapi_tartismasiz"]["coverage"]), f(s["makro_f1"], 2), pct(s["dogruluk"]),
            pct(s["turev_ascii"]), pct(s["turev_yazim"]), f(s["gecikme_p50"]), f(s["gecikme_p95"]),
            "%.0fM" % (s["parametre"] / 1e6) if s["parametre"] else "-"))
    for a, s in karne.items():
        if s["yanlis_yola_giden"]:
            print("\n%s yanlış yola giden: %s" % (a, s["yanlis_yola_giden"]))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("komut", choices=["kalibre", "kos", "puanla"])
    ap.add_argument("aday", nargs="?")
    ap.add_argument("--sadece-onayli", action="store_true")
    a = ap.parse_args()
    if a.komut == "kalibre":
        kalibre()
    elif a.komut == "kos":
        kos(a.aday)
    else:
        puanla(a.sadece_onayli)
