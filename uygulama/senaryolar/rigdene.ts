// uygulama/senaryolar/rigdene.ts — `3dorion.bat rigdene`: Control Rig (spec 38) Orion'un GERÇEK gövdesinde: kontrol şekilleri çiziliyor mu, tıklama doğru
// kontrolü buluyor mu, halka sürükleyince kemik GERÇEKTEN hareket ediyor mu, değişiklik anahtara yazılıyor mu, geri al pozu eski yerine döndürüyor mu.
//
// Birim testler matematiği (eksen döndürme, sürükleme açısı) ve anahtar yazmayı ölçer; kontrol şekillerinin NEREDE ve NASIL göründüğü, halkanın sürüklenebilir
// olduğu ve editör yerleşimi yalnız GÖRÜNTÜYE bakarak anlaşılır. Kareler `[KLIPSS] <ad>` satırıyla alınır (ana süreç ORION_SS_DIR'e PNG yazar, host/main.js).
//   R0  Orion gövdesi ve örnek sekans hazır, editör açıldı           R1  tuval dokun ÜSTÜNDE kaldı (editör açıkken küçüldü)
//   R2  rig kipi açıldı; 17 kontrolün şekli sahnede                   R3  eldeki kutuya "tıklama" (izdüşüm + pick) kontrolü buluyor
//   R4  seçili kontrolün üç döndürme halkası tıklanabiliyor           R5  halka sürüklenince bırakınca iz ve anahtar yazıldı, el HAREKET etti
//   R6  Ctrl+Z (geriAl) eli eski yerine döndürdü                      R7  panelden dondur: başka karede de poz bedende görünüyor
//   R8  ▶ oynatma rig pozunu bırakır ve hata vermez                   R9  rig kapanınca beden tabana döner
// Görsel karar insana/denetçiye ait: senaryo kareleri üretir, "doğru görünüyor" demez.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import { KAMERA_YONU, kameraKilitle, orionuKarsiyaAl } from "../senaryoSahnesi.ts";

const uzaklik = (a: { x: number; y: number; z: number } | null, b: { x: number; y: number; z: number } | null): number => (a && b ? Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) : NaN);

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[RIGDENE] " + m);
  let gecen = 0, kalan = 0;
  const kontrol = (ad: string, ok: boolean, ek = "") => { if (ok) gecen++; else kalan++; log(`${ok ? "GECTI" : "KALDI"} ${ad}${ek ? ` — ${ek}` : ""}`); };
  const kare = async (ad: string) => { console.log("[KLIPSS] " + ad); await bekle(250); };
  const bitir = () => console.log(`[RIGDENE] ${kalan === 0 ? "GECTI" : "KALDI"} — ${gecen}/${gecen + kalan}`);

  await bekle(3000);
  await d.sekans.hazir();
  const orion = d.orion;
  const ornek = d.sekans.ornekler().find((s) => s.ad === "kimodo_el_salla");
  kontrol("R0 Orion gövdesi ve kimodo_el_salla hazır", !!orion && !!ornek, !ornek ? "örnek yok (npm run kimodo:hepsi)" : "");
  if (!orion || !ornek) { bitir(); return; }

  const k = await orionuKarsiyaAl(d, "rigdene");
  if (!k) { bitir(); return; }
  kameraKilitle(d, k, KAMERA_YONU.onden, 2.8);
  await bekle(600);
  await kare("00_dinlenme");
  d.rig.odakBirak();   // imleç kipi (editör) odak kilidiyle açılamaz; oyuncu Orion'dan 4,2 m geride, ona bakıyor
  await bekle(1200);

  // Editörü aç (örneğin kopyası: örnek salt okunur).
  const ad = await d.sekans.ornegiAc("kimodo_el_salla");
  const oturum = d.sekans.editor.etkinOturum();
  kontrol("R0b editör açıldı (kopya)", !!ad && !!oturum && d.sekans.editor.acikMi(), `ad=${ad ?? "yok"}`);
  if (!oturum) { bitir(); return; }
  await bekle(900);
  const tuval = d.sahne.getEngine().getRenderingCanvas();
  const yuk = tuval?.clientHeight ?? 0;
  kontrol("R1 tuval dokun ÜSTÜNDE kaldı (editör açıkken küçüldü)", yuk > 0 && yuk < innerHeight - d.sekans.editor.dokYuksekligi() * 0.8, `tuval ${yuk} px · pencere ${innerHeight} px · dok ${d.sekans.editor.dokYuksekligi()} px`);
  await kare("01_editor_rig_kapali");

  // Rig kipi.
  const acildi = d.sekans.editor.rigDegistir(true);
  await bekle(700);
  const sekiller = d.sahne.transformNodes.filter((n) => n.name.startsWith("rig_k_") && n.isEnabled()).length;
  kontrol("R2 rig kipi açıldı; 17 kontrolün şekli sahnede", acildi && d.sekans.rig.acikMi() && sekiller === 17, `açık=${d.sekans.rig.acikMi()} · şekil=${sekiller}`);
  await kare("02_rig_acik");

  // R3: elin kutusuna "tıklama" (izdüşüm + pick: gerçek fare olayının kullandığı aynı vurus()).
  const g = d.sekans.rig.gosterim;
  const elKonum = orion.uzuvKonumu("sol_el");
  const ek = g.ekranaKoy();
  const px = elKonum ? ek([elKonum.x, elKonum.y, elKonum.z]) : null;
  const vurus = px ? g.vurus(px.x, px.y) : null;
  kontrol("R3 eldeki kutuya tıklama kontrolü buluyor", vurus?.tur === "kontrol" && vurus.id === "k_sol_el", `vurus=${JSON.stringify(vurus)} · piksel=${px ? `${Math.round(px.x)},${Math.round(px.y)}` : "yok"}`);
  d.sekans.rig.sec("k_sol_on_kol");
  await bekle(500);
  await kare("03_secili_dirsek");

  // R4: seçili kontrolün halkalarından biri tıklanabilir (Z halkasının +X yönündeki noktası).
  const m = g.merkez();
  const r = 0.14;
  let halka: ReturnType<typeof g.vurus> = null;
  if (m) {
    // X halkası (YZ düzleminde; dirseği büker): Y ve Z halkalarıyla kesişmeyen 45° noktası (Y + Z yönlerinin ortası).
    const y = g.eksenYonu("y"), z = g.eksenYonu("z"), h = r * Math.SQRT1_2;
    const p = ek([m[0] + (y[0] + z[0]) * h, m[1] + (y[1] + z[1]) * h, m[2] + (y[2] + z[2]) * h]);
    halka = g.vurus(p.x, p.y);
  }
  kontrol("R4 X döndürme halkası tıklanabiliyor", halka?.tur === "halka" && halka.eksen === "x", `vurus=${halka ? (halka.tur === "halka" ? `halka ${halka.eksen}` : `kontrol ${halka.id}`) : "yok"}`);

  // R5: halkayı sürükle, bırak; el hareket etti mi, iz/anahtar yazıldı mı.
  oturum.kareyeGit(30);
  d.sekans.editor.tazele();
  await bekle(400);
  const once = orion.uzuvKonumu("sol_el");
  const izOnce = oturum.sekans().izler.length;
  const anahtarOnce = oturum.sekans().izler.reduce((t, z) => t + (z.tur === "uzuv" ? z.anahtarlar.length : 0), 0);
  if (halka?.tur === "halka") {
    d.sekans.rig.surukleBasla(halka.eksen, halka.nokta);
    for (let i = 0; i < 30; i++) { d.sekans.rig.surukleHareket(0, -12); await bekle(30); }
    await bekle(300);
    await kare("04_surukleme_onizleme");
    d.sekans.rig.surukleBitir();
  }
  await bekle(500);
  const sonra = orion.uzuvKonumu("sol_el");
  const anahtarSonra = oturum.sekans().izler.reduce((t, z) => t + (z.tur === "uzuv" ? z.anahtarlar.length : 0), 0);
  kontrol("R5 sürükleme yazıldı: anahtar arttı ve el hareket etti", anahtarSonra > anahtarOnce && uzaklik(once, sonra) > 0.08,
    `iz ${izOnce}→${oturum.sekans().izler.length} · anahtar ${anahtarOnce}→${anahtarSonra} · el ${uzaklik(once, sonra).toFixed(3)} m`);
  await kare("05_surukleme_sonrasi");

  // R6: geri al — tek adım.
  const gerial = oturum.geriAl();
  d.sekans.editor.tazele();
  await bekle(500);
  const geri = orion.uzuvKonumu("sol_el");
  // Boşta (nefes) animasyonu eli ~2 cm oynatır: eşik hareketin %30'u (ölçüm gürültüsünün üstünde, sürükleme farkının altında).
  kontrol("R6 Ctrl+Z pozu eski yerine döndürdü (tek adım)", gerial.ok && uzaklik(once, geri) < 0.3 * uzaklik(once, sonra), `${gerial.mesaj ?? ""} · geri alınca fark ${uzaklik(once, geri).toFixed(4)} m (sürükleme ${uzaklik(once, sonra).toFixed(3)} m)`);
  await kare("06_geri_alindi");

  // R7: panelden döndür (X +35°) ve başka bir kareye git: poz o karede doğru, öteki karede eski.
  oturum.kareyeGit(60);
  d.sekans.editor.tazele();
  await bekle(300);
  d.sekans.rig.sec("k_sag_kol");
  const p60 = orion.uzuvKonumu("sag_el");
  const dr = d.sekans.rig.dondur("x", 35);
  d.sekans.editor.tazele();
  await bekle(400);
  const p60Yeni = orion.uzuvKonumu("sag_el");
  oturum.kareyeGit(5);
  d.sekans.editor.tazele();
  await bekle(400);
  const p5 = orion.uzuvKonumu("sag_el");
  oturum.kareyeGit(60);
  d.sekans.editor.tazele();
  await bekle(400);
  const p60Geri = orion.uzuvKonumu("sag_el");
  kontrol("R7 panelden döndür: kare 60'ta el taşındı, kare 5'te taşınmadı, kare 60'a dönünce yine taşınmış", dr.ok && uzaklik(p60, p60Yeni) > 0.03 && uzaklik(p60Yeni, p60Geri) < 0.04 && uzaklik(p5, p60Yeni) > 0.03,
    `${dr.mesaj ?? ""} · 60: ${uzaklik(p60, p60Yeni).toFixed(3)} m taşındı · dönüş farkı ${uzaklik(p60Yeni, p60Geri).toFixed(4)} m`);
  await kare("07_panelden_dondurme");

  // R8: ▶ oynatma rig pozunu bırakır.
  const oy = d.sekans.oynat(oturum.sekans(), { baslangic: 0, dongu: false });
  await bekle(800);
  const oynuyor = d.sekans.durum().calisiyor !== null;
  await kare("08_oynarken");
  d.sekans.durdur();
  kontrol("R8 ▶ oynatma rig kipi açıkken de çalışır ve ■ durdurur", oy.ok && oynuyor, oy.ok ? `oynuyordu=${oynuyor}` : oy.neden);

  // R9: rig kapanınca beden tabana döner (rig pozu bırakıldı).
  d.sekans.editor.rigDegistir(false);
  await bekle(600);
  const sekilSon = d.sahne.transformNodes.filter((n) => n.name.startsWith("rig_k_") && n.isEnabled()).length;
  kontrol("R9 rig kapandı: şekiller gizlendi", !d.sekans.rig.acikMi() && sekilSon === 0, `açık=${d.sekans.rig.acikMi()} · şekil=${sekilSon}`);
  await kare("09_rig_kapali");
  d.sekans.editor.gizle();
  await bekle(500);
  // İmleç kipinde Yapı çubuğunun şeridi görünür kalır (`--alt-cubuk`): tuval onun kadar kısa, editör payı (`--editor-alt`) ise kalkmış olmalı.
  const stil = getComputedStyle(document.documentElement);
  const yapiPayi = parseFloat(stil.getPropertyValue("--alt-cubuk")) || 0, editorPayi = parseFloat(stil.getPropertyValue("--editor-alt")) || 0;
  kontrol("R9b editör gizlenince tuval editör payını bıraktı", editorPayi === 0 && Math.abs((tuval?.clientHeight ?? 0) - (innerHeight - yapiPayi)) <= 2, `tuval ${tuval?.clientHeight ?? 0} px · pencere ${innerHeight} px · Yapı çubuğu ${yapiPayi} px · editör payı ${editorPayi} px`);
  d.rig.odakBirak();
  bitir();
}
