# Ön kayıt — Göz muayenesi: Orion'un gözünden kare, bağımsız görme sorgusu, panel (2026-10-15)

**İstek (Ozyn):** "Zihin akışı / bakma işi: Orion'un kamerasından o an ekran görüntüsünü al, mevcut sohbet dışında yerel görme modeline sorgu yaptır, özel prompt,
resimde ne gördüğünü bize uygun şekilde bildirsin. Bir tuşla; resmin ÖNİZLEMESİ ve CEVABI görünsün. 'Sen Orion'sun' gibi prompt verme: tamamen mekanizma. Yerel model
gerekiyorsa SIRALI çalışsın. Mevcut görme/resim inceleme yapısı uygun olabilir."

**Tasarım:** `O` tuşu → `uygulama/gozlem.ts`: `orionKaresi()` (mevcut göz karesi, 896×504 PNG) → `GozModeli.incele(png)` (mevcut görme modeli sınıfına eklenen yöntem;
`GOZLEM_ISTEMI`: DÜZ Türkçe soru, rol YOK, algı YOK, sohbet geçmişi YOK; ortam/ışık, nesneler, ekran içeriği, kişi, ve görsel kusurlar) → `world/arayuz/gozPaneli.ts`:
önizleme resmi + durum satırı + cevap + model/süre/saat. Sonuç sohbet geçmişine, hafızaya, köprüye GİRMEZ. Orion'un kendi `sor gor` yolu aynen kalır.
**Sıra (iki yönlü):** beyin düşünüyorsa göz bekler (panelde söyler, tavan 90 sn); göz sürerken beyin yeni tur BAŞLATMAZ (köprü `beyinKapisi`; tur ertelenir, kaybolmaz).
Tek uçuş: sürerken ikinci istek yeni muayene açmaz.

**Ölçütler (uygulamadan önce):**
- **G1 bağımsızlık:** modele giden istek yalnız `[resim + GOZLEM_ISTEMI]` (testle: `incele` tek argüman; sohbet/algı/rol yok); Orion geçmişi ve hafıza bu yolla değişmez.
- **G2 sıra:** beyin meşgulken model ÇAĞRILMAZ ve panel nedenini söyler; tavan aşılırsa vazgeçer; kapı kapalıyken beyin turu BAŞLAMAZ ama kapı açılınca kaybolmadan çalışır; tek uçuş. (birim testleri)
- **G3 dürüst hata:** beden yok, kare hatası, model kapalı/zaman aşımı → panelde yazılı sebep, önizleme (varsa) görünür kalır, kilit açılır.
- **G4 canlı:** `O` ile panel açılır, önizleme görünür, gerçek yerel model cevap verir (cevap anlamlı uzunlukta); cevabın DOĞRULUĞUNA insan bakar (sayı yok, "gördüm" yazarım).
- **Çürütme:** model kare ile uyumsuz/uydurma cevap veriyorsa (insan karar verir) istem sadeleştirilir ya da model değiştirilir; sonuç olduğu gibi yazılır.

**Kapsam dışı:** periyodik/otomatik bakış (Ozyn'in eski kararı: yalnız istenince), Orion'un bu betimi sohbetine alması, çoklu kare, kare seçimi (kamera açısı değiştirme).

## SONUÇLAR
(G1–G3 birim testleriyle yazıldı; G4 canlı kapı Ozyn'in isteğiyle BİRLİKTE koşulacak — henüz koşulmadı)
