# Deliberative Simülasyon ve Reasoning Maliyeti

## Kısa sonuç

Mevcut Bob seçimi yaklaşık **24 ns/karar** düzeyinde küçük bir kural tabanlı baseline'dır. Gerçek deliberative davranış eklendiğinde maliyetin artış şekli, reasoning'in türüne bağlıdır:

| Reasoning biçimi | Beklenen maliyet sınıfı | Mevcut Bob'a göre tipik etki |
|---|---:|---:|
| 2–4 adaylı kısa heuristik | 1–10 µs | yaklaşık yüzlerce kat |
| Sığ arama / küçük dünya simülasyonu | 10–200 µs | binlerce kat |
| Beam search veya çoklu rollout | 0,2–10 ms | on binlerce–yüz binlerce kat |
| Yerel LLM reasoning | 10 ms–1 s | milyonlarca kat |
| Uzak API/LLM reasoning | 0,3–5 s+ | on milyonlarca kat ve ağ gecikmesi |

Bu fark, fast path'in neden gerekli olduğunu gösterir: Fast path'in amacı yalnızca Bob kodundan birkaç nanosaniye kazanmak değil, pahalı deliberation çağrılarının bir kısmını tamamen atlamaktır.

## Gerçekleştirilen deterministik benchmark

[`deliberative-benchmark-v03.mjs`](./deliberative-benchmark-v03.mjs) ile basit bir ağaç araması ölçüldü. Her yaprak, aday eylem dizisinin bir sonucu olarak değerlendirildi. Bu ölçüm LLM değildir; yalnızca deliberative simülasyonun dallanma ve derinlikle nasıl büyüdüğünü gösteren CPU baseline'ıdır.

| Derinlik | Dallanma | Yaprak sayısı | Karar başına süre | Mevcut Bob'a göre |
|---:|---:|---:|---:|---:|
| 2 | 4 | 16 | **4,58 µs** | yaklaşık **190.585×** |
| 4 | 4 | 256 | **4,83 µs** | yaklaşık **201.000×** |
| 6 | 4 | 4.096 | **83,28 µs** | yaklaşık **3.463×** |
| 8 | 4 | 65.536 | **1,23 ms** | yaklaşık **51.124×** |
| 4 | 8 | 4.096 | **67,76 µs** | yaklaşık **2.817×** |
| 6 | 8 | 262.144 | **4,24 ms** | yaklaşık **176.467×** |

İlk iki satırda arama ağacının küçük olması nedeniyle JavaScript çağrı ve ölçüm sabit maliyeti baskındır. Derinlik ve dallanma yükseldiğinde maliyet beklenen biçimde yaklaşık olarak:

```text
arama maliyeti ≈ branching ^ depth × node_evaluation_cost
```

şeklinde büyür.

## Mevcut sistemle karşılaştırma

Önceki fast-path benchmarkında ölçülen değerler:

```text
Alice fast path: 16,97 ns
Bob baseline:    24,05 ns
```

Bu değerler yalnızca `Map` lookup, birkaç alan kontrolü ve küçük bir koşul zincirini kapsıyor. Gerçek Bob aşağıdaki adımları eklerse maliyet hızla büyür:

1. Gözlem vektörünü normalleştirme,
2. Olası eylem üretimi,
3. Her eylem için dünya geçişi simülasyonu,
4. Enerji ve risk hesabı,
5. Prediction üretimi,
6. Birden fazla gelecek adımının rollout edilmesi,
7. Adayların utility/information gain ile sıralanması,
8. En iyi yolun seçilmesi ve trace oluşturulması.

Dolayısıyla fast path'in gerçek ölçülmesi gereken kazanımı şudur:

```text
fast_path_cost
vs.
observation + candidate_generation + rollout + scoring + trace
```

Sadece Alice `sec()` ile Bob `sec()` arasındaki fark, bu gerçek uçtan uca farkı temsil etmez.

## Reasoning katmanlarına göre beklenen maliyet

### 1. Kural tabanlı deliberation

Bob birkaç koşuldan daha fazlasını değerlendirir, fakat graph araması yapmazsa maliyet genellikle mikro saniye seviyesinde kalır. Bu katmanda uygun optimizasyonlar:

- Önceden hesaplanmış eylem özellikleri,
- Küçük candidate listeleri,
- Allocation yapmayan veri yapıları,
- Context signature cache,
- Sınırlı horizon.

Bu katman, gerçek world loop için ilk uygulanması gereken reasoning seviyesidir.

### 2. Deterministik rollout / search

Her eylem için geleceğin birkaç adımını simüle etmek branching factor ve horizon ile çarpanlı büyüme yaratır. Örneğin dört eylem ve sekiz adımlık horizon, teorik olarak 65.536 aday yapar. Sekiz eylem ve altı adım ise 262.144 yaprağa ulaşır.

Bu yüzden düz brute-force yerine şu sınırlamalar gerekir:

- Beam width,
- Maksimum node budget,
- Erken budama,
- Dominance pruning,
- Transposition table,
- Dünya durumlarının immutable kopyaları yerine delta/undo modeli,
- Her rollout'ta tam trace yerine özet trace.

### 3. Yerel LLM reasoning

Yerel bir model kullanıldığında maliyet ağacın kendisinden çok token üretim hızına ve context uzunluğuna bağlı olur. Pratik bütçe genellikle:

```text
10 ms – 1 s / karar
```

aralığına çıkar. Model boyutu, quantization, GPU/CPU seçimi, prompt uzunluğu, tool-call sayısı ve output token sayısı sonucu büyük ölçüde değiştirir.

LLM reasoning'in her tick'te çalıştırılması mimarinin maliyet tavanını bozar. Bu nedenle LLM yalnızca:

- novelty yüksekse,
- fast path güveni düşükse,
- prediction error yükselmişse,
- Bob'un belirli bir reasoning bütçesi varsa,
- eylem riski deliberation maliyetini haklı çıkarıyorsa

çağrılmalıdır.

### 4. Uzak model/API reasoning

Uzak modelde model hesaplamasına ek olarak ağ gidiş-dönüşü, kuyruklama, serialization ve olası retry maliyeti bulunur. Bu katmanda tek kararın maliyeti yüzlerce milisaniyeden birkaç saniyeye çıkabilir. Fast path burada yalnızca performans optimizasyonu değil, çoğu rutin kararda **uzak çağrıyı atlama mekanizması** olur.

## Fast path için beklenen tasarruf

Örnek bir karar dağılımı düşünelim:

```text
Alice fast path hit rate: %80
Alice maliyeti:            17 ns
Bob deliberation maliyeti: 1 ms
```

Ortalama karar maliyeti yaklaşık:

```text
0.80 × 17 ns + 0.20 × 1 ms ≈ 200 µs
```

Always-Bob baseline yaklaşık 1 ms iken ortalama maliyet yaklaşık **5× düşer**. Bob maliyeti 10 ms olursa aynı hit rate ile ortalama yaklaşık 2 ms olur ve yine yaklaşık **5×** kazanç korunur. Fast path hit rate yükseldikçe kazanç daha da büyür; ancak güvenlik nedeniyle hit rate'i zorla yükseltmek doğru değildir.

Genel formül:

```text
E[latency] = H × L_alice + (1 - H) × L_bob + L_routing
```

Burada:

- `H`: güvenli fast-path hit rate,
- `L_alice`: fast path maliyeti,
- `L_bob`: deliberative karar maliyeti,
- `L_routing`: novelty/confidence/context gate maliyeti.

Bob pahalılaştıkça `H` küçük olsa bile fast path'in mutlak katkısı büyür.

## Enerji etkisi

CPU latency doğrudan enerji değildir, fakat reasoning'in compute cost'u ve GPU kullanımı enerji bütçesine doğrudan yansır. Bu nedenle her karar için en az şu ledger alanları tutulmalıdır:

```text
path: alice | bob
latency
computeCost
energyCost
predictionError
success
fallback
```

Fast path'in başarı ölçütü yalnızca daha hızlı olmak değil, aynı başarı oranını korurken:

```text
energy_per_success ↓
latency_per_decision ↓
Bob_calls_per_episode ↓
```

üretmesidir.

## Mimari öneri

Gerçek deliberative simülasyon eklenecekse aşamalı bütçe uygulanmalı:

| Faz | Bob bütçesi | Amaç |
|---|---:|---|
| v0.3a | 4–8 aday, 2 horizon | Dünya geçişi ve outcome kanıtı |
| v0.3b | beam width 4, horizon 4 | Prediction ve novelty ölçümü |
| v0.3c | node budget 1.000 | Enerji/latency trade-off'u |
| v0.4 | replay destekli search | Öğrenilmiş path'lerin karşılaştırılması |
| v0.5+ | seçili LLM reasoning | Yalnızca zor ve novel durumlar |

Her fazda Alice/Bob karşılaştırması aynı episode setinde yapılmalı. Aksi halde hızlanma, görev zorluğu değişiminden kaynaklanabilir.

## Sonuç

Gerçek deliberative simülasyon eklendiğinde performans maliyeti birkaç mikro saniyeden milisaniyelere, LLM reasoning'de ise saniyelere çıkabilir. Maliyet özellikle reasoning derinliği ve aday dallanma sayısıyla katlanarak büyür.

Bu nedenle mevcut fast path/reflex fikrinin asıl stratejik değeri şudur:

> Fast path, Bob'u biraz hızlandıran bir kod yolu değil; pahalı reasoning çağrılarının çoğunu güvenli biçimde atlayan doğrulanmış davranış cache'idir.

Bunu kanıtlamak için sonraki deney, yalnızca fonksiyon mikrobenchmarkı değil; aynı görevde `Always Bob` ile `Alice + Bob` sistemlerinin episode latency, enerji, başarı, fallback ve prediction error ölçümlerini karşılaştırmalıdır.
