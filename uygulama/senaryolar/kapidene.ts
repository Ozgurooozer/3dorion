// uygulama/senaryolar/kapidene.ts — `3dorion.bat kapidene` (spec 27): ofis ova'nın İÇİNDE, kapı gerçek bir kapı.
//
// (Eski sürüm spec 24'ün kararma + ışınlanma kapısını sınıyordu; ışınlanma kalktı, kod `world/giris.ts`te köşede duruyor.)
// Ölçülenler, hepsi SONUÇ olarak (söz değil): tek yer; kapı kendiliğinden açılır ve uzaklaşınca kapanır; Orion kapıdan YÜRÜYEREK dışarı
// çıkar ve geri döner (yol bulma kapıyı geçer, kapı onun için açılır); görünüm geçişi (sis) ofiste ofisin, dışarıda ova'nın, eşikte
// ikisinin arasında; pencere ova'ya bakar (sahte manzara gizli). `?poz=x,z,yaw(derece)` sonda oyuncuyu ışınlar (ekran görüntüsü, ORION_SS).
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Avatar } from "../../world/avatar/index.ts";
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";

/** Çizim sayısı bütçesi (Ozyn, 2026-10-14: "çizim sınırında sorun yok, 220 olur"). */
const CIZIM_BUTCESI = 220;

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { oyuncu, sahne } = d;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const sonuc: string[] = [];
  const kontrol = (ad: string, gecti: boolean, detay = "") =>
    sonuc.push(`${gecti ? "GECTI" : "KALDI"}  ${ad}${detay ? "  " + detay : ""}`);
  const olana = async (kosul: () => boolean, ms: number) => {
    for (let t = 0; t < ms; t += 100) { if (kosul()) return true; await bekle(100); }
    return kosul();
  };
  const bitir = () => {
    for (const r of sonuc) console.log("[KAPIDENE] " + r);
    console.log("[KAPIDENE] ozet: " + sonuc.filter((r) => r.startsWith("GECTI")).length + "/" + sonuc.length);
  };
  const aci = () => d.dunya.kapiAcisi() ?? NaN;
  const ACIK = 1.4, KAPALI = 0.05;   // tam açıklık π/2 ≈ 1,57

  await bekle(2500);
  const o = d.orion as Avatar | null;
  if (!o) { kontrol("Orion'un bedeni hazır", false); bitir(); return; }

  // ── 1. Tek dünya ──
  const hazir = await d.ovayaCik();
  kontrol("birleşik dünya kuruldu", hazir);
  const y = d.yerler();
  kontrol("tek yer: Ozyn ve Orion AYNI yerde", y.ozyn === y.orion && y.ozyn.ad === "ova", `ozyn=${y.ozyn.ad} orion=${y.orion.ad}`);
  kontrol("ofisin çapaları ve ova aynı yerde", y.ozyn.capalar.some((c) => c.ad === "tahta") && y.ozyn.capalar.some((c) => c.ad === "kapi"));
  kontrol("pencere ova'ya bakıyor (sahte şehir resmi gizli)", sahne.getMeshByName("pen_manzara")?.isEnabled() === false);
  const fogOfis = sahne.fogDensity;
  kontrol("ofiste ofis havası (mor sis ≈ 0,035)", Math.abs(fogOfis - 0.035) < 0.004, `sis=${fogOfis.toFixed(4)} ic=${d.dunya.ic().toFixed(2)}`);

  // ── 2. Kapı kendiliğinden açılır / kapanır (Ozyn) ──
  oyuncu.isinla(-3, 0, 0);
  kontrol("kimse yakında değilken kapı kapalı", await olana(() => aci() < KAPALI, 3000), `açı=${aci().toFixed(2)}`);
  oyuncu.isinla(2.6, 2.6, 0);                                  // kapıya 1,4 m, yüz kapıya dönük
  kontrol("Ozyn kapıya yaklaşınca kapı AÇILIR", await olana(() => aci() > ACIK, 3000), `açı=${aci().toFixed(2)}`);
  oyuncu.isinla(2.6, 9, Math.PI);                              // eşiğin dışında 5 m
  kontrol("Ozyn uzaklaşınca kapı KAPANIR (Orion içeride de olsa: o uzakta)", await olana(() => aci() < KAPALI, 5000), `açı=${aci().toFixed(2)}`);
  const fogDis = await (async () => { await bekle(600); return sahne.fogDensity; })();
  kontrol("dışarıda ova havası (açık sis ≈ 0,004)", Math.abs(fogDis - 0.0042) < 0.002, `sis=${fogDis.toFixed(4)} ic=${d.dunya.ic().toFixed(2)}`);
  // Eşik: kameranın konumuna göre (3. şahıs kamera oyuncunun ~3 m arkasında): oyuncuyu kapıdan dışarı doğru yürüt, ic ve sis dizisini oku.
  const seri: { z: number; ic: number; sis: number }[] = [];
  for (const z of [0, 2, 3.5, 5, 6.5, 8, 10, 13]) {
    oyuncu.isinla(2.6, z, Math.PI);                          // yüz ofise dönük: kamera dışarıda, oyuncudan uzakta
    await bekle(450);
    seri.push({ z, ic: d.dunya.ic(), sis: sahne.fogDensity });
  }
  console.log("[KAPIDENE] geçiş serisi: " + seri.map((s) => `z=${s.z}:ic=${s.ic.toFixed(2)}/sis=${s.sis.toFixed(4)}`).join(" "));
  const azalan = seri.every((s, i) => i === 0 || s.ic <= seri[i - 1]!.ic + 1e-6);
  kontrol("görünüm geçişi tek yönlü (ofisten uzaklaştıkça ova'ya)", azalan);
  kontrol("eşikte görünüm İKİSİNİN ARASINDA", seri.some((s) => s.ic > 0.05 && s.ic < 0.95 && s.sis > fogDis && s.sis < fogOfis), `ic=${seri.map((s) => s.ic.toFixed(2)).join(",")}`);

  // ── 3. Orion kapıdan yürüyerek çıkar ve döner ──
  oyuncu.isinla(10, 14, Math.PI);                              // Ozyn kenarda: Orion'un yolunu kesmesin, kapıdan uzak
  await olana(() => aci() < KAPALI, 4000);
  let enAcik = 0;
  const izle = setInterval(() => { enAcik = Math.max(enAcik, aci()); }, 80);
  d.niyetiYurut({ tur: "git", hedef: { tip: "nokta", x: 2.6, y: 0, z: 8 } }, "kapidene_cik");
  const cikti = await olana(() => o.durum().konum.z > 6.5, 20_000);
  clearInterval(izle);
  kontrol("Orion kapıdan YÜRÜYEREK dışarı çıktı", cikti, `konum=${o.durum().konum.x.toFixed(1)},${o.durum().konum.z.toFixed(1)}`);
  kontrol("kapı Orion için açıldı", enAcik > ACIK, `en açık ${enAcik.toFixed(2)}`);
  kontrol("Orion çıkınca dışarıda algı: ova", d.algiSor("dunya").metin.length > 0);
  d.niyetiYurut({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }, "kapidene_don");
  const dondu = await olana(() => o.durum().konum.z < 3.4 && Math.abs(o.durum().konum.x) < 5, 30_000);
  kontrol("Orion kapıdan geri ofise yürüdü (tahtaya gidiyor)", dondu, `konum=${o.durum().konum.x.toFixed(1)},${o.durum().konum.z.toFixed(1)}`);

  // ── 4. Çizim bütçesi: ofisin içinde ve dışında, 4 sn ortalaması ──
  const olcer = new SceneInstrumentation(sahne);
  const cizimOlc = async (ad: string, x: number, z: number, yaw: number) => {
    oyuncu.isinla(x, z, yaw);
    await bekle(1500);
    let kare = 0, cizim = 0;
    const g = sahne.onAfterRenderObservable.add(() => { kare++; cizim += olcer.drawCallsCounter.current; });
    await bekle(4000);
    sahne.onAfterRenderObservable.remove(g);
    const ort = cizim / Math.max(kare, 1);
    kontrol(`çizim bütçesi (${ad}): ≤ ${CIZIM_BUTCESI}`, ort <= CIZIM_BUTCESI, `${ort.toFixed(0)} çizim, ${d.motor.getFps().toFixed(0)} fps`);
  };
  await cizimOlc("ofisin içi, cam duvara bakış", 1.6, 1.9, Math.PI);
  await cizimOlc("ofisin içi, kapıya bakış", 1.6, -1.0, 0);
  await cizimOlc("dışarıda, ofise bakış", 2.6, 12, Math.PI);
  await cizimOlc("dışarıda, ova'ya bakış", 2.6, 12, 0);

  // ── 5. Ekran görüntüsü için poz ──
  const poz = new URLSearchParams(location.search).get("poz");
  if (poz) {
    const [x, z, yaw] = poz.split(",").map(Number) as [number, number, number];
    oyuncu.isinla(x!, z!, (yaw! * Math.PI) / 180);
  } else {
    oyuncu.isinla(1.6, 1.9, Math.PI);                          // ofis içinde, cam duvara (ova'ya) bakarak
  }
  await bekle(3000);
  console.log(`[KAPIDENE] fps=${d.motor.getFps().toFixed(0)} aktifMesh=${sahne.getActiveMeshes().length} sis=${sahne.fogDensity.toFixed(4)} ic=${d.dunya.ic().toFixed(2)}`);
  bitir();
}
