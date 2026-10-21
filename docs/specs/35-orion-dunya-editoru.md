# Spec 35 — Orion dünyanın editörü, Ozyn mimar: Blueprint benzeri JSON düğüm grafiği

Tarih: 2026-10-21 · Durum: **Dilim 0 bitti** (biçim + tür denetimi + saf yorumlayıcı, testli); dilim 1–5 sırada.
Plan: `C:\Users\ozigo\.claude\plans\expressive-coalescing-mist.md` (onaylı). Araştırma: Opus ajanı raporu (scratchpad `modulerlesme-arastirma/rapor.md`).

## 1. İstek ve kararlar (Ozyn, 2026-10-21)
- "Orion etrafındaki tüm objeleri ve NPC Flash'ları belli sınırlarda editleyebilsin; **Orion bu dünyanın editörü olacak, ben de mimar**."
- "Hem Orion hem ben kodu yazabileyim ama **çalıştırmak için benim Çalıştır tuşuna basmam** gereksin."
- "Yaptığı deseni JSON'la bir grafikte parça parça alıp sonra kullanabilelim; 'x objesini al'ı her seferinde yazmıyoruz; **node graph, Blueprint, UE5** gibi."
- **İstisna verildi** (odak kuralı bu iş için askıda; `world/level/`'a yeni özellik girmez). Onay biçimi: **öneri paketi, tek ▶** (fark görülür, tek tuşla uygulanır/reddedilir, tek adımda geri alınır).

## 2. Çekirdek: grafik = program = öneri
- Her program bir **düğüm grafiği** (JSON, `protocol/graf.ts`). Orion'un önerisi bir grafiktir; ▶ grafiği çalıştırır. Dünya düzenlemeleri de düğümdür (ayrı bir "değişiklik seti" biçimi yok).
- **Desen** = kaydedilmiş fonksiyon grafiği (girişli/çıkışlı); `desen.cagir` ile **tek düğüm** olarak yeniden kullanılır (Blueprint fonksiyonu).
- **Biçim bizim**: editör kütüphanesi yalnız görünüm; LLM bizim şemamızı yazar.
- **Sandbox gerekmez**: grafik yalnız kütüphanedeki düğümleri dizer; kütüphanede olmayan şey (terminal, güvenlik/onay ayarları, protokol, level DOSYASI) yapılamaz.

## 3. Anlam (UE5 Blueprint ile aynı)
- `akis` pinleri yürütme sırasını taşır; bir akış çıkışından en çok bir bağ (dallanma: **Sıra**), akış döngüsü yasak (tekrar: **Tekrar**).
- Veri girişi: bağlıysa kaynaktan (SAF düğüm her istekte yeniden hesaplanır; akışlı düğümün çıkışı son çalışmasından — çalışmadıysa HATA), bağsızsa aynı adlı ayardan.
- Çalışmadan ÖNCE tür denetimi (hata varsa hiç başlamaz). Tavanlar: 1000 adım, 120 sn, desen derinliği 5, Tekrar ≤ 100, Bekle ≤ 10 sn. **■ Durdur** her adımda ve her beklemede.
- Her düğüm başlarken `dugum` olayı (editörde aktif düğüm vurgusu, günlük).

## 4. Dilim 0 — yapıldı [TEST]
| Dosya | İş |
|---|---|
| `protocol/graf.ts` | biçim + elle doğrulayıcı (temiz kopya, tavanlar, hata yeri) |
| `uygulama/graf/dugumKaydi.ts` | düğüm türü kaydı (pinler ayara/desene göre, ayar aralıkları, saf/olay, yetenek) |
| `uygulama/graf/grafTurDenetimi.ts` | "Kontrol et": tür uyumu, pin varlığı, tek bağ kuralları, döngüler, Başla/Fonksiyon girişi, kendini çağıran desen |
| `uygulama/graf/yorumlayici.ts` | saf yorumlayıcı (akış, veri, dallar, desen çerçeveleri, tavanlar, Durdur, olaylar) |
| `uygulama/graf/cekirdekDugumler.ts` | ▶ Başla, Fonksiyon girişi/dönüşü, Sıra, Tekrar, Eğer, Bekle, Desen, Sayı/Metin/Bool, Karşılaştır |

36 test (biçim 11, yorumlayıcı + denetim 25). Bozma denemesi: 5/5 yakalandı (Tekrar indeksi, Durdur, çift akış bağı, desen derinliği, bilinmeyen alan). Durdur testi bozulunca sonsuza dek asılı kalıyordu → testine zaman aşımı eklendi (artık kırmızı yanar).

## 5. Editör kütüphanesi spike'ı (pencere açılmadan) [ÖLÇÜLDÜ: paket incelendi, repoya kurulmadı]
- `@comfyorg/litegraph` 0.17.2: **MIT**, ESM + tipler, bağımlılık yok, son güncelleme 2026-10-02 (ComfyUI'nin editörü). Orijinal `litegraph.js` 0.7.18 Ocak 2024'ten beri durgun.
- **Bulgu:** paketin sayı alanı istemi kullanıcının yazdığı ifadeyi `eval` ediyor (düzenli ifade yalnız başı denetliyor: "1+…" ile başlayan her şey çalışır). Yazan yalnız Ozyn olduğu için risk düşük ama ana pencere `sandbox:false` ve CSP yok: LiteGraph seçilirse sayı alanları **kendi** alanlarımızla değiştirilmeli ya da o istem kapatılmalı. Karar dilim 2'de (LiteGraph vs kendi SVG editörümüz).

## 6. Sıradaki dilimler
1. Ajan eylem düğümleri (Git, Bak, Otur, Kalk, Söyle, Jest, Emret; `kim` pini; tek eylem yolu) + Ajan seç/Nesne bul + ▶/■ + günlük.
2. Görsel editör (Yapı çubuğu "Graf" sekmesi) + desen kaydet/kullan + aktif düğüm vurgusu.
3. Dünya düzenleme düğümleri (yerleştirme katmanı) + geri al + öneri farkı.
4. Orion `dunya_oku` / `dunya_oner` (önerir, asla çalıştırmaz; yalnız editör kipinde).
5. Tarif (balta/ağaç primitifleri + bileşenler), JSON animasyon (el sallama — bugün `jestUygula` boş), Etkileş (kes) → ağaç kesme demosu.

## 7. Açıklar
- Grafiğin kalıcı deposu (desenler, öneriler) henüz yok (dilim 1–2; md deposu genelleştirilecek, kopya değil).
- Ajan eylemlerinin sonucu (yürüme bitti mi) için niyet sonucunu bekleyen bağlantı dilim 1'de.
- Komut kipi `otomatik` çelişkisi (araştırma) bu sistemi etkilemez: grafik terminale erişemez.
