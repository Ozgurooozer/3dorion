# docs/ — dizin

Bir spec'i yalnız o alana dokunacaksan aç. Her satır: ne · durum · dokunmadan önce okunacağı yer.
Açık işler tek yerde: `ACIK-ISLER.md`. Fikirler: `FIKIR-HAVUZU.md`. Son güncelleme: 2026-10-13.

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
| 17 | Ova: yeni level (lowpoly, çim, gök, Blender arazi) + level ALTYAPISI (veri tanımı, modüller, ışık sistemi, panel) | MVP L0–L4 bitti, bütçe B1–B4 geçti | `world/level/{cekirdek,moduller,editor,ova}/`, yeni katman/level eklerken |
| 20 | Özel shader'lar ("Sistem Hatası"): gün/gece paleti shader'da, zaman kırığı, hata imzası, debug taraması, fırça, elyazması; 4 dünya paleti | uygulandı · debug taraması çizim ön kaydını aştı | `world/level/shader/`, yeni shader eklerken |
| 21 | Yaşayan dünya: kavisli çim (hücre + LOD, 500 bin tutam), gün/gece parçacıkları, göl + su shader'ı, atmosfer eklentisi, serbest uçuş | uygulandı | `world/level/moduller/{cim,su,parcacik}.ts`, `shader/moduller/atmosfer.ts` |
| 22 | Level editörü: kimlikli yerleşim, 3 eksen, gruplar; saf çekirdek (geri/ileri al, komutlar, tek tuş haritası); gizmo, yüzeyde sürükle/çatıya koy, kutu seçimi, fırça, güneş, ölçü, hazır yapı; sahne ağacı, özellikler, varlık tarayıcısı v2; örnekleme düzeltmesi (1106 → 106 çizim); arazi araçları (Unreal karşılıkları, bölgesel güncelleme, damga 22 ms) | Faz 1–7 bitti | `world/level/editor/`, yerleşim/editör/kısayola dokunurken; deneme `npm run editor-dene` |
| 23 | Level yönetimi (aç / yeni / şablon / farklı kaydet, `editor.html?level=`), depo katmanı (host/levelDosyasi.js ↔ world/level/depo), çökme kurtarması, kamera açıları veride; Orion için anlam (protokol eylem sözlüğü, anlam.json, Orion'un gözü O); sonra düzenleme niyeti | Faz A, B bitti · C (spec 24) / D tasarım | level dosyalarına, editörün kaydetmesine, `host/levelDosyasi.js`e dokunurken |
| 24 | Ofisin kapısından ovaya: `Yer` soyutlaması (aktör başına yer: çarpışma, yol bulma, çapalar, algı), ova yeri, kararmalı kapı geçişi, Orion'un `gec` niyeti; C0 ölçümü (gizli tut ✗ / her çıkışta kur ✓) | C0 ölçüldü, C1–C3 bitti (`3dorion.bat kapidene`) | `world/yer/`, yol bulmaya / çarpışmaya / çapalara / `giris.ts` yerine dokunurken |
| 26 | Orion'u prototipten çıkarmak: ölçüm tezgâhı, harness (uyanış politikası, araç şeması %66, İngilizce iç dil), terminal, hafıza (ne saklanır → dosya/vektör A/B), ova yetenekleri | F0–F3 + Beyin Ofisi (§10) + mimari düzeltme (§11) YAPILDI · açık: terminal oku, 1 hafta kullanım | Orion beyni/harness/hafıza/terminal işine başlamadan önce; kendiliğinden uyanış/özerk tur: §10–§11 |
| 25 | Orion gerçekten görsün: Orion'un gözü (baş kamerası, kare + geometrik gerçek), yerel görme modelleri gemma4 e2b/e4b, V0 ön kayıtlı deney (22 kare) | V0 (yanlış soru) · Faz 1 ALGI (NPC) + Faz 2 GÖRME (`sor gor`, canlıda çalıştı) bitti · V1 ölçümü koşulmadı · ARKA PLANDA | `world/avatar/goz.ts`, `tools/goz-olc.ts`; görmeye, Orion'un algısına görüntü eklerken |
| 19 | Işık sonrası (bloom, huzme, AO, eğri…), küresel aydınlatma (GIRSM), sağlam gölge (CSM ayarları) | bitti · VRAM ön kaydı 3 önayarda aştı (karar bekliyor) | ışık/gölge/sonrası işlemeye dokunurken |
| 18 | Stil shader'ları: cel, toon, anime90, Moebius, piksel (t3ssel8r); G/panel geçiş | S0–S5 bitti, bütçe geçti · kendi stilimiz Ozyn'in seçimini bekliyor | `world/level/stil/`, malzeme/ışık görünüşüne dokunurken |

## Ölçüm ve kayıt belgeleri
| dosya | ne |
|---|---|
| `olcum-soz-siniflandirma.md` | komut sözlüğünün kör set ölçüleri (diğer oturumun) |
| `olcum-goz-ve-mekan-bellegi.md` | spec 15 S1 ölçüleri |
| `olcum-ponytail.md` | ponytail eklentisi denemesi — KALDIRILDI (kopya kod kuralı değil bekçi) |
| `canli-test-2026-10-02.md` | ilk ortak canlı testin bulguları |
| `arastirma/` | dış kaynak notları (`stil-shaderlari.md`: toon/cel/çizgi/piksel teknikleri) |

## Bu turun kalıcı davranışları (spec dışı, commit mesajlarında)
- **Kulak:** `3dorion.bat mikrofon` / K aç-kapa, V bas-konuş; Nemotron Speech EN, CPU (`tools/nemotron-dinle.py`, `voice/nemotron.ts`).
- **Uzaktan terminal:** onaylanan komut terminal kapalıysa arka planda açar, kamerayı kaçırmaz (`uygulama/terminalYazici.ts`; canlı `onaydene`).
- **Varlık kataloğu:** şehir kiti `assets/sehir/` (86 glb + önizleme + katalog; kaynak Masaüstü
  "city build test moduler 1.blend", betik `assets/kaynak/sehir-kiti.py`); yerleşimler `tanim.nesneler`
  (`world/level/cekirdek/nesneSistemi.ts`); editör spec 22.
- **Beni takip et:** içgüdü `kopru.takip` (`mind/takipSozu.ts`, `uygulama/takip.ts`; canlı `3dorion.bat takipdene`).
