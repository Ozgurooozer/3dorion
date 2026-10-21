# Spec 33 — Orion Flash: LLM'siz NPC ajan + çoklu ajan girdi adaptörü

**Durum:** Dilim 0–5 YAZILDI (testli, başsız doğrulandı); canlıda GÖRÜLMEDİ (§7 listesi Ozyn'le). Ozyn'in isteği (2026-10-21): "Orion Flash
projenin en önemli işlerinden biri; oyunlardaki NPC gibi düşün." Onaylı plan: `~/.claude/plans/expressive-coalescing-mist.md`.
Odak dönemi (2026-10-16 → 30) notu: `world/level/`'a dokunulmadı; iş Ozyn'in doğrudan isteği.

**Bir cümlede:** Flash, Orion'un bedenini (amber renk) ve Orion'un LLM'siz yollarını (komut sözlüğü, takip, sohbet kipi, ajanda, dikkat)
taşıyan, HİÇ model çağırmayan bir NPC; anlamadığı söze "bilmiyorum" deyip bildiği komutlardan en yakınını önerir. Ozyn'in sözü tek yerden
girer ve sohbetteki hedef çipiyle Orion'a, Flash'a ya da ikisine gider; Yapı çubuğu · Zihin sekmesinde iki ajanın zihin haritası çiplerle seçilir.

## 0. Ölçüm ön kaydı — Flash'ın tavanı

> 2026-10-21 · ÖN KAYIT. Bu bölüm ölçüm KOŞULMADAN önce yazıldı; sonuç altına (§0.1) eklenir, bu bölüm değişmez.

**Soru.** Ozyn'in gerçekte söylediği sözlerin yüzde kaçını Flash, hiç model çağırmadan karşılayabilir? (= Flash'ın bugünkü sözlükle tavanı.)

**Veri.** `%APPDATA%/3dorion/karar-kaydi/*.jsonl` (19 gün dosyası, 2026-09-27 → 2026-10-21), `tur:"algi"`, `algi:"duydum"`, `soz.kesin === true`
satırları. Hiçbir satır elenmez. Senaryo/deneme koşularının sözleri kayıttan ayırt edilemiyorsa ayrılmaz; yanlılık olarak yazılır.

**Yöntem.** Her söz Flash'ın GERÇEK köprüsünden geçirilir (`flash/` kurulumu, aynı `Kopru` sınıfı, beyin = `BeyinsizBeyin`); her söz için yeni
köprü kurulur (takip/sohbet kipi bir sözden ötekine taşmasın). Flash'ın kendi karar kaydındaki algı satırının kapı kuralı okunur:
- **karşılandı** = kural ∈ {`kopru.komut`, `kopru.takip`, `kopru.sohbet`} (LLM'i atlayan doğuştan yollar);
- **bilmiyorum** = `kopru.konusma` (söz `BeyinsizBeyin`'e düştü: "bilmiyorum + seçenek").
Flash'ta ortam yetkisi yok (ova ışığı/stili Orion'un işi), seçili nesne yok. Araç: `tools/flash-tavan.ts`.

**Sayılar.**
1. **olay oranı** = karşılanan söyleyiş / toplam söyleyiş (BİRİNCİL; gerçek kullanım sıklığı);
2. **tekil oran** = karşılanan farklı metin / farklı metin;
3. **yapabildiği** = (1)'den, karşılanıp da Flash'ın bedeninin yapamadığı niyete (odaklan, komut, doktor, gör…) dönenler düşülmüş hâli.

**Doğruluk.** Eşleşenlerin listesi elle okunur (okuyan Claude; Ozyn onaylamadı); bariz yanlış eşleşme sayısı yazılır.

**Eşik (ön kayıtlı; sonuca bakıp değişmez), sayı (3) üstünden:**
- (3) ≥ %30 → "Flash bugünkü sözlükle günlük sözlerin anlamlı bir payını LLM'siz karşılar";
- %15 ≤ (3) < %30 → "kısmi: Flash'ın asıl deneyimi 'bilmiyorum + seçenek'; sözlük genişletmesi sıradaki iş";
- (3) < %15 → "Flash çoğu sözde bilmiyorum der; değeri NPC'nin seçenek diyaloğunda, kullanım defteri karar verir".
- Yanlış eşleşme > 0 → o kalıp sözlük hatasıdır ve Orion'u da etkiler: ayrı not, düzeltme Ozyn'e sorulur.

**Bilinen yanlılık.** Bu sözler Ozyn LLM'li Orion'a konuşurken söylendi; Flash'a konuşurken daha kısa, komut dilinde konuşabilir (tavan
yukarı) ya da sohbet deneyebilir (aşağı). Ölçüm geçmişi anlatır, Flash'ın gelecekteki kullanımını değil: asıl ölçü kullanım defterindeki
"Flash yetti mi?" satırları.

### 0.1 Sonuç [ÖLÇÜLDÜ — çevrimdışı, gerçek karar kaydı; 2026-10-21]

Koşum: `node --experimental-strip-types --import ./tools/babylon-cozucu.mjs tools/flash-tavan.ts`. Ham çıktı oturumun geçici dizininde
(listeler orada; aşağıdakiler özet).

| | sayı | oran |
|---|---|---|
| veri | 327 farklı söz, 531 söyleyiş (kesin `duydum`) | |
| (1) olay oranı (BİRİNCİL) | 157 / 531 | **%29,6** |
| (2) tekil oran | 45 / 327 | %13,8 |
| (3) yapabildiği (olay) | 131 / 531 | **%24,7** |

Kapı kuralları (söyleyiş): `kopru.komut` 133, `kopru.takip` 24, `kopru.konusma` (bilmiyorum) 372, `kopru.sikistir` 2 (`/compact`: Flash'ta
yedek yok, "yapılmadı" der). Karşılanıp yapamadığı 26 söyleyiş: bilgisayarı aç/odaklan 19, gözünle bak (`sor gor`) 3, doktor 4.

- **Ön kayıtlı karar (3) = %24,7 → "kısmi: Flash'ın asıl deneyimi 'bilmiyorum + seçenek'; sözlük genişletmesi sıradaki iş".**
- **Yanlış eşleşme: 0** (45 eşleşen sözü ben okudum; Ozyn onaylamadı). Not: "Orion beni takip et." Flash'ta da takip açar — hedef çipi
  Flash'sa söz Flash'a gider, ad ayıklanmaz (bkz. §6).
- En sık eşleşenler: "bana gel" 22, "gel" 18, "tahtaya git" 12, "kalk" 11, "yanima gel" 11, "otur" 10, "beni takip et" 10.
- 1 söz deiksis ("buraya otur"): ölçümde seçim yoktu; canlıda Flash seçili nesneyi Orion'la aynı veriden görür (`secili`).

**Keşif (ÖN KAYITSIZ, karar değil):** "bilmiyorum"a düşen 374 söyleyişin 39'u (%10,4) yakın bir komut önerisi alıyor (çoğu "tahtaya … yaz" →
«tahtaya git»), geri kalanı "Bildiklerim: …" listesini. Öneri kuralının iki düzeltmesi (asimetrik kök benzerliği, zayıf kelimeler) BU VERİYE
bakılarak yapıldı ("bir şiir" → «takibi bırak», "getir" → «kalk» yanlışlarını gidermek için): aynı veride ölçülen oran iyimserdir.

### 0.2 Spike: ikinci `avatarKur` [ÖLÇÜLDÜ — başsız: NullEngine + gerçek `orion-lowpoly.glb`]

İki bedeni aynı sahneye kurmak ÇALIŞTI (169 ms + 81 ms, ikisi de VRM). Bulunanlar ve çözümleri:
- **Ad çakışması:** iki kök de `orion_vrm_kok`; `getTransformNodeByName` ilkini döner (`uygulama/yerGecisi.ts` Orion'u böyle bulur) → yükleme
  sırası değişirse Flash'ı bulurdu. Çözüm: `AvatarAyari.ad` öneki (varsayılan "orion"; Flash "flash").
- **Malzeme:** her yükleme kendi malzemesini üretiyor (ortak malzeme 0) → renk öbür bedene sızmaz. Çözüm: `AvatarAyari.renk` (PBR albedo).
- **Aynı sandalye:** iki beden "otur" alınca İKİSİ DE aynı noktaya oturdu, hata yok. Çözüm: yürütücüde oturma izni (`koltukDolu`) +
  `uygulama/ajanlar/koltuklar.ts`; koltuk oturmaya GİDERKEN de tutulur, kalkınca bırakılır (durumdan hesaplanır, unutulamaz).
- **`yer()` paylaşımı:** Yer salt veri (çarpışma, yol, çapalar); iki beden aynı Yer'de sorunsuz yürüdü. Bedenler BİRBİRİNE çarpmaz (§6).
- **vrm yükleme:** sorunsuz; uyarılar Orion'unkiyle aynı (ağız/kırpma blend shape'i yok).
Spike kalıcı bekçiye döndü: `world/avatar/ikinciBeden.test.ts` (önek, renk sızmaması, koltuk çakışması, yok etme).

## 1. NPC çerçevesi ve kararlar

| karar | neden |
|---|---|
| LLM'siz = HİÇ model çağrısı (functiongemma terfi kararı da yok) | uyandırılacak beyin yok; maliyet modelle değil veriyle ölçeklenir |
| Aynı `Kopru` sınıfı, beyin = `BeyinsizBeyin` | Orion'un LLM'siz yolları kopyalanmaz (CLAUDE.md "kopya kod: kural değil bekçi"); kapı, eylem sırası, karar kaydı aynı |
| Anlamayınca "bilmiyorum + seçenek" (en yakın komut, yoksa bildikleri) | oyun NPC'si uydurmaz, diyalog seçeneği sunar; deterministik (aynı söz → aynı cevap) |
| Yapamadığı niyet (odaklan, komut, yaz, doktor…) → açık hata → "Yapamadım: …" | sessiz düşme yok; NPC tanımında `bedenNiyetleri` |
| Flash'ın karar kaydı KONSOLA YAZILMAZ | host `[KARAR]` satırlarını Orion'un günlük dosyasına ekler (`host/kararDosyasi.js`); Flash'ın satırları Orion'un ölçümlerini (kullanım defteri, beceri defteri, komut-tara) kirletirdi |
| Hafıza/durum diske gitmez, ortam yetkisi yok | NPC'nin uzun hafızası yok (bugün); ova ışığı Orion'un işi |
| Ajan ≠ beden: `AjanKaydi {id, ad, renk, kume, algi}` | ileride 300 ajanın çoğu bedensiz/uzak; `kume` kategori→departman yer tutucusu (bugün hep null, arayüzü YOK — YAGNI) |
| Girdi tek yerden: sohbet + mikrofon → `sozAlindi` → `girdiAdaptoru` | hedef seçimi tek yerde; mikrofon da çipi izler |
| Zihin haritası: TEK sekme + ajan çipleri | 300 ajanda sekme şeridi taşar |
| Flash senaryolarda (`?sessiz`, `*dene`) ve `?flashsiz` ile kurulmaz | bütün canlı doğrulama senaryoları bugünkü tek bedenli dünyayı görsün |
| Söz önce Orion'a, sonra Flash'a (defter sırası) | "ikisi birden otur"da iki niyet aynı tikte işlenir; sandalyeyi saatte ÖNCE kayıtlı beden alır (genelde Orion: bedeni önce yüklenmeye başlar — GARANTİ DEĞİL), öbürü "… dolu: X orada" hatası alır |

## 2. Dosyalar (dilim dilim)

- **Dilim 0** — `tools/flash-tavan.ts` (ölçüm), `tools/kararSozleri.ts` (komut-tara ile ORTAK söz okuyucu; komut-tara'daki kopya kaldırıldı).
- **Dilim 1** — `uygulama/ajanlar/ajanKaydi.ts` (defter, `hedefCoz`, `HEPSI`, `ORION_AJANI`), `girdiAdaptoru.ts`; giris.ts `sozAlindi`
  artık adaptörden geçer (Orion'a giden algı nesnesi aynı, testli).
- **Dilim 2** — `flash/` alt-sistemi: `npcTanimi.ts` (FLASH verisi), `secenek.ts` (bilmiyorum/yapamadım, en yakın komut),
  `beyinsizBeyin.ts`, `flashKur.ts` (aynı Kopru + niyet yönü), `flashTest.ts` (test düzeneği; ölçüm aracı da kullanır). Bekçiler:
  `tools/altSistemler.ts` (Flash: Protokol/Zihin/Köprü, kamu = flashKur + npcTanimi), `tools/mimari.test.ts` (flash katmanı + iki
  kalibrasyon), `tools/altSistem.test.ts` ve `tools/tipKacisi.test.ts` taraması, `tsconfig.json` include.
- **Dilim 3** — `world/avatar/`: `AvatarAyari.ad/renk/koltukDolu`, `Avatar.koltugu()`, yürütücüde oturma izni, vrm/prosedürel önek+renk.
  `uygulama/ajanlar/koltuklar.ts`, `flashBaglantisi.ts` (beden + köprü + takip + ajanda + kayıt); `uygulama/niyetYurutucu.ts`'ten
  `avatarAdimi` dışa açıldı (Orion'un beden adımının gövdesi, Flash'ın takibi aynısını çağırır); `uygulama/yerGecisi.ts` `ekAktorler`
  (birleşik dünyanın ışık üyeliği ve kapısı Flash'ı da görsün). giris.ts: koltuk defteri, Flash'ın ayrı kablosu; `yol.al("orion")` yerleri DEĞİŞMEDİ.
- **Dilim 4** — `semaCekirdek.ts` `SemaTanimi` + `ORION_SEMASI` (duvarın eski sabitleri), `cizSema` tanımla (verilmezse Orion — duvar aynı);
  `world/surfaces/duvar/semaTuvali.ts` (mesh'siz şema; `semaKur` DEĞİŞMEDİ); `uygulama/ajanlar/flashSemasi.ts` (ALGI→DİKKAT→KOMUT→BEDEN,
  yan dal BİLMİYORUM→SÖZ; LLM düğümü YOK; karar kaydından besleme); `uygulama/ajanlar/cipModeli.ts` (ortak çip modeli);
  `uygulama/yapi/zihinSekmesi.ts` ajan çipleri.
- **Dilim 5** — `index.html` `#sohbetHedef` + stil; `uygulama/sohbetHedefi.ts` (çipler, Tab/Shift+Tab döngü, seçim hatırlanır `orion.sohbetHedefi`).

## 3. Doğrulama durumu

- [TEST] hedef çözücü, adaptör (Orion'un algısı birebir), defter; BeyinsizBeyin (fetch sayacıyla uçtan uca model çağrısı 0 — mutasyonla
  sınandı: dusun'a fetch eklenince test kırmızı); bilmiyorum/yapamadım cümleleri; NPC tanımı bekçisi (her örnek gerçek Flash köprüsünden
  LLM'siz geçer, doğurduğu niyeti bedeni yapabilir); karar kaydının konsola gitmemesi; koltuk kuralı (yürütücü + defter); çip modeli;
  Flash şeması ve beslemesi; şema çizimi (kaydedici bağlam: Orion başlık/toplam aynı, Flash'ta DÜŞÜNCE yok).
- [ÖLÇÜLDÜ başsız] iki beden gerçek glb ile (`world/avatar/ikinciBeden.test.ts`); Flash bağlantısı uçtan uca (`flashBaglantisi.test.ts`:
  sohbet hedefi → Flash'ın bedeni gerçekten oturuyor; Orion sandalyedeyken Flash altyazıda "Yapamadım: … dolu: Orion orada" diyor).
- [YAZILDI-KOŞULMADI] DOM: Zihin sekmesindeki çipler, sohbet hedef çipleri, Tab döngüsü, yer tutucu metin; Flash'ın gerçek ekranda rengi,
  ışık üyeliği (ofis içi/dışı), kapının Flash'a açılması, ajandanın ritmi, takip yürüyüşü.
- `npm run typecheck` temiz; `npm test` 4405 testten yalnız bilinen kırmızı ("ova bütün yerleşimleri dönüşsüz", Ozyn'in level WIP'i);
  `npx vite build` geçti.

## 4. Bilinen açıklar

1. **Bedenler birbirine çarpmaz:** yol bulma Yer'in engellerini bilir, öbür bedeni bilmez; Orion ile Flash iç içe geçebilir.
2. **Orion Flash'tan haberdar edildi (2026-10-21, Ozyn'in isteği)** — Orion'un koduna/dünya satırına DOKUNULMADAN: Hafıza sekmesinde `flash.md` notu (host/mdDosyalari.js `EK_TOHUMLAR`; eski kullanıcının klasörüne de bir kez yazılır, `_ayar.json` `tohumlandi` kaydıyla, AKTİF başlar). Talimatın sonuna NOTES olarak girer; Ozyn düzenler ya da sağ tık → "Bağlamdan çıkar" ile kapatır. [ÖLÇÜLDÜ] bağlama +365 karakter (≈+121 token, karakter/3 kaba tahmin; mevcut talimat 2054 karakter). [YAZILDI-KOŞULMADI] Orion'un davranışına/sadakatine etkisi ölçülmedi (`eylem-olc`/`sadakat-olc` koşulmadı); not ilk sürümde 767 karakterdi, "bağlama giren her satır ölçülür" kuralı yüzünden kısaltıldı. Hâlâ yok: Orion'un algı hizmetinde Flash. (Fareyle seçim 2026-10-21'de eklendi: Flash'a sol tık seçer + çerçeve, sağ tık komut menüsü açar.)
3. **Flash'ın sesi yok** (TTS Orion'un); konuşması altyazı + günlük. "İkisi birden"de iki cevap artık alt alta YIĞILIR (2026-10-21, `uygulama/altyazi.ts` `ekle`; her satır adını taşır, en çok 3, 2,5 sn pencere): [TEST] saf yığma mantığı; DOM görünümü canlıda görülmedi.
4. **Hitap:** "Flash otur" / "Flash, otur" → Flash'a "otur" gider (2026-10-21, `AjanKaydi.hitapAyiklar`, yalnız Flash; Orion'un metni AYNEN gider). Başka ajanın adıyla hitap ("Orion beni takip et", hedef Flash) hâlâ ayıklanmaz: Flash "bilmiyorum" der.
5. **Flash köprüsünün konsol satırları** (`[KOMUT]`, `[TAKIP]`, `[BAGLAM]`…) Orion'unkilerle aynı önekte; ayırt etmek için önek yok (karar kaydı ayrı, sorun yok).
6. **Zihin sekmesinde Flash'ın sayfası tıklanmaz** (detay görünümü duvara ve devre panosuna bağlı).
7. **Ölçüm araçları Flash'ı görmez:** Flash'ın karar kaydı bellekte; kullanım ölçüsü elle (kullanım defteri) tutulur.
8. Küme/departman seçimi, 300 ajan, LOD, NPC rutinleri — plan dilim 6 (SONRA).

## 5. Dünyayı etkileyen riskler

- Flash elle açılışta HER ZAMAN kurulur (ikinci glb yüklemesi, ~1 avatar maliyeti; VRAM/kare süresi ÖLÇÜLMEDİ). Sorun olursa `?flashsiz`.
- Orion'un `otur`u artık Flash sandalyedeyse hata döner (yeni durum; Orion'un LLM'i bunu "dolu: Flash orada" diye görür). Flash yokken davranış aynı.
- Sohbet hedefi hatırlanır: Ozyn bir kez Flash'ı seçerse sonraki açılışta da Flash seçili gelir (yer tutucu "→ Flash" ve altyazı "sen → Flash" söyler).
- Senaryolarda Flash kurulmadığı için `*dene` koşuları Flash'ı DOĞRULAMAZ; canlı kanıt yalnız aşağıdaki elle deneme.

## 6. Canlı deneme listesi (Ozyn'le birlikte; pencere açmadan ÖNCE sorulur)

`npm start` (senaryosuz, elle açılış). Her adımda altyazı + günlük + Zihin sekmesi (Y → Zihin → Flash çipi) izlenir.
1. Odada amber renkli ikinci beden ofiste (−1,2; 0,6) duruyor mu; Orion'un rengi değişmedi mi; ışık doğru mu (ofis içi).
2. T → çip şeridi Orion | Flash | İkisi görünüyor mu; Tab hedefi değiştiriyor mu; yer tutucu "→ Flash" diyor mu.
3. Hedef Flash: "otur" → Flash sandalyeye yürüyüp oturuyor mu; Orion kıpırdamıyor mu; Zihin · Flash: ALGI→DİKKAT→KOMUT→BEDEN yanıyor mu.
4. Hedef Flash: "kalk", "bana gel", "pencereye bak", "beni takip et" (yürü, takip ediyor mu), "takibi bırak".
5. Hedef Flash: "bugün hava nasıl" → "Bunu bilmiyorum. Bildiklerim: …"; "oturabilir misin" → «otur» önerisi; BİLMİYORUM düğümü yanıyor mu.
6. Hedef Flash: "bilgisayarı aç" → "Yapamadım: Flash bunu yapamaz (odaklan)…"; BEDEN düğümü arızalı mı.
7. Hedef İkisi: "otur" → biri oturuyor, öbürü "dolu" diyor mu (genelde Orion oturur, Flash "Yapamadım: … dolu: Orion orada"; tersi
   olursa Orion'un LLM'i "dolu: Flash orada" hatasını görüp açıklar — bir model turu harcar).
8. Orion otururken hedef Flash "otur" → aynı hata; Orion kalkınca Flash oturabiliyor mu.
9. Mikrofon (K, V): hedef Flash iken İngilizce "sit down" Flash'a gidiyor mu.
10. Kullanım defterine "Flash yetti mi?" satırı (bkz. `docs/kullanim-defteri.md` Flash bölümü).

## 7. Sonradan eklenenler (2026-10-21, Ozyn'in istekleriyle)

**7.1 Fareyle seçim ve menü.** Flash'a sol tık seçer (sarı çerçeve, tek çerçeve kuralı), sağ tık Flash'ın komut menüsünü açar (Otur/Kalk, Bana gel, Beni takip et, Takibi bırak, Pencereye bak, Özellikler). Zemin ve nesne menülerinde de "Flash ▸ …" girişleri var (Orion'unkiyle aynı eylem verisi; niyet Flash'ın kendi beden kapısından geçer: `AjanKaydi.niyet`). Menüdeki her söz komut sözlüğünce tanınır (bekçi testi). [TEST] 25+ test; [YAZILDI-KOŞULMADI] görünüm.

**7.2 Orion → Flash emri (`dunya_emret`).** Yeni niyet `{emret, kime, soz}` (protokol, doğrulayıcı, araç tablosu, yürütücü, `uygulama/ajanlar/emir.ts`). Teslim = "yapıldı" değil: komut Flash'ın girdisine Ozyn'in yazdığı gibi gider, Flash kendi kapısından geçirir, sonucu Orion'a dönmez. Kurallar: Orion kendine emredemez; olmayan ajan nedenli reddedilir (kimlerin olduğu söylenir); özerk turda sunulmaz (Ozyn yokken emir yok); beceri refleksi tekrarlamaz (`engel`). **Araç YALNIZ Flash varken sunulur** (`KopruAyari.emirHedefleri`): Flash yokken (`?flashsiz`, senaryolar) Orion'un araç yüzeyi eskisiyle birebir aynı (1704 token); Flash varken +≈88 token (ölçüldü 1792, rakam /4 kaba tahmin). Orion'un Flash notu (`flash.md`) aracı adıyla anlatır (parite testi). [TEST] mutasyon: araç koşulsuz sunulursa/kendine emir serbest olursa test kırmızı. [YAZILDI-KOŞULMADI] Orion'un modeli aracı gerçekten doğru çağırıyor mu (eylem-olc koşulmadı); +88 token'ın yerel modele etkisi ölçülmedi. Emir Flash'a gitmeden Ozyn'e "Orion → flash: otur" altyazısı görünür.

**7.3 Flash KESİNLİKLE LLM'siz (bekçi).** `tools/flashLlmsiz.test.ts`: `flash/` ve `uygulama/ajanlar/` hiçbir model/ağ modülünü import edemez (Ollama, API, harici beyin, MCP, görme, beyin seçimi), ağa çıkan API (fetch, WebSocket, XHR, süreç) kullanamaz, `mind/refleks.ts`'ten yalnız kural tarafını (`KuralRefleksi`, `refleksGirdisi`) alabilir (küçük model refleksi Ollama'ya konuşur). Runtime tarafı: `flash/beyinsizBeyin.test.ts` (ağ sayacı 0).

**7.4 Bağlamı şişirmeme ayarları.** Orion hafızadan YALNIZ SORULANI getirir (spec 16); her turda giden tek şey md notlarıdır (spec 32) ve biriken ham anılar (otomatik sıkıştırma). İkisi de ayarlanabilir: devre panosu telleri (`PANO_TELLERI.hafiza`; duvar ya da Zihin sekmesi → HAFIZA → ayar) `hafiza.oto_esik` (varsayılan 100 ham anı; 55–1000), `hafiza.oto_aralik` (15 dk; 1–240), `hafiza.md_toplam` (5000 karakter; 500–20000), `hafiza.md_dosya` (2000; 200–8000). Değerler `localStorage`'a kalıcı (`uygulama/hafizaAyari.ts`); bozuk/aralık dışı kayıt atlanır ve konsola söylenir. Varsayılanlar eski sabitler: ayar yapılmazsa davranış DEĞİŞMEZ. Eşik alt sınırı KORU+EN_AZ_PLAN=55: altında plan hiç oluşmaz. [TEST] eşik/aralık/bütçe canlı okunuyor (depo ve köprü aynı teli okur), kalıcılık, aralık kapısı. [YAZILDI-KOŞULMADI] panelde düğmelerin görünüşü ve sürgü kullanımı.
