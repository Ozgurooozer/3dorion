# Brain IR / Orion Beyni Test Raporu

**Rapor tarihi:** 21 Eylül 2026  
**Kapsam:** `/home/ubuntu/3dorion/brain-ir`  
**Amaç:** Mevcut Orion yapısına dokunmadan eklenen modüler Brain IR prototipinin deterministik davranışını, Orion sözleşmesiyle uyumunu ve mevcut depo üzerindeki etkisini doğrulamak.

## Sonuç

Brain IR prototipi mevcut haliyle **kontrollü bir laboratuvar modülü olarak çalışıyor**. Yeni modülün kendi testleri 10/10 geçti. Brain IR dahil olmak üzere depo içindeki tüm proje testleri 683/683 geçti. TypeScript tip kontrolü ve üretim derlemesi başarılı oldu.

Prototip, mevcut `Beyin` arayüzünü uyguluyor ve ürettiği `dunya_bak` çağrısı Orion’un mevcut niyet doğrulama katmanından geçiyor. Buna karşılık modül henüz gerçek dünya akışına bağlanmış değil. Bu nedenle bu rapor, üretim davranışını değil, **takılabilir beyin motorunun güvenli ve ölçülebilir ilk sürümünü** doğruluyor.

## Test özeti

| Kontrol | Sonuç | Açıklama |
|---|---:|---|
| Brain IR özel testleri | **16/16 geçti** | Grafik, decay, eşik, reset, adapter, olay günlüğü ve hafıza doğrulaması |
| Proje testleri | **689/689 geçti** | `node_modules` hariç tüm depo testleri ve Brain IR testleri |
| TypeScript | **Başarılı** | `npm run typecheck` |
| Üretim derlemesi | **Başarılı** | `npm run build` |
| Örnek JSON sözdizimi | **Geçerli** | `brain-ir/examples/orion.json` |
| Performans deneyi | **Başarılı** | 200 düğüm, 199 bağlantı, 500 tik: 156,27 ms |
| Paket test komutu | **689/695 geçti** | 6 hata yalnızca `node_modules/node-pty` test keşfinden kaynaklandı |

## İncelenen davranışlar

### Sinyal yayılımı

Test grafiğinde `terminal_alarm` girdisi önce `dikkat` nöronuna, sonra `tehdit` karar düğümüne ve son olarak `bak` aksiyon düğümüne ulaşıyor. Güncelleme eşzamanlı olduğu için her bağlantı en az bir tik gecikme oluşturuyor. Bu davranış testte doğrulandı; karar aynı tikte sıçramıyor ve aksiyon izlenebilir biçimde sonraki adımda oluşuyor.

Bu gecikme, daha sonra gerçek zamansal devreleri modellemek için uygun bir temel sağlıyor. Bununla birlikte henüz biyolojik sinaps gecikmesi veya farklı zaman sabitleri temsil edilmiyor.

### Karar eşiği

Karar ve aksiyon düğümleri eşik üzerinde `1`, altında `0` üretiyor. Eşik altındaki ham state’in aşağı akışa sızmadığı ayrıca test edildi. Böylece `0,6` değerindeki bir karar düğümü, eşiği `0,7` olan bir karar olarak aksiyon düğümünü yanlışlıkla tetiklemiyor.

### Decay ve state sürekliliği

`neuron` düğümü için `decay` değeri test edildi. Girdi kesildiğinde state değeri `1` seviyesinden `0,5` seviyesine düştü. Bu, kısa süreli hafıza davranışının temel biçimde çalıştığını gösteriyor.

Decay aralığı `0..1` ile sınırlandırılıyor. Aralık dışındaki bir değer grafik oluşturulmadan reddediliyor.

### Reset ve sıfır adımlı çalışma

`reset()` çağrısı state değerlerini ve tik sayacını başlangıca döndürüyor. `run(0)` çağrısı ise artık gizli bir tik üretmiyor ve simülasyonu ilerletmeden mevcut state’i döndürüyor.

## Orion sözleşmesiyle uyum

`BrainIrBeyni`, mevcut `bridge/beyin.ts` içindeki şu sözleşmeyi uyguluyor:

```ts
hazirMi(): Promise<boolean>
dusun(girdi: BeyinGirdisi): Promise<BeyinCikti>
```

Orion girdisi, `duyarga` fonksiyonu aracılığıyla sayısal sensörlere çevriliyor. Bu seçim özellikle modüler bırakıldı. Brain IR, Türkçe metni veya dünya durumunu kendisi yorumlamıyor; bu sorumluluk dışarıdan verilen sensör katmanında tutuluyor.

Aksiyon düğümleri mevcut `dunya_*` araç çağrılarına eşleniyor. Adapter, `action` türünde olmayan düğümlerin aksiyon olarak tanımlanmasını ve `dunya_` ile başlamayan araç adlarını başlangıçta reddediyor.

Üretilen çağrı, `bridge/araclar.ts` içindeki `cagriyiNiyete` fonksiyonuna verildi. `dunya_bak` çağrısı geçerli bir `{ tur: "bak" }` niyetine dönüştü. Böylece Brain IR’ın dünya tarafına doğrudan ve doğrulamasız bir yol açmadığı doğrulandı.

## Olay günlüğü ve numaralı hafıza

Brain IR çağrısı artık bir `beyin_cagrisi` olayı, üretilen her aksiyon ise ayrı bir `beyin_aksiyonu` olayı olarak kaydediliyor. Olaylar `OLY-00000001` biçiminde kararlı numaralar alıyor. Bu numara hem hafıza metninin içinde korunuyor hem de tam olay kaydına doğrudan erişim anahtarı olarak kullanılıyor.

`OlayHafizasi`, olay günlüğünü kaynak kayıt kabul ediyor. Her yeni olay mevcut `mind/Hafiza` skorlayıcısına besleniyor. `ilgili(sorgu)` çağrısı önce hafıza skorlamasıyla adayları seçiyor, sonra `OLY-...` numarasını çözerek tam olay ve metadata bilgisini döndürüyor. Günlük yeniden yüklendiğinde hafıza indeksi olaylardan tekrar kuruluyor; numara dizisi de kaldığı yerden devam ediyor.

Bu akış için şu ek senaryolar test edildi: numara üretimi, özel numarayla doğrudan çağırma, olay günlüğünün dışa aktarılıp yeniden yüklenmesi, yeniden yüklenen olaylardan hafıza indeksinin kurulması, çağrı ve aksiyonların ayrı kaydedilmesi ve günlük yazma hatasında kararın kaybolmaması. Son senaryoda kayıt katmanı hata verdiğinde Brain IR uyarı yazıp çalışmaya devam ediyor. Bu, olay günlüğünü karar yolundan ayırıyor.

Bu tasarımda **olay günlüğü kaynak**, hafıza ise **türetilmiş indeks** konumundadır. Hafıza kaydı silinse bile olay günlüğünden yeniden üretilebilir. Bu nedenle gelecekte dosya, SQLite veya başka bir kalıcı depo eklenebilir; Brain IR’ın karar motoru bu depolama ayrıntılarını bilmek zorunda kalmaz.

## Düzeltilen sorunlar

### Karar state’inin ham değer olarak yayılması

İlk sürümde bir karar veya aksiyon düğümünün ham state’i aşağıdaki düğüme aktarılıyordu. Örneğin karar eşiği `0,7` iken state `0,6` olabilir ve sonraki aksiyonun eşiği `0,5` ise aksiyon yanlışlıkla tetiklenebilirdi.

Düzeltme sonrasında karar ve aksiyon düğümleri aşağı akışa yalnızca eşiklenmiş çıkışlarını iletiyor. Bu davranış için özel regresyon testi eklendi.

### `run(0)` çağrısının gizli tik ilerletmesi

İlk sürümde boş geçmiş için kullanılan geri dönüş ifadesi `step()` çağırıyordu. Bu nedenle `run(0)` beklenmedik şekilde simülasyonu bir tik ilerletiyordu.

Düzeltme sonrasında boş çalışma, mevcut state ve mevcut tik ile açıkça döndürülüyor.

### Grafik ve adapter doğrulamasının genişletilmesi

Grafik doğrulamasına düğüm türü ve eşik geçerliliği eklendi. Adapter tarafında aksiyon düğümü türü ve Orion araç adı doğrulanıyor. Kopuk bağlantı, tekrar düğüm, geçersiz decay ve geçersiz eşik senaryoları test edildi.

## Performans ölçümü

Küçük bir zincir grafiği üzerinde 200 düğüm, 199 bağlantı ve 500 tik çalıştırıldı. Ölçüm sonucu 156,27 ms oldu ve son aksiyon beklenen şekilde `1` üretti.

Bu sonuç yalnızca küçük grafik için anlamlıdır. Simülatör her düğüm için bağlantı listesini yeniden taradığı için mevcut yaklaşım yaklaşık olarak düğüm sayısı ile bağlantı sayısının çarpımına bağlıdır. Milyonlarca bağlantı içeren gerçek connectome verisi için bu yapı yeterli olmayacaktır.

Gerçek connectome aşamasından önce bağlantıların düğüm başına önceden indekslenmesi gerekir. Daha sonra seyrek matris, typed array veya chunk tabanlı hesaplama seçenekleri ölçülmelidir.

## Test komutları

Brain IR testleri:

```bash
node --experimental-strip-types \
  --import ./tools/babylon-cozucu.mjs \
  --test brain-ir/brain-ir.test.ts
```

Tam proje testleri:

```bash
files=$(find bridge host mind protocol voice world brain-ir -name '*.test.ts' -print)
node --experimental-strip-types \
  --import ./tools/babylon-cozucu.mjs \
  --test $files
```

Tip kontrolü ve derleme:

```bash
npm run typecheck
npm run build
```

## Bilinen sınırlar

Brain IR şu anda bir JSON dosyasını doğrudan yükleyen çalışma zamanı katmanına sahip değil. `orion.json` format örneğidir; testte aynı yapı TypeScript nesnesi olarak kuruluyor. Bir sonraki adımda güvenli JSON loader ve şema sürümü eklenmelidir.

Döngüsel grafikler için kararlılık, maksimum iterasyon veya salınım tespiti bulunmuyor. Pozitif geri besleme ağırlıkları state’in büyümesine yol açabilir. Bu nedenle gerçek connectome verisi bağlanmadan önce ağırlık normalizasyonu ve döngü testleri zorunludur.

İnhibisyon yalnızca negatif ağırlıkla örtük olarak ifade edilebiliyor. Ayrı bir excitation/inhibition türü, refractory period, sinaps gecikmesi ve temporal dynamics henüz yoktur.

Olay günlüğü şu anda bellek içi bir uygulamadır. `dok()` ve `kayitlar` ile dış depoya aktarılıp geri yüklenebilir, fakat üretim dosya deposu veya SQLite adapterı henüz eklenmemiştir. Ayrıca olay günlüğü büyüdükçe `ara()` doğrusal tarama yapar; büyük günlükler için indeksleme gerekir.

Aksiyon girdileri şu anda sabit JSON nesneleridir. Gerçek Orion davranışında hedef, metin veya gerekçe gibi alanların sensör/state değerlerinden üretilebilmesi için kontrollü bir aksiyon şablonlama katmanı gerekir.

Bu modül henüz `ORION_BEYIN=ir` gibi bir seçim bayrağıyla üretim başlatma yoluna bağlanmadı. Bu bilinçli bir tercihtir; test tamamlanmadan mevcut Orion davranışını değiştirmemektedir.

## Sonuç ve önerilen sonraki adım

İlk kapı geçildi: Brain IR, Orion’un mevcut beyin sözleşmesine uyuyor, deterministik biçimde çalışıyor, karar izini kaydediyor ve niyet doğrulama katmanını atlamıyor. Ayrıca iki önemli semantik hata testlerle yakalanıp düzeltildi.

Bir sonraki deney üretim entegrasyonu değil, **daha gerçekçi ama hâlâ izole bir beyin laboratuvarı** olmalıdır. Önerilen sıra şudur: önce döngü ve inhibisyon testleri, sonra JSON loader, ardından dinamik aksiyon girdileri ve en son yalnızca seçilebilir bir feature flag üzerinden Orion’a bağlama. Gerçek connectome verisine bu kapılar geçilmeden geçilmemelidir.

## References

[1]: https://github.com/Ozgurooozer/3dorion "Ozgurooozer/3dorion GitHub deposu"
