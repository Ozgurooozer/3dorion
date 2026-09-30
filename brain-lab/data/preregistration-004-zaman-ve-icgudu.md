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

## Bölüm A2 — çürütme bataryası: H3B97 @200 (Ozyn: "sırayla ikisini de dene", 2026-09-30; koşmadan önce)
Komut: `npm run exp -- curut H3B97 --egitim 200` (taze seed 11–20, CROSS, LOCAL, lezyonlar, diğer odalar). Ayar seed'i
değil, test seed'i değil. Soru: H3B97'nin 200 bölümdeki kazancı (dürtü 0,193, hayatta %79) gerçek, dopamine bağlı
öğrenme mi, yoksa yön bilgisiz bir hareket alışkanlığı mı?
| # | öngörü | çürütülürse |
|---|---|---|
| C1 | Taze seed'lerde kazanç sürer: dürtü < 0,30, ikizden eşleştirilmiş fark p < 0,05 | dürtü ≥ 0,30: 1–10 seed'in kazancı seçilim yanlılığıydı, geri çekilir |
| C2 | CROSS'ta kazanç kaybolur: CROSS dürtüsü ≥ 0,60 | < 0,40: kazanç dopamin bağlı değil (öğrenme değil, alışkanlık) |
| C3 | LOCAL'de de kaybolur: dürtü ≥ 0,60 | < 0,40: aynı sonuç |
| C4 | Kural yolu lezyonu (rec → Go doğum değerine) kazancı kaldırır: dürtü ≥ 0,50; ilgisiz yol lezyonu kaldırmaz (< 0,30) | kural lezyonu < 0,30: kazanç kural sinapslarından değil başka yerden |
| C5 | Yönlendirme (öğrenen − ikiz) taze seed'lerde anlamsız: Wilcoxon p > 0,05 | anlamlıysa: yön bilgisi 200 bölümde öğrenilmiş |
Ön beklenti (yanlış çıkabilir): C2, C3, C4 tutar (kazanç gerçek ama yönsüz); C5 tutar.

## Bölüm B — içgüdü olarak yön: koşullar ve öngörüler (Ozyn: "sırayla ikisini de dene", 2026-09-30; koşmadan önce)
Kod: `rules: "directed"` doğuş grubu (`birth.ts`, 8 test, 10/10 bozma yakalandı), varsayılan değil, adı ağırlığı taşır.
| kod | ne |
|---|---|
| H3Y3f | yön içgüdüsü W 0,3, kural sinapsları **öğrenmeye kapalı** (senseFilter rec'i dışlar): yalnız içgüdü |
| H3Y3 | W 0,3, kural sinapsları öğrenir, iz λ 0,97 |
| H3Y6 | W 0,6, aynı |
Hepsi oda 3, seed 1–5 × iki grup, **200** eğitim + 10 değerlendirme (H3B97 @200 ile aynı). Referans: H3B @200 (dürtü
0,398, G6m 0,018) ve H3B97 @200 (dürtü 0,193, G6m 0,003, kendi > öbür 9/10).
| # | öngörü | çürütülürse |
|---|---|---|
| B1 | H3Y3f yön ölçüsü (G6m) ≥ 0,05: içgüdü kullanılıyor | < 0,02: hatırlama yönü davranışa taşınmıyor (kapı/seçici sorunu) |
| B2 | H3Y3f dürtüsü H3B @200'den (0,398) en az 0,05 düşük, 10 çiftin ≥ 7'sinde | değilse: yön bilgisi tek başına yetmez, boyut da gerekli |
| B3 | H3Y3 dürtüsü ≤ 0,17 (H3B97 @200'ün 0,193'ünden iyi) | ≥ 0,193: içgüdüsel yön, öğrenilmiş boyutun üstüne bir şey eklemiyor |
| B4 | H3Y3'te öğrenme yönü silmez: kendi > öbür ≥ 9/10, G6m ≥ 0,05 | < 8/10: uzun iz doğuştan yönü bozuyor (yön bilgisiz kredi) |
| B5 | H3Y6, H3Y3'ten en fazla 0,03 fark eder | > 0,03: kazanç çekim gücünden geliyor |
Durma kuralı: H3Y3f B1'i tutturmazsa H3Y3/H3Y6 koşulmaz (yönü kullanmayan bir beyinde üstüne öğrenmek anlamsız); rapor.
