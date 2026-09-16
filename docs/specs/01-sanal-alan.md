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
| Refleks | ~~`functiongemma:270m`~~ → **kural tabanlı** | ölçümde model elendi (31/31 bozuk JSON), bkz. karar kaydı |
| Sohbet | `qwen2.5:7b` (4.7GB) | konuşma, hafif karar — 4 aday ölçüldü, bkz. model seçimi karar kaydı |
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

## Karar kaydı — 3D yüzeyde terminal (T3, ölçümle)

Projenin en riskli bilinmeyeni iki adayla prototiplendi ve ölçüldü:

| Ölçüt | Aday A (doku) | Aday B (CSS matrix3d) |
|---|---|---|
| Girdi gecikmesi (medyan) | 19.8 ms | 19.9 ms |
| FPS | 100 | 100 |
| Okunabilirlik @1.5 m | okunur | **daha keskin** (gerçek DOM metni) |
| 30° açı | bozulmuyor | bozulmuyor |
| **Derinlik** | **doğru — önündeki nesne terminali kapatır** | **yok — terminal dünyanın üstünde yüzer** |

Gecikme, FPS ve açıda iki aday **ayırt edilemez**. Kararı derinlik verdi:
CSS bindirme WebGL tuvalinin üstünde bir DOM katmanıdır, derinlik testi yoktur.
Bu projede oyuncu odada dolaşıyor ve Orion monitörün önünden geçiyor — terminalin
onun üstüne binmesi kabul edilemez. **Aday A seçildi.**

Kanıt: `world/surfaces/t3-derinlik-{A,B}.png` (aynı engel, A'da kapatıyor,
B'de yok sayılıyor), `t3-{A,B}-{1.5m,30deg}.png`.

Uygulama notu: brifte varsayılan "xterm'in canvas'ını dokuya kopyala" yolu
geçersiz çıktı — `@xterm/xterm` 6 çekirdeği DOM renderer ile geliyor, kopyalanacak
canvas üretmiyor. Bunun yerine xterm yalnızca VT durum makinesi olarak koşuyor,
hücre ızgarası doğrudan `DynamicTexture` bağlamına boyanıyor. Ara canvas yok.

## Karar kaydı — T6 zihin katmanı (ajanda + refleks)

Araştırma notuyla (bkz. "Bedenlenme Notları" artifact) doğrulanan Generative
Agents / PIANO bulguları ışığında T6 iki ayrı sorumluluğa bölündü:

- `mind/ajanda.ts` — **boşta ajanda.** `world/avatar/bosta.ts` kasıtlı olarak
  karar vermiyor (yalnızca mikro-hareket); ajanda o boşluğu dolduran karar
  katmanı. Saf, determinist (bosta.ts'teki `sapma()` tekniğiyle aynı), beyin
  meşgulken asla araya girmez. **[TEST] canlı**: `ORION_SMOKE=1` koşusunda
  `[NIYET] ajanda_...→ bitti` gerçek logda görüldü (2026-09-12).
- `mind/refleks.ts` — **terfi kararı.** İki aday ölçüldü (`mind/refleks-olcum.ts`).

Kasıtlı olarak yapılMADI: uzun-vadeli hafıza (Generative Agents'ın
recency/importance/relevance skorlaması). Spec'in T6 tanımı yalnızca
"idle ajanda + dikkat + refleks"; hafıza `gecmisSiniri=12` sabit pencere
olarak kaldı. Araştırma notunda bu açıkça bir sonraki somut adım olarak
işaretli, ayrı bir karar/dilim gerektirir — burada sessizce genişletilmedi.

## Karar kaydı — refleks modeli ELENDİ (ölçümle, 2026-09-12)

Spec satır 58 "Refleks = `functiongemma:270m`" diyordu. Bu bir **varsayımdı**;
hatta bağlanmadan önce ölçüldü ve **çürütüldü**.

| Ölçüt | Aday A (kural) | Aday B (functiongemma-270m) |
|---|---|---|
| Geçerli JSON yanıt | — | **0/31** (hepsi bozuk) |
| Bilgi katkısı | — | **sıfır** — "her şeyi terfi ettir" ile birebir aynı |
| Gecikme (ortanca / azami) | 0.0 ms | 120 ms / **13 817 ms** |

Model formatı hiç tutturamadı: girdiyi tekrarladı, kendi sistem promptunu geri
kustu, bir durumda aynı satırı onlarca kez basıp 13.8 sn sayıkladı. %52'lik
görünen "doğruluğu" tamamen güvenli-varsayılanın (`terfi:true`) eseriydi.
**Karar: aday A (kural tabanlı) üretime alındı, B reddedildi.** Sınıf
(`OllamaRefleks`) silinmedi — reddin kanıtı olarak duruyor, T3'teki
`css-bindirme.ts` ile aynı gerekçe.

### Asıl birim parça değil, KOMUT (ölçümle bulundu)

İlk kural süzgeci uydurma bir kümede %100 aldı — ama sınavı da cevap
anahtarını da aynı kişi yazmıştı. **Gerçek** yakalanmış terminal çıktısında
(`mind/akis-olcum.ts`, 13 gerçek komut) tablo değişti: tek bir `npm test`
koşusu beyni **11 kez** uyandırdı, çünkü testlerin ADLARI içinde "hata"
kelimesi geçiyor. Süzgeç, hata *anlatan* bir başlığı hata *olan* bir olaydan
ayıramıyordu.

Çözüm sözcüksel değil yapısal oldu: `world/surfaces/ciktiToplayici.ts` —
çıktı akarken sus, akış ~800 ms durunca **tek blok** gönder. Bir test başlığı
bunu kandıramaz; sessizlik metinden bağımsızdır.

| | parça başına karar | sessizlikte toplama |
|---|---|---|
| 13 gerçek komutta toplam uyandırma | 18 | **8** (ideal 8) |
| hedefi tutturan | 7/13 | **13/13** |

## Karar kaydı — davranış ölçümü (T6c, 18 canlı koşu)

"Hat çalışıyor" ile "davranış iyi" aynı şey değil. Algı borusu bağlandıktan
sonra sayaçlar yeşildi ama Orion gerçek bir kabuk hatasını görüp **hiçbir şey
söylemiyordu**. `world/davranisDenemesi.ts` bunu ölçer: her senaryoda ne
söyledi, hangi niyetleri üretti, kaç saniyede — ve nesnel kusurları işaretler
(sessizlik, araçsız düz metin, konudan sapma, gevezelik, yanlış atıf).

Tek koşu kanıt değildir: model rastgeledir, aynı senaryo koşudan koşuya
değişir. Her değişiklik **üçer koşuyla** ölçüldü.

| Düzeltme | Selama cevap | Hatada konuya değinme | Rutinde susma |
|---|---|---|---|
| başlangıç | 1/3 | 2/3 | 3/3 |
| + talimat (monitör/terminal anlatıldı) | 3/3 | 1/3 | 3/3 |
| + çapa listesi sistem mesajına taşındı | 3/3 | 3/3 | 3/3 |
| + sıcaklık 0.6→0.3 | 3/3 | 3/3 | 3/3 |
| + atıf algıya kondu | 3/3 | 3/3 | **2/3 ← gerileme** |
| + süzgeç türle çalışır (gerileme giderildi) | 3/3 | 3/3 | 3/3 |

Yol boyunca bulunan ve düzeltilen GERÇEK hatalar:

1. **`soyle` iki yere gidiyordu.** Köprü onu hem ses hattına hem avatara
   veriyordu; avatar "benim işim değil" diye reddedince Orion'a *"konuşman
   başarısız oldu"* diye geri besleniyordu. Yönlendirme kompozisyon köküne
   alındı.
2. **Düz metin sessizce yutuluyordu.** Model 3/3 koşuda terminal olayında
   `dunya_soyle` çağırmadı; doğru teşhisi düz metin olarak yazdı ve kullanıcı
   mutlak sessizlik duydu. Kural daraltıldı: araç ÇAĞRILDIYSA metin hâlâ
   duyulmaz (eyleme eşlik eden iç ses), HİÇ araç yoksa konuşmaya çevrilir.
   Bu, testi olan bilinçli bir kural değişikliğidir — sessizce yapılmadı.
3. **Çapa listesi her tur tekrarlanıyordu** ve model onu son algı sanıp geri
   okuyordu (terminal hatası sorulunca odadaki eşyaları saydı). Sabit bilgi
   sistem mesajına taşındı.
4. **Atıf eksikti.** Orion komutu KENDİSİNİN yazdığını sanıyordu (3/3).
   `ozetle()` artık "Ozyn'in terminalinde (masandaki ekran)" diyor — tıpkı
   `duydum` için "Ozyn dedi:" dediği gibi. Yanlış atıf 3/3 → 0/3.
5. **Süzgeç düzyazı önekine bağlıydı.** (4) numaralı iyileştirme öneki
   değiştirince süzgeç terminali tanıyamadı ve rutin dizin listesini beyne
   geçirdi. Artık algı TÜRÜ geçiriliyor; düzyazı bir arayüz değildir.

**Kalan bilinen kusur:** gevezelik (2/3 koşuda cevap 180 karakteri aşıyor,
"en fazla iki cümle" talimatına rağmen) ve Türkçe akıcılığı zayıf
("İlerideyim, Ozyn"). Bu bir talimat sorunu değil, `qwen2.5:7b` sınırı gibi
görünüyor. Ölçüm düzeneği artık hazır: model değişimi (`ornith-32k`,
`Qwythos-9B`) aynı üç senaryoyla kıyaslanabilir. **Ölçülmeden değiştirilmedi.**

### Hangi BAŞARI söylenmeye değer? (ölçüt: Ozyn bekledi mi)

Çıkış kodu gelince yeni bir soru doğdu: başarılı komutlar da bildirilsin mi?
Hepsi bildirilirse `cd` bile beyin uyandırır. Ölçüt "Ozyn bekledi mi":
uzun süren bir işin bitmesi beklenen bir andır, anlık olanınki değil.

Süre ölçümü Enter tuşundan (`
` pty'ye giderken) `D` işaretine kadar.
OSC 133 `C` işareti bu entegrasyonda yayılmıyor; `B` ise istem gösterilince
gelir ve YAZMA süresini de içerir — ikisi de kullanılmadı.

Eşik GERÇEKTEN ölçülerek seçildi (bu makine):

| Komut | Süre | Karar |
|---|---|---|
| `dir` | 47 ms | bildirilmez |
| `tsc --noEmit` | 1178 ms | bildirilir — üstelik BAŞARIDA HİÇ ÇIKTI YAZMAZ |
| `npm test` | 2859 ms | bildirilir |

**Kendi hatam, kayda geçsin:** eşiği önce 3000 ms yazmış ve yorumda
"`tsc` ~8 sn (ölçüldü)" demiştim. Ölçmeden yazılmıştı ve yanlıştı — gerçek
1178 ms. 3000 ms hem `tsc`'yi hem `npm test`'i elerdi, yani çözmek istediğim
sorunu çözmezdi. `UZUN_ISLEM_MS = 1000`.

Canlı kanıt (`3dorion.bat sessizdene`):
```
anlik sessiz komut ($null = 1)          -> terfi=0  ✓
Start-Sleep 1600ms  -> kod=0 sure=1671ms -> terfi=1 "uzun iş başarıyla bitti (1.7 sn)"
```

**Dürüst sınır:** "hiç blok üretmeyen" tam sessiz yol (`sessizBitisBekliyor`)
birim testiyle kaplı ama CANLI GÖZLENMEDİ — PowerShell her komuttan sonra
istem satırını yeniden bastığı için pratikte hep en az bir satırlık fark
oluşuyor. Kod yazılı ve testli; canlı tetiklendiği görülmedi.

## Karar kaydı — iskelet seçimi yetenekle yapılır (T6e)

**Bulgu:** her canlı koşuda şu iki satır geçiyordu ve üzerine gidilmemişti:
`'./orion.vrm' içinde ağız blend shape'i yok` / `göz kırpma blend shape'i yok`.
Yani ölçülüp doğrulanmış TTS ağız senkronu (tepe_agiz=1.000) ekranda
**hiç görünmüyordu**. Bedenlenme projesinde en görünür kusur buydu.

**Varlığın kendisi incelendi** (dosyadan, hafızadan değil):

| Alan | Değer |
|---|---|
| `extensionsUsed` | `null` — **VRM eklentisi YOK** |
| mesh adı | `Cesium_Man` (Khronos glTF örneği) |
| morph target | **0** — ağız/göz fiziksel olarak imkânsız |
| kemikler | `leg_joint_R_1`… — VRM insansı eşlemesi yok |

`assets/orion.vrm` bir VRM değil; uzantısı değiştirilmiş bir glTF örneği.
İçinde Orion diye bir karakter yok.

**Kök neden koddaydı:** yedeğe düşme yalnızca YÜKLEME HATASINDA çalışıyordu
(`catch`). Yüklenen ama yüzü oynamayan model kabul edilip yalnızca uyarı
basılıyordu. Ölçüt yanlıştı: soru "yüklendi mi" değil, **"ifade edebiliyor mu"**.

`world/avatar/iskeletSecim.ts` (saf, 6 test) bu kararı verir. Ağız desteği
HARD ölçüttür — konuşma bu projenin çekirdek yeteneği; göz/baş eksikliği
uyarı olarak geçer. Görünüşü ifadeye tercih etmek isteyen için `vrmZorla`
kaçış kapısı var, ama bedeli logda açıkça yazılır ("ölü görünecek").

Varlık SEÇİMİ (hangi VRM) hâlâ Ozyn'in kararı — ona dokunulmadı.

**Canlı kanıt** (`3dorion.bat yuzdene`):
```
iskelet=prosedurel  agiz=true kirpma=true
GECTI agiz mesh oynuyor  kapali=1.000 acik=6.000 fark=5.000
GECTI goz kirpiyor       genlik=0.934
```
Bu değişiklikten önce ikisi de sıfırdı. Gerileme yok: `otodene` 4/4.

## Karar kaydı — uzun vadeli hafıza (T6f): boru çalışıyor, model kullanamıyor

**Sorun:** bellek `Kopru._gecmis` içinde SABİT 12 turluk pencereydi; 13. turda
ilk tur sessizce düşüyordu. Odada yaşadığı iddia edilen bir varlık için bu,
birkaç dakikada bir hafıza kaybı demek.

`mind/hafiza.ts` — Generative Agents (arXiv:2304.03442) skorlaması. Formül ve
sabitler makalenin HTML tam metninden **birebir doğrulandı**:
`score = recency + importance + relevance`, tüm α=1, min-max normalize,
bozulma katsayısı **0.995**, yansıma eşiği **150**.

**Bilinçli sapma:** makale ilgi için gömme (cosine similarity) kullanıyor;
burada varsayılan ucuz kelime örtüşmesi, gömme TAKILABİLİR. Gerekçe bu
oturumun tekrar eden dersi: önce ucuz taban çizgisi, pahalı olan ancak
ölçümde kazanırsa. (`nomic-embed-text` kurulu; kıyas ayrı iş.)

### Canlı ölçüm iki GERÇEK hata buldu

1. **Kalıp ilgiyi zehirliyordu.** Anılar `Ozyn dedi: "..."` biçiminde
   saklanıyordu; tüm anılar aynı öneki taşıdığı için kelime örtüşmesi
   içerikten değil KALIPTAN geliyordu. Sorgu ne olursa olsun hep aynı üç
   alakasız anı dönüyordu. Artık hafızaya **içerik** yazılıyor, kim söylediği
   `tur` alanında duruyor.
2. **`konusmaDinle` sessizce eziyordu.** Tek yuvaya yazıyordu; ikinci çağrı
   birincisini siliyordu. Ölçüm dinleyicisi kuruldu, `beyniBagla` üretim
   dinleyicisini bağlayınca ölçüm hiçbir şey duymadı ve "cevap boş" sandı.
   Artık çoklu, abonelikten çıkılabilir, bir dinleyicinin hatası diğerlerini
   kesmiyor.

Ayrıca hafızanın kendi tasarımında bir hata: **şu anki girdi kendi anısı
olarak geri geliyordu** ("şifrem neydi" sorusu, mükemmel ilgi+tazelikle ilk
sırayı kapıp asıl anıyı dışarı itiyordu). Dışlama artık çağıran tarafından
AÇIKÇA veriliyor — ilk düzeltme (`sorgu.includes`) çok genişti ve meşru
anıları da eliyordu.

### Dürüst NEGATİF sonuç

Plumbing doğrulandı: log her koşuda aranan anıyı **ilk sırada** teslim ediyor:
```
[HAFIZA] getirilen 3: bu hafta terminal suzgeci uzerinde calisiyorum | hava bugun guzel | kahve ictim
```

Ama `qwen2.5:7b` onu KULLANMIYOR. Altı canlı koşu (pencere 12 ×4, pencere 4 ×2):

| Koşu | Cevap |
|---|---|
| 1 | "-ozyn'e bakan pozisyonda- «Evet, hatırlıyorum»" — neyi, söylemiyor |
| 2 | "Hatırlıyorum, sen **masanın üzerinde** çalışıyordun" — uyduruyor |
| 3 | "orld" — bozuk çıktı |
| 4-5 | boş / `dunya_soyle({"metin": ...})` — araç sözdizimini DÜZ METİN yazıyor |

"Sinyal gömülmüş olabilir" hipotezi tek değişkenle sınandı: geçmiş penceresi
12 → 4 indirildi, **sonuç değişmedi**. Yani bağlam kalabalığı değil, model
sınırı. Prompt kurcalama burada kesildi.

**Durum:** hafıza katmanı [TEST] (28 birim testi), davranış [ÖLÇÜLDÜ-BAŞARISIZ].
Ölçüm düzeneği hazır (`3dorion.bat hafizadene`); daha güçlü bir model ya da
gömme tabanlı ilgi aynı sınavla kıyaslanabilir. Ölçülmeden değiştirilmeyecek.

## Karar kaydı — beyaz tahta (T7a): ofiste ilk kalıcı iz

**Bulgu:** `yaz` niyeti protokolde tanımlıydı, LLM'e araç olarak sunuluyordu,
odada `tahta_yuzey` mesh'i vardı — ama yüzey **hiç yazılmamıştı**. `oda.ts`'in
kendi yorumu "yer tutucu" diyordu ve her `yaz` çağrısı hata dönüyordu:
"`yaz` avatarın işi değil: tahta yüzeyi (world/surfaces) yürütür." O yüzey yoktu.
Orion kendi ofisinde hiçbir şey yazamıyordu; beyaz tahta dekordu.

| Parça | İş |
|---|---|
| `world/surfaces/tahtaYazisi.ts` | SAF metin yerleşimi: kelime sınırından bölme, sığmayan kelimeyi zorla kırma, taşınca en eski satırı düşürme (ve kaç satır düştüğünü SAYMA) |
| `world/surfaces/tahta.ts` | DynamicTexture yüzeyi; monitörle aynı kirli-bayrak deseni, ama hücre ızgarası değil orantılı yazı — tahta insan okuması içindir |

**Yakınlık kuralı gerçekten uygulanıyor.** Talimatta zaten yazılıydı ("tahtaya
yazmak için önce tahtanın önüne git"); artık `yaklastiMi("tahta", konum)` ile
zorlanıyor ve reddin gerekçesi beyne geri besleniyor.

### Yol boyunca bulunan GERÇEK mimari kusur

İlk sürümde yönlendirme yalnızca köprünün `niyetGonder` yolundaydı. Sonuç:
**`yaz` niyeti GELDİĞİ YOLA GÖRE farklı davranıyordu** — köprüden gelince
tahtaya, `window.dunya.niyet()` ya da 1-6 tuşlarından gelince doğrudan avatara
gidip "benim işim değil" hatası alıyordu. Canlı tahta denemesi bunu ortaya
çıkardı (test 1/3, hiç `[TAHTA]` logu yok). Artık tek yönlendirme noktası var:
`niyetiYurut(n, id)` — avatar, ses hattı ve tahta orada ayrılıyor.

Not: ilk kontrolüm YANLIŞ SEBEPLE geçmişti (tahta boş kaldı diye "reddedildi"
sandım, oysa kural hiç çalışmamıştı). Loglara bakmasam yanlış sonuca varırdım.

### Canlı kanıt

`3dorion.bat tahtadene` — 3/3:
```
[TAHTA] reddedildi: uzakta (0.9,-1.2)      <- kural gercekten calisti
[TAHTA] yazildi: +2 satir                   <- tahtanin onunde
  "Terminal suzgeci bitti. Cikis"           <- kelime sinirindan bolunmus
  "kodu ile calisiyor."
temizle=true eskiyi sildi -> ["yeni not"]
```

`3dorion.bat tahtabeyin` — uçtan uca, ve geri besleme döngüsünün modeli
CANLI olarak öğrettiğini gösteriyor:
```
Ozyn: "tahtaya git ve 'suzgec bitti' yaz"
  git tahta + yaz        -> [TAHTA] reddedildi: uzakta (0.9,-1.2)
  (ret gerekcesi beyne geri beslendi)
  git tahta + yaz        -> [TAHTA] yazildi: +1 satir
  orion konumu=-2.9,-0.6 | tahtada: "suzgec bitti"
```
Model `git` ve `yaz`'ı aynı anda gönderdi, reddedildi, **aynı konuşma içinde
kendini düzeltti**. Araştırmada doğrulanan Voyager tarzı özdüzeltme, canlıda.

## Karar kaydı — model arayışı (T6g): daha iyisi bütçeye sığmıyor

Üç cephede aynı duvara çarpıldı (gevezelik, hatırlama, araç çağırma), bu yüzden
model aranmasına karar verildi. Araştırma (Ollama 2026 karşılaştırmaları):
Qwen3 ailesi araç çağrısını en az düşüren aile, yerel modeller arasında en
güçlü çok dilli destek; **Gemma3 araç çağırmıyor** → eleme. Aday: `qwen3:4b`
(2.5 GB — mevcut modelin yarısı, VRAM'de rahat).

`tools/model-olcum.mjs` dört sınavla ölçer (aynı talimat, aynı araçlar):
selam · terminal hatası · hafızadan bilgi kullan · rutin çıktıda SUSMA.

| Model | Puan | Ortalama gecikme |
|---|---|---|
| `qwen2.5:7b` | **1/4** | **858 ms** |
| `qwen3:4b` | 2/4 | 27 900 ms |

`qwen3:4b` Türkçesi ve hafıza kullanımı **açıkça daha iyi** (hatırlama sınavını
geçen tek model), ama 28-30 saniye. Düşünme modu kapatılmaya çalışıldı:

- `think: false` (Ollama 0.33.3): **kabul ediliyor, etkisi YOK** — ham akıl
  yürütme doğrudan `content`'e sızıyor, ayrı `thinking` alanı yok.
- `/no_think` sistem mesajında: etkisiz.
- `/no_think` kullanıcı mesajında: etkisiz **ve cevaba sızıyor**
  ("/no_think dosyaları işlendi").
- Araçsız tek istekte `/no_think` ÇALIŞIYOR (cevap uzunluğu 1).
  → **Araçlar açıkken Qwen3 her hâlükârda düşünüyor.** Ölçülen sonuç budur.

**Karar: `qwen2.5:7b` kalıyor.** Daha iyi dil ve hafıza kullanımı, 30 saniyelik
gecikmeye değmez. `qwen3:4b` silinmedi; Ollama düşünme modunu gerçekten
kapatabildiğinde aynı sınavla yeniden ölçülebilir.

### Asıl bulgu: mimari, modelin zayıflığını taşıyor

Ham model sınavda **1/4**; aynı model uygulamanın içinde davranış ölçümünde
**3/4 senaryoda kusursuz** (`3dorion.bat davranis`). Fark, arada duran
katmanlar:

| Sınavda kalma sebebi | Uygulamada bunu kapatan katman |
|---|---|
| araç çağırmadı, düz metin yazdı | düz metin kurtarma (`bridge/kopru.ts`) |
| rutin çıktıda konuştu | çıkış koduyla süzme — o algı beyne HİÇ gitmiyor |
| gereğinden uzun konuştu | `voice/kisalt.ts` belirleyici iki cümle |
| komutu kendi yazdığını sandı | atıf algıda (`protocol/algi.ts`) |

Yani bu oturumda kurulan koruma katmanları süs değil; ölçülebilir biçimde
1/4'lük bir modeli kullanılabilir hâle getiriyor. Model değişimi hâlâ
arzu edilir ama **önkoşul değil**.

## Karar kaydı — beyin modeli seçimi (ölçümle, 2026-09-12)

Gevezelik ve zayıf Türkçe "model sınırı" diye geçiştirilmedi; dört aday
**aynı araç çağrısı sondasıyla** ölçüldü.

| Model | Araç çağırdı mı | Soğuk | Sıcak (ort.) | Sonuç |
|---|---|---|---|---|
| `qwen2.5:7b` (4.7GB) | **evet 3/3** | 3.2 sn | **741 ms** | **seçildi** |
| `ornith-32k` (5.6GB) | evet 3/3 | 12.0 sn | 3127 ms | elendi — 4.2× yavaş |
| `Qwythos-9B` (6.8GB) | **hayır** | 17.1 sn | — | elendi — araç yok |
| `vibethinker` (1.9GB) | **hayır** | 88 sn | — | elendi — `<think>` döküyor |

Son ikisi araç çağırmıyor: avatar hiç hareket etmez, yalnızca konuşan bir kutu
kalırdı. Bedenlenme projesinde bu diskalifiyedir.

`ornith-32k`ın Türkçesi ve hata açıklaması **daha iyiydi** — ama VRAM ölçümü
kararı verdi: yüklendiğinde kartta yalnızca **833 MiB** kaldı (8188 toplam).
Babylon'un ~1.5 GB'ı oraya sığmaz; gerçek uygulamada CPU'ya taşar ve ölçülen
3.1 sn daha da kötüleşir. Üstelik bu ölçüm Babylon KAPALIYKEN alındı, yani
iyimser hâli. Daha iyi dil, bütçeye sığmadığı için reddedildi.

### Gevezelik: modele yalvarmak yerine belirleyici kural

Talimattaki "EN FAZLA İKİ CÜMLE" kuralına model 3 koşudan 2'sinde uymadı.
Promptu daha çok zorlamak kırılgandır; kural `voice/kisalt.ts` ile
belirleyici biçimde uygulanır — kesme CÜMLE SINIRINDA yapılır, çünkü cümle
ortasından kesmek yarım kalmış bir söz duyurur ve sessizlikten beterdir.

Canlı sonuç (3 koşu): kısaltma her koşuda devreye girdi (234→50, 195→135,
330→135 karakter), gevezelik kusuru **2/3 → 0/3**. Yan fayda: TTS süresi
metinle doğru orantılı olduğundan cevaplar daha çabuk bitiyor.

### Ölçüm aracının kendi körlükleri (ikisi de bulundu ve kapatıldı)

Dürüstlük gereği yazılı: `davranisDenemesi` iki kez **yanlış temiz rapor**
verdi. (1) Gecikme olarak benim bekleme penceremi basıyordu, Orion'un hızını
değil. (2) Yanlış atıf dedektörü yalnızca geçmiş zamanı tanıyordu; Orion
"bir komut veriyorum" dediğinde kusur sayılmadı. İkisi de gerileme testiyle
kilitlendi. Bir ölçüm aracına, ölçtüğü şey kadar şüpheyle bakmak gerekiyor.

### ÇÖZÜLDÜ — OSC 133 kabuk entegrasyonu (T6d)

Üç ayrı ölçüm aynı eksikliğe işaret etmişti: (1) `tsc` temiz geçince HİÇBİR
ŞEY yazmıyor, "başarı" metinde görünmez; (2) Windows hata metinleri tutarsız
ve hiçbiri "error"/"fail" içermiyor; (3) metne bakan süzgeç, hata ANLATAN bir
test adını hata OLAN bir olaydan ayıramıyor. Hepsinin cevabı aynı: komutun
ÇIKIŞ KODU.

**Kabuk değişti: cmd.exe → PowerShell.** Bu keyfi değil, ölçüm sonucu.
Microsoft'un belgelediği cmd `PROMPT` dizisi `D`'yi **çıkış kodu olmadan**
yayıyor (cmd `%ERRORLEVEL%`'i her istemde genişletmez). PowerShell'in `prompt`
fonksiyonu `$LASTEXITCODE`'a erişebiliyor. node-pty üzerinden canlı sonda:

```
D;0  A  B   D;0  A  B   D;1  A     ← echo basarili, bilinmeyen komut D;1
```

`ORION_KABUK` ile eski kabuğa dönülebilir (kod sinyali kaybolur).

| Parça | İş |
|---|---|
| `world/surfaces/kabukIsaret.ts` | OSC 133 ayrıştırıcı — SAF, durumlu. pty verisi dizinin ortasından bölünebilir; yarım parça saklanır. İşaretler xterm'e ULAŞMADAN ayıklanır, ekrana çöp yazılmaz. |
| `host/main.js` | PowerShell'e `prompt` fonksiyonu enjekte eder |
| `protocol/algi.ts` | `terminal` algısına EK alan: `kod?: number` (ek alan = kırıcı değil) |
| `mind/refleks.ts` | Kod varsa metin desenlerini **ezer** |

**Karar kuralı:** kod ≠ 0 → koşulsuz terfi. kod = 0 → metindeki korkutucu
kelimelere BAKILMAZ; yalnızca "sonuç bildirmeye değer mi" sorulur (test
sayıları, derleme bitti). Gerçek veride yakalanan yanlış pozitiflerin
TAMAMI bu sınıftaydı: `fix error handling` commit mesajı, `"error": null`
JSON alanı, `grep "error"` yankısı — hiçbiri hata değildi.

Canlı kanıt (`3dorion.bat gorudene` 3/3, davranış 3/3 kusursuz):
```
terfi=false (komut başarılı, rutin çıktı)          ← kod 0
terfi=true  (komut hata ile bitti (çıkış kodu 1))  ← kod 1
terfi=false (komut başarılı, rutin çıktı)          ← kod 0
```
Üç kararın üçü de çıkış kodundan; metin tahmini sıfır.

Yol boyunca düzeltilen iki YARIŞ (ikisi de canlı koşuda görüldü, testte değil):
1. Sessizlik zamanlayıcısı kabuk işaretinden ÖNCE tamponu boşaltıyor, kod
   algıya hiç girmiyordu. Entegrasyon canlıyken zamanlayıcı devre dışı;
   sınırı kabuk söyler (azami bekleyiş freni güvenlik için kalır).
2. İşaret, 400 ms'lik örnekleme sırası gelmeden düşünce boş tampona
   rastlıyordu. Artık işaret geldiğinde örnekleme beklenmez.

Ayrıca: kabuk değişince `dir /b` (CMD sözdizimi) PowerShell'de geçersiz
parametre olup komutu BAŞARISIZ yaptı ve "rutin komut" senaryosunu çökertti;
`-NoLogo` yüzünden açılış afişi kalmadığı için "afiş gürültü sayıldı"
kontrolü sınayacak şey bulamadı. İkisi de testin kabuk varsayımıydı, düzeltildi.

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
| K9 | Orion masasındaki terminali görür; gürültü beyni uyandırmaz | `3dorion.bat gorudene` 3/3 ✓, `mind/akis-olcum.ts` 13/13 ✓ |
| K10 | Ozyn konuşunca Orion cevap verir; gördüğü hatayı doğru atıfla söyler | `3dorion.bat davranis` — selam 3/3, hata 3/3, rutinde susma 3/3 ✓ |
| K11 | Orion konuşurken ağzı, yaşarken gözü oynar | `3dorion.bat yuzdene` — ağız farkı 5.000, kırpma genliği 0.934 ✓ |
| K12 | Orion tahtaya yazar; uzaktan yazamaz | `3dorion.bat tahtadene` 3/3 ✓, `tahtabeyin` uçtan uca ✓ |

## Ticket'lar

| # | Dilim | Bağımlılık | Durum |
|---|---|---|---|
| T0 | Repo + Dünya Protokolü + testler | — | **✓ [TEST] 16/16** |
| T1 | Dünya: tick, oda, çapalar, 3. şahıs kamera + F, E etkileşim | T0 | açık |
| T2 | Avatar: VRM + animasyon durum makinesi, niyet→hareket | T1 | açık |
| T3 | Monitör yüzeyi: xterm → DynamicTexture, pty, `claude` | T0 | açık |
| T4 | Köprü: mesh client, Orion dünya araçları, algı geri akışı | T0,T2 | açık |
| T5 | Ses: Piper kurulum + TTS hattı + takılabilir girdi | T0 | **kısmen ✓** — TTS [TEST], STT mikrofon bekliyor |
| T6 | Zihin: idle ajanda + dikkat filtresi + refleks | T4 | **✓ [TEST]** — ajanda canlı, dikkat (T4), refleks kural tabanlı + köprüye bağlı; 270M model ölçümle elendi |
| T6b | **Orion görsün**: dünya olayları + terminal algısı + içerik süzgeci | T6 | **✓ [TEST]** — `3dorion.bat gorudene` 3/3 canlı |
| T6f | **Uzun vadeli hafıza**: Generative Agents skorlaması | T6 | **kısmen** — katman [TEST], davranış model sınırında kaldı |
| T6e | **İskelet seçimi yetenekle**: ağzı oynamayan model reddedilir | T2 | **✓ [TEST]** — `3dorion.bat yuzdene` 2/2 canlı |
| T6d | **OSC 133 kabuk entegrasyonu**: komut sınırı + çıkış kodu | T6b | **✓ [TEST]** — canlı 3/3, kararlar kodla veriliyor |
| T6c | **Davranış ölçümü**: Orion gördüğüne doğru tepki veriyor mu | T6b | **✓ [ÖLÇÜLDÜ]** — 18 canlı koşu; 5 gerçek hata bulundu ve giderildi; gevezelik açık |
| T7a | **Beyaz tahta**: `yaz` niyeti gerçek oldu, yakınlık kuralı zorlanıyor | T2 | **✓ [TEST]** — `tahtadene` 3/3, `tahtabeyin` uçtan uca ✓ |
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
