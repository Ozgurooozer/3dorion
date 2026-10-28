# Spec 39 — Motor ve Proje (Unreal gibi)

**Durum:**
- D1, D2 ve D3 YAZILDI; `projedene` 13/13, `dokdene` 14/14 [ÖLÇÜLDÜ].
- D4–D6 YAZILDI (2026-10-28): birim testleri + bozma denemesi `[TEST]`; `icerikdene` 32/32 [ÖLÇÜLDÜ]; gerilemeler: dokdene 14/14, projedene 13/13, sekansdene 7/7, kameradene 12/12, grafdene 11/11, rigdene 26/27 (R3, HEAD'de de aynı) [ÖLÇÜLDÜ]. Ayrıntı §9–§12.
- D7 (karakter tanımı düzenleme, prefab) ayrı onay ister; yapılmadı.

**İstisna:** Ozyn 2026-10-27, "şimdi başla", level'ın projeye taşınması dahil.

## 1. Neden
Kod, motor içeriği ve Ozyn'in içeriği iç içeydi:
- Level repodaydı.
- Modeller `assets/`teydi.
- Sekans, graf ve NPC `<userData>/orion-*` altına dağınıktı.

Ozyn Unreal mantığını istedi:
- Motor bir yerde, proje Belgeler'de.
- Projedeki her şey bir **Content Browser**'da klasör klasör görünür.
- Bir karaktere çift tık, onu kendi görüntü alanında gösteren pencereyi açar.
- Paneller dok edilebilir.

## 2. Kararlar (Ozyn, 2026-10-27)
- **Proje yeri:** `Belgeler/3dorion Projeleri/<Ad>/`.
- **Orion motorda ve tek:**
  - md, hafıza, durum defteri, karar kaydı, ses ve beyin ayarı userData'da kalır.
  - Projede yalnız Orion'un beden tanımı olur (`Characters/Orion/Orion.karakter.json`).
- **Content Browser:** dok edilebilir panel. Bölge kuralına uyan her panel sürüklenip başka bölgeye bırakılabilir.
- **Şablon:** repodaki `world/level/ova/ova.level.json` motorun başlangıç şablonudur. Proje onun KOPYASINI taşır, dosyaya dokunulmaz.

## 3. Biçim
```
<Ad>/<Ad>.orionproj   {"surum":1,"ad","motorSurumu","varsayilanLevel","olusturuldu"}   ← EN SON yazılır
<Ad>/Content/{Levels,Characters,Animations,Sequences,Graphs,NPC,Assets}
<Ad>/Saved/
```
- **Varlık adresleri:**
  - `Engine/...` motorun `assets/` klasörüdür, salt-okunur.
  - `Content/...` projenindir.
  - Bu dilimde Orion'un bedeni `Engine/orion-lowpoly.glb`'ye işaret eder; kopya yok, iki beden ayrışmasın.

## 4. Dilimler
| # | ne | durum |
|---|---|---|
| D1 | Proje çekirdeği (bkz. aşağıdaki liste) | YAZILDI: `host/proje.test.ts`, bozma 16/16 |
| D2 | Ana menü şeridi (pencere tepesi, tek şerit, editör katkısı birleşir) + Proje tarayıcısı (liste/yeni/aç; şablonlar `ofis`, `bos`) | YAZILDI: testli (§7), `projedene` 13/13, `rigdene` 27/27, `sekansdene` 7/7, `kameradene` 12/12, `grafdene` 11/11; görüntüler okundu |
| D3 | Dok sistemi: saf `dokDuzeni` (bölgeler sol/sağ/alt/yüzer, panel izinli bölgeleri, reddin nedeni, kalıcılık) + sürükle-bırak DOM; tuval `--dok-*` paylarını düşer | YAZILDI: `dokDuzeni.test.ts` 20 mutant 20 yakalandı, `dokdene` 14/14 (§8) |
| D4 | Content Browser: klasör ağacı + önizlemeli kartlar, tür tanıma, çift tık türün editörünü açar, sağ tık yeniden adlandır/çoğalt/Explorer/sil (`.silinenler`), içe aktar | YAZILDI (§9) |
| D5 | Varlık/karakter önizleme penceresi: ayrı sahne, orbit kamera (`serbestKamera`), Bileşenler ağacı + Viewport + Ayrıntılar (salt-okunur) | YAZILDI (§10) |
| D6 | Level Outliner (`nesneKaydi`), seçim sahneyle eşleşir | YAZILDI (§11) |

**D1'in içeriği:**
- `host/proje.js`: kök, ad kuralı, oluştur, aç, liste, seç, son açılanlar, hazırla.
- `klasorDizini`'ne `projeDizini` eklendi. Sekans/graf/NPC artık `Content/`te.
- İlk açılışta "Ofis" projesi şablondan oluşur; eski userData klasörleri silinmeden kopyalanır.
- IPC kanalları `projeBilgi` ve `projeLevelOku` eklendi. Ova artık projeden okunur (`yerGecisi.ts ovaTanimiOku`).
- Pencere başlığı açık projeyi gösterir.

## 5. Kurallar (D1, `host/proje.test.ts`)
- **Kök önceliği:** `ORION_PROJELER_KOKU` > `ORION_SMOKE=1` (geçici kök, göçsüz) > Belgeler.
- **Proje seçimi:** `ORION_PROJE` (yoksa hata, sessizce başka proje açılmaz) > son açılan > ilk sağlam proje > yoksa "Ofis" oluşturulur.
- **Klasör önceliği:** sekans/graf/NPC için env > senaryo (geçici) > proje > eski userData.
- **Kopyalama:** üstüne yazmaz; `.silinenler` ve `.tmp` atlanır; kaynak silinmez.
- **Ad kuralı:** harf/rakamla başlar; harf, rakam, boşluk, `_` ve `-` olur; en çok 48; Windows'un ayrılmış adları (CON…) yasak.
- **Hata durumu:** proje hazırlanamazsa açılış durmaz. Konsola `[proje] HAZIRLANAMADI` yazılır ve eski userData klasörleriyle sürülür.
- **Level yedeği:** projede level yoksa renderer şablonu okur ve konsola yazar.

## 6. Açıklar
- Level editörü (`editor.html`, vite uç noktaları) hâlâ repodaki level'ları düzenliyor. Projeye bağlanması D2/D4'te.
- Paketli kurulumda şablon yolu (`KOK/world/level/ova`) doğrulanmadı.
- `Content/Assets` boş. Motor varlıkları "Engine" kökünden görünecek (D4).
- Proje değiştirmek uygulamayı YENİDEN BAŞLATIR (canlı geçiş yok; kasıtlı: sekans/graf/NPC klasörleri ve level açılışta kurulur).
- Graf editörü tam ekran ve kendi menü çubuğunu taşıyor: ana şeride katkı vermiyor (Proje menüsü onda yok); Esc'i proje tarayıcısına bırakır.
- Proje açarken kirli sekme uyarısı yalnız SEKANS editörü için; graf ve md düzenleyicisinin kirli durumu sorulmuyor.
- Sekans editörü açıkken kapanan ana şerit imleç kipi sürdüğü sürece görünür kalır (tuval 30 px kısa).

## 7. D2 — Ana menü şeridi ve Proje tarayıcısı
- **Şerit:** `uygulama/yapi/ortak/anaMenu.ts`. Pencere tepesinde sabit, 30 px (`UST_SERIT_PX`).
  - Görünürlük: imleç kipinde ya da bir editör katkısı varken. Görünürken `--editor-ust` yazılır ve `index.html` tuvali (ve HUD'u) şeridin altından başlatır.
  - Katman: z 40, açılır liste 50.
  - Tuşlar şeritte biter (oyuna sızmaz); en son katkının `tus` işleyicisi önce çağrılır.
- **Birleşim:** `menuBirlestir.ts` (SAF, testli). Aynı adlı menüler tek menü olur: editörün satırları önde, ayırıcı, sonra uygulamanın satırları. İlk görülme sırası korunur, "Yardım" hep SON.
  - Uygulama tabanı: Dosya (Yeni proje…, Proje aç…, Proje klasörünü göster) ve Pencere (Yapı çubuğu).
  - Sekans editörü: açılınca `anaMenu.katki(...)` ile menülerini, tuşunu ve sağ ucunu (sekans adı, kare) kaydeder; gizlenince bırakır. Eski dok-içi menü kalktı.
- **Proje tarayıcısı:** `uygulama/yapi/proje/projePenceresi.ts` (DOM) + `projeModeli.ts` (SAF, testli).
  - Kartlar: son açılanlar önde, açık olan işaretli, bozuk proje nedeniyle görünür ama açılamaz.
  - Yeni proje: ad + şablon. Ad kuralı yalnız host'ta (`projeAdiGecerli`); renderer kopyalamaz.
  - Aç: host seçimi yazar ve uygulamayı yeniden başlatır. Kirli sekme varsa uyarır, ikinci tıklama ister (`acmaUyarisi`). Senaryo koşusunda yeniden başlatma yok.
- **Host:** IPC `projeListe`, `projeYeni`, `projeAc`, `projeKlasorGoster`. Şablonlar `host/proje.js projeSablonu`: `ofis` (ova şablonunun kopyası), `bos` (`world/level/sablon/bos.level.json` kopyası); ikisinde de Orion'un `Orion.karakter.json`'u.
- **Bulduğu hata (projedene P13):** sekans/graf editörünün pencere düzeyindeki tuş yakalayıcısı proje penceresinin Esc'ini yutuyordu (editörü gizleyecekti). `.pp-kok` istisnaya eklendi, bekçi testi var (`sekansBekci.test.ts`).
- **Ölçümler [ÖLÇÜLDÜ]:**
  - `projedene` 13/13.
  - Boş şablonlu proje açıkken (kazara oluşan koşu) `bos` level'ı projeden okundu ve birleşik dünya kuruldu (yer=ova, nesne 15).
  - `rigdene` R9b beklentisi ana menü payını (`--editor-ust`) sayacak şekilde güncellendi, 27/27.
  - `kapidene` 15/19: HEAD'deki aynı 4 kırmızı (D2'den bağımsız, gerileme eski).
- **Bozma denemesi:** 21 mutant, 19 yakalandı, 2 eşdeğer (hata metninin kelimesi; zaten ada göre sıralı listede ada göre ikinci sıralama).

## 8. D3 — Dok sistemi
- **Saf model** `uygulama/yapi/ortak/dok/dokDuzeni.ts` (DOM yok, her işlem yeni düzen döndürür):
  - Bölgeler: sol · sağ · alt (sekmeli, kenara yaslı) ve yüzer (panel başına pencere).
  - Panel kaydı `{id, ad, bolgeler (izinli), varsayilan}`. İzinsiz bölgeye bırakma REDDEDİLİR, nedeni söylenir ("Rig paneli alt bölgeye bırakılamaz: izinli bölgeler sol, sağ, yüzer").
  - İşlemler: taşı (sıra dahil), kapat (`kapali` listesi), aç, etkin sekme, boyut (bölge başına sınır: sol/sağ 180–720 px, alt 120–600), yüzer konum.
  - Kalıcılık: `serilestir`/`oku`. Bozuk metin, yanlış sürüm → varsayılan; bilinmeyen panel düşer, yinelenen tek kalır, sonradan eklenen panel varsayılan bölgesine girer, izinsiz bölgedeki panel varsayılanına döner.
- **DOM** `dokYoneticisi.ts` + `dokStili.ts`:
  - Sekme başlığı HTML5 sürükle-bırak: boş bölgeler kenar şeridi, yüzer ortada hedef olur; izinsiz hedef gri. Aynı bölgede sürükleyince sıra değişir.
  - Kenar tutamağı boyutu değiştirir. Yüzer pencere başlıktan taşınır, köşeden büyür, ⇲ ile bölgeye döner. Panelin içeriği (sahibinin DOM öğesi) bölgeler arasında TAŞINIR; görünmeyenler gizli depoda durur.
  - Görünür paneli olan bölge `--dok-sol|sag|alt` yazar; `index.html` tuvali (ve HUD'u) bunlardan düşer. Alt bölge Yapı çubuğu/editör payının ÜSTÜNDE oturur.
  - Sürükleme sırasında yeniden çizilmez (kaynak sekme DOM'dan giderse `dragend` gelmez). Tuşlar dok kökünde biter (oyuna sızmaz).
  - Pencere menüsü: kayıtlı her panel (işaretli = açık; sahibi görünmezken pasif) + "Dok düzenini sıfırla".
- **İlk paneller:** sekans editörünün Ayrıntılar · Rig · Kamera sekmeleri (`yanSekmeler.ts` artık dok adaptörü; kimlikler `sekans-<id>`). Ayrıntılar/Kamera: dört bölge, Rig: sol/sağ/yüzer. Editör gizliyken paneller görünmez, bölge açmaz.
- **Ölçümler [ÖLÇÜLDÜ]:**
  - `dokdene` 14/14 (bölge payları, tuval ölçüleri, gerçek `DragEvent` sürükle-bırak, izin reddi ve ekrandaki neden, sıralama, boyut ve sınır, yüzer taşıma, Pencere menüsünden geri açma, depo gidiş-dönüşü, tuş sızıntısı, editör kapanıp açılınca düzen).
  - Bozma denemesi: 20 mutant, 20 yakalandı (ilk koşuda 4 kaçtı: negatif sıra, yüzer panelde `etkinYap`, sürümsüz dolu kayıt, bir desen hatası; testler güçlendirildi).
- **Açıklar:**
  - Düzen `localStorage`'da (anahtar `orion.dok.v1`); spec'in `Saved/dok.json`'u için ana süreç kanalı yok. Depo yoksa her açılışta varsayılan.
  - Panel sonradan kaydolur ve kullanıcı o oturumda düzeni değiştirmişse, o panelin eski `kapali` kaydı kaybolur (varsayılan bölgesine girer).
  - Altyazı, diyalog ve HUD'un orta hizalı kutuları dok payını bilmez: sol/sağ bölge açıkken tuvale göre değil pencereye göre ortalanır.
  - Gizmo/rig kontrolleri ve çok sayıda panel yüzerken üst üste binebilir; z-sırası sabit.
  - Yapı çubuğunun Asset/Zemin/Hafıza sekmeleri dok paneli DEĞİL (D4'te Content Browser'a katılacak); graf editörü dok kullanmıyor. Zaman çizelgesi ve 3B yüzeyler (monitör, tahta) taşınmaz.
  - Gerçek fareyle sürükleme elle denenmedi (senaryo sentetik `DragEvent` ve `PointerEvent` kullanır).

## 9. D4 — Content Browser (İçerik gezgini) `[TEST]`, canlı `[YAZILDI-KOŞULMADI]`
- **Adres:** `Content/...` (açık proje, yazılabilir) ve `Engine/...` (motorun `assets/`i, SALT OKUNUR). Renderer dosya yolu görmez; `host/icerik.js` çözer. Parça kuralı: boş, `.`, `..`, noktayla başlayan, Windows'ta geçersiz karakterli parça reddedilir.
- **Host** (`host/icerik.js` saf Node, 17 test; IPC `icerikListe|Ikili|Metin|YeniKlasor|Adlandir|Cogalt|Sil|IceAktar|Goster`):
  - Content ve 7 tür klasörü (Levels, Characters, Animations, Sequences, Graphs, NPC, Assets) korumalı: adlanmaz, silinmez.
  - Türün ad kuralı geçerli (level klasörü küçük harf/rakam/tire ve içindeki `<ad>.level.json` birlikte adlanır; düz klasörler `grafAdiGecerli`).
  - Silme = `Content/.silinenler/<zaman>-<ad>`e taşıma. Hiçbir işlem var olanın üstüne yazmaz.
  - İçe aktar: dosya seçici ANA SÜREÇTE; yalnız glb/png/jpg/jpeg/webp, ≤128 MB, `Content/Assets` altına; atlanan dosya nedeniyle döner. SMOKE'ta `ORION_ICE_AKTAR`.
  - Liste ≤6000 öğe, derinlik ≤10, aşılırsa `kesildi`. İkili okuma ≤48 MB, metin ≤1 MB.
- **Model** `uygulama/icerik/icerikModeli.ts` (saf, 15 test): tür tanıma, ağaç, paket kartı (`<x>/<x>.level.json` ya da `.karakter.json` içeren klasör tek kart), arama (derin, Türkçe küçük harf), süzgeç, favoriler.
- **Panel** `uygulama/yapi/icerik/icerikPaneli.ts` (dok `icerik`, varsayılan alt, `baslangicKapali`): araç çubuğu, Favoriler + ağaç, kırıntı, önizlemeli kartlar; çift tık türe göre açar (sekans/graf → editör, karakter/glb/görsel → önizleme, klasör → gir); sağ tık menüsü, F2, Delete.
- **Dok'a eklenen:** `PanelKaydi.baslangicKapali`, `DokYoneticisi.yuzerAyarla`.
- **Bozma `[TEST]`:** 55 mutant, 53 yakalandı; 2 eşdeğer (başka kök öğeleri ulaşılamayan düğümde kalır; `gecerliKlasor` kök yedeği).
- **Canlı `[ÖLÇÜLDÜ]`:** `3dorion.bat icerikdene` 32/32 (geçici projede; ekran görüntüleri `%TEMP%\icerikdene\01…12` okundu: panel alt bölgede, Orion paket kartı, önizleme viewport'unda beden çizili).
  - İlk koşuda 2 kırmızı gerçek hata çıkardı: (1) senaryoda sekans klasörü SMOKE'ta `orion-sekans-deneme`ye gidiyordu, kartlar Content'te görünmüyordu → `klasorDizini` yalnız `ORION_ICERIKDENE=1` iken proje klasörünü kullanır (SMOKE'ta proje kökü zaten geçici); (2) **ürün hatası:** düz türlerde (Sequences/Graphs/NPC) depolar dosyayı İÇTEKİ `ad` alanıyla tanıdığı için Content Browser'dan çoğaltılan/adlandırılan dosya açılmıyordu (kopya aynı adı taşıyordu) → `icAdiUydur`: içteki ad dosya adına eşitse yeni adla değiştirilir (testli).
  - Bir beklenti düzeltildi (K6b ret metni "olmalı" diyor, "geçersiz" değil); davranış doğruydu.
  - Not: oyun açıkken koşuldu (Ozyn'in önceki "Kapattım, koş" onayı vardı; ikinci kopya Ozyn'in pencerelerine dokunmadı, süreç öldürülmedi).

- **Kullanım turu (2026-10-28, arayüz gözden geçirme; `icerikdene` 36/36 [ÖLÇÜLDÜ], 3 yeni model testi [TEST]):** ekran görüntülerinde bulunan zorluklar giderildi:
  - Süzgeç düğmeleri yalnız ikondu (9 aynı boyda simge) → "🎞 Sekans" gibi adlı + "Tümü" düğmesi (süzgeç yokken işaretli).
  - Kart adı `selamlasma_2.js…` diye kesiliyordu → `gorunenAd`: türün uzantısı kartta düşer (tam ad ipucunda; adlandırma girdisi tam ad).
  - Klavyeyle gezilemiyordu → ok tuşları/Home/End (`gezin`, sütun sayısı çizimden okunur), seçili kart görünür alana kayar.
  - Kart boyutu sabitti → kaydırıcı (72–200 px) ve klasör ağacı ayırıcısı (sürükle; çift tık sıfırlar); ikisi `localStorage`da kişisel tercih.
  - Alt bölge varsayılanı 240 → 300 px (ağaç ~6 satır, kartlar 1 satır görünüyordu). Durum çubuğu seçili öğenin türünü ve boyutunu da yazar; boş klasör/boş sonuç ne yapılacağını söyler.
  - Outliner panele gelince hemen tazelenir (1 sn'lik zamanlayıcıyı beklemez).

## 10. D5 — Varlık / karakter önizleme penceresi `[TEST]`, canlı `[YAZILDI-KOŞULMADI]`
- `uygulama/yapi/onizleme/varlikPenceresi.ts`: dok paneli `varlik-onizleme` (varsayılan yüzer 860×500, ilk açılışta kapalı). Bileşenler (mesh/iskelet/kemik/malzeme/animasyon) · Viewport (orbit) · Ayrıntılar (dosya, üçgen, köşe, kemik, ölçü). Araç çubuğu: animasyon seçici, Kemikler, Izgara, Sığdır. Karakter: tanımdaki `beden` glb'si yüklenir, boşta/idle döngüde oynar. Görsel `<img>` ile.
- Kendi Engine/Scene/canvas'ı; Babylon "son oluşturulan sahne/motor" kayıtları ana değerine döndürülür; pencere görünmezken çizmez.
- Saf: `varlikModeli.ts` (8 test), `varlikOzeti.ts` (2 test, gerçek `orion-lowpoly.glb`, NullEngine). Bozma: 19/19.

## 11. D6 — Level Outliner `[TEST]`, canlı `[YAZILDI-KOŞULMADI]`
- `uygulama/yapi/outliner/outlinerPaneli.ts` + `outlinerModeli.ts` (7 test): kaynak `Yer.nesneler`, türe göre gruplu, arama; satır tıklaması sahnedeki `secim` durumunu değiştirir, sahnede seçim paneli işaretler (`nesne.secildi`); "İçerikte göster" İçerik gezginini `Content/Levels`a götürür; liste 1 sn'de bir imzayla tazelenir. Bozma: 14/15 (1 eşdeğer).

## 12. Açıklar (D4–D6)
- Level çift tık canlı geçiş YAPMAZ (proje açılışta `varsayilanLevel`ı kurar); altyazı söyler.
- Açık sekans/graf sekmesindeki dosya İçerik'ten adlandırılır/silinirse editör bayatlar (depolar yalnız `baslat()` ile tazelenir).
- Yapı çubuğu Asset sekmesi Content Browser'a katılmadı.
- Explorer'dan sürükle-bırak ve panelde sürükleyerek taşıma yok.
- Önizleme tek pencere (son açılan); yalnız glb; gerçek fareyle orbit/sağ tık elle denenmedi.
- Outliner: nesne→varlık eşlemesi yok ("İçerikte göster" level dosyasını seçer); Orion/Flash gövdeleri listede yok.
- Karakter tanımı düzenleme yok (D7).
