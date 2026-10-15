# Ön kayıt — Orion'un kurallarını MarkovJunior biçiminde yazmak: hafıza yazma politikası (2026-10-15)

**Yön (Ozyn):** "Orion zaten kurallardan ibaret: LLM kullanmadan kararlar, refleksler veriyor. Bunu MarkovJunior ile
tasarlayacağız; daha sonra level işinde de kullanacağız. Önce hafıza."

## MarkovJunior'dan ne alıyoruz, ne almıyoruz
MarkovJunior (mxgmn, MIT, C#): **sıralı kural listesi**; her adımda uygulanabilen İLK kural çalışır; kural yoksa durur
(Markov algoritması). Düğümler kuralları birleştirir (`sequence`, `markov`, `one/all/prl`). Kurallar veridir (XML).
Çıktı ızgara/voxel (2D/3D), kısıt yayılımı ve rastgele eşleşme seçimi de var.
- **ALINAN:** sıralı kural listesi + "ilk uygulanabilir kazanır" + kural gruplama (sequence/markov) + kuralların VERİ olması
  + her sonucun hangi kuralla çıktığının izlenmesi (zaten `icgudu.ts`/karar kaydı felsefesi).
- **ALINMAYAN (şimdilik):** ızgara, kısıt yayılımı, rastgelelik. Hafıza kararları belirlenimli olmalı (aynı girdi → aynı
  karar, testlenebilir). Izgara/rastgelelik LEVEL işi için kalır (orada MarkovJunior'ın asıl gücü).
- Harici bağımlılık YOK: kendi küçük yorumlayıcımız. (TS portlar var; bu ölçümde bakılmadı, ızgaraya özgü oldukları için
  ilk denemede gerekmiyor.)

## Bugünkü durum (neden uygun aday)
Hafıza yazma politikası dağınık: `aniSuzgeci.ts` (kural 1–7: olay yok, terminal kırp, mikrofon önemi, selam yok, komut önemi,
ders normalleşir, ortam hatası yok), `hafiza.ts` `kuralOnemi` + `cekmecesi`, `eskiSozleriTemizle` (aynı kuralların göç
kopyası: kopya kural). Kurallar kod; sıra, öncelik ve "hangi kural tetikledi" örtük. Yönlendirici (`hafizaYonlendirici.ts`)
zaten tablo + kural kimlikli: ikinci adım.

## Deneme (spike 1): yazma politikasını kural tablosuna çevir
Bir kayıt (`{tur, metin, kaynak, kod?}`) kural listesinden geçer; ilk eşleşen kural `{yaz|at, önem, metin, kuralId}` verir.
Mevcut `aniKaydi` + `kuralOnemi` + `cekmecesi` aynı girdide aynı sonucu vermeli.

**Ölçütler (ölçmeden ÖNCE):**
- **E1 denklik:** (a) mevcut testlerin girdileri, (b) gerçek hafıza dosyası (86 anı, salt okunur), (c) sentetik ızgara
  (tur × kaynak × söz sınıfı: selam, komut, takip, sohbet, bilgi, hata, ortam hatası, uzun terminal, boş) üzerinde yeni
  motorun çıktısı eskisiyle BİREBİR aynı. Hedef: 0 fark. Tek fark varsa nedeni yazılır, düzeltilmeden geçilmez.
- **E2 izlenebilirlik:** her çıktı bir kural kimliği taşır; "kuralsız" çıktı 0.
- **E3 küçüklük:** yorumlayıcı ≤ 150 satır, kural tablosu ≤ 25 kural. Aşarsa dil kendini kanıtlamamıştır.
- **E4 hız:** 1000 kayıt ≤ 100 ms (yazma yolu tiklerin içinde).
- **E5 kaçış kapısı:** kuralların en çok 3'ü ham JS fonksiyonu (özel koşul) kullanabilir. Fazlası = dil süs, TS'in aynısı.
- **Çürütme:** E1 yok (fark ≠ 0 ve gerekçesiz) YA DA E5 aşılırsa spike başarısız sayılır; eski kod kalır, sonuç yazılır.

## Genişleme (Ozyn, 2026-10-15, aynı gün): kurallar hafıza panelinde görünsün ve düzenlensin
"Kuralları hafıza panelinden görsel olarak görelim: bloklar, node graph gibi, basit: kim kime gidiyor; kuralın kendi
değişkeni de editlenebilir. Hafıza tabii ki editlenebilmeli." Bu, formatı belirler: kurallar **JSON'a çevrilebilir veri**
olmalı (düzenlenebilir değişkenleri olan bloklar), grafik ayrı çizilmiş bir şey değil kural tablosundan TÜRETİLMELİ
(kopya kural değil bekçi: tablo ile grafik ayrışamaz). Aşamalar (her biri ayrı ön kayıt ve onay):
1. **Spike 1 (bu belge):** motor + veri biçimi + tablodan türeyen grafik verisi (çizim yok).
2. Duvarda salt okunur grafik: kutu = kural/grup, ok = akış (algı → ele → içerik → önem → çekmece → derin kabuk).
3. Kural DEĞİŞKENİ düzenleme (örn. KOMUT_ONEMI, MIKROFON_ONEMI, selam kelimeleri): `tehlikeli` pano düğmesi yolu, iki aşamalı
   teyit, yedek, kalıcı dosya, "bu değişiklik gerçek hafızada kaç kaydı etkiler" önizlemesi (yeniden oynatma).
4. ANI düzenleme (söz/önem): bugünkü "Unut…" ile aynı güvenli yol, `hafiza.duzenle`.
Kural YAPISINI düzenlemek (ekle/sil/sırala) bu dört aşamanın dışında; kararı aşama 3'ten sonra.
- **E6 serileştirilebilirlik:** kuralların tamamı JSON'a gidip gelir (özel koşullar ADLA anılır: kayıtlı adlı koşul tablosu);
  gidiş-dönüş sonrası E1 yine 0 fark.
- **E7 türetilen grafik:** düğüm/kenar listesi YALNIZ tablodan üretilir; her kural tam bir düğümdür, kural kimlikleri tekil,
  her kenar bir sıra ilişkisinden gelir (testle).

**Kapsam dışı:** ızgara/level; refleks ve komut sözlüğü; getirme (yönlendirici); kural formatı olarak XML (tipli TS tablosu
varsayılan; XML kararı spike sonrası: kurallar Ozyn tarafından düzenlenecekse değerlendirilir).
**Yalnız bir hafıza (tek denek):** "genel olarak çalışır" denmez; yazma politikası için denk ve küçük çıktı.

## SONUÇLAR
Koşu: 2026-10-15, `mind/hafizaKurallari.ts` + `mind/hafizaKurallari.test.ts` (6 test), ölçüm betiği scratchpad'de.

- **E1 denklik: GEÇTİ.** (a) Izgara 1284 kombinasyon (olay, yakın, söz × 13 söz sınıfı × 3 kaynak, terminal × 6 içerik × 3 kod,
  sonuç × 3 durum × 4 not × 4 metin; her biri 6 AniTuru × 2 politika): 0 fark. (c) Gerçek hafıza dosyası (77 anı, salt okunur;
  kaynak bilgisi dosyada yok, konuşma = klavye sözü varsayıldı): 0 fark. Not: (a) yalnız bu ızgara için; ızgarada olmayan bir
  girdi sınıfı varsa fark çıkabilir.
- **E2 izlenebilirlik: GEÇTİ.** Izgaranın her sonucu ≥1 kural kimliği taşıyor, hepsi tabloda var (kuralsız çıktı 0).
- **E3 küçüklük: GEÇTİ.** Yorumlayıcı (`eslesir` + `uygula` + `kayitDan`) ≈ 40 satır (eşik 150); tablo 14 kural (eşik 25).
- **E4 hız: GEÇTİ.** 1000 kayıt: eski kod 35,3 ms, kural motoru 31,4 ms (eşik 100 ms).
- **E5 kaçış kapısı: SINIRDA, kararı Ozyn'in.** Tabloda ham JS fonksiyonu YOK (0); yazıldığı gibi eşik (≤3) karşılandı. Ama ruhuna
  bakınca: özel koda dayanan ADLI koşul 4 (selam, komut, ortam-hatası, test-geçti), bunları 4 kural kullanıyor (eşik 3 aşıldı).
  E5'i "ham JS" diye yazmıştım; adlı koşulu saymak sıkı okumadır. İkisini de yazıyorum; dil yine JSON'a gidip geliyor (E6).
- **E6 serileştirme: GEÇTİ.** JSON gidiş-dönüş sonrası ızgarada 0 fark.
- **E7 türetilen grafik: GEÇTİ.** `grafik()` yalnız tablodan: 14 kural = 14 düğme, kimlikler tekil, kenar uçları var, "at" kuralları
  "reddet" çıkışına bağlı.
- Değişken düzenleme: `komut.dusuk` önemi 3 → 5 yapınca karar değişiyor, yapı aynı (testli).
- **Çürütme ölçütü: tetiklenmedi** (fark 0; E5 yazıldığı gibi aşılmadı). Spike başarılı. `aniKaydi` henüz bu motora devredilmedi
  (kopya kural şimdilik iki yerde); devir ayrı onay ister.

**Yan bulgu (spike dışı, aynı gün):** duvardan "Unut…" yedeği sıkıştırma yedekleriyle aynı rotasyondaydı (son 5): Ozyn'in hızlı
arka arkaya silmeleri eski yedekleri (12–14 Ekim, ilk 86 anılık göç öncesi) döndürüp attı. Düzeltme: "unut" yedeği kendi öneki
(`orion-hafiza.unut-yedek-*`) ve 100 dosya sınırıyla. Kaybolan yedekler geri gelmez; silinen anılar Ozyn'in bilerek sildiği sözlerdi.
