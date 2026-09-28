# Spec 10 — Beceri refleksi: bir kez başarılan görev, parametreleriyle refleks olur

Tarih: 2026-09-28 · Durum: **onaylandı** (Ozyn, `/goal`: "fazları düzgünce test ederek bitir"); açık sorularda
öneriler uygulanıyor. Faz A bitti. Faz B'nin kodu bitti (c4fefcb); gerçek kayıtla ölçümü (B9) hafta sonunda, ön-kaydı
defterde. Faz C bitti: gölge canlıda (3b8d5ef, `becerdene` ölçüldü). Faz D'nin kodu bitti (a6cd3e8): yetki anahtarı
varsayılan KAPALI; açıkken zincir canlıda ölçüldü (B14). Gerçek kullanımda yetkinin açılması adım 6'dan sonra, kendi
ön-kayıtlı barıyla. E ayrı tasarım. Uygulama `/goal` ile öne alındı; ölçümlerin ve yetkinin zamanı aşağıdaki
tablodaki gibi kalır.
Üst belgeler: `docs/specs/08-karar-kaydi.md` (karar kaydı), `docs/specs/09-ogrenen-kapi.md` (öğrenen kapı),
`brain-lab/BUYUK-RESIM.md`.

İstek (Ozyn, 2026-09-28): "Bir görevi ilk defa yaptığında görevi tekrar kullanmak üzere otomatik kaydediyoruz ama belli
parametrelerde. Görev 'masaya git otur' olsa, bunu bir kere başarılı yapınca refleks olarak görevin nasıl yapıldığı
beyne iletilecek; o parametreler içinde aynı görevi modüler, esnek şekilde yapabilecek."

## Neden

- **Bugün her görev LLM'le baştan planlanıyor.** "Masaya git otur" her seferinde bir uyanış ve bir LLM çağrısı
  demek. Haiku'nun uyanışı canlıda 2,7 sn sürdü.
- **Başarının tarifi zaten kayıtta.** Uyanış satırı verdiği niyetleri, sonuç algıları da her niyetin akıbetini
  taşıyor (spec 08; `mind/kararZinciri.ts` `NiyetAkibeti`). İki eksik var:
  - Niyetin gövdesi yok: kayıt `git` diyor, hangi çapaya gidildiğini söylemiyor.
  - Ozyn'in sözü yapı olarak yok: yalnız özetin içinde duruyor.
- **Emsal.** Öğrenen kapı (spec 09) aynı yolu izledi: tek derste öğren, gölgede ölç, yetkiyi sonra al. Aynı fikrin
  önceki halleri: brain-lab v0.3'teki `Beceri` (refleks aktif / askıda) ve Soar'daki "chunking".

## Kavramlar

- **Görev:** Ozyn'in tek bir kesin sözüyle (`duydum`, `kesin: true`) tetiklenen ve başka hiçbir algıyla tetiklenmeyen
  uyanış. Görevin adımları, o uyanışın dünyaya gönderdiği bedensel niyetlerdir.
- **Başarı:** Görevin hiçbir bedensel niyeti `hata` değil, hepsinin sonucu geldi ve sonuncusu `bitti`. Öncekilerin
  `iptal`i, sonraki emrin onu geçmesidir (ayrıntı: "Beceri çıkarma" 3).
- **Beceri:** İlk başarıdan doğan kayıt. Taşıdıkları:
  - görev anahtarı: sözün çerçevesi ve parametre yuvaları;
  - adımlar: niyetler, argümanları yuvalara bağlı;
  - sayaçlar: başarı / hata;
  - kanıt: doğuran ve besleyen uyanışların kimlikleri.
- **Yuva (parametre):** Niyetin, sözde geçen bir çapa adına bağlı argümanı. "Masaya git otur"da `git.hedef.ad = masa`
  sözdeki "masaya"dan geliyor, yani yuva. Sözde geçmeyen argüman (ör. `otur`un sandalyesi) sabit kalır.
- **Parametre içinde:** Yeni sözün çerçevesi becerininkiyle aynıdır ve yuvalardaki sözcükler tanınan çapa adlarıdır.
  - "Pencereye git otur": aynı beceri, `hedef.ad = pencere`.
  - "Masaya gidip otur": çerçeve farklı, parametre dışında; görevi LLM yapar.
- **Refleks:** Parametre içinde eşleşen beceriyi LLM'e sormadan yürütmek (Faz D). Gölgede (Faz C) yalnız "refleks
  şunu yapardı" kayda yazılır.

## Mimari

```
Ozyn'in sözü ("masaya git otur")
   │ duydum algısı (metin + kesinlik yapı olarak kayda, Faz A)
   ▼
KAPI — içgüdü: konuşma her zaman geçer (değişmez)
   │
   ▼
BECERİ HAFIZASI (mind/beceriHafizasi.ts, saf) — parametre içinde eşleşen beceri var mı?
   │ Faz C: sonuç kayda `beceriGolge` olarak yazılır, davranış değişmez
   │
   ├── evet, emin ve yetki açık (Faz D) ──► adımlar, yuvalar yeni çapayla doldurulur ──┐
   │                                                                                    │
   └── hayır / emin değil / yetki kapalı ──► LLM uyanır ve planlar ──► niyetler ───────┤
                                                                                         ▼
                       niyetGonder ──► niyetiYurut ──► dünya     (TEK YOL: doğrulayıcı, onay kapısı, yakınlık kuralı)
                                                           │
                                                           ▼
                                             sonuç algıları: bitti / hata / iptal
                                                           │
                                                           ▼
KARAR KAYDI — uyanış (niyetler + gövdeleri, Faz A) · sonuçlar · beceri gölgesi (Faz C) · refleks uyanışı (Faz D)
   │
   ▼
BECERİ ÇIKARICI (saf) — tek sözle tetiklenmiş, hatasız, son bedensel niyeti "bitti" olan görev
   ├── ilk başarı → beceri doğar (Ozyn: "bir kere başarılı yapınca")
   ├── sonraki başarı / hata → sayaçlar; karar payı 0,75 (öğrenen kapıyla aynı)
   └── hafıza açılışta kayıttan birebir yeniden kurulur (defter ilkesi, spec 09 K5)
```

- **Katmanlar:**
  - Kapı neyin LLM'i uyandıracağına karar verir (spec 09).
  - Beceri hafızası uyanan bir görevin LLM'e gerekip gerekmediğine karar verir.
  - İkisi ayrı hafızalar, ayrı anahtarlar; biri öbürünün kararını değiştirmez.
- **Güvenlik yapısal:** Refleksin niyetleri LLM'inkilerle aynı yoldan gider. Doğrulayıcı, onay kapısı ve yakınlık
  kuralı atlanamaz: köprünün dünyaya tek çıkışı `niyetGonder`.

## Beceri çıkarma (v1, Faz B'de ölçülür)

1. **Tetik:** Uyanışı yalnız bir kesin `duydum` algısı tetiklemiş olmalı. Birden çok tetik belirsizdir; beceri
   doğmaz. Uyanışın kökeni dış olmalı: Orion'un kendi girişimi (inisiyatif) beceri doğurmaz.
2. **Bedensel niyetler:** `git`, `otur`, `kalk`, `bak`, `al`, `birak`, `dur`, `jest`, `poz`, `odaklan`.
   Beceriye girmeyenler:
   - `komut`: asla. Kabuk komutu kendiliğinden tekrarlanmaz (güvenlik).
   - `soyle` ve `yaz`: içerik üretimi, tekrar edilmez (bayat söz).
   - `yaz` ya da `komut` içeren uyanıştan beceri hiç doğmaz: yazının içeriği sözden gelir ve v1 onu parametre
     yapmaz; yalnız bedensel kısmı tekrar etmek görevi yarım bırakırdı (Faz A canlı koşusunda görüldü).
   - `sor`: bilgi toplar, reflekste anlamı yok.

   Bedensel niyet yoksa beceri doğmaz.
3. **Başarı:**
   - Hiçbir bedensel niyet `hata` değil.
   - Son bedensel niyet `bitti`.
   - Her bedensel niyetin sonucu gelmiş.
   - Öncekilerin `iptal`i başarısızlık değil: dünya "en son emir kazanır" kuralıyla çalışıyor
     (`world/avatar/yurutucu.ts`). LLM aynı turda `git masa` + `otur` gönderince `otur`, `git`i geçer. İlk taslaktaki
     "hepsi bitti" şartı bu yüzden gerçekte hiç sağlanmazdı.
   - Refleks (Faz D) adımları sırayla, her birinin sonucunu bekleyerek gönderir.
4. **Anahtar** (`mind/gorev.ts` `sozAnahtari`):
   - Sözün sözcükleri `mind/durumKodu.ts` `kelimeler` ile çıkar: küçük harf, dolgu atılır. Karşılaştırmada Türkçe
     karakterler katlanır (ı→i, ö→o, ü→u, ş→s, ç→c, ğ→g).
   - Ayıklayıcı aynı, ayarı farklı (`enKisa: 2`, sınırsız). Kapının varsayılanı iki harfli sözcükleri atar; o zaman
     "kupayı al" ile "kupayı at" aynı anahtar olurdu. Kelime sınırı da iki uzun sözü aynı anahtara düşürebilirdi.
   - Çapa adı ve bilinen bir ek (hal eki, 3. tekil iyelik + hal eki, ünsüz yumuşaması) yuva olur: "masaya" → `masa`,
     "masasına" → `masa`, "kapıya" → `kapi`, "günlüğe" → `gunluk`. Ek listesi kapalı: "masal", "kapital",
     "tahtalar" yuva değil.
   - Rica ve seslenme sözcükleri ("Orion", "lütfen", "hadi") çerçeveye girmez. Kalan sözcükler çerçevedir.
   - Anahtar olamayan söz: çerçevesi boş ("masa") ya da aynı çapa iki ayrı yuvada ("masaya git masada otur"). İkincide
     adımdaki çapanın hangi yuvadan geldiği belirsiz; yanlış bağ başka bir sözde yanlış çapaya götürür.
   - İki kelimelik iç ad (`oda_ortasi`) v1'de yuva olmaz; sözcükleri çerçevede kalır.
5. **Adımlar:** Bir yuvanın çapa adına eşit argüman yuva işareti alır; öbür argümanlar sabittir. Çapa değerli
   alanlar: hedefi çapa olan `git`, `bak`, `jest` (`hedef.ad`) ile `otur` ve `odaklan` (`capa`). Nesne, oyuncu ya da
   nokta hedefi sabittir.
   - **Tarif ve kimlik:** Tarif = çerçeve + yuva sayısı + yuvadan arındırılmış adımlar. Kimlik bu içerikten türer
     (FNV-1a, anahtar sırasından bağımsız JSON): hafıza kayıttan yeniden kurulunca kimlik aynı kalır.
6. **Sayaç:** Aynı anahtarla gelen sonraki başarı ya da hata sayaçlara yazılır. Karar payı 0,75'in altına düşen beceri
   askıya alınır; yeni bir başarı onu geri getirir.

## Eşleşme (v1, bilerek katı)

- **Çerçeve:** Çerçeve kümesi birebir aynı olmalı.
  - "Git masaya otur" = "masaya git otur": sıra önemsiz.
  - "Masaya gidip otur" ≠: fiil çekimi farklı; bunu LLM yapar.
- **Yuvalar:** Yuva sayısı aynı olmalı ve her yuvanın sözcüğü tanınan bir çapa adı olmalı.
- **Pay:** Becerinin payı ≥ 0,75.
- **Birden çok eşleşme:** Daha çok başarılı olan kazanır; eşitlikte en yeni.
- **Neden katı:** Genelleme ancak gölgede ölçülünce gevşetilir. Öğrenen kapıda yeni duruma genelleme iki kez
  reddedildi (H-K1, H-K2); aynı hatayı burada ölçmeden yapmayalım.

## Canlı defter (Faz C)

- **Geçmiş:** Host açılışta kayıttan yalnız görev satırlarını okur: uyanış, söz, sonuç (`GOREV_SATIRLARI`, senkron
  IPC `kayit:satirlar`). Seçim renderer'dan gelir, süzme host'ta yapılır. İki yazımın eşitliğini test bekler.
- **Defter** (`mind/beceriDefteri.ts`): geçmiş oturumlar bir kez göreve çevrilir, satırlar tutulmaz.
- **Bu oturum:** Satırlar köprünün kendi kaydından dinlenir (`KararKaydi.dinle`). Dinleyici diske gidenin aynısını alır,
  yani JSON'dan geri okunmuş hali. Canlı hafıza bu yüzden kayıttan kurulana yapıca eşit kalır.
- **Gölge:** Kesin sözde karar söz satırı yazılmadan önce verilir (sıralı).
  - Kayıttaki hali tek fonksiyondur (`BeceriDefteri.golge`).
  - Çevrimdışı denetim (`tools/beceri-deney.ts` `golgeDenetimi`) aynı fonksiyonla, aynı satır sırasıyla yeniden hesaplar.
- **Tek görev iki uyanışa yayılırsa** (önce `sor`, cevaptan sonra `git`): v1 onu görmez. Tetik söz değil bakış
  cevabıdır.
- **Açılış maliyeti `[ÖLÇÜLDÜ]`:** gerçek kayıt, 2 gün, 1935 satır, 505 KB; okuma 4–6 ms, defter 2–4 ms.
  - Kayıt büyüdükçe bu da büyür.
  - Gerekirse host ağır metin alanlarını (özet, dünya) taşımaz; görev onları kullanmıyor.
  - Aylık izlenir.

## Yetki (Faz D)

- **Anahtar:** `beceriYetkisi`, varsayılan KAPALI; canlıda yalnız `ORION_BECERI=1` → `?beceri=1`. Kapalıyken köprü Faz
  C'dekiyle birebir aynıdır (B12).
- **Eşleşen kesin söz (anahtar açık):**
  - Söz kayda gölgesiyle yazılır ve anı olur; LLM uyanmaz.
  - Önce onay jesti gider (`jest: başını_sallıyor`). Adım değildir; sonucu beklenmez.
  - Sonra adımlar sırayla gider: her biri `niyetDogrula`dan geçer (adım kayıttan gelir, doğrulayıcı atlanmaz) ve
    `niyetGonder` ile gönderilir. Sonucu beklenir (varsayılan en çok 30 sn). Kimlikler `refleks_…`.
- **Adım sonuçları:** refleks okur, beyne gitmez (içgüdü `kopru.refleks`, ezilemez). Geç gelen sonuç (onay jesti,
  kesilmiş adım) yalnız kayıtta kalır; ara durum `basladi` ne ilerletir ne keser.
- **Bitiş:**
  - **Başarı:** Söz konuşma geçmişine girmez; LLM sonraki turunda cevapsız bir istek görüp onu yeniden yapmaz.
  - **Hata ya da zaman aşımı:** Kalan adımlar gönderilmez. Söz konuşma geçmişine ve tampona döner; yanına sebebini
    söyleyen bir geri besleme eklenir. LLM hemen uyanır ve görevi kendisi yapar. Bu düzeltme turu görev sayılmaz: geri
    besleme vardır.
  - **İptal ya da yeni söz:** Yeni emir kazanır, refleks sessizce kesilir. `durdur` da keser.
- **Kayıt ve hafıza:**
  - Her refleks turu bir `refleks` satırı yazar: söz, beceri, onay, adımlar, bitiş, süre.
  - Refleks turu da görevdir. Beceri doğurmaz; sonucu yürütülen becerinin sayacına kimlikle yazılır. Hata payı düşürür;
    pay 0,75'in altına inince beceri askıya alınır ve söz yine LLM'e gider.
- **Ölçüye girmez:** Refleks turları `tools/beceri-deney.ts`'in kapsam ve uyumuna girmez; bir beceri kendini
  doğrulayamaz.

## Kod kalitesi — önceden belirlenen kurallar

Bunlar kabul ölçütüdür; her fazın commit'inden önce denetlenir.

1. **Saf çekirdek.**
   - `mind/beceriHafizasi.ts` saf ve belirlenimcidir: dosya, saat, rastgelelik ve dünya yok.
   - Aynı zincir dizisi aynı hafızayı kurar; bekçi testi JSON eşitliğiyle sınar.
   - G/Ç kenarlardadır: köprü hafızayı besler, araçlar kaydı okur.
2. **Tek kaynak.** Hiçbir kural ikinci bir yerde yeniden yazılmaz.
   - Sözcük ayıklama yalnız `kelimeler`'den gelir; ikinci bir ayıklayıcı yazılmaz.
   - Çapa adları tek listeden gelir. `protocol/temel.ts`'e çalışma zamanı listesi (`CAPALAR`) eklenir ve `CapaAdi` ondan
     türetilir. Bir bekçi testi, dünyanın kaydettiği çapaların bu listeyle aynı olduğunu sınar.
   - Niyet sınıfları tek tablodur (`mind/gorev.ts` `SINIF`, `niyetSinifi`): bedensel, eşlik (söz, sorgu), engel (yazı,
     komut). Tablo `Record<NiyetTur, …>`: protokole yeni tür eklenince tip denetimi sınıfını sorar, sınıfsız kalamaz.
   - Görev sonucu tek fonksiyondur (`gorevSonucu`); köprü de çevrimdışı araç da onu kullanır.
   - Güven payı tek sabittir (`VARSAYILAN_GUVEN_PAYI`, `mind/kuralHafizasi.ts`); öğrenen kapı, kıyas düzeneği ve beceri
     hafızası aynı payı kullanır. İçerik özeti tek fonksiyondur (`mind/ozet32.ts`).
   - Zaman sırası tek fonksiyondur (`zamanSirali`): sıralı ölçüm ve kayıttan kurma ona dayanır.
3. **Yapı, metin değil.**
   - Niyetler kayda yapı (gövde) olarak girer; özetten ya da günlükten ayrıştırılmaz.
   - Söz, algı satırına metin olarak girer.
   - Akıbet `durum` alanından okunur; düzyazı regex yok.
4. **Defter ilkesi.** Hafıza kayıttan birebir yeniden kurulur; ayrı bir durum dosyası yok. Bekçi: kayıttan kurulan
   hafıza canlı kurulana eşittir.
5. **Önce anahtar, önce gölge.**
   - Her davranış değişikliği bir anahtardır ve varsayılanı kapalıdır.
   - Anahtar kapalıyken aynı betikli oturum birebir aynı uyanışları ve niyetleri üretir (bekçi testi).
   - Yetki ancak ön-kayıtlı bar geçilince açılır.
6. **Tek yol.** Refleks niyetleri yalnız `niyetGonder` ile gider. Refleks, güvenlik içgüdülerini ve onay kapısını
   atlayamaz.
7. **Güvenlik bekçileri.**
   - Hiçbir becerinin adımı `komut` olamaz (test).
   - Başarısız bir adım zinciri durdurur; kalan adımlar gönderilmez (test).
8. **Testler.**
   - Önce düşman testler: tek koşullu assert, açıklayıcı ad, her test temiz durumla başlar.
   - Anahtar ve yuva bağlama için kenarları içeren ızgara: Türkçe ekler, ı/i, ö/o, iki kelimelik adlar, çapa adıyla
     başlayan ama çapa olmayan sözcük.
   - Bozma denemesi: her mutant yakalanır ya da eşdeğerliği yazılır. Dokunulan her dosyanın yedeği alınır.
9. **Kanıt.**
   - İddia ölçülerek yazılır: çevrimdışı gerçek kayıtla (Faz B), canlıda bir `*dene` senaryosuyla (Faz C–D).
   - Öngörüler koşmadan önce `brain-lab/LAB-DEFTERI.md`'ye yazılır; sonuç karneyle puanlanır.
10. **Kayıt biçimi.**
    - Kayda yalnız alan eklenir; kırıcı değişiklik yok, `KARAR_SURUMU` aynı kalır.
    - Metin alanları `kisalt` ile kesilir (spec 08 `SINIR`).
    - Gövdesiz eski satırlar okunmaya devam eder.
11. **Dil ve yorum.** Türkçe kimlikler, yoğun "neden" yorumları. Her karar gerekçesiyle kodun yanında durur.
12. **Commit disiplini.**
    - Faz başına küçük, tek amaçlı commit'ler; yalnız bu işin dosyaları.
    - Ölçümden önce commit.
    - `world/`'e dokunulmaz: Faz A–D `world/` gerektirmiyor. Tek istisna kural 2'nin bekçisi: dünyanın çapa kaydını
      sınayan `world/level/capalar.test.ts`'teki kopya liste, protokolün `CAPALAR`ına bağlandı (yalnız test, yalnız
      `protocol/`'den alır).
13. **Dosya hijyeni.**
    - Dosyanın kendi satır sonu korunur; Python'la bayt sayılarak doğrulanır.
    - Ters eğik çizgili içerik Write/Edit ile yazılır.
    - Commit'ten önce kontrol karakteri taraması yapılır.

## Plan ve kabul ölçütleri

| faz | ne | davranış |
|---|---|---|
| A | Kayıt tamamlanır: uyanış satırındaki her niyet gövdesini taşır, `duydum` algısı sözün metnini ve kesinliğini taşır | değişmez |
| B | Beceri hafızası (saf) + çevrimdışı ölçüm aracı (`tools/beceri-deney.ts`); gerçek kayıtla sıralı ölçüm | değişmez |
| C | Canlı gölge: eşleşen sözde uyanış satırına `beceriGolge`; `ogret gozden` becerileri de gösterir | değişmez |
| D | Yetki: anahtar açıkken eşleşen görevde LLM uyanmaz, adımlar refleksle yürür | değişir |
| E | Becerinin LLM'e araç olarak verilmesi (LLM "masaya git otur"u tek araçla çağırır) | değişir; ayrı tasarım |

| # | ölçüt | faz | durum |
|---|---|---|---|
| B1 | Uyanış satırındaki her niyet gövdesini taşır, metin alanları kesilir; gövdesiz eski satırlar okunur | A | `[TEST]` 2bf7353 |
| B2 | `duydum` algı satırı sözün metnini ve kesinliğini taşır | A | `[TEST]` 2bf7353 |
| B3 | Davranış aynı: köprü testleri ve betikli oturum aynı uyanış ve niyetleri üretir | A | `[TEST]` eski 1686 test birebir; kayıt yalnız yazılır |
| B4 | Canlı: senaryo koşusunda uyanış satırlarında gövdeler, söz satırlarında metin var | A | `[ÖLÇÜLDÜ]` `tahtabeyin`: 5/5 niyet gövdeli, söz satırı metinli, bozuk satır 0 |
| B5 | Çıkarıcı: tek kesin sözle tetiklenmiş, son bedensel adımı `bitti` ve hiçbir adımı `hata` olmayan uyanıştan beceri doğar. Çok tetikli, inisiyatif kökenli, kesin olmayan, hatalı, sonuçsuz, yalnız sözlü, `yaz`lı ya da `komut`lu uyanıştan doğmaz | B | `[TEST]` c4fefcb |
| B6 | Yuvalar: sözdeki çapa adı (ekiyle) yuva olur, sözde geçmeyen argüman sabit kalır | B | `[TEST]` c4fefcb; ek ızgarası, bağlama ızgarası |
| B7 | Eşleşme: aynı çerçeve + tanınan çapa → adımlar yeni çapayla; farklı çerçeve ya da pay < 0,75 → eşleşmez | B | `[TEST]` c4fefcb |
| B8 | Belirlenimci: aynı kayıt aynı hafızayı kurar | B | `[TEST]` c4fefcb; JSON eşitliği, kimlik kayıt sırasından bağımsız |
| B9 | Ölçüm (gerçek kayıt, ön-kayıtlı): kapsam, uyum, kazanılacak uyanış ve süre | B | `[ÖN-KAYIT]` defter 2026-09-28; ölçü kalibre `[TEST]`; koşu hafta sonunda |
| B10 | Gölge: eşleşen sözde `beceriGolge` yazılır; kapı ve uyanış değişmez | C | `[TEST]` 3b8d5ef bekçi (becerili ve becerisiz köprü aynı niyet ve uyanış) · `[ÖLÇÜLDÜ]` `becerdene`: 3 söz, 3 uyanış; 2. ve 3. sözde gölge `[git sandalye]`, `[git pencere]` |
| B11 | Kayıttan yeniden kurulan hafıza canlıdakine eşit | C | `[TEST]` 3b8d5ef (dinleyici diske gidenin aynısını alır) · `[ÖLÇÜLDÜ]` gölge denetimi 3/3 aynı |
| B12 | Yetki anahtarı kapalıyken köprü birebir aynı (bekçi) | D | `[TEST]` a6cd3e8: anahtarsız ve `false` köprü aynı niyet ve uyanış; eşleşen becerili köprü LLM'i uyandırır, refleks yok |
| B13 | Anahtar açıkken: eşleşen görevde LLM uyanmaz; adımlar `niyetGonder` ile gider; bir adım hata verirse kalanlar gönderilmez, hata LLM'e geçer | D | `[TEST]` a6cd3e8: sıralı adım, hata, iptal, zaman aşımı, yeni söz, doğrulayıcı, geç gelen sonuç, `basladi`, `durdur` |
| B14 | Canlı `becerdene`: ilk söz LLM'le, aynı söz ikinci kez refleksle; ikinci seferde uyanış yok | D | `[ÖLÇÜLDÜ]` `ORION_BECERI=1`: 1. söz LLM'le, 2. ve 3. söz refleksle (uyanış +0, `basari`, 2,0–2,4 sn yürüyüş dahil); adım sonuçları `kopru.refleks`, gölge denetimi 3/3. Hata ve zaman aşımı yolları canlıda koşulmadı |
| B15 | Her fazda bozma denemesi: bütün mutantlar yakalanır ya da eşdeğerliği yazılı | A–D | A: 9/9 · B: 70'te 68, 2 eşdeğer (G7 hiçbir çapa adı öbürünün öneki değil; G26 `soz` yalnız `duydum` satırında) · C: 38'de 35, 3 eşdeğer (C14 defterin süzgeci yalnız bellek için; C24 gölge hatası testte tetiklenemez; C28 NTFS dizini sıralı verir) · D: 33/33 |

**Ölçüler (Faz B ve C; `tools/beceri-deney.ts`, sıralı: her görevde önce karar, sonra öğrenme):**
- **Kapsam:** Görevlerin kaçında parametre içinde bir beceri eşleşirdi.
- **Uyum:** Eşleşen görevlerde becerinin adımları LLM'in gerçekten yaptığıyla birebir aynı mıydı (gövde eşitliği).
- **Kazanç:** Kazanılacak uyanış sayısı ve süresi.
- **LLM ayrıca konuştu:** Eşleşen görevlerin kaçında LLM söz ya da sorgu da verdi. Uyum yalnız bedensel adımlara bakar,
  refleks ise sessizdir; bu sayı uyumun göremediği farkı gösterir.
- **Güvensiz adım:** Eşleşmelerin önerdiği bedensel olmayan adım. Yapıca 0 olmalı.
- Ölçüye yalnız LLM'in planladığı görevler girer. Refleksin kendi yürütümü hafızayı besler ama ölçülmez: bir beceri
  kendini doğrulayamaz.
- Kalibrasyon (Themis 1.1): taban "hiç" kapsam 0; tavan "kâhin" kapsam ve uyum %100; sabit adımlı alışkanlık, uyumu
  yalnız o adımlı görevlerde. Gerçek hafıza bilinen akışlarda: aynı görev n kez → (n−1)/n eşleşme; aynı söze iki
  tarif sırayla → 3 eşleşme, 0 uyum.

Faz D'nin barı ön-kayıtta dondurulur. Taslak:
- gölgede en az 20 eşleşme;
- uyum en az %90;
- güvensiz adım 0.

## Ne zaman: mevcut yol haritasına göre karar

Yol haritası (BY44): 1–3 bitti · **4 bir hafta gerçek kullanım (şimdi)** · 5 ön-kayıtlı kıyas · 6 kapı yetkisi · 7 LED
yüz.

| faz | ne zaman | neden |
|---|---|---|
| A | Spec onaylanınca hemen, adım 4'ün başında | Küçük, davranış değişmez, `world/`'e dokunmaz. Gerçek kullanım haftası gövdeli kayıt biriktirsin diye ilk iş. Ozyn Orion'u bir kez yeniden açar. |
| B | Adım 4 haftası içinde yazılır, hafta sonunda ölçülür | Çevrimdışı; adım 5'in hazırlığıyla paralel yürür. Ölçülecek veri o hafta birikir. |
| C | Hafta sonu ölçümü kapsam gösterirse, adım 5 kıyasıyla aynı dönemde | İkisi de davranış değiştirmez; aynı kayıt ikisini birden besler. |
| D | Adım 6 (kapı yetkisi) kararından sonra, kendi ön-kayıtlı barıyla | Aynı anda iki davranış değişikliği olmasın: hangi değişikliğin neyi değiştirdiği ayırt edilebilsin. |
| E | Adım 7 (LED yüz) öncesinde ya da sonrasında; Ozyn'in kararı | Becerinin LLM'e araç olarak verilmesi ayrı bir tasarım sorusu. |

Faz A'dan önce birikmiş kayıt da boşa gitmez: niyet türleri ve akıbetleri orada. Yalnız gövdesi olmayan becerileri
kuramaz.

## Açık sorular (Ozyn'e; önerilerim yanında)

1. **Refleks çalışırken Orion bir şey söylesin mi?** Öneri: v1'de söz yok, yalnız `jest: başını_sallıyor`. Uydurma
   söz sessizlikten kötüdür (sağ lob ilkesi, `mind/yerelTepki.ts`).
2. **Görev yalnız senin sözünden mi doğsun?** Öneri: evet. Orion'un kendi girişimleri (inisiyatif) ve ajanda beceri
   doğurmaz.
3. **Hata sonrası ne olsun?** Öneri: pay 0,75'in altına düşen beceri askıya alınır, yeni bir başarı geri getirir.
   Öğrenen kapıdaki güven payıyla aynı.
4. **Beceriyi öğretebilmek.** Öneri: Faz C'de `ogret gozden` becerileri de göstersin; "bu beceri yanlış" dersi onu
   siler.
   - Yapılan (Faz C): `ogret beceriler` salt okur döküm; her sayının anlamı üstte yazılı.
   - Açık, Ozyn'in kararı: "bu beceri yanlış" dersi beceriyi silsin mi, tarifi yasaklasın mı? Silinen beceri, LLM aynı
     tarifi sürdürürse yeniden doğar. Öneri: yasak. Başarıyla biten ama yanlış olan bir tarifi sayaçlar askıya almaz; bu
     ders yetki açılmadan önce gerekli.
5. **Faz E, beceri LLM'e araç olarak verilsin mi?** Voyager'daki beceri kütüphanesi gibi: LLM bilinen becerileri tek
   araçla çağırır, onlardan yeni görev kurar. Öneri: Faz D ölçüldükten sonra ayrı bir tasarımla.
