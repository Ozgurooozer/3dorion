# Orion / Brain IR — Kompakt Çalışma Bağlamı

**Repo:** `Ozgurooozer/3dorion`  
**Aktif branch:** `brain-ir-v02-event-memory`  
**Son commit:** `ec17525` — Brain IR v0.2

## 1. Projenin amacı

Orion, Babylon.js ve Electron üzerinde yaşayan bir yapay varlık prototipidir. Brain IR, Orion’un mevcut üretim akışını değiştirmeden eklenen bağımsız hesaplamalı beyin katmanıdır.

Temel hedef yalnızca bir grafik simülatörü yapmak değildir. Hedef; beyin mimarilerini tasarlamak, çevre içinde denemek, davranışlarını ölçmek, trace kayıtlarından anlamlandırmak ve sonunda başarılı mimarileri aramak/öğrenmektir.

> **Brain IR = biyolojik bağlantı fikirlerini hesaplanabilir dinamiklere çeviren ara katman.**

## 2. Mevcut v0.2 durumu

`brain-ir/` klasörü mevcut `bridge/`, `mind/` ve `world/` kodlarına dokunmadan çalışır.

Desteklenen düğüm türleri:

```text
input, sensor, neuron, memory, inhibitor,
decision, action, motor, ai
```

`memory` düğümü önceki state’i `decay` katsayısıyla taşır:

```text
state(t+1) = decay × state(t) + input
```

`inhibitor` düğümü negatif katkı üretir. Negatif bağlantı ağırlıkları da inhibition olarak trace’e yazılır. `decision`, `action` ve `motor` düğümleri eşiklenmiş çıktı üretir. `linear` aktivasyon recurrent ve negatif state deneyleri için, varsayılan `relu` normal düğümler için kullanılır.

## 3. Kanıtlanmış davranışlar

- Memory persistence: `τ = 0.92`
- Pozitif excitation ve negatif inhibition ayrımı
- Doğrudan `inhibitor` düğümü
- Stable recurrent loop: `weight = 1`
- Decaying loop: `weight = 0.5`
- Oscillating loop: `weight = -1`
- Unstable loop: `weight = 1.2`
- Immutable `BrainTrace`
- Causal node zinciri
- `OLY-...` olay numaralarının trace boyunca taşınması
- Deterministic replay
- Orion `Beyin` adapterı
- Mevcut niyet doğrulamasından geçen `dunya_*` çıktıları
- Olay günlüğü ve hafıza indeksinin yeniden kurulması

Son doğrulama:

```text
Brain IR testleri: 22/22 geçti
Tüm proje testleri: 695/695 geçti
TypeScript typecheck: geçti
Production build: geçti
```

200 düğüm, 199 bağlantı ve 500 tik ölçümü gelen bağlantı indekslemesi sonrasında yaklaşık **1436 ms** sürüyor. Ana maliyet trace ve causal metadata üretimi. Sonraki optimizasyonlar seçilebilir trace, yalnız değişen düğümlerin trace edilmesi ve daha seyrek metadata saklamadır.

## 4. Olay günlüğü ve hafıza

Olaylar `OLY-00000001` biçiminde kararlı numara alır. Brain IR düşünme çağrısı ve aksiyonları olay olarak kaydeder. `OlayHafizasi`, olayları mevcut Orion hafıza skorlamasına besler.

```text
OLY event
   ↓
Hafiza indeksi
   ↓
ilgili olay seçimi
   ↓
OLY numarasıyla tam olay çağırma
```

Bu ayrım iki soruyu ayırır:

- **Ne oldu?** Olay günlüğü.
- **Neden oldu?** Brain IR trace’i.

Bir input olay numarası taşıyabilir:

```ts
{ deger: 1, olaylar: ["OLY-00000037"] }
```

Bu numara `vision → motion → threat → escape` gibi node zincirinde taşınır ve action trace’inde görünür.

## 5. Mimari yön değişikliği

İlk model:

```text
node → edge → state → action
```

Daha doğru model:

```text
structure + dynamics + memory → behavior
```

Ve gerçek zeki davranış için kapalı çevrim gereklidir:

```text
WORLD → OBSERVATION → BRAIN → ACTION → WORLD → ...
```

Bu nedenle sıradaki ana katman Brain IR’ın içine gömülü değil, çevresinde çalışan küçük bir deney dünyasıdır.

## 6. Önerilen v0.3: Experiment + World + Neuromodulation

```text
Brain IR
  ├── nodes
  ├── edges
  ├── state
  ├── recurrence
  ├── trace
  └── causal events

Experiment
  ├── seed
  ├── initial brain
  ├── world
  ├── episode
  ├── observation sequence
  └── metrics

World
  ├── state
  ├── observation
  ├── action
  └── transition

Neuromodulation
  ├── prediction
  ├── outcome
  ├── dopamine
  └── plasticity
```

Öncelik sırası:

```text
WORLD LOOP
→ OBSERVATION
→ ACTION
→ OUTCOME
→ PREDICTION ERROR
→ DOPAMINE SIGNAL
→ TRACE
→ PLASTICITY
```

Plasticity otomatik hale getirilmeden önce deterministic experiment protocol kurulmalıdır.

## 7. World deneyinin ilk biçimi

İlk dünya küçük bir 2D ortam olabilir:

```text
░░░░░░░░░░
░  ●     X░
░         ░
░     ○   ░
░░░░░░░░░░
```

- `●`: ajan
- `X`: yiyecek
- `○`: tehdit

Dünya Brain IR’a gözlem verir. Brain action üretir. Dünya action sonucunu uygular ve yeni observation üretir. Başarı ölçütleri davranışsal olmalıdır: tehdidi görünce kaçma, yiyeceği görünce yaklaşma, enerji kaybını azaltma.

## 8. Homeostasis

Ödülden önce iç durum korunmalıdır:

```text
energy = 1.0
move   → -0.01
food   → +0.30
danger → -0.50
```

İlk homeostatic sinyaller:

```text
energy
health / damage
fatigue
safety
```

Amaç yalnızca “hangi action?” değil, “hangi action iç durumu korur?” sorusunu ölçmektir.

## 9. Dopamin ve prediction error

Dopamin doğrudan reward değildir. İlk hesaplamalı soyutlama olarak teaching/prediction-error sinyali kabul edilir:

```text
δ = actualOutcome - expectedValue
```

Örnek:

```text
expected = 0.4
actual   = 0.9
δ        = +0.5
```

Dopamin normal bir neuron olmak zorunda değildir. Global veya bölgesel neuromodulator channel olarak ele alınmalıdır:

```ts
type Neuromodulator = {
  dopamine: number;
  serotonin?: number;
  acetylcholine?: number;
};
```

## 10. Plasticity

İlk deneysel kural:

```text
Δweight = learningRate
        × preActivation
        × postActivation
        × dopamine
```

Bu biyolojik gerçeklik iddiası değildir; kontrollü bir hesaplamalı abstraction’dır.

Bir OLY olayı ileride şu bilgileri taşıyabilir:

```text
OLY-00000037
observation: food
action: approach
expected: 0.4
outcome: success
actual: 0.9
dopamine: +0.5
```

Bu kayıt trace, hafıza, prediction update ve plasticity motorunu birbirine bağlayan deneysel köprü olur.

## 11. Jev / AI rolü

Jev başlangıçta Brain IR’ın içine konulmamalıdır. İlk rolü dış gözlemci ve semantic analyzer olmaktır:

```text
BrainTrace
   ↓
Jev / AI analyzer
   ↓
semantic interpretation
   ↓
hypothesis
   ↓
new experiment
```

Örneğin:

```text
danger = 0.91
food   = 0.03
unknown = 0.06
```

AI kararın kontrolünü almaz. Brain trace’lerini yorumlar ve yeni deney önerir. Daha sonra gerekirse sınırlı bir local semantic oracle olarak eklenebilir.

## 12. Connectome rolü

Connectome doğrudan kopyalanacak nihai beyin değil, biological prior/reference olarak kullanılmalıdır:

```text
CONNECTOME
    ↓
biological prior
    ↓
Brain IR
    ↓
simulation
    ↓
behavior
    ↓
trace
    ↓
AI analysis
```

Son hedef ters yönde de çalışabilmektir:

```text
desired behavior
      ↓
search / optimization / evolution
      ↓
candidate brain architecture
      ↓
simulation
      ↓
behavior score
```

Bu noktada proje brain simulator’dan brain designer’a dönüşür.

## 13. Devam noktası

Bir sonraki teknik adım:

> **Brain IR v0.3’te deterministic World + Experiment sözleşmesini tanımlamak.**

Önce şu dört nesne belirlenmelidir:

```text
WorldState
Observation
Action
ExperimentSpec
```

Bundan sonra homeostasis ve prediction/outcome protokolü eklenebilir. Dopamin ve plasticity, deney protokolü sabitlenmeden otomatikleştirilmemelidir.
