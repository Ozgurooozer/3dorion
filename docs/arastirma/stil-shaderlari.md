# Stil shader'ları — araştırma notu (spec 18, 2026-10-09)

Amaç: ova'da toon / cel / anime / Moebius / piksel-sanat görünümlerini denemek, aralarında geçmek, sonunda kendi
stilimizi seçmek. Referans görseller repo DIŞINDA: `C:\Users\ozigo\Pictures\shader-ornekleri\<stil>\` (telifli,
yalnız bakmak için). Ozyn'in referansları: BotW (iki ton + specular + rim), 90'lar anime robot, piksel-sanat
sütunlar/kayalar, pastel gün batımı gök.

## Teknikler
| teknik | özü | kaynak | Babylon'da |
|---|---|---|---|
| **Cel (Catuhe)** | N·L 5 seviyeye: eşik .95/.5/.2/.03 → 1/.8/.6/.35/.2; gölge çarpanı içeride | Smashing "Building Shaders with Babylon.js" (2016); `@babylonjs/materials` `CellMaterial` (`computeCustomDiffuseLighting`, `CELLBASIC` = 2 seviye) | CellMaterial ayrı malzeme → fabrikamızı ve rüzgâr eklentisini bozar. Mantığı EKLENTİYE taşınır. |
| **Toon (Roystan / BotW)** | iki ton `smoothstep(0,.01,N·L·gölge)` + ortam; Blinn specular `pow(N·H, parlaklık²)` eşikli; rim `(1−N·V)·N·L^0.1` eşikli (.716) | roystan.net/articles/toon-shader | Eklenti: `normalW`, `viewDirectionW`, güneş yönü uniform. |
| **Renkli gölge (anime)** | gölgeyi karartma değil TON KAYDIR (mavi-mor); sert iki/üç ton, posterize, kalın çizgi, film greni | Blender anime rehberleri; "Retro 90s Anime" eklentisi | Eklentide gölge rengi = paletten. Posterize renk efektinde. |
| **Kenar çizgisi (Sobel)** | derinlik + normal tamponunda 3×3 Sobel → dış hat + iç kırılım | Wikipedia "Cel shading" (5 adımlı hat); Heckel "Moebius-style post-processing" | Hazır efekt YOK. `GeometryBufferRenderer` (derinlik, normal) + özel `PostProcess`. |
| **Moebius** | Sobel çizgi + sin/hash titreşim (el çizimi) + ışığa göre tarama (luma < .45 / .55 / .80) | blog.maximeheckel.com | Çizgi efektine titreşim; tarama renk/ışık aşamasında. |
| **t3ssel8r / piksel-sanat** | düşük çözünürlük; 4 komşu: derinlik farkı → koyu dış çizgi, normal farkı → açık iç vurgu; göreli derinlik eşiği (fark / derinlik — uzak düzlemde sahte kenar olmasın); paletli ton; ortho kamera piksel sabitleme | godotshaders "3D Pixel art outline & highlight"; t3ssel8r röportajları (80.lv) | `ortam.piksel` VAR. Çizgi efektinin t3ssel8r kipi. Perspektif kamerada sabitleme tam olmaz → kayma kabul. |
| **Palet + titreme** | rengi en yakın palet rengine yuvarla, 4×4 Bayer ile titret | Codrops "Real-time dithering shader"; Heckel "Art of dithering" | Renk efekti: level paleti → uniform dizi. |

## Babylon'a nasıl oturur (koddan doğrulandı, Babylon 9.26)
- Standard malzeme ışığı `diffuseBase`'te toplar, gölge dahil (`lightFragment`: `diffuseBase+=info.diffuse*shadow`).
  Eklenti `getCustomCode` içinde `"!regex"` anahtarıyla `vec3 finalDiffuse=` satırından önce kod sokabilir: ışık
  bantlanır, CSM gölgesi, sis, ince örnek (çim) ve rüzgâr eklentisi olduğu gibi çalışır.
- Kenar efekti için Babylon'da `EdgesRenderer` (geometri kenarı, çizgi mesh) ve `OutlineRenderer` (ters kabuk) var;
  flat lowpoly'de ters kabuk köşelerde açılır, kenar çizgisi her üçgeni çizer → ekran uzayı efekt seçildi.
- Çim gbuffer'a girmemeli: binlerce yaprak gürültü kenarı üretir ve rüzgâr kayması gbuffer'da yok.

## Maliyet beklentisi
Işık eklentisi: piksel başına birkaç işlem (önemsiz). Çizgi: sahne bir kez daha gbuffer'a çizilir (çizim ~2×) +
tam ekran geçiş. Renk efekti: tam ekran geçiş, palet döngüsü ≤ 32. Ön kayıt spec 18'de.

## Kaynaklar
- https://www.smashingmagazine.com/2016/11/building-shaders-with-babylon-js/
- https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/materials/src/cell/cell.fragment.fx
- https://roystan.net/articles/toon-shader/
- https://blog.maximeheckel.com/posts/moebius-style-post-processing/
- https://en.wikipedia.org/wiki/Cel_shading
- https://godotshaders.com/shader/3d-pixel-art-outline-highlight-post-processing-shader/
- https://www.therookies.co/projects/58728 (90'lar anime şehir, Blender)
- https://80.lv/articles/tips-on-convincing-animations-for-3d-pixel-art-games (t3ssel8r)
