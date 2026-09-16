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

## YARIM KALDI — buradan devam et (2026-09-16)

### `gordum` düzeltmesi: yazıldı + birim testli, CANLI DOĞRULANMADI

**Hata (canlıda görüldü):** Orion `sor` gönderiyor, algı hizmeti doğru cevabı
üretiyor, ama cevap beyne HİÇ ulaşmıyor. Orion soruyor ve cevabı duymuyor.

```
[BEYIN→NIYET] {"tur":"sor","ne":"onumde"}
[SOR] onumde → "yönetim terminali (birkaç adım ötede)"
dusunme: 1        ← ikinci tur hiç olmadı, Orion konuşmadı
```

**Sebebi:** cevap `sonuc` (niyet akıbeti) olarak dönüyordu; `mind/refleks.ts`
başarılı sonuçları "rutin" sayıp beyne çıkarmıyor. O kural EYLEMLER için doğru
("masaya yürüdü → bitti" beyni ilgilendirmez) ama `sor` bir eylem değil, SORU.

**Yapılan değişiklik (3 dosya):**
- `protocol/algi.ts` — yeni varyant `{tur:"gordum", ne, metin}`, kanal `beyin`,
  `ozetle` içinde `Baktın (ne): metin`
- `mind/refleks.ts` — `gordum` HER ZAMAN terfi eder ("sorunun cevabı")
- `world/giris.ts` — `sor` artık hem `sonuc` (niyeti kapatır, rutin) hem
  `gordum` (cevabı taşır) gönderiyor

**Durum:** `npm test` 446/446 yeşil, `tsc` temiz. Refleks için 4 yeni test var.

**YAPILMASI GEREKEN — tek adım:**
```
npx vite build
ORION_BAKDENE=1 ORION_SMOKE=1 ORION_SMOKE_MS=45000 npx electron .
```
Beklenen: `[SOR] onumde → ...` satırından SONRA ikinci bir `[BEYIN→NIYET]`
(`soyle`) ve `[SOZ]` görünmeli — yani Orion gördüğünü söylemeli.
`dusunme` sayacı 2 veya daha fazla olmalı (önceden 1'de kalıyordu).

Çalışmazsa bakılacak yer: süzgeç `gordum`u geçiriyor mu (`[kopru] suzulen`
sayacı), ve dikkat kısması ikinci turu boğuyor mu.

> NOT: Bu bölümdeki iddia belgeye erken yazılmıştı. Spec 03'te "cevap beyne
> geri besleniyor, bir sonraki turda konuşuyor" deniyordu — ölçüm bunun
> YANLIŞ olduğunu gösterdi. Düzeltme yapıldı ama canlı kanıt henüz yok;
> doğrulanana kadar spec'e "çalışıyor" diye yazılmamalı.

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

## Bu oturumda ÇÖZÜLENLER (referans)

`BAK:` etiketi CANLI doğrulandı (model doğru sorgu türünü seçiyor: "odada neler var"→`onumde`, "ben neredeyim"→`oyuncu`) · Terminal kamera açısı (1./3. şahıs aynı çerçeve, görsel doğrulandı) · fare kipi
(odağa bağlı: gezinirken fare kamerayı sürer, ekranda imleç serbest + Ctrl'le kamera) · açılış manzarası (görünürlük her tikte,
doğum yeri, omuz kayması) · `bak` kilidinin `git` varış yönünü ezmesi · poster
çakışması · geçici hatada oturumun silinmesi · `GIT:` etiketinin kabuk
komutuyla karışması · sağlayıcı hatasının 200 gövdesinde gizlenmesi · günlük
kotada 5 dk'lık boşuna yeniden deneme · senaryo/beyin niyet çakışması.
