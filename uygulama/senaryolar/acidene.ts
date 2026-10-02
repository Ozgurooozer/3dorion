// uygulama/senaryolar/acidene.ts — `3dorion.bat acidene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── TERMİNAL AÇISI denemesi (?acidene=1) ──────────────────────────────────
// Ozyn'in bildirdiği asıl şikayet: "1. şahıstayken terminale düzgün açıyla
// geçemiyorum, 3. şahısta iyi." Düzeltme testle doğrulandı ama GÖRSEL olarak
// doğrulanmadı. Bu kip iki modda da monitöre geçip ekran görüntüsü aldırır.
//   ?acidene=1        → 3. şahıs
//   ?acidene=1&fps=1  → 1. şahıs
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { rig, monitor, monitoreGec } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await bekle(1500);
  if (new URLSearchParams(location.search).has("fps")) {
    rig.modDegistir();
    await bekle(1200);
  }
  console.log(`[ACIDENE] mod=${rig.mod}`);
  await monitoreGec();
  await bekle(2500);
  monitor.yaz("echo ACI-DENEMESI" + String.fromCharCode(13));
  await bekle(2000);
  console.log(`[ACIDENE] odakta=${rig.odakta} mod=${rig.mod}`);
}
