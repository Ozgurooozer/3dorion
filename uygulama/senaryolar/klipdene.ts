// uygulama/senaryolar/klipdene.ts — `3dorion.bat klipdene`: JSON animasyon klipleri Orion'un GERÇEK gövdesinde oynuyor mu (spec 35 Dilim 5a, §4f).
//
// Birim testler klibin geometrisini (el nereye gider) ölçer; deri yırtılıyor mu, kol gövdeye giriyor mu, yönler doğru mu — bunlar yalnız
// GÖRÜNTÜYE bakarak anlaşılır. Bu senaryo her klibi Orion'da (yüzü kameraya dönük; ilk koşuda yaw 0 sırtını çevirmişti) oynatır ve klip süresinin 0,1 / 0,35 / 0,6 / 0,85'inde
// pencereyi PNG olarak kaydeder (`ORION_SS_DIR`; ana süreç `[KLIPSS] <ad>` satırını görünce `capturePage` ile yazar, host/main.js).
//   K1  her klip için jest niyeti `bitti` döner (hata/iptal değil) ve süre ≈ klip süresi.
//   K2  oynatma sırasında kare hızı (`motor.getFps`) — ortalama ve en düşük basılır; eşik YOK (kare süresi ölçüm borcu: spec 35 §4f açıkları).
// Görsel karar insana/denetçiye ait: senaryo kareleri üretir, "doğru görünüyor" demez.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

/** Her klip: ad ve süresi (assets/animasyon/<ad>.json `sure`; klip bitişi sonuçtan da doğrulanır). */
const KLIPLER = [
  { ad: "el_salla", sure: 2.4 },
  { ad: "basla_onayla", sure: 1.2 },
  { ad: "basla_reddet", sure: 1.4 },
  { ad: "selam_ver", sure: 2.0 },
  { ad: "dusun", sure: 3.0 },
] as const;
/** Klip süresinin kesirleri: kare alma anları (başlangıç, çıkış, tepe, dönüş). */
const KESIRLER = [0.1, 0.35, 0.6, 0.85] as const;

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[KLIPDENE] " + m);
  let gecen = 0, kalan = 0;
  const kontrol = (ad: string, ok: boolean, ek = "") => { if (ok) gecen++; else kalan++; log(`${ok ? "GECTI" : "KALDI"} ${ad}${ek ? ` — ${ek}` : ""}`); };

  await bekle(3000);
  const orion = d.orion;
  if (!orion) { kontrol("K0 Orion gövdesi hazır", false); console.log("[KLIPDENE] KALDI — 0/1"); return; }

  // Sahne: Orion boştayken masaya (-Z) döner, bu yüzden `isinla` yaw'ı tutmaz (ilk üç koşuda görüldü). Ozyn kameranın ARKASINA geçer (kamera +Z'de, ona bakar)
  // ve Orion'a "oyuncuya bak" denir: boyun sınırı aşılınca gövde kendi döner, yüzü kameraya gelir.
  const k = orion.durum().konum;
  d.oyuncu.isinla(k.x, k.z + 4.2, Math.PI);
  d.niyetiYurut({ tur: "bak", hedef: { tip: "oyuncu" } }, "klipdene_bak");
  await bekle(2500);
  const hedef = new Vector3(k.x, 1.05, k.z);
  d.rig.odakKilitle(hedef, 2.6, 0.1, new Vector3(0, 0, 1));
  await bekle(1500);
  // Gövde döndükten sonra bakış serbest: "oyuncuya bak" sürerken baş sürekli ona kilitlenir, baş klibini (onay/ret) ezip ölçümü bozar (4. koşuda şüphelendik).
  d.niyetiYurut({ tur: "bak", hedef: null }, "klipdene_bak_birak");
  await bekle(400);
  log(`Orion (${k.x.toFixed(2)}, ${k.z.toFixed(2)}) iskelet=${orion.iskeletBilgisi().tur}`);

  const sonuclar = new Map<string, { durum: string; not?: string; t: number }>();
  const abonelik = orion.sonucDinle((s) => {
    if (s.durum === "basladi") return;
    sonuclar.set(s.niyet_id, { durum: s.durum, ...(s.not ? { not: s.not } : {}), t: performance.now() });
  });

  /** Ana süreç bu satırı görünce o anki pencereyi `<ORION_SS_DIR>/<ad>.png` olarak yazar. */
  const kare = async (ad: string) => { console.log("[KLIPSS] " + ad); await bekle(250); };

  await kare("00_dinlenme");
  for (const [i, klip] of KLIPLER.entries()) {
    const id = `klipdene_${i}`;
    const fps: number[] = [];
    const t0 = performance.now();
    d.niyetiYurut({ tur: "jest", jest: "el_salliyor", klip: klip.ad }, id);
    const olc = setInterval(() => fps.push(d.motor.getFps()), 150);
    for (const [j, kesir] of KESIRLER.entries()) {
      const hedefMs = kesir * klip.sure * 1000;
      const kalanMs = hedefMs - (performance.now() - t0);
      if (kalanMs > 0) await bekle(kalanMs);
      await kare(`${String(i + 1).padStart(2, "0")}_${klip.ad}_${j + 1}`);   // ~250 ms sürer; kareler bu yüzden klibin içinde kalır
    }
    // bitiş: sonuç gelene kadar en çok klip süresi + 3 sn
    const bitisSon = t0 + klip.sure * 1000 + 3000;
    while (!sonuclar.has(id) && performance.now() < bitisSon) await bekle(100);
    clearInterval(olc);
    const s = sonuclar.get(id);
    const gecenSn = s ? (s.t - t0) / 1000 : NaN;
    kontrol(`K1 ${klip.ad} bitti`, s?.durum === "bitti" && Math.abs(gecenSn - klip.sure) < 1.2,
      s ? `durum=${s.durum}${s.not ? ` not=${s.not}` : ""} süre=${gecenSn.toFixed(2)} sn (klip ${klip.sure})` : "sonuç gelmedi");
    const ort = fps.length ? fps.reduce((a, b) => a + b, 0) / fps.length : 0;
    log(`K2 ${klip.ad} kare hızı: ort=${ort.toFixed(1)} en düşük=${fps.length ? Math.min(...fps).toFixed(1) : "?"} (${fps.length} örnek)`);
    await bekle(800);
    await kare(`${String(i + 1).padStart(2, "0")}_${klip.ad}_5_sonra`);
  }
  abonelik();
  d.rig.odakBirak();
  console.log(`[KLIPDENE] ${kalan === 0 ? "GECTI" : "KALDI"} — ${gecen}/${gecen + kalan}`);
}
