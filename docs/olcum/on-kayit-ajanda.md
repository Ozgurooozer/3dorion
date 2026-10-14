# Ön kayıt — ajanda gürültüsü (2026-10-14, koşudan ÖNCE)

**Gözlem (karar kaydı, gerçek):** `ajanda` (boşta bak/jest, `mind/ajanda.ts`, ~15–30 sn'de bir) her niyetinin sonucunu
`algi/sonuc` satırı olarak yazıyor. 2026-10-14: 84 / 256 satır (hepsi `bitti`, `refleks.sonuc.rutin`, kapı geçmedi);
2026-10-12: 1333 / 1599. İki-yer döneminde (2026-10-11: 54, 2026-10-13: 5) ova yerinde `tahta`/`pencere` çapası yoktu →
`hata (bilinmeyen çapa/nesne)` → `refleks.sonuc.hata` kapıyı GEÇTİ (LLM uyandı). Spec 27 B3'ten (0fd1db7) beri canlı yer
birleşik ve ofis çapalarını taşıyor (`world/yer/birlesikYer.ts` `capalar`), bugün ajanda hatası 0.

**Hipotez (kök):** ajandanın niyeti hiçbir karar zincirine bağlı değil (LLM vermedi, öğrenen kapının öğreteceği bir şey
yok), ama sonucu zihnin algı yoluna, LLM'in kendi niyetinin sonucuyla AYNI yoldan giriyor: her sonuç kayda bir satır, her
hatası LLM'e "senin niyetin başarısız" diye gidiyor. Düzeltme: köprü ajanda kaynaklı sonucu beyne hiç vermez (yeni içgüdü
`kopru.ajanda`); başarı kayda yazılmaz (yalnız sayaç), hata `kopru.ajanda`/geçmedi ile yazılır (iz kalsın, LLM uyanmasın).
Ajandanın çapa listesi birleşik yerle bekçi testle bağlanır (her çapa canlı yerde var).

**Koşular (TABAN = düzeltmeden önceki kod, YENİ = sonrası; ikisi de aynı komutla):**
- O (ova): `ORION_OVADENE=1 ORION_SMOKE=1 ORION_SMOKE_MS=300000` — 300 sn; Ozyn ofisin dışına ışınlanır, Orion yürüyerek
  çıkar (senaryonun çoğu ofis dışında, sonunda kapıdan girip oturur). `ovadene` beden senaryosu DEĞİL: ajanda açık.
- F (ofis): senaryosuz, `ORION_SMOKE=1 ORION_SMOKE_MS=300000 ORION_SESSIZ=1` — 300 sn; Orion ofisin içinde, masada.
- İkisinde de: `ORION_KARAR_DOSYASI=<scratchpad>/<kol>-<koşu>.jsonl` (gerçek kayda yazılmaz), konsol dosyaya; beyin ölü
  uç (`ORION_BEYIN=dis ORION_BEYIN_ADRES=http://127.0.0.1:9`): LLM yok, Ozyn'in açık uygulamasının Haiku adaptörüne
  bağlanılmaz. Bu yüzden "LLM uyanışı" doğrudan ölçülemez; yerine kapı ölçülür: uyanış yalnız kapıdan GEÇEN algıyla olur
  (`bridge/kopru.ts` `algi`: geçmeyen algı tampona girmeden döner).

**Sayılar (koşu başına):** a = kayıtta `niyet` öneki `ajanda` olan `algi` satırı; a_h = bunların `durum:hata` olanı;
g = ajanda satırı içinde `kapi.gecti=true`; c = konsolda `[NIYET] ajanda_… → bitti` satırı (ajanda gerçekten çalıştı mı);
d = ajanda dışı `algi` satırı; ovadene için GECTI/KALDI sayısı.

**Ölçütler:**
- K1 (sorun ölçülebiliyor): TABAN'da O ve F'nin ikisinde de a ≥ 5. Değilse düzeltmenin etkisi bu düzenekle görünmez; sonuç
  olumsuz yazılır, kod yine birim testle değerlendirilir.
- K2 (gürültü gitti): YENİ'de O ve F'de a = 0 (ajanda hatası çıkmadığı sürece; çıkarsa a = a_h ve g = 0 olmalı).
- K3 (ajanda hâlâ çalışıyor, ofiste de ovada da): YENİ'de F'de c ≥ 8 ve c ≥ TABAN(F).c × 0,7; O'da c ≥ 3.
- K4 (LLM'i uyandırmaz): YENİ'de g = 0; birim testte ajanda HATASI kapıyı geçmez ve sahte beyin uyanmaz.
- K5 (gerileme yok): YENİ ovadene GECTI ≥ TABAN GECTI; YENİ d, TABAN d'nin ±%30'u içinde (aynı senaryo, aynı süre).

K2 ve K3 ve K4 geçerse düzeltme kalır; biri kalırsa sonuç olduğu gibi yazılır, düzeltme Ozyn'e sorulur.

## Sonuç (2026-10-14, koşulduktan sonra)

| koşu | a (ajanda satırı) | a_h | g | c (konsolda ajanda bitti) | d (ajanda dışı algı) | ovadene |
|---|---|---|---|---|---|---|
| TABAN O | 12 | 0 | 0 | 12 | 17 | 7/7 |
| TABAN F | 11 | 0 | 0 | 11 | 19 * | – |
| YENİ O | **0** | 0 | 0 | 12 | 14 | 7/7 |
| YENİ F | **0** | 0 | 0 | 13 | 0 | – |

- K1 GEÇTİ (12 ve 11 ≥ 5). K2 GEÇTİ (a = 0, ikisinde de). K3 GEÇTİ (F: 13 ≥ 8 ve ≥ 11 × 0,7; O: 12 ≥ 3).
  K4 GEÇTİ (g = 0; birim test `bridge/kopruAjanda.test.ts`: ajanda hatası uyandırmaz, aynı düzenekte LLM'in hatası uyandırır).
- K5: ovadene 7/7 → 7/7 GEÇTİ; O'da d 17 → 14 (−%18, içinde; fark Ozyn'in hareket olayları: `ozyn_yaklasti`/`ozyn_sana_bakti`).
  F'de d kıyaslanamaz (*): TABAN F koşusunda 07:20'de test penceresine klavyeyle "takip et" yazıldı (benim düzeneğim söz
  vermez; `kesin:true`, kaynak yok) — Orion 8 takip adımı yürüdü, 19 satırın hepsi bundan. YENİ F'de dış girdi yok.
- Ajandanın hata yolu canlıda koşulmadı: canlı yer birleşik ve dört çapa da orada (O koşusunun yer satırı:
  `çapa masa,monitor,sandalye,tahta,pencere,kapi,…`), hata üretmenin canlı yolu yok. O yol birim testle sınandı.
- Beyin ölü uçtaydı: "LLM uyanışı" doğrudan değil, kapı üzerinden ölçüldü (yukarıda). Ham dosyalar scratchpad'de kaldı
  (`taban-O/F`, `yeni-O/F` `.jsonl` + `.log`), depoya alınmadı.
