# Spec 17 — Ova: yeni level MVP (lowpoly düzlük, çim, gökyüzü)

> Durum: **MVP BİTTİ** (2026-10-08): L0–L4 + level altyapısı (§5). Bütçe ön kaydının dördü de geçti (§6).
> Sırada (ayrı onay): toon/piksel gölgelendirici · gece · ağaç/çiçek · Orion'u ovaya taşımak · odayı çekirdeğe taşımak.
> Sanat kararları Ozyn'in; her faz ekran görüntüsüyle sunulur.

## 0. Tek cümle
Uçsuz bir düzlük, rüzgârlı çim, güzel bir gök — lowpoly, "gerçekçilik değil sanat". Önce Orion'suz, tek başına
bir deneme sayfasında; ileride piksel/toon shader (referans 3) ve Orion'un taşınması ayrı adımlar.

## 1. Kararlar (Ozyn, 2026-10-08)
- **K1** Önce tek başına (`world/level/ova-deneme.html`); oda, oyuncu, avatar, beyin, protokol dokunulmaz.
- **K2** Gündüz (referans 1). Gece (referans 2) sonra.
- **K3** Çim kodda (thin instance), uzak arazi/kaya Blender betiğinde (spec 11 yolu).
- **K4** Baştan shader'a hazır: renk tek paletten (`ovaVerisi.ts PALET`), malzeme tek fabrikadan
  (`ovaMalzeme.ts`), geometri saf dizi (`ovaGeometri.ts`). Toon/piksel shader = fabrikanın içi değişir.

## 2. Ön kayıt — bütçe (ilk ölçümden ÖNCE yazıldı)
| # | ölçüt | eşik |
|---|---|---|
| B1 | FPS (1080p sınıfı, RTX 4060) | ≥ 60 |
| B2 | Çizim çağrısı | ≤ 150 |
| B3 | VRAM artışı (`nvidia-smi` önce/sonra) | ≤ 500 MB |
| B4 | Blender glb | ≤ 4 MB |

## 3. Yapı (ilk sürüm — §5'te altyapıyla değişti)
- `world/level/ova/ovaVerisi.ts` — palet, ölçüler, bütçe, tohumlu rastgele (mulberry32), değer gürültüsü,
  yükseklik (merkez düz, dışa doğru dalgalı), gök/zemin rengi. Saf, testli.
- `ovaGeometri.ts` — flat geometri (üçgen başına köşe, renk, normal): zemin ızgarası, bantlı gök kubbesi,
  ikosahedron kümesi bulutlar ("pişmiş" gölge: alt yüzler koyu, ışıktan bağımsız). Saf, testli.
- `ovaMalzeme.ts` — tek fabrika: `isikli` (zemin) / `pismis` (gök, bulut, güneş: ışıksız, emissive × köşe rengi).
- `ova.ts` — sahneye sarma, hemisferik + yönlü güneş ışığı, EXP2 sis = ufuk rengi = arka plan.
- `ova-deneme.html/.ts` — yürüyen kamera (WASD, fare, Shift), sabit açılar `ufuk|alcak|tepe|gunes`,
  `?piksel=N`, 3 sn ölçüm → başlık "hazir …". Görüntü: `ODA_ADRES=…/ova-deneme.html node tools/oda-goruntu.mjs <klasör> ufuk alcak tepe gunes`.

## 4. Sonuçlar
### L0 + L1 `[TEST]` `[ÖLÇÜLDÜ]`
- 26 saf test (veri 15, geometri 11): belirleyicilik, gök normali içe, zemin normali yukarı, palet, üçgen bütçesi.
- Başsız Chrome, 1280×720: **FPS 100 (vsync tavanı), çizim 3–4, 25 674 üçgen** — B1/B2 çok rahat. VRAM ölçülmedi (L4).
- İlk görüntüde iki hata yakalandı ve düzeltildi: (1) üçgen köşe sırası Babylon'un ön yüz kuralının tersiydi →
  zemin üstten, gök içeriden ayıklanıp görünmedi; (2) ışıksız malzemede emissive yoktu → bulut ve güneş SİYAH.
- Sanat açıkları (Ozyn'e): gök bantları kaba (7 bant, en alttaki geniş açık şerit); zemin lekeleri sert ve koyu
  (referanstaki altın-yeşil değil); bulutlar referansa göre küçük.

## 5. Level altyapısı (Ozyn, 2026-10-08: "alt yapı yok… her şey editable ve modüler olsun")
Kararlar: düzenleme **Inspector + level paneli** · ışık **stilize** (güneş + kademeli gölge + düşük dolgu +
ACES ton eşleme; Standard malzeme, ileride toon/NodeMaterial) · **ortak çekirdek** (oda ileride buna taşınır).
Araştırma: Babylon dış mekân deseni = tek güneş + CSM, güneşin belirgin altında dolgu, görüntü işleme.

```
world/level/
  cekirdek/   levelTanimi (veri tipi + doğrulama) · levelKur (kur, canlı ayarla, yalnız değişeni yeniden kur)
              isikSistemi (güneş, CSM gölge, dolgu, ton eşleme, sis) · malzeme (TEK fabrika) · modul (sözleşme)
              geometri (flat lowpoly) · renk (palet) · rastgele (tohum, gürültü)
  moduller/   gok · gunesDiski · bulut · zemin · kaya  + index (kayıt)
  editor/     levelPaneli (tanımdan otomatik panel, Kaydet) · alanlar (saf) · inspektor (F8, yalnız dev)
  ova/        ova.level.json  ← LEVEL BURADA (palet, ışık, ortam, katmanlar)
```
- **Level = veri:** `ova.level.json`. Katman ayarı `{}` olsa da modül varsayılanıyla tamamlanır (panel her alanı gösterir).
- **Modül sözleşmesi:** `varsayilan` = şema; bilinmeyen ayar ya da yanlış tür HATA (yazım hatası sessiz geçmez).
  Metin ayar = renk başvurusu (palet adı / hex). Yeni katman türü = modül dosyası + kayıtta bir satır.
- **Katman sırası = bağımlılık sırası:** bir katman yeniden kurulunca sonrakiler de kurulur (kaya zemine oturur).
- **Canlı düzenleme:** ışık/ortam anında; katmandan yalnız değişen (ve sonrakiler); palet değişince hepsi.
  Geçersiz düzenleme reddedilir, level önceki hâlinde kalır. Kaydet → vite eklentisi (`vite.config.ts levelKaydet`)
  doğrular ve dosyaya yazar (yalnız var olan level, yalnız geliştirme sunucusu).
- **Inspector:** `@babylonjs/inspector` 9.26.0 devDependency, dinamik import, son pakete girmez.
- Testler: çekirdek 21, levelKur 12 (NullEngine + sahte modül: yeniden kurma sayıları), modüller 14, ova tanım
  bekçisi 5 (geçerli, modüller kayıtlı, renkler çözülüyor, kaya zeminden sonra, üçgen < 80k), editör alanları 7.
- Not: `CascadedShadowGenerator` Node/NullEngine'de kurulamıyor (Babylon içi hata); gölge tarayıcıda doğrulandı.
- Canlı [ÖLÇÜLDÜ] başsız 1280×720: FPS 100 (vsync), çizim 7–8, 25,9 bin üçgen, 5 katman. Gölge kayadan zemine düşüyor.
  Sanat notu: kayaların gölgeli yüzü neredeyse siyah (dolgu 0,35 + ton eşleme) — panelden ayarlanacak.

## 6. L2–L4 sonuçları (2026-10-08)
### L2 — uzak arazi (Blender) `[TEST]` `[ÖLÇÜLDÜ]`
- `assets/kaynak/ova-arazi.py` → `assets/ova-arazi.glb` (**17 nesne, 2280 üçgen, 35 KB**) + düzenlenebilir
  `assets/kaynak/ova-arazi.blend`. Tohumlu, kendi değer gürültüsü (Blender sürümünden bağımsız). Elle şekillendirilen
  .blend'den yalnız dışa aktarım: `--disa-aktar` (komutlar betiğin başında).
- glb **yalnız biçim** taşır; renk Babylon'da paletten (`moduller/uzakArazi.ts`: yükseklik bandı + eğim + kaya).
  Nesne adı sözleşmesi: `tepeler` yerinde kalır, `masa*`/`kaya*` zemine oturtulur.
- `cekirdek/glb.ts` saf glb okuyucu (yükleyici paketi yok): x aynası + sarım çevirme. Bozma denemesi: sarım ve
  ayna bozulunca testler kırmızı (3 ve 2).
- Görüntü kıyası: sahne sisi KAPALIYKEN dağlar soluklaşan zeminin üstüne yapıştırılmış gibi durdu; sis açık
  (varsayılan) tutarlı. Ek hava perspektifi/pus ayarları panelde (varsayılan kapalı/hafif).
### L3 — çim `[TEST]` `[ÖLÇÜLDÜ]`
- `moduller/cim.ts`: 40 bin denemeli tutam, 3 yaprak × 3 üçgen, **ince örnek → 1 çizim çağrısı, ~330 bin üçgen**.
  Renk altındaki zemin lekesinden (`baglam.zeminRengi`, yeni sözleşme), kökten uca üç basamak; normal yukarı
  (zeminle aynı ışık); öbekler ve açıklıklar gürültüden; alan kenarında boy sıfıra iner.
- Rüzgâr: `cekirdek/ruzgar.ts` malzeme eklentisi (`CUSTOM_VERTEX_UPDATE_WORLDPOS`; gölge ve sis kaymış konumu
  kullanır), fabrikada `ruzgar` seçeneği. Canlı kanıt: aynı açıdan iki karede çim bölgesinde 18 889 piksel farklı,
  gök/dağ bölgesinde 147.
### L4 — piksel kipi `[TEST]` `[ÖLÇÜLDÜ]`
- `ortam.piksel` (1–8) artık level TANIMINDA: panelde "Ortam › piksel boyu", ışık sistemi uygular (iç çözünürlük
  ölçeği + `image-rendering: pixelated`). Eski dosyalarda yoksa 1. `?piksel=N` yalnız açılışta geçersiz kılar.

### Bütçe sonucu (§2 ön kaydı) — başsız Chrome, RTX 4060, tam ova (7 katman, çim dahil)
| # | ölçüt | eşik | ölçülen | |
|---|---|---|---|---|
| B1 | FPS 1920×1080 (vsync kapalı, `ODA_SINIRSIZ=1`) | ≥ 60 | 1560–1930 (3 açı); qwen2.5:7b yüklüyken 1864 | geçti |
| B2 | çizim çağrısı | ≤ 150 | 13–14 | geçti |
| B3 | VRAM artışı (`nvidia-smi` en yüksek − boşta) | ≤ 500 MB | +251–255 MiB (2 tekrar; boş Chrome +55); LLM yüklüyken +253 (5685 → 5938) | geçti |
| B4 | Blender glb | ≤ 4 MB | 35 KB | geçti |
- Yöntem notu: ilk B3 ölçümü +652 MiB çıktı — üç açı art arda yüklenince sayfalar üst üste bindi. Tek açılık
  tekrarlar tutarlı (+251/+255). Çimsiz +217 → çimin payı ~35 MiB. Kare hızı LLM ÜRETİRKEN ölçülmedi (yalnız yüklü).
- Testler: glb 6, uzakArazi 11 (gerçek varlık bekçisi: adlar, halka 150–470 m, yüzler dışa, bütçe), çim 9,
  piksel 4.

