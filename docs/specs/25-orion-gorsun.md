# Spec 25 — Orion gerçekten görsün (yerel görme modeli)

> Durum: **V0 ön kaydı** (2026-10-11) — deney koşulmadan ÖNCE yazıldı; sonuç §3'e, ön kayıt değiştirilmeden eklenir.

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

## 3. Sonuç
(deneyden sonra)
