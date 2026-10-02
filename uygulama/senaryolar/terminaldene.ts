// uygulama/senaryolar/terminaldene.ts — `3dorion.bat terminaldene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── Entegrasyon duman testi: terminal gerçekten açılıyor mu? ───────────────
// Kullanıcı E'ye bastığında çalışacağını ELDEN ÖNCE kanıtlar.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { monitor, monitoreGec } = d;
  try {
    await monitoreGec();
    await new Promise((r) => setTimeout(r, 1400));
    window.kopru; // köprü hazır olmalı
    const yaz = (m: string) => document.dispatchEvent(
      new KeyboardEvent("keydown", { key: m, bubbles: true }));
    for (const ch of "echo ORION ENTEGRASYON") yaz(ch);
    yaz("Enter");
    await new Promise((r) => setTimeout(r, 1200));
    console.log("[TERMDENE] acik=" + monitor.acikMi());
    for (const satir of monitor.kuyruk(8).split(String.fromCharCode(10))) {
      if (satir.trim()) console.log("[TERMDENE] | " + satir);
    }
  } catch (e) {
    console.error("[TERMDENE] hata:", e);
  }
}
