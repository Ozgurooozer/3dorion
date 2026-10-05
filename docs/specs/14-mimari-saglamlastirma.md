# 14 — Mimari sağlamlaştırma: ön/arka katmanlar, dev dosyaların bölünmesi (2026-10-02)

**Durum:** Ozyn istedi ("kod kalitesi ve mimari çok kötü olmuş … front back gibi kategorilerine ayır,
sağlamlaştır"), iki kararı verdi (aşağıda). Uygulanıyor.

## Teşhis [ÖLÇÜLDÜ, 2026-10-02]

Araç: `graphify update` (5277 düğüm, 12224 kenar, döngüsel import YOK) + katman import matrisi + satır sayımı.

| ölçüm | sonuç |
|---|---|
| Katman yönü | Sağlam. `world → bridge/mind` yalnız `world/giris.ts`te (belgelenmiş kompozisyon kökü). Tek gerçek ihlal: `mind/akis-olcum.ts` (bir ölçüm betiği) `world/surfaces`'ı import ediyor. |
| `world/giris.ts` | 3184 satır: 23 `?xxxdene` senaryo bloğu (~1000 satır), 22 kopya `bekle`, 7 kopya `kontrol`, 21 modül düzeyi `let`, 69 import; beyin bağlama, niyet yürütme, zihin duvarı, monitör, onay, sohbet aynı dosyada. |
| `bridge/kopru.ts` | 1334 satır; `_dusun` 269, `algi` 178 satır. Kapı, eylem sırası, doğuştan programlar, beceri refleksi, benlik, iç ses, söz-eylem tek sınıfta (spec 13 fazları büyüttü). |
| `as unknown as` (üretim) | 18 (R5 sonrası 3, bekçili: `tools/tipKacisi.test.ts`) |
| **R7 sonrası (2026-10-03)** | `giris.ts` 3184 → 1580, `kopru.ts` 1334 → 1021; import döngüsü 0 (150 üretim dosyası, değer ve tip import'ları, doğrudan kaynak taraması); `graphify update`: 5529 düğüm, 12903 kenar |

## Kararlar (Ozyn, 2026-10-02)

| soru | karar |
|---|---|
| Ön/arka ayrımı | **Klasörler kalır, içleri bölünür.** Bugünkü katmanlar zaten ön/arka: aşağıdaki tablo. |
| Avatar oturumunun çalışması | **Onların bölgesine dokunulmaz:** `world/avatar/*` ve `giris.ts`'teki `avatarKur` bloğu yerinde kalır. |

## Katmanlar — ön, arka, ortak, kabuk

| kategori | klasör | ne | kimi import edebilir |
|---|---|---|---|
| **ORTAK** (sözleşme) | `protocol/` | niyet, algı, doğrulama, pano tipleri | hiç kimseyi |
| **ÖN** (görünen) | `world/`, `voice/` | sahne, yüzeyler, arayüz, oyuncu, ses | yalnız `protocol/` |
| **ARKA** (beyin) | `mind/`, `bridge/` | karar mekanizması, hafıza, beyin sağlayıcıları | `protocol/`; `bridge/` ayrıca `mind/` |
| **KABUK** (Electron ana süreç) | `host/` | pty, IPC, dosyalar, anahtar deposu | yalnız `host/` (+ `mind/`'den YALNIZ tip) |
| **UYGULAMA** (kompozisyon) | `world/giris.ts` + `uygulama/` | ön ile arkayı bağlar | herkesi |
| araçlar | `tools/` | ölçüm ve bakım betikleri | herkesi |

Bekçi: `mimari.test.ts` bu tabloyu bütün depo için zorlar (bugün yalnız `world/` için var).

## Fazlar

| faz | ne | kapı |
|---|---|---|
| R1 | Katman bekçisi (`mimari.test.ts`); `mind/akis-olcum.ts` → `tools/`; `docs/MIMARI.md` | bekçi yeşil, bozma denemesi |
| R2 | `bridge/kopru.ts` bölünür: `bridge/kopru/` altında eylem sırası, tur çıktısı işleme, program yürütme; `Kopru` cephe olarak kalır, API değişmez | bütün köprü testleri değişmeden yeşil |
| R3 | Senaryolar `giris.ts`'ten `uygulama/senaryolar/`e: her biri ayrı dosya, ortak `bekle`/`kontrol`, yalnız URL'de istenince dinamik import (paket boyutu) | tsc + test; canlı `tahtadene`, `eylemdene`, `benlikdene`, `apidene`, `gorudene` aynı skor |
| R4 | `giris.ts`'ten niyet yürütücü ve zihin duvarı bağlantısı `uygulama/`ya | aynı canlı senaryolar |
| R5 | `as unknown as` gözden geçirilir; gereksiz olanlar tipli hâle | tsc |
| R6 | `beyniBagla`'nın beyin seçimi (seçenekler, başlangıç, Ollama/OpenCode/API taramaları, hatırlanan seçim, kayıt sarmalı, devre kesici) ve M seçicinin kaynağı → `uygulama/beyinSecimi.ts`. `location`, `localStorage`, `window.kopru` ve taramalar bağlamla verilir; sahteyle test edilir | tsc + test (hatırlanan seçim YALNIZ taramalardan sonra ve yalnız elle açılışta); canlı `apidene` 5/5, `eylemdene` 6/6, `gorudene` 3/3 |
| R7 | Komut programları ve beceri refleksi `bridge/kopru.ts`'ten ayrılır. **Sözlük genişletmesi (diğer oturum) commit'lenmeden başlamaz:** aynı bağlantı noktasına dokunur (d7079c5 + ce9cc44 ile commit'lendi, R7 sonra başladı) | köprü testleri değişmeden yeşil; `eylemdene` 6/6 |

Her faz ayrı commit; davranış değişmez (yalnız yer değiştirir).

## Sonuçlar

| faz | commit | ne oldu | kanıt |
|---|---|---|---|
| R1 | e8e922d | `tools/mimari.test.ts` bütün depoyu zorlar; tek gerçek ihlal (`mind/akis-olcum.ts`) `tools/`a taşındı | bekçi yeşil + kalibrasyon testleri [TEST] |
| R2 | eedd006 | `bridge/kopruTurleri.ts`, `bridge/eylemSirasi.ts` (+ test); `_dusun` ve `algi` adlı adımlara bölündü. `kopru.ts` 1334 → 1077 satır | köprü testleri değişmeden yeşil [TEST]; canlı `eylemdene` 6/6 [ÖLÇÜLDÜ] |
| R3 | cf58580 | 23 senaryo `uygulama/senaryolar/<ad>.ts`, bağlam `uygulama/senaryoBaglami.ts` (sonradan atananlar getter). Yalnız URL'de istenen senaryo `import()` edilir; Vite her birini ayrı küçük parça yapar. `giris.ts` ~3060 → 2064 satır | `npm test` 2242/2242 + senaryo listesi bekçisi [TEST]; canlı `eylemdene` 6/6, `tahtadene` 4/4, `benlikdene` 4/4, `apidene` 5/5, `gorudene` 3/3 — hepsi R3 öncesiyle aynı [ÖLÇÜLDÜ] |

| R4 | 2d87a8a | Niyet yürütücü (`niyetiYurut`, `tahtayaYaz`, `odaklanYurut`, `bedenAdimi`) → `uygulama/niyetYurutucu.ts`; zihin duvarı bağlantısı (karar kaydı → günlük, canlı satır, kesik sayacı, hafıza bulutu, aşama/iç ses/söz-eylem dinleyicileri) → `uygulama/zihinDuvari.ts`. İkisi de bağımlılığını bağlamla alır. `giris.ts` 2064 → 1867 satır | yürütücü için 16 yeni test, sahte dünya ile (önceden yalnız canlıda sınanabiliyordu); 3 bozma denemesinin 3'ü yakalandı (yedekli). Duvar için 6 test. `npm test` 2269/2269 [TEST]; canlı `eylemdene` 6/6, `tahtadene` 4/4, `benlikdene` 4/4, `apidene` 5/5, `gorudene` 3/3 — R4 öncesiyle aynı [ÖLÇÜLDÜ] |
| R5 | cf0e5bf | `window` kancaları (`dunya`, `orionModel`, `orionPano`, `orionSes`, `_davranisKayit`, `_goruKanca`) tek tip tanımında: `uygulama/pencereKancalari.ts` (`host/kopru.ts`'in `window.kopru` kalıbı). Dört yüzeyin `getContext` dönüşümü `tuval2d` (world/surfaces/yuzey.ts). Üretimde `as unknown as` 18 → 3; kalan üçü gerekçeli izin listesinde | bekçi `tools/tipKacisi.test.ts` (geçici kaçış dosyası eklendi → yakaladı); `npm test` 2271/2271 [TEST]; kancaları kullanan senaryolar canlı: `gorudene` 3/3, `sessizdene` 2/2 (anlık 0 terfi, uzun ≥1), `apidene` 5/5, `eylemdene` 6/6 [ÖLÇÜLDÜ] |
| R6 | 3f572e7 | Beyin seçimi (seçenekler, açılış beyni, üç tarama, hatırlanan seçim, kayıt sarmalı, devre kesici) ve M seçicinin kaynağı + `window.orionModel` → `uygulama/beyinSecimi.ts`; `location`/`localStorage`/`window.kopru`/taramalar bağlamla. `giris.ts` 1869 → 1580 satır, `beyniBagla` 620 → 287 satır | 15 yeni test (sahte tarama, depo, pano); 4 bozmanın 4'ü yakalandı — biri ilk denemede KAÇTI (aşağıda). `npm test` 2286/2286 [TEST]; canlı `apidene` 5/5, `eylemdene` 6/6, `gorudene` 3/3; `zihindene` (120 sn pencereyle) AYNA, S5, S6, SECICI-GECIS GECTI, SECICI-RED KALDI — R6 dışı, aşağıda [ÖLÇÜLDÜ] |
| R7 | 6b49d35 | Beceri refleksinin durum makinesi (başlat → adım → sonuç → bitir, zaman aşımı) → `bridge/beceriRefleksi.ts` (`EylemSirasi` deseni; köprüye bağı gönderim, kayıt satırı, LLM'e geri verme). Doğuştan programın saf planı (doğrula, kimlik ver, kayıt niyetleri, geçmiş çağrıları) → `bridge/komutProgrami.ts`. Sözün kayda/anıya yazılması, onay jesti, eylem sırası köprüde kaldı. `kopru.ts` 1077 → 1021 | köprü testleri DEĞİŞMEDEN 172/172; yeni 22 test; 5 bozmanın 5'i yakalandı (yedekli). `npm test` 2322/2322 [TEST]; canlı `eylemdene` 6/6 (6 söz, 6 program satırı, LLM uyanmadı), `benlikdene` 4/4; `becerdene` YETKİ AÇIK (`ORION_BECERI=1`): 1. söz LLM, 2.–3. refleks (uyanış +0, `basari`, 2,0/2,4 sn — spec 10 B14 ile aynı), karar kaydında 2 refleks satırı [ÖLÇÜLDÜ] |

R3 notları:
- Taşıma bir betikle yapıldı. Gövde aynı; yalnız giris'in değişkenleri `d.` ile okunuyor. Betiğin ilk sürümü
  `orion`/`kopru` adlarını dize ve yorumların içinde de değiştirmişti (`"api:ozel/sahte/d.orion-test"`).
  tsc bunu yakalamaz, çünkü dize geçerli kalır. Bu yüzden yeniden adlandırma yalnız kod parçalarına
  uygulanıp yeniden koşuldu.
- Bağlam dosyası önce `senaryolar/` içindeydi. Vite'ın değişkenli `import()` kalıbı onu ve testini
  (`node:fs`) de pakete almaya çalıştı. Bu yüzden klasörde yalnız senaryolar durur.
- Senaryonun `void (async …)` öncesindeki senkron satırları (ör. `tezdene`'nin `beyinDokum` ayarı) artık
  dinamik import çözülünce koşuyor, yani giris'in sonunda. Beyin avatar yüklendikten sonra kurulduğu için
  sıra değişmiyor; yine de not edildi.
- Ortak `bekle`/`kontrol` yardımcısı YAPILMADI: 22 kopya `bekle` tek satır, her senaryonun `kontrol`ü farklı
  rapor biçiminde. Birleştirme davranış değişikliği olurdu; bu faz yalnız yer değiştirir.

R4 notları:
- `niyetiYurut` eskiden hoisted bir `function` idi. Artık `niyetYurutucusuKur(...)`'dan dönen bir `const`.
  Modül değerlendirilirken onu çağıran kod yok (çağıranların hepsi olay/geri çağrı içinde). Bu yüzden
  TDZ riski yok; tsc de kullanım-öncesi-tanım hatası vermedi.
- `hafizaBagla` artık köprüden önce çağrılıyor (eskiden pano kurulduktan sonra). Yalnız kaynak
  fonksiyonu atadığı ve köprü yokken `[]` döndüğü için sıra fark etmez (test: "köprü yokken hafıza
  bulutu boş").
- `beyniBagla` hâlâ ~450 satır: beyin seçimi + üç katalog taraması + model seçici kaynağı. Bunlar
  R4'ün kapsamında değildi. R6 ile ayrıldı.

R6 notları:
- **Kaçan bozma ve sebebi:** "hatırlanan seçim taramalardan SONRA istenir" kuralını bozan mutant
  (`ilkTarama.then` → `Promise.resolve().then`) ilk test sürümünde yakalanmadı. Sahte taramalar hemen
  çözülüyordu; mikro-görev sırası yüzünden "hemen" ile "taramadan sonra" aynı sonucu veriyordu.
  Gerçek tarama ağdır ve zaman alır. Sahteye 5 ms gecikme verildi, mutant artık yakalanıyor. Ders:
  zamanlama kuralı sınanıyorsa sahte, gerçeğin zamansal şeklini taşımalı.
- `ilkTarama` (üç taramanın `Promise.all`'u) artık her açılışta kuruluyor; eskiden yalnız hatırlanan seçim
  varken kuruluyordu. Yan etkisi yok: taramalar zaten koşuyordu, yalnız birleşimleri tutuluyor
  (`hazir`, testler için; hata yutulur).
- **`zihindene` iki R6-dışı bulgu — 2026-10-05'te DÜZELTİLDİ** (`3dorion.bat zihindene`: 120 sn pencere ve
  `ORION_BEYIN_ADRES=http://127.0.0.1:9`, böylece `dis` belirlenimli olarak kapalı; canlı koşuda AYNA, S5, S6,
  SECICI-RED, SECICI-GECIS hepsi GECTI [ÖLÇÜLDÜ]; `3dorion.bat` başlığına `http://` şartı yazıldı):
  1. `3dorion.bat zihindene` 30 sn'lik duman penceresinde S5'e varamadan kapanıyor. S5/S6 ekranı her 3 pikselde
     `sahne.pick` ile eşzamanlı tarıyor. 120 sn'lik pencereyle (`ORION_SMOKE_MS=120000`, bat değiştirilmeden)
     sonuna kadar koştu.
  2. SECICI-RED KALDI: senaryo `dis` beyninin "dış beyin yok" diye reddedilmesini bekliyor. Ama `host/main.js`
     Claude adaptörünü 4700'de başlatıyor (Haiku varsayılan, 2026-09-28) ve `dis`'in varsayılan adresi de
     4700. Electron açıkken `dis` = Haiku adaptörü, sağlık kontrolü geçiyor. Beklenti adaptör taşındığından
     beri bayat. Seçenek listesi R6'da aynen taşındı.
- (R6 bitti.) Gözlem (düzeltilmedi, kapsam dışı): `OllamaBeyni.hazirMi` hata yolunda 2,5 sn'lik iptal zamanlayıcısını
  temizlemiyor (bridge/ollama.ts). Zararsız ama test süresine 2,5 sn ekliyor.

R7 notları:
- **Neden `_programYurut` tümüyle taşınmadı:** gövdesinin çoğu köprünün iç durumuna yazar: kayıt, anı,
  dikkat sıfırlama, sayaç, konuşma geçmişi, onay jesti, eylem sırası. Tümünü taşımak 9 alanlık bir bağlam
  arayüzü isterdi ve test edilebilir yeni bir şey kazandırmazdı. Saf kısım (plan) ayrıldı ve testli.
- **Birebir davranış inceliği:** eski döngü geçersiz bir adıma gelmeden ÖNCEKİ geçerli adımları konuşma
  geçmişine yazıyordu, sonra duruyordu. Plan bu öneki `cagrilar`da taşır, köprü onları yine yazar
  (test: "geçersiz adımda yalnız ÖNCEKİ geçerli adımların çağrısı kalır").
- **Kapanış:** eski `_refleksBitir` `_durduruldu` ise LLM'e geri vermiyordu. Bu kontrol köprüde,
  `_refleksiGeriAl`'ın başında; sınıf köprünün durumunu bilmez.
- **Gölge kipteki `becerdene`:** 2. söz ("sandalyeye git") LLM'e gitti ve ornith-32k Orion'u yürütmedi
  (konum değişmedi). Yetki kapalıyken refleks yolu koşmaz; bu modelin seçimidir, R7'nin kodu değil.
  Aynı söz yetki açıkken refleksle doğru yürüdü.
- `SurenRefleks` tipi `kopruTurleri.ts`'ten sınıfın içine taşındı; dışarıdan kullanan yoktu.
