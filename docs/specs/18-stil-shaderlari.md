# Spec 18 — Stil shader'ları: hepsini dene, aralarında geç

> Durum: **S0–S5 bitti** (2026-10-09). Altı önayar ova'da çalışıyor, G / panel ile geçiliyor; bütçe geçti.
> Sırada (Ozyn seçer): beğenilen stilden **kendi shader'ımız** — ayrı spec.

## 0. Tek cümle
Toon, cel, 90'lar anime, Moebius ve t3ssel8r tarzı piksel-sanatı ova'da yan yana görmek, tuşla geçmek, sanat
kararını görüntüyle vermek. Araştırma: `docs/arastirma/stil-shaderlari.md`.

## 1. Kararlar
- **K1** Ayrı "toon malzemesi" yok: Standard malzemeye EKLENTİ (`stil/isikEklentisi.ts`), `vec3 finalDiffuse=`
  satırının önüne. CSM gölgesi, sis, ince örnek, rüzgâr korunur. Babylon `CellMaterial` bu yüzden kurulmadı.
- **K2** Çizgi ekran uzayında (`GeometryBufferRenderer` + `PostProcess`); ters kabuk flat lowpoly'de köşede açılır.
- **K3** Stil = veri: `tanim.stil` (ışık, çizgi, renk) + `ortam.piksel`; önayar bunun hazır doldurulmuşu.
  Geçiş: G (önayar), P (renk düzeni), `?stil=` / `?renk=`, panelde "Stil" bölümü (Kaydet ile dosyaya).
- **K4** Referans görseller repo dışında (telifli): `C:\Users\ozigo\Pictures\shader-ornekleri\`, galeri `index.html`.

## 2. Ön kayıt (ölçümden önce)
Her önayar, 1080p, vsync kapalı (`ODA_SINIRSIZ=1`), tek açı: FPS ≥ 60 · çizim ≤ 150 · VRAM artışı ≤ 500 MB.

## 3. Yapı
```
world/level/stil/
  stilTanimi.ts    tip + doğrulama + ONAYARLAR (standart, cel, toon, anime90, moebius, piksel) + renk düzenleri
  isikEklentisi.ts basamak (bant, yumuşaklık, en koyu), gölge TONU, eşikli parlama, kenar ışığı, tarama
  efektler.ts      çizgi (kip 0 Sobel, kip 1 t3ssel8r) + renk (palete yuvarlama, Bayer, posterize, doygunluk, gren)
  stilSistemi.ts   tanımı uygular (uniform'lar; efektler açılıp kapanınca sırayla yeniden kurulur)
```
Çekirdeğe dokunuş: `levelTanimi` (isteğe bağlı `stil`), `levelKur` (stil sistemi, ışıklı malzemeye eklenti,
`level.stil.kameraBagla`), `malzeme` (`stil` seçeneği). Çim `metadata.cizgisiz` (gbuffer dışı).

## 4. Sonuçlar `[TEST]` `[ÖLÇÜLDÜ]`
| önayar | FPS | çizim | VRAM artışı | not |
|---|---|---|---|---|
| standart | 1684 | 14 | +261 / +293 | kıyas |
| cel | 1698 | 14 | +268 | |
| toon | 794 | 18 | +389 | |
| anime90 | 780 | 19 | +380 / +404 | |
| moebius | 680 | 19 | +383 | |
| piksel | 1936 | 19 | +91 | 1/3 çözünürlük |
Hepsi geçti. Çizgi efekti FPS'i ~yarıya indiriyor (gbuffer geçişi), yine 10× pay var.
- Yöntem: ilk seride boştaki VRAM ölçüm sırasında 1922 → 2753 kaydı (makinede başka uygulamalar) ve anime90
  +1,3 GB göründü; her koşudan önce/sonra tabanla tekrarlandı, taban sabitken farklar yukarıdaki gibi.
- Görüntüyle yakalanıp düzeltilenler: (1) tam ışık güneşe dik yüze göre ölçülünce alçak güneşte düz zemin koyu
  banda düştü → ölçü düz zemin; (2) derinliğe Sobel yatay bakılan zemini simsiyah şerit yaptı → ters derinliğin
  Laplace'ı (düzlemde sıfır), t3ssel8r kipinde düzlem tahmini; (3) palet uzaklığı parlaklık ağırlıklıyken çimde
  mavi noktalar → renk ağırlıkları.
- Testler (18): önayarlar şemadan geçer ve adı geri okunur, yazım hatası reddedilir, palet listesi, tam ışık,
  eklenti takılır, **Babylon bekçisi**: eklentinin dayandığı shader satırları/değişkenleri hâlâ var.
- Shader derlemesi Node'da yok → her önayar tarayıcıda derlendi, `hata=0` (sayfa Babylon hata kaydını sayar).

## 5. Açık / sonraki
- **Işık dili adım 1 (2026-10-14):** `isik.golgeDolgudan` (0..1) — gölge tonu dünya paletinin o saatteki `dolgu` rengine
  karışır (`stilSistemi.golgeTonu`, akan zamanda `saatDegisti`); toon'da 1, diğerlerinde 0. Eklenti yalnız `malzemeKur`
  malzemelerinde (ova): ofis (`oda.ts` Standard + glTF PBR) etkilenmez. Ölçüm: `docs/olcum/on-kayit-isik-dili-1.md`.
- Ozyn'in seçimi → kendi stilimiz (ör. piksel + toon gölge tonu + pastel). Rim ışığı düz zeminde dik bakışta
  yanabiliyor (toon'da düşük tutuldu). Çim çizgisiz (gbuffer'da rüzgâr yok). Perspektif kamerada piksel sabitleme yok.
