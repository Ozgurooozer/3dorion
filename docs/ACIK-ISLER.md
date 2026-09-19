# Açık İşler — birlikte bakılacak

> Bu liste "hemen çöz" listesi DEĞİL. Yan yolda çıkan, asıl işi bloke etmeyen
> kusurlar buraya yazılır ve önceliği Ozyn belirler.
> Son güncelleme: 2026-09-18

## Karar bekleyen (büyük)

- ~~**MCP kaydı (Aşama 3).**~~ — **YAPILDI (2026-09-19)**, spec 05 §8.
  Aşama 1–4 canlı kapılardan geçti: R2 (ajanda Bash yok), `tezdene` (ajan
  `dunya_komut` önerdi, onay kapısı tuttu), R1 (ajan öldürülünce sağ lob
  devraldı). Açık: Aşama 7 — ikinci ajan (OpenCode) + sayıyla karşılaştırma.
- **Orion'un inisiyatifi.** Şu an tepki veriyor, kendi gündemi yok. Hafıza var
  ama kişilik/süreklilik zayıf. Projenin asıl vaadi buydu.
- **VRM avatar** — `assets/orion.vrm` aslında Cesium_Man, 0 morph target;
  yüz ifadesi bu yüzden sınırlı. (Ozyn ertelemişti.)
- **STT yok** — mikrofon donanımı yok. (Ozyn ertelemişti.)

## Sıradaki (2026-09-17 kod incelemesinden, bu sırayla)

1. **Senaryoları `world/giris.ts`'ten çıkar.** Dosya 2.312 satır, 1.304'ü
   (21 blok) `?xxxdene` senaryosu — test kodu üretim dosyasında ve bundle'da.
   `world/senaryolar/` altına, dinamik import ile.
2. **Ayar normalizasyonu artık 5 kopya** (2026-09-19'da `mind/inisiyatif.ts` beşinciyi ekledi — ponytail açıkken; bkz. `docs/olcum-ponytail.md`). Eski metin: `mind/dikkat.ts`, `ajanda.ts`, `hafiza.ts`,
   `onayKapisi.ts` aynı `sayı | () => sayı` çevirimini ayrı ayrı yapıyor.
   Tek yardımcıya indirilmeli.
3. **`world/surfaces/sema.ts` testsiz** (824 satır). Saf yardımcılar
   (`satirla`, `suredenBeri`, `degerYaz`) canvas'sız sınanabilir.
4. ~~**Sonra teze dön — önce cevabın KULLANILMASI.**~~ — **ÇÖZÜLDÜ**
   (2026-09-17/18). Aşağıda "ÇÖZÜLENLER".

5. **Orion'un inisiyatifi — artık kapı AÇIK.** K1 "sadakat önce" diyordu,
   sağlandı (%100). İkinci ön koşul da geldi: fayda puanlaması için MALİYET
   gerekir ve Faz 2'den sonra gövdenin hata payı var. Eksik olan güç bütçesi
   (`docs/FIKIR-HAVUZU.md`).

## Beyin davranışı (canlıda görüldü, 2026-09-17)

- ~~**Orion gördüğünü değil uydurduğunu anlatıyor.**~~ — **ÇÖZÜLDÜ**
  (spec 06 Faz 1–5, ölçüldü). Aşağıya taşındı.

- ~~**Yerel model gözlenen nesneyi sık sık HİÇ söylemiyor.**~~ — **TEŞHİS
  YANLIŞTI** (2026-09-18, spec 06 §6.8). Sorun sessizlik değil kelime
  salatasıydı ve sebebi modelin yetersizliği değil, **Türkçe bağlamdı**:
  aynı model İngilizce çerçevede 0/10 → 9/10 doğru araç, 2,3 kat hızlı.
  Bağlam İngilizceye alındı. ESKİ METİN (yanlış teşhis) referans için:
  "`qwen2.5:7b` aynı bağlamda %30–56 sadık ... boşluk artık bağlamda değil
  MODELDE" — bu cümle ham çıktıya bakılmadan yazılmıştı.

- **Yerel modelin Türkçe SÖZ kalitesi hâlâ ölçülmedi.** İngilizce bağlamda
  araç çağırmayı düzgün yapıyor (9/10) ama Türkçe cümle kurarken nasıl,
  ölçülmedi — `dunya_soyle` metnini puanlayan bir koşu gerekiyor. Alet hazır:
  `tools/sadakat-olc.ts --beyin=yerel --fixture=fixtures/sadakat/E3-ing-cerceve.json`.
  Not: eski ölçümde "Sessiz kalıyorum" deyip soruyu
  cevapsız bırakıyor. Sıradaki aday: daha iyi bir yerel model ya da bu tur
  için `dis` beynine düşme. Alet hazır: `tools/sadakat-olc.ts --beyin=yerel`.
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

## Test düzeneği

- **Tarama kapıları ağır.** `zihindene`'deki AYNA/S5/S6 kapıları ekranı
  senkron `sahne.pick` ile tarıyor; o aralıkta FPS 100 → 8–19'a düşüyor
  (ölçüldü, 2026-09-17). Ürün değil düzenek; senaryolar `giris.ts`'ten
  çıkarılırken daha seyrek ızgara ya da erken çıkışla düzeltilmeli.
- **Açıklanamayan iki panel yazması, tekrarlanamadı.** Bir koşuda
  `dikkat.tekrar = 4000`, bir başkasında istenmemiş `yerel:qwen3` geçişi
  görüldü. Kodda sentetik tıklama yok; tek yol panel tıklaması. O koşularda
  `[TIKLAMA]` günlükte aranmamıştı, artık her panel tıklaması iz bırakıyor.
  Ayrıca aynı koşuda ekran görüntüsünde FPS 2 / 100 atlanan tik görüldü;
  örnekleyiciyle tekrar koşunca seçici sonrası FPS sabit 100 çıktı.
  Makinede eşzamanlı başka GPU yükü olabilir.

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

**2026-09-18:** **Bağlam dili + beden mimarisi.**
- **Bağlam İngilizce çerçeveye geçti** (spec 06 §6.8). `qwen2.5:7b` Türkçe
  bağlamda 1. turda 10/10 YANLIŞ araç seçiyor ve kelime salatası üretiyordu;
  İngilizce çerçevede 9/10 doğru ve 2,3 kat hızlı. Haiku'da sadakat
  %90 → **%100**. Sınır: İngilizce = makineye ait olan; Türkçe = odadaki
  şeylerin adları ve Orion'un sesi. Protokol kimlikleri (`KOMUT:`, `onumde`)
  çevrilmez.
- **Beden mimarisi, donanım disiplininde** (Faz 0–5). Gövde künyesi
  bildirimsel tabloya (`protocol/bedenTanimi.ts`) · `AvatarIskeleti`
  Babylon'dan kurtuldu · **aktüatör doyumu**: komut artık gerçekleşene eşit
  değil (0,1 → 1,25 m/s, 13 tik; fren 1,187 → 0,587 → 0) · propriyosepsiyon
  bağlama girdi, sadakat düşmedi (%100) · **LED yüz üçüncü sürücü olarak
  çalıştı** (canlı HIL 4/4).
- **Claude Haiku artık seçilebiliyor**; adaptörü Electron başlatıyor.
- Yol boyunca **dört gerçek hata**, hepsi ölçümle: `refleks.ts` ölü bir dalı
  canlı sanıyordu (önek kayması) · `zaman.test.ts` üç fonksiyonun kopyasını
  tutuyordu · `_hiz` her tik sıfırlanıyordu (gövde 0,1 m/s'de saplandı) ·
  fren hedefin merkezine göre hesaplanıyordu, hiç devreye girmiyordu.
- **Yapılmayanlar, gerekçeli:** duyu gecikmesi (~150 ms bu dünyada
  gözlemlenemez; örnekle-tut zaten `calismaBellegi`de var) · IDF (K6).

**2026-09-17 (akşam):** **Uydurma sorunu kapandı — spec 06 Faz 1–5.**
Kök neden ölçüldü, düzeltildi ve canlı doğrulandı: anlık gözlem kalıcı
hafızaya yazılıyordu, getirme eşiksizdi, anılar zamansız/kaynaksız
sunuluyordu. Sonuç `claude:haiku` ile **%0 → %90 sadakat**, uydurma 22 → 1
(n=10). Canlı `bakdene`: Orion kendi `dunya_sor` çağırdı ve algının verdiği
şeyi aynen söyledi. Yol boyunca iki gerçek hata daha çıktı:
`bridge/ollama.ts` anıları HİÇ göndermiyordu (yerel beyinde hafıza yoktu) ve
iki hafıza testi yanlış sebepten yeşildi.

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
