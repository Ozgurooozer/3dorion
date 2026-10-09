# Spec 22 — Level editörü: modüler çekirdek + bütün araçlar

> Durum: **Faz 1–7 uygulandı** (2026-10-09).
> Deneme: `npm run editor-dene` (36 adım, gerçek fare/klavye) · ölçüm: `npm run editor-dene -- --olc`.

## 0. Neden
Ozyn: "Bu dünyada her şey zemine sabitleniyor"; "level editör araçlarımızın hepsi olmalı… baştan savma değil,
modüler esnek core bir altyapı; asset browser dahil, düzenli." Kontroller için: "Unreal ya da mevcut değil, daha
kullanışlı bir düzen yarat." Arazi araçları: "girsin, en sona".

Önceki durum: yerleşim yalnız zemine (y hep zemin), yalnız Y dönüşü + tek ölçek, kimlik = dizideki sıra (silme
sonrakileri yeniden kurar), her düzenlemede düğüm yık-kur, tek seçim, Q/E hem kamera hem döndürme (çakışma),
geri al var ileri al yok, tuşlar 4 dosyaya dağınık.

## 1. Katmanlar
```
world/level/cekirdek/        veri: NesneYeri (id, ad, donus/olcek sayı|[x,y,z], grup, gizli, kilitli), gruplar,
                             kameraYerleri; kimlik.ts, donusum.ts, grup.ts; nesneSistemi kimlikle eşler
world/level/editor/cekirdek/ SAF (Node'da test): durum (tek değişiklik yolu), gecmis, komutlar, secim, yaslama,
                             kisayol (tek harita), pano (parça biçimi), firca
world/level/editor/sahne/    Babylon, DOM'suz: yuzey, kamera, gizmo, vurgu, yuzeySurukle, yerlestirme, izgara,
                             firca (imleç), cetvel
world/level/editor/arayuz/   DOM: editorArayuzu (yuvalı düzen), aracCubugu, sahneAgaci, ozellikler, varlikTarayici,
                             gorunum, durumCubugu, yardim, ortak (el, CSS belirteçleri, sayı kutusu, tutamak)
world/level/editor/editor.ts kompozisyon kökü — işaretçi sırası, tuş dağıtımı, eylemler
world/level/editor/levelPaneli.ts  "Dünya" sekmesi (stil/palet/ışık/ortam/zaman/shader/katman), durum'a bağlı
```
**Kural:** tanım tek doğruluk kaynağı; her kalıcı değişiklik `durum.degistir(f, mesaj)` → `level.ayarla` (geçersizse
fırlatır, hiçbir şey değişmez) → geçmiş → olay. Sürükleme boyunca yalnız sahne düğümleri oynar (ya da `onizle`,
geçmişsiz); bırakınca TEK adım (`onceki` = sürüklemenin başı). Parçalar birbirini bilmez, durum olaylarına abone olur.

## 2. Veri (geriye uyumlu, `surum` 1)
- Eski dosyalar aynen açılır: kimliksiz yerleşime `normallestir` sırayla kimlik verir (`n1…`); sayı dönüş = yalnız Y.
- Dosyaya kısa biçim yazılır: X/Z dönüş sıfırsa sayı, eşit ölçek tek sayı, konum mm (`donusum.ts`).
- Doğrulama: kimlik benzersiz, grup var, grup döngüsü yok, ölçek > 0, bayraklar mantıksal (`levelTanimi.ts`).
- Gizli/kilitli üst gruptan içindekilere geçer (`grup.ts` `etkinBayrak`).

## 3. Kontrol düzeni (tek harita: `editor/cekirdek/kisayol.ts`, kart: F1)
Kural: aynı bağlamda bir tuş tek iş — `cakismalar()` bekçisi testte boş olmak zorunda [TEST].
| | |
|---|---|
| Sağ tık BASILI | bak; basılıyken W A S D uç, Space/E yukarı, Q/C aşağı, Shift hızlı, tekerlek uçuş hızı |
| Orta tık sürükle / tekerlek | kaydır / imlecin altındaki noktaya yaklaş |
| Alt + sol sürükle | seçimin (yoksa imleç altının) çevresinde dön — HER araçta |
| Sol tık / sürükle | seç (Shift ekle, Ctrl tersle); nesneyi tut → YÜZEYDE kaydır; boşlukta → kutu seçimi |
| Shift + seçiliyi sürükle | kopyala (kopya yerinde kalır), gizmo okunda da |
| 1–9 | Seç · Taşı · Döndür · Ölçek · Kutu · Fırça · Arazi · Güneş · Ölç |
| Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z) | geri / ileri al |
| Ctrl+D, Ctrl+C/X/V, Del | çoğalt, kopyala/kes/yapıştır (imlecin altına; sistem panosuna da), sil |
| Ctrl+G / Ctrl+Shift+G, H / Alt+H, L | grupla / çöz, gizle / hepsini göster, kilitle |
| End | zemine / alttaki yüzeye indir |
| [ ] (Shift 90°), oklar, PageUp/Down | Y'de döndür, kameraya göre ızgara adımı kaydır, dikey kaydır |
| X, N, I | gizmo yerel/dünya, ızgara yaslaması aç/kapa, ızgara görseli |
| F / çift tık | odaklan · Shift+1–9 yer imine git · Ctrl+Shift+1–9 yer imi kaydet (level'a yazılır) |
| Ctrl basılı | sürüklerken yaslamayı geçici tersle |
| Esc | süren işlemi İPTAL (eski yerine), yoksa seçimi bırak |
| Tab | editör ⇄ uçuş kipi (eski fare kilitli uçuş aynen; arayüz gizli) |
| P / Shift+P, B, F8, Ctrl+S | stil / renk önayarı (geri alınır), basılı: ışık sonrası kapalı, Inspector, kaydet |

Neden böyle: araçlar rakamlarda (uçarken basılmaz), uçuş tuşları yalnız sağ tık basılıyken (kamera yakalama
aşamasında tutar, editöre ulaşmaz) → Q/E çakışması yapısal olarak imkânsız. Fırça silgisi Shift (Alt+sol her
yerde yörünge; ilk denemede Alt'ı silgiye vermiştik, kamera yuttu — yakalandı).

## 4. Araçlar
- **Yüzey** (`sahne/yuzey.ts`): arazi analitik yükseklikten ışın yürütmesi (çim hücreleri ışına girmez) + nesne
  mesh'leri. "Alttaki yüzey" yalnız YUKARI bakan yüzleri sayar — ışın binanın içinden başlarsa taban yüzüne
  arkadan çarpıp nesneyi binanın içine gömüyordu (denemede 3,6 cm sapma olarak yakalandı).
- **Yüzeyde sürükle / yerleştir:** çatıya, masaya koyma; ızgara x/z, y yüzeyden; "yüzey" kapalı → yatay düzlem
  (yükseklik korunur); "eğ" → normale hizalı (tek nesne). Tekerlek döndürür.
- **Gizmo** (`sahne/gizmo.ts`): taşı/döndür/ölçek/kutu ayrı yardımcı katmanda; çoklu seçimde pivot (sürüklerken
  düğümler pivota bağlanır, bırakınca çözülür). Bilinen sınır: dönmüş nesneleri eksen başına gruplu ölçeklemek
  kayma üretir, en yakın ayrıştırma yazılır.
- **Seçim dış hattı:** SelectionOutlineLayer (örnekli mesh'leri tek tek ayırır); üstünde durma ayrı renk.
- **Fırça:** damga = dairede aday, mevcutlara ve birbirine en az aralık, rastgele varlık/dönüş/ölçek; Shift silgi
  (yalnız fırçadaki varlıklar, kilitliye dokunmaz); Ctrl+tekerlek yarıçap; tek vuruş = tek geri al.
- **Güneş:** zaman yoksa gökyüzüne sürükle → güneş yönü; zaman tanımlıysa (ova) yatay sürükleme saat.
  `LightGizmo` seçilmedi: zamanlı level'da güneşi saat yönettiği için oku tanıma yazılamazdı.
- **Ölç:** iki yüzey noktası, toplam/yatay/dikey.
- **Hazır yapı (prefab):** seçim → `world/level/hazir/<ad>.hazir.json` (vite `/__level/hazir`), varlık tarayıcısında
  sekme; konunca AÇILIR (yeni kimlikler). Bağlı prefab (tek yerden güncelleme) YOK.
- **Arayüz:** yuvalar boyutlanır/gizlenir (◧ ⬓ ◨), sahne ağacı (gruplar iç içe, göz/kilit, sürükle-bırak, çift tık
  ad, katman gözü), özellikler (etiketinden sürüklenen sayı kutuları, çoklu seçimde yazmak = aynı değer,
  sürüklemek = aynı fark; varlık değiştir; hizala/dağıt), varlık tarayıcısı (kategori, arama Ctrl+F, ★, son, boyut,
  kart boyu, sürükle-bırak), geçmiş listesi (tıkla → o adıma dön), durum çubuğu (imleç noktası, fps).

## 5. Ölçüm [ÖLÇÜLDÜ] (1920×1080, kare sınırı kapalı, ova `?aci=tepe`; `npm run editor-dene -- --olc`)
| durum | fps | çizim/kare |
|---|---|---|
| taban (8 nesne, seçim yok) | 792 | 113 |
| uçuş kipi (arayüz/ızgara/vurgu yok) | 796 | 86 |
| 200 nesne, seçim yok | 398 | 106 |
| 200 nesne, 50 seçili (dış hat) | 325 | 175 |
| 200 nesne, 50 seçili, gizmo sürüklerken | 278 | 184 |
Geri al (200 nesne, 50 dönüşüm): 18 ms (CDP gidiş-dönüş dahil).

**Bulgu (spec 19 düzeltmesi):** `instantiateModelsToScene` varsayılanı KOPYADIR (`doNotInstantiate: true`) —
yerleşimler hiç örneklenmiyordu; 192 nesnede kare başına **1106** çizim, 197 fps. `{ doNotInstantiate: false }` ile
**106** çizim, 398 fps. Örnek gölge almayı kaynaktan okur → birleşik kaynak mesh'te `receiveShadows` açıldı.
Hayalet bilerek kopya (yarı saydamlık örnekte bütün aynı varlıklara geçerdi).

## 6. Arazi araçları (Faz 7, araç 7)
Ozyn: "internette teknikler var, matematik üzerine araştır; Unreal bu işi çok iyi yapıyor." Unreal Landscape
Sculpt araçları ve erozyon literatürü tarandı; karşılıkları:
| Unreal | bizde (`cekirdek/arazi.ts`) |
|---|---|
| Sculpt (raise/lower) | Yükselt / Alçalt (Shift tersi), güç m/damga |
| Brush falloff Smooth/Linear/Sphere/Tip + Falloff % | düşüş `yumusak` (smoothstep) / `dogrusal` (1−u) / `kure` (√(1−u²)) / `uc` (1−√(1−(1−u)²)), `sertlik` = tam etkili iç oran |
| Apply Without Moving | basılı tuttukça ~90 ms'de bir damga |
| Flatten: mode, Use Slope Flatten, Pick Value Per Apply | Düzle: ikisi / yalnız doldur / yalnız kes; eğime göre (başlangıç normaline dik düzlem); hedefi her damgada al |
| Smooth: Filter Kernel Radius | Yumuşat: çekirdek dairesi ortalamasına (damga öncesi değerlerden) |
| Erosion (thermal) | Aşındır: dinlenme açısı + yineleme; fazlanın yarısı en alçak komşuya (Musgrave–Kolb–Mace 1989), kütle korunur [TEST] |
| Noise | Pürüz: tohumlu değer gürültüsü, ölçek |
| Ramp: width, side falloff | Rampa: bas A, sürükle B (canlı önizleme), yarı genişlik = yarıçap |
| Paint layers / foliage erase | çim / kaya / dekor MASKESİ: Kaldır / Geri boya |
Yapılmayan Unreal araçları: hidrolik erozyon (damla/boru modeli; ayrı iş), Mirror, Region copy/paste, Visibility
(delik), Alpha/Pattern fırçası, katmanlı (non-destructive) düzenleme.

**Veri:** zemin `duzenleme`, çim/kaya/dekor `maske` — modül ayarında SEYREK `[anahtar, değer, …]` (yalnız sıfırdan
farklı hücreler; 2 m hücre, çift doğrusal). Modüller `veri: [...]` bildirir → panelde gösterilmez.
**Çekirdek değişikliği (levelKur):** modül `ayarGuncelle` ile değişikliği YERİNDE uygulayabilir (zemin: yalnız
bölgedeki köşeler + normaller; çim: yalnız değişen maske hücreleri) ve değişen BÖLGEyi bildirir; zemine bağlı sonraki
katmanlar `bolgeYenile` alır (yoksa yeniden kurulur). Zincir kuralı daraldı: yalnız zemini SAĞLAYAN katman yeniden
kurulunca, yalnız `zemineBagli` katmanlar yeniden kurulur (kaya değişince çim kurulmaz; gök/bulut/su/parçacık hiç).
**Çim bölgesi:** mulberry32'nin durumu çekim başına sabit artar → `rastgeleAtla(tohum, n)` ile herhangi bir tutama
baştan yürümeden sıçranır; ilk bölge yenilemesinde "hücre → aday tutam" dizini bir kez çıkar. Yalnız yükseklik
değiştiyse tutamların y'si yerinde güncellenir; bölge su seviyesine (`enAlcak`) yakınsa tam yeniden üretim.
**Nesneler:** vuruş bitince tabanı eski arazide olan nesneler yeni araziye taşınır (havadaki/nesne üstündeki değil).
İmleç ışını yalnız ARAZİYE çarpar (binanın arkasındaki zemin işlenir; rampa ucu çatıya bağlanmasın — denemede yakalandı).

**Ölçüm [ÖLÇÜLDÜ]** (damga = bir `level.ayarla`, 6 m fırça):
| sürüm | damga |
|---|---|
| ilk (her damgada bütün katman zinciri) | ~950 ms (çim 860) |
| bölge + yerinde zemin | 166 ms (editörde; arayüz her damgada yeniden çiziliyordu) |
| önizleme ayrı olay (arayüz çizilmez) + çim aday dizini | 115 ms |
| çim sınır kutusu konumlardan (Babylon 8 köşe × her örnek, iki kez: ~65 ms) | ~110 ms |
| çim y'si yerinde (yeniden üretim yok) | **22 ms** ort., en çok 32 (ilki 46: aday dizini) |
Kare başına çizim çağrıları değişmedi (113/86/106/175/184); fps bu oturumda makine yüküyle oynadı (aynı kodla
ardışık iki koşuda taban 584 ve 354) — fps karşılaştırması için sessiz makinede yinelenmeli.
Zemin mesh karesi ova'da 5,8 m (`bolum` 110): 2 m'lik arazi verisi kaba görünür; ince şekil için bolum artırılmalı
(220 → 2,9 m, 97 bin üçgen) — lowpoly görünüşü değiştirdiği için Ozyn'in kararı.

## 7. Yapılmayanlar (dürüstçe)
- Hidrolik erozyon, ayna, bölge kopyala/yapıştır, arazi deliği, desen fırçası, katmanlı arazi düzenlemesi (§6).
- Bağlı prefab; prefab önizleme resmi (kartta 🏗).
- Hazır yapı ve kaydetme yalnız geliştirme sunucusunda (Electron paketinde dosya yazma uç noktası yok).
- Nesneler araziye "bağlı" değil (mutlak y): arazi aracı tabanı eski arazide olanları taşır; başka yoldan (ör. zemin
  tohumu) değişirse End ile yeniden oturtulur.
- Çim yerleştirilen nesnelerin tabanından geçer (çim, nesne yerleşimini bilmiyor).
- DOM arayüzünün birim testi yok; davranış `tools/editor-dene.mjs` ile canlıda sınanıyor.
