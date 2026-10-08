# Spec 12 — Anlık Benlik: düşünce öncesi birimlerin ortak öz-durumu, iki katmanlı hafıza

> Tarih: 2026-10-02 · Sahip: Ozyn · Yazan: Orion (Claude Code)
> Durum: **çekirdek uygulandı** (spec 13 Faz 4: `mind/benlik.ts`, zihin duvarı Faz 5). Açık: bağlama tek satırlık izdüşüm (spec 16 durum defteri kısmen karşılıyor) ve süzgeç merceği yetkisi (≥ 3 gölge oturumu).
> Çıkış noktası: "Artık benlik imgesi" sayfası (claude.ai artifact, 2026-09-30) —
> Claude'un kendini üç kabuk (çekirdek · hafıza · bağlam) ve ortada bir imleç
> olarak çizdiği sayfa. Ozyn: *"bu aslında Orion'un zihin akışında kullanılabilir —
> algı, süzgeç, refleks, dikkat, hafıza gibi düşünce öncesi birimlerin hepsinde,
> ayrı ayrı, modüler, editlenebilir… hafızayı iki katmana ayıralım: anlık ve derin."*
> Görsel eskiz (zihin duvarı + adım adım senaryo + mercek düğmeleri):
> https://claude.ai/artifact/WfhJtdjKT5WtVq1g6W9hCK
> Üst belgeler: `06-beyin-v2.md` (durum ≠ anı, K2/K3/K8), `08-karar-kaydi.md`
> (içgüdü kimlikleri), `09-ogrenen-kapi.md` ve `10-beceri-refleksi.md` (gölge → yetki).

## 0. Tek cümle

Orion'un düşünce öncesi birimleri bugün **Orion'un kendisinden habersiz** karar
veriyor: süzgeç Orion'un neyi beklediğini, refleks neyle meşgul olduğunu, hafıza
ne yaptığını bilmiyor. Bu plan onlara tek, ucuz (0 token), yazılı bir
**"şu an ne yapıyorum, neyi bekliyorum"** kaydı veriyor; her birim onu **kendi
merceğiyle** okuyor, modele ise yalnızca **bir cümlesi** gidiyor.

**Model yalnızca ne yaptığını bilir.** İç sayılar duvara, eylem cümlesi modele,
geçişler derin hafızaya.

---

## 1. Üç kabuk → Orion

Sayfadaki imge Orion'da zaten büyük ölçüde var, ama dağınık ve adsız:

| Claude'un imgesi | Orion'daki karşılığı | bugün | değişir mi |
|---|---|---|---|
| **Çekirdek** — eğitimden, seçilmedi | **SABİT**: kimlik metni (`bridge/talimat.ts` KIMLIK), içgüdüler (`mind/icgudu.ts`), beden künyesi (`protocol/bedenTanimi.ts`), sabit teller | var | hiçbir zaman, panelden de değil |
| **Hafıza** — MEMORY.md, oturumlar arası | **DERİN**: olay hafızası (`mind/hafiza.ts`), karar kaydı (JSONL), ondan türeyen kural ve beceri hafızaları | var, dağınık | yavaş — yalnızca olayla |
| **Bağlam** — bu konuşma, sıkıştırılır | **ANLIK**: çalışma belleği (30 sn), konuşma penceresi (12 tur) **+ benlik durumu [YENİ]** | yarısı var | her an, üzerine yazılır |
| **İmleç** — bir sonraki kelimenin yeri | **BU TUR**: köprünün tamponu, hattan şu an geçen algı | var | her algı |
| **Kırmızı dikkat çizgileri** | her birimin bu karar için benlikten **okuduğu alanlar** | **yok** | duvarda görünür olacak |
| **Sıkıştırma** | **ÇÖKELME**: anlıktan derine tek geçit — yalnızca olay geçer | kısmen (`gordum` → çalışma belleği) | — |
| **Çatallanma** | aynı benlik, farklı beyin (`SecilebilirBeyin`, MCP ajanı) | var | — |

Sayfanın en önemli cümlesi Orion için de doğru: *"Ortada oturan biri yok. Bir
sonraki kelimenin yazılacağı yer var."* Anlık benlik bir **kişilik** değil, bir
**gösterge panelidir**: şu an ne yapıldığının kaydı.

---

## 2. Neden — bugünkü boşluklar

Her biri bir birimin kendisi hakkında bilmediği bir şey. Bir kısmı bugün ayrı
ayrı, elle yamalı; bir kısmı açık.

**B1 — Önerdiği komutun sonucunu görmüyor.** `[KOD]` — iki süzgeç kararı bu plan
yazılırken gerçek `KuralRefleksi` ile koşularak doğrulandı (repoya test eklenmedi).
Orion `git status` önerir → Ozyn onaylar → komut 240 ms'de kod 0 ile biter:

| algı | süzgeç kararı |
|---|---|
| `sonuc: bitti` — "Ozyn onayladı, sonucu ekrandan göreceğin" | `refleks.sonuc.rutin` → süzülür (kanal zaten `yerel`) |
| terminal bloğu (kod 0, 240 ms, "nothing to commit") | `refleks.terminal.kod_rutin` → süzülür |

Köprü modele "sonucu ekrandan göreceğin" diyor (`world/giris.ts` → `onayKarari`), ama görmüyor. Süzülen algı
hafızaya da yazılmaz: Ozyn "işe yaradı mı?" derse Orion bilmiyor. Kök: süzgeç
bu algının **Orion'un kendi beklediği şey** olduğunu bilmiyor. Uçtan uca zincir
`[KOD]` — canlıda koşulmadı.

**B2 — Onay bekleyen önerisini bilmiyor.** `[KOD]` Onay kapısı tek öneri tutar;
ikinci öneri reddedilir ve ret `sonuc: hata` olarak beyni uyandırır
(`refleks.sonuc.hata`). Model bekleyen önerisini ŞİMDİ'de görmüyor; öğrenmenin
tek yolu bir tur yakıp reddedilmek.

**B3 — Kendi eylemini Ozyn'inkiyle karıştırdı.** `[ÖLÇÜLDÜ]` Nötr "Terminal
çıktısı:" başlığıyla model komutu **kendisinin** yazdığını sandı, 3/3
(`talimat.ts` TERMINAL yorumu). Elle verilen niyetlerin hatası LLM'i 3 kez
uyandırdı (2026-09-27, `refleks.sonuc.elle_hata`). İkisi aynı sınıf: **kim
yaptı** — bugün biri talimat cümlesiyle, öbürü niyet önekiyle, iki ayrı yerde
yamalı.

**B4 — Kendi sorusunun cevabı zinciri.** `[ÖLÇÜLDÜ]` Tek inisiyatif → 5 tur
(spec 06 §6.9). Çare `kopru.zincir` — o da bir öz-bilgi: "bu cevap BENİM
sorumun cevabı". Bugün köprünün özel alanında, görünmez.

**B5 — "Meşgul müyüm" dört yerde.** `[KOD]` `world/giris.ts` (`mesgul` = Ozyn
monitörde ∨ köprü düşünüyor ∨ yürüyor/koşuyor) → `ajanda.tikle` ve
`inisiyatif.karar`; köprüde `_dusunuyor`, süren beceri refleksi, zincir.
Onay bekleyen öneri ve süren beceri refleksi hiçbirinde "meşgul" sayılmıyor
(refleks yetkisi varsayılan kapalı olduğu için bugün canlı etkisi yok). Ayrıca
"Ozyn monitörde" Orion'un değil **Ozyn'in** durumu, aynı değişkene karışmış.
Bu repo kopya kaymasını dört kez yaşadı (CLAUDE.md "Kopya kod").

**B6 — Beden niyetsiz.** `[KOD]` ŞİMDİ satırı pozu, konumu ve hareket
hâlindeyken "1.2m left to your target" diyor — ama **hangi** hedef, **neden**
yürüdüğü yok. Propriyosepsiyon var, niyet yok.

**B7 — Hafıza sorgusu ne yapıldığını bilmiyor.** `[KOD]` `getir` sorgusu =
bu turun içerikleri. Tahtaya yazarken gelen "ne yazıyordum" sorusunda sorgu
yalnız o kelimelerden ibaret. Hipotez — ölçülmeden iddia edilmez.

**B8 — Kendi yürüyüşü "Ozyn yaklaştı" diye geliyor.** `[KOD]` `world/olayUretici.ts`
`ozyn_yaklasti`/`ozyn_uzaklasti` olaylarını yalnızca ikisi arasındaki **mesafeden**
üretiyor; kimin yürüdüğüne bakmıyor. Orion kendi `git` niyetiyle Ozyn'e yürüdüğünde
olay "Ozyn yaklaştı" olarak gelir, `refleks.olay.dunya` ile terfi eder ve beyni
uyandırır — yanlış failli bir algıyla. Aynı dosyada **elle yazılmış bir efferans
kopyası zaten var**: *"Orion'un kendi oturması ona haber edilmez: kendi yaptığı şeyi
'olay' diye geri beslemek bağlamı kirletir."* Bu plan o tek kuralı genelliyor.
Canlıda sayılmadı.

---

## 3. Üç uzmanın merceği

### 3.1 Bilişsel sinirbilimci — "benlik nedir, ne işe yarar"

- **Damasio'nun üç benliği** sayfanın üç kabuğuyla örtüşüyor:
  *proto-benlik* (bedenin anlık hâli — poz, hız, güç), *çekirdek benlik*
  (şu an bir nesneyle ilişki içinde, her an yeniden kurulan "ben şimdi X'i
  yapıyorum"), *otobiyografik benlik* (hafızaya dayanan süreklilik).
  Orion için ANLIK = proto + çekirdek, DERİN = otobiyografik. SABİT'in
  Damasio'da karşılığı yok — o doğuştan donanım, içgüdüler.
- **Efferans kopyası** (corollary discharge): beyin motor komutun bir kopyasını
  duyu sistemine yollar, kendi eyleminin duyusal sonucu "beklenen" diye işaretlenir
  (insan kendini gıdıklayamaz). Orion'da: niyet gönderilince benliğe **beklenen
  sonuçlar** yazılır. Dönen algı beklentiyle eşleşirse iki ayrı durum var:
  - **beklenen yan ürün** (Ozyn'e ben yürüdüm → "Ozyn yaklaştı" olayı, B8) → bastırılabilir;
  - **beklenen cevap** (önerdiğim komutun sonucu, sorduğum sorunun cevabı) →
    beklenen ama DEĞERLİ, geçmeli. B1 ve B4 bu ayrımın iki yüzü.
- **Fail duygusu ve kaynak izleme:** spec 06'nın kök nedeni kaynak izleme
  bozukluğuydu (nereden, ne zaman). B3 aynı ailenin **kim** boyutu.
- **Uyarı:** benlik modeli konfabulasyon kaynağıdır da — insan kendi niyetini
  sonradan uydurur (bölünmüş beyin deneylerindeki "yorumcu", seçim körlüğü).
  Bu yüzden benliğe yalnızca **gözlenmiş** şey yazılır: gönderilen niyet, dönen
  sonuç, ölçülen poz. "Neden yaptım" çıkarımı yok, ruh hâli yok.

### 3.2 Oyun yapay zekâsı / gerçek zamanlı sistem mühendisi — "nasıl ucuz kurulur"

- **Kara tahta (blackboard):** oyun YZ'sinde yaygın mimari (ör. F.E.A.R.'ın
  "çalışma belleği"): algı, hedefleme ve navigasyon ortak bir tahtayı okur. Orion'da `AnlikBenlik` tek tahtadır,
  ama **her alanın tek yazıcısı** vardır (köprü: niyet/sonuç; gövde: poz).
  Çok yazıcılı tahta yarış hatası üretir.
- **Çekme, itme değil:** birimler karar anında `benlik.oku()` ile dondurulmuş
  bir anlık görüntü alır. Gövde alanları 20 Hz yazılmaz, okunurken çekilir —
  `KopruAyari.baglam` bugün Ozyn'in durumu için tam böyle çalışıyor.
- **Uyaran yaşı:** her alan bir `an` taşır, azami yaşı geçen alan "bilinmiyor"
  okunur (`calismaBellegi`nin kuralı genelleşir). Sonucu hiç dönmeyen niyet
  sonsuza dek "yapıyorum"da kalmaz: zaman aşımı → **boşa çıktı** geçişi.
- **Mercek = birime ait saf fonksiyon:** `(algı, benlik) → öneri`. Her birimin
  merceği ayrı dosya, ayrı test, ayrı pano modülü, kapı kararı veriyorsa ayrı
  içgüdü kimliği. Modülerlik ve editlenebilirlik buradan gelir: her mercek
  panelden **kapalı · gölge · yetkili** — üç konum.
- **Gölge önce** (spec 09/10'da kanıtlanmış yol): mercek kararını karar kaydına
  yazar, davranışı değiştirmez. Yetki anahtarı varsayılan kapalı, `olculmus`
  sınıfı (spec 05 S7: gerekçesiz açılmaz, açılırsa "ÖLÇÜM DIŞI" damgası).
- **Kopya bekçisi:** `mesgul` tek kaynaktan türer; ajanda, inisiyatif ve giriş
  noktası oradan okur. Eski ifadeyle eşdeğerlik testi, sonra ayrışma testi.

### 3.3 LLM bağlam mühendisi — "modele ne gider"

- Bir LLM için bağlam **benliğin kendisidir** (sayfanın tezi). Orion'un düşünce
  beyni durumsuz: her tur yeniden doğuyor ve ona giden her satır ölçülmüş bir
  risk taşıyor — eski gözlem anıları sadakati %0'a indirdi (spec 06 §6.6),
  Türkçe çerçeve araç seçimini 0/10'a (§6.8).
- Bu yüzden **modele giden izdüşüm tek satırdır**, ŞİMDİ bölümünde (K8), durum
  olarak (K2), yaşıyla (K3), İngilizce çerçeveyle (§6.8):
  ```
  You are walking to the whiteboard (4 sec). Waiting for Ozyn to approve `git status` (40 sec).
  ```
  Söylenecek bir şey yoksa satır yok — propriyosepsiyon satırının "duruyorken
  yazılmaz" kuralı gibi.
- **İç sayılar modele gitmez:** dikkat sayaçları, süzgeç kuralları, mercek
  kararları, güç seviyesi, zincir hakkı. Model onları anlatır ("dikkat
  süzgecim…") ve bu Orion'un sesine ait değil — spec 03'ün ilkesi: *sistemin
  arızası odada görünür, ama Orion'un sesiyle değil.*
- **Talimat yaması değil, yapı:** B3 bugün bir talimat cümlesiyle ("commands are
  typed by OZYN") yamalı. Algıya yapısal **eden** etiketi girince o cümle ileride
  ölçümle kaldırılabilir — bu spec'te değil.
- Her şey sadakat aletinden geçer (`tools/sadakat.ts`, `sadakat-olc.ts`) ve yeni
  bir ölçüt eklenir: **öz-sadakat** — "önerin ne oldu?" sorusuna doğru cevap.

### 3.4 Üçünün uzlaştığı ve ayrıştığı yer

| konu | sinirbilimci | oyun YZ | bağlamcı | **karar** |
|---|---|---|---|---|
| benliğe ne yazılır | yalnız gözlenen | tek yazıcılı alanlar | az | gözlem kaydı, kişilik yok |
| beklenen algıyı bastırma | dikkatte (öngörücü işleme) | dikkat maliyet tavanıdır, dokunma | — | bastırma **süzgeçte** (ezilebilir); dikkat merceği yalnız **daraltır** |
| tahtanın zenginliği | — | zengin | ince | **zengin tahta, ince izdüşüm** |
| modele ne gider | "yapıyorum" | — | tek satır | yapıyorum + bekliyorum, tek satır, ölçüme bağlı |
| sıra | — | önce görünürlük | önce ölçüm | görünürlük → gölge → ölçüm → yetki |

---

## 4. Tasarım

### 4.1 İki katmanlı hafıza: ANLIK ve DERİN

```
SABİT  (çekirdek)  kimlik · içgüdüler · beden künyesi · sabit teller          değişmez
───────────────────────────────────────────────────────────────────────────────────────
ANLIK  (yüzey)     benlik durumu        [YENİ]  üzerine yazılır, alan başına azami yaş
                   çalışma belleği      (var)   gözlemler, 30 sn
                   konuşma penceresi    (var)   son 12 tur
                   KALICI DEĞİL — oturum bitince gider, diske yazılmaz
        │
        │  ÇÖKELME — tek geçit, yalnızca OLAY geçer.  Durum geçişi = olay.
        ▼
DERİN  (tortu)     olay hafızası        (var)   hafiza.ts, Generative Agents, eşikli getirme
                   karar kaydı          (var)   JSONL, yalnız ekleme
                   türetilenler         (var)   kural hafızası, beceri hafızası
                   KALICI — oturumlar arası
```

**Ayrım kuralı** (spec 06'nınki, benliğe genişletildi): *Dünya değişince yanlışa
dönen ANLIK'tadır. Olmuş ve öyle kalacak olan DERİN'e çöker.* "Tahtaya
yürüyorum" anlıktır; "tahtaya yürüdüm ve `git status` yazdım" derine çöker.

**Çökelme ne geçirir (v1, dar):** yalnızca benlik alanlarının **uç geçişleri** —
komut önerisinin yaşam döngüsü (önerildi → onaylandı · reddedildi · düştü; onaylandıysa
sonucu). Ara pozlar, güç seviyesi, her adım **çökelmez**. Çöken öz-olay bugünkü
`hafiza.ekle(…, "sonuc", …)` yolundan, zaman etiketiyle ve `gozlemAnisiMi`
desenine **uymayan** biçimde yazılır (spec 06 Faz 3'ün temizlik bekçisi aynen geçerli).

**Neden yalnız uçlar:** spec 06'nın yarası derine yazılan **durumdu**. Benlik
durumu derine yazılırsa aynı hata büyük ölçekte geri gelir.

### 4.2 Anlık Benlik — alanlar (şekil, kod değil)

```
AnlikBenlik                                          yazıcı        azami yaş
├─ beden      poz · oturuyor · hareket{hedef, kalanM} · güç   gövde (çekilir)   —
├─ yapiyorum  süren niyetler: {id, tür, özet, eden, başladı}  köprü             niyete göre
├─ bekliyorum {ne: onay | komut_sonucu | bakış_cevabı | beceri_adımı,
│              ilgili niyet, özet, başladı}                   köprü             onay: kapı süresi; komut: 60 sn
├─ dusunce    uyanık · beyin · zincirKalan · köken            köprü             —
├─ son        söz{metin, an} · bitenNiyet{özet, durum, an}   köprü             120 sn
└─ odak  (v2) son dış tetiğin içerik kelimeleri              köprü             120 sn
```

Türetilmiş, saf, **tek kaynak** fonksiyonlar:

| fonksiyon | ne döner | kim kullanır |
|---|---|---|
| `mesgulMu(b)` | meşgul + sebep — Faz 1: düşünüyor · yürüyor (bugünkünün aynısı); Faz 7: + beceri sürüyor · onay bekliyor | ajanda, inisiyatif, sağ lob |
| `beklenenMi(algı, b)` | `cevap` · `yan_urun` · `hayir` | süzgeç merceği |
| `eden(algı, b)` | `ben` · `ozyn` · `ortak` · `dunya` | algı merceği, kayıt, durum kodu |
| `izdusum(b)` | tek İngilizce satır ya da `null` | bağlam kurucu (ŞİMDİ) |

**Yazma noktaları — hepsi bugün var, yeni yol yok:**

- `niyetGonder` çağrısı → `yapiyorum`a ekle. `komut` niyeti → `bekliyorum: onay`.
- `sonuc` algısı (süzgeçten **önce**, süzülse bile) → `yapiyorum`dan çıkar, `son.bitenNiyet`.
  Onay kapısının üç ucu zaten köprüye `sonuc` olarak geliyor `[KOD]`:
  onay → `bitti`, ret → `hata`, zaman aşımı → `hata` (`world/giris.ts`).
  Onaylanınca `bekliyorum: komut_sonucu` açılır.
- Terminal algısı → komut satırı `terminalAyristir` (mind/durumKodu.ts, **tek kaynak**)
  ile ayrıştırılır; bekleyen komutla eşleşirse `komut_sonucu` kapanır.
- `_dusun` başı/sonu → `dusunce.uyanik`. Zincir hakkı köprünün özel alanından
  benliğe taşınır (davranış aynı, görünürlük yeni).
- Gövde: kompozisyon kökü `bedenDurumu?: () => …` verir, karar anında çekilir.

**Önemli:** benlik **süzülen** algıdan da güncellenir. B1'in çözümü budur: onay
bildirimi beyni uyandırmaz (kanal `yerel`, değişmiyor) ama benliği günceller;
bir sonraki gerçek turda ŞİMDİ satırında yaşıyla görünür — `kopru.zincir`in
"hakkı biten bakış cevabı kaybolmaz, çalışma belleğine yazılır" kuralının
genellenmiş hâli.

### 4.3 Mercekler — birim başına

Her mercek: ayrı dosya (`mind/mercek/<birim>.ts`), saf, kendi testi, kendi pano
modülü, panelden **kapalı · gölge · yetkili**. Hepsi gölgede doğar.

| birim | okuduğu alanlar | önerisi | içgüdü (yetkide) | ezilebilir? | faz |
|---|---|---|---|---|---|
| **ALGI** | yapiyorum, bekliyorum, beden.hareket | her algıya **eden** etiketi: `ben · ozyn · ortak · dunya` (B3, B8). Kapı kararı değil, etiket. Ozyn'in hızı bugün bağlamda yok: Orion yürürken gelen yaklaşma `ben` sayılır, Ozyn de yürüyorsa bu yanlış olur — Faz 2'de sayılır, gerekirse Ozyn'in hızı bağlama eklenir. | — (etiket) | — | **2** |
| **SÜZGEÇ** | bekliyorum, yapiyorum | `beklenen_cevap` → geçir (B1) · `yan_urun` → süz (kendi yürüyüşünün ürettiği `ozyn_yaklasti`, B8) | `benlik.beklenen_cevap`, `benlik.yan_urun` | evet (içerik yargısı) | **4** gölge · **5** yetki |
| **REFLEKS** | beden, yapiyorum, dusunce | `mesgulMu` — ajanda, inisiyatif, sağ lob ve beceri refleksi aynı cevabı okur (B5) | — (kapı değil) | — | **1** birleştirme · **7** genişleme |
| **HAFIZA** | yapiyorum, son, odak | getirme sorgusuna "ne yapıyorum" eklenir (B7) · çökelme (öneri yaşam döngüsü → olay) | — | — | **6** |
| **DİKKAT** | beden.güç, dusunce | yorgunken konuşma dışı tetiklerin bütçesi **daralır** — asla genişlemez | `benlik.yorgun` | **hayır** (dikkat gibi) | **7** — ölçüm gerektirirse |
| **DÜŞÜNCE** (izdüşüm) | yapiyorum, bekliyorum, son, beden.hareket | ŞİMDİ'ye tek satır (B2, B6) | — | — | **3** |

**Neden DİKKAT en sonda — bilerek:** dikkat projenin maliyet tavanı ve içgüdüleri
ezilemez (`dikkat.butce`, `tekrar`, `kisildi`). Üç uzman da benliğin dikkate
yalnızca **daraltıcı** girdi olabileceğinde uzlaştı. Daraltmanın bedeli gerçek
(yorgun Orion gerçek bir terminal hatasını kaçırabilir) ve faydası ölçülmedi.
K6/IDF gibi: ölçüm gerektirmezse yapılmaz.

**Neden ALGI merceği etiket, kapı değil:** "kim yaptı" bilgisi bir karar değil bir
**gözlemdir**. Karar kaydına (`algi` satırına `eden` alanı) ve durum koduna
(`eden:ben` işareti) gider; öğrenen kapı istersen onu kullanmayı öğrenir.

### 4.4 Doğru yer — hangi bilgi nereye gider

| bilgi | birimler (mercek) | **model** (ŞİMDİ) | **duvar** | kayıt | **derin** |
|---|---|---|---|---|---|
| poz, hareket, **hedef adı** | refleks, ajanda | evet (poz zaten var; **+ hedef**) | evet | — | hayır |
| güç | dikkat, inisiyatif | **hayır** — iç sayı | evet | — | hayır |
| süren niyetler | algı, süzgeç, refleks | evet, tek cümle | evet | `eden` alanı | hayır |
| bekleyen öneri | süzgeç | evet — "waiting for approval of `x`" | evet | — | geçişleri **evet** |
| biten niyet (az önce) | hafıza | evet, yaşıyla | evet | var (niyet satırları) | **evet**, olay olarak |
| zincir hakkı, köken | dikkat (görünürlük) | **hayır** | evet | var | hayır |
| mercek kararları | — | **hayır** | evet — kırmızı iplikler | gölge alanı | hayır |
| beyin adı | — | hayır | evet | var | hayır |

Kural, tek satırda: **iç sayılar duvara, eylem cümlesi modele, geçişler derine.**

### 4.5 Zihin duvarında görünüm

Devre benzetmesi (spec 05) burada kelimesi kelimesine işe yarıyor: birden çok
birimin okuduğu ortak veri, bir devrede **veri yoludur**.

- **BENLİK veri yolu:** ZİHİN AKIŞI şemasının altında GİRİŞ → KARAR sütunları boyunca
  yatay bir şerit. ALGI, SÜZGEÇ, REFLEKS, DİKKAT, HAFIZA'ya birer **kılcal bağlantı**
  iner. Bir mercek benliği okuduğunda bağlantısı parlar (sayfadaki kırmızı dikkat
  çizgilerinin karşılığı) — `sema.vur` deseniyle, sayaç ve son an ile.
- **Mercek rozeti:** her düşünce öncesi düğümün köşesinde ○ kapalı · ◐ gölge · ● yetkili.
- **Düğüme tıkla** → pano detayı: merceğin son kararı, okuduğu alanlar, bugünkü
  kapı kararıyla **ayrıştığı** sayısı (gölge ölçümünün canlı hâli).
- **Veri yoluna tıkla** → üç kabuk görünümü: SABİT · ANLIK · DERİN halkaları,
  ortada BU TUR (imleç). ANLIK'ta alanlar yaşlarıyla; DERİN'de olay sayısı ve son çöken olay.
- **DÜŞÜNCE girişinde** modele giden tek satır yazılı: "modele: You are …". Ozyn
  modelin kendisi hakkında ne bildiğini duvardan okuyabilir.

Görünüm önce `world/surfaces/sema-deneme.html`'de (sahnesiz) kurulur;
`semaCekirdek` saf kalır, yerleşim testli. Eskizi: bu spec'in görsel sayfası.

### 4.6 Sabit teller — değişmez, testle kilitli

1. **`tik` yasağı:** benlik `tik` yolunda ne okunur ne yazılır.
2. **Mercek ezilemez içgüdüyü ezemez:** `ezilebilir: false` olan her içgüdünün
   kararı, her benlik durumunda aynı kalır. Bekçi: tüm içgüdüler × örnek benlik durumları.
3. **Dikkat merceği yalnız daraltır:** hiçbir benlik durumu dikkatin düşürdüğü
   bir algıyı geçiremez (`VARSAYILAN_KANAL` ilkesinin aynısı).
4. **Onay kapısı:** benlik komut önermez, onaylamaz, süre uzatmaz. "Bekliyorum: onay" yalnızca bilgi.
5. **Tek yol:** mercek niyet üretmez. `niyetiYurut` değişmez.
6. **Benlik kalıcı değil:** diske yazılmaz; yalnız geçişleri çökelir.
7. **Modele iç sayı gitmez:** izdüşüm yalnız izinli alanlardan kurulur (bekçi testi).

### 4.7 Maliyet tavanı

Benlik ve merceklerin LLM maliyeti **0**. Yetkili bir mercek uyanma sayısını
yalnızca iki yönde değiştirebilir:

- `yan_urun` → azaltır.
- `beklenen_cevap` → artırır, ama yapısal olarak sınırlı: **onaylanan öneri başına en
  çok 1 uyanma**. Onay Ozyn'in tuşu olduğu için bu uyanmalar Ozyn'in onaylarından fazla olamaz.

Bekçi testi (spec 06 §6.9'daki "1 saat boşta en fazla 4 uyanma"nın eşi): aynı
senaryoda mercekler yetkiliyken uyanma sayısı ≤ mercekler kapalıyken + onay sayısı.

---

## 5. Fazlar — her birinin kapısı bir sayı

Sıra spec 05'in ilkesi: **önce görmek, sonra dokunmak.** Aynı anda tek değişken (spec 06 K7).

| faz | ne | kapı |
|---|---|---|
| **0** | Bu belge + görsel sayfa | Ozyn onayı · §8'deki sorular cevaplı |
| **1** | `mind/benlik.ts` saf çekirdek; köprüde yazma noktaları; `mesgul` tek kaynağa. **Davranış değişmez.** Duvarda veri yolu + alan görünümü (salt okunur). | `npm test` + `tsc` yeşil. Bekçiler: tik yolunda benlik yok; `mesgulMu(b) ∨ ozyn monitörde` bugünkü `mesgul` ifadesine **eşdeğer** (tüm kombinasyonlar); benlik diske gitmez. Canlı: yeni `benlikdene` — öneri yaşam döngüsü benlikte doğru sırayla görünür (önerildi → bekliyor → onaylandı → sonuç) — birim testi yetmez, canlı koşu şart |
| **2** | ALGI merceği: `eden` etiketi; karar kaydına alan, durum koduna işaret | Gerçek oturum kaydında (`tools/karar-ozet.ts`): her `refleks.sonuc.elle_hata` satırı `eden: ozyn` (%100). Kural hafızası yeni işaretle kayıttan yeniden kurulur, eski öğretimlerin kararı **değişmez** |
| **3** | İzdüşüm modele (ŞİMDİ'ye tek satır), **anahtar varsayılan kapalı** | Sadakat A/B, Haiku, n=10/kol, yeni B1/B2 fixture'ları + mevcut E3: sadakat ≥ %90 korunur, uydurma ≤ %5, **öz-sadakat** satırla ≥ 9/10 **ve** satırsız tabandan ≥ 25 puan iyi (gürültü bandı, spec 06 §6.7). Giriş token artışı ölçülür. Geçmezse satır modele **gitmez** — birimler kullanmaya devam eder |
| **4** | SÜZGEÇ merceği **gölgede**: `beklenen_cevap`, `yan_urun` → kayda `benlikGolge` | Ön-kayıt, ≥ 3 gerçek oturum: `beklenen_cevap`ın işaretlediği her algı gerçekten onaylanmış önerinin çıktısı (**yanlış eşleşme 0**); `yan_urun`un süzeceği algıların hiçbiri hata ya da konuşma değil (**0**) |
| **5** | SÜZGEÇ yetkisi — anahtar, varsayılan kapalı, `olculmus` kilidi | Canlı `onaydene`: öneri → onay → Orion sonucu söylüyor. Uyanma: onaylanan öneri başına ≤ +1. Maliyet bekçisi yeşil |
| **6** | HAFIZA merceği: çökelme (öneri yaşam döngüsü → olay) + sorgu zenginleştirme **gölgede** | `hafizadene` geriye gitmez; tur başına getirilen anı ortalaması **artmaz**; "önerin işe yaradı mı" 10/10 doğru |
| **7** | *(ölçüm gerektirirse)* DİKKAT merceği (yorgunlukta daraltma) · REFLEKS merceğinin genişlemesi (beceri ve onay meşguliyeti) | Ayrı ön-kayıt |

---

## 6. Ne YAPILMAYACAK

- **Kişilik, ruh hâli, duygu alanı yok.** Gözlenmeyen şey benliğe yazılmaz.
- **"Neden yaptım" çıkarımı yok.** Benlik günlük değil, gösterge panelidir.
- **Benlik bir LLM ile özetlenmez.** 0 token.
- **Yeni karar → eylem yolu yok.** `niyetiYurut` tek yol kalır.
- **`protocol/` değişmez** (Faz 1–6). Gerekirse yalnızca ekleme, `SURUM` korunur.
- **B3'ün talimat cümlesi bu spec'te silinmez** — `eden` etiketi ölçülene kadar kalır.
- **Konuşma penceresinin sıkıştırılması** (sayfadaki "Sıkıştır" düğmesi) bu spec'te
  değil — konsolidasyon işi, ayrı spec.

## 7. Riskler

| risk | mekanizma |
|---|---|
| Benlik bayatlar (sonuç hiç dönmez, "yapıyorum" sonsuza kalır) | alan başına azami yaş + **boşa çıktı** geçişi; testli |
| B1'de yanlış eşleşme: Ozyn aynı komutu kendisi yazar | eşleşme yalnız onaydan **sonraki ilk** tamamlanan komut bloğu, azami 60 sn; Faz 4 barı "yanlış eşleşme 0" |
| Bağlam şişmesi, sadakat düşüşü | izdüşüm tek satır, boşsa yok; Faz 3 A/B'si geçmezse modele gitmez |
| Durum koduna yeni işaret → öğrenilmiş kurallar kayar | Faz 2 kapısı: kayıttan yeniden kur, eski öğretimlerin kararı değişmesin |
| Benlik derine sızar (spec 06'nın yarası büyür) | çökelme yalnız uç geçişler; `gozlemAnisiMi` bekçisi aynen |
| Kapsam kayması (inisiyatif, konsolidasyon) | §9'da yön olarak duruyor, başlatılmaz |

## 8. Ozyn'e sorular (Faz 0 kapısı)

1. **Adlar:** "Anlık hafıza / Derin hafıza", "Anlık Benlik", geçiş için **çökelme**,
   birim okuması için **mercek**. Uygun mu?
2. **"Model yalnızca ne yaptığını bilir"** — bunu şöyle okudum: modele yalnız
   *yapıyorum / bekliyorum* gider, iç durum gitmez. Kastettiğin bu mu, yoksa
   bugünkü bir eksikliği mi anlatıyordun (model bugün yalnız *yaptığını* biliyor,
   kendi durumunu bilmiyor)? İkisi de aynı tasarıma çıkıyor, ama Faz 3'ün önceliği değişir.
3. **"Ozyn monitörde"** bugün Orion'u meşgul sayıyor (ajanda ve inisiyatif susar).
   Öneri: davranış aynı kalsın, ama alan ayrı dursun (`ozyn.odak` ≠ `ben.mesgul`).
4. **Konuşma penceresi** (12 tur) ANLIK'ta mı kalsın? Öneri: şimdilik evet.
5. **Brain IR'ın `OLY-…` olay numaraları** (bu dalın konusu, `brain-lab/brain-ir/OLAY-HAFIZA.md`)
   DERİN'in olay kimliği olsun mu? Doğrulanmış atıfla (`[ani:12]`, FIKIR-HAVUZU)
   birleşir. Öneri: Faz 6'da karar.
6. **MCP ajanı** (`dunya_bekle` cevabı) da izdüşümü alsın mı? K8 gereği **evet** — aynı satır.

## 9. Yön — bu spec'te değil

- **İçerikli inisiyatif.** "Önerim 10 dakikadır onay bekliyor" — benlik, FIKIR-HAVUZU'ndaki
  *içerikli tetiklerin* hammaddesi. Salt sessizlik tetiğinde model 6/6 susmayı seçmişti
  (spec 06 §6.9); yarım kalmış bir iş ona söyleyecek somut bir şey verir.
- **Konsolidasyon:** DERİN'de olay → bilgi, kaynaklı.
- **Çatallanma görünürlüğü:** MCP ajanı ile yerel beyin aynı benliği okur; duvarda
  hangi beynin hangi benlikle düşündüğü görünür.
