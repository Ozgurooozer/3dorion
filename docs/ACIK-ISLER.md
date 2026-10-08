# Açık işler — tek liste

Önceliği Ozyn belirler. Her madde tek satır + nerede. Biten madde SİLİNİR (geçmişi git'te);
"çözüldü" arşivi tutulmaz. Son güncelleme: 2026-10-08.

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
