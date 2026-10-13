// world/yer/levelSahnesi.ts — Bir level'ı (ova) Orion'un odasıyla AYNI sahneye kurar ve kaldırır (spec 24 C2).
//
// NEDEN AYNI SAHNE: oyuncu, kamera, Orion'un bedeni ve odanın yüzeyleri (monitör, terminal, tahta) durum taşır;
// iki Babylon sahnesi arasında taşınamazlar. Kapıdan geçince oda GİZLENİR, level KURULUR; dönüşte level YIKILIR,
// oda ve sahne ayarları (sis, arka plan, ton, piksel ölçeği, kamera menzili) birebir geri gelir.
//
// NEDEN HER ÇIKIŞTA KUR / DÖNÜŞTE YIK (C0 ölçümü, docs/specs/24 §2): ovayı gizli tutmak odaya görsel ayar sızdırdı
// (oda gri-sisli kaldı) ve kademeli gölgenin otomatik sınırı ışık kapalıyken de her karede derinlik çizdi (45 → 90
// çizim). Yıkmak temiz: sayılar odanınkine birebir döndü; kurmak ~0,8 sn (kararmanın arkasında).
//
// Orion için `Yer` (levelYeri.ts) burada üretilir ve SAF VERİDİR: kutular bir kez sahneden ölçülür, yükseklik
// tanımdan gelir — level yıkıldıktan sonra da geçerli (Orion tek başına dışarıdayken, C6).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { Light } from "@babylonjs/core/Lights/light";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Observer } from "@babylonjs/core/Misc/observable";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { levelKur, type Level } from "../level/cekirdek/levelKur.ts";
import { levelTanimiDogrula, type Gecit } from "../level/cekirdek/levelTanimi.ts";
import { MODULLER } from "../level/moduller/index.ts";
import type { OdaKurulumu } from "../level/oda.ts";
import type { Yer } from "./yer.ts";
import { levelYuksekligi, kapiKutusu } from "./levelYeri.ts";
import { levelYeriniOlc } from "./levelOlcumu.ts";

export interface LevelSahnesiAyari {
  sahne: Scene;
  /** Level tanımı (doğrulanır; bozuksa fırlatır — oda yerinde kalır). */
  tanim: unknown;
  /** Yerin adı (algıya geçer): "ova". */
  ad: string;
  oda: OdaKurulumu;
  /** Oyuncunun kamerası: level'ın görsel stili (son işlem) buna bağlanır, menzili level'ınki olur. */
  kamera: Camera;
  /** Güneşin gölgesini düşürecek dış mesh'ler (oyuncu gövdesi, Orion'un bedeni). */
  golgeAtanlar?: readonly AbstractMesh[];
}

export interface LevelSahnesi {
  readonly level: Level;
  /** Orion ve oyuncu için yer (saf; yıkımdan sonra da geçerli). */
  readonly yer: Yer;
  /** Ofise açılan geçit (yoksa null). */
  readonly gecit: Gecit | null;
  /** Kurulumun sürdüğü süre (ms) — ölçüm satırı. */
  readonly kurulumMs: number;
  /** Level'ı kaldır, odayı ve sahne ayarlarını geri getir. */
  yokEt(): void;
}

/** Odanın sahne geneli ayarları — level bunları ezer, dönüşte geri yazılır. */
function sahneAyariniAl(sahne: Scene, kamera: Camera) {
  const ip = sahne.imageProcessingConfiguration;
  return {
    clear: sahne.clearColor.clone(), fogMode: sahne.fogMode, fogColor: sahne.fogColor.clone(), fogDensity: sahne.fogDensity,
    exposure: ip.exposure, contrast: ip.contrast, tone: ip.toneMappingEnabled, toneType: ip.toneMappingType, ipAcik: ip.isEnabled,
    olcek: sahne.getEngine().getHardwareScalingLevel(), maxZ: kamera.maxZ,
  };
}

export async function levelSahnesiKur(a: LevelSahnesiAyari): Promise<LevelSahnesi> {
  const bas = performance.now();
  const d = levelTanimiDogrula(a.tanim);
  if (!d.ok) throw new Error(`${a.ad}: level tanımı bozuk — ${d.hata}`);
  const { sahne, oda, kamera } = a;

  // ── Odayı gizle (yüzeyler çalışmaya devam eder: Ozyn dönünce terminal aynı yerde) ──
  const eski = sahneAyariniAl(sahne, kamera);
  const odaMeshleri: AbstractMesh[] = [...new Set([...oda.meshler, ...oda.seffaflar])].filter((m) => m.isEnabled());
  const odaIsiklari: Light[] = sahne.lights.filter((l) => l.isEnabled());
  const odaKatmanlari = sahne.effectLayers.filter((k) => k.isEnabled);
  for (const m of odaMeshleri) m.setEnabled(false);
  for (const l of odaIsiklari) l.setEnabled(false);
  for (const k of odaKatmanlari) k.isEnabled = false;
  const odayiGeriGetir = () => {
    for (const m of odaMeshleri) m.setEnabled(true);
    for (const l of odaIsiklari) l.setEnabled(true);
    for (const k of odaKatmanlari) k.isEnabled = true;
    sahne.clearColor = eski.clear.clone() as Color4;
    sahne.fogMode = eski.fogMode; sahne.fogColor = eski.fogColor.clone() as Color3; sahne.fogDensity = eski.fogDensity;
    const ip = sahne.imageProcessingConfiguration;
    ip.exposure = eski.exposure; ip.contrast = eski.contrast; ip.toneMappingEnabled = eski.tone; ip.toneMappingType = eski.toneType;
    ip.isEnabled = eski.ipAcik;
    sahne.getEngine().setHardwareScalingLevel(eski.olcek);
    const tuval = sahne.getEngine().getRenderingCanvas();
    if (tuval) tuval.style.imageRendering = "";
    kamera.maxZ = eski.maxZ;
  };

  let level: Level;
  try {
    level = levelKur(sahne, d.deger, MODULLER);
    await level.nesneler.hazir();
  } catch (err) {
    odayiGeriGetir();
    throw err;
  }
  level.stil.kameraBagla(kamera);
  kamera.maxZ = level.tanim().ortam.kamera.uzak;
  const tanim = level.tanim();
  const yukseklik = levelYuksekligi(tanim);

  // ── Kapı kanadı (glb binada kapı yok): odanınkiyle aynı ölçü, koyu ahşap, ince metal kasa ──
  const kapiMeshleri: Mesh[] = [];
  const gecit = tanim.gecitler?.[0] ?? null;
  if (gecit) {
    const k = kapiKutusu(gecit, yukseklik);
    const mAhsap = new StandardMaterial("m_gecit_kapi", sahne);
    mAhsap.diffuseColor = new Color3(0.22, 0.14, 0.09);
    mAhsap.specularColor = new Color3(0.05, 0.05, 0.05);
    const kanat = CreateBox("gecit_kapi", { width: k.g, height: k.yuk, depth: k.d }, sahne);
    kanat.position.set(k.x, k.y, k.z);
    kanat.material = mAhsap;
    kanat.metadata = { capa: "kapi" };
    kapiMeshleri.push(kanat);
    for (const m of kapiMeshleri) level.isik.golgeyeKat(m, { atar: true, alir: true });
  }
  for (const m of a.golgeAtanlar ?? []) level.isik.golgeyeKat(m, { atar: true });

  // ── Orion için yer: kutular sahneden BİR KEZ, anlam sözlükten (levelOlcumu.ts; birleşik dünya da aynısını kullanır) ──
  const yer = await levelYeriniOlc(level, a.ad);

  await sahne.whenReadyAsync();
  let son = performance.now();
  const gozlemci: Observer<Scene> = sahne.onBeforeRenderObservable.add(() => {
    const simdi = performance.now();
    level.guncelle(Math.min(0.1, (simdi - son) / 1000));
    son = simdi;
  });

  return {
    level, yer, gecit,
    kurulumMs: Math.round(performance.now() - bas),
    yokEt() {
      sahne.onBeforeRenderObservable.remove(gozlemci);
      for (const m of a.golgeAtanlar ?? []) level.isik.golgedenCikar(m);
      for (const m of kapiMeshleri) { m.material?.dispose(); m.dispose(); }
      level.yokEt();
      odayiGeriGetir();
    },
  };
}
