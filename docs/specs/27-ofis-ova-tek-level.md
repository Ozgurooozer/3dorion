# 27 — Ofis ve ova TEK level (Ozyn, 2026-10-13)

**Karar (Ozyn):** "ofisin dış duvarlarını da yapıp neden ovaya koymuyoruz; ofis ovaya taşınsın, iki ayrı level olmasın,
tek level olsun." Bugün iki ayrı dünya var: kodla kurulan ofis (`world/level/oda.ts`, orijinde, 10×8×3,2 m) ve level
dosyasıyla kurulan ova (`world/level/ova/ova.level.json`); kapıdan geçince ofis GİZLENİR, ova KURULUR (`world/yer/levelSahnesi.ts`),
dönüşte ova YIKILIR. Hedef: ofis ova'nın içinde bir bina, kapıdan geçmek yalnız yürümek; kararma, yıkım/kurma, ikinci `Yer` yok.

## 1. Bulgular (kod okuyarak; ölçüm yoksa açıkça [OKUNDU])
- [OKUNDU] Ofis: `oda.ts` 522 satır; yüzeyler (`DynamicTexture`: monitör, tahta, şema, günlük) ve ışıklar (1 hemisferik + 2 yönlü
  + 4 noktasal, gölge yok) KODLA; kabuk ve eşya `assets/oda-esyalar.glb`. Hepsi `olculer.ts`'teki orijin-mutlak koordinatlara bağlı
  (taşıma ofseti yok). Level modül sözleşmesi (`modul.ts`) yüzey ya da noktasal ışık tutamacı vermiyor → ofisin içi level
  nesnelerine ÇEVRİLEMEZ; kodla kalır, ova'nın İÇİNE konur.
- [OKUNDU] Sahne geneli ayarlar tek değer: sis (ofis mor `EXP2` 0,035; ova açık 0,0042) ve `clearColor`. İkisi aynı anda olamaz.
- [OKUNDU] Işık çakışması: ofis yönlü ışıkları menzilsiz, ova'yı da aydınlatır; ova güneşi ofisin malzemelerini de aydınlatır
  (`maxSimultaneousLights = 8`). Çözüm adayı Babylon'da hazır: `light.includedOnlyMeshes` (ofis ışıkları yalnız ofis mesh'lerini),
  `light.excludedMeshes` (güneş ofis mesh'lerini hariç tutar).
- [OKUNDU] Çim/kaya/dekor ofisin altından da büyür. Kaya (`icYaricap` 6) ve dekor (`icYaricap` 10) merkezi zaten boş bırakıyor;
  ÇİM bırakmıyor (merkezde en yoğun). `maske` verisi (arazi fırçası: hücre → 0–1 seyreltme) veri olarak çim dışlamayı ifade eder:
  kod değişikliği gerekmez.
- [ÖLÇÜLDÜ, spec 24 §2] Gizli bırakılan ova ofisi 45 → 90 çizime çıkardı (kademeli gölge `autoCalcDepthBounds`), VRAM 1,43 → 1,59 GB.
- [OKUNDU] `ova.level.json` Ozyn'in commit dışı düzenlemesi: HEAD'de `ofis` bina nesnesi (`CORP_BLD_OfficeBlock_MD`, [-2,-0.2,22]) ve
  ona bakan geçit vardı; çalışma kopyasında bina yok, geçit boşluğa bakıyor olabilir. **Bu dosyaya DOKUNULMAZ**; ofisin ova'daki
  yeri Ozyn'in kararı (aşağıda "Açık").

## 2. Aşamalar (her aşama kendi ölçütüyle; bir aşama geçmezse durulur)
- **A (spike, ölçüm; kod commit'e GİRMEZ):** ofis ve ova AYNI sahnede, ofis gizlenmeden. Ne bozuluyor, düzeltmeler yetiyor mu? (§3)
- **B:** `levelSahnesi` gizle/göster mantığı kalkar; ışık/sis eşiği; ofis dış duvarları/çatısı (bina dışı görünüm).
- **C:** tek `Yer`: `ODA_YERI` + `levelYeri` birleşir; `kapi` çapası çözülür (iki kapı: ofis dış kapısı); `yerSabitBilgisi` ve
  `yerOrtasiSozu` metni (istem ölçümleri bu metne dayanıyor → f0 yeniden); `ovadene`/`kapidene`/`gozdene` senaryoları ve
  `tools/ogretmen.ts SABIT`.
- **D:** geçit/kararma kodu silinir (`kapidanGec`, `gecitler`, `levelSahnesi`), testler güncellenir.

## 3. AŞAMA A — spike ön kaydı (koşudan ÖNCE, 2026-10-13)
**Düzenek.** Tam uygulama (avatar + yüzeyler canlı), RTX 4060, Electron. Spike bayrağı `?tekseviye=<mod>` (yalnız çalışma kopyasında,
commit'e girmez): `ham` = ova ofisle yan yana, ofis gizlenmez, başka önlem yok; `onlem` = aynı + (1) ofis ışıkları
`includedOnlyMeshes = ofis mesh'leri`, (2) ova güneşi/dolgusu `excludedMeshes = ofis mesh'leri`, (3) çim `maske` ile ofis ayak
izi (x ±7, z ±6) dışlanır, (4) sis ova'nınki (tek değer, değiştirilemez). Ova tanımı `ova.level.json`'un OKUNMUŞ kopyasıdır
(dosya değişmez). Taban: spike kapalı, yalnız ofis (`tekseviye` yok).
**Ölçüler.** (a) fps: 10 sn ortalaması, ofis içinde sabit kamera; (b) çizim sayısı (`SceneInstrumentation.drawCallsCounter`);
(c) ofis içi parlaklık: aynı kamera/zaman, spike'lı ve spike'sız ekran görüntüsünün ortalama luma farkı (PIL);
(d) görsel yargı (ekran görüntüsü): ofis zemininde çim sapı var mı, ova ofisten görünüyor mu, ofis dışarıdan görünüyor mu.
**Ölçütler (`onlem` modu için; `ham` yalnız TEŞHİS).**
- K1 fps ≥ 60 ve taban − 15 %'inden az düşüş değil.
- K2 çizim sayısı ≤ 150.
- K3 ofis içi ortalama luma değişimi ≤ %10 (güneş/ova ışığı içeri sızmıyor, oda ışıkları ova'yı aydınlatmıyor: ekran görüntüsünde
  ova yüzeyleri ofis ışıklarıyla boyanmıyor).
- K4 ofis zemininde çim sapı YOK (görsel).
- K5 BİLGİ (kapı değil): mor ofis sisi kaybolur (tek sis değeri); Ozyn'in estetik kararı, ekran görüntüleriyle sunulur.
**Karar kuralı.** K1–K4 geçerse B aşaması planlanır ve Ozyn'e ekran görüntüleriyle sunulur; biri kalırsa neden yazılır ve ek önlem
gerekiyorsa Ozyn'e sorulur (kodda sessiz ayar yok). `ham` modunun sonucu (neyin bozulduğu) her durumda yazılır.

## 4. Açık (Ozyn'in kararı) — spike sonrası güncel liste §6'da
1. Ofisin ova'daki yeri: orijin (düz alanın ortası, bugün ova orijinde) mi, bina HEAD'deki gibi (-2, 22) civarında mı? Ofis
   koordinatları mutlak olduğundan "taşımak" ofisi değil ova'yı kaydırmak demek; en ucuz yol ofisi orijinde bırakıp ova'nın
   içeriğini ona göre düzenlemek. `ova.level.json` senin dosyan: değişikliği sen yapar mısın, ben mi (yedekle + sor)?
2. Yeşil harabe aynı level'a mı girecek, ayrı kalacak mı?
3. Ofisin mor sisi/ışığı korunacak mı (bölgesel sis için ek iş: post-process ya da kapı eşiğinde anahtarlama) yoksa ova'nın havası
   ofise de mi gelecek?

## 5. AŞAMA A — spike SONUÇLARI (2026-10-13/14, tek koşu = yön göstergesi; kod `docs/olcum/spike-tekseviye-blok.ts.txt`, ekranlar `docs/olcum/spike-tekseviye/`)
Tam uygulama, RTX 4060, ekran 100 Hz (fps tavanı 100: "≥ 60" geçildi ama başlık payı ölçülemedi). Ova tanımı dosyadan okunmuş kopya (dosya değişmedi).

| ölçü | taban (yalnız ofis) | `kapı` (bugünkü: ofis gizli, ova kurulu) | `ham` (ofis+ova yan yana) | `önlem` (ışık ayrımı + çim maskesi) |
|---|---|---|---|---|
| fps | 100 | 100 | 91–100 | 100 |
| çizim sayısı | 37–48 | 105 | 176–210 | 141–160 (kamera yönüne göre) |
| ofis zemininde çim | yok | — | **VAR** (zeminden bitiyor) | yok |

- **K1 fps ≥ 60: GEÇTİ** (100; tavan olduğu için başlık payı bilinmiyor).
- **K2 çizim ≤ 150: KALDI.** `önlem` 141–160, `ham` 176–210. Bugünkü kapı tasarımının ova hâli 105; ofisi gizlemek yerine açık bırakmak ≈ +40–55 çizim.
  Önceden yazdığım sınır (150) spec 24'ün oda 46 + ova 104 toplamından; avatar/yüzeyler dahil gerçek toplam daha yüksek çıktı.
- **K3 ofis içi görünüm değişmez: KALDI, YAPISAL NEDENLE.** Parlaklık karşılaştırması (PIL) kamera yönü koşular arasında tutmadığı için
  GEÇERSİZ sayılır (ekran görüntüleri farklı duvara bakıyor). Geçerli olan deterministik ölçü: ova kurulunca SAHNE GENELİ ayarlar değişiyor:
  | ayar | önce (ofis) | sonra (ova eklenince) |
  |---|---|---|
  | kontrast | 1 | 1,1 |
  | ton eşleme (ACES) | kapalı | açık |
  | sis (EXP2) | 0,035 (mor) | 0,0042 (açık) |
  | arka plan (`clearColor`) | #030206 | #CD94A1 |
  | kamera son işlemi | 0 | **7** (bloom, GI, AO … ova'nın stili) |
  Yani ışık ayrımı (`includedOnlyMeshes`/`excludedMeshes`) ışık sızmasını çözdü ama ofisin görünümünü sahne geneli ton/sis/son işlem
  değiştiriyor: `ham` ekranında ofis soluk ve parlak (ekran: `spike2-ham.png`), `önlem`de yumuşak ama ova'nın tonuyla.
- **K4 zeminde çim yok: GEÇTİ** (`önlem`: `maske` verisiyle; kod değişikliği gerekmedi) — `ham`'de çim ofisin içinde (ekran: `spike-ham.png`).
- **K5 (bilgi): mor ofis sisi ve koyu arka plan KAYBOLUYOR** (yukarıdaki tablo). Estetik karar: aşağıda "Açık".
- **Ek bulgu — ofis DIŞARIDAN:** ofisin dış yüzü yok. Dışarıdan bakınca yalnız pencere manzarası düzlemi (siberpunk şehir resmi) çimde
  asılı duruyor (`spike-onlem-dis.png`); duvarlar tek yüzlü (içe bakıyor). Dış duvar/çatı/kapı yapılacak (Ozyn'in "dış duvarları da yapıp"
  dediği iş) — spike bunu gerekli kılıyor, ölçmüyor.

**Karar kuralına göre:** K2 ve K3 kaldı → B aşaması bu hâliyle BAŞLATILMAZ. Ölçümün gösterdiği iki iş, ikisi de ek tasarım ister:
1. **Görünüm geçişi ("look blending").** Ofis ve ova iki ayrı görünüm: sis, arka plan, pozlama/kontrast, ton eşleme ve 7 son işlem.
   Bugün kapıdaki kararma bunu örtüyor. Tek sahnede eşikte (kapıdan geçerken, ~1–2 m) bu değerleri ofis ↔ ova arasında yumuşakça
   geçirmek gerekir; sayısal değerler (sis, arka plan, pozlama, kontrast) ucuzca lerp edilir, son işlem efektleri ise açılıp kapanır
   (zincir yeniden kurulur: takılma riski; `stilSistemi.ts` imzası). Bu ayrı bir spike: 1) eşik yakınında lerp, 2) son işlem
   efektlerinin ofiste kapalı olması kabul edilebilir mi?
2. **Çizim bütçesi.** 141–160 çizim (önlem) → ≤150 için ofis dışında kalan ova parçaları (kaya/dekor/çim aralığı) uzaktan seyreltilir ya
   da ofis içindeyken ova'nın uzak katmanları gizlenir (ofis kapalı bir kutu: içerideyken dış neredeyse görünmüyor, yalnız pencereden).
   Ölçülmüş bir ucuz kazanç: ofis içindeyken ova çim/dekor/kaya `setEnabled(false)` (kapıdan çıkınca açılır) — spike 2'de ölçülür.

## 6. Ozyn'e sorular (spike sonrası)
1. **Ofisin ova'daki yeri** (bölüm 4/1): orijin mi, HEAD'deki (-2, 22) mi? `ova.level.json` senin dosyan: ofis için gereken veri (çim maskesi, ofis
   ayak izi, geçit) senin eline mi bırakılsın, ben yedekleyip mi yapayım?
2. **Görünüm:** ofiste mor sis/koyu hava, dışarıda ova'nın açık havası olsun, aralarında kapı eşiğinde yumuşak geçiş (öneri) mi; yoksa ofis de ova'nın
   havasını mı alsın (en ucuz, ofisin gece/mor estetiği gider)?
3. **Çizim bütçesi:** 150 sınırını koruyalım mı, yoksa (fps 100'de sorun yok) 220'ye mi çıkaralım? 220 olursa K2 geçer; yalnız zayıf ekran kartında
   riske girilir.
4. Yeşil harabe aynı level'a mı girecek, ayrı mı kalacak?

## 7. KARARLAR VE UYGULAMA (2026-10-14) — ofis ova'nın içinde, tek level
Ozyn'in cevapları: çizim sınırı **220** (sorun yok); ofis **özel, güzel ve biraz yüksekte bir düzlüğe** (plato); pencereden **gerçek ova**;
kapıdan ışınlanma YOK, **kapı açılır kapanır** (ışınlanma kodu köşeye, ileride ışınlanma için); yeşil harabe başka arşivde beklesin;
**ofis olduğu gibi, ova olduğu gibi** (iki görünüm korunur).

| iş | nerede | durum |
|---|---|---|
| plato (düz, ofisten 5 cm aşağı; çevresi 3 m çöker; uzakta doğala döner) | `moduller/zemin.ts`, `level/ofisYeri.ts` | [TEST] 11 test + mutasyon |
| ova DOSYASI değişmez; yerleştirme yüklemede koddan (çim maskesi, kaya/dekor iç yarıçapı, y'li yerleşimler ve su kayar, geçit ve eski bina kalkar) | `level/ofisYeri.ts` | [TEST] |
| kapı: menteşede dönen kanat, açma 2,2 m / kapama 3,4 m (histerezis), çarpışmada kanat yok | `level/odaKapisi.ts`, glb kanatsız üretildi (`--kapi-kanadi` eski hâl) | [TEST] + [ÖLÇÜLDÜ] canlı |
| tek `Yer`: ova + ofis duvarları (ön duvarda kapı boşluğu) + ofis mobilyası, tek çapa listesi; ofis içi y=0 | `yer/birlesikYer.ts` | [TEST] 7 test; yol bulma kapıdan geçer |
| tek sahne, açılışta kurulur; ışık ayrımı (ofis ışıkları yalnız ofis + içerideki aktörler; ova ışıkları ofisi hariç tutar) | `yer/birlesikDunya.ts` | [ÖLÇÜLDÜ] ekran görüntüleri |
| görünüm geçişi: ofiste ofis (mor sis, koyu), dışarıda ova (açık sis, ton eşleme, 7 efekt), kapı önünde 3 m'de yumuşak karışım; efekt zinciri orta noktada | `yer/birlesikDunya.ts` (`icFaktoru`, `gorunumKaristir`) | [TEST] 6 test; [ÖLÇÜLDÜ] sis dizisi |
| pencere gerçek ova'ya bakar (sahte şehir resmi ve yağmur gizli) | `oda.pencereyiAc()` | [ÖLÇÜLDÜ] ekran |
| ışınlanma kodu köşede (`isinlanmaOvayaCik/OdayaDon`, `levelSahnesi.ts`); hiçbir yol çağırmaz | `world/giris.ts` | `window.dunya.kapidanGec` hata ayıklama |

**Canlı doğrulama [ÖLÇÜLDÜ], `3dorion.bat kapidene` (yeniden yazıldı), 19/19:** tek yer; ofiste mor sis (0,035), dışarıda açık (0,0042), eşikte
ara değer; kapı Ozyn yaklaşınca açılır, uzaklaşınca kapanır; Orion ofisten kapıdan YÜRÜYEREK çıktı ve geri girdi (kapı onun için açıldı);
**çizim sayısı 77–193 (bütçe 220), fps 100.** `ovadene` 7/7 (Orion dışarıdaki Ozyn'a kapıdan çıkıp geldi, ofisin etrafından dolanıp takip etti,
kapıdan girip sandalyeye oturdu). `ortamdene` ofiste de çalışır. Ekran görüntüleri: ofisin içinden cam duvardan ova (gün batımı), dışarıdan
ofis (cam duvar parlıyor), kapı kapalı ön yüz.

**Bilinen sınırlar / açık:**
- Efekt zincirinin eşiğin ortasında açılıp kapanması ufak bir takılma yapabilir (zincir yeniden kurulur); gerçek yürüyüşte kare kare izlenmedi.
- Işık üyeliği aktör başına ~5 Hz güncellenir (kapıdan geçerken bir iki karelik yanlış aydınlatma olabilir).
- Ofisin DIŞ yüzü yalın duvar + parlayan cam (kapı ve neon çizgisi var): "güzel bina" görsel işi (kaplama, saçak, çatı) yok.
- Işın (görüş hattı) ofisin duvarlarını katı sayar: kapı açıkken bile dışarıdaki nesneler ofisten `gordum` ile görünmez (cam duvar dahil).
- `gozdene` (görme ölçümü, spec 25) iki ayrı yer (oda/ova) varsayıyordu: tek yer olunca B2 ("öbür yerin adı yok") ve poz üretimi anlamsız;
  yeniden tasarlanmalı (ACIK-ISLER).
- Yeşil harabe yükleyicisi (`?level=harabe`) ışınlanma köşesinde; harabe varlıkları commit'siz, Ozyn'in kararıyla ayrı arşivde bekliyor.
