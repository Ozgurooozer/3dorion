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
