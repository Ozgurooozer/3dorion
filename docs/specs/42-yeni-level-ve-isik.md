# Spec 42 — Yeni level oluşturma + ışık aktörleri (oyun içi, Unreal gibi)

Durum: PLANLANDI (2026-10-29); Y0 (belge) yazıldı, Y1–Y5 sırada. İstek: Ozyn, "istisna" (ODAK dönemi, `world/level/`).
Plan dosyası kopyası: aşağıdaki §1–§6. Kararlar Ozyn'in cevaplarıdır (AskUserQuestion, 2026-10-29).

## 1. İstek ve kararlar
- Arayüzden "Yeni level" → **Boş ova**, **Düz zemin**, **Tamamen boş** (+ "bu level'ın kopyası"). Her şey arayüzden seçilip eklenebilmeli.
- Güneş/ışık kaynaklarını arayüzden eklemek (ışık işine girilecek). Işık: **önce MVP 1 = nokta ışık**, sonra spot, yönlü (ek güneş), gölge.
- Orion: **sırayla**. 1. aşama düzenleme kipi (Orion ofiste kalır); 2. aşama Orion'un yeni level'a geçişi (ayrı onay).
- Editör: **oyun içi dok paneli** (ayrı `editor.html` Electron'a bağlanmaz).

## 2. Unreal nasıl yapıyor
- File ▸ New Level → şablon seçici; level = projenin Content'inde tek dosya.
- Place Actors paneli: Basic · Lights (Directional, Point, Spot, Rect, Sky Light) · Shapes (Cube, Sphere, Cylinder, Cone, Plane) · Visual Effects · Volumes; sürükle-bırak.
- Her şey Actor: ışık, zemin, sis. Seçince Details, Outliner'da yeri. **"Zemin yapmak" Shapes'ten Plane/Cube yerleştirip ölçeklemek** (Landscape ayrı mod).
- Not: Basic şablonunun tam içeriği doğrulanmadı (Epic belgesi yalnız panel sekmelerini anlatıyor).
- Fark: Unreal'da ışık/zemin/sis level'ın NESNESİ; bizde ışık/ortam level'ın TEK AYARI (`isik.gunes/dolgu`, `ortam`).

## 3. Bugün (okuyarak)
- `LevelTanimi`: tek güneş + gök dolgusu; nokta/spot tanımı yok. GI hacmi her kare `scene.lights` okur (yeni ışık girer).
- Yeni level yalnız ayrı web editörde (`world/level/editor/arayuz/levelMenusu.ts`, şablon `sablon/bos.level.json`); editör yalnız geliştirmede.
- Oyun içinde yok: level yazma IPC'si (yalnız `projeLevelOku`), yeni level, canlı level geçişi (spec 39 §12), `levelYeriniOlc(l,"ova")` sabit adı.

## 4. Tasarım
- **Veri:** `LevelTanimi.isiklar?: IsikAktoru[]` (isteğe bağlı, `LEVEL_SURUMU` aynı). MVP `{ id, ad, tur:"nokta", konum, renk, siddet, menzil, gizli?, kilitli?, grup? }`. Güneş+dolgu Outliner'da "Dünya ışığı" sabit satırı.
- **Şablonlar:** `bos` (Boş ova), `duz-zemin`, `tamamen-bos`; bekçi `world/level/leveller.test.ts`.
- **Host:** `proje:level-olustur` / `proje:level-kaydet` (kanallar.cjs → preload.cjs → kopru.ts → main.js); içerik doğrulaması çağıranda.
- **Düzenleme kipi:** `Dosya ▸ Yeni Level…`; ayrı `LevelSahnesi`; saf editör çekirdeği (`durum/komutlar/gecmis`) yeniden kullanılır; Yerleştir/Outliner/Details dok panelleri.

## 5. Riskler (ölçülecek)
- Babylon malzemesi varsayılan 4 eşzamanlı ışık; güneş+dolgu 2'sini yer → nokta ışık tavanı ölçülür (çizim bütçesi 220, `kapidene` 15/19 tabanı).
- `world/level/cekirdek/nesneSistemi.ts` başka Claude'un commit'lenmemiş değişikliğini taşıyor; dokunmadan önce `git status`.
- Orion'un araç yüzeyine level/ışık düzenleme EKLENMEZ.

## 6. Dilimler
Y0 belge · Y1 şablonlar · Y2 host yazma IPC · Y3 nokta ışık (veri+kurulum+ölçüm) · Y4 düzenleme kipi + paneller · Y5 `leveldene`. Sonra: spot, yönlü, gölge, Şekiller (düzlem/küp), Orion geçişi, bileşen modeli.

## 7. Işık gizmosu (Ozyn isteği, 2026-10-29)
Yeni ışık SEÇİLİ gelir; Işıklar paneli açıkken ışığın yerinde parlak bir işaret küresi ve seçiliye taşı okları görünür (`uygulama/isikGizmosu.ts`, editörün `gizmoKatmaniKur`u aynen). Sahnede işarete tıklamak seçer (ekran uzayında, mesh pick değil); ok bırakılınca konum tek adımda `level.ayarla`ya yazılır; Esc sürüklemeyi iptal eder. Çekirdeğe yalnız `IsikAktorleri.kimlikler()` eklendi.
**Sonraki (ayrı spec, Ozyn onayıyla):** ışık = bileşenli aktör (alan şeması → Details, değişkenler), grafa açma (`ışık.ayarla/oku`, kendi grafı, olay tabanlı), eklenti olarak aç/kapa. Bkz. DOGRULAMA-DEFTERI K15.
