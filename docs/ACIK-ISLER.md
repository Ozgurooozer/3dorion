# Açık işler — tek liste

Önceliği Ozyn belirler. Her madde tek satır + nerede. Biten madde SİLİNİR (geçmişi git'te);
"çözüldü" arşivi tutulmaz. Son güncelleme: 2026-10-13.

## Orion'un ortam aracı + ofis/ova tek level (Ozyn, 2026-10-13/14): spec 26 §12 yok (ölçümler `docs/olcum/on-kayit-ortam*.md`), spec 27
Yapıldı: `dunya_ortam` niyeti, doğuştan sözlük (token'sız), öğrenen sözlük, modüler kalıcılık, G penceresi komut yolu; canlı `ortamdene` Haiku 16/16.
- **LLM yolunun serbest cümleyi anlaması zayıf** (f0 tek atış: Haiku 9/24, yerel 2–6/24). Üçüncü düzeltme (eş anlamlı tablosu) Ozyn'e soruldu: "öğrenen sözlük asıl yol" denerek ertelendi.
- **Ofis ova'nın İÇİNDE, tek level (spec 27 §7): YAPILDI.** Plato, gerçek kapı, tek `Yer`, görünüm geçişi, pencereden ova; `kapidene` 19/19, çizim 77–193 (bütçe 220). Açık: efekt zinciri geçişinde takılma gözlenmedi, ofisin dış yüzü yalın, ışın ofis duvarlarını katı sayar, **`gozdene` yeniden tasarlanmalı** (iki yer varsayıyordu), yeşil harabe Ozyn'in kararıyla ayrı arşivde (commit'siz).
- Ajanda gürültüsü giderildi (`kopru.ajanda`, `docs/olcum/on-kayit-ajanda.md`: kayıtta ajanda satırı 12/11 → 0). Kalan: eski ışınlanma yolunda (`dunya.kapidanGec`, `?level=harabe`) yer ofis çapalarını taşımaz, ajanda orada `tahta` hatası üretir (artık LLM'i uyandırmaz, kayda iz düşer); `uygulama/giris.ts` ajanda kimliğini `AJANDA_ONEKI` yerine düz "ajanda" ile kuruyor (WIP yüzünden dokunulmadı); duman koşuları `ORION_KARAR_DOSYASI` verilmezse gerçek karar kaydına yazıyor (2026-10-14 kaydında `kapidene` oturumları dahil 13 "beyin yok" oturumu).

## Ova stil penceresi (Ozyn, 2026-10-13): G ile açılıp kapanır — `world/arayuz/stilPenceresi.ts`
Ova'dayken stil önayarı, renk düzeni, ışık sonrası çipleri, shader'lar, saat/dünya düğmeleri oyunun içinde sürüklenebilir pencerede (editörle AYNI panel: `level/editor/arayuz/gorunum.ts`, soyut `GorunumKaynagi`). Yalnız canlı level'a yazar, dosyaya yazmaz. Canlı doğrulandı (G aç, toon, kapat, yeniden aç; ekran görüntüsü). Ofise dönünce sökülür (bu yol canlıda koşulmadı).

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
- **İngilizce cevap kipi** (talimat + İngilizce Piper sesi) — `ORION_STT=nemotron` ile mikrofon İngilizce duyar. Varsayılan kulak artık TÜRKÇE (Whisper base, yerel CPU, 2026-10-15; `docs/olcum/on-kayit-stt-turkce-1.md`): sentetik sesle ölçüldü, GERÇEK MİKROFON canlı kapısı Ozyn'de bekliyor (`3dorion.bat mikrofon`, V basılı tut). Açık: iki dil arasında oyun içi geçiş tuşu, akışlı (sesli yazma gibi) tanıma, gerçek sesle doğruluk.

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
  Ağız/göz blend shape'i yok → ağız senkronu ve göz kırpma görünmez, `jest` klibi yok; `uygulama/giris.ts`
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
- `world/surfaces/duvar/semaCizim.ts` birim testsiz (deneme sayfası var: `/world/surfaces/duvar/sema-deneme.html`).
- `zihindene` tarama kapıları ağır (senkron `pick`, FPS 100 → 8–19).
- **Mimari düzenleme (2026-10-14, `docs/arastirma/kod-mimarisi-konteyner-onerisi-2026-10-14.md`):** A1–A4, B3 (`giris.ts` → `uygulama/`) ve B4 (`surfaces/` alt klasörleri) YAPILDI. KALAN: **B5** ofis dosyalarını `world/level/` kökünden `world/oda/`'ya taşımak — `cekirdek/anlam.ts`'in `Nesne` tip bağının yön değiştirmesi gerekiyor (önce tipi `level/cekirdek` ya da `protocol/temel.ts`'e al); bu dosya Ozyn'in commit dışı düzenlemesi olduğu için atlandı, çözülünce yapılır. **B1–B2** YAPILDI (2026-10-15, dal `mimari/b1-b2-giris-bolme`): `uygulama/giris.ts` 2075 -> ~700 satır, 19 modül `uygulama/` altına taşındı (başlık yorumunda liste); giris kompozisyon kökü ve kurulum SIRASI olarak kaldı, getter deseni `senaryoBaglami.ts` ile aynı. `ISTISNALAR` 60 -> 35 kenar (uygulama→dünya kenarlarının çoğu bilinçli tüketilen yüzey olarak kamu listelerine alındı); yalnız küçülür.
- Sözleşme cilası: model fazladan `TAHTA:` satırı üretiyor; `ornekler.ts` OpenCode yolunda kullanılmıyor (iki örnek kaynağı).

## Güvenlik
- `OPENCODE_SERVER_PASSWORD` ayarlı değil (kod hazır; sunucu localhost'ta şifresiz).
