// world/avatar/rig/gosterim.ts — RİG GÖSTERİMİ (spec 38 §3, §4): kontrol şekillerini ve seçili kontrolün döndürme halkalarını sahnede çizer, tıklamayı çözer.
// Babylon'a bağlı İNCE katman: ne yapılacağını bilmez (sekans, anahtar, geri al başka modülde); yalnız "nerede ne çizili" ve "şuraya tıklandı → şu".
//
// ŞEKİLLER (`kontroller.ts` kaydından): halka = ince simit, disk = sekizgen simit (pelvis), kutu = tel küp. Hepsi gövdenin üstünde çizilir
// (`renderingGroupId = 1`: derinlik temizlenir; seçim vurgusuyla aynı kural), sise/ışığa uymaz. Zincirde çocuğu olan halka KEMİĞİN EKSENİNE dizilir
// (omuz halkası kolu sarar); çocuğu olmayan (baş) yatay durur.
// TIKLAMA için şekillerin altında görünmez KALIN yardımcı mesh'ler vardır (ince simiti tutturmak zor): `metadata.rig`.
// DÖNDÜRME HALKALARI: seçili kontrolün eklemine gövde eksenlerinde üç halka (X kırmızı, Y yeşil, Z mavi); sürükleme açısı `surukleme.ts`.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Vec3 } from "../../../protocol/temel.ts";
import type { Uzuv } from "../../../protocol/animasyon.ts";
import { kanonikAta } from "../iskelet/kanonik.ts";
import { KONTROLLER, kontrolRengi, type Kontrol } from "./kontroller.ts";
import { RIG_EKSENLERI, type RigEkseni } from "./poz.ts";
import type { EkranaKoy, V3 } from "./surukleme.ts";
import { enYakinHalka } from "./halkaSecimi.ts";

/** Gösterimin avatardan istedikleri (Avatar'ın alt kümesi: sahte kaynakla başsız denenebilir). */
export interface RigKaynagi {
  uzuvKonumu(u: Uzuv): Vec3 | null;
  /** Gövdenin çizilen yaw'ı (radyan). */
  cizimYaw(): number;
}

export type RigVurusu =
  | { tur: "kontrol"; id: string }
  | { tur: "halka"; eksen: RigEkseni; nokta: V3 };

export interface RigGosterimi {
  etkin(a: boolean): void;
  etkinMi(): boolean;
  seciliYap(id: string | null): void;
  /** Tuval pikselinde (CSS) tıklanan şey; yoksa null. Döndürme halkası kontrolden ÖNCE sayılır. */
  vurus(x: number, y: number): RigVurusu | null;
  /** Seçili eklemin dünya konumu ve bir gövde ekseninin dünya yönü (sürükleme açısı için). */
  merkez(): V3 | null;
  eksenYonu(e: RigEkseni): V3;
  ekranaKoy(): EkranaKoy;
  yokEt(): void;
}

const RENK: Record<RigEkseni, Color3> = { x: new Color3(1, 0.25, 0.25), y: new Color3(0.3, 0.9, 0.3), z: new Color3(0.3, 0.55, 1) };
/** Kontrol şekli (ölçeksiz, metre): görünür tüp 1,2 cm, tıklama tüpü 5 cm. */
const HALKA_KALINLIK = 0.012;
const TUTMA_KALINLIK = 0.05;
/**
 * Döndürme halkaları BİRİM yarıçaplı simit olup düğüm ölçeğiyle (≈0,14) büyür: kalınlık da birimle ölçeklenir. İlk koşuda 0,05 birim → 7 mm'lik tıklama tüpü
 * hiçbir şeye tutturulamadı (rigdene R4). Birim kalınlıklar: görünür 0,07 (≈1 cm), tıklama 0,5 (≈7 cm).
 */
const DONDURME_GORUNUR = 0.07;
/** Halka seçimi: imleç halkanın ekrandaki çizgisine en çok bu kadar piksel uzaksa tutulur. */
const HALKA_TUTMA_PIKSEL = 11;

function malzeme(sahne: Scene, ad: string, renk: Color3): StandardMaterial {
  const m = new StandardMaterial(ad, sahne);
  m.disableLighting = true; m.emissiveColor = renk; m.diffuseColor = Color3.Black(); m.specularColor = Color3.Black();
  m.fogEnabled = false; m.backFaceCulling = false;
  return m;
}

function hex(h: string): Color3 { return Color3.FromHexString(h); }

function simit(sahne: Scene, ad: string, yaricap: number, kalinlik: number, segment: number): Mesh {
  return MeshBuilder.CreateTorus(ad, { diameter: yaricap * 2, thickness: kalinlik, tessellation: segment }, sahne);
}

function telKup(sahne: Scene, ad: string, kenar: number): LinesMesh {
  const k: Vector3[] = [];
  for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) k.push(new Vector3(x * kenar, y * kenar, z * kenar));
  const l: Vector3[][] = [];
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
    const a = k[i]!, b = k[j]!;
    if ((a.x !== b.x ? 1 : 0) + (a.y !== b.y ? 1 : 0) + (a.z !== b.z ? 1 : 0) === 1) l.push([a, b]);
  }
  return MeshBuilder.CreateLineSystem(ad, { lines: l }, sahne);
}

interface KontrolCizimi { kontrol: Kontrol; dugum: TransformNode; /** Şu an açık mı (setEnabled'ı yalnız DEĞİŞİNCE çağırmak için: her kare çağrısı ışık kaynaklarını yeniden hesaplatıp FPS'i 100'den 5'e düşürdü, rigdene 2026-10-23). */ acik: boolean; gorsel: Mesh; /** Tel küpün çizgisi (renk mesh'te); halka/diskte null. */ cizgi: LinesMesh | null; malz: StandardMaterial | null; cocuk: Uzuv | null }

export function rigGosterimiKur(sahne: Scene, kaynak: RigKaynagi): RigGosterimi {
  let acik = false, secili: string | null = null;
  const kok = new TransformNode("rig_kok", sahne);
  const cizimler: KontrolCizimi[] = [];
  const yukari = new Vector3(0, 1, 0);
  const isaretle = (m: Mesh, tut: object) => { m.renderingGroupId = 1; m.isPickable = false; m.parent = null; m.metadata = tut; m.applyFog = false; };

  for (const k of KONTROLLER) {
    const dugum = new TransformNode(`rig_${k.id}`, sahne);
    dugum.parent = kok;
    let gorsel: Mesh, cizgi: LinesMesh | null = null, malz: StandardMaterial | null = null, tutma: Mesh;
    if (k.sekil === "kutu") {
      cizgi = telKup(sahne, `rig_g_${k.id}`, k.yaricap * 1.4);
      gorsel = cizgi;
      cizgi.color = hex(kontrolRengi(k.taraf, false));
      tutma = MeshBuilder.CreateBox(`rig_t_${k.id}`, { size: Math.max(0.14, k.yaricap * 3) }, sahne);
    } else {
      gorsel = simit(sahne, `rig_g_${k.id}`, k.yaricap, HALKA_KALINLIK, k.sekil === "disk" ? 8 : 32);
      malz = malzeme(sahne, `rig_m_${k.id}`, hex(kontrolRengi(k.taraf, false)));
      gorsel.material = malz;
      tutma = simit(sahne, `rig_t_${k.id}`, k.yaricap, TUTMA_KALINLIK, 12);
    }
    isaretle(gorsel, { rig: false });
    isaretle(tutma, { rig: true, kontrol: k.id });
    tutma.isPickable = true; tutma.visibility = 0;
    gorsel.parent = dugum; tutma.parent = dugum;
    const cocuk = ((): Uzuv | null => {
      for (const o of KONTROLLER) if (kanonikAta(o.uzuv) === k.uzuv && o.zincir === k.zincir) return o.uzuv;
      return null;
    })();
    dugum.setEnabled(false);
    cizimler.push({ kontrol: k, dugum, acik: false, gorsel, cizgi, malz, cocuk });
  }

  // Döndürme halkaları (seçili kontrolün eklemi).
  const halkaDugumu = new TransformNode("rig_halkalar", sahne);
  halkaDugumu.parent = kok;
  const halkalar = new Map<RigEkseni, { gorsel: Mesh }>();
  for (const e of RIG_EKSENLERI) {
    const g = simit(sahne, `rig_h_${e}`, 1, DONDURME_GORUNUR, 48);
    g.material = malzeme(sahne, `rig_hm_${e}`, RENK[e]);
    isaretle(g, { rig: false });
    // Simit ekseni varsayılan Y: X halkası için z'de 90°, Z halkası için x'te 90°. TIKLAMA hedefi YOK: halka seçimi ekran uzayında (`halkaSecimi.ts`).
    g.parent = halkaDugumu; if (e === "x") g.rotation.z = Math.PI / 2; if (e === "z") g.rotation.x = Math.PI / 2;
    halkalar.set(e, { gorsel: g });
  }
  halkaDugumu.setEnabled(false);
  let halkaAcik = false;
  const halkaGoster = (g: boolean): void => { if (g !== halkaAcik) { halkaAcik = g; halkaDugumu.setEnabled(g); } };
  const kontrolGoster = (c: KontrolCizimi, g: boolean): void => { if (g !== c.acik) { c.acik = g; c.dugum.setEnabled(g); } };

  const secilen = (): KontrolCizimi | null => cizimler.find((c) => c.kontrol.id === secili) ?? null;

  const gozcu = sahne.onBeforeRenderObservable.add(() => {
    if (!acik) return;
    kok.rotation.y = 0;
    const yaw = kaynak.cizimYaw();
    for (const c of cizimler) {
      const p = kaynak.uzuvKonumu(c.kontrol.uzuv);
      kontrolGoster(c, p !== null);
      if (!p) continue;
      c.dugum.position.set(p.x, p.y, p.z);
      // Çocuğu olan halka kemik eksenine dizilir; yoksa gövdeyle birlikte yatay.
      const cp = c.cocuk ? kaynak.uzuvKonumu(c.cocuk) : null;
      if (cp && c.kontrol.sekil !== "kutu") {
        const d = new Vector3(cp.x - p.x, cp.y - p.y, cp.z - p.z);
        if (d.lengthSquared() > 1e-8) { d.normalize(); c.dugum.rotationQuaternion = Quaternion.FromUnitVectorsToRef(yukari, d, new Quaternion()); }
      } else c.dugum.rotationQuaternion = Quaternion.RotationYawPitchRoll(yaw, 0, 0);
    }
    const s = secilen();
    const sp = s ? kaynak.uzuvKonumu(s.kontrol.uzuv) : null;
    halkaGoster(sp !== null && s !== null);
    if (s && sp) {
      halkaDugumu.position.set(sp.x, sp.y, sp.z);
      halkaDugumu.rotationQuaternion = Quaternion.RotationYawPitchRoll(yaw, 0, 0);
      const r = Math.max(s.kontrol.yaricap * 1.9, 0.14);
      halkaDugumu.scaling.setAll(r);
    }
  });

  const eksenVekt: Record<RigEkseni, Vector3> = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) };
  const merkezKonumu = (): V3 | null => { const sc = secilen(), p = sc ? kaynak.uzuvKonumu(sc.kontrol.uzuv) : null; return p ? [p.x, p.y, p.z] : null; };
  const yonu = (e: RigEkseni): V3 => {
    halkaDugumu.computeWorldMatrix(true);
    const v = Vector3.TransformNormal(eksenVekt[e], halkaDugumu.getWorldMatrix()).normalize();
    return [v.x, v.y, v.z];
  };
  const ekranaKoyF = (): EkranaKoy => {
    const motor = sahne.getEngine(), kam = sahne.activeCamera;
    const olcek = motor.getHardwareScalingLevel();
    return (p) => {
      if (!kam) return { x: 0, y: 0 };
      const v = Vector3.Project(new Vector3(p[0], p[1], p[2]), Matrix.IdentityReadOnly, sahne.getTransformMatrix(), kam.viewport.toGlobal(motor.getRenderWidth(), motor.getRenderHeight()));
      return { x: v.x * olcek, y: v.y * olcek };
    };
  };

  function vurus(x: number, y: number): RigVurusu | null {
    if (!acik) return null;
    // Seçili kontrolün döndürme halkaları ÖNCE (üst üste binen kalın tıklama tüpleri yanlış halkayı seçerdi): ekranda çizgiye en yakın halka.
    const m = merkezKonumu();
    if (halkaAcik && m) {
      const sec = enYakinHalka({ merkez: m, y: yonu("y"), x: yonu("x"), z: yonu("z"), yaricap: halkaDugumu.scaling.x }, ekranaKoyF(), x, y, HALKA_TUTMA_PIKSEL);
      if (sec) return { tur: "halka", eksen: sec.eksen, nokta: sec.nokta };
    }
    const olcek = 1 / sahne.getEngine().getHardwareScalingLevel();
    const h = sahne.pick(x * olcek, y * olcek, (mm) => mm.metadata?.rig === true && mm.isEnabled(), false);
    if (!h?.hit || !h.pickedMesh) return null;
    const md = h.pickedMesh.metadata as { kontrol?: string };
    return md.kontrol ? { tur: "kontrol", id: md.kontrol } : null;
  }

  return {
    etkin(a) { acik = a; if (!a) { for (const c of cizimler) kontrolGoster(c, false); halkaGoster(false); } },
    etkinMi: () => acik,
    seciliYap(id) {
      secili = id;
      for (const c of cizimler) {
        const renk = hex(kontrolRengi(c.kontrol.taraf, c.kontrol.id === id));
        if (c.malz) c.malz.emissiveColor = renk; else if (c.cizgi) c.cizgi.color = renk;
      }
    },
    vurus,
    merkez: merkezKonumu,
    eksenYonu: yonu,
    ekranaKoy: ekranaKoyF,
    yokEt() {
      sahne.onBeforeRenderObservable.remove(gozcu);
      kok.dispose(false, true);
    },
  };
}
