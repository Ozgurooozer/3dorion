# Spec 35 — Orion dünyanın editörü, Ozyn mimar: Blueprint benzeri JSON düğüm grafiği

Tarih: 2026-10-21 · Durum: **Dilim 0 bitti** (biçim + tür denetimi + saf yorumlayıcı, testli) · **Dilim 1 YAZILDI** (ajan düğümleri, grafik deposu, Graf sekmesi; testli, başsız; Graf sekmesi ve ajanların gerçek yürüyüşü canlıda GÖRÜLMEDİ) · **Dilim 2 YAZILDI** (NPC davranışı: ⚡ olay dinleme, değişkenler + koşul, seçimli diyalog, nöbetçi şablonu; testli, canlıda GÖRÜLMEDİ, §4c) · **Dilim 2b YAZILDI** (görsel düğüm editörü: saf mantık testli, DOM/SVG canlıda GÖRÜLMEDİ, §4e) · **Dilim 3 YAZILDI** (NPC sınıfı: ajan kapsamlı değişken, `@ben`, NPC parametresi, NPC kaydı + dinleme; testli, canlıda GÖRÜLMEDİ, §4g) · **Dilim 5a YAZILDI** (JSON animasyon klibi + "Animasyon oynat" düğümü; testli, kemik yeri başsız ölçüldü, görüntü canlıda GÖRÜLMEDİ, §4f) · 3b–5 sırada.
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

## 4d. Dilim 2c — dünya değişkenleri (salt okunur saf düğümler) [TEST · canlıda GÖRÜLMEDİ]
"Saat 12'den önceyse şu konuma git" gibi şeyler artık bağlanabilir (Blueprint'teki Get düğümleri). Dosya `uygulama/graf/dunyaDugumleri.ts`; yetenek arayüzü `GrafYetenegi.ajanDurumu/ozynDurumu` (kopya döner: grafik gövdeyi değiştiremez).
- **`saat.simdi`** → `saat` (kesirli, 14:30 = 14.5), `tam_saat`, `dakika`. Gün vaktiyle aynı geçerlilik kuralı (`gecerliSaat`); bilgisayarın saati (oyun içi saat yok).
- **`veri.konum`** (x, y, z ayarı, ±200 m) ve **Git/Bak hedefi `konum`**: konum pini; protokolün `nokta` hedefi. Konum olmayan değer (örn. sayı) çalışma anında reddedilir.
- **`ajan.durum`** → `konum`, `x`, `z`, `mesgul`, `oturuyor`. **`ozyn.durum`** → `konum` (AYAK hizası: göz hizası değil), `x`, `z`, `yuzey`. **`ozyn.mesafe`** → ajanın Ozyn'e YATAY uzaklığı.
- **`nesne.en_yakin`** (tür süzgeci, menzil): ajana yatayda en yakın nesne + mesafe; eşitlikte kimlik sırası; menzilde yoksa nedenli hata.
- Bilerek yok: oyun içi saat/gündüz-gece (ortam aracı Orion'un), Orion'un LLM durumu, dünyayı DEĞİŞTİREN her şey (dilim 3).
- Açık: nesne konumu kutu merkezi (büyük nesnede yüzeye değil merkeze uzaklık); `animasyon.oynat` yok (klip sistemi önce); canlıda görülmedi.

## 4e. Dilim 2b — görsel editör [TEST: saf mantık · YAZILDI-KOŞULMADI: DOM/SVG etkileşimi]
Ozyn (2026-10-22): "graph işi istediğim gibi ama kullanıcı dostu değil; Unreal'deki gibi düğümlerle, değişkenlerle programlayabilmeliyim; farklı canvas'larda".
JSON metin kutusunun yerine tam ekran bir TUVAL (Blueprint hissi). **Biçim değişmedi**: `protocol/graf.ts` `Graf` JSON'u tek doğruluk kaynağı; editör yalnız görünüm,
`konum` zaten biçimdeydi. Palet kütüphaneden (`DugumKaydi.hepsi()`) beslenir: yeni düğüm türü kendiliğinden görünür; Orion aynı JSON'u yazar.

**Teknik karar (değişmez):** kendi DOM + SVG editörümüz, harici kitaplık YOK (LiteGraph'ın sayı alanı `eval` ediyordu, §5), yeni npm bağımlılığı YOK. Saf mantık
(testli) `uygulama/graf/editor/`, DOM katmanı `uygulama/yapi/graf/`; `giris.ts`'e tek kablo (`grafEditoruKur` + Graf sekmesine `ac`/`metinAc`/`adIslemi`).

| Dosya (saf, testli) | İş |
|---|---|
| `editor/tuvalMatematigi.ts` | dünya↔ekran, İMLEÇ MERKEZLİ yakınlaştırma (sabit nokta), ölçek 0.25–2, sığdır (ölçek ≤ 1), kutu seçimi, ızgara 20 |
| `editor/dugumGeometrisi.ts` | düğüm kutusu ve pin yerleri HESAPLANIR (DOM'da ölçülmez; CSS aynı sabitlerden), bağ eğrisi (kübik Bézier), pin/düğüm vuruşu |
| `editor/grafIslemleri.ts` | ekle/sil (bağlarıyla)/taşı/ayar/bağ ekle-kaldır/kopyala-yapıştır/grafik bilgisi — DEĞİŞTİRİLEMEZ, her sonuç `grafDogrula`dan geçer, tavanlı, okunur benzersiz kimlik (`git`, `git_2`) |
| `editor/bagKurali.ts` | pinden pine bağ: yön serbest, tür uyumu, tek-bağ ucunda ESKİ BAĞ DEĞİŞTİRİLİR (söylenir), döngü reddi — kurallar `grafTurDenetimi.ts`'ten (`uyumlu`, `tekBagUcu`, `donguVarMi` dışa verildi; KOPYA YOK) |
| `editor/pinBudama.ts` | ayar/desen pinleri değişince pini kalkan ya da türü uymayan bağ BUDANIR ve nedeniyle döner (sessiz kayıp yok); çözülemeyen düğümün bağına dokunulmaz |
| `editor/palet.ts` | palet öğeleri (her desen ayrı öğe, grafik türüne uymayan önerilmez), arama, PİN UYUMU süzgeci, kategori grupları, yeni düğümün ilk ayarı (`AyarTanimi.ornek`) |
| `editor/otomatikYerlesim.ts` | konumsuz düğümler soldan sağa akış sırasıyla (en uzun gelen yol; kaynak düğüm okuyanın bir soluna); konumlu düğüme dokunmaz |
| `editor/gecmis.ts` · `editor/sekmeler.ts` | geri al/yinele (görüntü yığını, tavan 100, kirli işareti, eşzamansız kaydetmeye dayanıklı) · sekmeler (kirli sekme ONAYSIZ KAPANMAZ) |
| `editor/editorOturumu.ts` | sekme oturumu + komutlar; her komut TEK geri al adımı ("palette'ten ekle + bırakılan pine bağla" dahil) ve kullanıcıya söylenecek sonuç |
| `editor/alanlar.ts` · `kisayollar.ts` · `degiskenler.ts` · `calismaGorunumu.ts` · `renkler.ts` | ayar alanları (sayı `Number`, EVAL YOK, Türkçe virgül, aralık/seçenek dışı yazılmaz) · tuş→komut (yazı alanında tuş harftir) · değişken listesi (değişken düğümlerinden toplanır; çakışma ⚠) · çalışma vurgusu + tavanlı denetim sıklığı (250 ms) · renkler |

| Dosya (DOM, testsiz) | İş |
|---|---|
| `yapi/graf/grafEditoru.ts` | tam ekran katman (z 30: altyazı ve diyalog kutusu ÜSTTE kalır), sekmeler, üst çubuk, tuş yönlendirme, kaydet, aç/gizle, hata olursa gizlen |
| `yapi/graf/tuval.ts` · `dugumOgesi.ts` | tuval (kaydır, yakınlaş, sürükle, Shift/kutu seçimi, bağ çek/kaldır, çift tık desen açar) · düğüm DOM'u (kategori başlığı, tür renkli pinler, akış beyaz üçgen, satır içi değer alanı, saf düğüm yeşil/ince) |
| `yapi/graf/paletKutusu.ts` · `ayrintiPaneli.ts` · `grafigimPaneli.ts` | palet (arama, ↑↓ Enter) · sağ panel (düğüm ayarları ya da grafik: tür, açıklama, desen giriş/çıkış pinleri) · sol panel (Değişkenler + ＋ Değişken, Desenler, Dünya değişkenleri) |
| `yapi/graf/calistirmaDugmeleri.ts` | ▶ / ■ / ⚡ — mevcut `calistir`/`dinlemeyeAl`, YALNIZ `isTrusted`; kirliyken ▶/⚡ gri ("önce kaydet: ▶ kaydedilmiş hâli çalıştırır") |
| `yapi/graf/sekmeSeridi.ts` · `sekmeDosyalari.ts` · `bilgiSeritleri.ts` · `komutlar.ts` · `dom.ts` · `editorStili.ts` · `editorBaglami.ts` | sekme şeridi + ad kutusu · dış değişiklik/silinme + yeniden adlandır/kopya · ipucu şeridi, bant, alt şerit (hata listesi → düğüme git), yardım · komut yürütücü (pano) · yardımcılar · CSS · parçaların ortak arayüzü |
| değişen | `grafTurDenetimi.ts` (`grafTurDenetleYapili`: hata + düğüm + bağ; metin API'si aynı mesajlar), `dugumKaydi.ts` (`AyarTanimi.ornek`), `durumDugumleri.ts` (`DEGISKEN_DUGUMU`, ad örneği `sayac`), `dunyaDugumleri.ts` (kategori `dunya`), `grafDeposu.ts` (`yenidenAdlandir`, `kopyasiniOlustur`), `yapi/grafSekmesi.ts` (Aç → görsel editör; Metin, Yeniden adlandır, Kopyasını oluştur), `tools/altSistemler.ts` (`arayuzJetonlari.ts` kamu), `giris.ts` kablosu, bekçi testleri |

### Kararlar ve nedenleri
- **Kural tek yerde.** Editörün bağ kuralı denetimin fonksiyonlarını kullanır; bekçi her (çıkış, giriş) tür çiftinde "editör kabul eder ⇔ Kontrol et tür hatası vermez"i
  sınar ve editör dosyalarında ikinci bir `"herhangi"` karşılaştırması aranır. Editör tek-bağ kuralını çiğnemez, Blueprint gibi eski bağı DEĞİŞTİRİR ve bunu söyler.
- **Yapılı hata** (`grafTurDenetleYapili`) eklendi, eski `grafTurDenetle` artık onun mesaj listesi (bütün eski testler değişmeden yeşil; bekçi iki çıktının aynı olduğunu
  örnek ve bozuk grafikte sınar). Grafik düzeyindeki hata düğümsüzdür; fazla Başla/Fonksiyon girişinde İKİNCİSİ işaretlenir.
- **Ayar değişince pinler yeniden hesaplanır**, pini kalkan bağ budanır ve "N bağ kaldırıldı — … (Ctrl+Z geri getirir)" denir. Desenin pin listesi değişince yalnız
  O desenin Fonksiyon girişi/dönüşü bağları budanır; bu deseni ÇAĞIRAN başka grafikler değişmez (başka dosyalar; onların denetimi gösterir).
- **Kaydetme mevcut `grafDeposu.yaz`** (biçim orada; tür denetimi kaydı engellemez — yarım program kaydedilir, mesaj sorun sayısını söyler). ▶/⚡ KAYDEDİLMİŞ hâli
  çalıştırır: kirli sekmede ikisi de gri ve nedenini söyler (ekrandaki ile çalışan ayrışmasın). İkinci bir çalıştırma yolu YAZILMADI.
- **Bekçi kalibrasyonu** (npcDavranisi.test.ts): eskiden yalnız Graf sekmesinin İLK ▶/⚡ çağrısında "if (!e.isTrusted" METNİ aranıyordu. Şimdi bilinçli izin
  listesi (`calistirmaDugmeleri.ts`, `grafSekmesi.ts`), listedeki HER çağrı için işleyici `(e) =>` almalı ve çağrıdan önce `if (!e.isTrusted…) return;` olmalı;
  bekçinin kendisi de örneklerle sınanır. Bozma #6 (denetim var ama `return` etmiyor) eski bekçiden geçerdi, yenisinden geçmez. ▶ TEK YERDEN listesi de iki dosya.
- **Tuş sızıntısı:** kök keydown/keyup/keypress'i durdurur; odak gövdeye düşerse pencere yakalayıcısı (yalnız editör açıkken kurulu) yutar — JSON penceresi (`.ep-pencere`)
  ve başka yazı alanları hariç. Onay kapısının Y/N/Esc'i ve diyaloğun 1–4'ü daha önce kurulmuş yakalayıcılar olduğundan editörden ÖNCE çalışır (onay ve diyalog
  editör açıkken de cevaplanır). Yerleştirme hayaleti ve zemin kalemi de daha önce kurulu yakalayıcılardır: editör açılırken BİTİRİLİR (Esc/Ctrl+Z'yi onlar alırdı).
- **Fare:** editör açılırken imleç kipi açılır (`izin`); katman tuvali örttüğü için tık kilide gitmez. **Hata olursa** (çizimde istisna) editör gizlenir, yakalayıcı
  kalkar, neden altyazıda: oyun kilitli kalmaz. **Esc gizler, kapatmaz**: kirliyse ilk Esc uyarır, ikinci Esc (3 sn içinde) gizler; değişiklik bellekte kalır.
- **Yeniden adlandırma = yeni dosya + eskisini kaldır** (`.silinenler/`; host'a yeni işlem GEREKMEDİ, kalıcı yok-etme yok). **Kullanılan desen yeniden adlandırılmaz**
  (reddedilir, kullananlar sayılır): çağıranları kendiliğinden güncellemek Ozyn'in görmediği dosyalara yazmak olurdu. Ayrıca açık sekme kirliyse, grafik çalışıyorsa
  ya da dinlemedeyse reddedilir. Kaldırmayı bilmeyen kaynakta HİÇ yazmadan reddedilir (iki kopya doğmaz). Bellekteki değişken durumu eski adda kalır (söylenir).
- **Otomatik yerleşim geri al adımı değil, kirli de değil** (konum davranışı etkilemez); kaydedilirse konumlar da yazılır.
- **Dünya değişkenleri kategorisi `dunya`** (eskiden `veri`): kategori yalnız görünümdür; palette ve sol panelde bu grup kütüphaneden çıkar.
- Bağa SOL tık bağı hemen kaldırır (Ctrl+Z geri getirir) — kaydırmak için bağın yanından sürükle; canlıda rahatsız ederse Alt+tık'a alınabilir (ölçülmedi).

### Kısayollar (tek kaynak `uygulama/graf/editor/kisayollar.ts`; editörde `?`)
| Tuş | İş |
|---|---|
| Sağ tık / Boşluk | düğüm paleti (ara, ↑↓, Enter ekler; düğüm imlecin yerine) |
| Pinden sürükle | bağ çek (uyanlar parlar, uymayanlar söner); boşluğa bırak: yalnız o pine uyan düğümler, eklenince bağlanır |
| Ctrl+S · Ctrl+Z · Ctrl+Y / Ctrl+Shift+Z | kaydet · geri al · yinele |
| Delete · Ctrl+C / X / V · Ctrl+D · Ctrl+A | seçimi bağlarıyla sil · kopyala/kes/yapıştır (yeni kimlik, imlecin yerine) · çoğalt · hepsini seç |
| F · tekerlek · arka planı sürükle / orta tuş | sığdır (seçim varsa seçimi) · imleç merkezli yakınlaş · kaydır |
| Shift+tık / Shift+sürükle | çoklu seçim / kutu seçimi |
| Bağa tık / sağ tık | bağı kaldır |
| Düğümü sürükle (Alt: serbest) | taşı; bırakınca ızgaraya yaslanır |
| Desen düğümüne çift tık | deseni yeni sekmede aç |
| ? / F1 · Esc | yardım · palet/ad kutusu/sürükleme/yardımı kapat, yoksa editörü gizle |

### Testler ve bozma denemesi
120 yeni test (`uygulama/graf/editor/*.test.ts` 117, `uygulama/yapi/graf/grafEditoruBekci.test.ts` 3) + `grafDeposu.test.ts` 5 + `npcDavranisi.test.ts` bekçileri
(2 eski bekçi kalibre edilmiş 3 bekçiyle değişti). Bütün takım: **4886 test, tek kırmızı bilinen "ova bütün yerleşimleri dönüşsüz"** (taban 4760 + 126). `typecheck` temiz, `vite build` scratchpad'e geçti (dist/'e yazılmadı). Mimari/alt-sistem/tip kaçışı/Flash LLM'siz/kuruluş sırası bekçileri yeşil. Bozma: her mutant tek dosyada tek değişiklik, dosya önce scratchpad'e
yedeklendi, ilgili testler `timeout 120` ile koşuldu, yedekten geri kondu ve bayt bayt aynı olduğu doğrulandı (16/16 AYNI; `git checkout` yok).

| # | bozma | 1. koşu | 2. koşu |
|---|---|---|---|
| 1 | bağ kuralında tür denetimi yok (uyumsuz bağ kabul) | **yakalandı** (4: tür, akış↔veri, eşdeğerlik bekçisi, oturum) | — |
| 2 | silinen düğümün bağları kalıyor | **yakalandı** (2) | — |
| 3 | geri al yığınının tavanı yok | **yakalandı** (2) | — |
| 4 | ayar değişince bağ budanmıyor | **yakalandı** (6) | — |
| 5 | editörün ▶ düğmesi isTrusted'a bakmıyor | **yakalandı** (bekçi) | — |
| 6 | isTrusted "denetimi" var ama dönmüyor (yalnız uyarı) | **yakalandı** (kalibre bekçi; eski bekçi bunu GEÇİRİRDİ) | — |
| 7 | kimlik çakışması | **yakalandı** (2) | — |
| 8 | palette pin uyumu süzgeci yok | **yakalandı** (3) | — |
| 9 | kirli sekme onaysız kapanıyor (`sekmeler.ts`) | **yakalandı** | — |
| 10 | kirli sekme onaysız kapanıyor (DOM: ✕ hep "onaylı") | **YAKALANMADI** (DOM testsiz) | kaynak bekçisi eklendi → **yakalandı** |
| 11 | sayı alanı ifadeyi hesaplıyor (eval) | **yakalandı** | — |
| 12 | palette'ten ekle + bağla iki geri al adımı | **yakalandı** | — |
| 13 | yapılı denetim hatayı düğüme eşlemiyor | **yakalandı** | — |
| 14 | editör kökü tuşları durdurmuyor (oyuna sızar) | **YAKALANMADI** (DOM testsiz) | kaynak bekçisi eklendi → **yakalandı** |
| 15 | `uyumlu`: akış 'herhangi'ye bağlanır (denetim + editör birlikte) | **YAKALANMADI**: editör ve denetim AYNI fonksiyonu kullandığı için eşdeğerlik bekçisi geçti ve hiçbir test akış→herhangi çiftini sınamıyordu (yorumlayıcı testleri dahil) | test eklendi → **yakalandı** |
| 16 | kullanılan desen yeniden adlandırılabiliyor | **yakalandı** | — |

Dürüst not: #10 ve #14'ün ikinci koşudaki "yakalandı"sı bir METİN bekçisidir (satır silinirse/değişirse kırmızı); tuşun gerçekten sızmadığını ya da ✕'un iki tık
istediğini KANITLAMAZ — yalnız canlı denemede görülür.

### Açıklar [YAZILDI-KOŞULMADI]
- **DOM/SVG etkileşiminin HİÇBİRİ canlıda görülmedi** (bu projede tarayıcı test ortamı yok; pencere açan koşu yapılmadı): sürükleme, pointer capture, SVG'nin 1×1 kutu
  dışındaki bağlara tıklama (`overflow: visible`), satır içi alanlar, palet konumu, ızgara, yazı alanı odaktayken çizimin ertelenmesi, tuş yutma.
- Pin noktaları geometriden hesaplanır; CSS aynı sabitlerden yazıldı ve düğüm kenarı `outline` (kenarlık 1 px kaydırırdı) — yine de 1–2 px kayma canlıda görülebilir.
- Sağ panelde yazarken bir ▶ çalışması her düğümde çizimi tetikler; yazı alanı odaktayken o panelin çizimi ertelenir (odak çıkınca çizilir). Ölçülmedi.
- Editör açıkken Orion'un ayar paneli gizlenir; kapanınca imleç kipine göre geri gelir. Nesne paneli/menü açılırken kapanır. Başka yüzen paneller (göz paneli,
  beden paneli, z 55) editörün üstünde açılabilir — açık bırakılmışsa.
- Bu deseni çağıran grafikler, desenin pinleri değişince kendiliğinden budanmaz (kendi denetimleri gösterir). Yeniden adlandırılan grafiğin bellekteki değişkenleri taşınmaz.
- Pano bellekte (sistem panosuna yazılmaz). Çok büyük grafikte (200 düğüm) her değişiklikte tam yeniden çizim yapılır — performans ölçülmedi.
- Bir sekmenin çözüm önbelleği başka dosya değişince unutulur (desenin yeni pini çağıran sekmede görünsün; testli), ama ajan defteri değişince (Flash sonradan gelir) bir sonraki grafik değişikliğine dek bayat kalabilir.
- Canlı satır olay (⚡) çalışmalarında şu anki düğümü göstermez (dinleyici yalnız "çalışıyor" bilgisini veriyor); son hatası gösterilir.

### Canlı deneme listesi (Ozyn; pencere açan koşu sorulmadan yapılmadı)
1. `npm start` → Tab → Y → **Graf** → bir grafik (yoksa ＋ Yeni grafik → Selam) → **çift tık**: tam ekran editör açılmalı, üstte sekme `selam`, ilk açılışta mavi
   ipucu şeridi; düğümler ekrana sığmış (şablonda konum var; konumsuz JSON'da soldan sağa dizilmeli). Konsolda hata olmamalı.
2. Editör açıkken **W, 1, T, Y, Tab** bas: Ozyn yürümemeli, Orion tahtaya gitmemeli, sohbet açılmamalı, alt çubuk değişmemeli, imleç kipi kapanmamalı.
3. Arka planı sürükle (kaydır), tekerlekle imlecin olduğu yere yakınlaş/uzaklaş (imlecin altındaki düğüm yerinde kalmalı), **F** (sığdır).
4. Bir düğümü sürükle → bırakınca ızgaraya oturmalı; **Ctrl+Z** eski yere, **Ctrl+Y** yeniye. Sekmede **●** görünmeli.
5. **Sağ tık** boşluğa → palet; "bekle" yaz → Enter: Bekle düğümü imlecin yerinde. `ms` kutusuna `1+1` yaz → Enter: kırmızı "sayı olmalı… ifade hesaplanmaz", değer
   değişmemeli; `2,5` → 2.5 kabul (aralık 0–10000).
6. Başla'nın beyaz çıkışından sürükle: uyumsuz pinler sönük, akış girişleri parlak olmalı; Bekle'nin girişine bırak → bağ. Aynı çıkıştan başka düğüme çek → "eski bağ
   değiştirildi" mesajı. Bir **metin** çıkışını Bekle'nin **ms**'ine bırak → "tür uyuşmuyor: metin → sayı", bağ kurulmamalı.
7. Bir sayı çıkışından sürükle, **boşluğa bırak**: palette yalnız sayı alan düğümler; birini seç → eklenip bağlanmalı; **tek Ctrl+Z** ikisini birden geri almalı.
8. Bir Git düğümünün Ayrıntılar'ında hedef `konum` → konum pini çıkmalı; Konum düğümünü bağla; hedefi `ozyn` yap → "1 bağ kaldırıldı — … konum girişi artık yok".
9. Düğümleri **Shift+sürükle** ile kutu seç → **Delete**: düğümler ve bağları gitmeli, mesaj sayıları söylemeli. **Ctrl+C / Ctrl+V** (imlecin yerine, yeni kimlikler: `bekle_2`).
10. Bir ayarı boz (Söyle'nin metnini sil): düğüm kırmızı çerçeve + ipucu, alt şeritte "✗ 1 sorun"; satıra tık → görünüm düğüme gitmeli.
11. Sol panel **＋ Değişken** → ad `ziyaret`, sayı → **Artır** → düğüm ortada; listede `ziyaret · sayı`. Aynı adla **metin** Oku ekle → ⚠ çakışma.
12. Sol panel **Dünya değişkenleri** → Saat → ekle. **Desenler** → `selamla` (yoksa ＋ Yeni desen) → ekle → Desen düğümü; ona **çift tık** → yeni sekme `🧩 selamla`.
    Desen sekmesinde Ayrıntılar (boş seçim) → girişlere ＋ → pin; öteki sekmede Desen düğümünün yeni pini görünmeli (kaydedince).
13. Kirli sekmede **▶** gri ve "önce kaydet" demeli. **Ctrl+S** → "kaydedildi", ● gider; **▶** → çalışırken şu anki düğüm yeşil parlamalı, satır `▶ selam · gel (Git)`.
    Flash'ın altyazısı editörün ÜSTÜNDE görünmeli. Hata çıkarsa (ulaşılamaz hedef) o düğüm kırmızı halkalı.
14. Nöbetçi grafiğinde **⚡ Dinlemeye al** → sekmede ⚡ rozeti; Flash'a yürü (editörü gizleyip) → diyalog açılmalı. Konsolda `document.querySelector('.ge-calistir').click()` →
    ÇALIŞMAMALI (isTrusted).
15. Kirli sekmenin **✕**'u → "Kaydedilmedi! tekrar tıkla"; 3 sn bekle → geri döner; iki hızlı tık → kapanır. **Esc** kirliyken: uyarı; ikinci Esc gizler; Graf
    sekmesinden yeniden aç → değişiklik duruyor olmalı.
16. **Metin** → JSON penceresi editörün üstünde açılmalı; orada yaz (tuşlar JSON'a gitmeli) → Ctrl+S: editör sekmesi temizse yeni hâle yenilenmeli; kirliyse sarı bant.
17. **Yeniden adlandır** → `selam2`: sekme adı değişmeli, Graf sekmesinde kart `selam2`. Kullanılan bir deseni yeniden adlandırmayı dene → "şunlarda kullanılıyor" reddi.
    **Kopyasını oluştur** → yeni sekme açılmalı. `.silinenler/` klasöründe eski dosya.
18. Graf sekmesinde bozuk bir dosyaya çift tık → görsel editör yerine JSON düzenleyici açılmalı (altyazı nedenini söyler).

## 4f. Dilim 5a — JSON animasyon klibi ("Animasyon oynat", Blueprint'in PlayAnimation'ı) [TEST · başsız ölçüm · canlıda GÖRÜLMEDİ]
Ozyn (2026-10-22): grafikle "belirli bir animasyonu oynat" diyebilmeli; Graf'ın Jest düğümü (el_salliyor) low-poly bedende görünmüyordu (§4b canlı listesi madde 3).

### Keşif (başsız ölçüm: NullEngine + gerçek `assets/orion-lowpoly.glb`, 2026-10-22) [ÖLÇÜLDÜ]
**Varsayım YANLIŞTI:** low-poly beden tek mesh (`orion_govde`, 15 000 köşe) ama **iskeletli**: 1 iskelet `orion_rig`, **52 kemik** (VRM humanoid adları: hips, spine, chest, upperChest, neck, head, left/right Shoulder/UpperArm/LowerArm/Hand + 30 parmak, left/right UpperLeg/LowerLeg/Foot/Toes), her kemik aynı adlı bir TransformNode'a bağlı (54 TN; + `orion_govde`, `orion_rig`). glb'de 5 klip: `bosta` (240 kare), `yuru` (70), `otur` (48), `oturuyor` (240), `kalk` (42); her biri 156 hedef = 52 kemik × (öteleme, dönme, ölçek). Jest klibi YOK. Yüzü +Z, `rightHand` +X'te (gövdenin kendi sağı). Morph target 0 (ağız/göz yok).

**El sallamanın görünmeme NEDENİ:** Orion da Flash da `vrmZorla: true` ile low-poly bedeni kullanır (`giris.ts`, `flashBaglantisi.ts`) → `vrm.ts`'in `jestUygula`'sı BOŞ (modelde jest klibi yok). Kemik eksikliği değil: kemikler var, onları süren kod yoktu.

| gövde türü | ne zaman | kontrol edilebilir adlı düğümler | `jestUygula` | düz `el_salliyor` görünür mü |
|---|---|---|---|---|
| `vrm` (low-poly glb) | bugün Orion + Flash (`vrmZorla`) | 52 kemik TN'si (yukarıda) | **boş** | **HAYIR** (kod yok) |
| `prosedurel` (blok robot) | VRM yüklenemezse | `kok`, `kalca`, `boyun` (baş pivotu), `omuzL/R`, `bacakL/R` (TN); kol/baş/gövde kutu mesh | omuz/boyun/göz/çene yordamsal | EVET — ama `omuzR`'yi kaldırır: `omuzR` −X'te = gövdenin **SOL** kolu (ölçüldü; prosedürelde `L/R` omuz-bacakta ters adlı, gözde doğru) |
| `ledyuz` (donanım) | yalnız LED test düzeneği | yok (gövdesiz) | yüz hâli (`gülümsüyor`→happy…) | hayır — `el_salliyor`'un yüz karşılığı yok (nötr) |

Yan bulgular (bu dilimde DÜZELTİLMEDİ, ölçülmedi): (a) Orion'un çizim güncellemesi `scene.render()`'dan ÖNCE koşar (`giris.ts` döngüsü), `bosta` klibi baş kemiğini de yazdığı için `BoneLookController`'ın baş dönüşü Orion'da büyük olasılıkla EZİLİYOR (Flash'ta `onBeforeRender`'da, animasyondan sonra: ezilmez). (b) `vrm.ts` `pozUygula` "eğiliyor"da `disKok.rotation.x` yazar; glTF kökünde `rotationQuaternion` dolu olduğu için Babylon bu Euler'i yok sayar — eğilme pozu VRM'de görünmüyor olabilir.

### Yapılan [TEST]
| Dosya | İş |
|---|---|
| `protocol/animasyon.ts` | klip BİÇİMİ: `surum`, `ad` (= dosya adı, `[a-z0-9_]`), `jest` (klibin anlamı), `sure` (0 < s ≤ 10), `dongu`, `izler[{uzuv, kanal, anahtarlar[{t, deger, yumusatma}]}]`; `klipDogrula` (temiz kopya, tavan: 24 iz, iz başına 32 anahtar, ±180°, ±0.5 m, sonlu sayı, t süre içinde ve KESİN artan, çift uzuv+kanal reddi, öteleme yalnız `kok`), `klipOzeti`. Eksenler GÖVDE UZAYINDA (yüz +Z, sağ +X): donme_x + öne eğilir, donme_y + sağa döner, donme_z + sağ taraf kalkar |
| `protocol/niyet.ts` · `dogrula.ts` | `jest` niyetine isteğe bağlı **`klip`** alanı (alan eklemek kırıcı değil, `SURUM` aynı); doğrulayıcı yalnız ad biçimine bakar, klipsiz jest ESKİ biçimde döner |
| `world/avatar/klipOrnekleyici.ts` | saf örnekleyici: `klipZamani` (döngüsüz kısma, döngülü sarma), `klipBittiMi` (döngülü ASLA), `yumusat` (dogrusal/yumusak=smoothstep/basamak; segmentin BAŞINDAKİ anahtardan), `izDegeri`, `klipOrnekle`, `uzuvPozlari`, `atlananIzler` |
| `world/avatar/uzuvEslemesi.ts` | soyut uzuv → gövde düğümü tablosu (vrm: 13 uzvun hepsi; prosedürel: kok, govde→kalca, bas→boyun, sag_kol→omuzL, sol_kol→omuzR, bacaklar; ledyuz: boş) + `uzuvlariCoz` (modelde bulunmayan "eksik" sayılır) |
| `world/avatar/uzuvSurucusu.ts` | Babylon sürücüsü: klip dönmesi o anki duruşun (bosta/yürüme/poz) ÜSTÜNE, eklem etrafında, gövde uzayında (`yerel × P·R·P⁻¹`; glTF kökünün −1 aynası ve boy ölçeği eşlenikte sadeleşir); birikme kalkanı; `kok` uzvu iskeletin kendi ara düğümüne (`<önek>_klip_kok`) |
| `world/avatar/klipKutuphanesi.ts` | kütüphane kabı (boş kurulur, yükleme bitince dolar; çağrı anında okunur) + saf yükleyici (`liste.json` + `<ad>.json`; bozuk dosya NEDENİYLE düşer, sağlamlar yüklenir) |
| `world/avatar/{yurutucu,beden,iskelet,vrm,prosedurel,index}.ts` | Yürütücü: klipli jest SÜRELİ (`basladi` → süre dolunca `bitti`; veri: klip, süre, döngü, **atlanan izler**); ayrı kanal (git kesmez; yeni jest/klip ve `dur` keser → `iptal`); bilinmeyen klip nedenli `hata`. Beden: klip değerlerini poz/boşta/bakıştan SONRA verir, çizim zamanı mantığın en çok 1 tik önünde; klipsiz gövdede klibin `jest`'i. VRM: kemik BU yüklemede aranır (Orion/Flash aynı adları taşır), değerler `onBeforeRenderTargetsRender`'da uygulanır (animasyon + bakış denetleyicisinden sonra). Avatar: uygulanamayan izleri klip başına BİR KEZ `console.warn` ("… klibinin 1 izi uygulanamadı: sag_on_kol.donme_x") |
| `assets/animasyon/` | `liste.json` + 5 klip: `el_salla` (2.4 sn), `basla_onayla` (1.2), `basla_reddet` (1.4), `selam_ver` (2.0, hafif eğilme), `dusun` (3.0, baş eğik + el çeneye) — hepsi döngüsüz, bitişte 0 |
| `uygulama/graf/animasyonDugumleri.ts` | **`ajan.animasyon` "Animasyon oynat"** (kategori ajan): ayar `klip` (seçenekler yüklü kliplerden, `secenekleriCoz` çalışma anı), `bekle` (varsayılan true: BİTENE dek; false: kabulde devam), `kim`. Jest düğümüyle AYNI yol (`niyetDogrula` → `yurut` → ajanın tek eylem yolu). Döngülü klip + bekle → denetimde HATA |
| değişen | `grafYetenegi.ts` (`AjanIsi.kabul`: işin ilk cevabı — dar ek), `ajanDugumleri.ts` (`yurut` dışa), `kutuphane.ts` (`grafKutuphanesi({ klipler })`), `giris.ts` (kütüphane kurulumu + `fetch` yükleyici, Orion/Flash/grafiğe aynı kap), `flashBaglantisi.ts` (`klipler`), `tools/altSistemler.ts` (`protocol/animasyon.ts` kamu) |

`bridge/araclar.ts` DEĞİŞMEDİ: Orion'un `dunya_jest` şeması `klip` sunmaz (bekçi testi); klip bugün yalnız grafikten.

**Başsız ölçüm** (`klipGovdesi.test.ts`, gövde-kökü çerçevesi, m; KEMİK yeri, deri değil): taban sağ el (0.22, 0.87, 0.11), baş (0, 1.57, 0.03), omuz y 1.38 → `el_salla` 1.0 sn: el **(0.54, 1.73, 0.11)** başın üstünde, sağda; ön kol iki uçta el x'i > 5 cm değişir; bitince el yine omzun altında. `selam_ver` 0.9 sn: baş (0, 1.52, 0.22) — 19 cm öne, ayak yerinde. `dusun` 1.5 sn: el (−0.02, 1.38, 0.20) — ortada, omuz hizasında, önde (çenenin ~12 cm altı: "çeneye doğru", tam çene değil). `basla_onayla`: başın ileri yönü aşağı döner; `basla_reddet`: yatayda döner. İki beden: Flash'ın klibi Orion'un koluna gitmez.

### Görünürlük tablosu (hangi iz hangi gövdede uygulanır)
| uzuv | vrm (low-poly) | prosedürel | ledyuz |
|---|---|---|---|
| kok (bütün beden: eğilme/zıplama) | ✓ ara düğüm | ✓ ara düğüm | — |
| govde · gogus · boyun · bas | ✓ spine · chest · neck · head | ✓ kalca · — · — · boyun pivotu | — |
| sag/sol_kol | ✓ Right/LeftUpperArm | ✓ omuzL / omuzR | — |
| sag/sol_on_kol · sag/sol_el | ✓ LowerArm · Hand | — (kol tek kutu) | — |
| sag/sol_bacak | ✓ UpperLeg | ✓ bacakL / bacakR | — |
Uygulanamayan iz KULLANICIYA hata değildir: klip uygulanabilen kısmıyla oynar, `basladi` sonucu `atlanan` listesini taşır, günlükte (konsol) bir kez yazar. LED yüzde klibin `jest`'i yüz hâli olarak görünür.

### Kararlar ve nedenleri
- **Yeni niyet türü YOK**: `jest` niyetine `klip` alanı. Jest zaten "anlık hareket"tir; `jest` alanı zorunlu kaldı (klibin anlamı) — eski tüketiciler (benlik, LED yüz, köprü) değişmeden çalışır.
- **Klipli jest süreli, kanalı ayrı**: `git` klibi kesmez (yürürken el sallanır — anlık niyet kuralı); yeni jest ya da klip keser ("en son jest kazanır", düz jestteki kural), `dur` keser. Kesilen klip `iptal` yayar (grafik "iş kesildi" der; sessiz kesme yok). Bilinmeyen klip oynayanı KESMEZ.
- **Döngülü klip kendiliğinden bitmez**: grafik onu bekleyemez (denetimde nedenli ret: sonsuz bekleme yerine). `bekle: false` ile oynar; ■ çalışma sürdükçe keser (kanca çalışmanın sonuna dek kurulu). Kütüphanedeki beşi döngüsüz.
- **Katman, ezme değil**: klip `bosta`/`yuru`'nun üstüne eklenir (gövde uzayında); `bosta` kapatılmadı. Neden: kollar dışındaki kemikler canlı kalsın, klip bitince ayrı bir "dinlenme pozuna dön" adımı gerekmesin.
- **Eksen kuralı gövde uzayında, gövde başına tabloda değil**: aynı JSON iki gövdede aynı yöne kaldırır (prosedürelde `sag_kol` → +X'teki `omuzL`, ölçüldü). Tabloda işaret/eksen çevirisi YOK; gerekirse eşleme kemik başına eksen düzeltmesiyle büyür.
- **Kütüphane kap, yükleme asenkron**: bedenler ve grafik boş kapla kurulur, `fetch` bitince dolar (bedenlerin yüklenmesi beklemez). Kütüphane dolmadan Kontrol et "seçenekler: yok" der (sessiz geçiş yok).
- **Depo repoda** (`assets/animasyon/`, Vite publicDir): tarayıcı klasör listeleyemediği için `liste.json`; bekçi klasörle aynı olduğunu sınar. Kullanıcı verisi klasörü ve Orion'un klip yazması bu dilimde YOK.

### Bozma denemesi
Betik `scratchpad/klip-bozma.cjs` (yedek `klip-bozma-yedek/`; adı bilerek ayrı — aynı scratchpad'i başka ajan kullanıyordu ve ilk betiğimin üstüne yazmıştı). Her mutant tek dosyada tek değişiklik, dosya önce yedeklendi, ilgili testler 120 sn zaman aşımıyla, yedekten geri kondu, bayt bayt karşılaştırıldı (16/16 AYNI; `git checkout` yok). Taban önce yeşil koşuldu.

| # | bozma | sonuç |
|---|---|---|
| 1 | iz tavanı yok | **yakalandı** (iz tavanı) |
| 2 | döngüsüz klip hiç bitmiyor | **yakalandı** (örnekleyici, yürütücü 2, düğüm uçtan uca). Gövde testleri GEÇTİ: zaman süreye kısıldığı için el yine iner — "bitmiyor" bedende görünmez, sonuçta görünür |
| 3 | `dur` klibi kesmiyor | **yakalandı** (yürütücü + VRM "el bir sonraki karede aşağıda") — ilk koşuda dosya CRLF'e dönmüştü, desen tutmadı ve ATLANDI; satır sonu LF'e döndürülüp yeniden koşuldu |
| 4 | eşlemesiz iz sessizce yutuluyor (`atlanan` hep boş) | **yakalandı** (yürütücü + prosedürel gövde uyarısı) |
| 5 | süre 0/negatif kabul | **yakalandı** |
| 6 | klip adı seçenek denetimi yok | **yakalandı** (2) |
| 7 | birikme kalkanı yok | **yakalandı** (4 VRM testi) |
| 8 | kemik sahnede aranıyor (Flash'ın klibi Orion'un koluna) | **yakalandı** (iki beden) |
| 9 | `bekle: false`ta ■ kancası hemen bırakılıyor | **yakalandı** |
| 10 | `donme_z` işareti ters | **yakalandı** (VRM + prosedürel) |
| 11 | gövde uzayı yok (dönme kemiğin yerel ekseninde) | **yakalandı** (el_salla, dusun) |
| 12 | `liste.json`'dan bir klip unutuldu | **yakalandı** (bekçi) |
| 13 | yeni düz jest klibi kesmiyor | **yakalandı** (ilk koşuda #3 gibi CRLF yüzünden atlanmıştı) |
| 14 | bekle (varsayılan) kabulde devam ediyor | **yakalandı** (4) |
| 15 | öteleme her uzuvda kabul | **yakalandı** |
| 16 | tek bozuk klip bütün kütüphaneyi düşürüyor | **yakalandı** |

Dürüst not: ilk koşuda #2 ve #14'te düğüm testi dosyası kırmızı yaktı ama SÜREÇ 120 sn asılı kaldı (uçtan uca testin saati ve grafiğin 60 sn adım tavanı zamanlayıcısı süreci ayakta tutuyordu). Testin saati `unref` edildi, sahte dünyanın adım tavanı 2.5 sn yapıldı; ikinci koşuda ikisi de zaman aşımsız kırmızı.

### Açıklar [YAZILDI-KOŞULMADI]
- **Canlıda HİÇBİR ŞEY görülmedi** (pencere açan koşu yapılmadı): derinin kemikle doğru eğildiği (ağırlıklar), kolun gövdenin İÇİNDEN geçip geçmediği (çarpışma yok), açıların göze doğru gelip gelmediği, ön kol sallamasının "el sallama" gibi okunup okunmadığı. Ölçülen yalnız kemik/düğüm YERİ.
- Klip sınırında yumuşak geçiş (harmanlama) yok: klip başlarken/biterken değer 0'dan başlar/0'da biter diye yazıldı; bitişte 0 olmayan klip (Ozyn'in yazacağı) kolu sıçratır (kütüphanedekiler için bekçi var, kullanıcı klibi için yok).
- Flash'ın boşta kıpırtısı (`mind/ajanda.ts`, 15–30 sn'de bir düz jest) grafiğin klibini KESER → grafik "iş kesildi" der (§7 açık (a)'nın klip hâli; ölçülmedi).
- Orion'un baş bakışı (BoneLookController) ile `bas` izi Flash'ta üst üste biner (bakış önce, klip sonra); Orion'da bakış zaten eziliyor olabilir (yan bulgu a).
- `jest` niyetinin `hedef`'i klipte kullanılmaz (işaret etme klibi hedefe yönelmez).
- Dosya `fetch`'i paketli (file://) Electron'da denenmedi; `nesneSistemi.ts` aynı kalıbı kullanıyor.

### Kalıcı çözüm seçenekleri (karar Ozyn'in; `project-orion-3b-model-karari` bekliyor) — kod YAZILMADI
1. **Bugünkü rig yeter (öneri: önce canlı dene)**: low-poly beden zaten 52 kemikli; JSON klipler bu dilimle kemiklere biniyor. Eksik olan yalnız göz kontrolü. Canlı denemede kol gövdeye giriyorsa ya da deri kötü eğiliyorsa →
2. **Blender'da jest klipleri bake et**: `tools/avatar-blender/` hattı (`klipler.py`, `bake.py`) `bosta/yuru/otur` gibi `el_salla` vb. üretebilir; glb'deki AnimationGroup'u `vrm.ts` jest adına göre oynatır (JSON klip yerine ya da yanında). Artı: sanatçı kalitesi, IK; eksi: her klip için Blender turu, Orion/Ozyn oyunda yazamaz.
3. **JSON'dan glb'ye**: JSON klibi Blender'a aktarıp (betik) bake etmek — iki dünyanın arası; iş fazla.
4. **ComfyUI 3B / yeni model**: yeni gövde üretimi (rigli) — 3B model kararına bağlı; rig yoksa bu dilimin eşleme tablosu yeni gövdeye yeni satırdır (VRM humanoid adlarını taşıyorsa satır gerekmez).
5. **Prosedürelde ön kol**: blok gövdeye dirsek pivotu eklemek (ucuz) — prosedürel yalnız yedek gövde olduğu için öncelik düşük.

### Canlı deneme listesi (Ozyn; pencere açan koşu sorulmadan yapılmadı)
1. `npm start` → konsolda `[KLIP] 5 klip yüklendi: el_salla, basla_onayla, basla_reddet, selam_ver, dusun`; `[KLIP] … ` uyarısı OLMAMALI.
2. Graf → ＋ Yeni grafik → editörde palet "animasyon" → **Animasyon oynat**; klip seçeneğinde beş ad. `kim: flash`, `klip: el_salla` → Başla'ya bağla → Ctrl+S → ▶: Flash sağ kolunu yana-yukarı kaldırmalı, ön kolu üç kez sallamalı, indirmeli (~2.4 sn); satır klip bitince `✓ … bitti`. **Kol gövdeye giriyor mu, deri yırtılıyor mu, el başın üstüne çıkıyor mu — bak.**
3. Aynısı `kim: orion` ile (Orion'un çizim sırası farklı: klip yine görünmeli).
4. `basla_onayla`, `basla_reddet`, `selam_ver`, `dusun` tek tek: baş öne/yana, gövde öne eğilme, el çeneye. Yönler doğru mu (sağ/sol, öne/geri)?
5. `bekle` kapalı + arkasına **Git (ozyn)**: Flash yürürken el sallamalı (klip yürüyüşün üstüne biner).
6. `el_salla` sürerken **■**: kol hemen inmeli, satır `■ … durduruldu`.
7. Klip JSON'unu boz (`assets/animasyon/el_salla.json`'da `"sure": 99`) → yeniden başlat: konsolda `[KLIP] el_salla.json: sure: 99 aralık dışı…`, günlükte uyarı, öteki dört klip çalışır; Kontrol et `'el_salla' geçersiz (seçenekler: …)`. Dosyayı geri al.
8. Flash yürürken (`Git`) **Jest** (düz `el_salliyor`) düğümü: hâlâ görünmez (beklenen; düz jest için klip eşlemesi yapılmadı).

## 4g. Dilim 3 — NPC sınıfı: ajan kapsamlı değişken, `@ben`, NPC parametresi, NPC kaydı + dinleme [TEST · canlıda GÖRÜLMEDİ]
Gerekçe: 35b §2.1 (Unreal "Blueprint Class": tür bir kez yazılır, örnekleri çoğalır, her örneğin kendi üye değişkenleri ve "Instance Editable" parametreleri
vardır). Dilim 2'de değişken GRAFİK başına ve olay düğümünün `ajan`ı sabitti: aynı Nöbetçi grafiğini iki ajan kullansa ziyaret sayacı PAYLAŞILIRDI. Hedef:
300 NPC'ye veriyle ölçeklenen "NPC sınıfı" — **bir grafik, birçok ajan, ayrı durum**. (Dilim numarası 3 bu işe verildi; eski "3. dünya düzenleme" §6'da 3b.)

| Dosya | İş |
|---|---|
| `protocol/npc.ts` | NPC kaydı biçimi + elle doğrulayıcı (temiz kopya; tavanlar: graf 8, parametre 32, metin 200; ad kuralı = `grafAdiGecerli`, aynı fonksiyon) |
| `uygulama/graf/benAjani.ts` | `@ben`: seçenekler, denetim (`benDenetle`, `npcGerekli`), çalışma anı çözümü (`ajanCoz`) |
| `uygulama/graf/npcDugumleri.ts` | `npc.parametre` (saf): `ad`, `tip`, `varsayilan` (giriş pini), çıkış `deger` + `kayitta` |
| `uygulama/graf/npcSablonu.ts` | "Nöbetçi (NPC'li)" şablonu (`@ben`, parola parametresi, ajan kapsamlı sayaç); eski Nöbetçi DEĞİŞMEDİ |
| `uygulama/graf/npcDeposu.ts` | NPC deposu (`<userData>/orion-npc/<ad>.json`; localStorage `orion.npc.v1` geliştirmede) |
| `uygulama/dogruDosyaDeposu.ts` | grafik deposundan GENELLEŞTİRİLEN doğrulanan-kayıt çekirdeği (doğrula → kanonik yaz, ad = dosya adı, bozuk dosya listede nedeniyle); `grafDeposu.ts` artık bunun üstünde (testleri değişmeden yeşil) |
| `host/npcDosyalari.js` (+ `.d.ts`) | host deposu; `host/dosyaKlasoru.js`'e `jsonKlasoru` (ad → `<ad>.json`, kaldır = `.silinenler/`) eklendi, `grafDosyalari.js` onun üstüne alındı (kopya yok) |
| `uygulama/yapi/npcSeridi.ts` | Graf sekmesi · "NPC'ler" şeridi (DOM, testsiz) |
| değişen | `dugumKaydi.ts` (`PinOrtami.ben`, `NpcBaglami`, `DugumCalismasi.ben/ajanDegiskenleri/ajanlar`), `grafDurumu.ts` (ajan alanı), `durumDugumleri.ts` (`kapsam`, `kim`, `metin.esit`), `olayDugumleri.ts` + `ajanDugumleri.ts` (`ajan.sec`) (`@ben`), `yorumlayici.ts`, `grafCalistirici.ts` (`ben`), `grafDinleyici.ts` (NPC dinleme), `kutuphane.ts` (kayıt + şablon satırı), `editor/calismaGorunumu.ts` (bir grafiğin birden çok kaydı), `dosyaDeposu.ts` (`kaynakSec`: grafik ve NPC kaynak seçimi ortak), `grafSekmesi.ts` (şerit bağı, ajan durumu, bırak anahtarla), `host/kanallar.cjs` · `preload.cjs` · `kopru.ts` · `main.js` (`npc:liste/oku/yaz/yeni/sil`; dinleme kanalı YOK), `giris.ts` kablosu, `tools/altSistemler.ts` (`protocol/npc.ts` kamu) |

NPC kaydı (örnek): `{ "surum": 1, "ad": "kapi_nobetcisi", "ajan": "flash", "graflar": ["nobetci"], "parametreler": { "parola": "Ay ışığı", "gece_basi": 21 } }`

### Kararlar ve nedenleri
- **Ajan kapsamlı değişken** (`kapsam`: `grafik` VARSAYILAN | `ajan`): `ajan` kapsamında değişken `kim`in alanındadır (Unreal üye değişkeni), o ajanın BÜTÜN
  grafikleri paylaşır, başka ajan göremez; pin listesi kapsama göre değişir (`kim` ajan pini; bağsızsa `kim` ayarı, `@ben` dahil). Ayarsız eski grafikler
  dilim 2'deki gibi GRAFİK alanını kullanır (testli; bozma #6). Sahip ÇALIŞMA ANINDA defterde olmalı: "flsh" yazım hatası sessizce yeni bir alan açmasın.
  Ad çakışması bilerek mümkün (iki grafik aynı ajanın `ziyaret`ini paylaşır: üye değişkeni budur). Tavanlar: ajan başına 32 değişken, metin 200, en çok
  512 ajanın alanı (300 NPC + pay; ölçülmedi); çözülmemiş `@ben` alan açamaz. **YALNIZ BELLEKTE** (kalıcılık YOK: uygulama kapanınca sayaçlar gider; kalıcı
  durum = sürüm/göç/bozuk dosya sözleşmesi, ayrı karar). Graf sekmesi Kontrol et altında ve NPC kartında ajan durumu + ajan başına "sıfırla".
- **`@ben`** = "bu grafiği çalıştıran NPC": olay düğümlerinin `ajan`ında, `ajan.sec`in `ajan`ında ve ajan kapsamlı değişkenin `kim` ayarında. Çözüm
  ÇALIŞMA BAĞLAMINDA (`DugumCalismasi.ben`, denetimde `PinOrtami.ben`) — grafiğin kopyasında "@ben"i değiştirmek YAPILMADI: dinleyicinin dondurduğu kopya
  (ve `desenleriDondur`un desen kopyaları) Ozyn'in onayladığı metnin aynısı kalır, aynı kopya iki NPC'de çalışır (testli). `PinOrtami.ben` üç hâlli:
  verilmez = Kontrol et / görsel editör (grafik bir SINIF: `@ben` geçerli), `null` = ▶ ya da NPC'siz ⚡ (NEDENLİ hata: "grafik bir NPC sınıfı: yalnız NPC
  şeridinden…"), NPC = çözülür. Yorumlayıcıya `ben` verilmezse null sayılır (çalışma anında "sınıf serbestliği" yok). Eylem düğümlerinin `kim` AYARI
  `@ben` almaz (bağla: Ajan seç @ben ya da olayın `ajan` çıkışı; olayın `ajan` çıkışı ÇÖZÜLMÜŞ kimliktir).
- **`npc.parametre`** (Instance Editable): NPC kaydındaki parametreyi okur, yoksa `varsayilan` (giriş pini; bağsızsa ayar — zorunlu: kaydı eksik NPC de
  çalışsın); `kayitta` çıkışı kayıttan mı geldiğini söyler. Yalnız NPC çalışmasında (▶'de nedenli hata). TÜR uyuşmazlığı DİNLEMEYE ALIRKEN reddedilir
  (NPC denetimde biliniyor; ilk yaklaşmada patlamaz) ve çalışma anında ikinci kez bakılır. Parola için **`metin.esit`** eklendi (Karşılaştır yalnız sayı alır;
  boşluk ve — `harf` kapalıyken — büyük/küçük harf yok sayılır).
- **NPC dinleme = aynı giriş**: `grafDinleyici.dinlemeyeAl(npc)` (grafik adı yerine NPC kaydı); ikinci bir çalıştırma yolu YAZILMADI. Kaydın her grafiği o
  NPC'nin ajanı için ayrı kayıt (anahtar `<graf>@<ajan>`); çakışma/soğuma/tek-çalışma KAYIT başına; `DINLEME_AZAMI` (8) NPC grafikleri dahil TOPLAM.
  Kurulum **ATOMİK** (bir grafik reddedilirse hiçbiri kurulmaz; neden `'<npc>' · <graf>: …`). Kaydın `ajan`ı DEFTERDE olmalı (dinlemeye alırken; kayıt
  biçimi bilmez). **Aynı grafik aynı ajan için iki kez dinlenmez** (tek başına + NPC, ya da iki NPC; iki program aynı bedeni sürerdi); ayrı ajanlar serbest.
  NPC'nin parametreleri dinleme anının kopyası (kayıt sonradan değişse de dinlenen NPC değişmez; bırak + yeniden kur). `npcBirak` bütün kayıtlarını bırakır.
- **GÜVENLİK KURALI DEĞİŞMEDİ**: "⚡ NPC'yi dinlemeye al" yalnız `isTrusted` tıklama; bırakmak serbest; silmenin ikinci adımı gerçek tık. Bekçi kalibrasyonu
  (`npcDavranisi.test.ts`): izin listesi artık dosya başına TAM çağrı sayısı (`calistirmaDugmeleri` 1+1, `grafSekmesi` 1+1, `npcSeridi` 0+1) ve desenler
  geniş (`.calistir(` / `.dinlemeyeAl(` her alıcıda: takma adla çağrı sayıdan kaçamaz). Eski "en az 2 çağrı" kuralı ▶'siz şeridi reddederdi ve fazladan
  bir çağrıyı saymazdı. Host'ta NPC için dinleme/çalıştırma kanalı yok (bekçi: `host/npcDosyalari.test.ts`); Orion'un araç yüzeyine (`bridge/araclar.ts`)
  hiçbir şey eklenmedi; bridge/mind/flash `uygulama/graf/`'a uzanmaz (mevcut bekçi).
- **Kopya yok**: host'ta `jsonKlasoru` (grafik + NPC), renderer'da `dogruDepoKur` (grafik + NPC) ve `kaynakSec` (IPC / localStorage / çalışmayan); NPC ad
  kuralı grafiklerin AYNI fonksiyonu (protokolde ve host'ta; bekçi testleri). Modülerlik: graf → ajanlar tek yön korunuyor (`tools/grafYonBekcisi.test.ts`
  yeşil); `GrafYetenegi`ne yeni yetenek EKLENMEDİ (NPC bağlamı çalışma bağlamında, yetenek değil).
- **Arayüz**: Graf sekmesinde üçüncü şerit "NPC'ler" (ayrı dosya; `grafSekmesi.ts` net +7 satır, 322 → 329): kartlar (ajan · grafikler · ajan durumu), ＋ Yeni NPC
  (ad + ajan + olay grafiği → kayıt, parametreler boş → JSON penceresi açılır), ⚡ NPC'yi dinlemeye al / bırak, Metin (JSON penceresi: `editorPenceresi`
  deseninin üçüncü örneği), Durumu sıfırla, Sil (iki adım, kaldır → `.silinenler`). Parametreleri satır içi düzenleyen form YAZILMADI (JSON yeterli sayıldı).

### Testler
39 yeni test: `protocol/npc.test.ts` 6, `host/npcDosyalari.test.ts` 6 (ad kuralı protokolle aynı + kanal bekçisi dahil), `uygulama/graf/npcDeposu.test.ts` 6,
`uygulama/graf/npcSinifi.test.ts` 21 (depo, geriye uyum, kapsam, `@ben` ×4, parametre ×2, dinleme kuralları ×6, iki NPC ayrı sayaç/parola, üye değişkeni,
şablon). Değişen beklentiler (bilinçli): Ajan seç seçenek metni sonunda `@ben`; tavan metni "8 dinleme kaydı"; şablon listesinde `nobetci_npc`; isTrusted
bekçisi (yukarıda). Kuzey yıldızı testi: iki NPC (flash "Ay ışığı", gardiyan "Kırmızı") aynı Nöbetçi (NPC'li) grafiği — Flash'a "Kırmızı" → "Geçemezsin.",
gardiyana "Kırmızı" → "Geç.", ikinci Flash ziyaretinde "Ziyaret: 2", gardiyan 1; grafiğin kendi alanı boş. Bütün takım: bkz. bozma tablosunun altı.

### Bozma denemesi
Betik (scratchpad `bozma.cjs`): her mutant tek dosyada tek değişiklik, dosya önce yedeklendi, 9 test dosyası 120 sn zaman aşımıyla koşuldu, yedekten geri
kondu ve bayt bayt aynı olduğu doğrulandı (18/18 AYNI; `git checkout` yok).

| # | bozma | 1. koşu | 2. koşu |
|---|---|---|---|
| 1 | iki NPC sayacı paylaşıyor (ajan alanı kök grafiğin adıyla) | **yakalandı** (4: iki NPC, üye değişkeni, kapsam, @ben) | — |
| 2 | `@ben` denetimi yok (NPC'siz ▶/dinleme denetimden geçer) | **yakalandı** (1: NPC'siz dinleme) | — |
| 3 | `@ben` çözülmeden geçiyor (`ajanCoz` NPC yoksa '@ben'i aynen verir) | **YAKALANMADI**: denetim (`benDenetle`) önce düştüğü için ikinci savunmaya hiç ulaşılmıyordu | doğrudan düğüm çağrısı testi eklendi → **yakalandı** |
| 4 | olay düğümünün `ajan` çıkışı çözülmemiş '@ben' | **yakalandı** (4) | — |
| 5 | NPC dinleme `isTrusted`'sız | **yakalandı** (bekçi) | — |
| 6 | grafik kapsamı bozuk: `kapsamOku`nun `?? "grafik"` yedeği `"ajan"` | **YAKALANMADI**: EŞDEĞER mutant — ayarın `varsayilan`ı çözümde zaten birleşiyor, yedek ölü kod | gerçek bozma: kapsam ayarının varsayılanı `"ajan"` → **yakalandı** (12 kırmızı + 1 iptal: eski grafikler) |
| 7 | NPC parametresi tür denetimi yok | **yakalandı** | — |
| 8 | ajan alanı tavanı yok | **yakalandı** | — |
| 9 | NPC'de toplam dinleme tavanı yok | **yakalandı** | — |
| 10 | kaldır yerine KALICI silme (host `jsonKlasoru`) | **yakalandı** (2: grafik + NPC) | — |
| 11 | aynı grafik aynı ajan için iki kez dinleniyor (çakışma denetimi yok) | **yakalandı** | — |
| 12 | dinleme anahtarı ajanı yok sayıyor | **yakalandı** (6) | — |
| 13 | NPC kurulumu atomik değil | **yakalandı** | — |
| 14 | NPC parametreleri kaydın nesnesi (kopya değil) | **YAKALANMADI**: EŞDEĞER — `npcDogrula` zaten temiz kopya veriyor (iki savunma; biri kalkınca öteki tutuyor) | aynı sonuç (bilerek bırakıldı) |
| 15 | NPC'nin ajanı defterde mi denetimi yok | **yakalandı** | — |

Bütün takım: **5027 test**. Dilimin ilk tam koşusunda (5026 test) tek kırmızı bilinen "ova bütün yerleşimleri dönüşsüz"; son iki koşuda ona ek olarak AYNI ANDA
yazılan Dilim 5a'nın (§4f) `animasyonDugumleri.test.ts` / `world/avatar/*Klip*` testlerinden 4–5'i koşudan koşuya DEĞİŞEN biçimde kırmızı (zamanlama/yarım iş;
tek başına koşunca başka testler düşüyor ya da hepsi geçiyor) — bu dilimin dosyalarıyla ilişkisi görülmedi, ama kanıtlanmadı da (taban, Dilim 5a bitince
yeniden koşulmalı). Taban 4891; fark bu dilimin 39 testi + Dilim 5a'nın testleri. `typecheck` temiz, `vite build` scratchpad'e geçti (dist/'e yazılmadı).
Mimari/alt-sistem/tip kaçışı/Flash LLM'siz/yön bekçileri yeşil.

### Açıklar [YAZILDI-KOŞULMADI]
- **DOM'un HİÇBİRİ canlıda görülmedi** (NPC şeridi, ＋ Yeni NPC formu, JSON penceresinin NPC örneği, Kontrol et altındaki ajan durumu). Şeridin dar Graf
  sekmesinde (üç şerit + sağ panel) sığıp sığmadığı ölçülmedi.
- İkinci NPC bedeni YOK (kapsam dışı): bugün defterde Orion ve Flash var; Orion'un olayları grafiğe kapalı → canlıda gerçek "iki NPC" denenemez, yalnız
  Flash ile tek NPC. İki NPC yalnız saf testte (sahte kapılar) kanıtlı.
- Kalıcılık yok: ajan sayaçları ve dinleme uygulama kapanınca gider (bilerek).
- Görsel editörün sol paneli "Değişkenler" listesi kapsamı ayırmıyor (aynı ad grafik + ajan kapsamında tek satır görünür); `＋ Değişken` grafik kapsamlı
  düğüm ekler (ajan kapsamı Ayrıntılar'dan seçilir). Editör kodu bu iş için değiştirilmedi (kayıt-temelli: pinler kapsama göre kendiliğinden değişir).
- NPC kaydı yeniden adlandırma/kopya yok (Metin ile yeni kayıt). Kaydın `graflar`ındaki grafik silinir/yeniden adlandırılırsa kayıt bozulmaz ama
  dinlemeye alırken "yüklenemedi" der.
- Eylem düğümlerinin `kim` AYARI `@ben` almaz (bilinçli; bağla). Diyalog seçenekleri ayar olduğu için NPC parametresiyle değiştirilemez (parola cevaplardan
  biri olmalı; şablon üç sabit cevap gösterir).
- `npc.parametre` kayıtta olmayan parametrede varsayılana döner — yazım hatası ("parloa") sessiz değil ama yalnız `kayitta=false` ile görünür.
- **Makro (çok akış çıkışlı desen) ve saf desen bu işte YAPILMADI** (35b §2.2 sırada). Bu dilimdeki `@ben` desenin içinde de çözülür (desen çağıranın
  bağlamını görür), yani makro geldiğinde ek iş gerekmez; saf desen için desen çerçevesinin `ben`i aynı kalmalı (not).

### Canlı deneme listesi (Ozyn; pencere açan koşu sorulmadan yapılmadı)
1. `npm start` → Tab → Y → **Graf**: üç şerit (Grafikler · Desenler · **NPC'ler**) ve sağ panel. NPC şeridinde "Henüz NPC yok…". Konsolda `[NPC] 0 NPC kaydı`.
2. **＋ Yeni grafik** → şablon **Nöbetçi (NPC'li…)** → ad `nobetci_sinif` → Enter. Kontrol et: "✓ hata yok". **▶ Çalıştır**: satır `✗ … '@ben' çözülemez — grafik bir NPC sınıfı…`, Flash kıpırdamamalı.
3. Grafik seçiliyken **⚡ Dinlemeye al** (grafik tek başına): "dinlemeye alınamadı: Kontrol et: yaklasti: ajan: '@ben' çözülemez…".
4. NPC şeridi **＋ Yeni NPC** → ad `kapi_flash`, ajan Flash, grafik `nobetci_sinif` → Enter: kart `👤 kapi_flash · flash · nobetci_sinif`, JSON penceresi açılır.
   `"parametreler": { "parola": "Kırmızı" }` yaz → Ctrl+S → "kaydedildi". Bozuk değer dene (`"parola": null`) → "KAYDEDİLEMEDİ: biçim: parametreler.parola…".
5. Kartı seç → **⚡ NPC'yi dinlemeye al**: kart ⚡, sağda `⚡ nobetci_sinif@flash [NPC kapi_flash] · flash:ozyn_yaklasti · 0 tetik`.
6. Flash'a yürü: "Hoş geldin yolcu. Ziyaret: 1", "Dur! Parola?" → **1 (Ay ışığı)** → "Geçemezsin." (bu NPC'nin parolası Kırmızı). Uzaklaş-yaklaş (5 sn sonra) → **2 (Kırmızı)** → "Geç.", "Ziyaret: 2".
   Kartta ve Kontrol et altında "Ajan durumu… flash: ziyaret = 2"; **Durumu sıfırla** → 0.
7. `"parola": 21` yap, Ctrl+S, bırak → yeniden kur: "dinlemeye alınamadı: 'kapi_flash' · nobetci_sinif: Kontrol et: parola_param: 'parola': NPC 'kapi_flash' kaydında sayı (21) ama düğüm metin bekliyor…".
8. Dinlemedeyken JSON'da parolayı değiştir + Ctrl+S, yaklaş: ESKİ parola geçerli (kopya); bırak + yeniden kur → yeni.
9. Eski **Nöbetçi** şablonundan bir grafik (`nobetci`) ⚡ dinlemeye al, sonra `kapi_flash`'ın `graflar`ına `"nobetci"` ekle → NPC'yi dinlemeye al: "'nobetci' zaten flash için dinlemede…" (aynı grafik aynı ajanda tek kayıt).
10. JSON'da `"ajan": "hayalet"` → kaydedilir; dinlemeye al: "ajan 'hayalet' ajan defterinde yok (var: orion, flash)".
11. Konsolda `document.querySelectorAll('.gs-dinle')[1].click()` (NPC şeridinin düğmesi) → NPC dinlemeye ALINMAMALI (isTrusted).
12. NPC'yi bırak → **Sil** → "Emin misin?" → tekrar → kart gider; `<userData>/orion-npc/.silinenler/kapi_flash.json.<zaman>` durmalı.
13. Uygulamayı kapat-aç: NPC kaydı durur, dinleme ve `ziyaret` sayacı gitmiş olmalı.

## 5. Editör kütüphanesi spike'ı (pencere açılmadan) [ÖLÇÜLDÜ: paket incelendi, repoya kurulmadı]
- `@comfyorg/litegraph` 0.17.2: **MIT**, ESM + tipler, bağımlılık yok, son güncelleme 2026-10-02 (ComfyUI'nin editörü). Orijinal `litegraph.js` 0.7.18 Ocak 2024'ten beri durgun.
- **Bulgu:** paketin sayı alanı istemi kullanıcının yazdığı ifadeyi `eval` ediyor (düzenli ifade yalnız başı denetliyor: "1+…" ile başlayan her şey çalışır). Yazan yalnız Ozyn olduğu için risk düşük ama ana pencere `sandbox:false` ve CSP yok: LiteGraph seçilirse sayı alanları **kendi** alanlarımızla değiştirilmeli ya da o istem kapatılmalı. Karar dilim 2'de (LiteGraph vs kendi SVG editörümüz).

## 6. Sıradaki dilimler
1. ~~Ajan eylem düğümleri + Ajan seç/Nesne bul + ▶/■ + günlük~~ → §4b (Emret yapılmadı: grafikten başka ajana söz teslimi gereksiz, eylem düğümleri ajanı doğrudan sürer).
2. ~~NPC davranışı (olay tetikleyici + dinleme, değişkenler, mantık, gün vakti, seçimli diyalog)~~ → §4c (dilim 2 numarası Ozyn'in 2026-10-21 isteğine verildi).
2b. ~~Görsel editör (Graf sekmesinden tam ekran düzenleyici) + desen kaydet/kullan + aktif düğüm vurgusu~~ → §4e (YAZILDI, canlıda görülmedi).
3. ~~NPC sınıfı (ajan kapsamlı değişken, `@ben`, NPC parametresi, NPC kaydı + dinleme)~~ → §4g (dilim 3 numarası 2026-10-22'de bu işe verildi; YAZILDI, canlıda görülmedi).
3b. Dünya düzenleme düğümleri (yerleştirme katmanı) + geri al + öneri farkı.
4. Orion `dunya_oku` / `dunya_oner` (önerir, asla çalıştırmaz; yalnız editör kipinde).
5. Tarif (balta/ağaç primitifleri + bileşenler), ~~JSON animasyon (el sallama)~~ → §4f Dilim 5a, Etkileş (kes) → ağaç kesme demosu.

## 7. Açıklar
- Canlıda hiçbir şey görülmedi: Graf sekmesinin DOM'u testsiz (bu projede tarayıcı test ortamı yok; mantık saf modüllerde testli).
- Orion grafik çalışırken kendi LLM'iyle de niyet verebilir: aynı bedene iki kaynak → grafiğin işi `iptal` olur ve grafik "iş kesildi" der (dürüst ama Orion'u grafik süresince susturmak yok; dilim 4'ün editör kipiyle düşünülecek).
- ■ Flash'ın altyazısını kesmez (Flash'ın sesi yok; altyazı kendi süresinde gider).
- Orion'un Söyle'si köprü kuralıyla iki cümleye kısaltılır (tek ses kuralı; Ozyn uzun metin yazarsa kesilir).
- Nesne bul ve nesne hedefi **Ozyn'in yerinden** okunur; Orion başka yerdeyse (kapıdan çıktıysa) o yerin nesnesi bulunamaz.
- ~~Grafik silme / yeniden adlandırma yok~~: Sil (§4b sonrası), Yeniden adlandır + Kopyasını oluştur (§4e). Graf sekmesinin Kontrol et'i hâlâ kaydedilmiş hâli denetler; görsel editör ise EKRANDAKİ (kaydedilmemiş) hâli her değişiklikte denetler (§4e).
- Tek adım tavanı (60 sn) ve Flash'ın söz bekleme süresi ölçülmedi.
- Komut kipi `otomatik` çelişkisi (araştırma) bu sistemi etkilemez: grafik terminale erişemez.
- **Dilim 2 açıkları:** (a) Flash'ın boşta kıpırtısı (`mind/ajanda.ts`) grafiğin sürdüğünü bilmez (grafiğin niyetleri köprüyü atlar, benlik "meşgul" demez): diyalog beklerken jest/bakış yapabilir, bir Git sırasında araya girerse grafik "iş kesildi" der — ölçülmedi. (b) KAPATILDI (dilim 2c): dinlemeye alınırken grafiğin (iç içe) desenleri de kopyalanır (`desenleriDondur`), tetikler depoyu değil kopyayı yürütür; test + bozma denemesi var. (c) Diyalog kutusunun DOM'u ve 1–4 yakalaması testsiz (bozma #11 yakalanmadı); yalnız saf `diyalogTusu` testli. (d) Oyun kipinde imleç kilitliyken fare kutuya ulaşmaz (1–4 çalışır). (e) Ozyn diyalog açıkken uzaklaşınca diyalog kapanmaz (yalnız süre). (f) Soğuma 5 sn, diyalog 30/60 sn ölçülmedi. (g) Gün vakti bilgisayarın saati; oyun içi gündüz/gece önayarına bağlı değil. (h) Değişken alanı adla anahtarlı: grafik silinip aynı adla yeniden yaratılırsa eski durum kalır (oturum boyunca; Durumu sıfırla).
