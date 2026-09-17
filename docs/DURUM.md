# 3dorion — durum raporu

> Tarih: 2026-09-17 · `master` @ `cbcfb3c` (origin'den 3 commit önde)
> Kanıt etiketleri: `[TEST]` birim testli · `[ÖLÇÜLDÜ]` canlı koşuda görüldü ·
> `[YAZILDI-KOŞULMADI]` yazıldı, çalıştırılmadı

## Tek cümle

Oda, terminal, onay kapısı ve iki loblu beyin **çalışıyor**; Orion bakıp
soruyor ve cevabı alıyor ama **cevabı kullanmıyor**, kendi gündemi de yok.
Tezin iskeleti ayakta, ruhu eksik.

## Tez

> **"AI'ın oturduğu oda — terminalini onun masasında açıyorsun."**

| parça | durum | kanıt |
|---|---|---|
| Oda + avatar + 20 Hz dünya | çalışıyor | `[ÖLÇÜLDÜ]` FPS 100, tik 19,5–19,8 Hz |
| Masadaki gerçek terminal (`claude` açılıyor) | çalışıyor | `[ÖLÇÜLDÜ]` |
| Orion terminal hatasını görüp teşhis ediyor | çalışıyor | `[ÖLÇÜLDÜ]` `gti status` → "`git` olmalı" |
| Komut önerisi onay kapısında bekliyor | çalışıyor | `[ÖLÇÜLDÜ]` Orion hiçbir komutu kendisi çalıştırmadı |
| Soruya verilen cevap beyne ulaşıyor (`gordum`) | çalışıyor | `[ÖLÇÜLDÜ]` `dusunme` 1 → 2 (2026-09-17) |
| **Cevabın içeriği kullanılıyor** | **HAYIR** | `[ÖLÇÜLDÜ]` algı "yönetim terminali" dedi, Orion "masa, tahta, pencere" anlattı |
| **Orion'un kendi gündemi / inisiyatifi** | **yok** | Yalnızca tepki veriyor |
| Kalıcı hafıza + zaman algısı | çalışıyor | `[TEST]` + `hafizadene` 13 tur |
| Zihin duvarı: devre panosu (S0–S7) | bitti | `[ÖLÇÜLDÜ]` ayna 10/10, panelden yazma ve teyit canlı |

## Sayılar

| ölçü | değer |
|---|---:|
| Test | **539 / 539 yeşil**, `tsc` temiz, K4 sınırı temiz |
| Kod (test hariç) | 16.078 satır, 116 TS dosyası |
| `world/` kod / test oranı | 0,25 (en zayıf katman) |
| `mind/` · `bridge/` oranı | 0,73 · 0,72 |
| En büyük dosya | `world/giris.ts` 2.312 satır — **%56'sı senaryo** |
| Kumanda paneli katmanı | 2.053 satır |
| Beyin katmanı (`mind/`) | 1.826 satır |

Son satır önemli: Orion'un **kendine bakma aygıtı artık düşünme aygıtından
büyük.** Panel gerekliydi ve istenmişti, ama sıradaki emek teze gitmeli.

## Bilinen kusurlar

**Beyin davranışı**
- Cevap alınıyor, kullanılmıyor (yukarıda).
- PowerShell'de cmd sözdizimi öneriyor (`cd /d`). Onay kapısı tuttu.

**Kod borcu** (2026-09-17 incelemesi)
1. `giris.ts`'te 21 senaryo bloğu, 1.304 satır — üretim dosyasında ve bundle'da.
2. Ayar normalizasyonu 4 dosyada kopyalanmış.
3. `sema.ts` 824 satır, testsiz.

**Görünüm**
- Zoom hapı şema başlığına biniyor (işlevsel etkisi yok).

Ayrıntı: `docs/ACIK-ISLER.md`.

## Yerel modeller — neler var, ne işe yarar

Donanım: **RTX 4060, 8 GB VRAM.** (Ölçüm anında 5,4 GB doluydu.)

| model | boyut | projedeki yeri |
|---|---:|---|
| `qwen2.5:7b` | 4,7 GB | Yerel düşünce beyni (`ollama.ts`). **Ölçümle seçildi:** 8 GB'a sığıp araç çağrısını güvenilir yapan tek aday. |
| `qwen3:4b` | 2,5 GB | Aday, ölçülmedi |
| `functiongemma-270m` | 253 MB | Küçük araç çağıran model — çıkarım organı adayı |
| `nomic-embed-text` | 274 MB | **Gömme modeli.** Hafızanın `ilgiOlcer` kancasına takılabilir; bugün kullanılmıyor |
| Bulut (OpenCode) | — | Asıl düşünce lobu |
| Needle 2 | — | `tools/needle-cikarim.py`: refleks olarak 4/6; asıl yeri çıkarım + gömme olabilir |

### GPT-2 değerlendirmesi (2026-09-17)

| özellik | GPT-2 | etkisi |
|---|---|---|
| Bağlam | **1.024 token, sabit** | Konum gömmeleri öğrenilmiş; genişletilemez |
| Türkçe | Tokenizer İngilizce | **Ölçüldü:** TR 3,07 token/kelime, EN 1,17 → **~2,6× şişme**. 1.024 token ≈ **~330 Türkçe kelime**, istem + cevap toplamı |
| Talimat / sohbet | Yok | Sadece metin devam ettirir |
| Araç çağırma | Yok | Niyet üretemez |
| VRAM | 124M–1,5B, <1–3 GB | Sığar |

**Sonuç: üründe yeri yok.** Her aday rolde elimizde daha iyisi zaten kurulu:

- Düşünce lobu → Türkçe yok, araç yok, bağlam 30 kat küçük.
- Refleks → proje zaten ölçtü: bu kapalı kümede kurallar 0 ms'de kazanıyor.
- Hafıza gömmesi → `nomic-embed-text` kurulu ve bu iş için eğitilmiş;
  GPT-2'nin gizli durumları kötü cümle gömmesi verir.
- Terminalden yapısal çıkarım → talimat izleme gerekir; `functiongemma-270m`
  ya da `qwen3:4b` uygun.

**Tek meşru kullanım: öğrenme.** 124M'lik model, transformer'ın içini görmek
için idealdir — dikkat haritaları, katman katman tahmin ("logit lens"). Zihin
duvarında bir modelin *nasıl düşündüğünü* göstermek istenirse bu bir fikir
havuzu maddesi olabilir; ürün kararı değil.

## Düşünce lobunda model değiştirme

**Olmalı — ve yarısı zaten var.**

Bugün:
- Beyin **yalnızca açılışta** seçiliyor: `ORION_BEYIN`, `ORION_SAGLAYICI`,
  `ORION_MODEL` ortam değişkenleri (`host/main.js`).
- `Beyin` arayüzü (`hazirMi()`, `dusun()`) değiştirmeye hazır; arkasında
  `ollama`, `opencode`, `disBeyin` var.
- Panoda `beyin.model` düğmesi **görünüyor ama yazılamıyor** — sınıfı
  `tehlikeli`, etkisi `yeniden_kurulum`.

Eksik olan tek parça: çalışırken beyin değiştiren bir sarmalayıcı
(`SecilebilirBeyin`). Spec 05 bunu MCP planıyla birlikte ertelemişti.

Tasarımda üç kural şart:
1. **Geçiş tur sınırında olur**, düşünürken asla. Yarım düşünceyi başka beyin
   bitiremez.
2. **Önce sağlık kontrolü.** Yeni beyin `hazirMi()` geçmezse eskisi kalır;
   panelde neden geçilemediği yazar.
3. **İki aşamalı teyit.** OpenCode oturumunun biriken bağlamı geçişte kaybolur;
   kullanıcı bunu teyitte okumalı.

## Sıradaki — önerilen sıra

1. Senaryoları `giris.ts`'ten çıkar.
2. 4 kopya normalizasyonu tekilleştir.
3. `sema.ts` saf yardımcılarını test et.
4. **Teze dön:** cevabın kullanılması, sonra Orion'un kendi gündemi.
5. `SecilebilirBeyin` — model seçimi panelden.

Ponytail denemesi sürüyor; karar tarihi **2026-10-01**
(`docs/olcum-ponytail.md`).
