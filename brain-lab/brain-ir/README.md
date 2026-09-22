# Brain IR — Orion için bağımsız beyin laboratuvarı

`brain-ir/`, mevcut `bridge/`, `mind/` ve `world/` koduna dokunmadan çalışan deneysel beyin katmanıdır. Brain IR henüz üretim beyni değildir; state, bağlantı, olay nedenselliği ve davranış replay'i ölçülebilen bir computational substrate'tir.

## v0.2 çekirdeği

Brain IR v0.2 şu katmanları birlikte taşır:

```text
state memory + event log + graph topology
                 ↓
              simulator
                 ↓
     immutable behavior trace + replay
```

Desteklenen node türleri: `input`, `sensor`, `neuron`, `memory`, `inhibitor`, `decision`, `action`, `motor` ve gelecekteki model adapterı için `ai`.

`memory` düğümü önceki state'i `decay` katsayısıyla taşır. `inhibitor` düğümü negatif çıktı üretir. Negatif bağlantı ağırlıkları da inhibition olarak kaydedilir. `decision`, `action` ve `motor` düğümleri eşiklenmiş çıktı üretir. `linear` aktivasyon negatif ve recurrent deneyler için, varsayılan `relu` ise normal düğümler için kullanılır.

## Trace ve olay bağlantısı

Her düğüm her tikte immutable `BrainTrace` kaydı üretir. Trace; önceki state'i, excitation'ı, inhibition'ı, ham state'i, eşiği, aktivasyonu, causal node zincirini ve `OLY-00000037` gibi olay numaralarını taşır.

Brain IR adapterına `olayGunlugu` verildiğinde her düşünme çağrısı ve her aksiyon olay günlüğüne yazılır. `OlayHafizasi`, olayları mevcut `mind/Hafiza` skorlayıcısına besler ve ilgili hafıza seçildiğinde OLY numarasıyla tam olayı çağırır. Ayrıntılı sözleşme `OLAY-HAFIZA.md` içindedir.

## Replay

Bir replay kaydı seed, başlangıç state'i, input dizisi, grafik sürümü ve node parametrelerini taşır. Aynı kayıt şu şekilde yeniden çalıştırılır:

```ts
const tekrar = BrainSimulator.replay(graf, kayit);
```

Aynı grafik ve aynı kayıt aynı state, output ve trace dizisini üretmelidir. Seed şu anda metadata kimliğidir; stochastic node davranışı henüz eklenmemiştir.

## Orion'a takılma

`BrainIrBeyni`, mevcut `bridge/beyin.ts` içindeki `Beyin` arayüzünü uygular. Orion bağlamını Brain IR input'larına çeviren tek parça `duyarga` fonksiyonudur. Input olayları istenirse şu biçimde taşınabilir:

```ts
{ deger: 1, olaylar: ["OLY-00000037"] }
```

Action düğümleri mevcut `dunya_*` araç çağrılarına eşlenir. Adapter, action olmayan düğümlerin aksiyon olarak seçilmesini ve geçersiz Orion araç adlarını baştan reddeder. Üretim seçimi henüz feature flag ile bağlanmamıştır.

## Dosyalar

- `ir.ts`: v0.2 veri sözleşmesi, trace ve replay tipleri.
- `simulator.ts`: state, memory, inhibition, recurrent dynamics, trace ve replay motoru.
- `orion.ts`: mevcut Orion `Beyin` arayüzü adaptörü.
- `olayGunlugu.ts`: OLY numaralı olay günlüğü ve hafıza izdüşümü.
- `examples/orion-v02.json`: memory, inhibition ve feedback içeren örnek grafik.
- `V02-DENEYLERI.md`: v0.2 deney kriterleri.
- `V02-TEST-RAPORU.md`: son doğrulama sonuçları.

## Test

```bash
node --experimental-strip-types \
  --import ./tools/babylon-cozucu.mjs \
  --test brain-ir/brain-ir.test.ts
```

Tam proje doğrulaması için `node_modules` hariç test dosyaları çalıştırılmalıdır. `npm test` mevcut glob kalıbı nedeniyle `node_modules/node-pty` testlerini de keşfedebilir.
