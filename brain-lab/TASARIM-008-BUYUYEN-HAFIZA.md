# Tasarım 008: Büyüyen hafıza

Tarih: 2026-09-26 · Durum: **ONAYLANDI** (Ozyn, 2026-09-26: "onay"; toplantının K1–K9 kararları olduğu gibi).
Toplantı: vault `forum/beyin0fis/toplantilar/2026-09-26-buyuyen-hafiza`.
Kaynak: Ozyn'in hafıza modeli (LAB-DEFTERI.md, 2026-09-26) ve A1 ölçümleri.
Bu belge TASARIM-007'nin §4 (hafıza çekirdeği), §5 (H2 ızgara, H3), §6 (kapı) ve §12 (yol haritası) bölümlerinin yerini
alır. Geri kalan her şey geçerli.

## 1. Neden

Ozyn'in modeli, kendi sözleriyle:

> "Hafıza demek yeni nöronlar, sinapslar demek. Ana bir bölge var, bu kurallar hiç değişmiyor. Etrafında diğer bölgeler
> gelişiyor; ana bölgeye uygunsa giderek yeni kurallar ekleniyor. Hafıza bunun temeli olmalı. Hafızadan geçip
> geçmeyeceğinin kapısına giren bilgi geçmezse refleks, geçerse bilgi ihtiyacı için geçer. Bu çok basit bir bilgi de
> olabilir, tüm hafızayı da tarayabilir. Evrimleşmenin gidişine bağlı çıkacak harita."

TASARIM-007'de hafıza içeriği beyin ağının dışında bir veri yapısıydı: konum hesabı ve 40×40'lık çizilmiş bir ızgara.
Modülleri biz tasarlıyorduk; beyin ağında yeni nöron ya da sinaps doğmuyordu. Ozyn'in "kurallar zinciri" dediği sorun
buradan geliyor: her yeni yeteneği biz ekliyoruz.

Bu modelin üç yararı var:
- **Her şey tek yerde.** Hafıza, refleks ve sonradan gelecek bölgeler aynı beyin ağında, aynı defterde durur. Beyin,
  doğum hali ve defterinden birebir yeniden kurulur; büyürken beyin haritasında görünür.
- **Emsali var:**
  - ART (Carpenter ve Grossberg 1987): mevcut hiçbir bilgiye uymayan girdi yeni bir nöron açar, eski bilgi silinmez.
  - Hipokampus: yeni odada yer hücreleri yeni bir harita kurar.
  - Kapı için Daw, Niv ve Dayan (2005): beyin belirsizliğe göre alışkanlıkla plan arasında seçim yapar.
- **Altyapı hazıra yakın:**
  - Defterde yeni nöron, yeni sinaps ve sinaps silme kayıtları (`node+`, `edge+`, `edge-`) ilk günden beri var;
    yeniden oynatma testleri var, ama hiç kullanılmadı.
  - Brain IR'da `memory` nöron türü tanımlı.
  - Yollar tablosu (`regions/pathways.ts`) tabloda olmayan bağlantıyı reddediyor.

## 2. İlkeler

- **Çekirdek sabittir.** Doğuştan gelir; kuralları yaşam boyunca değişmez. Değişmesi bizim tasarım kararımızdır,
  Ozyn onaylar. Bu, "evrim" düzeyidir.
- **Hafıza yapıdır.** Hatırlanan her şey, yaşarken doğan bir nöron ve onun sinapslarıdır.
- **Anlık durum etkinliktir, yapı değildir.** "Şu an neredeyim, şu an ne görüyorum" üzerine yazılır, deftere girmez.
  Bu, K2'nin "durum ≠ anı" kuralıdır: durum etkinliktir, anı yapıdır.
- **Her büyüme deftere yazılır:** doğum, pekişme, sönme, ölüm. Doğum grafiği ve defter canlı beyni birebir verir,
  büyüme dahil.
- **Uyum şartı:** Büyüme yalnız yollar tablosunun izin verdiği bağlantılarla olur. Tabloda olmayan bağlantı
  reddedilir. Bu, "ana bölgeye uygunsa" şartının kod hali.
- **Davranış elle yazılmaz.** Hafıza "hatırlanan duyular" üretir; onları kullanmayı beyin öğrenir.

## 3. Yapı

```
 duyular ──► ┌──────────── DOĞUŞTAN ÇEKİRDEK (kuralları değişmez) ────────────┐
             │ duyular · dürtü · dopamin · konum (neredeyim) · KAPI · büyüme  │
             └────────┬────────────────────────────────────┬──────────────────┘
                      │ kapı kapalı:                        │ kapı açık:
                      │ tanıdık, emin, ihtiyaç karşılanıyor │ ihtiyaç var, duyular yetmiyor
                      ▼                                     ▼
              REFLEKS (Alice)                      HAFIZA (büyüyen nöronlar)
              öğrenilmiş kurallar             tek adım çağrışım → yetmezse tam tarama (Bob)
                      ▲                                     │ hatırlanan duyular
                      └──── işe yaradıysa yeni kural (sinaps doğar) ◄──┘
```

## 4. Doğuştan çekirdek

Ozyn 2026-09-26'da seçti. Kuralları hiç değişmeyen parçalar:

| parça | ne yapar | bugünkü hali |
|---|---|---|
| duyular | 5 ışın (uzaklık ve tür), çarpma, iç duyu, hareket duyusu | var |
| dürtü | açlık ve acı (`hyp.*`) | var |
| dopamin | homeostatik ödülden öğretme sinyali | var |
| konum | "neredeyim": yol entegrasyonu (A1) ve temas hesabı (A1b) | A1 var, A1b onaylandı |
| kapı | bilginin hafızaya girip girmeyeceğine karar verir (§6) | yeni |
| büyüme kuralları | hafıza nöronunun doğumu, pekişmesi, sönmesi, ölümü; yeni kuralın doğumu (§5, §7) | yeni |

## 5. Hafıza nöronları: ilk hafıza, yemeğin yeri

Basitten karmaşığa ilerlenir. İlk hatırlanan şey, dürtüye en çok dokunan bilgidir: yemeğin nerede olduğu. Duvarlar ve
tehlike sonra gelir.

**Bir hafıza nöronu:**
- Beyin ağında yeni bir düğümdür; bölgesi `mem`, türü `memory`.
- "Ne" (yemek) ve "nerede" bilgisini taşır. "Nerede", bedenin kendi başlangıç çerçevesinde bir noktadır.
- Hatırlanan duyulara bir sinapsla bağlanır. Sinapsın gücü (0–1) hatıranın gücüdür, yani güveni.

**Doğum (ART'taki "uyanıklık" eşiği):**
- Bir ışın yemek görünce, yemeğin yaklaşık yeri konumdan hesaplanır:
  `p = konum + (d + r_yemek) · (cos(θ̂ + a), sin(θ̂ + a))`.
- p'nin ρ yakınında (öneri ρ = 0,5 m) bir yemek nöronu varsa bu yeni bir şey değildir; o nöron pekişir.
- Yoksa yeni bir nöron doğar. Deftere `node+` ve `edge+` yazılır; sebep alanında tik, ışın ve konum bulunur.

**Pekişme:** Aynı yerde yemek yeniden görülünce güç artar: `w ← w + α·(1 − w)`.

**Sönme:**
- **Sürpriz** (TASARIM-007'deki H3'ün büyüyen hali): Bir ışın hatıranın yerinden geçer ama orada yemek görmezse
  ("beklediğim yerde yok"), güç hızla düşer: `w ← w·(1 − β)`.
- **Zaman:** Hiç doğrulanmayan hatıra yavaşça söner: `w ← w·(1 − λ)`.
- **Yendi:** Yemek yenince bedenin yanındaki yemek hatırası ölür; o yemek artık orada değil.
- Güç değişimleri öğrenmedeki gibi kuantumludur; deftere yalnız anlamlı değişiklik düşer.

**Ölüm (budama):**
- Güç bir tabanın altına inerse nöron ölür. Sinapsları silinir (`edge-`), kendisi de silinir (`node-`, defterde yeni
  kayıt türü).

**Oda değişince:** Yer hatıraları odaya bağlıdır; hipokampusta yeni odada yer hücrelerinin yeniden haritalanmasına
benzer. Hemen mi ölecekleri, yavaşça mı sönecekleri toplantıya gider (§15, S2).

**Sınır:** Bir odada canlı hafıza nöronu sayısının bir tavanı olur; sınırsız büyüme bir hatadır. Tavan ölçülerek
seçilir.

## 6. Kapı

Her tik kapı karar verir: bilgi hafızadan geçecek mi?

**Kapalıysa (refleks yolu):** Beden doğrudan duyularla davranır, hatırlanan duyular sessizdir. Kapı şu durumlarda
kapalıdır:
- ihtiyaç yoktur (tok);
- ihtiyacı karşılayan şey görünüyordur (açım ve yemek görüyorum);
- refleks emindir (seçimde birinci ile ikinci arasındaki fark büyüktür).

**Açıksa (hafıza yolu):** İhtiyaç vardır ve duyular yetmiyordur (açım, yemek görmüyorum), ya da refleks emin değildir,
ya da sürpriz yüksektir.
- **Tek adım çağrışım:** En güçlü ve en yakın yemek hatırası, yönü ve uzaklığıyla "hatırlanan duyu" olur. Işın
  duyularıyla aynı biçimde kodlanır ve refleksin girdilerine katılır.
- **Tam tarama:** Güçlü bir hatıra yoksa ya da yol engelliyse, bütün hafıza taranır. Bu Bob'un planıdır (A5).

**Ana ölçü:** Kapı açılma oranı. Beden tanıdık odada ustalaştıkça düşmeli, oda değişince yükselmeli.

Kapının ilk sürümde hangi ölçütleri kullanacağı toplantıya gider (§15, S3).

## 7. Kural büyümesi (refleks derleme)

Kapı açıkken bir hatırlanan duyu seçimi belirlediyse ve sonuç iyi çıktıysa, o hatırlanan duyudan seçilen hareketin
Git hücresine yeni bir sinaps doğar (`edge+`). Yollar tablosu izin veriyorsa doğar; "ana bölgeye uygunsa" budur.
Sonrasında sinaps üç faktörlü öğrenmeyle güçlenir ya da zayıflar. İşe yaramayan kural zayıflar ve budanır; bozulan
refleks böyle çürür. Bu, TASARIM-007 §9'un büyüme hali; emsali Soar'daki "chunking".

Bu sinapsların doğuştan mı var olacağı (ağırlık ~0), yoksa ilk başarıda mı doğacağı toplantıya gider (§15, S1).

## 8. Harita

Harita çizilmez; doğan nöronların kendisidir. Deney Odası'nda iki şey görünür:
- beynin yemek hatırladığı yerler, güçlerine göre soluk ya da parlak noktalar olarak;
- ölen hatıranın kayboluşu.

Beyin haritası sayfasında yeni nöronlar büyüdükçe belirir.

## 9. Defter, iz ve kod sınırları

| şey | nerede durur | neden |
|---|---|---|
| konum, şu anki hatırlanan duyular, kapının durumu | çalışma hafızası (`memory/`), koşu izi | anlık durum: üzerine yazılır, deftere girmez (A1'in bekçi testi korunur) |
| hafıza nöronları, güçleri, sinapsları, yeni kurallar | beyin ağı ve defter (`learning/` altında büyüme) | yapı: öğrenmedir, yeniden oynatılır |

TASARIM-007 §4'teki "hafızanın içeriği bir durumdur, koşu izine yazılır" cümlesi uzun süreli hafıza için geçersiz.
Yalnız çalışma hafızası için geçerli kalır.

## 10. TASARIM-007'den ne kalıyor, ne değişiyor

| TASARIM-007 | bu belgeyle |
|---|---|
| K1 üç parça + öğretmen kanalı | kalır. Hafıza temel olur; Alice refleks yolu, Bob tam tarama yolu. |
| K2 çekirdek kuralları (zaman, kaynak, güven, eşik, durum ≠ anı) | kalır. Durum etkinlik, anı yapı. |
| K3 Bob v1 = planlayıcı | kalır. Izgarada değil, büyümüş hafızada arar. |
| K4 sıra | A2–A6 yeniden tanımlanır (§12). |
| K5, K6, K7, K8 | kalır. |
| H1 konum | çekirdekte kalır (+ A1b). |
| H2 ızgara (log-olasılık) | kalkar. Yerine yemek hafızası nöronları gelir (§5). |
| H3 hayal ve sürpriz | sönme kuralı ve kapının sürpriz sinyali olur. |
| §6 belirsizlik ölçer | girişteki kapıya taşınır (§6). |

## 11. Ölçüler ve kapılar

A2'de davranış değişmez; hafıza gerçek odayla notlanır:

| kapı | ölçü | eşik (öneri) |
|---|---|---|
| G1 yeniden kurma | doğum grafiği + defter (büyüme dahil) = canlı beyin | her denekte birebir |
| G2 sınırlı büyüme | odada canlı hafıza nöronu sayısı; oda değişince eski hatıraların ölümü | tavanın altında; sönme ölçülen sürede |
| G3 isabet | canlı yemek hatıralarından gerçek yemeğe 0,5 m'den yakın olanların payı | > %80 |
| G4 kapsama | son 100 tikte görülen yemeklerden hatırlananların payı | > %80 |
| G5 yanlış hatıra | yemek yendikten ya da yeri görüldükten sonra hatıranın ölmesi | < 20 tik |

A3'te davranış değişir:

| kapı | ölçü | eşik |
|---|---|---|
| G6 hafızayı kullanma | bağlı bedene ve K1n'e göre dürtü; gözden çıkan yemeğe dönüp ulaşma payı | p < 0,05 |
| G7 kapı | açılma oranı eğrisi | tanıdık odada düşer |

## 12. Yol haritası

TASARIM-007 §12'nin A2–A6'sı yeniden tanımlanır; aynı anda tek değişken (K6):

1. **A1 ✓** Konum (0,47 m). **A1b:** temas hesabı, bu belgenin onayından sonra.
2. **A2.** Büyüme altyapısı ve yemek hafızası nöronları. Büyüyen ağ, `mem` bölgesi, yol satırları, `node-` kaydı.
   Doğum, pekişme, sönme ve ölüm kuralları. Davranış değişmez; G1–G5.
3. **A3.** Kapı, hatırlanan duyular ve kural büyümesi. İlk davranış değişikliği; G6–G7. Alice'in kuralı kıyaslanır (K5).
4. **A4.** Öğretmen kanalı ve insan arayüzü (TASARIM-007 §8, aynı).
5. **A5.** Tam tarama: Bob, büyümüş hafızada planlar; refleks derleme; kapı eğrisi.
6. **A6.** Oda değişimi: yeniden öğrenme, eski hatıraların ve kuralların çürümesi.
7. **Sonra:** duvar ve tehlike hatıraları, olay hafızası (H5), anlam (H6), iki göz.

## 13. Teknik gereksinimler

- **Brain IR:** Bir `memory` düğümü yerini ve türünü taşıyabilmeli; `BrainDugumu`'na isteğe bağlı bir alan eklenir.
  Defterdeki `node+` kaydı bu alanı da taşır ve yeniden oynatılır.
- **Simülatör:** Büyüyen ağ. `BrainSimulator` ağı yalnız kurulurken dizinliyor (`nodes`, `incoming`). Düğüm ve bağlantı
  eklenip silindikçe bu dizin güncellenir. Maliyet ölçülür.
- **Defter:**
  - `node-` kaydı eklenir (nöron ölümü), yeniden oynatma testleriyle.
  - Hızlı yol (bağlantı dizini) büyümeyi de kaldırmalı; ölçülür.
- **Bölgeler:** Yeni bölge `mem.` eklenir. Yol satırları:
  - çekirdek → `mem`: doğum bağlantısı, öğrenmez;
  - `mem` → hatırlanan duyular: güç = hatıranın güveni;
  - hatırlanan duyular → Git ve Gitme: öğrenir; doğuştan mı büyüyerek mi, S1 karar verir.
- **Bekçi testler:**
  - büyüme yalnız tabloda olan bağlantıyla;
  - çalışma hafızası deftere yazmaz;
  - hafıza, dünyanın gerçeğini değil yalnız bedenin duyularını okur;
  - aynı seed aynı büyümeyi verir.

## 14. Riskler

- **Sınırsız büyüme ya da gürültüyü ezberleme.** Karşılığı: tavan, uyanıklık eşiği ve sönme kuralları; G2 ile
  ölçülür.
- **Konum hatası hatırayı kaydırır.** A1'de çok hareket eden bedenin konum hatası 1,4 m. A1b'nin temas hesabı bu
  yüzden A2'den önce gelir.
- **Defter büyür.** Tahmin: odada ~10–30 nöron. 40 eğitim odasında birkaç bin kayıt; bugün denek başına ~40 000 ağırlık
  kaydı var. Ölçülür.
- **Yavaşlık.** Büyüyen ağın maliyeti ölçülür: tik başına süre, büyümeden önce ve sonra.

## 15. Toplantıya giden sorular

1. **S1:** Hatırlanan duyulardan harekete giden sinapslar doğuştan mı var olsun (ağırlık ~0, öğrenerek güçlenir), yoksa
   ilk başarıda mı doğsun?
2. **S2:** Oda değişince eski yer hatıraları hemen mi ölsün, yavaşça mı sönsün?
3. **S3:** Kapının ilk ölçütü ne olsun?
   - (a) Yalnız "açım ve yemek görmüyorum".
   - (b) (a) + refleks emin değil.
   - (c) (b) + sürpriz.
4. **S4:** Hatıranın yeri doğduğu yerde mi sabit kalsın, yoksa her yeniden görülüşte ortalamaya mı çekilsin?
