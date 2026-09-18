# 3dorion — durum raporu

> Tarih: 2026-09-18 · `master` @ `c4781dc` (origin ile eşit) · 611 test yeşil
> Kanıt etiketleri: `[TEST]` birim testli · `[ÖLÇÜLDÜ]` canlı/gerçek koşuda
> sayı var · `[YAZILDI-KOŞULMADI]` yazıldı, çalıştırılmadı

## Tek cümle

Orion artık **gördüğünü doğru söylüyor** (%100 sadakat, uydurma 0) ve
**bedeninde hata payı var** (komut ≠ gerçekleşen); tezin iskeleti de ruhu da
ayakta — eksik olan tek büyük parça **kendi gündemi**.

Bir önceki rapor (2026-09-17) "cevabı kullanmıyor, gündemi yok" diyordu.
Birincisi çözüldü, ikincisi duruyor — ama artık ön koşulları hazır.

---

## Plan envanteri — ne bitti, ne bekliyor

| plan | kapsam | durum |
|---|---|---|
| **spec 01** — sanal alan | oda, tik, protokol, MVP K1–K12 | ✅ **bitti** |
| **spec 02** — iki loblu beyin | refleks / düşünce ayrımı | ✅ **bitti** |
| **spec 03** — algı + zihin duvarı | algı hizmeti, paneller | ✅ **bitti** |
| **spec 04** — dış beyin | dil-bağımsız HTTP sözleşmesi | ✅ **bitti**, bugün Haiku ile kullanıldı |
| **spec 05** — modüler beyin + devre panosu | pano, teller, teyit | ✅ **bitti** (S0–S7) |
| **spec 06** — beyin v2 (sadakat) | Faz 0·1·1b·2·3·4a·4b·5a·5b | ✅ **bitti** · 5c (IDF) **gerekçeli atlandı** |
| **spec 06 §6.8** — bağlam dili | İngilizce çerçeve / Türkçe ses | ✅ **bitti** |
| **beden mimarisi** (plan dosyası) | Faz 0·1·2·3·5 | ✅ **bitti** · Faz 4 **gerekçeli atlandı** |
| **spec 07** — dünya çekirdeği | başsız sim, kalıcılık, dil seçimi | ⏸ **başlamadı** — panel kurulmadı |
| **inisiyatif** | Orion'un kendi gündemi | ⏸ **bekliyor** — ön koşulları hazır |
| **MCP kaydı (Aşama 3)** | satır sözleşmesinin yerine gerçek tool-calling | ⏸ **karar bekliyor** (Ozyn) |
| **ponytail denemesi** | ölç, 2026-10-01'de karar | ⏳ **süresi dolmadı** |
| **VRM avatar** | Cesium_Man, 0 morph target | ⏸ **Ozyn erteledi** |
| **STT** | mikrofon donanımı yok | ⏸ **Ozyn erteledi** |

---

## Bugün biten iki büyük iş

### 1. Bağlam dili — İngilizce çerçeve `[ÖLÇÜLDÜ]`

"Yerel model cevap vermiyor" teşhisi **yanlıştı**. Ham çıktı kelime salatası
gösterdi ve sebep modelin yetersizliği değil, **Türkçe bağlamdı**:

| bağlam | doğru araç (1. tur, n=10) | gecikme |
|---|---|---|
| Türkçe | **0/10** (+2 bozuk şema) | 1,4 sn |
| yalnız talimat+araç İngilizce | 4/10 | 0,6 sn |
| hepsi İngilizce çerçeve | **9/10** | **0,6 sn** |

Haiku'da sadakat **%90 → %100**, uydurma 1 → 0.

**Sınır:** İngilizce = makineye ait olan (talimat, araç açıklamaları, durum
satırlarının çerçevesi). Türkçe = odadaki şeylerin **adları** ve Orion'un
**sesi**. Protokol kimlikleri (`KOMUT:`, `onumde`, `dunya_sor`) çevrilmez.

### 2. Beden mimarisi — donanım disiplininde

| faz | ne | kapı |
|---|---|---|
| 0 | Gövde künyesi `protocol/bedenTanimi.ts`'e (URDF mantığı) | saf taşıma, hiçbir sayı değişmedi `[TEST]` |
| 1 | `AvatarIskeleti` **Babylon'dan kurtuldu** | `grep @babylonjs` → boş `[TEST]` |
| 2 | **Aktüatör doyumu** — komut ≠ gerçekleşen | 0,1→1,25 m/s 13 tik; fren 1,187→0,587→0 `[ÖLÇÜLDÜ]` |
| 3 | Propriyosepsiyon bağlamda | sadakat **düşmedi** (%100) `[ÖLÇÜLDÜ]` |
| 5 | **LED yüz = üçüncü sürücü** | canlı HIL **4/4**, gerçek sunucuya `[ÖLÇÜLDÜ]` |

Faz 5 mimari iddianın kanıtı: aynı `Yurutucu`, sahne yerine gerçek donanım
ucu. Birim testleri **Babylon kancası olmadan** koşuyor.

### 3. Claude Haiku seçilebiliyor

Panelde `claude:haiku` adıyla duruyor; adaptörü Electron başlatıyor, çıkışta
öldürüyor. Öncesinde seçenek `dis` diye anlaşılmaz bir addaydı ve adaptörü
elle başlatmak gerekiyordu — yani Ozyn için o seçenek pratikte yoktu.

---

## Tooling modeli neden ana beyin olmadı `[ÖLÇÜLDÜ]`

Soru yerinde, üstelik **tooling modeli zaten kurulu ve zaten kullanılıyor**:
`functiongemma-270m` (253 MB), `mind/refleks.ts` → `OllamaRefleks`. Ama orada
araç çağırmak için değil, *"bu olay beyni uyandırsın mı"* ikili JSON kararı
için kullanılıyor.

Araç seçiminde bugün ilk kez ölçüldü:

| model | doğru `sor(onumde)` | not |
|---|---|---|
| `functiongemma-270m` | **0/10** her üç dil yapılandırmasında | `tool_calls` alanına hiç yazmadı |

Ham çıktı sebebi gösterdi — **beceremediği için değil, başka lehçe konuştuğu
için**:

```
<start_function_call>call:dunya_sor{ne:<escape>onumde<escape>}<end_function_call>
```

Doğru aracı ve doğru argümanı üretiyor, ama ollama'nın OpenAI-tarzı
`tool_calls` alanı `null` kalıyor; köprü göremiyor. Üstelik **durmuyor**:
aynı cevapta önce yanlış `dunya_yaz`, sonra doğru `dunya_sor`, sonra
`dunya_dur`, sonra `dunya_sor{ne:dunya}`... Tek araç verildiğinde tamamen
dağıldı (`call:git us current_page_url` tekrarı) — 270M bizim şemayı tutmuyor.

**Ana beynin gerçek engeli ise ayrı ve daha temel:** ana beyin yalnızca araç
çağırmıyor, **Türkçe konuşuyor**. `dunya_soyle`nin `metin` alanı serbest
metindir. 270M'lik bir fonksiyon modeli doğru çağrıyı üretebilir ama Türkçe
cümle kuramaz.

**Yani fikir ölü değil, bugünkü aday yetersiz.** Doğru biçim şu ayrım:
eylem seçimi (araç çağrısı — kimlikler, dil yok) tooling modeline, **söz**
(Türkçe düzyazı) büyük beyne. Ölçülmesi gereken: orta boy bir araç uzmanı
(ör. 3–8B fonksiyon-çağırma modeli) bizim 14 araçlık şemayı tutuyor mu.
Alet hazır (`scratchpad/kapsam-olc.mjs` kalıbı), maliyet birkaç dakika.

---

## Sayılar

| ölçüt | değer | kanıt |
|---|---|---|
| Sadakat (Haiku, İngilizce çerçeve) | **%100** (10/10) | `[ÖLÇÜLDÜ]` |
| Uydurma | **0** | `[ÖLÇÜLDÜ]` |
| Beyin gecikmesi (Haiku) | 2,4–3,7 sn | `[ÖLÇÜLDÜ]` |
| Yerel araç seçimi (İngilizce çerçeve) | 9/10, 0,6 sn | `[ÖLÇÜLDÜ]` |
| Dünya tiki | 19,8–20,0 Hz, 0 atlanan | `[ÖLÇÜLDÜ]` |
| Onaysız çalışan komut | **0** (değişmez) | `[TEST]` |
| Test | 611 yeşil | `[TEST]` |
| Sadakat fixture'ları | 10 | — |

---

## Açık kusurlar (öncelik sırasıyla)

1. **Orion'un inisiyatifi yok.** Tezin asıl vaadi. **Artık kapı açık:** K1'in
   iki ön koşulu da sağlandı — sadakat %100, ve fayda puanlaması için gereken
   **maliyet** Faz 2'den sonra var (gövdenin hata payı). Eksik: güç bütçesi.
2. **Senaryolar `world/giris.ts` içinde.** ~1.300 satır test kodu üretim
   dosyasında ve bundle'da.
3. **Ayar normalizasyonu 4 kopya** (`dikkat`, `ajanda`, `hafiza`, `onayKapisi`).
4. **`world/surfaces/sema.ts` testsiz** (824 satır).
5. **Yerel modelin Türkçe SÖZ kalitesi ölçülmedi.** Araç çağırma ölçüldü
   (9/10), cümle kurma ölçülmedi.
6. **PowerShell'de cmd sözdizimi öneriyor** (`cd /d`). Onay kapısı tutuyor
   ama öneri çalışmazdı.
7. **`OPENCODE_SERVER_PASSWORD` ayarlı değil.**

---

## Bilerek yapılmayanlar (gerekçeli)

- **IDF / BM25 (spec 06 5c).** K6 "ölçüm gerektirirse" diyordu; kalıp üreten
  kaynak Faz 3'te kurudu, gövde eşleşmesi ekleri çözdü.
- **Duyu gecikmesi (beden Faz 4).** ~150 ms bu dünyada gözlemlenemez: en hızlı
  şey koşan Orion (2,45 m/s → 0,37 m) ve mesafe zaten 1,2/2,5/4,5 m eşiklerine
  kabalaştırılıyor. Üstelik örnekle-tut **zaten var**: `mind/calismaBellegi.ts`
  cevabı tutuyor, 30 sn'de eskitiyor, yaşını yazıyor.
- **ROS 2 / URDF XML / fizik motoru.** Desen alındı, çatı alınmadı.

---

## Sıradaki — önerilen sıra

1. **Güç bütçesi** — tek skaler kaynak; hareket de düşünce de aynı yerden
   harcar. İnisiyatifin ön koşulu: tartacak maliyeti olmayan bir varlığın
   gündemi olamaz.
2. **İnisiyatif** — çalışma belleğini okuyan fayda puanlamalı ajanda.
3. **Senaryoları `giris.ts`'ten çıkar** — borç, ama hiçbir şeyi bloke etmiyor.
4. *(paralel, ucuz)* Orta boy araç-uzmanı model ölçümü — yukarıdaki tooling
   sorusunun devamı.

**spec 07 (dünya çekirdeği / başsız sim / dil seçimi)** bilerek beklemede:
mühendislik merceği "önce durum ve saatler, sonra süreç sınırı" dedi ve
Faz 0–5 tam onu yaptı. Süreç ayrımına gerek doğarsa artık ölçülebilir bir
zeminden karar verilir.
