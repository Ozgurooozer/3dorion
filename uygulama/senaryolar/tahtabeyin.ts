// uygulama/senaryolar/tahtabeyin.ts — `3dorion.bat tahtabeyin` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── UCTAN UCA tahta denemesi (?tahtabeyin=1) ──────────────────────────────
// Zincirin tamami: Ozyn soyluyor -> beyin karar veriyor -> Orion yuruyor ->
// tahtaya yaziyor. Araclardan biri ilk kez GERCEK bir dunya izi birakiyor.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Avatar } from "../../world/avatar/index.ts";
import type { Kopru } from "../../bridge/kopru.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { tahta } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await bekle(2500);
  const k = d.kopru as Kopru | null;
  if (!k) { console.log("[TAHTABEYIN] KALDI kopru yok"); return; }

  k.algi({ tur: "duydum", kesin: true,
    metin: "tahtaya git ve 'suzgec bitti' yaz" });
  await bekle(20000);

  const satirlar = tahta.satirlar();
  const o = d.orion as Avatar | null;
  const konum = o?.durum().konum;
  console.log(`[TAHTABEYIN] orion konumu=${konum ? `${konum.x.toFixed(1)},${konum.z.toFixed(1)}` : "?"}`);
  for (const s of satirlar) console.log(`[TAHTABEYIN]   tahtada: "${s}"`);
  console.log(`[TAHTABEYIN] ${satirlar.length > 0 ? "GECTI" : "KALDI"} beyin tahtaya yazdirdi mi (satir=${satirlar.length})`);
}
