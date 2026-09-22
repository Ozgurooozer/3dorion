# Olay günlüğü, numaralı hafıza ve v0.2 trace

Brain IR çağrıları `OlayGunlugu` üzerinden kaydedilir. Her olay kararlı bir numara alır:

```text
OLY-00000001
OLY-00000002
```

`OlayHafizasi`, olayları önce günlüğe yazar, sonra mevcut `mind/Hafiza` skorlamasına `OLY-...` numarasını taşıyan bir hafıza kaydı verir. Hafıza ilgili kaydı seçtiğinde numara üzerinden tam olay günlüğüne dönülür.

```ts
const hafiza = new OlayHafizasi();
const olay = hafiza.kaydet({
  tur: "beyin_cagrisi",
  metin: "terminal alarmından sonra bak kararı",
  veri: { grafik: "orion-dikkat-v0" },
});

hafiza.cagir(olay.id);             // tam olay
hafiza.ilgili("terminal alarm");  // ilgili olaylar + OLY kimlikleri
```

## Nedensel iz

Brain IR v0.2 input'ları olay numarası taşıyabilir:

```ts
{ deger: 1, olaylar: ["OLY-00000037"] }
```

Simülatör bu numarayı node'lar boyunca taşır. Action trace'i `causeEvents` ve `causeNodes` alanlarıyla hem olay kaynağını hem de devre zincirini gösterir. Adapter, düşünme olayına tüm trace'i ve aksiyon olayına ilgili `nedenselIz` kaydını ekler.

Bu ayrım iki soruyu ayırır:

- **Ne oldu?** Olay günlüğü cevaplar.
- **Neden oldu?** Brain IR trace'i cevaplar.

## Kalıcılık

`OlayDefteri.dok()` çıktısı dış depoya yazılabilir. Yeni oturumda `OlayDefteri({ kayitlar })` ile günlük yüklenir. `OlayHafizasi` mevcut günlükteki olaylardan hafıza indeksini otomatik olarak yeniden kurar; numara dizisi de kaldığı yerden devam eder.

Dosya veya SQLite adapterı henüz bu modüle gömülü değildir. Bu bilinçli ayrım, günlük depolamasının Brain IR karar motorundan bağımsız kalmasını sağlar.
