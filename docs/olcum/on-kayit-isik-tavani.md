# Ön kayıt — Işık aktörü tavanı ölçümü (spec 42 Y3)

Yazıldı: 2026-10-29, ÖLÇÜM KOŞULMADAN ÖNCE. Sonuca bakıp eşik değiştirilmez (CLAUDE.md). Ölçüm aracı: `3dorion.bat leveldene` (Y5; henüz yazılmadı) ya da bu kaydı kullanan ayrı koşu.

## Soru
Level'a eklenen nokta ışıklar (`LevelTanimi.isiklar`, tavan `ISIK_TAVANI = 8`, malzeme tavanı `MALZEME_ISIK_TAVANI = 10`) kare süresini ve görüntüyü kabul edilemez bozuyor mu?

## Düzenek
- Boş ova şablonu (`bos`) + 0 / 2 / 4 / 8 nokta ışık (menzil 8 m, şiddet 1,5, kamera çevresinde dağıtılmış), gündüz saat 13, stil standart, aynı kamera konumu.
- Her koşul: ısınma 60 kare, sonra 300 kare. Ölçü: ortalama kare süresi (ms, `SceneInstrumentation.frameTimeCounter`), çizim çağrısı sayısı (`drawCallsCounter`), WebGL hatası (`gl.getError`) ve shader derleme hatası sayısı, görünür bozulma (ekran görüntüsü okunur: ışıklar aydınlatıyor mu, siyah/bozuk yüzey var mı).
- n = 3 tekrar, ortanca alınır. Aynı makine, oyun/yarış süreçleri kapalı.

## Karar kuralı
- **Tavan 8 KABUL** ⇔ 8 ışıkta ortalama kare süresi ≤ 0 ışık × 1,25 **ve** çizim çağrısı ≤ 0 ışık + 10 **ve** WebGL/shader hatası 0 **ve** 8 ışığın hepsi görüntüde etkili (en az 2 ışıkta açıkça görünür aydınlanma).
- Aksi hâlde tavan **4**'e indirilir ve aynı kural 4 ışıkla yeniden denenir; o da tutmazsa tavan 2.
- Aradaki farklar "belirsiz" sayılır; tavan korunur ama `ACIK-ISLER.md`'ye yazılır.

## Sınırlar (baştan)
- Gölge YOK (nokta ışık gölgesi bu ölçümün dışında; açılması ayrı ön kayıt ister).
- Tek makine, tek sahne (boş ova). Ofis ve çok nesneli level için genelleme yok.
- Babylon `maxSimultaneousLights` mesh başına en çok bu kadar ışığı işler; sahnede tavandan fazla ışık, kare süresi ölçümü kapsamı dışında.
