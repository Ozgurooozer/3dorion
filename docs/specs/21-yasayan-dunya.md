# Spec 21 — Yaşayan dünya: çim, parçacıklar, su, atmosfer

> Durum: **uygulandı** (2026-10-09). Ova'ya canlılık: yeniden yazılan çim, gün/gece'ye bağlı parçacıklar, göl, atmosfer eklentisi.

## 0. Neden
Ozyn: çim seyrek ve kalitesiz ("3D mi Blender'la mı yaptın?"); "daha sık, optimize, farklı boylarda, canlı hissettirelim";
Babylon atmosfer eklentisine girelim; Unreal'da olup bizde olmayan / ikisinde olup bizim kullanmadığımız şeyler → "önerilerini
hallet" (parçacık, atmosferden güneş rengi, su).

## 1. Çim (`moduller/cim.ts`)
- Yaprak: kavisli, uca doğru daralan şerit (`dilim` halka, 2·dilim − 1 üçgen). Kod üretimi (Blender değil): her ayar panelden
  oynar, yükleme yok. Blender modeli istenirse ayrı iş.
- Canlılık: boy çeşitli (çoğu kısa, %7 `uzunCarpan` kat uzun), tutam başına genişlik/yatış/eğim oynaması.
- Optimizasyon: 16 m hücre → hücre başına mesh (kamera dışı kırpılır) + 3 detay seviyesi (24 / 55 m): tam tutam →
  az yaprak, yarı sayı → 2 yaprak, çeyrek sayı, daha geniş. Uzak seviyede kök rengi açılır (koyu kök uzaktan benek oluyordu).
- `enAlcak`: bu yüksekliğin altına çim konmaz (göl tabanı).
- `[ÖLÇÜLDÜ]` 1080p, kare sınırı kapalı, 500 bin tutam: 200–630 fps, çizim 114–147, üçgen 7–12 milyon (tek mesh 40 bin → 363 bin
  üçgendi; 250 bin tek mesh 2,2 milyon üçgen 100 fps'te takıldı).

## 2. Parçacıklar (`moduller/parcacik.ts`)
Polen (gündüz, `gunIsigi²` ile) ve ateşböceği (gece, `gece²` ile): iki Babylon `ParticleSystem`, yayma hızı her karede dünya
durumundan (`ModulBaglami.dunya()` — yeni). Doku koddan (yumuşak yuvarlak). Ateşböceği ekleme karışımlı, renk gradyanıyla yanıp
söner. `[ÖLÇÜLDÜ]` gündüz 218 polen / 0 böcek, gece 38 / 133 (sayı gerçek sistemden); fps etkisi ölçülemeyecek kadar küçük.

## 3. Su (`moduller/su.ts` + zemin çanağı)
- Zemin: `golX/golZ/golYaricap/golDerinlik` çanak oyar (derinlik 0 = göl yok), taban/kıyı toprak rengi.
- Su: kendi shader'ı, lowpoly düz-gölgeli yüzey. Yansıyan renk GÖK PALETİNDEN (dünya durumunun ufuk/zenit rengi → akşam turuncu,
  gece koyu mavi kendiliğinden), güneş/ay parıltısı, kıyı köpüğü, sis. Neden WaterMaterial/SSR değil: iki ek render hedefi
  8 GB bütçeyi yer, lowpoly yöne uymaz. **Bilinen sınır:** binalar yansımaz.
- Ova: göl (−30, −32), yarıçap 16, derinlik 1,1; su seviyesi −0,25.

## 4. Atmosfer (`shader/moduller/atmosfer.ts`, `@babylonjs/addons/atmosphere`)
- Fiziksel gök (Rayleigh/Mie, çoklu saçılım) shader olarak: kubbe gizlenir. `?shader=atmosfer`.
- Güneş rengi: eklentinin iletim tablosundan ton (ufka yaklaştıkça kızıl), şiddet ışık sisteminde kalır (`gunesRengi`).
- Sınır: uzaklık sisi (aerial perspective) sonsuz uzak düzlem + doğrusal olmayan derinlik ister; bizde ikisi de farklı → kapalı.
  Eklenti `@experimental`.
- `[ÖLÇÜLDÜ]` atmosfer açıkken +33 çizim, fps −%15–20 (ufuk 245, tepe 513).

## 5. Gün/gece ve ışık
- Bulut: pişmiş malzeme dünya durumundan (gündüz 1, gece `geceParlak` 0,16; alacakaranlıkta ışık rengi).
- Dolgu ışığı alacakaranlıkta güçlenir (akşam yer simsiyahtı; görüntüyle yakalandı).
- Kamera: serbest uçuş (Space/E yukarı, Q/C aşağı; zemine kilit kalktı).

## 6. Yapılmayanlar (dürüstçe)
- Hacimsel bulut: yok; mevcut ikosahedron bulutlar gece/gün rengi alıyor. Hacimsel sis/bulut ayrı iş (VRAM + derinlik biçimi).
- SSR/yansıyan bina: yok (bkz. §3).
- Atmosfer tek başına akşam yeri aydınlatmaz; dolgu ışığıyla dengelendi.
