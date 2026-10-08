# Spec 16 — Temiz bağlam: çekmeceli hafıza, kalıcı durum defteri, kural yönlendirici

> Üst belgeler: `06-beyin-v2.md` (durum ≠ anı K2, zaman etiketi K3, eşikli getirme K4/K5, bağlam düzeni K8),
> `12-anlik-benlik.md` §4.1 (SABİT / ANLIK / DERİN), `15-goz-ve-mekan-bellegi.md` (nesnelerin yeri).
> Durum: **F0–F5 kodlandı ve birim testli; canlı ölçüm (taban + `baglamdene`) bekliyor** (2026-10-08).

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
- **K6** (Ozyn, 2026-10-08) Sohbet kipleri: **standart** · **yeni sohbet** (pencere sıfırlanır, hafıza kalır) ·
  **temiz sohbet** (hafıza/durum bağlama girmez, hiçbir şey yazılmaz). Geçiş sözle, tam eşleşmeyle, LLM uyanmadan.
  Başlangıç selamı eklenmedi: "sorulmayan girmez" kuralıyla çelişir.

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

### F6 ön kaydı (F5 canlı sonuçları görüldükten SONRA, F6 koşusundan ÖNCE yazıldı — 2026-10-08)
F5 ölçüsü gösterdi: konuşma uyanışında bağlamın ~%94'ü SABİT iskele (araçlar 4797 kr, talimat 1997,
örnekler 653). Hafıza tarafı küçüldü ama toplamı taşımıyor. F6 iskeleye dokunur; davranış riski olduğu
için önce çevrimdışı ölçü (`tools/eylem-olc.ts`, qwen2.5:7b, koşul temiz+faz1, n=5, 8 komut).
- Kol T0: 14 araç (bugün). Kol T1: `dunya_al`, `dunya_birak`, `dunya_poz` çıkarılır — bütün karar
  kaydı tarihinde (314 çağrı) al/birak 0 kez, poz 2 kez çağrıldı; poz doğrulayıcıda "oturuyor"a geçişi
  zaten reddediyor (otur/kalk var). `dunya_dur` güvenlik için KALIR.

| # | ölçüt | eşik | çürütme |
|---|---|---|---|
| P7 | T1 araç doğruluğu (doğru/toplam, iki koşul birlikte) | T0'dan en çok 2/80 düşük | > 2/80 düşük |
| P8 | Araç şeması boyu | ≥ %10 küçülür | < %10 |

P7 tutarsa T1 canlıya girer (`KopruAyari.cikarilanAraclar`); tutmazsa kalmaz, sonuç yazılır.

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

### F2 — durum defteri `[TEST]`
- `mind/durumDefteri.ts`: anahtar başına tek satır, üzerine yazılır, zamanıyla: `konum`, `onceki_konum`,
  `yapiyor`, `son_is`, `son_ozyn`, `son_orion`, `monitor`; + yüklemeden türeyen `onceki_oturum`.
  Yanından geçmek konum değildir (`KONUM_OTURMA_MS` 2 sn); süren iş oturumdan oturuma taşınmaz.
- Konum adı çapadan: `world/level/capalar.ts` `bulunduguCapa` (durağa en yakın, ≥ 1,2 m içinde; yoksa
  "odanın ortası"). `world/giris.ts` 500 ms'de bir gözler; defter yalnız değişimi yazar.
- Köprü besler: iş niyeti (`IS_NIYETLERI`: git/otur/kalk/yaz/komut/odaklan) → yapıyor; sonucu → son iş;
  Ozyn'in kesin sözü, Orion'un sözü. Kalıcılık ayrı dosya `orion-durum.json` (IPC `durum:oku/yaz`,
  hafızayla aynı senaryo yalıtımı, `ORION_DURUM_DOSYASI`).
- Zihin duvarı: ANLIK kabukta "durum defteri (kalıcı; bağlama yalnız sorulunca)".
- Bozma: 5/5.

### F3 — çekmeceler `[TEST]`
- `mind/hafiza.ts` `cekmecesi`: konusma (söz) · is (terminal, başarılı sonuç) · ders (`hata…` sonucu) ·
  olay. Kayıtta ayrı alan yok, türden türer — eski dosya göçsüz çalışır.
- Budama çekmece başına payla (`CEKMECE_PAYI` 0,5/0,2/0,2/0,1): önemli gürültü sözlerin payına giremez.
- `getir(…, cekmeceler)` yalnız istenen çekmecede; `sonlar(cekmeceler, adet)` ilgiden bağımsız en yeniler
  ("ne konuşmuştuk" sorusunun eski sözlerle ortak kelimesi yok — eşikli getirme orada boş dönerdi).
- Panel başlığı: `DERİN 60 / 174` (`kabukSayilari`).

### F4 — kural yönlendirici `[TEST]`
- `mind/hafizaYonlendirici.ts` `KURALLAR` (tek kaynak, test ızgarası örneklerden türer): konum.simdi,
  konum.once, is.simdi, is.once, konusma.gecmis (konuşma çekmecesi `son` 4), hatirla (konuşma+iş+ders
  `ilgi` 3); sözden bağımsız: terminal.hata (ders+iş), niyet.hata (ders), soz.yer (odadaki yer adı → konum).
  Türkçe harfler sadeleşir. **Varsayılan boş**: 8 sorulmayan söz için boş istek test edildi (P6).
- Bilerek yok: "her söz turunda ilgili ders" — Ozyn'in kuralı "sorulmayan girmez"; ders yalnız başarısızlıkta.

### F5 — bağlam montajı `[TEST]`, canlı kanıt bekliyor
- `KopruAyari.hafizaKipi`: "otomatik" (varsayılan, eski davranış — kıyas kolu) | "yonlendirici" (canlı,
  `world/giris.ts`; `?hafiza=otomatik` / `ORION_HAFIZA_KIPI=otomatik` eskiye döner).
- Yönlendirici kipinde: anılar yalnız istenen çekmecelerden; istenen durum satırları ŞİMDİ'de (dünya
  metninde, yaşıyla); yakın pencere son 4 kayıt / 10 dk (`yakinPencere`); dünya satırında ham koordinat yok.
  Karar kaydı `uyanis.hafizaIstegi` (tetiklenen kurallar).
- Yeni senaryo `3dorion.bat baglamdene`: otur → neredesin → tahtaya git → neredeydin → bilgi + 5 alakasız
  söz → ne konuşmuştuk. Canlı koşu **bekliyor**.
- Bozma (yönlendirici + montaj + çekmece): 8/8.

### F5b — sohbet kipleri `[TEST]`
- `mind/sohbetKipi.ts`: `SOHBET_IFADELERI` (TR+EN, tek kaynak), `sohbetEylemi` yalnız TAM eşleşme
  ("yeni sohbet nasıl açılır" bir sorudur, kip değiştirmez). İçgüdü `kopru.sohbet`.
- Köprü: her eylemde konuşma penceresi ve bekleyen tur sıfırlanır; Orion sabit cümleyle onaylar
  (`SOHBET_ONAYI`, durum defterine yazılmaz). Temizde: anı ve durum bağlama girmez (hafıza kipi ne olursa),
  söz hafızaya ve defterin söz satırlarına yazılmaz; pencere yalnız temiz sohbetin kendi sözleri; karar
  kaydında `uyanis.sohbetKipi: "temiz"`. Temizden çıkınca o sohbet pencereye sızmaz.
- Ekran: temizdeyken üstte kalıcı işaret; geçişler günlükte.
- Bozma: 5/5.

### Canlı ölçüm (2026-10-08, yalıtılmış hafıza; `tools/baglam-ozet.ts`) `[ÖLÇÜLDÜ]`
| # | sonuç | karar |
|---|---|---|
| P1 | `hafizadene` qwen2.5:7b, konuşma uyanışı medyanı: otomatik 8255 kr / 2766 tok → yönlendirici 7892 kr / 2429 tok (**−%4 kr, −%12 tok**). Hafıza tarafı (geçmiş+dünya+anı) 640 → 268 kr (−%58) | **ÇÜRÜDÜ** (eşik %40). Hipotez yanlıştı: bağlamın ~%94'ü sabit iskele (araç 4797, talimat 1997, örnek 653). F6 bunun için |
| P2 | `eylemdene` yönlendirici kipinde 6/6 | tuttu |
| P3/P4 | `baglamdene` qwen: koşu 1 3/4, koşu 2 1/4 (tasarım hatası: "ne konuşmuştuk" pencereyi tekrar getiriyordu → düzeltildi), koşu 3–7: ne konuşmuştuk **5/5**, defter 5/5, neredesin 0/5, neredeydin 0/5 (konum etiketi yanlıştı: terminalin yanında doğan Orion sandalyede de "yönetim terminali"ydi → histerezis 0,3 m), koşu 8–9 (histerezisli) neredesin 1/2. Haiku koşu 1: neredesin ✓, neredeydin ✓, ne konuşmuştuk ✗ (aşağıda) | n=5 ön-kayıtlı partiler yarım kaldı (Ozyn durdurdu); **karar verilmedi** |
| P6 | Bütün koşularda sorulmadan bağlama giren anı/durum satırı: **0** | tuttu |
- qwen'de bilgi bağlamda doğruyken bile yok sayıldı (kayıt: `You are at: çalışma masası` → "sana oturuyorum"); Haiku aynı bağlamla doğru cevapladı ve düz metne hiç kaçmadı (`kurtarilanMetin` 0, qwen 6–8). Başarısızlıkların büyük kısmı modelin.
- **Bulgu (düzeltilmedi):** Haiku adaptörü `claude -p`'yi proje klasöründe koşuyor; Claude Code'un CLAUDE.md'si ve hafızası Haiku'nun bağlamına giriyor — "ne konuşmuştuk"a "beyin haritası üzerinde çalışıyorduk" dedi (o konuşmada hiç geçmedi). Adaptör proje dışı boş bir klasörde koşmalı.
- **Açık:** konumu geometri yerine yapılan işten almak (vardı/oturdu); F6 çevrimdışı ölçüsü (P7/P8).

## 6. Sapma kaydı
- 2026-10-08 (koşudan sonra): "ne konuşmuştuk" pencerede zaten görüneni haric tutar, adet 4 → 6; durum
  satırı (son söz) bu kuraldan çıktı (sorunun kendisini tekrarlıyordu). Konum: önce yapışkanlık, sonra 0,3 m
  histerezis (`YER_HISTEREZISI`). Her değişiklik yeni bir parti başlattı; eski partiler tabloda ayrı.
- 2026-10-08: canlı taban F0'da alınamadı (Ozyn o sırada Orion'u kullanıyordu); F5 öncesi alınacak.
  Taban koşusu süzgeçli kodla olacak: P1 tabanı "süzgeç sonrası, yönlendirici öncesi" sayılır.
