# Ön kayıt — Markov hafıza, aşama 2: duvarda salt okunur kural grafiği (2026-10-15)

**Soru:** Hafıza panelinde kural tablosu "bloklar halinde, node graph gibi, kim kime gidiyor" görünebilir mi, ve bu görünüm
tablodan TÜRETİLEBİLİR mi (çizim ayrı bir kopya olmadan)? (Ozyn: "kuralları hafıza panelinden görsel olarak görebilelim, bloklar
halinde, node graph gibi düşün, basit".) Düzenleme YOK (aşama 3); yalnız görme ve seçip açıklamasını okuma.

**Tasarım (basit, tek bakışta):**
- Hafıza bulutunun alt şeridine **[Kurallar]** düğmesi; kurallar görünümünde **[‹ Bulut]** ile dönülür.
- Üst sıra: **algı → ELE → İÇERİK → ÖNEM → hafızaya yaz** kutuları, aralarında oklar (`sonra` kenarları).
- Her grubun altında kuralları kutu olarak dizili (`içerir` kenarı: ince dikey omurga). Kutuda: kural kimliği + koşulun kısa
  hâli + varsa DEĞİŞKEN (önem 3, baş 4 / son 8).
- "at" kuralları kırmızı kenarlı; **reddet** kutusu algı sütununun altında, at kurallarından kırmızı oklar ona gider.
- Kutuya tıklayınca alt şeritte: açıklama (neden) + koşul + sonuç. Seçili kutu vurgulanır.
- Veri: kompozisyon kökü (`zihinDuvari.ts`) `grafik()` çıktısını panele bağlar (`world/` `mind/`i görmez, K4).

**Ölçütler (ölçmeden ÖNCE):**
- **G1 yerleşim saf ve çakışmasız:** düğümlerin TAMAMI tam bir kez yerleşir; kutular birbiriyle kesişmez; hepsi tuvalin içinde.
  Üç tuval boyutunda (1024×512, 910×512, 640×360).
- **G2 oklar kutulara değer:** her kenar bir çizgi dizisine dönüşür, uçları ilgili kutuların kenarında; kenar sayısı = çizilen ok sayısı.
- **G3 türetme:** kutu sayısı = `grafik()` düğüm sayısı; tabloya kural eklenince (testte) kutu da eklenir, çizim kodu değişmeden.
- **G4 metin sığar:** kutuya yazılan hiçbir satır, kutu genişliğini aşmaz (ölçülmüş genişlikle kırpılır; kırpma "…" ile belli).
- **G5 canlı kapı (`zihindene`):** GERÇEK tıklamayla [Kurallar] açılır; ekrandaki kural kutularının sayısı tablodaki kural sayısına eşit;
  bir kutuya tıklayınca seçili kural değişir; ekran görüntüsü alınır ve BAKILIR (okunabilirlik).
- **G6 salt okunur:** kurallar görünümünde yazma/silme yolu yok (pano çağrısı yok; testle: görünümdeki bölge işlemleri yalnız
  `gorunum` ve `kural`).
- **Okunabilirlik (öznel):** ekran görüntüsünde kural kimlikleri okunuyor mu — Ozyn'in gözü karar verir; ben görüntüye bakıp
  dürüstçe yazarım ("okunuyor/okunmuyor"), geçti saymam.

**Kapsam dışı:** düzenleme, canlı tetiklenme sayaçları ("şu an hangi kural çalıştı"), kural ekleme/silme, sürükleme.

## SONUÇLAR
Koşu: 2026-10-15. Ön koşul: `aniKaydi` kural tablosuna devredildi (`f74df51`, referans testte, 1284 kombinasyonda 0 fark).
Kod: `world/surfaces/duvar/kuralGrafigi.ts` (+ test), `mind/hafizaKurallari.ts` (`grafik()` kısa koşul/başlık alanları),
`tools/kural-grafigi-olc.ts`, `zihindene` KURALLAR kapısı. Ekran görüntüsü: `docs/olcum/markov-hafiza-2/kurallar-gorunumu.png`.

- **G1 yerleşim: GEÇTİ.** Gerçek tablo (20 düğüm) üç boyutta (1024×512, 910×512, 640×360): her düğüm tam bir kez, 0 kesişme, 0 taşma
  (`tools/kural-grafigi-olc.ts`; sentetik grafikle birim testi de geçti).
- **G2 oklar: GEÇTİ.** 21 kenar = 21 ok, hepsinin uçları ilgili kutunun kenarında (üç boyutta).
- **G3 türetme: GEÇTİ.** Kutu sayısı grafik düğüm sayısına eşit; sentetik testte kural eklenince kutu ve ok da eklendi (çizim kodu aynı).
  Canlıda ekranda 14/14 kural kutusu bulundu.
- **G4 metin sığar: GEÇTİ (birim).** `kisalt` ölçülmüş genişliği aşmıyor, kırpmayı "…" ile belirtiyor. Canlı görüntüde bazı koşul satırları
  hâlâ kırpık ("yeni · duydum · k…", "test-g…", "ortam-hat…", "baş satır 4…"); tam metin kutuya tıklayınca alt şeritte.
- **G5 canlı kapı: GEÇTİ.** `3dorion.bat zihindene`: GERÇEK tıklamayla [Kurallar] açıldı, `kural_kutusu=14/14`, `komut.dusuk` kutusuna
  tıklanınca seçildi (görüntüde beyaz çerçeve; alt şerit açıklamayı, koşulu ve sonucu yazıyor). Önceki iki koşu eksikti: ilk koşuda
  tam ekran tarama süre sınırına takıldı, görüntüde başlıklar kesilmişti ("ELE — yazılmayac…") ve sağ üst yazı yakınlaştırma
  düğmesinin altında kalmıştı; ikisini düzelttim (iki satırlı başlık, kısa sayaç) ve taramayı duvarın ekran alanıyla sınırladım.
- **G6 salt okunur: GEÇTİ.** Görünümün bölge işlemleri yalnız `gorunum` ve `kural` (üç boyutta ölçüldü); pano çağrısı yok.
- **Okunabilirlik (öznel, benim gözümle ekran görüntüsünden): okunuyor, sınırda.** Kural kimlikleri, "önem N" değişkenleri, grup başlıkları,
  reddet kutusu ve kırmızı kesikli oklar net; koşul satırı kutuya sığmayanlarda kırpık. Kamera uzak (çerçeve 5,2 m); yakında daha rahat
  okunması beklenir ama BAKILMADI. Karar Ozyn'in gözünün.
- **Çürütme tetiklenmedi.** Aşama 2 başarılı. Görünen eksikler: koşul satırı kırpması; canlı tetiklenme sayacı yok (kapsam dışıydı).
