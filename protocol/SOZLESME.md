# Dünya Protokolü — Sözleşme

Bu dizin projenin omurgasıdır ve **hiçbir şeye bağımlı değildir**. Babylon'u,
Electron'u, Orion çekirdeğini tanımaz. Beyin ile beden arasındaki tek temas
yüzeyi burasıdır.

## Neden var

"AI'a sanal bir alan vermek" iddiasının iki bilinen çöküş biçimi var:

1. **Motor kilidi.** AI mantığı doğrudan Babylon çağırırsa, motor bir daha
   değişmez ve dünya test edilemez hâle gelir.
2. **Token çöplüğü.** Dünya canlıdır, saniyede 20 kez durum üretir. Bu akış
   LLM bağlamına girerse maliyet saatler içinde patlar.

Protokol ikisini de yapıya gömerek engeller.

## İki yön

```
        ┌──────────────┐   niyet (Niyet)    ┌──────────────┐
        │    BEYİN     │ ─────────────────► │    DÜNYA     │
        │ Claude /     │                    │  Babylon     │
        │ yerel model  │ ◄───────────────── │  sahne+avatar│
        │ / mind       │   algı (Algi)      │              │
        └──────────────┘                    └──────────────┘
```

- **Niyet** (`niyet.ts`) — Orion'un dünyada yapabildiği her şey. Bu liste
  aynı zamanda Orion'un araç yüzeyidir: `bridge/tools.ts` burayı okuyup LLM'e
  araç şeması üretir. Yeni yetenek eklemek = buraya bir varyant eklemek.
- **Algı** (`algi.ts`) — dünyanın Orion'a söylediği her şey.

## İki kanal — maliyet tavanı

| Kanal | Tüketici | Frekans | Maliyet |
|---|---|---|---|
| `yerel` | `world/`, `mind/` | 20 Hz | 0 |
| `beyin` | LLM bağlamı | olay bazlı | token |

**KATI SINIR:** `tik` algısı hiçbir koşulda `beyin` kanalına yazılmaz.
Terfi kararını yalnızca `mind/dikkat` verir ve `VARSAYILAN_KANAL` haritasını
**yalnızca daraltabilir, genişletemez**. Bu kural test edilir
(`protokol.test.ts` → "tik yerel kanalda kalır").

## Güvenilmezlik varsayımı

Niyetler LLM çıktısından doğar. Alan eksik, tür uydurulmuş, sayı `NaN`
olabilir. `dogrula.ts` her niyeti geçirir; dünya doğrulanmamış niyet işlemez.
Reddedilen niyet **sessizce yutulmaz** — hata mesajı geçerli seçenekleri
söyler, böylece model kendini düzeltebilir.

## molp ile ilişki

`POZLAR` ve `JESTLER` sözlükleri `molp/core/sahne.ts` ile **birebir aynı**
tutulmuştur. Mevcut `[POZ:x]` / `[JEST:x]` stream ayrıştırıcısı çeviri
katmanı olmadan bu protokole bağlanabilir. Taşıma tarafında zarf, molp
`core/mesh` kanalında `tur: "SAHNE"` mesajının `govde` alanı olarak seyahat
eder — yeni bir taşıma icat edilmedi.

## Değiştirme kuralı

`SURUM` kırıcı değişiklikte artar. Bir alan kaldırmak, bir sözlükten değer
çıkarmak veya bir niyeti yeniden adlandırmak kırıcıdır. Alan/varyant eklemek
kırıcı değildir.
