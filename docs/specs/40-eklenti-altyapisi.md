# Spec 40 — Eklenti (plugin) altyapısı + "Düşünme kipi" (P = NP / P ≠ NP)

Durum: E1–E4 YAZILDI (2026-10-28); E5 ölçüm KAPANDI (2026-10-29): 0 KABUL, "kanıt yok", kip KAPALI (§7). Canlı senaryo (`eklentidene`) KOŞULMADI. Sıradaki aday: deterministik geri dönüş (§7 sonu, ayrı ön kayıt). İstek: Ozyn, 2026-10-28 ("İstisna": ODAK dönemi, motor özellikleri eklenti).

## 1. Karar
- Eklenti = **depo içi, derleme zamanı kayıtlı modül**. Dış klasörden JS yükleme YOK (güvenlik; gerekirse ayrı spec).
- Mevcut motor özellikleri de eklenti: açılıp kapanır, **alternatifi olmasa bile**. Varsayılan hepsi AÇIK = bugünkü motor.
- Orion eklentileri değiştiremez: araç yüzeyinde (`bridge/araclar.ts`, `protocol/niyet.ts`) YOK. Yalnız Ozyn, Ayarlar ▸ Eklentiler'den.

## 2. Parçalar
| Parça | Dosya |
|---|---|
| Sözleşme (sıfır bağımlılık, `EKLENTI_SURUMU`) | `protocol/eklenti.ts` |
| Defter (saf): kaydet/baslat/ac/kapat/secenekYaz, bağımlılık, kilit, kalıcılık | `uygulama/eklenti/eklentiDefteri.ts` |
| Arayüz modeli (saf) + Ayar bölümü (DOM) | `uygulama/eklenti/eklentiModeli.ts`, `uygulama/ayar/eklentilerBolumu.ts` |
| Mevcut özellikler: `hafiza-yonlendirici`, `ajanda`, `flash`, `panel-icerik`, `panel-outliner`, `panel-onizleme` | `uygulama/eklentiler/mevcutOzellikler.ts` |
| Köprü kancaları (talimat eki + niyet doğrulama) | `bridge/kopruKancalari.ts`, `bridge/kopru.ts` |
| Düşünme kipi + doğrulayıcı | `uygulama/eklentiler/dusunmeKipi/{dusunmeKipi,dogrulayici}.ts` |
| Senaryo | `3dorion.bat eklentidene`, `ORION_EKLENTI="id:1,id:0,id=secenek"` |

Kurallar: ortam > kayıt > varsayılan; bağımlısı açıkken kapatılamaz; `kilitli` kapatılamaz; `kur` fırlatırsa kapalı sayılır, hata görünür, ötekiler etkilenmez.
`etki: "yeniden_baslat"` (hafıza yönlendirici, Flash) sahte anında GÖSTERİLMEZ: panel "kapanacak · yeniden başlat" der. Kalıcılık localStorage `orion.eklentiler.v1`; senaryoda yazılmaz.

## 3. Düşünme kipi (deney kolu — metafor, karmaşıklık iddiası DEĞİL)
Varsayılan **KAPALI**. Açılınca seçenek:
- **P ≠ NP · Doğrulayıcı** ("doğrulamak çözmekten ucuzdur"): talimata tek satır + LLM'siz kurallar. Ret modele geri döner (mevcut ret yolu, en çok 2 ardışık).
  V1 aynı beden eylemi hemen tekrar · V2 aynı söz (son 3 söz, normalize) · V3 komut gerekçesi < 6 harf.
- **P = NP · Çözücü** ("doğrulayabiliyorsan çözebilirsin"): yalnız talimat eki (doğrudan, tek net eylem); doğrulama yok.
Kanca köprüde her turda canlı okunur (aç/kapa anında). Kancasız köprü talimatı birebir aynı (test). Karar kaydına `kip` ve `kancaReddi` isteğe bağlı alanları yazılır.
Zihin duvarı: açıkken başlıkta rozet (`ZİHİN AKIŞI · P≠NP`); kapalıyken Orion şemasının aynı nesnesi.

## 4. Bilerek yapılmayanlar
- Planda olan **hedef sınaması** ve **söz-eylem tutarlılığı** kuralları düşürüldü: protokol (`capaCoz`, `dogrula.ts`) ve mevcut "söyledi ama yapmadı" bekçisi zaten örtüşüyor.
- **`eklenti.dogrulayici` içgüdü kimliği** açılmadı: ret bir kapı kararı değil; sayaç + `kancaReddi` yeterli.
- **NİYET → DOĞRULA → BEDEN ara düğümü** çizilmedi: düğümü yakacak olay bağlanmadan çizmek sahte gösterge olurdu.
- Kapsam dışı: Sekans/Graf editörü, yan sekmeler, dış klasörden eklenti.

## 5. Doğrulama
- `[TEST]` defter 15, model 4, mevcut özellikler 4, kanca 5+4, doğrulayıcı 7, kip 7; tam `npm test` taban dışında yeşil; `tsc` temiz.
- `[TEST]` bozma denemesi: defter 19/19; doğrulayıcı/kip/kanca 19 mutantın 17'si yakalandı, ikisi için: biri test eklenip yakalandı (söz halkası), biri eşdeğer (`k &&` koruması boş sözü zaten halkaya almıyor).
- `[YAZILDI-KOŞULMADI]` `eklentidene` (K1–K6) ve gerilemeler (`projedene`, `dokdene`, `icerikdene`, `sekansdene`, `kameradene`, `grafdene`): pencere açar, oyun kapalıyken.

## 6. E5 — ölçüm (yapıldı, sonuçlar §7)
Kip faydası ölçülene dek KAPALI. `tools/kip-olc.ts` + `docs/olcum/on-kayit-dusunme-kipi.md` (eşik ÖNCEDEN yazılır, sonuca bakıp değişmez): üç kolda (kapalı/çözücü/doğrulayıcı) doğru eylem oranı, reddedilen çağrı, tur başı token, gecikme. Yerel/`dis` beyin; ücretli beyin Ozyn onayı olmadan YOK.

## 7. E5 sonuçları (2026-10-28, `gemma4:e2b`, n=5, sahte dünya; ön kayıt `docs/olcum/on-kayit-dusunme-kipi.md`)
- **Ölçüm 1** (5 söz, tek tur): üç kolda A=67 B=50, ret=0 → ön kayıtlı karar **RED/RED**; kipler hiç sınanmadı (model tek hatada durdu).
- **Tuzak-2** (oda tarifi dünyanın reddettiği hedefi gösterir, 3 ardışık söz): kapalı H=3,00 · Çözücü H=3,40 · Doğrulayıcı H=3,20 (ret 10); hiçbir kolda `soyle` yok (S=0) → **Doğrulayıcı RED**, Çözücü yalnız gözlem (fark yok).
- Okuma: Doğrulayıcı gerçekten devreye girdi (10 ret) ama `gemma4:e2b` ret mesajındaki geçerli hedef listesini kullanmadı; `bak(tahta)` gibi olmayan bir ada kaydı, sonra eski hedefe döndü. Not: sahte dünya `tahta` takma adını reddeder, gerçek oda kabul edebilir.
- Karar: kip varsayılan KAPALI kalır. Daha güçlü modelle (ör. `gemma4:e4b`, `qwen3:4b`) tekrar ölçmek ayrı ön kayıt ister. Tek model, n=5: genelleme yok.

### Çok modelli tuzak-2 (n=5, üç kol; ön kayıt: `on-kayit-dusunme-kipi.md` son ek bölüm)
| model | kapalı H / S% | Doğrulayıcı H / S% / ret | karar |
|---|---|---|---|
| gemma4:e2b | 3,00 / 0 | 3,20 / 0 / 10 | RED |
| gemma4:e4b | 3,00 / 100 | **1,40** / 80 / 10 | RED (H şartı sağlandı, S −20 puan > −10 sınırı) |
| qwen3:4b | 0,00 / 60 | 0,00 / 20 / 1 | RED (tuzağa düşmedi) |
| nemotron-3-nano:4b | 0,40 / 60 | 1,20 / 0 / 7 | RED (kipten KÖTÜLEŞTİ) |
| phi4-mini | 0,80 / 100 | 0,40 / 60 / 0 | BELİRSİZ (R=0) |
| lfm25-tb | 0,00 / 0 | 0,00 / 0 / 0 | BELİRSİZ (R=0) |
- Genel hüküm (ön kayıt: ≥3 ölçülebilir modelin yarısı KABUL): **0 KABUL → "kanıt yok"**. Kip varsayılan KAPALI kalır.
- Gözlem: tuzağa yalnız iki gemma düştü (kapalı H=3); öteki dört model kendi başına durdu. Ret mekaniği çalışıyor (gemma4:e4b'de hata yarıdan fazla azaldı) ama "ret → modelin kendi düzeltmesi" modele bağlı: e4b'de işe yarıyor, nemotron'da kötüleştiriyor, e2b'de etkisiz.
- Mimari okuma: kanca yeri (köprü `_ciktiyiIsle`) doğru; zayıf halka reddin düzeltmeyi modele bırakması. Aday (ÖLÇÜLMEDİ, ayrı ön kayıt ister): ikinci ardışık retten sonra modele sormadan deterministik geri dönüş (ısrarı kesip Ozyn'e tek cümle söyletmek).
