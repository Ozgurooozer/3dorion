# Spec 30 — Oyun içi asset yerleştirme ve düzenleme (menü + hayalet + gizmo)

**Durum:** YAZILDI (testli), canlıda GÖRÜLMEDİ. Odak kuralına Ozyn'in açık **istisnası** ile yapıldı (2026-10-17; aynı gün kapsam genişletildi: "Ova Stil Deneme'deki asset/gizmo işlerini Orion'a taşı"). Spec 29'un bağlam menüsünün üstünde çalışır.

## Ne yapar
Zemine sağ tık → `Asset ▸ Kategori ▸ Ad ▸ Yerleştir | Çağır`. Nesneye sağ tık → `Kopyala`, `Düzenle ▸ Taşı | Döndür | Ölçekle | Düzenlemeyi bitir`, `Kaldır`. Zemin menüsünde ayrıca `Yapıştır (ad)`.
- **Yerleştir** = sağ tıkladığım zemin noktasına HEMEN koy.
- **Çağır** = asset imleci izler (yarı saydam hayalet, zemine / nesnelerin üstüne oturur); **sol tık koyar** (art arda koyulabilir), **sağ tık / Esc bitirir**, **tekerlek** döndürür (15°, Shift 90°). Tab ile imleç kipinden çıkınca da biter.
- **Düzenle:** seçili nesneye editördeki gizmo takılır (oklar / halkalar / ölçek kutuları). Sürükleme bırakılınca yeni konum+dönüş+ölçek TEK adımda kaydedilir; Esc süren sürüklemeyi iptal eder. Ctrl basılıyken geçici ızgara/açı yaslaması (yaslama varsayılan KAPALI, editördeki "Ctrl = tersle" kuralı).
- Kopyala/Düzenle yalnız LEVEL nesnesi içindir (ofis eşyası level'da değil → gri + neden). Kaldır yalnız menüden eklenenler içindir (level dosyasındakiler gri + neden).

## Editörden ne taşındı, ne taşınmadı
**Taşındı (kopya değil, editörün sahne parçaları aynen kullanılıyor — `world/level/editor/sahne/{yerlestirme,yuzey,gizmo}.ts`, `cekirdek/yaslama.ts`; bekçi kamu listesinde):** hayalet yerleştirme, yüzey ışını (arazi + nesne üstü), taşı/döndür/ölçek gizmosu, yaslama kuralı.
**Taşınmadı (bilinçli, ayrı iş):** editör kamerası, tuş haritası (1–9 araçlar, Ctrl+Z…), araç çubuğu / sahne ağacı / özellikler paneli, kutu ve çoklu seçim, gruplama, geri al/ileri al, yüzeyde sürükleyerek taşıma, sınır kutusu aracı (gizmo koduyla gelir ama menüde yok), fırça / arazi / güneş / ölçü araçları, hizala-dağıt, yer imi. Gerekçe: Orion'un gezinme, seçim ve menüsü var; editörün kendi arayüzü bunlarla çakışırdı.

## Tasarım kararları
- **Level dosyası yazılmaz** (`ova.level.json` Ozyn'indir). Değişiklikler tarayıcı localStorage'ında (`orion.yerlestirme.v1`, sürüm 2) durur, açılışta level'ın ÜSTÜNE uygulanır (`tanimaUygula`: idempotent). Kayıt: `eklenen` (menüden eklenenler, `yer-` kimlikli) + `degisen` (level nesnesi için konum/dönüş/ölçek geçersiz kılma). Sürüm 1 kaydı (yalnız `tasinan` konumu) okunur ve yeni biçime çevrilir.
- **`world/level`'a kod girmedi.** Level'ın kamu API'si: `Level.tanim()/ayarla()`, `nesneler.katalog()/anlamlar()/hazir()/dugum()/idsi()/ornekOlustur()`, `yukseklik()`.
- **Orion yeni nesneyi görür:** her değişiklikte `Yer` yeniden ölçülür (`levelYeriniOlc` + `birlesikYerKur`) ve `yerler.ozyn/orion`a verilir: nesne Orion'un bak/git hedefidir, yürünmez yükseklikteki engel olur.
- **Tıklama sahipliği:** `uygulama/duzenlemeKipi.ts` `click`/`contextmenu`'yu yakalama aşamasında tutar: hayalet açıkken ya da imleç bir gizmo tutamağının üstündeyken (ve bırakmadan sonraki 300 ms) tıklama nesne seçimine (`nesneSecimi.ts`) GİTMEZ. Hayalet yokken hiçbir mevcut davranış değişmez (test: "hayalet yokken Esc ve tıklama dokunulmaz").
- Ardışık komutlar kuyrukta sırayla çalışır; `level.ayarla` hata verirse durum geri alınır ve neden altyazıda söylenir. Bozuk kayıt sessiz yutulmaz (uyarı + boş başlangıç). Katalogda artık olmayan varlık atlanır.
- Çok uzun liste: `Asset` kökü "Diğer ▸" ile bölünmez (`MENU_AYARI.sinirsizKokler`), liste ekrana sığmazsa kaydırılır.
- İki adımlı "Taşı → zemine Buraya taşı" KALDIRILDI (gizmo onu geçersiz kıldı); "Çağır = önüme 2,5 m" yorumu da kalktı (yerine imleçle hayalet).

## Dosyalar
`uygulama/yerlestirme.ts` (saf durum), `assetListesi.ts` (saf: katalog+anlam → gruplar), `yerlestirmeKaydi.ts` (localStorage), `yerlestirmeBaglantisi.ts` (komutları level'a uygular), `duzenlemeKipi.ts` (hayalet + gizmo yapıştırıcısı, Babylon), `menuKatkilari.ts` (asset/düzenleme katkıları), `world/arayuz/menu/*` (sınırsız kök + kaydırma), `uygulama/giris.ts`, `yerGecisi.ts`.

## Ölçülmeyenler / bilinen sınırlar
- **Gerçek ekranda hiçbiri görülmedi:** menü görünümü, hayaletin imleci izleyişi ve zemine oturuşu, gizmo'nun Orion'un ışık/stil zincirinde görünmesi (yardımcı katman editörde çalışıyor, Orion'da denenmedi), glb yükleme süresi, `level.ayarla`nın sık yerleştirmede maliyeti, Orion'un yeni/taşınan nesneyi gerçekten görmesi.
- Başsız testli: hayalet (tıkla koy, art arda, tekerlek, Esc, sağ tık, hayalet yokken dokunulmazlık, level hazır değil); gizmo bağlama testsiz (Babylon yardımcı katmanı başsız çalışmıyor).
- Gizmo yalnız TEK seçimle çalışır (Orion'da çoklu seçim yok). Seçili nesne değişince gizmo yeni seçime geçer; seçim kalkınca gizmo kalkar.
- Önizleme resmi (katalogda var) menüde gösterilmiyor; geri al yok (Kaldır var).
- Yerleştirilen nesneye Orion'un anlamı katalog anlam sözlüğünden gelir (ad, tür, eylemler); yeni anlam yazılmadı.
- Düzenlenen level nesnesi kayıtta geçersiz kılmadır: level dosyası sonradan o nesnenin dönüşümünü değiştirirse kayıt yine kazanır.
