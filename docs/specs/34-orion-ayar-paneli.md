# Spec 34 — Orion'un ayar paneli + seçilebilir ses (Piper)

Durum (2026-10-21): YAZILDI, birim testli, başsız ölçüldü (ses değişimi gerçek piper.exe ile). Panel ve sesin uygulama içinde kullanımı canlıda GÖRÜLMEDİ (§7 deneme listesi).

Ozyn'in isteği (aynen): "orionun ayarlarında ses modeli seçilebilir olsun; orion seçilince solunda bir pencere açılsın, burada orionun ayarlanabilir
özelliklerinin kısayolları olsun ama ayarlanabilir. mesela model seçimi açılır kapanır liste, eklenecek md dosyaları, aktif reflexler falan. ha bide orion
bu sesi kullanabilsin. indirmeyi de yap."

## 1. Ne yapar

İmleç kipinde (Tab) Orion'a sol ya da sağ tık → ekranın SOLUNDA "Orion · ayarlar" paneli açılır. Başka bir şey seçilince (nesne, Flash, boşluk) kapanır;
✕ ya da panelde Esc paneli kapatır VE Orion seçimini bırakır (panel = seçimin görünümü; bırakılmasaydı Orion'a tekrar tık "zaten seçili" sayılır, panel geri
açılmazdı). İmleç kipi kapanınca panel gizlenir (kaybolmaz), imleç geri gelince aynı hâliyle döner. Bölümler açılır-kapanır (akordeon, bağımsız); hangi
bölümün açık olduğu hatırlanır (`localStorage` `orion.ayarPaneli.v1`, try/catch'li; panel kendisi her açılışta kapalı başlar).

| bölüm | ne | yazma yolu (TEK kaynak) | kalıcı mı |
|---|---|---|---|
| 💭 Beyin modeli | açılır liste (yerel/bulut grupları, seçilemeyen gri + nedeni), iki adımlı geçiş ("X seçilecek, sohbet geçmişi taşınmaz" → Geç), ↻ Tara, "Ayrıntılı seçici (M)" | M seçicinin AYNI kaynağı (`seciciKaynagiKur` → devre panosunun `beyin.model` teyit yolu); ikinci seçim yolu yok | M ile aynı (son elle seçim hatırlanır) |
| 🔊 Ses | kurulu + katalogdaki sesler: Seç, İndir (ilerleme çubuğu), Sil (yalnız panelden indirilen), ▶ Dene | host ses yöneticisi (`host/sesler.js`) IPC `ses:*`; Dene mevcut `orionSesi.soyle` → `sesUret` yolu | evet, host userData `ses-ayari.json` |
| 📄 Hafıza notları | md dosyaları: ● bağlamda / ○ kapalı rozeti, ✎ ve çift tık düzenleyici, "≈N token her turda", bütçe uyarıları, "Hafıza sekmesinde aç" | aynı md deposu (`mdDeposu`) ve düzenleyici (`editorPenceresi`); simge/uyarı Hafıza sekmesinden (`mdSimgesi`, `baglamUyarilari`) | md dosyalarının kendisi |
| ⚡ Refleksler | doğuştan komutlar ANAHTARI; beceri refleksi ve süzgeç merceği SALT OKUNUR (neden + nasıl açılır); ajanda (asgari/sapma); dikkat (tekrar, terminal kısma, dakikada azami — teyitle); kilitli güvenlik içgüdüleri listesi | devre panosu düğmeleri (`pano.yaz` / `teyitIste`→`teyitliYaz`) | doğuştan komut: HAYIR (bilerek); diğerleri pano gibi (bellek) |
| 📦 Bağlam | otomatik sıkıştırma eşiği/aralığı, md toplam/tek-not bütçesi | `PANO_TELLERI.hafiza` düğmeleri (`hafiza.oto_*`, `hafiza.md_*`) — yeni tel yok | evet (`uygulama/hafizaAyari.ts`) |
| ↗ Kısayollar | Yapı ▸ Zihin, Yapı ▸ Hafıza, M seçici | modüllerin kendi `ac`ı | — |

## 2. Kararlar

- **K1 Modüler çerçeve.** `world/arayuz/ayarPaneliModeli.ts` (saf, testli) + `world/arayuz/ayarPaneli.ts` (DOM). Çekirdek bölümleri tanımaz; yeni ayar = yeni
  `AyarBolumu` dosyası (`uygulama/ayar/*Bolumu.ts`) + `orionAyarlari.ts`'te bir `ekle`. Yapı çubuğunun sekme kaydıyla aynı fikir. **Ajanla genelleşir:**
  bölüm `ajanlar: ["orion"]` taşır; bölümü olmayan ajanın paneli açılmaz (boş pencere yok); içerik ajan × bölüm başına ayrı kurulur. Flash için bugün bölüm YOK.
- **K2 Yerleşim/katman.** Solda, `top: 64px` (HUD'un altı), yükseklik `100vh − 64 − 80 − --alt-cubuk` ile sınırlı: Yapı çubuğunu ve sohbet kutusunu (altta,
  ortada) örtmez. z-index 34: altyazı 31 üstü; editör pencereleri 40–55, beden paneli (B) 55, bilgi paneli 57, bağlam menüsü 58 altı. B paneli de solda
  (z 55): ikisi açıkken B üstte durur (bilinen, kabul).
- **K3 Klavye.** Panelin içindeki keydown/keyup/keypress oyuna SIZMAZ (editorPenceresi kuralı), tekerlek kamerayı oynatmaz; tıklanan düğme odağı hemen bırakır
  (yoksa WASD panelde yutulurdu), seçim kutusu seçimden sonra bırakır, sayı kutusu Enter'da bırakır. Esc panelde: paneli kapatır.
- **K4 Görünüm.** Renk/yazı jetonları `world/arayuz/arayuzJetonlari.ts`: Yapı çubuğu ve Hafıza sekmesindeki değerlerin AYNISI. Eski iki dosyanın CSS'i bu turda
  yeniden yazılmadı (canlıda görülmemiş görünüm riski); `arayuzJetonlari.test.ts` her jetonun o dosyalarda aynen geçtiğini sınar (biri değişirse kırılır).
  Bölümlerin ortak parçaları (satır, rozet, düğme, uyarı, ilerleme çubuğu) panel CSS'inde tek yerde; bölümler kendi CSS yığınını kurmaz.
- **K5 Ses seçimi HOST'ta saklanır** (`%APPDATA%/3dorion/ses-ayari.json`, atomik yazım; senaryo koşusunda `ORION_SMOKE=1` geçici dizin, `ORION_SES_AYARI` ezer).
  Neden localStorage değil: sesi seçen ve çalan ana süreçteki kalıcı piper sürecidir; seçim renderer'da olsaydı açılış selamı renderer seçimi bildirmeden ÖNCE
  varsayılan sesle çıkardı (yarış). Host seçimi pencere açılmadan çözer: selam da seçilen sesle çıkar.
- **K6 Öncelik:** `ORION_PIPER_MODEL` > panel seçimi > `tr_TR-dfki-medium` > kurulu ilk ses. Env varken panel seçimi `kilitli` koduyla reddedilir ve panelde
  nedeni yazar (Seç düğmeleri gri). Env yolu diskte yoksa eski `piperBul` gibi varsayılana düşülür, uyarıyla.
- **K7 Çalışma anında ses değişimi** (`host/ses.js`): `modelAyarla` yalnız İSTENEN modeli yazar; süreç sıradaki isteği göndermeden hemen önce istenenle açılanı
  karşılaştırır, farklıysa eskisini kapatıp yenisini açar. Uçuştaki cümle eski süreçte ve eski sesle TAMAMLANIR (kesilmez); SERİLEŞTİRME korunur (yeniden açılış
  yalnız yanıt beklenmezken). Boştaysa süreç hemen bırakılır. Kapatılan eski sürecin geç gelen `exit`/çıktısı yeni süreci bozamaz (her dinleyici "hâlâ benim
  sürecim mi" bakar) — bu bekçi önceden yoktu: `kapat()` sonrası gelen `exit` yeni süreci de silebilirdi.
- **K8 Orion bu sesi kullanır:** seçim host'ta olduğundan Orion'un BÜTÜN konuşması (`konusmayiBagla` → `orionSesi.soyle`, açılış selamı, `?soz=`, panelin
  Dene'si) aynı `sesUret` yolundan, seçilen sesle çıkar; değişim bir sonraki cümleden geçerli. grep: `sesUret`'i çağıran tek renderer kodu `voice/cikis.ts`.
  Flash'ın sesi yok (spec 33), dokunulmadı. Ses seçimi bugün GLOBAL (ajan başına değil); ikinci konuşan ajan gelirse `sesUret`e ses parametresi gerekir (§6).
- **K9 IPC** (`host/kanallar.cjs` tek kaynak): `ses:liste`, `ses:sec`, `ses:indir`, `ses:sil` (sonuç `{ok, deger: SesDurumu}` | `{ok:false, kod, mesaj}`, md ile aynı
  biçim; ortak açıcı `uygulama/ipcSonuc.ts`, mdDeposu da onu kullanır), olay `ses:indirme` (ilerleme, ≤4/sn). İndirme yalnız katalogdaki ADI kabul eder —
  adres renderer'dan gelmez. Yeni bekçi `host/kanallar.test.ts`: her kanal hem preload'da hem main.js'te geçmeli (kanallar.cjs'in doğuş hatası).
- **K10 İndirme** (`host/sesIndir.js`): `.part` dosyalarına iner; ikisi de doğrulanınca (HTTP 2xx, yazılan = Content-Length, katalog boyutuna ±%20, json ayrışır)
  önce json sonra EN SON onnx yeniden adlandırılır — ses taraması onnx'i ancak eşi varken saydığından yarım çift hiçbir an "kurulu" görünmez. Hata/iptalde
  `.part` silinir, var olan dosyalara dokunulmaz. Aynı anda tek indirme. Silme: yalnız panelden indirilmiş (`ses-ayari.json` `indirilenler`), dahili olmayan ve
  şu an çalmayan ses; iki adımlı ("Sil" → 4 sn içinde "Eminim, sil").

## 3. Ses kataloğu ve indirme sonucu (2026-10-21)

Katalog tek yer: `host/sesler.js` `SES_KATALOGU` (ad ve adres girdiden türer). Boyutlar HEAD isteğiyle doğrulandı (rhasspy/piper-voices, `main`):

| ses | onnx | json | durum |
|---|---|---|---|
| `tr_TR-dfki-medium` | 63 201 294 B | 4 960 B | kurulu (dahili, silinmez) — varsayılan |
| `en_US-lessac-medium` | 63 201 294 B | 4 885 B | kurulu (Ozyn 2026-10-08, elle) — panelden silinmez |
| `tr_TR-fahrettin-medium` | — | — | **İNDİRİLMEDİ, katalogda YOK** |
| `tr_TR-fettah-medium` | — | — | **İNDİRİLMEDİ, katalogda YOK** |

`fahrettin` ve `fettah`: istenen URL şeması (`resolve/main/tr/tr_TR/<ses>/medium/...`) iki dosyada da **HTTP 404**. Depo ağacı (`/api/models/.../tree/main/tr/tr_TR`)
ve `voices.json` main'de Türkçe TEK ses gösteriyor: dfki. Depo geçmişinde **"2025-12-30 Remove fahrettin and fettah voices at request of contributors"**
commit'i var. Dosyalar eski `v1.0.0` etiketinde hâlâ duruyor (onnx 63 201 294 B, json 5 022 / 4 877 B; model kartı CC0 veri kümesi diyor) ama ses sahipleri
kaldırılmasını İSTEDİ — oradan indirmek o isteği çiğnemek olur. Bu yüzden indirmedim ve kataloğa koymadım (`host/sesler.test.ts` bekçisi: katalogda fahrettin/
fettah yok). Bu yüzden başsız sentez denemesi de bu iki ses için YAPILMADI. Türkçe ikinci ses gerekiyorsa seçenek Ozyn'in kararı (başka depo/lisans ya da kendi
kaydı); katalog girdisi eklemek tek satır.

**Başsız ölçüm [ÖLÇÜLDÜ]** (`host/ses.js` PiperSesi + gerçek piper.exe, ses çalınmadı, wav geçici dizinde ve silindi; betik scratchpad `piper-bassiz.mjs`):
dfki 1. cümle 613 ms (250 ms hazırlık beklemesi dahil), 2. cümle 91 ms (aynı süreç); çalışma anında lessac'a geçiş: ilk cümle 446 ms (yeni süreç + model yükleme);
dfki'ye dönüş 378 ms. Dört wav da RIFF/WAVE başlıklı (77–144 KB). 3 süreç açıldı (her değişimde bir), kapanıştan sonra yaşayan piper.exe YOK.
Sonuç: ses değişiminden sonraki ilk cümle ~0,3–0,4 sn daha geç başlar (model yükleme); sonrakiler eski hızında.

## 4. Refleksler: ne anahtarlanabilir, ne anahtarlanamaz

- **Doğuştan komutlar (`kopru.komut`) — ANAHTAR.** Yeni pano düğmesi `refleks.dogustan_komut` (sınıf `guvenli`, etki `sonraki_tur`), teli
  `PANO_TELLERI.refleks.komut`; `KopruAyari.komutYetkisi` artık işlev de olabilir ve köprü onu HER kesin sözde okur. Kapatmak güvenli taraftır: söz LLM'e gider
  (daha yavaş, token). Açılış değeri eski kuraldan (`yetkiAnahtarlari`: elle açılışta açık, senaryoda kapalı, `?komut=0|1`). **Kalıcı değil (bilerek):** elle
  kapatılmış bir anahtar haftalar sonra "Orion neden yavaş" diye sessizce kalmasın; her açılış ölçülmüş varsayılana döner. Duvarda/Zihin sekmesinde de görünür.
- **Beceri refleksi (spec 10) ve süzgeç merceği (spec 12 Faz 5) — SALT OKUNUR.** Teknik olarak köprü bunları da canlı okuyor, ama açılmaları ön-kayıtlı ölçüye /
  gölge ölçüsüne ve Ozyn'in kararına bağlı; bir tıkla açılabilseler o kapı anlamsızlaşırdı. Panel durumu ve açma yolunu yazar (`ORION_BECERI=1` / `?benliksuzgec=1`,
  yeniden başlatma). Durum köprüyle AYNI kaynaktan (`uygulama/kopruKur.ts` `yetkiAnahtarlari`).
- **Ajanda (boşta bakış/jest) ve dikkat — mevcut pano düğmeleri.** Ajandanın aç/kapa anahtarı YOK (yalnız aralık ve sapma); yeni bir "kapat" anahtarı yazmadım
  (ajandanın davranış ölçüsü `docs/olcum/on-kayit-ajanda.md`'ye bağlı, sezgiyle anahtar eklenmez). `dikkat.azami` tehlikeli: panelde iki aşamalı teyit
  (pano uyarısı istek anında hesaplanır, 30 sn).
- **`ezilebilir: false` içgüdüler — YALNIZ LİSTE** (`kilitliIcguduler()`, `ICGUDULER`den türer): maliyet tavanı, sözleşme, insan denetimi. Anahtar değil kural.
- **`olculmus` düğmeler** (ör. refleks uzun işlem eşiği) bu panelden değişmez: ölçüm kilidi yalnız yönetim terminalinden gerekçeyle açılır (devrePanosu.ts).

## 5. Dosyalar

Host: `host/sesler.js` (+ `.d.ts`, `.test.ts`) katalog, tarama, seçim kuralı, ayar dosyası, yönetici · `host/sesIndir.js` (+ `.d.ts`, `.test.ts`, yerel http
sunucusuyla) · `host/ses.js` (+ `ses.d.ts`, `ses.test.ts`, sahte süreçle) çalışma anında model · `host/main.js` kablolar · `host/kanallar.cjs`, `host/preload.cjs`,
`host/kopru.ts` (IpcSonuc, ses tipleri) · `host/kanallar.test.ts` bekçi.
Dünya: `world/arayuz/ayarPaneliModeli.ts` (+ test), `world/arayuz/ayarPaneli.ts`, `world/arayuz/arayuzJetonlari.ts` (+ test).
Uygulama: `uygulama/ayar/` — `orionAyarlari.ts` (bileşim), `ayarModelleri.ts` (+ test; saf), `panoListesi.ts`, `dom.ts`, `beyinBolumu.ts`, `sesBolumu.ts`,
`notlarBolumu.ts`, `reflekslerBolumu.ts`, `baglamBolumu.ts`, `kisayollarBolumu.ts` · `uygulama/ipcSonuc.ts` · küçük eklemeler: `giris.ts` (panel kurulumu, Orion
seçimi → panel, imleç görünürlüğü, `modelKaynagi` servisi), `yolTipleri.ts`, `nesneSecimi.ts` (`bedenSeciminiBirak` + test), `kopruKur.ts` (`yetkiAnahtarlari`),
`devrePanosu.ts` (`refleks.komut` teli), `mdDeposu.ts` (ortak açıcı), `yapi/hafizaSekmesi.ts` (`mdSimgesi`, `baglamUyarilari` dışa).
Köprü/Zihin: `bridge/kopruTurleri.ts` + `bridge/kopru.ts` (komut yetkisi işlev olabilir; `kopruKomut.test.ts` +2 test), `mind/tanim/index.ts` (`RefleksTelleri`, +2 test).
Bekçi tablosu: `tools/altSistemler.ts` (Yüzeyler kamu: `world/arayuz/ayarPaneli.ts`).

## 6. Doğrulama durumu ve bilinen açıklar

- [TEST] panel modeli 13, ayar modelleri 23, host sesler 31, indirme 9 (yerel sunucu: başarı, 404, kopukluk, bozuk json, boyut, iptal, var olan dosya korunur),
  piper istemcisi 8 (sahte süreç), kanal bekçisi 3, nesne seçimi +3, köprü komut teli +2, tanım +2. Mutasyon: köprünün teli canlı okuduğu satır ve `ses.js`
  "benim sürecim mi" bekçisi bozulunca testler kırmızı oldu (yedekten geri kondu).
- [ÖLÇÜLDÜ] gerçek piper.exe ile çalışma anında ses değişimi (§3). Uygulama içinde (Electron) KOŞULMADI.
- [YAZILDI-KOŞULMADI] DOM: panel, bölümler, teyit kutusu, indirme çubuğu, odak bırakma, Esc — tarayıcıda/Electron'da GÖRÜLMEDİ. DOM modülleri testsiz: projede
  DOM test ortamı yok (jsdom bağımlılığı eklenmedi); mantık saf dosyalara alındı ve orada testli. `vite build` scratchpad'e derlendi (dist/'e değil).
- Açık: uygulama içi indirme düğmesinin indirebileceği yeni ses bugün YOK (iki katalog sesi de kurulu); indirme yolu yerel sunucuyla testli, gerçek HF'den uygulama
  içinden koşulmadı. Katalog Türkçe ikinci ses bekliyor (§3, Ozyn'in kararı).
- Açık: ses seçimi global; Flash konuşursa (bugün konuşmuyor) ajan başına ses için `sesUret(metin, ses)` gerekir.
- Açık: beden paneli (B) açıkken ayar panelinin üstüne biner (ikisi de solda).
- Risk: doğuştan komut anahtarı kapatılınca "otur/bana gel" LLM'e gider — yerel modelde yavaşlık ve yanlış eylem riski (spec 13 ölçüsü bunu zaten anlatıyor).
- Risk: ses değişiminden sonraki ilk cümle ~0,4 sn geç (ölçüldü); K3 (< 1,5 sn) içinde.

## 7. Canlı deneme listesi (Ozyn'le birlikte; pencere açmadan ÖNCE sorulur)

1. `3dorion.bat` (normal açılış). Konsolda `[ses] ses: tr_TR-dfki-medium (varsayilan)` satırı; selam dfki ile.
2. Tab (imleç kipi) → Orion'a sol tık: solda "Orion · ayarlar" açılıyor mu, HUD/sohbet/Yapı çubuğu örtülmüyor mu; Beyin ve Ses bölümleri açık.
3. Beyin listesinden başka bir model seç → uyarı satırı + Geç → durum satırı "sağlık kontrolü…" sonra "düşünen: …"; köşe rozeti ve M penceresi aynı modeli söylüyor mu.
4. Ses ▸ English · lessac ▸ Seç → ▶ Dene: İngilizce sesle söylemeli (ilk cümle ~0,5 sn gecikmeli). Orion'a T ile bir şey yaz: cevap da yeni sesle mi.
   Uygulamayı kapat-aç: selam lessac ile mi (kalıcılık). Sonra dfki'ye geri dön.
5. `set ORION_PIPER_MODEL=...dfki...onnx` ile aç: Ses bölümünde kilit uyarısı, Seç düğmeleri gri.
6. Hafıza notları: bir notun rozetini çevir → Hafıza sekmesindeki kart da değişti mi; ✎ düzenleyiciyi açıyor mu.
7. Refleksler: doğuştan komutlar ○ kapalı → "otur" de: LLM uyanmalı (günlükte düşünce); ● açık → "otur" LLM'siz. Duvardaki REFLEKS düğümünde aynı değer.
   `dikkat.azami`yı değiştir: uyarılı teyit kutusu, Onayla.
8. Bağlam: sıkıştırma eşiğini +10 → Zihin sekmesi ▸ HAFIZA aynı değeri gösteriyor mu; kapat-aç sonrası kalıyor mu.
9. Panelde W/A/S/D yaz (bir düğmeye tıkladıktan sonra): Orion'un/oyuncunun yürümemesi değil — düğme odağı bıraktığı için oyuncu YÜRÜMELİ; sayı kutusuna yazarken yürümemeli.
   Esc panelde: panel kapanır, Orion çerçevesi kalkar; Orion'a yeniden tık panel geri gelir. Flash'a tık: panel kapanır.
10. Tab ile imleç kipini kapat: panel gizlenir; tekrar Tab: aynı hâliyle döner.
