# Spec 26 — Orion'u prototipten çıkarmak: beyin, harness, terminal, hafıza, ova (2026-10-11)

Durum: PLAN (Ozyn onayı bekliyor). Kod yazılmadı. Karar zaten verildi, yeniden açılmaz: **beyin Haiku, Gemma yalnız göz** (spec 25).

Ozyn'in tespitleri: (1) Orion terminali düzgün kullanamıyor, (2) hafıza çok kötü, (3) beyin çok eksik, prompt ve harness
mühendisliği sorunlu, promptlar İngilizceye çevrilmeli, (4) Orion ovadaki her şeyi (oturmak, takip etmek…) anlık
kullanabilmeli. Bu belge önce KANITI (kayıt + kod + dış kaynak), sonra TEŞHİSİ, sonra ölçümlü planı verir.

## 1. Kanıt (karar kaydı: 9 dosya, 798 uyanış; `%APPDATA%/3dorion/karar-kaydi/`)

| Bulgu | Sayı | Etiket |
|---|---|---|
| Haiku bağlamı (uyanış başına medyan) | 7,35 bin karakter; **araç şeması %66** (4969 / 7519) | [ÖLÇÜLDÜ] |
| Haiku uyanışları olay tetikli | 32 / 83 (%38); bunların **21'i hiçbir şey yapmadan** bitti (≈3 sn Haiku çağrısı boşa) | [ÖLÇÜLDÜ] |
| `sor` → `gordum` → `sor` zinciri | Olay→`sor` 10, `gordum`→`sor` 6: Orion kendi bakışına yeniden uyanıp yine bakıyor | [ÖLÇÜLDÜ] |
| Bağlama giren hafıza | `anilar` ortalama **2 karakter** (7519'dan): hafıza beyne fiilen ulaşmıyor | [ÖLÇÜLDÜ] |
| Hafıza içeriği (`orion-hafiza.json`) | 273 kayıt: **228 ham Ozyn cümlesi** ("yanıma gel", "claude yaz"), 23 hata sonucu, 22 terminal çıktısı. Kişi/tercih/olay/gerçek YOK | [ÖLÇÜLDÜ] |
| Terminal: 52 `komut`/`yaz` niyeti | Doğru olanlar az: "terminale claude yaz" → `Write-Host "claude"`; "şimdi merhaba yaz" → `echo "merhaba"`; "monitörü inceley", "ClearMemory", "terminali aç" (yerel modeller). Haiku "terminali kullanabilirim" dedi, kullanamadı | [ÖLÇÜLDÜ, kayıttan] |
| Düşünce konuşmaya sızdı | "Ozyn'in sorduğu şey net: … Bakıyorum." (6,9 sn uyanış) | [ÖLÇÜLDÜ, 1 örnek] |
| Boş girişli uyanış | `GİRDİ: ""` → "çapa hatası aldım" (ovada ajanda `pencere` çapası) | [ÖLÇÜLDÜ, 1 örnek] |
| Haiku araç çağrısı geçerliliği | reddedilen 0, kurtarılan 0: **format sorunu yok** | [ÖLÇÜLDÜ] |

Dış kaynak (araştırıldı, kopyalanmıyor — ölçüm kazanırsa alınır):
- Letta düz dosya + dosya araçlarıyla LoCoMo'da %74 aldı; Mem0 graf varyantı %68,5; graf ~3× yavaş, ~2× token
  (letta.com/blog/benchmarking-ai-agent-memory). **Sonuç: yöntem (vektör/graf) değil, "ne saklanıyor" belirleyici.**
- Ajan belleği: ham döküm değil ÖZET + gerçek (anlamsal) + olay (episodik); kayıt = gözlem/eylem/sonuç/yansıma.
- Araç şeması bağlamı yer (MCP'de 43 araç ≈ 32× token); şema sıkıştırma %44–50 tasarruf; küçük bağlamda JSON şeması
  işlevi öldürür (8K'da %2,6). Bizde 7 bin karakterin %66'sı şema.

## 2. Teşhis (kök nedenler)

1. **Harness uyanış politikası kötü:** Orion olay (kimlik: `ozyn_yuzeyden_cikti`) ve kendi `gordum`'una uyanıyor; çoğu
   uyanış boş. Maliyet + gecikme + "Bakıyorum." gevezeliği. (Kural, LLM değil, süzmeli.)
2. **Araç yüzeyi şişkin ve karışık:** 12 araç, 3 "bakmak" (`bak`, `sor`, `sor gor`); şema bağlamın 2/3'ü.
3. **Terminal tek yönlü:** Orion `komut` ÖNERİR (Ozyn onaylar), ama "yaz" ile "komut çalıştır" ayrımı ve Ozyn'in
   cümlesinden komuta çeviri güvenilmez; çıktıyı okuma ayrı bir yol (`terminal` algısı otomatik gelir, `sor` ile
   sorulamaz). "Yaz" = klavyeden aynen yazmak olduğu halde Haiku komut uyduruyor.
4. **Hafıza yanlış veriyi tutuyor ve getirmiyor:** ham cümle torbası; çekmece/yönlendirici var ama getirilen yok.
5. **Prompt dili ve içeriği:** çerçeve İngilizce, içine Türkçe algı/görme/durum karışıyor; talimat "odandasın"
   (ovada yanlış); olaylar ham kimlik; "gördüğünü aktar, ekleme" kuralı yok (spec 25 §8).
6. **Ova yetenekleri eksik:** `gec` (C6) yok, ovada oturulacak nesne yok (`otur` çapa ister), takip (içgüdü) ova'da
   ölçülmedi, algı yeşil harabede 890 engelle ölçülmedi.

## 3. Plan — sıra önemli, her faz ölçüm ve durak

### F0 — Ölçüm tezgâhı (önce; kod değiştirmeden)
Haiku'yu GERÇEK bağlamla (karar kaydından yeniden oynatılabilir) bir **yetenek bataryası**ndan geçir:
~40 senaryo × 3 tekrar, 6 küme: (a) beden (gel/otur/takip/bak), (b) terminal (yaz / komut / çıktı oku / hata düzelt),
(c) hafıza (3 oturum önceki bilgi), (d) olay yönetimi (tepki gerekmeyen olaylar), (e) görme aktarımı, (f) ova.
Ölçülen: doğru araç, doğru argüman, **gereksiz uyanış oranı**, süre, bağlam boyutu, uydurma (gördüğünden fazla).
Çıktı: "neler kolay / neler zor" tablosu — Ozyn'in sorusunun cevabı. Orion'a kendi hakkında sormak ayrıca yapılır ama
**hipotez kaynağı** sayılır, kanıt değil (kendi günlüğünü okuyacak aracı yok: bugün "neleri yaparken kolay" → `sor`).
Ön kayıt F0 başında yazılır (eşikler, set), sonuç Ozyn'e gösterilir.

### F1 — Harness: uyanış politikası ve araç yüzeyi
- Olay uyanışlarını kural süzsün (tepki gerektirmeyen olaylar beyni uyandırmaz; "ozyn_yuzeye_gecti" gibi); `sor`→
  `gordum`→`sor` zinciri kırılsın (kendi görmesine, tekrar bakma niyetiyle uyanmama).
- Araç şeması: hedef bağlamın ≤ %35'i (bugün %66): açıklamaları kısalt, bakma araçlarını birleştir/ada göre ayır,
  gerekirse bağlama göre alt küme (yerde oturulacak şey yoksa `otur` yok).
- Talimat ve bütün iç metinler İNGİLİZCE (algı, görme betimi, durum, olay, hata mesajı); Türkçe yalnız Orion'un SESİ
  ve odadaki/ovadaki ADLAR (bir sözlük). Yer farkı: "ofis" / "ova" (talimattan "odandasın" çıkar). Olaylar insan
  cümlesi ("Ozyn stepped away from the desk").
- Düşünce sızıntısı: konuşmadan önce süzgeç (ölçülür: sızıntı sayısı).
- Ölçüt (ön kayıt): gereksiz uyanış ≤ %10; bağlam ≤ 5 bin karakter; F0 başarı kümelerinde gerileme YOK.

### F2 — Terminal
- Niyetleri ayır: `yaz` (aynen klavye: "claude yaz" → `claude`), `enter`, `komut` (öner + gerekçe), `terminal oku`
  (son N satır/çıktı, `sor terminal`). "Yaz" cümlesini komuta çevirme kuralı talimatta ve ÖRNEKTE, testle.
- Onay modeli korunur (Orion önerir, Ozyn onaylar); onaylı oturumda (Ozyn "burada kullanabilirsin" dediyse) çalışma kipi
  seçeneği ayrı karar — güvenlik (`onayKapisi`) Ozyn'in kararı.
- Ölçüt: 20 komut isteği (Türkçe, İngilizce, yazım hatalı) → doğru komut ≥ %90, uydurma komut 0; hata sonrası düzeltme
  (≥ %70) — Haiku ile.

### F3 — Hafıza (araştırma + A/B, sonra karar)
- **Önce VERİ:** saklanan şey değişir: ham cümle yerine (i) **olgu/tercih** ("Ozyn terminalde `claude` kullanır"),
  (ii) **olay özeti** (oturum sonunda 2–4 cümle: ne yapıldı, ne bozuldu), (iii) **ders** (başarısızlık nedeniyle),
  (iv) kişi/yer adı sözlüğü. Üretici: oturum sonunda Haiku özeti (ucuz, tek çağrı).
- **Sonra YÖNTEM, A/B (40 soruluk sınav):** K1 düz Markdown/JSON dosya + Orion'un okuma/yazma aracı (Letta bulgusu) ·
  K2 mevcut kelime örtüşmesi · K3 `nomic-embed-text` (kurulu) vektör araması. Vektör/graf ANCAK sınavda K1'i yenerse alınır.
  Sınav türleri: kişi/tercih, geçen oturum olayı, zaman ("dün"), çelişki (tercih değişti).
- Ölçüt (ön kayıt F3 başında): doğru hatırlama ≥ %80; bağlama giren hafıza payı ≤ %10; yanlış anı sızması ≤ %5.

### F4 — Ova yetenekleri (anlık kullanım)
- `gec` (C6): Orion kapıdan kendi başına gider/döner. Takip: ovada ölçüm (`takipdene` ova varyantı). Oturma: ovada
  oturulacak nesne (bank, küp kenarı) → çapa/anlam; Orion'un `otur` bir nesne adıyla çalışması. Terminal: ovadayken
  uzaktan (zaten arka planda açılıyor) — ölçüm.
- Algı yükü: yeşil harabede 890 engel, görüş-hattı yol bulma küpsel büyüyor (levelYeri bilinen sınır) → ölç; gerekirse
  engel gruplama (kule = tek kutu).
- Ölçüt: ovada 6 yetenek bataryası (gel, takip, otur, bak, gec, terminal) ≥ %90, uyanış başına gecikme ≤ 4 sn.

### Ortak kurallar
Her faz: ön kayıt → ölçüm → dürüst rapor → Ozyn'e göster → dur. Davranışı sezgiyle ayarlama yok. Mutasyon testi,
yedekle (git checkout değil). Mimari bekçisi yeşil kalır. Push yok.

## 4. Önerilen sıra ve neden
F0 → F1 → F2 → F3 → F4. F0 olmadan "neler iyi/kötü" konuşması sezgi olur; F1 ucuz ve her şeyi iyileştirir (boş uyanış,
şema); F2 Ozyn'in en çok şikâyet ettiği şey; F3 en çok araştırma ister ve F1–F2'nin yeniden düzenlediği bağlamın
üstüne oturur; F4 ova level'ı olgunlaşınca (yeşil harabe) yapılır.

## 5. Ozyn'e sorular
1. Sıra uygun mu (özellikle F1'in F2'den önce olması)?
2. Terminal: "burada kullanabilirsin" deyince Orion onaysız çalıştırsın mı, yoksa her komut onaylı kalsın mı?
3. Hafıza özetini üretmek için oturum sonunda Haiku çağrısı (~ucuz) kabul mü, yoksa yerelde (Gemma) mi?

## 6. F0 ÖN KAYDI (koşudan ÖNCE yazıldı, 2026-10-11)

**Araç:** `tools/f0-olc.ts` (24 senaryo, `fixtures/f0/senaryolar.json`; puanlama `tools/f0.ts`, testli). Girdi canlı
köprünün kurduğu gibi (talimat, örnekler, 14 araç şeması). Taban = BUGÜNKÜ harness, hiçbir şey değiştirilmeden.
**Koşular:** yerel qwen2.5:7b, ornith-32k, gemma4:e2b (n = 3, ücretsiz); Haiku (n = 1, `claude-beyin` 4700).
**Hipotezler (kayıttan türetildi, eşikler şimdi sabit):**
- H1 Haiku beden kümesi (6) ≥ 5/6 geçer (kayıtta 0 reddedilen).
- H2 Haiku terminal kümesi (8) ≤ 5/8 geçer (kayıt: yaz→komut çevirisi hatalı) — çürürse terminal sorunu "model" değil "belirsiz niyet".
- H3 Haiku olay kümesinde `bos` senaryoları (o1, o2) en az birinde BOŞ KALMAZ (kayıtta 21/32 olay uyanışı boş bitti ama o zaman çağrı yapılıyordu: boş kalamama kanıtı).
- H4 Haiku `o3` (görme sonrası) tekrar `sor` çağırır (kayıt: gordum→sor 6/19).
- H5 Haiku hafıza kümesi (4) ≥ 3/4 (anı bağlamda VERİLİRSE kullanır): sorun saklama/getirmede, kullanmada değil.
- H6 Yerel modeller (qwen2.5:7b, gemma4:e2b) Haiku'nun gerisinde: toplam < Haiku − 6 senaryo.
**Karar kuralı:** Hiçbir eşik koşudan sonra değiştirilmez. Çürüyen hipotez raporda çürüdü diye yazılır. Haiku koşusu
1 kez; belirsiz çıkarsa (puan ≤ 1 farkla eşikte) yalnız o senaryo 2 kez daha. Sonuçlar `docs/olcum/f0-taban-*.jsonl`.

## 7. F3-A ÖN KAYDI — hafıza GETİRME yöntemi (koşudan ÖNCE, 2026-10-11)
**Araç:** `tools/hafiza-sinav.ts` · fikstür `fixtures/hafiza/sinav.json` (60 anı: 12 olgu, 12 olay özeti, 24 ham söz + dolgu;
36 soru, çoğu eş anlamlı/dolaylı). Model YOK, ücretsiz: doğru anı ilk k sonuçta mı (hit@k). Gömme: `nomic-embed-text` (kurulu).
**Yöntemler:** K2 mevcut `Hafiza.getir` · K2k yalnız kelime · K3 yalnız gömme · K3b `Hafiza.getir` + gömme ilgisi · K1 hepsi-bağlamda (boyut).
**Hipotezler (eşikler şimdi sabit):**
- HA1 K2 hit@3 ≤ 0,55 (kayıt: bağlama giren anı ≈ 0).
- HA2 K3 hit@3 ≥ 0,80.
- HA3 K3b hit@3 ≥ K2 hit@3 + 0,15.
- HA4 Damıtılmış anıların (olgu+olay) toplamı ≤ 3000 karakter → "hepsi bağlamda" (K1) kâğıt üstünde mümkün.
**Karar kuralı:** HA2 VE (K3 ≥ K2 + 0,20) tutarsa arşiv aramasında gömme; tutmazsa kelime+çekmece kalır. Her durumda
"damıtılmış çekirdek blok her zaman bağlamda" (Letta bulgusu) ayrı karar olarak F3-B'de ölçülür. Bu sınav SENTETİK korpustur
(gerçek hafıza bu özellikleri taşımıyor çünkü ham söz torbası); sonuç "yöntem" içindir, "Orion hatırlıyor" iddiası DEĞİL.

## 8. SONUÇLAR (2026-10-11) — F0 taban → F1/F2/F3-B sonrası

Koşular: `docs/olcum/f0-taban-*.jsonl` (taban, 24 senaryo), `f0-son-*.jsonl` (final, 28 senaryo; Haiku n=2, yerel n=3),
ara koşular `f0-yapisal*-dis.jsonl`. Hepsi ham çağrılarla saklı. **Önemli düzeltme:** §1'deki "araç şeması bağlamın %66'sı"
Ollama/MCP beyinleri için doğru; Haiku (`claude -p`) şemayı HİÇ görmüyordu — satır sözleşmesi görüyordu (aşağıda).

### 8.1 F0 ön kayıtlı hipotezler — kader
| H | iddia | sonuç |
|---|---|---|
| H1 | Haiku beden ≥ 5/6 | **ÇÜRÜDÜ** (1/6). Neden model değil: satır sözleşmesi yalnız 4 eylem ifade ediyor |
| H2 | Haiku terminal ≤ 5/8 | tuttu (5/8) |
| H3 | Haiku olay (o1,o2) boş kalamıyor | tuttu (iki koşuda da çağırdı) → kural (F1) ile çözüldü |
| H4 | Haiku görme sonrası yine `sor` | tuttu (o3) → tur kuralı (F1) |
| H5 | Haiku hafıza ≥ 3/4 | tuttu (4/4): anı VERİLİRSE kullanıyor; sorun saklamada |
| H6 | yerel modeller Haiku'dan ≥ 6 senaryo geride | **ÇÜRÜDÜ**: yerel %50–56, Haiku %54 (taban). Sorun model değil harness |

### 8.2 Taban → son (ortak 24 senaryo; o1/o2 artık kuralla beyne hiç gitmiyor)
| beyin | taban | son |
|---|---|---|
| Haiku (satır → yapısal kip) | 13/24 %54 | 34/48 %70 (o1,o2 hariç %77) |
| gemma4:e2b | %56 | %69 |
| qwen2.5:7b | %52 | %58 |
| ornith-32k | %50 | %56 |
Küme (son, Haiku): beden 10/12 · terminal 11/16 · hafıza 7/8 · olay 6/12 · yazma 7/8. **Terminal hâlâ en zayıf küme tüm
beyinlerde** (yerel 7–10/24). Haiku n=2 tutarsız: t5, h1, o3, o4, y2 (tek koşuya güvenilmez); hâlâ başarısız: b6 (dur), t1, t8.
Hata payı büyük (senaryo başına 1–2 örnek); bu "iyileşti" değil "yön doğru" kanıtıdır.

### 8.3 Ne yapıldı (commit'ler)
- **F1** `f640d57`: Ozyn'in hareket olayları beyni uyandırmaz (801 uyanışın 215'i, %54'ü boştu; tek kaynak `protocol/algi.ts`);
  gordum-yalnız turda `sor` aracı yok (`turIcinAraclar`, tek işlev: köprü + koşucu + dış beyin); yapısal Haiku sözleşmesi
  (`bridge/yapisalSozlesme.ts`, `claude-beyin --mod=yapisal`, **varsayılan** `2b4cea1`; `ORION_CLAUDE_MOD=satir` geri alır);
  talimat yer-nötr + GORDUM bölümü; görme istemi İngilizce; zaman cümlesi yer adsız.
- **GERİ ALINAN deneme:** talimata "otur = dunya_otur…" eşlemesi → qwen2.5:7b aracı çağırmak yerine adını metne yazdı
  (beden 11/18 → 5/18). Ders: zayıf modele talimatta araç adı sıralama.
- **F2** `f640d57`: `uygulama/komutKipi.ts` otomatik (varsayılan; yıkıcı sınıf yine onay bekler) | tam | onayli; komut aracı
  "satırı yazar + Enter, sarma yok" (claude yaz = `claude`). Ozyn: "terminal onaysız çalışsın".
- **F3-A** `4b15d5f`: getirme sınavı (48 anı, 36 soru): K2 mevcut hit@3 0,83 · K2k kelime 0,86 · K3 gömme 0,67 · K3b birleşik 0,31.
  HA1–HA3 ÇÜRÜDÜ, HA4 tuttu. **Vektör/graf gerekmedi**; sorun saklanan şey.
- **F3-B** `80e949e`: olgu çekmecesi + `hatirla {anahtar, deger}` (aynı anahtar günceller); olgular `[fact:anahtar] …` olarak
  YALNIZ Ozyn konuşan turda bağlamda (≤ 700 kr). Yazma kümesi (y1–y4) Haiku 7/8.
- **F4** ölçüm (`ovadene`, 6/8): gel ✓, takip ✓, takibi bırak ✓, kapıya git ✓, bak/jest ✓, algı ✓; **otur ✗**, **gec ✗**.

### 8.4 AÇIK (yapılmadı; kanıtlı)
1. **Ovada oturma:** avatar `otur` tek ofis sandalyesi koordinatına (`OTURMA_NOKTASI`) sabit; ova çapaları yalnız kapı.
   Gerekenler: oturma noktasını çapadan türet (yürütücü), `levelYeri`'de `otur` eylemli nesne → çapa, ova'da oturulacak nesne.
2. **`gec` niyeti (C6):** Orion kapıdan tek başına geçemiyor; ova sahnesi kurulu değilken Orion'un yürüyeceği veri (engeller)
   yok → geçişte arka plan ölçümü (~1,1 sn) gerek.
3. **F3-C oturum özeti:** olay özeti (oturum/N tur sonunda Haiku, ucuz) yazılmadı; olgular yalnız Orion `hatirla` derse oluşur.
   Eski 228 ham söz hâlâ duruyor (göç/temizlik yazılmadı).
4. **Hata/sonuç metinleri hâlâ Türkçe** (`world/avatar/yurutucu.ts` ~25 mesaj, `bilgisayar.ts`…) ve LLM bağlamına giriyor;
   İngilizceye çevirmek testleri (~40 assert) etkiler, ölçümlü yapılmalı (zayıf modelde karışık dil etkisi ölçülmedi).
5. **Terminal hâlâ ≤ %70** (Haiku 11/16; yerel 7–10/24): "terminal oku" aracı (`sor terminal`) yok; "git durumuna bak" gibi
   `bak` kelimeli komutlar `sor`a gidiyor.
6. Haiku b6 ("dur" → yalnız söz), t1/t8 tutarsız; yapısal kipte `sor gor`/`sor dunya` ayrımı ("ne görüyorsun" → dunya).
7. İlgisiz bulgu: repo kökünde `calisti`, `tahtaya`, `gunluk.txt` (Orion'un terminale yazdığı komutların artığı, canlı testten).

## 9. F3-C: `/compact` ve otomatik sıkıştırma (2026-10-12)

Ozyn: "/compact ve auto compact özelliği eklemeliyiz Orion'a". §8.4'teki F3-C maddesinin gerçekleşmesi.

**Ne yapar.** Kalıcı hafızadaki ESKİ ham anılar (konuşma, olay, terminal, sonuç) tek bir model çağrısıyla en çok 8 `olgu` +
tek bir özet anısına iner (`mind/sikistir.ts`, `Hafiza.sikistir`, `Kopru.sikistir`). Konuşma penceresi son 4 kayda iner.
İçgüdü `kopru.sikistir`: sohbet turu uyanmaz, Orion sabit cümleyle bildirir.

**Tetik.** `/compact` (ya da "hafızayı sıkıştır", TAM eşleşme; "compact diye komut var mı" tetiklemez) · otomatik: ham kayıt
> 100, plan ≥ 25, son sıkıştırmadan ≥ 15 dk, beyin boşta ve temiz sohbet değil.

**Güvenlik (hepsi testli, 4 mutasyonla doğrulandı: çözülemeyen cevapta silme, yedeği silmeden sonra alma, olgu silme,
taze kaydı koruma kaldırıldı → her biri tam bir testi kırdı).** Model cevabı çözülemez/boşsa HİÇBİR ŞEY silinmez · yedek
(`hafizaYedegi`, host: `orion-hafiza.yedek-<tarih>.json`, son 5 kalır) silmeden ÖNCE alınır, yedek yoksa sıkıştırma
yapılmaz · `olgu` anılarına, en yeni 30 ham kayda ve son 1 saatteki kayda dokunulmaz.

**Henüz ölçülmedi:** gerçek modelde (Haiku/yerel) çıktının kalitesi ve biçime uyumu. Yalnız sahte beyinle test edildi.
Eşikler (100 / 25 / 15 dk) tahmin, canlı hafıza dosyasında ölçülüp ayarlanmalı.

## 10. Orion Beyin Ofisi: nedenli uyanma, özerk tur, hafıza (2026-10-12)

Ozyn: "robot mühendisi, yazılım mühendisi, yapay zeka mühendisi, 30 mühendis perspektifinden… beyin ofisi kur… toplantı yap, test et, tekrar toplan." Ofis, forum konusu, kanıt, ön-kayıt ve üç toplantının tamamı **vault**'ta: `forum/orion-beyin0fis/` (Toplantı 1 teşhis, Toplantı 2 tasarım, Toplantı 3 sonuç), `forum/orion-beyin-yeniden-dusunme/`, ön-kayıt `kanit/on-kayit-001.md`, ölçümler `kanit/olcum-001.json`. Bu bölüm yalnızca koda yansıyanı özetler.

**Teşhis (kayıttan, B1–B10).** 12 Ekim'de 8,6 saatte 70 uyanışın 69'u kendiliğinden; 64'ü yalnız `dunya_sor`; her inisiyatif olayı 2 model turu (`ZINCIR_AZAMI = 1`: olay turu + `sor` cevabı) ve 32 görme çağrısı. Süzgeç doğru çalışıyor (1497 algının 1395'i `refleks.sonuc.rutin`). Kapılar (varlık = mesafe, nedensizlik, yanlış bütçe birimi) ve depolama politikası sorunluydu.

**Kod (commit 1a2e9f1, 62ec522, bunu izleyen).**
- `mind/inisiyatif.ts`: varlık = son girdi yaşı ≤ 10 dk (`girdiYasiMs`, mesafe değil); nedenler `acik_is` (zaman aşımına uğrayan komut önerisi, ≥ 2 dk, aynı iş TEK kez) ve `sessizlik` (ikincil); `UyanisButcesi` (saatlik ≤ 4 uyanma, ≤ 20 model-sn, ≤ 12 bin token; günlük ≤ 60 bin token; üst üste 2 boş uyanış → 30 dk devre kesici; başarısız çağrı da düşer).
- Köprü: köken=inisiyatif turunda araç kümesi `{söz, bak, jest, poz}` (`OZERK_ARACLAR`), zincir 0, özerk tura özel talimat (`OZERK`); uyanış satırına `neden`, `eylemli`; içgüdü `kopru.ozerk_dar`. `world/giris.ts`: girdi saati (tuş/fare/söz), `?inisiyatif=eski` geri alma.
- Hafıza: `mind/aniSuzgeci.ts` selam sözü saklanmaz, doğuştan komut düşük önem (3), hata dersi normalleşir (`?anipolitikasi=eski` geri alma); sıkıştırma (`/compact` + otomatik) **yalnız ÖZET** yazar, olgu yazmaz; başarısız otomatik deneme de 15 dk aralığı başlatır.
- Ölçüm araçları: `tools/sikistir-olc.ts`, `tools/ani-politikasi-olc.ts`, `fixtures/f0/ozerk*.json` (+ `f0-olc.ts --fixture`), ham sonuçlar `docs/olcum/`.

**Sonuçlar (ön-kayıt 001; küçük örneklem = yön göstergesi).**
| H | Sonuç |
|---|---|
| H1 varlık kapısı (replay) | 153 geçmiş inisiyatif olayının **9'u (%5,9)** geçerdi (ALT SINIR: tuş/fare kaydı yok) — geçti |
| H2 olay başına ≤ 1 tur | sahte beyin `sor`'a ısrar etse de 1 tur; 6 bozma testi yakalandı — geçti |
| H3 acik_is davranışı | **ilk koşu YANLIŞLANDI** (Haiku 0/4: Ozyn'e bakıp susuyor). Neden: OLAY talimatı "emin değilsen `dunya_sor` ile bak" + olay metninde "only if it still matters". Düzeltme sonrası (post-hoc, n=1): Haiku 4/4 (sessizlik 4/4), ornith 4/4 (4/4), qwen 3/4 (0/4), gemma 3/4 (0/4) |
| H4 8,6 saat "Ozyn yok" | 0 uyanış (birim testi) — geçti |
| H5 sıkıştırma gerçek modelde | Haiku'da **hiç çalışmıyordu** (araç listesi boşken `yapisalSema` `enum: []` üretiyor; claude şemayı reddediyor) → düzeltildi. Olgu çıkarımı anahtar-kelime ölçütünü %86–90 geçti ama içerik kalıcı bilgi değil geçici hata durumu (biri uydurma) → **olgu yazılmıyor**, yalnız özet: 9/9 çözülme (Haiku, qwen, ornith) |
| H6 giriş politikası | **kaldı**: selam yalnız %5,7 elendi (hedef ≥ %35), %15,8 düşük önemle; hata dersi 24 → 14. Asıl mekanizma sıkıştırma |

**Açık.** Uyanış defterinde "Ozyn tepkisi" alanı ve panel göstergesi yok (alanlar `neden`/`eylemli` var); tuş/fare girdisi karar kaydına yazılmıyor (varlığın gerçek ölçümü için gerekli); otomatik sıkıştırma canlıda açık (H5 özet-only geçti) ama canlı hafızada kullanılmadı; "terminal oku" aracı (OB12); gündem tek kaynaklı (zaman aşımına uğrayan öneri). Zayıf yerel modeller (qwen, gemma) özerk turda susamıyor: pratikte kendiliğinden turlar Haiku ya da ornith ile.

## 11. Mimari düzeltme turu (2026-10-13)

Ozyn: "plan yap, mimariyi düzeltelim, hepsini planla ve başla". Commit'ler 0e4d2ad → c135b98 (8 commit). Ofis tarafı:
vault `forum/orion-beyin0fis/` Toplantı 4, `kanit/on-kayit-002.md`, `kanit/olcum-002.json`.

**Mimari kusurlar (koddan) — düzeltildi [TEST + bozma testi].**
- Köprü düşen öneriyi not METNİNDE "zaman asimi" arayarak tanıyordu → `NiyetSonucu.kod: "onay_dustu"` (yapısal).
- "Bu iş hatırlatıldı" iki yerdeydi (kapı + köprü; ayrışınca yeni işler aç kalırdı) → tek sahip köprü.
- Kapı→köprü sırası ve olay metni kompozisyon kökündeydi, testsizdi → `uygulama/inisiyatifBaglantisi.ts` +
  `mind/inisiyatif.ts inisiyatifOlayi` (ölçüm aracı f0-olc de metni BURADAN türetir; elle kopya yok).
- **Özerk tur sözleşmesi yalnız modele gösterilen listedeydi:** sunulmayan `dunya_komut`/`dunya_sor` (yapısal ya da
  metin içinde) dünyaya gidiyordu. Köprü artık turda sunulanı uygular; sunulmayan çağrı sayılır, GERİ BESLENMEZ
  (geri besleme yeni tur açıp zinciri delerdi — ilk denemede 3 test bunu gösterdi).
- `eylemli` çağrı adlarından hesaplanıyordu (reddedilen sor da "eylem"): devre kesici hiç açılmazdı → `gorunurEylemMi`
  (sor dışı GÖNDERİLMİŞ niyet ya da konuşulan metin). 12 Ekim: boşa uyanış %4 değil **%96**.
- Karar kaydı okuyucusu `program` satırını tanımıyordu (10 günde 68 "bozuk" satır) → `TANINAN_SATIRLAR`.

**Ölçüm altyapısı [TEST].** Karar kaydına `girdi` satırı (tuş/fare/söz SAYISI, dakikalık, içerik yok; OB13) ve
`sikistirma` satırı. `tools/karar-ozet.ts` kendiliğinden uyanış bölümü: neden, boş oran, Ozyn tepkisi, token, model-sn,
sor izi, varlık kanıtı, `hatirla` kullanımı (OB5/14/18). Zihin duvarı canlı satırında bütçe durumu.

**Yetenek kapısı (OB15) [ÖLÇÜLDÜ].** "Sessizlik" uyanışı yalnız susabildiği ölçülen beyinde (`bridge/ozerkYetenek.ts`).
Ön-kayıt 002 (görülmemiş 8 senaryo, koşudan önce donduruldu): **Haiku 8/8 geçti; ornith 2/8 KALDI** (zaman aşımları
tekrarlanınca 4/8; sessizlik 1/4 — H3 düzeltmesi ornith'te eski sete aşırı uymuş). qwen 4/8, gemma 4/8 (ham).
**Ölçüm artefaktı:** gemma "konuşmuyor", kendi şablonunda metne `dunya_poz{poz:<|"|>duruyor<|"|>}` yazıyor; f0 bunu söz
sayıyordu, CANLI köprü de tanımıyor ve çöpü sesli okuyordu (kayıtta gemma'nın 11 böyle uyanışının 9'u). Kurtarıcı
düzeltildi (biçim 3); `tools/f0-canli-puan.ts` köprünün duyurduğunu puanlar → gemma sessizlik 8/8 (SONRADAN). Tablo:
Haiku, gemma izinli; ornith, qwen izinsiz.

**Canlı uçtan uca (ilk kez) [ÖLÇÜLDÜ, n=1].** Haiku, duman kipi, `ORION_INISIYATIF_SN=20`, 5 dk: 20. ve 40. sn'de iki
sessizlik uyanışı, ikisinde de sustu (çağrı, sor, takip turu yok); 2 boş uyanışta devre kesildi, kalan 4 dk uyanış
yok (`docs/olcum/d1-inisiyatif-canli-haiku.jsonl`). Koşunun gösterdiği iki hata düzeldi: (1) devre kesici doğru susmayı
cezalandırıp açık iş hatırlatmasını da kesiyordu → yalnız sessizliği keser; (2) `claude-beyin` token sayısını
`girisToken` adıyla yolluyordu, köprü `girdiToken` okuyor: **Haiku'da token tavanı hiç işlememişti** (şimdi ~4490/tur).
`otodene` 4/4, `gordene` geçti (gerileme yok).

**Açık iş hatırlatması canlı uçtan uca [ÖLÇÜLDÜ, n=1, OB21].** `ORION_OZYN_SOZU="git durumuna bak"` (8. sn'de
klavyeyle aynı yoldan söz; beden senaryosu değil), onaylı komut kipi, Haiku, 5 dk. Koşudan önce konan 4 ölçütün
4'ü geçti: öneri onay bekledi (12. sn `git status`); 91 sn sonra onaysız düştü; düşüşten tam 2 dk sonra TEK
`acik_is` uyanışı (koşu sonuna kadar ikincisi yok); Orion tek kısa söz söyledi: "Git status komutu hala bekliyor—
çalıştırmak istiyor musun?" (sor/komut yok). Arada 2 sessizlik uyanışı sustu, devre kesildi; devre kesici açık
işi kesmedi. Kusur: "hala bekliyor" yanlış, öneri o an düşmüştü (olay metni "did not decide in time" diyor; model
bunu bekliyor diye okudu). İlk iki koşu kirliydi: açık pencereye gerçek tuşlar geldi, öneri onaylandı/reddedildi
(girdi satırı bunu gösterdi: tus=4, tus=5). `docs/olcum/d1-acik-is-canli-haiku.jsonl`.

**Hafıza [ÖLÇÜLDÜ].** İlk canlı otomatik sıkıştırma ZATEN olmuş (12 Ekim 18:33, ornith, Ozyn'in oturumu): 275 → 196
kayıt, yedek alındı, özetin her iddiası silinen kayıtlarda var. Üç kusur düzeldi: yalnız konsola yazılmıştı (artık
kayıt + günlük satırı), Ozyn konuşurken konuşma penceresini 4'e kesti (artık yalnız `/compact` isteğinde), özet
500. karakterde kelime ortasında bitti (`sinirdaKes`). H6: kalan 171 söz çoğu kısa emir ("otur", "bana gel"), selam
6 tane — hedef (%35 selam) yanlış varsayımdı.

**Bulut (OB10) [görsel doğrulandı].** Olgu ve özet DERİN'de önde ve yeşil; "sığmadı" kabuğa göre
(`docs/olcum/e2-hafiza-bulutu.png`; deneme sayfası `?yalniz=hafiza`).

**Geri alındı — olumsuz sonuç [ÖLÇÜLDÜ].** `sor terminal` (OB12): önceden konan ölçüt terminal ≥ 10/16; Haiku
11/16 → **7/16** (komut önermek yerine önce okuyor; bağlamda görünen terminali de yeniden okuyor). Yama saklandı.
