// world/level/stil/isikSonrasi.ts — IŞIK SONRASI (spec 19): Babylon'un hazır sonrası işlemleri, stile göre ayarlı.
//
// Neden ayrı katman: Ozyn — "standart bir şey aramıyorum, ışık için post-processing eksik; shader'lara göre
// ayarlanabilsin". Her efekt `tanim.stil.son` içinde (stil/stilTanimi.ts), önayarla gelir, panelden ince ayar.
//
// SIRA (kameranın sonrası işleme listesi ekleme sırasıyla oluşur — bu yüzden zincir hep BU sırayla kurulur):
//   AO (SSAO2) → güneş huzmesi → boru hattı (bloom, alan derinliği, keskinlik, renk sapması, görüntü işleme, gren)
//   → [stil/efektler.ts] çizgi → renk/palet (en son: palete yuvarlama bloom'u da yuvarlar).
// Boru hattının kimi ayarları onu YENİDEN KURAR ve kendini listenin sonuna ekler (bloom/keskinlik/DOF/sapma/gren
// aç-kapa, bloom ölçeği, örnekleme — Babylon kaynağında doğrulandı); o ayarlar `sonImzasi`ndadır: değişince bütün
// zincir yeniden kurulur, sıra bozulmaz. Diğer değerler kaydırıcıyla canlı.
//
// Küresel aydınlatma (gi): Babylon GIRSMManager — güneşin yansıtıcı gölge haritasından tek sekme dolaylı ışık
// (Lumen'e en yakın yerleşik araç; yansıma yok). Ayrı, malzemeleri aydınlatmayan bir yönlü ışığın izdüşümü
// kameranın çevresindeki `alan`a sabitlenir (ova'nın 640 m zemini tek haritaya yayılıp çözünürlüğü yemesin).
// Parıltı (GlowLayer) yalnız güneş diskine: gök/bulut da "kendinden ışıklı" — hepsi parlamasın.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { ColorCurves } from "@babylonjs/core/Materials/colorCurves";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { SSAO2RenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline";
import "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import { VolumetricLightScatteringPostProcess } from "@babylonjs/core/PostProcesses/volumetricLightScatteringPostProcess";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { ReflectiveShadowMap } from "@babylonjs/core/Rendering/reflectiveShadowMap";
import { GIRSM } from "@babylonjs/core/Rendering/GlobalIllumination/giRSM";
import { GIRSMManager } from "@babylonjs/core/Rendering/GlobalIllumination/giRSMManager";
import type { SonStili } from "./stilTanimi.ts";
import type { Renk } from "../cekirdek/renk.ts";
import type { Vec3 } from "../cekirdek/levelTanimi.ts";
import { cizgiyeUygun } from "./efektler.ts";

/** Ton eşleme türü (tanım) → Babylon sabiti; 0 = kapalı. */
const TON = [-1, ImageProcessingConfiguration.TONEMAPPING_STANDARD, ImageProcessingConfiguration.TONEMAPPING_ACES, ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL];

/**
 * Uygulanacak değerler: `atla` (B tuşu, önce/sonra) bütün efektleri kapatır (ton eşleme standart görünüşte, ACES);
 * piksel kipinde bloom ve alan derinliği kapalı (pikseli bulandırır). Saf: test edilir.
 */
export function etkinSon(son: SonStili, piksel: number, atla: boolean): SonStili {
  const kapali = <T extends { acik: boolean }>(g: T): T => ({ ...g, acik: false });
  if (atla) {
    return {
      ...son, tonlama: { tur: 2 }, bloom: kapali(son.bloom), huzme: kapali(son.huzme), parilti: kapali(son.parilti),
      ao: kapali(son.ao), egri: kapali(son.egri), vinyet: kapali(son.vinyet), gren: kapali(son.gren), sapma: kapali(son.sapma),
      keskinlik: kapali(son.keskinlik), derinlik: kapali(son.derinlik), gi: kapali(son.gi),
    };
  }
  return piksel > 1 ? { ...son, bloom: kapali(son.bloom), derinlik: kapali(son.derinlik) } : son;
}

/** Boru hattı gerekiyor mu (bloom, DOF, keskinlik, sapma, gren — görüntü işleme ve eğri materyalde de olur). */
export const boruHattiGerekli = (e: SonStili) => e.bloom.acik || e.derinlik.acik || e.keskinlik.acik || e.sapma.acik || e.gren.acik;

/** Değişince zincirin YENİDEN KURULMASI gereken her şey (geri kalanı canlı). Saf. */
export function sonImzasi(e: SonStili, gunesId: number | null): string {
  return JSON.stringify([
    e.ao.acik, e.huzme.acik, e.huzme.ornek, e.parilti.acik, e.gi.acik, e.gi.ornek,
    e.bloom.acik, e.bloom.olcek, e.derinlik.acik, e.keskinlik.acik, e.sapma.acik, e.gren.acik, gunesId,
  ]);
}

/** Görüntü işleme (malzemede ya da boru hattında uygulanır): ton eşleme türü, renk eğrileri, vinyet. */
export function goruntuIslemeUygula(sahne: Scene, e: SonStili, tonlamaAcik: boolean, renk: (ad: string) => Renk, fov: number): void {
  const ip = sahne.imageProcessingConfiguration;
  const tur = Math.max(0, Math.min(3, Math.round(e.tonlama.tur)));
  ip.toneMappingEnabled = tonlamaAcik && tur > 0;
  if (tur > 0) ip.toneMappingType = TON[tur]!;
  ip.colorCurvesEnabled = e.egri.acik;
  if (e.egri.acik) {
    const c = ip.colorCurves ?? (ip.colorCurves = new ColorCurves());
    const g = e.egri;
    c.globalHue = g.genelTon; c.globalSaturation = g.genelDoygunluk;
    c.shadowsHue = g.golgeTon; c.shadowsDensity = g.golgeYogunluk; c.shadowsSaturation = g.golgeDoygunluk;
    c.highlightsHue = g.parlakTon; c.highlightsDensity = g.parlakYogunluk; c.highlightsSaturation = g.parlakDoygunluk;
  }
  ip.vignetteEnabled = e.vinyet.acik;
  if (e.vinyet.acik) {
    const r = renk(e.vinyet.renk);
    ip.vignetteWeight = e.vinyet.guc;
    ip.vignetteColor = new Color4(r[0], r[1], r[2], 0);
    ip.vignetteBlendMode = ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
    ip.vignetteCameraFov = fov;
  }
}

export interface SonKurulum {
  /** Canlı değerler (yeniden kurmadan). */
  guncelle(e: SonStili, gunesYonu: Vec3, gunesRengi: Renk, gunesSiddet: number): void;
  yokEt(): void;
}

/**
 * Zinciri SIRAYLA kurar (AO → huzme → boru hattı; GI ve parıltı sıradan bağımsız). Çizgi ve renk efektleri bundan
 * SONRA kurulmalı (stilSistemi).
 */
export function sonKur(sahne: Scene, kamera: Camera, e: SonStili, ornekleme: number, gunesDiski: Mesh | null): SonKurulum {
  const yikilacak: (() => void)[] = [];
  let ao: SSAO2RenderingPipeline | null = null;
  let huzme: VolumetricLightScatteringPostProcess | null = null;
  let hat: DefaultRenderingPipeline | null = null;
  let parilti: GlowLayer | null = null;
  let gi: { yon: DirectionalLight; rsm: ReflectiveShadowMap; girsm: GIRSM; yonetici: GIRSMManager; alan: number } | null = null;
  let gunesYonu = new Vector3(0, 1, 0);

  // GI önce: geometri tamponunu kendi biçimiyle kurar (çizgi sonra aynı tamponu kullanır).
  if (e.gi.acik) {
    const yon = new DirectionalLight("gi_isik", new Vector3(0, -1, 0), sahne);
    // Malzemeleri doğrudan AYDINLATMASIN (güneş zaten var): yalnız görünmez bir yer tutucuyu "aydınlatır".
    const yerTutucu = new Mesh("gi_yer_tutucu", sahne);
    yerTutucu.isVisible = false;
    yon.includedOnlyMeshes = [yerTutucu];
    yon.autoUpdateExtends = false;
    yon.shadowMinZ = 0; yon.shadowMaxZ = 1200;
    const rsm = new ReflectiveShadowMap(sahne, yon, { width: 512, height: 512 });
    rsm.forceUpdateLightParameters = true;
    const girsm = new GIRSM(rsm);
    girsm.numSamples = Math.round(e.gi.ornek);
    const motor = sahne.getEngine();
    const yonetici = new GIRSMManager(sahne, { width: motor.getRenderWidth(), height: motor.getRenderHeight() },
      // GI dokusu ÇEYREK çözünürlük (yumuşak dolaylı ışık; bulanıklaştırılıp büyütülür) — VRAM bütçesi.
      { width: Math.max(64, motor.getRenderWidth() >> 2), height: Math.max(64, motor.getRenderHeight() >> 2) }, 2048);
    yonetici.addGIRSM(girsm);
    // Yalnız IŞIKLI malzemeler (gök/bulut/güneş "pişmiş": GI eklenirse gök parlar). Babylon tekrar eklemeyi engeller.
    // RSM'e mesh `addMesh` ile girer: o, malzemeye akıyı (flux) yazan eklentiyi takar. İlk sürüm listeyi elle
    // doldurdu → RSM dokuları boş, GI sıfır (doku okunarak teşhis edildi). Yok edilenler listeden düşer.
    const giyeEkle = () => {
      const rl = rsm.renderList;
      if (rl) for (let i = rl.length - 1; i >= 0; i--) if (rl[i]!.isDisposed()) rl.splice(i, 1);
      for (const m of sahne.meshes) {
        if (!m.material || !cizgiyeUygun(m)) continue;
        // Önce RSM (malzemenin ışıksız KOPYASINI alır), sonra GI eklentisi — tersi kopyaya GI'yi de taşırdı.
        if (rl && !rl.includes(m)) rsm.addMesh(m);
        yonetici.addMaterial(m.material);
      }
    };
    giyeEkle();
    yonetici.enable = true;
    let kare = 0;
    gi = { yon, rsm, girsm, yonetici, alan: e.gi.alan };
    // RSM'e yalnız gök/bulut/güneş/çim DIŞI mesh'ler girer (gök kubbesi güneşi keser; çim pahalı ve gürültülü);
    // her karede: katmanlar yeniden kurulabilir. Yeni malzemeler de GI eklentisini almalı.
    const liste = sahne.onBeforeRenderObservable.add(() => {
      if (!gi) return;
      if (++kare % 30 === 0) giyeEkle();   // katman/nesne yeniden kurulunca yeni mesh ve malzemeler
      const k = kamera.globalPosition, a = gi.alan;
      gi.yon.direction = gunesYonu.scale(-1);
      gi.yon.position = new Vector3(k.x, 0, k.z).subtract(gi.yon.direction.scale(600));
      gi.yon.orthoLeft = -a; gi.yon.orthoRight = a; gi.yon.orthoTop = a; gi.yon.orthoBottom = -a;
    });
    yikilacak.push(() => {
      sahne.onBeforeRenderObservable.remove(liste);
      yonetici.dispose(); rsm.dispose(); yon.dispose(); yerTutucu.dispose();
    });
  }

  if (e.ao.acik) {
    // Geometri tamponunu PAYLAŞ (forceGeometryBuffer): varsayılan "prepass" yolu GI'nin ve çizginin tamponunu
    // kapatıyordu — GI sessizce hiç çalışmadı (sayfa içi teşhis: tampon yok, GI işlemi kurulu).
    // Yarım çözünürlükte hesap ve bulanıklaştırma: tam çözünürlüklü bulanıklaştırma 1080p'de +132 MiB'tı (ölçüldü).
    ao = new SSAO2RenderingPipeline("stil_ao", sahne, { ssaoRatio: 0.5, blurRatio: 0.5 }, [kamera], true);
    ao.expensiveBlur = false;
    ao.maxZ = 250;
    ao.samples = Math.round(e.ao.ornek);
    yikilacak.push(() => { ao?.dispose(); });
  }

  if (e.huzme.acik && gunesDiski) {
    huzme = new VolumetricLightScatteringPostProcess("stil_huzme", 0.5, kamera, gunesDiski, Math.round(e.huzme.ornek), undefined, sahne.getEngine(), false, sahne);
    // Güneş diski kameraya yapışık (sonsuz uzaklık): konumu her karede güneş yönünden verilir.
    huzme.useCustomMeshPosition = true;
    const h = huzme;
    const izle = sahne.onBeforeRenderObservable.add(() => { h.customMeshPosition = kamera.globalPosition.add(gunesYonu.scale(400)); });
    yikilacak.push(() => { sahne.onBeforeRenderObservable.remove(izle); h.dispose(kamera); });
  }

  if (boruHattiGerekli(e)) {
    hat = new DefaultRenderingPipeline("stil_hat", true, sahne, [kamera]);
    // MSAA yerine FXAA: 1080p'de 4× örneklemeli HDR hedefleri VRAM'i yüzlerce MB şişirdi (ölçüldü, spec 19).
    void ornekleme;
    hat.samples = 1;
    hat.fxaaEnabled = true;
    hat.bloomEnabled = e.bloom.acik;
    hat.bloomScale = e.bloom.olcek;
    hat.depthOfFieldEnabled = e.derinlik.acik;
    hat.sharpenEnabled = e.keskinlik.acik;
    hat.chromaticAberrationEnabled = e.sapma.acik;
    hat.grainEnabled = e.gren.acik;
    if (hat.grainEnabled) hat.grain.animated = true;
    const h = hat;
    yikilacak.push(() => h.dispose());
  }

  if (e.parilti.acik && gunesDiski) {
    parilti = new GlowLayer("stil_parilti", sahne, { blurKernelSize: Math.round(e.parilti.cekirdek) });
    parilti.addIncludedOnlyMesh(gunesDiski);
    const p = parilti;
    yikilacak.push(() => p.dispose());
  }

  return {
    guncelle(x, yon, gRenk, gSiddet) {
      gunesYonu = new Vector3(...yon);
      if (gi) {
        gi.alan = x.gi.alan;
        gi.girsm.intensity = x.gi.guc;
        gi.girsm.radius = x.gi.yaricap;
        gi.yon.diffuse = new Color3(...gRenk);
        gi.yon.intensity = gSiddet;
      }
      if (ao) { ao.radius = x.ao.yaricap; ao.totalStrength = x.ao.guc; }
      if (huzme) { huzme.density = x.huzme.yogunluk; huzme.decay = x.huzme.azalma; huzme.weight = x.huzme.agirlik; huzme.exposure = x.huzme.parlaklik; }
      if (hat) {
        hat.bloomThreshold = x.bloom.esik; hat.bloomWeight = x.bloom.guc; hat.bloomKernel = x.bloom.cekirdek;
        if (hat.depthOfFieldEnabled) { hat.depthOfField.focusDistance = x.derinlik.odak * 1000; hat.depthOfField.fStop = x.derinlik.aciklik; }
        if (hat.sharpenEnabled) hat.sharpen.edgeAmount = x.keskinlik.guc;
        if (hat.chromaticAberrationEnabled) hat.chromaticAberration.aberrationAmount = x.sapma.guc;
        if (hat.grainEnabled) hat.grain.intensity = x.gren.guc;
      }
      if (parilti) parilti.intensity = x.parilti.guc;
    },
    yokEt() {
      // Kuruluşun tersi: önce boru hattı/huzme/AO, en son GI (geometri tamponunu o kurdu).
      for (const y of yikilacak.reverse()) y();
      yikilacak.length = 0;
    },
  };
}
