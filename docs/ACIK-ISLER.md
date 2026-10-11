# Açık işler — tek liste

Önceliği Ozyn belirler. Her madde tek satır + nerede. Biten madde SİLİNİR (geçmişi git'te);
"çözüldü" arşivi tutulmaz. Son güncelleme: 2026-10-11.

## ŞU AN: odak OVA. Orion tarafı ARKA PLANDA (Ozyn, 2026-10-11)
"Projenin Orion kısmını arka plana alıyoruz, artık ovaya odaklanacağız." Aşağıdaki Orion maddeleri (karar bekleyen,
yarım iş, beden, davranış) Ozyn yeniden açana kadar BEKLER; önerilmez. Bırakıldığı yer:
- **Spec 25 görme:** Faz 1 NPC algısı + Faz 2 `sor gor` (Gemma e4b) bitti, Ozyn canlıda denedi, çalıştı (`specs/25` §8).
  Koşulmadı: V1 ön kayıtlı ölçüm `3dorion.bat gozdene` (§7). Karar: beyin Haiku kalır, Gemma yalnız göz.
- **Talimat + ajan yapısı düzgün değil (Ozyn) — spec 26 adayı, yazılmadı.** Teşhis (karar kaydı 2026-10-11): talimat
  hâlâ "Ozyn'in odasındasın" diyor (ovada "7 dakikadır bu odadasın"); üç "bakmak" (`bak` baş çevirir, `sor` algı,
  `sor gor` göz) — "gözünle bak" → `bak`; "gördüğünü aktar, ekleme" kuralı yok (Haiku Gemma'nın demediği renkleri
  ekledi, "gibi" çekincesini düşürdü); olaylar ham kimlik (`ozyn_yuzeyden_cikti` → "Ozyn odadan çıktı"); bağlamın
  %70'i araç şeması. Dil: İngilizce çerçevenin içine Türkçe algı/görme/durum karışıyor — öneri: içerisi tek dil
  (İngilizce), Türkçe yalnız ses + adlar sözlüğü. Önce `tools/eylem-olc.ts` / `sadakat-olc.ts` ile taban ölçümü.
- **Ovada boşta bakma (ajanda) odanın `pencere` çapasını istiyor** → "bilinmeyen çapa" hatası beyni boşuna uyandırıyor.
- **Spec 24 C6** (`gec`: Orion kendi başına çıkar) ve **C5** (paket) — Orion işi, bekler.

## Karar bekleyen (Ozyn)
- **Spec 15 S2–S5** (mekânsal bellek, gölge) — ön kayıt hazır, onay bekliyor. `specs/15`
- **Soru biçimi komut mu?** ("oturur musun?") — komut sözlüğü bugün saymıyor. `mind/komutSozlugu.ts`
- **Süzgeç merceği yetkisi** — ≥ 3 gölge oturumundan sonra. `specs/12`, `benlikSuzgecYetkisi`
- **Beceri yetkisi** (`ORION_BECERI`) gerçek kullanımda kapalı; "bir hafta gerçek kullanım" adımı. `specs/10`
- **3. ortak canlı test** (Ozyn + Orion, uçtan uca). `specs/13`

## Yarım iş (bu turdan, spec 16)
- **Haiku'ya proje bağlamı sızıyor:** adaptör `claude -p`'yi proje klasöründe koşuyor; CLAUDE.md ve hafıza
  Orion'un bağlamına giriyor ("ne konuşmuştuk" → "beyin haritası…"). Adaptör boş klasörde koşmalı. `tools/claude-beyin.ts`
- **Konumu yapılan işten al** (vardı/oturdu), geometri yedek kalsın — masa çevresi durakları 0,9 m arayla. `mind/durumDefteri.ts`
- **F6 araç kırpma** çevrimdışı ölçümü (P7/P8; `eylem-olc --cikar=dunya_al,dunya_birak,dunya_poz`). Bağlamın ~%60'ı araç şeması.
- **`baglamdene` n=5 partileri yarım:** qwen 2/5, Haiku 1/5 koşuldu (histerezisli sürüm). `specs/16` §5
- **İngilizce cevap kipi** (talimat + İngilizce Piper sesi) — mikrofon İngilizce duyuyor, Orion Türkçe cevaplıyor.

## Ova (spec 17) — sıradaki adımlar, her biri ayrı onay
- **Spec 19 bütçe aşımı (karar):** cel +538, toon +594 MiB ve 158 çizim, anime90 +637 MiB (sınır 500 MiB / 150).
  Seçenekler `specs/19` §4 sonunda.
- Şehir parçaları dalgalı zemine gömülebiliyor: arazi aracı "Düzle" ile altları düzlenebilir (araç var, ova'da yapılmadı).
- **Spec 24 kapıdan ovaya** (`specs/24`): C0–C3 bitti: ofiste kapıya bak, E → ova (`3dorion.bat kapidene`); C4 spec 25 Faz 1 (NPC algısı) ile bitti; kalan C6 `gec` → C5 · eski C4 notu: Orion
  ovayı bilir → C6 `gec` niyeti → C5 paket. Kopya: `tools/ogretmen.ts` SABIT ↔ giris "In the room" (C4'te tek kaynak).
- **Spec 23 sırası (onay):** C = spec 24 (yukarıda) → D düzenleme niyeti. B'den kalan:
  aynı adlı nesneler (ova'da 9 "ek bina") Orion için ayırt edilemiyor — denetim uyarısı + ayırt edici ad. Açık sorular: Orion'un düzenlemesi doğrudan mı onaylı mı; Electron'da
  level'ların yeri. Electron IPC deposu (`host/levelDosyasi.js` hazır) editör pakete girince bağlanacak.
- **Spec 22 açıkları:** bağlı prefab yok; hazır yapı/kaydet yalnız dev sunucusunda; dönmüş nesnelerde gruplu eksen
  ölçeği kayma üretir; çim nesne tabanından geçer; hidrolik erozyon/ayna/bölge kopyala/arazi deliği yok; editör fps'i
  sessiz makinede yeniden ölçülmeli (bu oturumda makine yüklüydü).
- **Kendi stilimiz** (spec 18/20): stil önayarları + 7 özel shader + 4 dünya paleti; "bir olması" için Ozyn'in seçimi.
- **Spec 20 açıkları:** debug taraması +22 çizim (derinlik geçişi; gbuffer'dan okumak düşürebilir); 06:00 şafak koyu.
- **Spec 21 açıkları:** su binaları yansıtmıyor (SSR yok); hacimsel bulut/sis yok; atmosfer sisi kapalı (sonsuz uzak düzlem ister); ateşböceği parlaklığı gözle ayarlanmadı (soluk beyaz).
- **Gece** (referans 2), ağaç/çiçek katmanları; gök bantları kaba (Ozyn: şimdilik dursun).
- **Odayı level çekirdeğine taşımak** (olculer/capalar → level verisi) — spec 24 bunu gerektirmedi (oda bir `Yer`).
- Ova kare hızı LLM ÜRETİRKEN ölçülmedi (yalnız model yüklüyken).

## Spec açıkları
- Spec 05 Aşama 7: ikinci MCP ajanı (OpenCode) + sayıyla karşılaştırma.
- Spec 11: VRAM farkı ölçülmedi; bazı ölçüler için glb bekçisi yok.
- Spec 13: Ozyn'in kendi API anahtarıyla ölçüm; şemanın çizili veri yolu.

## Beden / görünüm
- **Avatarın yüzü yok** — varsayılan beden low-poly `assets/orion-lowpoly.glb` (kaynak `tools/avatar-blender/`).
  Ağız/göz blend shape'i yok → ağız senkronu ve göz kırpma görünmez, `jest` klibi yok; `world/giris.ts`
  `vrmZorla: true`, `?yuzdene` KALDI raporlar. Sıradaki: yüz + jest klipleri, sonra saç/kıyafet.
- Oyuncu gövdesi kapsül (omuz kamerasında belirgin).
- Zoom hapı şema panelinin başlık şeridine biniyor (işlevsel etkisi yok).

## Davranış (ölçülmedi / canlıda görüldü)
- **Orion'un kendi gündemi yok:** inisiyatif v1 var (sessizlik dürtüsü, `mind/inisiyatif.ts`), kişilik/süreklilik zayıf.
- **qwen2.5:7b bağlamdaki bilgiyi sık yok sayıyor** ve düz metne kaçıyor (spec 16 koşuları); Haiku aynı bağlamda doğru.
- Yerel modelin Türkçe söz kalitesi ölçülmedi (`tools/sadakat-olc.ts --beyin=yerel`).
- Talimatta kabuk türü yok; model PowerShell'de `cd /d` önerebiliyor (dünya satırı yalnız terminal açıkken "PowerShell" der).

## Teknik borç
- Ayar normalizasyonu (`sayı | () => sayı`) 5 kopya: `mind/dikkat.ts`, `ajanda.ts`, `hafiza.ts`, `onayKapisi.ts`, `inisiyatif.ts`.
- `world/surfaces/semaCizim.ts` birim testsiz (deneme sayfası var: `/world/surfaces/sema-deneme.html`).
- `zihindene` tarama kapıları ağır (senkron `pick`, FPS 100 → 8–19).
- Sözleşme cilası: model fazladan `TAHTA:` satırı üretiyor; `ornekler.ts` OpenCode yolunda kullanılmıyor (iki örnek kaynağı).

## Güvenlik
- `OPENCODE_SERVER_PASSWORD` ayarlı değil (kod hazır; sunucu localhost'ta şifresiz).
