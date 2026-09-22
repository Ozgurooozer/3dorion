# Brain IR v0.2 Test Raporu

## Sonuç

Brain IR v0.2, ölçülebilir deney platformu olarak çalışıyor. State memory, excitation/inhibition, recurrent dynamics, immutable trace, causal event propagation ve deterministic replay eklendi.

| Kontrol | Sonuç |
|---|---:|
| Brain IR v0.2 özel testleri | **21/21 geçti** |
| Tüm proje testleri (`node_modules` hariç) | **694/694 geçti** |
| TypeScript typecheck | **Başarılı** |
| Üretim derlemesi | **Başarılı** |
| v0.2 örnek JSON | **Geçerli** |
| Replay state/trace karşılaştırması | **Başarılı** |

## Doğrulanan davranışlar

`memory` düğümünde `τ = 0.92` için giriş kesildikten sonraki state değeri beklenen eğriyi izliyor. Pozitif excitation ile negatif inhibition aynı hedefte ayrı trace bileşenleri olarak ölçülüyor. `+0.9` excitation ve `-0.8` inhibition birleştiğinde ham state yaklaşık `0.1` oluyor ve `0.5` eşiğindeki aksiyon tetiklenmiyor.

Recurrent loop testleri dört sınıfa ayrıldı: ağırlık `1` ile stable, `0.5` ile decaying, `-1` ile oscillating ve `1.2` ile unstable. Bu dört sonuç beklenen state dizileriyle eşleşti.

Her düğüm her tikte immutable `BrainTrace` üretiyor. Trace; önceki state, excitation, inhibition, ham state, threshold, aktivasyon, causal node zinciri ve causal event numaralarını taşıyor. `OLY-00000037` input olayından `vision → motion → threat → escape` zincirine kadar nedensel iz taşındı.

Replay kaydı seed, initial state, input dizisi, grafik sürümü ve node parametrelerini içeriyor. Aynı kayıt `BrainSimulator.replay()` ile tekrar çalıştırıldığında state ve trace dizileri birebir eşleşti.

## Performans

v0.1 ile kullanılan ölçüm tekrarlandı: 200 düğüm, 199 bağlantı ve 500 tik. v0.2 sonucu **1602,97 ms** oldu; son aksiyon beklenen şekilde `1` üretti. v0.1 ölçümü 156,27 ms idi.

Bu yaklaşık on katlık artış trace ve causal metadata üretiminin maliyetidir. Bu kabul edilebilir bir laboratuvar prototipi sonucudur, ancak büyük grafikler için üretim optimizasyonu gerekir. En önemli sonraki optimizasyonlar gelen bağlantıların önceden indekslenmesi, yalnız değişen düğümlerin trace edilmesi ve trace depolamasının isteğe bağlı yapılmasıdır.

## Bilinen sınırlar

`BrainSimulator` deterministiktir; `seed` şu an rastgelelik üretmek için değil, replay metadata'sını kimliklendirmek için saklanır. Gerçek stokastik node davranışı eklendiğinde seed yürütme motoruna bağlanmalıdır.

Döngülerin kararlı, sönümlenen, salınan veya büyüyen olduğu ölçülebiliyor ancak henüz otomatik kararlılık sınıflandırıcısı yok. Pozitif geri beslemenin sonsuza büyümesini sınırlayan bir state clamp'i de bulunmuyor.

`ai` düğüm türü IR sözleşmesinde tanımlı, fakat henüz herhangi bir model adapterı yok. Bu bilinçli olarak ertelendi; pure Brain IR davranışları AI eklenmeden önce ölçülmelidir.

## Çalıştırma

```bash
node --experimental-strip-types \
  --import ./tools/babylon-cozucu.mjs \
  --test brain-ir/brain-ir.test.ts

npm run typecheck
npm run build
```
