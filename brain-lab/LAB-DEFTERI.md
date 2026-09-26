# Laboratuvar Defteri — brain-lab

Tarihli, sadece eklenen kayıt. Her giriş: ne yapıldı, ne ölçüldü, ne bilinmiyor.
Olumsuz sonuçlar da yazılır. Etiketler: `[ÖLÇÜLDÜ]` canlı ölçüm, `[TEST]` birim testi,
`[VARSAYIM]` henüz doğrulanmadı.

---

## 2026-09-22 — Başlangıç ve yön

- Amaç (Ozyn): basit kararlar veren, kendi ekosistemi olan, sabit ve dinamik değişkenlerle
  çevrili, zamanla öğrenip gelişen bir karar mekanizması — beyin haritası olarak.
- Brain IR v0.2 ve v0.3 brain-lab altına taşındı; tip kapısı yeşil. `[TEST]` 715/715.
- Ölçek ölçümü: mevcut simülatör saat güdümlü; nedensel iz yüzünden düğüm sayısıyla
  ~O(N²) büyüyor, 20 Hz sınırı ~3200–4500 düğüm. `[ÖLÇÜLDÜ]` (bilgi havuzu §9)

## 2026-09-23 — Yön düzeltmesi

- Üç farklı MVP paradigması önerildi (vault beyin0fis toplantısı) — **geri çekildi**.
  Ozyn: yeni mimari icat etme, mevcut v0.1 → v0.2 → v0.3 çizgisini izle. Toplantı sayfası
  "GEÇERSİZ" olarak işaretlendi. Ders: önce mevcut plan ve belgeler okunur.

## 2026-09-23 — Dünya (commit 7da324c)

- Tek oda, başsız (headless), deterministik fizik: itme/dönme motor komutları, sürtünme,
  duvar çarpışması, enerji/sağlık, yemek, tehlike. Babylon yerine kendi fiziğimiz —
  gerekçe: bit-aynı replay ve binlerce hızlı bölüm.
- `[TEST]` 23 test; 16 bilinçli bozma (mutasyon) testlerce yakalandı.
- `[ÖLÇÜLDÜ]` ~1,9 milyon tik/sn başsız.

## 2026-09-23 — Duyu-motor köprüsü (commit 2ae1bb7)

- 18 sensör (ışın×tür, çarpma, açlık, yara), 4 motor (antagonist çiftler), bağlantısız iskelet.
- `[ÖLÇÜLDÜ]` Boş beyin kıpırdamıyor, 2001. tikte açlıktan ölüyor (taban çizgisi).
  Elle çizilmiş tek test yayı (fikstür) yemeğe 22. tikte ulaşıyor.
- `[ÖLÇÜLDÜ]` İletim gecikmesi: doğrudan yay 1 tik, ara nöronlu 2 tik.
- Bilinen kestirme (Ozyn notu): ışınlar "tehlike" etiketini hazır veriyor. Hedef: nötr
  duyu, tehlikenin doğuştan acı sinyalinden öğrenilmesi.

## 2026-09-23 — Görsel laboratuvar (commit d49267f)

- `npm run lab`: oda, beyin haritası, zaman şeridi, trace incelemesi. Gerçek kodu çalıştırıyor.
- `[ÖLÇÜLDÜ]` Görseldeki dünya hash'i aynı seed'le Node'daki koşuyla birebir aynı (2 durum).

## 2026-09-23 — Dopamin sinyali (commit da4e3e5)

- δ = sonuç − tahmin; sonuç sadece bedenin kendi duyusundan (enerji + sağlık değişimi);
  tahmin şimdilik durumsuz koşan ortalama.
- `[TEST]` Dopaminin bilinen imzaları görüldü: dinlenmede alışma, ilk yemekte büyük artı,
  düzenli yemekte küçülen tepe ve kaçan yemekte eksi, süren acıda sönen eksi, acı kesilince
  rahatlama artısı. 9 mutasyonun 9'u yakalandı.
- `[ÖLÇÜLDÜ]` Görselde seed 3: yemek tok bedende yendiği için küçük tepe — tokluk etkisi.
- Bilinmeyen: durumsuz tahmin gecikmeli ödülü köprüleyebilecek mi? Öğrenme deneyi gösterecek.

## 2026-09-23 — Faz 0: bakım (commit 73507f0)

- Dopamin commit'lendi ve dal GitHub'a gönderildi (tek kopya riski kapandı).
- Vault'taki 3-MVP toplantısı ve görev panosu "GEÇERSİZ" olarak işaretlendi; tarihçe korunuyor.
- Bu defter ve `CLAUDE.md` açıldı; denek kayıtları git dışında, ön-kayıt dosyaları git içinde.

## 2026-09-23 — Faz 1: denek kayıt sistemi (`registry/`)

- Kimlik: `DNK-0001 «Kıvılcım»` — numara asıl kimlik, ad insanlar için; numara asla
  yeniden kullanılmaz. Kategori, grup (reflekssiz/refleksli), soy (doğum/klon), doğum
  (seed, tarih, dünya ayarı, doğum grafiğinin hash'i), evre (E0 doğum … E4 kararlı).
- Öğrenme defteri: her değişiklik numaralı `LRN-…`; türler: ağırlık, yeni nöron, yeni
  bağlantı, budama, parametre, evre geçişi. Defter bir zincir: her kayıt bulduğu ve
  bıraktığı değeri yazar; doğum grafiği + defter canlı beyni bit-aynı üretmeli.
- `[TEST]` 16 test. Diskte elle değiştirilen değer, silinen satır, değiştirilen doğum
  grafiği ve evre hepsi yakalanıyor; kayıt dışı öğrenme `matches()` ile görünür oluyor.
  13 bilinçli bozmanın 13'ü yakalandı (ilk turda 2 kaçtı, testler eklendi).
- Bulgu: eski bir defter kopyası diskteki kadar kayda sahip ama farklı içerikteyse, ilk
  sürüm bunu "zaten kaydedilmiş" sanıyordu — düzeltildi; artık "tarih ayrışıyor" hatası verir.
- Karar: dünya olayları `EVT-…` ile numaralanıyor, `OLY-` değil; brain-ir'deki olay defteri
  Orion'un olay türlerine bağlı.
- FNV hash tek dosyaya (`world/hash.ts`) taşındı; dört seed'in hash'i taşıma öncesiyle aynı. `[ÖLÇÜLDÜ]`

## 2026-09-23 — Faz 2: beden ve sinyal ön koşulları

- **Hareket duyusu:** gözleme bedenin kendi hareketi eklendi (ileri hız, dönüş); 4 yeni
  sensör, karşıt çiftler (`proprio.forward/backward/left/right`). Sensör sayısı 18 → 22.
- **Ölüm sinyali:** bölüm ölümle bitince dopamin kanalı doğuştan −1 sonuç hisseder;
  tahmin bundan öğrenmez (ölüm "genelde olan" değil). `[TEST]` ölüm δ < −0,9, bir kez gelir.
- **Açlığa göre değer:** enerji değişiminin değeri 1 + (1 − enerji) ile ölçeklenir.
  `[TEST]` aynı yemek aç bedende 0,54, tok bedende 0,42.
- **Kendiliğinden hareket:** her motor için bir üreteç düğümü (`spont.*`), patlamalı
  rastgele ateşleme (varsayılan açılma 0,03, kapanma 0,12 / tik). Beynin içinde durduğu
  için trace "sol motor, kendiliğinden sol yüzünden ateşledi" diyebiliyor.
- **Doğum:** tüm sinirler + üreteçler + zayıf rastgele bağlantılar (yoğunluk 0,15, |w| ≤ 0,3,
  eşik 0,5'in altında). Refleksli grup ayrıca iki doğuştan refleksle doğar — sadece beden
  duyusuna dayalı: çarpınca sola dön, yaralanınca ileri kaç.
- `[ÖLÇÜLDÜ]` Kendiliğinden hareket kapalıyken zayıf doğum bağlantıları motorları hiç
  ateşlemedi (%0 tik), 20 yenidoğanın 0'ı yer değiştirdi → doğum bağlantısı davranış değil.
  Açıkken 20'nin 19'u yer değiştirdi, toplam 781 duvar teması → deneyim buradan geliyor.
- Mutasyon: gelişim 8/8, dopamin eklemeleri 5/5 yakalandı (ilk turda "seed'siz doğum"
  kaçtı: grafın adı seed içerdiği için hash farklıydı; test bağlantıları karşılaştıracak şekilde düzeltildi).
- **Süreç hatası (dürüst kayıt):** bir bozma testini geri alırken commit edilmemiş bir
  dosyada `git checkout` kullanıldı ve yeni ölüm kancası silindi. Testler düştüğü için hemen
  fark edildi ve yeniden yazıldı. Kural eklendi: bozma testinde dokunulan her dosya yedeklenir.
- Görsel: iki yenidoğan ön ayarı (reflekssiz / refleksli), "kendiliğinden" sütunu, ölüm dopamine iletiliyor.

## 2026-09-23 — Dönüş: bölgeli beyin tasarımı (kod yok)

- Ön-kayıt 001 taslağı **hiç koşulmadan geri çekildi.** Ozyn: "hâlâ bir şeyleri yanlış
  yapıyoruz — açlık bir aksiyon gerektiğini söylemeli, hangisi olduğunu beyin öğrenmeli."
- Faz 2 ölçümünün yeniden yorumu: "hareket kapalıyken 0/20 kıpırdadı" iyi haber değil;
  beynin içinde hareketi başlatan hiçbir şey olmadığını gösteriyor. Kendiliğinden hareket
  durumdan bağımsızdı; gerçek bebekte aç olan kıpırdar, tok olan uyur.
- Tespit edilen diğer tuhaflıklar: hareket seçimi yok (karşıt motorlar aynı anda ateşliyor),
  düz sensör→motor yapısı (kredi atama yok), tok doğum (bebek aç doğar), kavram karışıklığı.
- İlke: yapıyı doğa verir, ağırlıkları deneyim belirler.
- Tasarım: `TASARIM-BOLGELI-BEYIN.md` — hipotalamus (dürtü), dopamin (tonik + fazik),
  örüntü üreteci, bazal ganglion Git/Gitme (tek öğrenen yol), yollar tablosu, homeostatik ödül.
- Altı kaynak internetten doğrulandı (Betley 2015, Chen 2015, Nature 2021, Niv 2007,
  Keramati & Gutkin 2014, Frank 2005). Önceki "hafızadan" iddialar belgeye doğrulanmadan girmedi.
- Ders: deney tasarlamadan önce pilot; kontrol koşulu motivasyonu kesmemeli.

## 2026-09-24 — Bölgeli beyin, Adım 1: bölgeler ve yollar tablosu (`regions/`)

- Tasarım onaylandı (Ozyn: "devam"; açık sorular varsayılanlarla kapandı).
- Her düğüm bir bölgeye ait (duyu, hyp, cpg.noise, cpg, bg.go, bg.nogo, bg.out, motor) ve
  bölge düğüm tipini belirler. 11 satırlık yollar tablosu, her satır gerekçesiyle; tabloda
  olmayan her kenar adıyla reddedilir. Öğrenen yollar sadece duyu → bg.go / bg.nogo (P1, P2).
- `[TEST]` Eski düz beyin (ışın2.yemek → ileri motoru) artık reddediliyor; "görme doğrudan
  üreteci komuta eder" veya "seçimi atlar" gibi amaç biçimli kısayollar da. 8/8 mutasyon yakalandı.

## 2026-09-24 — Bölgeli beyin, Adım 2–4: dürtü, hareket seçimi, aç doğum

- Doğum artık bölgeli: 22 duyu, açlık/acı dürtüsü, eylem başına gürültü + üreteç + Git +
  Gitme + seçim, 4 motor (48 düğüm, 210 bağlantı). Öğrenen yollar (duyu → Git/Gitme, 176
  kenar) tam bağlı, [0; 0,05] zayıf rastgele. Her doğuştan ağırlık gerekçesiyle `INNATE`'te.
- Gürültü: zamanla ilişkili ("renkli"), sonra yayılımı düzgün dağılıma geri çekilmiş —
  aksi halde dürtü kademeli bir sıklık değil, açık/kapalı bir eşik olurdu.
- Dünya: `initialEnergy` ayarı (varsayılan 1; deneyler 0,4 = aç doğum).
- `[ÖLÇÜLDÜ]` Tok beden (açlık ≤ 0,1) hiç kıpırdamıyor. Üreteç ateşlemesi açlık 0,2 / 0,3 /
  0,4 / 0,6'da %1,8 / %7,5 / %13,3 / %38,4 (8 seed) — açlık "bir şey yap" diyor, ne yapılacağını değil.
- `[ÖLÇÜLDÜ]` Karşıt hareketlerin aynı anda motora ulaşması: bastırma −0,5 ile %2,7 (hedef %1'in
  üstü). Tarama sonrası bastırma −1 + Git kalıcılığı 0,5: %0,53; motor deseni titremesi tik başına
  %58 → %29. Seçim bu değerlerle sabitlendi.
- `[ÖLÇÜLDÜ]` Görselde seed 2: aç yenidoğan ~30. tikte tesadüfen yiyor; doyunca motor ateşlemesi
  seyreliyor (tok beden sakinleşiyor) — tasarımın öngördüğü davranış, kodlanmadan ortaya çıktı.
- Trace bir hareketi uçtan uca açıklıyor: motor ← seçim ← Git ← üreteç ← gürültü + açlık dürtüsü ← iç duyu.
- Mutasyon: 9 denemenin 8'i gerçekten yakalandı. "Doğum grafiği bölge kontrolünden geçmiyor"
  mutasyonu **yakalanmıyor** — kontrol yalnızca doğum kodu ileride yanlış düzenlenirse çalışan bir
  emniyet; kontrolün kendisi `regions` testlerinde doğrulanıyor. İlk turda bu mutasyon yanlışlıkla
  "yakalandı" göründü; tek başına iki kez tekrarında yakalanmadı, sebebi bulunamadı. Testler 4
  koşuda birebir aynı (dengesizlik yok).
- Süreç: ters eğik çizgi kaybı bir kez daha yaşandı (betikle yazılan düzenli ifadeler); test yakaladı,
  Edit aracıyla düzeltildi. Kural hatırlatması: düzenli ifade içeren düzenlemeler betikle yapılmaz.
- Görsel: bölge sütunları (duyu | dürtü | gürültü | üreteç | git | gitme | seçim | motor), eylem
  başına satır; eski düz "boru testi" ön ayarı kaldırıldı (artık yollar tablosunca yasak).

## 2026-09-24 — Bölgeli beyin, Adım 5: homeostatik ödül

- Ödül artık dürtünün azalması (Keramati & Gutkin 2014): D = açlık² + acı², r = D(önce) − D(sonra).
  Hedef değerdeki (tok, sağlam) beden küçük değişimleri neredeyse hiç hissetmez; hedeften
  uzaklaştıkça aynı değişim daha çok hissedilir. Eski "1 + açlık" ölçeklemesinin yerine geçti.
- Her dopamin sinyali artık o anki dürtüyü (tonik seviye) de taşıyor; görsel gösteriyor.
- **Düzeltme (dürüst kayıt):** 2026-09-23 girişindeki "düzenli yemekte küçülen tepe" imzası
  **yanlış yorumlanmıştı.** O senaryoda enerji 0,96'ya çıkıyor, beden doyuyordu; tepenin küçülmesi
  tokluktandı, beklentiden değil. Dengeli bir yemek düzeninde sürpriz hiç küçülmüyor (0,056 → 0,055)
  `[ÖLÇÜLDÜ]`. Sonuç: durumsuz tahmin düzenli bir ödülü önceden bekleyemez. Bu, durum-bağımlı
  tahminin (tasarım §6, ikinci sürüm) neden gerekli olduğunun ölçülmüş gerekçesi. Test artık bu
  sınırlılığı belgeliyor.
- Değişen imza: karesel dürtüde süren yaralanma "alışılan" bir acı değil, her tik biraz daha
  kötüleşen bir acı. Eski "acıya alışma" testi yeni modelin öngörüsüne göre değiştirildi.
- Mutasyon 7/7 yakalandı.

## 2026-09-24 — Bölgeli beyin, Adım 6: öğrenme kuralı (`learning/`)

- Üç faktör (Frank 2005): kenar başına uygunluk izi e ← λe + önceki·şimdiki; Git kenarı +ηδe,
  Gitme kenarı −ηδe; sadece yollar tablosunda "öğrenir" olan 176 kenar. Tik içi sıra: dopamin →
  ağırlık → beyin adımı → uygunluk izi. Ölüm de öğretir (ölüm kancası).
- Ağırlıklar 0,001'lik kuantumlarla değişir; her kuantum bir LRN satırı. Kuantumun altı hiç uygulanmaz.
- Evreler kendiliğinden: ilk tik E1, ilk ağırlık değişimi E2 — deftere yazılı.
- `[TEST]` Uzun yaşamdan sonra doğum + defter = canlı beyin; doğuştan kenarlar hiç değişmiyor;
  donuk kardeş aynı hayatı yaşıyor ama beyni değişmiyor; aynı denek → birebir aynı defter.
- `[ÖLÇÜLDÜ]` 4 aç bölümde 5.278 ağırlık kaydı → defter büyük olabilir; pilotta bölüm sayısı buna göre seçilecek.
- Mutasyon: 11 denemenin ilk turda 10'u yakalandı. Kaçan: "yaşarken dopamin hiç uygulanmıyor" —
  ölüm anındaki öğrenme testi tatmin ediyordu. Test artık yaşarken öğrenme de arıyor; 11/11.

## 2026-09-24 — Pilot 001: koşmadan önce verilen kararlar (keşif)

- Soru: aç doğan bölgeli beyin yemeğe yönelmeyi öğreniyor mu? Keşif; iddia değil. Sadece ayar
  seed'leri (1–10); test seed'lerine (1001+) dokunulmuyor.
- `[ÖLÇÜLDÜ]` İlk ölçüm: 3 yemekli odada donuk yenidoğan 20 bölümde 1 yemek yedi — ödül öğrenmeye
  yetmeyecek kadar seyrek. Yemek yoğunluğu donuk yenidoğanlarla (5 seed × 10 bölüm) ölçüldü:
  3 → 0,70 öğün/bölüm (%64 hiç yok), 6 → 1,84 (%42), **10 → 3,22 (%24)**, 15 → 4,98 (%6), 20 → 6,50 (%4).
  **10 yemek seçildi**: ödül arada bir, tavana uzak. Seçimde hiçbir öğrenen denek görülmedi.
- Kuantum 0,005 (0,001'e göre defter 10 kat küçük; 20 bölümde 5.681 → 577 satır).
- Ölçü: **yönelim** — yemek görüş alanındayken hareketin ona doğru olma oranı; hareket t,
  görüntü t−3 ile karşılaştırılır (duyu → Git → seçim → motor = 3 tik gecikme).
- Aşama A (ayar): seed 1–3 × iki grup × η {0,05; 0,1; 0,2} × λ {0,8; 0,9; 0,95}; 30 eğitim + 10
  değerlendirme bölümü. Seçim kuralı: 6 hücrede (öğrenen − donuk kardeş) yönelim farkının medyanı en büyük olan.
- Aşama B (pilot): seed 4–10 × iki grup, seçilen η, λ; 60 eğitim + 20 değerlendirme bölümü.
- Değerlendirmede öğrenme kapalı; öğrenen ve kardeşi aynı dünyalarda, aynı gürültüyle.
- Her denek kayıt sisteminde (DNK-…); kardeş, öğrenenin doğumundan klon.

## 2026-09-24 — Pilot 001 sonucu: OLUMSUZ — beyin "hareket etmemeyi" öğrendi

Kod `a171a1b`, 339 sn, 88 denek (DNK-0001…0088; ad listesi bitti, adlar "… 2" ile devam etti).
Veri: `brain-lab/data/pilot-001-summary.json` ve RUN kayıtları (git dışı).

- `[ÖLÇÜLDÜ]` Aşama A: 9 η×λ kombinasyonunun **hepsinde** öğrenen, donuk kardeşinden kötü; seçilen
  (η 0,05, λ 0,8) bile medyan yönelim farkı −0,19.
- `[ÖLÇÜLDÜ]` Aşama B (seed 4–10, 14 çift): öğrenenlerin **28'inin 28'i** değerlendirmede 0 yemek,
  yönelim 0,000. Donuk kardeşler 2,65–3,80 yemek/bölüm, yönelim 0,14–0,20. Eğitimde öğrenenler ilk
  10 bölüm 1,7–4,1 yemek, son 10 bölüm 0. Reflekssiz ve refleksli grup aynı.
- `[ÖLÇÜLDÜ]` Mekanizma (3 öğrenenin defterinden): Gitme ağırlıkları ortalama ~0,027 → 0,86–0,95
  (~35 kat); Git ağırlıkları 0,027 → 0,016. Ağırlık değişimlerinin ~3,5 katı eksi dopaminden; ~%10'u ölüm anında.
- **Yorum (hipotez, henüz sınanmadı):**
  1. Aç bir bedende dürtü her tik artıyor → sonuç neredeyse hep eksi; karesel dürtüde kötüleşme
     hızlandığı için durumsuz beklenti geride kalıyor → dopamin sistematik olarak eksi.
  2. Gitme öğrenmesi "eksi dopamin + o an aktif her duyu" ile büyüyor. Duvarlar hep görünüyor,
     açlık duyusu hep açık → neredeyse her Gitme kenarı büyüyor. En ironik olanı açlık → Gitme:
     beyin "açken hareket etme"yi öğreniyor, dürtünün tam tersi.
  3. Ölüm (−1) son anlarda aktif olan Gitme kenarlarını ayrıca büyütüyor.
- **Ne öğrendik:** üç faktörlü kural bu haliyle, sürekli eksi bir ortamda "harekete ceza"yı seyrek
  ödülden çok daha hızlı öğreniyor. Durumsuz tahminin sınırlılığı (Adım 5'teki düzeltme) burada
  ölçülebilir bir başarısızlığa dönüştü.
- Aday çözümler (ayrı onayla, tek tek sınanmalı): durum-bağımlı değer tahmini (eleştirmen/critic,
  δ = r + γV(s′) − V(s)) — sistematik eksi yanlılığı kaldırmanın standart yolu; iç duyuların
  (açlık, hareket) öğrenen yollardan çıkarılması; Gitme için dengeleyici sönüm.
- Bu olumsuz sonuç yayımlanır; ön-kayıt yazılmadan önce mekanizma düzeltilmeli.

## 2026-09-24 — Pilot 001b: tanı deneyleri — koşmadan önce (keşif)

Ozyn: "sonuçları daha derin incele, ekstra deneyler yap, emin ol." Pilot 001'deki mekanizma
hipotezi parça parça sınanıyor. Sadece ayar seed'leri (4–10); hiçbir koşul seçilmiyor, hepsi raporlanıyor.
- Bölüm 1 (gözlem): donuk yenidoğanda dopamin sistematik olarak eksi mi; hareketten hemen sonra
  (t+1) daha mı eksi? Bu, öğrenmeyen geçici beyinlerle ölçülüyor (kayda girmiyor — hiç öğrenmedikleri için).
- Bölüm 2: pilot 001 defterlerinde hangi Git/Gitme kenarları büyüdü — duyu türüne göre.
- Bölüm 3: rastgele (ayrık) politikanın yönelimi — kardeşlerin 0,17'si şans düzeyine göre ne?
- Bölüm 4 (bozma deneyleri), η 0,05, λ 0,8, 30 eğitim + 10 değerlendirme, aynı donuk kardeşlerle:
  A0 tam kural (tekrar) · A1 Gitme öğrenmesi yok · A2 ölüm öğretmiyor · A3 iç duyu/hareket duyusu
  öğrenen yolda değil · A4 sadece dopamin artışı öğretiyor · A5 = A1 + A3.
- Öngörüler (hipotez doğruysa): Bölüm 1'de ortalama δ < 0 ve hareket sonrası δ < dinlenme sonrası δ;
  Bölüm 2'de en çok büyüyen Gitme kenarları hep-açık duyulardan (duvar, açlık); A1, A4, A5'te çöküş
  kaybolur; A2 tek başına çöküşü önlemez; A3 kısmen iyileştirir.
- Ablasyon anahtarları öğrenme kuralına eklendi (varsayılanları tam kural); her anahtarın sadece kendi
  mekanizmasını kaldırdığı testle doğrulandı.

## 2026-09-24 — Pilot 001b sonucu: sebep ölüm sinyalinin büyüklüğü; ilk olumlu sonuç Git-yalnız

Kod `389c10a`, 176 sn. Veri `data/pilot-001b-summary.json`.
- `[ÖLÇÜLDÜ]` Bölüm 1 (donuk yenidoğan, 86.458 tik): ortalama δ ≈ 0 (−0,000004); tiklerin %66'sı eksi
  ama küçük, yemeklerdeki büyük artılar dengeliyor. Hareket sonrası ortalama δ **artı** (+0,00023),
  dinlenme sonrası eksi (−0,0003) — yemek hep hareketten sonra geliyor. **"Dopamin sistematik eksi" ve
  "hareket cezalandırılıyor" hipotezleri çürüdü.**
- `[ÖLÇÜLDÜ]` Bölüm 2: en çok büyüyen Gitme kenarları açlık (+1,98) ve **yemek görme** ışınları (+1,8–1,96).
- `[ÖLÇÜLDÜ]` Bölüm 3: rastgele ayrık politikanın yönelimi 0,286 — kardeşlerin 0,176'sı şansın altında
  (çoğu zaman durdukları için).
- `[ÖLÇÜLDÜ]` Bölüm 4 (7 çift, kardeş: 1236 tik, 2,51 yemek, 2,02 yemek/1000 tik, %44 durgun):

  | koşul | yaşam (tik) | yemek | yemek/1000 tik | yönelim | durgun |
  |---|---|---|---|---|---|
  | A0 tam kural | 808 | 0,01 | 0,02 | 0,000 | %100 |
  | A1 Gitme yok | **1970** | **5,61** | **2,83** | 0,194 | %58 |
  | A2 ölüm öğretmiyor | 288 | 0,10 | 0,33 | 0,376 | %0 |
  | A3 iç duyu yok | 911 | 0,43 | 0,41 | 0,041 | %90 |
  | A4 sadece artış | 287 | 0,10 | 0,34 | 0,396 | %0 |
  | A5 A1+A3 | 939 | 2,17 | 2,06 | 0,255 | %33 |

- `[ÖLÇÜLDÜ]` A0'da yemek-ışını → Gitme büyümesinin +131,8'i **ölüm anından**, yaşarken +3,4 (−8,6 azalma).
  Ölüm δ'sı −1, yaşam sinyalleri 10⁻⁴…0,3 — yaklaşık 3–4 mertebe büyük. Ölüm anında beden sık sık yemeğe
  bakarken donmuş olduğu için "yemek görünce dur" öğreniliyor: kendini besleyen bir döngü.
- **Yeni hipotez:** çöküşün sebebi ölüm sinyalinin öteki sinyallere göre ölçeği (ve onu büyüten Gitme yolu).
  Ceza hiç olmayınca (A2, A4) Git sınırsız büyüyor → hiperaktivite → hızlı açlık ölümü. İkisi de dengesizlik.
- **İlk olumlu (keşif) sonuç:** A1 (sadece Git öğreniyor, ölüm Git'i freni gibi zayıflatıyor) 7 çiftin 7'sinde
  kardeşten çok yedi; daha uzun yaşıyor ve daha verimli. A5 < A1 → iç duyuların Git yolunda olması işe yarıyor.
- **Öngörü puanlaması (dürüst):** A1 ✓. A5 kısmen (çökmedi ama kardeşi geçmedi). A2 ✗ ("tek başına önlemez"
  demiştim — donmayı önledi ama hiperaktiviteyle başka türlü çöktü). A4 ✗ yarım (donma kalktı, hiperaktivite geldi).
  A3 ✓ (iyileştirmedi).
- **Ölçü dersi:** yönelim tek başına yanıltıcı — sürekli dönen beden şansın üstünde puan alıp yemek yiyemiyor.
  Yemek/1000 tik ve yaklaşma ölçüsü eklenmeli.

## 2026-09-24 — Pilot 001c: doğrulama — koşmadan önce (keşif)

- S1 (nedensel sınama): tam kural (Git + Gitme) ölüm değeri −1 / −0,1 / −0,01 ile (C0–C2), seed 4–10 reflekssiz.
  **Öngörü:** hipotez doğruysa −0,1 ve −0,01'de donma (%100 durgun) kaybolur.
- S2 (tekrar): Git-yalnız, yeni hücrelerde — C3 seed 1–3 reflekssiz, C4 seed 4–10 refleksli.
  **Öngörü:** Git-yalnız, kardeşini yemek/1000 tikte hücrelerin çoğunda (≥ 6/7, ≥ 2/3) geçer.
- Yeni ölçü: yaklaşma (yemek iki ardışık tikte görünürken en yakın yemeğe mesafe azaldı mı) — yerinde
  dönmek sayılmaz. Birincil ölçü artık yemek/1000 tik; yönelim ikincil.
- η 0,05, λ 0,8, 30 eğitim + 10 değerlendirme, donuk kardeşlere karşı. Ölüm değeri ajana ayar olarak eklendi.

## 2026-09-24 — Pilot 001c sonucu: ölçek hipotezi nedensel olarak doğrulandı; Git-yalnız tekrarlandı

Kod `9a8198e`, 136 sn. Veri `data/pilot-001c-summary.json`. (Not: `e21ab10` tip hatasıyla commit'lenmişti;
hiçbir şey onunla koşulmadı, düzeltmesi `9a8198e`.)

| koşul | yaşam (öğr./kardeş) | yemek/1000 tik | önde | yaklaşma | durgun |
|---|---|---|---|---|---|
| C0 tam kural, ölüm −1 | 808 / 1236 | 0,02 / 2,02 | 0/7 | 0,022 / 0,541 | %100 / %44 |
| C1 tam kural, ölüm −0,1 | 640 / 1236 | 1,86 / 2,02 | 4/7 | 0,592 / 0,541 | %18 / %44 |
| C2 tam kural, ölüm −0,01 | 371 / 1236 | 0,85 / 2,02 | 1/7 | 0,535 / 0,541 | %5 / %44 |
| C3 Git-yalnız, seed 1–3 | 1907 / 1118 | 2,83 / 2,05 | 3/3 | 0,606 / 0,495 | %61 / %42 |
| C4 Git-yalnız, refleksli | 1381 / 1456 | 2,53 / 2,14 | 5/7 | 0,609 / 0,528 | %43 / %42 |

- **Tekrarlanabilirlik:** C0, 001b'deki A0'ı birebir tekrarladı (808 tik, %100 durgun).
- **Nedensel sonuç:** tam kuralda ölüm değeri tek başına davranışı bir uçtan öbürüne taşıyor: −1 donma,
  −0,1 kardeşe yakın, −0,01 aşırı hareketlilik (kısa yaşam). Öngörü "donma kaybolur" ✓. Ama tam kural
  denenen hiçbir değerde kardeşi net geçmedi → Git/Gitme dengesi bu haliyle kararsız.
- **Git-yalnız:** 001b + 001c birlikte **17 çiftin 15'inde** kardeşten verimli (yemek/1000 tik);
  keşif amaçlı işaret testi p ≈ 0,001. Yaklaşma üç Git-yalnız koşulun üçünde de yüksek → avantaj
  sadece uzun yaşamdan değil, yemeğe gerçekten yaklaşmaktan. Öngörüler: C3 ✓, C4 ✗ (5/7, ≥ 6/7 demiştim).
- **Sınırlar (dürüst):** hepsi ayar seed'leri, 30 eğitim bölümü, tek ortam, tehlike yok; keşif — iddia değil.
  Git-yalnızda ölüm hâlâ büyük bir fren (−1); frenin biyolojik karşılığı açık bir soru (ölü hayvan
  öğrenmez; gerçekte fren acı/yorgunluk olabilir).

## 2026-09-24 — Seri 002: mekanizmalar (kod) ve literatür

Ozyn: "önerini dene, toplantı yap, ekstra testler; bu aşama başlangıç — tüm hipotezleri sor, test et."
- **Yeni şüphe (kod okumasından):** Git/Gitme nöronları, hareketleri seçilmese de duyulardan aktif;
  eski kural bu yüzden seçilmemiş eylemleri de ödüllendiriyor/cezalandırıyordu.
- **Literatür taraması** (Sonnet alt ajanı, Ozyn isteğiyle; kaynaklar toplantıdan önce ayrıca doğrulanacak):
  donma, Frank 2005'in Parkinson modelindeki Gitme-baskın hareketsizlik rejimiyle yapısal olarak aynı;
  seçime bağlı öğrenmenin yayımlanmış bir karşılığı var (2025 Sci Rep — kolinerjik kanal geçidi,
  kanallar arası karışmayı önlüyor); OpAL* (Jaskir & Frank 2023) aynı model ailesinde Git/Gitme'nin
  sıfıra çökme/kaçma kararsızlığını dopamin ölçeklemesiyle çözmüş; genel RL literatürü tek büyük
  terminal cezaya karşı uyarıyor; açlıkla kendiliğinden hareket eden, ham duyudan öğrenen bazal gangliyon
  bedeni için karşılık bulunamadı.
- **Eklenen mekanizmalar** (hepsi anahtar, varsayılan = eski kural; 11/11 mutasyon yakalandı):
  seçime bağlı uygunluk (H1), dopamin düşüş tabanı (H2), ölüm öğretmez (H3, vardı), doğrusal TD
  eleştirmeni — ağırlıkları deftere yeni "critic" kaydıyla (H4), nöron başına sinaptik ölçekleme (H5),
  dopamin ölçeklemesi / OpAL* (H11), negatif kontrol için dopamin dönüştürücü (H10).
- `[TEST]` Eleştirmen, durumsuz tahminin yapamadığını yapıyor: düzenli yemekte sürpriz yarıdan fazla küçülüyor;
  değer iki adım geriye (duvar → yemek görme → yemek) taşınıyor. İlk mutasyon turunda iki kaçak
  ("sonraki durumu yok say", "eleştirmen δ'sı kullanılmıyor") → testler eklendi.

## 2026-09-24 — Seri 002a (mekanizma taraması) — koşmadan önce

- Seed 4–10 × iki grup (koşul başına 14 öğrenen), 40 eğitim + 10 değerlendirme, η 0,05 / λ 0,8, 10 yemek,
  aç doğum. Tüm koşullar aynı donuk kardeşleri paylaşır.
- Koşullar: E0 tam kural (referans) · E1 seçime bağlı · E2 E1+ölüm öğretmez · E3 E1+düşüş tabanı 0,05 ·
  E4 E1+taban+ölüm öğretmez · E5 Git-yalnız (önceki en iyi) · E6 Git-yalnız+ölüm öğretmez · E7 E4+eleştirmen ·
  E8 E4+ölçekleme · E9 E1+ölüm öğretmez+dopamin ölçeklemesi (η 0,003) · E10 E4+eleştirmen+ölçekleme.
- **"En iyi" tanımı:** (öğrenen − kardeş) yemek/1000 tik medyanı en yüksek olan, ama yalnızca en az 11/14
  öğrenen kardeşini geçiyorsa; eşitlikte yaklaşma. Hiçbiri 11/14'e ulaşmazsa "en iyi yok".
- **Öngörüler:** H1 → E1 donmaz ve E0'dan iyi. H2/H3 → E4 ≥ E1. H6 → E6 aşırı hareketli (durgun < %10).
  H4 → E7 ≥ E4. H5 → E8 ≥ E4. H11 → E9 kararlı (ne donma ne aşırılık).
- En iyi aday → parti 2 (sağlamlık) ve parti 3 (ne öğrenildi, lezyon, karıştırılmış dopamin kontrolü).

## 2026-09-24 — Seri 002a sonucu (mekanizma taraması)

Kod `59a2c27`, 1091 sn, 14 öğrenen/koşul, ortak donuk kardeşler (2,08 yemek/1000 tik, 1346 tik yaşam, %43 durgun).

| koşul | önde | yemek/1000t | yaşam | yaklaşma | durgun | Git | Gitme |
|---|---|---|---|---|---|---|---|
| E0 tam kural, nöron geçidi | 0/14 | 0,02 | 808 | 0,005 | %100 | 0,047 | 0,692 |
| E1 seçime bağlı | 3/14 | 1,78 | 1540 | 0,625 | %76 | 0,116 | 0,148 |
| E2 E1 + ölüm öğretmez | 0/14 | 0,43 | 308 | 0,529 | %3 | 0,092 | 0,027 |
| E3 E1 + düşüş tabanı | 3/14 | 1,50 | 676 | 0,558 | %27 | 0,109 | 0,036 |
| E4 E1 + taban + ölüm öğretmez | 0/14 | 0,43 | 308 | 0,529 | %3 | 0,092 | 0,027 |
| **E5 Git-yalnız** | **12/14** | 2,53 | 1408 | 0,603 | %47 | 0,120 | 0,026 |
| E6 Git-yalnız + ölüm öğretmez | 0/14 | 0,43 | 296 | 0,513 | %0 | 0,095 | 0,026 |
| **E7 E4 + eleştirmen** | **11/14** | 2,35 | 1187 | 0,557 | %42 | 0,164 | 0,067 |
| E8 E4 + ölçekleme | 8/14 | 2,03 | 903 | 0,542 | %30 | 0,058 | 0,026 |
| E9 dopamin ölçeklemesi (η 0,003) | 0/14 | 0,00 | 800 | 0,034 | %97 | 0,096 | 0,203 |
| **E10 E4 + eleştirmen + ölçekleme** | **12/14** | **2,81** | **1645** | 0,590 | %48 | 0,057 | 0,027 |

- **Öngörü karnesi:** H1 kısmen (donmayı azaltıyor — Gitme 0,69 → 0,15 — ama tek başına kardeşi geçmiyor).
  H2 boşa çıktı: E2 ≡ E4 birebir; günlük düşüşler tabana hiç ulaşmıyor, taban yalnızca ölümü sınırlıyor.
  H3 eleştirmensiz ✗ (ölüm öğretmeyince hep aşırı hareket), eleştirmenle ✓ (E7). **H4 en güçlü bulgu:** E4 → E7
  0/14 → 11/14 — eleştirmen, ölüm yerine sürekli ve bilgilendirici bir fren. H5 dengeliyor, kazanç yok (8/14).
  H6 ✓ (E6 %0 durgun). H11 benim yaklaşığımda ✗ (donma) — bu OpAL*'ın kendisi değil, o sınanmadı.
- **Seçim (dürüst):** önceden yazılı kurala göre "en iyi" **E5** (medyan fark +0,52). **E10** ortalamada en yüksek
  (2,81) ve en uzun yaşam (1645); biyolojik olarak en savunulabilir (ölümden öğrenmez, sadece seçilen eylemi
  öğrenir, eleştirmenli). Plan "en iyi 1–2 aday" diyordu → **E10 ikinci aday olarak, sağlamlık sonuçlarından
  önce, bu gerekçeyle** eklendi. İkisi de 002b ve 002c'den geçecek.

## 2026-09-24 — Seri 002b/002c sonucu: sağlam görünüyor ama negatif kontrol başarısız

Kod `1d10af5`. Veri: `data/series-002b-*`, `series-002c-*`.
- `[ÖLÇÜLDÜ]` Sağlamlık (002b, 20 öğrenen/değişken, seed 1–10 × iki grup): E5 12–20/20, E10 13–18/20 önde;
  E10 en iyi ayarda 3,54 yemek/1000t (kardeş 2,07); seyrek yemekte (5) avantaj zayıflıyor (E5 12/20, E10 13/20).
  100 bölümde ikisi de 6/6 önde, ama eğitim eğrisi tekdüze artmıyor (E5 2,15 → 2,49 → … → 1,91; E10 3,45 → 4,01 → … → 3,20).
- `[ÖLÇÜLDÜ]` Geometri (H8): öğrenilmiş 0,57 vs doğum 0,46 (şans 0,5) — iki adayda da yön öğrenimi zayıf.
- `[ÖLÇÜLDÜ]` Lezyon (H9): E10 bozulmamış 2,81 → yemek lezyonu 2,27, duvar lezyonu 2,66; E5 2,53 → 2,29 / 2,58.
- `[ÖLÇÜLDÜ]` **Negatif kontrol (H10) BAŞARISIZ:** 100 tik gecikmeli dopaminle E5 10/14, E10 12/14 önde (öngörü: ≈ kardeş).
  Ayrıntı: E5 gecikmeli → 2,21 yemek/1000t (kardeş 2,08), yaklaşma kardeş seviyesinde, Git büyümüyor → **E5'in
  öğrenmesi büyük ölçüde gerçek ve zamanlamaya bağlı.** E10 gecikmeli → 2,97 (orijinal 2,81), yaşam, yaklaşma,
  Git aynı → **E10'un avantajı anlık zamanlamaya bağlı değil.**
- Yeni hipotezler: (a) E10 yavaş değişkenleri öğreniyor (açlık → etkinlik); 100 tik yetmez. (b) Avantaj bir
  mekanizmanın (ölçekleme/eleştirmen) yan etkisi. (c) Ağırlıklar 0'da kesildiği için sıfır ortalamalı dopamin bile
  ağırlıkları şişiriyor (E5 gecikmeli Git 0,048 vs doğum 0,025).
- Sınama (002d): dopamin işareti rastgele (SIGN) ve bölümler arası 3000 tik gecikme (CROSS), E5 ve E10.
  **Öngörüler:** E5 ikisinde de ≈ kardeş. E10 — (a) doğruysa SIGN ≈ kardeş, CROSS biraz kalabilir; (b) doğruysa ikisi de önde.

## 2026-09-24 — Seri 002d sonucu: hangi öğrenme gerçek?

Kod `793e240` (E5, E10) ve `29f4121` (E7). Veri `data/series-002d-*`.

| koşul | önde | yemek/1000t (kardeş 2,08) | yemek-ışını → Git değişimi | açlık → Git değişimi |
|---|---|---|---|---|
| E5 asıl | 12/14 | 2,53 | **+0,306** | −0,001 |
| E5 SIGN (rastgele işaret) | 7/14 | 1,60 | +0,257 | +0,057 (her şey şişiyor) |
| E5 CROSS (bölümler arası gecikme) | 9/14 | 2,27 | −0,009 | −0,007 |
| E7 asıl | 11/14 | 2,35 | **+0,381** | +0,024 |
| E7 CROSS | 6/14 | 1,82 | +0,018 | +0,041 |
| E10 asıl | 12/14 | 2,81 | +0,121 | **−0,266** |
| E10 SIGN | 4/14 | 1,26 | +0,033 | −0,174 |
| E10 CROSS | 11/14 | 3,02 | +0,026 | −0,193 |

- **E5 ve E7 gerçekten öğreniyor:** asıl koşulda "yemek görmek → Git" belirgin büyüyor; dopamin başka bölümden
  gelince bu büyüme ve avantaj kayboluyor. Öngörü "E5 CROSS ≈ kardeş" ✓ (9/14, +0,19 — küçük artık).
- **E10'un fazladan kazancı öğrenme değil:** üç koşulda da "açlık → Git" düşüyor (beden sakinleşiyor) ve CROSS'ta
  avantaj sürüyor → sonuçtan bağımsız bir kayma; ölçekleme eklenince ortaya çıkıyor (E7'de yok). Öngörü (b) ✓.
  Basit açıklama "eleştirmenin δ ortalaması eksi" ölçümle desteklenmedi (ortalama −3·10⁻⁵ ≈ 0; E5'in durumsuz
  beklentisi −5,6·10⁻⁴). Kaymanın kesin mekanizması açık soru.
- **Gürültü şişmesi doğrulandı (hipotez c):** rastgele işaretli dopamin, 0'da kesilen ağırlıkları her duyuda şişiriyor
  ve performansı düşürüyor. SIGN bu yüzden nötr bir kontrol değil; CROSS daha temiz kontrol.
- **Ara sonuç:** biyolojik olarak savunulabilir VE gerçekten öğrenen tek aday **E7** (seçime bağlı öğrenme, düşüş
  tabanı, ölüm öğretmez, eleştirmen; ölçekleme yok). E7 henüz sağlamlık/lezyon testinden geçmedi → 002b/002c E7.

## 2026-09-24 — E7 testleri ve toplantı

- `[ÖLÇÜLDÜ]` E7 (seçime bağlı + düşüş tabanı + ölüm öğretmez + eleştirmen): 100 tik gecikmeli dopamin **0/14**
  (medyan −0,73); yemek lezyonu 2,35 → **2,05** (≈ kardeş 2,08), duvar lezyonu 2,24; geometri 0,54 (doğum 0,46);
  sağlamlık 8–17/20 (λ 0,9 en iyi: 17/20, 3,16; η×2 9/20; λ 0,7 10/20; seyrek yemek 8/20); 100 bölüm **tek yükselen
  eğri** 2,49 → 3,99. → E7: sonuca bağlı gerçek öğrenme, ama parametreye duyarlı, seyrek yemekte başarısız, yön zayıf.
- Toplantı: vault `forum/beyin0fis/toplantilar/2026-09-24-ogrenme-temeli/` — 11 hipotez karnesi, E5/E7/E10 kanıtı,
  9 persona + konuk, oylama (A: E7 ile ön-kayıt 36 · D: önce daha fazla keşif 32 · B: E5 25 · C: E10 14), kararlar
  K1–K10. Ofis config/board güncellendi (BY1–BY9 iptal, BY10–BY15 açıldı).
- Ön-kayıt 002 taslağı: `data/preregistration-002.md` — **dondurulmadı**, Ozyn onayı bekliyor; test seed'lerine dokunulmadı.
- Süreç notu: bu girişi yazan betik Windows yolundaki ters eğik çizgilerde çöktü; önceki commit (413071e) yalnızca
  ön-kayıt taslağını içeriyor, giriş ayrı commit'le eklendi.

## 2026-09-24 — Seri 003a: kıyas öğrenicisi — koşmadan önce (keşif)

- Ozyn kararı: hedef **Basamak 2** ("doğru kararı öğrenir, koşullar değişince de"); ön-kayıt 002 dondurulmadan önce
  iki keşif: (1) kıyas öğrenicisi, (2) topografik doğum. Sinek bağlantı haritası (Male CNS v1.0) ayrı bir alt ajanda.
- Kod: `baselines/` — **beyin değil, ölçü çubuğu.** `LinearQ` = ders kitabı SARSA(λ), doğrusal Q (Sutton & Barto §12.7),
  beyinle aynı 22 duyu + sabit terim, aynı 9 motor komutu, aynı homeostatik ödül, ölümde −1; ε-açgözlü, seed'li.
  Eğitilmemiş hali = rastgele politika (eşitlikler rastgele bozuluyor, testli). `oracle` = elle yazılmış tavan
  (en yakın yemeğe dön, yoksa ileri, yakın duvardan dön) — sadece "iyi ne demek" için. 13 test, 11/11 mutant öldü.
- Yeni ölçü `turnToward` (dönüş yönü): yemek bir YANDA görülüp beden döndüğünde, yemeğe doğru dönme oranı; şans 0,5,
  tek yöne dönme alışkanlığı da 0,5 verir. Her aktör kendi gecikmesiyle ölçülür (beyin LAG=3, tepkisel politika 0).
  Ölçüm tek yerde: `harness.measureEpisodes` — beyin ve kıyaslar aynı değerlendirme dünyalarında, aynı ölçülerle.
- Plan (seed 1–10, yemek 10, aç doğum 0,4, tehdit yok; E7 ile aynı dünyalar): rastgele, kâhin, TD taraması
  (α {0,03; 0,1; 0,3} × λ {0,8; 0,9}, ε 0,1, 40 eğitim + 10 değerlendirme, değerlendirmede ε 0,05), en iyi TD için
  100 bölüm eğrisi ve ε 0 değerlendirmesi. E7 denekleri (as-is ve λ 0,9) yeni ölçüyle yeniden değerlendirilir —
  yemek/1000 tik kayıtlı değerle **birebir aynı çıkmalı** (ölçüm yeniden düzenlemesinin kontrolü).
- **Öngörüler (koşmadan):** (a) kâhin ≥ 3× rastgele; (b) en iyi TD, E7 λ 0,9'u (3,16) açıkça geçer ve kâhinin
  %50'sinden fazlasına ulaşır; (c) TD'nin dönüş yönü ≥ 0,7; (d) E7'nin dönüş yönü ~0,5–0,55 (geometri 0,54 ile
  tutarlı). (b) ya da (c) tutmazsa oda sanıldığından zor demektir ve beynimizi yargılamak için ölçüt değişir.

## 2026-09-24 — Seri 003a sonucu: oda kolay, beynimiz yavaş ve yön öğrenmiyor

`[ÖLÇÜLDÜ]` seed 1–10, yemek 10, 10 değerlendirme bölümü (E7 ile aynı dünyalar). Yemek/1000 tik · dönüş yönü:

| aktör | yemek/1000t | kâhinin %'si | dönüş yönü | durgun |
|---|---|---|---|---|
| rastgele (eğitilmemiş TD) | 0,67 | %5 | 0,499 | %11 |
| E7 kardeş (donuk, doğuştan yapı) | 2,07 | %16 | 0,499 | %42 |
| E7 as-is (40 bölüm) | 2,43 | %19 | **0,483** | %44 |
| E7 λ 0,9 (40 bölüm) | 3,16 | %25 | **0,506** | %51 |
| TD α 0,03 λ 0,8 (40 bölüm) | **8,38** | **%67** | 0,655 | %18 |
| TD aynı, 100 bölüm | 9,05 | %72 | 0,639 | %11 |
| kâhin (elle yazılmış tavan) | 12,57 | %100 | 1,000 | %0 |

- TD taraması: α 0,03–0,1 arası 5,3–8,4; α 0,3 bozuluyor (1,5–3,9). ε 0 (açgözlü) değerlendirme ε 0,05 ile aynı düzeyde
  (7,7 / 8,3). TD daha **ilk 10 bölümde** 6,0'a çıkıyor (beynimizin 100 bölümde ulaştığının iki katından fazla);
  100 bölümlük eğitim eğrisi 6,0 → 14,2'ye kadar çıkıyor (ε 0,1 ile).
- E7 deneklerinin yeniden ölçümü kayıtlı yemek değerleriyle **birebir aynı** (40 denek) → ölçüm düzenlemesi temiz.
- **Öngörü karnesi:** (a) kâhin ≥ 3× rastgele ✓ (18,8×); (b) TD E7'yi açıkça geçer ve kâhinin > %50'si ✓ (2,7×, %67);
  (c) TD dönüş yönü ≥ 0,7 ✗ (0,655; en iyi ayar 0,69 — yakın ama altında); (d) E7 dönüş yönü ~0,5–0,55 ✓ (0,483 / 0,506).
- **Yorum:** oda zor değil — aynı duyu, aynı beden, aynı ödülle ders kitabı öğrenicisi kâhinin üçte ikisine çıkıyor.
  Beynimizin kazancının tamamı "ne zaman hareket et/dur"dan geliyor (durgun %51, yaşam uzuyor); **yön hiç öğrenilmemiş**
  (0,506 = şans). Kardeşin 2,07'si de doğuştan yapıdan (açlıkla hareket, tokken dinlenme): eğitilmemiş TD'nin 3 katı.
  Basamak 2 için asıl engel yön öğrenmesi.
- Neden TD öğreniyor da biz öğrenmiyoruz — farklar (henüz sınanmadı): (1) TD eylemin değerini **duyu × eylem** çarpımında
  tutuyor; bizde de öyle (duyu → Git.eylem) ama eylemi çoğunlukla gürültü üreteci seçiyor, öğrenilen ağırlıklar seçime
  katılmak için ~0,2'ye çıkmalı; (2) TD her tik tek eylem seçiyor ve kredi onda; bizde seçim eşikli ve ikili, sık sık
  hiçbir şey seçilmiyor; (3) TD ε ile her eylemi eşit dener, bizim üreteçler açlığa bağlı patlamalar.

## 2026-09-24 — Ozyn'in notu ve sinek bağlantı haritası

- **Ozyn (003a'dan sonra):** "Deney 1 gösteriyor ki beyni çok kaba tasarlamışız. Yön öğrenmek ve diğer şeyler daha
  derin; beyin daha karmaşık." → Tek katmanlı duyu → Git/Gitme öğrenmesi Basamak 2 için yetersiz görünüyor; mimarinin
  derinliği gündemde (henüz karar yok, tasarım belgesi + toplantı gerekecek).
- Sinek verisi: Male CNS v1.0 (Janelia FlyEM, Google Research, Cambridge; CC-BY 4.0; male-cns.janelia.org; DOI
  10.1101/2025.10.09.680999) indirildi, alt ajan inceledi: `data/connectome/RAPOR-male-cns.md` (betikler `scripts/`).
  `[ÖLÇÜLDÜ]` 211 577 etiketli nöron, 26,0 milyon bağlantı / 125 milyon sinaps; mantar gövdesi: 686 koku projeksiyon
  nöronu → **4 064 Kenyon hücresi (6× genişleme)** → **97 çıkış nöronu (MBON, 42× daralma)**; dopamin: 316 PAM + 16 PPL1
  (+8 PPL2), 15 PAM tipi, 8 PPL1 tipi; her KC ~6 projeksiyon nöronundan girdi alıyor, ~15 MBON'a veriyor; dopamin
  nöronları devreden **geri besleme alıyor** (KC→DAN 281 bin sinaps, MBON→DAN 11 bin); KC→KC 643 bin bağlantı;
  güçlü bağlantıların %81'i aynı vücut yarısında kalıyor.
- Bizim beyinle farklar (gözlem, karar değil): (1) sinekte öğrenme ham duyuda değil, büyük seyrek bir ara katmanda
  (KC → MBON); bizde doğrudan duyu → eylem. (2) sinekte ~15 tipte, bölmelere ayrılmış çok sayıda dopamin sinyali;
  bizde tek küresel δ. (3) sinekte dopamin nöronları devreden girdi alıyor (tahmin devrenin içinde); bizde eleştirmen
  ayrı bir doğrusal modül. (4) sinek iki yarımküreli, bağlantılar büyük ölçüde aynı tarafta; bizde "taraf" yok.
  (5) Literatür (veride değil): mantar gövdesi neyin iyi/kötü olduğunu öğrenir; yönü merkezi kompleks (bu veride
  2 950 CX nöronu) ve iki taraf arasındaki asimetri çözer — yani sinekte "hangi yön" büyük ölçüde yapı, "neye yaklaş"
  öğrenme. 003b tam bu ayrımın küçük bir sınaması.

## 2026-09-24 — Seri 003b: doğuştan yönelme — koşmadan önce (keşif)

- Kod: `bornGraph(..., { orienting: { strength, direction } })` — her ışının kendi yönündeki eylemin Git'ine (sol ışınlar
  → sola dön, orta → ileri, sağ → sağa dön) doğuştan ek ağırlık; duvar, yemek, tehlike için **aynı** (hedef değil yapı);
  öğrenen yolda (silinebilir). Biyolojik karşılık: arama (rooting) refleksi. "away" = ayna kontrolü.
- Üst sınır ölçüldü: 200 seed, üreteçler susuk, aç beden, iki sol ışını dolduran duvar/yemek, 60 tik — 0,02'de hiçbir
  seed yalnız görmeyle eylem seçmiyor (eğilimsiz yenidoğan da 0/200); 0,03'te 4/200, 0,05'te 62–71/200.
  `MAX_ORIENTING = 0,02`. Analitik en kötü durum (NoGo'yu yok sayan) kullanılamadı: eğilimsiz yenidoğanı bile yasaklıyor.
  Testler: 2 yeni, 8/8 mutant öldü.
- Plan: E7 λ 0,9 ayarı, seed 1–10 × iki grup, 40 eğitim + 10 değerlendirme, yemek 10; koşullar: O1 yönelme 0,02
  (toward), O2 ayna 0,02 (away); kardeşler aynı eğilimle doğar. O0 (eğilimsiz) = 003a'daki E7 λ 0,9 ölçümü.
- **Öngörüler (koşmadan):** eğilim küçük (rastgele başlangıç aralığı 0–0,05), bu yüzden etki küçük olur:
  (a) O1 kardeşinin dönüş yönü 0,5'ten biraz yukarı (0,5–0,55), O2 kardeşininki biraz aşağı;
  (b) O1 öğrenenin dönüş yönü ≤ 0,6 — yani eğilim yön öğrenmesini **çözmez**; (c) O1 yemek/1000 tik O0'dan (3,16) en
  fazla ~%20 farklı. (b) tutarsa sorun başlangıç simetrisi değil, kredi atamadır (sonraki adım o).

## 2026-09-24 — Seri 003b sonucu: doğuştan yönelme yönü çözmedi

`[ÖLÇÜLDÜ]` seed 1–10 × iki grup, E7 λ 0,9. O0 = 003a ölçümü.

| koşul | yemek/1000t öğrenen | kardeş | önde | dönüş yönü öğrenen | kardeş |
|---|---|---|---|---|---|
| O0 eğilimsiz | 3,16 | 2,07 | 17/20 | 0,506 | 0,499 |
| O1 yönelme 0,02 | 2,99 | 2,09 | 16/20 | **0,497** | 0,505 |
| O2 ayna 0,02 | 3,08 | 2,14 | 16/20 | **0,484** | 0,501 |

- Öngörü karnesi: (a) O1 kardeşi 0,5–0,55 ✓ (0,505), O2 kardeşi biraz aşağı ✗ (0,501 — fark yok); (b) O1 öğrenen ≤ 0,6 ✓
  (0,497); (c) O1 yemek O0'ın %20'si içinde ✓ (2,99 / 3,16).
- Yorum: izin verilen en büyük eğilim kardeşin yönünü bile değiştirmiyor (0,505) — üreteçlerin seçimi yanında çok küçük.
  Öğrenme de yönü büyütmüyor: sorun başlangıç simetrisi değil. Kredi atama / öğretme sinyali şüphesi güçlendi → M1.

## 2026-09-24 — Seri 004 / M1: dopamin bölmeleri — koşmadan önce (keşif)

- Tasarım: `TASARIM-004-MODULLER.md`. Kod: `learning/compartments.ts` — "action" (eylem başına bölme, kendi beklentisi
  Q_a, yalnız eylemi seçildiğinde konuşur: δ_a = r + γ·V(s′) − Q_a(s)) ve "valence" (ödül kanalı: rahatlama, ceza kanalı:
  maliyet + ölüm; Git yalnız δ⁺, Gitme yalnız δ⁻). `outcomeParts` (rahatlama + maliyet = sonuç; 7⁴ durumluk ızgarada
  fark ≤ 2ε, ölçülen en büyük 1ε). Öğrenici hücre başına δ alabiliyor; beklenti ağırlıkları deftere bölme önekli.
  Testler: 28 bölme + 5 ayrıştırma; 15 mutantın 14'ü öldü, kalan eşdeğer (δ = 0 için kısayol). Bölmeler kapalıyken
  E7 λ 0,9 deneği sıfırdan yeniden eğitildi: 4 denek, kayıtlı değerlendirme ile **bit-aynı**.
- Ozyn'in test incelemesi (2026-09-24): çok koşullu `assert`'ler, hikâye adları, rastgele örnekleme ve gerekçesiz tolerans
  eleştirildi — haklı; ayrıca bir test örnekler arasında durum paylaşıyordu ve bu yüzden yanlış yere başarısız oldu.
  Testler baştan yazıldı: her durum temiz nesne, her doğrulama tek koşul + mesaj, ızgara, ölçülmüş tolerans.
- Plan: E7 λ 0,9 ayarı (ölüm öğretmez — karşılaştırma için aynı bırakıldı; M1b'de ölüm kanalı bu yüzden susuk),
  seed 1–10 × iki grup, 40 + 10 bölüm, yemek 10. M1a = + eylem bölmeleri, M1b = + değerlik bölmeleri.
  Kazanan olursa CROSS (her bölmenin δ'si ayrı ayrı 3000 tik geciktirilir).
- **Öngörüler (koşmadan):** M1a: dönüş yönü öğrenende **> 0,55** ve kardeşten yüksek; yemek > 3,16 (E7 λ 0,9).
  M1b: dönüş yönü ~0,5 (değerlik eyleme göre ayrışmaz); yemek 3,16 ± %20. M1a tutmazsa: kredi atama sorunu öğretme
  sinyalinde değil, seçimde (üreteçler) — sonraki şüpheli orası.

## 2026-09-24 — İleride bakılacak iki dış kaynak (Ozyn: "not al, ilerde bakarız")

İkisi de `data/external/` altına indirildi (sığ klon, git dışı); kod okundu, hiçbir şey çalıştırılmadı.

- **AlbertPro** (github.com/thinking0things/AlbertPro, MIT, C. Capone, 2026-08-31): 14 cm, 8 servolu dört ayaklı robot;
  MuJoCo'da PPO+GAE ile yürümeyi öğreniyor, ağ ESP32'de 100 Hz koşuyor. Ağ 24 → 64 → 8 (2 120 sayı, 8,3 KB). Eylem =
  eklem ivmesi (ΔΔθ) → yumuşaklık yapıdan. ~849. tur (≈ 2,7 milyon adım) tırıs; ödül 8 terimli, el yapımı.
  Bizim için: Basamak 3'ün gerçek fiyatı (milyonlarca adım); "omurilik" (ritim) bölgesi için referans; Ozyn'in ESP32
  LED yüz robotuyla aynı donanım yolu (ESP32 + PCA9685 + Bluetooth). Kara kutu: kayıt/açıklanabilirlik yok.
- **Needle** (github.com/cactus-compute/needle, Apache 2.0, v3.0.1): 8–29 MB araç çağırma / yapılandırılmış çıkarım
  modeli, 2–20 katman arası her derinlik kullanılabilir, her cevapta kalibre edilmiş güven puanı; kapsam dışı isteğe
  boş liste. Bizim için: Jev'in açık/yerel karşılığı; Bob'un "dil ve alet" bölgesi adayı; güven puanı = Daw 2005
  tarzı hakemlik sinyali. **Telemetri varsayılan açık** (Supabase'e olay adı, sürüm, OS, rastgele kurulum kimliği;
  istem/çıktı göndermediği kod okunarak doğrulandı) → kullanılırsa `NEEDLE_TELEMETRY=0`.

## 2026-09-24 — Ozyn'in fikri: Needle öğretmen, beyin öğrenci

- Fikir (Ozyn): Needle istenen işi zaten kolayca yapabilir; bizim beyin onun ne yaptığını görüp ondan öğrensin.
  Sabırla, zaman sınırı olmadan.
- Karşılıkları: gözlemle/taklitle öğrenme (bebekler), ötücü kuşlarda öğretmen şarkısı + bazal ganglion (Area X) +
  dopaminle eşleşme öğrenmesi; RL'de gösterimden öğrenme, davranış klonlama, DAgger (Ross ve ark. 2011), politika
  damıtma. Bizim çizgide: yavaş/düşünen Bob'un hızlı Alice'e öğretmesi = Soar'daki "chunking", bilgi havuzundaki
  "refleks derleyici" fikri (§13).
- Tartışma ve öneri: bkz. konuşma; ilk adım olarak öğretmeni ucuz bir kâhinle deneyip "beynimiz yönü *temsil*
  edebiliyor mu, yoksa sorun kredi atamada mı" sorusunu ayırmak önerildi (Needle kurulumu ayrı onayla).

## 2026-09-24 — Seri 004 / M1 sonucu: bölmeler yönü çözmedi; değerlik bölmesi ters öğretti

`[ÖLÇÜLDÜ]` seed 1–10 × iki grup, E7 λ 0,9 + modül. Referans E7 λ 0,9: 3,16 · 17/20 · dönüş 0,506 · yaklaşma 0,564.

| koşul | yemek/1000t | kardeş | önde | dönüş yönü | 0,5 üstü | yaklaşma | durgun |
|---|---|---|---|---|---|---|---|
| M1a eylem bölmeleri | 3,08 | 2,07 | 17/20 | 0,513 | 13/20 | **0,624** | %47 |
| M1b değerlik bölmeleri | 2,31 | 2,07 | 8/20 | **0,460** | **0/20** | 0,448 | %27 |

- Öngörü karnesi: M1a dönüş > 0,55 ✗ (0,513), yemek > 3,16 ✗ (3,08); M1b dönüş ~0,5 ✗ — daha kötü: **20 deneğin
  hiçbiri** 0,5'in üstünde değil, yaklaşma 0,448 → yemekten sistematik uzaklaşma. M1b yemek 3,16 ± %20 ✗ (2,31).
- Yorum: eylem başına öğretme sinyali yaklaşmayı biraz artırdı ama yönü değil. M1b'deki tutarlı ters öğrenme gerçek bir
  etki (20/20 aynı yönde); olası sebep (sınanmadı): ceza kanalı her hareketin enerji maliyetini görüyor, beklentisi
  duyuya bağlı; yemeğe dönüp yaklaşma dönemleri maliyetin "beklenenden kötü" olduğu anlara denk gelip Gitme'yi
  o eylemlerde güçlendiriyor olabilir. Açık soru.

## 2026-09-24 — T0: öğretmenden öğrenme (tanı) — koşmadan önce (keşif)

- Ozyn T0'ı onayladı; ayrıca "istediğin kadar zamanın var; çalış, araştır, toplantı yap, farklı kombinasyonları dene".
- Kod: `learning/teacher.ts` — öğretmen her tik "ben ne yapardım" der; beynin **seçtiği** her eylemin bölmesine,
  öğretmen de onu seçerdiyse +kazanç, seçmezdiyse −kazanç; seçilmeyen eyleme 0 (ötücü kuşta öğretmen şarkısıyla
  karşılaştırma + Area X dopamini). Öğretmen, beynin eylem yaptığı tikin gözlemini yargılar. "only" = yalnız öğretmen,
  "add" = ödüle eklenir. Kayıtta her ders "teacher" nedeniyle. 14 test, 9/9 mutant öldü (biri yeni testle).
  E7 geriye dönük kontrol yeniden: 4 denek bit-aynı.
- T0'da öğretmen = elle yazılmış kâhin: **tasarım değil, tanı aracı** — soru: beyin "hangi yön"ü temsil edebiliyor mu?
- Koşullar (seri 004 içinde): T0a yalnız öğretmen, kazanç 0,3 · T0b ödül + öğretmen 0,3 · T0c yalnız öğretmen 1,0.
- **Öngörüler (koşmadan):** yoğun ve doğru sinyal kredi atamayı çözer → T0a dönüş yönü **> 0,65**, yemek > 4,2.
  Tutmazsa (dönüş yönü ≤ 0,55): sorun temsil/seçim mimarisinde (üreteçler seçimi ele geçiriyor ya da duyu → Git
  doğrusal yolu yetmiyor) → M2/M3 şart. T0c (daha güçlü) T0a'dan daha yüksek yön; T0b T0a'ya yakın.

## 2026-09-24 — Seri 004 / M2: ara katman — koşmadan önce (keşif)

- Kod: yeni bölge `kc` (Kenyon benzeri, ikili karar hücresi, eşikli); yollar P12 (duyu → kc, doğuştan, ağırlık 1),
  P13/P14 (kc → Git/Gitme, öğrenir). `bornGraph(..., { expansion: { cells, inputs, threshold } })`: her hücre rastgele
  `inputs` farklı duyu dinler (kendi rastgele akışı — kalan yenidoğan değişmez), öğrenen yol duyulardan değil hücrelerden
  başlar; refleksler doğrudan yolda kalır. Duyu → motor gecikmesi 4 tik (`senseToMotorDelay`, dönüş ölçüsü buna göre).
  Görselde "ARA KATMAN" sütunu. Testler 11 yeni; 9/9 mutant öldü (biri yeni testle). E7 geriye dönük: bit-aynı.
- Eşik ölçüldü (5 yenidoğan × 3000 tik, 8 298 gözlem, 64 hücre): 4 girdi / eşik 1,0 → ortalama **%14 hücre etkin**,
  %5'i hiç ateşlemiyor, hiçbiri hep ateşlemiyor (3 girdi/1,0: %9; 4/1,2: %7,5; 5/1,0: %19). Seçim: 64 × 4, eşik 1,0.
  Eşik 1'de tek duyu hücreyi neredeyse hiç ateşlemez → hücreler birleşim kodlar.
- Koşullar: M2 (E7 λ 0,9 + ara katman), M2T (ara katman + kâhin öğretmen), M2a (ara katman + eylem bölmeleri).
- **Öngörüler (koşmadan):** M2 tek başına dönüş yönü 0,5–0,55 (sorun temsil değilse değişmez); yemek E7'ye yakın
  (daha çok bağlantı → daha yavaş öğrenme olabilir). M2T > T0a dönüş yönünde (birleşim temsili öğretmenden daha iyi
  yararlanır). Asıl ayrım T0 sonucuna bağlı.

## 2026-09-24 — T0a sonucu ve bir ölçüm hatası: dönüş yönü alışkanlıktan etkileniyor

- `[ÖLÇÜLDÜ]` T0a (yalnız kâhin öğretmen, kazanç 0,3, E7'nin düşüş tabanı −0,05 ile): yemek **0,31** (kardeş 2,07),
  0/20 önde, yaşam 286 tik, **durgun %0**, dönüş yönü 0,462 (0/20 > 0,5). Öngörü (> 0,65) ✗ — ama sonuç öğretmenin
  değil düzeneğin sorunu: (1) düşüş tabanı öğretmenin "evet"ini (+0,3) geçirip "hayır"ını (−0,05'e) kısıyor;
  (2) kâhin neredeyse her tik "ileri" diyor → beyin hiç durmamayı öğreniyor, aç doğan beden 286 tikte açlıktan ölüyor.
  T0d/T0e düşüş tabanı olmadan koşulacak.
- **Ölçüm hatası bulundu** `[ÖLÇÜLDÜ]`: `turnToward` kapalı döngüde alışkanlıktan bağımsız DEĞİL. Yemeği hiç görmeyen
  politikalar (20 bölüm): "ileri + hep sol" **0,465**, "ileri + hep sağ" 0,498, yerinde sola dönme 0,494, rastgele
  0,49–0,51. Sebep: dönülen taraftaki yemek hızla ortaya gelir, öbür taraftaki uzun süre yanda kalır. Aynı politika
  yaklaşmada 0,557 alıyor (E7: 0,564) → **yaklaşma da öğrenmenin temiz ölçüsü değil.** Sonuç: M1b (0,460) ve T0a (0,462)
  "yemekten kaçmayı öğrendi" değil, büyük olasılıkla "tek yöne dönme alışkanlığı edindi".
- Yeni ölçü `steering` (yönlendirme endeksi): ½·[(P(sol|yemek sol) − P(sol|yemek sağ)) + (P(sağ|yemek sağ) − P(sağ|yemek sol))].
  Alışkanlık 0, rastgele ~0, kusursuz 1, ters −1; gerçek odada "hep sol" tam 0 (testli). 8 test, 5/5 mutant öldü.
  `experiments/remeasure.ts`: eski deneklerin hepsi yeni ölçüyle yeniden değerlendirilir; yemek değeri kayıttan farklı
  çıkarsa durur (deterministik değerlendirme).

## 2026-09-24 — T1: Needle öğretmen olabilir mi? (keşif)

- Kurulum: `data/external/needle-venv`, PyPI `cactus-needle==3.0.1` (klondaki sürüm 3.0.2 motor istiyor, HF'de yayınlanmamış).
  Telemetri kodu klondakiyle birebir aynı (fark yok); `NEEDLE_TELEMETRY=0` + `DO_NOT_TRACK=1` ile çalıştırıldı.
  `~/.cactus_needle/telemetry_id` dosyası 2026-09-13 tarihli — bu makinede Needle daha önce telemetri açıkken
  kullanılmış; bugünkü çalıştırmalar oluşturmadı. Motor HF'den (Cactus-Compute/needle3) indirilen derlenmiş kod.
- Hız `[ÖLÇÜLDÜ]`: karar başına ~230–1500 ms (bir kez 10,8 s). Her tik sormak bir seri için 100+ saat → Needle'a her kaba
  "sahne" bir kez soruldu, cevaplar tabloya (`data/needle-table.json`): yemek yok/sol/önde/sağ × yakın/uzak × duvar
  yakın/açık × aç/tok = 28 sahne; araç açıklamalarına "ne zaman" yazıldı (Needle'ın kendi rehberi).
- Sonuç `[ÖLÇÜLDÜ]`: 28 sahnenin **hiçbirinde "ileri"** yok (yemek tam öndeyken bile dönüyor); yakın yemekte hep sağa
  (yemek solda olsa da); doğru olanlar uzak-sol ve bütün sağ sahneler ≈ 14/28. Güven yanlışlarda da yüksek (0,91–0,98).
  İleri hiç demeyen bir öğretmenle beden yer değiştirmez → bu haliyle bu odada öğretmen olamaz.
- Yorum: Needle telefon uygulaması araç çağırmak için eğitilmiş; mekânsal akıl yürütme alanı dışında ve orada aşırı emin
  (Jev ekosisteminde ölçülen alan-dışı aşırı güvenle aynı). Öğretmen fikri geçerli kalıyor (T0d/T0e bunu kâhinle sınar);
  Needle için iki yol: odanın örnekleriyle ince ayar (platformu, 100–10 000 örnek) ya da Needle'ı mekân değil **dil**
  işlerinde Bob bölgesi olarak kullanmak. Karar Ozyn'in.

## 2026-09-24 — T0 bütün koşullar; tavan ve kapasite tanısı; kısır döngü

- `[ÖLÇÜLDÜ]` T0a/T0b/T0c (kâhin öğretmen; yalnız 0,3 / ödüle eklenmiş 0,3 / yalnız 1,0): yemek 0,31 / 0,31 / 0,34,
  hepsi 0/20 önde, durgun %0, yaşam ~286 tik. Öğretmen hep "ileri" dediği için beyin durmamayı öğreniyor ve aç doğan
  beden açlıktan ölüyor; düşüş tabanı "hayır"ı kısıyor (T0d/T0e sırada).
- **Tavan yanlışmış** `[ÖLÇÜLDÜ]` (kâhin değişkeleri, 10 seed × 5 bölüm): kâhin 12,4; 3 tik gecikmeli 13,3; 4 tik 13,8;
  6 tik 9,9 → **gecikme sorun değil.** "Yemek görünce kâhin, yoksa 10 tiklik rastgele patlamalar" (`seekerPolicy`)
  **25,8** — kâhinin iki katı: kâhinin araması (düz git, duvarda dön) aynı şeritleri tarıyor. Yerinde dönen kâhin 5,4
  → dönerken ilerlemek kritik. Yalnız rastgele patlamalar 2,8. Buna göre: TD 8,38 ≈ %32, E7 3,16 ≈ %12.
- **Kapasite fikstürü** (tasarım değil; öğrenen ağırlıklar elle): yemek ışını → kendi yönünün Git'i w, ayrıca → ileri w.
  w 1: yemek 4,92, yönlendirme 0,33, durgun %74; w 2: 6,01 / 0,47; w 4: 6,23 / 0,60; w 8: 6,83 / 0,63; yaşam ~2 900
  (neredeyse hiç ölmüyor). → Mimari yönü **ifade edebiliyor** (ama öğrenme sınırı wMax = 2); **tok beden dinleniyor**
  (%73 durgun) → yemek/1000 tik homeostatik beyni cezalandırıyor. Yeni ölçüler: ortalama dürtü (açlık² + yara², ölü
  beden son değerinde bölüm sonuna kadar; düşük iyi) ve hayatta kalma oranı. 4 test.
- Üreteçleri zayıflatmak (cpg → Git 0,6 → 0,2) elle kurulmuş beyinde yönlendirmeyi yalnız 0,33 → 0,41 yapıyor.
- **E7 ne öğrendi** `[ÖLÇÜLDÜ]` (20 E7 λ 0,9 deneği): eleştirmen yemek ışınlarına ~0,004 değer vermiş (sabit terim
  −0,078) → "yemek görmek değerli" **öğrenilmemiş**. Yan yemek ışını → Git değişimi: kendi tarafına dönüş +0,57, karşı
  tarafa +0,52, ileri +1,10 → "yemek görünce hareket et" öğrenilmiş, taraf ayrımı yok.
- **Kısır döngü hipotezi:** beden yemeği kovalamadığı için yemek görmek nadiren yemekle biter → eleştirmen yemeği
  değerli bulmaz → doğru yöne dönmek ödüllenmez → beden kovalamaz. TD bunu kırıyor çünkü öğrendiği değerler davranışı
  hemen yönetiyor (%90 sömürü); bizde üreteçler tiklerin ~%40'ında kendi başına seçiyor, öğrenilen ağırlık davranışa
  ancak ~0,2'den sonra karışıyor → **iyileşme döngüsü yok**. Sınama: G koşulları (üreteç → Git 0,3 / 0,2; +bölmeler;
  +iki taraf). Doğum seçeneği `generatorToGo` (0 < g ≤ 0,6), 4 test; g 0,3'te aç yenidoğanların ≥ 8/10'u hâlâ hareket ediyor.
- **Öngörüler (G, koşmadan):** G3 yönlendirme > E7'ninki ve > 0,05; ortalama dürtü E7'den düşük. G2 G3'ten iyi değil
  (çok zayıf üreteç keşfi keser). G3a/G3L'nin G3'ten iyi olması, bölmelerin/iki tarafın ancak döngü kurulunca işe
  yaradığını gösterir.

## 2026-09-24 — Seçim darboğazı toplantısı; M2 sonucu; matematik denetimi (Ozyn)

- Toplantı: vault `forum/beyin0fis/toplantilar/2026-09-24-secim-darbogazi/` — oylama A (tersine tasarım) 40 · D 29 ·
  B 20 · C 9; K1 ön-kayıt 002 askıda, K2 ölçü kalibrasyonu, K4 iki aşamalı deney, K5 rekabetçi seçim önerisi (Ozyn onayı
  bekliyor), K8 "robot beyni" ilkesi Ozyn'e.
- `[ÖLÇÜLDÜ]` M2 (ara katman 64×4): yemek 1,13 (kardeş 1,79), 5/20 önde, yönlendirme −0,013, eğitim 2,11 → 1,42 (düşüyor).
  Kuyruk K4 gereği durduruldu (M2T, M2a koşmadı); öncelik tarama.
- **Ozyn'in matematik şüpheleri ve ölçümler** (E7 λ 0,9 deneği, 40 bölüm, yalnız gözlem):
  1. Bölüm başında silinen kuantum-altı birikim: sinapslarda öğrenmenin **%2,0**'ı, eleştirmende %0,7, eleştirmenin
     yemek özelliklerinde %1,9 → **çürüdü**. Ama eleştirmenin yemek ağırlıkları toplam 4,7 hareket edip net ~0,004'te
     kalıyor → aşırı savrulma.
  2. Eleştirmen adımı normalize değil: ‖x‖² medyan 2,63 (p10 1,30, p90 4,28, en çok 8,06) → etkin adım α·‖x‖² ≈ 0,13;
     TD'nin en iyisi 0,03, TD 0,1'de düşüyor, 0,3'te bozuluyordu → **destekleniyor**. Kod: `CriticParams.normalize`
     (α/max(1, ‖x‖²)), 2 test.
  3. λ 0,9 ≈ 0,5 sn iz; görme → yeme 2–5 sn → taramada λ 0,97 (≈ 1,6 sn).
  4. Yakınlık kodu: yemek ilk görüldüğünde mesafe medyan 2,77 m (p25 1,86, p75 3,69) → kod medyan 0,45, çeyreğinde
     0,26 → **kısmen**: zayıf ama sıfır değil. Alternatif kod henüz denenmedi.
  5. Düşüş tabanı asimetrisi → taramada tabansız.
- Bilgi ölçüsü (Ozyn + bilgi kuramcısı): I(yemek tarafı; dönüş) bit, 2 × 3 tablo (taraf × sol/yok/sağ), yönlendirme
  sayımlarından, bölümler üstünden toplanmış. Kusursuz yönlendirme (ya da kusursuz ters) 1 bit, tek yöne alışkanlık 0,
  bağımsız 0; elle hesaplanan 0,311278 değeriyle testli (6 test).
- Tarama betiği `experiments/screen.ts` (seed 1–5 × iki grup, 40 + 10): A0 E7, A1 normalize eleştirmen (α 0,03),
  A2 tabansız, A3 λ 0,97, A4 üçü, A5 üçü + üreteç 0,3.
- **Öngörüler (koşmadan):** A1 eleştirmenin yemek değerini belirgin büyütür (> 0,02) ama yönlendirmeyi tek başına
  > 0,1'e çıkarmaz; A4 ve A5 içinde en iyisi A5; hiçbiri yönlendirme > 0,2'ye ulaşmaz (asıl darboğaz seçim, K5).

## 2026-09-24 — Dış kaynaklar (Ozyn'in listesi; "merak güdümlü", "oda önemli")

- İndirildi, okundu, çalıştırılmadı (`data/external/refs/`, ayrıntı `refs/INCELEME.md`): MIMo (bebek modeli, MIT),
  explauto (Oudeyer, GPL-3 — yalnız okuma), CURIOUS ve IMAGINE (MIT), pymdp (MIT), flygym / NeuroMechFly v2 ve flybody
  (Apache-2.0), Monty (MIT), c302 + OpenWorm (MIT), Lava (BSD-3/LGPL), Polyworld (APSL-2.0), science_rcn (MIT), iCub (BSD-3).
- Atlandı (lisans): Nengo/Spaun (ticari olmayan), Cortical Labs cl-sdk (CC BY-NC), Verses AI ve Vicarious ürünleri (kapalı).
- Üç fikir: (1) **merak = öğrenme ilerlemesi** (explauto: son yarı pencere yetkinlik ortalaması − önceki yarı; keşif
  ilerlemenin olduğu yere) → rastgele üreteç yerine öğrenmeye bağlı keşif, kısır döngünün adayı; oda çeşitli ve
  öğrenilebilir olmalı; (2) **yön = iki taraflı asimetri** (flygym'de dönüş sol/sağ CPG genlik farkı; solucanda
  zamansal karşılaştırma) → eylem temsili ve M3; (3) **MIMo** Basamak 3 için bebek beden adayı (büyüme, yaşa bağlı
  görme, gecikmeler).
- Tarama ara sonucu `[ÖLÇÜLDÜ]` (10 denek, yeni ölçüler): A0 E7 yönlendirme 0,060 (kardeş 0,003), bilgi 0,031 bit
  (0,008), **ortalama dürtü 0,469 (kardeş 0,718), hayatta kalma %52 (%11)** → E7'nin gerçek kazancı homeostaz;
  A1 normalize eleştirmen: yönlendirme −0,029, dürtü 0,560, hayatta kalma %35 — daha kötü.

## 2026-09-24 — Tarama sonucu (matematik denetimi + G): hiçbiri E7'yi geçmedi

`[ÖLÇÜLDÜ]` seed 1–5 × iki grup, 40 + 10 bölüm. Kardeş: yönlendirme ~0, dürtü 0,72–0,73, hayatta kalma %11–13.

| kod | değişiklik | yönlendirme | bilgi (bit) | ort. dürtü ↓ | hayatta kalma | yemek/1000t | eleştirmen yemek değeri | yemek → Git kendi / karşı taraf |
|---|---|---|---|---|---|---|---|---|
| A0 | E7 (referans) | **0,060** | 0,031 | **0,469** | **%52** | 3,62 | 0,0023 | 0,68 / 0,61 |
| A1 | normalize eleştirmen | −0,029 | 0,028 | 0,560 | %35 | 3,50 | 0,0063 | 0,31 / 0,38 |
| A2 | düşüş tabanı yok | 0,015 | 0,013 | 0,610 | %35 | 2,72 | — | — |
| A3 | λ 0,97 | 0,017 | 0,013 | 0,787 | %14 | 1,69 | — | — |
| A4 | A1+A2+A3 | −0,020 | 0,032 | 0,635 | %28 | 1,77 | 0,0076 | 0,73 / 0,54 |
| A5 | A4 + üreteç 0,3 | −0,002 | 0,028 | 0,776 | %9 | 1,82 | — | — |
| G3 | üreteç 0,3 | 0,031 | 0,019 | 0,523 | %49 | 2,75 | 0,0022 | 0,70 / 0,67 |

- Öngörü karnesi: A1 eleştirmen yemek değeri > 0,02 ✗ (0,006); A1 yönlendirme ≤ 0,1 ✓; "A5 en iyisi" ✗ (en kötülerden);
  "hiçbiri > 0,2" ✓. Toplantı K9'un yanlışlayıcısı (G'de yönlendirme > 0,2) tetiklenmedi → K5 geçerli.
- Yorum: tek tek matematik düzeltmeleri yardımcı olmuyor, çoğu homeostazı bozuyor. Normalize eleştirmen de yemek görmeye
  değer vermiyor — **eleştirmen doğru ölçüyor**: bu politikayla yemek görmek gerçekten yemeği öngörmüyor. Kısır döngü
  mekanik bir hata değil, yapısal: davranış iyileşmeden değer oluşmuyor, değer oluşmadan davranış iyileşmiyor.
- E7'nin gerçek kazancı **homeostaz** (dürtü 0,72 → 0,47, hayatta kalma %11 → %52); yön ≈ 0,06 (10'da 6 denek > 0).

## 2026-09-25 — S1: rekabetçi seçim — Ozyn onayı; kod; kapasite; tarama öncesi

- Ozyn (TASARIM-005): K5 evet (S1'den başla), K8 **serbest** (bölge içi öğrenme kuralında çalışan mühendislik
  yöntemleri kullanılabilir), oda: **ikinci öğrenilecek şey eklenecek** (S1'den sonra).
- Kod: `learning/selection.ts` — eksen başına rekabet (itme {ileri, geri, dur}, dönüş {sol, sağ, dur}); önem =
  Σ (Git − Gitme)·duyu + vigor·açlık + gürültü·(renkli gürültü − ½); dur = restBias; kazanan en yüksek önem, %5 keşif.
  Öğrenen ağırlıklar canlı grafikten okunur (defterdeki her değişiklik seçimi anında etkiler). Eligibility doğrudan:
  bu tikin duyusu × bu tikte seçilen eylem (`Learner.updateEligibilityDirect`). Ajan seçeneği `selection`; ölçüm
  gecikmesi seçimle 0 tik; kardeş de aynı seçimle değerlendirilir. 20 test, 12 mutantın 11'i öldü (kalan eşdeğer:
  explore 0'da `<` / `<=`, olasılık 2⁻³²).
- Kalibrasyon `[ÖLÇÜLDÜ]` (5 seed × 5 bölüm, yenidoğan): vigor 1 → durgun %11, hayatta kalma %4; **vigor 0,5 / dur 0,3 →
  durgun %22, hayatta kalma %12** (grafik yenidoğan %48 / %8) → varsayılan.
- **Kapasite** `[ÖLÇÜLDÜ]` (elle yemek → Git ağırlıkları, fikstür): seçimle w 0,3 → yönlendirme **0,26**, dürtü 0,16,
  hayatta kalma %80; w 1 → 0,66 / 0,06 / %96; w 2 → **0,79** / 0,03 / %96. Grafik beyin w 2'de 0,52 / 0,12 / %88.
  → Öğrenilen küçük değerler artık davranışa dönüşüyor: iyileşme döngüsünün önkoşulu sağlandı.
- Tarama: S1 (E7 öğrenmesi + seçim), S1n (+ tabansız), S1a (+ eylem bölmeleri), S1c (+ normalize eleştirmen).
- **Öngörüler (koşmadan; TASARIM-005 ölçütü):** S1 yönlendirme > 0,2, ortalama dürtü < 0,47, eleştirmenin yemek
  değeri > 0,02. S1a ve S1c S1'den iyi (döngü kurulunca eylem başına öğretme ve düzgün eleştirmen işe yarar).

## 2026-09-25 — S1 tarama sonucu: ilk gerçek ilerleme

`[ÖLÇÜLDÜ]` seed 1–5 × iki grup, 40 + 10 bölüm; kardeşler aynı seçimle (öğrenmeden) değerlendirildi.

| kod | yönlendirme (> 0) | bilgi (bit) | ort. dürtü ↓ | hayatta kalma | yemek/1000t | eleştirmen yemek | yemek → Git kendi / karşı |
|---|---|---|---|---|---|---|---|
| kardeş (seçimle) | 0,007 | 0,004 | 0,848 | %3 | 2,24 | — | — |
| A0 E7 (grafik) | 0,060 (6/10) | 0,031 | 0,469 | %52 | 3,62 | 0,0023 | 0,68 / 0,61 |
| **S1** seçim | 0,104 (6/10) | **0,121** | 0,267 | %70 | 4,66 | 0,0051 | 0,57 / 0,41 |
| S1a + eylem bölmeleri | −0,049 (3/10) | 0,056 | 0,673 | %23 | 1,91 | 0,0075 | 0,24 / 0,23 |
| S1c + normalize eleştirmen | −0,022 (5/10) | 0,082 | 0,437 | %51 | 5,47 | 0,0043 | 0,63 / 0,69 |
| **S1n** + tabansız | **0,131 (8/10)** | 0,077 | **0,190** | **%83** | 5,46 | 0,0033 | **0,59 / 0,39** |

- Öngörü karnesi (TASARIM-005 ölçütü): S1 dürtü < 0,47 ✓ (0,27); yönlendirme > 0,2 ✗ (0,10 / S1n 0,13); eleştirmen
  yemek değeri > 0,02 ✗ (~0,005). "S1a ve S1c S1'den iyi" ✗ — ikisi de kötüleştirdi (üçüncü kez: eklenen parça zarar).
- Yorum: rekabetçi seçim homeostazı büyük ölçüde iyileştirdi ve **taraf ayrımı ilk kez öğreniliyor** (kendi tarafı
  0,59 vs karşı 0,39). Eleştirmen hâlâ yemeğe değer vermiyor → ayrım yemek anındaki ödülden, eleştirmen köprüsünden değil.
  Düşüş tabanı S1'de zararlı (E7'de değildi): tabansız S1n en iyi.
- Sonraki: S1n doğrulama (20 denek + CROSS), sonra oda 2 (R1n), sonra S2 (merak).

## 2026-09-25 — S1n doğrulama (20 denek + CROSS) ve oda 2

`[ÖLÇÜLDÜ]` S1n = E7 öğrenmesi + rekabetçi seçim, düşüş tabanı yok. Doğrulama seed 1–10 × iki grup; oda 2 tarama
(seed 1–5 × iki grup; 10 yemek + 2 tehlike bölgesi). Teşhis `diagnose.ts`.

| koşul | yönlendirme (> 0) | bilgi (bit) | ort. dürtü ↓ (öğrenen < kardeş) | hayatta kalma | zarar/1000t | yemek → Git kendi / karşı (kendi > karşı) |
|---|---|---|---|---|---|---|
| kardeş (seçimle, öğrenmeyen) | 0,003 | 0,003 | 0,842 | %3 | — | — |
| **S1n doğrulama** | **0,133 (16/20)** | 0,067 | **0,318 (16/20)** | **%67** | — | **0,435 / 0,267 (16/20)** |
| S1n CROSS (dopamin başka bölümden) | 0,004 (13/20) | 0,010 | 0,813 (10/20) | %6 | — | 0,014 / 0,010 (11/20) |
| oda 2 kardeş | ~0,01 | 0,010 | 0,94 | %1 | 0,43 | — |
| **R1n** oda 2, S1n | 0,023 (5/10) | 0,099 | **0,661 (8/10)** | **%24** | **0,06** | 0,55 / 0,51 (6/10) |
| R0 oda 2, E7 | −0,007 (3/10) | 0,035 | 0,960 (2/10) | %6 | 0,62 | 0,31 / 0,36 (3/10) |

- **S1n gerçekten öğreniyor:** kardeşten iyi (dürtü 16/20, yönlendirme 16/20 > 0) VE CROSS'ta kazanç tamamen kayboluyor
  (dürtü 0,813 ≈ kardeş 0,842; taraf ağırlıkları ~0). İki kontrolün ikisinden de geçen ilk mekanizma.
  Taraf ayrımı 20 deneğin 16'sında. Eleştirmen hâlâ yemeğe değer vermiyor (0,0014).
- **Oda 2 (tehlike açık):** S1n zararı kardeşin ~1/7'sine indiriyor (0,06 vs 0,43), hayatta kalma %1 → %24 — kaçınma
  öğreniliyor gibi; ama yemekte zayıflıyor (2,12 vs kardeş 3,34) ve yön öğrenmesi oda 2'de neredeyse yok (0,023).
  E7 oda 2'de kardeşten kötü. → İki zıt şeyi birlikte öğrenmek zor; oda 2 doğrulama + CROSS gerekli.
- Doğrulama koşusu kayıt kilidinden önce başladığı için kilitsiz koştu (eski kod); sonraki koşular kilitli.

## 2026-09-25 — "S1n öğreniyor" iddiasını çürütme denemesi — koşmadan önce

Ozyn: "Birşeyden emin olmak büyük bir adım. Bilim için önce bu testleri çürütmeye çalışalım." Haklı: S1n, dört aday
arasından seed 1–5'te en iyi olduğu için seçildi ve aynı bölgede (1–10) doğrulandı — kazananın laneti riski.

- Araçlar: `experiments/stats.ts` (işaret testi ve Wilcoxon işaretli sıralar; bağsız n ≤ 30'da kesin dağılım — değerler
  bağımsız olarak tüm işaret desenleri sayılarak hesaplandı, 13 test), `localDopamine` (LOCAL kontrol: dopamin aynı
  bölümden 200 tik geç — yavaş değişkenler korunur, eylem–sonuç bağı kırılır), `lesionClone` (öğrenilmiş ağırlıkları
  doğum değerine döndüren, defterli klon). 8/8 + 1 mutant öldü. Betik: `experiments/falsify-s1n.ts`.
- **Öngörüler — iddia doğruysa** (çürütme ölçütü parantezde):
  - F1 taze seed'ler 11–20 × iki grup: öğrenen dürtüsü kardeşten düşük ≥ 15/20 ve Wilcoxon p < 0,01; yönlendirme > 0
    ≥ 14/20 (çürütür: ≤ 12/20 ya da p > 0,05).
  - F2 LOCAL: kazancın çoğu kaybolur — LOCAL dürtüsü ≥ 0,6 (kardeş ~0,84; S1n ~0,3) (çürütür: LOCAL ≈ öğrenen →
    öğrenme yavaş eşleşmelerden).
  - F3 CROSS adil mi: CROSS'ta defter ağırlık kaydı öğrenenin en az %30'u (değilse CROSS zayıf bir kontrol; F2 önem kazanır).
  - F4 yemek lezyonu dürtüyü kardeşe yaklaştırır (≥ 0,6), duvar lezyonu öğrenenin 0,1'i içinde kalır (çürütür: yemek
    lezyonu etkisiz → kazanç başka yerden).
  - F5 öğrenen–CROSS, öğrenen–LOCAL, öğrenen–yemek lezyonu farkları p < 0,01; duvar lezyonu p > 0,05.
  - F6 yemek 5 ve 15: öğrenen dürtüsü kardeşten düşük ≥ 7/10 her odada (yemek 5'te E7 başarısızdı — orada tutmayabilir).
  - F7 eğitim yemeği son blokta ilk bloktan yüksek.
  - F8 iki grupta da öğrenen dürtüsü kardeşten düşük ≥ 7/10.

## 2026-09-25 — Çürütme denemesi sonucu: "öğreniyor" kısmen ayakta, "yön öğreniyor" çürüdü

`[ÖLÇÜLDÜ]` `falsify-s1n.ts`, taze seed'ler 11–20 × iki grup (S1n'in hiç görmediği).

| | ort. dürtü ↓ | hayatta kalma | yönlendirme | bilgi (bit) | yemek/1000t |
|---|---|---|---|---|---|
| kardeş | 0,845 | %2 | 0,015 | 0,003 | 2,20 |
| **öğrenen** | **0,480** | **%45** | 0,048 | 0,119 | 3,36 |
| CROSS | 0,827 | %6 | 0,000 | 0,003 | 1,28 |
| LOCAL (aynı bölüm, 200 tik geç) | 0,878 | %1 | −0,001 | 0,003 | 0,70 |
| yemek lezyonu | 0,574 | %34 | 0,001 | 0,013 | 2,55 |
| duvar lezyonu | 0,490 | %43 | 0,091 | 0,074 | 4,63 |

Eşleştirilmiş testler (20 denek, pozitif = öğrenen iyi): dürtü öğrenen–kardeş 17/20, Wilcoxon p = 0,00026 · öğrenen–CROSS
17/20, p = 0,0014 · öğrenen–LOCAL 18/20, p = 0,0001 · **yönlendirme öğrenen–kardeş 10/20, p = 0,52** · yemek lezyonu 13/20,
p = 0,33 · duvar lezyonu 11/20, p = 0,93. Diğer odalar: yemek 5'te 9/10 (p = 0,014), yemek 15'te 7/10 (p = 0,027).
Gruplar: reflekssiz 10/10 (yönlendirme 0,10), refleksli 7/10 (yönlendirme −0,005). Defter kaydı/denek: öğrenen 37 152,
CROSS 8 833 (%24), LOCAL 3 506 (%9). Eğitim yemeği blokları 4,07 → 3,98 → 3,86 → 3,58.

**Öngörü karnesi:** F1 dürtü ✓ (17/20, p < 0,001) · F1 yönlendirme ✗ (10/20; ölçüt ≥ 14/20) · F2 LOCAL ✓ (0,878 ≥ 0,6) ·
F3 CROSS adil mi ✗ (%24 < %30; LOCAL %9) · F4 yemek lezyonu ✗ (0,574 < 0,6; p = 0,33) · F4 duvar lezyonu ✓ · F5 kontroller ✓,
yemek lezyonu ✗ · F6 ✓ (ikisi de ≥ 7/10) · F7 ✗ (yemek/1000t düşüyor — ama bu ölçü tokken dinlenmeyi cezalandırıyor,
eğri için yanlış ölçü seçmişim) · F8 ✓ (refleksli sınırda).

**Geri alınanlar (açıkça):**
- "S1n yönü öğreniyor" — **çürüdü.** Taze seed'lerde yönlendirme 0,048, kardeşten farkı şans düzeyinde (p = 0,52). 1–10'daki
  0,13 büyük olasılıkla seçim yanlılığıydı (kazananın laneti).
- "Kazanç yemek → Git bağlantılarında" — **çürüdü.** Yemek lezyonu kazancın yalnız ~%25'ini götürüyor, anlamlı değil.

**Ayakta kalan (bu testlerden geçti, "kanıtlandı" değil):** S1n'in homeostazı iyileştirmesi gerçek ve eylem–sonuç
zamanlamasına bağlı: taze seed'lerde, iki odada daha, iki grupta; CROSS ve LOCAL'de tamamen kayboluyor.

**Açık kuşku (F3):** kontrollerde plastisite öğrenenin %9–24'ü. Kontroller "yanlış zamanlı öğrenme" değil kısmen "az öğrenme"
olabilir — öğrenen daha uzun yaşadığı için daha çok kayıt yazıyor olabilir (tik başına oran ölçülmedi). Bu kuşku giderilmeden
"zamanlamaya bağlı" demek güçlü bir iddia.

## 2026-09-25 — Ek lezyonlar: kazanç tek bir yolda değil

`[ÖLÇÜLDÜ]` Aynı 20 taze-seed öğreneni; öğrenilmiş ağırlıklar seçilen duyulardan doğuma döndürüldü (defterli klon),
değerlendirme aynı seçimle. Öğrenen dürtüsü 0,480, kardeş 0,845.

| sökülen | dürtü | öğrenenden kötü | Wilcoxon p |
|---|---|---|---|
| iç duyu (açlık, yara) | 0,488 | 11/20 | 0,87 |
| beden duyusu (propriosepsiyon) | 0,572 | 13/20 | 0,058 |
| dokunma | 0,467 | 9/20 | 0,85 |
| tüm ışınlar (duvar, yemek, tehlike) | 0,606 | 10/20 | 0,26 |
| **öğrenilen her şey** | **0,845** (= kardeş) | 17/20 | 0,00026 |

- Hiçbir tek duyu grubu kazancı götürmüyor; hepsi birlikte sökülünce beyin tam olarak kardeşe dönüyor (sağlama ✓: kazancın
  tamamı öğrenilen ağırlıklarda). En büyük pay ışınlar (~%35) ve beden duyusu (~%25; p = 0,058 sınırda).
- Yorum (sınanmadı): öğrenilen, "yemeğe dön" gibi tek bir kural değil; birçok duyuya dağılmış, birbirini yedekleyen bir
  "ne zaman hareket et / ne zaman dur" düzenlemesi. Bu, yönlendirmenin şans düzeyinde kalmasıyla tutarlı.

## 2026-09-25 — Laboratuvar paralel; F3 kuşkusu (plastisite) — tik başına ölçüm ve karıştırma kontrolü

- `npm run exp -- tara|dogrula|curut|teshis|liste`, koşul kataloğu `experiments/conditions.ts`, iş havuzu (worker
  thread'ler; paralel = sıralı, testli), sonuç tablosu `data/results.jsonl` (DuckDB ile sorgu). `curut S1n` eski
  betiğin bütün sayılarını birebir tekrarladı; 386 sn (eski paket + ek lezyonlar ~1 835 sn).
- `[ÖLÇÜLDÜ]` Tik başına plastisite (DuckDB, taze-seed koşuları): öğrenen 0,512 kayıt/tik (73 586 eğitim tiki),
  CROSS 0,219 (39 964), LOCAL 0,099 (37 462). → Kontroller hem yarı süre yaşıyor hem tik başına daha az kayıt yazıyor
  (ilişkisiz dopaminde bekleyen değişimler birbirini götürür — beklenen, ama "kazanç yalnız değişim miktarından mı?"
  sorusunu açık bırakıyor).
- Yeni kontrol `shuffledClone` (KARIŞIK): öğrenenin öğrendiği değişimler öğrenen bağlantılara rastgele dağıtılır —
  aynı miktar ve dağılım, yanlış bağlantılar. 2 test. `curut` paketine eklendi.
- **Öngörü (koşmadan):** kazanç neyin öğrenildiğine bağlıysa KARIŞIK dürtüsü ikize yaklaşır (≥ 0,7) ve öğrenenden kötüdür
  ≥ 15/20 (çürütür: KARIŞIK ≈ öğrenen → kazanç yalnız değişim miktarından).

## 2026-09-25 — KARIŞIK kontrol sonucu ve T1 (S1n + öğretmen) — koşmadan önce

- `[ÖLÇÜLDÜ]` KARIŞIK (20 taze-seed S1n öğreneni): dürtü **0,700** (öğrenen 0,480, ikiz 0,845); öğrenenden kötü 15/20,
  Wilcoxon p = 0,019; ikizden iyi 12/20, p = 0,036. Öngörü ✓ ama sınırda (0,700 ≥ 0,7; 15/20 ≥ 15/20).
  → Kazancın ~%60'ı **hangi bağlantının** öğrendiğine bağlı; ~%40'ı yalnız değişimin miktarından/genel yönünden
  (muhtemelen genel bir hareket eğilimi). "Öğreniyor" iddiası ayakta, ama kısmen "daha hareketli oldu" etkisi de var.
- **T1 — yön teşhisi** (3. adım): S1n seçimiyle kâhin öğretmen. İlk öğretmen denemesinde (T0) seçim öğreneni davranışa
  çeviremiyordu; artık çeviriyor (kapasite w 0,3 → yönlendirme 0,26). Koşullar: T1only (yalnız öğretmen, kazanç 0,3),
  T1add (ödül + öğretmen). Tarama, seed 1–5 × iki grup.
- **Öngörüler (koşmadan) ve ne anlama gelecekleri:** yön temsil edilebiliyorsa (sorun kredi atamada) T1only yönlendirme
  **> 0,3**; T1add da > 0,2. T1only yönlendirme < 0,1 kalırsa → sorun temsilde/seçimde, sıradaki aday S3 (iki taraflı
  dönüş). T1only'de beden yine durmadan açlıktan ölebilir (kâhin hep "ileri" der) — dürtü kötü olabilir; T1add bunu dengeler.

## 2026-09-25 — T1 sonucu: yön öğrenilebilir; sorun kredi atamada

`[ÖLÇÜLDÜ]` tarama, seed 1–5 × iki grup, S1n seçimi.

| | yönlendirme (> ikiz) | bilgi (bit) | ort. dürtü ↓ | hayatta | yemek/1000t |
|---|---|---|---|---|---|
| ikiz | 0,007 | 0,004 | 0,848 | %3 | 2,24 |
| S1n (yalnız ödül) | 0,131 (7/10) | 0,077 | 0,190 | %83 | 5,46 |
| **T1only** (yalnız kâhin öğretmen, 0,3) | **0,241 (10/10, p = 0,002)** | **0,175** | 0,233 | %66 | **17,23** |
| T1add (ödül + öğretmen) | 0,177 (9/10, p = 0,006) | 0,116 | 0,335 | %64 | 11,16 |

- Öngörü karnesi: T1only > 0,3 ✗ (0,241); T1add > 0,2 ✗ (0,177); "T1only < 0,1 ise sorun temsilde" — **olmadı**.
  T1only'nin açlıktan öleceği endişesi ✗ (hayatta %66 — seçim artık tokken dinlenmeyi koruyor).
- **Teşhis:** aynı beyin, aynı seçim, aynı öğrenme kuralıyla, yoğun ve doğru bir sinyal verildiğinde yönü öğreniyor
  (10/10) ve TD'nin iki katı yiyor (17,2 vs 8,4; tavan 25,8). → **Temsil ve seçim yeterli; darboğaz kredi atamada:**
  seyrek homeostatik ödülden (yemek anı) "hangi yöne döndüm" bilgisi çıkarılamıyor. Eleştirmen yemek görmeye değer
  vermediği için (≈ 0,001) köprü kurulmuyor.
- Ödül + öğretmen (T1add) yalnız öğretmenden kötü: ödülün gürültüsü öğretmenin sinyalini sulandırıyor.
- Teşhis (`diagnose.ts`): yan yemek ışını → Git, kendi tarafı / karşı taraf: **T1only 1,32 / 0,28 (10/10)**, T1add
  1,24 / 0,27 (10/10), S1n 0,59 / 0,39 (8/10). Eleştirmenin yemek değeri üçünde de ~0.
- Süreç notu: paralel hata yeniden üretimi sırasındaki 1 bölümlük deneme koşuları `screen-S1n-summary.json`'ın üzerine
  yazmıştı (teşhis yanlış sayı gösterdi: 0,020 / 0,012). S1n taraması yeniden koşuldu — bit-aynı sonuç — ve bekçi eklendi:
  standart dışı bölüm sayılı koşular ayrı dosya adına yazılır. `results.jsonl`'da S1n taraması artık iki kez var (aynı
  sayılar); sorgularda `learner` üzerinden tekilleştirilmeli.
- Sonraki adayların sırası buna göre: S2 (merak / öğrenme ilerlemesi, iç ödül) ya da yemeğe yaklaşmayı ödüllendiren
  içsel bir tahmin sinyali (eleştirmenin köprüsünü kurmak) — S3 (iki taraf) artık öncelikli değil. Öğretmen burada
  tasarım değil, teşhis aracı (kâhin elle yazılı); Bob bölgesi olarak öğretmen fikri ayrıca değerlendirilebilir.

## 2026-09-24 — Seri 004 / M3: iki taraf — koşmadan önce (keşif)

- Kod: yeni bölge `lat` (6 nöron: duvar/yemek/tehlike × sol/sağ). Doğuştan: her taraftaki ışın kendi tarafının hücresini
  +1 uyarır, karşı tarafınkini −1 baskılar; orta ışın bağlı değil → hücre "kendi tarafı ne kadar fazla görüyor"u verir
  (relu). Yollar P15 (duyu → lat, doğuştan), P16/P17 (lat → Git/Gitme, öğrenir). Doğrudan duyu yolu **kalır** (M3 ekler,
  değiştirmez); öğrenen ağırlıklar rastgele akışın sonuna eklenir → düz yenidoğanın ağırlıkları birebir aynı kalır
  (testli). Hangi farkın hangi dönüşe bağlanacağı öğrenilir. Testler 8 yeni, 6/6 mutant öldü.
- Süreç notu: bir testteki düzenli ifadenin `\\d`'si bash heredoc'ta `\d`'ye indi ve şablon dizgisinde "d" oldu; test
  yanlış yerde patladı, Edit ile düzeltildi (hafızadaki kaçış dizisi kazası — yine).
- Koşullar: M3 (iki taraf), M3T (iki taraf + kâhin öğretmen), M3a (iki taraf + eylem bölmeleri), M23 (ara katman + iki taraf).
- **Öngörüler (koşmadan):** M3 dönüş yönü > 0,55 (fark sinyali doğrudan "hangi taraf" diyor; öğrenilecek tek şey işaret).
  M3T > M3. M23 ~ M3.

## 2026-09-25 — Deney Odası; motorlar arası yuvarlama farkı; defter hızı

- **Ozyn'in eleştirisi:** ilk deney panosu "aşırı kullanışsız", "hiçbir şey anlaşılmıyor, test edemiyorum, sadece veriler
  var". Doğru: sayfa sayı döküyordu, hiçbir şeyi denetlemeye ya da anlamaya izin vermiyordu. Yeniden yapıldı:
  - **Deney Odası** (`viewer/deney-odasi.html`, `npm run lab` ilk bunu açar). Bir deney, sonra bir denek seçiliyor.
    Öğrenen ile ikizi, deneyde ölçülen 10 değerlendirme odasını yan yana yaşıyor. Her oda bitince öğrenenin ve ikizin
    ortalama dürtüsü, yemeği ve hayatta kalıp kalmadığı yazılıyor. Kayıtla eşleşme de odanın son dünya imzasıyla
    denetleniyor.
  - **Rehber** (`viewer/guide.html`): her terim ve sayı için ne olduğu, nasıl okunduğu, hedef ve gerekçesi. Tek kaynak
    `viewer/guide.ts`. Sayfalardaki "?" işaretleri buraya bağlı; bir test, bağlanan her terimin rehberde olduğunu
    denetliyor.
  - **Sonuçlar** sayfası: her deneye bir karar etiketi eklendi (eşleştirilmiş Wilcoxon, p < 0,05; kontrol satırlarında
    beklenen, kazancın kaybolması). Her sütun başlığında açıklama var.
- `[ÖLÇÜLDÜ]` **Motorlar arası yuvarlama farkı.** DNK-2747'nin oda 1'i Node'da (v26.4.0) ve Edge'in tarayıcı motorunda
  koşturuldu. İlk ayrılık 706. tikte çıktı: `body.vx` 0,20811514376685938 ile …936, yani son bitte fark var. Konum,
  yön ve enerji o tikte aynıydı. Kaynak `Math.cos`: iki JavaScript motoru son biti farklı yuvarlıyor.
  - Sonuç: dünya **aynı motor içinde** bit bit tekrarlanabilir, motorlar arasında değil. Oda 2'nin son hali farklı
    çıktı; yemek sayısı ve süre aynı kaldı.
  - Karar: beyinler sunucuda, deneyin koştuğu Node motorunda yaşıyor. Tarayıcı yalnız "film"i çiziyor
    (`viewer/arena.ts` `filmRoom`).
  - Denetim: DNK-2747 ve ikizi, 10 odanın 10'unda kayıtla birebir aynı çıktı. Ortalama dürtü öğrenen 0,04, ikiz 0,64;
    `results.jsonl` ile aynı.
  - İleride: koşu kayıtlarına Node sürümü de yazılmalı (şu an yalnız commit yazılıyor). Bir kayıt başka bir Node
    sürümünde yeniden oynatılırsa son bitte ayrılabilir.
- `[ÖLÇÜLDÜ]` **Defter hızı.** 666.370 kayıtlı bir defterin açılması 55,2 s'den 1,3 s'ye indi. Eskiden her kayıtta bütün
  beyin kopyalanıp denetleniyordu. Artık ağırlık kayıtları kenar dizini üzerinden yerinde uygulanıyor; yapısal kayıtlar
  eskisi gibi tam kopya + denetimden geçiyor. Dışarıya verilen grafik yine hiç değişmiyor.
  - Gerçek veride beyin imzası eski ve yeni kodda aynı (`633062a8`). 10 yeni test yazıldı, 6/6 mutant öldü.
- Panonun tüm yeni kodu: 1116/1116 test, mutasyon 18/18 + 19/19 + 6/6.

## 2026-09-25 — Seri 005a: bağlı kontrol (yoked) — koşmadan önce

- **Ozyn'in eleştirisi (doğru):** "Rastgele motor bile yeterince çalışınca yemek yiyebiliyor, bu böyle olmamalı."
  Denekler izlendiğinde yemeğe yönelmiyor, rastgele dolaşıyor görünüyor.
  - Odada 10 yemek var ve yenen yemek hemen başka yerde çıkıyor. Böyle bir odada dolaşan her beden yemeğe çarpar.
  - İkiz ise çoğunlukla kıpırdamıyor. Bu yüzden "ikizden iyi" demek "hareket etmeyi öğrendi" demekten fazlası
    değil. Panodaki "Öğrendi" etiketi bu yüzden abartılıydı.
- **Yeni kontrol, bağlı beden** (`experiments/yoked.ts`, nörobilimdeki yoked control). Değerlendirme odası k'da
  deneğin oda k+1'deki hareketlerini gözü kapalı tekrar oynar: hareket miktarı, patlamalar ve duraklamalar aynı,
  gördüğüyle bağı yok. Testler: 11, hepsi geçti.
- **Soru:** Mevcut denekler bağlı bedenlerini geçiyor mu? Aynı donmuş beyinler aynı 10 değerlendirme odasında yeniden
  yaşatılıyor. Yeniden ölçümün kayıtlı değerle birebir aynı çıkması şart (denetim).
- **Öngörüler (koşmadan):**
  - (a) S1n, yemek/1000 tikte bağlı bedenini anlamlı geçemez (Wilcoxon p > 0,05): yemek kazancı yalnız hareketten.
  - (b) S1n, ortalama dürtüde bağlı bedenini geçer (p < 0,05): duraklamalarını açlığına göre zamanlıyor, bağlı beden
    rastgele zamanda duruyor. Bu, iç duyuyu kullanan gerçek bir öğrenme olur ama yemekle ilgili değildir.
  - (c) T1only, yemek/1000 tikte bağlı bedenini açıkça geçer (≥ 9/10, p < 0,01), çünkü yönlendirmesi 0,24.
  - (d) Bağlı bedenlerin yönlendirmesi ~0 (|ortalama| < 0,03). Kontrolün kendisinin denetimi.
  - (e) Refleksli S1n, bağlı bedenini reflekssizden daha sık geçer. Çarpınca dönme refleksi duyuya bağlı bir
    davranış, bağlı bedende yok.

## 2026-09-25 — Seri 005a sonucu: denekler yemeğe dair tek bir karar öğrenmiş — "önündeyse ileri"

`[ÖLÇÜLDÜ]` Her donmuş beyin, 10 değerlendirme odasında yeniden yaşatıldı. Yeniden ölçüm, kayıtlı değerle 60/60 birebir
aynı çıktı. Bağlı beden aynı hareketleri başka odada, kör olarak tekrar oynadı. Denek başına bir satır sayıldı: S1n
taraması iki kez koşulmuştu (aynı seed'ler, bit-aynı beyinler); ilk sayımda n yanlışlıkla 20'ydi, düzeltildi.

| koşul | yemek/1000t öğr · bağlı | yemek/1000 hareketli tik | dürtü öğr · bağlı | yönelme öğr · bağlı | yönlendirme öğr · bağlı | çarpma/1000t |
|---|---|---|---|---|---|---|
| S1n tara (n 10) | 5,46 · 2,68 (9/10, p 0,006) | 15,1 · 7,1 (9/10) | 0,19 · 0,59 (9/10) | 0,33 · 0,17 (10/10, p 0,002) | 0,13 · 0,01 (7/10, p 0,05) | 50 · 49 |
| S1n taze seed (n 20) | 3,36 · 1,95 (14/20, p 0,014) | 10,6 · 5,9 (14/20) | 0,48 · 0,70 (16/20) | 0,28 · 0,16 (19/20, p 1e-5) | 0,05 · 0,00 (p 0,13) | 94 · 104 |
| T1only (n 10) | 17,2 · 8,1 (10/10) | 18,3 · 8,8 | 0,23 · 0,41 | 0,58 · 0,28 | 0,24 · 0,00 (10/10) | 63 · 58 |
| T1add (n 10) | 11,2 · 6,5 (9/10) | 13,8 · 7,9 | 0,34 · 0,47 | 0,48 · 0,26 | 0,18 · −0,01 (9/10) | 67 · 69 |

- **Öngörü karnesi:**
  - (a) ✗ S1n, yemekte bağlı bedenini geçiyor (9/10; taze seed'de 14/20).
  - (b) ✓ Dürtüde de geçiyor.
  - (c) ✓ T1only 10/10, p 0,002.
  - (d) ✓ Bağlı bedenlerin yönlendirmesi en fazla |0,016|; kontrol sağlam.
  - (e) ✗ Refleksli grup taze seed'de bağlı bedenini yemekte geçemiyor (5/10), reflekssiz geçiyor (9/10).
  - Ara hipotezim ("kazanç duvardan kaçmaktan") de ✗: çarpma sayıları eşit.
- **Okuma:**
  - S1n yemek başına iki kat verimli, çünkü yemek görüş alanındayken ona doğru hareketi bağlı bedenin iki katı sık
    yapıyor (yönelme). Bu yönelme neredeyse tamamen "yemek tam öndeyse ileri git". Yana dönme yönlendirmesi taze
    seed'lerde şansta. Öğrenilen bağlantılarda da ışın 2 yemek → ileri +2 görünüyor.
  - Yani Ozyn'in gözlemi dönüşler için doğru: dönüşler yemeğe göre rastgele. "Hiçbir şey öğrenmemiş" ise tam doğru
    değil; tek bir karar öğrenilmiş. Buna açlığa göre hareket etme/durma eşlik ediyor.
  - Refleksli grup: taramada iyi (çarpma 26/1000t), taze seed'lerde duvara çok çarpıyor (118/1000t) ve yemekte bağlı
    bedenini geçemiyor. Refleks bazı doğumlarda işe yarıyor, bazılarında yaramıyor. Ozyn'in "fena değil ama eksik"
    gözlemiyle tutarlı; ayrı izlenecek.
- **Panodaki "Öğrendi" etiketi** yalnız ikize göre verilmişti. Ölçüt değişecek: bağlı bedene göre ve ne öğrendiğini
  söyleyerek.

## 2026-09-25 — Seri 005b ayarı: rastgelenin kazanamadığı oda

`[ÖLÇÜLDÜ]` Beyinsiz, elle yazılmış gövdeler; seed 1–10 × 10 değerlendirme odası; tehlike yok.
- kör: 10 tiklik rastgele patlamalar.
- ön: kör + "yemek tam öndeyse ileri", yani S1n'in öğrendiği.
- arayıcı: gördüğü yemeğe döner.
- kâhin.

| yemek | enerji | kör yemek · hayatta | ön | arayıcı | kâhin |
|---|---|---|---|---|---|
| 10 | 0,4 | 2,68 · %3 | 19,7 · %99 | 26,8 · %100 | 12,6 · %51 |
| 5 | 0,4 | 1,26 · %0 | 10,9 · %81 | 14,9 · %89 | 4,2 · %12 |
| 3 | 0,4 | 0,64 · %0 | 6,7 · %46 | 8,8 · %60 | 1,9 · %4 |
| 5 | 0,8 | 1,43 · %1 | 10,8 · %81 | 15,2 · %92 | 3,9 · %12 |
| 3 | 0,8 | 0,81 · %0 | 6,5 · %60 | 8,9 · %65 | 1,6 · %4 |

- **Büyük bulgu:** 10 yemekli odada "önündeyse ileri + kör dolaşma" tavana yakın (19,7 · %99). Oda yana dönmeyi hiç
  gerektirmiyor. Beyin en kolay işe yarayan kararı öğrendi ve orada kaldı; öğrenmeye çalıştığımız şeyi oda
  istemiyordu.
- 5 yemekte kör beden ölüyor (%0–1). Görüşü kullanan gövdeler yaşıyor. Yana dönmenin katkısı hâlâ küçük:
  ön %81, arayıcı %89–92.
- Ozyn'in enerji önerisi: 0,8 enerji kör bedeni kurtarmıyor (%1), öğrenmeye zaman kazandırıyor → uygun.
- **Seçim (koşmadan önce konan ölçüt: kör hayatta ≤ %5 ve arayıcı hayatta ≥ %80):** yemek 5, enerji 0,8, tehlike yok →
  **ROOM3** ("kıt oda"). Yana dönmeyi gerçekten zorunlu kılan oda ayrı bir iş; bu oda "rastgele kazanamaz" şartını
  karşılıyor.
- **Seri 005b öngörüleri (koşmadan; S1n ve T1only, ROOM3, seed 1–5 × iki grup, bağlı kontrol otomatik):**
  - (a) S1n öğrenenleri dürtüde bağlı bedenlerini geçer (≥ 8/10).
  - (b) S1n hayatta kalma > %30.
  - (c) S1n yana dönme yönlendirmesi yine şans düzeyinde kalır (< 0,05).
  - (d) T1only her ölçüde S1n'den iyi.
  - (e) Refleksli ve reflekssiz ayrı raporlanır; yön öngörüsü yok.

## 2026-09-25 — Seri 005b sonucu: kıt odada S1n rastgeleyi geçiyor ama basit kuralın çok altında

`[ÖLÇÜLDÜ]` ROOM3 (5 yemek, enerji 0,8), seed 1–5 × iki grup, 40 eğitim + 10 değerlendirme; kod `9ca10ca`.

| | dürtü | hayatta | yemek/1000t | yönlendirme |
|---|---|---|---|---|
| S1n öğrenen (K1n) | 0,425 | %39 | 2,12 | 0,114 |
| S1n bağlı beden | 0,647 | %7 | 0,73 | −0,002 |
| KT1 öğrenen (yalnız öğretmen) | 0,153 | %72 | 9,46 | 0,258 |
| KT1 bağlı beden | 0,536 | %19 | 4,15 | −0,007 |
| ikiz (ortak) | 0,755 | %0 | 1,00 | 0,006 |
| elle: kör / ön / arayıcı (ayar) | — | %1 / %81 / %92 | 1,4 / 10,8 / 15,2 | — |

- K1n öğrenen, bağlı bedenine karşı:
  - dürtü 9/10 (p 0,02)
  - yönelme 9/10 (p 0,004)
  - yönlendirme 7/10 (p 0,16, anlamsız)
- KT1: her ölçüde 10/10 (p 0,002).
- **Öngörü karnesi:**
  - (a) ✓ 9/10.
  - (b) ✓ %39.
  - (c) ✗ Yönlendirme 0,114 çıktı. Ama bağlı bedene göre anlamlı değil; belirsiz.
  - (d) ✓
- **Okuma:** Rastgelenin kazanamadığı odada da S1n bir şey öğreniyor ve duyusunu kullanıyor. Ama "önündeyse ileri"
  kuralının bile çok altında kalıyor: %39'a karşı %81. Öğretmenli beyin %72'ye çıkıyor; yani aynı yapı yönü
  taşıyabiliyor. Eksik olan, bu öğretme sinyalini beynin kendi içinden üretmek. Ozyn'in sözüyle: "yemek yenince
  yemeğe dair bilgisi gelişmeli". Eleştirmenin yemek görmeye verdiği değer bugün ~0.
- **Pano yeni cetvele geçti:** karar artık bağlı bedene göre veriliyor. Eski koşuların bağlı ölçümleri `data/yoked-005a.jsonl`'den eşleniyor; kayıtların kendisi değişmedi. Deney Odası üç bedeni yan yana oynatıyor: öğrenen, bağlı beden, ikiz. Açılışta K1n (kıt oda) seçili; DNK-2778 10 odanın 10'unda yaşadı (116 yemek), bağlı bedeni 2'sinde (27 yemek), ikizi hiçbirinde (11 yemek).
- Refleksli / reflekssiz bu odada benzer. K1n'de dürtüde refleksli 5/5, reflekssiz 4/5; n 5 ile ayrım yapılamaz.

## 2026-09-25 — Seri 006: yemek hafızası (işaret değeri) — koşmadan önce

- Ozyn onayladı: "Yemek yenince az önce yemeği gören ışınlara değer yazılsın." Tasarım: `TASARIM-006-YEMEK-HAFIZASI.md`.
- **Teşhis** `[ÖLÇÜLDÜ]` (`experiments/diagnose-critic.ts`), eleştirmen ağırlıkları, 10 öğrenenin ortalaması:

| grup | K1n bitiş | K1n toplam oynama | S1n bitiş | S1n toplam oynama |
|---|---|---|---|---|
| yemek ışınları | +0,026 | 2,24 | +0,017 | 4,81 |
| duvar ışınları | −0,011 | 2,75 | +0,002 | 5,06 |
| bias | −0,027 | 3,14 | −0,043 | 5,09 |
| hareket duyusu | +0,018 | 3,50 | +0,023 | 6,78 |

  Eleştirmen çalkalanıyor, anlam biriktirmiyor.
  - Sebep 1: TD(0), kredi yalnız bir adım geriye gidiyor.
  - Sebep 2: her duyudan birden öğreniyor.
- **Ozyn'in sorusu:** "Beyin öğrendiğini hafızada tutuyor mu?"
  - Alışkanlık hafızası (bağlantı güçleri, defter) kalıcı ve eksiksiz.
  - Değer hafızası var ama çalışmıyor (yukarıdaki teşhis).
  - Çalışma hafızası (görüşten çıkan yemeği hatırlamak) yok; açık sorulara eklendi.
- **Kural özeti:** işaretler yalnız ışınlar (yemek, duvar, tehlike; hangisinin değerli olduğunu kural buluyor).
  λ 0,95 izli TD(λ), adım işaret enerjisine bölünmüş. Öğretmeye katkısı potansiyele dayalı biçimlendirme:
  κ·(γΦ(s′) − Φ(s)).
- **Koşullar** (kıt oda, seed 1–5 × iki grup, 40 + 10 bölüm, bağlı kontrol otomatik):
  - K2: S1n + işaret hafızası, κ 1
  - K2x: κ 3
  - Karşılaştırma: K1n (aynı doğumlar, aynı seed'ler).
- **Öngörüler (koşmadan):**
  - (a) Hafıza anlam biriktirir: öğrenilmiş yemek ışını değerlerinin toplamı > +0,1 ve duvar ışınlarınınkinden
    büyük, ≥ 8/10 öğrenende.
  - (b) **Asıl öngörü, dönüş:** K2'nin yönlendirmesi bağlı bedenine göre anlamlı yüksek (Wilcoxon p < 0,05) ve
    ortalaması ≥ 0,15.
  - (c) K2 hayatta kalma ≥ %50 (K1n %39).
  - (d) Aynı doğumlu K1n öğreneniyle eşleştirildiğinde K2 dürtüde ≥ 7/10 iyi.
  - (e) K2x, K2'den daha çok döner ama dürtüde daha kötü olabilir (fazla biçimlendirme açlığa rağmen işaret
    kovalatabilir); yön öngörüsü yok.
  - **Çürütme ölçütü:** (b) tutmazsa fikir bu haliyle yön öğretmiyor demektir; "hafıza anlam biriktirdi ama davranışa
    geçmedi" (a tutar, b tutmaz) ile "hafıza da oluşmadı" (a da tutmaz) ayrı yazılır.

## 2026-09-25 — Seri 006 sonucu (K2/K2x): başarısız — hafıza öğrenmedi, savruldu

`[ÖLÇÜLDÜ]` Kıt oda, seed 1–5 × iki grup, 40 + 10 bölüm; kod `7566021`.

| | dürtü | hayatta | yemek/1000t | yönlendirme | bağlı bedene göre dürtü |
|---|---|---|---|---|---|
| K2 (κ 1) öğrenen | 0,866 | %0 | 0,33 | 0,027 | 5/10, p 0,85 |
| K2x (κ 3) öğrenen | 0,885 | %0 | 0,33 | 0,016 | 4/10, p 0,61 |
| K1n öğrenen (karşılaştırma) | 0,425 | %39 | 2,12 | 0,114 | 9/10, p 0,02 |
| ikiz (ortak) | 0,755 | %0 | 1,00 | 0,006 | — |

- Öğrenenler ikizden bile kötü: dürtüde 0/10.
- **Teşhis** (`diagnose-critic.ts K2 cue/`): hafıza değerleri savruldu.
  - Duvar ışınları eğitim boyunca toplam 279 birim oynadı, −2,35'te bitti.
  - Yemek ışınları 118 oynadı, −0,39'da bitti.
  - Karşılaştırma: eleştirmen K1n'de 2,7 ve 2,2 oynamıştı.
- **Sebep: benim tasarım hatam, fikrin değil.** İz birikimliydi (e ← λe + x). Sürekli görünen bir duvarın izi
  1/(1−λ) = 20 katına çıktı, adım 20 kat büyüdü, değerler salındı. Biçimlendirme bu gürültüyü doğrudan öğretmeye taşıdı.
- **Öngörü karnesi:** (a) ✗ (0/10), (b) ✗, (c) ✗, (d) ✗ (tersine). Fikir bu uygulamayla sınanamadı.
  "Hafıza oluşmadı" durumu.
- **Düzeltme:** yerine koyan iz (e ← max(λe, x); Singh & Sutton 1996). Sürekli görülen bir şey bir kez görülmüş
  sayılır, iz en fazla 1 olur.
  - Seçenek olarak eklendi (`CueParams.trace`). K2/K2x kayıtları eski ayarla yeniden üretilebilir kaldı
    (gerileme kontrolü: K2 3/3, K1n 2/2 birebir aynı).
  - Testler 47; mutasyon 4/4.

## 2026-09-25 — Seri 006b (K3/K3x, yerine koyan iz) — koşmadan önce

- Koşullar: K3 (κ 1) ve K3x (κ 3); kıt oda, seed 1–5 × iki grup.
- Öngörüler seri 006'dakilerle aynı ölçütler:
  - (a) Yemek ışınlarının hafıza değeri > +0,1 ve duvar ışınlarınınkinden büyük, ≥ 8/10.
  - (b) Yönlendirme bağlı bedene göre p < 0,05 ve ortalama ≥ 0,15.
  - (c) Hayatta kalma ≥ %50.
  - (d) Aynı doğumlu K1n'e göre dürtüde ≥ 7/10 iyi.
- Ek öngörü (e′): değerler artık savrulmaz. Duvar ışınlarının toplam oynaması K1n eleştirmenininkiyle (2,7) aynı
  mertebede kalır (< 10).
- **Çürütme:**
  - (e′) tutmazsa değer öğrenmesi hâlâ kararsızdır; biçimlendirme sınanamaz.
  - (e′) tutar ama (b) tutmazsa hafıza oluşmuş ama dönüşe geçmemiştir.

## 2026-09-25 — Seri 006b sonucu (K3/K3x): iz düzeldi, ama yemek "kötü" öğrenildi

`[ÖLÇÜLDÜ]` Kıt oda, seed 1–5 × iki grup; kod `d020c49`.

| | dürtü | hayatta | yemek/1000t | yönlendirme | yönelme, bağlı bedene göre |
|---|---|---|---|---|---|
| K3 (κ 1) | 0,786 | %7 | 0,32 | 0,000 | 9/10, p 0,027 |
| K3x (κ 3) | 0,889 | %0 | 0,21 | 0,022 | 4/10 |
| K1n (karşılaştırma) | 0,425 | %39 | 2,12 | 0,114 | 9/10, p 0,004 |

- **Teşhis:**
  - Hafıza değerleri artık savrulmuyor: duvar ışınları toplam 2,1 oynadı; K2'de 279.
  - Ama yemek ışınları **−0,27**'de bitti (7,1 oynadı). Yemek ışını değeri > 0,1 olan öğrenen: 1/10.
- **Öngörü karnesi:**
  - (e′) ✓: savrulma bitti.
  - (a) ✗, (b) ✗, (c) ✗, (d) ✗.
- **Sebep:** hafıza her bedensel maliyetten öğreniyordu (hareketin enerjisi, açlığın yavaş artışı). Kıt odada yemek
  görmenin ardından çoğunlukla onu kovalamanın maliyeti geliyor, yemek ise nadiren. Yemek "kötü" öğrenildi,
  biçimlendirme bedeni yemekten uzaklaştırdı, daha az yedi. Kısır döngü ters yönde işledi.
  - Bu, onaylanan fikirden benim sapmamdı. Onaylanan: "yemek yenince, az önce gören ışınlara değer yazılsın".
- **Düzeltme:** `CueParams.outcome`.
  - "relief" (yeni varsayılan): yalnız bir dürtünün azalmasından, yani yemekten öğrenir. Yemeksiz görülen işaret
    0'a doğru söner, cezalandırılmaz.
  - "signed": K2 ve K3'ün ayarı, kayıtlar yeniden üretilebilir kaldı (gerileme K2 2/2, K3 2/2).
  - Zarar ileride ayrı bir, kaçınma belleğine bırakıldı.
  - Testler 52; mutasyon 4/4.

## 2026-09-25 — Seri 006c (K4/K4x, yalnız yemekten öğrenen hafıza) — koşmadan önce

- Koşullar: K4 (κ 1) ve K4x (κ 3); kıt oda, seed 1–5 × iki grup.
- Öngörüler (a)–(d) seri 006'dakiyle aynı. Ek olarak:
  - (f) Yemek ışınlarının hafıza değeri ≥ 0 kalır (hiçbir öğrenende < −0,05 değil).
  - (g) K4 dürtüde en azından K1n kadar iyi: ortalama farkı ≤ +0,05. Hafıza en kötü ihtimalle zararsız olmalı.
- **Çürütme:** (g) tutmazsa biçimlendirme, doğru işaretli değerle bile homeostazı bozuyor demektir. O zaman
  sorun değerde değil, biçimlendirmenin öğretmeye katılma biçimindedir.
- Not: iki art arda başarısızlık, Themis'in "tabanı sorgula" uyarısını hatırlatıyor. K4 de başarısız olursa bir
  sonraki adım yeni bir deneme değil, bir toplantı/tasarım gözden geçirmesi olmalı.

## 2026-09-25 — Seri 006c sonucu (K4/K4x): hafıza doğru öğrendi, ama öğretmeye bağlanış biçimi hareketi bastırıyor

`[ÖLÇÜLDÜ]` Kıt oda, seed 1–5 × iki grup; kod `eeda696`.

| | dürtü | hayatta | yemek/1000t | yönlendirme | durgun | yemek → kendi tarafının Git'i / karşı taraf |
|---|---|---|---|---|---|---|
| K4 (κ 1) | 0,620 | %9 | 0,47 | 0,013 | %86 | 0,052 / 0,002 (8/10'da kendi > karşı) |
| K4x (κ 3) | 0,672 | %3 | 0,19 | −0,002 | — | — |
| K1n (hafızasız) | 0,425 | %39 | 2,12 | 0,114 | %73 | 0,342 / 0,213 (6/10) |
| ikiz | 0,755 | %0 | 1,00 | 0,006 | — | — |

- **Hafızanın kendisi artık doğru öğreniyor:**
  - Yemek ışınlarının değeri +0,198; duvarlarınki +0,032.
  - 7/10 öğrenende yemek > 0,1 ve duvardan büyük.
  - Hiçbir öğrenende yemek eksi değil.
  - Yemeğin **tarafı** ilk kez ağırlıklarda görünüyor: yemek → kendi tarafının Git'i 0,052, karşı taraf 0,002.
- **Ama beyin daha az hareket ediyor:** durgun %86, K1n'de %73. Öğrenilen ağırlıklar çok küçük kalıyor:
  yemek → ileri 0,13, K1n'de 0,60.
- **Olası sebep (sınanmadı):** biçimlendirme "yemeği gözden kaçırmayı" eksiyle cezalandırıyor. Hareket eden beden
  sık sık yemeği gözden kaçırıyor, bu eksiler hareketlerin Gitme'sini büyütüyor. Potansiyele dayalı biçimlendirme
  toplamda nötr; ama uygunluk izli bir öğrenicide eksiler ve artılar farklı hareketlere düştüğü için nötr
  kalmıyor.
- **Öngörü karnesi:**
  - (a) ✗ (7/10; eşik 8).
  - (b) ✗.
  - (c) ✗ (%9).
  - (d) ✗ (5/10).
  - (f) ✓: yemek hiç eksi değil.
  - (g) ✗: K4, K1n'den 0,195 kötü.
- **Önceden konan kural gereği burada duruluyor:** üç varyant (K2, K3, K4) koşuldu. Her biri bir tasarım hatasını
  buldu ve düzeltti:
  - K2: birikimli iz savruldu.
  - K3: maliyetten öğrenmek yemeği kötü yaptı.
  - K4: biçimlendirme hareketi bastırıyor.

  Hafızanın kendisi artık çalışıyor. Bundan sonraki adım, hafızanın davranışa nasıl bağlanacağı; bu bir mimari
  kararı, Ozyn'e / toplantıya.

## 2026-09-25 — Mimari gözden geçirme öncesi: Ozyn'in fikirleri (karar değil, not)

Seri 006'dan sonra Ozyn büyük resmi sordu: "Jev'den daha iyi bir yapı, ileride robot hafızası için yola çıktık; doğru
yolda mıyız?" Sonra fikirlerini verdi. Hepsi mimari belgesine (TASARIM-007) ve toplantıya girdi olacak.

- **Amaç yeniden:** biyolojik bir şey kurmuyoruz, yalnız esinleniyoruz. Son haftalarda yapı bir "kurallar zincirine"
  döndü (taban, bölmeler, seçici, işaret hafızası: her biri bir öncekini yamadı).
- **Üç parçalı beyin:**
  - Alice: refleks, hızlı.
  - Bob: düşünen, yavaş. Küçük model; Needle adayı. İleride üstüne bir derin düşünme katmanı (küçük LLM) gelecek.
  - Hafıza.
- **Keşif → kullanmayı öğren → refleks:** Bob'un yeni bir durumda verdiği karar, işe yararsa Alice'e refleks olarak
  işlenmeli. Refleks bozulursa çürümeli (çürüme zaten var). Doğru yerlerde birden fazla Needle olabilir.
- **İnsan öğretmen:** deneyde boş beyinde sinirlere tıklayarak Ozyn (ya da Claude) döngüye girip öğretmen olabilmeli.
- **Hafıza, kararları etkilemeli.** Bugün beyin gördüğünü unutuyor, neyin nerede olduğunu bilmiyor, her seferinde
  yeniden dönüyor.
  - Gördüklerini "beyninde hayal edip" hatırlayabilmeli.
  - Bir şey yer değiştirirse bunu fark edebilmeli.
  - Bunun için iyi bir matematik gerekiyor.
- **Hafıza mimarisi:** modüler olmalı, bir çekirdeği olmalı. Basit hafızadan karmaşık hafızaya ilerlenmeli.
- **İki göz:** "İki gözümüz olursa bu bize derinlik, uzaklık olayını verir." Claude'un notu:
  - Bugünkü ışınlar uzaklığı doğrudan ölçüyor, lidar gibi. Bu, §16'daki etiketli duyu kestirmesine benzer bir
    kolaylık. Bugün iki göz derinlik eklemez.
  - Duyular gerçekçileşirse iki göz gerçek değer kazanır: gözler yalnız yön ve görünüş verir, uzaklığı vermez.
    Uzaklık iki gözün farkından hesaplanır (üçgenleme: uzaklık ≈ göz arası mesafe / açı farkı).
  - İki göz ayrıca görüş alanını genişletir ve sol/sağ karşılaştırmasını doğal kılar (M3 iki taraf bölgesi).
  - Hafızanın haritası da iki gözle daha sağlam kurulur.
  - Duyu gerçekçiliği adımıyla birlikte TASARIM-007'de ele alınacak.

**Claude'un eklediği teknik notlar** (tasarım belgesinde ayrıntılanacak):
- Beden kendi konumunu bilmiyor; hareket duyusu (proprio: hız, dönüş) var. Konum tahmini için yol entegrasyonu
  (dead reckoning) gerekiyor. Sapmayı duvara çarpmalar düzeltebilir.
- "Hayal etmek" = hafızadaki haritadan ışınların şu an ne görmesi gerektiğini tahmin etmek (iç ışın izleme).
  Gerçekle fark = sürpriz. Hatırlanan yerde yemek yoksa "yenmiş ya da yer değiştirmiş".
- Hafızanın içeriğini dünyanın gerçek haliyle kıyaslayarak **tam olarak notlayabiliriz**; simülasyonun büyük avantajı.
- Hafıza içeriği bir durumdur, öğrenme değildir. Defterle izin ayrımı netleşmeli: öğrenilen parametreler deftere,
  hafıza içeriği koşu izine.
- Hafızanın karara etkisi elle yazılmamalı. Hafıza, Alice'e ve Bob'a "hatırlanan duyular" verir (örneğin en yakın
  hatırlanan yemeğin yönü ve uzaklığı); onları kullanmayı beyin öğrenir.

## 2026-09-26 — TASARIM-007 onaylandı; A1 (H1 konum): "ben neredeyim?" — koşmadan önce

Ozyn TASARIM-007'yi ve toplantının K1–K8 kararlarını olduğu gibi onayladı ("onayladım", 2026-09-26). İlk adım A1.

**Soru:** Hafıza, yalnız bedenin hareket duyusundan (`motion.forward`, `motion.turn`) konumunu, 3000 tikin sonunda
gerçek konumdan ortalama 0,5 m'den az sapmayla bilebilir mi? Davranış değişmez; tahmin gerçek konumla notlanır.

**Fizik okuması** (kodu okuyarak, koşmadan önce):
- **Yön:** Dönüş duyusu dönüş komutunun kendisi; dönüşte atalet yok. Yön tahmini birebir doğru olmalı. Bu, dünyanın
  bir kolaylığı: gerçek bir bedende dönüş duyusu gürültülüdür.
- **Hız:** Hız duyusu hızın yalnız **ileri bileşeni**. Dönen beden eski hızını bir süre korur ve yana kayar: sürtünme
  her tik hızı 0,925 ile çarpar, zaman sabiti ~0,65 s. Tam hızda (2,47 m/s) tek bir dönüş tiki yaklaşık 0,24 m'lik
  bir yan kayma bırakır; ileri hız duyusu bunu görmez.
  - TASARIM-007'deki formül yalnız ileri hızı topluyor, bu yüzden eksik.
  - Belgedeki "sapma küçük beklenir" cümlesi yanlıştı. Claude'un fizik okuma hatası; belge sonuçla birlikte
    düzeltilecek.
- **Kayma hesaplanabilir:** Yan hız, önceki tikin ileri hızı F, dönüş açısı Δ ve sürtünme çarpanı k = 0,925 ile
  güncellenir: `s ← k·(s·cos Δ − F·sin Δ)`. Duvara değmeyen bir bedende bu, konumu kayan nokta hassasiyetinde vermeli.
  - Kullanılan sabitler (tik süresi, azami hız, dönüş hızı, sürtünme) bedenin kendi sabitleri. Doğuştan bilgi sayılır,
    kasın ne kadar güçlü olduğunu bilmek gibi.
- **Duvar teması:** Duvar, hızın duvara doğru bileşenini siler. Beden hangi duvara hangi açıyla değdiğini hareket
  duyusundan bilemez. Eğik çarpan beden duvar boyunca kayar; bu kayma modelin dışında kalır.
- **K1n'nin temas oranı yüksek** `[ÖLÇÜLDÜ]` (results.jsonl, K1n değerlendirmesi):
  - 3000 tiki yaşayan denekler (DNK-2778, 2781, 2783, 2784): 1000 tikte 23–134 temas tiki.
  - Temas etmeyen üç denek (2780, 2782, 2786) 1800 tikten önce ölüyor.
  - Kapı kümesi fiilen 4 denek, ~39 hayat.

**Değişkenler (hepsi anahtar; hafıza davranışı değiştirmez):**

| | kayma modeli | temasta yan hız |
|---|---|---|
| V0 | yok (TASARIM-007 formülü) | — |
| V1 | var | korunur |
| V2 | var | sıfırlanır |

- **Seçim ve sınama ayrı:** V1/V2 seçimi referans bedenlerde yapılır (kör, merkez, arayıcı; kıt oda, seed 1–10).
  Kapı K1n öğrenenlerinde ölçülür.
- **Güven:** Konumun belirsizliği yalnız temas tiklerinde büyür: σ² ← σ² + (q · v · dt)². Burada v, bedenin temastan
  önceki hızıdır (ileri ve yan). q, referans bedenlerde ölçülür. Güven = 1 / (1 + (σ / 0,5 m)²).
  - Düzeltme (aynı gün, ölçümden önce, kodu yazarken): İlk yazılan "her temas tikinde sabit q", duvara yaslanıp duran
    bedenin güvenini boşuna düşürürdü. Duran beden hiç hata biriktirmez.

**Ölçü:**
- **Konum hatası (m):** Kendi başlangıç çerçevesindeki tahmin odanın çerçevesine taşınır, gerçek konuma uzaklığı
  ölçülür.
- **Yön hatası (°).**
- **Kapı:** 3000 tiki yaşayan hayatlarda ortalama konum hatası < 0,5 m.
- **Ekler:** her hayatın sonundaki hata, 1000 tikteki hata, denek başına dağılım.
- **Aynı hayat kontrolü:** Değerlendirme hayatları kayıttakilerle aynı olmalı (her odanın son dünya özeti kayıtla eşit).

**Öngörüler:**
- (a) Yön hatası her bedende, her tikte tam 0.
- (b) Hiç duvara değmeyen hayatlarda V1'in hatası < 1e-6 m, yalnız kayan nokta. Aynı şey 1000 m'lik açık bir
  odada, rastgele dönen bir bedenle 3000 tik boyunca da geçerli. Orada V0'ın hatası > 0,1 m.
- (c) V0 kapıdan kalır: K1n'de 3000 tikte ortalama hata > 1 m.
- (d) V1'in bütün hatası duvar temasından gelir. Temassız hayatta 0; temaslı hayatlarda hata temas sayısıyla artar.
- (e) V1 de kapıdan kalır: K1n'de 3000 tikte ortalama hata > 0,5 m, çünkü temas çok. Tahminim ~1 m; güvenim orta.
- (f) V1 ile V2 arasındaki fark küçük (< %25).
- (g) Hafıza takılıyken yaşanan hayat birebir aynı (eylemler, dünya özeti) ve deftere tek satır yazılmıyor.
- (h) Güven dürüst: K1n'de gerçek hata / σ oranı 0,5–2 arasında.

**Çürütme ve sonrası:**
- (b) tutmazsa kayma türetmesi yanlıştır; önce o düzeltilir.
- (e) tutmazsa, yani V1 kapıyı geçerse, temas sanıldığı kadar zararsızdır ve A1 tamamdır.
- (e) tutarsa A1 kapısı saf yol entegrasyonuyla geçilemiyor demektir. İki yol var; hangisi, Ozyn'in kararı:
  - Temas anında ışınların gördüğü duvar noktalarından duvarın yönünü çıkarıp kaymayı hesaplamak. Hâlâ H1, yeni duyu
    yok.
  - Düzeltmeyi A2'nin haritasına bırakmak.

## 2026-09-26 — A1 sonucu: konum hafızası kapıyı sınırda geçti; kalan hatanın tamamı duvar temasından

`[ÖLÇÜLDÜ]` Ölçüm kodu `3ffffbf`, hafıza `a13a1a9`. Salt okunur; kayıtta hiçbir şey değişmedi.

**Açıklama:** Öngörüler yazıldıktan sonra, ölçümden önce küçük bir deneme koşuldu. Amacı test toleranslarını koymaktı;
ortamı fikstür odalarıydı (1000 m'lik açık oda ve yemeksiz 10 m'lik oda, kör beden). Deneme, temas kuralının
sanıldığından önemli olduğunu gösterdi. Öngörüler değiştirilmedi.

**Adım 1 — referans bedenler** (kıt oda, seed 1–10 × 10 oda):

| beden | ort. yaşam (tik) | temas/hayat | son hata V0 / V1 / V2 (m) | 3000 tikte, yaşayanlar: V0 / V1 / V2 (m) |
|---|---|---|---|---|
| kör | 1024 | 113 | 1,87 / 1,13 / 0,78 | 1 hayat: 4,24 / 0,71 / 0,34 |
| merkez | 2804 | 303 | 4,03 / 2,01 / 1,34 | 81 hayat: 4,22 / 1,92 / 1,37 |
| arayıcı | 2906 | 254 | 4,03 / 2,12 / 1,42 | 92 hayat: 4,16 / 2,16 / 1,46 |

- **Seçilen temas kuralı: V2** (temasta yan hız sıfırlanır). Ortalama son hata: V1 1,75 m, V2 1,18 m.
- **Ölçülen temas gürültüsü:** q = 2,76 (293 temaslı hayat). Varsayılan ayarlar buna çekildi (`DEFAULT_POSE`).

**Adım 2 — K1n öğrenenleri** (10 denek × 10 kayıtlı oda; 100/100 hayat kayıttakiyle aynı, son dünya özetleri eşit):

| denek | grup | 3000'e ulaşan hayat | temas/hayat | 3000 tikte V0 / V1 / V2 (m) |
|---|---|---|---|---|
| DNK-2778 | reflekssiz | 10 | 267 | 2,37 / 0,84 / 0,60 |
| DNK-2783 | reflekssiz | 10 | 186 | 2,20 / 0,66 / 0,32 |
| DNK-2781 | refleksli | 9 | 375 | 2,27 / 0,61 / 0,56 |
| DNK-2784 | refleksli | 10 | 68 | 3,36 / 0,42 / 0,41 |
| öteki 6 denek | | 0 | 0–196 | —; son hata V1 0,00–0,45 |

- **Kapı** (3000 tiki yaşayan 39 hayat, ortalama < 0,5 m): V0 2,56 · V1 0,63 · **V2 0,47 m. Geçti, ama sınırda.**
  - Pay %6.
  - İki denek (2778, 2781) tek başına 0,5 m'nin üstünde.

**Öngörü karnesi:**
- (a) ✓ Yön hatası her hayatta, her tikte tam 0.
- (b) ✓ Temassız 50 hayatta V1'in en büyük hatası 5,5e-14 m. V0 aynı hayatlarda 3,33 m'ye kadar sapıyor.
- (c) ✓ V0 kapıda 2,56 m.
- (d) ✓ V1'in hatası temassız hayatlarda 0. Temaslı hayatlarda temas sayısıyla artıyor (Spearman 0,49, orta güçte).
- (e) ✓ V1 kapıdan kaldı (0,63 m). Büyüklüğü abarttım: ~1 m demiştim.
- (f) ✗ Fark küçük değil: kapıda %26, referans bedenlerde %33. Temas kuralı önemli.
- (g) ✓ 100/100 hayat aynı. Hafıza takılıyken eğitilen denek birebir aynı defteri yazıyor (test).
- (h) ✓ Gerçek hata / σ = 0,73: güven dürüst, hatayı biraz büyük gösteriyor (güvenli yönde).

**Yorum:**
- Belgedeki formül (V0) kullanılsaydı beden 3000 tikte 2,6 m sapardı. 10 m'lik odada bu, "neredeyim" bilgisini
  anlamsız kılar. Yana kayma modeli serbest harekette hatayı sıfıra indirdi.
- Kalan hatanın tamamı duvar temasından geliyor. Kapı geçildi, ama yalnız K1n az hareket ettiği için. Çok hareket eden
  bedenlerde (merkez, arayıcı) aynı model 3000 tikte 1,4 m sapıyor. A3'ten sonra beden daha çok hareket edecek; konum
  hafızası bu haliyle yetmez.
- TASARIM-007 §5'teki H1 formülü bu ölçümle düzeltildi. Düzeltme belgede, tarihiyle.

**Sonraki adım, Ozyn'in kararı:**
1. Temas anında, ışınların gördüğü duvar noktalarından duvarın yönünü çıkarıp kaymayı hesaplamak. Hâlâ H1, yeni duyu
   yok.
2. Olduğu gibi A2'ye geçip konumu haritayla düzeltmek.

## Açık sorular (güncel)

- Çalışma hafızası: görüş alanından çıkan yemeği hatırlamak (Ozyn, 2026-09-25: "öğrendiği şey hafızaya işlenmeli"). Bugün beyin yalnız şu anki görüntüye bakıyor.

- Kendiliğinden hareket (motor babbling) ve zayıf rastgele doğum bağlantıları öğrenmeyi başlatır mı?
- Doğuştan refleks yardımcı mı, engel mi? (reflekssiz / refleksli karşılaştırması planlandı)
- Üç faktörlü kural ~20 tiklik gecikmeyi köprüleyebilir mi?
- Beynimiz basit tablo TD(λ) öğrenicisini geçebilecek mi?
