# Ölçüm: söz sınıflandırma (ön kayıt)

> 2026-10-02 · ÖN KAYIT — aşağıdaki öngörüler ve kapı **hiçbir aday koşulmadan önce** donduruldu.
> Dondurulan: `tools/soz-siniflandirma/olc.py` (özet `1e5c51482c41f2ea`), `fixtures/soz/etiketli.json`
> (`cf46cbceab2b29fc`), repo başı `d169aa8`. `olc.py kalibre` TAMAM (tavan, hep-hareket, hep-LLM, yanlış-yol,
> eşik, ayırıcısız, rastgele, sızıntı, B0 kalıpları). Koşudan sonra bu bölümler DEĞİŞMEZ; karne altına eklenir.

## Soru

Orion'a gelen söz (`duydum`) bugün her zaman LLM'i uyandırıyor. Küçük, hızlı bir sınıflandırıcı sözü 5 yola
ayırıp **güvendiği** basit komutları LLM'siz yola (hareket, sorgu) gönderebilir mi — ve elle yazılmış kalıp
tablosundan (spec 13 Faz 2 komut sözlüğü) gerçekten daha iyi mi?

Bu tur yalnız çevrimdışı ölçüm; `bridge/ mind/ world/ protocol/` değişmez.

## Veri ve etiket durumu

- 347 örnek: 71 `gercek` (günlük + `fixtures/eylem/komutlar.json`), 276 `uretilmis` (benim tohumlarım + ASCII/yazım türevleri).
- **Gerçek sözlerin etiketleri benim önerim, Ozyn onaylamadı (`onay:false`).** Sonuçlar GEÇİCİ etiketlerle; tartışmalı
  4 söz (`not` alanında "TARTIŞMALI") için ayrıca "tartışmasız" kapsama raporlanır. Ozyn etiketleri değiştirirse yalnız
  `olc.py puanla` yeniden koşar (gömmeler diskte), bu belgenin öngörüleri değişmez.
- Test seti YALNIZ `gercek`. Bellek (kNN) YALNIZ `uretilmis`, değerlendirilen örneğin grubu hariç (grup-dışarıda-bırak).

## Protokol

- Aday çıktısı: (sınıf, güven). Güven: kNN'de oy payı (k=5, benzerlik ağırlıklı, kosinüs); Laya'da en yüksek seçenek olasılığı; B0'da 1.0.
- **LLM'siz yola gitme:** tahmin ∈ {hareket, sorgu} ve güven ≥ τ. Diğer her şey LLM'e düşer.
- **τ seçimi test setine bakmadan:** kalibrasyon kümesi = gerçek üyesi olmayan gruplar (tohumlar + türevleri), aynı
  grup-dışarıda-bırak. τ = kesinlik ≥ %98 veren EN KÜÇÜK eşik (0.50..1.00, 0.01 adım); yoksa hiçbir şey yola gitmez.
- **Birincil metrik:** gerçek sözlerde kesinlik (yola gidenlerin doğru yola gitme oranı) ve **kapsama** (etiketi hareket/sorgu
  olan gerçek sözlerin kaçı doğru yola gitti). Yanlış yola gidenler tek tek listelenir.
- İkincil: makro-F1 ve doğruluk (güvensiz, argmax), ASCII/yazım türevlerinde doğruluk (grup-dışarıda-bırak; tür
  dayanıklılığı), CPU gecikme p50/p95 (tek söz, gerçek sözler, 12 mantıksal çekirdek, torch CPU), parametre sayısı.

## Adaylar

| kod | ne |
|---|---|
| B0 | elle yazılmış genel kalıplar (`olc.py` `B0_KURALLAR`); eşleşmeyen = LLM'e düşer |
| Laya | `Router.predict(..., model="multilingual")`, 5 seçenek, TR anahtar + EN/TR açıklama, sıfır atış |
| C1 | `ytu-ce-cosmos/modernbert-tr-base` ortalama-havuz + kNN |
| C2 | `alphaedge-ai/mmBERT-base-tur-16384` ortalama-havuz + kNN |
| C3 | `intfloat/multilingual-e5-base` (`query: ` önekli) ortalama-havuz + kNN |

## Bilinen yanlılıklar (koşmadan önce yazıldı)

1. B0'ın yazarı gerçek söz listesini gördü → B0'a hafif avantaj (ML'e karşı tutucu).
2. Etiketler onaysız; 3'ü tartışmalı.
3. Küçük n: etiketi hareket olan 14 + sorgu olan 9 = **23 gerçek söz**. Tek bir yanlış yola gidiş kesinliği %98'in altına
   çeker; sonuçlar **eğilimdir**, hüküm değil.
4. Tohum örnekler benim yazım tarzımı yansıtıyor; kNN belleği bu tarza yakın, gerçek sözler uzak olabilir.
5. Laya kullanımı bizim seçenek metinlerimize bağlı; başka metinle başka sonuç verebilir (tek metin denendi).

## Öngörüler ve çürütücüler (donmuş)

| # | öngörü | çürüten |
|---|---|---|
| P1 | B0: gerçek sözlerde kapsama **%35–70** ve yanlış yola giden **≤ 1** (kanonik komutlar iyi) | kapsama < %35 ya da ≥ 2 yanlış |
| P2 | Laya sıfır atış: makro-F1 **< 0,55** ve kapsama (kendi τ'sında) **< %20** | makro-F1 ≥ 0,55 ya da kapsama ≥ %20 |
| P3 | C1: makro-F1 **≥ 0,65** ve kapsama **≥ %40** | makro-F1 < 0,65 ya da kapsama < %40 |
| P4 | C3 makro-F1'i C1'inkinden **en çok 0,10 farklı** | fark > 0,10 |
| P5 | C2 makro-F1 < C1 makro-F1 (budanmış sözlük aleyhine) | C2 ≥ C1 |
| P6 | Yazım türevlerinde en iyi ML adayı B0'dan **≥ 10 puan** doğru; ASCII türevlerinde ML ≥ 0,85 × kendi orijinal doğruluğu | ML'in yazım doğruluğu B0'dan < 10 puan yüksek |
| P7 | C1 CPU gecikme **p50 < 100 ms, p95 < 250 ms**; Laya p50 **200–400 ms** (daha önce tek soruda 288 ms ölçüldü) | aralık dışı |
| P8 | Tartışmalı 4 sözü çıkarmak hiçbir adayın kapı kararını (geçti/geçmedi) değiştirmez | değiştirirse |

## Kapı (karar kuralı, donmuş)

Bir aday **geçer** ⇔ gerçek sözlerde **kapsama ≥ %40, kesinlik ≥ %98 ve yanlış yola giden ≤ 1**.

- Geçen adaylar arasında kazanan: en yüksek kapsama; fark ≤ 5 puansa düşük p50 gecikme.
- **ML, B0'a ancak** şunlardan biriyle üstün sayılır: kapsama B0'dan ≥ 10 puan fazla **ya da** yazım türevi doğruluğu B0'dan
  ≥ 10 puan fazla. Hiçbiri yoksa karar: **"kalıp tablosu yeter; spec 13 Faz 2 sözlüğüyle devam"** (ML için olumsuz sonuç, olduğu gibi kaydedilir).
- Hiçbir aday geçmezse: bu veriyle sınıflandırıcı yolu kanıtlanmadı; sonraki adım daha çok gerçek söz toplamak (`ORION_KAYIT=1`).
- Kapı geçiş **entegrasyon izni değildir**: geçen aday için sonraki tur shadow bağlamadır (`siniflandirmaGolge`, davranış değişmez).

## Puanlama kararlarım (sözün açık bıraktığı seçimler)

- Yola giden yoksa kesinlik "-" (tanımsız), kapsama 0 sayılır; "geçmedi".
- Kapsama paydası etiketi hareket/sorgu olan gerçek sözler; hareket sözü sorgu'ya gitse yanlış yol (kapsamaya girmez).
- τ bulunamazsa 1.01 (hiçbir şey yola gitmez). Alternatif (en yüksek kesinlikli τ) daha cömert olurdu; seçilmedi çünkü kalibrasyon kümesinde hedefi tutmayan bir eşiği "kalibre" saymak yanlış.

## Karne

> Koşu: 2026-10-02, `olc.py` `1e5c51482c41f2ea` (dondurulandan sonra düzenlenmedi), etiketler **onaysız**.
> Kaynak: `tools/soz-siniflandirma/sonuc/karne.md` ve `karne.json` `[ÖLÇÜLDÜ]`. Komut: `olc.py kos <aday>` ardından `olc.py puanla`.

| aday | τ | yola giden | yanlış | kesinlik | kapsama | tartışmasız kapsama | makro-F1 | doğruluk | ASCII türev | yazım türev | p50 ms | p95 ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B0 (kalıp) | 0.50 | 17 | 0 | 100% | **74%** | 81% | 0.64 | 58% | 48% | 21% | 0 | 0 |
| Laya sıfır atış | – | 0 | 0 | – | 0% | 0% | 0.18 | 25% | 30% | 24% | 194 | 222 |
| C1 ModernBERT-TR | 0.81 | 3 | 1 (`ee`→hareket) | 67% | 9% | 10% | 0.60 | 63% | 65% | 57% | 43 | 50 |
| C2 mmBERT-tur | – | 0 | 0 | – | 0% | 0% | 0.62 | 63% | 70% | 50% | 46 | 53 |
| C3 multilingual-e5 | – | 0 | 0 | – | 0% | 0% | **0.72** | **75%** | 78% | **72%** | 37 | 44 |

"–" = kalibrasyon kümesinde kesinlik ≥ %98 veren eşik bulunamadı, hiçbir şey LLM'siz yola gitmedi.

### Öngörü karnesi: 3/8 ✓

| # | sonuç | ölçülen |
|---|---|---|
| P1 | ✗ | B0 kapsaması %74 > %70 (0 yanlış). B0 öngörüden İYİ; yanlılık 1 (yazarı listeyi gördü) bunu açıklayabilir |
| P2 | ✓ | Laya makro-F1 0,18, kapsama %0. Not: 0,18 rastgele tabanın (0,2) altında; Laya bu seçenek metinleriyle çoğunlukla tek sınıfa yığıldı |
| P3 | ✗ | C1 makro-F1 0,60 < 0,65 ve kapsama %9 < %40 |
| P4 | ✗ | C3 − C1 = 0,12 > 0,10 (C3 beklenenden iyi) |
| P5 | ✗ | C2 0,62 ≥ C1 0,60 |
| P6 | ✓ | yazım türevinde en iyi ML (C3) %72, B0 %21 (+51 puan); ASCII'de C3 %78 ≥ 0,85 × %75 |
| P7 | ✗ | C1 p50 43 ms / p95 50 ms ✓; Laya p50 194 ms, aralığın (200–400) 6 ms altında ✗ |
| P8 | ✓ | tartışmalıyı çıkarmak hiçbir kapı kararını değiştirmedi |

### Kapı sonucu (donmuş kurala göre)

- **B0 geçti:** kapsama %74 ≥ %40, kesinlik %100, yanlış yola giden 0.
- **Hiçbir ML adayı geçmedi** (C1 kapsama %9; Laya, C2, C3 eşik bulunamadı).
- Donmuş karar: **"kalıp tablosu yeter; spec 13 Faz 2 sözlüğüyle devam"**. Bu veriyle ve bu kNN + eşik tasarımıyla ML için **olumsuz** sonuç.

Puanlama notu: P6'daki "yazım türevi doğruluğu" B0'ı eşleşmeyen sözü `emin_degil` (LLM'e düşer) saydığı için cezalandırıyor. Yola gitmeyen bir yazım hatalı komut güvenli bir sonuçtur, ama doğruluk metriği bunu "yanlış" sayar. B0'ın yazım dayanıklılığı gerçekte "düşük" ama zararsız.

### Keşif (SONRADAN, karara girmez) `[ÖLÇÜLDÜ]`

Neden encoder'lar kapıyı geçemedi? C3'ü sabit eşiklerde gerçek sözlerde ve kalibrasyon kümesinde ayrı baktım:

| C3, τ | gerçekte yola giden / doğru | gerçek kesinlik | gerçek kapsama | kalibrasyon kesinliği |
|---|---|---|---|---|
| 0.5 | 25 / 19 | 76% | 83% | 65% |
| 0.7 | 15 / 13 | 87% | 57% | 82% |
| 0.9 | 7 / 7 | 100% | 30% | 87% |

- Kalibrasyon kümesi gerçek sözlerden **daha zor**: benim yazdığım olumsuz/belirsiz vakalar ("kalkma", "oraya git", "şuna bak") ve "git status çalıştır" komut kümesine karışıyor (embedding'de "otur" ile "oturma" yakın komşu). Eşik kuralı bu yüzden hiçbir şeyi yola göndermedi.
- Gerçek sözlerde C3 τ=0.9'da 7/7 doğru ama kapsama %30; bu **karara girmez** (eşik test setine bakılarak seçilemez).
- Hipotezler (denenmedi) `[SEZGİ]`: (a) olumsuz/soru/bileşik için ayrı bir "komut değil" işareti; (b) B0 önce, C3 yalnız B0'ın düştüğü yerde (yazım hatalı komutları kurtarma); (c) etiketli gerçek söz sayısını artırmak.

### Dürüst sınırlar

- 23 gerçek yol sözü; bir söz kapsamayı ~4 puan oynatır. Sonuçlar eğilimdir.
- Etiketler Ozyn tarafından onaylanmadı; tartışmalı 3 söz çıkarılınca hiçbir karar değişmedi (P8).
- Laya yalnız bir seçenek metniyle denendi. Başka metin başka sonuç verebilir.
- B0'ın üstünlüğü kısmen yanlılık 1'den olabilir; kalıp tablosu YENİ sözlerde (örn. başka bir kullanıcı) bu kadar tutmayabilir.

**En çok şu yanlışlar bu karneyi bozar:** etiketlerin onaysız olması ve B0 yazarının test sözlerini görmüş olması. **Şu gözlem yakalar:** B0 canlı oturumda toplanacak yeni gerçek sözlerde (`ORION_KAYIT=1`) kesinlik ≥ %98'i koruyor mu, ve yazım hatalı/ASCII/İngilizce komutlarda LLM'e düşme oranı ne.

---

# Tur 2 — hibrit H1 (ön kayıt)

> 2026-10-02 · ÖN KAYIT — koşmadan önce donduruldu. Dondurulan: `tools/soz-siniflandirma/olc_hibrit.py`
> (`15bc79debb6a0f80`); `olc.py` değişmedi (`1e5c51482c41f2ea`), `etiketli.json` değişmedi (`cf46cbceab2b29fc`), repo başı `d169aa8`.
> Etiketler hâlâ **onaysız**. Bu ön kayıttan önce B0'ın gerçek sözlerde hangilerini kaçırdığına BAKILMADI (öngörüler sonradan uydurulmasın diye).

## Soru

Tur 1'de B0 (kalıp) kapıyı geçti, encoder'lar geçmedi; ama encoder'lar yazım/ASCII türevlerinde çok daha dayanıklıydı
(C3 %72 vs B0 %21). Hibrit — B0 önce, **yalnız B0'ın hiçbir kurala eşleşmediği yerde** C3 — B0'ın güvenliğini koruyup
kaçırdıklarını kurtarır mı?

## Tanım (donmuş)

1. B0 bir kurala eşleşirse sınıfı B0 verir (güven 1.0). **Bekçi kuralları (sohbet/emin_degil) da eşleşmedir**; C3 onları ezemez.
2. B0 eşleşmezse C3 kNN çıktısı (sınıf, güven) (Tur 1'deki bellek ve grup-dışarıda-bırak kuralı aynen).
3. LLM'siz yol: tahmin ∈ {hareket, sorgu} ve güven ≥ τ. τ = kalibrasyon kümesinde **tüm boru hattının** kesinliği ≥ %98 veren en
   küçük eşik (`olc.tau_sec`); yoksa 1.01 (yalnız B0 yola gider).
4. Kontrol (ölçü doğrulaması): τ = 1.01'de H1'in yola gidenleri B0'ınkiyle birebir aynı olmalı (`olc_hibrit.py` assert eder).

## Öngörüler ve çürütücüler (donmuş)

| # | öngörü | çürüten |
|---|---|---|
| Q1 | kalibrasyonda bir τ_H1 **bulunur** (boru hattı kesinliği ≥ %98) [~%50] | bulunmazsa: H1 ≡ B0, kazanç yok |
| Q2 | gerçek sözlerde H1, B0'a **≥ 2 doğru yol ekler** ve **0 yanlış yol ekler** [~%40] | < 2 doğru ya da ≥ 1 yanlış eklenirse |
| Q3 | türevlerde etiketi hareket/sorgu olanların **doğru yola gitme oranı**: yazımda H1 ≥ B0 + 20 puan, ASCII'de H1 ≥ B0 + 10 puan | herhangi biri tutmazsa |
| Q4 | türevlerde H1'in yanlış yola gidenleri B0'ınkinden **en çok 2 fazla** | > 2 fazla |
| Q5 | gerçek sözlerde H1 kesinlik **≥ %98** ve yanlış yola giden **≤ 1** | tutmazsa |

## Kapı (donmuş)

**H1, B0'dan üstün sayılır ⇔ Q1 ✓ ve Q2 ✓ ve Q5 ✓.** Aksi halde karar değişmez: "kalıp tablosu yeter".
Üstünlük **entegrasyon izni değildir**; sonraki adım shadow bağlama (davranış değişmez) ve canlı oturumda yeni gerçek sözlerle teyit.

## Bilinen yanlılıklar

Tur 1'dekiler aynen geçerli (B0 yazarı listeyi gördü; etiketler onaysız; 23 yol sözü). Ek: τ'yı boru hattının TÜMÜNDE seçmek,
B0'ın doğru yola gittiği çok sayıda kalibrasyon örneğinin C3 hatalarını sulandırmasına izin verir; bilinçli seçim (sistem kesinliği
ölçülür) ama C3'ün tek başına güvenilirliği hakkında bir şey söylemez.

## Karne

> Koşu: 2026-10-02, `olc_hibrit.py` `15bc79debb6a0f80` (bu özetle koşuldu, düzenlenmedi). Çıktı: `tools/soz-siniflandirma/sonuc/karne-tur2.md` `[ÖLÇÜLDÜ]`.

| # | sonuç | ölçülen |
|---|---|---|
| Q1 | **✗** | τ_H1 **bulunamadı** (kalibrasyonda boru hattı kesinliği hiçbir eşikte ≥ %98 olmadı). Donmuş kural: H1 ≡ B0, kazanç yok |
| Q2–Q5 | ölçülmedi | kapı Q1'de düştü (H1 ≡ B0); puanlanmadı, uydurulmadı |

**Kapı sonucu: H1, B0'dan üstün DEĞİL.** Karar değişmez: "kalıp tablosu yeter".

### Koşuda yakalanan hata (benim kodum)

`olc_hibrit.py`'nin kontrol assert'i koşuyu durdurdu: "τ bulunamazsa 1.01 (yalnız B0 yola gider)" kuralının kodlaması B0'ın kendi
güvenini (1.0) da engelliyordu. Amaç (yalnız B0 yola gider) doğru, kod yanlış: sentinel kaynağa duyarlı olmalı. Q1 bu hatadan
**etkilenmez** (τ, sentinelden önce `tau_sec` ile bulunuyor ve çıktıda yazılı). Hata dosyada **düzeltilmedi** (dondurulmuş özetle koşulan kod
korunuyor); Tur 3 olursa yeni özetle düzeltilir.

### Keşif (SONRADAN, karara girmez) `[ÖLÇÜLDÜ]`

Kalibrasyon kümesi (185 örnek): B0 eşleşen 105, kNN'ye düşen 80. B0 tek başına kalibrasyonda 43 yola gitti, 43 doğru (%100).
Hibrit (B0 + kNN-kaynaklı τ):

| τ (yalnız kNN için) | boru hattı yola giden | kesinlik | kNN'nin eklediği doğru / yanlış |
|---|---|---|---|
| 0.5 | 70 | %82,9 | 15 / 12 |
| 0.7–0.8 | 54 | %96,3 | 9 / 2 |
| 0.9–1.0 | 48 | **%97,9** | 4 / 1 |

- τ=1.0'da bile tek hata var: **`orya git`** ("oraya git"in yazım hatalı hâli). B0'ın "oraya/buraya" bekçisi yazım hatasında eşleşmiyor, e5 de
  oybirliğiyle `hareket` diyor. 47/48 = %97,9, hedef %98: **bir örnek** fark ediyor.
- Yani kNN, B0'ın kaçırdığı yazım hatalı komutlardan 4'ünü doğru kurtarıyor, ama bekçi kurallarının yazım hatalı hâllerini (olumsuz/belirsiz) komut sanıyor.
- Hipotezler (denenmedi) `[SEZGİ]`: (a) bekçi kalıplarına yazım toleransı (bulanık eşleşme) ya da bekçileri de kNN'ye öğretmek (olumsuz/belirsiz için daha çok örnek);
  (b) %98 hedefi n=48'de bir örneğe bağlı; daha çok gerçek söz olmadan bu eşik ayırt edici değil; (c) yazım tolerasyonlu sözcük normalizasyonu (kök + bulanık eşleşme) önce, sonra kalıp.

### Tur 2 sonucu

Hibrit bu veriyle ve bu ön kayıtla **geçmedi** (Q1 ✗). Sınır dardı: hedefi %0,1 kaçırdı. Bir sonraki adım yeni gerçek söz toplamak ve bekçi kurallarının yazım dayanıklılığıdır.
**En çok şu yanlışlar bu karneyi bozar:** n=48'lik kalibrasyon (bir örnek kararı çeviriyor) ve onaysız etiketler. **Şu gözlem yakalar:** canlı oturumda yazım hatalı/olumsuz komutların ("oturma", "orya git") B0 ve hibritte yola gidip gitmediği.

---

# Keşif: dile göre ayrım (SONRADAN, ön kayıtsız, karara girmez)

> 2026-10-02 · Soru (Ozyn): "küçük modeller için Türkçe zorluyor olabilir mi, İngilizce daha iyi mi?" Tur 1 gömmeleri/tahminleri,
> 153 ORİJİNAL örnek (gerçek + benim tohumlarım; türevler hariç) dile göre bölündü. Dil sezgisi: sözcüklerin yarıdan fazlası küçük bir İngilizce
> listede mi (`[SEZGİ]`, elle denetlenmedi). **TR 106, EN 47.** argmax doğruluk / makro-F1, grup-dışarıda-bırak.

| aday | TR doğruluk | TR F1 | EN doğruluk | EN F1 |
|---|---|---|---|---|
| B0 | 72% | 0.76 | 74% | 0.77 |
| Laya | 26% | 0.19 | 25% | 0.25 |
| C1 ModernBERT-TR | 66% | 0.65 | **44%** | 0.38 |
| C2 mmBERT-tur | 66% | 0.66 | 59% | 0.60 |
| C3 e5 | 69% | 0.68 | **82%** | 0.83 |

Okuma `[ÖLÇÜLDÜ]` + yorum `[SEZGİ]`:
- Hipotez **yarı destekleniyor, genel değil**: yalnız C3'te İngilizce belirgin iyi (+13 puan). C1 (Türkçe ağırlıklı ön eğitim) beklendiği gibi İngilizcede kötü
  (%44); C2'de fark ters yönde; B0'da fark yok.
- **Laya'nın başarısızlığı dil sorunu değil:** İngilizcede de %25. Sebep sıfır atış başlığı ve seçenek metni, Türkçe değil.
- Karıştıranlar: İngilizce n = 47 ve çoğu benim yazdığım kanonik tohum (gerçek İngilizce söz az); kNN belleği aynı yazım tarzında. Temiz test için
  **eşleşmiş TR/EN çiftleri** (aynı söz iki dilde) gerekir; yapılmadı.

---

# Tur 3 — eşleşmiş TR/EN çiftleri ve iki-model hibrit H2 (ön kayıt)

> 2026-10-02 · ÖN KAYIT — koşmadan önce donduruldu. Dondurulan: `tools/soz-siniflandirma/olc_cift.py` (`cfd1de337c2f11cf`),
> `fixtures/soz/cift.json` (`8d6ca2424d9b54bc`, 65 çift, belleğe örtüşen 0); `olc.py` (`1e5c51482c41f2ea`) ve `etiketli.json`
> (`cf46cbceab2b29fc`) değişmedi; repo başı `7643004`. `olc_cift.py kalibre` TAMAM. Etiketler (gerçek sözler) hâlâ **onaysız**.
> Ozyn (2026-10-02): "ingilizce türkçe iki model kullanmamızda sakınca yok, B0 fena değil; en mantıklısı ile karar senin, hepsini test et."

## Soru

1. Tur 1 keşfindeki "İngilizce daha kolay" etkisi içerik karışıklığı mı, gerçek mi? (Aynı anlam iki dilde, 65 çift, 5 koşul:
   `tr`, `en`, `tr_ascii`, `tr_yazim`, `en_yazim`; yazım hatası aynı mekanizma ve tohumla.)
2. **İki-model hibrit H2** (B0 → dil tespiti → TR: ModernBERT-TR (C1) / EN: MiniLM (e1) ya da bge-small (e2), hangisinin kalibrasyon EN doğruluğu
   yüksekse) B0'dan üstün mü?

## Tanım (donmuş)

- Adaylar: C1 (`ytu-ce-cosmos/modernbert-tr-base`), C3 (`multilingual-e5-base`), e1 (`all-MiniLM-L6-v2`, ortalama havuz), e2 (`bge-small-en-v1.5`, CLS havuz).
  Tek-encoder adaylarında bellek = tüm `uretilmis` (dil kısıtsız); H2'de bellek yalnız aynı dilde (`dil_tespit` sezgisi).
- H2: B0 eşleşirse B0 (güven 1.0, kaynak "b0"); eşleşmezse dil → ilgili encoder kNN. LLM'siz yol: tahmin ∈ {hareket, sorgu} ve
  (kaynak b0 **ya da** kNN güveni ≥ τ). τ = kalibrasyonda tüm hattın kesinliği ≥ %98 en küçük eşik; yoksa kNN hiçbir zaman yola göndermez.
  (Tur 2'deki sentinel hatası burada kaynağa duyarlı yazıldı ve `kalibre` ile denendi.)
- İngilizce encoder seçimi kalibrasyon kümesinde EN doğruluğuna göre (teste bakılmaz).
- Dil farkı: çift başına (EN doğru − TR doğru) ortalaması, bootstrap %95 AA (2000, tohum 0); ayrık çift sayıları.

## Öngörüler ve çürütücüler (donmuş)

| # | öngörü | çürüten |
|---|---|---|
| T1 | B0: \|EN − TR\| doğruluk farkı ≤ 8 puan (kalıplar iki dil için yazıldı) | > 8 |
| T2 | C3: EN − TR ≥ **+5 puan** (Tur 1 keşfindeki +13 gerçek etki) | < +5 (etki içerik karışıklığıydı) |
| T3 | C1 (Türkçe): TR − EN ≥ **+15 puan** | < +15 |
| T4 | en iyi İngilizce encoder'ın EN doğruluğu ≥ C3'ün EN doğruluğu − 5 puan (küçük tek-dilli yeter) | daha düşük |
| T5 | en iyi İngilizce encoder'ın TR doğruluğu ≤ kendi EN doğruluğu − 15 puan (dil uyumsuzluğu) | fark < 15 |
| T6 | dil tespiti: 325 metinde (65 × 5) genel doğru ≥ %90 ve `tr_ascii` koşulunda ≥ %85 | altında |
| T7 | **H2 gerçek sözlerde:** τ_H2 bulunur ve kesinlik ≥ %98, yanlış yol ≤ 1 ve B0'a **≥ 2 doğru yol ekler** (B0: 17) [~%35] | herhangi biri tutmazsa |
| T8 | **H2 çiftlerde:** LLM'siz doğru-yol oranı yazım koşullarında (`tr_yazim`, `en_yazim`) B0 + ≥15 puan ve `tr`/`en`'de B0'dan düşük değil; yanlış yol ≤ B0 + 2 | tutmazsa |
| T9 | gecikme p50: e1 < 25 ms, e2 < 40 ms, C1 < 100 ms | aşarsa |

## Kapı (donmuş)

**İki-model sistem H2 benimsenir ⇔ T7 ✓ ve T8 ✓.** Aksi halde karar: "B0 ile devam; encoder ek katmanı kanıtlanmadı". Benimseme **entegrasyon izni
değildir**; sonraki adım shadow (davranış değişmez). T1–T5 dil sorusunu yanıtlar, kapıya girmez.

## Bilinen yanlılıklar

Çiftleri ben yazdım (stilim bellekteki tohumlarla aynı elden → kNN'ye hafif avantaj); B0 yazarı bu çiftleri görmeden yazılmadı ama B0 kalıpları Tur 1'de dondu
(çiftler sonradan yazıldı, B0 değişmedi). Dil tespiti sezgisel (kelime listesi) ve listeyi çiftleri yazarken genişlettim (bu yüzden T6 iyimser olabilir).
65 çift: bir çift ≈ 1,5 puan.

## Karne

> Koşu: 2026-10-02, `olc_cift.py` `cfd1de337c2f11cf` (düzenlenmedi). Çıktı: `tools/soz-siniflandirma/sonuc/karne-tur3.md` `[ÖLÇÜLDÜ]`.

**Eşleşmiş çiftler (65; doğruluk, bellek dil kısıtsız):**

| aday | tr | en | tr_ascii | tr_yazim | en_yazim | EN−TR fark [95% AA] |
|---|---|---|---|---|---|---|
| B0 | 42% | 37% | 42% | 26% | 26% | −5 [−12, +3] |
| C1 ModernBERT-TR | 69% | 68% | 55% | 58% | 62% | −2 [−14, +11] |
| C3 e5 | **80%** | **89%** | 74% | 77% | 80% | +9 [−2, +20] |
| e1 MiniLM | 71% | 74% | 72% | 66% | 62% | +3 [−9, +15] |
| e2 bge-small | 69% | 75% | 72% | 72% | 69% | +6 [−8, +20] |

**H2 (B0 → dil → C1 / e2; e2 kalibrasyon EN doğruluğuyla seçildi: e1 %44, e2 %46), τ_H2 = 0,61:**

| gerçek 71 söz | yola giden | doğru | yanlış | kesinlik | kapsama |
|---|---|---|---|---|---|
| B0 | 17 | 17 | 0 | 100% | 74% |
| H2 | 23 | 19 | **4** | **83%** | 83% |

H2'nin yanlış yola gidenleri: `ee`→hareket, `ne oldu?`→sorgu, `ne yapıyorsun`→sorgu, `neler yapabilirsin`→sorgu (hepsi sohbet). Kurtardığı: `ner görüyorsun`, `odada başka neler var`.

**Çiftlerde LLM'siz doğru-yol oranı (yanlış yol):** B0: tr 14% (0), en 11% (0), tr_ascii 14% (0), tr_yazim 0% (0), en_yazim 0% (0). H2: tr 71% (2), en 57% (1), tr_ascii 32% (1), tr_yazim 32% (3), en_yazim 25% (2).

Dil tespiti: genel %98 (tr %100, en %98, tr_ascii %100, tr_yazim %100, en_yazim %94). Gecikme p50: e1 6,2 ms · e2 11,4 · C3 32,0 · C1 37,7.

### Öngörü karnesi: 4/9 ✓

| # | sonuç | ölçülen |
|---|---|---|
| T1 | ✓ | B0 \|EN−TR\| = 5 puan ≤ 8 |
| T2 | ✓ | C3 EN−TR = +9 ≥ +5 (ama AA [−2, +20] sıfırı içeriyor: yön tutuyor, anlamlı değil) |
| T3 | ✗ | C1 TR−EN = **+1** < +15: ModernBERT-TR İngilizce çiftlerde de iyi (%68) |
| T4 | ✗ | e2 EN %75 < C3 EN %89 − 5: küçük İngilizce modeller çok dilli e5'ten geride |
| T5 | ✗ | e2 TR %69, EN %75 (fark 6 < 15): İngilizce encoder Türkçede çökmedi (bellekte Türkçe tohumlar var; sözcüksel eşleşme) |
| T6 | ✓ | dil tespiti %98 (tr_ascii %100) — liste çiftler yazılırken genişletildi, iyimser |
| T7 | ✗ | τ_H2 bulundu (0,61) ama gerçek sözlerde kesinlik %83, yanlış 4 > 1 (+2 doğru yol eklendi) |
| T8 | ✗ | yazım koşullarında B0 + ≥15 ✓ (+32, +25), tr/en'de B0'dan düşük değil ✓; ama `tr_yazim`'de yanlış yol 3 > B0 (0) + 2 |
| T9 | ✓ | e1 6,2 < 25; e2 11,4 < 40; C1 37,7 < 100 |

### Kapı sonucu (donmuş kurala göre)

**H2 benimsenmez** (T7 ✗, T8 ✗). Karar: "B0 ile devam; encoder ek katmanı bu veriyle kanıtlanmadı". Dil sorusu (T1–T5): "İngilizce kolay"
etkisi **zayıf ve çok dilli e5'e özgü** (+9, AA sıfırı içeriyor); iki dar modelin ikisi de tek çok dilli e5'ten geride.

### Bu turun en önemli bulgusu: B0'ın gerçek sözlerdeki %74'ü iyimserdi `[ÖLÇÜLDÜ]`

B0, GÖRÜLMEMİŞ çiftlerde LLM'siz kapsamada yalnız **%11–14** yakalıyor (yanlış yol 0; yani güvenli ama dar). Gerçek sözlerdeki %74, B0'ın yazarının o
sözleri görmüş olmasının (Tur 1 yanlılık 1) sonucuydu. "B0 fena değil" yargısı **güvenlik için doğru, genelleme için yanlış**: kalıp tablosu yeni
cümleleştirmelerin ~%85–90'ını LLM'e düşürüyor. Bu, Tur 1'in "B0 üstün" sonucunu **zayıflatır**: o karşılaştırma B0 lehine yanlıydı.

### Keşif (SONRADAN, karara girmez) `[ÖLÇÜLDÜ]`

- **Tek çok dilli e5 hibriti (B0 + C3):** τ yine **bulunamadı** (dil kısıtlı/kısıtsız ikisinde); kNN hiçbir şeyi yola göndermediği için B0'a eşit (gerçek 17/17, çiftlerde %11–14).
- **H2'nin τ=0,61'i kalibrasyona uydu:** kalibrasyonda 50/50 doğru, gerçekte 4 yanlış. Neden: kalibrasyon kümesi benim yazdığım resmî komut/sohbet cümleleri;
  Ozyn'in gerçek kısa/gevşek sohbeti ("ee", "ne oldu?", "ne yapıyorsun") bellekte yok, kNN dağılım dışı girdiye de yüksek oy payı veriyor. **Oy payı güven ölçüsü olarak
  dağılım dışında çöküyor.** Hipotez `[SEZGİ]`: en yakın komşu benzerliği (mutlak) eşiği ya da "komşular farklı sınıflarda mı" ayrımı daha iyi güven işareti olur; denenmedi.
- Dağılım uyumsuzluğu hem kalibrasyon hem bellek için geçerli: gerçek sözler daha kısa ve gevşek. Daha fazla GERÇEK söz (`ORION_KAYIT=1`) en yüksek getirili iş.

**En çok şu yanlışlar bu karneyi bozar:** çiftleri ve belleği aynı elden (ben) yazmam, onaysız gerçek etiketler, 65 çift. **Şu gözlem yakalar:** canlı oturumda Ozyn'in gerçek,
planlanmamış cümleleri B0'da ve kNN'de hangi oranda yola gidip doğru çıkıyor (aşağıda canlı/HTTP aşamaları).

---

# Tur 4 — HTTP sınırı ve canlı köprü (ön kayıt)

> 2026-10-02 · ÖN KAYIT — koşmadan önce donduruldu. Dondurulan: `tools/soz-siniflandirma/hizmet.py` (`33dd855d933909f2`),
> `http_dene.py` (`45aa9f527c3c9e3b`); `olc.py` `1e5c51482c41f2ea`, `olc_cift.py` `cfd1de337c2f11cf`, `etiketli.json` `cf46cbceab2b29fc`; repo başı `5ae7637`.
> `hizmet.py kalibre` TAMAM. Kapsam: **B0** (Tur 1-3'te hiçbir encoder kapıyı geçmedi; hizmette encoder yok). Hizmet **gölge**: `/dusun` her zaman boş `cagrilar` döner.
> Ozyn (2026-10-02): "orionun tam http ve mcp desteği var sende test edebilirsin… hepsini test et."

## Düzenek

- **(a) HTTP sınırı, Electron'suz:** `hizmet.py` (spec 04 sözleşmesi: `GET /saglik`, `POST /siniflandir`, `POST /dusun`) + projenin kendi
  `tools/beyin-tekrar.ts --beyin=dis` aracı (gerçek `DisBeyin` istemcisi) ile `fixtures/beyin/*` oynatılır.
- **(b) Canlı köprü:** gerçek Orion (Electron) `becerdene` senaryosuyla (`ORION_BECERDENE_SOZLER`) **20 sözü gerçek `duydum` yolundan** enjekte eder,
  beyin olarak `ORION_BEYIN=dis` ile bu hizmet. Kayıtlar kalıcı hafızayı/günlüğü kirletmesin diye `ORION_HAFIZA_DOSYASI` ve `ORION_KARAR_DOSYASI`
  geçici dosyalara yönlendirilir. Smoke zamanlayıcısıyla kendiliğinden kapanır; ardından süreç ağacı denetlenir.
- Canlı sözler (donmuş; ilk 10 TR, son 10 EN; etiket): sandalyenin yanına git (hareket) · tahtaya bir şiir yaz (yaz) · odada ne var (sorgu) ·
  günün nasıl geçiyor (sohbet) · sakın oturma (emin_degil) · buraya gel (hareket) · ayağa kalk (hareket) · tahtada ne yazıyor (sorgu) ·
  iyi akşamlar (sohbet) · bak (emin_degil) · go next to the table (hareket) · write welcome on the board (yaz) · where is the window (sorgu) ·
  how is your day going (sohbet) · do not sit down (emin_degil) · come over here (hareket) · get up (hareket) · what do you see now (sorgu) ·
  good evening (sohbet) · go (emin_degil). Her söz arası 2500 ms.

## Öngörüler ve çürütücüler (donmuş)

| # | öngörü | çürüten |
|---|---|---|
| U1 | `beyin-tekrar.ts --beyin=dis` 3 fixture'ı hatasız oynatır (çıkış kodu 0, hizmet hatası yok) [~85%] | çıkış kodu ≠ 0 ya da sözleşme hatası |
| U2 | `/dusun`: 3 fixture'ın 3'ünde yanıt biçimi geçerli (`metin` string, `cagrilar` []); `002-soyle`'den **1** söz çıkar, `001-komut` ve `003-sessiz`'den **0** | herhangi biri |
| U3 | HTTP `/siniflandir` sınıfı çevrimdışı B0 ile **396/396 aynı** | tek uyumsuzluk bile |
| U4 | istemci tarafı gecikme (loopback, yeni bağlantı/istek): **p50 < 10 ms, p95 < 30 ms** | aşarsa |
| U5 | hedef çıkarımı: hareket/yaz etiketli gerçek + çift sözlerde **≥ %90** doğru | < %90 |
| V1 | hizmet enjekte edilen 20 sözden **≥ 18**'inin `/dusun`'unu alır | < 18 |
| V2 | alınan her `/dusun`'da çıkarılan söz enjekte edilenle **birebir** (≥ %95) | < %95 |
| V3 | hizmetin sınıfı, alınan sözlerin hepsinde çevrimdışı B0 ile aynı | tek fark |
| V4 | söz enjeksiyonundan hizmete varışa gecikme **p50 < 1500 ms** (günlük `t` ↔ hizmet günlüğü `t`) | aşarsa |
| V5 | Orion karar günlüğünde enjekte edilen **20/20** `duydum` satırı, `soz.metin` birebir | < 20 |
| V6 | sınıflandırıcı davranışı değiştirmez: hizmet 0 çağrı döner, günlüğün `uyanis` satırlarında beden niyeti 0 | niyet varsa |
| V7 | gerçek `orion-hafiza.json` (özet `87e8a365087f2099`) ve gerçek `karar-kaydi/` değişmez | değişirse |
| V8 | Orion smoke süresinde kendiliğinden kapanır; sonra artık Electron/hizmet süreci kalmaz | kalırsa |

## Kapı

Tur 4 bir karar kapısı değil, **entegrasyon ölçümüdür**: tüm U/V tutarsa B0 hizmeti, gölge olarak köprüye bağlanmaya hazırdır (davranış değişmez); tutmayan her madde
bağlamadan önce kapatılacak bir eksik olarak listelenir. Üretim bağlaması (`siniflandirmaGolge`) ayrı kod değişikliği ve ayrı karar.

## Bilinen yanlılıklar

Canlı sözler çiftlerden (B0'dan bağımsız yazılmış, B0 kalıplarına karşı kapsamı %11–14 ölçülen metin türü) seçildi; B0 çoğunu LLM'e düşürecek ve bu **beklenen**
(sınıflandırıcının doğruluğu değil, sınır uyumu ölçülüyor). Hedef çıkarımı kuralları benim yazımım; çiftlerde etiket-hedef de benim: kendi kendine uyum riski.

## Karne

> Koşular: 2026-10-02. (a) `http_dene.py` `45aa9f527c3c9e3b`, çıktı `sonuc/karne-tur4a.md`; (b) `canli_kos.sh` + `canli_puanla.py`, çıktı `sonuc/karne-tur4b.md`,
> Orion karar günlüğü `sonuc/canli-karar.jsonl`, hizmet günlüğü `sonuc/canli-dusun.jsonl` `[ÖLÇÜLDÜ]`. Dondurulan dosyalar düzenlenmedi.

### (a) HTTP sınırı

| # | sonuç | ölçülen |
|---|---|---|
| U1 | **✗** (harfi harfine) | `beyin-tekrar.ts --beyin=dis` çıkış kodu 1. **Sözleşme hatası yok**: 3 fixture'ın 3'ü ~3 ms'de oynadı, yanıtlar ayrıştı; araç, kayıtlı eski çıktıyla (dunya_komut / dunya_soyle) karşılaştırıp "yeni: eylem yok, eski: …" diye 2 FARKLI saydığı için 1 döndü. Gölge hizmet bilerek eylem üretmiyor; öngörüm yanlış kurulmuştu (çıkış kodunu sözleşme uyumuna bağladım) |
| U2 | ✓ | `/dusun` biçimi 3/3 geçerli; `002-soyle`'den 1 söz çıktı (`Ozyn dedi: "…"`), `001`/`003`'ten 0 |
| U3 | ✓ | HTTP == çevrimdışı B0: **396/396** |
| U4 | ✓ | istemci gecikmesi p50 **0,61 ms**, p95 15,85 ms, p99 20,9 ms (n=396); hizmet içi p50 0,017 ms |
| U5 | **✗** | hedef çıkarımı 146/167 = **%87** < %90. Yanlışlar iki sınıf: (1) ÖRTÜK hedef: "birseyler yaz", "write your name" (etiket `tahta`, metinde yok; 5 gerçek söz); (2) yazım hatalı türevler ("penceerye", "maasnın", "wndow", "montor"): önek eşleşmesi yazım toleranssız |

### (b) Canlı köprü (gerçek Orion, `becerdene` ile 20 söz, beyin = bu hizmet)

| # | sonuç | ölçülen |
|---|---|---|
| V1 | ✓ | hizmet 20/20 `/dusun` aldı |
| V2 | ✓ | çıkarılan söz 20/20 birebir (çok-söz içeren istek 0) |
| V3 | ✓ | canlı sınıf == çevrimdışı B0: 20/20 |
| V4 | ✓ | enjeksiyondan hizmete varış p50 **3 ms**, p95 4 ms (beklenen 1500 ms'in çok altı: `duydum` anında düşünür) |
| V5 | ✓ | günlükte 20/20 `duydum`, `soz.metin` birebir |
| V6 | ✓ | 20 uyanış, beden niyeti 0, LLM çağrısı 0, hata 0 (gölge davranışı değiştirmedi) |
| V7 | ✓ | gerçek `orion-hafiza.json` özeti ve `karar-kaydi/2026-10-02.jsonl` boyutu aynı (yönlendirme çalıştı) |
| V8 | ✓ | Orion çıkış kodu 0, 69,6 sn; sonrasında artık Electron süreci yok |

**Öngörü karnesi: 11/13 ✓** (U1, U5 ✗).

**Canlı sözlerde B0'ın kendisi:** 20 sözün **8'inde doğru sınıf**; LLM'siz yola giden hareket/sorgu 10 sözden **2'si** (sandalyenin yanına git, where is the window), **yanlış yola giden 0**.
Tur 3'teki %11–14 kapsama canlıda tekrarlandı: B0 güvenli ama dar. "buraya gel" bekçi kuralına (`buraya`) takılıp LLM'e düştü; "ayağa kalk", "get up", "come over here" hiçbir kurala girmedi.

### Koşuda yakalananlar (kendi hatam ve dokümantasyon tuzağı)

1. **İlk canlı koşu geçersiz (benim kurulum hatam):** `ORION_BEYIN_ADRES=127.0.0.1:4700` (şemasız) verdim; `DisBeyin` `fetch("127.0.0.1:4700/saglik")` ile başarısız oldu → `hazir=false` → Orion "kurallı varlık" kipine düştü, hizmet 0 istek aldı. `3dorion.bat` başlığı varsayılanı "127.0.0.1:4700" diye yazıyor; **`http://` şart**.
   Çıktılar `sonuc/canli1-*` olarak saklandı, puanlamaya girmedi; düzeltilmiş adresle yeniden koşuldu (öngörüler aynen).
2. İlk koşuda bile günlükte 20 `duydum` yazıldı: söz yolu, beyin hazır olmasa da çalışıyor (köprü sözü her zaman alıyor).

### Sonuç ve bağlama için eksik listesi

Hizmet, sözleşme ve canlı köprü sınırında **doğru ve hızlı** çalışıyor (U2–U4, V1–V8). Sınıflandırıcının KENDİSİ dar (B0 kapsama ~%10–20 görülmemiş sözlerde). Bağlamadan önce kapatılacaklar:
- **Örtük hedef kuralı:** `yaz` sınıfında terminal sözcüğü yoksa varsayılan `tahta` (U5 (1)); yazım toleransı (U5 (2)). Ön kayıtsız bir hipotez; denenmedi.
- **`buraya`/`oraya` bekçisi** "buraya gel"i (komut) LLM'e düşürüyor: Türkçede "buraya gel" kanonik bir komut; bekçi yalnız belirsiz hedefli ("oraya git") için olmalı.
- **Kapsamayı artıran şey encoder değil, B0 kalıplarının genişlemesi + gerçek söz** (Tur 3: hiçbir encoder kapıyı geçmedi). Spec 13 Faz 2 komut sözlüğü bu işin üretim karşılığı; bu çıktı ona **ölçüt ve örnek seti** olarak girebilir (`fixtures/soz/etiketli.json`, `cift.json`).

**En çok şu yanlışlar bu karneyi bozar:** canlı sözleri ve hedef kurallarını ben yazdım; 20 söz küçük; tek koşu (gecikmeler tekrarlanmadı). **Şu gözlem yakalar:** hizmet gölge olarak üretim köprüsüne bağlanıp birkaç gün gerçek Ozyn sözleri aldığında B0'ın `yol` kararlarının günlükteki LLM davranışıyla (`uyanis.niyetler`) uyumu.

---

# Tur 5 — üretim komut sözlüğü (`mind/komutSozlugu.ts`) görülmemiş sözlerde (ön kayıt)

> 2026-10-02 · ÖN KAYIT — koşmadan önce donduruldu. Dondurulan: `tools/soz-siniflandirma/olc_uretim.py` (`0f340206d0ac97d5`),
> `uretim_sozluk.ts` (`11a0b01b682d8fab`, yalnız `komutCoz`u çağırır), ölçülen bileşen `mind/komutSozlugu.ts` (`c4fdf78cb6fffadb`, commit'li),
> `etiketli.json` `cf46cbceab2b29fc`, `cift.json` `8d6ca2424d9b54bc`; repo başı `eedd006`. `olc_uretim.py kalibre` TAMAM.
> Ozyn: "devam". Bağlam: spec 13 Faz 2b sözlüğü yazıldı (başka oturum); kendi notu "62 söz kalıplar yazılırken görüldü; **ayrı tutulmuş bir sınav değil**".

## Soru

Üretim sözlüğü, yazarlarının GÖRMEDİĞİ sözlerde (a) yanlış eşleşme 0'ı koruyor mu, (b) beden komutlarının ne kadarını yakalıyor? Benim B0'ımla (aynı veri, aynı metrik) karşılaştırması.
**Ben sözlüğün kalıp listesini bu ön kayıttan ÖNCE okumadım** (yalnız başlığını/API'sini); öngörüler başlıktaki tarif ("sözün TAMAMI bir kalıba uymalı: otur, kalk, bana/yanıma gel, dur, bana bak, `<yer>(y)a git`, `<yer>(y)e bak`, bilgisayarı aç/kullan") üzerinden.

## Tanım (donmuş)

Metrik yalnız `hareket` yolu (sözlüğün kapsamı bu). Yola giden = sözlük `komutCoz` eşleşti (P) ya da B0 sınıfı hareket. Pozitif = etiketi hareket; nötr = etiketi emin_degil ve bileşik
(`ve|and|then|sonra`; sözlüğün bilerek zincir yazdığı "masaya git ve otur" türü, yanlış sayılmaz); negatif = geri kalan. Kapsama = eşleşen pozitif / pozitif; yanlış = eşleşen negatif.
Kümeler: gerçek 71 (yazarlar gördü), tohum orijinal (benim, 163), tohum türev (ASCII/yazım), çift × 5 koşul (65'er), canlı 20.

## Öngörüler ve çürütücüler (donmuş)

| # | öngörü | çürüten |
|---|---|---|
| W1 | P'nin **yanlış eşleşmesi 0** — tüm kümelerde toplam (negatif sözde program çalışmaz) [~%75] | ≥ 1 yanlış eşleşme |
| W2 | P'nin çift kümelerinde hareket kapsaması: `tr` **≤ %20**, `en` **≤ %5** (kalıplar Türkçe, dar) | `tr` > %20 ya da `en` > %5 |
| W3 | P'nin gerçek 71'deki hareket kapsaması **≥ %50** (yazarlar gördü) | < %50 |
| W4 | P'nin canlı 20'deki hareket kapsaması **≤ 1/6** (sandalyenin yanına git, buraya gel, ayağa kalk, go next to the table, come over here, get up) | ≥ 2 |
| W5 | B0'ım çiftlerde (`tr` ve `en` birlikte) P'den **yüksek ya da eşit** kapsama verir (B0 Tur 3: %14 / %11) | P'nin kapsaması B0'dan yüksek |
| W6 | P, B0'ın yakalayamadığı en az bir hareket sözü yakalar (ikisi birbirinin üst kümesi değil) | P ⊆ B0 |

## Kapı

Bu bir kapı değil, **üretim bileşeninin ayrı tutulmuş sınavı**. W1 ✗ ise (görülmemiş sözde yanlış eşleşme) bu Ozyn'a bildirilir ve ilgili kalıp önerilir; W2–W4 kapsama boşluğunu
ölçer ve **kaçırılan sözler listesi** sözlük genişletmesi için somut girdidir. Bileşen bu turda DEĞİŞTİRİLMEZ (başka oturumun ve Ozyn'ın kararı).

## Bilinen yanlılıklar

Çiftleri/canlı sözleri/tohumları ben yazdım (aynı elden, sözlüğü görmeden); etiketler onaysız; "bileşik → nötr" kuralı sözlüğün niyetine uyuyor ama benim seçimim.

## Karne

> Koşu: 2026-10-02, `olc_uretim.py` `0f340206d0ac97d5` (düzenlenmedi). Çıktı: `tools/soz-siniflandirma/sonuc/karne-tur5.md` `[ÖLÇÜLDÜ]`. Ölçülen: `mind/komutSozlugu.ts` `c4fdf78cb6fffadb`.

| küme | n | pozitif (hareket) | **P (üretim sözlüğü) kapsama** | P yanlış | B0 kapsama | B0 yanlış |
|---|---|---|---|---|---|---|
| gerçek 71 (yazarlar gördü) | 71 | 14 | 12/14 (86%) | **0** | 12/14 (86%) | 0 |
| tohum orijinal (benim) | 82 | 22 | 8/22 (36%) | **0** | 21/22 (95%)* | 0 |
| tohum türev (ASCII/yazım) | 194 | 46 | 7/46 (15%) | **0** | 11/46 (24%) | 0 |
| çift tr | 65 | 16 | 3/16 (19%) | **0** | 2/16 (12%) | 0 |
| çift en | 65 | 16 | 0/16 (0%) | **0** | 1/16 (6%) | 0 |
| çift tr_ascii | 65 | 16 | 3/16 (19%) | **0** | 2/16 (12%) | 0 |
| çift tr_yazim | 65 | 16 | 0/16 (0%) | **0** | 0/16 (0%) | 0 |
| çift en_yazim | 65 | 16 | 0/16 (0%) | **0** | 0/16 (0%) | 0 |
| canlı 20 | 20 | 6 | 2/6 (33%) | **0** | 1/6 (17%) | 0 |

\* B0'ın tohum orijinaldeki %95'i yanlılıktır: B0'ı o tohumlara bakarak yazdım (Tur 1 yanlılığı); yazarı o cümleleri görmemiş üretim sözlüğünde %36.

### Öngörü karnesi: 5/6 ✓

| # | sonuç | ölçülen |
|---|---|---|
| W1 | ✓ | 9 kümede toplam **0 yanlış eşleşme** (negatif söz: sohbet/sorgu/yaz/olumsuz/belirsiz) |
| W2 | ✓ | çift `tr` %19 ≤ %20 (sınırda), `en` %0 ≤ %5 |
| W3 | ✓ | gerçek 71'de %86 ≥ %50 |
| W4 | **✗** | canlı 20'de 2/6 (≤ 1 öngörmüştüm): sözlük "buraya gel" ve "ayağa kalk"ı yakaladı; ikisini de kaçırır sanmıştım |
| W5 | ✓ | çiftlerde `tr+en` toplamı P 3/32, B0 3/32: eşit |
| W6 | ✓ | P, B0'ın kaçırdığı sözleri yakalıyor (ör. "ayağa kalk", "buraya gel", "sandalyeye git"); B0 da P'nin kaçırdıklarını (ör. İngilizce "come here"): ikisi birbirinin üst kümesi değil |

### Bulgular

1. **Güvenlik güçlü `[ÖLÇÜLDÜ]`:** üretim sözlüğü, yazarlarının görmediği 700'ü aşkın metinde (olumsuz "oturma", yetenek sorusu "oturabilir misin?", belirsiz hedef "oraya git", bileşik, sohbet) **hiç yanlış eşleşmedi**. "Dar ve kesin" tasarım hedefine ulaşmış.
2. **Kapsama dar `[ÖLÇÜLDÜ]`:** görülmemiş Türkçe cümleleştirmelerde ~%19, İngilizcede %0, yazım hatalı/ASCII-bozuk sözlerde %0–15. Gerçek 71'deki %86, kalıplar yazılırken görülmüş olmanın sonucu (spec 13'ün kendi notuyla tutarlı).
3. **Kaçırılan hareket sözleri, sözlük genişletmesi için somut girdi:**
   - Türkçe aile (13 çift sözü): "X'in yanına git" (masanın/sandalyenin/pencerenin yanına), "X'e doğru git/yürü" (tahtaya doğru, pencereye doğru), "hemen otur", "kalk ayağa", "koltuğa otur", "kıpırdama", "bana doğru yürü", "pencereden dışarı bak", "monitöre odaklan", "bilgisayarın başına geç", "tahtanın karşısına geç".
   - İngilizce aile (hepsi, 16/16 + tohum): "sit down", "stand up", "get up", "come here / come to me / come over here", "go to the X / go next to the X", "look at the X", "open the computer", "stop", "freeze", "take a seat", "head to the board".
4. Ozyn'ın "İngilizce de sorun değil" kararına göre **İngilizce paket, kapsamayı en çok artıracak tek hamle**: sözlükte hiç İngilizce kalıp yok (P `en` %0).

### Sınırlar

Etiketler onaysız; çiftleri/tohumları/canlı sözleri ben yazdım (sözlüğü görmeden, ama aynı elden); "bileşik → nötr" seçimi benim. Bileşen bu turda DEĞİŞTİRİLMEDİ.

**En çok şu yanlışlar bu karneyi bozar:** tek yazar (ben) tüm negatifleri üretti: sözlüğün yanlış eşleşme güvencesi benim aklıma gelmeyen negatiflerde ölçülmedi. **Şu gözlem yakalar:** bağımsız bir yazarın (farklı model/kişi) yazdığı kör bir set; ve canlı kullanımda `program` satırlarının `komut-tara` ile denetimi.

---

# Tur 6 — komut sözlüğü genişletmesi, bağımsız yazarın kör setiyle (ön kayıt)

> 2026-10-03 · ÖN KAYIT — **sözlüğe dokunmadan önce** donduruldu. Dondurulan: `fixtures/soz/kor.json` (`7e2215c719f79118`, 120 cümle, bağımsız yazar:
> kalıpları görmeyen ayrı bağlam, araçsız), `tools/soz-siniflandirma/olc_kor.py` (`c12c64516fa5e9bd`), ölçülen bileşenin GENİŞLETME ÖNCESİ hâli
> `mind/komutSozlugu.ts` (`c4fdf78cb6fffadb`) ve testi (`7c447ee1ad1aedd1`); repo başı `cf0e5bf`. İki oturum paralel çalışıyor: ben yalnız
> `mind/komutSozlugu.ts`, testi ve `tools/soz-siniflandirma/`, diğeri `giris.ts`/`uygulama/`/`kopru.ts`.

## Önce ölçümü `[ÖLÇÜLDÜ]` (`sonuc/kor-once.json`, `sonuc/karne-tur6-once.md`)

Kör sette hareket kapsaması **13/48 (%27)**: Türkçe 13/30 (%43), İngilizce **0/18**. Yanlış eşleşme **0** (58 negatif). Soru kovasında eşleşen: yalnız `oturur musun` (1/8; sözlükte zaten komut olarak yazılı).

## Dürüstlük notu (kör setin kirlenmesi)

Kör seti yazdırdıktan sonra OKUDUM. Bu yüzden kalıpları **cümlelere göre değil sözcük/dil bilgisi ailelerine göre** yazacağım; aileler Tur 5'in kör olmayan çift/tohum kaçan listesinden ve dil
bilgisinden çıkarıldı: yer+(n)in yanına/önüne/başına git·geç; `<yer>(y)e doğru git·yürü`; koltuk≈sandalye (ğ→k yumuşama); `<bilgisayar/ekran/monitör>(e) odaklan`; "kıpırdama/hareket etme";
dolgu sözcükleri (hemen, şimdi, bi, biraz, zahmet olmazsa, please, hey, now…); İngilizce kalıp paketi (sit down/stand up/get up/stop/freeze/come here/come to me/go to the X/look at the X/open·turn on the computer/take a seat…).
Kör sette **tek tur** ölçerim; sonuca bakıp aynı sette ayar YAPMAM. Kalan kaçanlar sonraki kör set için aile listesi olur.

## Öngörüler ve çürütücüler (donmuş)

| # | öngörü | çürüten |
|---|---|---|
| X1 | **Yanlış eşleşme 0**: kör negatifler (58) ve önceki bütün kümeler (gerçek 71, çift 5×65, canlı 20, tohum 276) | tek yanlış eşleşme |
| X2 | kör sette hareket kapsaması: hepsi **≥ %60 (≥ 29/48)**, Türkçe **≥ %65 (≥ 20/30)**, İngilizce **≥ %55 (≥ 10/18)** | herhangi biri altında |
| X3 | **soru kovası** (8): eşleşen kümesi aynen `{oturur musun}` kalır; YENİ soru-biçimi eşleşmesi 0 (can/could/will you, -ebilir misin, -ar mısın eklenmez; karar Ozyn'ın) | yeni eşleşme |
| X4 | önceki kümelerde (Tur 5 ölçümüyle) çift `tr` kapsaması **≥ %44**, çift `en` **≥ %25**; gerçek 71'de hareket kapsaması **≥ 12/14** | altında |
| X5 | kalite kapıları: `mind/komutSozlugu.test.ts` yeşil (yeni pozitif + yeni olumsuz/soru/bileşik/belirsiz testleri), `npm run typecheck` 0 hata, `tools/mimari.test.ts` yeşil, `tools/komut-tara.ts` gerçek günlükte yanlış 0, dosya CRLF'i korundu (CR sayısı = satır sayısı) | herhangi biri |
| X6 | bozma geçişi: 6–8 bilinçli bozma (kalıpta `^`/`$`, dolgu listesi, yumuşama, yer çözümü, İngilizce kalıp) → **≥ %80'i testlerce yakalanır** | < %80 |

## Kabul kapısı (donmuş)

**Genişletme kabul edilebilir ⇔ X1 ve X2 ve X3 ve X5.** (X4 ve X6 raporlanır; X6 < %80 ise eksik test eklenir, kapıyı kapatır.) Aksi halde: değişiklik **önerilmez**, ölçüm ve diff Ozyn'a gösterilir.
**Commit yok** (Ozyn onayı; yalnız kendi dosyalarım).

## Bilinen yanlılıklar

Kör seti okudum (yukarıda). Etiketler yazarın, tek model/bağlam: tam bağımsızlık değil, benden bağımsız. Sözlüğün güvenlik iddiası tek yazarın aklına gelen negatiflerle sınırlı.

## Karne

> Koşular: 2026-10-03. Önce: `sonuc/karne-tur6-once.md`; sonra: `sonuc/karne-tur6-sonra.md`. Genişletilmiş `mind/komutSozlugu.ts` `e2977d10a44960f7`, testi `e8d91b866d28e723`
> (bozma geçişinde bulunan bir boşluk için 1 test eklendi). Dosya satır sonu (LF) korundu; bayt sayımıyla doğrulandı. Commit YOK.

| kör set 1 (`kor.json`, 120) | önce (özgün sözlük) | sonra (genişletilmiş) |
|---|---|---|
| hareket kapsaması (48) | 13/48 (%27) | **46/48 (%96)** |
| Türkçe (30) | 13/30 (%43) | 28/30 (%93) |
| İngilizce (18) | 0/18 (%0) | 18/18 (%100) |
| yanlış eşleşme (58 negatif) | 0 | **0** |
| soru kovasında eşleşen | `oturur musun` | `oturur musun` (aynı) |

Kalan kaçanlar: "bi dur şuracıkta", "pencreye git" (yazım hatası).

### Öngörü karnesi: 6/6 ✓

| # | sonuç | ölçülen |
|---|---|---|
| X1 | ✓ | yanlış eşleşme 0: kör set 1 (58 negatif) ve önceki 9 küme (gerçek 71, tohum 276, çift 5×65, canlı 20) |
| X2 | ✓ | hepsi %96 ≥ %60, Türkçe %93 ≥ %65, İngilizce %100 ≥ %55 |
| X3 | ✓ | soru kovası aynen `{oturur musun}`; yeni soru-biçimi eşleşmesi 0 |
| X4 | ✓ | çift `tr` %19 → %100 (≥ %44), çift `en` %0 → %100 (≥ %25), gerçek 71'de 13/14 (≥ 12/14) |
| X5 | ✓ | `komutSozlugu.test.ts` 31/31, `npm run typecheck` 0 hata, `tools/mimari.test.ts` 5/5, **tam `npm test` 2300/2300**, `komut-tara` gerçek günlükte 14 eşleşme / 14 gerçek komut / **0 yanlış** |
| X6 | ✓ | bozma geçişi **12/12 yakalandı** (ilk koşuda 11/12; kaçan M7'yi kapatan "go over next to the table" testi eklendi) |

### Dikkat: bu rakamlar iyimser (Tur 5 çift/canlı kümelerindeki %100'ler de)

Kör seti 1'i yazdırdıktan sonra okudum; çift ve canlı sözler de kalıp ailelerini çıkardığım listelerdi. Bu yüzden %96/%100 **temas etkisi içerir**. Temiz ölçüm Tur 6b'de.

### Genişletmenin içeriği

Dolgu sözcükleri her yerden atılır (hemen, şimdi, bi, biraz, zahmet olmazsa, please, hey, now…); `<yer>(n)in yanına/önüne/başına/karşısına git·geç·gel·yürü`; `<yer>(y)e doğru git·yürü`, `yaklaş`; `<yer> gel`; koltuk = sandalye (ğ→k yumuşaması); `<bilgisayar/ekran/monitör>(e) odaklan`; "kıpırdama/hareket etme" = dur (zıt anlamlı "durma" yok); "kalk ayağa"; "pencereden dışarı bak"; bana doğru gel/yürü/yaklaş; **İngilizce paketi** (sit/stand/stop/freeze/come/look/go/open·turn on·use the computer…).
Soru biçimi ve olumsuz BİLEREK eklenmedi.

### Politika değişikliği (Ozyn'a bildirilir)

1. `"open the monitor"` artık LLM'e gitmiyor, bilgisayar programına gidiyor. Eski test onu "belirsiz, LLM'e" listesinde tutuyordu (İngilizce paket yokken). Gerçek günlükte Ozyn'ın bu sözü bir komuttu; `komut-tara` onu gerçek komut saydı.
2. **Soru biçimi tutarsızlığı (karar Ozyn'ın):** `oturur musun`, `kalkar misin`, `bakar misin bana` komut; `oturabilir misin`, `gelebilir misin`, `can you come here` LLM'e. Genişletme bunu değiştirmedi, yalnız testle sabitledi.

---

# Tur 6b — genişletilmiş sözlük, İKİNCİ bağımsız kör set (ön kayıt)

> 2026-10-03 · ÖN KAYIT — ikinci yazar cümleleri yazmadan ÖNCE donduruldu. Ölçülen: genişletilmiş `mind/komutSozlugu.ts` (`e2977d10a44960f7`; test dosyası
> bozma geçişi sonrası son hâli), 31 test yeşil. Bu kod, ikinci setin içeriğini GÖRMEDEN yazıldı ve artık DEĞİŞMEZ.
> Neden: Tur 6'daki kör seti (`kor.json`) yazdırdıktan sonra okudum; %96 kapsama o temasla iyimserleşmiş olabilir. İkinci set, temiz bir genelleme tahmini verir.

## Öngörüler ve çürütücüler (donmuş)

| # | öngörü | çürüten |
|---|---|---|
| Y1 | **Yanlış eşleşme 0** (negatifler: sohbet/sorgu/yaz/olumsuz/belirsiz) [~%70] | tek yanlış eşleşme |
| Y2 | hareket kapsaması **≥ %50** (genel) [Tur 6'da %96; temas etkisini düşünerek %60–75 beklerim] | < %50 |
| Y3 | İngilizce kapsama **≥ %50**, Türkçe kapsama **≥ %50** | herhangi biri altında |
| Y4 | soru kovasında YENİ eşleşme yok (eşleşen küme `{oturur musun, kalkar misin, bakar misin bana}` içinde kalır) | küme dışı eşleşme |
| Y5 | kapsama kaybı (kör set 1 → 2) **≥ 10 puan** (temas etkisi gerçek) | fark < 10 puan: temas etkisi küçüktü |

Aynı betik (`olc_kor.py`, `fixtures/soz/kor2.json`'a yönlendirilir), aynı roller (pozitif/nötr/soru/negatif). Sonuca bakıp sözlük **değiştirilmez**; kaçanlar sonraki tur için aile listesi olur.

## Karne

> Koşu: 2026-10-03. İkinci yazar `fixtures/soz/kor2.json` (`b735dca44887e5aa`, 120 cümle), genişletilmiş sözlük `e2977d10a44960f7` (içeriği görülmeden yazıldı, değişmedi). Çıktı: `sonuc/karne-tur6b.md`.

| temiz set (`kor2.json`, 120) | önce (özgün sözlük) | sonra (genişletilmiş) |
|---|---|---|
| hareket kapsaması (48) | 4/48 (%8) | **27/48 (%56)** |
| Türkçe (28) | — | 15/28 (%54) |
| İngilizce (20) | — | 12/20 (%60) |
| yanlış eşleşme (58 negatif) | 0 | **0** |
| soru kovasında eşleşen | — | yalnız `oturur musun?` (mevcut) |
| bileşik kovası eşleşen | — | 1 (`go to the desk and sit down`: İngilizce `git+otur`, Türkçe `masaya git ve otur`'un karşılığı, bilerek) |

### Öngörü karnesi: 5/5 ✓

| # | sonuç | ölçülen |
|---|---|---|
| Y1 | ✓ | yanlış eşleşme 0 |
| Y2 | ✓ | %56 ≥ %50 |
| Y3 | ✓ | İngilizce %60, Türkçe %54 (ikisi ≥ %50) |
| Y4 | ✓ | soru kovasında yeni eşleşme yok |
| Y5 | ✓ | kör set 1 → 2: %96 → %56 = **40 puan düşüş** (temas etkisi / daha çeşitli set) |

### Bulgular

1. **Gerçek, temiz kazanç: %8 → %56** (+23 söz, yanlış eşleşme 0). İlk setteki %96 temas etkisiyle şişmişti; temiz rakam %56.
2. **Güvenlik iki bağımsız yazarda da 0 yanlış eşleşme** (116 negatif; olumsuz, belirsiz, soru, bileşik, geçmiş/koşul/meta, tuzaklı "dün tahtaya gittin", "komut verirken 'otur' demek yeterli mi").
3. **Kaçırılan aileler (sonraki tur için; sözlük bu sete bakılarak DEĞİŞTİRİLMEDİ):**
   - Dolgu: "abi", "kardeşim", "hocam", "go ahead and", "for a bit", "right there" (`bana gel abi`, `yanima gel kardesim`, `go ahead and open the computer`, `use the computer for a bit`, `stop right there`).
   - Takma ad / eşanlamlı: cam→pencere (`cama git`), pc→monitör (`pc yi kullan`), `çök`→otur, `bekle`/`hold on`→dur?, `dön`→git (`masaya dön`), `göz at`/`glance at`/`face`→bak, `approach`→git, `rise from`→kalk.
   - Yapı: `<yer> tarafına bak`, `<yer>(n)in yanına yaklaş`, `<yer>(n)in önünde dur`, "şu <yer>(y)e otur" (gösterme sıfatı, dikkat: "şuraya/şuna" belirsiz kalmalı).
   - Yazım hatası: `bilgisyarı aç` (bilerek bulanık eşleşme YOK; güvenlik).
4. İki set arasındaki fark, tek bir kör setle ölçüm yapmanın sınırını gösteriyor: üçüncü ve dördüncü bağımsız set hedef kapsamaya yakınsama eğrisi verir.

**En çok şu yanlışlar bu karneyi bozar:** iki yazar da aynı model ailesinden; negatifler hep model aklından geldi. **Şu gözlem yakalar:** kod canlıya girip birkaç gün gerçek Ozyn sözleri alırsa `program` satırlarının `komut-tara` ile denetimi (yanlış eşleşme 0 sürmeli).
