# Spec 10 — Beceri refleksi: bir kez başarılan görev, parametreleriyle refleks olur

Tarih: 2026-09-28 · Durum: **TASLAK, Ozyn'in onayını bekliyor.** Kod yok.
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
- **Başarı:** Görevin bütün bedensel niyetleri `bitti` ile döndü. Hiçbiri `hata` ya da `iptal` değil, hepsinin sonucu
  geldi.
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
BECERİ ÇIKARICI (saf) — tek sözle tetiklenmiş, bedensel niyetlerinin hepsi "bitti" olan görev
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
   doğmaz.
2. **Bedensel niyetler:** `git`, `otur`, `kalk`, `bak`, `al`, `birak`, `dur`, `jest`, `poz`, `odaklan`.
   Beceriye girmeyenler:
   - `komut`: asla. Kabuk komutu kendiliğinden tekrarlanmaz (güvenlik).
   - `soyle` ve `yaz`: içerik üretimi, tekrar edilmez (bayat söz).
   - `sor`: bilgi toplar, reflekste anlamı yok.

   Bedensel niyet yoksa beceri doğmaz.
3. **Başarı:** Bütün bedensel niyetler `bitti` olmalı. Sonucu gelmeyen niyet varsa görev başarılı sayılmaz.
4. **Anahtar:**
   - Sözün sözcükleri `mind/durumKodu.ts` `kelimeler` ile çıkar: küçük harf, dolgu atılır. Karşılaştırmada Türkçe
     karakterler katlanır (ı→i, ö→o, ü→u, ş→s, ç→c, ğ→g).
   - Bir çapa adıyla başlayan sözcük yuva olur ("masaya" → `masa`, "pencereye" → `pencere`, "kapıya" → `kapi`).
   - Kalan sözcükler çerçevedir.
5. **Adımlar:** Bir yuvanın çapa adına eşit argüman yuva işareti alır; öbür argümanlar sabittir.
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
   - Bedensel niyet kümesi tek sabittir (`BEDENSEL_NIYETLER`). Bekçi testi, her niyet türünün "bedensel" ya da
     "bedensel değil" diye sınıflanmasını zorlar; yeni tür sınıfsız kalamaz.
   - Görev başarısı tek fonksiyondur (`gorevBasarili`); köprü de çevrimdışı araç da onu kullanır.
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
    - `world/`'e dokunulmaz: Faz A–D `world/` gerektirmiyor.
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
| B1 | Uyanış satırındaki her niyet gövdesini taşır, metin alanları kesilir; gövdesiz eski satırlar okunur | A | `[PLAN]` |
| B2 | `duydum` algı satırı sözün metnini ve kesinliğini taşır | A | `[PLAN]` |
| B3 | Davranış aynı: köprü testleri ve betikli oturum aynı uyanış ve niyetleri üretir | A | `[PLAN]` |
| B4 | Canlı: senaryo koşusunda uyanış satırlarında gövdeler, söz satırlarında metin var | A | `[PLAN]` |
| B5 | Çıkarıcı: tek kesin sözle tetiklenmiş, bedensel niyetlerinin hepsi `bitti` olan uyanıştan beceri doğar. Çok tetikli, hatalı, iptalli, sonuçsuz, yalnız sözlü ya da `komut`lu uyanıştan doğmaz | B | `[PLAN]` |
| B6 | Yuvalar: sözdeki çapa adı (ekiyle) yuva olur, sözde geçmeyen argüman sabit kalır | B | `[PLAN]` |
| B7 | Eşleşme: aynı çerçeve + tanınan çapa → adımlar yeni çapayla; farklı çerçeve ya da pay < 0,75 → eşleşmez | B | `[PLAN]` |
| B8 | Belirlenimci: aynı kayıt aynı hafızayı kurar | B | `[PLAN]` |
| B9 | Ölçüm (gerçek kayıt, ön-kayıtlı): kapsam, uyum, kazanılacak uyanış ve süre | B | `[PLAN]` |
| B10 | Gölge: eşleşen sözde `beceriGolge` yazılır; kapı ve uyanış değişmez | C | `[PLAN]` |
| B11 | Kayıttan yeniden kurulan hafıza canlıdakine eşit | C | `[PLAN]` |
| B12 | Yetki anahtarı kapalıyken köprü birebir aynı (bekçi) | D | `[PLAN]` |
| B13 | Anahtar açıkken: eşleşen görevde LLM uyanmaz; adımlar `niyetGonder` ile gider; bir adım hata verirse kalanlar gönderilmez, hata LLM'e geçer | D | `[PLAN]` |
| B14 | Canlı `becerdene`: ilk söz LLM'le, aynı söz ikinci kez refleksle; ikinci seferde uyanış yok | D | `[PLAN]` |
| B15 | Her fazda bozma denemesi: bütün mutantlar yakalanır ya da eşdeğerliği yazılı | A–D | `[PLAN]` |

**Ölçüler (Faz B ve C):**
- **Kapsam:** Görevlerin kaçında parametre içinde bir beceri eşleşirdi.
- **Uyum:** Eşleşen görevlerde becerinin adımları LLM'in gerçekten yaptığıyla aynı mıydı.
- **Kazanç:** Kazanılacak uyanış sayısı ve süresi.

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
5. **Faz E, beceri LLM'e araç olarak verilsin mi?** Voyager'daki beceri kütüphanesi gibi: LLM bilinen becerileri tek
   araçla çağırır, onlardan yeni görev kurar. Öneri: Faz D ölçüldükten sonra ayrı bir tasarımla.
