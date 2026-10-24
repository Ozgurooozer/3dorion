# Spec 38 — Control Rig, kanonik iskelet, Sekans kamerası ve editör kabuğu

Durum (2026-10-24): yazıldı, `rigdene` 27/27, `kameradene` 12/12, `grafdene` 11/11 canlı koşuldu (ekran görüntüleri `%TEMP%\rigdene`, `%TEMP%\kameradene`). Kullanıcı (Ozyn) canlıda
henüz denemedi. Bağlam: spec 36 (Sekans), spec 37 (Kimodo hattı). Ozyn'in isteği: "Kimodo ile yapıp kendi sahnemizde düzenleyebilmek; control rig, modüler, iskelet
düzgün; arayüz kullanışsız, menüler/araçlar yerinde olsun, kamera ekleyebilelim".

## 1. Karar özeti
- **Rig = Sekans verisini düzenleyen görsel katman.** Yeni bir animasyon biçimi YOK: rig, bir kontrolü döndürünce playhead karesine uzuv izlerine ANAHTAR yazar (auto-key).
  Kimodo çıktısı (64 izli sekans) doğrudan düzenlenir; her düzenleme TEK geri al adımıdır.
- **Modüler, iç içe değil:** saf çekirdek (Babylon yok) ile ince Babylon katmanı ayrı; tek yönlü bağımlılık; kontrol kaydı bir TABLO (yeni kontrol = yeni satır).
- **Kanonik iskelet** kaynak iskeletten ayrıldı (§2). Retarget, IK ve rig yalnız ona dayanır.
- **Kamera sekansın parçası:** isimli kameralar + kamera kesmeleri (§7), dosyada saklanır; oynatma ve önizleme canlı kamerayı sürer.
- **Editör kabuğu** (menü çubuğu, araç çubuğu, yan sekmeler, yeniden boyutlanır dok, durum çubuğu) Sekans için kuruldu (§6); Graf editörü sonraki adım.

## 2. Kanonik iskelet (`world/avatar/iskelet/`)
```
kanonik.ts   YAPI: 17 uzuv (kalca kökü; omurga, baş-boyun, sağ/sol kol, sağ/sol bacak zincirleri), ebeveyn, kutup (dirsek GERİ −Z, diz İLERİ +Z)
kaynaklar.ts KAYNAK ADLARI: uzuv → VRM kemik adı, SOMA (Kimodo) eklemi, prosedürel düğüm, yön noktası
zincirler.ts İKİSİNİN BİRLEŞİMİ (eski ZincirEklemi biçimi): çevirici, eşleme tablosu ve rig bunu okur — tüketiciler değişmedi
```
Yeni kaynak iskelet (Mixamo, Unreal Mannequin) = `kaynaklar.ts`'e bir tablo; yapıya ve zincirlere dokunulmaz. Birleşik tablo eski tek-tablo hâliyle anlamca AYNI
(anlık görüntü karşılaştırması; `iskelet/kanonik.test.ts`). Unreal IK Rig / Mixamo karşılığı: kalca = pelvis/Hips, govde = spine_01, gogus = spine_03, boyun = neck_01,
kol = upperarm, on_kol = lowerarm, el = hand, bacak = thigh, diz = calf, ayak = foot.

## 3. Control Rig modül haritası
```
world/avatar/rig/matris.ts      3×3 dönme matematiği (çevirici ile ORTAK tek kopya; tools/kimodo/matris.ts yeniden dışa aktarır)
world/avatar/rig/poz.ts         eksendeDondur(Euler, eksen, derece): gövde ekseninde SOLDAN çarpım, öncekine en yakın Euler (±180 sarma, gimbal)
world/avatar/rig/kontroller.ts  KONTROL KAYDI (tablo): şekil (halka, disk, kutu), yarıçap, ad, renk (Unreal: sağ kırmızı, sol mavi, orta sarı)
world/avatar/rig/surukleme.ts   fare farkı → açı (halka teğeti ekranda, kenardan bakışta sınırlı)
world/avatar/rig/halkaSecimi.ts halka seçimi EKRAN UZAYINDA (en yakın çizgi, 11 px) — mesh pick değil (üst üste binen tüpler yanlış halkayı seçiyordu)
world/avatar/rig/gosterim.ts    Babylon: şekiller (gövdenin üstünde, renderingGroup 1), seçili kontrolün 3 döndürme halkası
uygulama/rig/anahtarla.ts       rigDuzenle(): hedef toplam dönme → izler/anahtarlar (klip altta oynarken katkısı ÇIKARILIR; yeni iz ±6 kare komşu sıfırla)
uygulama/rig/rigKipi.ts         denetleyici: seçim, sürükleme önizlemesi (bırakınca TEK adım), geri al, bedene poz (Avatar.rigPozu)
uygulama/yapi/rig/rigPaneli.ts  panel: zincir zincir kontrol listesi, 3 kanal sayı kutusu ± düğmeleri, anahtar durumu
```
Avatar kamu yüzüne eklenenler: `rigPozu(uzuvDegerleri | null)` (klibin YERİNE uygulanır; ▶ sırasında bırakılır), `uzuvKonumu(uzuv)`, `cizimYaw()`; `Beden.rigPozu`,
`AvatarIskeleti.uzuvKonumu`. Sekans scrub'ı artık gövdeyi oynatır (eski açık kapandı: rig kipinde playhead karesinin pozu bedende görünür).

**Auto-key kuralı:** hedef = uzvun O KAREDEKİ TOPLAM dönmesi (bütün izlerin toplamı); yazılan değer = hedef − öteki izlerin katkısı. Böylece klip bölümü altta oynarken elle
eklenen iz klibin ÜSTÜNE biner. Kilitli iz, anahtar tavanı (256), iz tavanı (64) nedenle reddedilir (`sekansDogrula`).

**Kapsam dışı (sonraki dilimler):** R2 iki kemikli IK çözücü ve ayak sabitleme (kutup bilgisi kanonik tabloda hazır), R3 poz kütüphanesi ve Kimodo düzeltme akışı, konum tutamacı
(yalnız dönme var), Flash'ın bedeni (rig yalnız Orion'u düzenler), yüz paneli.

## 4. Kamera (sekans biçimi, `protocol/sekans.ts`)
```
kameralar: [{ id, ad, konum:[x,y,z], hedef:[x,y,z], fov }]      en çok 8; koordinat ±1000 m; fov 10–120°; konum≠hedef (≥ 1 cm)
kesmeler:  [{ kare, kamera, gecis:"kesme"|"yumusak", gecis_kare }] en çok 64; kare KESİN artan; yumuşak için 1–90 kare (kesme: 0)
```
İsteğe bağlı üst düzey alanlar; boşsa YAZILMAZ (eski dosyalar aynen geçerli, SEKANS_SURUMU değişmedi). İz değil: kamera bir ajana bağlı değil. İlk kesmeden ÖNCE oyunun kendi kamerası sürer.
Değerlendirme saf (`uygulama/sekans/kameraDegerlendir.ts`): kare ≤ k olan son kesme; yumuşak geçişte önceki kameradan smoothstep harman (konum, hedef, fov).

**Canlı kamera:** `KameraRig.sekansKamerasi(konum, bakis, fov)` odaktan ve sinematikten ÖNCE gelir, yumuşatmasız tam poz; `sekansKamerasiBirak()` oyuncuya döner ve fov'u geri koyar.
`kameraOynatici.ts`: ▶ sırasında oynatıcının ANLIK GÖRÜNTÜSÜNDEKİ kamera verisi (oynarken düzenleme kamerayı değiştirmez) ve oynatıcının karesi; oynamıyorken editörün önizlemesi
(Kamera sekmesi: Kapalı / Seçili kamera / Sekansın kamerası). Yalnız kamera kesmesi olan, hareketsiz sekans da oynar (süreyi saat bitirir).
Kamera kaynakları: oyuncunun şu anki görünümü (3 m önü hedef), Orion'un karşısı/yanı; sonra sayı kutuları ve yörünge düğmeleri (◀ ▶ ▲ ▼ ＋ −, hedef sabit). Editör açıkken
sahnede serbest gezinti yok (tuşlar editörün); önizleme canlı olduğundan sayı değişince kadraj anında değişir.
**İleride çağrılabilirlik:** kameralar adla saklı; "kamerayı çağır" için grafik düğümü/niyet bu spec'te YOK (Orion'un araç yüzeyine hiçbir şey eklenmedi).

## 5. Güvenlik
Rig yalnız sekans VERİSİNİ düzenler; çalıştırma (▶) yolu aynı: yalnız gerçek tık (`isTrusted`), menüde ▶ YOK. Rig fare olayları yalnız gerçek tık; senaryo programlı yolu
yalnız rigdene/kameradene koşusunda (`senaryoKosusu`). Orion'un araç yüzeyi ve niyet sözleşmesinde rig/kamera yok (bekçi `sekansBekci.test.ts` korunur).

## 6. Editör kabuğu (Sekans)
Yerleşim: boyut tutamağı · menü çubuğu (Dosya, Düzen, Görünüm, Oynat, Ekle, Rig, Yardım) · sekme satırı · araç çubuğu (⏮ ◀ ▶ ■ ▶| ⏭ ⟳ | ◆ 🧲 ⤢ | 🦴 🎥 🎯 | okuma | Kaydet ✕) ·
gövde: sol iz listesi | zaman çizelgesi | sağ sekmeler (Ayrıntılar · Rig · Kamera) · durum çubuğu. Zaman çizelgesinin en üstünde 🎥 Kamera satırı (kesme blokları, sürüklenir, çift tık ekler).
**Sahne dokun altında kalmaz:** dok açıkken tuval küçülür (`--editor-alt`; `index.html`: `#tuval` yüksekliği `max(--alt-cubuk, --editor-alt)` kadar kısalır, ResizeObserver motoru boyutlar);
dok yüksekliği tutamakla ayarlanır (220 px – pencerenin %75'i, oran hatırlanır). Altyazı ve sohbet bu payı bilir. Yapı çubuğu açıkken de tuval onun kadar kısa (yan etki: alttaki 41 px
şerit artık sahnenin parçası değil).
Ortak parçalar `uygulama/yapi/ortak/`: `menuModeli.ts` (saf, testli), `menuCubugu.ts`, `yanSekmeler.ts`, `dokBoyutu.ts`, `kabukStili.ts` — Graf editörü de bunları kullanacak.

## 7. Ölçümler
- Birim test: 5303 test, tek eski kırmızı ("ova bütün yerleşimleri dönüşsüz"). Yeni testler: iskelet 7, rig çekirdeği 11, sürükleme 8, halka seçimi 7, anahtar yazma 10, sekans kamera biçimi 7,
  kamera değerlendirme/işlemler 10, kamera oynatıcı 6, kamera yardımcıları 6, menü modeli 5, izDuzeni kamera satırı 2.
- Bozma denemesi: ilk tur 18 mutant, 17 yakalandı + 1 eşdeğer; ikinci tur (serbest kamera, yön, yansıtma, gruplar, öteleme) 14 mutant, 13 yakalandı + 1 eşdeğer (öteleme kısması kanal kısmasıyla aynı). İlk turun ayrıntısı: ("harman bir kare uzun": o karede smoothstep 1, poz aynı). İlk koşuda "halka parçası sınırı" kaçmıştı, test eklendi.
- `rigdene` 12/12: 17 kontrol şekli, el kutusuna tıklama doğru kontrolü buluyor, X halkası seçiliyor, sürükleme eli 44 cm taşıdı ve anahtar yazdı, geri al eski yere döndürdü (fark 1,5 cm =
  boşta nefes gürültüsü), panelden döndürme eli 29 cm taşıdı, ▶ rig açıkken çalışıyor, tuval dokun üstünde (465/861 px), editör kapanınca editör payı 0.
- `kameradene` 8/8: iki kamera gerçek düğmelere tıklanarak eklendi, önizleme kamerayı 0,000 m sapmayla taşıdı, ▶ sırasında kamera 1→2 gitti (0,00 m), bitince oyuncuya döndü,
  yalnız-kamera sekansı oynadı ve bitti. `sekansdene` 7/7, `klipdene` 5/5, `kimododene` 9/9 bozulmadı.
- Bulunan ve düzeltilen: rig açıkken FPS 100→5 (her karede `setEnabled`, ışık kaynağı yeniden hesabı); halka tıklama tüpü 7 mm; üst üste binen tüpler yanlış halkayı seçiyordu.

## 8. Gizmo, gruplar ve serbest kamera (ikinci tur, Ozyn'in istekleri)
- **Kare kare poz:** editör açıkken beden HER ZAMAN playhead karesinde (rig kapalıyken de; `RigKipi.pozOnizleme`). ◀ ▶| düğmeleri, ← → tuşları, cetvelde sürükleme, ■ ile durulan kare beden pozunu sürer. ▶ sürerken klip yolundan oynar.
- **Serbest kamera** (`uygulama/sekans/editor/serbestKamera.ts` saf + `yapi/sekans/serbestKameraGirdisi.ts`): sağ tuş sürükle = orbit, orta tuş = pan, tekerlek = yakınlaş, sağ tuş + W A S D Q E = uç (Shift 3×), Alt + sol tuş = orbit; 🎯 Orion düğmesi kadrajı sıfırlar. Yalnız editör açıkken; sekans kamerası (▶/önizleme) varsa o üstte, yoksa serbest kamera (`kameraOynatici.serbest`). "Şu anki görünümden kamera ekle" artık serbest kameranın gözüdür. Editör kapanınca oyuncuya döner.
- **Gizmo kipleri** (panel: Gizmo · Yön): **Döndür** (halkalar), **Taşı** (oklar), **Ölçek**. Yön: **Gövde** (eksenler gövdeyle döner) / **Dünya** (sahneye sabit; dünya ekseni gövdeye çevrilir `dunyaEkseniGovdeye`, sonra `eksenVektorundeDondur`). Taşı YALNIZ Pelvis (kök) için çalışır: bütün bedeni `kok` ötelemesiyle taşır (biçim sınırı ±0,5 m). El/ayak taşımak IK ister (yazılmadı): neden arayüzde söylenir. **Ölçek KAPALI**: biçimde ölçek kanalı yok; düğme sahte çalışmaz, nedeni ipucunda. Oklar ve halkalar ekran uzayında seçilir (`halkaSecimi.enYakinOk/enYakinHalka`).
- **Gruplar** (`KONTROL_GRUPLARI`, kanonik zincirlerden): Gövde ve baş, sol/sağ kol, sol/sağ bacak. Grup başına **Sıfırla** ve **⇄ karşı tarafa yansıt** (sol↔sağ: yan eksen aynı, y ve z işaret değiştirir; `yansit`), **Poz kopyala/yapıştır** (bütün beden, kareden kareye), **Hepsini sıfırla**; ◆ işareti bu karede anahtarı olan kontrolleri gösterir; seçili kontrolün kanalları kaydırıcı + sayı + ± + ↺ (kaydırıcı sürülürken yalnız ÖNİZLEME, geri al yığınına girmez; bırakınca yazılır). Toplu işlemler YARIM KALMAZ (bir uzuv reddedilirse hiçbiri yazılmaz) ve tek geri al adımıdır.

## 9. Açıklar (dürüst liste)
- Canlıda insan eliyle denenmedi: gerçek fare sürükleme hissi, halka seçim payı (11 px), kamera yörünge düğmelerinin adımı, sahnenin tuval küçülmesiyle görünüşü.
- Rig şekilleri uzaktan küçük (kamera Orion'dan 4 m); odaklı kadraj için Kamera sekmesinin "Orion'un karşısı" önizlemesi kullanılabilir.
- Taşı yalnız kök için; el/ayak taşıma (IK) ve ayak kayması düzeltmesi yok; Ölçek biçimde yok; Flash'ın bedeni rig'de yok. Dünya yönü birim testlidir ama senaryoda Orion yaw 0 olduğundan gövde/dünya eksenleri çakıştı (canlıda farkı görülmedi).
- Kesme sürükleme son hâli ve zaman çizelgesindeki kamera satırı ayrıntıları `kameradene`'de yalnız görüntüyle (`02_kesmeler_cizelgede`) görüldü.
- Graf editörü yeni kabuğa taşınmadı (menü/araç çubuğu/dok yok); sıradaki iş.
- Serbest kamera fare hissi (orbit 0,3°/px, uçuş 2,2 m/sn) ve gizmo oklarının tutma payı (12 px) insan elinde denenmedi.
- Animasyon odası (stüdyo, boş sahne) önerildi; `world/level/` istisnası gerektirir, yapılmadı.
- Kamera çarpışması yok (iki kamera arası düz çizgi duvardan geçebilir).
