# Spec 45 — Blueprint JSON altyapısı: aktör hiyerarşisi + bileşen kaydı + olay yolu + soket + şablon (Unreal Actor/Component/Blueprint, JSON ile)

> Durum: **B0 (bu belge), B1 (şema + bileşen kaydı), B2 (olay yolu), B3 (graf olay düğümleri + ⚡ dinleme), B4 (çalışma zamanı: tetik, hareket, üst/soket bağları + `hareket_et/sokete_tak/sokettan_al` düğümleri), B4b (hata kodu kataloğu + günlük + bayraklar + `aktorDebug`, §13), B5 (beden soketleri), B6 (şablon çekirdeği + `Content/Actors` dosyası), B7 (Details bileşenler + hiyerarşi, Nesneler paneli ağacı, şablon düğmeleri, glb soket düğümleri), B8 (Orion taslak kapısı), B9 (demolar; B8 atlandı) yazıldı, 2026-10-31/11-01**; B8 ve H yok. Dilimler B1…B9 aşağıda; her dilim testle kapanır, commit/push Ozyn'in isteğiyle. **Havok (gerçek fizik) EN SONA** (bölüm 9, açık işler).
> Üst belgeler: `43-aktor-bilesen-graf-ve-hata-ayiklama.md` (aktör, şema, aktör grafı), `35-orion-dunya-editoru.md` (graf motoru, ⚡ dinleme), `42-yeni-level-ve-isik.md`, `44-orion-npc-mimarisi.md` (bu spec 44'ün "nesne kendi etkileşimini taşır" ayağıdır).
> Etiketler: `[KOD]` okundu · `[GENEL]` Unreal bilgisi, doğrulanmadı · `[YAZILDI-KOŞULMADI]`.

## 1. İstek (Ozyn, 2026-10-31, kendi sözleriyle)

Bir asset (araba, kılıç, lamba, kutu) içe aktarılıp OBJE olarak kullanılacak; Unreal'daki mantıkla **event + component + graf**. Lamba: 3D objenin içine grafla/bileşenle lamba eklenir. Kılıç: Orion
karakterinin bileşenine eklenir, eline ve belli **soket** yerlerine konur. Araba: sürüş = level nesnesinin hareketi, hepsi JSON. Orion de, Ozyn da kullanır. Kararlar (AskUserQuestion):
- **Fizik:** gerçek fizik motoru (Babylon + Havok) — bir eklenti; **en sona**, o zamana kadar basit kinematik `hareket` bileşeni.
- **Saklama:** her nesne bileşenlerini ve grafını **kendi içinde** taşır; nesneler graf/şablon olarak kaydedilebilir, alt/üst nesnelere olay yayınlayabilir, olay veriyoluyla modüler çalışır (Blueprint mantığı).
- **Orion:** JSON'u şimdilik **öneri** olarak yazar, Ozyn gerçek tıklamayla onaylar (ileride üstüne düşünülür).
- **Sıra:** önce altyapı, sonra demolar (lamba, kutu, kılıç, araba).

## 2. Elimizde olan `[KOD]`

| Parça | Durum |
|---|---|
| Aktör = level nesnesi/ışığı; sabit alan şeması (`bilesen.ts`: `ISIK_BILESENI`, `NESNE_BILESENI`) | var; **bileşen LİSTESİ yok** (tek sabit şema) |
| `graf` + `degiskenler` (`AktorOzellikleri`, `aktorOzellikleriHatasi`) | var |
| Aktör grafı ▶/■ (`aktorCalistirici.ts`, `@bu`), `aktor.oku/yaz/degisken_*` düğümleri | var; tavan 4 eşzamanlı, geçici yazma geri alınır |
| ⚡ dinleme + olay düğümleri (`grafDinleyici.ts`, `olayDugumleri.ts`) | var; olaylar yalnız Ozyn↔ajan mesafe olayı; dinlemeyi Ozyn'in gerçek tıklaması kurar |
| Nesne sahne düğümü `level.nesneler.dugum(id)` (TransformNode) | var (kamu API); `nesneSistemi.ts` DEĞİŞMEDEN kullanılır |
| İçe aktar: Content Browser, glb/png/jpg → `Content/Assets` (`host/icerik.js`) | var |
| Orion'un eli: `elinde` + prosedürel `elindekiGoster` | var; soket kavramı YOK |
| Hiyerarşi (`ust`), bileşen listesi, olay yolu, soket, aktör şablonu, hareket/tetik | **yok → bu spec** |

## 3. Veri biçimi (geriye uyumlu: hepsi isteğe bağlı, `LEVEL_SURUMU` aynı, eski level bire bir aynı)

Nesne ve ışık aktörlerine ortak yeni alanlar (`AktorOzellikleri`):
```json
{ "id": "n3", "varlik": "araba/ARABA_Basit.glb", "konum": [0,0,0], "donus": 0, "olcek": 1,
  "ust": "n1", "soket": "el_sag",
  "bilesenler": [
    { "id": "b1", "tur": "tetik",   "ad": "Binme alanı", "ayar": { "sekil": "kure", "yaricap": 2.5 } },
    { "id": "b2", "tur": "soket",   "ayar": { "ad": "surucu", "konum": [0.4, 0.8, 0.2], "donus": [0,0,0] } },
    { "id": "b3", "tur": "hareket", "ayar": { "azamiHiz": 12, "ivme": 6, "donmeHizi": 90 } },
    { "id": "b4", "tur": "isik",    "ayar": { "konum": [0,1.5,0], "renk": "#ffd9a0", "siddet": 1.5, "menzil": 8 } }
  ],
  "graf": "araba-surus", "degiskenler": { "hiz": 0 } }
```
- **`ust` / `soket`:** üst aktörün kimliği (nesne ya da ışık) ve üstteki soket adı. `ust` varken `konum`/`donus` ÜSTE GÖRE yereldir. Döngü ve derinlik>4 reddedilir; `ust` level'da yoksa nedenli hata.
- **`bilesenler`:** sıralı liste, aktör başına en çok 8. Kimlik aktör içinde benzersiz (`b<sayı>`). `ayar` türün şemasından doğrulanır; bilinmeyen tür/alan nedenli hata (sessiz düzeltme yok).
- **`aktorOzellikleriHatasi`** bunları aynı yerde doğrular (nesne ve ışık aynı kuralı kullanır; kopya yok).

## 4. Bileşen kaydı (`world/level/cekirdek/bilesenKaydi.ts` + `alanSemasi.ts`, SAF çekirdek; Babylon örnekleri ayrı, B4) — B1 YAZILDI

`BilesenTuru` tanımı = `{ tur, etiket, alanlar: AlanSemasi[] (spec 43 şeması), olaylar: string[], kur(ctx) → { guncelle?, alanYaz?, yokEt } }`. Yeni bileşen = kayıt tablosuna bir satır + test; çekirdek koda dokunulmaz (Unreal'da yeni Component sınıfı gibi).
İlk türler:
| Tür | Ne yapar | Yayınladığı olaylar |
|---|---|---|
| `isik` | aktöre bağlı nokta ışık (spec 42 ışık fabrikası) | — |
| `tetik` | küre/kutu alan; içine kim girdi/çıktı (Orion, Ozyn, başka aktör) | `tetik.girdi`, `tetik.cikti` (`kim`) |
| `soket` | adlı bağlanma noktası (yerel konum/dönüş); başka aktör `ust`+`soket` ile takılır | `soket.takildi`, `soket.cikarildi` |
| `hareket` | KİNEMATİK: hız/ivme/dönme hızı komutu, zemine yapışma, basit çarpışma kutusu | `hareket.basladi`, `hareket.durdu` |
| `fizik` | **REZERVE (Havok, en sona):** şimdi doğrulama "henüz yok" der | — |
Bütçe: bileşen güncellemesi kare başına bütçeli (tetik taraması en çok N aktör/kare); `setEnabled` yalnız durum DEĞİŞİNCE (spec 38 tuzağı).

## 5. Olay yolu (`world/level/cekirdek/aktorOlayYolu.ts`, SAF) — Unreal Event Dispatcher — B2 YAZILDI

- Adres: `<aktör>.<olay>`. Yolun kendisi olay adını `[A-Za-z0-9_.-]` ile sınırlar (yerleşik olaylar nokta taşır); **özel olay adını graf düğümü (B3) noktasız `grafAdiGecerli` kuralıyla daraltır**, böylece graf `tetik.girdi` gibi yerleşik bir olayı taklit edemez. Yerleşik olaylar §4 tablosundaki + `basla` (level kurulunca bir kez; B4).
- `yayinla(aktor, ad, veri)`, `dinle(aktor | "*", ad | "*", f)`, `ustuneYayinla(aktor, ad)` (üst zincire, `beden:` dahil), `altlaraYayinla(aktor, ad)` (alt ağaca, genişlik sırası). `dinle` aboneliği kaldıran fonksiyon döner. Hiçbiri fırlatmaz: geçersiz girdi ve tavan `ok: false` + neden döner.
- **Koruma:** iç içe dağıtım derinliği ≤ 8 (olay olayı doğurur), kare başına dağıtım ≤ 256 (çağıran her karede `kareBasi()` der); aşılan ATLANIR ve SAYILIR (`sayim()`), sessiz değil. Dinleyici hatası ötekileri durdurmaz ve sayılır. Veri yalnız metin/sayı/mantıksal (≤ 8 alan, metin ≤ 200), nesne sızdırılmaz. Tetik taşmasını önleyen histerezis/soğuma OLAY YOLUNUN değil `tetik` bileşeninin işi (B4; `world/olayUretici.ts` kalıbı).
- Graf bağlantısı: `olay.aktor_olayi` düğümü (⚡ dinlemedeki grafı tetikler; **dinlemeyi yalnız Ozyn'in gerçek tıklaması kurar**, spec 35 kuralı AYNEN) ve `aktor.olay_yayinla` düğümü.

## 6. Graf düğümleri (spec 43 `aktorDugumleri` ailesine) — B3 YAZILDI (olay + hiyerarşi); bileşen/soket/hareket düğümleri B4/B5'te

**B3'te yazılanlar** (`uygulama/graf/aktorDugumleri.ts`, `aktorOlayKaynagi.ts`):
- `aktor.olay_yayinla` — ayar `aktor` (`@bu` ya da kimlik), `olay` (noktasız `grafAdiGecerli`: graf `tetik.girdi` taklit edemez), `yon` (`aktor` | `ust` | `alt`), `deger` (isteğe bağlı giriş; boş = veri yok, doluysa `{deger}`). Yol reddi (ad/veri/derinlik/kare tavanı) düğümü NEDENLE düşürür, sessiz yutulmaz.
- `aktor.ust_bul` (`id`, `var`; beden üstü `beden:<ad>` olduğu gibi), `aktor.alt_bul` (ayar `sira`; `id`, `var`, `sayi`).
- `olay.aktor_olayi` (⚡ giriş; `dunyaOlayi: "aktor_olayi"`) — ayar `aktor` (açık kimlik; `@bu` dinlemede çözülemez → reddedilir), `olay` (yerleşik noktalı olaylar DİNLENEBİLİR, yayınlanamaz); çıkış `sonra`, `kaynak`, `kim`, `deger`.
- Dinleme bağı: olay adresi `aktor:<id>`; `aktorOlayKaynagiKur` ajan kaynağını sarar, `aktor:` önekini `AktorOlayYolu.dinle(id, "*", …)`'e yönlendirir (ajan olayları DEĞİŞMEDEN geçer). `grafDinleyici` yalnız `OlayKaynagi.aktorVar` olan kaynakta aktör olayını kabul eder, level'da olmayan aktörü nedenle reddeder. Dinleyiciye `ayrinti = {...olayVerisi, kaynak, aktor}`; yayıncının verisi `kaynak`/`aktor`'u EZEMEZ.
- Kablolama: `levelBaglantisi.ts` canlı hiyerarşiyle (`levelHiyerarsisi(level)`) `aktorOlayYoluKur` kurar (`aktorOlaylari`), `giris.ts` dinleyicinin kaynağı olarak sarılmış kaynağı verir. Kare sayacı (`kareBasi`) çağrısı B4'te (çalışma zamanı karesi).
- Güvenlik DEĞİŞMEDİ: dinlemeyi yalnız Ozyn'in gerçek tıklaması kurar, dinleme diske yazılmaz; dinlemede olmayan grafın `olay.aktor_olayi`'ı ölü koddur; ▶ buradan başlamaz.

**B4'te yazılanlar** (`uygulama/aktor/`, saf modeller + Babylon çalışma zamanı; `world/level/`'a dokunulmadı):
- `tetikModeli.ts` (saf): küre/eksene hizalı kutu, `kim` süzgeci (herkes/ozyn/orion/aktor; bilinmeyen değer kimseyi saymaz), HİSTEREZİS (içeride olan sınırın 0.15 m dışına çıkınca "çıktı"; ölçülmedi). Kutu aktörün dönüşünü yok sayar (spec §11).
- `hareketModeli.ts` (saf): kinematik; hız ivmeyle hedefe, hedefi aşmaz, dönme anında; yamuk adım; ileri = +Z (yaw 0). Çarpışma yok (§12).
- `hiyerarsiEzmesi.ts` (saf): `sokete_tak/sokettan_al` tanıma YAZMAZ, çalışma zamanı ezmesi tutar; olay yolu ve düğümler ETKİN hiyerarşiyi görür. Kendi üstü / olmayan üst / döngü / derinlik (4) reddedilir.
- `aktorCalismaZamani.ts`: her karede olay sayacı sıfırlanır → hareket → bağlar → tetikler. `level.tanim()` kopya döndüğünden aktör listesi 0.25 sn'de bir ve nesne yüklenince yenilenir. **`ust` yerel dönüşümü:** çocuğun `konum/donus/olcek`'i üste (ve soketine) göre yereldir. Babylon ebeveynliği DOĞRUDAN kullanılmadı: `nesneSistemi` bir düğümü yıkarken çocuklarını da yıkar (`dispose(false, …)`); her bağlı aktör kendi ara düğümünün (`bag_<id>`) çocuğudur, ara düğüm üstün dünya matrisini izler → üst yeniden kurulsa çocuk yıkılmaz. Olaylar: `tetik.girdi/cikti` (veri `kim`, `bilesen`), `hareket.basladi/durdu`, `soket.takildi/cikarildi` (üst adına; veri `kim`, `soket`).
- Düğümler: `aktor.hareket_et` (hız m/s, dönüş °/s; **komut kalıcıdır**, durdurmak için 0,0), `aktor.sokete_tak` (`ust`: kimlik, `@bu` ya da `beden:<ad>`; `soket`), `aktor.sokettan_al`. Bunlar çalışma zamanı durumudur (level yeniden kurulunca gider); graf alan/değişken yazması gibi "çalışma bitince geri alınan" DEĞİLDİR.
- **Yapılmadı:** `basla` olayı (level kurulunca; yüzlerce aktörde kare tavanını yerdi), `aktor.bilesen_ekle/kaldir/oku/yaz` düğümleri (bileşen düzenlemesi kalıcı tanım işi: Details B7'de), ışığa hareket. `gozlenenler` giris.ts'te Ozyn (ayak) ve gövdesi olan ajanlar.

**Sonraki dilimlerde**: `aktor.bilesen_oku/yaz` (şema alanları; yalnız `grafta: true`) ve bileşen ekleme/kaldırma (B7 Details). Orion'un araç yüzeyine hiçbiri eklenmez.

## 7. Soket ve Orion'un bedeni

Soket çözümü iki kaynaktan: (a) aktörün `soket` bileşeni (glb'ye gömülü boş düğüm ya da elle verilen yerel konum), (b) **beden soketleri**: Orion'un kanonik iskeletinden adlı noktalar (`el_sag`, `el_sol`, `sirt`, `kalca`; `world/avatar/iskelet/kanonik.ts`). Kılıç = nesne aktörü `ust: "beden:orion"`, `soket: "el_sag"` (`beden:` öneki level aktörleriyle ad çakışmasını önler; bedenin varlığı çalışma anında denetlenir). Beden bir "aktör" gibi adreslenir (`beden:orion`, `beden:flash1`): bileşen alabilir (`soket`, ileride `hareket`). `elinde` alanı soketten türer (kopya yok).

## 8. Şablon ve içe aktarma

- **Şablon = aktör alt ağacı JSON'u** (`Content/Actors/<ad>.aktor.json`): kök aktör + çocukları + bileşenleri + graf adı/değişkenleri; kimlikler yerleştirmede yeniden üretilir. Level'a "Şablondan yerleştir"; mevcut aktörden "Şablon olarak kaydet". `Content/Actors` host'ta 8. korumalı tür klasörü.
- **İçe aktar akışı:** glb zaten `Content/Assets`e girer (D4); yeni: glb'den "Aktör oluştur" → kök nesne + glb içindeki adlı boş düğümlerden otomatik `soket` bileşenleri + boş graf.
- **Orion (öneri kapısı, B8):** Orion aktör/bileşen/graf JSON'unu TASLAK olarak üretir; taslak doğrulamadan geçer, Ozyn gerçek tıklamayla onaylayınca kaydedilir/çalışır. Araç yüzeyine DOĞRUDAN yazma yolu eklenmez (CLAUDE.md kuralı).

**B6'da yazılanlar** (kod kataloğunda `SBL` alanı, `AKT-SBL-001…006`):
- `aktorSablonu.ts` (saf): `sablonCikar(ad, level, kokId)` alt ağacı genişlik sırasıyla çıkarır (kimlikler `s1…`, kökün `ust/soket/konum`u silinir, `grup` taşınmaz, level'a dokunmaz); `sablonYerlestir(sablon, level, konum)` level'ın kullanmadığı yeni kimlik (`n<sayı>`/`i<sayı>`) verip `ust` bağlarını eşler, kökü konuma koyar, ışık tavanını (8) denetler ve level'a YAZMAZ (yazma kapısı çağıranda); `sablonHatasi` dosyadan okunan her şeyi doğrular (sürüm, ad, ≤32 aktör, nesne/ışık alanları, bileşen şeması, tek kök, döngü/derinlik); `glbdenSablon` `soket_<ad>` adlı düğümlerden `soket` bileşenleri üretir, atlananı AKT-SBL-006 ile bildirir.
- Host: `Content/Actors` 8. korumalı klasör; yalnız `<ad>.aktor.json` (düz klasör, ad `grafAdiGecerli`); `aktorYaz` var olanın üstüne yazmaz, JSON nesnesi + ≤256 KB denetler, eski projede klasörü açar; okuma mevcut `icerik:metin` ile. Çoğalt/adlandır düz klasör kurallarını izler (`kasa_kopya.aktor.json`, içteki `ad` dosya adına uyar). Şablon İÇERİĞİNİ host doğrulamaz, renderer yazarken ve okurken `sablonHatasi`'ndan geçirir.
- **Yapılmadı (B6 anında):** düğmeler ve glb düğüm okuma → B7'de yazıldı (aşağıda); Orion'un şablon üretmesi (B8), şablon sürümü yükseltme (yalnız sürüm 1 var).

**B7'de yazılanlar** (kod kataloğunda `BIL` alanı `AKT-BIL-001…004`, `SBL` alanına `-007/-008`; günlük kategorisi `sablon`):
- `uygulama/aktor/sablon/bilesenIslemleri.ts` (saf): `bilesenEkle` (şema varsayılanı; `soket` için benzersiz ad `soket1…`; rezerve `fizik` ve bilinmeyen tür reddedilir), `bilesenSil` (son bileşen silinince `bilesenler` alanı kalkar: eski biçim), `bilesenAyarYaz` (şema + level doğrulaması), `bilesenAdiYaz`, `bilesenleriEkle` (glb soketleri için; aynı adlı soket ATLANIR ve söylenir, tavan aşımı hepsini reddeder), `ustAta` (üst + soket; null bağı çözer). Her işlem kaynak tanımı DEĞİŞTİRMEZ, sonucu `levelTanimiDogrula`dan geçirir (döngü/derinlik/yinelenen soket/tavan ikinci kapı).
- `uygulama/yapi/level/bilesenDetayModeli.ts` (saf) + `bilesenDetayPaneli.ts` (DOM): Details'te "Hiyerarşi" (üst seçici: kendisi ve SOYU çıkarılır, ışıklar + `beden:orion` var; soket seçici üstün `soket` bileşenlerinden ya da beden kemik soketlerinden) ve "Bileşenler" (her bileşenin şema alanları aktörün kendi alanlarıyla AYNI çizici `alanSatiriCiz`; kapalı küme alanları (tetik şekli, "kim girince") `select`; bileşen adı, ✕ sil, "+ Bileşen"). Yazma yolu tek: panel → `bilesenIslemleri` → `level.ayarla` (reddedilirse eski hâl, neden altyazıda).
- Nesneler paneli hiyerarşi: `nesneListesi` çocuğu üstünün hemen altına girintiyle dizer (`└`, `⤵n`); üstü listede olmayan (ışık, beden, silinmiş) kök gibi çizilir; arama varken düz; döngülü ham veri sonsuz döngüye girmez.
- `uygulama/aktor/sablon/sablonIslemleri.ts` (saf, dosya erişimi enjekte) + `yapi/level/sablonCubugu.ts` (DOM): "Şablon olarak kaydet" (seçili nesnenin alt ağacı → `Content/Actors`; var olanın üstüne yazmaz) ve "Yerleştir" (şablon → kamera önüne yeni kimliklerle; birleşik tanım `levelTanimiDogrula`dan geçer, reddedilirse AKT-SBL-002). **İki düğme de YALNIZ gerçek tıklamayla (`isTrusted`)**; Orion'un araç yüzeyinde şablon yazan/yerleştiren yol yoktur. Şablon doğrulaması level doğrulamasından GEVŞEKTİR (örn. ışık rengi `#fff` şablondan geçer, level reddeder): bu boşluk testle kayıtlı, level kapısı yakalar.
- `uygulama/aktor/sablon/glbDugumleri.ts` (Babylon): yerleştirilmiş nesnenin sahne düğümü soyundan `soket_<ad>` düğümlerini NESNE KÖKÜNE göre yerel konum/dönüşle (derece) okur (nesnenin dünya konumu ve ölçeği çıkarılır); Details'teki "glb soketleri" düğmesi bunu `glbdenSablon` ile soket bileşenine çevirip `bilesenleriEkle` ile ekler.
- Kablolama: `levelBaglantisi.ts` (şablon dosyaları host IPC'sinden, yoksa çubuk çizilmez; yerleştirme konumu kamera önü + zemin yüksekliği; iz → `aktorGunlugu.yaz(…, "sablon", …)`).
- **Yapılmadı:** Işıklar panelinde bileşen bölümü (yalnız Nesneler paneli; ışığa bileşen eklemek işlem katmanında var, arayüzü yok), Outliner'da sürükle-bırak ile üst atama (üst seçici ile yapılır), Flash gibi başka bedenlerin `beden:<ad>` üst seçeneği (yalnız `beden:orion` listede; başka bedene bağlı `ust` korunur ve gösterilir), gerçek glb ile canlı doğrulama (B9 `bpdene`).

**B8'de yazılanlar** (`taslakKapisi.ts`, `taslakIslemleri.ts`, `taslakCubugu.ts`): Orion aktör/graf JSON'unu YAZAMAZ (araç yüzeyine düzenleme eklenmez); önerisini `Content/Drafts/<ad>.taslak.json` dosyası olarak BIRAKIR (kendi terminalinden; komutu çalıştıran Ozyn'in tuşudur — yeni araç yok, host kodu da değişmedi: mevcut `icerik*`/`graf*` IPC'leri). Zarf: `{ taslak: 1, ad, gerekce, sablon: AktorSablonu, graflar?: Graf[≤4] }`; `ad` şablonun adıyla aynı, `gerekce` 1-300 karakter (Ozyn onaydan önce okur). Kapı zarfı, şablonu (`sablonHatasi`) ve grafları (`grafDogrula`) doğrular (`AKT-TSL-001/002/003`), Ozyn için özet çıkarır (aktör/bileşen sayısı, graf düğüm türleri, ⚡ dinleme uyarısı, yazılacak dosyalar). Nesneler panelinde 'Orion taslakları' satırı: taslak seçilince kapıdan geçirilir, bozuksa REDDEDİLDİ yazar ve Onayla kapalı kalır. **Onayla** (yalnız gerçek tıklama) önce graflara (`grafYeni`, var olanın üstüne yazmaz) sonra şablona yazar; biri başarısız olursa yazılan graflar silinir (`AKT-TSL-005`), başarıda taslak dosyası silinir. **Onay ne YAPMAZ:** şablonu yerleştirmez, grafı çalıştırmaz, ⚡ dinleme kurmaz (üçü ayrı tıklama). **Reddet** yalnız taslak dosyasını siler. Sınırlar: graf düğüm TÜRLERİNİN kütüphanede olup olmadığı kapıda denetlenmez (çalışınca nedenle durur); dinleme grafları açık aktör kimliği ister, taslaktaki kimlikler yerleştirilen aktörün kimliğiyle eşleşmez (R32 sınırı); taslak yazımı Orion'un terminal komutuna bağlı (Orion'un bu biçimi bildiğini sağlayan istem/örnek henüz yok: örnek `docs/ornekler/demo_lamba.taslak.json`).

**B9'da yazılanlar** (`uygulama/aktor/sablon/demolar.ts`, saf veri; `demolar.test.ts`): `DEMOLAR` = şablon + `graflar(kimlikler)` (⚡ dinleme grafları AÇIK kimlik ister, yerleştirmeden sonra kurulur) + `kimlikEsle`. Varlıklar level kitlerinin KATALOG adlarıdır (`PROP_Streetlamp_Slum_MD`, `DETAIL_Junction_Box`, `DETAIL_Power_Line_Pole` kılıç yerine, `ARABA_Basit`); `esya` level kiti değildir. **Bilinen sınırlar:** `isik` bileşeninin çalışma zamanı YOK (lamba = nesne + çocuk ışık aktörü); şablonla graf dosyası taşınmaz; bin/in ve 'incele' niyeti yok; ⚡ zinciri canlıda koşulmadı.

## 9. Dilimler

| # | İçerik | Kapanış kanıtı |
|---|---|---|
| **B0** | bu belge, CLAUDE.md istisna satırı, INDEX, ACIK-ISLER, defter | — |
| **B1** | veri biçimi: `ust`/`soket`/`bilesenler` alanları + doğrulama + bileşen kaydı (SAF) + türler `isik/tetik/soket/hareket` şemaları | birim test + bozma ≥12 mutant, eski level bire bir aynı |
| **B2** | `AktorOlayYolu` (SAF): yayın/abone, üst/alt, derinlik/kare tavanı | birim test + bozma |
| **B3** | graf düğümleri + `olay.aktor_olayi` ⚡ dinleme bağı | `grafdene`/birim; dinleme Ozyn tıklaması kuralı bekçisi |
| **B4** | çalışma zamanı (Babylon): bileşen örnekleri, hiyerarşi (parent), tetik/soket/hareket/isik | NullEngine testi + canlı senaryo |
| **B4b** | hata kodu kataloğu + yapısal günlük + bayraklar + `aktorDebug` (§13) | birim test + kod bekçisi + bozma 20/20 |
| **B5** | beden soketleri: `ust:"beden:<ad>"` + `soket:"el_sag"` → avatarın eklem matrisi (`uzuvDunyaMatrisi`, Babylon'suz 16 sayı); soket adı→uzuv tablosu `bedenSoketleri.ts` — **YAZILDI** (kılıç demosu B9) | birim + bozma 10/10; canlı B9 |
| **B6** | şablon çıkar/yerleştir/doğrula + glb→aktör (SAF, `uygulama/aktor/sablon/aktorSablonu.ts`) + `Content/Actors` 8. proje klasörü, `<ad>.aktor.json` ad kuralı, `aktorYaz` + IPC `icerik:aktor-yaz` — **YAZILDI** (düğme/menü B7; glb düğümlerini Babylon'dan okuyan parça YAZILMADI) | birim + host testi + bozma; canlı `icerikdene` B7/B9'da |
| **B7** | Details bileşen listesi (+ Bileşen ekle/sil/ayar), hiyerarşi (üst/soket) seçicileri, Nesneler paneli ağacı, "Şablon olarak kaydet / Yerleştir" düğmeleri (`isTrusted`), glb `soket_<ad>` düğümlerini okuyan parça — **YAZILDI** (UI canlı koşulmadı) | birim + bozma; canlı `bpdene` B9'da |
| **B8** | Orion taslak kapısı (öneri → doğrula → Ozyn onayı) — **YAZILDI**: `uygulama/aktor/taslak/taslakKapisi.ts` (saf zarf doğrulama + özet), `taslakIslemleri.ts` (okuma/onay/red, geri alınır), `uygulama/yapi/level/taslakCubugu.ts` (Nesneler panelinde 'Orion taslakları', onay/red `isTrusted`), hata kodları `AKT-TSL-001…005`, bekçi `taslakBekcisi.test.ts` | birim 17 + bekçi 4; bozma 21/21; canlı YOK |
| **B9** | demolar: lamba (Ozyn yaklaşınca ışık), kutu (itilir; 'incele' olayı), kılıç (soket + beden eli), araba (hareket + sürücü soketi; bin/in YOK) — **YAZILDI**: `uygulama/aktor/sablon/demolar.ts`, canlı `bpdene` P10 22/22; ⚡ zinciri canlıda yok (dinlemeyi yalnız Ozyn'in tıklaması kurar) | birim 15 + bozma 16/16; `bpdene` canlı |
| **H** | **Havok: `fizik` bileşeni, EN SON** (§10) | ölçüm: paket boyu, çizim bütçesi 220, `efektdene`/`kapidene` |

## 10. Havok (en sona; açık iş)

Babylon Havok eklentisi (WASM) ayrı paket; `fizik` bileşeni olarak takılır, `hareket` (kinematik) onunla yer değiştirmez, ikisi yan yana yaşar. Yapılmadan önce ölçülecek: paket boyu, Electron'da yükleme, kare maliyeti, çizim bütçesi. Karar anına kadar `fizik` türü "henüz yok" nedeniyle reddedilir.

## 11. Riskler

- `world/level/cekirdek/nesneSistemi.ts` başka Claude'un commit'siz araba değişikliğini taşıyor (`KITLER`): bu spec ona DOKUNMAZ; hiyerarşi/bileşen `nesneler.dugum(id)` üstünden kurulur. Gerekirse o iş commit'lendikten sonra.
- `ust` varken `uygula` yerel/dünya dönüşümü: B4'te `NullEngine` testiyle ölçülür (parent yoksa davranış bire bir aynı).
- Olay fırtınası ve kare maliyeti: tavanlar §5; ⚡ dinleme tavanı (8) ve aktör grafı tavanı (4) bu yük için YETERLİ mi ölçülmedi.
- Işık tavanı (`ISIK_TAVANI` 8): `isik` bileşeni aynı tavana sayılır (ışık sayısı sınırı ölçümü spec 42 Y3'te).
- Orion'un yazma yetkisi sınırı: yalnız öneri; kapı B8.

## 12. Bilerek yapılmayanlar

Havok bu turda yok. Orion'un araç yüzeyine doğrudan graf/level yazma yok. `ova.level.json` ve `brain-lab/` dokunulmaz. Görsel script (Blueprint editörü) yeni yazılmaz: mevcut Graf editörü kullanılır.

## 13. Hata kodları, günlük, bayraklar, hata ayıklama — B4b YAZILDI (Ozyn, 2026-10-31: "hatanın nerede olduğunu, neyin çalıştığını loglarda görelim")

**Amaç:** bir şey ters gidince "nerede, neden, şimdi ne yapayım" tek bakışta; çalışan şey de izlenebilsin. Üç parça, hepsi SAF ya da enjekte (Babylon/DOM yok):

| Parça | Dosya | İş |
|---|---|---|
| Kod kataloğu | `world/level/cekirdek/aktorHatalari.ts` | `AKT-<ALAN>-<NNN>`; her kayıt {alan, anlam, çözüm}; `aktorHatasi/kodlu/kodluHata/kodOku/kodAciklamasi` |
| Günlük + bayrak | `uygulama/aktor/calisma/aktorGunlugu.ts` | halka bellek (200), seviye/kategori/kod/aktör, sel koruması, bayrak ayrıştırma |
| Döküm | `aktorCalismaZamani.hataAyiklama()` + `window.aktorDebug` | bağlar (kurulu mu), tetik içerdekileri, hareketliler, geçerli uyarılar, kapalılar, olay sayımı |

**Alanlar:** `OLY` olay yolu · `BAG` üst/soket bağı · `HRK` hareket · `DUG` graf düğümü · `YTN` aktör yeteneği · `ZMN` çalışma zamanı · `BYR` bayrak · `SEM` şema. Mesaj `[KOD] ayrıntı`; graf düğümü hatası, günlük satırı ve test çıktısı AYNI kodu gösterir (grep'lenebilir). **Kod yeniden kullanılmaz / numaralanmaz.** Tetik değerlerini şema reddeder, ayrı tetik alanı yok (çalışma zamanı hatası `ZMN-001` + `tetik` kategorisiyle gelir).

**Günlük kuralları:** uyarı/hata HER ZAMAN tutulur; bilgi/iyi yalnız kategorinin ayrıntılı bayrağı açıksa (`herZaman` istisnası: "çözüldü", "yeniden açıldı" gibi durum değişimi kayıtları). **Sel koruması:** ardışık aynı kayıt tek satırda `×N` olur, çıkışa (konsol + Ozyn'in günlüğü) 1/10/100/1000… katlarında gider. Çözülemeyen bağ gibi DURUM uyarıları kare başına değil, yalnız durum değişiminde yazılır. Kare aşamaları (`yenileme/hareket/bag/tetik`) birbirinden yalıtılır: biri patlarsa `ZMN-001` yazılır, öteki aşamalar sürer.

**Bayraklar** (`?aktor=` URL parametresi ya da çalışırken `aktorDebug.bayrak("…")`): `olay,tetik,hareket,bag,dugum,zaman,sablon` ayrıntılı iz açar (`sablon` = Details bileşen düzenleme, şablon kaydet/yerleştir, glb soketleri; B7); `hepsi` hepsini; **`-tetik`, `-hareket`, `-bag`** o bileşen aşamasını KAPATIR (hata kaynağını ayırmak için; kapatma `ZMN-002` ile bir kez bildirilir, açılınca "yeniden açıldı" düşer). Tanınmayan bayrak `BYR-001` uyarısı verir, sessiz yutulmaz. `bayrak("")` bütün bayrakları sıfırlar.

**Konsol:** `aktorDebug.durum()` · `aktorDebug.son(20, {seviye:"hata"})` · `aktorDebug.sayim()` (kod başına toplam) · `aktorDebug.bayrak("olay,-tetik")` · `aktorDebug.temizle()`. Satır biçimi: `HATA zaman [aktor] (×N) [KOD] ayrıntı` + ilk satırda `↳ alan: anlam — çözüm`.

**Bekçi** (`uygulama/aktor/aktorHataBekcisi.test.ts`): aktör altyapısı dosyalarında çıplak `throw new Error(` yok; kaynakta geçen her `AKT-…` katalogda; katalogdaki her kod kaynakta ≥1 kez kullanılıyor (ölü kod yok); alan öneki/benzersiz anlam/çözüm dolu. Yeni hata = önce kataloğa satır, sonra kodu kullan.

**Kapsam dışı (dürüst):** level doğrulama hataları (`bilesenKaydi.ts`, `levelTanimi.ts`) yol bilgisi taşır ve kodsuz kaldı; graf çalıştırıcısının kendi günlüğü (spec 43 A4) ayrıdır; canlı senaryoda (gerçek glb, gerçek kare döngüsü) günlük çıktısı henüz izlenmedi.
