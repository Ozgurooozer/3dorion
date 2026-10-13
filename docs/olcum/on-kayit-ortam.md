# Ön kayıt — `dunya_ortam` aracı (2026-10-13, koşudan ÖNCE)

**Soru.** Orion'a ova'nın ışığını/rengini/stilini/zamanını değiştiren tek bir araç (`dunya_ortam {ne, deger?, sayi?}`,
~190 token) eklendi (8996be6). Sözlük ("gece yap", "saat 21") bunu token'sız yapıyor; ama sözlüğün bilmediği serbest ifadede
("burası çok karanlık", "romantik bir hava ver") karar LLM'de. İki şey ölçülür: (1) LLM bu araçla işi DOĞRU yapıyor mu,
(2) aracı eklemek zayıf modelin MEVCUT becerisini bozuyor mu (her tur sabit +190 token ve +1 araç).

**Düzenek.** `tools/f0-olc.ts`, canlı köprüyle AYNI araç tablosu/talimat/bağlam. Set: `fixtures/f0/ortam.json` (8 serbest
ifade; sözlük hiçbirini sahiplenmiyor — doğrulandı). Puanlama `tools/f0.ts`: `dunya_ortam` çağrısı + `ne` kalıbı +
`ortamGecerli` (çağrı gerçekten uygulanabilir: protokol doğrulaması geçer ve `ortamUygula` fırlatmaz — uydurma stil/efekt adı
ya da sayısız saat KALIR) + yasak çağrı yok (`sor`, `komut`, `git`). Gerileme seti: `fixtures/f0/senaryolar.json` (28
senaryo). Taban kolu: aynı koşu `--cikar=dunya_ortam` (araç sunulmaz).

**Hipotezler ve ölçütler (donduruldu).**
- **H-O1 (yapabiliyor mu).** Haiku (`--beyin=dis`, yapısal kip) ortam setinde n=3 → **≥ 18/24** deneme geçer (≥ %75;
  8 senaryoda ≥ 6/8 ile aynı oran). Yerel modeller (gemma4:e2b, qwen2.5:7b, ornith-32k) için **BİLGİ**: sayı raporlanır,
  kapı DEĞİL (yerel model başaramazsa sözlük ve öğrenen sözlük zaten token'sız yolu açar).
- **H-O2 (zarar vermiyor).** Her model için mevcut 28 senaryoda, araç VAR kolunun geçen sayısı ≥ araç YOK kolunun
  geçen sayısı − `izin`; `izin` = deneme sayısının %5'i yukarı yuvarlanmış (n=2 → 56 denemede 3; ornith n=1 → 28'de 2).
  Modeller: Haiku n=2, gemma4:e2b n=2, qwen2.5:7b n=2, ornith-32k n=1 (yavaş).
- **H-O3 (yanlış kullanım).** Gerileme setinde (ortam GEREKMEYEN 28 senaryo) `dunya_ortam` çağrısı yapılan deneme sayısı
  ≤ **%3** (araç gereksiz yere çağrılmasın). Ham sonuçta sayılır.
- **Karar kuralı.** H-O2 bir modelde geçmezse o model için aracı `cikarilanAraclar` ile çıkaracağız (sözlük orada yine
  çalışır) ve sonucu yazacağız; H-O1 Haiku'da geçmezse araç açıklaması bir kez (önceden belirtilmemiş bir düzeltme olarak
  YENİ ön-kayıtla) gözden geçirilir. H-O3 geçmezse araç açıklaması sıkılaştırılır, yeniden ölçülür. Olumsuz sonuç da yazılır.

**Bilinen sınır (önceden).** n küçük: yön göstergesi, istatistiksel kanıt değil. Setin 8 ifadesi ben yazdım (ayar yapılmadı
ama bağımsız bir göz yok). Haiku ve yerel modelin "doğru" saydığı yanıtın ova'da GÖRÜNÜR iyi bir sonuç verdiği ayrıca
doğrulanmadı (yalnız uygulanabilirlik ölçülür); görsel doğrulama canlı senaryoda (F4).
