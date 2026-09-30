# Ön-kayıt 008 — Eleştirmen hareketi değil durumu yargılasın — Kart 5

**Durum:** Ozyn 2026-09-30: "Dönmek neden ceza versin ki?" → öneri (eleştirmen bedenin kendi hareketini görmesin) "beğendim".
Kod bitti; öngörüler koşmadan önce commit'lenir. Test seed'leri (≥ 1001) yok, dondurma yok.

## Neden
δ teşhisi (defter 2026-09-30, `delta-teshis.ts`): izli kollarda δ yemeğe doğru ve öbür yana dönüşü ayırt etmiyor, **her
dönüşü** cezalandırıp düz gitmeyi ödüllendiriyor (KL: dönüşten sonra −0,004, dönmeden +0,0015). Dünyada dönmek enerji
harcamıyor; ceza eleştirmenden: dönme duyusuna negatif değer (KL −0,006; KLN −0,024), açken ileri gitmeye büyük pozitif değer
(KLN need*proprio.forward 0,185). Eleştirmen durumu değil hareketi yargılıyor. KL'nin yön kazancının bir kısmı "gereksiz
dönüşün bastırılması" olabilir (öbür yana dönüş 563 → 230).

## Değişiklik (`[TEST]`)
`critic: { proprio: false }`: eleştirmen `proprio.*` (ve "need" ile `need*proprio.*`) özelliklerini görmez. Yoksa bugünkü gibi.
2 test + ret testi, bozma 3/3; kapalıyken `regression-check H3B97 2` aynı; tam `npm test` 2031/2031.

## Kollar (sabırlı, seed 1–5 × iki grup, kıt oda; kıyas kendi kaydıyla, aynı seed ve grup)

| kod | ne | kıyas (kayıtlı, Kart 4) |
|---|---|---|
| KLw | KL + hareket-kör eleştirmen | KL: yönlendirme 0,265 · dürtü 0,078 · δ farkı (dönmeden − dönüş ortalaması) 0,0057 |
| KLNw | KLN + hareket-kör eleştirmen | KLN: 0,181 · 0,111 · 0,0076 · önde yemek açken 0,045 |

Komut: `npm run exp -- tara KLw KLNw --egitim sabirli --isci 5`. Ölçüler: `results.jsonl`, `kredi-teshis.ts`,
`delta-teshis.ts`, `yon-teshis.ts` (patient).

## Puanlama
Ortalama ölçütü + eşleştirilmiş (kendi kıyas kolu ya da K0'a karşı, aynı seed/grup) ≥ 7/10 aynı yönde + ortanca aynı yönde;
üçü uyarsa ✓, ortalama tutmazsa ✗, ortalama tutup biri uymazsa **belirsiz**.

## Öngörüler

| # | öngörü | çürütülürse |
|---|---|---|
| P1 | Mekanizma: δ farkı (dönmeden − dönüş ortalaması) KLw ≤ 0,0019 ve KLNw ≤ 0,0025 (kayıtlı kolların üçte biri) | büyük kalırsa: dönüş cezası başka bir özellikten geliyor |
| P2 | KL'nin yönü dönüş cezasındandı: KLw yönlendirme ≤ 0,185 (KL − 0,08) | KLw ≥ KL − 0,08: iz yönü ceza olmadan da veriyor |
| P3 | KLN'nin yemek değeri yönü taşır: KLNw yönlendirme ≥ 0,147 (K0 + 0,05) | < 0,147: yön büyük ölçüde dönüş cezasındandı |
| P4 | Eleştirmen yemeği hâlâ değerli bulur: KLNw önde yemek açken ≥ 0,03, açken − tokken ≥ 0,02 | hareket özellikleri yemek değerini taşıyormuş |
| P5 | Yan ayrımı δ'da görünür: KLNw'de yemeğe doğru dönüşten sonraki δ öbür yanadan büyük, ≥ 7/10 öğrenen | ayırt etmiyorsa: yön kredisi δ'dan değil izlerin zamanlamasından |
| P6 | Zarar yok: KLNw dürtü ≤ 0,166 (K0 + 0,05) | > 0,166: hareketi değerlemek aramaya yarıyordu |

## Dur kuralı
Çökme → dur. Yalnız tarama; olumlu iddiadan önce doğrulama (20 + CROSS) ve `curut`.
