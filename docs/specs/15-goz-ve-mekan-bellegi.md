# Spec 15 — Göz ve mekânsal bellek: sahneden okunan nesneler, bakışla güncellenen LLM'siz hafıza, büyüyen refleks

> Üst belgeler: `06-beyin-v2.md` (durum ≠ anı, K2/K3), `08-karar-kaydi.md`, `10-beceri-refleksi.md`,
> `12-anlik-benlik.md`, `14-mimari-saglamlastirma.md` (katman bekçisi), `docs/FIKIR-HAVUZU.md` (VLM ertelendi).
> Durum: **S1 bitti** (nesne kaydı + görünürlük, `world/level/nesneKaydi.ts`, ölçüler `docs/olcum-goz-ve-mekan-bellegi.md`). **S2–S5 Ozyn onayı bekliyor.** Kanıt etiketleri: `[KOD]` okundu, `[ÖNGÖRÜ]` ölçülmedi.

## 0. Tek cümle

Orion'un gözü bugün 10 adlandırılmış çapayı yalnızca beyin sorunca görüyor. Hedef: sahnedeki **anlamlı her nesne** bakış yönüne göre
**LLM'siz** kaydedilsin, bu kayıt bir mekânsal bellekte tutulsun, beyin onu hazır alsın ya da sorsun, ve yapılan işler giderek daha çok refleks olsun.

## 1. Bugünkü durum `[KOD]`

| parça | bugün | boşluk |
|---|---|---|
| `mind/algiHizmeti.ts` | ışın testi + 40° koni + karakter bütçesi | yalnız `CAPALAR` (10 çapa); yalnız `dunya_sor` ile |
| `mind/calismaBellegi.ts` | üzerine yazar, 30 sn'de siler | beynin sorduğunu tutar; kendiliğinden güncellenmez |
| `bridge/talimat.ts` | İngilizce, durum bazlı, ölçülmüş | "LOOK first" kuralı bellek yokluğunun yaması |
| `mind/beceriHafizasi.ts` | slotlu beceri, gölge modunda | kısmi refleks yok; sözlük yerleri elle yazılı |
| zihin duvarı | yalnız insan görür | MCP ajanı okuyamaz |

## 2. Kararlar

- **K1 Görme = sahne okuma, kamera değil.** Işın testi kesin ve 0 ms (FIKIR-HAVUZU). VLM kullanılmaz.
- **K2 Kapsam = anlamlı etiketli nesneler.** `metadata.nesne = { ad (Türkçe), tur }`. Etiketsiz mesh (duvar, zemin, tavan) bağlama girmez. Sınır bilerek kabul: etiketsiz şey "bilinmiyor", "yok" değil.
- **K3 Bellek durağanlığa göre eskir.** Eşya yavaş, Ozyn hızlı. Silinmez, yaşlanır; yaş HER satırda yazılır; bayat bilgi "şimdi" diye sunulmaz.
- **K4 Bakış güncellemesi beyne çıkmaz.** `yerel` kalır; bağlama yalnızca özet satırlar girer. Hiçbir güncelleme LLM turu açmaz.
- **K5 Gölge önce, yetki sonra.** Her dilim önce davranışı DEĞİŞTİRMEDEN yazar/ölçer.
- **K6 Salt-okunur.** MCP'ye `hatirla`/`zihin` sorgusu eklenir; panoya yazma yetkisi verilmez.
- **K7 Tek kaynak.** Nesne kaydı tek yerde; sözlük yerleri ondan türer; bekçi test ayrışmayı yakalar.

## 3. Dilimler

S1 nesne kaydı → S2 mekânsal bellek (gölge) → S3 bağlama bağlama + istem sadeleştirme → S4 `dunya_sor` `hatirla`/`zihin` → S5 sözlük yerleri kayıttan + kısmi refleks (gölge).
Bu belge S1 ve S2'yi ön kayıtlar. S3–S5 eşikleri, S2 sonucu görülünce ayrı ön kayıtla donar.

## 4. Ön kayıt — S1 ve S2 (koşmadan ÖNCE yazıldı)

Koşu: yalnız Node, `npm test` düzeyinde saf testler; LLM, Haiku, ağ yok. Gerçek oda geometrisi (`world/level/olculer.ts` `KATI_YUZEYLER`) ve gerçek kayıt kullanılır.

### S1 — nesne kaydı ve görünürlük

| # | öngörü | olasılık | çürütücü (bu olursa öngörü YANLIŞ) |
|---|---|---|---|
| P1 | 5 konum × 8 yön = 40 görünümde, kaydın "görünür küme"si bağımsız bir referansla (nesne kutusunda 9 örnek nokta, kaba kuvvet ışın) **belirsiz olmayan her (görünüm, nesne) çiftinde** aynı | %85 | belirsiz olmayan tek bir çiftte ayrışma |
| P2 | 60 nesnelik tam görünürlük taraması CPU'da p95 ≤ 1 ms | %80 | p95 > 1 ms |
| P3 | enjekte edilen mutantların (koni açısı, engelleme atlama, bütçe sınırı ±1, yaş birimi) ≥ %90'ı testlerce yakalanır | %75 | < %90 |
| P4 | kaydın nesne adı kümesi ile sahnedeki `metadata.nesne` kümesi birebir (elle ikinci liste yok) | %95 | fark var |

"Belirsiz": referansın 9 noktası kendi aralarında ayrışan çiftler (kısmi örtülme). Bunlar ayrı raporlanır, P1'i çürütmez ama sayısı yazılır.

### S2 — mekânsal bellek (gölge)

| # | öngörü | olasılık | çürütücü |
|---|---|---|---|
| P5 | betikli yürüyüş (A→B, 360° dönüş) her adımda `in view` listesi referans görünür kümeye eşit | %80 | herhangi bir adımda fark |
| P6 | **bayat-şimdi hatası = 0**: görünmeyen nesne için hiçbir satır `in view` demez | %90 | tek örnek |
| P7 | konide değilken yaş, gerçek geçen süreyle ±1 güncelleme adımı içinde | %85 | sapma > 1 adım |
| P8 | nesne görüş dışındayken taşınırsa: yeniden görülmeden eski konum yaşıyla kalır, yeniden görülünce ≤ 1 güncellemede yeni konum | %80 | eski konum "taze" yazılır ya da gecikme > 1 |
| P9 | 60 nesnede bağlam satırları ≤ 400 karakter; kırpma olursa kırpıldığı 100% söylenir | %85 | > 400 ya da sessiz eksiltme |
| P10 | **K4**: hiçbir bellek güncellemesi `beyin` kanalına algı ya da LLM turu üretmez (protokol testi) | %95 | tek örnek |

Olasılıklar: sahte kesinlik olmasın diye P3, P7, P8 en belirsiz (%75–85). Düşük olasılıklı madde tutmazsa yeni ön kayıtla turu tekrar ederiz, eşik oynanmaz.

### Dürüstlük kuralları

- Ön kayıt koşudan önce donar; koşudan sonra eşik, olasılık ya da çürütücü değiştirilmez. Yanlış çıkan öngörü "yanlış" yazılır.
- Referans, ölçülen çekirdekten **bağımsız** yazılır (aynı hatayı iki yerde yapmayalım). Ortak yardımcıdan türemez.
- Sonuçlar `docs/olcum-goz-ve-mekan-bellegi.md` karnesine, `[ÖLÇÜLDÜ]` etiketiyle yazılır; olumsuz sonuç dahil.
- Canlı kanıt (S4): token harcamayan örnek. Haiku/bulut beyin yalnızca Ozyn onayıyla.

## 5. Açık sorular (Ozyn'a)

1. Eşikler (P1–P10) makul mü? Donmadan önce değiştirmek serbest.
2. İlk etiketlenecek nesneler: hangileri? (Odadaki mevcut eşyalardan `odaEsyalari.ts`'e bakıp liste önereceğim; senin onayın gerekir.)
3. `hafiza jev ile değerleri değişken kelimeler ile` cümlesini "şablonlu kayıt (JSON), değişken kelimeler slot" diye okudum (S5). Yanlışsa düzelt.

## 6. Sapma kaydı (koşudan ÖNCE, 2026-10-04; ilk sürüm sha256 `473e3de5ed2750be`)

S1 kodu yazılmadan önce odanın kaynağı okundu ve K2'deki "metadata.nesne ile Babylon'dan okunur" ifadesi **değiştirildi**:

- Oda Blender GLB'sinden yükleniyor ve mesh'ler **malzeme adıyla** adlandırılmış (`oda_neon_pembe`, `oda_maun`...): tek tek eşya değil, anlamlı bir nesne adı taşımıyor `[KOD: odaEsyalari.ts]`.
- Odanın tek veri kaynağı `world/level/olculer.ts`: mesh (oda.ts), Blender betiği (`tools/oda-olcu-json.ts` üzerinden), çapa, çarpışma ve ışın kutuları hepsi oradan okuyor `[KOD]`.
- Bu yüzden nesne kaydı **olculer.ts'ten türer** (repo'nun kendi kalıbı: veri önce, sahne ondan). Çapalar `KATI_YUZEYLER` + `CAPA_ETIKETLERI`'nden; çapasız eşyalar (raf, berjer, kutu yığını, iki lamba) aynı dosyadaki sabitlerden. Raf kutusu iki yerde satır içi kopyaydı: `RAF` sabiti eklenip ikisi ondan türetildi.
- **P4 buna göre yeniden okunur:** "kaydın nesne kimlikleri = `KATI_YUZEYLER`'deki çapalı kutular ∪ açıkça sayılan eşyalar, adlar `CAPA_ETIKETLERI`'nden; ikinci liste yok" (bekçi testi). Eşik ve olasılık aynı kalır. Karnede P4 "koşu öncesi yeniden okundu" diye işaretlenir.
- `oda_ortasi` bir yer, nesne değil (kutusu yok): kayıtta yok.
