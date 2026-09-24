# Ön-kayıt 002 — Bölgeli beyin, sonuca bağlı öğrenme (TASLAK)

**Durum: TASLAK — Ozyn onayı bekleniyor (toplantı 2026-09-24, K7, K10).** Onaylanınca commit'lenir;
o commit'in hash'i dondurma kaydıdır. Sapmalar aşağıdaki bölüme tarihle eklenir. Test seed'leriyle
bu belge dondurulmadan hiçbir koşu yapılmaz.

## Soru
Aç doğan bölgeli beyin, seçime bağlı üç faktörlü öğrenme + TD eleştirmeni ile (ölüm öğretmez),
yemek bulmayı **sonuçlarından** öğrenir mi?

## Aday (E7, ayar seed'lerinde seçildi — bkz. LAB-DEFTERI seri 002)
gate "selected", dipFloor 0,05, teachAtDeath false, critic {α 0,05, γ 0,99, kuantum 0,0005},
η 0,05, λ 0,9, kuantum 0,005, Gitme öğrenir; ölçekleme yok. Ortam: tek oda, tehlike yok,
aç doğum 0,4, 10 yemek, bölüm başına en çok 3000 tik.

## Denekler
Test seed'leri 1001–1020 × iki grup (reflekssiz, refleksli): 40 öğrenen, 40 donuk kardeş (aynı doğum,
öğrenme kapalı), 40 CROSS kardeş (aynı kural, dopamin 3000 tik gecikmeli — başka bölümden).

## Protokol
60 eğitim + 20 değerlendirme bölümü (değerlendirmede öğrenme kapalı; hepsi aynı değerlendirme dünyaları
ve gürültüyle). Eğitim dünyası seed×1000+bölüm, değerlendirme seed×1000+500+bölüm. Ayar yok.

## Ölçüler
Birincil: değerlendirmede yemek/1000 tik — (öğrenen − donuk kardeş) ve (öğrenen − CROSS kardeş).
İkincil: yaklaşma; yemek lezyonu (klonda yemek-ışını → Git/Gitme doğum değerine); 100 bölümlük öğrenme
eğrisi (seed 1001–1003); geometri; yaşam; durgun oranı.

## İstatistik
Eşleştirilmiş Wilcoxon işaretli sıra, tek yönlü; iki birincil karşılaştırma için Bonferroni → p < 0,025.
Medyan fark ve IQR raporlanır.

## Yanlışlayıcılar
- Öğrenen donuk kardeşi geçmezse: bu kural bu görevi öğrenmiyor.
- Öğrenen CROSS kardeşi geçmezse: "sonuca bağlı öğrenme" iddiası düşer (avantaj başka yerden).
- Yemek lezyonu avantajı silmezse: "yemek görme → Git yolu öğrenildi" iddiası düşer.

## Bilinen sınırlar (önceden yazılı)
Parametre duyarlılığı (η, λ), seyrek yemekte başarısızlık, zayıf yön öğrenimi (geometri 0,54) —
bu deneyin iddiası "yemek görünce harekete geçmeyi öğrenir" ile sınırlıdır, "yemeğe yönelmeyi" değil.

## Sapmalar
(boş)
