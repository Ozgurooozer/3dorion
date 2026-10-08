# docs/ — dizin

Bir spec'i yalnız o alana dokunacaksan aç. Her satır: ne · durum · dokunmadan önce okunacağı yer.
Açık işler tek yerde: `ACIK-ISLER.md`. Fikirler: `FIKIR-HAVUZU.md`. Son güncelleme: 2026-10-08.

## Spec'ler (`specs/`)
| # | konu | durum | ne zaman oku |
|---|---|---|---|
| 01 | Sanal alan: oda, tik, protokol, MVP K1–K12, model seçim kayıtları | bitti | model/parametre değiştirmeden önce (ölçümler burada) |
| 02 | İki loblu beyin: refleks (kural) / düşünce (LLM) | uygulandı | refleks–düşünce sınırına dokunurken |
| 03 | Algı hizmeti + zihin duvarı panelleri | bitti | `mind/algiHizmeti.ts`, duvar |
| 04 | Dış beyin HTTP sözleşmesi (`/saglik`, `/dusun`) | bitti | `bridge/disBeyin.ts`, `tools/claude-beyin.ts` |
| 05 | Devre panosu (S0–S7) + MCP ajanı (Aşama 1–4) | bitti · Aşama 7 (ikinci ajan) açık | pano telleri, `bridge/mcpBeyin.ts` |
| 06 | Beyin v2: durum ≠ anı (K2), zaman etiketi (K3), eşikli getirme (K4/K5), bağlam düzeni (K8), İngilizce çerçeve (§6.8) | bitti | `mind/hafiza.ts`, köprünün bağlam kurulumu |
| 07 | Dünya çekirdeği: dil, süreç, kalıcılık (K1–K7) | Faz 1 bitti · Faz 2 tetikleyiciye bağlı | yeniden yazım / süreç ayırma önermeden önce |
| 08 | Karar kaydı (JSONL) + adlı içgüdüler (`mind/icgudu.ts`) | bitti | kapıya yeni kural = yeni içgüdü kimliği |
| 09 | Öğrenen kapı: Ozyn öğretir, kural hafızası gölgede | 1. adım bitti | `mind/kuralHafizasi.ts`, `tools/ogret.ts` |
| 10 | Beceri refleksi (yetki anahtarı `ORION_BECERI`, varsayılan KAPALI) | A–D bitti · gerçek kullanım haftası açık | LLM'i atlayan her yol |
| 11 | Odanın görünüşü (Blender eşya, kodda işlev) | Faz 0–4 bitti · VRAM farkı ölçülmedi | `assets/`, `world/level/` |
| 12 | Anlık benlik + iki katmanlı hafıza | çekirdek spec 13 Faz 4'te uygulandı · bağlama izdüşüm ve mercek yetkisi açık | `mind/benlik.ts` |
| 13 | Söylediğini yapsın: doğuştan komutlar, API beyni, zihin duvarı | Faz 0–7 bitti · 4 açık madde (ACIK-ISLER) | `mind/komutSozlugu.ts`, `bridge/apiBeyni.ts` |
| 14 | Mimari: ön/arka katmanlar, dev dosyaların bölünmesi (R1–R7) | bitti | katman bekçisi `tools/mimari.test.ts` |
| 15 | Göz ve mekânsal bellek | S1 (nesne kaydı, görünürlük) bitti · S2–S5 Ozyn onayı bekliyor | `world/level/nesneKaydi.ts` |
| 16 | Temiz bağlam: yazma süzgeci, durum defteri, çekmeceler, kural yönlendirici, sohbet kipleri | F0–F5b bitti, canlı ölçüldü · P1 çürüdü (iskele baskın) · F6 araç kırpma ölçüm bekliyor | bağlama ne girdiğine dokunurken |

## Ölçüm ve kayıt belgeleri
| dosya | ne |
|---|---|
| `olcum-soz-siniflandirma.md` | komut sözlüğünün kör set ölçüleri (diğer oturumun) |
| `olcum-goz-ve-mekan-bellegi.md` | spec 15 S1 ölçüleri |
| `olcum-ponytail.md` | ponytail eklentisi denemesi — KALDIRILDI (kopya kod kuralı değil bekçi) |
| `canli-test-2026-10-02.md` | ilk ortak canlı testin bulguları |
| `arastirma/` | dış kaynak notları |

## Bu turun kalıcı davranışları (spec dışı, commit mesajlarında)
- **Kulak:** `3dorion.bat mikrofon` / K aç-kapa, V bas-konuş; Nemotron Speech EN, CPU (`tools/nemotron-dinle.py`, `voice/nemotron.ts`).
- **Uzaktan terminal:** onaylanan komut terminal kapalıysa arka planda açar, kamerayı kaçırmaz (`uygulama/terminalYazici.ts`; canlı `onaydene`).
- **Beni takip et:** içgüdü `kopru.takip` (`mind/takipSozu.ts`, `uygulama/takip.ts`; canlı `3dorion.bat takipdene`).
