# Brain IR v0.2 deneyleri

Bu sürüm Brain IR'ı yalnızca grafik çalıştırıcısı olmaktan çıkarıp ölçülebilir bir deney platformuna dönüştürür. Dört katman birlikte izlenir: dinamik state, olay günlüğü, grafik topolojisi ve immutable davranış trace'i.

## Yeni düğüm türleri

`memory` düğümü önceki state'i `decay` katsayısıyla taşır. Örneğin `decay: 0.92`, giriş kesildiğinde state'in her tikte yüzde 92'sini korur. `inhibitor` düğümü negatif sinyal üretmek için ayrılmıştır. Negatif bağlantı ağırlıkları da doğrudan inhibition olarak trace'e yazılır. `sensor`, `motor` ve `ai` türleri IR sözleşmesinde hazırdır; `ai` düğümünün model adaptörü henüz eklenmemiştir.

## Trace ve nedensellik

Her tikteki her düğüm immutable bir `BrainTrace` kaydı üretir. Kaydın içinde önceki state, excitation, inhibition, ham state, eşik, aktivasyon durumu, neden olan node'lar ve olay numaraları bulunur. Bir input şu biçimde olay bağlayabilir:

```ts
{ deger: 1, olaylar: ["OLY-00000037"] }
```

Bu olay numarası devre boyunca taşınır ve action trace'inde görülebilir. Böylece olay günlüğü “ne oldu?” sorusunu, trace ise “hangi devre nedeniyle oldu?” sorusunu yanıtlar.

## Replay

Bir replay kaydı seed, başlangıç state'i, input dizisi, grafik sürümü ve node parametrelerini taşır. Aynı grafik ve kayıt `BrainSimulator.replay(graf, kayit)` ile yeniden çalıştırılır. Deterministik motor aynı state, output ve trace dizisini üretmelidir.

## Başarı kriterleri

- `memory` için `τ = 0.92` eğrisi beklenen değerle eşleşmeli.
- Pozitif bağlantı ile pozitif bağlantı + inhibition sonuçları farklı olmalı.
- Stable, decaying, oscillating ve unstable recurrent loop davranışları ayrılmalı.
- Aynı replay kaydı bit düzeyinde aynı sonuçları üretmeli.
- Bir action trace'i input olayından geriye doğru nedensel node zinciri taşımalı.

## Çalıştırma

```bash
node --experimental-strip-types \
  --import ./tools/babylon-cozucu.mjs \
  --test brain-ir/brain-ir.test.ts
```

Bu sürüm hâlâ üretim Orion akışına bağlanmış değildir. Önce v0.2 deney kriterleri, ardından JSON loader ve gerçek connectome importer değerlendirilmelidir.
