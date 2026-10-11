# Spec 24 — Ofisin kapısından ovaya

> Durum: **C0 ölçüldü, C1 ve C2 uygulandı** (2026-10-11). Sırada C3 (kapı geçişi: E → kararma).
> Deneme: uygulamayı `?yer=ova` ile aç ya da konsolda `dunya.ovayaCik()` / `dunya.odayaDon()`.
> Plan ve kararlar: aşağıda; ölçüm betiği atıldı (sonuçlar burada).

## 0. Neden
Ozyn (2026-10-10): "önce bunu Orion'a vermemiz lazım. Orion'un ofisinde bir kapı var; kapıdan dışarı çıkınca bu
ovaya gelsin." Spec 23'ün anlam katmanı (level nesnelerinin Orion için adı, türü, eylemleri) Orion ancak bir
level'da yaşarsa ona ulaşır. Oda olduğu gibi kalır; ön duvardaki kapı (çapa `kapi`) bir GEÇİT olur.

Kararlar (Ozyn, 2026-10-11): geçiş **kısa kararmayla** (kesintisiz kapı sonra); **ikisi de çıkar** — Ozyn kapıdan
geçince Orion yanında gelir, Orion da kendi kararıyla (`gec` niyeti) çıkabilir.

## 1. Mimari
- **Yer** (`world/yer/yer.ts`, saf): `{ ad, sinir, engeller, katiYuzeyler, capalar, nesneler, yukseklik }`.
  Yol bulma, çarpışma, bakış ışını, çapa sorguları ve Orion'un yürüyüşü yeri PARAMETRE olarak alır; verilmezse oda.
- **Aktör başına yer:** Oyuncu `yer: () => Yer`, avatar/yürütücü `yer: () => Yer`; `giris.ts` `ozynYeri` /
  `orionYeri` tutar. Global "aktif yer" yok: Ozyn içerideyken Orion dışarıda olabilir (C6).
- **Oda yeri türer** (`world/yer/odaYeri.ts`): olculer / capalar / nesneKaydi'ndan; ikinci liste yok.
- **Tek sahne, yer değiştirme:** oyuncu, kamera, avatar ve oda yüzeylerinin (monitör, terminal, tahta) durumu var;
  iki Babylon sahnesi arasında taşınamazlar. Geçişte oda gizlenir, ova kurulur (C0 kararı).
- Beyin yeri yalnız protokol verisi olarak öğrenir (C4: `Algi`ye isteğe bağlı `yer`); mind/bridge level görmez.

## 2. C0 — öncü ölçüm [ÖLÇÜLDÜ]
Başsız Chrome 1600×900, kare sınırı kapalı, RTX 4060; aynı sahnede oda (`odaKur`) + ova (`levelKur`). Avatar ve
oda yüzeyleri YOK (bunlar C2'de uygulamada ölçülür). Eşikler ölçmeden önce yazıldı.

| eşik | ovayı gizli tut | her çıkışta kur, dönüşte yık |
|---|---|---|
| ilk geçiş ≤ 3 sn | 1,24 sn ✓ | 1,24 sn ✓ |
| sonraki ≤ 1 sn | 0,12 sn ✓ | 0,82–0,84 sn ✓ |
| ovada ≥ 50 fps | 170 fps, 104 çizim ✓ | aynı |
| 10 gidiş-dönüşte sızıntı yok | sayılar sabit ✓ | yıkınca odanın sayılarına birebir ✓ (3 kez) |
| odaya dönünce görüntü aynı | ✗ oda gri-sisli (ovanın görsel ayarı sızıyor) | ✓ |
| gizli ova odayı ≤ %5 yavaşlatır | ✗ (aşağıda) | — |

- Gizliyken oda 45 → 90 çizim: kademeli gölgenin **otomatik sınırı** (`autoCalcDepthBounds`) ışık kapalıyken de
  aktif kameradan her karede derinlik çiziyor ("DepthRenderer minmax"). Kapatınca 46 çizim, kare yine +0,3 ms.
- Ova bir kez kurulup yıkıldıktan sonra oda karesi sabit +0,12 ms (sayılar ve gözlemciler aynı, 3 kurulumda
  artmıyor — sızıntı değil; kaynağı açıklanmadı). VRAM: oda 1,43 GB, ova kuruluyken 1,59 GB.
- **Karar: her çıkışta kur, girişte yık.** Ovanın Orion için verisi (engeller, nesneler, çapalar) ilk kurulumda
  saf veri olarak çıkarılıp saklanır; Orion tek başına dışarıdayken (C6) sahne gerekmez.

## 3. C1 — Yer soyutlaması (uygulandı; odada davranış değişmedi)
- `olculer.ts` `ODA_ALANI`, `carpisiyorMu(x, z, yaricap, alan)`; `yolBulma.ts` bütün işlevler `alan: YurumeAlani`
  alır (önceden `engeller` yalnız görüş hattına geçiyor, nokta testi hep odaya bakıyordu — artık ikisi aynı alan).
- `capalar.ts` sorguları (`capaBul`, `yaklastiMi`, `bulunduguCapa`, `yakinCapalar`, `etkilesilebilirCapa`,
  `eylemVarMi`) ve `capaGeometri.ts` isteğe bağlı çapa listesi alır.
- Yürütücü yol bulma / serbest nokta / çapa aramasını kendi yerinden yapar; oturma (sandalye) oda sabitlerinde
  kalır — sandalyesi olmayan yerde `otur` zaten "bilinmeyen çapa".
- `giris.ts`: algı (`algiSor` çapaları ve ışın yüzeyleri), "In the room: …" sabit bilgisi, yer adları, durum
  defterinin konumu → `orionYeri`; tıklama ipucu, HUD, sinematik kanca → `ozynYeri`.
- **Bekçi** `world/yer/yer.test.ts` (21): oda yeri = sabitler (kimlik eşitliği); yer verilmeyen çarpışma / yol
  bulma oda yeriyle aynı karar (ızgara); 40×40 m açık alanda binanın etrafından dolaşan yol, alanın çapası,
  ofisin tahtası orada yok, Orion binanın arkasındaki kapıya yürür, yer değişince sonraki niyet yeni yeri kullanır.
  Bozma denemesi: yürütücü yol bulmaya yeri geçirmeyi "unutunca" 3 test kırıldı.
- **Canlı [ÖLÇÜLDÜ]:** `3dorion.bat eylemdene` 6/6 (otur, bana gel, bilgisayarı aç, tahtaya git);
  `3dorion.bat gordene` geçti (cevap konuma bağlı 4/4).
- Bilinen kopya: `tools/ogretmen.ts` `SABIT` = giris'in "In the room: …" metni (oda çapalarıyla); C4'te sabit
  bilgi yere göre değişince ikisi tek kaynaktan türetilmeli.
- C4'e not: `uygulama/niyetYurutucu.ts` `yaklastiMi("tahta", …)` oda listesine bakar — Orion ovadayken tahta
  koordinatına denk gelirse "tahtanın yanında" sanılır; Orion'un yeri verilmeli.

## 4. C2 — Ova yeri (uygulandı)
- **Veri:** `LevelTanimi.gecitler?: { ad, konum: [x, z], yon (derece, dışarı), hedef: "oda", etiket? }[]`
  (doğrulama: konum [x, z], bilinen hedef, yinelenen ad ve aynı hedefe iki geçit yok — ikisi de `kapi` olurdu).
  ova'ya **Orion'un ofisi** (katalogdaki "ofis binası", 20,5 × 38,75 × 12,55 m; zeminin en alçak köşesine oturtuldu,
  y = -0,2) ve önüne geçit `ofis` (konum [-2, 15.675], yön 180°, "ofis kapısı").
- **`world/yer/levelYeri.ts` (saf):** engeller = görünür yerleşimlerin kutuları (gizli / gizli gruptaki / 0,25 m'den
  alçak olanlar hariç) + göl çanağı; katı yüzeyler = kutular + kapı kanadı (çapa `kapi`); çapa `kapi` (durak kapının
  1,1 m önünde, yüz kapıya); nesneler = kapı + `levelNesneleri` (spec 23 B anlamı); sınır = zemin dairesinin içindeki
  kare (−4 m pay); yükseklik TANIMDAN (`levelYuksekligi` → `zeminYuksekligi`: level yıkılınca da geçerli, C6).
  Varış (`gecitVarisi`): kapıdan 1,8 m dışarı, yüz dışarı.
- **`world/yer/levelSahnesi.ts` (Babylon):** oda meshleri / ışıkları / parlama katmanı gizlenir, sahne ayarları
  (sis, arka plan, ton, piksel ölçeği, kamera menzili) saklanır; `levelKur` + nesneler yüklenir; stil oyuncunun
  kamerasına bağlanır; kapı kanadı çizilir (glb binada kapı yok); oyuncu gövdesi güneşin gölgesine katılır; kutular
  sahneden BİR KEZ ölçülür; `level.guncelle` her karede. `yokEt` hepsini geri alır.
- **Zemine basmak:** oyuncu `konum.y = yer.yukseklik` (gövde de); yürütücü her tik ayağı zemine koyar (oturma /
  kalkma aşamaları hariç; oda düz olduğundan orada eskisi gibi 0). `isinla(x, z, yaw)`: oyuncu (kamera
  `anindaYerles` ile yumuşatmasız) ve Orion (süren iş `iptal` — beyin beklemede kalmaz; oturuyorsa ayakta belirir).
- **`giris.ts`:** `ovayaCik()` (ova `?url` ile paketlenir, fetch; ikisi de ova yerine, Ozyn varışta, Orion sağında —
  kapalıysa solunda / önünde), `odayaDon()` (kapının içinde, odaya dönük); `?yer=ova` açılışta ovaya çıkar;
  `dunya.ovayaCik/odayaDon/yer` deneme yüzeyi; günlüğe "ovaya çıkıldı (N ms)" / "ofise dönüldü".
- **Testler:** `world/yer/levelYeri.test.ts` (33: geçit geometrisi, engel kuralları, sınır, göl, doğrulama; GERÇEK ova
  bekçisi: kapının durağı ve varış yürünebilir, varıştan merkeze ve uzak binanın arkasından kapıya yol var, ofis
  Orion'un nesnelerinde adıyla); `yer.test.ts` +3 (eğimde ayak zeminde, ışınlanınca iş iptal, ışınlanınca zeminde).
- **Canlı [ÖLÇÜLDÜ]** (başsız Chrome, `index.html?yer=ova`, 10/10): ova ilk kurulum 1794 ms, ikinci 1003–1018 ms ·
  engel 10, nesne 10, çapa `kapi` · Orion Ozyn'in 1,2 m yanında belirdi · Ozyn 2,5 sn'de 6,5 m yürüdü (tepede,
  ayak y 0,58) · Orion ova merkezine (y 0,47) ve ofis kapısına yürüdü (y 0,43) · ovada `git tahta` → "bilinmeyen
  çapa/nesne" · odaya dönüş: oda görüntüsü yerinde (mor sis, ışık), ikisi de odada · ikinci çıkış-dönüş temiz.
  Oda davranışı: `3dorion.bat eylemdene` 6/6.
- **Bilinen:** kurulum sırasında mantık tiki takılıyor (HUD "atlanan 5") — C3'te kararmanın arkasında kalır. Ovada
  kare hızı uygulamada (avatar + oda yüzeyleri canlı) kare sınırı kapalı ölçülmedi (başsız görüntüde 100 fps
  sınırındaydı). Orion'un bedeni güneş gölgesine henüz katılmadı (avatar meshleri dışarı açılmıyor). Kaya / dekor
  katmanı örnekleri engel değil.

## 5. Sıradakiler
- **C3 kapı geçişi** (E → kararma → ova; ofis kapısından dönüş; Orion yanında) · **C4** Orion ovayı bilir (algıda
  `yer`, sabit bilgi yere göre, 9 "ek bina" ayırt edici ad) · **C6** `gec` niyeti · **C5** paket + `kapi-dene`.
