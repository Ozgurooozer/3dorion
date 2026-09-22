# Alice Reflex Eşikleri, Latency ve Açık Alan Güvenliği

## 1. Alice reflex'in iki ayrı eşiği

Alice davranışında iki farklı kapı vardır: **derleme kapısı** ve **çalışma zamanı seçme kapısı**. Bunları ayırmak önemlidir.

### Derleme kapısı

`AliceBob.derle()` şu anda yalnızca şu iki koşulu kontrol eder:

```ts
if (b.level < 5 || b.reflex !== "aktif") return null;
```

Dolayısıyla derleme için:

| Koşul | Gerekli değer |
|---|---:|
| Skill level | `>= 5` |
| Reflex | `aktif` |
| Confidence | Derleme fonksiyonunda ayrıca zorunlu değil |
| Prediction error | Derleme fonksiyonunda ayrıca zorunlu değil |

Skill motorunun normal öğrenme yolu level 5'e ulaşırken daha sıkı koşullar kullanır:

```text
xp >= 2
mastery >= 0.72
confidence >= 0.72
successRate >= 0.80
contextCoverage >= 0.50
```

Bu koşullar sağlanınca level 5 verilir. Reflex aktifleşmesi ayrıca:

```text
level >= 5
confidence >= 0.75
successRate >= 0.85
reflex != askida
```

koşullarına bağlıdır.

### Çalışma zamanı Alice gate'i

`AliceBob.sec()` mevcut cache yolunu şu koşullarla kullanır:

```ts
const yol = this.yollar.get(g.baglam);

if (
  yol &&
  b.reflex === "aktif" &&
  b.confidence >= 0.75 &&
  b.predictionError < 0.4
) {
  return { kaynak: "alice", eylem: yol.eylem };
}
```

Çalışma zamanında gerekli koşullar:

| Koşul | Eşik | Sonuç |
|---|---:|---|
| Bağlam cache'te | mevcut | yoksa Bob |
| Reflex | `aktif` | değilse Bob |
| Confidence | `>= 0.75` | 0.75 altı Bob |
| Prediction error | `< 0.4` | 0.4 ve üstü Bob |

**Önemli bulgu:** Runtime gate level 5'i tekrar kontrol etmiyor. Level kontrolü derleme aşamasında yapıldığı için normal akış güvenli; ancak dışarıdan beceri nesnesi elle değiştirilebiliyorsa runtime gate'e `b.level >= 5` kontrolü de eklenmesi daha sağlam olur.

## 2. Eşiklerde sınır davranışı

Sınır değerleri şu şekilde çalışıyor:

```text
confidence = 0.75  → Alice için geçerli
confidence = 0.7499 → Bob
predictionError = 0.3999 → Alice için geçerli
predictionError = 0.4    → Bob
reflex = askida         → Bob
context yok              → Bob
```

Bu davranışta `confidence` eşiği kapsayıcı (`>=`), `predictionError` eşiği ise katıdır (`<`).

## 3. Latency ölçümleri

### Alice fast path

Doğrudan runtime gate benchmarkı:

| Ölçüm | Değer |
|---|---:|
| Çağrı sayısı | 100.000 |
| Toplam süre | 8,65 ms |
| Ortalama | **0,0865 µs** |
| Karar | Alice |

Bu yalnızca `AliceBob.sec()` içindeki cache lookup ve güvenlik kapısıdır; world transition ve experience update dahil değildir.

Önceki uçtan uca ölçümde world transition dahil Alice:

```text
yaklaşık 3,51 µs / karar
```

### Bob planner

Derinlik 4 / 341 node koşulunda önceki ayrıştırılmış benchmark:

| Faz | Süre |
|---|---:|
| Bob planner kararı | **71,85 µs** |
| World transition | 0,84 µs |
| Experience/skill update | 1,31 µs |
| Tam Bob döngüsü | **74,00 µs** |

Karar seviyesinde karşılaştırma:

```text
Bob planner / Alice gate
≈ 71,85 / 0,0865
≈ 830×
```

Bu karşılaştırma yalnızca karar fonksiyonları içindir. Uçtan uca world + learning maliyetleri eklendiğinde önceki ölçümde Alice yaklaşık 3,51 µs, Bob yaklaşık 92,69 µs bulunmuştu.

### Bob fallback latency'si

Alice kapısı geçilemediğinde Bob şu maliyetleri taşır:

```text
context lookup
+ planner search
+ world state simulation
+ selected action
```

Bu nedenle reflex'in doğru eşiklerle korunması yalnızca doğruluk değil, latency bütçesi açısından da önemlidir.

## 4. Hatalı reflex'in latency etkisi

Hatalı Alice akışında ilk karar ucuzdur; ancak collision sonrasında sistem Bob'a düşer:

```text
Alice gate
  ↓
Yanlış action
  ↓
World collision
  ↓
Experience update
  ↓
Reflex askida
  ↓
Bob planner
```

Tek bir hatalı kararın sonraki tick'te planner maliyeti doğurması beklenir. Bu nedenle suspension mekanizması:

- hatalı Alice tekrarını engeller,
- kısa vadede bir Bob maliyeti ekler,
- uzun vadede tekrarlanan collision'ları azaltır.

## 5. Açık alanlarda Bob neden kilitlenebilir?

Açık alanda duvar yokken planner'ın kilitlenmesi genellikle fizik motorundan değil, şu üç tasarım hatasından kaynaklanır:

1. Planner boş plan döndürür ve action seçemez.
2. `sol/sag` yalnızca yön değiştirir, konum değişmez.
3. Aynı konumda ilerleme olmadan karar tekrarlandığı halde watchdog bulunmaz.

Bu durumda gözlem değişmez:

```text
aynı konum
aynı hedef
aynı bağlam
aynı action
```

ve sistem kararsız görünür.

## 6. Uygulanan açık alan korumaları

Görsel beden simülatöründe şu korumalar eklendi:

### Geçerli action garantisi

Bob'un sonucu yalnızca şu dört action'dan biri olabilir:

```text
ileri | sol | sag | bekle
```

Planner yolu boşsa doğrudan hedef yönüne göre fallback seçilir.

### Dönüşün fiziksel hareket üretmesi

Beden katmanında artık:

```text
sol = yön değiştir + yeni yöne bir hücre ilerle
sag = yön değiştir + yeni yöne bir hücre ilerle
ileri = mevcut yöne bir hücre ilerle
```

olarak uygulanıyor. Böylece `sol` seçildiği halde robotun aynı hücrede kalması engelleniyor.

### Progress watchdog

Simülatör son konum ile yeni konumu karşılaştırıyor. İki ardışık kararda ilerleme yoksa:

```text
progress watchdog
→ hedef yönünü yeniden hesapla
→ ileri / sol / sag fallback seç
```

uygulanıyor.

### Collision sonrası güvenli reset

Collision olduğunda:

```text
collision sayacı artar
reflex askida olur
compiled Alice yolları temizlenir
Bob fallback devreye girer
```

## 7. Daha güçlü üretim çözümü

Simülatördeki watchdog üretim Brain IR'ye de taşınmalıdır. Önerilen karar sonucu alanları:

```ts
interface Karar {
  kaynak: "alice" | "bob";
  eylem: Eylem;
  plan?: Eylem[];
  ziyaretEdilenDugum?: number;
  ilerleme?: number;
  fallback?: boolean;
  fallbackNedeni?: "bos-plan" | "stall" | "collision-risk" | "budget";
}
```

Ayrıca Alice runtime gate şu hâle getirilmeli:

```ts
if (
  yol &&
  b.level >= 5 &&
  b.reflex === "aktif" &&
  b.confidence >= 0.75 &&
  b.predictionError < 0.4
) {
  return { kaynak: "alice", eylem: yol.eylem };
}
```

Bob için minimum güvenlik sözleşmesi:

```text
planner geçerli action döndürmeli
OR
hedefe doğru greedy fallback döndürmeli
OR
bekle + fallback reason döndürmeli
```

Ancak `bekle` sonsuza kadar tekrarlanmamalıdır. `stallCount >= 2` olduğunda yeni plan veya zorunlu yönlendirme çalışmalıdır.

## Sonuç

Alice reflex şu anda iki kritik runtime eşiğiyle korunuyor:

```text
confidence >= 0.75
predictionError < 0.4
```

Buna derleme ve öğrenme tarafında şu eşikler eşlik ediyor:

```text
level >= 5
successRate >= 0.85
mastery >= 0.72
contextCoverage >= 0.50
```

Doğrudan Alice karar kapısı yaklaşık **0,0865 µs**, derinlik 4 Bob planner kararı yaklaşık **71,85 µs** ölçüldü. Bu, Bob kararını yaklaşık 830 kat daha pahalı yapıyor; dolayısıyla güvenli Alice hit rate önemli bir latency optimizasyonudur.

Açık alan kilitlenmesini önlemek için beden simülatörüne şu üç koruma eklendi:

```text
geçerli action garantisi
+
sol/sag dönüşlerinde fiziksel ilerleme
+
progress watchdog ve greedy fallback
```

Bundan sonraki üretim iyileştirmesi, bu watchdog ve fallback nedenlerini `Karar` tipine taşıyarak Brain IR'nin kendisinde ölçülebilir hâle getirmektir.
