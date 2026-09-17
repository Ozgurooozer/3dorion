# Open Notebook — mimari incelemesi ve Orion için fikirler

> Tarih: 2026-09-17 · İncelenen: [lfnovo/open-notebook](https://github.com/lfnovo/open-notebook)
> @ `3127f14` (2026-09-13) · Yerel kopya: `C:\Users\ozigo\open-notebook`
>
> **Kurulmadı, çalıştırılmadı.** Kod ve belgeler okundu. Amaç aracı projeye
> bağlamak değil, fikirlerini almak.
>
> Kanıt etiketleri: `[KOD]` kaynak dosyada görüldü · `[BELGE]` yalnızca
> belgede yazıyor, kodda doğrulanmadı · `[ÖLÇÜLDÜ]` bizim tarafımızda ölçüldü

## Ne bu?

Google NotebookLM'in kendi makinende çalışan açık kaynak karşılığı. Belge
yüklüyorsun (PDF, web sayfası, metin, ses, video), soru soruyorsun, cevaplar
kaynağa atıfla geliyor. Ayrıca özet çıkarma, not tutma ve çok konuşmacılı
podcast üretiyor.

**Kendini nasıl tanımlıyor** (`VISION.md`): araştırma asistanı. Belge
editörü, dosya deposu ya da genel sohbet botu **değil**. Kişisel veriyi
kullanıcıda tutmak, herhangi bir yapay zekâ sağlayıcısıyla çalışmak ve her
yeteneği REST API üzerinden açmak temel ilkeleri.

**Teknik yığın** `[KOD]`: Next.js arayüz (3000) → FastAPI (5055) → SurrealDB
(8000) + arka plan işçisi (surreal-commands). İş akışları LangGraph ile, model
çağrıları Esperanto kütüphanesiyle.

---

## Üç kategori

Özellikleri bilginin izlediği yola göre ayırdım: **içeri nasıl giriyor → nasıl
saklanıp bulunuyor → nasıl kullanılıp gösteriliyor.** Orion'un sorunu tam da
bu yolun ortasında (hafıza ve erişim) çıktığı için bu ayrım işe yarıyor.

Her satırda sonuncu sütun **Orion için fikir değeri**:
**Y** yüksek · **O** orta · **D** düşük · **—** yok.

---

### KATEGORİ 1 — ALIM ve İŞLEME
*Dış dünyadan gelen içerik nasıl kullanılabilir bilgiye dönüşüyor.*

| # | Özellik | Nasıl çalışıyor | Kaynak | Orion |
|---|---|---|---|---|
| 1.1 | **Çok biçimli kaynak alımı** | PDF, URL, düz metin, ses, video, YouTube dökümü. İçerik çıkarma `content-core` kütüphanesine devredilmiş. | `graphs/source.py` `[KOD]` | — |
| 1.2 | **İçerik türüne göre parçalama** | Metin; HTML, Markdown ya da düz metin oluşuna göre farklı bölücüyle parçalanıyor. Varsayılan 400 token, %15 örtüşme, 5 token altı atılıyor. Üçü de ortam değişkeniyle ayarlanabilir. | `utils/chunking.py` `[KOD]` | D |
| 1.3 | **Gömme üretimi** | Her parça için vektör. Sağlayıcıdan bağımsız: yerel (Ollama) ya da bulut. | `utils/embedding.py`, `commands/embedding_commands.py` `[KOD]` | **O** |
| 1.4 | **Dönüşümler → "içgörü"** | Kaynağa bir istem şablonu uygulanıyor (özet, ana noktalar, alıntılar, soru-cevap). Çıktı **ayrı bir kayıt** olarak saklanıyor (`source_insight`), türü ve hangi kaynaktan türediği belli. | `graphs/transformation.py`, `prompts/transformation/` `[KOD]` | **Y** |
| 1.5 | **Arka plan iş kuyruğu** | Uzun işler (gömme, işleme, podcast) kuyruğa atılıyor, arayüz beklemeden dönüyor, durum sonradan sorgulanıyor. İşçi çalışmıyorsa işler *sessizce sonsuza kadar bekliyor* — kendi belgeleri bunu uyarı olarak yazmış. | `commands/`, ADR-004 `[KOD]` | D |
| 1.6 | **Konu çıkarma** | Kaynak işlenirken LLM ile başlıklar/konular üretiliyor. | `graphs/source.py` `[BELGE]` | D |

**1.4 neden yüksek:** Open Notebook **ham kaynak** ile **ondan türetilmiş
bilgiyi** ayrı tablolarda tutuyor ve aradaki bağı koruyor. Orion'un bugünkü
hatası bu ayrımın yokluğundan doğdu: "önümde şu var" (o ana ait, türetilmiş,
geçici) ile "Ozyn şunu söyledi" (kalıcı olay) aynı hafıza listesinde aynı
biçimde duruyor.

---

### KATEGORİ 2 — HAFIZA ve ERİŞİM
*Bilgi nasıl saklanıyor ve doğru parçası nasıl bulunuyor.*

| # | Özellik | Nasıl çalışıyor | Kaynak | Orion |
|---|---|---|---|---|
| 2.1 | **Grafik veri modeli** | Defter ← kaynak (`reference` kenarı), defter ← not (`artifact` kenarı), kaynak → parçalar, kaynak → içgörüler. Tek veritabanında hem grafik hem vektör. | `migrations/`, `architecture.md` `[KOD]` | D |
| 2.2 | **BM25 tam metin arama** | Başlık, tam metin, parça, içgörü ve notlarda BM25 indeksi. **Her belgede geçen kelimenin ağırlığı otomatik düşüyor (IDF).** | `migrations/1.surrealql` `[KOD]` | **Y** |
| 2.3 | **Vektör arama + asgari puan eşiği** | `fn::vector_search(..., $minimum_score, ...)` — eşiğin altındaki sonuç **hiç dönmüyor**. | `domain/notebook.py:884` `[KOD]` | **Y** |
| 2.4 | **Metin ve vektör araması AYRI** | İkisi karma değil, arama türü parametreyle seçiliyor. (Karma arama `woodysc8/OpenNotebookLM`'de var.) | `api/routers/search.py` `[KOD]` | bilgi |
| 2.5 | **Defter kapsamı** | Arama bir ya da birden çok deftere sınırlanabiliyor. Filtre veritabanı fonksiyonunun **içinde** uygulanıyor. Sonradan Python'da süzmek, `LIMIT` önce uygulandığı için sonuçları aç bırakırdı; bu yüzden reddedilmiş. Hatalı kimlik → 404, **asla "sonuç yok" gibi görünmüyor.** | ADR-008 `[KOD]` | **O** |
| 2.6 | **Kaynak başına bağlam seviyesi** | Her kaynak için kullanıcı seçiyor: *bağlamda değil* / *yalnızca içgörüler* / *tam içerik*. "Bağlamda değil" = yapay zekâ onu **aramaz bile**. | `utils/context_builder.py`, `ai-context-rag.md` `[KOD]` | **O** |
| 2.7 | **Token bütçesine göre kırpma, açık bildirimle** | Bütçe aşılırsa kaynak kırpılıyor ve sonuna `[Source content truncated to fit the context token budget.]` ekleniyor. İçgörülere bütçenin %20'si ayrılmış. | `context_builder.py` `[KOD]` | **O** |
| 2.8 | **Kök bulucu yalnızca İngilizce** | `snowball(english)`. Türkçe metinde kelime kökleri eşleşmez. | `migrations/1.surrealql` `[KOD]` | uyarı |
| 2.9 | **Otomatik şema göçü** | API açılırken numaralı göçler çalışıyor, geri alma dosyaları elle. | `database/migrate.py`, ADR-006 `[KOD]` | D |

#### Kategori 2 ile Orion'un hafızası yan yana

Bu bölüm bugünkü hatanın tam karşılığı. `mind/hafiza.ts` → `getir()` `[KOD]`:

| soru | Open Notebook | Orion bugün | Sonuç |
|---|---|---|---|
| Alakasız sonuç döner mi? | Eşiğin altı **dönmez** (2.3) | **Eşik yok.** Her zaman en iyi N döner | İçerik örtüşmesi 0 olan anı ilk üçe girebiliyor `[ÖLÇÜLDÜ]` |
| Her yerde geçen kelime? | BM25 ağırlığını **düşürür** (2.2) | Düz kelime örtüşmesi | `onumde`, `birkaç adım ötede` kalıbı eşleşmeyi domine ediyor `[ÖLÇÜLDÜ]` |
| Puan mutlak mı göreli mi? | BM25 / benzerlik mutlak | İlgi adaylar arasında **0–1'e yayılıyor** | En iyi aday, aslında zayıf olsa bile **1,00** alıyor `[ÖLÇÜLDÜ]` |
| Geçici bilgi? | Ham kaynak ile türetilmiş bilgi ayrı (1.4) | Anlık algı kalıcı anı olarak yazılıyor | Eski "önümde" bilgisi bugün geri geliyor `[ÖLÇÜLDÜ]` |
| Getirmek puanı değiştiriyor mu? | Hayır | **Evet**, getirilen anının tazeliği yenileniyor | **Kendini besleyen döngü:** alakasız anı bir kez gelirse sonraki turda daha taze olur ve yine gelir `[KOD]` |

Son satır yeni bir bulgu. Generative Agents makalesinin "son erişim"
tanımından geliyor ve doğru çalışan bir aramada zararsız. Ama arama alakasız
sonuç döndürdüğünde **hatayı kalıcılaştırıyor.**

---

### KATEGORİ 3 — AKIL ve SUNUM
*Bilgi nasıl kullanılıyor, cevaba dönüşüyor ve kullanıcıya gösteriliyor.*

| # | Özellik | Nasıl çalışıyor | Kaynak | Orion |
|---|---|---|---|---|
| 3.1 | **Sohbet akışı** | Mesaj → bağlam kur → sistem + geçmiş + bağlam → model → akış hâlinde cevap → oturuma kaydet. Geçmiş veritabanında. | `graphs/chat.py` `[KOD]` | D |
| 3.2 | **"Sor" akışı: planla → dağıt → birleştir** | Model önce arama stratejisi üretiyor. Her arama **ayrı ayrı** yürütülüyor (10 sonuç). Her biri **yalnızca kendi sonuçlarından** cevaplanıyor. En sonda bir model hepsini birleştiriyor. Boş cevaplar birleştirmeye girmiyor. | `graphs/ask.py` `[KOD]` | **O** |
| 3.3 | **Kaynağa atıf** | Bağlamdaki her öğenin **tipli kimliği** var (`source:…`, `note:…`, `insight:…`). Modelden her iddiayı `[kimlik]` ile işaretlemesi isteniyor. Arayüz kimlikleri ayrıştırıp tıklanabilir bağlantıya çeviriyor. | `prompts/chat/system.jinja`, `frontend/.../source-references.tsx` `[KOD]` | **Y** |
| 3.4 | ⚠ **Atıflar DOĞRULANMIYOR** | Arayüz kimliği regex ile yakalıyor ama o kayıt gerçekten var mı, kontrol **yok**. Kendi karar kayıtları "doğrulanmış atıf"ı Ekim 2026'ya kadar tartışılacak gelecek bir tasarım olarak yazıyor. Yani uydurma kimliğe karşı tek savunma istemdeki "uydurma" cümlesi. | ADR-008, `source-references.tsx` `[KOD]` | **ders** |
| 3.5 | **Sağlayıcıdan bağımsız model yöneticisi** | 17+ sağlayıcı. Bağlam boyutuna göre model seçimi. **İstek başına model değiştirme.** | `ai/`, `architecture.md` `[KOD]` | yapıldı |
| 3.6 | **İstem şablonları (Jinja2)** | Her akışın istemi ayrı şablon dosyasında; kod değil veri. | `prompts/` `[KOD]` | D |
| 3.7 | **Düşünme içeriğini temizleme** | Modelin "düşünme" bölümü cevaptan ayıklanıyor. Geriye boş kalırsa o cevap atılıyor. | `ask.py` → `clean_thinking_content` `[KOD]` | **O** |
| 3.8 | **Çok konuşmacılı podcast** | 1–4 konuşmacı, konuşmacı ve bölüm profilleri, metinden ses. | `podcasts/`, `podcast_service.py` `[KOD]` | D |
| 3.9 | **Önce API** | Arayüzün yapabildiği her şey REST ile de yapılabiliyor. Arayüz yalnızca bir istemci. | ADR-003, `VISION.md` `[KOD]` | O |
| 3.10 | **Akış hâlinde cevap** | Strateji → ara cevaplar → son cevap, aşama aşama kullanıcıya iletiliyor. | `ask.py` `[KOD]` | D |

**3.4 neden önemli:** Atıf fikrini alırsak doğrulamasını da **baştan**
yapmalıyız. İstemde "uydurma" yazmak bir savunma değil. Bugünkü bulgumuz tam
bu: model bağlamdakiyle çelişen şeyi rahatça söyleyebiliyor.

**3.7 neden orta:** Orion'un `opencode.ts`'inde de sızan JSON'u temizleyen bir
kurtarma var. Mantık aynı: modelin konuşulmaması gereken çıktısı sese
gitmemeli, geriye bir şey kalmıyorsa hiç konuşulmamalı.

---

### Süreç ve yönetim (kategori dışı ama değerli)

| Özellik | Ne yapıyor | Orion |
|---|---|---|
| **ADR / PDR karar kayıtları** | Her yapısal karar numaralı bir dosya: bağlam, karar, **reddedilen alternatifler ve nedeni**, sonuçlar. | **O** — bizim spec'lerimiz benzer ama kararlar dağınık; "reddedilen alternatif" alışkanlığı zaten kodda var |
| **VISION: ne OLDUĞU / ne OLMADIĞI** | Özellik isteği "OLMADIĞI" listesiyle çakışırsa gerekçeyle kapatılıyor. | **Y** — bugün kumanda paneli beyinden büyük çıktı; "Orion ne değildir" listesi bu kaymayı erken yakalardı |
| **Kalıcı kimlik / geçici duruş ayrımı** | Vizyonun bir kısmı kalıcı, bir kısmı "şu anki aşama" ve tarihli. | O |

---

## Orion için sıralı fikir listesi

Önem ve maliyet sırasıyla. **Hiçbiri Open Notebook'u bağımlılık olarak
eklemiyor**; hepsi fikir.

| sıra | fikir | nereden | çözdüğü sorun | tahmini boyut |
|---|---|---|---|---|
| **0** | **Anlık algıyı kalıcı hafızaya YAZMA** (bekleyen karar B) | 1.4 ham / türetilmiş ayrımı | Eski "önümde" bilgisi geri geliyor | birkaç satır + eski kayıtların temizliği |
| 1 | **Asgari ilgi eşiği** | 2.3 | İçeriksiz anı ilk üçe giriyor | birkaç satır |
| 2 | **Getirmek tazeliği yenilemesin** (ya da yalnızca eşiği geçen getirme yenilesin) | Kategori 2 karşılaştırması | Alakasız anının kendini besleyen döngüsü | birkaç satır |
| 3 | **BM25 / IDF** | 2.2 | Kalıp kelimelerin eşleşmeyi domine etmesi | ~20 satır, bağımlılık yok |
| 4 | **Anıya zaman bilgisi** ("2 gün önce") | 3.3'ün kaynak fikri | Model şimdiki ile eskiyi ayırt edemiyor | küçük |
| 5 | **Tipli kimlik + doğrulanmış atıf** (`[ani:12]`) | 3.3 + 3.4'ün dersi | Orion'un neye dayanarak konuştuğu görünmüyor | orta |
| 6 | **Yoğun gömme** (`nomic-embed-text` zaten kurulu) | 1.3 | Eş anlamlıları kaçırma | orta; `ilgiOlcer` kancası hazır |
| 7 | **"Orion ne değildir" listesi** | VISION | Kapsam kayması | belge |

### Ölçüm sırası — önemli

0, 1 ve 2 **aynı hatanın** üç ayrı sebebi. Hepsini birden yaparsak hangisinin
işe yaradığını ayıramayız. Önerilen sıra:

1. **Önce ölç** — mevcut durumda N koşu; "gördüğünü söylüyor mu, gözlemde
   olmayan bir şey uyduruyor mu" sayılır.
2. **0'ı yap**, aynı ölçümü tekrarla.
3. Kalan hata varsa **1 ve 2'yi** ayrı ayrı ekle, her birinde yeniden ölç.
4. 3 ve 6 ancak ölçüm kalıp eşleşmesinin sürdüğünü gösterirse.

## Almayacağımız şeyler

- **SurrealDB, LangGraph, Esperanto, FastAPI** — Orion tek süreçlik bir
  Electron uygulaması. Yığın kurmak ihtiyaçtan büyük.
- **Planla → dağıt → birleştir (3.2)** — her soru için birden çok model
  çağrısı. Bulut beyninde tur başına ~3,5 sn ve ücretsiz kota sınırı var;
  şimdilik pahalı.
- **İngilizce kök bulucu (2.8)** — Türkçe için işe yaramaz. Kök bulma
  gerekirse Türkçeye özgü bir çözüm lazım.
- **Podcast (3.8)** — Orion'un sesi zaten Piper ile tek konuşmacı.

## Kaynaklar

- Depo: [lfnovo/open-notebook](https://github.com/lfnovo/open-notebook)
- Yerel dosyalar: `VISION.md`, `AGENTS.md`, `docs/7-DEVELOPMENT/architecture.md`,
  `docs/7-DEVELOPMENT/decisions/ADR-008-notebook-scoped-search.md`,
  `docs/2-CORE-CONCEPTS/ai-context-rag.md`, `open_notebook/graphs/ask.py`,
  `open_notebook/utils/{chunking,context_builder}.py`,
  `open_notebook/database/migrations/1.surrealql`, `prompts/{chat,ask}/`
