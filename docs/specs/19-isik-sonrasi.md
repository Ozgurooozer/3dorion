# Spec 19 — Işık sonrası işleme, küresel aydınlatma, sağlam gölge

> Durum: **bitti** (2026-10-09). FPS hedefi her önayarda geçti; VRAM ön kaydı cel/toon/anime90'da AŞILDI (§4) —
> Ozyn'in kararı bekleniyor. Kendi shader'ımız bunun üstüne kurulacak (sonraki hedef).

## 0. Neden
Ozyn: "ışık sistemi kötü… standart bir şey aramıyorum; ışık için post-processing eksik, shader'lara göre
ayarlanabilsin", sonra "Lumen tarzı daha güçlü bir şey var mı; sağlam bir gölge işi lazım, zayıf değil."

## 1. Gözden geçirme bulguları (Babylon 9.26 kaynağı)
- Standard malzeme ışığı GAMMA uzayında çarpar, sonra doğrusala çevirip ton eşler; ACES 1,0'ı ~0,8'e indirir →
  tam güneşteki yüz palet rengine ulaşmaz. Ton eşleme türü artık seçilebilir (0 yok · 1 standart · 2 ACES · 3 nötr).
- Güneş ve gök dolgusu `diffuseBase`'te toplanır (stil eklentisi güneşi tahminle ayırır) — kalıcı çözüm kendi shader'ımızda.
- **Lumen karşılığı yok.** En yakını `GIRSMManager`: yansıtıcı gölge haritasından güneşin TEK sekmesi (yansıma yok).
  IBL gölgeleri (voksel) HDR ortam dokusu ister ve 640 m ovada kaba kalır → alınmadı. SSR var, su/cam yok → alınmadı.
- Gölge (CSM) güçlendirildi: `autoCalcDepthBounds` (kademeler görünen derinliğe), `depthClamp`, kademe karışımı,
  isteğe bağlı PCSS (temasta sert, uzakta yumuşak).

## 2. Yapı
- `stil.son` (stil/stilTanimi.ts): tonlama, bloom, huzme, parıltı, AO, eğri, vinyet, gren, sapma, keskinlik,
  alan derinliği, **gi**. Eksik gruplar kapalıyla tamamlanır (eski dosyalar açılır). Önayarlar değer taşır.
- `stil/isikSonrasi.ts`: sıra GI → AO → huzme → boru hattı (DefaultRenderingPipeline) → [çizgi → renk/palet].
  Yeniden kurma imzası (`sonImzasi`): boru hattını yeniden kuran ayarlar (aç/kapa, bloom ölçeği) — sıra bozulmasın.
  B basılıyken hepsi kapalı (`etkinSon`), piksel kipinde bloom/DOF kapalı.
- Gölge alanları (levelTanimi `GolgeAyari`): `otomatikSinir`, `kip` (0 PCF · 1 PCSS), `karisim` — isteğe bağlı.
- Deneme sayfası: üst çubukta "ışık (B)" çipleri; `?kapat=gi,ao` (maliyet ölçümü).

## 3. Canlıda yakalanan hatalar (her biri teşhisle)
1. **GI sessizce sıfırdı (3 ayrı neden):** (a) SSAO2'nin "prepass" yolu geometri tamponunu kapatıyordu → AO aynı
   tamponu paylaşmaya zorlandı (`forceGeometryBuffer`); (b) RSM listesi elle dolduruluyordu → `addMesh` (malzemeye
   akı eklentisini takar); (c) RSM malzemeyi KOPYALIYOR, kopya eklentilerimizi sınıf adından kuramıyordu
   ("IsikStiliEklentisi not found") → iki eklenti `RegisterClass` ile kaydedildi, kurucular tek argümanla çalışır.
   Teşhis: sayfa içinden RSM dokuları okundu (önce akı/konum boş, sonra dolu); "yalnız GI" görünümü.
2. **Şehir nesneleri çizimi 20 → 156'ya çıkardı:** glTF malzeme başına parça → yüklemede köşe rengiyle tek mesh'e
   birleştirme (ışıyanlar ayrı) → 87. (Spec 22 düzeltmesi: yerleşimler o zaman ÖRNEKLENMİYORDU —
   `instantiateModelsToScene` varsayılanı kopya; örneklemeyle aynı varlığın yerleşimleri tek çizim, 192 nesnede
   1106 → 106 çizim/kare.)
3. **VRAM:** boru hattının 4× MSAA HDR hedefleri (toon +1724 MiB) → FXAA (+594); AO tam çözünürlük bulanıklaştırma →
   yarım; GI dokusu çeyrek çözünürlük.

## 4. Sonuçlar `[ÖLÇÜLDÜ]` (1080p, vsync kapalı, tepe açısı, ova'da Ozyn'in 8 nesnesiyle; taban her koşu öncesi)
| önayar | FPS (≥ 60) | çizim (≤ 150) | VRAM artışı (≤ 500 MiB) |
|---|---|---|---|
| standart | 1161 | 94 | +344 |
| cel (GI + AO) | 207 | 138 | **+538 — aştı** |
| toon (GI, bloom, huzme, parıltı, çizgi) | 198 | **158 — aştı** | **+594 — aştı** |
| anime90 (GI, bloom, çizgi, renk) | 230 | 138 | **+637 — aştı** |
| moebius | 399 | 113 | +481 |
| piksel | 1440 | 113 | +218 |
- Efekt payları (cel üstünde ayrıştırıldı): GI ≈ +62 MiB, AO ≈ +132 MiB (yarım çözünürlüğe inmeden önce).
- GI kanıtı: "yalnız GI" görüntüsünde bina dipleri ve gölgeli yüzler seken yeşille aydınlık; güç 10 + yarıçap 0,05
  → ortalama 9,6/255 (güç 1–3 ≈ görünmez, varsayılan buna göre seçildi).
- Gölge kanıtı: eski ayar (512, 400 m, otomatik sınır yok) kenarları bulanık; yeni (2048, 250 m, otomatik sınır)
  keskin, lamba direğinin ince gölgesi seçiliyor. `ova.level.json` gölge alanları yeniye çekildi.
- Aşım seçenekleri (Ozyn): GI'yi önayarlardan çıkarıp çip olarak bırakmak; huzme/parıltıyı toon'dan almak; nesnelerin
  küçüklerini gölge atmaz yapmak (çizim); ya da bütçeyi yeniden kaydetmek (LLM yüklüyken toplam ≈ 6,3 GB < 8 GB).
