# Ön-kayıt 009 — KL ve KLw doğrulaması (CROSS ile) — Kart 6

**Durum:** Ozyn 2026-10-01: "devam önerilerine göre" (öneri: KL ve KLw birlikte doğrulamaya). Kod değişmedi; öngörüler
koşmadan önce commit'lenir. Test seed'leri (≥ 1001) yok, dondurma yok.

## Neden
Tarama (Kart 4–5, 10 denek): KL yönlendirme 0,265 (bağlı bedene karşı 9/10), KLw 0,194 (8/10, dönüş cezası yok), H3B97
(K0) 0,097. Olumlu bir "yön öğreniliyor" iddiası için Themis: önce doğrulama (daha çok denek + CROSS), sonra `curut`.

## Komut ve kollar
`npm run exp -- dogrula H3B97 KL KLw --egitim sabirli --isci 5`: seed 1–10 × iki grup = 20 öğrenen her kolda, ayrıca
her öğrenene eşleşen bir **CROSS** kontrolü (aynı beyin, dopamin 3000 tik gecikmeli: büyüklük ve zamanlama aynı,
eylem → sonuç bağı yok; öğrenenle aynı bölüm sayısı kadar eğitilir).
- Seed 1–5 tarama deneklerinin birebir tekrarıdır (belirleyicilik kontrolü: satırları taramayla aynı olmalı).
- Seed 6–10 tazedir (taramanın örneklem dışı tekrarı).

## Puanlama (20 denek)
Ortalama ölçütü + eşleştirilmiş sayım ≥ 14/20 aynı yönde + ortanca aynı yönde: üçü uyarsa ✓, ortalama tutmazsa ✗, ortalama
tutup biri uymazsa **belirsiz**. İşaret testi p değerleri raporlanır.

## Öngörüler

| # | öngörü | çürütülürse |
|---|---|---|
| C1 | KL ve KLw dürtüde kendi CROSS'unu geçer (fark CROSS − öğrenen > 0, ≥ 14/20, işaret p < 0,05) | geçmezse: kazanç eylem → sonuç bağından değil (zamanlama, yavaş değişkenler) |
| C2 | KL ve KLw yönlendirmede bağlı bedenini geçer (≥ 14/20, işaret p < 0,05) | geçmezse: yön duyulandan değil hareket kalıbından |
| C3 | Yönlendirme KLw ≥ K0 + 0,05 ve KL ≥ K0 + 0,05 (aynı 20 denekte eşleştirilmiş) | tarama kazancı genellenmiyor |
| C4 | Örneklem dışı: seed 6–10'da (10 denek) KLw yönlendirme ≥ 0,147 ve KL ≥ 0,147 | taramadaki değer seed 1–5'e özgüymüş |
| C5 | Dürtü: KLw ≤ K0 ve KL ≤ K0 (eşleştirilmiş, ≥ 14/20) | iz yön için dürtüden ödün veriyor |
| C6 | Belirleyicilik: seed 1–5 öğrenen satırları tarama satırlarıyla aynı (dürtü, yönlendirme, `trained`) | kod ya da koşu belirleyici değil: koşu yorumlanmaz |

## Dur kuralı
- Çökme ya da C6 çürümesi → dur, raporla.
- C1 ve C2 tutan kol için sıradaki adım `curut` (taze seed 11–20, CROSS, LOCAL, lezyonlar, başka odalar); olumlu iddia
  yalnız ondan sonra ("bu testlerden sağ çıktı").
