# Spec 35 — Orion dünyanın editörü, Ozyn mimar: Blueprint benzeri JSON düğüm grafiği

Tarih: 2026-10-21 · Durum: **Dilim 0 bitti** (biçim + tür denetimi + saf yorumlayıcı, testli) · **Dilim 1 YAZILDI** (ajan düğümleri, grafik deposu, Graf sekmesi; testli, başsız; Graf sekmesi ve ajanların gerçek yürüyüşü canlıda GÖRÜLMEDİ) · dilim 2–5 sırada.
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

## 5. Editör kütüphanesi spike'ı (pencere açılmadan) [ÖLÇÜLDÜ: paket incelendi, repoya kurulmadı]
- `@comfyorg/litegraph` 0.17.2: **MIT**, ESM + tipler, bağımlılık yok, son güncelleme 2026-10-02 (ComfyUI'nin editörü). Orijinal `litegraph.js` 0.7.18 Ocak 2024'ten beri durgun.
- **Bulgu:** paketin sayı alanı istemi kullanıcının yazdığı ifadeyi `eval` ediyor (düzenli ifade yalnız başı denetliyor: "1+…" ile başlayan her şey çalışır). Yazan yalnız Ozyn olduğu için risk düşük ama ana pencere `sandbox:false` ve CSP yok: LiteGraph seçilirse sayı alanları **kendi** alanlarımızla değiştirilmeli ya da o istem kapatılmalı. Karar dilim 2'de (LiteGraph vs kendi SVG editörümüz).

## 6. Sıradaki dilimler
1. ~~Ajan eylem düğümleri + Ajan seç/Nesne bul + ▶/■ + günlük~~ → §4b (Emret yapılmadı: grafikten başka ajana söz teslimi gereksiz, eylem düğümleri ajanı doğrudan sürer).
2. Görsel editör (Graf sekmesinden tam ekran düzenleyici) + desen kaydet/kullan + aktif düğüm vurgusu (`dugum` olayı ve `hataDugumu`/`hataGrafi` hazır).
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
