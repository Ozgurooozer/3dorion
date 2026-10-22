// uygulama/senaryolar/sekansdene.ts — `3dorion.bat sekansdene`: örnek sekanslar Orion'un GERÇEK gövdesinde GERÇEK oynatıcıyla oynuyor mu, ■ kesiyor mu,
// Sekans sekmesi ve editör nasıl görünüyor (spec 36).
//
// Birim testler değerlendirmeyi, derlemeyi ve oynatıcıyı gerçek yürütücüyle ölçer; deri, yön, zamanlama hissi ve editörün DOM'u yalnız GÖRÜNTÜYE bakarak
// anlaşılır. Bu senaryo kareleri `[KLIPSS] <ad>` satırıyla alır (ana süreç `ORION_SS_DIR`e PNG yazar, host/main.js — klipdene'nin yakalayıcısı).
//   K0  Orion gövdesi ve iki örnek hazır
//   K1  selamlasma ▶ kabul edildi; K2 'bitti' ve süre ≈ sekans süresi (±1,2 sn)
//   K3  dusun_onayla ortasında ■ → durum 'durdu'
//   K4  döngüde süre geçince hâlâ oynuyor; ■ ile durur
//   K5  Sekans sekmesi açıldı; K6 editör açıldı (örneğin kopyası, senaryo koşusunda geçici klasörde)
// Görsel karar insana/denetçiye ait: senaryo kareleri üretir, "doğru görünüyor" demez. Flash senaryo koşusunda kurulmaz (örnekler Orion'a bağlı).
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { zamanYakinlastir } from "../sekans/editor/zamanEkseni.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[SEKANSDENE] " + m);
  let gecen = 0, kalan = 0;
  const kontrol = (ad: string, ok: boolean, ek = "") => { if (ok) gecen++; else kalan++; log(`${ok ? "GECTI" : "KALDI"} ${ad}${ek ? ` — ${ek}` : ""}`); };
  /** Ana süreç bu satırı görünce o anki pencereyi `<ORION_SS_DIR>/<ad>.png` olarak yazar. */
  const kare = async (ad: string) => { console.log("[KLIPSS] " + ad); await bekle(250); };
  const bitene = async (enCokMs: number) => { const son = performance.now() + enCokMs; while (d.sekans.durum().calisiyor && performance.now() < son) await bekle(100); };

  await bekle(3000);
  await d.sekans.hazir();
  const orion = d.orion;
  const ornekler = d.sekans.ornekler();
  const selam = ornekler.find((s) => s.ad === "selamlasma"), dusun = ornekler.find((s) => s.ad === "dusun_onayla");
  kontrol("K0 Orion gövdesi ve iki örnek hazır", !!orion && !!selam && !!dusun, `örnekler: ${ornekler.map((s) => s.ad).join(", ") || "yok"}`);
  if (!orion || !selam || !dusun) { console.log(`[SEKANSDENE] KALDI — ${gecen}/${gecen + kalan}`); return; }

  // Sahne (klipdene'nin kurulumu): Ozyn kameranın arkasına, Orion ona döner; dönünce bakış serbest (baş izini ezmesin).
  const k = orion.durum().konum;
  d.oyuncu.isinla(k.x, k.z + 4.2, Math.PI);
  d.niyetiYurut({ tur: "bak", hedef: { tip: "oyuncu" } }, "sekansdene_bak");
  await bekle(2500);
  d.rig.odakKilitle(new Vector3(k.x, 1.05, k.z), 2.6, 0.1, new Vector3(0, 0, 1));
  await bekle(1500);
  d.niyetiYurut({ tur: "bak", hedef: null }, "sekansdene_bak_birak");
  await bekle(400);
  await kare("00_dinlenme");

  // ── K1–K2: selamlasma bir kez, sonuna dek ──
  const sureMs = (selam.aralik.bit - selam.aralik.bas) / 30 * 1000;
  const t0 = performance.now();
  const r1 = d.sekans.oynat(selam, { baslangic: 0, dongu: false });
  kontrol("K1 selamlasma ▶ kabul", r1.ok, r1.ok ? "" : r1.neden);
  for (const [j, kesir] of [0.15, 0.4, 0.7, 0.9].entries()) {
    const kalanMs = kesir * sureMs - (performance.now() - t0);
    if (kalanMs > 0) await bekle(kalanMs);
    await kare(`01_selamlasma_${j + 1}`);
  }
  await bitene(sureMs + 3000);
  const s1 = d.sekans.durum().son, gecenSn = (performance.now() - t0) / 1000;
  kontrol("K2 selamlasma bitti", s1?.sekans === "selamlasma" && s1.durum === "bitti" && Math.abs(gecenSn - sureMs / 1000) < 1.2, `son=${s1?.durum ?? "yok"}${s1?.neden ? ` (${s1.neden})` : ""} · ${gecenSn.toFixed(2)} sn (sekans ${(sureMs / 1000).toFixed(2)})`);
  await bekle(600);
  await kare("01_selamlasma_5_sonra");

  // ── K3: dusun_onayla ortasında ■ ──
  const r2 = d.sekans.oynat(dusun, { baslangic: 0, dongu: false });
  await bekle(1500);
  await kare("02_dusun_onayla_ortada");
  d.sekans.durdur();
  const s2 = d.sekans.durum().son;
  kontrol("K3 ■ hemen keser", r2.ok && s2?.durum === "durdu" && !d.sekans.durum().calisiyor, r2.ok ? `son=${s2?.durum ?? "yok"} · kare ${s2?.kare ?? "?"}` : r2.neden);
  await bekle(300);
  await kare("02_dusun_onayla_durdu_sonra");   // el çeneden inmiş, baş düz olmalı

  // ── K4: döngü ──
  const r3 = d.sekans.oynat(selam, { baslangic: 0, dongu: true });
  await bekle(sureMs * 1.4);
  const surer = d.sekans.durum().calisiyor !== null;
  await kare("03_selamlasma_dongu_ikinci_tur");
  d.sekans.durdur();
  kontrol("K4 döngü süre geçince sürer, ■ durdurur", r3.ok && surer && d.sekans.durum().son?.durum === "durdu", r3.ok ? "" : r3.neden);
  await bekle(400);

  // ── K5–K6: Sekans sekmesi ve editör ──
  d.rig.odakBirak();
  kontrol("K5 Sekans sekmesi açıldı", d.sekans.sekmeAc());
  await bekle(700);
  await kare("04_sekans_sekmesi");
  const ad = await d.sekans.ornegiAc("dusun_onayla");
  const o = d.sekans.editor.etkinOturum();
  kontrol("K6 editör açıldı", !!ad && !!o && d.sekans.editor.acikMi(), ad ? `sekans '${ad}'` : "ornegiAc null döndü (imleç kipi açılamadı mı?)");
  if (ad && o) {
    await bekle(700);
    await kare("05_editor_acik");
    o.kareyeGit(100); d.sekans.editor.tazele(); await bekle(200);
    await kare("06_editor_kare100");
    o.secim = { tur: "anahtar", refs: [{ iz: "onay", kare: 102 }] }; d.sekans.editor.tazele(); await bekle(200);
    await kare("07_editor_anahtar_secili");
    o.secim = { tur: "bolum", iz: "dusun", i: 0 }; d.sekans.editor.tazele(); await bekle(200);
    await kare("08_editor_bolum_secili");
    o.gorunum = zamanYakinlastir(o.gorunum, 300, 2.5); d.sekans.editor.tazele(); await bekle(200);
    await kare("09_editor_yakin");
    // Editör açıkken oynat: playhead yürür, beden üstte görünür.
    o.secim = { tur: "yok" }; o.kareyeGit(0); d.sekans.editor.tazele();
    const r4 = d.sekans.oynat(o.sekans(), { baslangic: 0, dongu: false });
    await bekle(1800);
    await kare("10_editor_oynarken");
    await bitene(6000);
    log(`editörden oynatma: ${r4.ok ? d.sekans.durum().son?.durum ?? "?" : r4.neden}`);
    await kare("11_editor_bitti");
    d.sekans.editor.gizle();
  }
  console.log(`[SEKANSDENE] ${kalan === 0 ? "GECTI" : "KALDI"} — ${gecen}/${gecen + kalan}`);
}
