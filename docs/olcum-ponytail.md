# Ponytail ölçümü — kurulum 2026-09-17, karar 2026-10-01

> Ponytail global eklenti olarak kuruldu. Satıcının kendi rakamına (-%54 LOC,
> n=4, Haiku 4.5, kendi seçtiği repo) **dayanarak karar verilmeyecek**. Karar
> bizim kendi işimizdeki farka bakacak. Bu dosya, karşılaştırma yapılabilsin
> diye kurulum anındaki durumu donduruyor.

## Maliyet — ölçüldü

| ne | değer | nasıl |
|---|---:|---|
| Skill listesi (6 skill) | ~709 tok | `claude plugin details ponytail` |
| SessionStart enjeksiyonu | ~1.300 tok | Hook'un `getPonytailInstructions()` çıktısı elle çalıştırılıp sayıldı |
| **Oturum başına toplam** | **~2.000 tok** | |

`claude plugin details` yalnızca 709 diyor ve hook'lar için *"harness-only — no
model context cost"* yazıyor. **Bu yanlış:** `SessionStart` hook'u ruleset'i
doğrudan oturum bağlamına basıyor. CLI hook'u çalıştırmadığı için göremiyor.

Not: `lite` / `full` / `ultra` modları arasında token farkı yok (5.202 / 5.229 /
5.267 karakter). Yoğunluk seviyesi **bağlam maliyetini düşürmez**, yalnızca
davranışı değiştirir. "Pahalıysa lite'a düşerim" işe yaramaz; tek gerçek
indirim `off`.

## Güvenlik denetimi — 2026-09-17

Hook'lar ve scriptler tarandı: **ağ erişimi yok, telemetri yok, komut
çalıştırma yok** (`exec`/`spawn` hiç geçmiyor). Yalnızca yerel bayrak dosyası
yazıyor (`~/.claude/.ponytail-active`, `.ponytail-statusline-nudged`).
Statusline önerisi bayrak dosyasıyla **bir kez** yapılıyor, her oturumda değil.

## Zemin — kurulum anındaki 3dorion

| ölçü | değer |
|---|---:|
| Toplam TS (test hariç) | 16.078 satır |
| `world/` kod / test | 10.514 / 2.633 (oran 0,25) |
| `mind/` kod / test | 2.061 / 1.508 (oran 0,73) |
| `bridge/` kod / test | 1.882 / 1.352 (oran 0,72) |
| `protocol/` kod / test | 1.011 / 574 (oran 0,57) |
| En büyük dosya | `world/giris.ts` — 2.312 satır (%56'sı senaryo) |
| Testsiz dosya (`world/`) | 24 |
| Test sayısı | 539 |
| Bilinen kopya kod | `mind/` içinde 4 kopya ayar normalizasyonu |

## Neye bakacağız — üç soru, üçü de yanıtlanabilir

**1. Merdivenin 2. basamağı gerçekten yakalıyor mu?**
Elimizde **cevabı bilinen** bir vaka var: `mind/dikkat.ts`, `ajanda.ts`,
`hafiza.ts`, `onayKapisi.ts` içinde aynı normalizasyonun dört kopyası. Bu,
ponytail'in 2. basamağının ("already in this codebase? reuse it") tanımı gereği
yakalaması gereken şey. Ponytail açıkken `mind/`e yeni bir ayar eklenirken
kopya önerilirse **basamak çalışmıyor** demektir.

**2. Yorum kalitesi bozuluyor mu?**
Bu repodaki "neden" yorumları belgelenmiş bir varlık. `CLAUDE.md`'ye ev kuralı
yazıldı ama kural yeterli mi, ancak koşarak görülür. Ölçüt: yeni eklenen
dosyalarda karar gerekçesi yorumda duruyor mu, yoksa "kod kendini anlatsın"a mı
kayıyor.

**3. Üretilen kod gerçekten küçülüyor mu?**
Sıradaki dört iş (açık işler güncelleme, senaryoları `giris.ts`'ten çıkarma,
4 kopyayı tekilleştirme, `sema.ts` testleri) ponytail açıkken yapılacak.
Çıkan diff bu zemindeki sayılarla karşılaştırılacak.

## Karar kuralı

**2026-10-01'de** bu üç soru yanıtlanır.

- Soru 1 "hayır" ise → kaldır. Bizim için tek somut gerekçe buydu.
- Soru 2 "evet, bozuluyor" ise → kaldır. Oturum başına 2.000 token ödeyip
  projenin en değerli özelliğini kaybetmek kötü takas.
- Soru 3 ölçülebilir bir küçülme göstermiyorsa ve 1–2 nötrse → kaldır;
  bedava değil.

Kaldırma: `claude plugin uninstall ponytail@ponytail` + `~/.claude/` altındaki
iki bayrak dosyası.

## Gözlemler

- **2026-09-17 — Soru 1, karışık kanıt.** Model seçicide başlangıç beynini
  doğrulamak için seçenek adlarını ikinci bir listeye yazdım (`baslangicBeyni`)
  — yani ponytail açıkken de kopya ÜRETİLDİ. Commit'ten önce fark edilip tek
  kaynaktan türetildi. Basamak kopyayı engellemedi; yakalanmasına yardım etmiş
  olabilir ama bunu ayırt edecek kontrol yok. Tek başına karar vermeye yetmez.
- **2026-09-17 — Soru 2.** Seçici ve pano değişikliklerinde "neden" yorumları
  inceltilmedi; ev kuralı tuttu.

## KARAR — 2026-09-19 (erken, önceden kaydedilmiş test tetiklendi)

Karar tarihi 2026-10-01'di. Erken verildi çünkü karar kuralının **tek başına
yeterli** kolu (Soru 1 "hayır" → kaldır) önceden kaydedilen testiyle birebir
tetiklendi. Kalan 12 gün bu cevabı değiştirecek bir veri üretemez.

### Soru 1 — merdivenin 2. basamağı kopyayı yakalıyor mu? **HAYIR**

Önceden kaydedilen test: *"Ponytail açıkken `mind/`e yeni bir ayar eklenirken
kopya önerilirse basamak çalışmıyor demektir."*

2026-09-19'da `mind/inisiyatif.ts` yazılırken **tam olarak bu oldu**:

```
mind/ajanda.ts:48       a === undefined ? () => v : (typeof a === "function" ? a : () => a);
mind/dikkat.ts:61       ...
mind/hafiza.ts:157      ...
mind/onayKapisi.ts:82   ...
mind/inisiyatif.ts:94   a === undefined ? () => v : typeof a === "function" ? a : () => a;   ← 5. KOPYA, 5fd1018
```

Kopya bilinen, adı konmuş, `ACIK-ISLER`'de listelenmiş bir kopyaydı — ve
ponytail'in SessionStart'ta enjekte ettiği "already in this codebase? reuse
it" kuralı bağlamdaydı. Yine de beşinci kez yazıldı.

İkinci bağımsız kanıt aynı gün: ponytail "bir fonksiyona dokunmadan önce
bütün çağıranlarını grep'le" diyor. `DUNYA_TALIMATI`'yı çağıranlarını aramadan
İngilizceye çevirdim; ölü bir kopyaydı, canlı talimat bir gün Türkçe kaldı
(spec 06 §6.8 düzeltme notu).

17.09'daki karışık gözlemle birlikte: **üç fırsatta üç kaçırma.**

### Soru 2 — yorum kalitesi bozuluyor mu? **HAYIR**

İki günde yazılan her yeni dosya (`mcpBeyin`, `mcpSunucu`, `inisiyatif`,
`hafizaDosyasi`, `hafizaGocu`, `bedenTanimi`, `ledYuz`, `talimat`) karar
gerekçesini, ölçümü ve reddedilen almaşığı yorumda taşıyor. `CLAUDE.md`'deki
ev kuralı tuttu.

### Soru 3 — kod küçülüyor mu? **ÖLÇÜLEMEDİ / ATFEDİLEMEDİ**

"Tembel" görünen seçimler oldu: MCP için SDK yerine ~100 satır, SQLite yerine
atomik JSON, duyu gecikmesi ve IDF'nin yapılmaması. Ama dördü de bu reponun
**kendi** kurallarından da çıkıyor (ölç sonra yap, K6, "tek kullanıcılı
arayüz yok"). Ponytail'e atfedecek bir kontrol yok. Nötr.

### Sonuç: **KALDIR**

Karar kuralı: *"Soru 1 'hayır' ise → kaldır. Bizim için tek somut gerekçe
buydu."* Oturum başına ~2.000 token ödeniyordu; karşılığındaki tek beklenen
kazanç önceden kaydedilmiş testte gerçekleşmedi.

Ders: kopyayı engelleyen şey **talimat değil yapı** oldu — bu iki günde
yakalanan dört kopya kaymasının dördü de (`OZET_ONEKI`, zaman fonksiyonları,
`kanallar.cjs`, talimat) bir **bekçi testiyle** kapandı, bir kuralla değil.
5. kopya için de doğru çare aynı: `ACIK-ISLER` madde 2 (tek yardımcıya indir).
