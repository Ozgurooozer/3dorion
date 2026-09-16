# Açık İşler — birlikte bakılacak

> Bu liste "hemen çöz" listesi DEĞİL. Yan yolda çıkan, asıl işi bloke etmeyen
> kusurlar buraya yazılır ve önceliği Ozyn belirler.
> Son güncelleme: 2026-09-15

## Karar bekleyen (büyük)

- **MCP kaydı (Aşama 3).** Satır sözleşmesinin yerini alacak gerçek
  tool-calling. Ozyn OpenCode tarafında skill yazacaktı. Aşağıdaki
  "sözleşme kalitesi" maddelerinin çoğunu kökten anlamsızlaştırır.
- **Orion'un inisiyatifi.** Şu an tepki veriyor, kendi gündemi yok. Hafıza var
  ama kişilik/süreklilik zayıf. Projenin asıl vaadi buydu.
- **VRM avatar** — `assets/orion.vrm` aslında Cesium_Man, 0 morph target;
  yüz ifadesi bu yüzden sınırlı. (Ozyn ertelemişti.)
- **STT yok** — mikrofon donanımı yok. (Ozyn ertelemişti.)

## CANLI DOĞRULAMA BEKLEYEN

- **`BAK:` etiketi.** Algı hizmeti yazıldıktan sonra fark edildi: talimat
  modele "odaya bakmak için `dunya_sor` kullan" diyordu ama satır
  sözleşmesinde karşılığı YOKTU — yani Orion bakma isteğini ifade edemiyordu
  ve hizmet ulaşılamazdı. `BAK: <onumde|yakin|oyuncu|dunya>` eklendi,
  5 birim testle korunuyor (399/399), AMA sağlayıcı kotası dolduğu için
  gerçek modelle hiç sınanmadı. Model bu etiketi gerçekten üretiyor mu,
  bilinmiyor.
  Sınama yolu: kota açıkken `T` → "önünde ne var" → günlükte `sor(onumde)`
  satırı ve şemada `BAKIŞ` kutusunun yanması beklenir.

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

- **Oyuncu gövdesi kapsül.** Omuz kamerasında belirgin duruyor. Gizleme eşiği
  (2.0 m) ve omuz kayması (0.85) ölçümle ayarlandı, ama gerçek çözüm daha ince
  bir gövde ya da gerçek avatar.
- **Günlük panelinin üst yarısı boş.** 18 satır ayrılmış, olay azken üstte
  boşluk kalıyor. Terminal davranışı (en yeni altta) doğru; yine de satır
  sayısı düşürülüp yazı büyütülebilir.

## Güvenlik

- **`OPENCODE_SERVER_PASSWORD` ayarlı değil.** Kod tarafı hazır: değişken
  verilirse hem host hem beyin otomatik kullanıyor. Sunucu şu an localhost'ta
  şifresiz.

## Bu oturumda ÇÖZÜLENLER (referans)

Terminal kamera açısı (1./3. şahıs aynı çerçeve, görsel doğrulandı) · fare kipi
(odağa bağlı: gezinirken fare kamerayı sürer, ekranda imleç serbest + Ctrl'le kamera) · açılış manzarası (görünürlük her tikte,
doğum yeri, omuz kayması) · `bak` kilidinin `git` varış yönünü ezmesi · poster
çakışması · geçici hatada oturumun silinmesi · `GIT:` etiketinin kabuk
komutuyla karışması · sağlayıcı hatasının 200 gövdesinde gizlenmesi · günlük
kotada 5 dk'lık boşuna yeniden deneme · senaryo/beyin niyet çakışması.
