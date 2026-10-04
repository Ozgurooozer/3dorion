# Ölçüm karnesi — göz ve mekânsal bellek (spec 15)

Ön kayıt: `docs/specs/15-goz-ve-mekan-bellegi.md` §4 (ilk sürüm sha256 `473e3de5ed2750be`, sapma kaydı sonrası `1fab17c3c017cba3`).
Koşu: Node saf test, LLM/ağ yok. Komut: `node --experimental-strip-types --import ./tools/babylon-cozucu.mjs --test world/player/gorunurluk.test.ts`.

## S1 — Koşu 1 (çekirdek kuralı: yalnız nesne MERKEZİNE ışın) 2026-10-04

| # | öngörü | sonuç | etiket |
|---|---|---|---|
| P1 | belirsiz olmayan her çiftte referansla aynı | **DOĞRU.** 40 görünüm × 14 nesne = 560 çift: 464 belirsiz olmayan çiftte **0 ayrışma**; 96 çift belirsiz (kısmi örtülme); 560 koni karşılaştırmasında 0 ayrışma | [ÖLÇÜLDÜ] |
| P2 | 60 nesnede p95 ≤ 1 ms | **DOĞRU.** p50 0,046 / p95 **0,099** / p99 0,133 ms (3000 tarama) | [ÖLÇÜLDÜ] |
| P4 | kayıt bekçisi (sapma kaydıyla yeniden okundu) | **DOĞRU.** kimlikler = çapalı kutular ∪ {raf, berjer, yığın, 2 lamba}; adlar `CAPA_ETIKETLERI`'nden; raf/berjer/yığın kutuları `KATI_YUZEYLER` ile aynı referans | [TEST] |
| P3 | mutasyon ≥ %90 | **henüz koşulmadı** (nihai çekirdek üzerinde koşulacak) | — |

### Ön kayıtta olmayan bulgu (temel doğruluk testi yakaladı)

Benim "oda ortasından masaya bakınca masa görünür" beklentim **tuttu değil**: çekirdek `masa: görünmez` dedi.
Sebep gerçek geometri: masa kutusunun merkezi y=0,38'de (kutunun içinde) ve doğrudan önündeki sandalye (üst y=0,9)
o merkez doğrusunu kesiyor; oysa masanın üstü ve bir kısmı apaçık görünüyor. P1 bunu yakalamadı çünkü P1 yalnız
belirsiz OLMAYAN çiftleri karşılaştırıyor: bu çift referansta **belirsiz** (9 örnek ayrışıyor), 96 belirsiz çiftten biri.
**Yorum:** çekirdek kendi kuralına göre doğru, ama kuralın kendisi ürün için zayıf (560 çiftin %17'si belirsiz,
yani Orion bunları sistematik olarak yanlış/eksik söyleyebilir). Bu P1'in çürütülmesi değil; kuralın sınırının ölçümü.

## S1b — Koşu 2: kural düzeltmesi (YENİ ön kayıt, koşudan ÖNCE yazıldı)

Değişiklik: nesne, **9 örnek noktasından (merkez + 8 köşe, merkeze %10 çekilmiş) en az biri açıksa görünür**;
merkez kapalı ama başka nokta açıksa `kismen: true`. Merkez önce denenir, açıksa erken çıkılır (maliyet).
Referans aynı 9 noktada marş yöntemiyle "en az biri açık" hesaplar (bağımsızlık korunur). Eşikler değişmez; yeni maddeler:

| # | öngörü | olasılık | çürütücü |
|---|---|---|---|
| P1b | 560 çiftin **TAMAMINDA** (belirsizlik ayrımı yok) `gorunur` referansın "en az biri açık"ına eşit; `kismen` = (merkez kapalı ∧ gorunur) | %80 | tek ayrışma |
| P2b | 60 nesnede p95 ≤ 1 ms | %80 (erken çıkış sayesinde; en kötü durum 9× ışın) | p95 > 1 ms |
| P5b | oda ortasından masaya bakışta `masa` görünür (temel doğruluk beklentisi) | %90 | görünmez |
| P3 | mutasyon ≥ %90 (nihai çekirdek üzerinde) | %75 | < %90 |

Dürüstlük notu: bu düzeltme P1 geçtikten SONRA, ürün açısından bir zayıflık görülünce yapıldı; koşu 1 sonucu
yukarıda aynen kalır. Kuralı P1b'yi geçirmek için değil, P5b'deki gerçek zayıflığı gidermek için değiştiriyorum.

## S1b — Koşu 2 sonucu (9 örnek nokta kuralı) 2026-10-04

| # | öngörü | sonuç | etiket |
|---|---|---|---|
| P1b | 560 çiftin tamamı referansla aynı | **DOĞRU.** 560/560 çift, 0 ayrışma (96 çift kısmi örtülmeli); `kismen` bayrağı da 560/560 eşit; koni 560/560 | [ÖLÇÜLDÜ] |
| P2b | 60 nesnede p95 ≤ 1 ms | **DOĞRU.** p50 0,051 / p95 **0,103** / p99 0,148 ms | [ÖLÇÜLDÜ] |
| P5b | oda ortasından masa görünür | **DOĞRU** (merkez örtülü olsa da) | [TEST] |
| P3 | mutasyon ≥ %90 | **YANLIŞ. 7/16 = %44.** Yakalananlar: M3 (okluzyon yok), M5 (erken çıkış ters), M6 (kismen bayrağı), M7, M11 (sıfır bakışta koni), M12 (göz yüksekliği), M16 (ad kaynağı). Kaçanlar: M1, M2, M4, M8, M9, M10, M13, M14, M15 | [ÖLÇÜLDÜ] |

Kaçan mutantların analizi (testler EKLENMEDEN önce yazıldı):
- **M2 (kendi kutusu engel):** DENK mutant. Varış mesafesi `varis ≤ kendi kutusuna ilk giriş`, dolayısıyla kendi kutusu `t < varis − EPS` koşuluna hiçbir zaman giremez; atlama satırı gereksiz. Satır silindi (basitleştirme).
- **M1 (`<=` → `<`):** yalnız reel sayı eşitliğinde fark eder; `koniYarim` parametresiyle tam 90°'de (kos=0) test edilebilir.
- **M4 (köşe oranı 1,0):** gerçek geometride ayırt eden bir durum kuramadım; yüzeye teğet örnek noktanın ışını bitiş noktasında kesiştiği için `t < varis − EPS` her iki oranda aynı. Kaçmış olarak kalır.
- **M8, M9, M10, M13, M14, M15:** gerçek test boşlukları (mesafe XZ mi, nesnenin içindeki engel, tek taraflı örtülme, türler, kutu boyutları, berjer/yığın konumu). Hedefli test eklenir.

## S1b — Koşu 3: test boşlukları kapatıldıktan sonra mutasyon (aynı eşik, ≥ %90)

Ön kayıt (koşudan önce): M2 çıkarıldı (denk, satır silindi), 15 mutant. Eklenen testlerle M1, M8, M9, M10, M13, M14, M15 yakalanmalı (öngörü %80: hepsi); M4 kalmalı. Beklenen 14/15 = %93. Çürütücü: < %90 (yani ≥ 2 kaçan daha).

### Koşu 3 sonucu (2026-10-04)

| # | öngörü | sonuç | etiket |
|---|---|---|---|
| P3 | 14/15 = %93 (M4 kalır), eşik ≥ %90 | **DOĞRU.** 14/15 = **%93**, kaçan yalnız M4 (köşe oranı 1,0), öngörüyle aynı | [ÖLÇÜLDÜ] |

Özet — **S1 kapandı.** P1b, P2b, P4, P5b doğru; P3 ilk koşuda YANLIŞ (%44) çıktı, kaçanlar analiz edilip testler eklendikten sonra %93.
Kapılar: `tsc` 0; `tools/mimari.test.ts` + `world/bagimlilik.test.ts` + `capalar.test.ts` 28/28; `npm test` **2343/2343** (öncesi 2331 + 12 yeni).
Bilinen sınırlar: (1) M4 ayırt edilemedi; (2) kayıt 14 nesne, P2 maliyeti 46 SENTETİK nesneyle ölçüldü (gerçek 60 nesneli oda yok); (3) görünürlük yalnız AABB kutularına karşı, dönük eşya (ADMIN, berjer) ışın ikizi gibi kutuyla yaklaşık.
Bir sonraki dilim: S2 (mekanBellegi, gölge) — ön kayıt `docs/specs/15-…md` §4 P5–P10; koşudan önce yeniden okunacak.
