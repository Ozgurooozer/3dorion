# Spec 43 — Aktör + bileşen şeması + aktör grafı + hata ayıklama (Unreal Actor/Component/Blueprint)

Durum: 2026-10-29 "istisna" (Ozyn: "bitirene kadar durma, alt ajan/skill serbest"). Önceki: spec 42 (ışık aktörleri), spec 35 (graf), spec 28/30 (seçim, gizmo).
İlerleme: A1 ✔ A2 ✔ A3 ✔ A4 ✔ (kesme noktası yalnız akışlı düğümde ve yalnız kullanıcı tetikli çalışmada; Devam/Adım yalnız `isTrusted`; günlük bellekte 200 satır). A5 ✔ (yalnız nesne aktörü paneli: `uygulama/yapi/level/nesnelerPaneli.ts`, liste + Details + graf ▶ ■; değişiklikler oturum içi). Mesh/ses/tetik bileşenleri YAPILMADI (§9: `nesneSistemi.ts`). Koşulmayanlar: `DOGRULAMA-DEFTERI.md` K18–K21.
**İlerleme (2026-10-29):** A1 ✔ (25/25 mutant), A2 ✔ (`leveldene` 12/12), A3 ✔ (`aktordene` 7/7, 32/32 mutant, tam paket 5540/0), A4 yazılıyor. Kod: `uygulama/graf/{aktorDugumleri,aktorCalistirici}.ts`, `uygulama/aktorYetenegi.ts`; düğümler yeni `aktor` kategorisinde.

## 1. İstek
"Her cisim bir obje. Bir obje ekle, çift tıkla, blueprint grafı açılsın, istediğin bileşeni ekle; event graph'ta kendi grafımız gibi kodla; level'da seçince yanda özelliklerde
bazı değişkenleri değiştirebil. Hata ayıklama bizde yok denecek kadar az." → dört dilim: **A1** bileşen şeması, **A2** Details şemadan, **A3** aktör grafı + değişkenler,
**A4** hata ayıklama (çalışma günlüğü, kesme noktası, adım adım).

## 2. Elimizde olan (okuyarak doğrulandı)
- NPC kaydı (`protocol/npc.ts`) zaten Unreal'ın "Blueprint Class + Instance Editable": ajan + graflar + örnek parametreleri; `@ben` örneği temsil eder (spec 35 dilim 3).
- Yorumlayıcı (`uygulama/graf/yorumlayici.ts`): çalışmadan önce tür denetimi, adım/süre/derinlik tavanı (1000/120 sn/5), ■ durdur, aktif düğüm olayı, hata = graf + düğüm, değişken alanı.
- Spec 42: `IsikAktoru`, `Level.isiklar`, Işıklar paneli, taşı gizmosu. `leveldene` 11/11.

## 3. Karar (kussu: iki aday)
- **A) Yeni birleşik `aktorler` dizisi** — REDDEDİLDİ: göç gerekir, `nesneler`/`isiklar` ile çift kimlik, eski level (ova) riski.
- **B) Mevcut `nesneler` ve `isiklar`'a isteğe bağlı alanlar + bileşen şeması bir GÖRÜNÜM** — SEÇİLDİ: eski level BİRE BİR aynı (alan yoksa hiçbir şey değişmez), göç yok.

Yeni isteğe bağlı alanlar (`IsikAktoru` ve `NesneYeri`): `graf?: string` (aktörün grafı), `degiskenler?: Record<string, number|string|boolean>` (örnek başına "Instance Editable";
en çok 16, ad `grafAdiGecerli`, metin ≤ 200). Alan eklemek kırıcı değil: `LEVEL_SURUMU` aynı.

## 4. A1 — bileşen şeması (`world/level/cekirdek/bilesen.ts`, SAF)
`AlanSemasi {ad, etiket, tip: sayi|metin|bool|renk|vec3, varsayilan, en?, cok?, adim?, birim?}`; `BilesenSemasi {tur, etiket, alanlar}`; kayıt: `ISIK_BILESENI`, `NESNE_BILESENI`
(görünüm: konum, dönüş, ölçek, gizli, kilitli). İşlemler: `alanOku(aktor, ad)`, `alanYaz(aktor, ad, deger)` (şemadan doğrular; değişmez), `degiskenYaz`. Hata modu: bilinmeyen alan,
tür uyuşmaz, aralık dışı, kimlik yok → NEDENLİ `{ok:false}`. Hiçbir şey fırlatmaz.

## 5. A2 — Details şemadan (`uygulama/yapi/level/detayPaneli.ts`)
Alan şemasından DOM üretir (sayı/metin/bool/renk/vec3); ışık paneli buna taşınır; "Graf" satırı ve "Değişkenler" bölümü (ekle/sil/değer) aynı bileşenden. Yazma yolu tek: `isikModeli`/`level.ayarla`.

## 6. A3 — aktör grafı
- Çalıştırma YALNIZ Ozyn'in gerçek tıklamasıyla (`isTrusted`): Details'te "Graf: [ad] ▶ ■". Orion'un araç yüzeyine eklenmez. Aynı anda aktör başına tek çalışma, toplam en çok 4.
- Çalışma bağlamına `aktor` (kimlik) eklenir; graf içinde `@bu` = bu aktör (`@ben` NPC'dir, karışmasın). Graf sekmesinden ▶ ile `@bu`lu grafik NEDENLE düşer (aktörsüz).
- Düğümler (`uygulama/graf/aktorDugumleri.ts`): `aktor.oku` (saf), `aktor.yaz` (akışlı) — bileşen alanı (şiddet, menzil, renk, gizli); `aktor.degisken_oku`, `aktor.degisken_yaz`.
- **Yazma GEÇİCİDİR:** graf Babylon ışığına doğrudan yazar, level tanımına DEĞİL (kirli rozeti çıkmaz, 💾 kaydetmez); çalışma bitince/■'de `level.ayarla(tanim())` ile tanımdaki hâle döner.
  Kalıcı olan yalnız Details'te elle girilen `degiskenler` başlangıç değerleridir. Graf değişken yazması bellekte (çalışma süresince).
- Dünya yeteneği `GrafYetenegi.aktor` (opsiyonel): verilmezse düğümler nedenle düşer (senaryo/test dünyası).

## 7. A4 — hata ayıklama
Var: aktif düğüm vurgusu, nedenli hata, tavanlar, ■. Eklenen:
1. **Çalışma günlüğü:** her düğüm bitince giriş/çıkış değerleri (kısaltılmış, ≤ 120 karakter) `CalismaOlayi`'nda; çalıştırıcı en son 200 satırı tutar; editörde "Günlük" bölümü.
2. **Kesme noktası + adım adım:** `CalismaAyari.duraklat?: (graf, id) => Promise<void> | null`; her düğüm başlamadan beklenir; ■ beklemeyi keser. Editörde düğümde kesme noktası, Devam / Adım düğmeleri (`isTrusted`).
3. **Değişken izleme:** çalışmanın değişken alanı günlükte (ad = değer) görünür.
4. Kuru koşu ve hatalı aktöre kamera odağı: bu dilimde YOK (not: DOGRULAMA-DEFTERI).

## 8. Riskler ve guard'lar
| risk | guard |
|---|---|
| eski level bozulur | alan yoksa davranış aynı; `leveller.test.ts`, `isiklar.test.ts` geriye uyum testi |
| graf FPS'i yer | olay tabanlı (kare başı çalışma YOK); adım tavanı 1000 |
| graf dünyaya zarar | yalnız ışık/değişken alanları; kalıcı yazma yok; çalışma bitince tanıma dön |
| otomatik çalışma | `isTrusted` bekçisi (testli); Orion yüzeyi yok (`bridge/araclar.ts` dokunulmaz) |
| `nesneSistemi.ts` başka Claude'da | dokunulmaz; nesne aktörü bu spec'te yalnız şema + veri (kurulum değişmez) |

## 9. Bilerek yapılmayanlar
Yeni nesne türünün kurulumu (mesh/ses/tetik bileşeni), `nesneSistemi.ts` değişikliği, `ova.level.json`, Orion yüzeyi, bileşenin kendi grafı olması, kuru koşu, hatalı aktöre odak.

## 10. Doğrulama
`npx tsc --noEmit`, `npm test`, bozma denemesi (≥12 mutant / dilim), `leveldene` (A1–A2), yeni `aktordene` (A3–A4: gerçek graf bir ışığı kısıp açar, kesme noktasında durur, ■, günlük), ekran görüntüleri okunur.
