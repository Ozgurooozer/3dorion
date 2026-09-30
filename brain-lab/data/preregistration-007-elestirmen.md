# Ön-kayıt 007 — Eleştirmen yemeği değerli bulsun (TASARIM-009 Aşama 4) — Kart 4

**Durum:** Ozyn 2026-09-30'da onayladı ("Onay, ikisini de kodla"). Kod bitti; öngörüler koşmadan önce commit'lenir. Test
seed'leri (≥ 1001) yok, dondurma yok.

## Neden
Kredi teşhisi (defter 2026-09-30): dönüş sinapslarındaki pozitif değişimin %89'u yemek anında yazılıyor (bitişiklik). Yemeğin
öbür yanına dönüş, yemeğe doğru dönüşün aldığı ödülün üçte ikisini alıyor. Eleştirmen yemeği görmeye değer vermiyor. Kök
neden 2026-09-26'da ölçülmüştü: temsil (değer açlığa bağlı, doğrusal eleştirmen ortalamayı öğreniyor) ve kural (TD(0)).

## Değişiklik (`[TEST]`)
- **4a** `critic: { lambda: 0.9 }`: özellik başına iz e ← γλ·e + x, w ← w + α·δ·e, bölüm başında sıfır.
- **4b** `critic: { features: "need" }`: her duyu × açlık (`need*<duyu>`; sabit terim ve açlığın kendisi hariç).
- `learning/critic-stage4.test.ts` 8 test (bozma 9/9); `experiments/stage4.test.ts`; `kredi-teshis.ts` `foodWorth` (6. test).
- Kapalıyken bit-birebir: `regression-check.ts H3B97 2` iki denek kayıtla aynı; tam `npm test` 2023/2023.

## Kollar (sabırlı eğitim, seed 1–5 × iki grup, 10 değerlendirme bölümü, kıt oda)

| kod | eleştirmen | taban değerleri (K0) |
|---|---|---|
| K0 = H3B97 (kayıtlı, sabırlı) | TD(0), doğrusal | dürtü 0,116 · hayatta 0,88 · yönlendirme 0,097 · yemek anındaki pozitif pay 0,889 · o yana / öbür yana 2,02 · önde yemeğin değeri açken 0,007, tokken 0,007 |
| KL | TD(λ 0,9) | |
| KN | ihtiyaç özellikleri | |
| KLN | ikisi | |

Komut: `npm run exp -- tara KL KN KLN --egitim sabirli --isci 5`. Ölçüler: `kredi-teshis.ts patient KL KN KLN H3B97`,
`yon-teshis.ts patient …` (yan taraması dahil), birincil ölçüler `results.jsonl`'den.

## Puanlama
Ortalama ölçütü + eşleştirilmiş sayım (aynı seed ve grup, K0'a karşı) ≥ 7/10 aynı yönde + ortanca aynı yönde; üçü uyarsa ✓,
ortalama ölçütü tutmazsa ✗, ortalama tutup öbürlerinden biri uymazsa **belirsiz**.

## Öngörüler

| # | öngörü | çürütülürse |
|---|---|---|
| P1 | Eleştirmen yemeği değerli bulur: KN ve KLN'de önde yemeğin değeri açken ≥ 0,03 ve açken − tokken ≥ 0,02; KL'de açken ≥ 2 × K0 (≥ 0,014) | tutmazsa o kolda P2–P4 "eleştirmenin etkisi" diye yorumlanmaz |
| P2 | Bitişiklikten çıkış: KLN'de yemek anındaki pozitif pay ≤ 0,75 | > 0,75: değer önceden gelse bile kredi hâlâ yemek anında |
| P3 | Yön: KLN yönlendirme ≥ K0 + 0,05 (≥ 0,147) | < 0,147: eleştirmen düzelse de yön davranışa geçmiyor → 3b (`lat`) |
| P4 | Yan ayrımı: KLN o yana / öbür yana ≥ 2,5 | < 2,5: kredi hâlâ yan körü |
| P5 | Zarar yok: KLN dürtü ≤ K0 + 0,05 (≤ 0,166) | > 0,166: yeni eleştirmen aktörü bozuyor (daha büyük δ, çalkantı) |

KL ve KN'nin P2–P5 değerleri raporlanır ama öngörü değildir (hangi parçanın işe yaradığını ayırmak için).

## Dur kuralı
- Çökme → dur, raporla.
- Yalnız tarama; olumlu iddiadan önce doğrulama (20 + CROSS) ve `curut`.
