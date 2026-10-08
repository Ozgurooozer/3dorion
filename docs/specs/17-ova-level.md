# Spec 17 — Ova: yeni level MVP (lowpoly düzlük, çim, gökyüzü)

> Durum: **L0 + L1 (ilk geçiş) bitti** (2026-10-08). L2 (uzak arazi, Blender), L3 (çim), L4 (piksel kipi + sonuç) sırada.
> Sanat kararları Ozyn'in; her faz ekran görüntüsüyle sunulur.

## 0. Tek cümle
Uçsuz bir düzlük, rüzgârlı çim, güzel bir gök — lowpoly, "gerçekçilik değil sanat". Önce Orion'suz, tek başına
bir deneme sayfasında; ileride piksel/toon shader (referans 3) ve Orion'un taşınması ayrı adımlar.

## 1. Kararlar (Ozyn, 2026-10-08)
- **K1** Önce tek başına (`world/level/ova-deneme.html`); oda, oyuncu, avatar, beyin, protokol dokunulmaz.
- **K2** Gündüz (referans 1). Gece (referans 2) sonra.
- **K3** Çim kodda (thin instance), uzak arazi/kaya Blender betiğinde (spec 11 yolu).
- **K4** Baştan shader'a hazır: renk tek paletten (`ovaVerisi.ts PALET`), malzeme tek fabrikadan
  (`ovaMalzeme.ts`), geometri saf dizi (`ovaGeometri.ts`). Toon/piksel shader = fabrikanın içi değişir.

## 2. Ön kayıt — bütçe (ilk ölçümden ÖNCE yazıldı)
| # | ölçüt | eşik |
|---|---|---|
| B1 | FPS (1080p sınıfı, RTX 4060) | ≥ 60 |
| B2 | Çizim çağrısı | ≤ 150 |
| B3 | VRAM artışı (`nvidia-smi` önce/sonra) | ≤ 500 MB |
| B4 | Blender glb | ≤ 4 MB |

## 3. Yapı
- `world/level/ova/ovaVerisi.ts` — palet, ölçüler, bütçe, tohumlu rastgele (mulberry32), değer gürültüsü,
  yükseklik (merkez düz, dışa doğru dalgalı), gök/zemin rengi. Saf, testli.
- `ovaGeometri.ts` — flat geometri (üçgen başına köşe, renk, normal): zemin ızgarası, bantlı gök kubbesi,
  ikosahedron kümesi bulutlar ("pişmiş" gölge: alt yüzler koyu, ışıktan bağımsız). Saf, testli.
- `ovaMalzeme.ts` — tek fabrika: `isikli` (zemin) / `pismis` (gök, bulut, güneş: ışıksız, emissive × köşe rengi).
- `ova.ts` — sahneye sarma, hemisferik + yönlü güneş ışığı, EXP2 sis = ufuk rengi = arka plan.
- `ova-deneme.html/.ts` — yürüyen kamera (WASD, fare, Shift), sabit açılar `ufuk|alcak|tepe|gunes`,
  `?piksel=N`, 3 sn ölçüm → başlık "hazir …". Görüntü: `ODA_ADRES=…/ova-deneme.html node tools/oda-goruntu.mjs <klasör> ufuk alcak tepe gunes`.

## 4. Sonuçlar
### L0 + L1 `[TEST]` `[ÖLÇÜLDÜ]`
- 26 saf test (veri 15, geometri 11): belirleyicilik, gök normali içe, zemin normali yukarı, palet, üçgen bütçesi.
- Başsız Chrome, 1280×720: **FPS 100 (vsync tavanı), çizim 3–4, 25 674 üçgen** — B1/B2 çok rahat. VRAM ölçülmedi (L4).
- İlk görüntüde iki hata yakalandı ve düzeltildi: (1) üçgen köşe sırası Babylon'un ön yüz kuralının tersiydi →
  zemin üstten, gök içeriden ayıklanıp görünmedi; (2) ışıksız malzemede emissive yoktu → bulut ve güneş SİYAH.
- Sanat açıkları (Ozyn'e): gök bantları kaba (7 bant, en alttaki geniş açık şerit); zemin lekeleri sert ve koyu
  (referanstaki altın-yeşil değil); bulutlar referansa göre küçük.
