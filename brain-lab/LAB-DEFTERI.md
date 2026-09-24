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

## Açık sorular (güncel)

- Kendiliğinden hareket (motor babbling) ve zayıf rastgele doğum bağlantıları öğrenmeyi başlatır mı?
- Doğuştan refleks yardımcı mı, engel mi? (reflekssiz / refleksli karşılaştırması planlandı)
- Üç faktörlü kural ~20 tiklik gecikmeyi köprüleyebilir mi?
- Beynimiz basit tablo TD(λ) öğrenicisini geçebilecek mi?
