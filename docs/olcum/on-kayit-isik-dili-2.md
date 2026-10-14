# Ön kayıt — Işık dili ADIM 2: "görünür sıçrama" — ova gecesine sıcak anahtar ışık + ufukta şehir (2026-10-14, koşudan ÖNCE)

Kaynak: `docs/arastirma/isik-dili-kararlari-2026-10-14.md` (Ozyn'in kararları 1, 5, 6, 7, 8: çizgi film, neon evet, ova'da UFUKTA şehir —
level'a dokunulmaz, katı gece paleti, önce gece). Önceki adım (`on-kayit-isik-dili-1.md`): gölge tonu mekanizması çalıştı ama ova gecesinde
görünür fark yoktu; teşhis: ova gecesi tek renk mavi, **sıcak yerel ışık yok, ufuk yok**. Bu adım ikisini ekler. Görsel karar Ozyn'in;
ben "güzel" demem, yalnız yan yana dosya adları ve piksel ölçüsü veririm.

## Teşhis doğrulaması (koddan, koşudan önce)
- Ova ışıkları: `isikSistemi.ts` tek yönlü ışık (gece ay, saat 22'de `#9fb4ff`-ailesi, şiddet ≈ 1,6 × 0,55 = 0,88) + yarıküre dolgu
  (`#3a4f86`-ailesi, ≈ 0,40). İkisi de soğuk. Ova malzemeleri (`malzemeKur`, Standard) `maxSimultaneousLights` varsayılanı 4: bugün 2 ışık
  → 2 nokta ışığa yer var.
- Işık ayrımı (`birlesikDunya.ts`): ofis ışıkları `includedOnlyMeshes` = ofis mesh'leri + içerideki aktörler; ova ışıkları
  `excludedMeshes` = aynı küme. Yeni sıcak ışıklar OVA tarafına girmeli (ofis mesh'lerini ve içerideki aktörleri hariç tutmalı) — yoksa
  ofis içini de aydınlatırlar. Bu bir birim testine bağlanır (K1-d).
- Stil eklentisi (`isikEklentisi.ts`) bütün ışıkların toplamını (`diffuseBase`) luma'dan bantlar ama RENGİ korur
  (`diffuseBase / luma × bant`). Tahmin: lambanın baskın olduğu yerde toon'da da sıcak ton kalır; koyu bantta `stilGolge` (gece dolgusu)
  karışır → lamba havuzunun kenarı soğuğa döner.
- Ufuk: uzak arazi (`assets/kaynak/ova-arazi.py`) tepe halkası 215–430 m, yükseklik 10–68 m; masa dağları 125–185 m; gök kubbesi 480 m,
  kameraya yapışık (`infiniteDistance`). Sis EXP2 0,0042: 450 m'de görünürlük exp(−(450·0,0042)²) ≈ %3 → sise giren bir şehir görünmez.
- Ufuk profili (glb'den hesaplandı, `ufukprofil.ts` karalama betiği; kamera 2.6,12 ve 1.6,1.9; azimut 0 = +z, 90 = +x): tepe silueti çoğu
  yönde 9–15° (455 m'de görünmek için 75–125 m gerekir), **geçitler**: 170–230° (≈2°, ofisin cam duvarının baktığı −z yönü), 40° (≈3°),
  300° (≈5°). Yani +z (kapıdan dışarı bakış) yönünde şehir yalnız yüksek kulelerin tepesiyle görünür; −z'de (cam duvar) geçitten görünür.

## Tasarım (uygulanacak; sayılar koşudan önce sabit)
Yeni katman level'dan BAĞIMSIZ, kodla kurulur: `world/level/ufuk/ufukSehri.ts` (SAF: bina listesi, geometri, renk sınıfları, gece
ağırlığı) + `world/level/ufuk/ufuk.ts` (Babylon: mesh'ler, ışıklar, `guncelle`, `yokEt`). Bağlama: `birlesikDunya.ts` (ofisin ova'ya
eklendiği yer); `ova.level.json` ve level tanımı DEĞİŞMEZ. `world/giris.ts`'te 1 satır: `?ufuk=0` okunur.
- **Gece ağırlığı** g = kırp(max(`dunya.gece`, 0,85 × `dunya.alacakaranlik`)). g ≤ 0,02 → katman kapalı (`setEnabled(false)`, ışıklar
  kapalı); arada lamba şiddeti ve pencere rengi g ile ölçeklenir, duvar rengi sis rengine solar. Zaman tanımsızsa g = 0.
  (Not: ova dosyasının saati 5,25 — şafak öncesi, g ≈ 1: düz açılışta da katman GÖRÜNÜR.)
- **(a) Sıcak anahtar ışık:** 2 sokak lambası, ofis terasında (plato düz yarıçapı 14 m), kapı yolunun iki yanında: L1 (0,9; 6,4) kapının
  önü, L2 (6,2; 13,4) terasın kenarı. Direk 4,6 m + 1,1 m kol (yalnız ışıklı malzeme, `malzemeKur` + stil eklentisi: lambanın kendi
  ışığını alır), başlık pişmiş sıcak `#ffb347`. Her biri için PointLight: renk `#ffb347`, şiddet 2,4 × g, menzil 12 m (Standard: doğrusal
  düşüş), kafanın 0,25 m altında. Gölge yok. Işıklar ova grubuna girer (ofis + içerideki aktörler hariç).
- **(b) Ufuk şehri:** TEK mesh (bütün halkalar, duvar + pencere + fener aynı çizimde; renk köşe renginde, sınıf başına renk tablosu değişince
  köşe renkleri yeniden yazılır). Pişmiş (ışıksız), sis KAPALI (atmosfer renkle taklit). `infiniteDistance` (gök gibi kameraya yapışık:
  480 m kubbenin içinde kalır, yürüyünce kubbenin arkasına düşmez). Taban y = −30 (göze göre; tepeler altını örter).
  Halkalar (yarıçap, tepe y aralığı, genişlik): 436 m [4, 42], 14–30 m · 451 m [12, 78], 14–28 m · 466 m [26, 125], 12–26 m; derinlik 10 m.
  Yoğunluk azimutla: taban 0,2 + 0,8 × tepe(195° σ35°, 15° σ25°, 300° σ20°); boy × (0,45 + 0,55 × tepe). 466 m halkasında 95 m'yi aşan
  binalara geri çekilmiş taç + ince kule + kırmızı fener. Pencereler yalnız merkeze bakan yüzde (kamera hep merkezde), 3,4 × 3,8 m ızgara,
  pencere 1,6 × 2,2 m, y > −4; yanma olasılığı halka başına 0,30 / 0,26 / 0,22 (+ %6 olasılıkla bütün kat yanık); tohumlu (deterministik).
  Renkler (gece sıcak paleti, katı paletin ilk 4 rengi): lamba `#ffb347`, pencere `#ffd27a` / `#ffb347` / `#ff8c42`, fener `#ff3b30`.
  Duvar = karıştır(palet r0, r1, 0,35) → sis rengine halka başına 0,22 / 0,42 / 0,60 (uzak halka soluk: atmosfer perspektifi); pencere
  parlaklığı 1,0 / 0,85 / 0,70. Sis rengi sahnenin O ANKİ sisi (`sahne.fogColor`): ofisin içinden bakınca ofis havasına, dışarıda ova'nın
  gece ufkuna uyar.
- **Stil çizgisi / GI:** şehir ve lamba başlıkları pişmiş → `cizgiyeUygun` onları zaten dışarıda tutar (gbuffer/RSM'e girmez); yine de
  şehre `metadata.cizgisiz` açıkça yazılır. Direkler ışıklı → çizgi ve GI'ye girer (ova'nın dekor lambaları gibi; tutarlılık).
- **Kapatma:** `?ufuk=0` → hiç kurulmaz. Varsayılan AÇIK olacak, ANCAK K2 bütçesi geçerse; geçmezse önce küçültülür (pencere/halka),
  yine geçmezse varsayılan kapatılır ve bu dosyaya yazılır.

## Ölçütler
- **K1 — birim testleri** (`world/level/ufuk/ufuk.test.ts`, `world/yer/birlesikDunya.test.ts`):
  (a) aynı tohum → aynı bina listesi (`deepEqual`), farklı tohum → farklı; (b) her bina halkasının yarıçap bandında, bütün köşeler
  kubbenin (480 m) içinde, taban y = −30; (c) gece ağırlığı: saat 22 → 1, saat 12 → 0, saat 5,25 → > 0,5; zaman yok → 0; Babylon
  tarafında g = 0'da şehir ve ışıklar kapalı, g = 1'de açık; (d) ışık ayrımı (NullEngine): lambaların ışığı ofis mesh'ini ve içerideki
  aktörü ETKİLEYEMEZ (`canAffectMesh` false), ova mesh'ini etkiler; ofis ışığı ova mesh'ini etkileyemez; (e) `?ufuk=0` okuması.
  Bozma testi: lambaları ova ışık grubundan çıkaran mutant (d)'yi kırmalı; gece ağırlığını yok sayan mutant (c)'yi kırmalı.
  `npm test` (bilinen TEK kırmızı: "ova bütün yerleşimleri dönüşsüz"), `npm run typecheck`, bekçiler yeşil; alt-sistem İSTİSNA listesi
  büyümez (yeni dosyalar Level alt-sisteminde, `ufuk.ts` Level'in kamu listesine).
- **K2 — bütçe** (`kapidene`, dist; dört ölçüm noktası: ofis içi cam duvar / ofis içi kapı / dışarıda ofise / dışarıda ova'ya):
  - Düz (ortam yok, stil standart, ova saati 5,25 → katman açık): **19/19**, her noktada çizim **≤ 220**, fps **≥ 60**; sonra − önce
    çizim artışı nokta başına **≤ +6**.
  - Saat 22 + standart: artış ≤ +6, çizim ≤ 220, fps ≥ 60.
  - Saat 22 + toon: artış nokta başına **≤ +10**, fps ≥ 60 (toon tabanı bütçeyi zaten aşıyor: 222/192/378/214, 17/19 — artış olarak
    değerlendirilir; 17/19 → 17/19 beklenir).
  - `?ufuk=0` (saat 22 + toon): çizim önce ile aynı (±1).
  - `ovadene` **7/7**.
  - Tahmin (önceden): şehir +1 çizim her yönde (halka mesh'i her bakışta görüş alanında), direk + başlık +0..2; toon'da direk gbuffer ve
    RSM'e de girer → +0..4. fps etkisi: 2 nokta ışık bütün ova malzemelerine (500 bin tutamlık çim dahil) piksel başına ek iş.
- **K3 — görüntü + piksel ölçüsü** (ORION_SS; saat 22, dünya ova, zaman durgun; `ORION_SORGU_EK="poz=…&ortam=saat:22,stil:<s>"`):
  Pozlar: **P1** `poz=2.6,12,0` (dışarıda, +z ova'ya bakış; L2 önde), **P2** `poz=2.6,12,180` (dışarıda, ofise ve kapıya bakış; L1
  kapıda, ofisin arkasında −z geçidi), **P3** poz yok (kapidene sonu: ofis içi 1.6,1.9, cam duvardan −z'ye). Stiller: standart (s), toon (t).
  Önce koşuları (kod değişikliğinden ÖNCE): P1s-A, P1s-B (gürültü), P2s, P3s-A, P3s-B (gürültü), P1t, P2t-A, P2t-B (gürültü), P3t; düz.
  Sonra koşuları: P1s, P2s, P3s, P1t, P2t, P3t; P2t + `ufuk=0`; düz; ovadene.
  Ölçü (`docs/olcum/isik-dili-2/piksel_olc.py`, PIL+numpy, 0–255; üstte HUD yazısı bulunan ilk 70 satır ve sağ üst rozet ölçüye girmez):
  - **S (sıcak bölge)** = ΔR > 25 VE Δ(R−B) > 20 olan pikseller (Δ = sonra − önce). Rapor: |S| (% piksel), S'de ortalama (R−B) önce ve sonra.
  - **G (soğuk gölge)** = önce luma alt %40 VE S dışı. Rapor: G'de ortalama (B−R) önce ve sonra.
  - **W (şehir ışık noktası)** = karenin üst %65'inde (satır 70'ten sonra) sonra'da R ≥ 140, R−B ≥ 50 olan ve önce'de R−B < 20 olan pikseller.
  - Gürültü: aynı ölçüler önce-A → önce-B çiftlerinde (P1s, P3s, P2t).
  **Tahminler:**
  - **T1 (sıcak ışık görünür):** P1 ve P2'de, iki stilde de: |S| ≥ %1 ve ≥ 10 × gürültü |S|; S'de sonra ort(R−B) ≥ +20; önce ort(R−B) ≤ 0.
  - **T2 (gölge soğuk kalır):** her çiftte G'de sonra ort(B−R) > 0 ve ≥ önce − 5.
  - **T3 (şehir görünür):** P2 ve P3'te iki stilde W ≥ 150 ve ≥ 5 × gürültü W. P1'de (+z, ufuk ≈ 9,5°) zayıf tahmin: W ≥ 30.
  - **T4 (ofis içi aydınlanmaz):** P3'te karenin alt %35'inde (ofis zemini/masa) ortalama |Δ| ≤ P3 gürültüsünün aynı ölçüsü + 1,5.
  - **T5 (kapatılabilir):** P2t `ufuk=0` sonra vs P2t-A önce: |S| ve W gürültü × 3 + %0,05 / 20 pikselin içinde.
  - Ek görüntü (ölçü yok, Ozyn için): ofis içinden pencereden bakış P3 (s ve t).

**Karar kuralı.** K1 + K2 geçerse varsayılan açık kalır. T1 ve T3 geçerse "görünür sıçrama" ÖLÇÜLDÜ sayılır (güzellik değil: sıcak/soğuk
zıtlığı ve ufukta ışık noktası piksel olarak var). T1 toon'da kalırsa: stil eklentisinin bant/gölge karışımı sıcak ışığı söndürüyor →
sonraki adımın konusu (ışık başına bant). T3 P1'de kalırsa: +z yönünde tepeler şehri örtüyor (önceden bilinen) — yerleşim kararı Ozyn'in.

**Sınırlar (önceden).** n = 1 görüntü/koşul (+ üç gürültü çifti); bölgeler fark ve eşikle (anlamsal maske değil); ekran efektleri (bloom,
ton eşleme, çizgi, GI) ölçüye karışır; pozlar önceden seçildi, görüntüye bakılmadan. Geliştirme sırasında görsel SAĞLIK koşuları
(lamba yerinde mi, şehir çiziliyor mu) yapılabilir; bunlar ölçüm değildir. Tasarım sayıları ölçüm koşularından önce değişirse
SONUÇLAR'da sapma olarak yazılır. VRAM bu adımda ölçülmez (şehir geometrisi köşe sayısıyla raporlanır).

## SAPMALAR (ölçüm koşularından ÖNCE, sağlık koşularından sonra yazıldı; önce koşuları bu sırada zaten alınmıştı)
1. **Halka yarıçapları ve boylar:** 436/451/466 m → **433/438/443 m**, derinlik 10 → **4 m**, tepe aralıkları [4,40] / [10,70] /
   [22,100], kule eşiği 95 → 80, taç/kule payı küçüldü. Neden (koddan, görüntüden önce): gök kubbesi düz yüzlü; en yakın yüz düzlemi
   469 m (gerçek geometriden ölçüldü). 466 m + 125 m boy 3B'de ~490 m → kubbe binaların tepesini keserdi. Birim testi bunu bekler.
2. **L2 konumu:** (6,2; 13,4) → **(5,6; 12,6)**: (6,2; 13,4) platonun düz yarıçapının (14 m) dışındaydı (birim testi yakaladı).
3. **Palet haritası sıcak koruması (yeni):** sağlık koşusunda (ölçüm değil, P2 standart) pencereler somon-pembe, lamba başlığı bej,
   lamba altı zeytin-gri çıktı. Neden: ova'nın `paletHaritasi` ekran shader'ı gece %75 güçle bütün kareyi MAVİ gece rampasına boyuyor —
   sıcak yerel ışık rampada kayboluyor. Sağlık koşusu sayısı (P2s önce → sonra, zemin bölgesi ort. RGB): (40, 68, 82) → (88, 121, 97);
   lamba şiddeti 2,4/menzil 12 ile 3,6/10 arasında fark yok (88, 121, 97 ↔ 88, 121, 97). Çözüm: `paletHaritasi` ayarına `sicakKoru`
   (0..1, varsayılan 0 → başka level'larda görünüş değişmez); gece oranıyla, R − B > ~0,04 olan pikseller haritadan korunur. Ova'da
   ufuk katmanı açıkken birleşik dünya yükleme anında tanıma `sicakKoru: 1` ekler (`ufukTanimi`; ova.level.json değişmez; `?ufuk=0`
   iken eklenmez → T5 kapatma tam). Lamba şiddeti/menzili ön kayıttaki değerlere (2,4 / 12) geri alındı.
   Sonuç beklentisi değişmedi; T1/T3 bu düzeltmeyle ölçülür. Sapma 3 olmadan koşulsaydı T1 sağlık koşusu sayısına göre KALIRDI
   (zemin R − B ≈ −9).

## SONUÇLAR (koşudan sonra eklendi, 2026-10-14)
Koşular: kapidene ortamı (`ORION_KAPIDENE=1 ORION_SMOKE=1 ORION_SMOKE_MS=62000`, dist; `3dorion.bat kapidene` ile aynı ortam değişkenleri,
ekran görüntüsü için ORION_SS ve ORION_SORGU_EK eklendi), görüntüler `docs/olcum/isik-dili-2/`. Önce koşuları kod değişikliğinden
ÖNCE (HEAD 55e1b16 + Ozyn'in commit dışı dosyaları, sonra koşularında da aynı). Ayrıca `3dorion.bat kapidene` ve `3dorion.bat ovadene`
bat üzerinden bir kez koşuldu. Şehir: 203 bina, 2647 pencere, 14 052 köşe (tek mesh), 2 lamba.

- **K1 GEÇTİ [TEST].** `world/level/ufuk/ufuk.test.ts` 20 test (deterministik bina listesi ve geometri; farklı tohum farklı; her
  halkada ≥ 30 bina, ≥ 500 pencere; bütün köşeler kubbenin en yakın yüz düzleminden (469 m) yakın; şehir 430 m'nin arkasında, taban
  −30; gece ağırlığı saat 22 → 1, 12 → 0, 5,25 → > 0,5, zamansız → 0; renk sınıfı gece 0'da sis rengi, 22'de pencere R > B, duvar
  B > R; `?ufuk=0`; palet haritası `sicakKoru` varsayılanı 0, `ufukTanimi` 1 ekler / Ozyn'in değerine dokunmaz / girdiyi değiştirmez;
  Babylon: gündüz kapalı, gece açık ve şiddet tam, eşik altında yeniden kapanır, menzil/renk, şehir `cizgisiz` + kameraya yapışık).
  `world/yer/birlesikDunya.test.ts` +4 (NullEngine: lambalar ofis mesh'ini ve içerideki aktörü etkileyemez, ova mesh'ini etkiler;
  ofis ışığı yalnız ofis + içerideki; lambalar ofisin dışında ve platoda). Bozma testleri (dosya yedekli, `git checkout` yok; taban
  30/30 yeşil): M1 lambaları ova grubundan çıkarmak → 1 test kırıldı ("lambalar ofisi … AYDINLATMAZ"); M2 gece ağırlığı = 1 → 3 test
  kırıldı; M3 `sicakKoru` eklenmez → 1 test kırıldı; yedekten geri yüklendi, dosyalar birebir, 30/30.
  `npm test` 3633 test, tek kırmızı bilinen "ova bütün yerleşimleri dönüşsüz"; `npm run typecheck` temiz; mimari/bağımlılık/tip kaçışı/
  alt-sistem bekçileri 28/28 (İSTİSNA listesi değişmedi; `world/level/ufuk/ufuk.ts` Level'in kamu listesine eklendi).
- **K2 — bütçe [ÖLÇÜLDÜ]** (dört nokta: ofis içi cam / ofis içi kapı / dışarıda ofise / dışarıda ova'ya; çizim, fps):

  | koşu | önce | sonra | artış | özet önce → sonra |
  |---|---|---|---|---|
  | düz (ortam yok, saat 5,25, katman açık) | 168 / 132 / 193 / 77 | 169 / 137 / 198 / 82 (bat ile aynı) | +1 / +5 / +5 / +5 | 19/19 → 19/19 |
  | 22 + standart (P2s, P3s, P1s tekrarı) | 168 / 132 / 190 / 74 (×4 aynı) | 169 / 137 / 195 / 79 | +1 / +5 / +5 / +5 | 19/19 → 19/19 |
  | 22 + standart, P1s ilk koşu | 168 / 132 / 190 / 74 | 169 / **143** / 169 / 79 | +1 / **+11** / −21 / +5 | 19/19 → 19/19 |
  | 22 + toon (P1t, P2t, P3t) | 222 / 192 / 378 / 214 | 223–224 / 193–198 / 388 / 224 | +1..2 / +1..6 / +10 / +10 | 17/19 → **16/19** |
  | 22 + toon + `ufuk=0` | 222 / 192 / 378 / 214 | 222 / 192 / 378 / 214 | 0 | 17/19 → 17/19 |

  fps: standart/düz her noktada 100; toon "dışarıda ofise" 81–89 önce, 87–89 sonra; en düşük 87 → **fps ≥ 60 GEÇTİ**. Çizim ≤ 220
  standart/düz'de her koşuda GEÇTİ. Artış ölçütü: düz GEÇTİ (+5 ≤ +6), toon GEÇTİ (en çok +10 ≤ +10, sınırda), `ufuk=0` GEÇTİ (0).
  Standart: 3 koşudan 2'si GEÇTİ; **P1s ilk koşusu KALDI** (kapıya bakış +11 > +6; aynı koşuda ofise bakış −21: sahne durumu oynamış —
  aynı ayarla tekrar koşusu +1/+5/+5/+5). Önceden beklenmeyen: toon'da "dışarıda ova'ya" 214 → 224 bütçeyi (220) aştı; toon bu
  ölçüm noktasında artık 16/19 (beklenen 17/19 idi). Toon'un bütçesi tabanda zaten aşıyordu (222, 378); karar kuralı gereği varsayılan
  AÇIK bırakıldı (standart/düz'de bütçe içinde); toon bütçesi ayrı iş.
  `ovadene` (bat): **7/7**.
- **K3 — piksel ölçüsü [ÖLÇÜLDÜ]** (`piksel_olc.py`; gürültü en büyük: |S| %0,046, W 41):

  | çift | \|S\| | S'de R−B önce → sonra | G'de B−R önce → sonra | W | alt %35 \|Δ\| |
  |---|---|---|---|---|---|
  | P1s | %32,7 | −44,4 → **+74,4** | 51,1 → 49,4 | 690 | 62,2 |
  | P2s | %35,5 | −41,4 → **+67,1** | 41,9 → 42,2 | 2759 | 48,9 |
  | P3s (ofis içi) | %0,25 | −56,8 → +93,5 | 24,7 → 24,7 | 1632 | **0,31** |
  | P1t | %39,2 | −65,4 → **+97,2** | 82,1 → 76,9 | 23 212* | 67,9 |
  | P2t | %11,0 | −34,7 → **+77,4** | 68,7 → 79,6 | 1967 | 38,8 |
  | P3t (ofis içi) | %0,25 | −61,4 → +78,4 | 24,9 → 24,9 | 1147 | **0,35** |
  | P2t `ufuk=0` | %0,05 | — | 68,8 → 68,8 | 0 | 0,25 |
  | düz (ek, tahminsiz) | %0,03 | −19,5 → +26,3 | 18,2 → 18,3 | 45 | 0,37 |

  - **T1 GEÇTİ** (P1s, P2s, P1t, P2t): lamba ışığının düştüğü bölge önce mavi (R−B −35..−65), sonra sıcak (+67..+97); |S| %11–39.
  - **T2: 5/6 GEÇTİ, P1t KALDI** (G'de B−R 76,9 < 82,1 − 5 = 77,1; 0,2 farkla). Gölge bölgeleri sonra da soğuk (B−R > 24 her çiftte).
  - **T3 GEÇTİ** (P2, P3 iki stilde W 1147–2759 ≥ 205; P1'de 690 / 23 212 ≥ 30). *SINIR: W "karenin üst %65'inde sıcak piksel"
    — P1/P2'de lamba ışığının boyadığı çim de üst %65'e giriyor; oralarda W pencere sayısı DEĞİL. Temiz pencere ölçüsü yalnız P3'te
    (lamba görünmüyor): 1632 (standart) / 1147 (toon) piksel.
  - **T4 GEÇTİ**: ofis içinden bakışta karenin alt %35'i (zemin, masa) |Δ| 0,31 / 0,35 ≤ 3,71 — lamba ofisi aydınlatmıyor.
  - **T5 GEÇTİ**: `ufuk=0` önce ile ayırt edilemez (|S| %0,055 ≤ %0,189, W 0, çizim aynı).
- **Karar kuralına göre:** K1 geçti; K2 standart/düz'de bütçe içinde (bir koşu artış ölçütünü +11 ile aştı, tekrarında +5), toon'da artış
  sınırda ve "ova'ya bakış" noktası 220'yi aştı → varsayılan AÇIK, toon bütçesi ayrı iş. T1 + T3 geçti → "görünür sıçrama" piksel
  olarak VAR (sıcak/soğuk zıtlığı ve ufukta ışık noktası). Güzel olup olmadığı Ozyn'in kararı.
- **Görsel gözlem (ölçü değil, Ozyn'in bakması için):** L2 pozun 3 m yanında olduğu için P1/P2'de bütün ön plan (çim) lambayla
  aydınlanıyor — "havuz" kenarı görünmüyor; standartta çim sarı-yeşil, toon'da altın-turuncu. Gece hissi ön planda azaldı. Şehir P1'de
  (+z, tepeler ≈ 9,5°) yalnız birkaç kule tepesi, P2/P3'te (−z geçidi) geniş siluet + pencereler.
- **Yan yana çiftler:** `once-P1s-A.png` ↔ `sonra-P1s.png` · `once-P2s.png` ↔ `sonra-P2s.png` · `once-P3s-A.png` ↔ `sonra-P3s.png`
  (ofis içinden pencere) · `once-P1t.png` ↔ `sonra-P1t.png` · `once-P2t-A.png` ↔ `sonra-P2t.png` · `once-P3t.png` ↔ `sonra-P3t.png`
  (ofis içinden, toon) · `once-P2t-A.png` ↔ `sonra-P2t-ufuk0.png` (kapatma) · `once-duz.png` ↔ `sonra-duz.png` (saat 5,25).
  Gürültü çiftleri: `once-P1s-A/B`, `once-P3s-A/B`, `once-P2t-A/B`; P1s tekrarı `sonra-P1s-B.png`.
- **Bilinen sınırlar:** şehir kameraya yapışık — ofisten çok uzağa (≳ 25 m) yürüyünce tepe halkasının dış bandı şehrin ARKASINA düşebilir
  (yerleşimde kare kare bakılmadı). Lamba ışığı ofisin dış duvarını da aydınlatmaz (ofis mesh'leri iç/dış ayrılmıyor). Işıkların
  açılıp kapanması malzemeleri yeniden derletir (yalnız eşik geçişinde). Akan zamanda alacakaranlık geçişi canlıda koşulmadı
  [YAZILDI-KOŞULMADI]; VRAM ölçülmedi.
