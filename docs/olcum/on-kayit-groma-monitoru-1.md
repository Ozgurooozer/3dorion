# Ön kayıt — 3. monitör: groma haritası ofiste (2026-10-15)

**İstek (Ozyn):** "groma için masa üstüne bir bat yap görebileyim (YAPILDI). Ayrıca Orion da görebilsin. Bir monitör daha ekle, küçük olan gibi, onu da o
ekranda görebilelim, inceleyebilelim, kullanabilelim; 3. monitör olarak dursun."

**Tasarım:** masada, yönetim terminalinin (sağ, `admin`) AYNASI olarak sol tarafta küçük bir monitör: `groma` çapası ("groma haritası"). Ekranda
`http://localhost:4747` (groma web haritası) canlı görünür. Ana süreçte (Electron) görünmez, EKRAN DIŞI bir pencere sayfayı yükler (`offscreen: true`),
kareler JPEG olarak renderer'a gelir, `DynamicTexture`a çizilir (mevcut `yuzeyKur` deseni). Odaklanınca (`odaklan`/tıklama, Esc ile çık) fare olayları
ekran dışı pencereye iletilir: haritada gezinmek, yakınlaştırmak, tıklamak. Orion odayı kendi gözüyle (`sor gor`) gördüğünde monitör de karede görünür;
çapa adı `groma` olduğu için `bak`/`odaklan`/`git` niyetleri hedefleyebilir.

**Güvenlik/yan etki sınırları:** yalnız yerel adres (`localhost`/`127.0.0.1`; `ORION_GROMA_URL` ile değişir) yüklenir, başka adres reddedilir; ekran dışı pencere
yalnız bu iş için; klavye iletilmez (yalnız fare ve tekerlek); pencere yıkılınca süreç kalmaz.

**Ölçütler (uygulamadan ÖNCE):**
- **W1 kare akışı:** groma ayaktayken renderer ≥ 5 kare/sn alır (5 sn'de ≥ 25 kare) ve doku boş değildir (tek renk olmayan piksel oranı > %5).
  **DÜZELTME (ölçmeden önce, tasarım hatası):** ekran dışı pencere `paint`i yalnız sayfa DEĞİŞİNCE verir; durağan bir harita saniyede 25 kare üretmez. Ölçüt şu oldu:
  sayfa ≤ 12 sn'de yüklenir, ilk kare ≤ 10 sn'de gelir, doku dolu (> %5 farklı piksel) ve etkileşimde (W3) yeni kare gelir.
- **W2 maliyet:** monitör ekle-çıkar farkı: çizim çağrısı ≤ +4 (düzlem, kasa, boyun, taban); `kapidene` çizim bütçesi (≤ 220) ve 19/19 geçmeye devam eder.
- **W3 kullanılabilirlik:** ekran UV'si → sayfa pikseli eşlemesi birim testli (dört köşe + merkez, ters yön dahil); canlıda odaktayken bir tıklama/tekerlek
  sayfaya ulaşır ve ardından yeni kare gelir (sayfa değişti ya da yenilendi).
- **W4 dürüst boşluk:** groma kapalıyken ekran "groma kapalı — masaüstündeki groma-haritasi.bat" yazar (sessiz siyah DEĞİL); groma açılınca ≤ 10 sn'de
  kendiliğinden bağlanır.
- **W5 Orion görür:** `groma` çapa olarak geçerli (`capalar` bekçisi, `bak`/`odaklan`/`git` doğrulayıcıdan geçer); `sor dunya` monitörü adıyla anar.
  Görme karesinde içerik okunur mu: ekran görüntüsüyle BAKILIR (öznel; geçti saymam, gördüğümü yazarım).
- **W6 sızıntı/güvenlik:** uygulama kapanınca ek süreç kalmaz; `http://localhost:4747` dışı URL `webmon:ac` ile REDDEDİLİR (birim testi).
- **Çürütme:** W1 ya da W2 tutmazsa (ör. kare maliyeti oyunu yavaşlatırsa) kare hızı ve çözünürlük düşürülür; yine olmazsa özellik varsayılan KAPALI yapılır
  ve sonuç olduğu gibi yazılır.

**Kapsam dışı:** klavye iletimi, sesli içerik, birden çok sayfa/sekme, groma'yı oyundan başlatmak (masaüstü .bat bunu yapar), haritanın METNİNİ Orion'a vermek
(sonraki adım: groma'nın JSON modelinden özet; bu turda yalnız görsel).

## SONUÇLAR
Koşu: 2026-10-15. Kod: `host/webMonitor.js` (+ `.d.ts`, testi), `world/surfaces/web/webEkrani.ts` (+ test), `uygulama/webMonitoru.ts` (+ test), `uygulama/odak.ts`,
`world/level/{oda,olculer,capalar}.ts`, `protocol/temel.ts` (çapa `groma`), `uygulama/senaryolar/gromadene.ts`, masaüstü `groma-haritasi.bat` + `-durdur.bat`.
Ekran görüntüsü: `docs/olcum/groma-monitoru-1/groma-monitor.png`.

- **W1 (düzeltilmiş) GEÇTİ [ÖLÇÜLDÜ canlı, `3dorion.bat gromadene`]:** sayfa açıldı, ilk kare geldi, doku dolu (farklı piksel oranı 0,160).
- **W2 KISMEN, ölçüt tutmadı:** `kapidene` 19/19 geçti, çizim bütçesi (≤ 220) altında: 177 / 137 / 206 / 82 çizim, ~100 fps. AMA monitörü gören iki bakışta çizim
  sayısı önceki ölçüme göre +8 (169→177, 198→206): ön kaydın ≤ +4'ü (4 mesh) tutmadı, çünkü her mesh gölge geçişinde de sayılıyor. Bütçeyi aşmıyor, fps etkilenmedi.
  (Ölçüm, Ozyn'in oyunu açıkken yapıldı: fps ve zaman ölçümleri gürültülü olabilir; çizim SAYISI etkilenmez.)
- **W3 GEÇTİ [ÖLÇÜLDÜ canlı + TEST]:** odağa geçildi, tekerlek ve tıklama sayfaya iletildi, sayfa tepki verdi (kare 6 → 7; görüntüde harita yakınlaştı, "F0 canlı puan" bileşeni
  seçildi). Birim testleri: UV→sayfa (dört köşe + merkez + ters yön), sayfa pikseline çevirme, bas/bırak/tekerlek, kapalı sayfaya olay GİTMEZ.
- **W4 TEST geçti, canlıda BAKILMADI:** her durumun ekranda yazan metni var ("groma kapalı — masaüstündeki groma-haritasi.bat"), kabuk yokken "yok", kapalıyken fare
  iletilmez, koparsa son kare "bağlantı kesildi" şeridiyle kalır. Groma'yı kapatıp ekranın gerçekten bunu yazdığını canlıda görmedim.
- **W5 KISMEN:** `groma` çapası tipli ve bekçili (`capalar` bekçisi, tip denetimi, doğrulayıcı: `bak/odaklan/git groma` geçerli). **Orion'un gözüyle karede görünüp
  okunduğuna BAKILMADI** (görme modeli koşusu yapılmadı); yalnız ekranın doğru çizildiği görüntüde görüldü.
- **W6 TEST geçti:** yalnız yerel http kabul edilir (https, dış adres, file, javascript: reddedilir); sayfa içinden dış adrese gezinme iptal; `kapat()` pencereyi yıkar;
  ana pencere kapanınca da yıkılır (aksi hâlde `window-all-closed` hiç gelmez ve uygulama arkada kalırdı). Süreç sızıntısı canlıda sayılmadı.
- **Çürütme tetiklenmedi.** Açık: Orion'un monitörü gözüyle okuması, kapalı-groma ekranı canlıda, klavye iletimi (kapsam dışıydı), haritanın METİN özetinin Orion'a verilmesi.
