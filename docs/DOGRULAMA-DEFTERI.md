# Doğrulama defteri — koşulmayanlar ve riskler

Ozyn'in kuralı (2026-10-29): her raporun "Koşulmayanlar ve riskler" kısmı BURAYA yazılır. Madde geçince SİLİNMEZ: durumu **GEÇTİ** olur, tarih ve kanıt (komut, sayı) yazılır.
Yeni iş bitince önce bu dosya güncellenir, sonra rapor yazılır. Etiketler: `[TEST]` birim testli · `[ÖLÇÜLDÜ]` canlı koşuda sayı var · `[YAZILDI-KOŞULMADI]`.
Pencere açan senaryolar oyun KAPALIYKEN koşar (Ozyn kapatır). Açık iş listesi ayrı: `ACIK-ISLER.md`.

## Koşulmayanlar (canlı doğrulama borcu)
| # | iş (spec) | madde | durum | nasıl kapanır |
|---|---|---|---|---|
| K1 | Eklenti (40) | `eklentidene` K1–K6 (Ayarlar ▸ Eklentiler, kapılar, Düşünme kipi) | AÇIK `[YAZILDI-KOŞULMADI]` | `cmd /c ".\3dorion.bat eklentidene"` tamamı geçer |
| K2 | Eklenti (40) | Düşünme kipinin canlı odada faydası | AÇIK — ölçülen: 6 yerel modelde 0 KABUL ("kanıt yok"), kip KAPALI | deterministik geri dönüş için ayrı ön kayıt + ölçüm |
| K3 | Content Browser (39) | Sürükle-bırak / İçe aktar düzeltmesi (`host/birakYollari.cjs`), kök neden kanıtlanmadı | AÇIK | Ozyn oyunu tam kapatıp `npm start` ile gerçek fareyle dener |
| K4 | Content Browser (39) | `icerikdene` K30–K32 (taşıma, `I` tuşu, Outliner çift tık) | AÇIK; spec 39 "32/32 ölçüldü" diyor, K30–K32'nin ayrı koşusu doğrulanmadı | `icerikdene` yeniden koşulur, sayı yazılır |
| K5 | Dok (41) | Dok panelleri Electron'da elle denenmedi (spec 41 kendisi söylüyor); gerçek fareyle sürükleme | AÇIK | Ozyn elle dener |
| K6 | Gerilemeler | `projedene` 13/13, `dokdene` 14/14, `sekansdene` 7/7, `kameradene` 12/12, `grafdene` 11/11, `rigdene` taban 26/27, `kapidene` taban 15/19 | AÇIK (2026-10-29'dan sonra koşulmadı) | hepsi koşulur, sayılar bu satıra yazılır |
| K7 | Masaüstü bat | `3dorion.bat` CRLF düzeltmesi sonrası masaüstü kısayolundan açılış (`'m' is not recognized` hatası kalktı mı) | AÇIK; ben `3dorion.bat zzzdene` ile hatasız başladığını gördüm, Ozyn'in elindeki açılış değil | Ozyn masaüstü bat'ından açar |
| K8 | Yeni level (42) Y1 | Şablonlar yalnız şema ve zemin yüksekliği testinden geçti; `levelKur` ile GERÇEK sahnede (düz zemin, tamamen boş) kurulumu, Yer ölçümü (zemin yok) denenmedi | AÇIK `[TEST]` | `leveldene` (Y5) ya da el ile |
| K9 | Yeni level (42) Y2 | `proje:level-olustur/kaydet` IPC'si Electron'da çağrılmadı (yalnız host fonksiyonları ve kanal bekçisi testli) | **GEÇTİ 2026-10-29** `[ÖLÇÜLDÜ]` `leveldene` L7a–L7c: IPC Electron'da çağrıldı (yaz→oku, 409/400/404, yalnız `isiklar` kaydı) | `leveldene` (Y5) |
| K10 | Işık (42) Y3 | Işık sayısı ölçümü (0/2/4/8 ışıkla kare süresi, çizim çağrısı, GL hatası); ön kayıt `olcum/on-kayit-isik-tavani.md` | AÇIK `[YAZILDI-KOŞULMADI]` | ön kayıtlı koşu (oyun kapalıyken) |
| K11 | Işık (42) Y3 | `efektdene` ve `kapidene` malzeme ışık sınırı 4→10'dan sonra koşulmadı | AÇIK | iki senaryo koşulur; `kapidene` tabanı 15/19 |
| K12 | Yeni level (42) Y4 | Yeni Level penceresi ve Işıklar paneli (DOM, CSS, dok yerleşimi) hiç gözle görülmedi; ekran görüntüsü yok | **GEÇTİ 2026-10-29** (görsel) `[ÖLÇÜLDÜ]` `leveldene` kareleri okundu: Işıklar paneli (sol dok), Yeni level penceresi (4 şablon), ışık işareti + taşı okları görüldü; Ozyn gözü henüz yok | `leveldene` koşulur, `01–05` kareler Read ile açılıp bakılır; sonra Ozyn elle dener |
| K13 | Yeni level (42) Y5 | `leveldene` senaryosu yazıldı + tsc temiz, canlı KOŞULMADI (pencere açar; oyun kapalı olmalı) | **GEÇTİ 2026-10-29** `[ÖLÇÜLDÜ]` `leveldene` 11/11 (üç koşuda 7/11 → 10/11 → 11/11; düzeltmeler aşağıda) | Ozyn oyunu kapatır → `cmd /c ".dorion.bat leveldene"` → sayı bu satıra |
| K14 | Yeni level (42) | Gerçek fare tıklamasıyla (`isTrusted`) Oluştur / Kaydet yolu: senaryo yalnız SENTETİK tıklamanın yazmadığını ölçer; gerçek tıklamanın yazdığını yalnız Ozyn elle görür | AÇIK | Ozyn Dosya ▸ Yeni level… ile bir level oluşturur, Işıklar ▸ 💾 dener |
| K15 | Işık (42) gizmo | Taşı gizmosu + sahne işareti (`uygulama/isikGizmosu.ts`): gerçek fareyle ok sürükleme, bırakınca konum yazımı, Esc iptali hiç denenmedi; sentetik `leveldene` L2b yalnız seçim/bağlanma/tıklamayı ölçer | KISMEN: L2b geçti (seçili gelir, gizmo takılır, sahnede tıklayınca seçer; kare `02b_gizmo` okundu). Gerçek fareyle ok SÜRÜKLEME, bırakınca yazım ve Esc iptali hâlâ AÇIK | `leveldene` + Ozyn elle ok sürükler |
| K16 | Pipecat dersleri | `protocol/SOZLESME.md` taşıyıcı kuralları HEDEF olarak yazıldı; mevcut köprünün/beyinlerin (ollama, apiBeyni, disBeyin, mcpBeyin) uyumu DENETLENMEDİ | AÇIK `[YAZILDI-KOŞULMADI]` | köprü kodu kural kural okunur, ihlaller listelenir |
| K17 | Konuşma uzunluğu | Ayarlar ▸ Ses ▸ Konuşma uzunluğu seçicisi gerçek DOM'da ve gerçek Piper sesiyle denenmedi; `uzun` ayarda 8 cümlenin Piper'da çalıp çalmadığı ölçülmedi | AÇIK `[YAZILDI-KOŞULMADI]` | Ozyn Ayarlar'dan Uzun seçip uzun cevap ister |
| K18 | Aktör (43) A1–A2 | Details paneli (renk seçici, sayı/vec3 girişleri, değişken ekle/sil, graf seçimi) gerçek fareyle/klavyeyle denenmedi; `leveldene` L4b ve `aktordene` A1 SENTETİK olay gönderir | AÇIK `[YAZILDI-KOŞULMADI]` (gerçek el) | Ozyn Işıklar ▸ bir ışık seçip Details'te her alanı dener |
| K19 | Aktör (43) A3 | Details'teki ▶ düğmesinin GERÇEK tıklamayla grafı başlattığı görülmedi (sentetik tık `isTrusted=false` olduğu için senaryo başlatamaz; `aktordene` A3–A6 çalıştırıcıyı `senaryo yüzü` (`aktorGraf`) ile sürer, ▶ düğmesinin kendi tıklama yolu yalnız A2'de "başlatmaz" yönünden ölçüldü) | AÇIK `[YAZILDI-KOŞULMADI]` (gerçek el) | Ozyn Details'te graf seçip ▶'ye basar; ışık kısılıp ■/bitişte geri gelmeli |
| K20 | Aktör (43) A3 | Nesne aktörü: Details/seçim bağı YOK (A5); nesne `gizli` yazması yalnız NullEngine birim testinde (`aktorYetenegi.test.ts`), canlı glb üzerinde denenmedi; ışık `renk` yazması canlı karede görülmedi (`aktordene` renk yazmıyor) | AÇIK `[TEST]` | A5'te nesne Details + canlı senaryo; renk için `aktordene`ye adım |
| K21 | Aktör (43) A4 | Kesme noktası / Devam / Adım / günlük GERÇEK fareyle denenmedi: `aktordene` A8–A11 sentetik tık yalnız 'Devam SÜRDÜRMEZ' yönünü ölçer, Devam/Adım senaryo yüzünden (`aktorGraf.devam/adim`) sürülür. Editör düzeni: Işıklar dok paneli Graf araç çubuğundaki '▶ Çalıştır'ın bir kısmını örtüyor (kare 05) | AÇIK `[YAZILDI-KOŞULMADI]` (gerçek el) | Ozyn Graf'ta akışlı düğüme kırmızı nokta koyar, ▶ der, ⏵ Devam / ⏭ Adım dener |

## Riskler
| # | risk | durum |
|---|---|---|
| R1 | Işık tavanı 8 / malzeme tavanı 10 ölçülmedi; `maxSimultaneousLights` etkisi bilinmiyor | AÇIK (K10 ile kapanır) |
| R2 | `world/level/cekirdek/nesneSistemi.ts` başka Claude'un (araba) commit'lenmemiş değişikliğini taşıyor; ona dokunulmadı, commit'lere girmez | İZLENİYOR |
| R3 | Ofis'siz bir level yeni açılışta ofise düşüyor (birleşik dünya ofisi ova'nın plato/geçidine oturtuyor); Orion yeni level'da yaşayamaz (spec 42 2. aşama) | AÇIK, Ozyn kararı: önce açık level üzerinde ışık, sonra ayrı dilim |
| R4 | İki Claude aynı çalışma kopyasında; rebase/stash diğerinin işini bozabilir | İZLENİYOR (commit yalnız açık yol listesiyle, push öncesi `git fetch`) |
| R5 | Işıklar paneli yalnız AÇIK level (ova) üzerinde çalışır; 💾 Kaydet diske yalnız `isiklar` alanını açık projenin VARSAYILAN level dosyasına yazar. Yeni oluşturulan level açılamaz, düzenlenemez (R3) | AÇIK, bilinçli sınır |
| R6 | `leveldene` L7 host yazmasını geçici projeye yapar; gerçek proje yazımı yalnız Ozyn'in elle denemesiyle görülür | AÇIK (K14) |
| R7 | Işık gizmosu panel açıkken her karede `kimlikler()` gezer ve işaret malzemesini karşılaştırır; ölçülmedi (kare süresi) | AÇIK (K10 ölçümüne eklenir) |
| R8 | Graf yazması GEÇİCİ ve doğrudan Babylon ışığına: çalışma sırasında Ozyn ışığı panelden değiştirirse `level.ayarla` tanımdan yeniden uygular ve graf yazısı SESSİZCE kaybolur (graf bir sonraki yazışında yine yazar) | AÇIK, bilinçli (tanıma yazmak kalıcı hasar riski) |
| R9 | Graf editörünün ■ Durdur'u artık aktör çalışmalarını da durdurur (A4, `aktorDurdur`) | **KAPANDI 2026-10-29** `[TEST]` + `aktordene` A11 |
| R10 | Aktör çalışma tavanı 4 ve aktör başına 1 ölçümle değil kararla konuldu (spec 43 §6); aynı anda 4 grafın ışık/değişken yazması FPS etkisi ölçülmedi | AÇIK |
| R11 | Details'te değişken adı sütunu dar (`hiz` → `h..` kesiliyor, kare `02_calisirken`) | AÇIK, kozmetik |
| R12 | Aktör grafı `renk` yazarken yalnız `#rrggbb` kabul eder (palet adı "mavi" graf yazısında reddedilir); okuma her zaman `#rrggbb` döner | AÇIK, bilinçli |
| R13 | Hata ayıklama (A4): kesme noktası yalnız AKIŞLI düğümde, yalnız kullanıcı tetikli çalışmada (Graf ▶, aktör ▶); ⚡ dinleme çalışmaları ve saf düğümler durmaz; F9 kısayolu yok; kuru koşu ve hatalı aktöre kamera odağı yok | AÇIK, bilinçli (unutulmuş duraklama NPC olay yolunu kilitlemesin) |
| R14 | Çalışma günlüğü yalnız bellekte (son 200 satır, değer ≤120 karakter); uygulama kapanınca gider. Aynı graf iki aktörle çalışırsa grafik değişkenleri paylaşılır | AÇIK, bilinçli |
| R15 | Kod incelemesi (A3+A4) kalanları: `durdurHepsi` level değişiminde çağrılmıyor (eski ışığa geri alma kapanışı sessiz); aynı graf hem Graf ▶ hem aktör ▶ ile çalışabilir; Devam/Adım yalnız Graf editörü araç çubuğunda (editör kapalıyken duran aktör çalışması yalnız ■ ile çözülür); günlük satırında değişken ad=değer yok; `alanYaz`'da ışık/nesne `gizli` bloğu kopya; `bitince` süpürmesi eşzamanlı başka graf yazısını da erken geri alabilir | AÇIK, bilinçli/küçük |

## Geçenler
| # | madde | tarih | kanıt |
|---|---|---|---|
| G1 | Tam test paketi ve tip denetimi, spec 42 Y3 sonrası | 2026-10-29 | `npm test` 5478 geçti / 0 başarısız; `tsc --noEmit` temiz |
| G2 | Işık aktörü kodu bozma denemesi | 2026-10-29 | 23 mutant: 22 ilk koşuda, 1'i tavan sabiti testi eklenince yakalandı |
| G3 | `3dorion.bat` CRLF (cmd satır sınırı hatası) | 2026-10-29 | 625/625 satır CRLF; `.gitattributes` `*.bat text eol=crlf` (Ozyn'in açılışı K7'de) |
| G4 | Tam test paketi ve tip denetimi, spec 42 Y4 + Y5 yazımı sonrası | 2026-10-29 | `npm test` 5493 geçti / 0 başarısız; `tsc --noEmit` temiz; mimari+altSistem+tipKacisi bekçileri yeşil |
| G5 | Işık gizmosu kodu sonrası tam paket + tip denetimi | 2026-10-29 | `npm test` 5494 geçti / 0; `tsc --noEmit` temiz; `kimlikler()` birim testi |
| G6 | `leveldene` canlı koşusu 11/11; koşuda bulunan iki hata düzeltildi: (1) ışıklar paneli çizilmeden önce yapılan ilk değişiklikte kaydedilmiş taban alınmıyordu → kirli rozeti çıkmıyordu; (2) senaryo birleşik dünyanın hazır olmasını beklemiyordu, imleç kipini açmıyordu, geçici kökte level adı çakışıyordu | 2026-10-29 | `cmd /c ".dorion.bat leveldene"` → `GECTI — 11/11`; kareler `%TEMP%\leveldene\*.png` |
| G7 | Konuşma kesilme nedeni bulundu: `voice/kisalt.ts` 2 cümle/180 karakter freni `orionKonusmasi`nda her söze uygulanıyordu (ölçümle konmuş gevezelik freni); ayrıca Piper `host/ses.js` 1200 karakter üstünü reddeder | 2026-10-29 | kod okundu; ön ayarlar + depo birim testleri: 34/34 (kısa/orta/uzun, varsayılan kısa, bozuk depo) `[TEST]` |
| G8 | Aktör bileşen şeması (spec 43 A1) bozma denemesi: `bilesen.ts` + `levelTanimi.ts` | 2026-10-29 | 25 mutant: ilk koşuda 19, testler sıkılaştırılınca 25/25 `[TEST]` |
| G9 | Aktör grafı (spec 43 A3) bozma denemesi: `aktorDugumleri` + `aktorYetenegi` + `aktorCalistirici` + `@bu` bağlamı (`yorumlayici`, `grafCalistirici`) | 2026-10-29 | 32 mutant 32/32 yakalandı: ilk koşuda 30 (biri eşleşmedi, biri `alan` mesajını gevşek eşliyordu; test sıkılaştırıldı, ikisi yeniden koşuldu); dosyalar bayt düzeyinde geri alındı `[TEST]` |
| G10 | `aktordene` canlı koşusu 7/7: Details graf seçimi, sentetik ▶ BAŞLATMAZ, graf @bu ışığı kıstı/söndürdü + aktör değişkeni okuyup yazdı + TANIM değişmedi, ikinci ▶ reddi, ■ sonrası geri alma, graf sonuna kadar + geri alma, hata (olmayan aktör) | 2026-10-29 | `cmd /c ".dorion.bat aktordene"` → `[AKTORDENE] GECTI — 7/7`; kareler `%TEMP%ktordene–04` (02 okundu: ▶ pasif, ■ etkin, durum yazısı) `[ÖLÇÜLDÜ]` |
| G11 | Tam paket + tip denetimi, spec 43 A1–A3 sonrası | 2026-10-29 | `npm test` 5540 geçti / 0; `tsc --noEmit` temiz. Koşuda bulunan iki hata düzeltildi: (1) `bilesen.ts` üretimde `as unknown as` kullanıyordu → `tipKacisi` bekçisi kırmızı; (2) aktör düğümleri palette 'Dünya değişkenleri' kategorisine karışıyordu → yeni `aktor` kategorisi |
| G12 | Hata ayıklama (spec 43 A4) bozma denemesi: `hataAyiklayici` + `calismaGunlugu` + `yorumlayici` + `grafCalistirici` + `aktorCalistirici` | 2026-10-29 | 23 mutant 23/23 yakalandı: ilk koşuda 22, `onizle` sınırı (+50) kaçtı → 118/119 karakter testleri eklendi, yeniden koşuldu; dosyalar bayt düzeyinde geri alındı `[TEST]` |
| G13 | `aktordene` A4 canlı 12/12 (A1–A7, A8, A8b, A9, A10, A11): editörde kesme noktası düğmesi (akışlıda var, saf düğümde yok), w2'de BAŞLAMADAN duraklama, sentetik Devam sürdürmez, Devam, Adım (w2→bk), ■ keser + ışık geri, günlük satırları | 2026-10-29 | `[AKTORDENE] GECTI — 12/12`; kareler `02`, `05_duraklama`, `06_devam_gunluk` okundu (kırmızı nokta, turuncu çerçeve, ⏸, günlük) `[ÖLÇÜLDÜ]` |
| G14 | Tam paket + tip denetimi, spec 43 A1–A4 sonrası | 2026-10-29 | `npm test` 5552 geçti / 0 başarısız; `tsc --noEmit` temiz `[TEST]` |
| G15 | Kod incelemesi (iki eksen, iki ajan) spec 43 A3+A4: 2 gerçek hata düzeltildi — (1) Graf ▶/⚡ açık kimlikle aktöre yazınca geri alma yoktu (ışık sonsuza dek kısık) → `CalismaTabani.bitince` süpürmesi; (2) `ayik.bitir()` reddedilen sonuçta çağrılmıyordu → `finally`. Devam/Adım `isTrusted` bekçisi (kaynak testi) eklendi, mutantla kırmızı görüldü | 2026-10-29 | `hataAyiklama.test.ts` 14/14 `[TEST]`; düzeltmelerden sonra `npm test` 5554/0, `tsc` temiz, `aktordene` 12/12 `[ÖLÇÜLDÜ]` |
