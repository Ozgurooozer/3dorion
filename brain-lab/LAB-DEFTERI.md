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

## Açık sorular (güncel)

- Kendiliğinden hareket (motor babbling) ve zayıf rastgele doğum bağlantıları öğrenmeyi başlatır mı?
- Doğuştan refleks yardımcı mı, engel mi? (reflekssiz / refleksli karşılaştırması planlandı)
- Üç faktörlü kural ~20 tiklik gecikmeyi köprüleyebilir mi?
- Beynimiz basit tablo TD(λ) öğrenicisini geçebilecek mi?
