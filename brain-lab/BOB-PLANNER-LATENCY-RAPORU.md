# Bob Planner Latency Raporu

## Uygulanan plan sırası

Bu ölçüm yeni plan sırasının ilk iki kapısını doğrular:

```text
Tam döngü kabul testi
  ↓
Bob planner latency ölçümü
  ↓
Planner optimizasyonu için baseline
  ↓
Reflex state machine / recovery
```

## Tam döngü kabul testi

Çalıştırılan testler:

```text
v03 temel döngüsü:           6/6 geçti
Deliberative planner:        5/5 geçti
AliceBob entegrasyonu:       2/2 geçti
----------------------------------
Toplam:                     13/13 geçti
```

Tam test komutunun process dahil toplam süresi yaklaşık **5,12 saniye** oldu. Bu değer Node başlangıcı, TypeScript type stripping ve üç test dosyasının yüklenmesini de içerir; tek bir episode latency'si olarak yorumlanmamalıdır.

Doğrulanan davranışlar:

- Bob planner AliceBob yönlendirmesi üzerinden çağrılıyor.
- Bob plan üretiyor ve engelli dünyada hedefe ulaşıyor.
- Hatalı Alice reflex'i collision sonrasında `aktif → askida` geçiyor.
- Askıya alma sonrasında Alice kapısı reddediliyor ve Bob devralıyor.
- Deterministik arama aynı dünya durumunda aynı eylemi seçiyor.

## Benchmark koşulları

| Parametre | Değer |
|---|---:|
| Her konfigürasyonda tekrar | 1.000 |
| Warm-up | 20 çağrı |
| Derinlikler | 2, 4, 6 |
| Eylem dallanması | 4 |
| Ölçüm | `performance.now()` |
| Ölçülen fazlar | karar, world transition, öğrenme update, toplam |

Toplam süre şu fazların toplamıdır:

```text
Bob decision
+ world transition
+ experience / skill update
```

## Latency sonuçları

| Derinlik | Node budget | Ortalama node | Karar | World | Öğrenme | Toplam |
|---:|---:|---:|---:|---:|---:|---:|
| 2 | 64 | 21 | 19,66 µs | 1,45 µs | 1,66 µs | **22,77 µs** |
| 4 | 512 | 341 | 71,85 µs | 0,84 µs | 1,31 µs | **74,00 µs** |
| 6 | 4.096 | 4.096 | 839,47 µs | 2,22 µs | 3,21 µs | **844,90 µs** |

Derinlik 4 konfigürasyonunda teorik ağaç tamamen taranıyor:

```text
1 + 4 + 16 + 64 + 256 = 341 node
```

Derinlik 6 için teorik tam ağaç 5.461 node olurdu, fakat node budget 4.096 olduğu için arama kontrollü biçimde kesiliyor. Bu nedenle derinlik 6 sonucu tam ağaç maliyeti değil, **budget-capped deliberation** maliyetidir.

## Maliyet dağılımı

Derinlik 4 / 341 node koşulunda toplam yaklaşık 74,00 µs maliyetin dağılımı:

| Faz | Süre | Toplamdaki pay |
|---|---:|---:|
| Planner kararı | 71,85 µs | yaklaşık %97,1 |
| World transition | 0,84 µs | yaklaşık %1,1 |
| Experience/skill update | 1,31 µs | yaklaşık %1,8 |

Sonuç açıktır: Bu aşamada ana darboğaz world veya skill update değil, planner aramasıdır.

## Derinliğe göre büyüme

Derinlik 2’den 4’e geçişte:

```text
21 node → 341 node
19,66 µs karar → 71,85 µs karar
```

Derinlik 4’ten budget-capped derinlik 6’ya geçişte:

```text
341 node → 4.096 node
71,85 µs karar → 839,47 µs karar
```

Bu, planner maliyetinin arama ağacı büyüdükçe hızla yükseldiğini doğrular. Derinlik 6’daki yaklaşık **11,7×** karar maliyeti artışı, node sayısındaki yaklaşık **12×** artışla uyumludur.

## Alice ile bağlam

Önceki entegrasyon benchmarkında Alice fast path yaklaşık **3,51 µs/karar**, derinlik 4 Bob planner ise yaklaşık **92,69 µs/karar** ölçülmüştü. Yeni faz benchmarkında yalnızca Bob karar + world + öğrenme bileşimi ölçülerek daha ayrıştırılmış bir baseline elde edildi:

```text
Bob planner decision: 71,85 µs
Tam Bob döngüsü:      74,00 µs
```

Bu iki sonuç çelişmez; farklı benchmark kapsamları ve process/JIT koşulları vardır. Ortak bulgu şudur:

> Derinlik 4 deliberative planner, mevcut Alice fast path'ten yaklaşık bir büyüklük mertebesi daha pahalıdır; planner kararının kendisi toplam maliyetin baskın bölümüdür.

## Optimizasyon önceliği

Bu ölçümden sonra optimizasyon sırası şöyle olmalıdır:

### 1. Planner aramasını azaltma

- Beam search
- Branch-and-bound
- Erken hedef/çarpışma budaması
- Node budget'i enerji/risk ile dinamik ayarlama

### 2. Node başına allocation azaltma

- Immutable engel haritası paylaşımı
- Search state için yalnızca `x/y/yon/enerji/zaman` taşıma
- `[...]` plan kopyaları yerine parent-pointer
- Transposition table

### 3. Cache ve yeniden kullanım

- Context signature cache
- World version cache
- Önceki plan suffix reuse
- Aynı skill/planner sürümünde tekrar hesaplamayı engelleme

### 4. Öğrenme update'ini hot path'ten ayırma

Derinlik 4 koşulunda experience/skill update yalnızca 1,31 µs civarında olduğundan şu anda ana darboğaz değil. Ancak episodic memory, replay, OLY ve ledger eklendiğinde bu faz büyüyebilir. Bu nedenle:

```text
Hot path: outcome + reflex safety gate
Cold path: replay + mastery + memory consolidation + ledger
```

ayrımı erken korunmalıdır.

## Kabul kararı

Yeni plan sıralamasının ilk kapısı geçildi:

1. **Tam döngü testleri:** 13/13 başarılı.
2. **Bob latency baseline:** üç arama bütçesinde ölçüldü.
3. **Darboğaz:** planner karar araması olarak belirlendi.
4. **Güvenlik:** hatalı Alice reflex'i askıya alınıp Bob'a fallback yaptı.

Mevcut kabul baseline'ı:

```text
Derinlik 4 / 341 node:
Bob karar:  ~71,85 µs
Tam döngü:  ~74,00 µs
```

Bir sonraki teknik iş, davranışı değiştirmeden planner optimizasyonu uygulamak ve aynı 13 testin yanında bu baseline'ın iyileşip iyileşmediğini ölçmektir.
