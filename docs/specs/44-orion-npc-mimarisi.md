# Spec 44 — Orion = NPC mimarisi: dünyayı VERİ olarak okuyan, LLM'i en sona bırakan ajan (yol haritası)

> Durum: **F0 (bu belge) yazıldı, 2026-10-31. F1–F6 kod YOK**; her faz ayrı onay, kendi bölümü/ön kaydıyla açılır.
> Üst belgeler: `15-goz-ve-mekan-bellegi.md` (mekânsal bellek, S2–S5 bu yol haritasına bağlandı), `10-beceri-refleksi.md`, `16-temiz-baglam-ve-cekmeceli-hafiza.md`,
> `23-level-yonetimi-ve-anlam.md` (anlam zinciri), `33-orion-flash.md`, `35-orion-dunya-editoru.md` (graf, §4c), `43-aktor-bilesen-graf-ve-hata-ayiklama.md`.
> Kanıt etiketleri: `[KOD]` okundu · `[ÖNGÖRÜ]` ölçülmedi · `[GENEL]` oyun yapay zekâsı genel bilgisi, bu projede doğrulanmadı.

## 0. Tek cümle

**Dünya, Orion'a veri olarak sunulur.** Orion etrafını "Matrix'teki kodlara bakan" gibi okur: nesnenin ne olduğu ve onunla ne yapılabileceği nesnenin
(ya da türünün) tanımından gelir; bilinen iş kodla/refleksle, bilinmeyen iş LLM'le yapılır ve LLM'in çözdüğü şey veriye yazılıp bir dahaki sefere LLM'siz olur.

## 1. Ozyn'in vizyonu (2026-10-30, kendi sözlerinden)

- Ofis bir deneme yeri değil, **özel bir level** (Orion'un evi); Orion **bütün level'ları gezebilmeli**. `otur` yeni level'da sandalye yoksa çalışmaz: kabul.
- **Nesne kendi etkileşimini bildirir.** Kutu: hareket ettirilir, tekmelenir, üstüne oturulur, incelenir — hepsi kutunun bilgisinde. Bilgide olmayan istek gelirse
  LLM düşünür, nesnenin JSON'unu/grafını düzenler; yapamazsa söyler.
- **"Git incele"**: Orion nesneyi inceler ve hafızaya (geçici/kalıcı) refleks olarak yazar.
- **Ayarlanabilir görme alanı**: alandaki nesneler otomatik okunur; bazı nesnelerin kendi alanı olur. Bilgi **mesafeye göre** değişir (yakındaki arabanın modeli /
  uzaktaki otoparktaki 10 araba bilinmez; uzak ormanın tek ağacı değil "orman"; dağdaki kale); duvar ve cam bilgiyi **sınırlar**; kapalı alanda gökyüzü okunmaz.
- **LLM en az**: LLM görme/düşünme, dünyayı düzenleme (ileride graf yazma) ve özel NPC sohbeti için. Geri kalan her şey refleks; refleksler **Orion Flash'a aktarılır**.
- **Sürekli çalışan idle grafı** (Blueprint gibi), içinde olay tetikleyicileri; katmanlar açılır/kapanır modüller.
- Uzun vade: Orion dünyanın **mimarı** (nesneleri kontrol eder, ağaç diker, gezer, araba sürer); boşta LLM'siz NPC gibi yaşar; iki Flash doğurup birine araba
  verip "beni şuraya götür" diyebilir — bir kez JSON'a modüler kaydedilir. En sonda küçük bir sinir ağı.
- İlham: `pipecat-ai/pipecat-client-cxx` (beden ↔ beyin deseni: beyin bedenin fonksiyonunu çağırır, beden yapar ve sonucu döner). Bağımlılık değil, desen.

## 2. Mevcut beyin `[KOD]` (2026-10-30 okundu)

| Parça | Ne yapıyor | Bu yol haritasındaki yeri |
|---|---|---|
| `bridge/kopru.ts` | algı → Dikkat → tampon → tetik → `Beyin.dusun` → niyet doğrulama → dünya | omurga; değişmez |
| `mind/icgudu.ts` | doğuştan kurallar, kalıcı kimlik, karar kaydına yazılır | hakem kurallarının adları |
| `mind/refleks.ts`, `mind/yerelTepki.ts` | "uyandırmaya değer mi"; LLM'siz beden tepkisi (sağ lob, konuşmaz) | algı olaylarının ilk süzgeci |
| `mind/beceriHafizasi.ts`, `mind/beceriDefteri.ts` | ilk başarı beceri doğurur, sonra LLM'siz tekrar (güven payı 0,75; altına inince askı) | "LLM bir kez çözer → refleks" mekaniği HAZIR |
| `mind/kuralHafizasi.ts` | deneyimden büyüyen istisnalı kurallar (ARTMAP benzeri) | öğrenilen kararlar |
| `mind/hafiza.ts`, `calismaBellegi.ts`, `durumDefteri.ts` | Generative Agents skoru; 30 sn çalışma belleği; durum | kalıcı / geçici kayıt |
| `mind/algiHizmeti.ts` | NPC algısı: menzil + görüş hattı (nesnenin 9 noktası) + karakter bütçesi; kırpınca söyler | algı katmanı HAZIR, tek menzil |
| `mind/inisiyatif.ts`, `mind/ajanda.ts` | utility AI "ne zaman" (1 saatte ≤4 uyanma tavanı), boşta bak/jest | idle yaşamın zamanlayıcısı |
| `world/level/cekirdek/anlam.ts` | anlam zinciri: yerleşim → varlık (`assets/sehir/anlam.json`) → kategori → varsayılan; ad, tür, eylemler, `algilanir`, not | **tür kataloğu HAZIR** |
| `protocol/temel.ts` `NESNE_EYLEMLERI` | bak, git, otur, al, odaklan, yaz, kullan | `it`, `tekmele`, `incele` yok |
| `world/olayUretici.ts` | histerezis + soğumalı ayrık olaylar (yalnız Ozyn yaklaştı/uzaklaştı/baktı/yüzeye geçti) | nesne/çevre olayı yok |
| `uygulama/graf/*` (spec 35) | Blueprint: olay düğümleri, ⚡ dinleme, dünya "Get" düğümleri, desen (alt graf), NPC sınıfı (`@ben`), hata ayıklama | idle grafın motoru HAZIR |
| `flash/` | aynı `Kopru`, beyinsiz beyin; NPC kimliği veri (`npcTanimi.ts`) | refleks aktarım hedefi |
| `world/yer/yer.ts` | `Yer`: saf veri (sınır, engel, çapa, nesne, yükseklik, `algiMenzil`, `katiYuzeyler`) | Orion'un bedeni ofise bağlı DEĞİL; bağ dünya kurulumunda (`birlesikDunya.ts`) |

**Bugünkü engeller:** spec 35 §4c "Orion'un olayları grafa açık değil" (iki karar verici yarışmasın); dinleme her açılışta Ozyn'in gerçek tıklamasıyla kurulur
ve diske yazılmaz; Orion'un araç yüzeyine graf/level düzenleme eklenmez (CLAUDE.md); ofis sabit koordinatlı ve koşulsuz kurulur, zemin katmanı şart (spec 42 §8).

## 3. Oyunlarda NPC nasıl tasarlanır `[GENEL]`

| Katman | Oyun tekniği | Bizde |
|---|---|---|
| Algı | duyular ayrı (görme/işitme), menzil, görüş konisi, "kaybetme" menzili, hatırlama süresi; **uyaran kaynakları** kendini kaydeder (UE AIPerception) | `algiHizmeti` (tek menzil + ışın) |
| Bilgi | Blackboard; "son bilinen konum", yaşlanan uyaran | spec 15 S2 (tasarım hazır, kod yok) |
| Karar | FSM, davranış ağacı, utility AI, GOAP | `inisiyatif` (utility), graf (davranış), LLM |
| Eylem | **Smart Object**: nesne ne sunduğunu ve etkisini ilan eder, NPC seçer (The Sims, UE5) | `anlam.eylemler` (yalnız ad; tarif avatarda) |
| Ölçek | AI LOD: uzak/önemsiz NPC seyrek güncellenir, kareye bütçe | yok (Flash sayısı artınca şart) |
| Kimlik | arketip verisi + örnek parametresi (sınıf/örnek) | `npcTanimi`, NPC sınıfı (`@ben`) |
| Dil | modern oyunlarda LLM yalnız diyalog / özel karakter | aynı; fark: LLM'in çözdüğü veriye yazılır |

Dersler: **pahalı olan algı, karar değil** (nesnelerin kendini ilan etmesi + kare bütçesi); **unutmak tasarımın parçası** (solma süresi şemaya baştan girer).

## 4. Hedef mimari (katmanlar; LLM en altta)

1. **Dünya verisi.** Bilgi arama zinciri, ilk bulan kazanır: nesne farkı (yerleşim) → tür kataloğu (varlık/kategori, `anlam.ts`) → bölge (sonra) →
   **level ortamı** (gök, hava, saat, zemin: level tanımından türetilir, yeni yazım yok) → çıkarım (sonra; ad/boyut, güven puanlı) → LLM.
2. **Algı.** Tek menzilden kademeye: `Anlam`'a önem / görünür menzil (**mesafe + önem etiketi**; görünür boyut hesabı yok — karar önerisi). Algı OLAY üretir
   (`nesne_alana_girdi`, `hava_degisti`…) `olayUretici` kalıbıyla (histerezis + soğuma). Algı akışı LLM bağlamına dökülmez (spec 16, spec 15 K4).
   Yavaş tarama (saniyede birkaç, kareye bütçeli) + olay + istek üzerine `incele`.
3. **Bilgi / hafıza** (spec 15 S2): algı (saniyeler) → son bilinen (durağanlığa göre yaşlanır; eşya yavaş, hareketli hızlı) → kalıcı (yalnız `incele`,
   nesnenin önem etiketi ya da tekrar görme).
4. **Karar (hakem).** Sıra: Orion'un idle/olay grafı → beceri hafızası → kural hafızası → LLM. Her katman kararını içgüdü kimliğiyle karar kaydına yazar.
5. **Eylem (Smart Object).** Eylemin TARİFİ nesnede/türde (spec 43 bileşen + aktör grafı); `NESNE_EYLEMLERI` genişler (`it`, `tekmele`, `incele`).
   Bilinmeyen eylem → nedenli "yapamam" (bugünkü `nesneEylemleri.ts` "uygun mu, değilse neden" ruhu).
6. **Öğrenme.** Başarılı görev → beceri (hazır); yeni nesne bilgisi → tür kataloğu; yeni davranış → graf. Orion'un yazdığı her şey ÖNERİ, Ozyn onaylar.

Açılır/kapanır: zincirin her katmanı ve her algı/olay kaynağı bir modül (graf deseni ya da eklenti, spec 40); kapalı katman zincirde atlanır.

## 5. Fazlar

| Faz | İçerik | Dokunduğu yer | Ön koşul |
|---|---|---|---|
| **F0** | bu belge, INDEX, ACIK-ISLER, spec 15 bağlantısı | `docs/` | — |
| **F1** | level ortamı algıya: gök/hava/saat/zemin `dunya_sor` cevabına ve durum defterine (LLM'siz) | `mind/`, `uygulama/` | onay |
| **F2** | algı kademesi (`Anlam` önem + menzil) + nesne/çevre olayları | `world/level/cekirdek/anlam.ts`, `mind/algiHizmeti.ts`, `world/olayUretici.ts` | **istisna** |
| **F3** | "etrafını incele" niyeti (yalnız okur + gider) → mekânsal belleğe kalıcı kayıt, LLM'siz | `protocol/niyet.ts`, `mind/`, spec 15 S2 | onay; spec 15 S2 ön kaydı |
| **F4** | Orion idle grafı + hakem; açılışta otomatik dinleme | `uygulama/graf/grafDinleyici.ts`, `bridge/kopru.ts` | §6 karar 1–2 |
| **F5** | Smart Object tarifleri: kutu demosu (it/tekmele/otur/incele); spec 35 "Tarif / ağaç kesme" ile birleşir | spec 43 bileşen/graf, avatar | **istisna** |
| **F6** | LLM → refleks: LLM cevabını tür kataloğuna / grafa yazma (öneri olarak) | araç yüzeyi | §6 karar 3 |
| sonra | bölge katmanı, çıkarım, cam/duvar duyu farkı, ofisin taşınabilir/gizlenebilir olması, araba, Flash doğurma, boşta yaşam, küçük sinir ağı | — | — |

## 6. Ozyn'in kararları (fazlardan önce)

1. **F4:** Orion'un idle grafı açılışta tıklamasız kurulsun mu? Öneri: evet, YALNIZ Orion'un kendi grafı; kullanıcı grafları gerçek tıklama ister.
2. **Hakem:** "önce graf, sonra beceri, sonra LLM" sırası §4c'nin yerine geçsin mi? Öneri: evet.
3. **F6:** Orion'un graf/katalog YAZMASI araç yüzeyi yasağını ne zaman ve hangi kapıyla gevşetir? Öneri: yalnız öneri üretir, Ozyn gerçek tıklamayla onaylar.
4. **Bilgi kademesi:** mesafe + önem etiketi (öneri) mi, görünür boyut mu?

## 7. Doğrulama (her faz)

- `npx tsc --noEmit`, `npm test` (taban 5574/0), bekçiler (`mimari`, `altSistem`, `tipKacisi`, `protokol`: `tik` beyne girmez), token bütçe testi ≤1800.
- LLM'siz iddiası ölçülür: `globalThis.fetch` sayacı 0 (`flash/beyinsizBeyin.test.ts` kalıbı); inisiyatif tavanı testi.
- Canlı: yeni `incelede` senaryosu (yeni level'da kutuya git → incele → kalıcı kayıt → ikinci istekte LLM çağrısı 0); gerilemeler `hafizadene`, `baglamdene`,
  `takipdene`, `grafdene`; oyun KAPALIYKEN.
- Yeni saf mantıkta bozma denemesi ≥12 mutant; `docs/DOGRULAMA-DEFTERI.md` her fazda.

## 8. Bilerek yapılmayanlar

F0'da kod yok. VLM ana yol değil (spec 15 K1: görme = sahne okuma; resim modeli EKSTRA). `brain-lab/`, `ova.level.json` dokunulmaz.
Görünür boyuta göre bilgi hesabı yok (öneri). Algı her tur LLM bağlamına girmez.
