# Tur 4 (b) — canlı köprü (canli_puanla.py)
enjekte: 20 söz | hizmet /dusun: 20 istek | günlük satırı: 44

V1 hizmet söz içeren /dusun aldı: 20/20 (toplam istek 20)
V2 çıkarılan söz birebir: 20/20 (eksik: []) | çoklu-söz içeren istek: 0
V3 hizmet sınıfı == çevrimdışı B0: 20/20 (uyumsuz: [])
V4 enjeksiyon → hizmete varış: p50 3 ms · p95 4 ms · min 2 · max 8 · n=20
V5 günlükte duydum: 20 satır, soz.metin birebir eşleşen: 20/20
V6 uyanış 20 · beden niyeti 0 · LLM çağrısı 0 · hata []
V7 gerçek hafıza özeti 87e8a365087f2099 (önce 87e8a365087f2099) AYNI · gerçek günlük 257451 bayt (önce 257451) AYNI
V8 Orion çıkış kodu 0, süre 69.6 sn (smoke 68 sn)

Söz → hizmet sınıfı (etiket):
  sandalyenin yanına git       → hareket    (b0) hedef=sandalye etiket=hareket ✓
  tahtaya bir şiir yaz         → yaz        (b0) hedef=tahta etiket=yaz ✓
  odada ne var                 → emin_degil (yok) hedef=None etiket=sorgu ·
  günün nasıl geçiyor          → emin_degil (yok) hedef=None etiket=sohbet ·
  sakın oturma                 → emin_degil (yok) hedef=None etiket=emin_degil ✓
  buraya gel                   → emin_degil (b0) hedef=oyuncu etiket=hareket ·
  ayağa kalk                   → emin_degil (yok) hedef=None etiket=hareket ·
  tahtada ne yazıyor           → emin_degil (yok) hedef=tahta etiket=sorgu ·
  iyi akşamlar                 → emin_degil (yok) hedef=None etiket=sohbet ·
  bak                          → emin_degil (yok) hedef=None etiket=emin_degil ✓
  go next to the table         → emin_degil (yok) hedef=masa etiket=hareket ·
  write welcome on the board   → yaz        (b0) hedef=tahta etiket=yaz ✓
  where is the window          → sorgu      (b0) hedef=pencere etiket=sorgu ✓
  how is your day going        → emin_degil (yok) hedef=None etiket=sohbet ·
  do not sit down              → emin_degil (b0) hedef=None etiket=emin_degil ✓
  come over here               → emin_degil (yok) hedef=oyuncu etiket=hareket ·
  get up                       → emin_degil (yok) hedef=None etiket=hareket ·
  what do you see now          → emin_degil (yok) hedef=None etiket=sorgu ·
  good evening                 → emin_degil (yok) hedef=None etiket=sohbet ·
  go                           → emin_degil (yok) hedef=None etiket=emin_degil ✓
doğru sınıf 8/20 | LLM'siz yanlış yola giden 0
