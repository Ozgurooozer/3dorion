# Ön-kayıt 005 — Ölüm ve acı öğretsin (TASARIM-009 Aşama 2) — Kart 2

**Durum:** Ozyn 2026-09-30'da "paralel koş" dedi. Mimari değişiklik yok (`teachAtDeath` anahtarı var). Öngörüler koşmadan
önce commit'lenir. Test seed'leri (≥ 1001) yok, dondurma yok.

## Neden
Ozyn: "Ölüm de acı öğretir." E7'den (seri 002) beri `teachAtDeath: false`: eleştirmen yokken ölüm öğretince beden aşırı
hareket ediyordu. Eleştirmen ve yarışmalı seçiciyle hiç denenmedi. Acı zaten hissedilen sonucun içinde (dürtü = açlık² +
yara²); ölüm ise hiç duyulmuyor.

`[TEST]` `experiments/stage2.test.ts` (4 test, bozma 5/5): seçici + eleştirmenle ölüm öğretir (defterde "death" etiketli
yazımlar); anahtar kapalıyken ölüm hiçbir şey yazmaz, kapalı defter açık defterin ölüme kadarki kısmıyla birebir aynı;
anahtarın eklediği her şey ölüm tikinde yazılır ve eleştirmen de ölümü duyar.

## Kollar (H3B97 beyni, sabırlı eğitim `--egitim sabirli`, seed 1–5 × iki grup, 10 değerlendirme bölümü)

| kod | oda | ölüm öğretir |
|---|---|---|
| D0 = H3B97 (kayıtlı, sabırlı, Kart 1) | kıt oda (ROOM3, 5 yemek, tehlike yok) | hayır |
| OL1 | kıt oda | evet |
| OT0 | oda 2 (ROOM2: 10 yemek, 2 tehlike, enerji 0,4) | hayır |
| OT1 | oda 2 | evet |

Komut: `npm run exp -- tara OL1 OT0 OT1 --egitim sabirli --isci 5`.

## Puanlama kuralı (Kart 1 dersi, bundan sonra hep)
Her yön/fark öngörüsü üç şeyle puanlanır: **ortalama** farkı ölçütü geçer, **eşleştirilmiş sayım** (aynı seed ve grup)
≥ 7/10 aynı yönde, **ortanca** farkı aynı yönde. Üçü de uyarsa ✓; ortalama ölçütü tutmazsa ✗; ortalama tutar ama öbür
ikisinden biri uymazsa **belirsiz**.

## Öngörüler (çürütme ölçütüyle)

| # | öngörü | çürütülürse |
|---|---|---|
| P1 | OL1 hayatta kalmayı düşürmez: ortalama hayatta ≥ D0 − 0,05 (D0 0,88) | < D0 − 0,10: aşırı hareket geri döndü (dur kuralı) |
| P2 | Kıt odada ölüm az (D0'da %12) ve çoğu eğitimin başında; etkisi küçük: \|OL1 − D0\| dürtü < 0,05 (D0 0,116) | OL1 ≥ 0,05 daha iyi: seyrek ölüm bile öğretiyor; ≥ 0,05 daha kötü: zarar veriyor |
| P3 | Oda 2'de ölüm öğretmek zararı azaltır: OT1 zarar/1000 tik ≤ OT0'ın %90'ı (üçlü puanlama) | OT1 ≥ OT0: ölüm tehlikeden kaçmayı öğretmiyor |
| P4 | OT1 dürtüsü ≤ OT0 dürtüsü (üçlü puanlama, ortalama ölçütü: fark ≤ 0) | OT1 > OT0 + 0,05: ölüm öğrenmesi oda 2'de zarar veriyor |
| P5 | Kalibrasyon: OT0 öğrenenleri ikizden daha iyi (dürtü, ≥ 8/10) | < 8/10: H3B97 beyni oda 2'de öğrenemiyor; P3–P4 yorumlanmaz |

## Dur kuralı
- Bir koşu çökerse dur, raporla.
- P1 çürürse (OL1 hayatta < 0,78) OT1 sonucu "ölüm öğretir" diye yorumlanmaz; aşırı hareket teşhisi (hareketsizlik oranı,
  `still`) önce gelir.
- Yalnız tarama: olumlu bir iddiadan önce doğrulama (20 + CROSS) ve `curut`.

## Teşhis (koşudan sonra)
`diagnose.ts`, `kural-olcum.ts patient`, `yon-teshis.ts patient` (ölüm öğretmek açlık alışkanlığını değiştiriyor mu?),
defterde "death" etiketli yazımların sayısı ve eğitimdeki zamanı.
