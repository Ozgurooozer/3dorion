# Spec 16 — Temiz bağlam: çekmeceli hafıza, kalıcı durum defteri, kural yönlendirici

> Üst belgeler: `06-beyin-v2.md` (durum ≠ anı K2, zaman etiketi K3, eşikli getirme K4/K5, bağlam düzeni K8),
> `12-anlik-benlik.md` §4.1 (SABİT / ANLIK / DERİN), `15-goz-ve-mekan-bellegi.md` (nesnelerin yeri).
> Durum: **F0 ve F1 kodlandı, canlı ölçüm bekliyor** (2026-10-08).

## 0. Tek cümle
Orion yerel 7B modelle yaşıyor: bağlama yalnız o an gereken girsin. Hafıza konuya göre çekmecelere
bölünür, "şu an" bilgisi (konum, ne yapıyor, son konuşma) kalıcı bir durum defterinde hep güncel tutulur,
ve ikisi de **yalnız sorulunca** bağlama girer — kararı LLM'den önce bir kural yönlendirici verir.

## 1. Bugünkü durum `[KOD]` (keşif, 2026-10-08)
- Her uyanışta: talimat (~2k kr), araç şemaları (~5,4k kr), örnekler, **son 12 geçmiş kaydı**, `dunya`
  satırı (ham koordinat), ve kelime örtüşmesi > 0 olan anılardan **3 tane** — otomatik.
- Hafıza katmanlı ama **ömre göre** (SABİT/ANLIK/DERİN), konuya göre değil; DERİN tek torba, 300 kapasite.
- Kalıcı "şu an" bilgisi yok: benlik ve çalışma belleği oturumla ölür, yer yalnız koordinat.
- Canlı hafıza (239 anı): 60'ı inisiyatif dürtüsü, olay adları ve terminal çıktıları tekrarla önem 10'a
  tırmanmış (Ozyn'in sözü 8), terminal blokları kırpılmamış, mikrofon yanlış duymaları önem 8.
- Senaryolar gerçek hafıza dosyasına yazıyordu; paneldeki kapasite teli köprüye bağlı değildi.
- Token hiç kaydedilmiyordu (`prompt_eval_count` atılıyordu).

## 2. Kararlar (Ozyn, 2026-10-08)
- **K1** Bağlama girişe **kural yönlendirici** karar verir (saf fonksiyon, LLM'den önce). LLM aracı değil.
- **K2** Durum defteri KALICI ve güncel; bağlama yalnız sorulunca ("neredesin", "neredeydin", "ne yapıyorsun").
- **K3** Eski konuşma yalnız sorulunca ("ne konuşmuştuk"). Yakın pencere küçülür (öneri: son 4 kayıt / 10 dk)
  — "evet", "onu da yap" anlaşılsın diye tamamen kalkmaz; sayı ölçümle kesinleşir.
- **K4** Gereksiz şey hafızaya hiç girmez (yazma süzgeci); eski gürültü yedekli göçle ayıklanır.
- **K5** Araç şeması kırpma ayrı faz (F6), kendi ön-kaydıyla.

## 3. Fazlar
F0 ölçüm + yalıtım → F1 yazma süzgeci → F2 durum defteri → F3 çekmeceler → F4 yönlendirici →
F5 bağlam montajı + `baglamdene` → F6 araç kırpma (ayrı ön-kayıt).

## 4. Ön kayıt (canlı koşudan ÖNCE yazıldı, 2026-10-08)
Taban: F0 ölçüsüyle bugünkü kod (yalıtılmış hafıza, `yerel:qwen2.5:7b`). Sonra: F5 bittiğinde aynı düzenek.

| # | ölçüt | eşik | çürütme |
|---|---|---|---|
| P1 | Konuşma uyanışında medyan bağlam (karakter, `uyanis.baglam.toplam`) | ≥ %40 küçülür | < %40 |
| P2 | `eylemdene` | 6/6 kalır | herhangi bir KALDI |
| P3 | `baglamdene` hatırlama soruları ("ne konuşmuştuk", "neredeydin") | ≥ 4/5 doğru | ≤ 3/5 |
| P4 | `baglamdene` konum sorusu ("neredesin") | 5/5 doğru | < 5/5 |
| P5 | Araç doğruluğu (`tools/eylem-olc.ts`, qwen2.5:7b) | tabandan düşmez | düşerse |
| P6 | Sorulmayan durumda bağlama durum/anı girmesi (yönlendirici boşken) | 0 | > 0 |

Dürüstlük: eşik tutmazsa olduğu gibi yazılır; eşik koşudan sonra değiştirilmez; sapma §6'ya tarihle.

## 5. Sonuçlar
### F0 — ölçüm ve yalıtım `[TEST]`
- Karar kaydının `uyanis` satırına `baglam` (bölüm başına karakter + `token`): `bridge/baglamOlcusu.ts`,
  `mind/kararKaydi.ts` `BaglamOlcusu`; Ollama `girdiToken` (`prompt_eval_count`), API `usage.prompt_tokens`.
  Konsolda `[BAGLAM]` satırı.
- Senaryo yalıtımı: `ORION_SMOKE=1` koşusu gerçek hafızaya dokunmaz, boş geçici dosyayla başlar
  (`host/hafizaDosyasi.js` `hafizaYolu`; dosya boş olarak var edilir ki renderer localStorage'daki eski
  hafızayı ona göç ettirmesin). `ORION_HAFIZA_DOSYASI` verilirse o kazanır.
- Canlı taban: **bekliyor** (Ozyn Orion'u kullanırken ikinci pencere açılmadı).

### F1 — yazma süzgeci `[TEST]`
- `mind/aniSuzgeci.ts`: olay (dünya olayı + inisiyatif dürtüsü) yazılmaz; terminal baş 4 + son 8 satıra
  kırpılır, kırpıldığı yazılır; mikrofon sözü önem 6 (klavye 8). Algıya `kaynak` alanı (`protocol/algi.ts`,
  eklemeli). Köprünün üç yazma yolu tek `_aniyaYaz`dan geçer.
- `Hafiza.ekle`: tekrar yalnız söz ve sonuçta önem artırır; terminal ve olay yalnız tazelenir.
- Panodaki kapasite teli köprüye bağlandı (`KopruAyari.hafizaKapasite`).
- Göç `eskiHafizayiTemizle` (`world/giris.ts` `gurultuyuAyikla`, localStorage yedeği bir kez). Gerçek dosyanın
  kopyasında [ÖLÇÜLDÜ, kuru koşu]: 239 → 174 anı, 65 olay atıldı, 11 terminal kırpıldı, 3 terminal önemi
  indirildi; 42 183 → 26 937 bayt (−%36). Söz (138) ve sonuç (17) aynen.
- Bozma denemesi (yedekli, taban yeşil): 6/6 mutant yakalandı.

## 6. Sapma kaydı
- 2026-10-08: canlı taban F0'da alınamadı (Ozyn o sırada Orion'u kullanıyordu); F5 öncesi alınacak.
  Taban koşusu süzgeçli kodla olacak: P1 tabanı "süzgeç sonrası, yönlendirici öncesi" sayılır.
