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
