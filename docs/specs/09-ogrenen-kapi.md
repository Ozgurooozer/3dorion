# Spec 09 — Öğrenen kapı (KT2): Ozyn öğretir, kural hafızası gölgede büyür

Tarih: 2026-09-27 · Durum: 1. adım uygulandı `[TEST]`; canlı doğrulama aşağıda.
Karar: vault `forum/beyin0fis/toplantilar/2026-09-27-ogrenen-kapi` (K1–K7). Ozyn tam yetki verdi.
Üst belgeler: `brain-lab/BUYUK-RESIM.md` (KT2), `docs/specs/08-karar-kaydi.md` (KT1: kayıt ve içgüdüler).

## Neden böyle

Öğrenen kapının sorusu şu: "Bu algı Orion'un LLM'ini uyandırmaya değer mi?" Öğretmen kim olmalı, dört aday ön-kayıtla
sınandı (`brain-lab/LAB-DEFTERI.md`, T0–T0c). Hiçbiri geçmedi:

| öğretmen | uyuşma (24 durum) | kaçırılan | boşa |
|---|---|---|---|
| qwen2.5, uyandırılınca ne yaptı | %58 | 0 | 10 |
| Haiku, uyandırılınca ne yaptı | %58 | 0 | 10 |
| qwen2.5, hakem ("değer mi?") | %71 | 5 | 2 |
| Haiku, hakem | %50 | 12 | 0 |

- **Uyandırılan beyin susmuyor.** Hangi model olursa olsun uyandırılmayı bir görev sayıyor.
- **Hakemler iki zıt uca düştü.** Soru öznel: Ozyn'in tercihi.

Bu yüzden öğretmen Ozyn (K1).

## Tasarım

```
algı ──► içgüdüler (değişmez) ──► kapının kararı ──► davranış (DEĞİŞMEDİ)
   │                                     │
   └─► durum kodu (doğuştan) ──► kural hafızası ──► GÖLGE karar ──► kayıt
                                        ▲
Ozyn: tools/ogret.ts ── öğretim satırı ──┘  (açılışta kayıttan yeniden kurulur)
```

- **Öğrenilebilir algı:** kararı ezilebilir bir içgüdünün verdiği (icgudu.ts) ve kanalı beyne açık olan algı.
  - Kanal kuralı tek kaynaktır (`kanalAcikMi`, mind/dikkat.ts).
  - Konuşma, bakış cevabı, yerel kanal, tik, bütçe, tekrar ve kısma öğrenilemez.
- **Durum kodu** (`mind/durumKodu.ts`, doğuştan): algı türü, kararı veren içgüdü, çıkış kodu, son komut, olay adı,
  kaynağı ve yüzeyi, mesafe kovası, niyeti kimin verdiği, içerik kelimeleri.
  - **Bağlam** (K4): algı anında Ozyn'in mesafe kovası (`ozyn:yakin|orta|uzak`), Orion'a bakıp bakmadığı
    (`ozyn:bakiyor`) ve çalıştığı yüzey (`ozyn_yuzey:…`).
  - Kompozisyon kökünden yapısal bir geri çağrıyla gelir (`baglam`); dünya metni ayrıştırılmaz. Okunamazsa kod
    bağlamsız yazılır.
- **Kural hafızası** (`mind/kuralHafizasi.ts`): her nöron okunur bir kural. Bir koşul (işaret kümesi), sayaçlar
  (uyan / sus) ve kanıt taşır.
  - Tek denemede doğar.
  - Aynı karardaki benzer deneyimle genelleşir (ARTMAP).
  - Çelişkide istisna doğar.
  - En özgül tam eşleşen kural karar verir.
  - Çoğunluk payı 0,75'in altındaysa karar yoktur.
- **Gölge** (K3): köprü her öğrenilebilir algıda hafızanın kararını kayda yazar: `golge: {yon, noron, pay}`, emin
  değilse `null`. Kapının kararı değişmez.
- **Öğretim** (K1, K5):
  - Ozyn bir algının doğru kararını işaretler. `ogretim` satırı hedef algıyı ve onun durum kodunu taşır.
  - Hafıza açılışta bu satırlardan, zaman sırasıyla, birebir yeniden kurulur. Ayrı bir durum dosyası yok.
  - Aynı satır iki yoldan gelirse (açılış ve izleyici) bir kez uygulanır. Aynı algının başka bir zamanda yeniden
    öğretilmesi ayrı bir derstir.
- **Canlı ders:**
  - `tools/ogret.ts` dersi `ogretim.jsonl`'a ekler.
  - Host dosyayı izler (`fs.watchFile`) ve yeni satırı renderer'a iletir; köprü onu hemen uygular.
  - Orion'u yeniden başlatmak gerekmez.

## Kullanım

```
node --experimental-strip-types tools/ogret.ts liste [--son=20]           # son öğrenilebilir kararlar
node --experimental-strip-types tools/ogret.ts ogret <oturum/algı> <uyan|sus>
node --experimental-strip-types tools/ogret.ts hafiza                     # öğrenilen kurallar
```

`--kayit=<klasör|dosya>` başka bir kayıt okur; varsayılan `%APPDATA%/3dorion/karar-kaydi`.

## Kabul ölçütleri

| | ölçüt | durum |
|---|---|---|
| G1 | Öğrenilebilir algı durum kodunu taşır; boş hafızada gölge `null`. | `[TEST]` `bridge/kopruOgretim.test.ts` |
| G2 | Ezilemez içgüdünün kararı ve kanalı kapalı algı öğrenilemez. Konuşma, yerel kanal ve dikkat.tekrar ayrı ayrı sınandı. | `[TEST]` |
| G3 | Tek deneme: bir dersten sonra aynı türden algının gölgesi öğretilen yöndür. | `[TEST]` |
| G4 | Gölge kapıyı değiştirmez: dersten sonra da içgüdü geçirir, beyin uyanır. | `[TEST]` |
| G5 | Kayıttan yeniden kurulan hafıza aynı gölge kararını verir. Zaman sırası kullanılır, eşitlikte kayıt sırası korunur. | `[TEST]` `mind/ogretim.test.ts` |
| G6 | Aynı öğretim satırı iki kez uygulanmaz. | `[TEST]` |
| G7 | Öğrenilemez algıya ders yazılmaz (bekçi). | `[TEST]` |
| G8 | Host yalnız tam satırları iletir; yalnız öğretim satırlarını okur. | `[TEST]` `host/kararDosyasi.test.ts` |
| G9 | Bozma denemesi: 20 mutantın 20'si yakalandı. | `[TEST]` 2026-09-27 |
| G10 | Canlı: kayıttaki gerçek bir karar araçla öğretilir; sonraki koşuda aynı durumun gölgesi dersi gösterir; davranış aynı kalır. | `[ÖLÇÜLDÜ]` 2026-09-27: gorudene, kabuk hatası "sus" diye öğretildi; koşu 2'de gölge `{sus, K1, 1}`, kapı geçirdi, LLM uyandı; koşu sırasında eklenen ders tam bir kez uygulandı |

| G11 | Bağlam koda girer: mesafe kovası, bakış, yüzey. Bilinmeyen alan kodlanmaz. Bağlam okunamazsa köprü bağlamsız kod yazar. | `[TEST]` 7 test; bozma 5/5 |

## Çevrimdışı kıyas özeti (`brain-lab/LAB-DEFTERI.md`, 2026-09-27)

- **Tek deneme ve unutmama güçlü.**
  - B (kural hafızası) ve D (tam anı) ikinci görülüşte %99–100 doğru. İlk çeyrekte görülenleri akış sonunda da doğru
    veriyorlar.
  - B, D ile aynı doğrulukta (%94–95) ve ~9 kat küçük.
- **Gerçekten yeni duruma genelleme zayıf.** Yeni durumlarda kararlar sınıf oranı düzeyinde.
  - B aşırı genelliyor: kesişimle küçülen kurallar çok yeni durumla eşleşiyor.
  - Karar anında kapsama şartı (H-K1) B'yi temkinli yaptı ama daha doğru yapmadı; reddedildi.
  - D, benzerliği bütün koda göre (Jaccard) ölçüyor ve iki havuzda da en iyi genelledi. Öneri H-K2: B karar anında
    Jaccard kullansın.
- Sinek modeli (A), bu uygulamayla başarısız: kodu ortak işaretler baskılıyor.

## Açık (sırayla, toplantı K7)

1. ~~Çevrimdışı kıyas (BY36)~~: yapıldı. B kaldı; H-K2 önerildi.
2. ~~Bağlam (BY37)~~: yapıldı (G11).
3. **Zihin duvarı paneli (BY38):** `world/` boşalınca.
4. **Yetki:** Ozyn'in kararı.
