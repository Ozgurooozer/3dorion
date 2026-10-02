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
| `as unknown as` (üretim) | 18 |

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

Her faz ayrı commit; davranış değişmez (yalnız yer değiştirir).

## Sonuçlar

| faz | commit | ne oldu | kanıt |
|---|---|---|---|
| R1 | e8e922d | `tools/mimari.test.ts` bütün depoyu zorlar; tek gerçek ihlal (`mind/akis-olcum.ts`) `tools/`a taşındı | bekçi yeşil + kalibrasyon testleri [TEST] |
| R2 | eedd006 | `bridge/kopruTurleri.ts`, `bridge/eylemSirasi.ts` (+ test); `_dusun` ve `algi` adlı adımlara bölündü. `kopru.ts` 1334 → 1077 satır | köprü testleri değişmeden yeşil [TEST]; canlı `eylemdene` 6/6 [ÖLÇÜLDÜ] |
| R3 | (bu commit) | 23 senaryo `uygulama/senaryolar/<ad>.ts`, bağlam `uygulama/senaryoBaglami.ts` (sonradan atananlar getter). Yalnız URL'de istenen senaryo `import()` edilir; Vite her birini ayrı küçük parça yapar. `giris.ts` ~3060 → 2064 satır | `npm test` 2242/2242 + senaryo listesi bekçisi [TEST]; canlı `eylemdene` 6/6, `tahtadene` 4/4, `benlikdene` 4/4, `apidene` 5/5, `gorudene` 3/3 — hepsi R3 öncesiyle aynı [ÖLÇÜLDÜ] |

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
