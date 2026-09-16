# Algı Hizmeti ve Zihin Duvarı (Spec v1)

> Karar tarihi: 2026-09-15 · Sahip: Ozyn · Yönetici: Orion (Claude Code)
> Durum: **uygulandı ve ölçüldü** — her iddianın altında koşulmuş bir kanıt var.

Bu belge iki soruyu yanıtlar:

1. **Orion odayı görebiliyor mu?** Sensör mü tasarlayalım, haritayı okuyan bir
   adaptör mü?
2. **Sistem kendi işleyişini gösterebiliyor mu?** Bir arıza olduğunda "Orion
   neden sustu" sorusunun cevabı nerede?

---

## 1. Algı: ara adaptör, ama görüş kısıtı gerçek

### Karar

Veri **haritadan doğrudan okunur** (ucuz), ama her nesne **gerçek ışın
testinden geçer** (`world/player/isinTarama.ts`, `KATI_YUZEYLER`).

### Neden sensör simülasyonu değil

Sahte bir göz, derinlik haritası ya da görüntü işleme israf olurdu: veri zaten
bellekte duruyor. Bir "göz" yazıp onu yeniden keşfetmek, bildiğimiz şeyi
unutup tekrar öğrenmektir.

### Neden düz veri dökümü de değil

O zaman Orion duvarın arkasını, kapalı kapının ötesini, arkasındaki tahtayı
"görür". Odada olduğunu iddia eden ama fizik tanımayan bir şey çıkardı ortaya —
varlığın inandırıcılığı tam burada kırılır.

### Arayüz

`mind/algiHizmeti.ts`, saf ve enjekte edilebilir (Babylon bağımlılığı yok).

| Soru | Ne döner | Bütçe |
|---|---|---|
| `onumde` | Bakış konisindeki **tek** en yakın şey | 90 krk |
| `yakin` | 2.5 m içindeki görünür şeyler, yakından uzağa | 160 krk |
| `oyuncu` | Ozyn nerede — görünmüyorsa **bilinmediği söylenir** | 110 krk |
| `dunya` | Buradan görünen her şey + kaç şeyin görünmediği | 300 krk |

Üç kural, üçü de testli:

- **Ham koordinat sızmaz.** Orion "2.34 m" demez, "birkaç adım ötede" der.
- **Bütçe aşılırsa kırpılır ve kırpıldığı söylenir.** Sessiz eksiltme, yanlış
  bilgiden beterdir.
- **Sanal çapalar elenir.** `oda_ortasi` gidilebilir bir hedeftir ama görülebilir
  bir nesne değildir; ilk canlı koşuda Orion "yakınında odanın ortası var"
  diyordu.

### Kanıt

`3dorion.bat gordene` — aynı soru iki farklı yerden sorulur:

```
masada   yakin: yönetim terminali, çalışma masası, monitör
tahtada  yakin: beyaz tahta
masada   dunya: … (1 şey buradan görünmüyor)
GECTI cevap konuma bagli (4/4 soru degisti)
GECTI butce tavani korundu
```

Sınanan şey cevabın *varlığı* değil, **konuma bağlı olması**. Bağlı değilse
görüş kısıtı sahtedir ve elimizde yalnızca süslenmiş bir veri dökümü vardır.

### Modelin buraya ERİŞİMİ — sonradan fark edilen boşluk

Hizmet yazıldı, protokole eklendi, talimatta Orion'a "odaya bakmak için
`dunya_sor` kullan" dendi. Ama model satır sözleşmesiyle cevap veriyor ve
sözleşmede `sor` için etiket YOKTU: Orion bakma isteğini ifade edemiyordu.
Hiçbir hata vermeden, sadece "hiç kullanılmıyor" olarak sessiz kalıyordu.

`BAK: <onumde|yakin|oyuncu|dunya>` eklendi — sözleşmede, talimatta ve
örneklerde. Geçersiz sorgu ayrıştırıcıda reddedilir (protokole gereksiz tur
attırmamak için) ve çağrı sırasında en önde durur: bilgi, eylemden önce gelir.

> DURUM: birim testlerle korunuyor ama sağlayıcı kotası dolduğu için gerçek
> modelle SINANMADI. Modelin bu etiketi üretip üretmediği bilinmiyor
> (bkz. `docs/ACIK-ISLER.md`).

### Yan kazanç: algı bir ölçüm aracı oldu

`gordene` çıktısı, hiç aramadığımız bir hatayı ortaya çıkardı — bkz. §3.

---

## 2. Zihin duvarı: sistemin kendini göstermesi

Sağ duvarda iki salt-okunur panel, masada üçüncü bir ekran.

| Yüzey | Ne gösterir | Neden ayrı |
|---|---|---|
| **ZİHİN AKIŞI** (`sema`) | Algı → süzgeç → dikkat/refleks → düşünce → niyet → beden/onay; canlı parıltı, sayaç, gecikme | Anlık **durum** |
| **GÜNLÜK** (`gunluk`) | Zaman damgalı, seviye renkli olay akışı | **Tarihçe** |
| **YÖNETİM TERMİNALİ** (`admin`) | Gerçek PowerShell, masada ikinci monitör | Ayrı **amaç** |

Durum ile tarihçe aynı yüzeyde okunmaz; bu yüzden iki panel.

### Yönetim terminali köprüye bağlı DEĞİL

Ana monitör Orion'un izlediği ekrandır: oradaki her komut çıktısı algı hattına
girer. Yönetim işi (dünyayı kurcalamak, günlüğe bakmak) Orion'un algısına
gürültü olarak düşmemeli. Bu iddia ölçüldü:

```
GECTI admin cikisi Orion'a sizmadi (dusunme 0 -> 0)
```

### `BAKIŞ` düğümü neden ayrı

Diğer düğümlerde bilgi dünyadan beyne akar; `dunya_sor`'da beyin bilgiyi
**kendi ister**. `ALGI` kutusunun içinde göstermek iki farklı yönü tek şeymiş
gibi okutuyordu.

---

## 3. Bu turda ölçümle ÇÜRÜTÜLEN iki tez

Bu bölüm bilerek duruyor: yanlış gerekçe kodda kalırsa bir sonraki kararı da
zehirler.

### 3.1 "OpenCode'un yapısal çıktısı askıda kalıyor" — YANLIŞ

İlk ölçüm şuydu:

```
şema YOK 8.6 sn doğru | şema VAR 60 sn abort | + retry 90 sn abort
```

Sonuç: "`format: json_schema` bu model/sağlayıcıda askıda kalıyor."

Aynı sonda tekrar koşulunca sonuç **tersine döndü** (şemasız abort, şemalı
9.5 sn). Gövdeye bakılınca asıl sebep göründü:

```
APIError 429: Rate limit exceeded: free-models-per-day
```

Gecikmeyi şema değil **kota** üretiyordu; iki ölçüm de o gürültüyü ölçmüştü.

**Ders:** tek koşuluk bir ölçüm, kararsız bir sağlayıcıda kanıt değildir.
Ters sonuç verebilen bir ölçümü tekrarlamadan tez kurmayın.

Satır sözleşmesi (`bridge/satirSozlesmesi.ts`) yine de tercih ediliyor, ama
**doğru gerekçeyle**: ayrıştırma bizde, sağlayıcının şema desteğine bağımlı
değiliz, ve testleri sağlayıcısız koşuyor. Kalıcı çözüm yine MCP kaydı.

### 3.2 "Sağlayıcı hatası HTTP durumundan görülür" — YANLIŞ

OpenCode sağlayıcı hatasını **HTTP 200 gövdesine gömüyor** (`info.error`),
üstelik 70-75 sn yeniden deneyerek. Kod `y.ok`'a baktığı için hiç görmüyordu:
Orion sessizce susuyor, sebebi hiçbir yerde görünmüyordu.

Alınan önlemler (`bridge/opencode.ts`):

- `info.error` okunur, `SaglayiciHatasi` fırlatılır.
- `AbortError` anlamlı mesaja çevrilir (30 sn tavan, 70 sn'lik kotadan önce vurur).
- **Devre kesici:** 3 ardışık arıza → 5 dk anında hata. Kota doluyken her algı
  30 sn boşa harcıyordu.
- Arıza odada görünür: altyazı + günlük. Orion'un *sesiyle* değil — bu sistemin
  arızası, onun sözü değil.

---

## 4. Bulunan ve düzeltilen davranış hataları

| Hata | Nasıl bulundu | Karar |
|---|---|---|
| Odak kipi yüzeyin yönünü sürmüyordu; 1. şahısta terminale eğik bakılıyordu | Kullanıcı bildirdi | `cizimGuncelle` odak dalını da yönlendirir; odak bırakılırken senkron |
| Açılı yüzeyler yanlış çerçeveleniyordu | Ekran görüntüsü | `odakKilitle` isteğe bağlı **yön** alır, yüzeyin kendi normalini kullanır |
| `bak` kilidi `git`in varış yönünü eziyordu | `gordene` çıktısı | Açık varış yönü olan `git`/`otur` **bakış kilidini düşürür** |
| Posterler zihin duvarıyla çakışıyordu | Ekran görüntüsü | Posterler boş duvarlara taşındı |
| Beyin+ajanda, senaryolu beden denemelerini kesiyordu | Yapay çakışma üretilerek | **Senaryo kipi**: beden denemelerinde beyin ve ajanda susar |
| Fare kipi TERS kurulmuştu: imleç her yerde serbest, kamera her yerde Ctrl | Kullanıcı bildirdi | Kip **odağa** bağlandı (aşağıya bak) |
| Zihin duvarı panellerine `E` basmak hiçbir şey yapmıyordu | Fare düzeltmesi sırasında | `E` ve tıklama aynı `YUZEY_GECISI` tablosunu kullanır |
| `Esc` panel odağını çözmüyordu — panelde mahsur kalınıyordu | Aynı tarama | `Esc` üç aşamalı: etkileşim → odak → kilit |

### Senaryo kipindeki kritik ayrım

`BEDEN_SENARYOLARI` listesinde yalnızca **bedeni** sınayan kipler vardır.
Beyni **test eden** kipler (`tezdene`, `tahtabeyin`, `hafizadene`, `gorudene`,
`sessizdene`, `davranis`, `otodene`) listede **yoktur** — orada beyni susturmak
testin kendisini anlamsız kılardı.

Bu arıza ölçüm anında **gizliydi** (kota yüzünden beyin zaten ölüydü ve deneme
3/3 geçiyordu). Gizlenmiş hâliyle bırakılmadı; çakışma yapay olarak üretildi:

```
rakip niyet zorla → konum 1.8,-2.6 (sapmış)  → KALDI
susturma devrede  → konum -3.7,-0.4 (tahtada) → GECTI
```

---

## 4b. Fare kipi — odağa bağlı, ölçülü bir karar

İlk sürüm imleci her yerde serbest bırakıp kamerayı her yerde `Ctrl`'ye
bağlamıştı. İki yönden de yanlıştı: odada gezerken bakmak için sürekli `Ctrl`
basmak yorucu, ekrandayken ise `Ctrl` kamerayı hiç sürmüyordu.

| Durum | Fare | Kamera |
|---|---|---|
| Gezinirken (odak yok) | kamerayı sürer (kilitli imleç) | fare — tuş gerekmez |
| Odakta (ekran/panel) | **imleç serbest**, tıklayıp seçilebilir | `Ctrl` + fare |

Üç incelik, üçü de bilinçli:

- **Odakta pointer lock ALINMAZ.** `movementX/Y` kilitsiz `mousemove`da da
  gelir; kilit alsaydık imleç kaybolur ve **`Ctrl+C` kabuğun elinden giderdi.**
- **`odakBirak()` kilidi kendisi ister.** "Ekrandan çıkınca normal kamera"
  beklentisi fazladan bir tıklama gerektirmemeli.
- **Karar kameradan AYRI.** Kip mantığı `world/engine/fareKipi.ts`'te ve
  Babylon'a hiç dokunmuyor; sahne/matris kurmadan sınanıyor (12 test, 0.19 sn).
  Grafik incelemesi `KameraRig`i en yüksek betweenness düğümü olarak
  işaretlemişti — girdi kararı orada durmamalıydı.
- **Tıklanabilirlik görünür.** Odakta imlecin altındaki yüzey geçilebilirse
  imleç `pointer` olur ve adı altyazıda yazar — gizli davranış kullanılabilir
  sayılmaz. Işın testi 60 ms'de bir yapılır (fare olayları 100+ Hz gelebiliyor).

## 5. Görsel doğrulama yolu

Görsel işlerde test geometriyi doğrular, "ekranda doğru görünüyor mu" sorusunu
yanıtlamaz. Artık duman koşusu pencereyi PNG'ye basabiliyor:

```
ORION_SS=<yol> ORION_SMOKE=1 npx electron .
```

Bu oturumda üç ayrı hata **yalnızca** bu yolla bulundu (poster çakışması,
kamera çerçevelemesi, panel yerleşimi).

---

## 6. Açık işler

- **OpenRouter kotası** — uçtan uca tez testi (`tezdene`) buna bağlı; her istek
  70 sn sonra 429. 10 kredi ya da NVIDIA anahtarı.
- **MCP kaydı (Aşama 3)** — satır sözleşmesinin yerini alacak gerçek tool-calling.
- **`OPENCODE_SERVER_PASSWORD`** ayarlı değil; sunucu kendi uyarısını yazıyor.

---

## Deneme kipleri

| Komut | Ne kanıtlar |
|---|---|
| `3dorion.bat gordene` | Algı konuma bağlı, bütçe korunuyor |
| `3dorion.bat zihindene` | İki panel doğru çiziliyor |
| `3dorion.bat admindene` | Yönetim terminali gerçek kabuk, Orion'a sızmıyor |
| `3dorion.bat senaryodene` | Senaryo kipi rakip niyetleri gerçekten susturuyor |
