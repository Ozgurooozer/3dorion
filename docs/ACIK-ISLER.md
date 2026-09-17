# Açık İşler — birlikte bakılacak

> Bu liste "hemen çöz" listesi DEĞİL. Yan yolda çıkan, asıl işi bloke etmeyen
> kusurlar buraya yazılır ve önceliği Ozyn belirler.
> Son güncelleme: 2026-09-17

## Karar bekleyen (büyük)

- **MCP kaydı (Aşama 3).** Satır sözleşmesinin yerini alacak gerçek
  tool-calling. Ozyn OpenCode tarafında skill yazacaktı. Aşağıdaki
  "sözleşme kalitesi" maddelerinin çoğunu kökten anlamsızlaştırır.
- **Orion'un inisiyatifi.** Şu an tepki veriyor, kendi gündemi yok. Hafıza var
  ama kişilik/süreklilik zayıf. Projenin asıl vaadi buydu.
- **VRM avatar** — `assets/orion.vrm` aslında Cesium_Man, 0 morph target;
  yüz ifadesi bu yüzden sınırlı. (Ozyn ertelemişti.)
- **STT yok** — mikrofon donanımı yok. (Ozyn ertelemişti.)

## Sıradaki (2026-09-17 kod incelemesinden, bu sırayla)

1. **Senaryoları `world/giris.ts`'ten çıkar.** Dosya 2.312 satır, 1.304'ü
   (21 blok) `?xxxdene` senaryosu — test kodu üretim dosyasında ve bundle'da.
   `world/senaryolar/` altına, dinamik import ile.
2. **Ayar normalizasyonu 4 kopya.** `mind/dikkat.ts`, `ajanda.ts`, `hafiza.ts`,
   `onayKapisi.ts` aynı `sayı | () => sayı` çevirimini ayrı ayrı yapıyor.
   Tek yardımcıya indirilmeli.
3. **`world/surfaces/sema.ts` testsiz** (824 satır). Saf yardımcılar
   (`satirla`, `suredenBeri`, `degerYaz`) canvas'sız sınanabilir.
4. **Sonra teze dön:** aşağıdaki "Orion'un inisiyatifi".

## Beyin davranışı (canlıda görüldü, 2026-09-17)

- **Orion gördüğünü değil uydurduğunu anlatıyor.** `bakdene` koşusunda
  `[SOR] onumde → "yönetim terminali (birkaç adım ötede)"` döndü, Orion ise
  *"Önümde masa ve üzerindeki monitör var. Sol tarafta tahta, sağ tarafta
  pencere"* dedi. Cevap beyne ULAŞIYOR (`dusunme` 2) ama içeriği KULLANILMIYOR.
  Algının asıl amacı buydu; şu hâliyle `sor` süs.
- **PowerShell'de cmd sözdizimi öneriyor.** Aynı koşuda `cd /d 3dorion &&
  git status` önerildi. Kabuk PowerShell; `cd /d` orada geçersiz. Onay kapısı
  doğru tuttu, ama öneri çalışmazdı. Talimata kabuk türü yazılmalı.

## Sözleşme kalitesi (iyileştirme, arıza değil)

Satır sözleşmesi çalışıyor ve tez uçtan uca geçti. Bunlar cila:

- **Model fazladan satır üretiyor.** Terminal hatasında hem `KOMUT:` hem
  gereksiz `TAHTA:` yazdığı görüldü. Zararsız (tahta yazısı yakınlık kuralına
  takılır) ama gürültü.
- **`GIDILECEK:` ölçümü dar.** İki senaryo, tek model. Seçim doğru görünüyor
  (`GIT:` 1/2 + kaçak, `GIDILECEK:` 2/2 + kaçak yok) ama örneklem küçük.
- **Sonda ile uygulama farkı.** `tools/sozlesme-sonda.ts` tek turluk ve temiz
  oturum kullanıyor; uygulama OpenCode oturumunun biriken bağlamından
  yararlanıyor. Sonda bu yüzden uygulamadan kötü sonuç veriyor — ölçüm aracı
  gerçeği yansıtmıyor.
- **İki örnek kaynağı.** `ornekler.ts` few-shot'ları araç çağrısı biçiminde
  tutuyor ve OpenCode yolunda KULLANILMIYOR; örnekler ayrıca
  `SOZLESME_TALIMATI` içine metin olarak gömülü. Tek kaynak olmalı.

## Görünüm / kullanım

- **Zoom hapı (%100) şema panelinin başlık şeridine biniyor.** Metinle
  çakışmıyor, işlevsel etkisi yok; yeri ideal değil.
- **Oyuncu gövdesi kapsül.** Omuz kamerasında belirgin duruyor. Gizleme eşiği
  (2.0 m) ve omuz kayması (0.85) ölçümle ayarlandı, ama gerçek çözüm daha ince
  bir gövde ya da gerçek avatar.
- ~~Günlük panelinin yazısı küçük~~ — **ÖLÇÜLDÜ, SORUN YOK.** 18 satırda punto
  42 mm; görme açısı panel odağında 126', oda ortasından 49', en uzak köşeden
  29'. Rahat okuma eşiği ~20-30' olduğuna göre her mesafede yeterli. Ekran
  görüntüsünde küçük görünmesinin sebebi çekimin 5.2 m'den ve geniş açıdan
  alınmış olmasıydı — panel değil, çekim.
  (Üst yarının boş kalması kusur değil: günlük terminal gibi alttan dolar.)

## Güvenlik

- **`OPENCODE_SERVER_PASSWORD` ayarlı değil.** Kod tarafı hazır: değişken
  verilirse hem host hem beyin otomatik kullanıyor. Sunucu şu an localhost'ta
  şifresiz.

## ÇÖZÜLENLER (referans)

**2026-09-17:** `gordum` — sorunun cevabı artık beyne ulaşıyor, CANLI
doğrulandı (`bakdene`: `[SOR]` sonrası ikinci `[BEYIN→NIYET]`, `dusunme` 1→2) ·
devre panosu S0–S7 (`docs/specs/05`) · onay kapısı son tarihinin geriye dönük
değişmesi (S0).

**2026-09-15/16:**

`BAK:` etiketi CANLI doğrulandı (model doğru sorgu türünü seçiyor: "odada neler var"→`onumde`, "ben neredeyim"→`oyuncu`) · Terminal kamera açısı (1./3. şahıs aynı çerçeve, görsel doğrulandı) · fare kipi
(odağa bağlı: gezinirken fare kamerayı sürer, ekranda imleç serbest + Ctrl'le kamera) · açılış manzarası (görünürlük her tikte,
doğum yeri, omuz kayması) · `bak` kilidinin `git` varış yönünü ezmesi · poster
çakışması · geçici hatada oturumun silinmesi · `GIT:` etiketinin kabuk
komutuyla karışması · sağlayıcı hatasının 200 gövdesinde gizlenmesi · günlük
kotada 5 dk'lık boşuna yeniden deneme · senaryo/beyin niyet çakışması.
