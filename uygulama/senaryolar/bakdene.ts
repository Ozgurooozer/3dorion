// uygulama/senaryolar/bakdene.ts — `3dorion.bat bakdene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── BAK denemesi (?bakdene=1) ─────────────────────────────────────────────
// Algı hizmeti canlıda ULAŞILABİLİR mi? Araç ve hizmet yazılmıştı ama satır
// sözleşmesinde karşılığı yoktu: model bakma isteğini ifade EDEMİYORDU.
// Bu deneme zincirin tamamını sınar: soru → BAK: satırı → dunya_sor → cevap.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Kopru } from "../../bridge/kopru.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { niyetiYurut } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await bekle(3000);
  const k = d.kopru as Kopru | null;
  k?.algi({ tur: "duydum", kesin: true, metin: "önünde ne var, bir bak bakalım" });
  await bekle(20000);

  // BELİRLEYİCİ YEDEK: zincirin sınanması modelin `BAK:` satırı üretmesine
  // bağlı kalmasın. Zayıf bir model `bak` (avatar bakışı) seçince `gordum`
  // hiç doğmuyor ve deneme sessizce HİÇBİR ŞEY sınamıyordu — yeşil görünen
  // ama boş bir kapı. Model kendi üretmediyse niyeti biz gönderiyoruz;
  // ölçülen şey zincir (sor → cevap → beyne ŞİMDİ satırı), modelin seçimi değil.
  if (!(k?.sayac().dusunme ?? 0) || !d.gordumGeldi) {
    // ÖNCE YÖNE, SONRA SOR: gözlenen şey her koşuda AYNI olmalı, yoksa
    // ölçüm fazı değil sahneyi ölçer. Ozyn'e bakarken "önünde ne var"
    // sorusunun dürüst cevabı "Ozyn" oluyor ve Orion buna "sen" diyerek
    // cevap verebiliyor — puanlayıcı kelimeyi arar, sadık cevabı kaçırır.
    console.log("[BAKDENE] model BAK: uretmedi — once yonetim terminaline bak, sonra sor");
    niyetiYurut({ tur: "bak", hedef: { tip: "capa", ad: "admin" } }, "bakdene_yon");
    await bekle(2500);
    niyetiYurut({ tur: "sor", ne: "onumde" }, "bakdene_yedek");
    await bekle(12000);
  }
  console.log(`[BAKDENE] gordum=${d.gordumGeldi} sayac=${JSON.stringify(k?.sayac())}`);
}
