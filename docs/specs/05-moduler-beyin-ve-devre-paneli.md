# Modüler Beyin + Devre Paneli (Spec v1 — PLAN)

> Karar tarihi: 2026-09-16 · Sahip: Ozyn · Yönetici: Orion (Claude Code)
> Durum: **plan** — hiçbir aşama uygulanmadı. Onay bekliyor.

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
