// uygulama/senaryolar/gidene.ts — GI SPIKE 1 ölçümü ("Işık Hacmi", `?gi=hacim`). Ön kayıt: docs/olcum/on-kayit-gi-spike-1.md.
//
// Koşturma (bat modu yok; ham sorgu): ORION_SMOKE=1 ORION_SMOKE_MS=… ORION_SORGU_EK="gidene=1&gi=hacim&sessiz=1" npx electron .
//   `gikesif=1`  yalnız keşif: ofis mesh'lerinin dünya kutuları, malzemeleri, sahnenin ışıkları (ölçüm değil).
//   `gison=bos|isik|isima`  ölçümden sonra ekran görüntüsü için bırakılacak durum (K2a ışığı / K2b ışıyan karton).
//   `giolcme=1`  ölçümü atla, yalnız pozu ve `gison` durumunu kur (GI kapalı karşılaştırma görüntüleri için).
//   `gipoz=cam`  son poz tahta yerine cam duvara bakış (kapidene son pozu, 1. şahıs).
// Ölçüm KARE-HASSAS: `onAfterRender` içinde çizim tamponundan okunur (preserveDrawingBuffer kapalıyken tampon o anda geçerli),
// eylem okumadan HEMEN sonra yapılır → bir sonraki çizilen kare N+1. GI yoksa (bayraksız) GI'ye özgü adımlar atlanır.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Ray } from "@babylonjs/core/Culling/ray";

const s2 = (x: number) => x.toFixed(2);

/** Ön kayıttaki sayılar (değiştirilirse SAPMALAR'a yazılır). */
const POZ_TAHTA = { x: -2.2, z: -0.4, yaw: -Math.PI / 2 };
const POZ_KAPI = { x: 1.6, z: -1.0, yaw: 0 };
/** `gipoz=cam`: kapidene'nin son pozu (ofis içi, cam duvara bakış) — yalnız ekran görüntüsü. */
const POZ_CAM = { x: 1.6, z: 1.9, yaw: Math.PI };
const ORION_YERI = { x: 3.5, z: 2.5 };
const K2A_ISIK = { konum: new Vector3(-3.0, 0.9, -1.8), renk: new Color3(1.0, 0.3, 0.05), siddet: 4, menzil: 1.6 };
const K2B_ISIMA = { renk: new Color3(1.0, 0.45, 0.1), guc: 2.2 };

interface Ornek { r: number; g: number; b: number; n: number }
const rb = (o: Ornek) => o.r - o.b;

export async function kos(d: SenaryoBaglami): Promise<void> {
  const { sahne, motor, rig, oyuncu } = d;
  const log = (m: string) => console.log("[GIDENE] " + m);
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  await bekle(2500);
  const hazir = await d.ovayaCik();
  const gi = d.dunya.gi();
  log(`birleşik dünya: ${hazir} · gi: ${gi ? "AÇIK" : "kapalı"}`);
  const q = new URLSearchParams(location.search);

  if (q.has("gikesif")) { kesif(d, log); return; }

  // ── poz: 1. şahıs, Orion kameranın arkasında ──
  if (rig.mod !== "birinci") rig.modDegistir();
  const orion = d.orion;
  const pozla = async (p: { x: number; z: number; yaw: number }) => {
    oyuncu.isinla(p.x, p.z, p.yaw);
    rig.bakisAyarla(p.yaw, 0);
    orion?.isinla(ORION_YERI.x, ORION_YERI.z, 0);
    await bekle(1800);
  };
  await pozla(POZ_TAHTA);

  // ── ROI ──
  const roiKur = (noktalar: Vector3[], kabul: (m: AbstractMesh) => boolean) => {
    const W = motor.getRenderWidth(), H = motor.getRenderHeight();
    const kam = rig.kamera;
    const vp = kam.viewport.toGlobal(W, H);
    const px: [number, number][] = [];
    for (const p of noktalar) {
      const c = kam.globalPosition, dir = p.subtract(c), uz = dir.length();
      const hit = sahne.pickWithRay(new Ray(c, dir.normalize(), uz + 0.2), (m) => m.isPickable && m.isVisible && m.isEnabled());
      if (!hit?.hit || !hit.pickedMesh || !kabul(hit.pickedMesh) || Math.abs(hit.distance - uz) > 0.12) continue;
      const s = Vector3.Project(p, Matrix.IdentityReadOnly, sahne.getTransformMatrix(), vp);
      const x = Math.round(s.x), y = H - 1 - Math.round(s.y);   // GL: alttan
      if (x < 1 || y < 1 || x > W - 2 || y > H - 2) continue;
      px.push([x, y]);
    }
    if (px.length === 0) return { px, kutu: [0, 0, 1, 1] as const, buf: new Uint8Array(4) };
    const x0 = Math.min(...px.map((p) => p[0])) - 1, y0 = Math.min(...px.map((p) => p[1])) - 1;
    const x1 = Math.max(...px.map((p) => p[0])) + 1, y1 = Math.max(...px.map((p) => p[1])) + 1;
    return { px, kutu: [x0, y0, x1 - x0 + 1, y1 - y0 + 1] as const, buf: new Uint8Array(4 * (x1 - x0 + 1) * (y1 - y0 + 1)) };
  };
  type Roi = ReturnType<typeof roiKur>;
  const roiOku = (roi: Roi): Ornek => {
    const [x0, y0, w, h] = roi.kutu;
    void motor.readPixels(x0, y0, w, h, true, true, roi.buf);   // senkron doldurur (WebGL), söz yalnız sarmalayıcı
    let r = 0, g = 0, b = 0, n = 0;
    for (const [x, y] of roi.px) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const o = 4 * ((y + dy - y0) * w + (x + dx - x0));
        r += roi.buf[o]!; g += roi.buf[o + 1]!; b += roi.buf[o + 2]!; n++;
      }
    }
    return { r: r / n, g: g / n, b: b / n, n: roi.px.length };
  };
  /** Bir sonraki çizilen karenin ROI'sini okur; `eylem` okumadan hemen sonra (bir sonraki kareyi etkiler). */
  const kare = (roi: Roi, eylem?: () => void) => new Promise<Ornek>((coz) => {
    sahne.onAfterRenderObservable.addOnce(() => { const o = roiOku(roi); eylem?.(); coz(o); });
  });
  const kareler = async (roi: Roi, n: number) => { let o: Ornek | null = null; for (let i = 0; i < n; i++) o = await kare(roi); return o!; };
  const ornekYaz = (o: Ornek) => `RGB ${s2(o.r)},${s2(o.g)},${s2(o.b)} R−B ${s2(rb(o))} (n=${o.n})`;

  const tahtaNoktalari: Vector3[] = [];
  for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) tahtaNoktalari.push(new Vector3(-4.9, 1.0 + (0.8 * j) / 4, -1.6 + (1.2 * i) / 6));
  const roiT = roiKur(tahtaNoktalari, (m) => m.name === "tahta_yuzey");
  log(`ROI-T geçerli nokta ${roiT.px.length}/35 kutu ${roiT.kutu.join(",")}${roiT.px.length < 20 ? " → ÖLÇÜM GEÇERSİZ" : ""}`);

  // Deney düzeneğinin parçaları (tek satırlık "konsol" eylemleri).
  let testIsigi: PointLight | null = null;
  const isikEkle = () => {
    testIsigi = new PointLight("gidene_isik", K2A_ISIK.konum.clone(), sahne);
    testIsigi.diffuse = K2A_ISIK.renk.clone(); testIsigi.specular = K2A_ISIK.renk.clone();
    testIsigi.intensity = K2A_ISIK.siddet; testIsigi.range = K2A_ISIK.menzil;
  };
  const isikKaldir = () => { testIsigi?.dispose(); testIsigi = null; };
  const karton = d.oda.meshler.find((m) => m.name === "oda_karton")?.material ?? null;
  const kartonEski = karton instanceof PBRMaterial ? { renk: karton.emissiveColor.clone(), guc: karton.emissiveIntensity } : null;
  const isimaAc = () => {
    if (!(karton instanceof PBRMaterial)) return;
    karton.unfreeze();
    karton.emissiveColor = K2B_ISIMA.renk.clone(); karton.emissiveIntensity = K2B_ISIMA.guc;
  };
  const isimaKapat = () => {
    if (!(karton instanceof PBRMaterial) || !kartonEski) return;
    karton.emissiveColor = kartonEski.renk.clone(); karton.emissiveIntensity = kartonEski.guc;
  };

  if (!q.has("giolcme")) {
    if (gi) await olc(gi);
    else log("GI yok: yalnız durum/görüntü (ölçüm GI ister)");
  }

  // ── ekran görüntüsü durumu ──
  await pozla(q.get("gipoz") === "cam" ? POZ_CAM : POZ_TAHTA);
  const son = q.get("gison") ?? "bos";
  if (son === "isik") isikEkle();
  if (son === "isima") isimaAc();
  if (gi) { gi.guc = 1; gi.kip = q.get("gikip") === "1" ? 1 : 0; }
  await bekle(1500);
  const sonOrnek = await kare(roiT);
  log(`son durum "${son}" (görüntü için) ROI-T ${ornekYaz(sonOrnek)} fps ${motor.getFps().toFixed(0)}`);
  log("bitti");

  // ────────────────────────────────────────────────────────────────────
  async function olc(g: NonNullable<ReturnType<typeof d.dunya.gi>>): Promise<void> {
    if (roiT.px.length < 20) { log("ROI-T yetersiz: K2 ölçülmedi"); }
    const gurultu = async (ad: string) => {
      const a = await kare(roiT), b = await kare(roiT);
      const x = Math.abs(rb(b) - rb(a));
      log(`gürültü ${ad}: |Δ(R−B)| ${x.toFixed(3)} (${ornekYaz(a)} → ${ornekYaz(b)})`);
      return x;
    };
    /** Önce (N) → eylem → N+1, N+15; sonra GI'siz aynı durum (GI payı). Dönen: N+1 Δ(R−B). */
    const deney = async (ad: string, ac: () => void, kapat: () => void) => {
      const once = await kare(roiT, ac);
      const n1 = await kare(roiT);
      await kareler(roiT, 13);
      const n15 = await kare(roiT, () => { g.guc = 0; });
      const gisiz = await kare(roiT);
      const d1 = rb(n1) - rb(once), d15 = rb(n15) - rb(once);
      log(`${ad}: N ${ornekYaz(once)}`);
      log(`${ad}: N+1 ${ornekYaz(n1)} Δ(R−B) ${s2(d1)} · N+15 Δ ${s2(d15)} (N+1/N+15 = ${s2(d15 !== 0 ? d1 / d15 : NaN)}) · GI'siz (aynı durum) ${ornekYaz(gisiz)} GI payı R−B ${s2(rb(n15) - rb(gisiz))}`);
      await kare(roiT, () => { g.guc = 1; kapat(); });
      await kareler(roiT, 40);   // malzemeler eski ışık sayısıyla yeniden derlensin, çok sekme sönsün
      return d1;
    };

    g.kip = 0; g.guc = 1;
    await kareler(roiT, 30);
    const gur1 = await gurultu("1");
    const gur2 = await gurultu("2");
    const gur = Math.max(gur1, gur2);

    // K2a: renkli ışık (doğrudan ışık ROI'ye ulaşamaz: kontrol C1 aşağıda).
    const d2a = await deney("K2a ışık", isikEkle, isikKaldir);
    // K2b: ışıyan yüzey (karton turuncu, güç 2,2).
    const d2b = await deney("K2b ışıma", isimaAc, isimaKapat);
    const esik = (x: number) => x >= 8 && x >= 5 * gur;
    log(`SONUÇ K2a Δ(R−B) N+1 = ${s2(d2a)} eşik ≥ 8 ve ≥ 5×gürültü (${s2(5 * gur)}) → ${esik(d2a) ? "GEÇTİ" : "KALDI"}`);
    log(`SONUÇ K2b Δ(R−B) N+1 = ${s2(d2b)} eşik ≥ 8 ve ≥ 5×gürültü (${s2(5 * gur)}) → ${esik(d2b) ? "GEÇTİ" : "KALDI"}`);

    // C1: GI gücü 0 iken ışık eklenir; 30 kare (yeniden derleme) sonra ROI değişmemeli (doğrudan ışık ulaşmıyor).
    await kare(roiT, () => { g.guc = 0; });
    await kareler(roiT, 5);
    const c0 = await kare(roiT, isikEkle);
    const c30 = await kareler(roiT, 30);
    const dc = Math.abs(rb(c30) - rb(c0));
    log(`SONUÇ C1 (GI 0, doğrudan ışık kontrolü) |Δ(R−B)| N+30 = ${s2(dc)} eşik ≤ gürültü + 1,5 (${s2(gur + 1.5)}) → ${dc <= gur + 1.5 ? "GEÇERLİ" : "GEÇERSİZ (doğrudan ışık ROI'ye ulaşıyor)"} · ${ornekYaz(c0)} → ${ornekYaz(c30)}`);
    await kare(roiT, () => { isikKaldir(); g.guc = 1; });
    await kareler(roiT, 40);

    // Bilgi: yalnız-GI görünümünde aynı iki deney.
    g.kip = 1;
    await kareler(roiT, 10);
    await deney("yalnız-GI K2a", isikEkle, isikKaldir);
    await deney("yalnız-GI K2b", isimaAc, isimaKapat);
    g.kip = 0;

    // K3: GPU süresi, kare başı CPU, ışıklar.
    await kareler(roiT, 20);
    const s = g.sonIsik();
    log(`ışıklar: ${s.sayi} (atlanan ${s.atlanan}) ${s.adlar.join(",")}`);
    log(`SONUÇ K3 kare başı CPU (GI güncellemesi, üstel ort.) ${g.cpuMs().toFixed(3)} ms · fps ${motor.getFps().toFixed(1)}`);
    for (const tekrar of [50, 200]) {
      const o = await g.gpuOlc(tekrar);
      log(`SONUÇ K3 GPU (${tekrar} tekrar): finish ${o.finishMs.toFixed(3)} ms/kare · sorgu ${o.sorguMs === null ? "YOK" : o.sorguMs.toFixed(3) + " ms"} (${o.sorguNotu})${o.gecisMs ? ` · geçiş başına: enjeksiyon ${o.gecisMs.enjeksiyon.toFixed(3)} mip ${o.gecisMs.mip.toFixed(3)} toplama ${o.gecisMs.toplama.toFixed(3)} ms` : ""}`);
      await kareler(roiT, 30);
    }
    const sy = g.sayim;
    log(`kurulum ${sy.kurulumMs} ms · ${sy.mesh} mesh ${sy.ucgen} üçgen · ızgara ${sy.n.join("×")} dolu ${sy.dolu} yakın ${sy.yakin} · VRAM hesabı ${sy.vramMiB.toFixed(1)} MiB`);

    // K4 (gözlem): kapıya bakış, yalnız-GI; dış lamba kapatılınca kapı önü iç zemin.
    await pozla(POZ_KAPI);
    g.kip = 1;
    const zemin: Vector3[] = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) zemin.push(new Vector3(2.1 + i * 0.25, 0.02, 2.8 + j * 0.3));
    const roiK = roiKur(zemin, (m) => m.name === "oda_zemin" || m.name === "oda_hali");
    const lamba = sahne.getLightByName("ufuk_lamba_isik_0");
    log(`ROI-K geçerli nokta ${roiK.px.length}/20 · lamba ${lamba ? s2(lamba.intensity) : "YOK"} · kapı açısı ${s2(d.dunya.kapiAcisi() ?? NaN)}`);
    if (lamba && roiK.px.length > 0) {
      await kareler(roiK, 20);
      const a = await kare(roiK), b = await kare(roiK);
      const eski = lamba.intensity;
      const k0 = await kare(roiK, () => { lamba.intensity = 0; });
      const k1 = await kare(roiK);
      const k15 = await kareler(roiK, 14);
      log(`SONUÇ K4 (gözlem) kapı önü iç zemin, yalnız-GI: gürültü |Δ| R ${s2(Math.abs(b.r - a.r))} B ${s2(Math.abs(b.b - a.b))} · dış lamba 0'a: N+1 ΔR ${s2(k1.r - k0.r)} ΔB ${s2(k1.b - k0.b)} · N+15 ΔR ${s2(k15.r - k0.r)} ΔB ${s2(k15.b - k0.b)} (${ornekYaz(k0)} → ${ornekYaz(k15)})`);
      lamba.intensity = eski;
    }
    g.kip = 0;
  }
}

function kesif(d: SenaryoBaglami, log: (m: string) => void): void {
  for (const m of d.oda.meshler) {
    if (!m.isEnabled() || !m.isVisible) continue;
    m.computeWorldMatrix(true);
    const k = m.getBoundingInfo().boundingBox, mat = m.material;
    const alb = mat instanceof PBRMaterial ? mat.albedoColor : mat instanceof StandardMaterial ? mat.diffuseColor : null;
    log(`mesh ${m.name} [${mat?.name ?? "-"}] min ${[k.minimumWorld.x, k.minimumWorld.y, k.minimumWorld.z].map(s2).join(",")} max ${[k.maximumWorld.x, k.maximumWorld.y, k.maximumWorld.z].map(s2).join(",")} albedo ${alb ? [alb.r, alb.g, alb.b].map(s2).join(",") : "-"}`);
  }
  for (const l of d.sahne.lights) {
    const p = l instanceof PointLight ? l.position : null;
    log(`ışık ${l.name} tür ${l.getTypeID()} şiddet ${s2(l.intensity)} renk ${[l.diffuse.r, l.diffuse.g, l.diffuse.b].map(s2).join(",")} ${p ? `konum ${[p.x, p.y, p.z].map(s2).join(",")} menzil ${s2(l instanceof PointLight ? l.range : 0)}` : ""} açık ${l.isEnabled()}`);
  }
  log("keşif bitti");
}
