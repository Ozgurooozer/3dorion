# Ön kayıt — GI SPIKE 1: "Işık Hacmi" (otomatik dinamik GI, yalnız ofis, `?gi=hacim`) (2026-10-14, ölçüm koşusundan ÖNCE)

Kaynak: `docs/arastirma/gercek-zamanli-gi-2026-10-14.md` §4 (önerilen "Işık Hacmi", spike 1 ölçütleri),
`babylon-github-gi-2026-10-14.md` (Babylon'da hazır Lumen yok), `isik-dili-kararlari-2026-10-14.md` (DÜZELTME: asıl hedef otomatik
dinamik GI). Ozyn'in hedefi: "Ben Lumen gibi bir sistem istiyorum, HAZIR. Biz ışık verince aynı anda realtime çalışacak."
Görsel karar Ozyn'in; ben "güzel" demem — yan yana dosya adları ve piksel ölçüsü veririm.

## Bu ön kayıttan önce yapılanlar (ölçüm DEĞİL, açıkça)
- Kod yazıldı (tasarım aşağıda), birim testleri yeşil (31 test).
- 3 sağlık koşusu: (1) `gi=hacim` ile açılış: shader derleme hatası yok, kurulum 316 ms, ızgara 110×43×94, 54 818 dolu voxel, 30 malzeme,
  28 malzemeye eklenti, fps 100 (HUD; ölçüm değil); (2) `gikip=1` "yalnız GI" görünümü: ofisin dolaylı ışığı görünür (neon pembesi
  tavanda/duvarda, kırmızı koltuğun yanındaki duvarda kırmızı leke) — mekanizmanın çalıştığını gösterir, sayı alınmadı;
  (3) keşif (`gikesif=1`): ofis mesh'lerinin dünya kutuları ve ışıklar (aşağıdaki konumlar bundan). K2 deney düzeneği (test ışığı,
  ışıyan kutu) hiçbir koşuda KURULMADI; ROI'lere hiç bakılmadı.

## Teşhis doğrulaması (koddan, koşudan önce)
- Ofisin içinde efekt zinciri kapalı (`birlesikDunya.ts` ic ≥ 0,5 → `sonrasiAtla(true)`, GIRSM dahil) → GI zincirden BAĞIMSIZ olmalı:
  bu yüzden ekran uzayı geçişi değil MALZEME EKLENTİSİ seçildi (aşağıda).
- Ofis ışıkları 7 (yarıküre + 2 yönlü + 4 nokta) + ova ışıkları 4 (güneş/ay, gök dolgusu, 2 ufuk lambası) = 11 ışık sahnede.
  Ofis malzemeleri `maxSimultaneousLights = 8` (`odaEsyalari.ts`; ova ışıkları ofisi `excludedMeshes` ile görmez → ofis mesh'i 7 ışık
  görür). Konsoldan eklenen bir ışık 8. olur (sığar); 9.'sunun DOĞRUDAN ışığı Standard/PBR'da sessizce düşer — GI'nin kendi dizisi 16
  (fazlası sayılır, `[GI]` uyarısı). GI ışıkları üyelik listesine BAKMAZ: görünürlük voxelde.
- **Ofisin albedoları çok koyu** (keşif): sıva 0,08/0,06/0,10, lambri 0,09/0,05/0,04, zemin dokusu ort. 0,08/0,05/0,03, tavan
  0,04; açık renkli tek büyük yüzey TAHTA (`tahta_yuzey`, Standard, doku `#f2f4f1` ≈ 0,94, ışıma 0,35; x = −4,91, y 0,9–2,4,
  z −1,8–1,0, normal +X). Diğer açık yüzeyler küçük (kâğıt 0,82, pirinç). Dolaylı ışık = yansıtan yüzeyin albedosu × ışık: bu ofiste
  sekme ZAYIF olacak (fizik, yöntemin kusuru değil) — K2 tahminlerim buna göre düşük.

## Tasarım (uygulandı; neden)
`world/level/gi/` (Level alt-sistemi; kamu dosyası `isikHacmi.ts`):
1. **Voxelleme, BİR KEZ, CPU** (`isikHacmiCekirdek.ts`, saf): birleşik dünya kurulunca ofisin açık/görünür/opak mesh'leri (42 mesh,
   14 356 üçgen) 0,1 m voxellere örneklenir (üçgen başına ≤ 5 cm afin örgü): doluluk, ortalama albedo (renk × doku ortalaması),
   ortalama normal, malzeme kimliği (ışıyan malzeme öncelikli). Neden GPU değil: ofis statik, iş bir kez ve ~300 ms; CPU yolu saf
   çekirdek olarak birim testlenebilir (K1) ve Babylon'un iç `_IblShadowsVoxelRenderer`'ına bağlanmayı gerektirmez.
2. **2B atlas, 3B doku değil**: WebGL2'de 3B dokuya yazmak katman başına (43) ya da 8'li MRT ile ≥ 6 çizim ister; y dilimlerini yan
   yana koyan 2B atlas her geçişte TEK çizim (rapor §4'ün "atlas düzeni" yedeği). Bedeli: dilimler arası trilineer elle (2 okuma).
3. **Her kare 5 tam ekran geçiş** (`isikHacmiGlsl.ts`): ENJEKSİYON (dolu voxel: albedo × Σ ışık + ışıma; ışıklar her kare
   `scene.lights`'tan baştan, görünürlük voxel içinde ışın yürütme ≤ 128 adım; nokta ışığın 2 voxellik armatür payı; malzeme ışıması
   her kare okunan 256'lık tablodan) → 3 MİP (2×2×2 ortalama, 0,2/0,4/0,8 m) → TOPLAMA (dolu + yüzey-yakını voxelde 6 eksen yönünde
   30°'lik koni; kaba hücrede doluluk düzeltmesi 1 − (1 − a)^(2^L)). Çok sekme: önceki karenin ışınımı × albedo enjeksiyona eklenir.
4. **Uygulama: malzeme eklentisi** (`giEklentisi.ts`), ekran uzayı değil: ofis malzemelerine (Standard: `diffuseBase += gi`; PBR:
   `finalDiffuse += gi × surfaceAlbedo`) pikselde ortam küpü (3 yön × 2 okuma). Neden: ek çizim yok, ekran boyu doku yok (VRAM),
   efekt zinciri kapalıyken de çalışır, ekran dışını bilir. Bedeli: ışınım hacmi 0,1 m — ince ayrıntı yok.
5. **Bırakılan / ertelenen**: koni izlemenin pikselde (çeyrek çözünürlük) yapılması (toplama voxel başına yapıldığı için gereksiz);
   aktörlerin GI alması/vermesi; kapı kanadının hareketi (voxelde KAPALI donar); ova kademeleri (spike 3); stil bantlamasıyla birleşim
   (spike 2; ofiste stil eklentisi yok — GI eklentisinin önceliği 220 > stil 210, yani bant GI'yi GÖRMEZ, not); renk uzayı dönüşümü
   (Standard gama, PBR doğrusal; Babylon GIRSM de yapmıyor).
- Hesaplanan VRAM (doku boyutlarından, ÖLÇÜM DEĞİL): statik 2 × RGBA8 660×752 (3,8 MiB) + ışıma L0..L3 RGBA16F (≈ 4,4 MiB) + ışınım
  6 blok RGBA16F 1980×1504 (22,7 MiB) + tablo → **30,8 MiB**.

## Ölçütler (önceden; eşikler görevden, sayılar burada sabit)

### K1 — birim testleri [TEST]
`world/level/gi/isikHacmiCekirdek.test.ts` (24) + `world/level/gi/isikHacmi.test.ts` (7): voxel indeksleme ve atlas tekseli tek/sınır
içi/geri çözülür; voxelleme (kare → tek dilim 100 voxel, normal, albedo, dünya matrisi, ışıyan malzeme önceliği, belirsiz normal);
ışık → voxel enjeksiyonu (nokta düşüşü 1 − d/menzil, menzil dışı 0, gölge, armatür payı, yönlü/yarıküre çatı altında 0, spot konisi,
ışıma tablosu, sekme); mip/örnekleme; koni (ışıyan duvarın ≥ %40'ı görülür, ters yön 0, renk oranı korunur, araya giren perde < %25'e
indirir); renkli sekme uçtan uca (beyaz ışık + kırmızı duvar → beyaz zeminde R > 2B; beyaz duvarla R = B); `?gi=hacim` bayrağı (yokken /
başka değerde KAPALI); GLSL'in CPU referansıyla aynı sabitleri taşıması (bekçi); malzeme eklentisinin kancaları.
`npm test` (bilinen TEK kırmızı: "ova bütün yerleşimleri dönüşsüz"), `npm run typecheck`, 4 bekçi yeşil; İSTİSNA listesi büyümez.
**Bozma testleri** (dosya yedekli, `git checkout` yok, taban yeşil kontrol edilerek): M1 gölge ışınını kapatan mutant (görünürlük
hep 1) → gölge testi kırılmalı; M2 koni doluluk düzeltmesini kaldıran mutant → perde/koni testi kırılmalı; M3 `giAcikMi` varsayılanı
açık yapan mutant → bayrak testi kırılmalı.
**"Kapalıyken birebir aynı" canlı kanıtı:** `?gi=hacim` YOKKEN `kapidene` 19/19, dört noktada çizim tabanla aynı (±1: 168/132/193/77
düz koşu, on-kayit-isik-dili-2 sonra satırı 169/137/198/82), fps ≥ 60; `ovadene` 7/7. Log'da `[GI]` satırı OLMAMALI.

### K2 — "ışık ver, bir sonraki karede renkli sekme" [ÖLÇÜLDÜ olacak]
Senaryo `uygulama/senaryolar/gidene.ts` (`ORION_SORGU_EK="gidene=1&gi=hacim&sessiz=1"`). Kamera 1. şahıs, oyuncu (−2,2; −0,4),
yaw −90° (−X'e, tahtaya), pitch 0. Orion (3,5; 2,5)'e ışınlanır (kameranın arkası). Ölçüm kare-hassas: `onAfterRender`'da çizim
tamponundan `readPixels` (0–255); eylem (ışık ekleme vb.) bir karenin okumasından HEMEN sonra yapılır → bir sonraki çizilen kare N+1.
- **ROI-T (tahta)**: tahta düzleminde x = −4,90, z ∈ [−1,6; −0,4], y ∈ [1,0; 1,8] — 7 × 5 dünya noktası; her biri ekrana izdüşürülür,
  ışın seçimiyle (pick) gerçekten `tahta_yuzey`e düştüğü doğrulanır (örtülen nokta atılır), 3 × 3 piksel ortalaması; ROI = geçerli
  noktaların ortalaması (geçerli nokta < 20 ise ölçüm GEÇERSİZ sayılır, raporlanır).
- **Gürültü**: aynı sahnede hiçbir şey değişmeden ardışık iki kare: |Δ(R−B)| (iki ayrı çift; büyüğü).
- **K2a (görev ölçütü, renkli ışık)**: kırmızı-turuncu `PointLight` renk (1,0; 0,3; 0,05), şiddet 4, menzil 1,6 m, konum (−3,0; 0,9;
  −1,8) — kartonların (−3,45…−2,44; 0…0,6; −2,18…−1,43, albedo 0,16/0,10/0,06) 0,3 m üstü, tahtanın sol ucunun önü. Işık ile tahta
  düzlemi arası ≥ 1,91 m > menzil → ROI-T'ye DOĞRUDAN ışık ulaşamaz; ROI-T'deki her değişim dolaylıdır. Konsoldan eklenecek gibi TEK
  satır (`new PointLight(...)`), başka kayıt/kod/veri yok (O1).
  **Ölçüt:** kare N+1'de Δ(R−B) (sonra − önce, ROI-T) **≥ +8/255 VE ≥ 5 × gürültü**.
  **Tahmin [TAHMİN]:** +3 … +10 — sınırda ya da altında; neden: yansıtanlar koyu (karton 0,16, zemin 0,08), tahta 1,9–2,6 m ötede.
  Kalırsa yorum: yöntem değil, sahnenin albedosu (yalnız-GI görünümü ve K2b ayırır).
- **K2b (ışıyan yüzey ışık kaynağıdır)**: karton malzemesinin (`karton`, PBR) `emissiveColor` = (1,0; 0,45; 0,1), `emissiveIntensity`
  = 2,2 (ofisin kendi pembe neonunun glTF gücü) — tek satır, vekil ışık yok. **Ölçüt:** kare N+1'de ROI-T Δ(R−B) ≥ +8/255 VE ≥ 5 ×
  gürültü. **Tahmin [TAHMİN]:** +10 … +25.
- **C1 (kontrol, ölçüt değil ama K2a'nın geçerlilik şartı)**: GI gücü 0 iken (`gi.guc = 0`; eklenti bağlı, katkı 0) aynı ışık eklenir,
  30 kare beklenir (malzemeler yeni ışık sayısıyla derlensin): ROI-T |Δ(R−B)| ≤ gürültü + 1,5. Kalırsa K2a geçersiz (doğrudan ışık
  ROI'ye ulaşıyor demektir).
- **Bilgi (ölçüt değil)**: (i) N+15'teki Δ (çok sekme yakınsaması; rapor O2: N+15 ≥ son değerin %90'ı); (ii) aynı adımlar `gikip=1`
  yalnız-GI görünümünde ROI-T; (iii) K2a/K2b'de GI'siz (gi.guc = 0) N+1 Δ — GI'nin payı.

### K3 — bütçe [ÖLÇÜLDÜ olacak]
- **fps ≥ 60** ve **çizim ≤ +20** (aynı oturum düzeninde `gi` kapalı tabana göre): `kapidene` dört noktası (ofis içi cam / ofis içi
  kapı / dışarıda ofise / dışarıda ova'ya), `ORION_SORGU_EK="gi=hacim"` ile, aynı gün `gi`siz koşuyla yan yana. Tahmin: +5 çizim
  (enjeksiyon 1 + mip 3 + toplama 1) her noktada (GI dışarıda da hesaplanıyor), fps 100 (vsync tavanı) içeride.
- **GI geçişi ≤ 2,5 ms**: `gi.gpuOlc(200)` — 200 tekrarın `gl.finish()` arası ortalaması (CPU gönderimi dahil, üst sınır) ve varsa
  `EXT_disjoint_timer_query_webgl2` GPU süresi (yoksa "ölçülemedi" yazılır; kesinti varsa o değer atılır). Ölçüt: sorgu varsa sorgu
  değeri, yoksa finish değeri. Ayrıca bilgi: kare başı CPU güncellemesi (`gi.cpuMs()`), kurulum süresi. Tahmin [TAHMİN]: 0,5–2 ms
  (rapor 0,6–1,2 ms; voxel başına toplama ≈ 140 bin aktif voxel × 6 koni).
- **VRAM ≤ +100 MiB**: `nvidia-smi memory.used` (sistem geneli) tepe değeri, `kapidene` koşusu boyunca 1 sn arayla; gi kapalı / açık
  ikişer koşu. Önceki ölçümlerde koşu-arası oynama ±100 MiB idi (on-kayit-isik-dili-1): fark < gürültü ise "BELİRSİZ" yazılır.
  Hesaplanan beklenti: +30,8 MiB doku (+ shader/derleme payı).

### K4 — sızma notu (gözlem, ölçüt DEĞİL)
`gikip=1` yalnız-GI görünümü, kamera ofis içi kapıya bakış (1,6; −1,0; yaw 0). ROI-K: kapı önü iç zemin (x 2,1…3,1, y 0,02, z 2,8…3,7).
(a) dıştaki ufuk lambası `ufuk_lamba_isik_0` (2,0; 4,18; 6,4, menzil 12) şiddeti 0'a çekilince ROI-K'deki Δ (duvar/kapı voxeli ışığı
kesiyorsa ≈ gürültü); (b) kapı kanadı voxelde kurulum anındaki hâliyle DONAR (kapı açılınca GI değişmez — bilinen sınır, ölçüm yok);
(c) ofis ışığının ova'ya sızması bu spike'ta YAPISAL OLARAK İMKÂNSIZ: GI eklentisi yalnız ofis malzemelerinde (ova yüzeyi GI almaz).

### Ekran görüntüleri (ORION_SS; aynı kamera; Ozyn'in gözü için, ölçü yok) → `docs/olcum/gi-spike-1/`
`gidene` pozunda (tahtaya bakış): `gi-kapali-bos.png` ↔ `gi-acik-bos.png` · `gi-kapali-isik.png` ↔ `gi-acik-isik.png` (K2a ışığı
yanık) · `gi-kapali-isima.png` ↔ `gi-acik-isima.png` (K2b) · `gi-yalniz-bos.png` (yalnız GI). `kapidene` son pozunda (ofis içi cam
duvar): `kapidene-gi-kapali.png` ↔ `kapidene-gi-acik.png` · `kapidene-gi-yalniz.png`.

## Karar kuralı
- K1 + K3 geçer, K2a VE K2b geçerse: **yol AÇIK** (spike 2'ye geç).
- K1 + K3 geçer, K2b geçer, K2a kalırsa ve C1 geçerliyse: **yol AÇIK, sahne koşullu** — mekanizma bir sonraki karede dolaylı ışık
  üretiyor ama bu ofisin koyu albedolarında renkli ışığın sekmesi eşiğin altında; görsel karar (albedo/ışık şiddeti) Ozyn'in.
- K2a ve K2b ikisi de kalırsa: teşhis (enjeksiyon mu, toplama mı, malzeme mi — yalnız-GI sayıları ve CPU referansıyla kıyas).
- K3 kalırsa (fps < 60 ya da > 2,5 ms ya da > +20 çizim): **koşullu** — hangi geçiş, neden (sayıyla); seçenek: toplamayı yarım hızda,
  ışınım hacmini 0,2 m, ya da WebGPU compute (rapor §6 tetikleyicisi).

## Sınırlar (önceden)
n = 1 koşu/koşul (K2 kare-hassas, aynı oturumda önce/sonra); ROI tek yüzey; ekran efektleri ofiste kapalı (ölçüye karışmaz);
VRAM sistem geneli; GPU süresi tek makine (NVIDIA GeForce RTX 4060, 8188 MiB, sürücü 610.88).
**Ortam uyarısı (ön kayıt anında görüldü, değiştirilmedi — Ozyn'in süreçleri):** arka planda League of Legends (istemci + oyun),
`llama-server.exe` ve `groma.exe` açık; koşulardan önce `nvidia-smi` 7238 / 8188 MiB dolu. fps ve VRAM bu yük altında ölçülecek;
GI kapalı/açık koşular ARDIŞIK ve dönüşümlü alınır ki ortam ikisine aynı binsin. VRAM tavanına ~950 MiB kaldığı için taşma
(sürücünün sistem belleğine kaydırması) fps'i bozabilir — olursa yazılır. Tasarım sayıları ölçüm koşularından önce değişirse SAPMALAR bölümüne yazılır.

## SAPMALAR
(henüz yok)

## SONUÇLAR
(koşudan sonra eklenecek)
