# Kullanım defteri — "Orion günlük kullanımda işe yarıyor mu?"

**Dönem:** 2026-10-16 → 2026-10-30 (14 gün). **Tek soru:** Orion, günlük kullanımda işe yarıyor mu? Bu dönemde `world/level`'a yeni özellik yok (yalnız hata düzeltme); istisna için Ozyn açıkça "istisna" der.

**Durum: ÖN KAYIT TASLAĞI.** Aşağıdaki sayılar BENİM ÖNERİM ve ölçüme dayanmıyor (tahmin). Ozyn onaylar ya da değiştirir; **ilk kullanım satırı yazıldıktan sonra ölçüt DEĞİŞTİRİLMEZ** (sonuca bakıp eşik oynatmak yok).

## Ne yazılır
Orion'u her kullandığında **bir satır** (aşağıdaki tablo). Sonuç harfi:
- **E** = istediğim oldu, düzeltmem gerekmedi.
- **K** = oldu ama düzeltmem/tekrar söylemem gerekti.
- **H** = olmadı ya da işe yaramadı.
- **Y** = yanlış ya da zararlı bir şey yaptı (yanlış komut önerisi, istenmeyen hareket…).
Gün sonunda tek soru: **"Yarın yine kullanır mıyım?" 1–5.**

## Ön kayıtlı ölçüt (öneri)
Dönem sonunda, yalnız yazılan satırlardan:
1. **Kullanım:** ≥ 10 farklı günde kullanım ve toplam ≥ 30 satır. Altında kalırsa sonuç "belirsiz: yeterince kullanılmadı" (başarı da başarısızlık da sayılmaz).
2. **İşe yarama:** (E + K) / toplam ≥ %70 **ve** Y ≤ %5.
3. **Süreklilik:** gün sonu puanlarının ortalaması ≥ 3,5.
Üçü de tutarsa: "evet, işe yarıyor; sıradaki iş en sık K/H nedeni". Biri tutmazsa: "henüz değil"; en sık H nedeni **tek** iş olarak seçilir (başka özellik değil). Eşikler tahmin: dönem sonunda "çok sıkı/gevşekti" diye **not düşülür**, geriye dönük değiştirilmez.

## Otomatik veri (elle yazmadan)
`tools/karar-ozet.ts` karar kaydından kendiliğinden uyanış, token ve Ozyn tepkisi özetini verir; kullanım günlerini ve oturum sayısını kayıttan doğrulamak için kullanılır (Ozyn'in elle yazdığı satırlar asıl veri; kayıt tamamlayıcı).

## Defter
| tarih | ne istedim | ne oldu | E/K/H/Y | not |
|---|---|---|---|---|
| | | | | |

## Gün sonu puanları
| tarih | "yarın yine kullanır mıyım?" (1–5) |
|---|---|
| | |
