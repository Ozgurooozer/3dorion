# Tasarım 005 — Rekabetçi seçim (Alice çekirdeği) — TASLAK

Tarih: 2026-09-24 · Durum: **taslak, Ozyn onayı bekliyor** (seçim darboğazı toplantısı K5; K8 "robot beyni" ilkesi
de Ozyn'de). Kod yazılmadı.

## Neden (ölçülenler)

- Aynı beden, duyu ve ödülle ders kitabı TD, gerçek tavanın (%25,8) %32'sine çıkıyor; E7 %12'de.
- Kapasite fikstürü: elle verilen ağırlıklarla bu beyin yön buluyor (yönlendirme 0,63). Öğrenen beyinde ~0,06.
- Eleştirmen yemek görmeye değer vermiyor (normalize edilince de 0,006) — çünkü bu davranışla yemek görmek yemeği
  öngörmüyor. **Kısır döngü yapısal:** üreteçler seçimi ele geçiriyor, öğrenilen ağırlıklar ancak ~0,2'den sonra
  davranışa karışıyor; davranış iyileşmeden değer, değer oluşmadan davranış oluşmuyor.
- Matematik düzeltmeleri (normalize adım, uzun iz, tabansız) ve zayıf üreteç tek başına çözmedi (tarama A1–A5, G3).

## İlke

Bazal ganglionun biyolojideki işi: eylem kanalları arasında **rekabetle seçim**; en yüksek "belirginlik" kazanır,
diğerleri bastırılır (Redgrave, Prescott & Gurney 1999). TD'nin çalışan ilkesi aynı şeyin hesabı: öğrenilmiş değer
seçimi yönetir, keşif küçük ve bilinçli. Öneri, ikisini Git/Gitme diliyle birleştirmek:

**eylem değeri = Git − Gitme** (öğrenilmiş) · **seçim = değer + küçük keşif** · **keşif = öğrenme ilerlemesine bağlı**

## Önerilen yapı (üç parça, her biri ayrı anahtar)

**S1 — Eksen başına rekabet.** İki eksen, her birinde üç aday: itme {ileri, yok, geri}, dönüş {sol, yok, sağ}.
Her adayın belirginliği = Σ öğrenilmiş Git − Σ öğrenilmiş Gitme + doğuştan yan etkiler (açlık tonik kolaylaştırma)
+ keşif gürültüsü. Eksende en yüksek belirginlik kazanır ("yok" da bir aday: durmak da öğrenilir). İki eksen birlikte
çalışır → "dönerken ilerle" (ölçülen: yerinde dönmek tavanı yarıya indiriyor). Brain IR'da: eksen içi güçlü karşılıklı
bastırma (kazanan-hepsini-alır), ayrı bir "yok" hücresi. Öğrenme kuralı değişmez: seçilen eylemin Git/Gitme'si
(K3, "selected" geçit).

**S2 — İlerlemeye bağlı keşif (merak, Oudeyer).** Üreteç gürültüsünün gücü sabit değil: eleştirmenin tahmin hatası
son pencerede önceki pencereye göre azalıyorsa (öğrenme ilerliyorsa) keşif o durum türünde azalır, sömürü artar;
ilerleme yoksa keşif sürer. Başlangıçta yenidoğan bugünkü gibi hareket eder (doğuştan yapı korunur). "Oda önemli":
ilerleme ölçülebilir olmalı → odanın öğrenilebilir, çeşitli bölgeleri olmalı (şimdilik tek görev: yemek).

**S3 — İki taraflı dönüş (seçenekli, sonra).** Dönüş eksenini "sol / sağ sürüş" farkı olarak temsil etmek (flygym:
dönüş = sol/sağ ritim üreteçlerinin genlik asimetrisi). S1 çalışırsa ablasyonla denenir.

## Doğrulama sırası (K4: tarama → doğrulama)

1. Kapasite: S1 elle kurulmuş ağırlıklarla yönlendirme ≥ 0,6 (bugünkü mimarinin tavanı 0,63) — S1'in kendisi bir
   şey kaybettirmiyor mu?
2. Tarama (10 denek): S1 + E7 öğrenme kuralı. **Başarı ölçütü (önceden):** yönlendirme > 0,2 ve ortalama dürtü < 0,47
   (E7) ve eleştirmenin yemek değeri > 0,02 (döngü kuruldu mu?).
3. S1 + S2. Sonra modüller (M1 bölmeler, M2 ara katman, M3 iki taraf, öğretmen) tek tek, ablasyonla.
4. Umut veren her şey 20 denek + CROSS kontrolüyle doğrulanır.

## Açık sorular (Ozyn'e)

- K8: bölge içi öğrenme kuralında biyolojide birebir karşılığı olmayan ama çalışan yöntemler serbest mi? (S1 bunu
  gerektirmiyor — biyolojik seçim hipotezine dayanıyor — ama S2'nin ilerleme hesabı bir mühendislik yaklaşımı.)
- Oda: merak için odaya öğrenilecek ikinci bir şey (ör. farklı değerde yemekler, nötr nesneler — bilgi havuzu §16)
  eklensin mi, yoksa önce tek görevde S1 mi doğrulansın? Öneri: önce S1, tek görev.
