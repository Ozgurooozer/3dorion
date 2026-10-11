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
