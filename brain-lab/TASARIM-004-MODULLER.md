# Tasarım 004 — Yapısal modüller (keşif serisi 004)

Tarih: 2026-09-24 · Durum: Ozyn onayladı ("Bu planla, M1'den başlayarak kodlamaya geç").

## Neden

Seri 003a: aynı duyu, aynı beden, aynı ödülle ders kitabı öğrenicisi (SARSA(λ)) elle yazılmış tavanın %67'sine
çıkıyor; E7 %25'te ve **yönü hiç öğrenmiyor** (dönüş yönü 0,506). 003b: doğuştan yönelme eğilimi (0,02) yönü
çözmedi (0,497). Ozyn: "Beyni çok kaba tasarlamışız." Sinek bağlantı haritası (Male CNS v1.0) ve literatür üç yapısal
fark gösteriyor; üçü de ayrı ayrı ve birlikte **denenerek** karar verilecek — veri olmadan fikir kalır.

İlke değişmiyor: doğa yapıyı verir (bölgeler, yollar, bölmeler), deneyim ağırlıkları. Her modül bir anahtar;
kapalıyken bugünkü beyin bit-aynı çalışır (testle korunur).

## M1 — Dopamin bölmeleri (öğretme sinyalini bölmek)

Sinekte mantar gövdesi 15 bölme; her dopamin tipi yalnız 1–2 bölmeye öğretir (Aso ve ark. 2014). Bizde tek küresel δ.

- **M1a — eylem bölmeleri.** Her eylemin kendi bölmesi ve kendi beklentisi var: Q_a(s) (duyular + sabit, doğrusal).
  Bölmenin dopamini yalnız o eylem seçildiğinde konuşur:
  `δ_a = r + γ·V(s′) − Q_a(s)` (a önceki tikte seçildiyse, yoksa 0). V = mevcut eleştirmen. a'nın Git/Gitme
  bağlantıları yalnız δ_a ile öğrenir; Q_a da yalnız δ_a ile. Neden: TD'nin bizden en büyük farkı eylem başına beklenti;
  "sol bu durumda sağdan iyi" ancak böyle ayrışabilir.
- **M1b — değerlik bölmeleri (PAM / PPL1).** Ödül kanalı rahatlamayı (açlığın azalması), ceza kanalı maliyeti
  (metabolizma, yara, ölüm) görür; her birinin kendi beklentisi var (V⁺, V⁻). Git yalnız δ⁺ ile, Gitme yalnız δ⁻ ile
  öğrenir (Gitme: beklenenden kötü maliyet → güçlenir). r = r⁺ + r⁻ (ödül ayrıştırması testle korunur).

Tüm beklenti ağırlıkları deftere `critic` kaydı olarak düşer (özellik adı bölme önekli: `left/ray3.food`, `pos/bias`).

## M2 — Ara katman (Kenyon benzeri)

Duyu ile Git/Gitme arasına sabit, rastgele, seyrek katman: N hücre (64–128), her biri rastgele 4–5 duyu dinler
(Litwin-Kumar ve ark. 2017), genel baskılayıcı (APL benzeri) etkinliği ~%10'da tutar. Öğrenme "ara katman →
Git/Gitme" yoluna taşınır. Bedel: bir tik ek gecikme. Yol tablosuna yeni bölge + yollar (duyu → ara: doğuştan,
öğrenmez; ara → Git/Gitme: öğrenir).

## M3 — İki taraf

Sol ışınlar sol yarıya, sağ ışınlar sağ yarıya, orta ışın ikisine. Yarılar arası doğuştan karşılıklı baskılama →
"sol − sağ" fark sinyalleri (tropotaksi). Hangi fark hangi dönüşe bağlanır: öğrenilir.

## Deney — seri 004 (keşif, ayar seed'leri 1–10 × iki grup, 40 eğitim + 10 değerlendirme, yemek 10)

Koşullar: E7 λ 0,9 (referans) · M1a · M1b · M2 · M3 · en iyi ikili · üçü birlikte. Ölçü çubukları: TD 8,38, kâhin 12,57.
Kazanan her koşula CROSS kontrolü (dopamin 3000 tik gecikmeli; bölmeli δ'lerin her kanalı ayrı geciktirilir).
Basamak 2'ye doğru ölçüt: dönüş yönü > 0,6 ve yemek/1000 tik > 4,2 (TD'nin yarısı). Her koşulun öngörüsü koşmadan deftere.

## Sonra

Alice/Bob: önce hızlı sistem (Alice) sağlam; sonra v0.3 planlayıcı (Bob) bu dünyaya, belirsizliğe dayalı hakemlikle
(Daw, Niv, Dayan 2005). Ayrı tasarım ve onay.
