# Spec 08 — Karar kaydı ve içgüdüler (KT1)

Tarih: 2026-09-27 · Durum: uygulandı `[TEST]`; canlı doğrulama `[ÖLÇÜLDÜ]` aşağıda.
Yetki: Ozyn, 2026-09-27: "tüm izinlerin var. Kayıt ekleyeceksen bunu içgüdü kuralları olarak, doğuştan gelen
kurallar olarak ekleyebilirsin."
Üst belge: `brain-lab/BUYUK-RESIM.md` §5 (KT1 → KT2 öğrenen kapı → KT3 gölge kip).

## Neden

Hedef, Orion'un LLM'inin etrafında deneyimden öğrenen, kararlarını kaydeden ve büyüyen bir karar mekanizması. Bugün
bu mekanizmanın elle yazılmış bir hali var (dikkat, refleks, köprü, onay kapısı), ama öğrenecek verisi yoktu:

- `ORION_KAYIT` yalnızca LLM'in girdisini ve çıktısını tutuyor.
- Hangi algının kapıda düştüğü, hangi kuralın düşürdüğü, LLM uyandığında ne yaptığı ve yaptığının nasıl bittiği hiçbir
  yerde birlikte durmuyordu.

Orion'un kendi dersi de aynı yönde (spec 01): kural süzgeci elle yazılmış sınavda %100 aldı, gerçek terminalde tek bir
`npm test` beyni 11 kez uyandırdı. Elle yazılmış sınav yetmiyor; gerçek kayıt gerekiyor.

## İçgüdüler (`mind/icgudu.ts`)

Ozyn'in modeli (2026-09-26): "Ana bir bölge var, bu kurallar hiç değişmiyor. Etrafında diğer bölgeler gelişiyor."

- **Ana bölge:** Orion'un kapısındaki elle yazılmış kurallar. Her birine kalıcı bir kimlik verildi: 32 içgüdü.
  - 2026-09-28'de iki eklendi: `refleks.sonuc.elle_hata` ve `kopru.refleks` (spec 10 Faz D).
  - İlk yazımda "34" deniyordu; koddaki sayı 30'du.
  Her karar, onu hangi içgüdünün verdiğini taşır.
- **Etrafı:** öğrenilen kurallar (KT2) bunların etrafında büyür ve aynı kayda kendi kimlikleriyle yazılır.

| grup | örnek kimlik | öğrenilmiş kural ezebilir mi |
|---|---|---|
| kayıt | `kayit` | hayır |
| köprü | `kopru.konusma`, `kopru.zincir`, `kopru.guvenli_taraf`, `kopru.refleks` (refleksin kendi adımının sonucu beyne gitmez) | hayır |
| dikkat, mekanik sınırlar | `dikkat.tik_yasak`, `dikkat.butce`, `dikkat.tekrar`, `dikkat.kisildi`, `dikkat.yerel_kanal` | hayır |
| dikkat, gürültü olay | `dikkat.onemsiz` | evet |
| refleks, sözleşme | `refleks.konusma`, `refleks.gordum.cevap` | hayır |
| refleks, içerik yargısı | `refleks.terminal.*` (9), `refleks.olay.*`, `refleks.sonuc.*`, `refleks.anlik.rutin`, `refleks.taninmayan` | evet |
| onay | `onay.insan` | hayır |

Kural: maliyet tavanı, sözleşme ve insan denetimi deneyimle gevşemez. İçerik yargıları ("bu terminal çıktısı Ozyn'i
ilgilendirir mi") deneyimle daha iyi bilinebilir. Kimlikler kalıcıdır: kural değişirse yeni kimlik alır.

## Kayıt (`mind/kararKaydi.ts`, biçim sürümü 1)

İçgüdü `kayit` doğuştandır: köprü kaydını kendisi kurar, kimse açmak zorunda değil. Kayıt davranışı değiştirmez;
yazılamazsa Orion yine çalışır ve kayıp sayılır (`sayac().kayitYazilamayan`).

JSONL; her satırda oturum kimliği `o`. Satır türleri:

- **`oturum`**: biçim sürümü, beynin adı.
- **`algi`**: algı türü; kısaltılmış özet; çıkış kodu, olay adı ve kaynağı, niyet kimliği ve durumu (sonuç algısında).
  Kapının kararı: `{ gecti, kural, gerekce? }`.
- **`uyanis`** (bir LLM turu):
  - tetikleyen algıların kimlikleri, geri besleme sayısı;
  - beyin, süre, köken (dış / inisiyatif), takip turu mu, getirilen anı sayısı, dünya zemini;
  - LLM'in düz metni ve çağırdığı araçlar;
  - dünyaya giden niyetler (kimlik ve tür);
  - reddedilen, metinden kurtarılan ve yutulan sayıları; konuşmaya çevrilen metin; hata.
- **`ogretim`** (spec 09): Ozyn'in bir kapı kararını düzeltmesi.
- **`refleks`** (spec 10 Faz D, eklemeli; sürüm aynı): bir kesin sözü LLM'e sormadan beceriyle yürüten tur.
  - Tetikleyen söz algısının kimliği ve yürütülen becerinin kimliği.
  - Onay jesti; adım değildir.
  - Gönderilen adımlar, gövdeleriyle.
  - Bitiş (başarı / hata / kesildi / zaman aşımı) ve süre.
  - Adımların sonucu, uyanıştaki gibi niyet kimliğiyle bağlanır.
- `algi` satırında spec 10'un eklemeli alanları: `soz` (söz metni ve kesinliği), `beceriGolge` (beceri hafızasının
  kararı).

Zincir kimliklerle kurulur (`mind/kararZinciri.ts`): algı → uyanış → niyet → sonuç algısı. Onay kapısının evet/hayırı
sonuç algısı olarak gelir. Tek zamana dayalı bağ Ozyn'in tepkisidir: uyanıştan sonraki 60 sn içindeki ilk söz.

Metinler baştan ve sondan korunarak kesilir: özet 500, dünya 400, metin 300 karakter; kesilen özet `kesik: true`
taşır. Tik hiç yazılmaz.

**Nereye:** köprü satırı `[KARAR] {json}` olarak konsola yazar (`KayitBeyni` ile aynı yol; renderer'ın dosya erişimi yok).
Host o satırları terminal günlüğüne basmaz; `%APPDATA%/3dorion/karar-kaydi/YYYY-MM-DD.jsonl` dosyasına ekler
(`host/kararDosyasi.js`). `ORION_KARAR_DOSYASI` tek bir dosyaya yönlendirir; deneme koşuları kendi kaydını ayrı tutar.
Başlangıçta yol `[KARAR-DOSYASI]` satırıyla söylenir.

**Taban çizgisi:** `node --experimental-strip-types tools/karar-ozet.ts [dosya|klasör] [--json]`. Çıktısı:
- algı türüne ve içgüdüye göre kapı kararları;
- uyanışların kaçının eylemle bittiği;
- boşa uyanışın hangi içgüdüden geldiği;
- niyetlerin akıbeti, onay sonuçları ve Ozyn'in tepkisi.

## Kabul ölçütleri

| | ölçüt | durum |
|---|---|---|
| K1 | Her kapı yolu tek satır ve doğru içgüdüyle yazılıyor: zincir, süzgeç (kimlikli ya da düz), süzgeç çöküşü, dikkat, konuşma, geçen algı. | `[TEST]` `bridge/kopruKarar.test.ts` |
| K2 | Davranış aynı: patlayan yazıcıyla da beyin aynı girdileri görüyor, aynı niyetler çıkıyor. Eski 1435 testin hepsi yeşil (toplam 1519). | `[TEST]` |
| K3 | Yazıcı patlarsa köprü çalışmaya devam ediyor ve kayıp sayılıyor. | `[TEST]` |
| K4 | İçgüdü kimlikleri tek kaynak. Refleksin her kararı listede; listedeki her refleks kimliği bir girdiyle üretiliyor; bir kimlik hep aynı yönde karar veriyor; dikkatin 6 sebebi listede. | `[TEST]` `mind/icgudu.test.ts` |
| K5 | Uyanış satırı tetikleyen algıları, niyet kimliklerini ve türlerini, hatayı, kökeni, takip turunu, süreyi, anı sayısını ve kurtarılan çağrıyı taşıyor. | `[TEST]` |
| K6 | Canlı koşuda dosya oluşuyor; algı → uyanış → niyet zinciri kuruluyor. | `[ÖLÇÜLDÜ]` 2026-09-27 (aşağıda) |
| K7 | Önek host ile renderer'da aynı (bekçi); host yalnızca geçerli karar satırını, günün dosyasına, sırayla yazıyor. | `[TEST]` `host/kararDosyasi.test.ts` |
| K8 | Bozma denemesi: 27 mutantın 27'si yakalandı. | `[TEST]` 2026-09-27 |

## Canlı doğrulama (K6) `[ÖLÇÜLDÜ]` 2026-09-27

İki senaryo koşuldu: `sessizdene` ve `gorudene`. Beyin qwen2.5:7b; kayıt ve hafıza ayrı dosyalarda.
- **Dosya:** iki dosya da oluştu; bozuk satır 0.
- **gorudene:**
  - Açılış afişi ve rutin dizin listesi `refleks.terminal.kod_rutin` ile düştü.
  - Gerçek kabuk hatası `refleks.terminal.kod_hata` ile geçti ve tek uyanışın tetikleyicisi oldu.
  - LLM 9,6 sn düşündü ve bir komut önerdi. Uyanış satırındaki niyet kimliği, günlükteki `[BEYIN→NIYET]` kimliğiyle
    aynı.

**Kaydın ilk koşusunda bulduğu:** `refleks.terminal.kod_uzun` ("uzun süren başarılı komut bildirilir") canlı kapıda hiç
çalışmıyor.
- Kompozisyon kökü refleksi süreyle çağırıp `[ALGI] … terfi=true` yazıyor; `sessizdene` de bu kopya kararı ölçüyor.
- Köprüdeki süzgeç ise süreyi göremiyor, çünkü terminal algısında süre alanı yok.
- `sessizdene`'de `Start-Sleep 1600 ms` için senaryo "terfi=1, geçti" dedi. Kayıt, bloğun `kod_rutin` ile düştüğünü
  gösterdi; köprü sayacı da `dusunme: 0` dedi.
- **Düzeltildi (2026-09-28, BY39):**
  - Terminal algısı süreyi taşıyor (`protocol/algi.ts` `sureMs`).
  - Süzgecin girdisi tek kaynaktan kuruluyor (`mind/refleks.ts` `refleksGirdisi`): köprünün süzgeci, kökün `[ALGI]`
    günlüğü ve çevrimdışı düzenek aynı algıdan, aynı özetle karar alıyor; bekçi testi elle kurulan girdiyi yakalar.
  - `[ÖLÇÜLDÜ]` `sessizdene`: 1,7 sn'lik başarılı komutun algısı kayıtta `refleks.terminal.kod_uzun` ile geçti ve
    uyanış hatasız bitti; anlık komutlar `kod_rutin` ile düştü.

**Elle verilen niyetin hatası (2026-09-28, BY39):** Ozyn'in tuşla ya da konsoldan verdiği niyet başarısız olunca LLM
uyanmıyor. Yeni içgüdü `refleks.sonuc.elle_hata`, ezilebilir: tek dersle "uyan" diye öğretilebilir. Niyetin kaynağı
süzgece yapıyla geçiyor (`niyetKaynagi`); özet metninden ayrıştırılmıyor. `[TEST]`: canlıda elle niyet senaryosu yok.
  - Orion'un davranışını değiştirdiği için Ozyn'in kararına bırakıldı.

## Kapsam dışı (bilerek)

- **Sağ lob:** LLM kapalıyken `yerelTepki` ile verilen kararlar. Kompozisyon kökünde çalışıyor, köprüden geçmiyor.
- **İnisiyatifin kendi kararı:** kendiliğinden düşünme fırsatı ne zaman doğuyor. Kayıtta yalnızca ürettiği olay görünür
  (`kaynak: "inisiyatif"`).
- **Tam LLM girdisi:** bu `ORION_KAYIT`'ın işi.
- **Gizlilik:** kayıt yereldir ve hafıza dosyasıyla aynı yerde durur. Terminal kuyruğundan en fazla 500 karakter taşır.
