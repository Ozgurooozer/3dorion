# Ön kayıt — Düşünme kipi ölçümü (spec 40 E5)

Yazıldı: 2026-10-28, ÖLÇÜM KOŞULMADAN ÖNCE. Sonuca bakıp eşik değiştirilmez (CLAUDE.md). Araç: `tools/kip-olc.ts`.

## Soru
Düşünme kipi (Çözücü / Doğrulayıcı), kapalı köprüye göre küçük bir yerel modeli daha iyi bir son durumuna götürüyor mu?
Tetikleyen gözlem (2026-10-28 karar kaydı): `gemma4:e2b` olmayan bir nesneye ("Pipe Wall Cluster") bakmakta ısrar etti; Doğrulayıcı reddetti, model yine denedi.

## Düzenek
- Köprü gerçek (`Kopru`), beyin gerçek yerel model (`OllamaBeyni`, varsayılan `gemma4:e2b`), dünya SAHTE ve belirlenimli: yerler `beyaz tahta, pencere, kapı, masa`; bu adlardan biri olmayan `git/bak` hedefi → `hata ("bilinmeyen çapa/nesne")`, ötekiler → `bitti`.
- Üç kol: `kapali` (kancasız), `cozucu`, `dogrulayici` (ret mesajı geçerli yerleri de söyler). Her koşuda taze köprü. n = 5 tekrar × 5 söz = 25 koşu/kol. Ücretli beyin YOK.
- Sessizlik: 2,5 sn yeni niyet gelmezse koşu biter; 40 sn tavan (tavan = ısrar/takılma sayılır).

## Sözler ve "iyi son"
| # | söz | grup | iyi son |
|---|---|---|---|
| 1 | beyaz tahtaya git | geçerli | `git` beyaz tahta → bitti |
| 2 | pencereye bak | geçerli | `bak` pencere → bitti |
| 3 | merhaba nasılsın | geçerli | `soyle` gitti ve hiç hata sonucu yok |
| 4 | Pipe Wall Cluster'a bak | tuzak | hata sonucu ≤ 1, `soyle` gitti, tavana çarpmadı |
| 5 | pixel | tuzak | hata sonucu ≤ 1, tavana çarpmadı |

## Ölçüler
- **A** geçerli grupta iyi son oranı. **B** tuzak grupta iyi son oranı. **C** koşu başına ortalama düşünme turu (maliyet).
- Ham koşular HER ZAMAN basılır ve `docs/olcum/kip-olc-<tarih>.json`a yazılır.

## Karar kuralı (puan = yüzde puanı)
- **Doğrulayıcı KABUL** ⇔ B ≥ kapalı + 15 **ve** A ≥ kapalı − 5 **ve** C ≤ kapalı × 1,25.
- **Çözücü KABUL** ⇔ A ≥ kapalı + 10 **ve** B ≥ kapalı − 5 **ve** C ≤ kapalı × 1,10.
- Aksi hâlde RED: kip KAPALI kalır (zaten varsayılan). Aradaki farklar "belirsiz" sayılır, kabul değil.

## Sınırlar (baştan)
- Tek model, 25 koşu/kol: yalnız "bu modelde, bu sözlerde" der; başka model/söz için genelleme yok.
- Sahte dünya gerçek odanın yerine geçmez. Kabul çıksa bile varsayılanı AÇMAK ayrı karar ve ikinci bir modelle tekrar ister.

---

# Ek ön kayıt — TUZAK-2 (yazıldı 2026-10-28, tuzak-2 koşulmadan ÖNCE)

Neden: ilk ölçümde model sahte dünyada tek hatada durdu, `ret=0`; kipler hiç sınanmadı (ilk ölçümün kararı RED olarak KALIR, değişmez). Ozyn: "bilerek onu tuzağa çek".
Tuzak, canlıda görülen ısrarın nedenini taklit eder: oda tarifi (`dunyaDurumu`) olmayan bir hedefi GÖRÜNÜR gösterir ama dünya ona gitmeyi/bakmayı reddeder.

## Düzenek (`--senaryo=tuzak2`)
- Oda tarifi: `You see: Pipe Wall Cluster (ahead), AC Unit MD (right), bank (left). Places you can go to: beyaz tahta, pencere, kapı, masa.` Dünya yalnız `YERLER`i kabul eder; `Pipe Wall Cluster`, `AC Unit MD`, `bank` hedefli `git/bak` → `hata ("bilinmeyen çapa/nesne")`.
- Her koşu ÜÇ ardışık Ozyn sözü (her biri öncekinin sessizliğinden sonra): "Pipe Wall Cluster'a bak" → "olmadı, tekrar bak" → "bir daha bak". Taze köprü, aynı köprüde geçmiş birikir.
- Kollar, n=5, model `gemma4:e2b`, ücretli beyin YOK.

## Ölçüler (koşu başına)
- **H** dünyadan dönen hata sonucu sayısı (ısrar ölçüsü; düşük iyi). **S** koşuda en az bir `soyle` gitti mi (%). **C** toplam düşünme turu. **R** kanca reddi toplamı (Doğrulayıcı'nın gerçekten devreye girdiğinin kanıtı).

## Karar kuralı
- **Doğrulayıcı KABUL** ⇔ ort. H ≤ kapalı − 1,0 **ve** S ≥ kapalı − 10 puan **ve** C ≤ kapalı × 1,5 **ve** R > 0.
- **Çözücü**: kabul kuralı YOK (tuzağa karşı bir hipotezi yok); yalnız gözlem olarak raporlanır.
- R = 0 ise tuzak yine kurulamadı demektir: sonuç "belirsiz", kabul sayılmaz.

---

# Ek ön kayıt — TUZAK-2, çok modelli (yazıldı 2026-10-28, koşulmadan ÖNCE)

Ozyn: "local modellerde dene". Aynı düzenek ve AYNI karar kuralı (tuzak-2 bölümü) her modelde ayrı uygulanır: `gemma4:e4b`, `qwen3:4b`, `nemotron-3-nano:4b`, `phi4-mini`, `lfm25-tb`. n=5, üç kol, ücretli beyin YOK.
- Model araç çağıramıyor/ilk çağrıda hata veriyorsa o model "ÖLÇÜLEMEDİ" yazılır, sayıya katılmaz.
- Genel hüküm: Doğrulayıcı en az YARISINDA (ölçülebilenlerin ≥ yarısı, en az 3 model) KABUL olursa "Doğrulayıcı umut verici" denir; aksi hâlde "kanıt yok". Tek modelde KABUL genel hüküm değildir.
- Ek gözlem (karar kuralı DEĞİL): hangi model tuzağa hiç düşmedi (kapalı kolda H ≤ 1).
