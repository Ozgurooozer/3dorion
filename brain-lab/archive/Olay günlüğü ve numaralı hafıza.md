# Olay günlüğü ve numaralı hafıza

Brain IR çağrıları `OlayGunlugu` üzerinden kaydedilir. Her olay kararlı bir numara alır:

```text
OLY-00000001
OLY-00000002
```

`OlayHafizasi`, olayları önce günlüğe yazar, sonra mevcut `mind/Hafiza` skorlama motoruna `OLY-...` numarasını taşıyan bir hafıza kaydı verir. Hafıza ilgili kaydı seçtiğinde numara üzerinden tam olay günlüğüne dönülür.

```ts
const hafiza = new OlayHafizasi();
const olay = hafiza.kaydet({
  tur: "beyin_cagrisi",
  metin: "terminal alarmından sonra bak kararı",
  veri: { grafik: "orion-dikkat-v0" },
});

hafiza.cagir(olay.id);          // tam olay
hafiza.ilgili("terminal alarm"); // ilgili olaylar + OLY kimlikleri
```

Beyin adaptörüne `olayGunlugu: hafiza` verildiğinde her düşünme çağrısı ve üretilen aksiyon ayrı olay olarak kaydedilir. Kaydı yapan katman hata verirse beyin akışı kesilmez; olay kaydı gözlem/hatırlama katmanıdır, karar yolunun zorunlu bağımlılığı değildir.
