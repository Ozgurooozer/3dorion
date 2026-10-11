# Spec 25 — Orion gerçekten görsün (yerel görme modeli)

> Durum: **V0 koşuldu** (yanlış soruyu ölçtü, §4) · **Faz 1 ALGI (NPC) uygulandı** (§5) · Faz 2 GÖRME sırada (§6).
> Ön kayıt (§1) koşudan önce commit edildi (`fb16533`), değiştirilmedi.

## 0. Neden
Ozyn (2026-10-11, spec 24 C3'ten sonra): "elimizde Google Gemma yerel modeli var, iki adet, biri büyük biri küçük;
resim inceleme özelliği var. Orion gerçekten görse olmaz mı?" — "güzel fikir, dene".

Orion bugün bir LİSTE görüyor: hangi nesnenin nerede olduğu ve örtülü olup olmadığı geometriden hesaplanır
(`world/player/gorunurluk.ts`, spec 15; level nesneleri spec 23 B). Neye benzediğini, ışığı, Ozyn'in ne yaptığını
bilemez. Görme modeli bu boşluğu doldurabilir — ama uydurursa Orion yanlış dünyada yaşar. Önce ÖLÇ.

Yerel modeller (`ollama show`): `gemma4:e2b` (4,6B, Q4_K_M) ve `gemma4:e4b` (7,5B, Q4_K_M) — ikisi de vision + audio +
tools + thinking. Ön yoklama (2 kare, ön kayıtsız, sonuç sayılmaz): e2b sıcakken 0,9 sn, kaba ama doğru; e4b yükleme
14–16 sn, kapıyı fark etti ama ayakta duranı "oturuyor" dedi.

## 1. V0 deneyi — ön kayıt
**Soru:** Orion'un gözünden alınan bir karede, Orion'un bildiği nesnelerden hangilerinin göründüğünü yerel görme
modeli doğru söyleyebiliyor mu, ne kadar sürede, ekran kartı belleğine sığarak?

**Düzenek.**
- Orion'un gözü: Orion'un ayak konumu + 1,62 m (oyuncuyla aynı göz yüksekliği), bakış = gövde yönü, 0,08 rad aşağı;
  ayrı kamera (FOV 1,0 rad), 896×504 kare (render hedefinden, son işlem efektleri YOK). Çekimde Orion'un kendi bedeni
  gizlenir.
- Pozlar (önceden sabit, 22): ODA 12 — sekiz çapanın durağında çapanın yönüne bakarak (masa, monitör, tahta, pencere,
  kapı, şema, günlük, yönetim terminali) + oda ortası (0, 0.5) dört yöne; OVA 10 — ofisten çıkış noktası dört yöne,
  ova merkezi (0, 0) dört yöne, (15, −5) noktası iki yöne (−X ve +Z).
- Aday listesi: o yerin `Yer.nesneler` adları (tekilleştirilmiş; ova'da 8 "ek bina" tek ad). Her karede HEPSİ sorulur.
- Soru (kapalı küme, JSON şemasıyla zorlanmış yanıt): "Bu kare 3D bir dünyada senin gözünden. Aşağıdakilerin her biri
  bu karede açıkça görünüyor mu? Görmüyorsan ya da emin değilsen false." Ek olarak serbest betimleme (yalnız nitel kayıt).
  `think: false`, sıcaklık 0, `num_ctx` 4096.
- **Gerçek** (geometriden, her nesne için): kutunun 8 köşesi göz kamerasıyla izdüşürülür, kareye kırpılmış izdüşüm
  alanı oranı `alan`; örtülme `gorunenNesneler.gorunur`. Sınıflar:
  - **belirgin** — `gorunur` ve `alan` ≥ %2 → beklenen yanıt *evet*;
  - **yok** — `alan` = 0 (kare dışında / arkada) ya da `gorunur` değil → beklenen yanıt *hayır*;
  - **ara** — görünür ama `alan` < %2 → skora girmez (küçük ve belirsiz).
  Bilinen zayıflık: gerçek eksen hizalı kutulardan; kutu ile görünen model aynı değil (raf, lamba). Kayıtta kalır.
- Modeller: e2b ve e4b, aynı kareler (kareler bir kez çekilir, iki modele aynı dosyalar gider).

**Ölçütler ve eşikler (önceden):**
- **H1 (e2b yeterli mi):** belirgin nesnelerde duyarlılık (evet / belirgin) ≥ 0,70 VE yok nesnelerde yanlış evet oranı
  ≤ 0,15. İkisi birden tutmazsa "e2b ile görme, aday listesini doğrulamak için yeterli değil" yazılır.
- **H2 (hız):** e2b sıcak gecikme ortancası ≤ 2,0 sn (kapalı soru, kare başına).
- **H3 (büyük model değer mi):** e4b duyarlılığı e2b'den ≥ 0,10 yüksek VE yanlış evet oranı e2b'den kötü değilse "büyük
  model farkı anlamlı"; değilse küçük model tercih edilir.
- **H4 (bellek):** uygulama (başsız Chrome) açıkken her modelle ekran kartı belleğinin tepesi ≤ 7,6 GB (8 GB kartta pay).
- Oda ve ova ayrı ayrı da raporlanır (oda karanlık-neon, ova gündüz): ayrışma beklenir, eşik toplam üzerinden.

**Yapılmayacak (V0):** Orion'un beynine bağlamak, protokole görüntü eklemek. V0 yalnız ölçer; bağlama kararı sonuca göre.

## 2. Araçlar
- `world/avatar/goz.ts` — Orion'un gözü: kare çekimi + karenin geometrik gerçeği (`dunya.orionGozu`).
- `tools/goz-olc.mjs` — sürücü: başsız Chrome (geliştirme sunucusu), pozlar, iki model, skor; ham kayıt `docs/olcum/goz-v0.jsonl`.

## 3. Sonuç [ÖLÇÜLDÜ] (2026-10-11, `node … tools/goz-olc.ts`, ham kayıt `docs/olcum/goz-v0.jsonl`, 22 kare × 2 model)
**Ön kayıttan sapma:** ön kayıttan SONRA Ozyn ova'yı editörde düzenledi (07:32 kaydı: 8 bina ve Orion'un ofisi silindi,
iki kablo demeti eklendi, saat geceye alındı). Pozlar aynı kaldı; ova adayları 2'ye indi (ofis kapısı, boru duvarı;
kablo demeti "detay", Orion görmez) ve ova kareleri GECE. Ova'da yalnız 5 belirgin örnek var — ova sonucu zayıf kanıttır.

| | e2b (4,6B) | e4b (7,5B) |
|---|---|---|
| duyarlılık (belirgin → evet) | **0,44** (16/36) | **0,69** (25/36) |
| — oda / ova | 0,52 (16/31) / 0,00 (0/5) | 0,77 (24/31) / 0,20 (1/5) |
| yanlış evet (yok → evet) | 0,03 (5/144) | 0,08 (12/144) |
| gecikme ortancası (en çok) | 1,14 sn (4,5) | 1,66 sn (2,1) |
| ekran kartı belleği tepesi (uygulama açık) | 5010 MiB | 6346 MiB |
| bozuk (JSON dışı) yanıt | 0 | 0 |

- **H1 TUTMADI** — e2b duyarlılığı 0,44 < 0,70 (yanlış evet 0,03 eşiğin altında).
- **H2 TUTTU** — e2b ortancası 1,14 sn ≤ 2,0.
- **H3 TUTMADI** — e4b duyarlılığı 0,25 yüksek (eşik 0,10) ama ön kayıttaki ikinci koşul "yanlış evet kötü değil"
  bozuldu (0,03 → 0,08). Kural gereği tutmadı; büyük model daha çok görüyor, daha çok da uyduruyor.
- **H4 TUTTU** — ikisi de ≤ 7,6 GB. (Ön yoklamadaki "e4b uygulamayla sığmaz" tahminim yanlıştı: tepe 6,3 GB.)

**Nesne başına (yorum, ölçüt değil):**
- Görsel adı olan nesneleri iyi tanıyor: pencere (e2b 4/5, e4b 5/5), masa (3/4, 4/4), monitör (3/3, 3/3), kapı (2/2,
  2/2), berjer, raf.
- Adı ORION'A ÖZGÜ olan ekranları tanımıyor: beyin şeması (0/2, 1/2), beyin günlüğü (0/2, 1/2), yönetim terminali (0/3,
  0/3). Bu bir görme sorunu değil AD sorunu: model "ekranda akış şeması" görüyor ama "beyin şeması" adını bağlayamaz.
- Yanlış evetlerin bir kısmı GERÇEĞİN hatası: "ayaklı lamba" karede açıkça duruyor (oda ortası -Z karesi) ama kayıttaki
  kutusu yalnız lamba başı (0,3 m) — gerçek onu hep "ara/yok" saydı; modeller 2/11 ve 3/11 "evet" dedi.
- Gece ova'sında ikisi de neredeyse kör: boru duvarı 0/4 ve 1/4; ofis kapısı (gece simsiyah dikdörtgen) 0/1. Betimler
  doğru ama genel: "yıldızlı gökyüzü, geniş çayır, ufukta geometrik yapılar".

**Karar önerisi (Ozyn'e):** görme bugün aday listesini DOĞRULAMAK için yeterince güvenilir değil (H1). Ama sınır büyük
ölçüde modelde değil, sorduğumuz ADLARDA ve gerçeğin kutularında. V1 için seçenekler: (a) e4b + soruya görsel tarif
("beyin şeması — sağ duvarda akış şeması gösteren ekran"), (b) görmeyi doğrulama değil serbest betim olarak kullanmak
(Orion "ne görüyorsun" deyince betim; adlar geometriden), (c) gerçeğin kutularını görünen modelle hizalamak (lamba).
Her biri yeni ön kayıt ister.

## 4. Ozyn'in düzeltmesi: algı ve görme AYRI (2026-10-11)
"Amacı bulması değil görmesi. Görme ve algılama farklı şeyler. Orion simülasyondan, mekanik olarak bir NPC gibi
etrafındaki her şeyi algılayacak — bunu kodla otomatik vereceğiz: bulunduğu level'da belli bir alandaki, ayarlanmış
bütün objeler. Resim / Google tarafı işin ekstrası; ikisini karıştırma. Resimde ne gördüğünü bilgileriyle birleştirecek."
V0, görmeyi algının YERİNE koyup "bulabiliyor mu" diye ölçtü — soru yanlıştı; sayılar kayıtta kalır ama karar dayanağı
değil. Doğru ayrım:
- **ALGI** — gerçek, kesin, ucuz, koddan (NPC): ne, nerede, hangi yönde, ne kadar uzakta.
- **GÖRME** — algının ÜSTÜNE nitel deneyim (ışık, renk, ekranda ne var, Ozyn ne yapıyor); model algıyı bağlam alır.
Kararlar: alandaki algılanır nesnelerden yalnız GÖRÜŞ HATTI açık olanlar algılanır (duvar/bina arkası bilinmez, sayısı
söylenir); görme yalnız İSTEYİNCE.

## 5. Faz 1 — ALGI (NPC gibi) [uygulandı]
Bulgu: o güne dek algı hizmeti yalnız ODANIN 10 ÇAPASINI biliyordu; level nesneleri ve spec 23 B anlamları Orion'a hiç
ulaşmıyordu. Spec 24 C4 ("Orion ovayı bilir") bu fazla birleşti.
- **Alan:** künye `BEDEN.duyu.algiMenzil = 12` m (protocol/bedenTanimi.ts); level verisi `algi?: { menzil }` (doğrulanır),
  `Yer.algiMenzil` (levelYeri doldurur).
- **`mind/algiHizmeti.ts`:** `DunyaGorusu.nesneler` (ad, konum, gorunur) + `menzil` verilince algı nesnelerden kurulur:
  alan içi + görüş hattı; yön sözü `yonSozu` (önünde ±35° / arkanda ±45° / sağında / solunda — Babylon sol-elli);
  aynı adlılar gruplanır ("3 ek bina (en yakını solunda)"); alan içi ama görünmeyenler SAYILIR, alan dışı hiç anılmaz;
  Ozyn'in yanındaki şey nesnelerden. `nesneler` verilmezse eski davranış (çapalar + ışın) — eski 14 test aynen geçer.
- **`world/giris.ts` `algiSor`:** `orionYeri.nesneler`; görüş hattını DÜNYA hesaplar (`gorunurluk.ts` gorunenNesneler, 9
  nokta — tek ışın büyük nesnede kendi duvarına çarpıyordu); mind yalnız seçer ve söze döker (K4 korunur).
- **Yer bilgisi:** `yerSabitBilgisi(yer)` (oda metni ESKİSİNİN AYNISI — "In the room: …", istem ölçümleri ona dayanır;
  dışarıda "Outside, in the ova (you left the room through its door): ofis kapısı."); `tools/ogretmen.ts` SABIT aynı
  işlevden (kopya kalktı); durum defterinde çapa yoksa `yerOrtasiSozu` ("odanın ortası" / "dışarıda (ova)").
- **Tahta kuralı:** `niyetYurutucu` `yaklastiMi("tahta", …, orionCapalari)` — ovada odanın tahta koordinatına denk gelince
  "tahtanın yanındasın" denmez.
- **Testler:** algiHizmeti +17 (alan, görüş hattı, sayılan gizli, alan dışı anılmaz, dört yön, gruplama, sıra, yakın,
  Ozyn'in yanı, çapa sızmaz); bozma denemesi (sağ/sol ters) 4 testte yakalandı. yer.test +3 (sabit bilgi eskisinin
  aynısı), niyetYurutucu +1 (tahtasız yerde yazmaz).
- **Canlı [ÖLÇÜLDÜ]:** `gordene` geçti — masada: "sandalye (sağında), yönetim terminali (önünde), çalışma masası (önünde),
  monitör (önünde), banker lambası (sağında), pencere (önünde), kırmızı berjer (solunda), … kapı (arkanda) (+2 tane
  daha)"; tahtada: "beyaz tahta (önünde), kutu yığını (solunda), raf (sağında) …". `kapidene` 16/16 (+2 algı kontrolü:
  ovada "ofis kapısı (arkanda)", ofis eşyası yok; dönünce odanın nesneleri). `eylemdene` 6/6, `tahtadene` 4/4.
  kapidene düzeltmesi: oyuncu ova kapısına 0,6 m yandan bakıyordu, 1 m'lik kapıyı 10 cm ıskaladı (önceki koşuda neden
  geçtiği açıklanmadı); artık kapının tam karşısından. "Ofiste algı" kontrolü "kapı" sözüyle zayıftı ("ofis kapısı" da
  uyuyordu), sıkılaştırıldı.
- **Bilinen:** "dunya" cevabı 300 karakter bütçesinde (odada 2 nesne kırpılıyor, söyleniyor). Kaya/dekor katmanı
  örnekleri algıda yok (yerleşim değiller).

## 6. Faz 2 — GÖRME (sırada; Ozyn'in onayıyla)
`sor { ne: "gor" }` → Orion'un gözünden kare (`world/avatar/goz.ts`) + o anki algı metni → `bridge/goz.ts` (Gemma,
`/api/chat` + görüntü) → "algılarınla birleştirerek 2–3 cümle" → `gordum` algısı. Ölçüm: birleştirme (algıdaki adları
kullanır, yerde olmayan adı söylemez, gece/gündüz tutarlı, ≤ 3 sn, ≤ 7,6 GB) — yeni ön kayıt.
