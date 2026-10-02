// uygulama/senaryolar/zoomdene.ts — `3dorion.bat zoomdene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── ZOOM denemesi (?zoomdene=1) ───────────────────────────────────────────
// Ozyn'in bildirdiği şikayet: "kamera hâlâ çok yakın tabloya, tabloyu tam
// göremiyorum." Zoom eklendi; bu kip üç seviyede ekran görüntüsü aldırır.
// `ORION_ZOOM=<pay>` ile tek bir seviye seçilir.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { oda, zoomKutu, zoomOran, panelOdak, zoomUygula } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await bekle(1500);
  panelOdak(oda.semaYuzey, "beyin şeması");
  const istenen = Number(new URLSearchParams(location.search).get("zoom") ?? "0");
  if (istenen > 0) {
    d.zoomPayi = istenen;
    zoomUygula();
  }
  await bekle(2500);
  console.log(`[ZOOMDENE] pay=${d.zoomPayi.toFixed(2)} oran=${zoomOran.textContent} `
    + `kumanda=${zoomKutu.dataset.acik} odakta=${rig.odakta}`);
}
