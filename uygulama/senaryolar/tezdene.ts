// uygulama/senaryolar/tezdene.ts — `3dorion.bat tezdene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── TEZ denemesi (?tezdene=1) ─────────────────────────────────────────────
// Projenin tezi: "AI'in oturdugu oda - terminalini onun masasinda aciyorsun."
// Bu deneme o tezin tamamini kosar:
//   Ozyn hatali komut yazar -> Orion EKRANDAN gorur -> duzeltme ONERIR ->
//   Ozyn onaylar -> komut calisir -> Orion sonucu gorur.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Kopru } from "../../bridge/kopru.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { monitor, onayKapisi, onayKarari, monitoreGec } = d;
  try { localStorage.setItem("beyinDokum", "1"); } catch { /* onemsiz */ }
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // `?senaryobekle=N`: MCP ajanı (spec 05) HTTP ucuna bağlanana kadar bekle.
  // Yoksa hata ajan bağlanmadan gelir ve test yanlış sebepten kalır.
  await bekle(Number(new URLSearchParams(location.search).get("senaryobekle") ?? 0) * 1000);
  await bekle(2000);
  await monitoreGec();
  await bekle(1800);

  // Ozyn hatali bir komut yazar.
  monitor.yaz("gti status" + String.fromCharCode(13));
  await bekle(3000);

  // Orion'a durumu sor - gordugune gore oneri uretmeli.
  const kt = d.kopru as Kopru | null;
  kt?.algi({ tur: "duydum", kesin: true,
    metin: "ekranda ne oldu, duzeltmek icin bir komut onerir misin" });
  await bekle(18000);

  const b = onayKapisi.bekleyen;
  console.log(`[TEZDENE] oneri=${b ? `"${b.komut}" (${b.risk.seviye}) gerekce="${b.gerekce}"` : "YOK"}`);
  if (b) {
    onayKarari(true);
    await bekle(3500);
    const kuyruk = monitor.kuyruk(24).replace(/\s+/g, " ").slice(-160);
    console.log(`[TEZDENE] onay sonrasi ekran: ...${kuyruk}`);
  }
  console.log(`[TEZDENE] ${b ? "GECTI" : "KALDI"} Orion gordugune gore komut onerdi mi`);
  console.log(`[TEZDENE] kapi sayaci=${JSON.stringify(onayKapisi.sayac())}`);
}
