# 11 — Odanın görünüşü: Blender'da eşya, kodda işlev (2026-10-01)

**Durum:** Ozyn onayladı (2026-10-01, sohbet). Faz 0, 1 ve 2 bitti. Faz 1'in Blender önizlemesini Ozyn onayladı.
Faz 3 (yağmurlu yeni manzara ve camdaki yağmur izleri) ve Faz 4'ün canlı senaryoları bekliyor.

## İstek

Ozyn bir referans görsel verdi: kara film havasında bir siberpunk ofis. İçinde şunlar var:
- oymalı koyu ahşap masa, üstünde yeşil banker lambası, kitaplar, kâğıtlar;
- kırmızı deri berjer, ahşap banker sandalyesi, şapkalı portmanto;
- desenli kenarlı halı;
- masanın arkasında eğik, yağmurlu neon şehir camı, tavanda ışıklık;
- mor/pembe neon ve camgöbeği vurgular, karanlık iç mekân.

"Blender'a bağlan, ofisi böyle düzelt."

## Kararlar (Ozyn, 2026-10-01)

| soru | karar |
|---|---|
| Blender'a bağlanma | **Betik**: `blender --background --python assets/kaynak/oda-esyalar.py`. Her şey repoda ve tekrar üretilebilir; MCP kurulmaz. |
| Kapsam | **Referansa yakın**: arka duvar boyunca eğik panoramik cam ve tavan ışıklığı. Tahta, zihin duvarı ve kapı yerinde kalır, yalnız çerçeveleri yenilenir. |
| Eski oda | **Anahtarla kalır.** Yeni oda varsayılan olur. `?oda=klasik` eski kutu odayı açar; glb yüklenemezse de eski oda devreye girer. |

## Mimari

- **İşlev kodda kalır.** Monitör, yönetim ekranı, tahta, şema ve günlük yüzeyleri ile pencere manzarası `oda.ts`'de
  düzlem olarak kurulur, çünkü içerikleri canlı çizilir. Ölçülerin tek kaynağı `olculer.ts`; çapalar, çarpışma
  (`ENGELLER`) ve bakış ışınları (`KATI_YUZEYLER`) değişmeden oradan türer.
- **Görünüş Blender'da.** Kabuk kaplamaları, cam çerçevesi, ışıklık ve bütün eşyalar `assets/oda-esyalar.glb`
  dosyasından gelir.
  - Blender betiği boyutları `olculer.ts`'den üretilen JSON'dan okur (`tools/oda-olcu-json.ts`). Masanın Blender'daki
    boyu koddakiyle ayrışmaz.
  - Model, Babylon dünya koordinatlarında yerinde kurulur. Blender (x, y, z) = Babylon (−X, −Z, Y). glTF yükleyicisinin
    sağ-el → sol-el dönüşümü bunu geri çevirir.
- **Işık ve atmosfer kodda** (`oda.ts`): koyu mor ortam ışığı, pencereden pembe/mor yön ışığı, lamba başına nokta ışık,
  neon için parlama katmanı ve hafif sis. Gölge yok (K2).

## Bütçe (ölçülür, tahmin edilmez)

| ölçü | önce (Faz 0, deneme sayfası) | sonra (Faz 2, aynı açılar) [ÖLÇÜLDÜ] | sınır |
|---|---|---|---|
| FPS | ~100 | ~100 (99,0–100,2) | ≥ 60 |
| çizim çağrısı | 31–53 | 36–45 | ≤ 150 |
| mesh | 60 | 38 (aynı malzemeli parçalar birleşik) | — |
| üçgen | — | 14 270 | ~50k |
| glb | — | 2,49 MB (halı 1K, zemin 1K, gök 512) | ≤ 4 MB |

Sayfanın FPS'i ekran tazeleme hızıyla sınırlı (~100), yani bu sayı bir taban, tavan değil. VRAM farkı henüz ölçülmedi.

## Faz 2'de testlerin yakaladıkları

- **Kutu yığını Orion'un yolunu kesiyordu.** İlk konum günlük panelinin durağını (3,59, −1,35) kapattı; `capalar.test`
  "durak yürünebilir" testi yakaladı ve yığın masanın sol önüne taşındı.
- **Malzeme birleşmesi masa kutusunu uzatıyordu.** Sandalye minderi masanın derisiyle aynı malzemedeydi, birleştirme
  ikisini tek düğüm yaptı. `odaEsyalari.test` masa konum testi yakaladı; minder ayrı malzeme aldı.
- **Manzara ve posterler baş aşağıydı.** Eski kutu odada da öyleydi; `doku()` `invertY=false` kullanıyordu. Görüntü
  karşılaştırmasında yakalandı ve iki kipte de düzeltildi.

**Bozma denemesi:** 4 bozmanın 4'ü yakalandı.
- Berjer engelden çıkarıldı.
- Kip hep "yeni" döndü.
- Yığın eski yerine kondu.
- Blender'da x ekseni aynalandı. Bunu yalnız berjer konum testi yakaladı, çünkü masa x = 0'da simetrik.

**Belirleyicilik:** aynı ölçülerden iki üretim bayt bayt aynı glb'yi verdi.

## Yeniden üretme

```
node --experimental-strip-types tools/oda-olcu-json.ts > <tmp>/olculer.json
"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --factory-startup \
  --python assets/kaynak/oda-esyalar.py -- --olculer <tmp>/olculer.json --glb assets/oda-esyalar.glb \
  [--onizleme <tmp>/onizleme.png --manzara assets/window-city.png]
```

Masa ya da berjer ölçüsü değişip glb yeniden üretilmezse `odaEsyalari.test` kırmızı olur. Diğer ölçüler için böyle bir
bekçi yok: tahta, zihin paneli ve lamba konumları değişince glb'yi elle yeniden üretmek gerekir. Bu bilinen bir açık.

VRAM 8 GB kartta zaten dolu: yerel model ornith-32k tek başına 7,1 GB kaplıyor. Yeni oda VRAM'i az kullanmalı.

## Ölçüm araçları

- `world/level/oda-deneme.html`: beyinsiz deneme sayfası. Odayı sabit açılardan gösterir (`?aci=referans|giris|masa|tahta`)
  ve FPS, çizim ve mesh sayısını basar.
- `tools/oda-goruntu.mjs <klasör>`: başsız Chrome ile her açıdan PNG alır. Tam uygulamayı açmaz, karar kaydına satır
  yazmaz.

## Fazlar

0. "Önce" görüntüleri ve ölçümleri — **bitti**.
1. Blender betiği ve referans açısından önizleme render'ı → Ozyn'e gösterilir.
2. Oyuna bağlama (`world/level/odaEsyalari.ts`), anahtar ve yedek oda.
3. Işık, atmosfer ve yeni neon şehir manzarası.
4. Doğrulama: `tsc`, `npm test`; aynı açılardan "sonra" görüntüleri; FPS ve VRAM; canlı `tahtadene` ve `gorudene`.
