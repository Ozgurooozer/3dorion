# Spec 29 — Bağlam menüsü (Windows/Unreal tarzı, kurallı, çok hedefli)

**Durum:** çekirdek + görünüm + üç hedef YAZILDI (testli), canlıda GÖRÜLMEDİ. Spec 28'in düz sağ tık panelinin yerini alır; panel yalnız "Özellikler…" bilgi paneli olarak kalır.

## Amaç
Sağ tık, tıklanan hedefe göre uzun liste + alt menüler açar ("Orion ▸ Buraya ▸ Git / Bak"). Seçenekler **kurallara göre** gelir ve sistem yalnız Orion için değil, her hedef için aynıdır.

## Tasarım: yollu öğeler + katkılar
- Her **katkı** (`MenuKatkisi`) "hangi hedef türünde, hangi koşulda, hangi YOLA ne eklerim" der. Yol `["Orion","Otur"]` = "Orion ▸ Otur".
- Aynı yol parçasını kullanan katkılar kendiliğinden **birleşir**; çekirdek hedef bilmez. Yeni hedef = yeni `hedef.tur` + yeni katkı (`uygulama/menuKatkilari.ts`).
- Koşulu tutmayan katkı görünmez; tutup yapılamayan öğe **gri + nedenli** (gizleme yok). Bir düzeyde > 8 öğe → fazlası "Diğer ▸". Gruplar arası ayraç.
  Aynı kimlik iki kez ya da aynı ad hem eylem hem alt menü → **hata** (sessiz ezme yok).
- Alt menü **sağa, sığmazsa sola** açılır; üzerine gelince 150 ms gecikmeyle, tıklayınca hemen. Klavye: ↑↓ → ← Enter Esc. Esc yakalama aşamasında (imleç kipini kapatmasın).
- Tek eylem yolu değişmedi: yaprağın yükü `NesneEylemi`, çalıştırma `uygulama/nesneEtkilesimi.ts` → `niyetiYurut`.

## Dosyalar
`world/arayuz/menu/menuModeli.ts` (saf çekirdek + `sonrakiSatir`), `menuKonum.ts` (saf), `baglamMenusu.ts` (DOM) · `uygulama/menuKatkilari.ts` (zemin, Orion, nesne, Özellikler…, Seçimi kaldır) · bağlama `uygulama/giris.ts`.
Sağ tık hedef seçimi: `uygulama/nesneSecimi.ts` (en yakın isabet: nesne / Orion / zemin), `world/player/hedefSecici.ts`.

## Ölçülmeyenler / sonraya
- Gerçek ekranda hover gecikmesi, klavye gezinmesi, alt menünün sola dönmesi ve panelin görünümü canlıda görülmedi.
- Orion'un tıklanabilir kutusu (0,75 × 0,75 × 1,85 m) tahmin; zemin "engel var" payı 0,37 m (avatar yarıçapı 0,34, alt-sistem sınırı yüzünden kopya).
- Terminal/tahta/duvar hedefleri ve level editörü menüsü YOK (odak kuralı: `world/level`'a dokunulmaz, 2026-10-30'a kadar); kısayol atama/son kullanılanlar sonraki sürüm.
