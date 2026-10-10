# Spec 23 — Level yönetimi, kalıcı kayıt ve Orion için anlam

> Durum: **Faz A uygulandı** (2026-10-10). Faz B (nesnelere anlam) onay bekliyor; C (Orion'u level'a taşımak,
> spec 24) ve D (düzenleme niyeti) tasarım olarak sabit.
> Deneme: `npm run editor-dene` (46 adım; 10'u level yönetimi).

## 0. Neden
Spec 22 editörü bitince Ozyn "eksiklerimiz neler?" diye sordu; öncelik önerisi (Ozyn: "istediğinden başla"):
önce level yönetimi + kalıcı kayıt (her şeyin zemini), sonra nesnelere Orion için anlam ve editör komutlarını
Orion'a açmak (projeyi diğer editörlerden ayıran şey). Ozyn: "önce planla; kod mimarisini göz önünde bulundur."

## 1. Mimari (bu iş katmanlara nasıl oturuyor)
```
host/levelDosyasi.js        KABUK, saf Node: listele/oku/kaydet/oluştur, atomik yazım (.tmp → rename), ad kuralı,
                            var olanı ezmeme (409), olmayanı "kaydet"meme (404). Silme yok. TEK yer: dev ara
                            yazılımı bugün, Electron ana süreci (IPC level:*) editör pakete girince aynı modül.
tools/vite-level.ts         GELİŞTİRME: /__level/* → host modülü; İÇERİK doğrulaması burada (levelTanimiDogrula,
                            parcaOku) çünkü host world'ü import etmez. vite.config yalnız kayıt eder.
world/level/depo/           ÖN: LevelDeposu ARAYÜZÜ (saf) + httpDeposu (dev). World dosyaya dokunmaz; depo
                            kompozisyon kökünde (editorSayfasi.ts) seçilir.
world/level/editor/…        editör depoyu görür: level menüsü, hazır yapılar, kaydet; çekirdekte saf kurtarma kararı.
```
Kural: diske yazmak her zaman insanın eylemi (Ctrl+S, "yeni", "farklı kaydet"); kurtarma kopyası diske değil
tarayıcıya yazılır ve kendiliğinden uygulanmaz.

## 2. Ne var
- **Genel sayfa:** `world/level/editor.html?level=<ad>` (`editorSayfasi.ts`); `ova-deneme.html` aynı modülü
  `level=ova` ile açar (araçlar o adrese bağlı). `window.ova` adı korunur (deneme betikleri).
- **Kamera açıları veri:** ova'nın sabit açıları (ufuk, alcak, tepe, gunes, gol) artık `kameraYerleri`nde, yuva
  1–5. Yer imine `yuva?` (Shift+rakam) ve `zemineGore?` (y zeminden yükseklik: arazi düzenlenince göz yüksekliği
  korunur) eklendi; eski biçim (ad = rakam) geçerli. `?aci=<yer imi adı>`; yoksa 1. yuva, o da yoksa merkez.
  Doğrulama: yuva 1–9, aynı yuvaya ya da aynı ada iki yer imi yok.
- **Level menüsü** (araç çubuğunda level adı): Aç (liste: boyut, son değişme) · Yeni (bu level'ın kopyası —
  nesneli/nesnesiz — ya da şablon: `world/level/sablon/bos.level.json` = gök, güneş, bulut, göl­süz zemin, çim,
  havadakiler) · Farklı kaydet · Dosyadan yeniden yükle (panelden buraya taşındı). Görünen ad serbest; klasör adı
  `adDuzelt` (Türkçe harf sadeleşir: "Işıklı Çarşı" → `isikli-carsi`). Level değiştirmek sayfayı yeniden yükler;
  kirliyse sorar.
- **Kurtarma:** kirliyken 3 sn sessizlikte tanımın kopyası tarayıcıya; kaydedince silinir. Açılışta kopya dosyadan
  farklıysa şerit: tarih, nesne farkı, "dosya o zamandan beri değişti" uyarısı · [Kurtar] (tek geri al adımı,
  kaydetmez) · [Sil]. Farklı kaydet eski level'ın kopyasını siler (değişiklikler artık yeni level'da).
- **Bekçi:** `world/level/leveller.test.ts` — her level ve şablon: geçerli, modüller kayıtlı, renkler çözülüyor,
  zemine bağlı katmanlar zeminden sonra. (`ova.level.test.ts`'te yalnız ova'nın üçgen bütçesi kaldı.)
- **Testler:** `host/levelDosyasi.test.ts` (11), `depo/levelDeposu.test.ts` (adDuzelt; host kuralına uyum),
  `editor/cekirdek/kurtarma.test.ts` (9), yer imi uyumu (cekirdek.test, donusum.test).
- **Canlı [ÖLÇÜLDÜ]** `npm run editor-dene` 46/46: yeni level (şablondan) açılır ve diskte · Ctrl+S yeni level'a
  yazar · kirliyken kopya yazılır · yenilemede şerit · Kurtar nesneyi geri getirir (kaydetmeden) · farklı kaydet
  yeni level'ı 2 nesneyle açar ve eski kopyayı siler. Denemenin açtığı klasörler sonunda silinir.

## 3. Yapılmayanlar (Faz A)
- Electron IPC deposu: `host/levelDosyasi.js` hazır ve testli, ama editör pakete girmedi (build yalnız
  `index.html`); kanal ve preload köprüsü editör Electron'a girince (spec 24 ile) eklenecek.
- Geri al geçmişi sayfa yenilenince kaybolur (kurtarma son hâli korur, adımları değil).
- Level silme / yeniden adlandırma (geri alınamaz; elle).

## 4. Sonraki fazlar (tasarım, plan: Faz B–D)
- **B — anlam:** `NesneYeri.anlam?: { tur?, etkilesim?: ("bak"|"git"|"otur"|"al")[], not? }`; katalog varsayılanları
  veri (`assets/sehir/anlam.json`); `nesneKaydi.ts`in `Nesne` biçimini level'dan üreten saf `levelNesneleri`;
  editörde "Orion için" bölümü ve anlamsız nesne denetimi.
- **C — Orion'u level'a taşımak:** ayrı spec 24 (oda = bir level; `giris.ts` level çekirdeğiyle).
- **D — düzenleme niyeti:** `protocol/niyet.ts`e `{ tur: "duzenle"; islem: koy|tasi|dondur|sil; …; gerekce }`,
  `YAZAN_NIYETLER`, `dogrula.ts`, `bridge/araclar.ts` satırı; yürütme `niyetiYurut` → editörün saf komutları →
  `durum.degistir("Orion: …")` (geri alınabilir); diske yalnız Ozyn. Açık sorular: doğrudan mı, önce hayalet
  öneri + onay mı (öneri: onaylı başla); Electron'da level'lar nerede (öneri: geliştirmede repo, pakette
  kullanıcı verisi + paketli varsayılanlar).
