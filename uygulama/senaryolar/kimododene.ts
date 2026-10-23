// uygulama/senaryolar/kimododene.ts — `3dorion.bat kimododene`: Kimodo'dan çevrilen sekanslar (assets/sekans/kimodo_*.json, spec 37) Orion'un GERÇEK
// gövdesinde GERÇEK oynatıcıyla nasıl görünüyor.
//
// Çevirinin yönü/konumu başsız ölçüldü (tools/kimodo/govde.test.ts: uç etkileyici korelasyonu ve hatası); DERİ (eklem büküm görüntüsü, kolun gövdeye
// girmesi), ayak kayması ve "doğal mı" sorusu yalnız GÖRÜNTÜYLE anlaşılır. Senaryo her sekansı oynatır ve süre boyunca 6 eşit aralıkla `[KLIPSS] <ad>`
// satırıyla kare alır (ana süreç ORION_SS_DIR'e PNG yazar, host/main.js). Yürüme, koşma ve oturma YANDAN (bacak sallanması/kalça), ötekiler ÖNDEN.
//   K0  Orion gövdesi ve 8 kimodo örneği hazır
//   K1  döngüsüz sekans ▶ kabul ve `bitti`, süre ≈ sekans süresi (±1,2 sn)
//   K2  döngülü sekans (yürüme, koşma) iki tur sonra hâlâ oynuyor; ■ ile `durdu`
// Görsel karar insana/denetçiye ait: senaryo kareleri üretir, "doğru görünüyor" demez.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import { KAMERA_YONU, kameraKilitle, orionuKarsiyaAl } from "../senaryoSahnesi.ts";

/** Sıra: önce yerinde jestler, sonra beden hareketleri. */
const SIRA = ["kimodo_el_salla", "kimodo_onayla", "kimodo_dusun", "kimodo_bekle", "kimodo_zipla", "kimodo_otur", "kimodo_yuru", "kimodo_kos"] as const;
const YANDAN = new Set<string>(["kimodo_yuru", "kimodo_kos", "kimodo_otur"]);
const KARE_SAYISI = 6;

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[KIMODODENE] " + m);
  let gecen = 0, kalan = 0;
  const kontrol = (ad: string, ok: boolean, ek = "") => { if (ok) gecen++; else kalan++; log(`${ok ? "GECTI" : "KALDI"} ${ad}${ek ? ` — ${ek}` : ""}`); };
  const kare = async (ad: string) => { console.log("[KLIPSS] " + ad); await bekle(250); };
  const bitene = async (enCokMs: number) => { const son = performance.now() + enCokMs; while (d.sekans.durum().calisiyor && performance.now() < son) await bekle(100); };

  await bekle(3000);
  await d.sekans.hazir();
  const ornekler = SIRA.map((ad) => d.sekans.ornekler().find((s) => s.ad === ad) ?? null);
  const eksik = SIRA.filter((_, i) => !ornekler[i]);
  kontrol("K0 Orion gövdesi ve 8 kimodo örneği hazır", !!d.orion && eksik.length === 0, eksik.length ? `eksik: ${eksik.join(", ")} (npm run kimodo:hepsi)` : "");
  const k = await orionuKarsiyaAl(d, "kimododene");
  if (!k || eksik.length) { console.log(`[KIMODODENE] KALDI — ${gecen}/${gecen + kalan}`); return; }
  await kare("00_dinlenme");

  for (const [i, s] of ornekler.entries()) {
    if (!s) continue;
    const no = String(i + 1).padStart(2, "0");
    const dongu = s.aciklama?.includes("döngülü") ?? false;
    kameraKilitle(d, k, YANDAN.has(s.ad) ? KAMERA_YONU.yandan : KAMERA_YONU.onden, YANDAN.has(s.ad) ? 3.2 : 2.6);
    await bekle(600);
    const sureMs = ((s.aralik.bit - s.aralik.bas) / 30) * 1000;
    // Döngülüde iki tur (en az 3 sn) izlenir; kareler bu sürenin içine eşit aralıkla düşer.
    const izleMs = dongu ? Math.max(3000, 2 * sureMs) : sureMs;
    const t0 = performance.now();
    const r = d.sekans.oynat(s, { baslangic: 0, dongu });
    if (!r.ok) { kontrol(`${dongu ? "K2" : "K1"} ${s.ad} ▶ kabul`, false, r.neden); continue; }
    for (let j = 0; j < KARE_SAYISI; j++) {
      const kalanMs = ((j + 0.5) / KARE_SAYISI) * izleMs - (performance.now() - t0);
      if (kalanMs > 0) await bekle(kalanMs);
      await kare(`${no}_${s.ad}_${j + 1}`);   // ~250 ms sürer
    }
    if (dongu) {
      const kalanMs = izleMs - (performance.now() - t0);
      if (kalanMs > 0) await bekle(kalanMs);
      const surer = d.sekans.durum().calisiyor !== null;
      d.sekans.durdur();
      const son = d.sekans.durum().son;
      kontrol(`K2 ${s.ad} döngüde sürer, ■ durdurur`, surer && son?.sekans === s.ad && son.durum === "durdu", `iki tur sonra ${surer ? "oynuyordu" : "DURMUŞTU"} · son=${son?.durum ?? "yok"}${son?.neden ? ` (${son.neden})` : ""}`);
    } else {
      await bitene(sureMs + 3000);
      const son = d.sekans.durum().son, gecenSn = (performance.now() - t0) / 1000;
      kontrol(`K1 ${s.ad} bitti`, son?.sekans === s.ad && son.durum === "bitti" && Math.abs(gecenSn - sureMs / 1000) < 1.2,
        `son=${son?.durum ?? "yok"}${son?.neden ? ` (${son.neden})` : ""} · ${gecenSn.toFixed(2)} sn (sekans ${(sureMs / 1000).toFixed(2)})`);
    }
    await bekle(700);
    await kare(`${no}_${s.ad}_7_sonra`);   // beden tabana döndü mü (kol indi, kalça yerinde)
  }
  d.rig.odakBirak();
  console.log(`[KIMODODENE] ${kalan === 0 ? "GECTI" : "KALDI"} — ${gecen}/${gecen + kalan}`);
}
