# Açık işler — tek liste
Önceliği Ozyn belirler. Her madde tek satır + nerede. Biten madde SİLİNİR (geçmişi git'te). Tarihli eski güncenin TAMAMI: `gunluk/acik-isler-2026-10-16.md` (donuk). Son güncelleme: 2026-10-16.

**ODAK (2026-10-16 → 2026-10-30):** `world/level`'a yeni özellik YOK (yalnız hata düzeltme; Ozyn istisnası 2026-10-17: oyun içi asset yerleştirme menüsü `specs/30` ve alt çubuk `specs/31`). Tek soru: **Orion günlük kullanımda işe yarıyor mu?** Kayıt: `kullanim-defteri.md` (ön kayıtlı ölçüt orada).

## Ozyn'dan bekleyen
- Asset yerleştirme menüsünü (`specs/30`) canlıda gör: Yerleştir/Çağır anlamı (tıklanan nokta / önüm), Kopyala-Yapıştır-Taşı-Kaldır; ardından commit (çalışma kopyasında, commit edilmedi).
- Bugünkü yığını canlıda gör, sonra commit: bank, `F`/`C`, `Tab` seçim + menü, Orion bankta oturur (~67 dosya commit dışı). Ölçülmeyenler: `specs/28` §9.
- Push: yerelde 3 commit (`ad1f1c6`, `67eb12b`, `a66749b`) + yukarıdaki yığın; onay yok.
- Kapı sen yaklaşınca KENDİLİĞİNDEN açılıyor (`world/level/odaKapisi.ts`, 2,2 m): beklediğin davranış söylenmedi (E ile / hiç / mesafe kısa / yalnız Orion).
- Kırmızı test `ova bütün yerleşimleri dönüşsüz` (bir nesne 30° dönük): level mi test mi uyacak.
- Gerçek mikrofonda yanlış tanınan sözler toplanmadı (`olcum/on-kayit-stt-turkce-1.md`); varsayılan beyin `gemma4:e4b` ölçülmedi (eski Haiku kararı ölçümlüydü).
- Karar: spec 15 S2–S5 (ön kayıt hazır), soru biçimi komut mu, süzgeç merceği ve beceri yetkisi (`specs/10`, `12`), spec 19 bütçe aşımı, spec 28 Faz 5 (not/ayar).

## Açık iş (ölçümlü, sıralı)
- Kullanım ölçümü bitince: `tools/karar-ozet.ts` (kendiliğinden uyanış bölümü) → ofis toplantısı (OB19).
- Terminal oku (OB12): `sor terminal` Haiku'yu 11/16 → 7/16 düşürdü, geri alındı; yeni tasarım gerek (`olcum/e1-sor-terminal-geri-alindi.patch`).
- Orion kapıdan tek başına `gec` (C6), `ovadene` 6/8; F3-C gerçek modelde ölçüm (`specs/26` §9); ornith-32k özerk talimat.
- Haiku'ya proje bağlamı sızıyor (`tools/claude-beyin.ts` boş klasörde koşmalı); Haiku tutarsızlıkları (`dur`, `terminale claude yaz`).
- Markov aşama 3–4 (kural düzenleme paneli, anı düzenleme); Orion'un 3. monitörü okuması ve Doktor'un kendi karar vermesi ölçülmedi.
- Beden: avatarın yüzü/jest klipleri yok; Ozyn'in oturma pozu yok (Blender klibi); Orion bankta oturan Ozyn'i "yüzeye geçti" algılar.

## Motor ve Proje (spec 39; istisna 2026-10-27)
- D1–D6 yazıldı: `projedene` 13/13, `dokdene` 14/14 [ÖLÇÜLDÜ]. D4 Content Browser, D5 önizleme, D6 Outliner birim testli ve bozma denemeli [TEST]; `icerikdene` 32/32 [ÖLÇÜLDÜ]; gerilemeler: dokdene 14/14, projedene 13/13, sekansdene 7/7, kameradene 12/12, grafdene 11/11, **rigdene 26/27**: R3 "eldeki kutuya tıklama" `vurus=null`; temiz HEAD'de (46cbf2f, ayrı worktree) AYNI 26/27 → D4–D6'dan değil, nedeni araştırılmadı (R3 sol elin pozuna/kutu tutma payına bağlı olabilir).
- D4–D6 açıkları: spec 39 §12 (level çift tık canlı geçiş yok; açık sekans/graf adlanırsa editör bayatlar; Asset sekmesi katılmadı; sürükle-bırak yok; önizleme tek pencere). D7 ayrı onay.
- Ozyn'in elle görmediği: ana menü şeridi, Proje aç… penceresi (yeniden başlama çalıştı: 2026-10-27), dok panellerini GERÇEK fareyle sürüklemek (senaryo sentetik olay kullandı), Pencere menüsü, yüzer pencere.
- Dok (spec 39 §8): düzen `localStorage`'da (`Saved/dok.json` için kanal yok); altyazı/diyalog/HUD ortası dok payını bilmez; Yapı çubuğu sekmeleri dok paneli değil (D4'te Content Browser'a).
- Yeniden başlatma takılması: `quit()` eski süreci kapatmadı, nedeni bilinmiyor (ikinci denemede çalıştı). `before-quit` adım adım `[kapanış]` yazıyor; tekrarlarsa son satır suçluyu gösterir. 4 sn'lik zorla çıkış emniyeti var.
- `kapidene` 15/19: dışarıda sis 0,0300 (≈0,004 bekleniyor) ve 3 çizim bütçesi (224/418/222 > 220); D2'den ÖNCE de aynı (temiz HEAD'de ölçüldü). Son temiz ölçüm 19/19 14–15 Ekim; hangi değişiklik bozdu bilinmiyor.

## Eklenti altyapısı (spec 40; istisna 2026-10-28)
- `eklentidene` (K1–K6) ve gerilemeler (`projedene`, `dokdene`, `icerikdene`, `sekansdene`, `kameradene`, `grafdene`) KOŞULMADI; oyun kapalıyken.
- E5 KAPANDI (2026-10-29): Düşünme kipi ölçüldü (`tools/kip-olc.ts`, ön kayıt `docs/olcum/on-kayit-dusunme-kipi.md`, 6 yerel model, tuzak-2): 0 KABUL → "kanıt yok". Kip varsayılan KAPALI kalır; eşik oynatılmaz. Sonuç: spec 40 §7.
- SIRADAKİ ADIM (isteğe bağlı, ayrı ön kayıt ister): 2. ardışık retten sonra modele sormadan deterministik geri dönüş (ısrarı kes, Ozyn'e tek cümle söylet). Ölçülmedi. `dunya_sor`/`ortam` tekrarı kural kapsamında değil; sezgiyle eklenmez, ölçümle sorulur.
- Ölçüm sınırları: tek tekrar n=5; sahte dünya `tahta` takma adını reddeder (gerçek oda kabul edebilir); canlı odada kipin faydası `[YAZILDI-KOŞULMADI]`.
- Content Browser sürükle-bırak/İçe aktar düzeltmesi (`host/birakYollari.cjs`): kök neden KANITLANMADI, canlı doğrulanmadı. Ozyn oyunu tam kapatıp `npm start` ile elle denesin (preload değişti). Tutmazsa DevTools'ta `dragstart`; yan şüphe: `.dk-icerik > [data-dok][data-etkin="1"]{display:block}` `.ic-kok{display:flex}`'i eziyor olabilir.
- Push bekleyen yerel commitler: `524ddae` (Fikir havuzu), `3d52caf` (çok modelli ölçüm). Ozyn onayıyla.
- Commit dışı (benim değil / karar bekliyor): `assets/araba/`, `assets/kaynak/araba.py`, `assets/kaynak/pist.py`, `assets/pist/`, `tools/pist-yerlestir.ts`, `docs/arastirma/*`, `docs/olcum/f0-ozerk3-acikis-yeni-dis.jsonl`, `docs/olcum/f3-getirme.json`.
- Fikir havuzu: telefondan Orion'a uzaktan bağlanma (A hazır araç 1–2 saat / B PWA spec 41 adayı / C yerel uygulama) — `docs/FIKIR-HAVUZU.md`.
- Hatırlatma: Hugging Face token'ı `huggingface.co/settings/tokens`'tan silinsin.
- Editör/yan sekme panelleri, Sekans/Graf editörü eklenti değil; dış klasörden eklenti yükleme yok.

## Sekans · Rig · Kamera (spec 36–38; eklendi 2026-10-27)
- Ozyn canlıda denedi (çalışıyor); menüler pencere tepesine taşındı (`--editor-ust`) — canlıda görülmedi; elle denenmeyenler: serbest kamera orbit/uçuş hızı, ok tutma payı, Graf menüleri.
- IK: el/ayak için "Taşı" kapalı (yalnız Pelvis); ayak kayması düzeltilmedi; `kos` döngü kapanışı 11,95 cm.
- Orion→Flash emir menüsü (odak kuralı: Ozyn onayı ister). Animasyon odası (`world/level/` istisnası ister, "istisna" denmeden başlanmaz).
- Küçük: Ölçek kanalı sekans biçiminde yok; rig yalnız Orion'un bedeni (Flash yok); Graf editörü tam ekran, dok/yan sekme almadı; kameralar sekans dosyasına bağlı (global kütüphane yok); kamera çarpışması yok.
- `kimododene` 8/9 kararsız: `ajanda_*` jesti `kimodo_otur`u son anda kesiyor.
- Eski bekleyenler: NPC hafızası dilimi, Sekans S3/S4, `GrafYetenegi` bölme, Epic IK Retargeter incelemesi, Kimodo A/B ölçümleri; Haiku'nun `orion-sekans-rig` skill'ini izlediği denenmedi.
- Push: 18 commit yerelde (2026-10-27 sayımı), onay yok. HF token'ı `huggingface.co/settings/tokens`'tan silinecek (Ozyn).

## Rafta (odak boyunca dokunulmaz)
Otomatik GI (`?gi=hacim`), shader/stil/ufuk işleri, kendi stilimiz seçimi, yeşil harabe kiti (oyuna bağlı değil), editör açıkları (spec 20–22), ışık şikâyeti (pencere/kapı ışığı).

## Teknik borç
- `giris.ts` 815 satır ve `saat.dinle` gövdesi (kökte iş mantığı); `bridge/kopru.ts` 1435 satır; B5 (ofis dosyalarını `world/oda/`ya taşı); ayar normalizasyonu 5 kopya; `semaCizim.ts` testsiz.
- Groma sunucusu kapalıyken `host/webMonitor` her ~2–3 sn `http://localhost:4747` bağlanmayı deniyor ve log'a `ERR_CONNECTION_REFUSED` basıyor (canlı log 2026-10-16). **KAPATILDI 2026-10-22:** yeniden deneme 5 sn'den başlayıp ikiye katlanıyor, en çok 60 sn; yüklenince başa döner (`host/webMonitor.js`, test + mutasyon).
- Ollama yetim `llama-server` VRAM tutuyor (temizleme betiği yok); duman koşuları `ORION_KARAR_DOSYASI` verilmezse gerçek karar kaydına yazıyor; `OPENCODE_SERVER_PASSWORD` ayarsız.
