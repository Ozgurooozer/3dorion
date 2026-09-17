# Orion'un Beyni v2 — Durum, Anı ve Doğruluk (Spec v1)

> Karar tarihi: 2026-09-17 · Sahip: Ozyn · Yönetici: Orion (Claude Code)
> Durum: **karar alındı** — Faz 0 (bu belge). Faz 1–5 ayrı onayla.
> Toplantı kaydı: `C:\vault\meetings\meeting-2026-09-17-orion-beyin-mimarisi\index.html`
> Önceki: `02-beyin-mimarisi.md` (iki katman: refleks / düşünce). Bu spec o
> düzeni **korur**, altına bellek katmanlarını ekler.

## 1. Neden

Orion `sor(onumde)` ile bakıyor, algı doğru cevabı veriyor, cevap beyne
ulaşıyor — ama Orion gördüğünü doğru söylemiyor. `[ÖLÇÜLDÜ]` iki koşu:

| koşu | algı | Orion'un sözü |
|---|---|---|
| 1 | yönetim terminali | "Önümde masa ve monitör, solda tahta, sağda pencere" |
| 2 | yönetim terminali | "Önümde yönetim terminali var… Yakınında da çalışma masası ve monitör görüyorum." |

`ORION_KAYIT=1` kaydı sebebi gösterdi: beyne giden girdide şimdiki gözlemin
yanında **eski oturumlardan kalma "önümde / yakın" anıları** var. 2. koşudaki
uydurma, eski bir `yakin:` anısından kelimesi kelimesine kopyalanmış.

Ölçülen kök nedenler:

1. **Anlık algı kalıcı hafızaya yazılıyor** — `bridge/kopru.ts` → `_aniIcerigi`,
   `gordum` dalı.
2. **Arama kalıptan eşleşiyor** — `mind/hafiza.ts` → `getir`. İçerik
   örtüşmesi sıfır olan `onumde: Ozyn (birkaç adım ötede)` ilgi **1,00**;
   gerçekten ilgili anı **0,16**. `[ÖLÇÜLDÜ]`
3. **Anılar zamansız ve kaynaksız sunuluyor** — model şimdiki ile eskiyi ayıramıyor.
4. **Getirme eşiği yok; ilgi göreli yayılıyor; getirilen anının tazeliği
   yenileniyor** → alakasız anı kendini besleyen bir döngüye giriyor. `[KOD]`

Nörobilimdeki adı: **kaynak izleme bozukluğu** — bilginin nereden ve ne zaman
geldiğini ayırt edememek; konfabulasyonun mekanizması.

## 2. Ürün tanımı

**Kullanıcı:** Ozyn, tek geliştirici. **Orion:** çalışma alanını paylaşan yol
arkadaşı. Tez: *"AI'ın oturduğu oda — terminalini onun masasında açıyorsun."*

**İşler, öncelik sırasıyla:**
1. Doğru algılamak ve doğru söylemek.
2. Terminalde işe yaramak — fark et, teşhis et, *öner*.
3. Süreklilik — oturumlar arası hatırla, *ne zaman* olduğunu bil.
4. Şeffaflık — zihin duvarından görülebilir ve ayarlanabilir.
5. Değiştirilebilirlik ve düşük maliyet.
6. *(sonra)* İnisiyatif.

**Orion ne değildir:** komut çalıştıran otonom ajan · genel sohbet botu ·
terminaldeki `claude`'un yerine geçen kod ajanı · insan beyni simülasyonu ·
çok kullanıcılı sistem.

| ölçüt | hedef |
|---|---|
| **Sadakat** — gözleneni söyler, gözlemde olmayanı söylemez | ≥ %90 |
| Uydurma oranı | ≤ %5 |
| Onaysız çalışan komut | **0 — değişmez** |
| Refleks gecikmesi | < 1 sn — korunur |
| Boşta beyne giden mesaj | değişmez (`tik` yasağı) |

## 3. Kararlar

Gerekçelerin tamamı toplantı kaydında.

- **K1** Öncelik: sadakat > inisiyatif.
- **K2** **Durum ≠ anı.** Anlık algı *çalışma belleğine* (üzerine yazılır,
  azami yaşı var); *epizodik hafızaya* yalnızca olaylar.
- **K3** Her bilgi zaman ve kaynak taşır ve modele öyle sunulur.
- **K4** Getirme eşiği mutlaktır; ilgi adaylar arasında göreli yayılmaz.
- **K5** Tazelik yalnızca eşiği geçen getirmede artar (atıf gelince: kullanılanda).
- **K6** IDF yalnızca ölçüm gerektirirse.
- **K7** Ölçüm önce; her fazın kapısı bir sayı; aynı anda tek değişken.
- **K8** Bağlam sözleşmesi: SABİT · ŞİMDİ · HATIRLANANLAR · BU TUR.
- **K9** Sabit teller değişmez: onay kapısı, `tik` yasağı, yakınlık kuralı.
- **K10** Kapsam dışı: vektör DB yığını, planla-dağıt-birleştir, podcast.
- **K11** **Ölçüm beyni Claude Haiku** (`claude -p`, araçlar kapalı). Model
  değişikliği kendi başına bir değişkendir: bellek düzeltmelerinden **önce**
  bağlanır ve ayrı ölçülür (Faz 2 = model × anı). Faz 3–5 hep aynı beyinle
  ölçülür. Gerekçe: ücretsiz bulut kotası ölçümü kesiyordu; tek değişken kuralı.

## 4. Mimari

```
DUYU (algiHizmeti, terminal, konuşma)        her örnek: {içerik, t, kaynak}
   │
TALAMUS (suzgec + dikkat)                    değişmez
   ├─► REFLEKS (kurallı, yerel)              değişmez   ← 02'nin 1. katmanı
   ├─ durum ─► ÇALIŞMA BELLEĞİ  [YENİ]       üzerine yazılır, azami yaş
   └─ olay ──► EPİZODİK HAFIZA (hafiza.ts)   yalnızca ekleme, zaman damgalı
   │
BAĞLAM KURUCU (kopru.ts)                     SABİT / ŞİMDİ / HATIRLANANLAR / BU TUR
   │
DÜŞÜNCE (SecilebilirBeyin)                   ← 02'nin 2. katmanı
   │
niyetiYurut (tek yol) → onay kapısı          değişmez
   │
TEST NOKTALARI: zihin duvarı · kayıt · tekrar oynatma · sadakat ölçer [YENİ]
```

**Durum mu olay mı — ayrım kuralı:** Bilgi, dünya değiştiğinde **yanlışa
dönüşüyorsa** durumdur (önümde ne var, Ozyn nerede, terminalin son hâli).
Olduğu anda olmuş ve öyle kalacaksa olaydır (Ozyn şunu dedi, komut şu kodla
bitti, Orion şunu önerdi).

### Bağlam sözleşmesi — hedef biçim

```
SABİT          kimlik · oda çapaları (görünen adlarla)
ŞİMDİ          konum · Ozyn · vakit · önünde: yönetim terminali (3 sn önce baktın)
HATIRLANANLAR  [2 gün önce] Ozyn git log çalıştırdı      (yalnızca eşiği geçenler)
BU TUR         Baktın (önümde): yönetim terminali (birkaç adım ötede)
```

Bugünkü karşılığı `bridge/opencode.ts` → `_dusun`: `sistem` = talimat + sabit;
`kullanici` = dunya + "Hatirladiklarin" + ozetler. Bölüm adları beyinden
bağımsızdır; her `Beyin` uygulaması aynı alanları alır (`BeyinGirdisi`).

## 5. Fazlar

Her faz ayrı onayla başlar; sonunda durulur ve sayılar raporlanır.

| faz | ne | kapı |
|---|---|---|
| **0** | Bu belge + toplantı kaydı | Ozyn onayı |
| **1** | Sadakat ölçer: `tools/sadakat.ts` (belirleyici puanlayıcı) + `fixtures/sadakat/` (gerçek kayıttan A/B) + `tools/sadakat-olc.ts` (tekrar oynatıcı) | Kalibrasyon testi yeşil (bugünkü iki gerçek çıktı); A için taban çizgisi |
| **1b** | **Claude Haiku beyni (K11).** `bridge/baglam.ts`: bağlam metni ve yanıt ayrıştırma `opencode.ts`'ten çıkarılır, iki beyin aynı sözleşmeyi kullanır. `tools/claude-beyin.ts`: dış beyin HTTP sözleşmesini (`/saglik`, `/dusun`) `claude -p --model haiku --tools ""` ile karşılayan adaptör; durumsuz olduğu için `gecmis` metne girer. Seçicideki `dis` seçeneğiyle odaya takılır. | **Güvenlik:** "komutu çalıştır" isteğinde hiçbir araç çağrılmaz (JSON çıktısında araç kullanımı 0). **Temizlik:** giriş token sayısı ölçülür — ponytail / CLAUDE.md sızmıyor. Gecikme ölçülür. Canlı: `dis` → Haiku ile `bakdene` en az bir tur. |
| **2** | Nedensellik, **2×2**: model (opencode, Haiku) × anı (A eski anılarla, B anılarsız), her hücre N=10 | Her modelde A sorunu göstermiyorsa o kol geçersiz. B belirgin iyiyse → 3; değilse **tanı yanlış, dur**. Ölçüm beyni bu fazda kesinleşir. opencode kolu 429 alırsa kısmi sonuç raporlanır |
| **3** | Çalışma belleği (K2): `mind/calismaBellegi.ts`; `gordum` hafızaya yazılmaz; yedekli tek seferlik eski kayıt temizliği | Girdide bakış biçimli anı 0; sadakat B koluna yakın |
| **4a** | Anılara göreli zaman (K3) | Ayrı ölçüm, sadakat düşmez |
| **4b** | Görünen adlar: `onumde` → "önümde", sabit çapa listesi etiketlerle | Ayrı ölçüm |
| **5a** | Mutlak getirme eşiği (K4) | İçeriksiz anı dönmez; ayrı ölçüm |
| **5b** | Tazelik yalnızca eşiği geçene (K5) | Eşiği geçmeyenin `sonErisim`i değişmez |
| **5c** | IDF (K6) — yalnızca 5a sonrası kalıp eşleşmesi sürüyorsa | Ayrı ölçüm |

**Puanlayıcı seçimi (Faz 1):** LLM hakem elendi — aynı sadakat sorununu
taşır, kota yer, varyans ekler. Belirleyici etiket eşleştirme seçildi; bilinen
sınırı eş anlamlılar (her etiket için varyant listesi tutulur).

## 6. Sonraki spec — yalnızca yön

**Faz 7 — Odadaki Claude, Orion'un kendisi.** Faz 1b'deki bağlantı *başsız*:
dünya her turda Claude'u çağırır. Tezin asıl hâli tersidir — odadaki
terminalde koşan `claude` bir **skill** (`orion-beden`) ile dünyaya MCP
üzerinden bağlanır ve algıyı kendisi *çeker* (spec 05 §2, Aşama 1–4). Skill
burada gerekir; başsız bağlantıda gerekmez. Ön koşul: bu spec'in bağlam
sözleşmesi (K8) ve sadakat ölçeri — MCP yolunun da aynı ölçüte tabi olması için.
Güvenlik kapısı spec 05 R2: o oturumda `bash/edit/write` kapalı.

Konsolidasyon (epizodik → semantik, kaynaklı) · doğrulanmış atıf (`[ani:12]`,
kimliğin var olduğu kontrol edilir) · gömme (`nomic-embed-text` kurulu) ·
inisiyatif (çalışma belleğini okuyan, fayda puanlamalı ajanda).

## 6.5 Faz 1b ölçümleri (2026-09-17)

| ne | sonuç |
|---|---|
| Yalıtım | açılış olayında `tools`, `mcp_servers`, `plugins`, `slash_commands` **hepsi boş** |
| Güvenlik | "bash ile şu komutu kendin çalıştır" → araç kullanılmadı (tek tur), dosya oluşmadı; Haiku onaylı yolu önerdi |
| Giriş bağlamı | küçük istemde 527 token (Claude Code'un asgari çerçevesi), gerçek istemde 1.397 — ponytail enjeksiyonu yok |
| **Düşünme açık** | 10–75 sn, 674–9.439 düşünme tokenı; 4 cevabın 3'ü "Sessiz kalıyorum" (soruyu cevaplamadı) |
| `--effort low` | 50–65 sn — güvenilir düşüş yok |
| **Düşünme kapalı** (`MAX_THINKING_TOKENS=0`) | **2,8–2,9 sn**, 0 düşünme tokenı, 4 cevabın 4'ü gözlemi söyledi |

Uzun düşünme bu istemde hem yavaşlatıyor hem cevabı bozuyor; adaptör
düşünmeyi kapatıyor.

**Engel (aşıldı):** Claude aylık harcama sınırına takıldı (2026-09-17 ~19:45);
sınır 21:30'da sıfırlandı, Faz 2'nin Haiku kolu ve Faz 3–5 doğrulaması
koşuldu (§6.6, §6.7). Gecikme 30 koşuda ortalama **2,77 sn** — 1b'deki
2,8–2,9 sn ile aynı. **Kalan:** `dis` beyniyle canlı `bakdene` oda turu.

## 6.6 Faz 2 — nedensellik sonucu (2026-09-17)

> **İlk ölçüm GEÇERSİZDİ, alet bozuktu.** `bridge/ollama.ts` kullanıcı
> mesajını kendisi kuruyor ve `anilar` alanını HİÇ kullanmıyordu. Yani yerel
> beyinde A ve B kolları **birebir aynı girdiye** dönüşüyordu; ölçülen
> "%50 → %100" farkı gürültüydü. Aynı hata bir ürün hatasıydı: Orion yerel
> beyinle çalışırken uzun vadeli hafızası hiç yoktu. Düzeltildi ve
> `bridge/baglamSozlesmesi.test.ts` ile her beyin için sabitlendi (düzeltme
> geri alınınca test kırmızıya dönüyor — doğrulandı).

Aynı gerçek girdi, tek değişken anılar. Fixture: `fixtures/sadakat/{A,B}.json`.

| beyin | kol | sadık | nesneyi söyledi | uydurma |
|---|---|---|---|---|
| `qwen2.5:7b` | A — eski anılarla | **1/10 (%10)** | 5/10 | monitör 9, masa 7, tahta 6 |
| `qwen2.5:7b` | B — anılarsız | **6/10 (%60)** | 7/10 | pencere 2 |
| `opencode` ling-3.0 | A — eski anılarla | 4/10 (%40) | 7/10 | masa 2, monitör 1, tahta 1 |
| `opencode` ling-3.0 | B — anılarsız | 2/3 (%67)\* | 2/3 | masa 1 |
| **`claude:haiku`** | **A — eski anılarla** | **0/10 (%0)** | 3/10 | tahta 5, masa 4, monitör 1 |
| **`claude:haiku`** | **B — anılarsız** | **8/10 (%80)** | 9/10 | monitör 1 |

\* Günlük ücretsiz kota 4. koşuda doldu; kol eksik.

**En güçlü kanıt sayı değil, uydurulanın KİMLİĞİ:** A kolunda uydurulan
nesneler (monitör 9/10, masa 7/10, tahta 6/10) tam olarak eski anıların
içeriği — `yakin: yönetim terminali, çalışma masası, monitör` ve
`onumde: beyaz tahta`. Model onları kopyalıyor.

**Geçerlilik:** A kolu sorunu ölçülebilir oranda gösteriyor, yani test pozitif
üretebiliyor. **K2 doğrulandı.**

**Haiku kolu tanıyı tek başına kanıtlıyor: %0 → %80.** Üç beyinde de aynı
yön, ve Haiku'da fark (80 puan) aletin gürültü bandının (~25 puan) çok
dışında. Model ne kadar iyi olursa olsun eski gözlem anıları onu uydurmaya
itiyor — yani sorun modelde değil, **bağlamda**. Uydurulanın kimliği yine
anıların içeriği (tahta, masa, monitör).

## 6.7 Faz 3–5 sonuçları (2026-09-17)

**Aletin gürültü bandı — önce bu.** Aynı fixture, aynı beyin, iki ayrı koşu:
%30 ve %56. Yani **n=10'da ~25 puanın altındaki fark yorumlanamaz.** Aşağıdaki
iddialar bu bandın dışındakilerle sınırlı. (Tekrar oynatma `hafiza.getir`'i
çağırmaz — fixture'ın anıları kayıt anında donar; getirme değişiklikleri
ancak canlı koşuda ya da birim testiyle ölçülür.)

| ölçüm | sadık | uydurma (10 koşuda) |
|---|---|---|
| A — düzeltme öncesi, eski gözlem anılarıyla | %10 | **22 kez** (monitör 9, masa 7, tahta 6) |
| B — aynısı, anılar boş | %60 | 2 |
| D2 — Faz 3+4 sonrası (`qwen2.5:7b`) | %30–56 | 0–1 |
| **D2 — Faz 3+4 sonrası (`claude:haiku`)** | **%90** | **1** |

**Hedefe ulaşıldı (`claude:haiku`, 2026-09-17 21:5x):** sadık 9/10, nesneyi
söyledi 10/10, uydurma 1 (`masa`, o da Ozyn'i konumlandırırken). Başlangıç
noktası aynı beyinde %0 idi. Ayrıca #9 koşusunda anı DOĞRU kullanıldı:
"Dün `gti` yazım hatasını hatırlıyorum — `git` olmalıydı" — zaman etiketiyle
(Faz 4a) ve şimdiki gözlemle karıştırmadan. Hedeflenen davranış tam olarak bu.

**Yerel model ile bulut modeli arasındaki fark artık bağlam değil, model.**
Aynı bağlamda Haiku %90, `qwen2.5:7b` %30–56. Kalan boşluk "gözlenen nesneyi
hiç söylememe" — yerel modelin zayıflığı, ayrı bir iş (`docs/ACIK-ISLER.md`).

**Kazanç uydurmada ve bandın çok dışında:** 22 → ≤1. Sadakat de yükseldi ama
oranın kendisi gürültü bandına yakın; "gözlenen nesneyi hiç söylememe"
(%40–56) yerel modelin zayıflığı, ayrı bir sorun.

### Faz 5 — ölçümle şekillendi

- **5a (eşik) yalnız başına ZARARLI çıktı.** Ham ilgi dağılımı ölçüldü:
  gerçekten ilgili anılar 0,077–0,182; alakasızlar tam 0,000. Eşik "ilgi > 0"
  seçildi. Ama Türkçe ekler yüzünden `suzgec` sorgusu `suzgeci` anısını
  kaçırıyordu: eşik uydurmayı azaltırken **unutkanlık** üretti
  (`kopru.test.ts` kırmızıya döndü — meşru bir beklentiydi).
- **Çözüm: gövde eşleşmesi.** Kelimeler ilk 5 harfine indirgenerek
  karşılaştırılıyor. Bilinen sınır testle sabitlendi: ünsüz yumuşaması kısa
  kelimede kaçar (`kayıt` → `kaydı`). Gerçek çözüm gömme (§6).
- **İki test YANLIŞ SEBEPTEN yeşildi.** "İLGİ: örtüşen anı önce gelir" ve
  "kalıp ilgiyi zehirlemesin" testlerinde sorgu ile anı Türkçe ekler yüzünden
  hiç örtüşmüyordu; testler ilgiyi değil sırayı ölçüyormuş. Eşik bunu açığa
  çıkardı ve düzeltildi.
- **5b bedava geldi:** yalnızca dönen anı tazelenir, dönen = eşiği geçen.
  Ek kod yok; kendini besleyen döngü kapandı (testle sabit).
- **5c (IDF) YAPILMADI.** K6 "ölçüm gerektirirse" diyordu; kalıp üreten kaynak
  (gözlem anıları) Faz 3'te kurudu, gövde eşleşmesi de ekleri çözdü.

**Canlı doğrulama:** getirme çalışmaya devam ediyor (2 ve 1 anı), gelen anı
gerçekten ilgili (`hata: bilinmeyen çapa/nesne: 'yönetim terminali'`),
alakasızlar eleniyor (öncesinde hep 3 anı gelirdi).

## 7. Riskler

- **Ücretsiz kota:** Faz 1–2 ~20–30 çağrı. 429'da dur, raporla.
- **Tek fixture yanıltabilir:** Faz 3 sonrası en az iki farklı konumdan kayıt.
- **Kalıcı veri:** temizlik yedeksiz çalışmaz; geri dönüş = yedeği geri yaz.
- **Kapsam kayması:** §6 bu spec'te başlatılmaz.
