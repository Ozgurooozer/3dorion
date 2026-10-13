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
