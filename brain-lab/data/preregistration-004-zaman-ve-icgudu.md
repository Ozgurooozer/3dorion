# Ön-kayıt 004 — Deneklere daha çok zaman; yön bilgisi içgüdü olarak (TASLAK)

**Durum: TASLAK.** Bölüm A (yalnız daha uzun eğitim, kod değişmez) Ozyn'in 2026-09-29 isteğiyle koşulur; öngörüler
koşmadan önce commit'lendi. Bölüm B (içgüdü) tasarımdır, Ozyn onayı olmadan kod yok. Test seed'leri yok, dondurma yok.

## Neden
Ozyn (2026-09-29): "Bazı deneyleri sanki kısa tutuyormuşuz; hemen başarılı olmaları gerekiyor gibi." Doğru: hepsi 40
eğitim bölümü (3000 tik/bölüm). A3.2 kural sinapsının kapasite fikstürüne göre ~15× yavaş kaldığını söylemişti; yavaş
öğrenen bir mekanizma 40 bölümde ölçülüyorsa "öğrenmiyor" ile "henüz" ayırt edilemez.

## Bölüm A — zaman (kod yok)
Koşullar: H3B, H3B97, H3B99 (H3D97 zaman çizgisi için ikinci öncelik). Oda 3, seed 1–5 × iki grup, **200** eğitim +
10 değerlendirme; aynı dünya seed'leri. Referans: kayıtlı 40-bölüm satırları. 200 bölümde H3B'nin kendi taban çizgisi de
koşulur (uzun H3B ile uzun H3B97 aynı uzunlukta kıyaslanır).
Ölçüler: kural ağırlığı (ortalama, kendi/öbür taraf, kendi > öbür sayısı), dürtü, hayatta, G7, G6m.

### Öngörüler (çürütme ölçütüyle)
| # | öngörü | çürütülürse |
|---|---|---|
| A1 | H3B (λ 0,9) 200 bölümde kural ağırlığı 40'takinin ≥ 3 katı ama < 0,12 | < 2 kat: zaman da darboğaz değil |
| A2 | H3B kendi > öbür taraf ≥ 9/10 kalır; H3B97 ve H3B99'da ≤ 8/10 kalır | B99 ≥ 9/10 çıkarsa: yön sorunu yalnız zamandı |
| A3 | G6m hiçbir koşulda 0,05'i geçmez (yön bilgisi hâlâ öğrenilmemiş) | ≥ 0,05: zaman yönü de öğretiyor |
| A4 | H3B'nin dürtüsü uzun eğitimde 0,351'den düşer (< 0,30); H3B99'da düşüş daha az (< 0,05 fark) | H3B'de düşüş yoksa yavaşlık savı çürür |

Durma kuralı: 200 bölümde bir koşu çökerse ya da ağırlıklar wMax'a yapışırsa dur, raporla.

## Bölüm B — yön bilgisi içgüdü olarak (TASARIM; onay bekliyor)
Fikir (Ozyn): "rec_i → Go(i yönü)" yapısını öğretmek yerine doğuştan ver. Tartışma noktaları:
- Bugünkü etiketli **fikstür** (recall-a3, elle W) tam bu; onu "doğuştan içgüdü" yapmak, lab ilkesiyle ("davranış
  elle kodlanmaz; doğa yapıyı verir, deneyim ağırlığı") tartışmalı. Çözüm: bunu **doğuş grubu** olarak ve gerekçesiyle
  `INNATE`'e koymak (mevcut refleksli/reflekssiz gruplar gibi), asla varsayılan yapmamak.
- Üç kol: `rules: "directed"` (rec_i → Go i yönü, doğuştan ağırlık W, sabit/öğrenilebilir), W ∈ {0,3 · 0,6}; `directed` +
  öğrenme açık (bunun üzerine öğrenir mi, bozar mı?); mevcut `grown`/`innate` (rastgele) referans.
- Ne soruyor: içgüdüsel yön bilgisi varken kalan sorun (eleştirmen/kredi) hâlâ dürtüyü düşürmekten alıkoyuyor mu? Tavan
  ölçümü: fikstür zaten "ne yapabilir"i veriyor; asıl yeni soru "doğuştan yön + öğrenilmiş büyüklük" birleşimi.
- Kod: `RecallBirth.rules`'a "directed" + `maxInitial` benzeri ağırlık alanı, bit-birebir test, bozma denemesi; `born`
  koşullarında H3Y3/H3Y6 kodları. **Yalnız onaydan sonra.**
