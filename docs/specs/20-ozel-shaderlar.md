# Spec 20 — Özel shader'lar: "Sistem Hatası" dünyası, gün/gece paleti shader'da

> Durum: **uygulandı** (2026-10-09): altyapı + gün/gece + 7 özel shader + 4 dünya paleti. Ön kayıt: FPS ve VRAM
> her shader'da geçti; çizim artışı debug taramasında AŞILDI (+22, derinlik geçişi). Galeri: `Pictures/shader-ornekleri/ozel/`.

## 0. Neden
Ozyn: "elimizdeki shader'ları geliştir, farklı shader'lar ekle, kendin başka shader'lar yap; vault'taki 'Sistem
Hatası' fikirlerine bak; gerçekten farklı, yenilikçi, hiç yapılmamış shader'lar deneyelim. Renk paletini, gece ve
gündüzü özel shader'larımıza koyalım. Amaç çok ileride bunun BİR olması. Modüler, düzgün, kaliteli kod."

## 1. Kaynaklar (vault, okundu)
- `projects/sistem-hatasi-story-bible`: üç simülasyon katmanı (siberpunk / ortaçağ / büyü), Orion = hata avcısı,
  LK2 "Orion'un paleti (obsidyen + orman yeşili) her katmanda sabit", LK3 katmanlar arası bilgi yalnız "kurgu eser".
- `forum/orion0fis/renk-swatch`: katman paletleri + ışık senaryoları, glitch paleti (#5b8def dijital mavi, #ff2079
  magenta, #0affef cyan, #f5f5f5 statik), "anomali bölgesi — renkler ters döner".
- `forum/orion0fis/gecis-mekanigi`: DEBUG MODU (renkler soluklaşır, hata imzaları görünür), hata türleri: doku
  hatası (titreyen glitch), ZAMAN KIRIĞI (bölgesel gün/gece salınımı), sızıntı, kimlik kopyası.
- `forum/orion0fis/painterly-shader`: Kuwahara yağlı boya filtresi, fırça normal deformasyonu ("ışık yalan söyler"),
  PP_Glitch (RGB kayma + tarama çizgisi).
- `forum/isik0fis`: "gerçekten modüler altyapı — ama uzay gemisi yapmak yerine zekice; spekülatif mega-sistem yasak."

## 2. Mimari (küçük ve modüler)
```
world/level/shader/
  dunyaDurumu.ts   saf: saat → güneş yönü, gün ışığı oranı, palet zaman çizelgesi (ara değer), ortak durum nesnesi
  paletler.ts      veri: katman paletleri (ova gündüz/akşam/gece/şafak, siberpunk, ortaçağ, büyü, glitch, Orion)
  modul.ts         ShaderModulu sözleşmesi (varsayilan = şema, aralik, tur: "ekran" | "dunya", kur → guncelle/yokEt)
  dunyaEklentisi.ts TEK malzeme eklentisi (ışıklı + pişmiş): zaman kırığı, hata imzası, fırça normali, gök zamanı/yıldız
                   — özellikler uniform bayraklarıyla (yeniden derleme yok); modüller ortak duruma yazar
  moduller/        paletHaritasi · gokZamani · zamanKirigi · hataImzasi · debugTarama · firca · elyazmasi
  shaderSistemi.ts tanim.shaderlar listesini kurar (sıra = liste sırası); ekran shader'ları stil zincirinin SONUNA
```
- **Veri:** `tanim.zaman { saat, hiz, akiyor }` (isteğe bağlı) ve `tanim.shaderlar: [{ tur, acik, ayar }]` (katman deseni:
  `ayarBirlestir` ile şema denetimi, panelde aç/kapa + ↺ + kaydırıcılar).
- **Gün döngüsü:** saat → güneş yönü/rengi/şiddeti doğrudan ışığa (tanım yeniden kurulmaz, kare başına ucuz);
  palet ve gök renkleri SHADER'da (palet haritası + gök zamanı) — geometri yeniden pişirilmez.
- **Deneme sayfası:** üst çubukta "shader" çipleri + saat kaydırıcısı + "zaman aksın" düğmesi.

## 3. Özgün shader'lar
| # | ad | tür | ne yapar | dünya bağı |
|---|---|---|---|---|
| Ş2 | Palet Haritası | ekran | kareyi parlaklık + ton bölgesine göre etkin katman paletinin rampasına eşler; gün/akşam/gece/şafak rampaları saatle karışır | "renk paleti shader'da" |
| Ş2 | Gök Zamanı | dünya (gök) | gök kubbesini saatle zenit/ufuk gece renklerine karıştırır, gece yıldızları (karma, titreşen), dolunay diski | gece |
| Ş3 | Zaman Kırığı | dünya | küre bölge içinde başka saat (gece paleti, ters dönmüş gölge yönü hissi), sınırda titreşen kenar | hata türü "zaman kırığı" |
| Ş4 | Hata İmzası | dünya + ekran | nesne üzerinde dünya-uzayı bloklu RGB kayma, köşe sıçraması, tarama çizgisi; glitch paleti | "doku hatası" |
| Ş5 | Debug Taraması | ekran | dünya soluklaşır; Orion'dan yayılan tarama halkası geçtiği yerde kenarları dijital mavi çizer | DEBUG MODU |
| Ş6 | Fırça | ekran + dünya | Kuwahara yağlı boya + prosedürel fırça akışıyla bükülen normal | painterly spec |
| Ş7 | Elyazması | ekran | kâğıt lifi, mürekkep sınırı, yaldız parlak bölgeler — dünya bir "kurgu eser" sayfası | LK3 |

## 4. Ön kayıt (ölçümden önce)
Her shader açıkken (standart stil + o shader), 1080p vsync kapalı: FPS ≥ 60, çizim artışı ≤ 10, VRAM artışı (shader'ın
payı) ≤ 100 MiB. Gün döngüsü akarken kare başına tanım yeniden kurulmaz (çizim/kurulum sayacıyla doğrulanır).

## 5. Doğrulama
Saf kısımlar testli (saat → güneş, palet ara değeri, rampa kurma, bölge matematiği, şema). Her shader için başsız
görüntü (açık/kapalı) + `hata=0`; gün döngüsü için 4 saatten görüntü. Galeri `Pictures/shader-ornekleri/ozel/`.

## 6. Sonuçlar `[TEST]` `[ÖLÇÜLDÜ]` (1080p vsync kapalı, tepe açısı; taban = gök zamanı + palet haritası açık)
| shader | FPS | çizim artışı (≤ 10) | VRAM payı (≤ 100 MiB) |
|---|---|---|---|
| taban | 1248 | — | (+347 sayfa toplamı) |
| zaman kırığı | 1276 | 0 | +3 |
| hata imzası | 1201 | 0 | +36 |
| debug taraması | 978 | **+22 — aştı** (derinlik çizicisi sahneyi bir kez daha çizer) | +29 |
| fırça (Kuwahara r=4) | 503 | +1 | +23 |
| elyazması | 1230 | +1 | +28 |
- Gün döngüsü tanımı yeniden KURMUYOR: zaman akarken 10 karede katman kurulumu 0, saat 10 → 15 (test).
- Görüntüyle yakalanıp düzeltilenler: (1) gece sis/arka plan gündüz renginde kalıyordu → ufuk rengine bağlandı;
  (2) şehir nesneleri dünya eklentisini almıyordu (ayrı malzeme bağlamı) → eklendi; (3) şafak/akşam/gece simsiyahtı →
  ay ve dolgu yükseldi, gece rampaları açıldı, palet haritası gece koyuları kaldırır.
- Bekçiler: her dünya karesinde gerekli adlar; rampalar koyudan açığa (iki yazım hatası yakaladı: ortaçağ akşamı,
  büyü gündüzü); dünya eklentisi GLSL'i yalnız bildirilen uniform'ları kullanır; eklenti tek argümanla kurulur.
- Bilinen: 06:00 (güneş tam ufukta) koyu; gece zaman kırığı bölgesi kameraya göre bina arkasında kalabilir (konum ayarı
  panelde); debug taramasının halkası hızlı, tek karede görünmeyebilir.
