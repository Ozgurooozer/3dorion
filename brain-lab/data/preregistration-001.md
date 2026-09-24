# Ön-kayıt 001 — İlk öğrenme deneyi

**Durum: GERİ ÇEKİLDİ (2026-09-23, Ozyn ile).** Hiç koşulmadı. Gerekçe: beynin motivasyonu
yoktu (açlık bir şey başlatmıyordu), hareket seçimi yoktu, pilot yapılmamıştı ve
"değerlendirmede kendiliğinden hareketi kapat" yanlış bir kontroldü. Yerine: bölgeli beyin
tasarımı (`brain-lab/TASARIM-BOLGELI-BEYIN.md`) → pilot → yeni ön-kayıt. Bu taslak tarihçe
olarak korunuyor.

- Tarih: 2026-09-23 (taslak)
- Kod: `brain-ir-v02-event-memory` dalı, commit `e7af5e6` üstüne kurulacak
- Sorumlu: Ozyn · uygulayan: Claude

---

## 1. Soru

Zayıf rastgele bağlantılarla doğan ve kendiliğinden hareket eden bir beyin, üç faktörlü
öğrenme kuralıyla (eligibility iz × dopamin) yemek bulmayı ve hayatta kalmayı **öğrenebilir mi?**

"Öğrendi" demek için karşılaştırma, öğrenmeyen ama her şeyi aynı olan bir kardeşle yapılır:
aynı doğum, aynı beden, aynı kendiliğinden hareket — tek fark öğrenmenin kapalı olması.

## 2. Hipotezler

- **H1 (birincil):** Öğrenen denekler, aynı doğumlu ama öğrenmesi dondurulmuş kardeşlerinden
  değerlendirmede bölüm başına daha çok yemek yer. Her iki grup (reflekssiz, refleksli) ayrı test edilir.
- **H2:** Öğrenen denekler rastgele motor taban çizgisinden daha çok yemek yer.
- **H3 (keşif, yön yok):** Refleksli ve reflekssiz öğrenenler arasında fark var mı?
- **H4 (dürüstlük, geçer/kalır değil):** Tablo TD(λ) öğrenicisine göre nerede duruyoruz?
  Sonuç ne olursa olsun raporlanır.

## 3. Denekler ve koşullar

Her koşulda **20 denek**; hepsi kayıt sisteminde numaralı (DNK-…), adlı, soylu.

| kod | kategori | ne |
|---|---|---|
| B-BOS | baseline.empty | bağlantısız iskelet, hareket yok (taban) |
| B-RAST | baseline.random | her tik rastgele itme/dönüş |
| B-DON-R0 | learner.3f, öğrenme kapalı | reflekssiz yenidoğan + kendiliğinden hareket, ağırlıklar donuk |
| B-DON-R1 | learner.3f, öğrenme kapalı | refleksli yenidoğan + kendiliğinden hareket, ağırlıklar donuk |
| B-TD | baseline.td | tablo Q(λ), kaba duyular (aşağıda) |
| O-R0 | learner.3f | reflekssiz yenidoğan, öğreniyor |
| O-R1 | learner.3f | refleksli yenidoğan, öğreniyor |

Eşleştirme: O-R0'daki i. denek ile B-DON-R0'daki i. denek **aynı doğum seed'ini** alır
(aynı doğum grafiği) — H1 eşleştirilmiş karşılaştırmadır.

## 4. Seed'ler — ayar ile test ayrı

- **Ayar seed'leri:** 1–10. Öğrenme parametreleri (η, λ) sadece bunlarla seçilir.
- **Test seed'leri:** 1001–1020. Parametreler dondurulmadan test seed'leriyle hiçbir koşu yapılmaz.
- Doğum seed'i = denek seed'i. Bölüm dünyası seed'i = denek seed'i × 1000 + bölüm no.
- Seçilen parametreler ve ayar koşularının RUN numaraları deftere yazılır.

## 5. Protokol

1. **Gelişim (eğitim):** her denek **200 bölüm** yaşar, bölüm başına en çok **3000 tik**.
   Beyin bölümler boyunca aynı kalır (ömür boyu öğrenme); her bölüm yeni bir oda (yeni seed).
   Kendiliğinden hareket açık, sabit hız (açılma 0,03, kapanma 0,12 / tik).
2. **Değerlendirme:** eğitimden sonra **50 bölüm**, öğrenme **kapalı**:
   - birincil: kendiliğinden hareket **kapalı** — öğrenilmiş davranışın kendisi ölçülür;
   - ikincil: kendiliğinden hareket açık.
   Değerlendirme dünyaları eğitimde hiç görülmemiş seed'lerdir (denek seed'i × 1000 + 500…549).

## 6. Öğrenme kuralı (koşmadan önce sabit)

- Her kenar için eligibility izi: `e ← λ·e + pre·post` (pre = kaynak düğümün çıkışı,
  post = hedef düğümün çıkışı, aynı tikte).
- Dopamin gelince: `Δw = η·δ·e`; ağırlıklar [−2, 2] aralığında kırpılır.
- Kendiliğinden hareket kenarları (`spont.* → motor.*`) doğuştan ve **öğrenmez**.
- Her ağırlık değişimi deftere (LRN-…) yazılır; δ, e ve tetikleyen olaylar (EVT-…) ile.
- η ∈ {0,05; 0,1; 0,2}, λ ∈ {0,8; 0,9; 0,95} — ayar seed'lerinde, eğitim sonu bölüm başına
  yemek ortalamasına göre seçilir. Başka ayar yapılmaz.
- Tahmin: durumsuz koşan ortalama (α = 0,05) — bilinen sınırlılık, bilerek.

## 7. Tablo TD(λ) taban çizgisi (dürüstlük ölçütü)

Kaba durum (64): yemek yönü {sol, orta, sağ, yok} × tehlike yönü {sol, orta, sağ, yok} ×
çarpma {0, 1} × açlık {düşük, yüksek}. Eylemler: itme {−1, 0, 1} × dönüş {−1, 0, 1} (9).
Q(λ), ε-açgözlü (ε 0,2 → 0,02), aynı ödül (dopaminin sonucu) ve aynı bölüm sayısı.
**Not:** TD'ye yön bilgisi hazır işlenmiş verilir — bizim beyinden **daha avantajlı** bir
rakip. Onu geçemezsek bu bir başarısızlık değil, ölçülmüş bir mesafedir.

## 8. Ölçüler

- **Birincil:** değerlendirmede (hareket kapalı) bölüm başına yenen yemek — denek başına tek sayı (50 bölüm ortalaması).
- İkincil: yaşam süresi (tik), tehlikeden ölüm oranı, ilk yemeğe kadar geçen tik,
  eğitim boyunca öğrenme eğrisi (her 10 bölümde bir ortalama), ağırlık değişimi sayısı,
  evre geçişleri (E2 ilk öğrenme, E3 ilk başarı).

## 9. İstatistik ve başarı ölçütü

- H1: eşleştirilmiş Wilcoxon işaretli sıra testi (öğrenen vs donuk kardeş), tek yönlü;
  iki grup için Bonferroni → **p < 0,005**. Ek olarak medyan fark ve IQR raporlanır.
- H2: Mann-Whitney U, tek yönlü, p < 0,005.
- H3: Mann-Whitney U, iki yönlü, p < 0,05 — keşif, iddia değil.
- Denek düzeyi: bir denek, değerlendirme yemek ortalaması kendi donuk kardeşininkinden
  ve donuk grubun %95'lik diliminden büyükse **E4 (kararlı)** evresine geçer.

## 10. Yanlışlayıcılar — hangi sonuç neyi çürütür

- H1 iki grupta da tutmazsa: "bu kural + durumsuz tahmin + bu parametrelerle bu görev
  öğrenilmiyor" — olumsuz sonuç olarak yazılır. Sonraki aday: durum-bağımlı tahmin.
- Öğrenenler sadece hareket açıkken iyiyse: öğrenme kendiliğinden harekete bağımlı, kendi
  başına davranış kurmamış.
- Öğrenen ağırlıklar sınırda (±2) yığılırsa: kural kararsız; sonuç geçersiz sayılır.

## 11. Geçerlilik kontrolleri (sonuçtan önce)

- Her denek için doğum grafiği + defter = canlı beyin (hash eşit). Tek bir uyuşmazlık tüm sonucu geçersiz kılar.
- Rastgele seçilen 2 denek baştan koşulur: bit-aynı sonuç.
- Ayar koşularının hiçbirinde test seed'i kullanılmadığı RUN kayıtlarından gösterilir.

## 12. Raporlama

Sonuçlar ne olursa olsun: laboratuvar defteri + vault'ta beyin0fis toplantı sayfası
(ölçümler, grafikler, en iyi/en kötü deneklerin adları, geçti/kalmadı). Olumsuz sonuç da yayımlanır.

## Sapmalar

(boş — deneyden sonra eklenir)
