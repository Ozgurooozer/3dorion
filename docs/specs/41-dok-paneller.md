# 41 — Dok paneller: yapı panelleri ve Orion ayarları (Unreal tarzı yerleşim)

Durum: **YAZILDI** (testli + tarayıcıda ekran görüntüsüyle doğrulandı; Ozyn'in elle denemesi YOK).
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

## Doğrulama
- `[TEST]` `world/arayuz/arayuzJetonlari.test.ts` (dok CSS'i jetonları içe aktarır), `uygulama/yapi/ortak/dok/dokDuzeni.test.ts` geçiyor.
- `[ÖLÇÜLDÜ]` Playwright (yazılım GL) ekran görüntüleri: Graf → sağ bölge, Sekans → sol bölge (sürükle-bırak olayı), Orion ayarları sağda açılır,
  sahne payı bölgelere göre küçülür. Görüntüler scratchpad'de (`dok-iki.png`, `ayar-sag.png`).
- `[YAZILDI-KOŞULMADI]` `3dorion.bat` ile gerçek Electron'da, gerçek fareyle sürükleme; Orion seçilerek (sağ tık) ayar panelinin açılışı.

## Açık (sonraki adım)
- Gözlem (O), Beden (B), nesne paneli (sağ tık), model seçici (M) ve stil penceresi hâlâ yüzen pencere; dok'a alınması bir sonraki dilim.
- Typecheck: bu makinede Babylon tip tanımları çözülemiyor (TS7016, yüzlerce satır); benim dosyalarımda hata yok. `npm run typecheck` temiz bir kurulumda yeniden koşulmalı.
- `world/yer/levelYeri.test.ts` "ova bütün yerleşimleri dönüşsüz" — bu değişiklikten ÖNCE de kırıktı (HEAD'de doğrulandı), ayrıca ele alınmalı.
