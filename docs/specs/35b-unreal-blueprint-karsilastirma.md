# 35b — Unreal Blueprint karşılaştırması ve modülerlik denetimi (2026-10-22)

Spec 35'in eki. Kaynak: Epic dokümantasyonu (değişkenler, fonksiyonlar, makrolar sayfaları okundu `[ÖLÇÜLDÜ: sayfalar okundu]`). Blog yazısı (introduction-to-blueprints) 403 verdi; "Blueprint editor reference" sayfası içeriksizdi (yalnız başlıklar): editör arayüzü bölümü Epic kaynağından DEĞİL, genel bilgiden; **doğrulanmadı**.

## 1. Kavram karşılaştırması

| Unreal Blueprint | Bizde | Durum |
|---|---|---|
| Event Graph (olay düğümleri girişi) | `olay.*` düğümleri, `olay.basla` | var |
| Exec (beyaz) / veri pinleri, renk = tür | akis / sayi, metin, bool, nesne, ajan, konum, herhangi; renk editörde | motor var, renk editörde (2b) |
| **Fonksiyon**: tek exec girişi, veri girdi/çıktı, pure/impure | **desen** (`fonksiyon` grafiği, `desen.cagir`) | var; **saf (pure) desen yok** |
| **Makro**: birden çok exec ÇIKIŞI, derlemede açılır | yok | **eksik**: desen tek akışla döner; "başardı/başaramadı" iki çıkış veremez |
| Get/Set değişken, tür, varsayılan, kategori, ipucu | `degisken.oku/yaz/artir` (sayı, metin, bool) | var, **varsayılan/kategori/ipucu yok** |
| Değişken kapsamı: üye (nesne başına) / yerel (fonksiyon içi) | grafik başına, bellekte | **eksik: ajan başına ve fonksiyon-yerel kapsam** |
| Public / Instance Editable (yerleştirilen örnekte düzenlenir) | yok | **eksik** |
| Dizi / harita | yok | eksik (şimdilik gereksiz) |
| **Blueprint Class** (yeniden kullanılır tür, örnekleri çoğalır) + Level Blueprint | grafik + `NpcTanimi` (veri) ayrı; ajana grafik bağlama dilimi yok | **en büyük eksik**: "aynı nöbetçi grafiği, iki ajan, ayrı sayaç" |
| Promote to Variable (pinden sağ tık) | yok | editör işi (2b'de sonraya) |
| Reroute / Comment / Group | yok | editör işi, sonra |
| Breakpoint / Watch / Step | çalışan düğüm vurgusu (2b) | **değer izleme (watch) yok** |
| Compile adımı | anlık tür denetimi (derleme yok) | bizde daha basit |
| Function/Macro kütüphanesi | desenler tek klasör | var |

## 2. Sonuç: önerilen sıradaki işler (etkisine göre)
1. **Ajan kapsamlı değişken** + grafiği ajana bağlama ("NPC sınıfı" = `NpcTanimi` + grafik + parametreler). 300 ajan hedefi ve "iki nöbetçi" buna bağlı; bugün sayaç grafik başına, iki ajan paylaşır. → **YAZILDI 2026-10-22** (spec 35 §4g "Dilim 3": `kapsam: ajan`, `@ben`, `npc.parametre` = Instance Editable, NPC kaydı; fonksiyon-yerel kapsam YAPILMADI; canlıda görülmedi).
2. **Çok akış çıkışlı desen (makro)** ve **saf desen**.
3. Değişkene varsayılan değer / ipucu; Instance Editable parametre.
4. Editör: watch (değer izleme), Reroute, Comment, "Promote to variable".

## 3. Modülerlik denetimi `[ÖLÇÜLDÜ: import grafı çıkarıldı]`
Araç: `uygulama/graf`, `uygulama/ajanlar`, `uygulama/yapi` içe aktarma grafı (test dosyaları hariç).
- **Döngü yok.** `graf/` hiçbir `ajanlar/` ya da `yapi/` dosyasını içe aktarmıyor (motor sahneden/arayüzden bağımsız) — iyi.
- Yön: `yapi → graf`, `yapi → ajanlar`, **`ajanlar → graf`** (ters yön, küçük): `ajanKaydi.ts` ve `flashBaglantisi.ts`, `grafYetenegi.ts`ten `AjanGovdesi` tipini ve `okumaSuresiMs`i alıyor. Ajan kavramı program motorunu bilmemeli; ikisi de ajanlara ait kavram.
  - **Düzeltildi:** `AjanGovdesi`, `govdeDurumundan`, `okumaSuresiMs` → `uygulama/ajanlar/ajanGovdesi.ts`; graf → ajanlar tek yön. Bekçi: `tools/grafYonBekcisi.test.ts` (ajanlar/ graf'ı, graf/ yapi/'yi ve DOM'u içe aktaramaz; mutasyonla doğrulandı).
- Düğüm türleri kayıt olarak ekleniyor (olay/durum/dünya/ajan paketleri; yeni tür = yeni kayıt + `kutuphane.ts`te bir satır) — modüler.
- Sapmalar: (a) `GrafYetenegi` tek arayüzde büyüyor (ajanlar, nesneler, çapalar, diyalog, ajan durumu, Ozyn): paket başına dar yetenek arayüzü (`DugumTanimi<Y>` zaten genel) olmalı; (b) `uygulama/yapi/grafSekmesi.ts` 368 satırdı: CSS `grafSekmesiStili.ts`e ayrıldı, `el()` editörün `dom.ts`inden ortak (322 satır; kalan fazlalık başlık yorumu ve kart/ üst çubuk kablosu); (c) `BOOL` pin yardımcısı iki dosyada ayrı tanımlıydı → düzeltildi (`durumDugumleri.ts` tek kaynak).
