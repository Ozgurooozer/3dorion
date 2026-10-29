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

## Taşıyıcı kuralları (Pipecat istemci SDK'sından, 2026-10-29)

Kaynak: `pipecat-ai/pipecat-client-cxx` (`transport.h`, `client.h`, BSD-2) — yalnız arayüz sözleşmesi okundu, gerçeklemesi okunmadı. Bir beyin/taşıyıcı (ollama, apiBeyni, disBeyin, mcpBeyin,
uzak ajan, ileride telefon) köprüye bağlanırken şu kurallar HEDEFTİR; mevcut köprünün hepsine uyumu henüz denetlenmedi (DOGRULAMA-DEFTERI K16):

1. **Gözlemci asla bloklamaz.** Taşıyıcının köprüye verdiği olay çağrıları hemen döner; ağır iş kuyruğa.
2. **Yaşam döngüsü sırayla.** bağlan / kopar / ayarla çağrıları aynı anda yürümez (bir taşıyıcı eşzamanlı yaşam döngüsü yazmak zorunda kalmasın).
3. **Köprü, taşıyıcıyı onun olay çağrısının İÇİNDEN çağırmaz** (bağlan/kopar olayı bekleyen kilitlenir).
4. **Kendi başlattığın kopma olay olarak geri gelmez.** "Taşıyıcı kendiliğinden koptu" yalnız beklenmeyen kopmadır; yoksa köprü kendi kapatmasını hata sanar.
5. **Hata ölümcül mü?** Her taşıyıcı hatası `fatal` bayrağı taşır: oturum sürebilir mi, bitti mi. Sessiz düşme yok (mevcut ilke) ama tek tür hata da yok.
6. **İstek/yanıt eşleşmesi:** yanıt isteğin `id`sini taşır; isteğin zaman aşımı vardır (Pipecat varsayılanı 10 sn); sonuç ya yanıt, ya hata, ya zaman aşımıdır — asılı kalmaz. Zarfta `id` zaten var; genel istek yolu henüz yok.
7. **Uzun iş sonradan yanıtlanır:** araç çağrısı sonucu hemen ya da sonra, tek kez verilir; bağlantı kapandıysa sonuç yutulur (hata değil). Bizdeki karşılığı: onay kapısının asenkron sonucu.
8. **Yetenek bildirimi:** beyin bağlanınca ne yapabildiğini söyler (araç çağırma, görme, ses); köprü varsaymaz. Bugün `beyinKatalogu` taraması bunun yarısıdır.

Pipecat'in RTVI zarfı (`id, label, type, data`) bizim zarfımızla (`v, id, ts, yon, govde`) aynı fikirdir; çevirmek `SURUM` kırar ve kazancı yoktur — alınmadı.
