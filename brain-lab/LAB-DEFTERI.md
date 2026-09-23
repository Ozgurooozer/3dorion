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

## Açık sorular (güncel)

- Kendiliğinden hareket (motor babbling) ve zayıf rastgele doğum bağlantıları öğrenmeyi başlatır mı?
- Doğuştan refleks yardımcı mı, engel mi? (reflekssiz / refleksli karşılaştırması planlandı)
- Üç faktörlü kural ~20 tiklik gecikmeyi köprüleyebilir mi?
- Beynimiz basit tablo TD(λ) öğrenicisini geçebilecek mi?
