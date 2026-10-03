# veri_kur.py — fixtures/soz/etiketli.json'u kurar (söz -> yol etiketi).
#
# Üç kaynak, bilerek ayrı işaretli:
#   gercek    Ozyn'in gerçekten söylediği söz (karar kaydı + fixtures/eylem/komutlar.json). TEST SETİ
#             YALNIZ bunlardan oluşur. Etiketi ben öneririm; `onay: false` kalır, Ozyn onaylayınca
#             true olur — onaysız örnek ölçüme girmez (olc.py denetler).
#   uretilmis Benim yazdığım örnek ya da bir gerçek sözün türevi (ASCII-Türkçe, yazım hatası).
#             Yalnız eğitim/bellek tarafında; test setine ASLA girmez. Türevler kaynağıyla AYNI
#             `grup`ta: çapraz doğrulamada bir grup bölünmez, yoksa sızıntı olur.
#
# Sınıflar (yol temelli, plan: docs/olcum-soz-siniflandirma.md):
#   hareket  beden eylemi: git/otur/kalk/dur/bak/odaklan (LLM'siz beceri refleksine gidebilir)
#   yaz      tahta/terminal yazımı (yakınlık + onay kapısı; LLM'de kalır)
#   sorgu    algıyı sor: ne görüyorsun, neredeyim (algı hizmeti)
#   sohbet   LLM
#   emin_degil  bileşik, belirsiz hedef, olumsuz, bağlama bağlı -> LLM'e düş
#
# Kullanım: python tools/soz-siniflandirma/veri_kur.py   (fixtures/soz/etiketli.json'u yeniden yazar)
import json
import os
import random
import sys

AYNI_KLASOR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AYNI_KLASOR)
import veri_cikar  # noqa: E402

KOK = os.path.dirname(os.path.dirname(AYNI_KLASOR))
CIKTI = os.path.join(KOK, "fixtures", "soz", "etiketli.json")
SINIFLAR = ["hareket", "yaz", "sorgu", "sohbet", "emin_degil"]

# (etiket, hedef, not). Hedef = çapa (masa/tahta/pencere/sandalye/monitor/oyuncu) ya da None.
# GERÇEK sözlerin ÖNERİLEN etiketleri: zayıf etiket (LLM'in verdiği araç) değil, sözün anlamı.
# Tartışmalı olanlar `not` ile işaretli; Ozyn onayında bunlara bakılır.
GERCEK = {
    # --- hareket ---
    "bana gel": ("hareket", "oyuncu", ""),
    "yanıma gel": ("hareket", "oyuncu", ""),
    "tahtaya git": ("hareket", "tahta", ""),
    "masaya git": ("hareket", "masa", ""),
    "pencereye git": ("hareket", "pencere", ""),
    "pencereye bak": ("hareket", "pencere", "bak de hareket sayıldı: beden niyeti"),
    "bilgisayara git": ("hareket", "monitor", "hedef monitör varsayıldı (spec 13: bilgisayar = odaklan monitor)"),
    "otur": ("hareket", None, ""),
    "kalk": ("hareket", None, ""),
    "can you go tahta": ("hareket", "tahta", "karışık dil"),
    "önündeki bilgisayarı aç": ("hareket", "monitor", "spec 13: odaklan monitor"),
    "önündeki bilgisayari aç": ("hareket", "monitor", "ASCII karışık yazım"),
    "open the monitor": ("hareket", "monitor", ""),
    "bilgisayari kullan": ("hareket", "monitor", "kullan = odaklan varsayıldı, TARTIŞMALI"),
    "başka bir yere git": ("emin_degil", None, "hedef belirsiz (hangi yer?)"),
    "sırayla odada gezin": ("emin_degil", None, "çok hedefli, belirsiz"),
    "tahtayi kullan": ("emin_degil", "tahta", "kullan = git mi yaz mı? TARTIŞMALI"),
    "tahtyi kullan": ("emin_degil", "tahta", "aynı, yazım hatalı"),
    "use that": ("emin_degil", None, "'that' bağlama bağlı"),
    "masaya git ve otur": ("emin_degil", None, "bileşik (plan: şimdilik LLM'e düşer; spec 13 zincir ister)"),
    # --- yaz ---
    "tahtaya yaz": ("yaz", "tahta", ""),
    "tahtaya adını yaz": ("yaz", "tahta", ""),
    "tahtaya yazı yaz": ("yaz", "tahta", ""),
    "adını yaz tahtaya": ("yaz", "tahta", ""),
    "beyaz tahtaya adını yaz": ("yaz", "tahta", ""),
    "beyaz tahtaya yaz": ("yaz", "tahta", ""),
    "tahtaya merhaba yaz": ("yaz", "tahta", ""),
    "tahtaya basit bir matematik formülü yaz": ("yaz", "tahta", ""),
    "bide quantum formülü yaz sen yaz": ("yaz", "tahta", "hedef örtük (tahta)"),
    "serbet düşüncelerini yaz şimdi": ("yaz", "tahta", "hedef örtük, 'serbest' yazım hatası"),
    "birseyler yaz": ("yaz", "tahta", "hedef örtük"),
    "write sometings": ("yaz", "tahta", "hedef örtük, yazım hatası"),
    "write your name": ("yaz", "tahta", "hedef örtük"),
    "write": ("emin_degil", None, "tek sözcük, bağlamsız"),
    "yeniden sorgula": ("emin_degil", None, "ne sorgulanacak? bağlama bağlı"),
    # --- sorgu ---
    "ne görüyorsun": ("sorgu", None, ""),
    "ner görüyorsun": ("sorgu", None, "yazım hatası"),
    "karşında ne var?": ("sorgu", None, ""),
    "odada başka neler var": ("sorgu", None, ""),
    "ben neredeyim": ("sorgu", None, ""),
    "masa nerede": ("sorgu", None, ""),
    "neredesin konumun ne": ("sorgu", None, ""),
    "what u seeing": ("sorgu", None, ""),
    "whats on the screen": ("sorgu", None, "ekran = monitör olabilir, TARTIŞMALI"),
    # --- sohbet ---
    "merhaba": ("sohbet", None, ""),
    "hello": ("sohbet", None, ""),
    "ee": ("sohbet", None, ""),
    "naber": ("sohbet", None, ""),
    "how are you": ("sohbet", None, ""),
    "nasilsin": ("sohbet", None, ""),
    "nasilsin orion": ("sohbet", None, ""),
    "merhaba goca de": ("sohbet", None, ""),
    "ne oldu?": ("sohbet", None, ""),
    "ne yapıyorsun": ("sohbet", None, "durum sorusu, algı değil"),
    "what u want to do": ("sohbet", None, ""),
    "what u want to do now?": ("sohbet", None, ""),
    "neler yapabilirsin": ("sohbet", None, "yetenek sorusu"),
    "az önce neredeydin şimdi neredesin": ("sohbet", None, "geçmişe bağlı"),
    "bareber yapıcaz onu": ("sohbet", None, "'beraber yapıcaz onu'"),
    "konuş bakalim sırpça": ("sohbet", None, ""),
    "sirpça biliyormusun?=": ("sohbet", None, ""),
    "sen seç": ("sohbet", None, ""),
    "reflexlerine bak": ("sohbet", None, "meta: kendi refleksleri, beden eylemi değil"),
    "uyan": ("sohbet", None, ""),
    "wanna see the city one day?": ("sohbet", None, ""),
    "şehri görmek istermisin?": ("sohbet", None, ""),
    "hareket edebilirsimin": ("sohbet", None, "yetenek sorusu, komut değil"),
    "hareket edemiyorsun gibi": ("sohbet", None, ""),
    "can you use computer": ("sohbet", None, "yetenek sorusu"),
    "can you able to use this": ("sohbet", None, "yetenek sorusu"),
    "you aldread there good. can you use now terminal": ("emin_degil", None, "karışık: yorum + yetenek/komut"),
}

# Benim yazdığım tohumlar: (söz, etiket, hedef). Gerçek sözlerin kapsamadığı yönler: İngilizce,
# eş anlamlılar, yetenek-sorusu/olumsuz zor vakalar (komut gibi görünüp komut OLMAYANLAR).
URETILMIS = [
    # hareket
    ("dur", "hareket", None), ("dur orada", "hareket", None), ("otur lütfen", "hareket", None),
    ("kalk ayağa", "hareket", None), ("sandalyeye otur", "hareket", "sandalye"),
    ("masaya yürü", "hareket", "masa"), ("pencerenin yanına git", "hareket", "pencere"),
    ("tahtanın yanına git", "hareket", "tahta"), ("yanıma doğru gel", "hareket", "oyuncu"),
    ("sandalyeye git", "hareket", "sandalye"), ("monitöre bak", "hareket", "monitor"),
    ("bilgisayarı aç", "hareket", "monitor"), ("go to the table", "hareket", "masa"),
    ("go to the board", "hareket", "tahta"), ("sit down", "hareket", None),
    ("stand up", "hareket", None), ("come here", "hareket", "oyuncu"), ("come to me", "hareket", "oyuncu"),
    ("look at the window", "hareket", "pencere"), ("walk to the window", "hareket", "pencere"),
    ("open the computer", "hareket", "monitor"), ("stop", "hareket", None),
    # yaz
    ("tahtaya selam yaz", "yaz", "tahta"), ("tahtaya adını yaz", "yaz", "tahta"),
    ("tahtayı temizle", "yaz", "tahta"), ("tahtaya bugünün tarihini yaz", "yaz", "tahta"),
    ("write hello on the board", "yaz", "tahta"), ("write your name on the board", "yaz", "tahta"),
    ("clear the board", "yaz", "tahta"), ("terminale npm test yaz", "yaz", None),
    ("npm test çalıştır", "yaz", None), ("run npm test", "yaz", None),
    ("git status çalıştır", "yaz", None), ("terminalde ls yaz", "yaz", None),
    # sorgu
    ("etrafta ne var", "sorgu", None), ("yakında ne var", "sorgu", None),
    ("önünde ne var", "sorgu", None), ("neredesin", "sorgu", None), ("ben nerede duruyorum", "sorgu", None),
    ("neyi görüyorsun", "sorgu", None), ("what do you see", "sorgu", None),
    ("what is in front of you", "sorgu", None), ("what's around", "sorgu", None),
    ("where am i", "sorgu", None), ("where is the table", "sorgu", None),
    # sohbet
    ("günaydın", "sohbet", None), ("iyi geceler", "sohbet", None), ("teşekkürler", "sohbet", None),
    ("sen kimsin", "sohbet", None), ("adın ne", "sohbet", None), ("bugün nasılsın", "sohbet", None),
    ("bana bir fıkra anlat", "sohbet", None), ("hava nasıl", "sohbet", None),
    ("good morning", "sohbet", None), ("thanks", "sohbet", None), ("who are you", "sohbet", None),
    ("what is your name", "sohbet", None), ("tell me a joke", "sohbet", None),
    ("how is the weather", "sohbet", None), ("seni seviyorum", "sohbet", None),
    ("oturabilir misin?", "sohbet", None), ("tahtaya yazabilir misin?", "sohbet", None),
    ("can you sit?", "sohbet", None), ("can you write on the board?", "sohbet", None),
    ("neden oturmuyorsun", "sohbet", None), ("masaya neden gitmedin", "sohbet", None),
    # emin_degil: olumsuz, belirsiz hedef, bileşik, bağlamsız
    ("oturma", "emin_degil", None), ("kalkma", "emin_degil", None), ("gitme", "emin_degil", None),
    ("don't sit", "emin_degil", None), ("do not go there", "emin_degil", None),
    ("oraya git", "emin_degil", None), ("şuna bak", "emin_degil", None), ("bunu yap", "emin_degil", None),
    ("go there", "emin_degil", None), ("do that", "emin_degil", None),
    ("otur ve tahtaya yaz", "emin_degil", None), ("pencereye git ve bak", "emin_degil", None),
    ("kalk ve masaya git", "emin_degil", None), ("go to the table and sit", "emin_degil", None),
    ("şunu aç", "emin_degil", None), ("devam", "emin_degil", None),
]

ASCII = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")


def ascii_katla(s):
    return s.translate(ASCII)


def yazim_hatasi(s, rnd):
    """Tek, deterministik yazım hatası: ≥4 harfli bir sözcükte komşu harf takası ya da harf düşürme."""
    sozcukler = s.split(" ")
    aday = [i for i, w in enumerate(sozcukler) if len(w) >= 4]
    if not aday:
        return s
    i = rnd.choice(aday)
    w = sozcukler[i]
    j = rnd.randrange(1, len(w) - 2)
    sozcukler[i] = w[:j] + w[j + 1] + w[j] + w[j + 2:] if rnd.random() < 0.5 else w[:j] + w[j + 1:]
    return " ".join(sozcukler)


def turevler(soz, grup):
    """Kaynak sözün türevleri: ASCII-Türkçe (kaynaktan farklıysa) ve bir yazım hatalı sürüm."""
    rnd = random.Random(grup)
    cikti = []
    a = ascii_katla(soz)
    if a != soz:
        cikti.append(a)
    y = yazim_hatasi(soz, rnd)
    if y != soz and y not in cikti:
        cikti.append(y)
    return cikti


def main():
    algilar, _ = veri_cikar.oku()
    gercek_sozler = {" ".join(m.split()) for (m, _g) in algilar.values()}  # çift boşluk = aynı söz
    # komutlar.json'daki sözler de Ozyn'in gerçek sözleri (2026-10-02 ortak test).
    fx = json.load(open(os.path.join(KOK, "fixtures", "eylem", "komutlar.json"), encoding="utf-8"))
    gercek_sozler |= {k["soz"].strip() for k in fx["komutlar"]}

    etiketsiz = sorted(gercek_sozler - GERCEK.keys())
    fazla = sorted(GERCEK.keys() - gercek_sozler)
    if etiketsiz or fazla:
        sys.exit("etiketsiz gerçek söz: %s\nkayıtta olmayan etiket: %s" % (etiketsiz, fazla))

    ornekler, n = [], 0

    def ekle(soz, etiket, hedef, kaynak, grup, onay, not_=""):
        nonlocal n
        n += 1
        ornekler.append({"id": "s%03d" % n, "soz": soz, "etiket": etiket, "hedef": hedef,
                         "kaynak": kaynak, "grup": grup, "onay": onay, "not": not_})

    gi = 0
    for soz in sorted(GERCEK):
        gi += 1
        etiket, hedef, not_ = GERCEK[soz]
        grup = "g%03d" % gi
        ekle(soz, etiket, hedef, "gercek", grup, False, not_)
        for t in turevler(soz, grup):
            ekle(t, etiket, hedef, "uretilmis", grup, True, "gerçek sözün türevi")
    for soz, etiket, hedef in URETILMIS:
        gi += 1
        grup = "g%03d" % gi
        ekle(soz, etiket, hedef, "uretilmis", grup, True)
        for t in turevler(soz, grup):
            ekle(t, etiket, hedef, "uretilmis", grup, True, "türev")

    os.makedirs(os.path.dirname(CIKTI), exist_ok=True)
    belge = {
        "surum": 1,
        "aciklama": "Söz -> yol etiketi (plan: docs/olcum-soz-siniflandirma.md). Test seti YALNIZ kaynak=gercek ve "
                    "onay=true örneklerden; uretilmis örnekler eğitim/bellek içindir. Grup = bölünmez birim.",
        "siniflar": SINIFLAR,
        "ornekler": ornekler,
    }
    with open(CIKTI, "w", encoding="utf-8") as fh:
        json.dump(belge, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    from collections import Counter
    c = Counter((o["kaynak"], o["etiket"]) for o in ornekler)
    print("yazıldı:", CIKTI, "| toplam", len(ornekler), "| gerçek", sum(1 for o in ornekler if o["kaynak"] == "gercek"))
    for k in ("gercek", "uretilmis"):
        print(" ", k, {e: c[(k, e)] for e in SINIFLAR})


if __name__ == "__main__":
    main()
