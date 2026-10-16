# Açık işler — tek liste
Önceliği Ozyn belirler. Her madde tek satır + nerede. Biten madde SİLİNİR (geçmişi git'te). Tarihli eski güncenin TAMAMI: `gunluk/acik-isler-2026-10-16.md` (donuk). Son güncelleme: 2026-10-16.

**ODAK (2026-10-16 → 2026-10-30):** `world/level`'a yeni özellik YOK (yalnız hata düzeltme). Tek soru: **Orion günlük kullanımda işe yarıyor mu?** Kayıt: `kullanim-defteri.md` (ön kayıtlı ölçüt orada).

## Ozyn'dan bekleyen
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

## Rafta (odak boyunca dokunulmaz)
Otomatik GI (`?gi=hacim`), shader/stil/ufuk işleri, kendi stilimiz seçimi, yeşil harabe kiti (oyuna bağlı değil), editör açıkları (spec 20–22), ışık şikâyeti (pencere/kapı ışığı).

## Teknik borç
- `giris.ts` 815 satır ve `saat.dinle` gövdesi (kökte iş mantığı); `bridge/kopru.ts` 1435 satır; B5 (ofis dosyalarını `world/oda/`ya taşı); ayar normalizasyonu 5 kopya; `semaCizim.ts` testsiz.
- Groma sunucusu kapalıyken `host/webMonitor` her ~2–3 sn `http://localhost:4747` bağlanmayı deniyor ve log'a `ERR_CONNECTION_REFUSED` basıyor (geri çekilme yok; canlı log 2026-10-16).
- Ollama yetim `llama-server` VRAM tutuyor (temizleme betiği yok); duman koşuları `ORION_KARAR_DOSYASI` verilmezse gerçek karar kaydına yazıyor; `OPENCODE_SERVER_PASSWORD` ayarsız.
