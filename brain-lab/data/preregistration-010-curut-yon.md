# Ön-kayıt 010 — Yön çürütme testlerinden sağ çıkıyor mu? (H3B97, KL, KLw yan yana) — Kart 7

**Durum:** Ozyn 2026-10-01: "devam önerilerine göre". Ön-kayıt 009 C1 ve C2 tuttu → sıradaki adım `curut`. Kod değişmedi;
öngörüler koşmadan önce commit'lenir. Test seed'leri (≥ 1001) yok, dondurma yok.

## Soru
Sabırlı eğitimle öğrenilen yön (yemeğin tarafına dönme) gerçek mi: taze deneklerde, CROSS ve LOCAL kontrollerine,
yemek ışını lezyonuna, başka odalara karşı sağ çıkıyor mu? Ve eleştirmenin izi (KL, KLw) aynı taze seed'lerde fark yaratıyor mu?

## Komut
Sırayla, aynı taze seed'ler (11–20 × iki grup = 20 öğrenen her kolda):
`npm run exp -- curut H3B97 --egitim sabirli --isci 5`, aynısı `KL`, `KLw`. Her biri: öğrenen + ikiz + bağlı beden, CROSS,
LOCAL (dopamin 200 tik gecikmeli, aynı bölüm), lezyonlar (yemek ışınları, duvar ışınları, tüm ışınlar, beden duyusu,
hatırlanan duyular, her şey, karıştırma), başka odalar (5 ve 15 yemek, seed 11–15).

## Puanlama (20 denek)
Ortalama + eşleştirilmiş ≥ 14/20 aynı yönde + ortanca aynı yönde; üçü uyarsa ✓, ortalama tutmazsa ✗, ortalama tutup biri
uymazsa belirsiz. "Aynı yönde" sayımı farkın işaretiyle yapılır (eşiksiz); eşikli ölçütler ayrıca yazılır.

## Öngörüler

| # | öngörü | çürütülürse |
|---|---|---|
| F1 | Üç kol da dürtüde CROSS'u ve LOCAL'i geçer (fark > 0) | LOCAL'i geçemeyen kol: yavaş değişkenleri öğreniyor, eylem → sonucu değil |
| F2 | Üç kolda yön bağlı bedeni geçer; ortalama yönlendirme ≥ 0,12 | geçmeyen kolda yön taramaya / doğrulamaya özgü |
| F3 | Yemek ışını lezyonu yönü öldürür: lezyonlu yönlendirme ≤ 0,05 ve dürtü artar (üç kol) | yön yemek görmeden geliyorsa, yemekle ilgili değildir |
| F4 | Başka odalar (5 ve 15 yemek): öğrenen ikizi dürtüde ≥ 8/10 geçer (üç kol) | öğrenilen oda özel |
| F5 | KL − K0 yönlendirme ≥ 0,05 (aynı seed'ler, eşleştirilmiş) — **güvenim düşük** (doğrulamada belirsiz) | eleştirmen izi yöne katkı yapmıyor |
| F6 | KLw'de beden duyusu (proprio) lezyonu, KL'dekinden daha az zarar verir (dürtü artışı daha küçük) | hareket-kör eleştirmen aktörün proprio'ya dayanmasını değiştirmiyor |

## Dur kuralı
Çökme → dur. Olumlu iddia yalnız F1–F3'ten sağ çıkan kol için: "bu testlerden sağ çıktı".
