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

## 4. Açık (Ozyn'in kararı)
1. Ofisin ova'daki yeri: orijin (düz alanın ortası, bugün ova orijinde) mi, bina HEAD'deki gibi (-2, 22) civarında mı? Ofis
   koordinatları mutlak olduğundan "taşımak" ofisi değil ova'yı kaydırmak demek; en ucuz yol ofisi orijinde bırakıp ova'nın
   içeriğini ona göre düzenlemek. `ova.level.json` senin dosyan: değişikliği sen yapar mısın, ben mi (yedekle + sor)?
2. Yeşil harabe aynı level'a mı girecek, ayrı kalacak mı?
3. Ofisin mor sisi/ışığı korunacak mı (bölgesel sis için ek iş: post-process ya da kapı eşiğinde anahtarlama) yoksa ova'nın havası
   ofise de mi gelecek?
