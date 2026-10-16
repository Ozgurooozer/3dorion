# 28 — Nesne seçimi ve etkileşim menüsü (Ozyn, 2026-10-16)

**İstek (Ozyn):** "orion otur diyince içeri dönüyor. buraya otur dediğimde onu anlayamıyor. demek ki obje seçme tuşu getirmeliyiz ve bununla
etkileşime gir diyebilmeliyiz. mouse açılır kapanır yine. tab tuşu ile olsun. sol tık seçme, sağ tık etkileşim özellikler ve ayarlar gibi bir panel
açsın. Orion'a bu obje ile işte etkileşim menüsünden yapılabilecekleri seçip yaptırabileyim. bunu modüler şekilde planla ve yaz."

**Durum: Faz 1–4 YAZILDI (2026-10-16, Ozyn: "nesne seçimi + etkileşim menüsü yap", sonra "orionda oturabilsin banka, zaten oturma animasyonu var"); testli, CANLIDA GÖRÜLMEDİ `[YAZILDI-KOŞULMADI]`. Faz 5 (not/ayar) AÇIK.** Bulgular okumaya dayanır (`[OKUNDU]`); §9 yapılanı ve ölçülmeyenleri söyler.

## 1. Mekanizma (Ozyn'in anlattığını nasıl anladım)
1. **Tab** → imleç kipi açılır/kapanır (fare kilidi bırakılır, imleç görünür; yine Tab kapatır).
2. İmleç kipinde **sol tık** → nesne SEÇER (vurgu çıkar; boşluğa tık seçimi kaldırır).
3. **Sağ tık** → seçili nesnenin paneli: özellikler, ayarlar ve o nesneyle YAPILABİLECEKLER (etkileşim menüsü).
4. Menüden bir eylem seçilince **Orion yapar** (ya da "ben yapayım": Ozyn kendisi, `F` ile aynı etkileşim).
5. Seçili nesne dilde bir gönderme olur: **"buraya otur", "buna bak", "bununla etkileşime gir"** → Orion "buraya/buna" ile ne kastedildiğini bilir.

Tek cümle: *Ozyn bir nesneyi gösterir; Orion o nesneyle ne yapabileceğini bilir ve Ozyn'in seçtiğini yapar.*

## 2. Bulgular (kod okuyarak)
- [OKUNDU] **"Otur" neden içeri döndürüyor:** `Niyet.otur` `{ tur: "otur", capa?: string }`, açıklaması "varsayılan: sandalye" (`protocol/niyet.ts`); söz sözlüğü (`mind/komutSozlugu.ts`) çıplak "otur"u çapasız programa çeviriyor.
- [OKUNDU] **"Buraya otur" neden anlaşılmıyor:** söz sözlüğü TAM eşleşmeli ve "buraya/buna/bunu" kalıbı yok; oturulabilir yerler sabit liste `OTURULAN = sandalye, masa, monitor` (bank yok). Seçim diye bir kavram dünyada yok.
- [OKUNDU → Faz 4'te GİDERİLDİ, bkz. §9] **Orion'un oturması TEK SANDALYEYE SABİTTİ:** `world/avatar/yurutucu.ts` `_otur` `OTURMA_NOKTASI`, `YANASMA_UZAKLIGI`, `OTURMA_ADIMI` sabitlerini `SANDALYE`den türetiyor; çapadan yalnız adı ve `yon`'u alıyor. `otur capa:"bank"` gönderilse bile Orion ofis sandalyesine giderdi. **Orion'un bankta oturması avatar genellemesi ister** (Faz 4, risk §6).
- [OKUNDU] **Tab** oyunda (level editörü dışında) kullanılmıyor, boş. `F` etkileşim, `C` kamera (`world/player/tuslar.ts`).
- [OKUNDU] **İmleç/fare:** `rig.fareKilitBirak()` var; paneller (G, B, M, O) kilidi bırakıp DOM'la çalışıyor, `tusSerbest` kapısı yazarken harfleri korur. Odak kipi (terminal/panel yakınlaştırma) ayrı bir mekanizma.
- [OKUNDU] **Seçilecek veri hazır ve Orion'un gördüğüyle AYNI:** `Yer.nesneler` (`Nesne`: id, ad, tur, capa, kutu) = ofis + bank + ova nesneleri; `Anlam.eylemler` ve `Anlam.not`; çapa `eylemler`. Işın–kutu testi saf (`isinTarama.ts` deseni).
- [OKUNDU] **Tek eylem yolu:** her niyet `niyetiYurut`'tan geçer (onay kapısı, yakınlık kuralı). Menüden Orion'a yaptırma buradan geçmeli, yeni yol açılmaz.
- [OKUNDU] **Editörün seçim/vurgu kodu** (`world/level/editor/`) editör alt-sisteminin içinde ve oyuna kamu değil: oyun için küçük saf çekirdek yeniden yazılır, editörden import edilmez.
- [OKUNDU] **Yeni olay/servis** için `uygulama/yolTipleri.ts` tek tablo (spec dışı, bus işi): seçim olayı oraya bir satır.

## 3. Tasarım kararları (varsayılan; itiraz edilebilir, §7)
- Seçim TEK nesne (çoklu yok). Yer değişince ya da nesne kalkınca seçim temizlenir.
- İmleç kipi açıkken fare bakışı kilitli; **W/A/S/D yürüme açık kalır** (açık soru 1). Esc imleç kipini de kapatır (mevcut Esc yığınına bir aşama).
- Odak kipi (terminal/panel yakınlaştırma) açıkken nesne seçimi KAPALI: monitöre tıklayınca terminale odak mevcut davranışı bozulmaz.
- Panel yalnız seçili nesne için; başka nesneye sağ tık onu seçer ve paneli ona açar.
- Deiksis ("buraya/buna/bunu/bununla/şuraya"): seçili YOKSA Orion tahmin etmez, geri sorar ("hangisi? Tab ile göster"). Seçili varsa komut sözlüğü token'sız çalıştırır; sözlük tanımazsa LLM'e giden dünya satırında "Ozyn seçti: …" bulunur.
- "Bununla etkileşime gir" = seçili nesnenin birincil eylemi (bank → otur, monitör → odaklan, tahta → yaz); birden çok makul eylem varsa Orion sorar (açık soru 2).
- Eylemler iki yönlü: her satırın **kim**i var (`orion` | `ozyn`) ve **uygun/neden**i: Orion'un yapamadığı eylem GRİ ve nedenli görünür ("Orion şimdilik yalnız sandalyeye oturabilir"), sessizce gizlenmez, sessizce başarısız olmaz.

## 4. Modüller (her biri tek sorumluluk: saf çekirdek + ince adaptör; her biri ayrı testlenir)
| # | modül | dosya (alt-sistem) | sorumluluk | saf mı |
|---|---|---|---|---|
| M1 | İmleç kipi | `world/player/imlecKipi.ts` (Sahne) | Tab/Esc durum makinesi: aç/kapa, kilidi bırak/al, odak ve panellerle çakışma kuralı; tuş tablosuna `imlec: Tab` (`tuslar.ts`) | saf durum + ince DOM |
| M2 | Nesne seçici | `world/player/nesneSecici.ts` (Sahne) | ışın (kaynak, yön) × `Yer.nesneler[].kutu` → en yakın `Nesne`; menzil, küçük nesneye kutu payı | saf |
| M3 | Fare ışını | `world/engine/fareIsini.ts` (Sahne) | piksel → dünya ışını (`createPickingRay`) | Babylon, ince |
| M4 | Seçim durumu | `uygulama/secimDurumu.ts` (Uygulama) | seçili nesne, geçerlilik (yer değişti/nesne kalktı → temizle), olay `nesne.secildi` (`yolTipleri.ts`'e satır) | saf |
| M5 | Vurgu | `world/level/secimVurgusu.ts` (Sahne) | seçili kutunun çizgi çerçevesi | Babylon, ince |
| M6 | Eylem kataloğu | `world/yer/nesneEylemleri.ts` (Sahne) | nesne → `[{kimlik, ad, kim, niyet?, uygun, neden?}]`; kaynak: çapa `eylemler` + `Anlam.eylemler` + avatar YETENEK tablosu | saf |
| M7 | Panel | `world/arayuz/nesnePaneli.ts` (Yüzeyler) | özellikler (ad, tür, konum, boyut, çapa), Orion notu (düzenlenir), eylem düğmeleri; model dışarıdan verilir (bedenPaneli deseni) | DOM |
| M8 | Deiksis (söz) | `mind/komutSozlugu.ts` + `KomutSecenegi.secili`, köprü besler (`bridge/kopru.ts`) | "buraya otur/git/gel", "buna bak", "bunu kullan", "bununla etkileşime gir" → program; seçili yoksa geri sor | saf |
| M9 | Orion bağlamı | `uygulama/dunyaDurumu.ts` | LLM'e giden satıra "Ozyn seçti: …, yapılabilecekler: …" (tek satır) | saf |
| M10 | Eylem yürütme | `uygulama/nesneEtkilesimi.ts` | menü seçimi → `Niyet` → `niyetiYurut` (tek yol, onay kapısı); "ben yapayım" → oyuncu etkileşimi (`F` ile aynı yol) | ince |
| M11 | Nesne notu (isteğe bağlı) | `uygulama/nesneNotlari.ts` | nesne id → Orion'a not (`bedenKaydi.ts` deseni, tarayıcı deposu) → algı/anlam | saf + depo |
| A | **Avatar genellemesi** (ayrı paket) | `world/avatar/yurutucu.ts` | `_otur`/`_kalk` çapanın konum, durak ve `oturmaYonu`'sunu kullansın (bugün sandalye sabit); klip hizası | RİSKLİ, §6 |

Bağımlılık yönü bozulmaz: `world/` yolu (`uygulama/yol.ts`) görmez; seçim durumu ve eylem yürütme `uygulama/`da (kompozisyon), saf çekirdekler `world/`/`mind/`de. Yeni dosyalar `tools/altSistemler.ts` kamu listelerine girer.

## 5. Aşamalar (her biri AYRI onay; kapı ölçütü yazılı, geçilmeden sonrakine başlanmaz)
- **Faz 1 — seçim çekirdeği (canlıda görülür):** M1 + M2 + M3 + M4 + M5. Ölçüt: Tab imleci açar/kapar; sol tık bankı (ve ofis nesnelerini) seçer, vurgu görünür; boşluğa tık seçimi kaldırır; odak kipinde seçim kapalı. Testler: M2 (en yakın, menzil, ön/arka, boş), M1 durum makinesi (Tab/Esc/odak çakışması), M4 geçerlilik; başsız Oyuncu testi (`oyuncuOturma.test.ts` deseni) imleç kipinde yürümeyi sınar.
- **Faz 2 — menü:** M6 + M7 + M10 (Orion: `git`, `bak`, `odaklan`, `yaz`; Ozyn: `otur`). Ölçüt: sağ tık paneli açar; "Orion: yanına git" Orion'u bankın önüne yürütür; "Ben: otur" Ozyn'i oturtur; yapamayacağı eylem nedenli gri.
- **Faz 3 — söz:** M8 + M9. Ölçüt: komutSozlugu testleri (deiksis kalıpları, seçili yokken geri sorma, yanlış pozitif yok: "buraya" geçen ama deiksis olmayan sözler LLM'e gider); karar kaydında `komut:` içgüdüsü; canlı: "buraya gel" seçili noktaya götürür.
- **Faz 4 — Orion bankta oturur (A):** avatar genellemesi. Ölçüt: Orion bankta oturur ve kalkar, ofis sandalyesi bozulmaz (mevcut `eylemdene` "otur" senaryosu yeşil kalır), canlı görsel (klip hizası ölçülmeden "oldu" denmez).
- **Faz 5 — ayar/not:** M11 + panelde Orion notu. İleride: görünürlük, ad.

## 6. Riskler ve sınırlar
- **A (avatar genellemesi) en riskli parça.** Oturma/kalkma klipleri sandalyeye yazılmış (yandan yanaşma, `OTURMA_ADIMI`); bankın oturma yüzeyi 0,45 m, sandalyeninki 0,46 m (yakın), ama klip hizası ve çıkış yönü canlı görülmeden bilinemez. Faz 2'de Orion "bankta otur" eylemi NEDENLİ GRİ kalır; "buraya otur" sözü Faz 4'e kadar bankta çalışmaz (yalnız sandalyede).
- **Işın–kutu (AABB) kabalığı:** küçük/iç içe nesneler (masa üstü monitör) zor seçilir; "en yakın isabet" doğru ama kutu payı ve seçim önceliği (küçük kutu önce) ölçülmeli.
- **Tab:** tarayıcı odak kaydırması `preventDefault` ister; Electron'da canlı doğrulanmalı.
- **Odak kipi çakışması:** mevcut "monitöre tıkla → terminale odak" davranışı bozulmamalı (kural §3).
- **LLM bağlamı:** "Ozyn seçti" satırı her tura tek satır ekler; maliyeti ölçülmedi (spec 16: bağlama yalnız sorulan girer; seçili yoksa satır yok).
- **Orion algısı:** Ozyn bankta oturunca Orion bunu "yüzeye geçti" diye algılıyor (sandalye için de böyleydi); seçim olayı bunu düzeltmez, ayrı küçük iş.
- Yer değişince (ofis ↔ ova geçişi artık yok ama `Yer` değişebilir) seçili nesne geçersizleşir: M4 temizler.

## 7. Açık sorular (Ozyn)
1. İmleç kipinde **W/A/S/D ile yürüme açık mı?** (öneri: açık; yalnız bakış kilitli)
2. **"Bununla etkileşime gir"** seçili nesnenin birincil eylemini mi yapsın (bank → otur), yoksa menü mü açsın? (öneri: birincil eylem; birden çok makul eylem varsa Orion sorar)
3. **Sıra:** "buraya otur" için Faz 4 şart mı, yoksa önce "buraya git/gel/bak" (Faz 1–3) yeter mi? (öneri: Faz 1–3 önce; Orion'un oturması en riskli parça, ayrı onay)
4. **Panelde "ayarlar"** neler olsun? (öneri: Orion'a not; ileride görünürlük/ad)
5. Seçili nesneyi **HUD'da** da yazalım mı ("seçili: bank")? (öneri: evet, tek satır)

## 8. Yazılmadı / ölçülmedi
Bu belge bir plan; hiçbir modül yok. Ölçülmeyenler: ışın–kutu seçiminin ofis iç eşyasında doğruluğu, Orion'un klip hizası bankta, LLM satırının maliyeti, Tab'ın Electron'daki davranışı.

## 9. Yapılan (Faz 1–3) ve ölçülmeyenler — 2026-10-16
Ozyn 5 soruya cevap vermedi, "yap" dedi: **önerilen varsayılanlar alındı** (§7): imleç kipinde W/A/S/D açık; "bununla etkileşime gir" = birincil eylem; HUD'da "seçili: …"; panelde Orion notu SONRAYA (Faz 5); Orion'un bankta oturması (Faz 4) SONRAYA.

**Modüller (hepsi testli):**
| # | dosya | not |
|---|---|---|
| M1 | `world/player/imlecKipi.ts` + `world/engine/fareKipi.ts` (üçüncü durum) + `kamera.ts` `imlecKaynagi` + `tuslar.ts` `imlec: Tab` + `oyuncu.ts` | Tab açar/kapar; Esc kapatır (kilit İSTENMEZ: tarayıcı Esc'ten hemen sonra reddeder); odak/sohbet/onayda AÇILMAZ; imleç kipinde fare Ctrl olmadan kamerayı sürmez, tıklama kilide gitmez |
| M2 | `world/player/nesneSecici.ts` | ışın × `Yer.nesneler[].kutu` (`isinAabb` yeniden kullanıldı); en yakın, eşitlikte KÜÇÜK hacim, kaynağı içinde kalan atlanır, kutu +4 cm pay |
| M3 | `world/engine/fareIsini.ts` | `createPickingRay`; ışın KAMERANIN YAKIN DÜZLEMİNDEN başlar (kamera ile `minZ` arası), tam kamera konumundan değil |
| M4 | `uygulama/secimDurumu.ts` | seçim imleç kipi KAPANINCA da kalır (Ozyn gösterir, bakışı serbest bırakıp "buraya otur" der); yer değişince/nesne kalkınca temizlenir; yol olayı `nesne.secildi` |
| M5 | `world/level/secimVurgusu.ts` | seçili kutunun 12 kenarlı sarı çerçevesi (tek mesh, taşınır) |
| M6 | `world/yer/nesneEylemleri.ts` | menünün beyni; çapalı nesnede git/bak hedefi ÇAPA, çapasızda NOKTA (avatar adla yalnız çapa çözer); gri eylem nedenli (`neden`) ve Orion'un söyleyeceği cümleli (`soz`) |
| M7 | `world/arayuz/nesnePaneli.ts` | sağ tık paneli: özellikler + "Orion yapsın" + "Ben yapayım"; saf `panelModeli` testli; Esc YAKALAMA aşamasında (imleç kipini kapatmasın) |
| M8 | `mind/komutSozlugu.ts` `deiktikCoz` + `bridge/kopru.ts` | "buraya/buna git", "buna/bunu bak", "buraya otur", "bununla etkileşime gir"; seçili YOKSA Orion "Hangisi? Tab'a basıp göster" der; Orion yapamıyorsa nedenini söyler; "buraya gel" (bana gel) DEĞİŞMEDİ |
| M9 | `uygulama/dunyaDurumu.ts` `seciliSatiri` | beyne tek satır, yalnız seçiliyken; "You can:" yalnız UYGUN eylemler |
| M10 | `uygulama/nesneEtkilesimi.ts` + `Oyuncu.etkilesimBaslat` | menü → `niyetiYurut` (tek yol) ya da oyuncunun kendi etkileşimi (menzil `ETKILESIM_MENZILI` 3,5 m) |
Söz sözlüğü ile menü AYNI veriden beslenir (`giris.ts` `seciliOrionEylemleri`); bekçi `uygulama/nesneSecimiBaglanti.test.ts` kökteki 11 halkayı denetler.

**Değişen eski testler (kasıtlı):** `mind/komutSozlugu.test.ts`te "buraya git" ve "şuna bak" artık "LLM'e gider" listesinde değil (deiksis); `capalar.test.ts` dış çapa `bank`ı sayar.

**Canlıda GÖRÜLMEDİ (pencere açılmadı):** Tab'ın Electron'da gerçekten imleci açıp kapaması; sol tıkın doğru nesneyi seçmesi (ışın–kutu gerçek sahnede, özellikle ofis içi küçük eşya); çerçevenin görünümü ve konumu; sağ tık panelinin konumu/okunurluğu; "Yanına git" ile Orion'un bankın önünde bankı görerek durması (`git` çapa hedefinde durağa gider ve çapanın `yon`'una döner: bank için −Z, bankı görür); "buraya otur" sözünün canlı akışı; Esc/Tab etkileşimi. **Ölçülmeyen:** "Ozyn seçti" satırının LLM bağlam maliyeti.

**Bilinen eksikler / sınırlar:** (1) Orion bankta oturur (Faz 4) ama CANLIDA görülmedi (§9 Faz 4). (2) `yaz`/`al`/`kullan` menüde gri ("metin ister" / "denenmedi"). (3) Seçim yalnız imleç kipinde; odakta kapalı. (4) Ozyn bankta otururken Orion "yüzeye geçti" algılar (sandalye de öyleydi). (5) Panelde Orion notu düzenleme yok (Faz 5).

### Faz 4 — Orion bankta oturur (2026-10-16, Ozyn: "orionda oturabilsin banka, zaten oturma animasyonu var")
**Ne değişti:** oturma geometrisi yürütücünün sabitlerinden **çapaya** taşındı (`Capa.oturma`: `nokta`, `yanlar`, `yariBoy`; `world/level/capalar.ts`). Sandalyenin değerleri birebir aynı (yanlar ±X, nokta `z − 0,04`, yarı boy genişlik/2); bank: yanlar `+Z` (ÖNDEN), nokta oturağın ORTASI, yarı boy derinlik/2, `oturmaYonu` +Z (yüz ova'ya). `world/avatar/yurutucu.ts`: `_otur` oturma noktasını, yanaşma yönünü (avatara yakın SERBEST olan), kalça yüksekliğini (`capa.konum.y − OTURMA_KALCA_PAYI`) ve bakılacak yönü çapadan okur; `kalk`/`_asamaKalkiyor` zemine çapanın çıkışının zemininden iner (oda 0, teras −0,05; eskiden `y = 0`). Klip AYNI (`otur`/`kalk`, `OTURMA_ADIMI` 0,45 m). Menü ("Otur" uygun mu) ve söz ("buraya otur", "banka otur", "banka git otur") artık `capa.oturma`dan okur; sabit liste yok.

**Doğrulanan (başsız, `world/avatar/yurutucu.test.ts` 10 yeni test + mevcut sandalye testleri DEĞİŞMEDEN yeşil):** önden yanaşma ve sırtı banka dönük, kök `OTURMA_ADIMI` kadar GERİ gider (klip sözleşmesi), oturunca ova'ya (+Z) bakar, oturunca y = 0,10, kalkınca bankın önüne çıkar ve terasa (−0,05) iner (oturuyorken `git` yolunda da), arkadan başlasa bile dolaşıp önden oturur, yanaşma yönü engelliyse nedenli hata, oturma geometrisi olmayan çapada nedenli hata. Menü ↔ söz tutarlılığı gerçek veriyle (`uygulama/seciliSoz.test.ts`). Mutasyon: oturma yüksekliği, kalkış yüksekliği ve yanaşma yönü bozulunca ilgili testler kırmızı.

**Canlıda GÖRÜLMEDİ:** oturunca bedenin banka oturması (kalça/bacak/sırt bankla örtüşmesi: oturma noktası oturağın ortası; sandalyedeki `−0,04` kaydırma bankta yok, canlı görünce ayarlanır), klibin banktaki ayak oturması (oturma yüzeyi 0,45 m, sandalye 0,46 m: 1 cm fark), yanaşma yolunun gerçek ova engelleriyle (ağaç/kaya) çakışması, Orion'un oturup kalkma sırasında bankın ÖNÜNDEKİ konuma geri dönmesi.
**Dokunulmayan:** araç şeması (`dunya_otur` açıklaması "Without an anchor you go to the chair": bank için de doğru; ölçülmüş şemaya dokunulmadı), "bilgisayarı aç" programı (sandalyeye oturur, kasıtlı).
