# Jev AI Observer Entegrasyon Planı

## Mimari karar

Jev, Brain IR'nin içine veya Alice/Bob implementasyonunun içine yerleştirilmeyecek. Jev, Brain IR'nin ürettiği trace ve Analyzer çıktıları üzerinde çalışan **opsiyonel AI Observer / intelligence layer** olacaktır.

```text
Brain IR
   ↓ trace
Analyzer
   ↓ structured analysis
AI Observer Interface
   ↓ adapter
Jev
   ↓ score · choice · novelty · confidence · hypothesis
Experiment / Brain Designer
```

**Orion, Jev olmadan çalışmaya devam etmelidir.** Jev giderse Brain IR, Learning, Memory, Decision ve Reflex katmanları çalışır durumda kalmalıdır.

## Orion master planındaki yeri

```text
1.  WORLD
2.  BRAIN IR
3.  LEARNING
4.  MEMORY
5.  EXPERIENCE / SKILL
6.  DECISION
    ├── Alice
    ├── Bob
    ├── Novelty Gate
    ├── Fast Path
    └── Adaptive Navigation
7.  REFLEX
8.  ECONOMY
9.  ANALYZER
10. AI OBSERVER          ← Jev burada
    ├── State Interpreter
    ├── Choice
    ├── Score
    ├── Novelty
    ├── Confidence
    ├── Anomaly Detection
    └── Hypothesis
11. QSE
12. CONNECTOME
13. BRAIN DESIGNER
```

## Alice, Bob ve Jev ayrımı

```text
Alice = doğrulanmış davranışı uygular
Bob   = belirsiz durumda düşünür / araştırır
Jev   = trace'i gözlemler, yapılandırır, değerlendirir
```

Karar akışı:

```text
INPUT
  ↓
NOVELTY GATE
  ├── düşük novelty + mastered → Alice
  └── yüksek novelty / belirsizlik → Bob
                                  ↓
                              Jev query (opsiyonel)
                                  ↓
                         confidence + hypothesis
                                  ↓
                              decision
```

Jev, Bob'un yerine karar veren üçüncü bir planner olmayacak. Bob'un kararını açıklamak, puanlamak, belirsizliği görünür kılmak ve deney önermek için kullanılacak.

## Observer contract

İlk olarak generic bir sözleşme tanımlanacak; Jev bu sözleşmenin yalnızca bir adapter'ı olacak.

```ts
export interface BrainTrace {
  episodeId: string;
  step: number;
  state: unknown;
  observation: unknown;
  decision: unknown;
  outcome: unknown;
  latencyUs?: number;
  predictionError?: number;
}

export interface ObserverAssessment {
  novelty: number;
  confidence: number;
  anomaly: number;
  score: number;
  explanation?: string;
  hypothesis?: string;
  suggestedExperiment?: string;
}

export interface AIObserver {
  assess(trace: BrainTrace): ObserverAssessment;
  available(): boolean;
}
```

`available()` false olduğunda Orion aynı trace'i kaydedip Jev'siz deterministik Analyzer yoluna devam edecektir.

## Jev döngüsü

```text
Brain IR
   ↓
Trace
   ↓
Analyzer
   ↓
Jev Observer
   ├── State interpretation
   ├── Novelty estimate
   ├── Confidence estimate
   ├── Anomaly detection
   └── Hypothesis
   ↓
Experiment
   ↓
New trace
   ↺ Jev
```

Bu döngü Jev'i runtime brain dependency'si değil, brain discovery ve experiment assistant yapar.

## Roadmap değişikliği

```text
v0.x  Brain IR + Alice/Bob + embodied simulator
v0.x  Adaptive Navigation & Exploration
v1.0  Learning Brain
v1.1  Generic AI Observer Interface
v1.2  Jev Adapter + Experiment Analysis
v1.3  Jev Hypothesis Engine
v2.x  Connectome + Jev Analysis
v3.x  Brain Designer
```

Jev, v1.0 Learning Brain'in kritik bağımlılığı olmayacak. Önce generic interface ve fallback Analyzer hazırlanacak.

## Adaptive Navigation ile ilişkisi

Adaptive Navigation & Exploration Bob'un karar arkasındaki deterministik runtime katmanıdır:

```text
Bob
  ↓
Adaptive Navigation
  ↓
Action
```

Jev ise bu kararların trace'lerini inceleyen üst katmandır:

```text
Adaptive Navigation
  ↓ trace
Analyzer
  ↓
Jev
```

Dolayısıyla Jev navigation policy'nin içine gömülmez. Ancak ileride Jev şu çıktıları sağlayabilir:

- hangi state/action çiftlerinin anormal olduğunu işaretlemek,
- navigation memory kayıtlarını kümelendirmek,
- recovery başarısızlıkları için hypothesis önermek,
- yeni exploration deneyleri tasarlamak.

Runtime güvenlik ve eylem seçimi yine Brain IR + Bob + Adaptive Navigation'da kalacaktır.

## Fazlar

### Faz 1 — Contract ve fallback

- `AIObserver` generic interface'i ekle.
- Jev olmadan çalışan deterministic `NullObserver` ekle.
- Trace schema'sını sabitle.
- Observer latency ve availability ölç.

### Faz 2 — Jev adapter

- Jev'i `AIObserver` contract'ına bağla.
- State interpretation ve confidence çıktısını trace'e iliştir.
- Jev yoksa aynı deneyin deterministik fallback ile çalışmasını doğrula.

### Faz 3 — Experiment analysis

- Jev assessment sonuçlarını Analyzer'a yaz.
- Hypothesis ve suggestedExperiment alanlarını episodic memory'ye kaydet.
- Deney sonuçlarını yeni trace ile Jev'e geri besle.

### Faz 4 — Brain Designer bağlantısı

- Jev hypothesis'lerini Brain Designer girdisi hâline getir.
- Yeni policy veya skill değişikliklerini sandbox deneyinde çalıştır.
- Üretim Brain IR'ye yalnızca kabul testinden geçen değişiklikleri aktar.

## Kabul kriterleri

- Jev kapalıyken Orion'un karar döngüsü çalışır.
- Jev latency'si Brain IR action latency'sini bloke etmez.
- Jev doğrudan Alice action'ını override edemez.
- Jev doğrudan Bob planner state'ini mutate edemez.
- Her assessment ilgili trace ve episode ile ilişkilidir.
- Aynı trace replay edildiğinde Jev kapalı deterministic sonuç değişmez.
- Jev önerisi deney olarak çalıştırılmadan runtime policy'ye dönüşmez.

## Sonuç

Jev, Orion'un beyni değil; **beyni inceleyen, puanlayan, hipotez üreten ve yeni deneyler tasarlamaya yardım eden araştırmacıdır**.

Bu ayrım korunmalıdır:

```text
Brain IR = çalışır ve replay edilebilir çekirdek
Bob       = deliberative runtime karar katmanı
Adaptive Navigation = güvenli hareket / keşif katmanı
Analyzer  = ölçüm ve trace katmanı
Jev       = opsiyonel AI Observer
Designer  = kontrollü yeni beyin deneyleri
```
