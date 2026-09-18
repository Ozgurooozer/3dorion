# Spec 07 — Dünya çekirdeği: dil, süreç ve hafıza

> 2026-09-19 · Karar toplantısı: `C:\vault\meetings\meeting-2026-09-19-orion-dunya-cekirdegi\`
> Durum: **K1–K7 kararlaştırıldı · Faz 1 uygulandı · Faz 2 tetikleyiciye bağlı**

## 1. Soru

Ozyn (2026-09-18): *"Babylon ile yaptığımız iş front end gibi — backend'ini
güçlendirelim. Hangi dilde yazılsa, avantajları dezavantajları ne?"*

"Backend" burada üç ayrı şey ve ayrı oylandı:

| | soru |
|---|---|
| **D1** | Dünya çekirdeği hangi dilde? |
| **D2** | Dünya simülasyonu renderer'dan ayrı sürece *şimdi* mi taşınsın? |
| **D3** | Orion'un hafızası nerede yaşasın? |

Soru 18 Eylül'de sorulduğunda panel kurulmadı. Mühendislik merceği önce şu
sırayı önerdi: **önce durum ve saatler, sonra süreç sınırı.** O uygulandı
(beden mimarisi Faz 0–5) ve bu karar ölçülmüş bir zeminden veriliyor.

## 2. Ölçülmüş zemin

| bulgu | kanıt |
|---|---|
| **Kopya-kayması bu repoda teorik değil** | Tek günde dört hata: `sureSozu` kopyası · `zaman.test.ts`'in üç fonksiyon kopyası · `refleks.ts`'in ölü önek dalı · `slice(5)` sabit uzunluğu |
| **Denetleyici zaten başsız** | `world/avatar/yurutucu.ts` sıfır Babylon; Faz 5 HIL kapısı düz Node'da gerçek LED yüzünü sürdü (4/4) |
| **Sürücü arayüzü donanım-nötr** | `AvatarIskeleti`, üç sürücü |
| **Beyin zaten ayrı süreçte** | spec 04; Claude Haiku bugün bu sözleşmeden çalışıyor |
| **Tik bütçesi sağlam** | 19,76–19,98 Hz, **0 atlanan tik** |
| **Hafıza renderer'da** | `localStorage`, tek tüketici; depo arayüzü dar (`oku`/`yaz`) |
| **İş yükü** | tek oyuncu, tek ajan, 20 Hz. **Ham hız bir ölçüt değil.** |

## 3. Oylama sonucu (8 disiplin, 1–5)

| | seçenek | toplam |
|---|---|---|
| D1 | **TypeScript** · Rust · Python · Godot | **32** · 28 · 20 · 18 |
| D2 | **Tetikleyiciyle ayır** · şimdi ayır | **35** · 19 |
| D3 | **Host JSON dosyası** · SQLite · `localStorage` kalsın | **35** · 26 · 16 |

Rust'ın yakın ikinciliği tek bir koşula bağlı: çekirdeğin mikrodenetleyicide
koşması (K6).

## 4. Kararlar

- **K1 — Dünya çekirdeği TypeScript'te kalır.** `protocol/` kopyalanmaz;
  kopya-kayması bu repoda ölçülmüş bir zayıflık.
- **K2 — Süreç ayrımı şimdi yapılmaz.** Denetleyici zaten başsız, beyin zaten
  ayrı süreçte. Ayrım bugün bir sorunu çözmüyor, bir hata alanı ekliyor.
- **K3 — K2'nin tetikleyicileri** (biri olursa ayrılır):
  (a) iki istemci aynı dünyayı aynı anda paylaşmak zorunda kalırsa (ekran +
  fiziksel robot); (b) Orion'un pencere kapalıyken yaşaması istenirse;
  (c) canlı ölçümde atlanan tik > 0 görülürse.
- **K4 — Hafıza host'un sahip olduğu JSON dosyasına taşınır** (`userData`),
  yazım atomik (geçici dosya + yeniden adlandırma). SQLite bu boyutta erken
  ve Electron için yerel derleme ister.
- **K5 — Göç tek seferlik:** önce dosya yazılır ve doğrulanır;
  `localStorage` anahtarı **silinmez** — geri dönüş yolu olarak kalır.
- **K6 — D1 yeniden açılır:** çekirdek mikrodenetleyicide koşmak zorunda
  kalırsa.
- **K7 — Depo arayüzü değişmez** (`oku`/`yaz`); yalnız uygulaması değişir.
  Köprü ne `localStorage` ne dosya sistemi bilir (`bridge/kopru.ts:83`).

## 5. Fazlar

| faz | ne | kapı | durum |
|---|---|---|---|
| 1 | Hafıza → host JSON dosyası (K4, K5, K7) | atomik yazım testi · göç testi · canlı: kayıt sayısı göç öncesi = sonrası | bkz. §6 |
| 2 | Başsız dünya süreci | **yalnız K3 tetikleyicisi gelirse** | beklemede |

## 6. Faz 1 sonuçları (2026-09-19)

**Canlı göç `[ÖLÇÜLDÜ]`** — Ozyn'in gerçek hafızası, `localStorage` önceden
klasör olarak yedeklendi:

| açılış | kaynak | kayıt |
|---|---|---|
| göç öncesi (`localStorage`) | — | 32 |
| 1. açılış | `goc` (yazıldı, yeniden okundu, sayıldı) | **32** |
| 2. açılış | `dosya` | **32** |

Geride `.tmp` ya da bozuk dosya yok. Dosya:
`%APPDATA%\3dorion\orion-hafiza.json` (`ORION_HAFIZA_DOSYASI` ile değişir).

**Parçalar:**
- `host/hafizaDosyasi.js` — atomik yazım (`.tmp` + yeniden adlandırma);
  bozuk dosya **silinmez**, `.bozuk-<zaman>.json` olarak yanına taşınır.
- `mind/hafizaGocu.ts` — saf karar (`depoYukle`); G/Ç dışarıdan gelir,
  arayüzünde **silme yeteneği yok** (K5 yapısal garanti).
- `host/kanallar.cjs` — üç kanal; okuma senkron (`sendSync`) çünkü köprü
  depoyu kurucuda senkron okuyor (K7).
- `world/giris.ts` → `hafizaDeposuKur` — Electron yoksa (`npm run dev`)
  eskisi gibi `localStorage`.

**Düşman testleri önce yazıldı, mutasyonla kanıtlandı** (18 test):
bozuk dosyayı "yok" saymak → 3 test kırmızı; göç doğrulamasını atlamak →
2 test kırmızı. Geri alınınca yeşil.

**Tasarım sırasında yakalanan iki tehlike:**
- **Okuma hatası = veri kaybı.** Main okuma hatasında (izin, kilit) yeni bir
  `"hata"` durumu döndürüyordu ama `depoYukle` onu tanımıyordu → göçe düşüp
  eski `localStorage` verisini **gerçek dosyanın üstüne** yazacaktı. Önce
  testi yazıldı (kırmızı), sonra düzeltildi: `"hata"` dosyaya dokunmaz.
- **Oturum boyu ezme.** `eski-yedek` modunda okuma dosyaya dokunmasa bile
  `yaz()` dosyaya yazsaydı aynı ezme olurdu. Kural: `eski-yedek` oturumunun
  yazımları da `localStorage`a gider.

**Yol boyunca bulunan ölü kopya:** `host/kopru.ts` kendine "TEK KAYNAK"
diyerek `CAGRI`/`OLAY` sabitlerinin ikinci kopyasını tutuyordu; kimse import
etmiyordu. `host/kanallar.cjs` tam da kanal kopyalamanın yol açtığı bir hata
(`sesVarMi` hiç kaydedilmemişti) yüzünden yaratılmıştı. Yeni kanallar
eklenmeden önce silindi — yoksa bir kopyada eksik kalıp kayacaklardı.

**Ölçüm hijyeni — kendi hatam:** 18.09'daki bir canlı testten yetim bir
Electron süreci üç saattir çalışıyordu (`timeout … npm start` Windows'ta
`npm`'i öldürüyor, Electron çocuğunu değil) ve `localStorage` kilidini
tutuyordu. Yedekleme bu yüzden başarısız oldu ve göç o sayede başlamadan
durdu. Canlı koşulardan sonra süreç ağacı artık açıkça kapatılıyor.

629 test yeşil, `tsc` temiz, K4 grep kapısı boş.
