# Açık işler — tek liste

Önceliği Ozyn belirler. Her madde tek satır + nerede. Biten madde SİLİNİR (geçmişi git'te);
"çözüldü" arşivi tutulmaz. Son güncelleme: 2026-10-13.

## Orion Beyin Ofisi (Ozyn, 2026-10-12/13): nedenli uyanma + özerk tur + hafıza — `specs/26` §10–§11
Mimari düzeltme turu bitti (§11; vault `forum/orion-beyin0fis/`, Toplantı 4). Açık:
- **Bir hafta gerçek kullanım** sonra `node --experimental-strip-types tools/karar-ozet.ts` (kendiliğinden uyanış bölümü: boş oran, Ozyn tepkisi, token, varlık kanıtı) → ofis yeniden toplanır (OB19).
- **Terminal oku (OB12):** `sor terminal` denendi, Haiku terminal kümesini 11/16 → 7/16 düşürdü (komut önermek yerine okuyor) → geri alındı (`docs/olcum/e1-sor-terminal-geri-alindi.patch`). Yeni tasarım gerek: araç yalnız terminal bağlamda YOKKEN sunulsun ya da sonuç algısı zenginleşsin.
- **ornith-32k** görmediği özerk sette sessizlikte 1/4: sessizlik uyanışı ornith'te kapalı (`bridge/ozerkYetenek.ts`); özerk talimat ornith için yeniden ele alınmalı.
- Açık iş hatırlatması canlıda geçti (§11, n=1), ama olay metni öneriyi düşmüş diye söylüyor (§11, 0/12 yanlış); "onayı iptal ettim" türü yeni yanlışlar kaldı. `?inisiyatif=eski` canlıda denenmedi.
- Hafıza giriş politikası (H6) hedefi tutmadı: ham sözler çoğu emir ("otur", "bana gel"), selam değil; asıl mekanizma sıkıştırma (canlıda 1 kez çalıştı, doğru).

## ŞU AN: Orion toparlama — F0–F3-B BİTTİ, F4 kısmen; sonuçlar `specs/26` §8 (Ozyn, 2026-10-11)
Yapılan: ölçüm tezgâhı (`tools/f0-olc.ts`, 28 senaryo) · hareket olayı uyandırmaz · gordum turunda `sor` yok · Haiku yapısal
çıktı (varsayılan; tam araç yüzeyi) · komut kipi (onaysız; yıkıcı bekler) · olgu hafızası + `hatirla`. Haiku %54 → %70
(ortak 24 senaryo), terminal hâlâ en zayıf. Kalan işler (hepsi ölçümlü, kanıtı spec 26 §8.4'te):
- **Ovada oturma** (`otur` tek ofis sandalyesine sabit) ve **`gec`** (Orion kapıdan tek başına, C6): `3dorion.bat ovadene` 6/8.
- **F3-C GERÇEK MODELDE ölçüm** (kod+test hazır, spec 26 §9: `/compact`, otomatik; eşikler tahmin) · **terminal oku** aracı · hata metinlerini İngilizceye çevirmek.
- Haiku tutarsızlıkları: `dur`, `terminale claude yaz` (t1), `terminale merhaba yaz` (t8).
- `world/level/ova/ova.level.json` Ozyn'in commit dışı düzenlemesi bir bekçi testini kırıyor (`ova bütün yerleşimleri dönüşsüz`: bir
  nesne 30° dönük) — düzenleme Ozyn'in; test ya level'a ya testin varsayımına uydurulmalı (Ozyn karar).

## (eski, öğleden sonra) odak OVA, Orion arka planda
Bırakıldığı yer:
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
- **Yeşil harabe kiti (2026-10-11, Ozyn'in referans görüntüsü):** `assets/kaynak/orman-kiti.py` (Blender'da kurar,
  sabit tohum) → `assets/orman/` 34 glb + önizleme + `katalog.json` (`sehir-kiti.py --pivot koken`: pivot = ızgara
  orijini). Duvar 8, blok 8, zemin 2, havuz 3, köprü 1, detay 2, bitki 10. `.blend`'de `vitrin` sahnesi referans
  kompozisyonu. **Oyuna bağlı DEĞİL:** editör/nesne sistemi tek katalog okur (`KATALOG_DOSYASI = "sehir/katalog.json"`).
  **Üçgen bütçesi [ÖLÇÜLDÜ, katalog × vitrin yerleşimi]:** vitrin 1285 yerleşim = 11,6 M üçgen; `CubeMossy_4` tek
  başına 29,7 k üçgen (205 adet = 6,1 M). Oyunda bu yoğunluk koşmaz → LOD / uzak kuleler için yapraksız sürüm /
  yaprak sayısı düşürme / ince örnekleme (thin instance) kararı gerek, level kurulmadan önce.
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
