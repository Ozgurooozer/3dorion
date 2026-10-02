# 13 — Söylediğini yapsın, düşüncesi görünsün, API ile güçlensin (2026-10-02)

**Durum:** Ozyn onayladı (2026-10-02, sohbet; plan "Orion MVP", revize v2). **Faz 0–7 bitti** (2026-10-02). Açık: Ozyn'in kendi API anahtarıyla ölçüm, süzgeç merceği yetkisinin gölge ölçüsü, şemanın çizili veri yolu, 3. ortak test.

Numara: başka bir oturumun planı aynı gün `12-anlik-benlik.md` olarak geldi; bu belge 12'den 13'e taşındı.

Kaynak: ortak canlı test, `docs/canli-test-2026-10-02.md`.

## Kararlar (Ozyn, 2026-10-02)

| soru | karar |
|---|---|
| Terminal | **Her komut onaylı.** Onay kapısı (`onay.insan`) aynen kalır; Orion yalnız monitörü kendisi açabilir hale gelir. |
| Hareket olayları | **Uyandırmaya devam eder, sesli konuşmaz.** Kapı değişmez (ölçüm haftası verisi bozulmaz). O zincirde söz sesli okunmaz, günlükte "iç ses" olur. Gereksiz uyanmayı Ozyn ileride `ogret` ile öğretir. |
| API anahtarı | **Şifreli, hatırlanır.** Ana süreçte `safeStorage` ile şifreli dosya; renderer anahtarı hiç görmez; "sil" düğmesi. |
| Sıra | Eylem → API → Zihin → Bilgisayar. |

## Faz 0 — taban ölçüsü [ÖLÇÜLDÜ]

Alet: `tools/eylem-olc.ts` + `fixtures/eylem/komutlar.json`. 8 sözlü komut, model başına koşul başına 5 tekrar,
puan `tools/eylem.ts` (gerçek log satırlarıyla kalibre, `tools/eylem.test.ts`). Girdi canlı köprünün kurduğu
gibi kurulur (`talimatUret`, `ornekUret`, `araclariUret`). İki koşul:
- **temiz:** geçmiş boş;
- **canlı:** 2026-10-02 testindeki "otur" turunun gerçek geçmişi (soyle ve düz metinle dolu, hiç beden eylemi yok).

| komut | ornith temiz | ornith canlı | qwen temiz | qwen canlı |
|---|---|---|---|---|
| otur | 4/5 | 4/5 | 5/5 | 0/5 |
| bana gel | 2/5 | 3/5 | 2/5 | 0/5 |
| yanıma gel | 5/5 | 4/5 | 5/5 | 0/5 |
| masaya git ve otur | 0/5 | 0/5 | 0/5 | 0/5 |
| kalk | 5/5 | 4/5 | 4/5 | 0/5 |
| önündeki bilgisayarı aç | 0/5 | 0/5 | 0/5 | 0/5 |
| tahtaya merhaba yaz | 0/5 | 0/5 | 2/5 | 0/5 |
| pencereye bak | 3/5 | 2/5 | 0/5 | 0/5 |
| **toplam** | **19/40** | **17/40** | **18/40** | **0/40** |
| ≥ 4/5 olan komut | 3/8 | 3/8 | 3/8 | 0/8 |

Ham çıktıdan teşhis:
1. **Söyleyip yapmamak** (ornith): "bilgisayarı aç" 8/10 kez yalnız `soyle "Bilgisayarı açıyorum"`; "bana gel"
   4/10 kez yalnız "Geliyorum".
2. **İlk adımda kalmak** (iki model): "masaya git ve otur" ve "tahtaya yaz" hep yalnız `git` ile bitti. Varış
   sonucu (`refleks.sonuc.rutin`) beyni uyandırmaz, ikinci adım hiç gelmez. Aynı turda `git + yaz` gönderilse de
   `yaz` varıştan önce yürür ve uzaktan yazma reddedilir.
3. **Geçmişteki düz metin zehirliyor** (qwen): canlı geçmişle 0/40. Model araç çağırmak yerine geçmişteki kendi
   düz metnini taklit ediyor ("ortalığı kontrol ediyorum. masaya git dolu sandalyeyi kapattım…"), bazen araç
   çağrısını düz metin olarak yazıyor. Kaynak: `kopru.ts` modelin araçsız düz metnini geçmişe `assistant` metni
   olarak yazıyor; `ollama.ts`'in yorumu bu kalıbın zararlı olduğunu zaten söylüyor.
4. **Etiket ve hedef karışıklığı**: `git {ad:"çalışma masası", tip:"nesne"}` (etiket çapaya çevrilmiyor);
   qwen "masaya git"te `{tip:"oyuncu", ad:"Ozyn"}` gönderdi.
5. **Bilgisayar için yetenek yok**: `dunya_odaklan` hiçbir yerde yürütülmüyor (Faz 4).

## Faz 1 — ön-kayıt (koşmadan önce yazıldı, 2026-10-02)

Değişiklikler:
- talimat (`KONUSMA`): iş istenirse beden aracı çağrılır; çok adımlı istek tek turda sırayla; "bana gel" =
  `git {tip:'oyuncu'}`; bilgisayar = `odaklan monitor`;
- eylem örneği (`ornekler.ts`);
- **geçmiş yalnız gerçekte olanı taşır**: Ozyn'in sözü, Orion'un sözü (`soyle`) ve beden niyetleri (araç adıyla).
  Araçsız düz metin geçmişe girmez;
- **eylem sırası**: tek turdaki birden çok beden niyeti köprüde sırayla yürür, her biri öncekinin `bitti`
  sonucunu bekler; `hata` sırayı keser ve beyne gider (mevcut `refleks.sonuc.hata`);
- `tip:'nesne'` etiketleri de çapaya çözülür;
- "dedi ama yapmadı" bekçisi (yalnız kayıt ve günlük);
- hareket zincirinde söz sesli okunmaz (içgüdü `kopru.hareket_sessiz`).

**Öngörü:** Aynı alet, aynı 8 komut, n=5, iki model.
- **temiz** koşulda her iki modelde ≥ 7/8 komut ≥ 4/5 doğru (plandaki eşik).
- **canlı** koşul Faz 1 kuralıyla kurulan geçmişle koşulur (aynı turlar, düz metin satırları geçmişe girmez,
  çünkü yeni kopru onları yazmaz). Bu koşulda her iki modelde ≥ 6/8 komut ≥ 4/5 doğru (gerçek geçmiş daha zor; tabanı 0/8 ve 3/8).
- "yalnız söz" toplamı her koşulda ≤ 3/40.
- "bilgisayarı aç" artık `odaklan monitor` çağırmalı (≥ 4/5). Yürütülmesi Faz 4'ün işi; bu fazda çağrı avatarda
  reddedilir.

**Çürütme:** temiz koşulda bir modelde < 7/8 komut geçerse kök neden düzeltmesi yetmemiştir → Faz 1b (bekçi
tetiklenince tek düzeltme turu, yeni içgüdü `kopru.sozEylemDuzelt`). Canlı koşulda qwen < 4/8 kalırsa geçmiş
temsili hâlâ zehirlidir → geçmiş penceresi ayrıca ölçülür.

## Faz 1 — sonuç [ÖLÇÜLDÜ] (2026-10-02, 13738b7)

Aynı alet, aynı 8 komut, n=5. Ham çıktı: scratchpad `eylem-faz1-*.txt`.

| koşul | ornith önce → sonra | qwen önce → sonra |
|---|---|---|
| temiz, toplam doğru | 19/40 → **31/40** | 18/40 → **39/40** |
| temiz, ≥ 4/5 olan komut | 3/8 → **6/8** | 3/8 → **8/8** |
| temiz, yalnız söz | 8/40 → **1/40** | 0/40 → 0/40 |
| eski köprünün geçmişi (`canli`), toplam | 17/40 → 21/40 | 0/40 → 3/40 |

**Ön-kayıt karnesi:**

| öngörü | sonuç |
|---|---|
| temiz: iki modelde ≥ 7/8 | **qwen 8/8 tuttu; ornith 6/8 TUTMADI** |
| faz1 geçmişi: iki modelde ≥ 6/8 | **TUTMADI**: ornith 4/8, qwen 5/8 |
| yalnız söz ≤ 3/40 her koşulda | **tuttu** (en yüksek 3/40) |
| "bilgisayarı aç" → `odaklan monitor` ≥ 4/5 | temizde tuttu (ornith 4/5, qwen 5/5); faz1 geçmişinde ornith 0/5 |

**Fixture hatası (benim):** ön-kayıtlı `faz1` geçmişinde son "masaya git" turunun cevabı (log satır 351,
`git masa`) eksikti. Cevapsız komut her ölçümü masaya çekti: ornith "otur"da 3/5 kez masaya yürüdü. Düzeltilmiş
geçmişle **keşif** ölçüsü (ön-kayıt sayılmaz): ornith 29/40, 5/8; qwen 19/40, 3/8. Ön-kayıtlı sonuç eski
sürümle kalır.

**Kalan hata biçimleri (ham çıktıdan):**
1. **ornith iki adımı zincirlemiyor.** "tahtaya merhaba yaz" temizde 0/5: hep yalnız `git`. Talimattaki "tüm
   araçları sırayla çağır" satırı ve eylem örneği yetmedi. qwen aynı komutta 5/5 `git + yaz`.
2. **qwen geçmişe hâlâ duyarlı.** Faz 1 geçmişinde bile araç çağrısını düz metin olarak yazıyor
   (`dunya_kalk(), dunya_git(...)`), bazen Çince karakter. Geçmişte kalan iki çöp söz ("ortalığı kontrol
   ediyorum…" — o gece sesli okunmuştu) yeterli. Canlıda `metinKurtar` JSON biçimlerini kurtarır; bu ölçü
   kurtarmayı saymaz.
3. **"Söyleyip yapmamak" büyük ölçüde kapandı:** 8/40 → 1/40 (ornith, temiz).

**Çürütme kuralı** "temizde < 7/8 → Faz 1b" diyor ve ornith 6/8 ile tetiklendi. Ama Faz 1b'nin hedefi
(söyleyip yapmamak) artık 1/40. Kalan açıklar zincirleme ve geçmiş duyarlılığı. Hangi yoldan gidileceği Ozyn'in
kararı.

## Revize plan v2 (2026-10-02, Ozyn: "anlık benliği de fazlara ekleyelim … Orion bir robot, LLM olmadan da bir çok şeyi yapmaya programlayabiliriz")

**İlke — Orion bir robot.** Bedenin yapabildiği her şey önce PROGRAMDIR: kesin bir söz ya da durum, LLM'e sorulmadan
niyet dizisine döner. LLM yalnız programın bilmediğine uyanır: sohbet, yorum, hangi komutun önerileceği. Taban
ölçüsü bunun gerekçesi: yerel 7–9B modeller iki adımı zincirleyemiyor, geçmişe duyarlı, bazen aracı düz metne
yazıyor. Program bunların hiçbirini yapmaz ve 0 token, ~0 ms'dir.

Spec 12 (anlık benlik, başka oturumun planı) bu plana fazlarıyla girer. **Ozyn (2026-10-02): "hepsini sen
yapacaksın, düzgün sırala"** — spec 12'nin fazlarını da bu oturum taşır, aşağıdaki sırayla; başka oturum köprüye
ve şemaya yazmaz. **Komut sözlüğü:** önce gölgede, gerçek sözlerde yanlış eşleşme 0 ölçülünce varsayılan açık.

Sıranın gerekçesi (bağımlılık): 2 hiçbir şeye bağlı değil ve Ozyn'in en çok gördüğü açık; 3 bağımsız ve sonraki
ölçümlere güçlü model verir; 4 (benlik) 5'in veri yolu ve 6'nın "bekliyorum" alanı için ön koşul; spec 12 Faz 3
(modele tek satır) 3'e bağlı.

| faz | ne | kapı |
|---|---|---|
| 0 ✓ | taban ölçüsü | d281d29 |
| 1 ✓ | söylediğini yapsın: talimat, örnek, eylem sırası, iç ses, söz-eylem bekçisi | 13738b7; ön-kayıt kısmen |
| **2** | **Robot çekirdeği.** (a) Bilgisayar programı: `odaklan monitor` = sandalyeye git → otur → monitör pty'si açılır, Ozyn'in kamerası kaçırılmaz → durum "Orion monitörde". (b) Komut sözlüğü: doğuştan programlar — otur, kalk, bana/yanıma gel, X'e git, X'e bak, dur, tahtaya "…" yaz, tahtayı temizle, bilgisayarı aç/kapat. Yeni içgüdü `refleks.komut`. Eşleşmeyen söz LLM'e; program başarısızsa söz notla LLM'e döner (spec 10 B13 deseni, aynı adım yürütücüsü). Onay jesti (baş sallama); söz istenirse LLM. | Birim: kalıp tablosu testli. Ölçü: `eylem-olc` program koluyla 8/8, **yanlış pozitif 0** (karar kaydındaki bütün gerçek Ozyn sözleri üzerinde: "neler yapabilirsin" eşleşmemeli). Canlı `eylemdene`. Anahtar Ozyn'in kararı. |
| 3 | API anahtarı (M seçici, `safeStorage`, ana süreçten istek) | anahtar bekçi testi; NVIDIA modeliyle `eylem-olc` |
| 4 | Anlık benlik çekirdeği (spec 12 Faz 1–2): `mind/benlik.ts`; yazma noktaları köprünün eylem sırasına (`_niyetiIsle`, `_siraBaslat`, `_siraSonucu`) ve onay kapısına; "meşgul" tek kaynak; ALGI merceği (`eden`) gölgede. Davranış değişmez. | spec 12'nin kapıları (eşdeğerlik bekçisi, `benlikdene`) |
| 5 | **Zihin duvarı.** Şema: benlik veri yolu ve mercek rozetleri (spec 12 §4.5); DÜŞÜNCE düğümünde canlı saniye ve model. Günlük: uyanış satırları (UYANDI ← neden ve kural · HATIRLADI · SEÇTİ · REDDEDİLDİ · SÜRE), iç ses, söz-eylem; canlı "DÜŞÜNÜYOR" satırı (akan metin). **Hafıza görünümü**: şemada HAFIZA düğümüne girince "Artık benlik imgesi" biçimi (aşağıda). Düşünen modelin araçsız İngilizce iç metni sesli okunmaz, iç ses olur (ortak test 2). | görünümler önce sahnesiz deneme sayfasında; saf çekirdek testli; FPS ≥ 60 ve dönme yalnız Ozyn odaklıyken |
| 6 | Komut sonucu Orion'a (spec 12 Faz 4–5, SÜZGEÇ merceği `beklenen_cevap`): gölge → ölçüm → yetki. Bilgisayar kullanımını tamamlar: Orion onaylanan kendi komutunun sonucunu öğrenir. | spec 12'nin kapıları (yanlış eşleşme 0; onay başına ≤ 1 uyanma) |
| 7 | Canlı kanıt: `eylemdene`, `tahtadene`, `gorudene`; ortak test 3 | 4/4 |
| sonra | spec 12 Faz 3 (modele tek satır — Haiku yerine API modeliyle ölçülür), Faz 6–7 | ayrı ön-kayıt |

### Hafıza görünümü (Faz 5) — "Artık benlik imgesi" Orion için

Kaynak: Ozyn'in gösterdiği sayfa (claude.ai artifact WP1bVpCgeg2NvBqjk8jh1X): üç kabuk halinde dönen kelime bulutu,
ortada imleç, kırmızı dikkat iplikleri. Orion'da her kelime GERÇEK bir kayıttır:

| kabuk | Orion'da | görsel |
|---|---|---|
| SABİT (çekirdek) | içgüdü adları (`mind/icgudu.ts`), kimlik cümleleri (`talimat.ts`), beden künyesi | eğik, büyük; panelden değişmez |
| ANLIK | benlik alanları (Faz 4), çalışma belleği, konuşma penceresi (12 tur), süren eylem sırası | oturum bitince gider |
| DERİN | hafıza anıları (`mind/hafiza.ts`, bugün 123+): önem → boyut, yaş → soluklık; kural ve beceri hafızası | kalıcı |

- **İmleç** = bu tur. **Kırmızı iplikler** = bu turda getirilen anılar (`getir`), tur bitince söner.
- **Üzerine gel / tıkla** → anının metni, türü, önemi, yaşı, son erişimi; içgüdüde açıklaması.
- **Buda** (sayfadaki "Sıkıştır"ın karşılığı) → mevcut `hafiza.buda` pano eylemi, teyitli. Giden kelimeler dışarı savrulur.
- **Gerçek** → kelimeler skorlarına çözülür (yakınlık · önem · ilgi, Generative Agents puanı).
- Çizim saf çekirdek + canvas (`semaCizim.ts` deseni), şema detay görünümünün yerine geçer (spec 05: detay şemanın yerini alır).
- Spec 05 "panel süs eklemiyor": her kelime bir kayıt, her iplik bir getirme, her boyut bir sayı.

## Faz 2 — robot çekirdeği: sonuç (2026-10-02)

**2a bilgisayar programı** (af04bb5, `world/bilgisayar.ts`): `odaklan monitor` → oturmuyorsa `otur` (çapasız,
sandalyeye yürür) → monitör pty'si açılır, Ozyn'in kamerası ve klavyesi değişmez → sonuç köprünün eylem sırasına
döner. Başka yüzey → oraya yürür. Orion oturuyor ve terminal açıksa dünya satırı bunu söyler ("terminal is open
(PowerShell)"). Komutlar yine Ozyn'in onayıyla. Yerel model zaman aşımı 20 → 60 sn; AbortError süreyle söylenir.
[TEST] 8 yeni test, 3/3 bozma yakalandı. Canlı: Faz 7.

**2b komut sözlüğü** (`mind/komutSozlugu.ts`, içgüdü `kopru.komut`): sözün TAMAMI bir kalıba uymalı: otur,
kalk, bana/yanıma gel, dur, bana bak, `<yer>(y)a git`, `<yer>(y)e bak`, bilgisayarı aç/kullan. "Bilgisayar",
"ekran", "terminal" monitördür. Program LLM'i uyandırmaz; onay jesti + adımlar Faz 1'in eylem sırasıyla; adımın
hatası her zamanki kapıdan beyne gider. Kayıtta ayrı `program` satırı: refleks satırı DEĞİL, çünkü görev
çıkarımı ve beceri hafızası refleks satırından öğrenir (B9 ölçüsü kirlenmesin).

| ölçü | sonuç |
|---|---|
| karar kaydındaki gerçek sözler (5 gün, 62 farklı, 78 toplam) | 12 farklı söz eşleşti (22/78 söz LLM'siz); 12'sinin 12'si gerçekten beden komutu → **yanlış eşleşme 0** [ÖLÇÜLDÜ, `tools/komut-tara.ts`] |
| `eylem-olc` komutları | 8'in 7'si programla (otur, bana gel, yanıma gel, masaya git ve otur, kalk, bilgisayarı aç, pencereye bak); "tahtaya merhaba yaz" bilerek LLM'de (ne yazılacağı içerik) [TEST] |

Sınır: bu 62 söz kalıplar yazılırken görüldü; ayrı tutulmuş bir sınav değil. Canlı kullanımda her eşleşme
`program` satırına yazılır, yanlış eşleşme `komut-tara` ile sonradan denetlenir.

**Anahtar:** elle açılışta AÇIK (Ozyn'in kararı). Senaryolarda (`sessiz=1`) KAPALI: `tahtadene`, `becerdene`
LLM'in ve becerinin yolunu ölçer. Kayıt oynatan ölçüm araçlarında (`beceri-curut`, `kapi-deney`, `ogretmen`)
KAPALI: sonuçları bu fazdan önceki koşularla birebir kalır. `?komut=0|1` zorlar.
[TEST] 27 yeni test (15 kalıp, 12 köprü); bozma 4/5 yakalandı, biri eşdeğer (`^` kaldırmak: açgözlü `(.+)`
zaten baştan yakalıyor), yerine "son kelime" bozması denendi ve yakalandı.

## Ozyn'in kendi testi (2026-10-02, 08:38–08:46) ve düzeltmeler (7643004)

Karar kaydından: komut programları canlıda çalıştı (kalk, tahtaya git, bana gel — LLM uyanmadı); Orion
bilgisayarı kendisi açtı, komut önerdi, Ozyn onayladı, terminalde çalıştı. Bulunanlar:
- lfm25-tb uzaktan 15 kez `yaz` denedi, hep "önce git" reddi; hiç yürümedi → **uzaktan `yaz` artık önce
  tahtaya yürür** (robot ilkesi). `tahtadene` canlı 4/4 [ÖLÇÜLDÜ].
- "neredesin" → "masamda oturuyorum" söz-eylem bekçisine takıldı (durum anlatımı) → bekçi yalnız Ozyn'in o
  turda istediği eylemlere bakar.
- "bilgisayara git otur" kalıba eklendi. Tarama: 74 söz, 13 eşleşme, hepsi gerçek komut; o sabahki 12 yeni söz
  kalıplar yazılırken görülmemişti ve hiçbiri yanlış eşleşmedi [ÖLÇÜLDÜ].
- Açık (Faz 6): Orion'un önerip Ozyn'in onayladığı `ls` başarılı bitti ama sonucu rutin sayılıp elendi —
  Orion kendi komutunun sonucunu görmedi. Talimattaki terminal örneği (`pyhton`) bağlamsız `python --version`
  önerisine sızdı; terminal talimatı hâlâ "komutları Ozyn yazar" diyor.

## Faz 3 — API anahtarı: sonuç (d169aa8 + bu commit)

- Ana süreç: `host/anahtarDeposu.js` (safeStorage/DPAPI ile şifreli `anahtarlar.json`; şifreleme yoksa yalnız
  bellekte ve bu söylenir), `host/apiIstek.js` (Bearer başlığı ana süreçte; hata metni anahtarı maskeler).
- Renderer: `bridge/apiBeyni.ts` (bağlam `ollamaMesajlari`'ndan, tek kaynak; OpenAI biçimine çeviri: çağrı
  kimlikleri, JSON metni argümanlar, `tool_call_id`; `reasoning_content` iç ses için ayrı), `bridge/apiKatalog.ts`
  (NVIDIA NIM, OpenRouter, özel adres; gömme/güvenlik modelleri seçenek olmaz).
- M seçici: "🔑 API anahtarı" bölümü — sağlayıcı, adres, şifre alanı; Kaydet'e basınca alan hemen boşalır;
  kayıtlı sağlayıcılar "✓ şifreli" ya da "⚠ yalnız bu oturum"; Sil. Modeller "Bulut" grubunda, "API" ve
  "araç ?" rozetiyle.
- [TEST] 30 yeni test (depo 11, istek 7, beyin+katalog 12). Ollama mesaj kurucusunun çıkarılması bayt bayt
  aynı istek gövdesini üretti (8861 bayt).
- [ÖLÇÜLDÜ] `3dorion.bat apidene` (sahte yerel sunucu, ayrı anahtar dosyası) **5/5**: kaydedildi, renderer
  anahtarı görmedi, model seçenek oldu, API modeli düşündü, Orion API'nin sözünü söyledi. Log'da anahtar 0 kez;
  dosyada düz anahtar yok; gerçek anahtar dosyası oluşmadı.
- Kalan: Ozyn kendi NVIDIA anahtarını girer (anahtar bende hiç olmaz), bir model seçilir, `eylem-olc` API
  modeliyle koşulur.

## Faz 4 — anlık benlik çekirdeği: sonuç (6a825f1, 8b261cf)

Spec 12 §8'deki sorular Ozyn'e soruldu; cevap gelene kadar spec'in kendi önerileri uygulandı (adlar aynen;
"Ozyn monitörde" ayrı alan, davranış aynı; konuşma penceresi ANLIK'ta; olay numaraları Faz 6'ya; MCP ajanına
izdüşüm sonra). Ozyn itiraz ederse değişir.
- `mind/benlik.ts`: yapıyorum, bekliyorum (onay → komut sonucu), düşünce, son söz/niyet; alan başına azami yaş
  ("boşa çıktı"); diske gitmez; `tik` dokunmaz. Köprü her niyeti tek `_gonder`den yazar; sonuç ve terminal
  benliği SÜZÜLSE DE günceller.
- **Meşgul tek kaynak**: eski ifadeyle her kombinasyonda eşdeğer [TEST, ızgara].
- **Kim yaptı** (`eden`, ALGI merceği): karar kaydının her algı satırında. Durum koduna (öğrenen kapı) henüz
  girmedi — eski öğretimler kaymasın diye bilerek.
- [ÖLÇÜLDÜ] `benlikdene` 3/3: önerildi → onay bekleniyor → sonuç bekleniyor → kapandı ("bitti, çıkış kodu 0").
  Kayıtta onaylanan komutun terminal sonucu `eden: ortak`. İlk koşu 2/3 idi: `echo` 400 ms dolmadan bitti,
  ara hâl tek bakışla kaçtı → geçişler 50 ms'de örneklenir.

## Faz 5 — zihin duvarı: sonuç (b1d1a7c, 57c8ee5, c6f25a1)

- **Günlük**: karar kaydının canlı akışı Türkçe satırlar — `uyandı ← Ozyn: "otur" [kopru.konusma · ozyn] · 2,3 sn
  ornith → otur + soyle`; LLM'siz programlar; elenen algılar sayılır. Başlığın altında CANLI SATIR: düşünüyorsa
  saniye ve model, değilse yaptığı/beklediği, boştaysa son biten iş.
- **İç ses**: düşünen modelin araçsız İNGİLİZCE iç monoloğu (Ozyn'in testinde lfm25-tb'ninki sesli okunmuştu) ve
  API modelinin `reasoning_content`'i sesli okunmaz, iç sestedir.
- **Hafıza görünümü**: HAFIZA düğümüne girince üç kabuklu dönen bulut — SABİT (içgüdüler), ANLIK (benlik,
  çalışma belleği, konuşma penceresi), DERİN (en fazla 60 anı: önem → boyut, yaş → soluklık); bu turda
  hatırlananlar kırmızı, imleçten iplikle. Kelimeye tıkla → ne olduğu; "Gerçek" → sayılar; "Ayarlar · Buda" →
  eski düğme ekranı. Deneme sayfasında görüldü (`sema-deneme.html`); ilk taslakta iç kabuk sıkışıktı → elips.
- **Şema**: DÜŞÜNCE hapında canlı saniye; alt şeritte benlik satırı. Spec 12'nin çizili veri yolu, kılcal
  bağlantılar ve mercek rozetleri YAPILMADI (yalnız metin hâli) — açık iş.
- Canlı odada görüntü: Faz 7'de.

## Faz 6 — komut sonucu Orion'a (süzgeç merceği): sonuç

- `mind/mercekSuzgec.ts` (spec 12 Faz 4–5): **beklenen cevap** — onaylanmış kendi komutunun sonucu beklenirken
  gelen terminal bloğu (komut satırı okunuyorsa eşleşmeli) → geçir; **yan ürün** — Orion yürürken gelen
  yaklaştı/uzaklaştı (`eden: ben`) → süz. Konuşmaya ve sonuca dokunmaz.
- **Gölge (varsayılan)**: kayıtta `mercek` alanı; davranış değişmez. **Yetki** `benlikSuzgecYetkisi`
  (`?benliksuzgec=1`, `ORION_BENLIK_SUZGEC=1`), varsayılan KAPALI: yalnız ezilebilir bir içerik kararını değiştirir;
  geçirilen blok "bu SENİN önerdiğin ve Ozyn'in onayladığı komutun sonucu" notuyla gider; yeni içgüdüler
  `benlik.beklenen_cevap`, `benlik.yan_urun`.
- [TEST] 11 yeni test, 3/3 bozma. [ÖLÇÜLDÜ] `benlikdene` (ornith): gölgede 4/4 (sonuç beyni uyandırmadı, bugünkü
  gibi), yetkide 4/4 (sonuç beyni uyandırdı, düşünme 0 → 1). Modelin cevabı bu koşuda görülmedi (duman penceresi
  ornith yüklenmeden kapandı).
- **Yetkinin gerçek kullanımda açılması** spec 12 Faz 4'ün kapısına bağlı: ≥ 3 gerçek oturumda gölge kararları,
  `beklenen_cevap` yanlış eşleşme 0 ve `yan_urun`un süzdüklerinde hata/konuşma 0. Karar Ozyn'in.

## Faz 7 — canlı kanıt (2026-10-02, son kod, ornith-32k, ayrı karar dosyaları)

| senaryo | sonuç [ÖLÇÜLDÜ] |
|---|---|
| `eylemdene` (yeni) | **6/6**: otur → oturdu; bana gel → 1,57 m; bilgisayarı aç → oturdu + terminal açık, Ozyn'in kamerası kaçırılmadı; tahtaya git → tahtada; günlükte 6 program satırı. LLM hiç uyanmadı (düşünme 0). |
| `tahtadene` | 4/4 (uzaktan istenince önce yürüdü, sonra yazdı) |
| `benlikdene` | gölge 4/4, yetki 4/4 |
| `apidene` | 5/5; log'da anahtar 0 |
| `gorudene` (gerileme) | 3/3 |

Kalan: Ozyn ile 3. ortak test (canlı odada zihin duvarına bakmak, API anahtarını girmek).
