# Spec 31 — Yapı çubuğu (alt çubuk): sekmeli, açılır-kapanır alt panel

**Durum:** YAZILDI (testli), canlıda GÖRÜLMEDİ. Odak istisnası (Ozyn, 2026-10-18: "asset manager altta açılır kapanır, Sims gibi; zemin kalemi ikinci sekme; ileride çok sekme").

## Ne yapar
Tab (imleç kipi) → ekranın altında şerit belirir; `Y` ya da sekmeye tık paneli açar, etkin sekmeye tekrar tık indirir. Üst kenar tutamacı yüksekliği ayarlar (saklanır). Açıkken `1–9` sekme seçer. Altyazı ve sohbet çubuğun üstüne çıkar (`--alt-cubuk`). İmleç kipi kapanınca çubuk gizlenir, zemin kalemi bırakılır.
- **Asset sekmesi:** sol kategori listesi (Tümü / ★ Favoriler / Son kullanılan / kategoriler), arama, yatay kaydırmalı önizlemeli kartlar. Karta tık = Çağır (spec 30 hayaleti); aynı karta tekrar tık bırakır.
- **Zemin sekmesi:** araçlar `uygulama/zeminAraclari.ts` tablosundan (yükselt, alçalt, düzle, yumuşat, pürüz, aşındır, eski hâl); boyut/güç/sertlik; "nesneleri araziye oturt"; geri al / ileri al; "dosyadaki zemine dön" (iki adımlı). Sahnede basılı tut-sürükle, Shift ters, Ctrl+tekerlek boyut, Ctrl+Z/Y, sağ tık/Esc bırak.

## Altyapı (yeni sekme = bir `ekle`)
`world/arayuz/altCubukModeli.ts` (saf: sekme kaydı, sıra, açık/etkin, engel + neden, olay, kalıcılık) + `altCubuk.ts` (DOM). Sekme `Sekme {id, ad, simge, sira, kur(sayfa, arac)}`; içerik tembel kurulur; `SekmeAraci` ile ipucu satırı, rozet, kapatma. Sekmeler `uygulama/yapi/`.

## Zemin tasarımı
Editörün arazi kalemi aynen kullanılır (`araziKomutu.ts`, `firca.ts`, `yuzey.ts`; bekçi kamu listesinde). Level DOSYASI yazılmaz: zemin katmanının `duzenleme` verisi `orion.zemin.v1`'de durur, açılışta üstüne yazılır; kayıt dosyadaki hâle eşitse "dokunulmamış" sayılır. Vuruş bitince: kayıt → geri al adımı → oturan nesneler yerleştirme kaydına (`yerlestirme.donustur`) → Orion'un `Yer`i yeniden ölçülür. Geri al zemin + o vuruşta oynayan nesneleri birlikte alır (bellekte, 40 adım).

## Ölçülmeyenler / sınırlar
- Gerçek ekranda hiçbiri görülmedi: çubuğun görünümü/animasyonu, kart önizlemeleri ve kaydırma, kalemin halkası ve basılı tutma hissi, halkanın Orion'un ışık zincirinde görünmesi, vuruş başına `level.ayarla` maliyeti, `Yer` yeniden ölçümü süresi.
- DOM sekmeleri başsız testsiz (yalnız mantık ve Babylon kalem testli). Rampa/su/çim-kaya maskesi araçları ve sürükle-bırak yerleştirme yok.
- Kayıt dolarsa (localStorage sınırı) uyarı basılır, zemin oturumda kalır.
