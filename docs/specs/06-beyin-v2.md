# Orion'un Beyni v2 — Durum, Anı ve Doğruluk (Spec v1)

> Karar tarihi: 2026-09-17 · Sahip: Ozyn · Yönetici: Orion (Claude Code)
> Durum: **karar alındı** — Faz 0 (bu belge). Faz 1–5 ayrı onayla.
> Toplantı kaydı: `C:\vault\meetings\meeting-2026-09-17-orion-beyin-mimarisi\index.html`
> Önceki: `02-beyin-mimarisi.md` (iki katman: refleks / düşünce). Bu spec o
> düzeni **korur**, altına bellek katmanlarını ekler.

## 1. Neden

Orion `sor(onumde)` ile bakıyor, algı doğru cevabı veriyor, cevap beyne
ulaşıyor — ama Orion gördüğünü doğru söylemiyor. `[ÖLÇÜLDÜ]` iki koşu:

| koşu | algı | Orion'un sözü |
|---|---|---|
| 1 | yönetim terminali | "Önümde masa ve monitör, solda tahta, sağda pencere" |
| 2 | yönetim terminali | "Önümde yönetim terminali var… Yakınında da çalışma masası ve monitör görüyorum." |

`ORION_KAYIT=1` kaydı sebebi gösterdi: beyne giden girdide şimdiki gözlemin
yanında **eski oturumlardan kalma "önümde / yakın" anıları** var. 2. koşudaki
uydurma, eski bir `yakin:` anısından kelimesi kelimesine kopyalanmış.

Ölçülen kök nedenler:

1. **Anlık algı kalıcı hafızaya yazılıyor** — `bridge/kopru.ts` → `_aniIcerigi`,
   `gordum` dalı.
2. **Arama kalıptan eşleşiyor** — `mind/hafiza.ts` → `getir`. İçerik
   örtüşmesi sıfır olan `onumde: Ozyn (birkaç adım ötede)` ilgi **1,00**;
   gerçekten ilgili anı **0,16**. `[ÖLÇÜLDÜ]`
3. **Anılar zamansız ve kaynaksız sunuluyor** — model şimdiki ile eskiyi ayıramıyor.
4. **Getirme eşiği yok; ilgi göreli yayılıyor; getirilen anının tazeliği
   yenileniyor** → alakasız anı kendini besleyen bir döngüye giriyor. `[KOD]`

Nörobilimdeki adı: **kaynak izleme bozukluğu** — bilginin nereden ve ne zaman
geldiğini ayırt edememek; konfabulasyonun mekanizması.

## 2. Ürün tanımı

**Kullanıcı:** Ozyn, tek geliştirici. **Orion:** çalışma alanını paylaşan yol
arkadaşı. Tez: *"AI'ın oturduğu oda — terminalini onun masasında açıyorsun."*

**İşler, öncelik sırasıyla:**
1. Doğru algılamak ve doğru söylemek.
2. Terminalde işe yaramak — fark et, teşhis et, *öner*.
3. Süreklilik — oturumlar arası hatırla, *ne zaman* olduğunu bil.
4. Şeffaflık — zihin duvarından görülebilir ve ayarlanabilir.
5. Değiştirilebilirlik ve düşük maliyet.
6. *(sonra)* İnisiyatif.

**Orion ne değildir:** komut çalıştıran otonom ajan · genel sohbet botu ·
terminaldeki `claude`'un yerine geçen kod ajanı · insan beyni simülasyonu ·
çok kullanıcılı sistem.

| ölçüt | hedef |
|---|---|
| **Sadakat** — gözleneni söyler, gözlemde olmayanı söylemez | ≥ %90 |
| Uydurma oranı | ≤ %5 |
| Onaysız çalışan komut | **0 — değişmez** |
| Refleks gecikmesi | < 1 sn — korunur |
| Boşta beyne giden mesaj | değişmez (`tik` yasağı) |

## 3. Kararlar

Gerekçelerin tamamı toplantı kaydında.

- **K1** Öncelik: sadakat > inisiyatif.
- **K2** **Durum ≠ anı.** Anlık algı *çalışma belleğine* (üzerine yazılır,
  azami yaşı var); *epizodik hafızaya* yalnızca olaylar.
- **K3** Her bilgi zaman ve kaynak taşır ve modele öyle sunulur.
- **K4** Getirme eşiği mutlaktır; ilgi adaylar arasında göreli yayılmaz.
- **K5** Tazelik yalnızca eşiği geçen getirmede artar (atıf gelince: kullanılanda).
- **K6** IDF yalnızca ölçüm gerektirirse.
- **K7** Ölçüm önce; her fazın kapısı bir sayı; aynı anda tek değişken.
- **K8** Bağlam sözleşmesi: SABİT · ŞİMDİ · HATIRLANANLAR · BU TUR.
- **K9** Sabit teller değişmez: onay kapısı, `tik` yasağı, yakınlık kuralı.
- **K10** Kapsam dışı: vektör DB yığını, planla-dağıt-birleştir, podcast.

## 4. Mimari

```
DUYU (algiHizmeti, terminal, konuşma)        her örnek: {içerik, t, kaynak}
   │
TALAMUS (suzgec + dikkat)                    değişmez
   ├─► REFLEKS (kurallı, yerel)              değişmez   ← 02'nin 1. katmanı
   ├─ durum ─► ÇALIŞMA BELLEĞİ  [YENİ]       üzerine yazılır, azami yaş
   └─ olay ──► EPİZODİK HAFIZA (hafiza.ts)   yalnızca ekleme, zaman damgalı
   │
BAĞLAM KURUCU (kopru.ts)                     SABİT / ŞİMDİ / HATIRLANANLAR / BU TUR
   │
DÜŞÜNCE (SecilebilirBeyin)                   ← 02'nin 2. katmanı
   │
niyetiYurut (tek yol) → onay kapısı          değişmez
   │
TEST NOKTALARI: zihin duvarı · kayıt · tekrar oynatma · sadakat ölçer [YENİ]
```

**Durum mu olay mı — ayrım kuralı:** Bilgi, dünya değiştiğinde **yanlışa
dönüşüyorsa** durumdur (önümde ne var, Ozyn nerede, terminalin son hâli).
Olduğu anda olmuş ve öyle kalacaksa olaydır (Ozyn şunu dedi, komut şu kodla
bitti, Orion şunu önerdi).

### Bağlam sözleşmesi — hedef biçim

```
SABİT          kimlik · oda çapaları (görünen adlarla)
ŞİMDİ          konum · Ozyn · vakit · önünde: yönetim terminali (3 sn önce baktın)
HATIRLANANLAR  [2 gün önce] Ozyn git log çalıştırdı      (yalnızca eşiği geçenler)
BU TUR         Baktın (önümde): yönetim terminali (birkaç adım ötede)
```

Bugünkü karşılığı `bridge/opencode.ts` → `_dusun`: `sistem` = talimat + sabit;
`kullanici` = dunya + "Hatirladiklarin" + ozetler. Bölüm adları beyinden
bağımsızdır; her `Beyin` uygulaması aynı alanları alır (`BeyinGirdisi`).

## 5. Fazlar

Her faz ayrı onayla başlar; sonunda durulur ve sayılar raporlanır.

| faz | ne | kapı |
|---|---|---|
| **0** | Bu belge + toplantı kaydı | Ozyn onayı |
| **1** | Sadakat ölçer: `tools/sadakat.ts` (belirleyici puanlayıcı) + `fixtures/sadakat/` (gerçek kayıttan A/B) + `tools/sadakat-olc.ts` (tekrar oynatıcı) | Kalibrasyon testi yeşil (bugünkü iki gerçek çıktı); A için taban çizgisi |
| **2** | Nedensellik: A (eski anılarla) vs B (anılarsız), N=10 | A sorunu göstermiyorsa test geçersiz. B belirgin iyiyse → 3; değilse **tanı yanlış, dur** |
| **3** | Çalışma belleği (K2): `mind/calismaBellegi.ts`; `gordum` hafızaya yazılmaz; yedekli tek seferlik eski kayıt temizliği | Girdide bakış biçimli anı 0; sadakat B koluna yakın |
| **4a** | Anılara göreli zaman (K3) | Ayrı ölçüm, sadakat düşmez |
| **4b** | Görünen adlar: `onumde` → "önümde", sabit çapa listesi etiketlerle | Ayrı ölçüm |
| **5a** | Mutlak getirme eşiği (K4) | İçeriksiz anı dönmez; ayrı ölçüm |
| **5b** | Tazelik yalnızca eşiği geçene (K5) | Eşiği geçmeyenin `sonErisim`i değişmez |
| **5c** | IDF (K6) — yalnızca 5a sonrası kalıp eşleşmesi sürüyorsa | Ayrı ölçüm |

**Puanlayıcı seçimi (Faz 1):** LLM hakem elendi — aynı sadakat sorununu
taşır, kota yer, varyans ekler. Belirleyici etiket eşleştirme seçildi; bilinen
sınırı eş anlamlılar (her etiket için varyant listesi tutulur).

## 6. Sonraki spec — yalnızca yön

Konsolidasyon (epizodik → semantik, kaynaklı) · doğrulanmış atıf (`[ani:12]`,
kimliğin var olduğu kontrol edilir) · gömme (`nomic-embed-text` kurulu) ·
inisiyatif (çalışma belleğini okuyan, fayda puanlamalı ajanda).

## 7. Riskler

- **Ücretsiz kota:** Faz 1–2 ~20–30 çağrı. 429'da dur, raporla.
- **Tek fixture yanıltabilir:** Faz 3 sonrası en az iki farklı konumdan kayıt.
- **Kalıcı veri:** temizlik yedeksiz çalışmaz; geri dönüş = yedeği geri yaz.
- **Kapsam kayması:** §6 bu spec'te başlatılmaz.
