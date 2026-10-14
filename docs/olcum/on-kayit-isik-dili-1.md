# Ön kayıt — Işık dili Yol 1, ADIM 1: "dolgu = gölge rengi" (2026-10-14, koşudan ÖNCE)

Kaynak: `docs/arastirma/isik-dili-kararlari-2026-10-14.md` (Ozyn'in 8 kararı; "En ucuz ilk test" bölümünün YALNIZ (a) parçası).
Işık başına bant (CUSTOMUSERLIGHTING) bu adımda YOK.

## Teşhis doğrulaması (koddan, koşudan önce)
- Stil eklentisi (`world/level/stil/isikEklentisi.ts`) bütün ışıkların toplamını (`diffuseBase` luma) TEK değerde bantlıyor;
  gölge tonu tek uniform (`stilGolge`), değeri `stil.isik.golgeRengi` (preset'te sabit); parlama/kenar ışığı yalnız `stilGunes`e bağlı. DOĞRU.
- Eklenti YALNIZ `malzemeKur(..., "isikli", { stil })` ile kurulan StandardMaterial'lere takılıyor (`levelKur.ts` bağlamı ve nesne
  sistemi). Ofis bu yoldan geçmiyor: `oda.ts` kendi `StandardMaterial`'lerini kurar, Blender eşyaları (`odaEsyalari.ts`) glTF'ten
  `PBRMaterial` gelir. İkisinde de eklenti YOK. DOĞRU.
- Ek bulgu: birleşik dünyada (`world/yer/birlesikDunya.ts` 165–176) ofis ışıkları `includedOnlyMeshes` ile YALNIZ ofisi, ova ışıkları
  `excludedMeshes` ile ofis DIŞINI aydınlatır; ofis içindeyken (ic ≥ 0,5) stilin ekran efektleri de atlanır. Dolayısıyla bu adımın
  değişikliği **ofisin içinde hiçbir pikseli değiştiremez**; etkisi yalnız ova yüzeylerinde (zemin, kaya, çim, yerleşimler).
- Ova'da gece "yerel sıcak ışık" yok: tek anahtar ışık ay (palet `isik`, saat 22'de soğuk mavi), dolgu da soğuk. Hipotezin
  "ışıklı taraf yerel sıcak ışığın rengini korur" yarısı bu sahnede **ÖLÇÜLEMEZ**; yalnız "ışıklı taraf değişmez" ölçülür.

## Değişiklik (uygulanacak)
`stil.isik.golgeDolgudan` (0..1, varsayılan 0): gölge tonu = karıştır(`golgeRengi`, saatin palet karesindeki `dolgu`, golgeDolgudan).
Palet `shader/dunyaDurumu.ts paletZamanda` + `shader/paletler.ts dunyaPaleti` ile (kopya yok); zaman tanımsızsa `golgeRengi`.
`toon` önayarında `golgeDolgudan: 1`. Diğer önayarlar 0 (değişmez). Eski dosyalarda alan yoksa 0 ile tamamlanır.

## Önceden hesaplanan tahmin (kod: palet kareleri, eklentinin `stG = renk / luma` normalleştirmesi)
Toon'un sabit tonu `#6b72c4` → stG (0,90 · 0,96 · 1,66). Saat 22 dolgusu: ova (0,80 · 0,99 · 1,70) — NEREDEYSE AYNI;
siberpunk (1,49 · 0,67 · 2,83) — çok mor. Koyu bantta (golgeKarisim 0,45) ışık çarpanı: ova R −%5, G +%1, B +%1;
siberpunk R +%28, G −%13, B +%41 (ton eşleme ve ekran efektlerinden ÖNCE). Yani ova@22'de **görünür fark beklemiyorum**;
mekanizmanın kanıtı siberpunk@22 duyarlılık koşusundan gelir.

## Ölçütler
- **K1 — birim testi.** (a) `isikDurumunuYaz`, `golgeDolgudan: 1` ve zaman saat 22 iken `d.golge`yi
  `paletZamanda(dunyaPaleti(dunya).kareler, 22).dolgu`ya EŞİTLER (1e-9); (b) 0,5'te ikisinin ortası; (c) varsayılan (0) ve zaman
  tanımsızken `d.golge` = `renk(golgeRengi)` BİREBİR; (d) mevcut stil testleri DEĞİŞMEDEN yeşil; (e) alan eksik eski stil geçerli ve
  önayar adı korunur. Bozma testi: alanı yok sayan mutant (a)'yı kırmalı.
- **K2 — bütçe** (`3dorion.bat kapidene`, dist). Ova@22 + toon koşusunda (ortam en başta uygulanır): kapidene **19/19**; dört
  ölçüm noktasının hepsinde çizim **≤ 220**, fps **≥ 60**; sonra − önce çizim farkı ≤ %5 (değişiklik yalnız uniform). Ek olarak
  ortam parametresiz düz `kapidene` sonra koşusu 19/19 (gerileme). VRAM: koşu boyunca `nvidia-smi memory.used` tepe değeri,
  sonra − önce ≤ **50 MiB** (sistem geneli; başka süreçler gürültü katar — öyle yazılır). Önce koşusu bütçeyi zaten aşıyorsa
  (toon'un kendi efektleri) K2 bütçe KALDI yazılır, nedeni "toon tabanı" ve değişikliğin payı fark olarak ayrıca verilir.
- **K3 — görüntü** (ORION_SS; poz `2.6,12,0` = kapidene'nin "dışarıda, ova'ya bakış" noktası; aynı kamera, saat 22, zaman durgun).
  Çiftler: ova@22 önce (iki kez: A ve B = gürültü kontrolü) / sonra; siberpunk@22 önce / sonra. Görsel karar Ozyn'in;
  ben yalnız dosya adlarını ve şu piksel ölçülerini veririm (Python PIL+numpy, `docs/olcum/isik-dili-1/piksel_olc.py`):
  - koyu bölge = önce görüntüsünde luma alt %40; parlak bölge = luma üst %20; bölge başına ortalama Δ = sonra − önce (R, G, B; 0–255).
  - gürültü tabanı = ova önce-A ile önce-B arasındaki aynı ölçü (çim rüzgârı vb.).
  - **Tahmin S (siberpunk, mekanizma):** koyu bölgede ΔB > 0 ve ΔG < 0, her biri |gürültü| × 3'ten büyük.
  - **Tahmin O (ova, gece hedefi):** koyu bölgede |ΔB| ve |ΔR| ≤ gürültü × 3 + 2 (görünür fark yok); sonra'da koyu bölge
    ortalaması B > R (soğuk gölge) — bu önce'de de doğruysa değişikliğe YAZILMAZ.
  - **Tahmin L (ışıklı taraf değişmez):** her iki çiftte parlak bölge ortalama |Δ| ≤ gürültünün parlak-bölge |Δ|'sı + 1.
- **Karar kuralı.** K1 + Tahmin S geçerse "dolgu = gölge rengi" mekanizması kanıtlı sayılır. Tahmin O'nun "fark yok" çıkması
  olumsuz değil, önceden beklenen sonuçtur: ova gecesinde gölgeyi mavi-mor yapan şey zaten toon'un sabit tonuydu. Ofis için bu
  adım hiçbir şey kanıtlamaz (eklenti orada yok) — sonraki adımın konusu.

**Sınırlar (önceden).** n = 1 görüntü/koşul (+1 gürültü kontrolü); bölgeler luma ile ayrılır (gölge maskesi değil); ekran
efektleri (bloom, eğri, GI, çizgi) ölçüye karışır; poz önceden seçildi, görüntüye bakılmadan; VRAM sistem geneli.
Koşu düzeni için `uygulama/senaryolar/kapidene.ts`'e `?ortam=ne:deger,…` parametresi eklenir (önce koşularından ÖNCE; görüntüyü
değiştirmez, yalnız ortam komutlarını senaryonun başında Orion'un yoluyla — `niyetiYurut` — uygular).

## SONUÇLAR (koşudan sonra eklendi, 2026-10-14)
Koşular: `3dorion.bat kapidene` (dist), `ORION_SORGU_EK="poz=2.6,12,0&ortam=…"`, ekran görüntüleri `docs/olcum/isik-dili-1/`.
Önce koşuları (A, B, siberpunk) kod değişikliğinden ÖNCE, kapidene'ye yalnız `?ortam=` eklenmişken alındı.

- **K1 GEÇTİ [TEST].** `world/level/stil/stil.test.ts` 9 yeni test: (a) saat 22 → ova dolgusu (1e-9), siberpunk'ta siberpunk
  dolgusu; (b) 0,5 → tam orta; (c) 0 → `golgeRengi` birebir (`deepEqual`), zaman tanımsızken de; canlı saat parametresi tanım
  saatini ezer; (d) eski stil testleri değişmeden yeşil; (e) alanı olmayan eski stil geçerli ve "standart" adı korunur.
  Bozma testi: `isikDurumunuYaz` alanı yok sayınca 4 test kırıldı (a, siberpunk, 0,5, canlı saat); yedekten geri yüklendi, 34/34.
  `npm test` 3609 test, tek kırmızı bilinen "ova bütün yerleşimleri dönüşsüz"; typecheck temiz; mimari/bağımlılık/tip kaçışı/
  alt-sistem bekçileri yeşil. NOT (e): eski bir dosyada KAYITLI `toon` stili artık "özel" okunur (toon'da alan 1, eski dosyada
  yok → 0; görünüşü değişmez).
- **K2 — kısmen KALDI [ÖLÇÜLDÜ].**
  - Düz `kapidene` (ortam yok, sonra): **19/19**, çizim 168 / 132 / 193 / 77, fps 100 (taban ile aynı). Gerileme yok.
  - Ova@22 + toon: **17/19 hem önce (A ve B) hem sonra**; kalan iki kontrol çizim bütçesi: ofis içi cam duvara bakış **222**,
    dışarıda ofise bakış **378** (> 220). Dört noktanın çizim sayısı önce = sonra = 222 / 192 / 378 / 214 (fark **0**; siberpunk
    çifti de aynı). fps en düşük 80–87 (dışarıda ofise bakış), diğerleri ~100 → fps ≥ 60 GEÇTİ. Ön kayda göre bütçe KALDI
    yazılır, nedeni **toon tabanı** (toon'un kendi efektleri: GI, huzme, bloom, çizgi…); bu değişikliğin payı 0 çizim.
  - VRAM (nvidia-smi sistem geneli tepe, MiB): önce A 3111, önce B 3134, siberpunk önce 3177; sonra ova 3165, siberpunk 3075,
    düz 3069. Ova sonra − önce = +54 (A'ya göre) / +31 (B'ye göre); siberpunk −102. Aynı koşunun iki tekrarı 23 MiB, çiftler arası
    ±100 MiB oynuyor: bu ölçü 50 MiB'ı **ÇÖZEMİYOR** — "ölçüldü, belirsiz". Yapısal not: değişiklik yeni doku/hedef/uniform
    eklemiyor (aynı `stilGolge` vec4'ünün değeri değişiyor).
- **K3 [ÖLÇÜLDÜ] — piksel ölçüsü** (`piksel_olc.py`; 0–255; koyu = önce luma alt %40, parlak = üst %20):

  | çift | koyu ortΔ (R, G, B) | parlak ort\|Δ\| (R, G, B) |
  |---|---|---|
  | gürültü: ova önce-A → önce-B | +0,26, +0,26, +0,13 | 1,01, 0,91, 0,57 |
  | ova@22: önce-A → sonra | −0,60, +0,80, +1,17 | 1,20, 1,08, 0,63 |
  | siberpunk@22: önce → sonra | **+7,62, −2,75, +2,57** | 1,04, 1,39, 0,41 |

  - **Tahmin S GEÇTİ:** siberpunk koyu bölgede ΔB +2,57 > 0 (eşik 3 × 0,13 = 0,39), ΔG −2,75 < 0 (eşik 0,78); R de +7,62 (önceden
    hesaplanan ışık çarpanı yönü: R+, G−, B+). Gölge tonu paletin dolgusunu izliyor — mekanizma canlıda çalışıyor.
  - **Tahmin O GEÇTİ (beklenen "fark yok"):** ova koyu |ΔR| 0,60 ≤ 2,78, |ΔB| 1,17 ≤ 2,39; yön önceden hesaplananla aynı (R−, B+)
    ama görünürlük eşiğinin altında. Koyu bölge B > R hem önce (91,7 > 21,1) hem sonra (92,8 > 20,5): ova gecesinde gölge
    zaten soğuktu; bu DEĞİŞİKLİĞE YAZILMAZ.
  - **Tahmin L GEÇTİ:** parlak bölge |Δ| her iki çiftte gürültü + 1'in altında (en büyük: siberpunk G 1,39 ≤ 1,91).
  - Sınır: siberpunk için ayrı gürültü koşusu yok (ova'nınki kullanıldı); bölgeler luma ile (gölge maskesi değil).
  - Görüntüler (görsel karar Ozyn'in): `ova22-once-A.png` ↔ `ova22-sonra.png` (gürültü: `ova22-once-B.png`),
    `siber22-once.png` ↔ `siber22-sonra.png`, düz kapidene `duz-sonra.png`.
- **Karar kuralına göre:** K1 + Tahmin S geçti → "dolgu = gölge rengi" mekanizması kanıtlı. Ova gecesinde görünür fark YOK
  (önceden beklenen): toon'un sabit tonu `#6b72c4` zaten gece dolgusuna yakındı. Ofis için bu adım hiçbir şey kanıtlamadı
  (eklenti ofis malzemelerinde yok). Hipotezin "ışıklı taraf yerel sıcak ışığın rengini korur" yarısı ÖLÇÜLMEDİ (ova'da
  yerel sıcak ışık yok); ölçülen yalnız "ışıklı taraf değişmez".
- Bilinen sınır: zaman AKARKEN gölge tonu her karede `saatDegisti` ile güncellenir (birim testi canlı saat parametresini sınar;
  akan zamanın kendisi canlıda koşulmadı — [YAZILDI-KOŞULMADI]).
