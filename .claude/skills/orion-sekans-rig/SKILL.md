---
name: orion-sekans-rig
description: "3dorion Sekans editörü + Control Rig + Sekans kamerası + editör kabuğu (menü çubuğu, araç çubuğu, yan sekmeler, serbest kamera) için çalışma kılavuzu: mimari, veri akışı, dosya haritası, arayüz/menü/kısayol, 'şunu ekle' tarifleri, güvenlik kuralları, doğrulama komutları, bilinen tuzaklar. Use for ANY work on: sekans (zaman çizelgesi, iz, anahtar, klip bölümü, kare kare poz), rig (kontrol şekilleri, gizmo, Taşı/Döndür, Gövde/Dünya, gruplar, yansıtma, poz kopyala, auto-key), kamera (isimli kamera, kesme, önizleme, serbest/orbit kamera), Kimodo çıktısını düzenleme, kanonik iskelet, Graf/Sekans editör yerleşimi. Haiku dahil her ajan önce bunu okumalı. Spec: docs/specs/36, 37, 38."
---

# Orion Sekans · Rig · Kamera — çalışma kılavuzu

Bu skill 3dorion'un animasyon düzenleme sisteminin **nasıl çalıştığını ve nasıl değiştirileceğini** anlatır. Kod/yorum/commit Türkçe; mevcut dosyaya uy. Kararlar ölçüme dayanır: "çalışıyor" demeden önce §9'daki kapıları geç.

## 0. Önce şunu yap (ajan için okuma sırası)
1. Görev hangi katmanda? §3 tablosundan dosyayı bul. **Tek seferde 1–2 dosya oku**, tahmin etme.
2. Bu skill + `docs/specs/38-control-rig-ve-sekans-arayuzu.md` (§1 kararlar, §9 açıklar). Sekans biçimi için `docs/specs/36-orion-sekans.md`, Kimodo için `37`.
3. Değiştirmeden önce ilgili testi/senaryoyu **koş** (taban yeşil mi?). Sonra küçük adım: değiştir → `npx tsc --noEmit` → ilgili test → senaryo.
4. Bitirince: `npm test`, ilgili `3dorion.bat <ad>dene`, ekran görüntüsünü OKU (`ORION_SS_DIR`), dürüst rapor (`[TEST]`, `[ÖLÇÜLDÜ]`, `[YAZILDI-KOŞULMADI]`).

## 1. Büyük resim (tek paragraf)
Kimodo (veya elle) bir hareket üretir → **Sekans JSON'u** (30 fps, kare tabanlı: uzuv izleri + klip bölümleri + kameralar/kesmeler). Sekans editörü bunu düzenler. **Rig yeni bir biçim değildir**: bir kontrolü döndürünce o karedeki *toplam* dönmeyi hedef alıp uzuv izlerine **anahtar yazar** (auto-key). ▶ sekansı bedene **klip olarak** oynatır (tek eylem yolu); editör açıkken beden playhead karesindeki pozda durur (`Avatar.rigPozu`). Kamera sekansın parçasıdır.

```
sekans JSON ──degerlendir(kare)──► uzuv değerleri ──► Avatar.rigPozu ──► kemikler (önizleme, kare kare)
     ▲                                                
     │ rigDuzenle / kameraIslemleri (saf, değişmez, sekansDogrula'dan geçer)
Rig/Panel/Zaman çizelgesi  ──oturum.uygula──► geri al yığını (TEK adım)
▶ (gerçek tık) ──derleyici──► geçici klip ──jest niyeti──► ajan kapısı ──► beden       kamera: kameraOynatici ──► KameraRig.sekansKamerasi
```

## 2. Kavramlar (sözlük)
- **Uzuv**: soyut kemik adı (`sag_kol`, `bas`, `kalca`, `kok`…). 18 adet (`protocol/animasyon.ts` UZUVLAR). **Kanonik 17** (kök `kalca` + 5 zincir) = `world/avatar/iskelet/kanonik.ts`.
- **Kanal**: `donme_x/y/z` (derece, **gövde uzayı**), `oteleme_x/y/z` (metre, **yalnız `kok`**, ±0,5 m).
- **İz** (`uzuv` | `klip`), **anahtar** (kare, değer, yumuşatma), **bağlama** (iz → ajan), **bölüm** (klip parçası).
- **Toplam dönme**: bir uzvun bir karedeki değeri = tüm izlerin (klip bölümü + uzuv izi) **toplamı**. Rig hedefi toplamdır; yazılan anahtar = hedef − öteki izlerin katkısı.
- **Gövde uzayı**: yüzü +Z, yukarı +Y, sağı +X. Babylon sol elli. `donme_x` + = öne eğilir, `donme_y` + = sağa, `donme_z` + = sağ taraf yukarı.
- **Kontrol**: rig'de bir uzvun ekrandaki şekli (halka/disk/kutu). **Grup**: gövde+baş, sol/sağ kol, sol/sağ bacak.
- **Oturum** (`SekansOturumu`): açık sekmenin durumu: sekans, playhead (`kare`), seçim, geri al yığını. **Tüm yazmalar `oturum.uygula(sonuc, mesaj)` ile** (tek geri al adımı).

## 3. Dosya haritası (görev → dosya)
| Konu | Dosya |
|---|---|
| Sekans biçimi, doğrulama, tavanlar (60 sn, 64 iz, 256 anahtar, 8 kamera, 64 kesme) | `protocol/sekans.ts` |
| Değerlendirme, derleme, oynatıcı, depo | `uygulama/sekans/{degerlendir,derleyici,oynatici,sekansDeposu}.ts` |
| Editör saf mantığı (oturum, işlemler, kısayollar, ayrıntı alanları, zaman ekseni, iz düzeni) | `uygulama/sekans/editor/*` |
| Editör DOM (ana denetimci, zaman çizelgesi, sol izler, ayrıntılar, kamera paneli, oynatma düğmeleri) | `uygulama/yapi/sekans/*` |
| Ortak kabuk (menü modeli+çubuğu, yan sekmeler, dok boyutu, stil) | `uygulama/yapi/ortak/{menuModeli,menuCubugu,yanSekmeler,dokBoyutu,kabukStili,dom}.ts` |
| **Rig saf çekirdek** (Babylon YOK) | `world/avatar/rig/{matris,poz,kontroller,surukleme,halkaSecimi}.ts` |
| Rig Babylon katmanı (şekiller, halkalar, oklar) | `world/avatar/rig/gosterim.ts` |
| Rig mantığı/denetleyici | `uygulama/rig/{anahtarla,grupIslemleri,rigKipi}.ts` |
| Rig paneli | `uygulama/yapi/rig/{rigPaneli,rigStili}.ts` |
| Kanonik iskelet | `world/avatar/iskelet/{kanonik,kaynaklar}.ts`, birleşim `world/avatar/zincirler.ts` |
| Kamera (değerlendirme, işlemler, oynatıcı, geometri, serbest kamera) | `uygulama/sekans/{kameraDegerlendir,kameraOynatici}.ts`, `uygulama/sekans/editor/{kameraIslemleri,kameraYardimcilari,serbestKamera}.ts`, `uygulama/yapi/sekans/{kameraPaneli,serbestKameraGirdisi}.ts` |
| Canlı kamera | `world/engine/kamera.ts` (`sekansKamerasi`, `sekansKamerasiBirak`, `gorunum`) |
| Avatar kamu yüzü (rig/uygulama BURADAN alır) | `world/avatar/index.ts` |
| Kablolama | `uygulama/yapi/sekans/kurulum.ts` (rig+kamera+editör), `uygulama/giris.ts` (sekansKur çağrısı, senaryo bağlamı) |
| Graf editörü kabuğu | `uygulama/yapi/graf/grafEditoru.ts` |
| Kimodo çevirici | `tools/kimodoCevir.ts`, `tools/kimodo/*` |

## 4. Çalışma mantığı (ayrıntı)
**Poz önizleme:** `rigKipi` kare gözcüsü (her render öncesi) — editör açık + ▶ yok ise `avatar.rigPozu(baglamaDegerleri(sekans, bağlama, oturum.kare))`. Sekans nesnesi veya kare değişince yeniden uygular. ▶ sürerken bırakır. Editör `tazele()` içinde `rig.pozOnizleme(oturum, ad)` bildirir; gizlenince `null`.
**Auto-key (`anahtarla.rigDuzenle`):** hedef toplam Euler → her değişen kanal için "öteki izlerin katkısı"nı bul (o izi gizleyip `degerlendir`) → anahtar değeri = hedef − katkı → iz yoksa aç + ±6 kare komşuya 0 anahtar (tek anahtarlı iz bütün sekansı çekmesin) → `sekansDogrula`. Kilitli iz/tavan nedenle reddedilir. `rigOtelemeDuzenle` aynı yol, `kok` öteleme kanalları.
**Gizmo:** `Döndür` = 3 halka (X kırmızı, Y yeşil, Z mavi), `Taşı` = 3 ok (yalnız Pelvis→`kok` ötelemesi). **Seçim ekran uzayında** (`halkaSecimi.ts`: imlece en yakın çizgi, 11–12 px) — mesh pick DEĞİL (üst üste binen tüpler yanlış seçiyordu). Sürükleme açısı `surukleme.ts` (teğetin ekran izdüşümü). Yön: `Gövde` (eksenler yaw ile döner) / `Dünya` (`dunyaEkseniGovdeye` ile gövdeye çevrilir) → `eksenVektorundeDondur`.
**Sürükleme önizlemedir:** `onizleme` sekansı üretir (geri al yığınına girmez), bırakınca `yaz` ile TEK adım; Esc iptal. Kaydırıcı da aynı (`kanalOnizle` → bırak → `kanalAyarla`).
**Toplu işlemler (`grupIslemleri`):** `topluAyarla` uzuv uzuv; biri reddedilirse **hiçbiri yazılmaz**. Yansıtma = `R' = M·R·M`, M=diag(−1,1,1) (y,z işaret değiştirir).
**Kamera önceliği (`kameraOynatici`, her kare):** ▶ sürüyorsa oynatma karesinin kesme kamerası → yoksa Kamera sekmesi önizlemesi → yoksa **serbest kamera** (editör açıkken) → yoksa `null` = oyuncunun kamerası. Pozlar `KameraRig.sekansKamerasi` ile yumuşatmasız uygulanır; `null` olunca `sekansKamerasiBirak`.
**Serbest kamera (`serbestKamera.ts` saf + `serbestKameraGirdisi.ts` DOM):** hedef etrafında küresel (yatay, yükselti ±85°, mesafe 0,3–40 m). Sağ tuş sürükle = orbit, orta tuş = pan, tekerlek = zoom, sağ tuş+WASD/QE = uç, Alt+sol = orbit. Olaylar capture + `stopImmediatePropagation` (oyuna gitmez); klavye dinleyicisi editörden önce kurulur ve durdurmaz.
**Tuval boyutu:** editör açıkken `--editor-alt` CSS değişkeni; `index.html` `#tuval` yüksekliğini `max(--alt-cubuk, --editor-alt)` kadar kısar, `ResizeObserver` motoru boyutlar. Altyazı/sohbet/diyalog payı bilir.

## 5. Arayüz özeti (menüler, araç çubuğu, kısayollar)
**Sekans editörü** (altta, tutamakla yeniden boyutlanır): Menü çubuğu **Dosya** (Kaydet, Yeniden adlandır, Kopyasını oluştur, JSON görünümü, Gizle) · **Düzen** (Geri al/Yinele, Anahtar ekle, Sil, Tümünü seç) · **Görünüm** (Yaslama, Sığdır, sekmeler) · **Oynat** (▶ menüde YOK — yalnız araç çubuğu düğmesi; Durdur, Döngü, Başa/Sona, anahtar atla) · **Ekle** (Kamera…, Kesme) · **Rig** (Rig kipi, sıfırla, seçimi bırak) · **Yardım**.
Araç çubuğu: ⏮ ◀ ▶ ■ ▶| ⏭ ⟳ | ◆ Anahtar · 🧲 Yasla · ⤢ Sığdır | 🦴 Rig · 🎥 Kamera · 🎯 Orion | kare okuması | 💾 Kaydet ✕. Sağ sekmeler: **Ayrıntılar · Rig · Kamera**. Sol: iz listesi (en üstte 🎥 Kamera satırı). Orta: zaman çizelgesi.
**Kısayollar** (`uygulama/sekans/editor/kisayollar.ts`, tek kaynak): ← → kare, Shift+←→ 10 kare, Home/End, `,` `.` anahtara atla, K anahtar ekle, N yasla, F sığdır, Delete, Ctrl+S/Z/Y/A, ?, Esc (önce açık menü, sonra editör). **▶ için kısayol YOK** (güvenlik).
**Rig paneli**: Gizmo [Döndür|Taşı|Ölçek(KAPALI)] · Yön [Gövde|Dünya] · Gruplar (çipler, ◆ = bu karede anahtar, Sıfırla, ⇄ yansıt) · Poz (kopyala/yapıştır/hepsini sıfırla) · seçili kontrolün kaydırıcı+sayı+±+↺.
**Graf editörü**: aynı kabuk: Dosya/Düzen/Görünüm/Çalıştır/Yardım menüleri + araç çubuğu; ▶ ⚡ düğmeleri `isTrusted` ister.

## 6. "Şunu ekle" tarifleri
- **Yeni kontrol türü/şekli:** `world/avatar/rig/kontroller.ts` `TASARIM` tablosuna satır (şekil, yarıçap, ad). Kod yok. Test: `rig.test.ts`.
- **Yeni kaynak iskelet (Mixamo…):** `world/avatar/iskelet/kaynaklar.ts`'e tablo + `KaynakIskelet` birleşimi; kanonik yapıya dokunma. Test: `world/avatar/iskelet/kanonik.test.ts` (eski çıktı anlık görüntüsü).
- **Yeni menü satırı:** editörün `menuler()` listesine `{ etiket, kisayol?, etkin?, isaretli?, calistir }`. Gerçek tuş için `kisayollar.ts`'e de ekle (menü yalnız gösterir). Menü modeli: `menuModeli.ts` (testli).
- **Yeni rig işlemi (toplu):** `grupIslemleri.ts`'e saf fonksiyon (`topluAyarla` kullan: yarım kalmaz) → `RigKipi` arayüzü + uygulaması (`topluYaz` ile tek adım) → `rigPaneli.ts` düğmesi → test + `rigdene` kontrolü.
- **Yeni sekans alanı (kamera gibi):** `protocol/sekans.ts` (isteğe bağlı alan, boşsa YAZILMAZ, `SEKANS_SURUMU` değişmez; **yeni iz TÜRÜ yeni sürüm kararıdır**) + doğrulama + `kameraIslemleri` benzeri işlemler + biçim testi.
- **Yeni gizmo kipi:** `gosterim.ts` (düğüm + `modAyarla`), `halkaSecimi.ts` (ekran uzayı seçim), `rigKipi.ts` (kip + sürükleme türü), panel.
- **Yeni editör paneli:** `yanSekmelerKur` listesine `{ id, etiket, icerik }`; `tazele()` içinde çiz; yazı/kaydırıcı odaktaysa yeniden çizme (korunan koşul var).
- **Yeni senaryo:** `uygulama/senaryolar/<ad>dene.ts` + `SENARYOLAR` (`senaryoBaglami.ts`) + `host/main.js` `ORION_<AD>DENE` + `3dorion.bat` etiketi (CRLF) — örnek: `rigdene.ts`, `kameradene.ts`, `grafdene.ts`.

## 7. Güvenlik ve sınırlar (değişmez)
- Çalıştırma (▶, ⚡) **yalnız Ozyn'in gerçek tıklaması** (`e.isTrusted`); `sekansiOynat(` yalnız `oynatmaDugmeleri.ts` ve senaryo yüzünde (bekçi: `sekansBekci.test.ts`). Menüye/kısayola ▶ ekleme.
- Orion'un araç yüzeyine (`bridge/araclar.ts`, `protocol/niyet.ts`) sekans/rig/kamera EKLEME.
- `world/level/` yeni özellik YOK, `brain-lab/` dokunulmaz; yeni level/oda "istisna" ister (Ozyn "istisna" demedikçe yapma). Push yalnız açık onayla; commit yalnız istenince/yetkili akışta, açık yol listesiyle.
- Avatar alt-sistemi kamu yüzü yalnız `world/avatar/index.ts`: uygulama katmanı rig/kontrol/poz'u BURADAN import eder (alt-sistem bekçisi). `as unknown as` yasak (tipKacisi bekçisi).

## 8. Yapılmayanlar / dürüst sınırlar
Ölçek yok (biçimde kanal yok → düğme KAPALI, sahte çalışmaz). Taşı yalnız Pelvis (kök, ±0,5 m); el/ayak taşıma **IK ister** (yazılmadı; kutup bilgisi `kanonik.ts`'te hazır). Rig yalnız Orion'un bedenini düzenler (Flash yok). Ayak kayması düzeltilmedi. Kamera çarpışması yok. İnsan elinde denenmeyenler: orbit/uçuş hızı, ok tutma payı (spec 38 §9).

## 9. Doğrulama kapıları (sırayla)
```
npx tsc --noEmit                                   # temiz olmalı
npm test                                           # taban: 1 eski kırmızı "ova bütün yerleşimleri dönüşsüz"
node --experimental-strip-types --import ./tools/babylon-cozucu.mjs --test <dosya.test.ts>   # tek test
.\3dorion.bat rigdene | kameradene | grafdene | sekansdene | klipdene | kimododene            # PowerShell: cmd /c ".\3dorion.bat rigdene"
```
Beklenen (2026-10-24): `rigdene` 27/27, `kameradene` 12/12, `grafdene` 11/11, `sekansdene` 7/7, `klipdene` 5/5. **`kimododene` 8/9 olabilir**: Orion'un `ajanda_*` jesti sekansı son anda keser (eski açık; kesen niyet kimliğine bak). Senaryolar **oyun KAPALIYKEN** koşar (pencere açar); açıksa Ozyn'den kapatmasını iste, Electron/ollama/piper süreçlerini ÖLDÜRME. Kareler `%TEMP%\<ad>dene\*.png`: Read ile aç ve bak (görmediğini "görüldü" deme).
**Bozma denemesi:** yeni saf mantık için ≥12 mutant: dosyayı yedekle → tek ifadeyi boz → ilgili testler kırmızı mı → geri koy → bayt karşılaştır. Taban önce yeşil olmalı. Eşdeğer mutantı açıkla.

## 10. Bilinen tuzaklar (para ödenmiş)
- **Her karede `setEnabled`** (Babylon) ışık kaynaklarını yeniden hesaplatır: FPS 100→5. Yalnız durum DEĞİŞİNCE çağır.
- **İnce tıklama hedefi / kalın üst üste tüp:** seçimi ekran uzayında yap, piksel payı sabit tut.
- **Tıklamadan önce konum/matris tazele** (`gosterim.vurus` bunu yapar); aksi hâlde hareketli elde ıskalar.
- **Boşta (nefes) animasyonu ölçümde ~1,5–2,5 cm gürültü:** senaryo eşiklerini hareketin yüzdesi olarak koy.
- **`isinla`/odak kilidi** imleç kipini engeller: senaryoda editör açmadan önce `d.rig.odakBirak()`.
- **Sentetik klavye olayını `document.body`'ye gönder** (window'a değil: `contains` TypeError).
- **Windows:** heredoc/`sed -i`/kesme işaretli `echo`/`printf` metni bozar → Write/Edit ya da scratchpad'de Python betiği. PowerShell `Set-Content` UTF-8'i ANSI'ye çevirip bozar → Python `encoding="utf-8", newline=""`. Bazı dosyalar CRLF (`3dorion.bat`, `giris.ts`…): yazarken koru. `.bat`'ı PowerShell'den `cmd /c ".\3dorion.bat x"` ile çağır.
- **Kamera:** `KameraRig` odak/sinematik/serbest üçü; sekans kamerası hepsinin ÖNÜNDE; `guncelle(0)` ile hemen uygulanır.
- **Editör açıkken Yapı çubuğu şeridi (41 px) kalır** (`--alt-cubuk`): tuval onun kadar kısa; senaryoda "tam boy" bekleme.
- **Sekans iz tavanı 64**; Kimodo sekansı 50 iz → rig yeni iz açarken tavana dikkat (neden mesajla döner).

## 11. Haiku için kısa kural listesi
1. Dosya yolu uydurma: §3'ten al, `Glob`/`Grep` ile doğrula.
2. Saf çekirdeğe (`world/avatar/rig/*`, `uygulama/rig/anahtarla.ts`, `grupIslemleri.ts`, `kameraIslemleri.ts`) **Babylon/DOM import etme**.
3. Sekansa asla doğrudan yazma: işlem fonksiyonu → `sekansDogrula` → `oturum.uygula`.
4. Yeni davranışın testini YAZ, kırmızıyı gör, sonra düzelt; senaryoyu koş; ekran görüntüsünü aç.
5. Emin değilsen **yapma, neden söyle** (ör. Ölçek düğmesi sahte çalışmaz).
6. Rapor: ne yapıldı / ne ölçüldü (`[ÖLÇÜLDÜ]`) / ne koşulmadı (`[YAZILDI-KOŞULMADI]`) / açıklar.
