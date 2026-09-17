# Orion'un Beyni — İki Katmanlı Mimari (Spec v1)

> Karar tarihi: 2026-09-13 · Sahip: Ozyn · Yönetici: Orion (Claude Code)
> Durum: **plan** — ölçümlerle gerekçelendirildi, uygulanmadı.
>
> **Devamı:** `06-beyin-v2.md` (2026-09-17) bu iki katmanlı düzeni korur ve
> altına bellek katmanlarını ekler: çalışma belleği / epizodik hafıza ayrımı,
> zaman-kaynak etiketi, getirme eşiği.

## Neden

Tek yerel model (`qwen2.5:7b`) üç ayrı cephede duvara çarptı ve bu **ölçüldü**:

| Cephe | Ölçüm |
|---|---|
| Gevezelik | "iki cümle" talimatına 3 koşudan 2'sinde uymuyor |
| Hatırlama | 6 canlı koşu, 6'sında da getirilen anıyı kullanamadı |
| Komut önerisi | Önerdiği komut yanlış (`cd ...`, "terminali yeniden başlat") |

Aynı üç senaryo `Ling 3.0 Flash VL (:free)` ile OpenCode üzerinden ölçüldü:

| Senaryo | qwen2.5:7b | Ling 3.0 Flash VL |
|---|---|---|
| Terminal hatası | `cd C:\Users\ozigo\Desktop` (yanlış teşhis) | **"`gti` yazım hatası — `git` olarak yaz"** ✓ |
| Hafızadan hatırlama | 0/6 | **"Terminal süzgeci üstünde çalışıyorsun"** ✓ |
| Selam (iki cümle) | değişken | 2 cümle, sahne yönergesi yok ✓ |
| **Gecikme** | **858 ms** | **3572 ms** (2.1–4.7 sn) |

Sonuç tek cümleyle: **kalite bulutta, hız yerelde.** Bu yüzden tek beyin değil,
iki katman.

## Doğrulanan zemin (varsayım değil, bu makinede ölçüldü)

- `opencode 1.18.30` kurulu; `opencode serve --port 4096` başsız çalışıyor, `/doc` 200 döndü.
- Sağlayıcılar bağlı: `opencode`, `openrouter` (367 model).
- `inclusionai/ling-3.0-flash-vl:free` OpenRouter'da mevcut ve yanıt veriyor (3/3).
- `POST /session/{id}/message` gövdesi şunları kabul ediyor: `model{providerID,modelID}`,
  **`system`** (kendi talimatımız), **`tools`** (araçları tek tek aç/kapat), `agent`.
- **`POST /mcp`** — çalışırken MCP sunucusu kaydedilebiliyor. Orion'un bedenini
  ajana açmanın yolu bu.
- `GET /api/session/{id}/event` — SSE; `/api/session/{id}/permission` — kendi izin akışı var.

## Mimari

```
         algı (20Hz dünya, terminal, konuşma)
                        │
              mind/dikkat + mind/refleks          ← maliyet tavanı (mevcut)
                        │
        ┌───────────────┴───────────────┐
        │                               │
   KATMAN 1: REFLEKS              KATMAN 2: DÜŞÜNCE
   yerel qwen2.5:7b + kural       OpenCode (serve) + seçilen model
   bütçe < 1 sn                   bütçe 2–15 sn
   beden: bak, dön, jest,         sohbet, terminal analizi,
   idle ajanda, anlık onay        komut önerisi, tahta notu,
                                  hafıza yansıması, web arama
        │                               │
        └───────────────┬───────────────┘
                        │
                 niyetiYurut()                     ← TEK yönlendirme (mevcut)
                        │
              avatar / ses / tahta / onay kapısı
```

**İlke: yükseltme, kopyalama değil.** Her algı iki beyne birden gitmez.
Refleks katmanı ya kendisi halleder ya da yükseltir. Yoksa hem maliyet ikiye
katlanır hem de iki beyin çelişen niyet üretir.

**Katman 2 düşünürken beden ölmez:** `mind/ajanda.ts` zaten boşlukta mikro
davranış üretiyor; buna "düşünüyorum" işareti eklenir (bakış, kısa jest).

**Çıktı yolu değişmez:** Katman 2'nin kararı da `niyetiYurut()` üzerinden
geçer. Onay kapısı, tahta yakınlık kuralı, kısaltma — hepsi aynen geçerli.

## Sorumluluk sınırı (ölçütü gecikme)

| İş | Katman | Gerekçe |
|---|---|---|
| Ozyn odaya girdi → dön ve bak | 1 | 3 sn sonra dönen bir bakış gecikmiş bir tepkidir |
| Boşta mikro davranış | 1 | zaten yerel ve determinist |
| Algı süzme (gürültü/hata) | 1 | kural tabanlı, 0 ms, ölçüldü 13/13 |
| Kısa onay ("tamam", "bakıyorum") | 1 | anında olmalı |
| Sohbet, açıklama | 2 | kalite farkı ölçüldü |
| Terminal çıktısını yorumlama | 2 | qwen yanlış teşhis koydu, Ling doğru |
| Komut önerisi | 2 | öneri kalitesi güvenlik meselesi |
| Tahtaya not, plan | 2 | uzun düşünme |
| Hafıza yansıması (reflection) | 2 | pahalı ve seyrek |

## Aşamalar — her biri doğrulama kapılı

**Aşama 0 — Zemin doğrulaması ✓ TAMAM**
`opencode serve` ayakta, `/doc` 200, model yanıt veriyor, ölçüm tablosu yukarıda.

**Aşama 1 — `bridge/opencode.ts`: `Beyin` uygulaması**
- `OpenCodeBeyni implements Beyin` — mevcut arayüz, yeni yol yok.
- Oturum yönetimi: tek kalıcı oturum; `POST /session` bir kez, sonra `message`.
- `system` alanına bizim `talimatUret()` çıktısı gider.
- `tools: {bash:false, edit:false, write:false, ...}` — OpenCode'un kendi
  kodlama araçları KAPALI başlar; Orion'un araçları MCP ile gelir (Aşama 3).
- **Yedek zorunlu:** sunucu yoksa/yanıt vermezse yerel beyne düş. Dünya
  beyinsiz kalmaz (`hazirMi()` zaten arayüzde var).
- Kapı: sonda ile aynı üç senaryo, ≥3/3 yanıt ve ortalama < 8 sn.

**Aşama 2 — `mind/katman.ts`: hangi iş kime**
- Saf karar fonksiyonu: algı türü + içerik → `"refleks" | "dusunce"`.
- Yukarıdaki tablo koda dönüşür, testle kilitlenir.
- Kapı: birim testler + canlı ölçümde beden tepkisi < 1 sn kalmalı.

**Aşama 3 — Dünya MCP sunucusu**
- `mcp/dunya-sunucu.ts`: `dunya_soyle`, `dunya_git`, `dunya_yaz`, `dunya_komut`…
  araçlarını MCP olarak açar.
- 3dorion açılışta `POST /mcp` ile kendini kaydeder.
- Böylece OpenCode ajanı **odada gerçekten hareket eder** ve kendi harness'i
  (oturum, skill, web arama) doğrudan işe yarar.
- Kapı: ajan MCP üzerinden `dunya_soyle` çağırır ve Orion konuşur.

**Aşama 4 — Hafıza birleştirme**
- `mind/hafiza.ts` = **dünya hafızası** (odada ne oldu). Kalır.
- OpenCode oturumu = **sohbet sürekliliği**. Ona bırakılır.
- İkisi çakışmaz: dünya hafızası anıları `system`/mesaj içine enjekte eder.
- Kapı: 13 tur sonra hatırlama senaryosu (`3dorion.bat hafizadene`) geçmeli —
  yerel modelle 0/6 idi.

**Aşama 5 — Ölçüm ve karar**
- `tools/opencode-sonda.mjs` (var) + `3dorion.bat davranis` ile iki katman kıyası.
- Karar sayıyla verilir; "daha iyi hissettiriyor" kabul edilmez.

## Riskler — açıkça

1. **Gizlilik.** Terminal içeriği buluta gider. Ozyn'in ekranında ne varsa
   modele gider. Bu yüzden yükseltme **opsiyonel** ve kapatılabilir olacak;
   yerel katman varsayılan kalabilir. Bu Ozyn'in kararıdır, sessizce açılmaz.
2. **Gecikme.** 3.5 sn beden refleksi için uygun değil — mimarinin tamamı
   zaten bunun üzerine kurulu.
3. **Dış bağımlılık.** `opencode serve` çökerse dünya beyinsiz kalmamalı:
   yerel yedek şart, isteğe bağlı değil.
4. **Ücretsiz katman sınırları.** `:free` modellerde oran sınırı var; sınır
   dolunca yerel katmana düşülmeli, kullanıcı bir JSON hatası dinlememeli.
5. **Güvenlik yüzeyi.** `opencode serve` şifresiz çalışıyor (kendi uyarısını
   bastı). `OPENCODE_SERVER_PASSWORD` ayarlanacak.

## İş bölümü

| Taraf | İş |
|---|---|
| **Orion (ben)** | `bridge/opencode.ts`, `mind/katman.ts`, `mcp/dunya-sunucu.ts`, ölçüm araçları, yedek/düşme mantığı |
| **Ozyn (sen)** | OpenCode tarafı: skill yazımı, model seçimi/limit, agent tanımı, `OPENCODE_SERVER_PASSWORD` |

## Açık sorular (karar bekliyor)

1. Terminal içeriği buluta gitsin mi? (gizlilik — varsayılan: **hayır**, açıkça
   açılana kadar yerel katman yorumlar)
2. Hangi model varsayılan olsun? Ling 3.0 Flash VL ölçüldü; başka adaylar aynı
   sondayla kıyaslanabilir.
3. OpenCode'un kendi araçları (bash, edit) Orion'a açılsın mı? **Önerim: hayır.**
   Orion'un terminale erişimi yalnızca onay kapısından geçen `dunya_komut`
   olmalı; ikinci bir yol açmak onay kapısını anlamsızlaştırır.
