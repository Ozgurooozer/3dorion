# Fast Path ve Reflex Derleme Performans Analizi

**Kapsam:** Brain IR v0.3 ilk milestone

**Ölçüm tarihi:** 21 Eylül 2026

**Kod:** [`v03.ts`](./brain-ir/v03.ts)

## Sonuç özeti

Mevcut mekanizma işlevsel olarak doğru bir ilk fast-path/reflex prototipidir: güvenilirlik koşulları sağlanmadan yol derlenmiyor; bağlama uyan yol `Alice` tarafından seçiliyor; reflex askıya alındığında seçim tekrar `Bob`a düşüyor. Ancak mevcut uygulama henüz gerçek anlamda derlenmiş bir yürütme fonksiyonu değildir. `derle()` yalnızca eylemi ve bağlamı `Map<string, HizliYol>` içine kaydeder; `sec()` ise her çağrıda aynı `Map` araması ve güvenlik koşullarını tekrar çalıştırır.

Beş tekrarlı benchmarkın ortalamasında:

| İşlem | Ortalama süre / 1.000.000 çağrı | Çağrı başına ortalama |
|---|---:|---:|
| Alice fast-path seçimi | **16,97 ms** | **16,97 ns** |
| Bob deliberative seçimi | **24,05 ms** | **24,05 ns** |
| Reflex/fast-path derleme | **63,01 ms** | **63,01 ns** |
| Alice/Bob seçim hızlanması | — | **1,42×** |

Bu sonuç, saf seçim fonksiyonu seviyesinde fast path lehine yaklaşık **%29,4 daha düşük süre** anlamına gelir. Bununla birlikte bu karşılaştırma yalnızca mevcut küçük kural tabanlı Bob politikasını ölçmektedir; LLM, arama, planlama, dünya simülasyonu veya bellek erişimi dahil değildir.

## Ölçüm yöntemi

Benchmark [`benchmark-v03.mjs`](./benchmark-v03.mjs) ile gerçekleştirildi. Her işlem için 10.000 warm-up çağrısından sonra 1.000.000 çağrı ölçüldü. Fast path ve Bob karşılaştırmasında aynı `Gozlem` ve aynı `Beceri` nesnesi kullanıldı; ilk ölçümdeki nesne kopyalama farkı giderildi.

Beş çalışmadaki hızlanma değerleri şöyledir:

| Çalışma | Alice | Bob | Hızlanma |
|---:|---:|---:|---:|
| 1 | 15,75 ms | 22,58 ms | 1,43× |
| 2 | 17,15 ms | 21,72 ms | 1,27× |
| 3 | 16,04 ms | 24,21 ms | 1,51× |
| 4 | 17,28 ms | 24,12 ms | 1,40× |
| 5 | 18,65 ms | 27,63 ms | 1,48× |

Çalışmalar arası değişkenlik nedeniyle tek bir koşunun sonucundan ziyade ortalama değer esas alınmalıdır. Ortalama hızlanma **1,42×** olsa da ölçüm aralığı **1,27–1,51×** olmuştur.

## Derleme maliyeti

`derle()` ortalama yaklaşık **63 ns** sürmektedir. Bu düşük görünse de ölçülen kodun yaptığı işlem sınırlıdır:

1. Seviye ve reflex durumunu kontrol eder.
2. Yeni bir `HizliYol` nesnesi oluşturur.
3. Sürüm sayacını artırır.
4. `Map` içine yazar.
5. Kopyalanmış yolu döndürür.

Dolayısıyla bu değer, gerçek bir trace analizi, yol sadeleştirme, doğrulama, kod üretimi veya çoklu koşul optimizasyonunun maliyetini temsil etmez. Daha doğru yorum, mevcut prototipte **cache kaydı oluşturma maliyeti** ölçülmüş olduğudur.

Ayrıca aynı bağlam tekrar tekrar derlendiğinde mevcut kod eski yolu günceller ve her seferinde sürüm artırır. Bu davranış işlevsel olarak kabul edilebilir, fakat ileride gereksiz derleme ve sürüm churn'ü oluşturabilir.

## Reflex seçiminin mevcut davranışı

Alice seçimi şu koşulların tamamını gerektiriyor:

```text
Map'te bağlam bulundu
AND reflex = aktif
AND confidence >= 0.75
AND predictionError < 0.4
```

Bu güvenlik kapısı önemli bir güçlü yön. Reflex yalnızca level 5'e ulaşmakla aktifleşmiyor; confidence, success rate ve prediction error da kontrol ediliyor. Hata durumunda reflex silinmiyor, `askida` durumuna geçiyor ve aynı seçim fonksiyonu Bob'a geri dönüyor.

Bu nedenle mevcut sistemde ölçülen şey yalnızca hız değil, aynı zamanda **hızlı yolun geri çekilebilir olmasıdır**. Bu, kalıcı ve hatalı otomatik davranıştan daha güvenli bir tasarımdır.

## Kritik sınırlama: Bob henüz pahalı değil

Mevcut Bob politikası şu birkaç koşuldan oluşuyor:

```text
engel varsa sol
özel başlangıç koşulundaysa ileri
yön hedefle uyuşmuyorsa sağ
aksi halde ileri
```

Bu nedenle Alice'in 1,42× avantajı gerçek bir deliberative sistem avantajı olarak yorumlanmamalıdır. Gerçekçi bir Bob maliyeti aşağıdakileri içermelidir:

- Birden fazla aday eylemin değerlendirilmesi,
- dünya geçişlerinin simülasyonu,
- prediction error ve novelty hesabı,
- episodic/procedural memory erişimi,
- hedef ve enerji bütçesi planlaması,
- gerekirse dış model veya AI Observer çağrısı.

Bu maliyetler eklendiğinde fast path'in beklenen değeri nanosaniseviyesinde değil, **tam karar döngüsünün latency ve enerji bütçesinde** ölçülmelidir.

## Performans değerlendirmesi

### Kanıtlananlar

- Fast path seçimi, aynı girdide Bob kuralından ortalama olarak daha hızlıdır.
- `Map` tabanlı bağlam lookup düşük sabit maliyetlidir.
- Reflex aktif değilse Bob fallback çalışmaktadır.
- Derleme koşulları sağlanmadığında yol oluşturulmamaktadır.
- Mevcut prototipte reflex invalidation, seçim hızının önüne geçen bir güvenlik kapısı olarak çalışmaktadır.

### Henüz kanıtlanmayanlar

- Fast path'in gerçek dünya karar latency'sini anlamlı ölçüde azalttığı,
- Fast path'in enerji maliyetini azalttığı,
- Bob'un gerçek reasoning maliyetine karşı daha büyük hızlanma sağlandığı,
- Reflex cache'in yeni bağlamlara genelleme yaptığı,
- Derlenmiş yolun yanlış eylem üretmesi durumunda güvenli ve hızlı invalidation sağladığı,
- Çok sayıda skill/context altında `Map` yaklaşımının ölçeklenebilir olduğu.

## Kod düzeyinde gözlemler

### 1. Fast path henüz çağrılabilir bir fonksiyon değil

`HizliYol` yalnızca `eylem` bilgisini tutuyor. Gerçek fast-path temsilinde en azından şu alanlar bulunmalı:

```text
inputPattern
contextConstraints
requiredState
action
expectedOutcome
energyCost
confidence
version
```

Bu alanlar olmadan yol, bağlamın yalnızca tam string eşleşmesine dayanan bir action cache olarak kalıyor.

### 2. Tam string bağlam eşleşmesi kırılgan

`baglam` şu anda konum, yön ve engel bilgisinin string birleştirilmiş halidir. Bu yaklaşım deterministik ve hızlıdır; ancak küçük bir bağlam farkında bile cache miss üretir. Bir sonraki aşamada normalize edilmiş bir context signature veya toleranslı eşleşme kullanılmalıdır.

### 3. Derleme idempotent değil

Aynı skill ve bağlam için aynı eylem tekrar derlendiğinde yeni sürüm yaratılıyor. İçerik aynıysa mevcut yolu korumak ve yeni sürüm üretmemek gereksiz churn'ü azaltır.

### 4. Reflex invalidation henüz prediction error ile otomatik bağlanmamış

`AliceBob.sec()` prediction error eşiğini kontrol ediyor; ancak yüksek hata durumunda yolu `Map`ten silmiyor veya kendi durumunu değiştirmiyor. Şu anda askıya alma `BeceriMotoru`ndaki `reflex = "askida"` alanına dayanıyor. İleride yolun durumunu da açıkça `active/suspended/invalidated` olarak taşımak izlenebilirliği artırır.

## Önerilen sonraki benchmarklar

1. **Gerçek deliberative baseline:** Bob'a 8–32 aday eylem ve kısa dünya simülasyonu eklenmeli; Alice/Bob farkı tam episode latency'si olarak ölçülmeli.
2. **End-to-end episode benchmarkı:** Sadece `sec()` değil, gözlem, karar, dünya geçişi, outcome, experience ve skill güncellemesi birlikte ölçülmeli.
3. **Cold vs warm path:** İlk lookup, warm cache lookup ve cache miss ayrı raporlanmalı.
4. **Context ölçekleme:** 1, 100, 1.000 ve 100.000 fast path ile lookup maliyeti ölçülmeli.
5. **Invalidation benchmarkı:** Hatalı reflex sonrası Bob fallback süresi ve yeniden derleme süresi ölçülmeli.
6. **Enerji benchmarkı:** Her Alice ve Bob eylemine compute/latency/energy maliyeti atanıp episode başına toplam maliyet karşılaştırılmalı.
7. **Genelleme testi:** Tam string eşleşmesi yerine benzer bağlamlarda reflex'in ne sıklıkta yanlış tetiklendiği ölçülmeli.

## Son karar

Mevcut sonuç **ilk prototip için olumlu**, fakat “reflex öğrenildi ve latency ciddi biçimde azaldı” iddiasını tek başına desteklemiyor. Desteklenen daha dar ve doğru iddia şudur:

> v0.3 fast path prototipi, doğrulanmış bir bağlam–eylem eşleşmesini düşük sabit maliyetli bir `Map` lookup ile seçebiliyor ve reflex askıya alındığında Bob'a güvenli fallback yapabiliyor. Küçük kural tabanlı baseline'a karşı seçim maliyeti ortalama 1,42× daha düşük ölçüldü.

Bir sonraki performans hedefi, Bob'u gerçek deliberative maliyetle temsil etmek ve kazanımı tek fonksiyon yerine **episode latency + enerji + başarı oranı** üçlüsüyle ölçmektir.
