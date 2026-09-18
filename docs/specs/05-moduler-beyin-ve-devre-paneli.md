# Modüler Beyin + Devre Paneli (Spec v1 — PLAN)

> Karar tarihi: 2026-09-16 · Sahip: Ozyn · Yönetici: Orion (Claude Code)
> Durum: **panel tarafı S0–S7 uygulandı** (2026-09-17). **MCP/skill tarafı
> Aşama 1–4 uygulandı ve canlı kapılardan geçti** (2026-09-19, §8). Aşama 7
> (ikinci ajan + karşılaştırma) açık.

## 0. Uygulanan: devre panosu (S0–S7)

| # | Ne | Durum | Kanıt |
|---|---|---|---|
| S0 | Onay kapısı son tarihi öneri anında DONDURULUR; `elleDusur()` | bitti | `[TEST]` `mind/onayKapisi.test.ts` |
| S1 | `semaAlani`/`semaYerlesimi`/`dugumBul` saf çekirdeğe | bitti | `[TEST]` piksel-eşdeğerlik testi |
| S2 | Kamera zoom (üstte ±, tekerlek) | bitti | `[ÖLÇÜLDÜ]` ekran görüntüsü |
| S3 | Tıkla → düğüm seç → salt okunur detay | bitti | `[ÖLÇÜLDÜ]` `zihindene`: AYNA 10/10, ters çift 0 |
| S4 | `protocol/pano.ts` + `mind/tanim/` + sınıf rozetleri | bitti | `[TEST]` 6 modül / 26 tel; `sabit` teller görünür ve yazıcısız |
| S5 | `guvenli` yazma (tel yoluyla) | bitti | `[ÖLÇÜLDÜ]` 6 aynı algı: `tekrar=4000ms` → 2 geçti/4 düştü; `0ms` → 6 geçti/0 düştü |
| S6 | `tehlikeli` + iki aşamalı teyit + bağlı eylemler | bitti | `[TEST]` bekleyen öneri özgün son tarihine kadar yaşar, izde tek `dustu` |
| S7 | `olculmus` kilidi + kalıcı "ÖLÇÜM DIŞI" damgası | bitti | `[TEST]` gerekçesiz açılmaz; kilit kapansa da damga silinmez |

Toplam: **539 test yeşil**, `tsc --noEmit` temiz, K4 grep kapısı boş.

Uygulama sırasında değişen üç karar:

1. **`Tel<T>`** — plandaki "düğme = tel" fikri, aynı anda hem okuyucu hem
   yazma noktası olan tek bir nesneye dönüştü. Modülle panonun ayrışması
   böylece yapısal olarak imkânsız; bir sözleşme değil, bir tip.
2. **Vuruş bölgeleri ÇİZİMDEN kaydediliyor**, bağımsız hesaplanmıyor.
   Açıklama cümlesinin kaç satır sardığı `measureText`e bağlı olduğu için
   ayrı bir hesap kaçınılmaz olarak kayardı.
3. **Ölçüm kilidi panelden AÇILMIYOR.** Gerekçe zorunlu, gerekçe yazmak
   klavye istiyor, odadaki panelin klavyesi yok. Panele "aç" düğmesi koyup
   gerekçeyi uydurmak kilidin tek işlevini — sürtünmeyi — yok ederdi.
   Açma yolu yönetim terminalinden (`orionPano.kilitAc("...")`) geçiyor.

Kalan bilinen kusur: zoom hapı (%100) panel başlığının üst şeridiyle
görsel olarak çakışıyor. İşlevsel etkisi yok.

## 1. İki iş, tek iş

İki ayrı istek gibi duruyordu:

1. Beyin modüler olsun; Claude, OpenCode ya da herhangi bir terminal ajanı
   kolayca bağlansın. Her biri için ince bir skill yazalım.
2. Zihin akışı paneli tıklanabilir olsun; kutuya girip ayar değiştirelim,
   katman ekleyelim, DÜŞÜNCE'nin içine girip terminali/modeli değiştirelim.
   **"Tamamen elektrik devresi gibi düşün."**

Bunlar ayrı değil: **(2), (1)'in arayüzü.** DÜŞÜNCE kutusuna tıklayıp modeli
değiştirmek, ancak beyin gerçekten takılıp çıkarılabilir olduğunda anlam
taşır. Panel, mimarinin *resmi* olmaktan çıkıp *kumandası* olacak.

Bu yüzden tek plan.

## 2. Mimari karar: kontrol yönü tersine döner

Bugün **dünya itiyor**: algı → `Kopru` → `Beyin.dusun()` → niyet. HTTP servisi
için doğru (`disBeyin` böyle çalışıyor).

Ama **terminal ajanı sunucu değil.** Claude Code, OpenCode, Aider — hepsi
istek/yanıt. Onları "dünya itsin" kalıbına sokmak zorlama olur.

Öneri: ajan **çeker**.

```
ajan → dunya_bekle(25)      MCP; bir şey olana kadar (en fazla 25 sn) bekler
     ← { tur:"terminal", ozet:"komut HATA ile bitti…", anilar:[…] }
ajan → dunya_soyle("`gti` yazım hatası, `git` olmalı")
ajan → dunya_komut("git status", "yazım hatası düzeltmesi")   → ONAY KAPISI
ajan → dunya_bekle(25)      döngü
```

Üç kazanç:

- Ajanın **kendi tool-calling'i** çalışır → satır sözleşmesi (`KOMUT:`/`BAK:`)
  hilesine gerek kalmaz. O sözleşme zaten ara çözüm olarak yazılmıştı.
- Ajanın **kendi bağlamı birikir** → sohbet sürekliliği bedava gelir.
- **Tek MCP sunucusu bütün ajanlara hizmet eder.** Modülerlik burada.

Yan kazanç: odadaki terminalde koşan `claude`, gerçekten Orion'un kendisi
olur — projenin ilk cümlesi.

## 3. Riskler → MEKANİZMA (söz değil, kod)

Her risk için "dikkat ederiz" değil, **kodda karşılığı olan bir mekanizma**.

| # | Risk | Mekanizma | Kapı (nasıl kanıtlanır) |
|---|---|---|---|
| R1 | Ajan döngüsü tükenir/durur → Orion susar | MCP sunucusu son temas anını tutar. N sn temassızlık → dünya **otomatik olarak yerel beyne düşer** (sağ lob). Zihin duvarı hangi beynin sürdüğünü gösterir. | Ajanı öldür; Orion terminal hatasına yerel refleksle tepki vermeye devam etmeli, panelde "yerel" yazmalı |
| **R2** | **Ajanın KENDİ araçları onay kapısını bypass eder** | Orion'un ajanı `bash/edit/write` KAPALI koşar. Bu bir skill talimatı DEĞİL — skill güvenlik sınırı değildir — **izin ayarı** olacak. | Orion'un oturumunda `bash` çağrısı denenir ve **reddedilmeli**; `dunya_komut` ise onay kapısına düşmeli |
| R3 | İki beyin aynı anda niyet üretir, çakışır | Tek sahiplik: bir anda yalnız bir beyin dünyayı sürer. Geçiş açık bir işlem. Panelde görünür. | Bu sınıf hata daha önce yaşandı (ajanda vs beyin, senaryo kipi). Aynı düzenekle sınanır: rakip niyet üretilir, senaryonun `git`i kesilmemeli |
| R4 | Boşta dönen döngü token yakar | `dunya_bekle` sessizlikte **ucuz** döner (boş yük). Boşta maliyet ÖLÇÜLÜR. | Bir saat boşta koş, token/saat raporla. Varsayım değil sayı |
| R5 | MCP blocking tool timeout | Bekleme sınırlı (~25 sn), "sessiz" döner, ajan döngüye devam eder | 30 dk kesintisiz koşu, timeout hatası olmamalı |
| **R6** | **Panel düzenlenebilir olunca dünya bozulabilir** | Devrede **sabit teller** ve **ayarlanabilir düğmeler** ayrılır (§4). Sabitler panelden değiştirilemez. | `tik` yasağı ve onay kapısı panelden kapatılamamalı — test bunu zorlar |
| R7 | Ajan yanlış/uydurma araç çağırır | Mevcut `protocol/dogrula.ts` aynen devrede; ret gerekçesi ajana geri döner | Var olan davranış; MCP yolunda da korunduğu sınanır |

R2 ve R6 **koyu**, çünkü ikisi de projenin güvenlik omurgasına dokunuyor.
Onay kapısı bu projenin merkezi vaadi: *Orion hiçbir koşulda komut
çalıştırmaz, çalıştıran şey Ozyn'in tuşudur.* Orion'a bash'li bir Claude Code
vermek bu vaadi sessizce iptal eder. Bu yüzden R2 bir "risk notu" değil,
**geçilmesi zorunlu kapı**.

## 4. Devrenin sabit telleri vs ayarlanabilir düğmeleri

"Elektrik devresi" benzetmesi doğru ama devrenin her teli sökülebilir değil.

**SABİT (panelden değiştirilemez, testle kilitli):**
- `tik` algısı beyin kanalına **asla** giremez (maliyet tavanı, `protokol.test.ts`)
- `dunya_komut` **her zaman** onay kapısından geçer
- Tahtaya uzaktan yazılamaz (yakınlık kuralı)
- `world/` → `bridge/`/`mind/` bağımlılığı yasak (K4)

**AYARLANABİLİR (panelden, canlı):**
- Dikkat bütçesi ve kısma pencereleri
- Hafıza getirme sayısı, kapasite
- Refleks eşikleri
- **DÜŞÜNCE: hangi beyin** (Claude / OpenCode / Python / yerel / kapalı)
- Sağ lob açık/kapalı
- Ajanda (boşta davranış) açık/kapalı

Panel bu ikisini **görsel olarak ayırmalı**: sabit teller çizili ama
tıklanamaz; düğmeler tıklanabilir. Kullanıcı neyin oynanabilir olduğunu
denemeden anlamalı.

## 5. Aşamalar

Her aşamanın **ölçülebilir kapısı** var. Kapı geçilmeden sonrakine geçilmez.

### Aşama 1 — Dünya MCP sunucusu
`mcp/dunya-sunucu.ts`, Electron ana sürecinde.
- Araçlar `protocol/niyet.ts`'ten **üretilir** — ikinci bir liste yok
- `dunya_bekle(azamiSn)` eklenir: sınırlı bekleme, "sessiz" dönebilir
- Çağrılar mevcut `dogrula` + `niyetiYurut` yolundan geçer (onay kapısı, yakınlık)
- **Kapı:** `claude` bağlanır, `dunya_soyle("merhaba")` çağırır, Orion odada konuşur

### Aşama 2 — `mind/` katmanı korunur
`dunya_bekle`, `Kopru`'nun süzdüğünü döndürür: dikkat + refleks süzgeci + anılar.
- **Kapı:** `tik` ajana hiç ulaşmıyor (ölçümle); onay kapısı komutu yine tutuyor

### Aşama 3 — Claude skill'i
`.claude/skills/orion-beden/SKILL.md` — kimlik + döngü + kurallar.
İçerik sıfırdan yazılmaz: `bridge/talimat.ts` zaten ölçümle oturmuş.
- **R2 KAPISI:** Orion'un oturumunda `bash` reddedilmeli
- **Kapı:** Skill yüklü, prompt yazılmadan Orion terminal hatasına tepki veriyor

### Aşama 4 — Düşme ve sahiplik (R1 + R3)
Temas takibi, otomatik yerel beyne düşme, tek sahiplik, panelde görünürlük.
- **Kapı:** ajan öldürülür → Orion yerel refleksle çalışmaya devam eder

### Aşama 5 — Panel tıklanabilir (salt okunur detay)
Kutuya tıkla → o düğümün detayı: ne yapar, sayıları, mevcut ayarı.
Henüz **değiştirilemez**. Önce görmek, sonra dokunmak.
- **Kapı:** DÜŞÜNCE'ye tıkla, hangi model/ajan koştuğu ve gecikmesi görünsün

### Aşama 6 — Düğmeler canlı
§4'teki ayarlanabilirler panelden değişir. Sabitler tıklanamaz görünür.
- **Kapı:** Panelden beyin değiştir (Claude → Python), dünya yeniden
  başlamadan yeni beyinle çalışsın. Sabitler değiştirilemediği testle kanıtlansın

### Aşama 7 — İkinci ajan + ölçüm
OpenCode için ince skill. Aynı senaryolar iki ajanda: gecikme, doğruluk, maliyet.
- **Kapı:** Karar **sayıyla** verilir; "daha iyi hissettiriyor" kabul edilmez

## 6. Katman eklemek (Aşama 8+, henüz plan değil)

"Katman ekleyebileceğiz" isteği en derin değişiklik: işlem hattının
**veriyle tanımlı** olması gerekir (bugün kodda sabit). Bunu şimdi planlamıyorum
çünkü 1-7 bitmeden doğru soruyu soramayız: hangi katmanlar gerçekten
eklenmek istendi? Somut bir ihtiyaç çıkınca tasarlanır.

Erken genelleştirme bu projede iki kez zarar verdi (spekülatif soyutlama),
bu yüzden kasıtlı olarak ertelendi.

## 7. Ne YAPILMAYACAK

- **Mevcut yollar silinmiyor.** `opencode.ts`, `disBeyin.ts`, `ollama.ts`
  kalıyor. Modülerlik, tek yol dayatmamak demek.
- **Satır sözleşmesi silinmiyor** — MCP'siz ajanlar için gerekli kalır.
- **Panel süs eklemiyor.** Her görsel öğe bir bilgi taşımalı.

## 8. Aşama 1–4 sonuçları (2026-09-19)

### Tasarım kararı — MCP ajanı bir `Beyin` olur

`bridge/mcpBeyin.ts`: köprü `dusun(girdi)` çağırır → ajan `dunya_bekle` ile
çeker → `dunya_*` araçları **çalıştırılmaz, toplanır** → ajanın bir sonraki
`dunya_bekle`si turu kapatır → çağrılar `dusun()`'un cevabı olarak köprüye
döner ve diğer beyinlerinkiyle **aynı yoldan** işlenir.

Aşama 2'nin iki şartı ("çağrılar mevcut `dogrula` + `niyetiYurut` yolundan
geçer", "`mind/` korunur") böylece sözden değil **yapıdan** gelir: bağlam
sözleşmesi (K8), `dogrula`, onay kapısı, zincir bütçesi, susma kapısı ve
`tik` yasağı MCP yolunda da işler — atlanacak bir yan yol yok. Tur DIŞINDA
araç çağrısı reddedilir (R7).

**Taşıma:** `host/mcpSunucu.js` — Streamable HTTP, durumsuz, yalnız JSON;
SDK yok (4 yöntem, ~100 satır). Dünya renderer'da yaşadığı için (spec 07 K2)
`tools/*` IPC ile röle edilir. Yalnızca `127.0.0.1`; localhost olmayan
`Origin` 403 (DNS rebinding).

### Kapılar

| kapı | sonuç |
|---|---|
| **R2 — ajanda Bash yok** | açılış olayında **15 araç, hepsi `mcp__orion__*`**; Bash/Edit/Write yok. İzin ayarı (`--tools ""`, `--strict-mcp-config`, `--setting-sources ""`), skill talimatı değil `[ÖLÇÜLDÜ]` |
| **Aşama 1** — bağlanır, konuşur | `orion=connected`; ajan `dunya_soyle` ile konuştu `[ÖLÇÜLDÜ]` |
| **Aşama 2** — `tik` ulaşmaz, onay tutar | köprüyle birlikte test: `tik` ajana ulaşmıyor; `dunya_komut` yalnızca `komut` NİYETİ olur `[TEST]` |
| **Aşama 3** — promptsuz terminal tepkisi | `tezdene` **GEÇTİ**: `gti status` → ajan `dunya_komut("git status")` → onay kapısı: önerilen 1, onaylanan 1 — komut ANCAK onaydan sonra çalıştı `[ÖLÇÜLDÜ]` |
| **Aşama 4 / R1** — ajan ölürse | ajan `dunya_bekle` ASKIDAYKEN öldürüldü → `[mcp] ajan bağlantısı koptu → temas kesildi` → sağ lob `git` önerdi, onaysız çalışmadı: `saglobdene` 2/2 `[ÖLÇÜLDÜ]` |
| **R3** — tek sahiplik | `SecilebilirBeyin` zaten tek aktif beyin tutuyor; `mcp` bir seçenek |

Birim testleri: `bridge/mcpBeyin.test.ts` 19, `host/mcpSunucu.test.ts` 10 —
hepsi mutasyonla kırmızıya dönebildiği kanıtlandı.

### Canlıda bulunan dört sorun — spec'in üç varsayımı ölçümle yanlış çıktı

**1. R5 varsayımı yanlış: ajan "sessiz" alınca döngüye devam ETMİYOR.**
Spec: "bekleme ~25 sn, sessiz döner, ajan döngüye devam eder." Ölçüm: Haiku
25 sn "quiet" alınca oturumu bitirdi (`tur=2`), skill "asla bırakma" demesine
rağmen. Bu tam olarak R1. Talimat güvence değil; iki yapısal karşılık:
- **Denetleyici döngü** (`tools/orion-ajan.ts`): oturum biterse yeniden başlar.
- **Uzun bekleme:** 25 → 60–120 sn. Her "quiet" bir model turu; ölçülen
  oturum başlangıcı **$0,025** → 25 sn'lik beklemeyle boşta saatte ~$3,4 (R4).

**2. Süreye dayalı temas uzun beklemeyle çelişiyor.** 120 sn bekleyen canlı
ajan 60 sn'de "ölü" sanılacaktı; tersine, ölen ajanın açık HTTP isteği onu
"canlı" gösterecekti. **Temas = açık bağlantı:** bekleyen `dunya_bekle` canlı
ajandır; HTTP kopması → iptal sinyali → temas HEMEN kesilir. İptal
**etiketli**: hızlı yeniden başlatmada eski bağlantının kopma sinyali yeni
ajanın beklemesini öldürmesin.

**3. Yeni oturum talimatsız başlayacaktı.** Talimat yalnızca temas koparsa
yeniden gidiyordu; denetleyicinin hızlı yeniden başlatması kuralsız bir Orion
açardı. MCP `initialize` artık oturum başlangıcını bildiriyor.

**4. Satır sözleşmesi ajanı araç çağırmaktan alıkoydu.** Ajan durumu aldı ve
hiç araç çağırmadan metinle bitirdi. Sebep: bağlam, araçsız modeller için
yazılmış "cümleyle yaz, eylemi `KOMUT:` satırıyla belirt" sözleşmesini
taşıyordu. Spec'in MCP'yi seçme sebebi tam da bu hileden kurtulmaktı.
`baglamMetni(…, { satirSozlesmesi: false })` — sözleşme kalkınca ajan gerçek
araç çağırdı ve döngüyü tek oturumda sürdürdü.

### Kullanım

```
npm start                                  # dünya; MCP ucu :4800 (ORION_MCP=0 kapatır)
node --experimental-strip-types tools/orion-ajan.ts [--model=haiku]
# zihin duvarında beyin seçici → "mcp"
```

Skill: `.claude/skills/orion-beden/SKILL.md` — yalnızca döngü ve sınırlar;
asıl talimat `dunya_bekle`'nin ilk cevabıyla gelir (talimat kopyalanmaz).
