# 12 — Söylediğini yapsın, düşüncesi görünsün, API ile güçlensin (2026-10-02)

**Durum:** Ozyn onayladı (2026-10-02, sohbet; plan "Orion MVP"). Faz 0 bitti. Faz 1 sürüyor.

Kaynak: ortak canlı test, `docs/canli-test-2026-10-02.md`.

## Kararlar (Ozyn, 2026-10-02)

| soru | karar |
|---|---|
| Terminal | **Her komut onaylı.** Onay kapısı (`onay.insan`) aynen kalır; Orion yalnız monitörü kendisi açabilir hale gelir. |
| Hareket olayları | **Uyandırmaya devam eder, sesli konuşmaz.** Kapı değişmez (ölçüm haftası verisi bozulmaz). O zincirde söz sesli okunmaz, günlükte "iç ses" olur. Gereksiz uyanmayı Ozyn ileride `ogret` ile öğretir. |
| API anahtarı | **Şifreli, hatırlanır.** Ana süreçte `safeStorage` ile şifreli dosya; renderer anahtarı hiç görmez; "sil" düğmesi. |
| Sıra | Eylem → API → Zihin → Bilgisayar. |

## Faz 0 — taban ölçüsü [ÖLÇÜLDÜ]

Alet: `tools/eylem-olc.ts` + `fixtures/eylem/komutlar.json`. 8 sözlü komut, model başına koşul başına 5 tekrar,
puan `tools/eylem.ts` (gerçek log satırlarıyla kalibre, `tools/eylem.test.ts`). Girdi canlı köprünün kurduğu
gibi kurulur (`talimatUret`, `ornekUret`, `araclariUret`). İki koşul:
- **temiz:** geçmiş boş;
- **canlı:** 2026-10-02 testindeki "otur" turunun gerçek geçmişi (soyle ve düz metinle dolu, hiç beden eylemi yok).

| komut | ornith temiz | ornith canlı | qwen temiz | qwen canlı |
|---|---|---|---|---|
| otur | 4/5 | 4/5 | 5/5 | 0/5 |
| bana gel | 2/5 | 3/5 | 2/5 | 0/5 |
| yanıma gel | 5/5 | 4/5 | 5/5 | 0/5 |
| masaya git ve otur | 0/5 | 0/5 | 0/5 | 0/5 |
| kalk | 5/5 | 4/5 | 4/5 | 0/5 |
| önündeki bilgisayarı aç | 0/5 | 0/5 | 0/5 | 0/5 |
| tahtaya merhaba yaz | 0/5 | 0/5 | 2/5 | 0/5 |
| pencereye bak | 3/5 | 2/5 | 0/5 | 0/5 |
| **toplam** | **19/40** | **17/40** | **18/40** | **0/40** |
| ≥ 4/5 olan komut | 3/8 | 3/8 | 3/8 | 0/8 |

Ham çıktıdan teşhis:
1. **Söyleyip yapmamak** (ornith): "bilgisayarı aç" 8/10 kez yalnız `soyle "Bilgisayarı açıyorum"`; "bana gel"
   4/10 kez yalnız "Geliyorum".
2. **İlk adımda kalmak** (iki model): "masaya git ve otur" ve "tahtaya yaz" hep yalnız `git` ile bitti. Varış
   sonucu (`refleks.sonuc.rutin`) beyni uyandırmaz, ikinci adım hiç gelmez. Aynı turda `git + yaz` gönderilse de
   `yaz` varıştan önce yürür ve uzaktan yazma reddedilir.
3. **Geçmişteki düz metin zehirliyor** (qwen): canlı geçmişle 0/40. Model araç çağırmak yerine geçmişteki kendi
   düz metnini taklit ediyor ("ortalığı kontrol ediyorum. masaya git dolu sandalyeyi kapattım…"), bazen araç
   çağrısını düz metin olarak yazıyor. Kaynak: `kopru.ts` modelin araçsız düz metnini geçmişe `assistant` metni
   olarak yazıyor; `ollama.ts`'in yorumu bu kalıbın zararlı olduğunu zaten söylüyor.
4. **Etiket ve hedef karışıklığı**: `git {ad:"çalışma masası", tip:"nesne"}` (etiket çapaya çevrilmiyor);
   qwen "masaya git"te `{tip:"oyuncu", ad:"Ozyn"}` gönderdi.
5. **Bilgisayar için yetenek yok**: `dunya_odaklan` hiçbir yerde yürütülmüyor (Faz 4).

## Faz 1 — ön-kayıt (koşmadan önce yazıldı, 2026-10-02)

Değişiklikler:
- talimat (`KONUSMA`): iş istenirse beden aracı çağrılır; çok adımlı istek tek turda sırayla; "bana gel" =
  `git {tip:'oyuncu'}`; bilgisayar = `odaklan monitor`;
- eylem örneği (`ornekler.ts`);
- **geçmiş yalnız gerçekte olanı taşır**: Ozyn'in sözü, Orion'un sözü (`soyle`) ve beden niyetleri (araç adıyla).
  Araçsız düz metin geçmişe girmez;
- **eylem sırası**: tek turdaki birden çok beden niyeti köprüde sırayla yürür, her biri öncekinin `bitti`
  sonucunu bekler; `hata` sırayı keser ve beyne gider (mevcut `refleks.sonuc.hata`);
- `tip:'nesne'` etiketleri de çapaya çözülür;
- "dedi ama yapmadı" bekçisi (yalnız kayıt ve günlük);
- hareket zincirinde söz sesli okunmaz (içgüdü `kopru.hareket_sessiz`).

**Öngörü:** Aynı alet, aynı 8 komut, n=5, iki model.
- **temiz** koşulda her iki modelde ≥ 7/8 komut ≥ 4/5 doğru (plandaki eşik).
- **canlı** koşul Faz 1 kuralıyla kurulan geçmişle koşulur (aynı turlar, düz metin satırları geçmişe girmez,
  çünkü yeni kopru onları yazmaz). Bu koşulda her iki modelde ≥ 6/8 komut ≥ 4/5 doğru (gerçek geçmiş daha zor; tabanı 0/8 ve 3/8).
- "yalnız söz" toplamı her koşulda ≤ 3/40.
- "bilgisayarı aç" artık `odaklan monitor` çağırmalı (≥ 4/5). Yürütülmesi Faz 4'ün işi; bu fazda çağrı avatarda
  reddedilir.

**Çürütme:** temiz koşulda bir modelde < 7/8 komut geçerse kök neden düzeltmesi yetmemiştir → Faz 1b (bekçi
tetiklenince tek düzeltme turu, yeni içgüdü `kopru.sozEylemDuzelt`). Canlı koşulda qwen < 4/8 kalırsa geçmiş
temsili hâlâ zehirlidir → geçmiş penceresi ayrıca ölçülür.
