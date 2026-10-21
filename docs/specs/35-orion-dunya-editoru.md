# Spec 35 — Orion dünyanın editörü, Ozyn mimar: Blueprint benzeri JSON düğüm grafiği

Tarih: 2026-10-21 · Durum: **Dilim 0 bitti** (biçim + tür denetimi + saf yorumlayıcı, testli) · **Dilim 1 YAZILDI** (ajan düğümleri, grafik deposu, Graf sekmesi; testli, başsız; Graf sekmesi ve ajanların gerçek yürüyüşü canlıda GÖRÜLMEDİ) · **Dilim 2 YAZILDI** (NPC davranışı: ⚡ olay dinleme, değişkenler + koşul, seçimli diyalog, nöbetçi şablonu; testli, canlıda GÖRÜLMEDİ, §4c) · dilim 2b (görsel editör), 3–5 sırada.
Plan: `C:\Users\ozigo\.claude\plans\expressive-coalescing-mist.md` (onaylı). Araştırma: Opus ajanı raporu (scratchpad `modulerlesme-arastirma/rapor.md`).

## 1. İstek ve kararlar (Ozyn, 2026-10-21)
- "Orion etrafındaki tüm objeleri ve NPC Flash'ları belli sınırlarda editleyebilsin; **Orion bu dünyanın editörü olacak, ben de mimar**."
- "Hem Orion hem ben kodu yazabileyim ama **çalıştırmak için benim Çalıştır tuşuna basmam** gereksin."
- "Yaptığı deseni JSON'la bir grafikte parça parça alıp sonra kullanabilelim; 'x objesini al'ı her seferinde yazmıyoruz; **node graph, Blueprint, UE5** gibi."
- **İstisna verildi** (odak kuralı bu iş için askıda; `world/level/`'a yeni özellik girmez). Onay biçimi: **öneri paketi, tek ▶** (fark görülür, tek tuşla uygulanır/reddedilir, tek adımda geri alınır).

## 2. Çekirdek: grafik = program = öneri
- Her program bir **düğüm grafiği** (JSON, `protocol/graf.ts`). Orion'un önerisi bir grafiktir; ▶ grafiği çalıştırır. Dünya düzenlemeleri de düğümdür (ayrı bir "değişiklik seti" biçimi yok).
- **Desen** = kaydedilmiş fonksiyon grafiği (girişli/çıkışlı); `desen.cagir` ile **tek düğüm** olarak yeniden kullanılır (Blueprint fonksiyonu).
- **Biçim bizim**: editör kütüphanesi yalnız görünüm; LLM bizim şemamızı yazar.
- **Sandbox gerekmez**: grafik yalnız kütüphanedeki düğümleri dizer; kütüphanede olmayan şey (terminal, güvenlik/onay ayarları, protokol, level DOSYASI) yapılamaz.

## 3. Anlam (UE5 Blueprint ile aynı)
- `akis` pinleri yürütme sırasını taşır; bir akış çıkışından en çok bir bağ (dallanma: **Sıra**), akış döngüsü yasak (tekrar: **Tekrar**).
- Veri girişi: bağlıysa kaynaktan (SAF düğüm her istekte yeniden hesaplanır; akışlı düğümün çıkışı son çalışmasından — çalışmadıysa HATA), bağsızsa aynı adlı ayardan.
- Çalışmadan ÖNCE tür denetimi (hata varsa hiç başlamaz). Tavanlar: 1000 adım, 120 sn, desen derinliği 5, Tekrar ≤ 100, Bekle ≤ 10 sn. **■ Durdur** her adımda ve her beklemede.
- Her düğüm başlarken `dugum` olayı (editörde aktif düğüm vurgusu, günlük).

## 4. Dilim 0 — yapıldı [TEST]
| Dosya | İş |
|---|---|
| `protocol/graf.ts` | biçim + elle doğrulayıcı (temiz kopya, tavanlar, hata yeri) |
| `uygulama/graf/dugumKaydi.ts` | düğüm türü kaydı (pinler ayara/desene göre, ayar aralıkları, saf/olay, yetenek) |
| `uygulama/graf/grafTurDenetimi.ts` | "Kontrol et": tür uyumu, pin varlığı, tek bağ kuralları, döngüler, Başla/Fonksiyon girişi, kendini çağıran desen |
| `uygulama/graf/yorumlayici.ts` | saf yorumlayıcı (akış, veri, dallar, desen çerçeveleri, tavanlar, Durdur, olaylar) |
| `uygulama/graf/cekirdekDugumler.ts` | ▶ Başla, Fonksiyon girişi/dönüşü, Sıra, Tekrar, Eğer, Bekle, Desen, Sayı/Metin/Bool, Karşılaştır |

36 test (biçim 11, yorumlayıcı + denetim 25). Bozma denemesi: 5/5 yakalandı (Tekrar indeksi, Durdur, çift akış bağı, desen derinliği, bilinmeyen alan). Durdur testi bozulunca sonsuza dek asılı kalıyordu → testine zaman aşımı eklendi (artık kırmızı yanar).

## 4b. Dilim 1 — ajan düğümleri, depo, Graf sekmesi [TEST · canlıda GÖRÜLMEDİ]
| Dosya | İş |
|---|---|
| `uygulama/graf/grafYetenegi.ts` | grafiğin dünyaya TEK kapısı (`GrafYetenegi`): ajan listesi, ajana niyet yürüt + sonucu bekle, Ozyn'in yerindeki nesneler/çapalar |
| `uygulama/graf/ajanDugumleri.ts` | `ajan.git` `ajan.bak` `ajan.otur` `ajan.kalk` `ajan.soyle` `ajan.jest` + saf `ajan.sec`, `nesne.bul` |
| `uygulama/graf/kutuphane.ts` | kütüphane v1 (çekirdek + ajan) ve "＋ Yeni" şablonları (çalışan örnek grafik ve desen) |
| `uygulama/graf/grafCalistirici.ts` | ▶/■ denetimcisi: tek çalışma, canlı satır (düğüm kimliği + tür adı, desen derinliği), son sonuç |
| `uygulama/graf/grafDeposu.ts` | grafik/desen deposu: yazmadan önce `grafDogrula`, ad = dosya adı, kanonik metin, bozuk dosya nedeniyle listede |
| `uygulama/dosyaDeposu.ts` · `host/dosyaKlasoru.js` | md deposundan GENELLEŞTİRİLEN ortak çekirdek (renderer + host); `mdDeposu.ts` ve `host/mdDosyalari.js` artık bunun üstünde |
| `host/grafDosyalari.js` | `<userData>/orion-graf/<ad>.json`; IPC `graf:liste/oku/yaz/yeni` (çalıştırma kanalı YOK) |
| `uygulama/yapi/grafSekmesi.ts` | Yapı çubuğu · **Graf** sekmesi (MVP, görsel editör değil): Grafikler/Desenler kartları, Kontrol et, ▶ Çalıştır, ■ Durdur, Aç (JSON düzenleyici), ＋ Yeni grafik/desen |
| değişen | `dugumKaydi`/`grafTurDenetimi`/`yorumlayici` (`bekleVeyaDur`, `durdurulunca`, dinamik seçenek, hatanın grafiği), `niyetYurutucu.avatarAdimi` (önek parametresi), `nesneEylemleri.nesneHedefleri` (menüyle ortak hedef kuralı), `AjanKaydi.sonucDinle/soyle`, `kopruDinleyicileri.orionKonusmasi`, `editorPenceresi.degistiNotu`, `giris.ts` kablosu |

49 yeni test (ajan düğümleri + çalıştırıcı 32, depo 11, host dosyaları 6); bütün takım 4677, tek kırmızı bilinen "ova bütün yerleşimleri dönüşsüz". `typecheck` temiz, `vite build` scratchpad'e geçti.

### Kararlar ve nedenleri
- **Sonuç BEKLENİR.** Eylem düğümü niyeti `niyetDogrula`dan geçirir, ajanın kapısından yürütür ve sonucunu bekler: `bitti` → devam; `hata` → düğüm hatası, ajanın nedeni aynen ("Flash: hedefe giden yol yok…"); `iptal` → düğüm hatası ("iş kesildi": başka niyet araya girdi). Bekleme `avatarAdimi`nın AYNISI (dinleyici göndermeden önce kurulur), kopya değil. Tek adım tavanı 60 sn (ölçülmedi; grafiğin 120 sn'lik toplam tavanı yalnız düğüm başlarken bakılır): aşılırsa düğüm düşer **ve beden durdurulur**.
- **■ Durdur beklerken keser ve dünyayı da durdurur.** Yorumlayıcıya iki yetenek: `bekleVeyaDur(söz)` (■ önce gelirse çalışma `durdu`) ve `durdurulunca(f)` (■'de bir kez). Ajan düğümü ■'de ajana **aynı kapıdan `dur`** gönderir (yürüyüş `iptal` olur); söz sürüyorsa Orion'un sesi kesilir (`orionSesi.kes`). `dur` "iş bitti mi" diye bakılmadan gönderilir: zararsızdır, bakmak yarış doğurur. Çalışma bittikten sonraki ■ hiçbir şey kesmez.
- **Kimlik öneki `elle`**: grafiği Ozyn'in ▶'si yürütür; hatası Orion'un LLM'ini uyandırmaz (`refleks.sonuc.elle_hata`), benlik "Ozyn yaptı" der. (`program` öneki Orion'u her graf hatasında uyandırırdı.)
- **TEK EYLEM YOLU:** Orion'un niyeti `niyetiYurut`tan, sonucu bedeninin `sonucDinle`sinden; Flash'ınki `AjanKaydi.niyet` (kendi bedeni). Orion'un defter kaydına `niyet` EKLENMEDİ (menüde "Flash ▸ …" girişleri `niyet`i olan ajanlardan çıkar; Orion'un çift girişi olurdu) — kapısı `giris.ts`'te `grafKapisi`.
- **Söyle niyet değil, söz hattı.** Avatar `soyle`yi reddeder, `niyetiYurut` sessizce bırakır (köprü TTS'e zaten vermiştir). Grafiğin Söyle'si ajanın söz hattına gider: Orion'da köprü cevabıyla AYNI işlev (`orionKonusmasi`: altyazı + günlük + Piper — **iki cümle kısaltması dahil**), Flash'ta aynı satır (altyazı + günlük, ses yok; okuma süresi kadar beklenir ki sonraki düğüm altyazıyı ezmesin).
- **Hedef türü ayarla seçilir** (`hedef`: `ozyn` | `capa` | `nesne`, Bak'ta `serbest`): bağsız veri girişi ayar ister (isteğe bağlı pin yok), pin listesi seçime göre değişir. Nesneye giden hedef menüyle aynı kuraldan (`nesneHedefleri`: çapalıysa çapa, değilse nokta + yarıçap). Ayrı `ozyn` düğümü ve `ajan.poz` gerekmedi, yapılmadı.
- **Ajan seç'in seçenekleri çalışma anında defterden**: `AyarTanimi.secenekler` artık fonksiyon da olabilir, `PinOrtami.ajanlar` defteri verir. Bilinmeyen kimlik DENETİMDE hata ("seçenekler: orion"); denetimden sonra defter değişirse çalışma anında da bakılır. Ortam ajan listesi vermezse liste BOŞ sayılır (sessiz geçiş yok). Bağsız `kim` ayarı da aynı listeden denetlenir.
- **Nesne bul**: önce tam ad/kimlik, sonra adın içinde geçen; birden çok aday HATA (ilkini seçmek yanlış yere yürütürdü), bulunamazsa var olanlardan sekizi söylenir. Hatası Nesne bul düğümünün kendi kimliğiyle döner.
- **Canlı satır saf düğümleri göstermez** (ilk denemede "Git yürüyor" yerine "Ajan seç" yazıyordu).
- **Depo genelleştirildi, kopya yok.** Host: `host/dosyaKlasoru.js` (atomik yazım, yok/var, ad, boyut, dizin önceliği); md ve graf onun üstünde. Renderer: `uygulama/dosyaDeposu.ts` (IPC açıcı, localStorage kaynağı, çalışmayan kaynak, iş sırası); md'nin yerel kayıt biçimi aynı kaldı (`orion.md.v1` geriye uyumlu). Bütün md testleri değişmeden yeşil.
- **Biçim renderer'da, kabuk yalnız tutar**: Kabuk protokolü import edemez. Grafik adı kuralı host'ta bilerek kopya (dosya adı = grafın adı); `host/grafDosyalari.test.ts` protokolün `grafAdiGecerli`siyle 19 örnekte karşılaştırır, ayrışırsa kırmızı. (Bu testi yazarken bulunan hata: geçersiz ad çekirdeğe olduğu gibi bırakılınca "x.json" adı "x" grafiğinin üstüne yazılıyordu; düzeltildi.)
- **Tür denetimi kaydı ENGELLEMEZ** (yarım program kaydedilebilir); biçim hatası engeller. Kaydedilen metin temiz kopyanın kanonik hâlidir (düğüm/bağ başına bir satır; bilinmeyen alanlar atılır; düzenleyici bunu söyler). İçerikteki `ad` dosya adından farklıysa kaydedilmez (başka adla = ＋ Yeni). Bozuk dosya listede nedeniyle durur, çalıştırılamaz.
- **▶ yalnız Ozyn'in gerçek tıklaması**: sekme `isTrusted` olmayan tıklamayı yok sayar; bekçi testi `calistirici.calistir(` çağrısının üretimde yalnız `uygulama/yapi/grafSekmesi.ts`'te olduğunu ve bridge/mind/flash'ın `uygulama/graf/`'a uzanmadığını sınar. ▶ anındaki grafik kopyalanır (çalışırken kaydetmek süren çalışmayı değiştirmez; desenler çağrı anında okunur).

### Bozma denemesi (dosya önce scratchpad'e yedeklendi, her deneme `timeout 120`, sonra yedekten geri kondu ve `cmp` ile aynı olduğu doğrulandı)
| # | bozma | sonuç |
|---|---|---|
| 1 | eylem düğümü sonucu beklemez | **yakalandı**: 12 test kırmızı ("Git sonucu BEKLER", hata/iptal, ■, zaman aşımı…) |
| 2 | ■ kancası boş (ajana `dur` gitmez) | **yakalandı**: 2 kırmızı (■ beklerken `dur`, ■ söz susturma) |
| 3 | Ajan seç seçeneksiz | **yakalandı**: 2 kırmızı (denetimde hata, dinamik liste); çalışma anı denetimi ikinci savunma olarak sağlam kaldı |
| 4 | depo doğrulamadan yazar | **yakalandı**: 3 kırmızı (bozuk diske gitmez, ad = dosya adı, kanonik metin) |
| 5 | `bekleVeyaDur` ■'yi dinlemez | **yakalandı** ama yalnız söz testinde, ZAMAN AŞIMIYLA (3 sn): beden testlerinde sahte beden `dur`u `iptal`le cevapladığı için bekleme yine bitiyor — gerçek avatar da öyle yapar, ama `dur`a cevap vermeyen bir beden ■'yi asardı (yalnız söz testi korur) |

### Canlı deneme listesi (Ozyn; pencere açan koşu Ozyn'e sorulmadan yapılmadı)
1. `npm start` → Tab (imleç kipi) → Y → **Graf** sekmesi. "Henüz grafik yok" görünmeli.
2. **＋ Yeni grafik** → ad `selam` → Enter: düzenleyici JSON'la açılır. Kapat; kartı seç → **Kontrol et** → "✓ hata yok".
3. **▶ Çalıştır**: Flash Ozyn'e yürür (canlı satır `gel (Git)`), varınca üç kez el sallar (low-poly bedende el sallama klibi YOK: `jestUygula` boş, görünmeyebilir; satır `salla (Jest)` / `ara (Bekle)` göstermeli), sonra "Merhaba Ozyn!" altyazısı; son satır `✓ selam bitti · … adım`.
4. Tekrar ▶, Flash yürürken **■**: Flash hemen durmalı, satır `■ selam durduruldu · son düğüm: gel (Git)`.
5. JSON'da `"ajan": "flash"`ı `"orion"` yap → Ctrl+S → ▶: aynı programı Orion yapar (Söyle'de Piper sesi; Orion'un LLM'i bu sırada uyanmamalı).
6. JSON'u boz (virgül sil) → Ctrl+S: "KAYDEDİLEMEDİ: JSON okunamadı…", dosya değişmez. `"ajan": "hayalet"` → kaydedilir; Kontrol et "s.ajan: 'hayalet' geçersiz (seçenekler: orion, flash)".
7. **＋ Yeni desen** `selamla`; yeni bir grafikte `{"id":"c","tip":"desen.cagir","ayar":{"desen":"selamla"}}` + `kim` bağı → ▶: canlı satırda `desen 'selamla' (derinlik 1)`.
8. Git'e ulaşılamaz hedef ver (`"hedef":"capa","capa":"kapi_disi"` gibi): son satır `✗ … gel (Git): Flash: bilinmeyen çapa/nesne…`.
9. `npm run dev` (Electron'suz): grafikler localStorage'da tutulur (konsolda uyarı).

## 4c. Dilim 2 — NPC davranışı: olay tetikleyici, değişkenler + koşul, seçimli diyalog [TEST · canlıda GÖRÜLMEDİ]
Amaç: Orion'un kuracağı LLM'siz NPC'ler (kapı nöbetçisi, barmen, kılıç satıcısı) için grafik motoruna üç yetenek (Ozyn, 2026-10-21). Kuzey yıldızı demo: **nöbetçi** şablonu.

| Dosya | İş |
|---|---|
| `uygulama/graf/olayDugumleri.ts` | dünya olayı düğümleri `olay.ozyn_yaklasti` · `_uzaklasti` · `_bakti` · `_yuzeye_gecti` · `_yuzeyden_cikti` (ayar `ajan`; çıkış `sonra`, `ajan`, `mesafe`/`yuzey`) |
| `uygulama/graf/grafDinleyici.ts` | ⚡ **dinleme ("KUR")**: dinlemeye al / bırak / hepsini bırak / ■; olay yolu (`olayYoluKur`); tavanlar; yalnız bellekte |
| `uygulama/graf/grafDurumu.ts` | grafik başına değişken alanı (bellekte), tavanlar |
| `uygulama/graf/durumDugumleri.ts` | `degisken.oku` · `degisken.yaz` · `degisken.artir`, `mantik.ve` · `mantik.veya` · `mantik.degil`, `saat.gun_vakti`, `metin.birlestir` |
| `uygulama/graf/diyalogDenetimi.ts` | seçimli diyalog denetimcisi (saf): tek diyalog, zaman aşımı, kapat, istek doğrulama |
| `uygulama/yapi/diyalogKutusu.ts` | diyalog kutusu (DOM): altyazının üstünde, ajan renkli başlık, tık ya da 1–4; saf `diyalogTusu` |
| değişen | `ajanDugumleri.ts` (`diyalog.sec`), `dugumKaydi.ts` (`tetik`, `degiskenler`, `saat`, `dunyaOlayi`), `grafTurDenetimi.ts` (giriş kuralı), `yorumlayici.ts` (`giris`), `grafCalistirici.ts` (ortak `calismaBaslat`, `mesgul`), `grafYetenegi.ts` (`diyalogAc`), `kutuphane.ts` (kayıt + `nobetciSablonu` + `GRAF_SABLONLARI`), `ajanlar/ajanAlgisi.ts` (`olayDinle`), `ajanlar/flashBaglantisi.ts` (`olayDinle`), `yapi/grafSekmesi.ts`, `giris.ts` kablosu |

Testler: `uygulama/graf/npcDavranisi.test.ts` (31), `uygulama/graf/durumDugumleri.test.ts` (18), `uygulama/ajanlar/ajanAlgisi.test.ts` (+2). Bütün takım: bkz. aşağıdaki bozma tablosunun altı.

### Kararlar ve nedenleri
- **GÜVENLİK (değişmez): çalıştırma yalnız Ozyn'in gerçek tıklaması.** Olay tetikli çalışma bunu "KUR (silahlandır)" modeliyle korur: Ozyn Graf sekmesinde seçili grafiği **⚡ Dinlemeye al** (▶ gibi `isTrusted`; betikten tık yok sayılır). Olay YALNIZ dinlemedeki grafiği yürütür; dinlemede olmayanın olay düğümü ölü koddur. Bekçiler (`npcDavranisi.test.ts`): `.dinlemeyeAl(` üretimde yalnız `uygulama/yapi/grafSekmesi.ts`'te; ▶ ve ⚡ çağrısının tıklama işleyicisi çağrıdan ÖNCE `if (!e.isTrusted` taşır; bridge/mind/flash dinleyiciye/diyaloğa uzanmaz; dinleyici ve durum dosyalarında depolama/IPC adı geçmez.
- **Dinlemeye alınan KOPYADIR** (▶ gibi): dosya sonradan değişse (Ozyn, ileride Orion'un önerisi) dinlenen program değişmez; Ozyn'in onayladığı şey çalışır. Yeni hâl için bırak + yeniden kur.
- **Durdurmak her zaman serbest**: "Dinlemeyi bırak", "hepsini bırak" ve ■ `isTrusted` istemez (güvenlik yönü). ■ bütün süren çalışmaları (▶ + olay) durdurur, dinlemeyi BIRAKMAZ; bırak hem dinlemeyi kapatır hem süren çalışmasını durdurur.
- **Uygulama kapanınca dinleme kalmaz**: liste yalnız bellekte; bir sonraki açılışta Ozyn yeniden kurar. Değişkenler de yalnız bellekte (kalıcı durum = sürüm/göç/bozuk dosya sözleşmesi; bugün gerek yok).
- **Tavanlar**: aynı grafik aynı anda TEK çalışma — çakışan olay kuyruğa girmez, **atlanır ve sayılır** (kuyruk, Ozyn uzaklaştıktan sonra eski bir "yaklaştı"yı oynatırdı); ▶ ile olay çalışması da birbirini görür (▶ sürerken olay atlanır, olay sürerken ▶ nedenle reddedilir). Olay düğümü başına soğuma 5 sn (olay üreticisinin 4 sn'sine ek; ölçülmedi). En çok 8 dinleyen grafik.
- **Olay kaynağı ajanın gözü** (`ajanAlgisi.ts`): `olayDinle` abonesi aynı üretilen olayı köprüyle birlikte alır — ikinci üretici yok. Sıra: köprü → NPC tanımının refleks tepkisi → abone (grafiğin ilk niyeti tepkinin niyetinden SONRA bedene ulaşsın; tersinde refleksin "bak"ı grafiğinkini iptal eder, grafik "iş kesildi" der). Bir abonenin hatası köprüyü kesmez.
- **Orion'un olayları grafiğe AÇIK DEĞİL** (yalnız gözü olan LLM'siz ajanlar; bugün Flash): Orion'un kendi LLM'i aynı olaya zaten tepki verir; grafik de aynı bedeni sürseydi iki karar verici yarışırdı (§7'deki açığın olay hâli). `ajan: "orion"` olay düğümlü grafik denetimden geçer ama dinlemeye alınırken nedenle reddedilir ("Orion'un olaylarını kendi LLM'i dinler").
- **Tür adları küçük harf**: protokolün tür deseni (`[a-z0-9_]`) büyük harf kabul etmiyor; istekteki `olay.ozynYaklasti`/`saat.gunVakti` → `olay.ozyn_yaklasti`/`saat.gun_vakti` (protokole dokunulmadı).
- **Olay grafiğinin girişi**: en çok bir ▶ Başla ve en az bir giriş (Başla ya da olay düğümü). İkisi aynı grafikte olabilir: Ozyn önce ▶ ile dener, sonra dinlemeye alır (akış GİRİŞİNE birden çok bağ zaten serbest). ▶ olay düğümünden başlamaz (Başla'sız grafik ▶'de "olayla çalışır: ⚡ Dinlemeye al"). Desende olay düğümü yok (dinleme grafiğe kurulur).
- **Değişkenler**: ad alanı = kök grafiğin adı (▶ ve olay aynı sayacı görür; barmen nöbetçinin durumunu göremez); desen çağıranın alanını kullanır. Tür düğümde (`tip`: sayi/metin/bool), Oku'nun pin türü buna göre — denetim Eğer'e metin bağlanmasını yakalar; alanda başka türde değer okumak HATA (sessiz dönüşüm yok); hiç yazılmamış = türün sıfırı (sayaç kurulumsuz). Tavanlar: grafik başına 32 değişken, metin 200 karakter, sayı sonlu, 64 grafiğin alanı; aşan yazma nedenle düşer (sessiz kesme/silme yok). Graf sekmesi seçili grafiğin durumunu gösterir, **Durumu sıfırla**.
- **Gün vakti** `mind/zaman.ts` `gununVakti`'nden türer (kopya sınır yok): 05–12 sabah, 12–17 öğle, 17–21 akşam, 21–05 gece. `gununVakti` yeni söz üretirse eşleme fırlatır; bekçi test bütün saatleri tarar. Saat bilgisayarın yerel saatidir (oyun içi gündüz/gece önayarı değil).
- **Mantık**: Ve/Veya/Değil yalnız bool alır; Veya kısa devre yapmaz (bozuk b girişi a doğru diye gizlenmesin). Mevcut Eğer/Karşılaştır'la çalışır (test: "(ziyaret > 1) VE DEĞİL(gece)").
- **Seçimli diyalog** (`diyalog.sec`): seçenekler `secenek1…secenek4` ayarı, sırayla ve boşluksuz (3 dolu 2 boşsa HATA: Ozyn'in bastığı numara başka dalı yürütürdü); çıkış pinleri `"1"…"n"` (tuşla aynı numara), `zamanAsimi`, `secilen`, `secilenMetin`. Süre 3–60 sn (varsayılan 30). Seçenek yok/tek/boş/uzun → denetimde nedenli hata. **Ekranda tek diyalog**: ikinci NPC'nin diyaloğu nedenle düşer (kuyruk yok: soru anı geçmiş olurdu). ■ ve bırakma diyaloğu ekrandan HEMEN kaldırır (`durdurulunca`); geç gelen seçim yok sayılır. Diyalog NPC'nin sözünü sesli okumaz (kutu metni gösterir; Orion'da bile Piper yok).
- **1–4 tuşu oyuna sızmaz**: diyalog açıkken pencereye yakalama evresinde dinlenir ve yutulur (`stopImmediatePropagation`: hızlı deneme tuşları "1" → Orion tahtaya yürür, alt çubuğun 1–9'u görmez); 3 seçenekte "4" de yutulur. Tuş serbest değilse (sohbet açık, terminal odakta, onay bekliyor, yazı alanı, Ctrl/Alt) diyalog tuşa dokunmaz — `tusSerbest` deseni. Seçim de yalnız gerçek tık/tuş (`isTrusted`).
- **Kopya yok**: ▶ çalıştırıcısı ve dinleyici aynı `calismaBaslat` çekirdeğini kullanır (saf düğüm canlı satırda görünmez, hata yeri, son sonuç tek yerde).
- **Diyalog kutusu dosyası `uygulama/yapi/`'de**: ilk deneme `uygulama/diyalogKutusu.ts` idi, o yazma oturumun izin kipi yüzünden reddedildi; DOM parçası olduğu için Graf sekmesinin yanına kondu.

### Nöbetçi şablonu (Graf sekmesi · ＋ Yeni grafik · şablon "Nöbetçi")
⚡ Ozyn Flash'a yaklaşınca (ya da ▶): Flash Ozyn'e döner → `ziyaret` +1 → gece (21–05) ise "Gece vardiyası. Fenerini indir, yüzünü göreyim!", değilse "Hoş geldin yolcu. Ziyaret: N" → "Dur! Parola?" (1 Ay ışığı · 2 Bilmiyorum · 3 Sana ne!) → 1: "Geç.", 2/3: "Geçemezsin.", 30 sn cevapsız: "Cevap yok mu? Geçemezsin." Uçtan uca testli (gündüz iki ziyaret, gece + zaman aşımı, ▶).

### Bozma denemesi
Betik: her mutant tek dosyada tek değişiklik; dosya önce scratchpad'e yedeklendi, ilgili test dosyası `timeout 120` ile koşuldu, dosya yedekten geri kondu ve bayt bayt aynı olduğu doğrulandı (14/14 AYNI; `git checkout` kullanılmadı).

| # | bozma | sonuç |
|---|---|---|
| 1 | ⚡ Dinlemeye al `isTrusted`a bakmıyor (dinleme ▶'siz/betikle kurulabilir) | **yakalandı**: bekçi "▶ ve ⚡ işleyicisi isTrusted'a bakar" |
| 2 | olay yolu olayı BÜTÜN ajanların abonelerine veriyor (yanlış ajan tetikler) | **yakalandı**: "YANLIŞ AJANIN olayı tetiklemez" |
| 3 | çakışan olay: süren çalışma varken yeni çalışma başlıyor | **yakalandı** — ilk koşuda yalnız ZAMAN AŞIMIYLA (test `cancelled`, "fail 0" yazdı); test beklemeden önce doğrudan sayacak biçimde güçlendirildi, ikinci koşuda net kırmızı |
| 4 | ■ diyaloğu kapatmıyor (`durdurulunca` kancası silindi) | **yakalandı**: "■ diyalog beklerken … EKRANDAN KALKAR" |
| 5 | bırakınca abonelik kapanmıyor | ilk koşuda **YAKALANMADI**: ikinci savunma (bırakılmış kaydın olayı elenir) davranışı korudu ama abone birikiyordu; abonelik sayan test eklendi, ikinci koşuda **yakalandı** |
| 6 | 5 + ikinci savunma da yok | **yakalandı**: "bırakınca sonraki olay hiçbir şey yapmaz" |
| 7 | olay adı süzgeci yok | **yakalandı**: "başka olay adı da tetiklemez" |
| 8 | soğuma yok | **yakalandı**: "SOĞUMA…" |
| 9 | dinleme kopya değil | **yakalandı**: "dinlemeye alınan KOPYADIR" |
| 10 | 3 seçenekte "4" yutulmuyor (oyuna sızar) | **yakalandı**: `diyalogTusu` testi |
| 11 | diyalog kutusu 1–4'ü yakalama evresinde yutmuyor (`stopImmediatePropagation` silindi) | **YAKALANMADI**: DOM katmanı testsiz (tarayıcı test ortamı yok); yalnız canlı denemede (madde 2) görülür |
| 12 | değişken okuma türü denetlemiyor | **yakalandı**: "başka türle yazılmış değişkeni okumak HATA" |
| 13 | değişken adet tavanı yok | **yakalandı**: "tavan: grafik başına DEGISKEN_AZAMI" |
| 14 | ▶ Başla yoksa ilk olay düğümünden başlar | **yakalandı**: "▶ olay düğümünden başlamaz" |

Bütün takım: **4739 test, tek kırmızı bilinen "ova bütün yerleşimleri dönüşsüz"** (taban 4688 + 51 yeni). `typecheck` temiz, `vite build` scratchpad'e geçti. Mimari/alt-sistem/tip kaçışı/Flash LLM'siz bekçileri yeşil.

### Canlı deneme listesi (Ozyn; pencere açan koşu sorulmadan yapılmadı) [YAZILDI-KOŞULMADI]
1. `npm start` → Tab → Y → **Graf** → **＋ Yeni grafik** → şablon **Nöbetçi** → ad `nobetci` → Enter. Kontrol et: "✓ hata yok".
2. Önce **▶ Çalıştır** (Flash'tan uzakta da çalışır): Flash döner, altyazı "Flash: Hoş geldin yolcu. Ziyaret: 1", ekranın altında **Flash** başlıklı (amber) "Dur! Parola?" kutusu, üç seçenek ve geri sayım. **1**'e bas → "Geç.". Oyunda "1" Orion'u tahtaya YÜRÜTMEMELİ.
3. Tekrar ▶ → bu kez **T** ile sohbeti aç, "1" yaz: sohbete yazılmalı, diyalog seçilmemeli. Esc → **3**'e bas → "Geçemezsin.". Kontrol et altında "Durum (bellekte): ziyaret = 2"; **Durumu sıfırla**.
4. ▶ → diyalog açıkken **■ Durdur**: kutu hemen kapanmalı, satır "■ nobetci durduruldu".
5. **⚡ Dinlemeye al** → sağda "⚡ Dinlemede (1)… flash:ozyn_yaklasti · 0 tetik". Flash'tan 3 m uzaklaş, sonra yanına yürü (1.8 m içine): diyalog kendiliğinden açılmalı, satır "▶ nobetci…" ve tetik 1. Diyalog açıkken uzaklaşıp yaklaş: yeni çalışma BAŞLAMAMALI, "1 atlandı" görünmeli.
6. Orion'a yaklaş (Flash'tan uzakta): nöbetçi tetiklenmemeli.
7. JSON'da metni değiştir + Ctrl+S, yaklaş: ESKİ metin görünmeli (kopya); bırak → yeniden kur → yeni metin.
8. **Dinlemeyi bırak**; yaklaş: hiçbir şey olmamalı. Yeniden kur, uygulamayı kapat-aç: liste boş olmalı.
9. Saat 21'den sonra (ya da bilgisayar saatini değiştirmeden ertesi akşam) ▶: gece sözü.
10. Konsolda `document.querySelector('.gs-dinle').click()` → dinleme KURULMAMALI (isTrusted).

## 5. Editör kütüphanesi spike'ı (pencere açılmadan) [ÖLÇÜLDÜ: paket incelendi, repoya kurulmadı]
- `@comfyorg/litegraph` 0.17.2: **MIT**, ESM + tipler, bağımlılık yok, son güncelleme 2026-10-02 (ComfyUI'nin editörü). Orijinal `litegraph.js` 0.7.18 Ocak 2024'ten beri durgun.
- **Bulgu:** paketin sayı alanı istemi kullanıcının yazdığı ifadeyi `eval` ediyor (düzenli ifade yalnız başı denetliyor: "1+…" ile başlayan her şey çalışır). Yazan yalnız Ozyn olduğu için risk düşük ama ana pencere `sandbox:false` ve CSP yok: LiteGraph seçilirse sayı alanları **kendi** alanlarımızla değiştirilmeli ya da o istem kapatılmalı. Karar dilim 2'de (LiteGraph vs kendi SVG editörümüz).

## 6. Sıradaki dilimler
1. ~~Ajan eylem düğümleri + Ajan seç/Nesne bul + ▶/■ + günlük~~ → §4b (Emret yapılmadı: grafikten başka ajana söz teslimi gereksiz, eylem düğümleri ajanı doğrudan sürer).
2. ~~NPC davranışı (olay tetikleyici + dinleme, değişkenler, mantık, gün vakti, seçimli diyalog)~~ → §4c (dilim 2 numarası Ozyn'in 2026-10-21 isteğine verildi).
2b. Görsel editör (Graf sekmesinden tam ekran düzenleyici) + desen kaydet/kullan + aktif düğüm vurgusu (`dugum` olayı ve `hataDugumu`/`hataGrafi` hazır).
3. Dünya düzenleme düğümleri (yerleştirme katmanı) + geri al + öneri farkı.
4. Orion `dunya_oku` / `dunya_oner` (önerir, asla çalıştırmaz; yalnız editör kipinde).
5. Tarif (balta/ağaç primitifleri + bileşenler), JSON animasyon (el sallama — bugün `jestUygula` boş), Etkileş (kes) → ağaç kesme demosu.

## 7. Açıklar
- Canlıda hiçbir şey görülmedi: Graf sekmesinin DOM'u testsiz (bu projede tarayıcı test ortamı yok; mantık saf modüllerde testli).
- Orion grafik çalışırken kendi LLM'iyle de niyet verebilir: aynı bedene iki kaynak → grafiğin işi `iptal` olur ve grafik "iş kesildi" der (dürüst ama Orion'u grafik süresince susturmak yok; dilim 4'ün editör kipiyle düşünülecek).
- ■ Flash'ın altyazısını kesmez (Flash'ın sesi yok; altyazı kendi süresinde gider).
- Orion'un Söyle'si köprü kuralıyla iki cümleye kısaltılır (tek ses kuralı; Ozyn uzun metin yazarsa kesilir).
- Nesne bul ve nesne hedefi **Ozyn'in yerinden** okunur; Orion başka yerdeyse (kapıdan çıktıysa) o yerin nesnesi bulunamaz.
- Grafik silme / yeniden adlandırma yok (md'de de yok). Kontrol et kaydedilmiş hâli denetler, düzenleyicideki kaydedilmemiş metni değil.
- Tek adım tavanı (60 sn) ve Flash'ın söz bekleme süresi ölçülmedi.
- Komut kipi `otomatik` çelişkisi (araştırma) bu sistemi etkilemez: grafik terminale erişemez.
- **Dilim 2 açıkları:** (a) Flash'ın boşta kıpırtısı (`mind/ajanda.ts`) grafiğin sürdüğünü bilmez (grafiğin niyetleri köprüyü atlar, benlik "meşgul" demez): diyalog beklerken jest/bakış yapabilir, bir Git sırasında araya girerse grafik "iş kesildi" der — ölçülmedi. (b) Dinlemedeki grafiğin çağırdığı DESEN çağrı anında depodan okunur (▶'deki gibi); dinleme uzun sürdüğü için desen değişikliği onaysız biçimde dinlenen programa girer — grafik kopyalanıyor, desenler kopyalanmıyor. (c) Diyalog kutusunun DOM'u ve 1–4 yakalaması testsiz (bozma #11 yakalanmadı); yalnız saf `diyalogTusu` testli. (d) Oyun kipinde imleç kilitliyken fare kutuya ulaşmaz (1–4 çalışır). (e) Ozyn diyalog açıkken uzaklaşınca diyalog kapanmaz (yalnız süre). (f) Soğuma 5 sn, diyalog 30/60 sn ölçülmedi. (g) Gün vakti bilgisayarın saati; oyun içi gündüz/gece önayarına bağlı değil. (h) Değişken alanı adla anahtarlı: grafik silinip aynı adla yeniden yaratılırsa eski durum kalır (oturum boyunca; Durumu sıfırla).
