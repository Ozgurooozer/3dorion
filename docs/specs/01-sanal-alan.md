# 3dorion — Orion'un Sanal Alanı (Spec v1)

> Karar tarihi: 2026-09-11 · Sahip: Ozyn · Yönetici: Orion (Claude Code)

## Amaç

Orion'a **içinde yaşadığı bir alan** vermek. Oyun değil, sandbox: AI'ın kendi
bedeni, kendi odası ve kendi çalışma masası var. Kullanıcı o odaya girer,
sesle konuşur, ve **Orion'un masasındaki monitörde kendi terminalini açar** —
`claude` yazdığı andan sonra iş akışı terminal üzerinden yürür.

Tek satırlık ürün cümlesi: **"AI'ın oturduğu oda — terminalini onun masasında açıyorsun."**

## Kapsam dışı (bilinçli)

- Oyun mekaniği, skor, hedef, düşman — yok.
- Çok kullanıcılı / ağ — yok.
- Dünya editörü (level editor) — MVP dışı, Faz 2.
- Yerel whisper STT — Faz 2 (8GB VRAM tavanı, bkz. Bütçe).

## Sabitlenmiş kararlar (Ozyn onayı 2026-09-11)

| Karar | Seçim | Gerekçe |
|---|---|---|
| AI özerkliği | **Gerçek araçlar** | Avatar, Orion'un niyetiyle gerçekten hareket eder. İfade süsü değil. |
| Ses | **Web Speech STT + Piper TTS** | VRAM 0 → 8GB'ı Ollama'ya bırakır. |
| Kamera | **3. şahıs varsayılan + `F` ile 1. şahıs** | Beden dili projenin değeri; saf FPS'te görünmez. |
| Repo | **Yeni `~/3dorion`**, molp beyin olarak kullanılır | 17 panel + 19MB renderer mirası taşınmaz. |

Bu kararlar `docs/roadmap/ORION-03` bölüm 3'teki iki eski reddi geçersiz kılar
("sesli arayüz — ambalaj", "Babylon editör — ertelendi"). Gerekçe: amaç arayüz
değil **bedenlenme**; ses ve 3D burada çıktı kanalı değil, dünya erişimi.

## Mimari

```
protocol/      Dünya Protokolü. Bağımlılık YOK. Beyin↔beden tek sözleşme.   [T0 ✓]
world/         Babylon. protocol'e bağımlı, beyinden habersiz.
  engine/      20Hz sabit tick, sahne bootstrap, kamera rig
  level/       oda, props, çapalar (masa/tahta/pencere/sandalye)
  avatar/      VRM + prosedürel yedek, animasyon durum makinesi
  surfaces/    monitör = DynamicTexture terminal; tahta = yazı yüzeyi
  player/      3. şahıs controller + F toggle + E etkileşim
bridge/        protocol ↔ Orion çekirdeği. Tek çift yönlü nokta.
mind/          özerklik: idle ajanda, dikkat filtresi, refleks modeli
voice/         STT (Web Speech) + TTS (Piper)
host/          Electron main: pty, IPC, pencere
```

**Bağımlılık yönü tek yönlüdür:** `world → protocol`, `bridge → protocol`,
`mind → protocol`. `world` asla `bridge`/`mind`/Orion çekirdeğini import etmez.
İhlal = mimari hata, PR reddi.

### Beyin hiyerarşisi (maliyet)

| Katman | Model | İş |
|---|---|---|
| Refleks | `functiongemma:270m` (253MB) | idle, bakış, dikkat terfisi |
| Sohbet | `qwen2.5:7b` (4.7GB) | konuşma, hafif karar |
| Ağır | Claude (terminal üzerinden) | kod, plan, araştırma |

Bu ayrım molp `core/router.ts` tier1/tier2 kararını yeniden kullanır, yeniden yazmaz.

### Bütçe tavanı — RTX 4060, 8GB

Babylon ~1.5GB + qwen2.5:7b ~5GB = ~6.5GB. Whisper'a yer yok → STT tarayıcıda.
Piper CPU'da çalışır, VRAM 0. Dünya tick'i LLM'e gitmez (bkz. `protocol/SOZLESME.md`
iki kanal kuralı) — canlı dünyanın token maliyeti yapısal olarak sıfırdır.

## Ölçülen gerçekler (2026-09-11, bu makinede)

| Ölçüm | Sonuç | Sonucu ne değiştirdi |
|---|---|---|
| Piper 1.2.0 + `tr_TR-dfki-medium` kuruldu | RTF 0.049 (3.5 sn ses / 0.17 sn çıkarım), VRAM 0 | TTS onaylandı |
| Türkçe fonemleştirme | `şeker→ʃekˈɛr`, `ağaç→ˈaːtʃ`, `ılık→ɯɫˈɯk` ✓ | UTF-8 stdin doğru, çeviri katmanı gerekmiyor |
| Süreç başına TTS maliyeti | **1350 ms** (model yükleme dahil) | Cümle başına süreç açmak K3'ü tek başına yiyor |
| Kalıcı süreç TTS | **101–125 ms/cümle**, ilk cümle 462 ms | `host/ses.js` kalıcı süreç + seri kuyruk olarak yazıldı |
| Dünya saati (simülasyon) | 20 Hz, 30 sn'de sapma < %5, atlanan 0 | K1 karşılandı |
| Kabuk canlı | `fps=100.0 hz=19.98 tik=80 atlanan=0 kopru=object` | K1/K2 canlı doğrulandı |
| **Mikrofon aygıtı** | **YOK** — yalnızca çıkış uçları (hoparlör, HDMI, dijital) | STT donanım bekliyor, aşağıya bak |
| Electron Web Speech | API var, `start()` → `not-allowed`, `audioinput` sayısı 0 | Mikrofonsuz ayırt edilemez; karar askıda |
| **ComfyUI boşta VRAM tutuyor** | Kuyruk boş, 19 saat boşta, yine de **2.6 GB** tutuyordu (3839→1241 MiB) | Dünya çalışırken ComfyUI kapalı olmalı — işletim kuralı |

### İşletim kuralı — VRAM tavanı paylaşımı

`/system_stats` içindeki `torch_vram_total` **yanıltıcıdır**: 576 MiB bildirdi,
gerçek tutulan 2.6 GB'tı (modeller ayrı hesapta). Ölçüm için tek güvenilir
kaynak `nvidia-smi`.

Bütçe: Babylon ~1.5 GB + qwen2.5:7b ~5 GB = ~6.5 GB / 8.0 GB. ComfyUI'ın
2.6 GB'ı bu tavanı kırar. Bu yüzden:

- Dünya çalışırken ComfyUI **kapalı** olacak (aynı kartı paylaşıyorlar).
- Görsel üretimi gerekirse: ComfyUI `POST /free {"unload_models":true,"free_memory":true}`
  ile modelleri boşaltabiliyor (HTTP 200, ölçüldü) — ikisi sırayla çalışabilir,
  aynı anda çalışamaz.
- Geri getirme: `C:\ComfyUI\ComfyUI_windows_portable` içinde
  `.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build`

### Ses kararının revizyonu

"Web Speech STT" kararı **askıya alındı** — reddedilmedi. Sebep yazılım değil
donanım: makinede giriş aygıtı yok. Bu yüzden ses girdisi bir **arayüz** olarak
kuruldu (`voice/tip.ts` → `KonusmaKaynagi`):

| Uygulama | Durum |
|---|---|
| `voice/metin-girdi.ts` | ✓ çalışıyor — hattın tamamı bugün uçtan uca test edilebilir |
| `voice/sahte-mikrofon.ts` | ✓ çalışıyor — senaryolu konuşma, ara sonuçlar dahil; mikrofon gelince regresyon testi olarak kalır |
| `voice/web-speech.ts` | **yazılmadı** — canlı doğrulanamayacak kod yazmıyoruz |
| yerel whisper | Faz 2 adayı; mikrofon geldiğinde Web Speech ile karşılaştırmalı ölçülür |

Mikrofon takıldığı gün tek dosya eklenir; `voice/cikis.ts`, avatar ağız senkronu
ve tüm hat değişmez. Orion'un **konuşması** bugün tam çalışıyor; **duyması**
donanım bekliyor.

## MVP — tek dikey dilim

Odaya gir → Orion masada kendi işini yapıyor (idle, yerel refleks modeli) →
sen konuş → **dönüp sana bakar**, sesle cevap verir, jesti metninden doğar →
monitöre yaklaş, `E` → monitör canlı terminal olur → `claude` yaz → Claude Code
çalışır → Orion o sırada kalkıp tahtaya bir şey yazar.

Bu dilim bitmeden hiçbir modül genişletilmez.

### Kabul ölçütleri (hepsi canlı doğrulanacak)

| # | Ölçüt | Nasıl ölçülür |
|---|---|---|
| K1 | Dünya tick'i 20Hz ± %5, 10 dakika boyunca sapma yok | tick sayacı logu |
| K2 | 60 FPS (1080p, RTX 4060), avatar + terminal yüzeyi açıkken | Babylon FPS sayacı |
| K3 | Ses turu (girdi bitişi → TTS başlangıcı) < 1.5 sn | zaman damgalı log — TTS payı ölçüldü: 101-125 ms |
| K4 | `world/` içinde `bridge`/`mind`/molp import'u: **0** | grep denetimi, CI |
| K5 | `tik` algısı beyin kanalına: **0 kez** | protokol testi + çalışma logu |
| K6 | Monitörde `claude` çalışır, çıktı 3D yüzeyde okunur | ekran görüntüsü |
| K7 | Orion'un `git`/`bak`/`yaz` niyetleri avatarı gerçekten hareket ettirir | video |
| K8 | Geçersiz niyet dünyayı çökertmez, hata mesajı çözüm söyler | dogrula testleri ✓ |

## Ticket'lar

| # | Dilim | Bağımlılık | Durum |
|---|---|---|---|
| T0 | Repo + Dünya Protokolü + testler | — | **✓ [TEST] 16/16** |
| T1 | Dünya: tick, oda, çapalar, 3. şahıs kamera + F, E etkileşim | T0 | açık |
| T2 | Avatar: VRM + animasyon durum makinesi, niyet→hareket | T1 | açık |
| T3 | Monitör yüzeyi: xterm → DynamicTexture, pty, `claude` | T0 | açık |
| T4 | Köprü: mesh client, Orion dünya araçları, algı geri akışı | T0,T2 | açık |
| T5 | Ses: Piper kurulum + TTS hattı + takılabilir girdi | T0 | **kısmen ✓** — TTS [TEST], STT mikrofon bekliyor |
| T6 | Zihin: idle ajanda + dikkat filtresi + refleks | T4 | açık |
| T7 | Demo (40sn çekim), design canvas, README, pazarlama | T1-T6 | açık |

## Kanıt kuralı

molp kültüründen devralındı. `[TEST]` = canlı koşturuldu, gerçek çıktı var.
`[YAZILDI-KOŞULMADI]` = derlendi ama koşturulmadı. Birim testi geçmek "bitti"
demek için **yetmez**; uçtan uca gösterilmesi gerekir.

## Yeniden kullanılan varlıklar (molp)

| Varlık | Yol | Kullanım |
|---|---|---|
| Ofis sahnesi, FPS kamera | `electron/Terminal/scene/SceneManager.ts` (1141 sat.) | T1 referans, damıtılacak |
| VRM yükleyici + prosedürel avatar | `Terminal/scene/{VRMLoader,ProceduralAvatar}.ts` | T2 |
| Karakter asset'i | `electron/assets/orion.vrm` | T2 |
| xterm renderer + pty sağlayıcı | `Terminal/renderer/TerminalRenderer.ts`, `terminals/pty-provider.js` | T3 |
| POZ/JEST stream ayrıştırıcı | `core/sahne.ts` | T4 |
| Ajan busı + `SAHNE` mesaj türü | `core/mesh/*` | T4 |
| Piper TTS sarmalayıcı | `core/agents/voice.ts` | T5 |
| tier1/tier2 router | `core/router.ts` | T6 |
