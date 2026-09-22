# Orion Adaptive Navigation & Exploration Planı

## Karar

Bob'a bağımsız kaçış algoritmaları koleksiyonu yüklenmeyecek. Tüm gezinme, ilerleme izleme, keşif ve recovery davranışları Bob'un arkasında tek bir **Adaptive Navigation & Exploration** katmanında birleştirilecek.

```text
Alice fast path
      ↓
Bob
      ↓
Adaptive Navigation & Exploration
      ↓
Eylem + NavigationMemory kaydı
```

Amaç, Bob'un planner çekirdeğini küçük tutarken açık alan kilitlenmelerini, tekrar eden durumları ve belirsiz keşfi kontrollü biçimde yönetmektir.

## Hedef modül yerleşimi

```text
brain-ir/decision/navigation/
├── planner/
│   ├── A* veya Beam Search
│   └── Transposition Cache
├── progress/
│   ├── distance progress
│   ├── position change
│   └── stall count
├── hysteresis/
│   └── heading turn penalty
├── tabu/
│   └── ziyaret ve state/action cezası
├── exploration/
│   └── sınırlı, seeded keşif
├── frontier/
│   └── ziyaret edilmemiş güvenli bölge seçimi
├── recovery/
│   └── Bug2 ve recovery state machine
└── navigation_memory/
    └── NavigationMemory kayıtları ve replay
```

## Katman sözleşmesi

```ts
export type NavigationMode =
  | "normal"
  | "limited-exploration"
  | "frontier"
  | "recovery";

export interface NavigationState {
  position: Nokta;
  heading: Yon;
  target: Nokta;
  energy: number;
  stallCount: number;
  mode: NavigationMode;
  episodeId: string;
  step: number;
}

export interface NavigationMemory {
  state: string;
  action: Eylem;
  outcome: "success" | "collision" | "no-progress" | "recovered";
  progress: number;
  energyCost: number;
  timestamp: number;
  confidence: number;
}

export interface NavigationDecision {
  action: Eylem;
  mode: NavigationMode;
  score: number;
  fallback: boolean;
  reason:
    | "planner"
    | "deterministic-alternative"
    | "heuristic-exploration"
    | "frontier"
    | "bug2-recovery"
    | "safe-stop";
  visitedNodes: number;
  replaySeed: string;
}
```

## Mod geçişleri

Rastgelelik doğrudan `stall >= 2` sonrasında çalışmayacak. Geçişler sıralı, ölçülebilir ve replay edilebilir olacak:

```text
stall = 0
  ↓
normal planner

stall = 1
  ↓
deterministic alternative

stall = 2
  ↓
heuristic exploration

stall = 3
  ↓
frontier exploration

stall >= 5
  ↓
Bug2 / recovery
```

Başarılı ilerleme görüldüğünde:

```text
progress > 0
  ↓
stallCount = 0
  ↓
normal mode
```

Collision veya tekrarlanan recovery başarısızlığı olduğunda Alice yolu askıya alınacak; Bob güvenli recovery moduna geçecek.

## Action scoring

Aday eylemler tek bir scorer üzerinden karşılaştırılacak:

```text
score(action) =
  + targetProgress
  + noveltyBonus
  - headingTurnPenalty
  - visitPenalty
  - riskPenalty
  - energyCost
  - repeatedActionPenalty
```

Önerilen başlangıç ağırlıkları:

| Terim | Ağırlık |
|---|---:|
| Hedef ilerlemesi | `1.00` |
| Yenilik bonusu | `0.35` |
| Yön değiştirme cezası | `0.25` |
| Ziyaret cezası | `0.60` |
| Risk cezası | `2.00` |
| Enerji maliyeti | `0.15` |
| Tekrarlı action cezası | `0.40` |

Engel görüldüğünde yön değiştirme cezası azaltılacak; collision riski her zaman yüksek önceliğe sahip olacak.

## NavigationMemory

Sistem yalnızca `visitCount[x,y]` tutmayacak. Her state/action sonucu kaydedilecek:

```text
state
+ action
+ outcome
+ progress
+ energyCost
+ timestamp
+ confidence
```

Bu sayede Bob şu tür bilgileri öğrenebilecek:

```text
Bu bölgede ileri denendi → ilerleme yok
Bu yönde sol denendi → güvenli ilerleme
Bu state/action çifti collision üretiyor
```

Memory ilk aşamada episodic tutulacak. Daha sonraki fazda skill motoruna özetlenmiş sinyaller aktarılacak:

```text
NavigationMemory
  ↓
prediction error / novelty / information gain
  ↓
Experience
  ↓
Skill confidence
```

## Seeded randomness ve replay

Keşif için `Math.random()` doğrudan kullanılmayacak. Her karar şu girdilerle deterministik bir seed alacak:

```text
episodeId + step + state + replaySeed
```

Böylece:

- aynı episode yeniden oynatılabilir,
- başarısız keşif birebir üretilebilir,
- benchmark sonuçları karşılaştırılabilir,
- Bob'un şans eseri kurtulduğu durumlar incelenebilir.

## Planner sırası

İlk uygulama sırası:

1. Mevcut planner sözleşmesini koru.
2. ProgressMonitor ekle.
3. ActionScorer ekle.
4. NavigationMemory ve tabu cezası ekle.
5. Deterministic alternative modunu ekle.
6. Seeded limited exploration ekle.
7. Frontier seçimini ekle.
8. Bug2 recovery state machine ekle.
9. A* veya beam search'i planner içine al.
10. Transposition cache ve replay testlerini ekle.

## Kabul kriterleri

### Normal alan

- Bob geçerli action üretir.
- Robot hedefe progress üretir.
- Aynı state/action döngüsü oluşmaz.
- Latency baseline'ın kabul edilebilir sınırında kalır.

### Açık alan

- Duvar olmasa da Bob eylem seçer.
- `sol` ve `sag` fiziksel ilerleme üretir.
- `stallCount >= 2` deterministik alternatif çalışır.
- `stallCount >= 3` frontier veya sınırlı keşif çalışır.

### Recovery

- `stallCount >= 5` Bug2/recovery başlar.
- Collision sonrası Alice fast path askıya alınır.
- Recovery sonucu NavigationMemory'ye kaydedilir.
- Aynı seed ile aynı karar dizisi tekrar üretilebilir.

### Gözlemlenebilirlik

Her karar şu alanları yayınlamalıdır:

```text
mode
source
action
score
reason
stallCount
visitedNodes
latency
replaySeed
```

Bu alanlar mevcut görsel body simulator'daki gerçek zamanlı grafik ve olay günlüğüne bağlanacaktır.

## Sonraki sprint

İlk uygulanacak dikey dilim:

```text
ProgressMonitor
+ ActionScorer
+ NavigationMemory
+ deterministic alternative
+ görsel latency/mode günlüğü
```

Bu dilim tamamlanmadan rastgele keşif ve Bug2 eklenmeyecek. Önce Bob'un neden kilitlendiği ölçülebilir hâle getirilecek, sonra kontrollü keşif eklenecek.
