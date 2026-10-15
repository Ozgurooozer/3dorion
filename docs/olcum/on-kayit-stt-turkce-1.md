# Ön kayıt — Türkçe konuşmadan yazıya (Whisper, yerel, CPU) (2026-10-15)

**Sorun:** Mikrofon zinciri hazır (V basılı tut → `host/dinleme.js` → Python süreci → metin → Orion `duydum`, kaynak "mikrofon"),
ama tanıyıcı Nemotron Speech İNGİLİZCE: Ozyn Türkçe konuşuyor (`docs/ACIK-ISLER.md`: "mikrofon İngilizce duyuyor"). Ozyn: "konuştuğumu direk
yazıya çevirip Orion'a verecek basit bir sistem" ve "locallerle yap" (bulut yok).

**Tasarım (en küçük değişiklik):** AYNI protokol (stdin `kayit`/`dur`/`cik`, stdout JSON satırı), yeni betik `tools/whisper-dinle.py`:
`transformers` ASR hattı, Whisper, dil Türkçe'ye KİLİTLİ, yalnız CPU (torch CPU kurulu, ekran belleği LLM ile paylaşılıyor).
Model `ORION_STT_MODEL` ile seçilir (varsayılan `openai/whisper-small`). Nemotron'a dönüş: `ORION_STT=nemotron`.
Sessizlikte uydurma metin üretmesin: tepe eşiği + bilinen "hayalet" kalıpları (Whisper'ın sessizlikte ürettiği "Altyazı M.K." gibi) atılır.

**Ölçüm düzeneği:** Elimizde Ozyn'in sesi yok; Piper `tr_TR-dfki-medium` ile 24 Türkçe cümle SENTEZLENİR (komut sözleri + sohbet +
odadaki adlar), 16 kHz'e indirilir, tanıyıcıdan geçirilir. **Sentetik ses temiz ve tek sesli: bu bir ÜST SINIRDIR, gerçek mikrofonun
sonucu değildir.** Gerçek doğrulama: Ozyn V ile konuşur (aşağıda "canlı kapı").

**Ölçütler (ölçmeden ÖNCE):**
- **S1 komut tutarlılığı (ürün ölçüsü):** komut sözü olarak yazılan 12 cümlenin tanıma çıktısı `komutCoz`/`takipEylemi`/`sohbetEylemi` ile
  AYNI kararı vermeli: ≥ 10/12 (%83).
- **S2 kelime hatası (WER, bilgi):** 24 cümlede ortalama WER ≤ %25 (sentetik, noktalama/büyük harf yok sayılır).
- **S3 hız:** 3 sn'lik cümle için çözme süresi ≤ 5 sn (CPU), model yüklemesi ≤ 30 sn.
- **S4 sessizlik/gürültü:** 6 sessiz ya da gürültü klibinden (sessizlik, beyaz gürültü, kısık gürültü, 0,2 sn tık…) HİÇBİRİ metin üretmemeli
  (0/6 uydurma).
- **S5 bellek:** süreç RAM'i ≤ 3 GB.
- **Çürütme:** S1 < 8/12 ya da S4 > 0 ise `small` yetmez; bir üst modele geçilir (`medium`) ve yeniden ölçülür; o da olmazsa sonuç olumsuz yazılır.
- **Canlı kapı (Ozyn, gerçek mikrofon):** `3dorion.bat mikrofon` → V basılı tut, "gece yap" / "yanıma gel" / "ne görüyorsun" de → tanınan
  metin altyazıda görünür ve Orion tepki verir. Geçti/kaldı Ozyn'in sözüdür; ben mikrofon olmadan doğrulayamam.

**Kapsam dışı:** sürekli dinleme, uyandırma sözü, GPU, akış (streaming) tanıma, konuşmacı ayrımı, İngilizce/Türkçe karışık kip.

## SONUÇLAR
Koşu: 2026-10-15, `tools/stt-olc.py` + `tools/stt-karar.ts`, 24 SENTETİK cümle (Piper tr_TR-dfki-medium), 6 gürültü/sessizlik klibi.
**Hepsi sentetik temiz ses: üst sınır, gerçek mikrofon değil.** Ozyn'in isteği (aynı gün): "daha küçük bir model, sesli yazma gibi"; Türkçe
BU kulakla gelir, İngilizce Nemotron'da kalır (`ORION_STT=nemotron`).

| koşu | model | düzenleme | S1 komut | WER | medyan çözme | RAM | gürültüde uydurma |
|---|---|---|---|---|---|---|---|
| 1 | small | yalnız temel | **6/12** ✗ | 0,344 ✗ | 3,0 sn | 2,2 GB | **3/6** ✗ |
| A | small | + konuşma-var-mı, tekrar/hayalet süzgeci | 7/12 ✗ | 0,312 ✗ | 3,2 sn | 2,0 GB | 0/6 ✓ |
| B | small | + komut kelime ipucu | 9/12 ✗ | 0,170 ✓ | 3,6 sn (**3 sıçrama 72–78 sn**) | 2,2 GB | 0/6 ✓ |
| C | small | + 0,5 sn sessizlik dolgusu | 10/12 ✓ | 0,135 ✓ | 3,5 sn (**4 sıçrama 56–78 sn**) | 2,2 GB | 0/6 ✓ |
| D | small | + jeton tavanı (8·sn+12) | 10/12 ✓ | 0,102 ✓ | 3,8 sn (komutta ~7 sn) | 2,1 GB | 0/6 ✓ |
| E | tiny | D ile aynı | 9/12 ✗ | 0,203 ✓ | **0,8 sn** | **0,8 GB** | 0/6 ✓ |
| F | **base** | D ile aynı | **11/12 ✓** | **0,080 ✓** | **1,4 sn** | **1,0 GB** | **0/6 ✓** |

- **Karar: varsayılan `openai/whisper-base`** (~290 MB; small'ın üçte biri). Sentetik sesle her ölçütte small'dan iyi çıktı; tiny hızlı ama komutta
  75% (eşik 83%). **S3'ün (≤5 sn)** her koşuda karşılanmadığı yer: yalnız small'daki döngü sıçramaları; base'te en kötü 3,6 sn.
- **Neden olduğu bulunan sorunlar (hepsi ölçüldü, gerçek):**
  1. **Gürültüde uydurma** (koşu 1): beyaz gürültü → "Hıhıhı…", klavye darbeleri → "izlediğiniz için teşekkürler". Çözüm: kayıtta ≥160 ms
     ardışık, taban gürültüsünün 10 dB üstünde enerji yoksa çözülmez (`konusma_var_mi`), ayrıca tekrar/sıkıştırma oranı ve "hayalet" kalıp süzgeci.
  2. **Kod çözücü tekrar döngüsü** (koşu B–C, ipucuyla kısa komut): "gündüz yap. gündüz yap. …", 448 jetona kadar, 60–77 sn. Çözüm: çıktı
     uzunluğu kayıt süresine bağlı (jeton tavanı). Tekrar testinde 7 çağrıda sıçrama 0.
  3. **Yanlış komut tehlikesi:** ipucuyla "gece yap" bir çağrıda "gündüz yap"a döndü (ipucundaki yakın kelime). İpuçlu hâlde gece/gündüz karışması
     olabilir; sohbetten türeyen yanlış komut ölçümde 0 (S1 yan ölçüsü), ama gerçek sesle izlenmeli.
- **Sınırlar (dürüst):** (a) Sentetik ses; gerçek mikrofon, aksan, oda gürültüsü, nefes sesi YOK. (b) `base` küçük model: gerçek konuşmada `small`ın
  gerisinde kalması BEKLENİR, bu ölçümde görünmedi çünkü ses temiz. (c) 24 cümle, tek ses, tek koşu: genel doğruluk iddiası yok. (d) Hâlâ yanlış
  duyulan komut: "ışığı kıs" → "beşir kıs." (base).
- **Çürütme tetiklenmedi** (base: S1 11/12, S4 0). Protokol testi: gerçek süreç başlatıldı, mikrofondan `hazir` (7,9 sn) ve konuşmasız kayıtta
  `bos/sessiz` geldi, `cik` ile 0 kodla kapandı.
- **Canlı kapı: BEKLİYOR** (Ozyn, gerçek mikrofon): `python tools/whisper-indir.py` (model zaten indirildi bu makinede) → `3dorion.bat mikrofon` →
  K ile mikrofonu aç, V basılı tut, "gece yap", "yanıma gel", "ne görüyorsun" de. Geçti/kaldı onun sözüdür.
