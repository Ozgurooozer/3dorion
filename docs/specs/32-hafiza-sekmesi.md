# Spec 32 — Hafıza sekmesi: Orion'un md dosyaları + oyun içi metin düzenleyici

**Durum:** YAZILDI (testli), canlıda GÖRÜLMEDİ. Odak istisnası kapsamında (Ozyn, 2026-10-20: "hafıza sekmesi ekle, md dosyaları, çift tıkla editlenebilir, sağ tık aktif/deaktif, anlık hafıza contexte full ve sürekli güncellensin"). Yapı çubuğunun (spec 31) üçüncü sekmesi.

## Ne yapar
- **Hafıza sekmesi:** Orion'un md dosyaları kartlar hâlinde (persona, anlık hafıza, Ozyn'in kendi notları). Kart rozeti `● Bağlamda` / `○ Kapalı`; üstte özet ("N dosya · M bağlamda · ≈T token her turda") ve bağlama SIĞMAYAN/KESİLEN dosyaların uyarısı. `＋ Yeni dosya`.
- **Çift tık:** dosya kendi penceresinde açılır (sürüklenir, boyutlanır, öne gelir). Düz metin alanı: kopyala/yapıştır/kes/geri al tarayıcıdan; Ctrl+S kaydet, Tab/Shift+Tab girinti, durum çubuğu (satır:sütun, karakter, ≈token, bağlamda mı), kaydedilmemiş nokta, kapatırken iki tıklı onay, Kopyala/Yenile düğmeleri. Yazarken tuşlar oyuna sızmaz.
- **Sağ tık menüsü** (mevcut bağlam menüsü, yeni hedef `dosya`): Düzenle… | Bağlama ekle / Bağlamdan çıkar | İçeriği kopyala, Adı kopyala.
- **Bağlama giriş:** aktif dosyalar her turda talimatın SONUNA `NOTES — …` bölümü olarak eklenir (kimlik/duruş/araç kuralları önce gelir; notlar onları geçersiz kılamaz). Ozyn dosyayı kaydedince SONRAKİ tur yeni metni görür.
- **Anlık hafıza (`anlik-hafiza.md`):** sistem dosyası, AKTİF başlar ve TAM girer. İşaretli `orion:otomatik` bölümü her 4 sn'de durum defterinden (konum, önceki yer, şu an yaptığı, son iş, Ozyn'in/Orion'un son sözü, monitör) güncellenir; yalnız blok DEĞİŞİNCE diske yazılır (zaman mutlak saat). Bölümün dışına Ozyn istediğini yazar, o kalır.

## Tasarım kararları
- **Dosyalar repoda değil, kullanıcı verisinde** (`<userData>/orion-md/`, `ORION_MD_DIZINI` ile değişir; `ORION_SMOKE=1` geçici klasör): kişisel hafıza ve notlar herkese açık repoya sızmasın. Aktif/pasif `_ayar.json`da (md içeriği saf kalır). Silme yok. Atomik yazım (`.tmp` → rename), boyut sınırı 256 KB, yalnız `.md`, klasör gezme yok. Bozuk ayar sessizce "hepsi pasif" sayılmaz: HATA + dosya kenara taşınır.
- **Bağlam sınırı (maliyet tavanı):** anlık hafıza dosya sınırından muaf (emniyet tavanı 6000 karakter); öteki dosyalar dosya başına 2000, toplam 5000 karakter. Sığmayan dosya HİÇ girmez (yarım dosya yanlış bağlam verir) ve nedeni arayüzde görünür. HTML yorumları (`<!-- -->`, otomatik bölüm işaretleri dahil) beyne gitmez; yalnız başlıklardan oluşan (dokunulmamış şablon) dosya "boş" sayılır. Şablonların kullanım açıklaması yorum içindedir.
- **Anlık hafıza çakışması:** otomatik bölüm SİSTEMİN. Ozyn düzenleyicideyken sistem güncellerse: temizse pencere sessizce yenilenir, kirliyse çakışma şeridi çıkar (Diskteki hâli al / Benimkini koru) — Ozyn'in yazdığı sessizce ezilmez. Kaydederken diskteki otomatik bölüm korunur (`kaydetBirlestir`).
- **Kaynak soyut:** Electron'da host dosyaları (IPC `md:*`, sonuç `{ok, deger}|{ok:false, kod, mesaj}`), `npm run dev`'de localStorage. Düzenleyici `DosyaKaynagi` arayüzünün arkasında: kod dosyaları (sözdizimi renklendirme, başka dizinler) bu pencereyi genişleterek gelir.
- Emniyet valfi: anlık hafıza da menüden bağlamdan çıkarılabilir (Orion davranışı bozulursa).

## Dosyalar
`host/mdDosyalari.js` (+`.d.ts`), `host/{kanallar.cjs,main.js,preload.cjs,kopru.ts}` (IPC), `mind/mdBaglami.ts` (bağlam kurucu, sınırlar, ad kuralı), `mind/anlikHafiza.ts` (otomatik bölüm), `bridge/kopru.ts` + `kopruTurleri.ts` (`mdBaglami` seçeneği), `uygulama/mdDeposu.ts` (önbellek, kuyruk, kaynaklar), `uygulama/yapi/hafizaSekmesi.ts`, `world/arayuz/editorModeli.ts` + `editorPenceresi.ts`, `uygulama/menuKatkilari.ts` (hedef `dosya`), `uygulama/giris.ts`, `uygulama/kopruKur.ts`.

## Ölçülmeyenler / bilinen sınırlar
- **Gerçek ekranda hiçbiri görülmedi:** kartların ve pencerenin görünümü, sürükle/boyutlandır, IPC'nin Electron'da çalışması, klavyenin oyuna sızmaması, sağ tık menüsünün pencerelerin üstünde çıkması.
- **Orion'un davranışına etkisi ÖLÇÜLMEDİ.** Örnek bağlam (anlık hafıza + boş persona): temel talimat 2054 karakter, eklenen NOTES 453 karakter (≈150 token, KABA tahmin: karakter/3, tokenizer değil). Yerel model (8 GB VRAM) ve Haiku üzerinde sadakat/eylem doğruluğu `eylem-olc`/`sadakat-olc` ile koşulmadı; kapatma valfi menüde.
- Düzenleyici düz metin alanı: sözdizimi renklendirme, satır numarası, md önizleme, bul/değiştir YOK. Kod dosyaları (`.ts`, `.json`…) yok, yalnız md. Silme/yeniden adlandırma yok. Çoklu pencere pozisyonu saklanmaz.
- Kaydedilmemiş pencere metni, uygulama kapanırsa kaybolur (imleç kipi kapanınca pencereler gizlenir, silinmez).
- Md içeriği harici beyne de gider (Haiku/API): hassas bilgiyi aktif dosyaya yazma.
