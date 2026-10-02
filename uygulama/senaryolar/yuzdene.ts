// uygulama/senaryolar/yuzdene.ts — `3dorion.bat yuzdene` (spec 14 R3: world/giris.ts'ten taşındı,
// gövde aynı; giris.ts'in modül değişkenleri `d` bağlamından okunur).
// ── YÜZ denemesi (?yuzdene=1) ─────────────────────────────────────────────
// "Ağız senkronu çalışıyor" iddiasını MESH ÜZERİNDEN kanıtlar. Ölçülmüş
// tepe_agiz=1.000 değeri, iskelet ağzı desteklemiyorsa ekranda hiçbir şey
// yapmıyordu; bu deneme tam olarak o boşluğu kapatır.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Avatar } from "../../world/avatar/index.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { sahne } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await bekle(2000);
  const o = d.orion as Avatar | null;
  if (!o) { console.log("[YUZDENE] KALDI avatar yok"); return; }

  const b = o.iskeletBilgisi();
  console.log(`[YUZDENE] iskelet=${b.tur} kaynak=${b.kaynak} agiz=${b.agizDestegi} kirpma=${b.kirpmaDestegi}`);

  const cene = sahne.getMeshByName("orion_cene");
  const goz = sahne.getMeshByName("orion_gozL");
  if (!cene) { console.log("[YUZDENE] KALDI cene mesh'i yok"); return; }

  // Ağız: kapalıyken ve tam açıkken çenenin ölçeğini karşılaştır.
  o.agizAyarla(0); o.cizimGuncelle(0.016); await bekle(120);
  const kapali = cene.scaling.y;
  o.agizAyarla(1); o.cizimGuncelle(0.016); await bekle(120);
  const acik = cene.scaling.y;
  const fark = Math.abs(acik - kapali);
  console.log(`[YUZDENE] ${fark > 0.1 ? "GECTI" : "KALDI"} agiz mesh oynuyor  kapali=${kapali.toFixed(3)} acik=${acik.toFixed(3)} fark=${fark.toFixed(3)}`);
  o.agizAyarla(0);

  // Göz kırpma boşta mikro-hareketten gelir: 6 sn içinde göz ölçeği değişmeli.
  if (goz) {
    let enAz = Infinity, enCok = -Infinity;
    for (let i = 0; i < 400; i++) {
      o.cizimGuncelle(0.016);
      enAz = Math.min(enAz, goz.scaling.y);
      enCok = Math.max(enCok, goz.scaling.y);
      await bekle(15);
    }
    const genlik = enCok - enAz;
    console.log(`[YUZDENE] ${genlik > 0.05 ? "GECTI" : "KALDI"} goz kirpiyor  genlik=${genlik.toFixed(3)}`);
  }
}
