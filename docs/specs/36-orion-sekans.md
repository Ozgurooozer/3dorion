# Spec 36 — Sekans: Unreal Sequencer'ın küçük, düzgün hâli (zaman çizelgesi, izler, bölümler, anahtarlar)

Tarih: 2026-10-23 · Durum: **S1 YAZILDI** (biçim, değerlendirme, derleme, oynatıcı; testli, gerçek yürütücüyle başsız) · **S2 YAZILDI** (editör: saf mantık testli,
DOM canlıda GÖRÜLMEDİ) · olay izi, eğri/ease düzenleyici, kamera izi, alt-sekans YAPILMADI (veri modelinde yer var).
Ozyn (2026-10-22): "düzgün bir sequencer olmalı". Girdi: spec 35 §4f (JSON klip), araştırma raporu (scratchpad `sequencer-arastirma.md`, Epic sayfalarının bir
kısmı 403; §6 "çekirdek 12 madde"). Kararlar Ozyn'in onayıyla (yer, biçim, güvenlik); burada uygulama kararları ve nedenleri.

## 1. Kavramlar ve biçim (`protocol/sekans.ts`)
```json
{ "surum": 1, "ad": "selamlasma", "fps": 30, "sure_kare": 105, "aralik": {"bas":0,"bit":105},
  "baglamalar": [{"id":"b1","ajan":"orion"}],
  "izler": [
    {"id":"el","baglama":"b1","tur":"klip","gizli":false,"kilitli":false,"bolumler":[{"klip":"el_salla","baslangic_kare":0,"uzunluk_kare":72,"ofset_kare":0}]},
    {"id":"bas","baglama":"b1","tur":"uzuv","gizli":false,"kilitli":false,"uzuv":"bas","kanal":"donme_x","anahtarlar":[{"kare":66,"deger":0,"yumusatma":"yumusak"},{"kare":80,"deger":14}]} ] }
```
- **Zaman kare tabanlı tamsayı** (30 kare/sn sabit; başka fps reddedilir). Kayan nokta zamanı "iki anahtar aynı an mı" sorusunu doğururdu; tamsayı karede kesin.
- **Bağlama** (binding) `{id, ajan}`: izler ajana ADIYLA değil bağlamanın kimliğiyle bağlı (ajanı orion → flash yapmak izlere dokunmaz). `ajan` defter kimliği
  ya da `@ben` (bugün yalnız oynatıcıya `ben` verilirse çözülür; editörden ▶'de nedenli ret). Bir ajan tek bağlama (biçim reddeder).
- **İz türü KAPALI birleşim**: `uzuv` (soyut uzuv + kanal + anahtarlar; anahtar/yumuşatma kuralı klibinkinin aynısı) ve `klip` (bölümler). Bilinmeyen tür
  ("olay", "kamera") nedenle reddedilir — genişleme payı: yeni iz türü = yeni `tur` + sürüm kararı.
- **Klip bölümü** `{klip, baslangic_kare, uzunluk_kare, ofset_kare}`: klibin sekanstaki bir oynanışı; ofset = kırpılan baş. Bölüm klipten uzunsa döngüsüz klip
  son değerinde durur. Bir izde bölümler sıralı ve üst üste BİNMEZ (aynı anda iki klip = ikinci klip izi).
- `gizli` = değerlendirilmez (Unreal "mute"), `kilitli` = editörde değiştirilemez; ikisi de dosyada.
- **Tavanlar** (`SEKANS_SINIRLARI`): süre 1800 kare (60 sn), 8 bağlama, 32 iz, iz başına 256 anahtar, iz başına 32 bölüm, ofset ≤ 300 kare (klip tavanı 10 sn),
  ad 48, kimlik 32 (`[a-z0-9_]`), açıklama 300. Değer klibin tavanı (±180°, ±0,5 m; öteleme yalnız `kok`). Ölçülmedi.
- Doğrulayıcı reddi sessiz değil: **yol + neden** (`izler[0].anahtarlar[1].kare: tamsayı olmalı…`). Temiz kopya (bilinmeyen alan atılır, bölümler sıralanır).
- Ad kuralı grafik/NPC adınınkiyle AYNI fonksiyon (`sekansAdiGecerli = grafAdiGecerli`; host'ta da aynısı, bekçi testi).

## 2. Değerlendirme (`uygulama/sekans/degerlendir.ts`) — tek doğruluk kaynağı
`degerlendir(sekans, kare, klipler)` → o karede her (bağlama, uzuv, kanal) değeri. **Durumsuz**: scrub/geri sarma hep aynı sonucu verir (test: kareler ters
sırayla değerlendirilince sıralıyla aynı). Uzuv izi klibin örnekleyicisiyle (`izDegeri`; yumuşatma segmentin başındaki anahtardan), klip bölümü klibin kendi
örneklemesiyle (`klipOrnekle`; ofset dahil) — **kopya enterpolasyon yok** (`world/avatar/index.ts` artık `izDegeri/klipOrnekle/klipZamani`yı dışa verir).
Aynı kanal birden çok izden gelirse **TOPLANIR** (klibin "duruşun üstüne ekle" kuralı) ve tavana **kısılır**. Kütüphanede olmayan klip katkı vermez ve adı
`eksikKlipler`de (editör bölümü kırmızı çizer, oynatıcı nedenle reddeder).

## 3. Oynatıcı bedene NASIL bağlanır (S1c) — seçilen yol ve reddedilenler
**Seçilen: derlenmiş geçici klip + mevcut niyet yolu.** ▶'de sekans bağlama başına TEK bir `AnimasyonKlibi`ne derlenir (`derleyici.ts`: plandaki her kare
değerlendirilir, kare başına anahtar, doğrusal/sabit kısımlar sıkıştırılır — hata ≤ 2·10⁻⁶). Klip **geçici klip katmanına** konur (`geciciKlipler.ts`:
bedenlerin bulucusu = kütüphane + `sekans__…` adlı geçici klipler; `giris.ts` `bedenKlipleri`) ve ajanın **kendi kapısından** mevcut niyetle istenir:
`{tur:"jest", jest:"bekliyor", klip:"sekans__3_b1"}` → `niyetDogrula` → `AjanKapisi.niyet` (Orion: `niyetiYurut`, Flash: kendi bedeni; graf'ın kapısı
`grafKapisi`nin AYNISI). Sonuç bedenin `sonucDinle`sinden: `basladi`/`bitti`; hepsi bitince sekans biter. Kimlik öneki `elle` (tek kaynak artık
`uygulama/ajanlar/ajanKapisi.ts` `ELLE_NIYET_ONEKI`; graf'ın `GRAF_NIYET_ONEKI` ondan türer).
- **Bekçi test (DERLEME = DEĞERLENDİRME)**: derlenmiş klip plandaki her karede değerlendirmeyle aynı (fark < 1e-6), ortadan başlayan oynatmada ve döngüde.
- Playhead ortadayken ▶ oradan başlar; **döngüde** klip "döndürülmüş" tek turdur (başlangıç→son, baş→başlangıç) ve beden kendi süresince sarar (yeni niyet
  gerekmez). Döngü sınırında (bit−1 → bas) değer TEK KARE boyunca doğrusal geçer (Unreal sıçrar; fark en çok 1/30 sn).
- Geçici katmanın kuralları: önekli ad kütüphaneden ASLA çözülmez (bir dosya oynayan sekansın yerine geçemez); `adlar()` yalnız kütüphane (grafiğin "Animasyon
  oynat" seçeneklerinde ve "yüklü: …" metninde görünmez); tavan 16; her bitişte kaldırılır (test: bitiş/■ sonrası 0 kayıt).
- **Reddedilenler:** (a) her karede niyet göndermek (30 niyet/sn karar kaydını ve Orion'un `niyetiYurut`unu boğardı); (b) bedene ayrı "sekans kanalı" ya da
  `uzuvSurucusu`na doğrudan yazan yol (ikinci eylem yolu: dur/iptal/yeni jest kuralları ikinci kez yazılırdı); (c) ≤10 sn'lik klip parçalarına bölüp ardışık
  niyet (parça sınırında `iptal`/boşluk; anahtar tavanı 32 kare başına örneğe yetmez). (d) Derlenmiş klibi `klipDogrula`dan geçirmek: klip tavanları (10 sn,
  32 anahtar) sekansınkinden dar; derlenmiş klip **biçimin tipini** taşır ama sınırları sekans doğrulayıcısından gelir (dürüst not: bu bir istisnadır).
- **■ Durdur** her an, beklemeden: abonelikler kalkar, her bağlamaya AYNI kapıdan `dur` (iş bitmiş olsa da; graf ■'ünün kuralı), geçici klipler kaldırılır.
  Test: ■'den bir tik sonra bedende klip YOK.
- **Dış kesilme**: başka bir niyet klibi keserse (Orion'un kendi kararı, Flash'ın boşta kıpırtısı) sekans "kesildi" diye durur ve ÖTEKİ bağlamalara da `dur`
  gider (yarım sekans sessizce sürmesin). Döngüsüz oynatmanın tavanı süre + 5 sn (beden `bitti` demezse `dur` + nedenli hata).
- Ret nedenleri (hiçbir bedene niyet gitmeden): bilinmeyen/bedensiz ajan, çözülemeyen `@ben`, iki bağlama aynı ajana, eksik klip, hareketsiz sekans,
  zaten oynayan sekans (tek oynatma). Gövdede olmayan uzvun izi günlüğe uyarı (sessiz yutma yok).

## 4. Editör (S2) — `uygulama/sekans/editor/` (saf) + `uygulama/yapi/sekans/` (DOM)
Yer: **yeni "Sekans" sekmesi** (Yapı çubuğu, 🎬) + ekranın **alt yarısında dok** (graf editörü tam ekrandı; sekansta 3B görünüm üstte açık kalmalı ki ▶'de
beden görünsün — Unreal düzeni). Graf editörüyle aynı anda açılmaz (biri açılınca öteki gizlenir).

| Saf (testli) | İş |
|---|---|
| `editor/zamanEkseni.ts` | kare↔piksel, İMLEÇ MERKEZLİ yakınlaştırma (graf tuvalinin `yakinlastir`ı, kendi sınırlarıyla 0,5–40 px/kare), aralığa sığdır, cetvel (≥70 px, "1 sn"), yaslama, Shift eksen kısıtı |
| `editor/izDuzeni.ts` | görünüm modeli: satırlar (bağlama başlığı + izler; sol sütun ve çizelge AYNI listeden — hiza tek kaynak), elmas/bölüm konumları, vuruş (bölüm sol kenar = kırp, sağ = uzat, iç = taşı), kutu seçimi |
| `editor/sekansIslemleri.ts` | değiştirilemez işlemler, her sonuç `sekansDogrula`dan geçer: iz/bağlama ekle-sil, gizle/kilitle, anahtar ekle (değer: o karedeki), taşı (değer tavana kısılır, çakışma reddi), bölüm ekle/taşı/uzat/kırp/sil, süre (dışarıda kalan varsa ret), aralık |
| `editor/sekansOturumu.ts` | sekme oturumu: geri al (ortak `duzenleyici/gecmis.ts`), playhead, seçim, yaslama, döngü; SÜRÜKLEME önizlemedir (taban + toplam kayma; bırakınca TEK geri al adımı, Esc iptal) |
| `editor/ayrintiAlanlari.ts` | Ayrıntılar modeli (anahtar · bölüm · iz · bağlama · seçimsizse sekans), her alanın birimi/anlamı; sayı kutusu ortak `duzenleyici/sayiAlani.ts` — **"1+1" REDDEDİLİR**, kare tamsayı |
| `editor/kisayollar.ts` | tuş → komut (tek kaynak; yardım kutusu buradan) |

| DOM (testsiz, canlıda GÖRÜLMEDİ) | İş |
|---|---|
| `sekansEditoru.ts` | dok, sekmeler (ortak `yapi/ortak/sekmeSeridi.ts`), üst çubuk, ipucu şeridi, dış değişiklik bandı, alt şerit, tuş yönlendirme (oyuna sızmaz), kaydet, aç/gizle, hata olursa gizlen |
| `zamanCizelgesi.ts` · `izListesi.ts` · `ayrintiPaneli.ts` · `oynatmaDugmeleri.ts` | çizelge (cetvel scrub, kaydır/yakınlaş, seç/kutu, sürükle, çift tık ekle) · sol sütun (playhead değeri, 👁 🔒 ✕, ＋ iz, ＋ bağlama) · Ayrıntılar · ▶ ■ ⟳ |
| `sekansSekmesi.ts` · `sekansDosyaIslemleri.ts` · `kurulum.ts` · `sekansStili.ts` | Sekans sekmesi (kartlar, örnekler, Yeni/Sil/Yeniden adlandır/Kopya) · dosya olayları · tek çağrılık kurulum · CSS |

**Kısayollar** (`kisayollar.ts`; editörde `?`): cetvele tık/sürükle scrub · ←/→ kare (Shift 10, basılı tutunca tekrar) · Home/End aralığın başı/sonu · `,`/`.`
önceki/sonraki anahtar · K seçili uzuv izine anahtar · anahtarı sürükle (↔ zaman, ↕ değer 1 px = 1° / 0,005 m; Shift tek eksen) · bölümü sürükle / kenarlar ·
N yaslama · Delete · Ctrl+S / Ctrl+Z / Ctrl+Y · Ctrl+A · tekerlek yakınlaş (Shift+tekerlek kaydır; sol sütunda tekerlek satırları kaydırır) · orta tuş kaydır ·
F sığdır · Esc. **▶'nin kısayolu YOK** (Boşluk dahil; bilinçli: oynatmak yalnız düğmeye gerçek tık).

### Kararlar
- **▶ EKRANDAKİ hâli oynatır** (graf ▶'sinden FARKLI: orada kirli sekmede ▶ gri). Sekansta düzenle-oynat döngüsü kaydetmeden döner (Unreal); ekrandaki ile
  oynayan ayrışmaz. Oynarken yapılan değişiklik bir sonraki ▶'de geçerli (derleme ▶ anının kopyası).
- **Scrub bedeni KIPIRDATMAZ** (yalnız playhead + değer okuması). Bedende önizleme, her scrub'da niyet demekti (açık, §8). Cetveli sürüklemek oynatmayı keser.
- **Örnekler salt-okunur** (`assets/sekans/`, `liste.json` + dosyalar; yükleyici klip kütüphanesiyle ORTAK `listeliKlasoruYukle`): ilk açılışta kullanıcı
  klasörüne tohumlamak, silinen örneği her açılışta geri getirir ya da aynı adlı sekansın yanına kopya doğururdu. Düzenlemek için "Kopyasını al" (YENİ dosya;
  ad doluysa `_2`). Örnekler Orion'a bağlı (senaryo koşusunda Flash kurulmaz).
- **Kayıt** `<userData>/orion-sekans/<ad>.json` (`host/sekansDosyalari.js`: ortak `jsonKlasoru` — atomik yazım, yol kaçışı yok, sil = `.silinenler/`;
  IPC `sekans:liste/oku/yaz/yeni/sil`, OYNATMA kanalı YOK, bekçi testli); renderer'da ortak `dogruDepoKur` (bozuk JSON/biçim diske gitmez, ad = dosya adı,
  kanonik metin: iz başına bir satır). Yeniden adlandır/kopya graf deposundan ÇEKİRDEĞE genelleştirildi (graf'ın desen kuralı `engel` kancası olarak; graf
  testleri değişmeden yeşil). `npm run dev`'de localStorage (`orion.sekans.v1`). Senaryo koşusu (`ORION_SMOKE=1`) geçici klasöre yazar.
- **＋ Yeni sekans boş sayfa değil**: el_salla bölümü + iki baş eğmesi (graf şablonlarının kuralı).

## 5. Kopya yerine çıkarılanlar (tarafsız klasörler; yön bekçisi `tools/sekansYonBekcisi.test.ts`)
Sekans graf motorunu içe aktarmaz, graf sekansı içe aktarmaz. Ortak ihtiyaç taşındı/genelleştirildi:
`uygulama/duzenleyici/` ← `gecmis.ts`, `sekmeler.ts`, `tuvalMatematigi.ts` (+ testleri; `yakinlastir` ölçek sınırı parametresi), yeni `sayiAlani.ts`
(graf'ın `alanlar.ts`i artık onu kullanır) · `uygulama/yapi/ortak/` ← `dom.ts` (`el`, `dugmeYap`, `yaziAlaniMi`, `ipucuSeridi`), `sekmeSeridi.ts` (türden
bağımsız, sınıf öneki parametre) · `uygulama/ajanlar/ajanKapisi.ts` ← `AjanKapisi` + `ELLE_NIYET_ONEKI` (graf yeniden dışa verir) ·
`uygulama/dogruDosyaDeposu.ts` ← yeniden adlandır/kopya · `world/avatar/klipKutuphanesi.ts` ← `listeliKlasoruYukle` · `tools/ithaller.ts` ← `yasakIthaller`,
`klasorMetinleri` · `tools/isTrustedBekcisi.ts` ← `isTrustedYoklamasi`. Tarafsız klasörler graf'ı da sekansı da bilmez (bekçi).

## 6. Güvenlik (değişmez)
- Oynatmak yalnız **Ozyn'in gerçek tıklaması**: ▶ işleyicisi `if (!e.isTrusted) return;` (konsoldan `.click()` oynatmaz). Bekçi (`sekansBekci.test.ts`):
  `.sekansiOynat(` üretimde yalnız `oynatmaDugmeleri.ts` (1, isTrusted yoklaması graf'la ortak) ve `kurulum.ts` (1: `sekansdene` senaryo yüzü — çağrıdan önce
  `if (!a.senaryoKosusu) return` denetimi bekçide). Senaryo bağlamı yalnız `?sekansdene=1` ile dinamik yüklenen senaryoya verilir (window'da değil) ve zaten
  `niyetiYurut` taşır (yeni güç değil).
- Orion'un araç yüzeyi (`bridge/araclar.ts`), `protocol/niyet.ts`, `protocol/dogrula.ts` sekans bilmez (bekçi); token bütçesi testi değişmedi. Orion'un
  olayları sekansa açık değil (sekansın olay girişi yok). Host'ta oynatma kanalı yok. `eval`/`new Function` yok. Silmenin ikinci adımı gerçek tık.
- Editör açıkken oyun tuşları oyunu etkilemez (graf editörünün kalıbı: kök + pencere yakalayıcısı; METİN bekçisi).

## 7. Testler ve bozma denemesi
118 yeni test: `protocol/sekans.test.ts` 13 · `uygulama/sekans/sekansCekirdegi.test.ts` 16 (değerlendirme, derleme, katman) · `oynatici.test.ts` 13 (GERÇEK
`Yurutucu` ile; saat elle ilerletilir) · `sekansDeposu.test.ts` 10 (örnek bekçileri dahil) · `editor/zamanVeDuzen.test.ts` 17 · `editor/duzenleme.test.ts` 29 ·
`uygulama/yapi/sekans/sekansBekci.test.ts` 8 · `host/sekansDosyalari.test.ts` 6 · `tools/sekansYonBekcisi.test.ts` 6. Taşınan testler (`duzenleyici/`) ve
graf testleri değişmeden yeşil. Bütün takım: **5145 test, tek kırmızı bilinen "ova bütün yerleşimleri dönüşsüz"** (taban 5027 + 118). `typecheck` temiz,
`vite build` scratchpad'e geçti (dist/'e yazılmadı; çıktıda `sekans/` örnekleri ve `sekansdene` parçası var).

Bozma: betik scratchpad `sekans-bozma.cjs` (yedek `sekans-bozma-yedek/`); her mutant tek dosyada tek değişiklik, dosya önce yedeklendi, ilgili test dosyaları
120 sn zaman aşımıyla koşuldu, yedekten geri kondu, bayt bayt karşılaştırıldı (**30/30 AYNI**; `git checkout` yok). Taban önce yeşil koşuldu.

| # | bozma | sonuç |
|---|---|---|
| 1 | gizli iz de değerlendirilir | **yakalandı** |
| 2 | toplama yok (son iz ezer) | **yakalandı** (2) |
| 3 | tavan kısması yok | **yakalandı** |
| 4 | bölüm ofseti yok sayılır | **yakalandı** |
| 5 | bölüm sonu dahil (bir kare taşar) | **yakalandı** |
| 6 | döngü döndürülmüyor / playhead'den başlamıyor | **yakalandı** (3) |
| 7 | sıkıştırma eşiği 1° | **yakalandı** (3: DERLEME = DEĞERLENDİRME dahil) |
| 8 | önekli geçici ad kütüphaneden de çözülür | **yakalandı** |
| 9 | ■ bedene `dur` göndermiyor | **yakalandı** (3) |
| 10 | geçici klipler kaldırılmıyor | **yakalandı** (2) |
| 11 | `@ben` çözülmeden orion sayılır | **yakalandı** |
| 12 | eksik klip denetimi yok | **yakalandı** |
| 13 | dış kesilme (`iptal`) bitti sayılır | **yakalandı** |
| 14 | ▶ `isTrusted`a bakmıyor | **yakalandı** (bekçi) |
| 15 | `isTrusted` "denetimi" var ama dönmüyor | **yakalandı** (bekçi) |
| 16 | senaryo yüzünde koşu denetimi yok | **yakalandı** (bekçi) |
| 17 | editör kökü keydown'u durdurmuyor | **yakalandı** (METİN bekçisi; sızmadığını kanıtlamaz) |
| 18 | bilinmeyen iz türü kabul | **yakalandı** |
| 19 | üst üste binen bölüm kabul | **yakalandı** (2: biçim + editör) |
| 20 | kesirli kare kabul | **yakalandı** |
| 21 | sayı kutusu ifade desenine bakmıyor | **yakalandı** — yalnız sekans testinde (nedeni metniyle sınar); graf testi GEÇTİ: desen kalkınca da `Number("1+1")` NaN olur ve "sonlu sayı olmalı" diye yine reddedilir (graf testi yalnız reddi sınıyor; davranış yönünden eşdeğer) |
| 22 | sürüklemenin her hareketi ayrı geri al adımı | **yakalandı** (2) |
| 23 | Shift eksen kısıtı yok sayılır | **yakalandı** |
| 24 | yakınlaştırma imleç merkezli değil | **yakalandı** (2) |
| 25 | iz satırı başlık yüksekliğiyle ilerler (hiza) | **yakalandı** |
| 26 | kilit yok sayılır | **yakalandı** |
| 27 | host ad kuralı gevşek (yol kaçışı) | **yakalandı** (3) |
| 28 | depo biçimi doğrulamadan geçirir | **yakalandı** |
| 29 | `liste.json`'dan bir örnek unutuldu | **yakalandı** (4) |
| 30 | Boşluk bir komuta bağlandı (▶ kısayolu sızdı) | **yakalandı** |

Dürüst not (yan etki): #27 GERÇEKTEN klasörden kaçtı — gevşek ad kuralıyla `../kacis` adı `%TEMP%\kacis.json` dosyasını yazdı (test kırmızı yandı, ama
dosya geri koymadan sonra da kaldı) ve sonraki tam koşuda graf/NPC/sekans host testlerinin "klasör dışına yazılmaz" denetimini (ortak üst klasör `%TEMP%`)
3 kırmızıya düşürdü. Dosya (içeriği testin `"x"`i) silindi, tam koşu yeniden temiz. Ders: yol kaçışı mutantı repo DIŞINA da yazar; betik artık bunu bilmeli.
Dürüst not: #14–17 METİN bekçileridir (satır silinir/değişirse kırmızı); konsoldan `.click()`'in gerçekten oynatmadığını ve tuşun gerçekten sızmadığını
yalnız canlı deneme gösterir (§9 madde 4, 17).

**Senaryo** `3dorion.bat sekansdene` [YAZILDI-KOŞULMADI]: Orion'u kameraya döndürür (klipdene'nin kurulumu), `selamlasma`yı sonuna dek oynatır (kareler
`01_selamlasma_1..5`), `dusun_onayla`yı ortada ■ ile keser (`02_…_ortada`, `02_…_durdu_sonra`), döngüde ikinci tur (`03_…`), Sekans sekmesi (`04_sekans_sekmesi`),
editör (`05_editor_acik`, `06_editor_kare100`, `07_editor_anahtar_secili`, `08_editor_bolum_secili`, `09_editor_yakin`, `10_editor_oynarken`, `11_editor_bitti`).
Kareler `ORION_SS_DIR` (varsayılan `%TEMP%\sekansdene`). K0–K6 GECTI/KALDI satırları `[SEKANSDENE]` önekiyle; son satır `[SEKANSDENE] GECTI|KALDI — n/m`.

## 8. Açıklar [YAZILDI-KOŞULMADI]
- **DOM'un HİÇBİRİ canlıda görülmedi**: dok yüksekliği (46vh) ve Yapı çubuğunun üstüne binmesi, sticky cetvel (`overflow: clip`), pointer capture, elmas/bölüm
  hizası (satır yükseklikleri `DUZEN`'den; CSS ile 1–2 px kayma olabilir), çift tık, tekerlek, sol sütunun dikey kaydırması, oynarken 33 ms'lik yeniden çizim.
- **Bedende görüntü görülmedi**: derlenmiş klibin çizim karesi arası doğrusal (smoothstep'ten sapma ölçülmedi); el_salla + baş izinin birlikte doğal görünüp
  görünmediği; Orion'un baş bakışı (BoneLookController) baş izini ezebilir (spec 35 §4f yan bulgu a).
- Oynatıcının saati (playhead) `performance.now`, bedeninki yürütücünün tiki: bir tik (50 ms) kayabilir; döngü sınırında tek karelik doğrusal geçiş.
- Scrub'da bedende önizleme yok; `@ben` editörden çözülmez (graf düğümü "Sekans oynat" gelince anlam kazanır); Flash'ın boşta kıpırtısı sekansı keser.
- Oynatma aralığının yeşil/kırmızı işaretleri SÜRÜKLENMEZ (yalnız Ayrıntılar'da, seçim yokken `▶ başı/sonu`); sekans süresi de yalnız Ayrıntılar'dan.
- Olay izi, eğri/ease editörü, bölüm harmanı (blend), kamera izi, alt-sekans, kopyala/yapıştır (anahtar), çoklu sekmede aynı anda iki sekans oynatma YOK.
- Büyük sekansta (32 iz × 256 anahtar) her değişiklikte tam yeniden çizim — performans ölçülmedi. Derleme 1800 kare × kanal; süresi ölçülmedi (testlerde < 2 ms, 120 kare).

## 9. Canlı deneme listesi (Ozyn; pencere açan koşu sorulmadan yapılmadı)
1. `npm start` → konsolda `[SEKANS] 2 örnek: selamlasma, dusun_onayla` ve `[SEKANS] 0 sekans`; `[SEKANS] örnek …` uyarısı OLMAMALI.
2. Tab → Y → **Sekans** (🎬) sekmesi: "Sekanslarım" boş, "Örnekler"de iki 📘 kart (süre + orion).
3. `selamlasma` örneğine **çift tık**: kartlarda `🎬 selamlasma`, ekranın ALT YARISINDA editör; üstte Orion görünür. Sekme `🎬 selamlasma`, mavi ipucu şeridi.
4. Editör açıkken **W, 1, T, Y, Tab** bas: Ozyn yürümemeli, Orion tahtaya gitmemeli, sohbet açılmamalı. 3B görünüme tıklayıp tekrar dene: yine sızmamalı.
5. Sol sütun: `👤 orion (b1)`, `🎞 klip · el`, `🦴 bas.donme_x`; satırlar çizelgedeki satırlarla HİZALI. Mavi `el_salla` kutusu 0–2,4 sn, baş izinde 5 ◆/●.
6. **Cetveli sürükle**: sarı playhead kayar, üstte `▸ kare N · X sn`, sol sütunda baş değeri (°) ve `el_salla 1,23 sn` değişir; beden KIPIRDAMAMALI.
7. **▶ Oynat**: Orion el sallar, sonra başını öne eğer (~3,5 sn); playhead yürür, satır `▶ selamlasma · kare …`; bitince `✓ selamlasma bitti`.
8. Tekrar ▶, ortasında **■ Durdur**: kol HEMEN inmeli, satır `■ selamlasma durdu · kare …`.
9. **⟳ Döngü** aç → ▶: sona gelince baştan sürmeli; ■ ile durmalı. Playhead'i ortaya al → ▶: oradan başlamalı.
10. Baş izindeki bir ◆'yi **sağa sürükle**: kayar; yukarı sürükle: değer artar (Ayrıntılar'da); **Shift** basılıyken çapraz sürükle: tek eksende kalmalı. Bırak →
    **Ctrl+Z** tek adımda eski yere, **Ctrl+Y** yeniye; sekmede ●.
11. Bir ◆'yi komşu ◆'nin üstüne sürüklemeye çalış: üstüne düşmemeli, alt şeritte "başka bir anahtarın üstüne düşer". **N** ile yaslamayı kapat/aç.
12. Mavi bölümü **sağ kenarından** uzat (taranmış kısım: "klip bitti, son değerinde durur"); **sol kenarından** kırp (Ayrıntılar'da `klip içi başlangıç` artar);
    ortasından taşı. Bölüm seçiliyken Ayrıntılar'da `klip` → `dusun` yap.
13. Ayrıntılar'da bir anahtarın **değer** kutusuna `1+1` yaz → Enter: kırmızı "sayı olmalı… ifade hesaplanmaz", değer DEĞİŞMEMELİ; `2,5` → kabul. `kare`ye
    `12,5` → "tamsayı olmalı".
14. Sol sütunda ＋ iz → `uzuv izi`, `sag_kol`, `donme_z` → Ekle; satıra **çift tık** (ya da playhead'de **K**): ◆ eklenir. 🔒 kilitle → sürükleme/K reddedilir.
    👁 gizle → ▶'de o iz oynamaz.
15. **Ctrl+S** → "kaydedildi"; **Metin** → JSON penceresi; JSON'u boz (virgül sil) → Ctrl+S: "KAYDEDİLEMEDİ: JSON okunamadı…", dosya değişmez.
    `"tur": "olay"` yaz → "bilinmeyen iz türü \"olay\" (bu sürümde: uzuv, klip)".
16. Sekans sekmesinde **Yeniden adlandır** → `selam2`: açık sekme adı değişmeli; **Kopyasını oluştur**; **Sil** → "Emin misin?" → tekrar →
    `<userData>/orion-sekans/.silinenler/` altında dosya.
17. Konsolda `document.querySelector('.sk-oynat').click()` → OYNAMAMALI (isTrusted).
18. `npm run dev` (Electron'suz): sekanslar localStorage'da (konsolda uyarı); bağlamayı `flash` yap (Flash'lı oturumda) → ▶ Flash oynamalı.

Otomatik kare koşusu: `3dorion.bat sekansdene` (bkz. §7 sonu ve senaryo dosyası `uygulama/senaryolar/sekansdene.ts`).
