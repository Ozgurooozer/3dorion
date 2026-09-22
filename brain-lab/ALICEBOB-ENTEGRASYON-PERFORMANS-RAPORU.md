# AliceBob Entegrasyon Performans ve Reflex Durum Raporu

## Kapsam

Bu rapor, `AliceBob` yönlendirme katmanının `DeliberativePlanner` ile entegrasyonunu ve iki uçtan uca davranışı inceler:

1. Dünya durumu yeni veya reflex yokken AliceBob'un Bob planner'a yönlendirmesi.
2. Hatalı Alice reflex'inin çarpışma outcome'u sonrasında askıya alınması ve Bob planner'ın devralması.

Benchmark betiği: [`benchmark-alicebob-integration.mjs`](./benchmark-alicebob-integration.mjs)

## Test doğrulaması

Tam test komutu üç test dosyasını çalıştırdı:

```text
v03.test.ts                 6/6
Deliberative planner         5/5
AliceBob integration         2/2
----------------------------------
Toplam                      13/13 geçti
```

Entegrasyon testlerinden ikisi:

- Bob planner'ın AliceBob üzerinden çağrılması, plan üretmesi ve engelli dünyada hedefe ulaştırması.
- Hatalı Alice fast path'in collision outcome'u sonrasında `askida` durumuna geçmesi ve bir sonraki kararı Bob planner'ın güvenli biçimde devralması.

## Benchmark koşulları

| Parametre | Değer |
|---|---:|
| Tekrar sayısı | 1.000 / senaryo |
| Planner derinliği | 4 |
| Node budget | 512 |
| Gerçek arama ağacı | 341 düğüm |
| Ölçüm öncesi warm-up | 20 çağrı |
| Saat | `performance.now()` |

Derinlik 4 ve dört eylem için teorik tam ağaç 341 düğümdür. Bu testte node budget 512 olduğu için arama budget'a takılmadan tamamlanmaktadır.

## Çalışma süreleri

İlk ölçüm:

| Senaryo | 1.000 çağrı toplamı | Ortalama çağrı |
|---|---:|---:|
| Bob planner + world transition + experience update | 104,03 ms | **104,03 µs** |
| Alice fast path + world transition | 3,45 ms | **3,45 µs** |
| Hatalı Alice + outcome + reflex suspension + Bob fallback | 77,65 ms | **77,65 µs** |

Beş ayrı process çalıştırmasından alınan ortalamalar:

| Senaryo | Ortalama toplam süre / 1.000 çağrı | Ortalama çağrı | Gözlenen aralık |
|---|---:|---:|---:|
| Bob planner döngüsü | **92,69 ms** | **92,69 µs** | 87,77–95,10 ms |
| Alice fast path | **3,51 ms** | **3,51 µs** | 3,22–3,71 ms |
| Hatalı reflex döngüsü | **88,66 ms** | **88,66 µs** | 79,20–104,59 ms |

Bu koşullarda Bob planner, Alice fast path'ten ortalama yaklaşık **26,4× daha pahalıdır**:

```text
92,69 µs / 3,51 µs ≈ 26,4×
```

Hatalı reflex döngüsü, normal Bob döngüsünden biraz daha düşük ölçülmüştür; bunun nedeni failure senaryosunun tek bir planner çağrısı yanında tek bir hatalı Alice seçimi ve state update içermesi, normal Bob senaryosunun ise her tekrarda full planner + world + experience update çalıştırmasıdır. Bu fark semantik bir optimizasyon sonucu değil, senaryo iş yükü farkıdır.

## Bob planner maliyetinin bileşenleri

Bob kararında aşağıdaki işler gerçekleşir:

1. `AliceBob.sec()` fast-path cache'ini kontrol eder.
2. Reflex aktif/eşik koşulları sağlanmadığı için planner'a geçer.
3. Dünya durumunun kopyası alınır.
4. 4 eylem için 4 derinlikli arama yürütülür.
5. Her node'da:
   - dünya durumu kopyalanır,
   - olası eylem uygulanır,
   - hedef mesafesi hesaplanır,
   - enerji maliyeti hesaplanır,
   - çarpışma cezası uygulanır.
6. En iyi ilk eylem döndürülür.
7. Dünya gerçek eylemi uygular.
8. Experience ve skill metriği güncellenir.

Ölçülen 341 node, planner'ın bu durumda arama ağacını tam dolaştığını doğrular.

## Alice fast path maliyeti

Alice senaryosunda:

1. Aynı context signature için `Map` lookup yapılır.
2. `reflex === aktif` kontrol edilir.
3. `confidence >= 0.75` kontrol edilir.
4. `predictionError < 0.4` kontrol edilir.
5. Önceden derlenmiş eylem döndürülür.
6. Dünya eylemi uygular.

Planner çağrılmadığı için arama node'u üretilmez. Ortalama 3,51 µs ölçümü, bu entegrasyon koşulunda Alice'in Bob'a göre yaklaşık 26× daha ucuz olduğunu gösterir.

Bu değer saf fast-path lookup değildir; dünya geçişi de içerir. Önceki saf mikrobenchmarkta ölçülen Alice/Bob farkından daha büyük olmasının nedeni Bob tarafında artık gerçek planner aramasının bulunmasıdır.

## Hatalı Alice reflex durum geçişi

Failure senaryosunda durum geçişleri aşağıdaki sıradadır:

```text
AKTİF
  ↓
Alice seçildi
  ↓
Yanlış eylem: ileri
  ↓
World outcome: collision
  ↓
Prediction error: 1
  ↓
confidence azalır
  ↓
reflex = askida
  ↓
Aynı context'te Alice kapısı reddedilir
  ↓
Bob planner çağrılır
  ↓
Güvenli fallback: sol
```

Benchmark çıktısındaki gözlenen durum:

| Alan | Değer |
|---|---|
| Başlangıç reflex durumu | `aktif` |
| İlk karar kaynağı | `alice` |
| İlk eylem | `ileri` |
| World outcome | `collision` |
| Sonraki reflex durumu | `askida` |
| Fallback karar kaynağı | `bob` |
| Fallback eylem | `sol` |
| Fallback planner node sayısı | 341 |

## Neden reflex silinmiyor?

`BeceriMotoru.deneyimUygula()` başarısız deneyimde iki ayrı etki uyguluyor:

```ts
b.hata++;
b.confidence = clamp(b.confidence - 0.18);
if (d.predictionError > 0.5) b.reflex = "askida";
```

Bu tasarımda:

- skill nesnesi korunur,
- level doğrudan sıfırlanmaz,
- derlenmiş davranışın güveni geri çekilir,
- Alice hızlı yolunu kullanamaz,
- Bob yeniden değerlendirme yapar.

Bu, `Failure ≠ punishment` ilkesinin çalışan karşılığıdır. Hatalı reflex bir anda yok edilmez; önce güvenli şekilde uykuya alınır.

## Alice kapısının güvenlik koşulları

`AliceBob.sec()` yalnızca şu koşulların tümü doğruysa Alice döndürür:

```text
context Map'te bulunuyor
AND reflex = aktif
AND confidence >= 0.75
AND predictionError < 0.4
```

Reflex `askida` olduğunda diğer alanlar yüksek kalsa bile Alice seçilemez. Böylece tek bir failure sonrasında aynı hatalı yolun tekrar edilmesi engellenir.

## Güçlü bulgular

- Planner entegrasyonu gerçek dünya durumu verilince gerçekten devreye giriyor.
- Bob kararı 341 arama düğümünü izleyebiliyor.
- Bob planner engelli dünyada hedefe ulaşan plan üretiyor.
- Alice fast path planner çağrısını atlıyor.
- Hatalı Alice davranışı collision ile gözlemlenebilir biçimde yakalanıyor.
- Reflex durumu `aktif → askida` geçişiyle otomatik geri çekiliyor.
- Askıya alma sonrasında Bob güvenli fallback sağlıyor.
- 13 testin tamamı geçti.

## Sınırlamalar

Bu ölçüm gerçek LLM reasoning maliyetini içermez. Bob planner deterministik, yerel ve CPU tabanlı bir arama katmanıdır. Ayrıca tek bir küçük dünya, tek engel, dört eylem ve dört derinlik kullanılmıştır.

Gerçek üretim performansı için sonraki ölçümlerde ayrıca şu metrikler tutulmalıdır:

- planner node başına süre,
- world transition başına süre,
- experience update süresi,
- Alice hit rate,
- Bob fallback rate,
- collision rate,
- reflex suspension rate,
- recovery/reactivation latency,
- episode başına toplam enerji ve latency.

## Sonuç

AliceBob entegrasyonu beklenen davranışı ve maliyet profilini gösteriyor:

```text
Alice fast path:  ~3,51 µs/karar
Bob planner:      ~92,69 µs/karar
Hız farkı:         ~26,4×
```

Buna karşılık reflex güvenlik mekanizması pahalı planner'ı yalnızca gerektiğinde çağırıyor. Yanlış Alice reflex'i:

```text
aktif → collision → prediction error → askida → Bob fallback
```

şeklinde güvenli ve izlenebilir bir geçiş yapıyor. Bu, hızlı davranışı korurken hatalı otomatikleşmenin kalıcı hale gelmesini engelleyen doğru ilk mimari davranıştır.
