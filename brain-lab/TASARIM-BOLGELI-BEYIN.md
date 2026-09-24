# Tasarım: Bölgeli Beyin (taslak)

**Durum:** ONAYLANDI (Ozyn, 2026-09-24: "devam"). §10'daki açık sorular belgedeki varsayılanlarla
kapandı — bölge listesi olduğu gibi, aç doğum 0,4, ilk deney tehlikesiz, ~4 tik gecikme.
Ozyn bunlardan birini değiştirirse bu satırın altına tarihli not düşülür.
**Tarih:** 2026-09-23 · **Önceki durum:** commit `e7af5e6` (dünya, sinirler, kayıt, doğum)

## 1. Neden

Altyapı sağlam (dünya, duyu-motor sözleşmesi, kayıt ve defter, görsel, testler). Garip
davranan beynin kendisi:

1. **Motivasyon yok.** Açlık sadece yemeğin değerini ölçekliyor; kendisi bir şey başlatmıyor.
   Faz 2 ölçümü (kendiliğinden hareket kapalıyken 20 yenidoğanın 0'ı kıpırdadı) bunu
   gösteriyor: beynin içinde hareketi başlatan hiçbir şey yok.
2. **Hareket seçimi yok.** Dört motor bağımsız ateşliyor; ileri ve geri aynı anda ateşleyip
   birbirini sıfırlıyor → titrek beden.
3. **Kendiliğinden hareket durumdan kopuk.** Açlıktan bağımsız sabit bir zar atışı; gerçek
   bebekte aç olan çok kıpırdar, tok olan uyur.
4. **Düz yapı.** Her şey sensör → motor kenarı; öğrenme kuralı hangi yolu değiştireceğini
   bilemez, kredi atama neredeyse imkânsız.
5. **Tok doğum.** Beden enerji 1 ile doğuyor. Bebek ağlayarak, yani **aç** doğar.
6. **Kavram karışıklığı.** Kendiliğinden hareket düğümleri "sensor" tipinde; refleks ağırlığı
   5 gibi keyfi, çünkü yara sinyali ölçeklenmemiş.

## 2. İlke

**Yapıyı doğa verir, ağırlıkları deneyim belirler.** Hangi bölgelerin var olduğu ve hangi
bölgeler arasında yol olabileceği doğuştandır (bizim tasarımımız); hangi yolun güçleneceği
öğrenilir. Gerçek beyinde de bağlantı planı genetik, ağırlıklar deneyimle şekillenir. Bu
sınır "davranışı kodlamıyoruz" ilkesinin tanımıdır: hiçbir doğuştan yol bir amaca göre
seçilmez (ör. "yemeğe dön" yolu yok; sadece "görme → eylem seçimi" yolu var, ağırlığı zayıf ve rastgele).

## 3. Biyolojik dayanak (kaynaklar doğrulandı, 2026-09-23)

- Açlık nöronları (AgRP) **olumsuz değerli bir öğretme sinyali** taşır; fareler bu nöronların
  susmasını sağlayan yer ve tatları öğrenir. Besin ipuçları bu nöronları hızla susturur.
  — Betley ve ark., *Nature* 521, 2015.
- **Yemeği algılamak**, daha yemeden açlık nöronlarının durumunu hızla tersine çevirir
  (beklenti = tahmin). — Chen ve ark., *Cell* 160, 2015. Ayrıca besin ipuçlarının açlık
  nöronları üzerinden öğrenmeyi yönlendirdiği: *Nature*, 2021.
- **Tonik dopamin hareketin şiddetini** (ne kadar hızlı/sık davranılacağını) belirler;
  fazik dopamin hangi eylemin seçileceğini öğretir. — Niv, Daw, Joel, Dayan, *Psychopharmacology* 191, 2007.
- **Homeostatik pekiştirmeli öğrenme:** birincil ödül = iç durumun hedefe yaklaşması; ödül
  aramak fizyolojik dengeyi korumakla matematiksel olarak eşdeğer. — Keramati & Gutkin, *eLife* 3, 2014.
- **Bazal ganglion Git/Gitme:** doğrudan yol uygun eylemi seçer (Git), dolaylı yol uygunsuzu
  bastırır (Gitme); dopamin artışı Git'i, düşüşü Gitme'yi öğretir. — Frank, *J Cogn Neurosci* 17, 2005.

## 4. Bölgeler

Hepsi **tek bir Brain IR grafiğinde**, öneki ile ayrılmış bölgeler olarak durur — böylece
trace, defter ve bit-aynı replay tek parça kalır. Brain IR'a değişiklik gerekmez
(bastırıcı düğüm ve toplamsal girdiler yeterli).

| önek | bölge (biyoloji) | düğümler | iş | doğuştan / öğrenilen |
|---|---|---|---|---|
| duyu | duyu | mevcut 22 sensör (`ray*`, `touch.*`, `intero.*`, `proprio.*` — adları değişmez) | dünyayı kodlar | doğuştan |
| `hyp.*` | hipotalamus | `hyp.hunger`, `hyp.pain` | iç eksikliği dürtüye çevirir | doğuştan |
| `vta.*` | dopamin çekirdeği | (modül, düğüm değil) | tonik seviye + fazik δ | doğuştan kural |
| `cpg.*` | beyin sapı örüntü üreteci | eylem başına bir üreteç + gürültü girişi | eylem **önerir**; dürtü arttıkça sık | doğuştan |
| `bg.*` | bazal ganglion | eylem başına `go`, `nogo`, `out` | önerileri yarıştırır, tek kazanan geçer | **öğrenme burada** |
| `motor.*` | motor çıkış | mevcut 4 motor | kasa gider | doğuştan |

**Eylemler:** ileri, geri, sol, sağ. Karşıt çiftler (ileri↔geri, sol↔sağ) birbirini
bastırır — aynı anda ikisi geçemez.

## 5. Yollar tablosu — hangi bölge hangisine bağlanabilir

| kaynak → hedef | ağırlık | öğrenir mi | not |
|---|---|---|---|
| duyu → `bg.go.*`, `bg.nogo.*` | zayıf, rastgele | **evet** (üç faktör) | striatum girdisi; tek öğrenen yol |
| `hyp.*` → `cpg.*` | sabit | hayır | dürtü "bir şey yap" der |
| `hyp.*` → `bg.go.*` | sabit, küçük | hayır | dürtü seçimi genel olarak kolaylaştırır (tonik) |
| gürültü → `cpg.*` | sabit | hayır | kendiliğinden ateşleme kaynağı |
| `cpg.a` → `bg.go.a` | sabit | hayır | üreteç kendi eylemini önerir |
| `bg.go.a` → `bg.out.a` (+), `bg.nogo.a` → `bg.out.a` (−) | sabit | hayır | Git − Gitme |
| `bg.out.a` → karşıt `bg.out.b` (bastırıcı üzerinden) | sabit | hayır | karşılıklı bastırma |
| `bg.out.a` → `motor.a` | sabit | hayır | seçilen eylem kasa gider |

Tabloda olmayan her kenar yasaktır; bir test bunu korur (bölge sınırı = kod sınırı).

## 6. Sinyaller

- **Dürtü (hipotalamus):** `D = (1 − enerji)² + w·(1 − sağlık)²` — hedef değerden uzaklık.
  Açlık arttıkça dürtü karesel artar.
- **Tonik dopamin:** dürtüyle orantılı; üreteçleri sıklaştırır ve Git yollarını kolaylaştırır
  → aç beden daha çok ve daha istekli hareket eder, ne yapacağını bilmeden.
- **Ödül (homeostatik):** `r = D(önce) − D(sonra)` — dürtünün azalması. Yemek → büyük artı;
  acıkmak → küçük eksi; yaralanmak → eksi. Ölüm: doğuştan büyük eksi (mevcut).
- **Fazik dopamin:** `δ = r − tahmin`. İlk sürümde tahmin durumsuz (mevcut). İkinci sürümde
  biyolojideki gibi: yemeği **görmek** dürtüyü önceden düşürür (öğrenilen `duyu → hyp` yolu)
  → beklenti doğar. Bu, Chen 2015'in bulgusunun karşılığı.
- **Öğrenme (üç faktör, Frank 2005):** `duyu → bg.go` kenarlarında `Δw = +η·δ·e`,
  `duyu → bg.nogo` kenarlarında `Δw = −η·δ·e`. Her değişiklik deftere (LRN-…).

## 7. Doğum

- **Aç doğum:** başlangıç enerjisi 0,4 (dünya ayarı `initialEnergy`). Dürtü ilk tikten açık.
- Yollar tablosundaki sabit kenarlar doğuştan; öğrenen kenarlar zayıf ve rastgele.
- Refleksli grup: beden duyusuna dayalı refleksler, bu kez `duyu → bg.go` üzerinden
  (çarpınca sol, yaralanınca ileri) — öğrenen yolda oldukları için silinebilirler.
- Ağlama şimdilik yok: bedenin sesi ve bakıcısı yok. İleride bir "ses" motoru ve ona
  doğuştan cevap veren bir bakıcı eklenebilir (bilgi havuzu §8).

## 8. Mevcut koddan ne kalır, ne değişir

| kalır | değişir | yeni |
|---|---|---|
| `world/` (+ `initialEnergy`) | `development/` doğumu bölgelere göre kurar; `spont.*` → `cpg.*` | `regions/`: bölge tanımları, yollar tablosu, grafik kurucu, bekçi test |
| `sensorimotor/` sözleşmesi | `neuromodulation/`: sonuç = dürtü azalması; tonik seviye eklenir | öğrenme kuralı (Faz 5, tabloya bağlı) |
| `registry/`, defter, görsel | görsel: bölgeleri sütun olarak gösterir | |

## 9. Deney yolu (pilot → ön-kayıt)

1. **Pilot (keşif, sadece ayar seed'leri 1–10):** tehlikesiz oda, tek soru — *aç doğan beyin
   yemeğe yönelmeyi öğreniyor mu?* Açıkça "keşif" etiketli; iddia değil, yön bulma.
2. **Ön-kayıt 001 yeniden yazılır:** pilotun gösterdiği tek soru, tek birincil ölçü.
   Mevcut taslak geri çekildi (çok koşul, pilot yok, yanlış kontrol).
3. **Birincil ölçü "yönelim":** yemek görüş alanındayken, ona doğru dönme/yaklaşma oranı —
   sadece yenen yemek sayısı değil (o şansa çok açık).
4. **Kontrol:** aynı doğumlu, öğrenmesi donuk kardeş — dürtü ve kendiliğinden hareket
   ikisinde de açık. (Değerlendirmede hareketi kapatmak yanlış kontroldü: motivasyonu keser.)
5. Tehlike ikinci deneyde; TD karşılaştırması ondan sonra.

## 10. Açık sorular (Ozyn)

- Bölge listesi yeterli mi, eksik/fazla var mı? (Ör. talamus kapısı, hafıza şimdilik yok.)
- Aç doğum enerjisi 0,4 uygun mu?
- İlk deney tehlikesiz olsun mu?
- Gecikme: gürültü → üreteç → Git → çıkış → motor ≈ 4 tik (200 ms). Kabul mü?

## 11. Riskler

- Tasarladığımız yollar tablosu fazla yönlendirici olabilir → her doğuştan kenarın gerekçesi
  bu belgede yazılı olmalı, "amaca göre" kenar kabul edilmez.
- Durumsuz tahminle gecikmeli ödül yine zor olabilir → pilot bunu erken gösterir.
- Bölge sayısı arttıkça §9'daki iz maliyeti büyür → şimdilik ~45 düğüm, sorun değil.

## Kaynaklar

- Betley ve ark. 2015 — https://www.nature.com/articles/nature14416
- Chen ve ark. 2015 — https://www.cell.com/fulltext/S0092-8674(15)00076-8
- Besin ipuçları ve AGRP öğrenmesi, 2021 — https://www.nature.com/articles/s41586-021-03729-3
- Niv ve ark. 2007 — https://pubmed.ncbi.nlm.nih.gov/17031711/
- Keramati & Gutkin 2014 — https://elifesciences.org/articles/04811
- Frank 2005 — https://direct.mit.edu/jocn/article-abstract/17/1/51/3948/Dynamic-Dopamine-Modulation-in-the-Basal-Ganglia-A
