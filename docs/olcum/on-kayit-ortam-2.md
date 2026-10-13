# Ön kayıt 2 — `dunya_ortam` düzeltmesi (2026-10-13, koşudan ÖNCE)

## Birinci koşunun sonucu: H-O1 KALDI (`docs/olcum/f0-ortam-dis.jsonl`)
Haiku, `fixtures/f0/ortam.json`, n=3: **0/24** (ön kayıt: ≥ 18/24). Ham nedenler (24 denemenin dökümü):
- **12/24** model niyeti doğru ama sayıyı `deger`e koydu (`ne:"saat", deger:18`) — `sayi` alanına değil. Doğrulayıcı
  "deger metin olmalı" diyip reddetti. Kusur araç şemasının (iki alan, `deger` açıklaması ad listesi verdi) ve katı
  doğrulayıcının ortak kusuru; model ne istediğini açıkça yazmıştı.
- **9/24** araç hiç çağrılmadı: `sor`/`git` ya da Ozyn'e soru ("Neyi çizgi film gibi yapmalı?", "Işık ekleyelim mi?") —
  araç ne zaman kullanılacağı konusunda yeterince yönlendirmiyor; konuşma talimatının "DO something" listesinde de yok.
- **3/24** uydurma değer (`isik: "yumusak"`, `"sichak"`, `renk: "sarkı"`, `stil: "çizgi film"`). Canlıda bu `hata`
  sonucuyla beyni bir kez daha uyandırır ve metin geçerli seçenekleri sayar (kendini düzeltme şansı); f0 tek atış olduğu
  için bunu GÖRMEZ — sayıya göre kötümser.
H-O2/H-O3 bu yapılandırmada ÖLÇÜLMEDİ (araç açıklaması değişeceği için son yapılandırmada ölçülecek).

## Düzeltme (3 değişiklik, ölçümün gösterdiği nedenlere birebir)
- **R1 doğrulayıcı hoşgörüsü** (`protocol/dogrula.ts`): sayı `deger`de gelirse `sayi`ya taşınır; `sayi` sayı-metniyse
  ("21") sayıya çevrilir. Açık `deger` sayısı + `sayi` birlikte gelirse belirsizlik: HATA. Uydurma AD hoşgörüye girmez.
- **R2 araç şeması** (`bridge/araclar.ts`): açıklamaya ne zaman hangi konu ("too dark → isik ac; too bright → isik kis;
  evening/night/day or an hour → saat; cartoon/anime look → stil; fog → sis"); `deger` "A short NAME, never a number";
  `sayi` "A NUMBER … saat: the hour 0-24 (e.g. 21)". Maliyet: ~+60 token (bütçe testi 1650).
- **R3 konuşma talimatı** (`bridge/talimat.ts`): mevcut "DO something" cümlesine "change the light or time of day outside"
  eklendi; "that body tool" → "that tool". Yeni satır yok, araç adı sıralaması YOK (spec 26: zayıf modelde ters teper).

## Ölçüm (YENİ set: `fixtures/f0/ortam2.json`, 8 ifade, ayarlamada kullanılmadı; sözlük hiçbirini sahiplenmiyor — doğrulanır)
- **H-O1b (yapabiliyor mu).** Haiku n=3 → **≥ 18/24**. (İlk set de tekrar koşulur ama BİLGİ: o set kusurları gösterdi, ayarlamada
  görüldü; kapı değil.) Yerel modeller (gemma4:e2b, qwen2.5:7b, ornith-32k): BİLGİ.
- **H-O2 (zarar vermiyor), eskisiyle AYNI.** Mevcut 28 senaryo, araç VAR (yeni yapılandırma) ≥ araç YOK (`--cikar=dunya_ortam`,
  aynı talimat) − `izin` (%5 yukarı yuvarlanmış: n=2 → 56'da 3; ornith n=1 → 28'de 2). Haiku n=2, gemma4:e2b n=2, qwen2.5:7b n=2,
  ornith-32k n=1. NOT: talimat değişikliği (R3) her iki kolda da var; "araç yok" kolu aracı çıkarır, talimat farkını ölçmez —
  talimat etkisi için ayrıca aynı koşu eski talimatla (git stash'siz: `fixtures`ta `--talimat-eski` yok) YAPILMAZ; sınır olarak yazılır.
- **H-O3 (gereksiz çağrı).** Gerileme setinde `dunya_ortam` çağrılan deneme ≤ **%3**.
- **Karar kuralı (değişmedi).** H-O2 bir modelde geçmezse o modelden araç çıkarılır; H-O3 geçmezse açıklama sıkılaşır; H-O1b
  geçmezse DURUR, olumsuz sonuç yazılır (üçüncü bir düzeltme için yeni Ozyn onayı).

**Sınırlar (önceden).** n küçük; setleri ben yazdım; yerel modeller bilgi amaçlı; f0 tek atış (canlıdaki kendini düzeltme yok).

## SONUÇLAR (koşudan sonra eklendi)
- **H-O1b KALDI:** Haiku `ortam2` **9/24** (ölçüt ≥ 18). Nedenler: uydurma ad ("pembe", "anime", "none", "kısık") ~14/24;
  p5'te sayı hâlâ `deger`de (2/3) — f0 puanı HAM çağrıya baktığı için hoşgörüden sonra doğru çalışan çağrıyı da kaldırıyor
  (normalleştirilmiş puanla ~11/24; yine ölçütün çok altında, sonuç değişmez). Yerel (BİLGİ): gemma4:e2b 6/24, qwen2.5:7b 2/24, ornith-32k 2/24.
- **H-O2 GEÇTİ (hepsi):** araç VAR / YOK — Haiku 40/39 · gemma4:e2b 36/39 (düşüş 3 = izin sınırı, kenarda) · qwen2.5:7b 36/31 ·
  ornith-32k 18/16 (n=1). Not: "YOK" kolu aracı çıkarır, talimat değişikliğini (R3) ayırmaz.
- **H-O3 GEÇTİ:** gerileme setinde `dunya_ortam` çağrısı: Haiku 0/56, gemma 0/56, ornith 0/28, qwen 1/56 (%1,8; ölçüt ≤ %3).
- **Karar kuralı gereği DURULDU:** üçüncü düzeltme (eş anlamlı değer tablosu: "anime"→anime90, "kısık"→kıs, "pembe"→pastel…) Ozyn'in onayını bekliyor.
- **Canlı (`ortamdene`, Haiku, dist) 16/16:** aynı Haiku, tek atış, serbest ifade "burası çok karanlık" → `isik ac`, söz öğrenildi, ikinci sefer
  token'sız (`docs/olcum/ortamdene-canli-haiku.jsonl`). f0 tek atış (canlıda hata sonucu modeli düzeltmeye çağırır) ve n çok küçük:
  ikisi çelişmiyor, ama "LLM yolu güvenilir" DENEMEZ.
