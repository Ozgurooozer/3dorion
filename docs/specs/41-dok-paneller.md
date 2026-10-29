# 41 — Dok paneller: yapı panelleri ve Orion ayarları (Unreal tarzı yerleşim)

Durum: **YAZILDI** (testli, tarayıcıda ölçüldü; Ozyn'in elle denemesi YOK).
Kapsam: alt çubuk (Yapı çubuğu) sekmeleri ve Orion ayar paneli artık dok panelleri; sürükleyip sol/sağ/alt/yüzer bölgeye taşınır.

## Ne değişti
- **Yapı çubuğu kaldırıldı** (`world/arayuz/altCubuk.ts` + `altCubukModeli.ts`). Asset, Zemin, Hafıza, Zihin, Graf, Sekans artık
  `uygulama/yapi/ortak/yapiPaneli.ts` üzerinden dok'a kayıtlı. `Sekme` sözleşmesi (kur/ipucu/rozet/kapat) aynı; içerik ilk gösterimde kurulur.
- **Orion ayar paneli** dok paneli (varsayılan SAĞ). `ayarPaneli` `ata` ile dok kabına gömülür (`ap-gomulu`); açma/kapama `giris.ts` `orionPaneliniAc`.
- **Yerleşim değişkenleri tek yerde:** `--alt-cubuk` = dok alt bölgesinin yüksekliği; `--alt-yigin` (index.html) = `--alt-cubuk + --editor-alt`.
  Tuval, altyazı, sohbet, diyalog ve ayar paneli bunun üstünde durur. Yan bölgeler `--alt-yigin`e kadar iner.
- **Görünürlük iki kapılı:** imleç kipi (`kipGorunur`, fare serbestken panel tıklanmaz, oyun alanı daralmaz) VE Y ile gizlenmemiş (`tumunuGoster`).
  Y gizle/göster yapar, düzen değişmez.
- **Bilgi şeridi:** etkin sekmenin yanında tek satır bağlam ipucu (`dok.bilgi`).
- **Panel içeriği kendi konum bağlamı:** `.dk-icerik > [data-dok]` `position: relative; overflow: hidden` — mutlak öğeler bölgeye taşmaz.
- Gözlem (O) ve Beden (B) panelleri yan bölgelerin dışına itildi (`--dok-sag` / `--dok-sol`).
- Graf sekmesinin sütunları dar panelde alt alta sarılır (eskiden sabit 320 px sütun taşıyordu).

## Kararlar
- Üst ana menü şeridi SABİT kalır (Unreal gibi). Menüler zaten katkıyla birleşir (`menuBirlestir.ts`); "Pencere" menüsü her dok panelini listeler.
- Sekmeler varsayılan olarak ALT bölgededir. Düzen `localStorage` (`orion.dok.v1`) ile hatırlanır; "Dok düzenini sıfırla" varsayılana döndürür.
- 1–9 tuşları görünür sekmeleri `sira` sırasıyla seçer; Y gizle/göster. Kısayollar yazı yazılırken çalışmaz.
- Sekans editörünün kendi alt payı (`--editor-alt`) değişmedi; dok alt bölgesi onun üstünde durur.

## Doğrulama (1. dilim)
- `[TEST]` `world/arayuz/arayuzJetonlari.test.ts` (dok CSS'i jetonları içe aktarır), `uygulama/yapi/ortak/dok/dokDuzeni.test.ts` geçiyor.
- `[ÖLÇÜLDÜ]` Playwright (yazılım GL) ekran görüntüleri: Graf → sağ bölge, Sekans → sol bölge (sürükle-bırak olayı), Orion ayarları sağda açılır,
  sahne payı bölgelere göre küçülür. Görüntüler scratchpad'de (`dok-iki.png`, `ayar-sag.png`).
- `[YAZILDI-KOŞULMADI]` `3dorion.bat` ile gerçek Electron'da, gerçek fareyle sürükleme; Orion seçilerek (sağ tık) ayar panelinin açılışı.

## Yüzer pencereler de dok'ta (2. dilim)
- Gözlem (O) `gozlem`, Beden (B) `beden`, nesne paneli `nesne`, model seçici (M) `model` (varsayılan yüzer), stil penceresi (G) `stil` (varsayılan yüzer).
- `uygulama/yapi/ortak/dok/dokPencere.ts`: pencerenin KÖKÜNÜ dok kabına taşır (`dk-gomulu`, !important ile yüzen konum kalkar), açık/kapalı işaretini
  (`data-acik` ya da `acik` sınıfı) MutationObserver ile dok görünürlüğüne bağlar. Pencerelerin kendi açma/kapama mantığı DEĞİŞMEDİ.
- Dok klavyesi artık yalnız Esc'i geçirir: Esc pencereyi kapatabilir, diğer tuşlar oyuna sızmaz.
- Tarayıcıda `[ÖLÇÜLDÜ]`: O, B, M açıldı; sekmeler ve bölgeler doğru; konsolda yeni hata yok. Nesne paneli (sağ tık) ve stil (G, yalnız ova'da) elle denenmedi.

## Doğrulama (güncel)
- Tip denetimi TEMİZ (`npx tsc --noEmit`, 0 hata). Önceki "Babylon tip tanımı yok" sorunu bozuk `node_modules`ten geliyordu: `npm ci` ile çözüldü.
- Tam test paketi: `npm test` (bkz. commit mesajı).
- `world/yer/levelYeri.test.ts`: "dönüşsüz" varsayım bekçisi yerine döndürülmüş ayak izi bekçisi. Ozyn'in editör düzenlemesinde ova'da
  iki nesne Y ekseninde 30° döndürülmüş (n5, n6); eski düz kutu bu binaların köşelerini kaçırıyordu. Kutu artık dönmüş ayak izini kapsıyor.
  Mutasyon: döndürme kapatılınca bekçi kırmızıya döner.
- `[YAZILDI-KOŞULMADI]` Gerçek Electron'da fareyle sürükleme; nesne paneli (sağ tık → Özellikler…).
