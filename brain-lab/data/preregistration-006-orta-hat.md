# Ön-kayıt 006 — Orta hat kuralı (TASARIM-009 Aşama 3a) — Kart 3

**Durum:** Ozyn 2026-09-30'da orta hat kuralını seçti ("Açlığın öğrettiği yan alışkanlığı nasıl tedavi edelim?" →
"Orta hat kuralı"). Kod bitti, öngörüler koşmadan önce commit'lenir. Test seed'leri (≥ 1001) yok, dondurma yok.

## Neden
Yön teşhisi (defter 2026-09-30, `yon-teshis.ts`): H3B97 yemeğin yönünü öğreniyor (dönüş farkı 0,10–0,18) ama açlık tek
başına bir yana dönme alışkanlığı öğreniyor (açlık 1'de |sol − sağ| 0,47–0,95). Yemek alışkanlığın karşı tarafındayken
dönüş yarışını %16–38 kazanıyor, doğumdaki %48'in altında.

## Değişiklik (`[TEST]`)
`born: { midline: true }` + `learning: { midline: true }`: tarafı olmayan duyuların (açlık, acı, çarpma, ileri/geri proprio,
merkez ışının her türü) sol ve sağ dönüş sinapsları (Git ve Gitme) doğumda eşit (iki rastgele ağırlığın ortalaması),
öğrenmede tek hesap (ortak bekleyen değişim, iki kopyanın ortalama uygunluğu, iki kopya birlikte, defterde ikisi de).
Refleksli grubun çarpma refleksi (bump → sol 0,6) aynalandı: bump → sol ve sağ 0,6.
- `learning/midline.test.ts` 13 test, `experiments/stage3a.test.ts` 2 test; bozma 12/12.
- Kapalıyken bit-birebir: `regression-check.ts H3B97 2` iki denek kayıtla aynı; tam `npm test` 2007/2007.

## Kollar (sabırlı eğitim, seed 1–5 × iki grup, 10 değerlendirme bölümü, kıt oda ROOM3)

| kod | ne |
|---|---|
| D0 = H3B97 (kayıtlı, sabırlı, Kart 1) | dürtü 0,116 · hayatta 0,88 · yönlendirme 0,097 · yön sondası: fark 0,153, alışkanlığa karşı kazanma 0,162, açlık \|sol−sağ\| 0,653 |
| H3M | H3B97 + orta hat kuralı |

Komut: `npm run exp -- tara H3M --egitim sabirli --isci 5`.

## Puanlama (Kart 1 dersi)
Ortalama ölçütü + eşleştirilmiş sayım (aynı seed ve grup) ≥ 7/10 aynı yönde + ortanca farkı aynı yönde. Üçü uyarsa ✓;
ortalama ölçütü tutmazsa ✗; ortalama tutar ama öbürlerinden biri uymazsa **belirsiz**.

## Öngörüler (çürütme ölçütüyle)

| # | öngörü | çürütülürse |
|---|---|---|
| P1 | Kalibrasyon: H3M'de açlık sol−sağ tam 0, 10/10 denek (yapı gereği) | ≠ 0: kod hatası; koşu yorumlanmaz |
| P2 | Yön sondasında yemek dönüş yarışını kazanma (alışkanlık yokken bütün yan ışınlar) ≥ 0,48 (doğumdaki düzey); H3M > D0 alışkanlığa karşı kazanma (0,162) | < 0,48: başka bir yanlı girdi (ör. proprio, yan ışın duvarı) alışkanlığı taşıyor |
| P3 | Yönlendirme: H3M ≥ D0 + 0,05 (≥ 0,147) | < D0 + 0,05: alışkanlık kalkınca da yön davranışa geçmiyor → sorun yemek farkının büyüklüğü (kredi) → 3b (`lat`) ya da iz |
| P4 | Dürtü: H3M ≤ D0 + 0,05 (≤ 0,166) | > 0,166: alışkanlık aramaya yarıyordu (dönerek aramak), kaldırmak bedel ödetti |
| P5 | Yemek farkı korunur: H3M dönüş farkı ≥ D0 − 0,05 (≥ 0,103) | < 0,103: kural yemek öğrenmesini de zayıflattı |

## Dur kuralı
- Koşu çökerse ya da P1 çürürse dur, raporla.
- Yalnız tarama: olumlu iddiadan önce doğrulama (20 + CROSS) ve `curut`.

## Teşhis (koşudan sonra)
`yon-teshis.ts patient H3M H3B97` (fark, kazanma, proprio sürüklemesi), `diagnose.ts`, `kural-olcum.ts patient H3M`, yeni bir
yan alışkanlığı var mı: sabit girdilerden sol − sağ (yan ışınların duvar türü dahil).
