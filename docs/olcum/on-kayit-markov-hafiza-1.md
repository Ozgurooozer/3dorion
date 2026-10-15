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

**Kapsam dışı:** ızgara/level; refleks ve komut sözlüğü; getirme (yönlendirici); kural formatı olarak XML (tipli TS tablosu
varsayılan; XML kararı spike sonrası: kurallar Ozyn tarafından düzenlenecekse değerlendirilir).
**Yalnız bir hafıza (tek denek):** "genel olarak çalışır" denmez; yazma politikası için denk ve küçük çıktı.

## SONUÇLAR
(deneme koşulduktan sonra doldurulur)
