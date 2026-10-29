// uygulama/isikGizmosu.ts — IŞIK AKTÖRLERİ İÇİN SAHNE İŞARETİ + TAŞI GİZMOSU (spec 42). İnce Babylon yapıştırıcısı; mantık yok.
//
// Işıklar paneli (dok) ekranda olduğu sürece: her ışığın yerinde küçük parlak bir küre (nokta ışık görünmezdir, tıklanacak bir şey olsun), seçili ışığa taşı oklarını takar.
//   • Yeni ışık eklenince panel onu seçer → gizmo kendiliğinden ışığın üstünde çıkar.
//   • Sahnede küreye TIKLAMAK seçer (seçim EKRAN UZAYINDA: imlece en yakın küre, mesh pick değil — rig dersi, spec 38 §10; kürenin isPickable'ı kapalı kalır,
//     yoksa hayalet/bakış ışınları kürelere çarpardı).
//   • Oklarla sürükleme canlı görünür (ışık sürüklenirken izler); bırakınca yeni konum TEK adımda panele yazılır (`tasindi` → `level.ayarla`). Esc sürüklemeyi iptal eder.
// Gizmo katmanı editörün `gizmoKatmaniKur`u AYNEN (kopya yok); `duzenlemeKipi.ts`in asset gizmosundan ayrı bir örnektir (iki seçim birbirine karışmaz).
// Panel görünmezken küreler gizli, gizmo sökülü ve karede iş yapılmaz (setEnabled/ışık yeniden hesabı yalnız durum değişince).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Level } from "../world/level/cekirdek/levelKur.ts";
import type { Vec3 } from "../world/level/cekirdek/levelTanimi.ts";
import { kisaKonum } from "../world/level/cekirdek/donusum.ts";
import { gizmoKatmaniKur, type GizmoKatmani } from "../world/level/editor/sahne/gizmo.ts";
import { ORION_YASLAMA } from "./duzenlemeKipi.ts";

/** İşaret kürenin yarıçapı (m) ve seçim için imlecin en çok bu kadar piksel yakınında olması gerekir. */
const ISARET_YARICAPI = 0.14, SECIM_PIKSELI = 16;
/** Gizmo bırakıldıktan sonra bu kadar ms içindeki `click` seçimi bozmasın (duzenlemeKipi ile aynı kural). */
const BIRAKMA_PENCERESI_MS = 300;

export interface IsikGizmosuAyari {
  sahne: Scene;
  tuval: HTMLCanvasElement;
  level: () => Level | null;
  /** Panelin seçili ışığı. */
  secili: () => string | null;
  /** Işıklar paneli ekranda mı (değilse işaret ve gizmo yok). */
  gorunur: () => boolean;
  /** Sahnede bir işarete tıklandı. */
  sec: (id: string) => void;
  /** Gizmo bırakıldı: ışığın yeni konumu. */
  tasindi: (id: string, konum: Vec3) => void;
  altyazi: (metin: string, ms?: number) => void;
}
export interface IsikGizmosu {
  /** Gizmo bir ışığa bağlı mı (senaryo ölçüsü). */
  bagliId(): string | null;
  /** Şu an sahnede görünen işaret sayısı (senaryo ölçüsü). */
  isaretSayisi(): number;
  /** İşaretin ekrandaki yeri (tuvale göre CSS pikseli, `clientX/Y`); görünmüyorsa null. Senaryo gerçek tıklama olayını buradan üretir. */
  ekranNoktasi(id: string): { clientX: number; clientY: number } | null;
  gizmo(): GizmoKatmani | null;
  yokEt(): void;
}

export function isikGizmosuKur(a: IsikGizmosuAyari): IsikGizmosu {
  const isaretler = new Map<string, Mesh>();
  let gizmo: GizmoKatmani | null = null;
  let vekil: TransformNode | null = null;
  let bagli: string | null = null;
  let sonBirakma = -Infinity;
  let gorunuyordu = false;

  const hazirla = (): GizmoKatmani => {
    if (gizmo) return gizmo;
    const g = gizmoKatmaniKur(a.sahne);
    vekil = new TransformNode("isik_gizmo_vekili", a.sahne);
    g.ayarla({ arac: "tasi", uzay: "dunya", yaslama: ORION_YASLAMA, ctrl: false });
    g.bitince((dugumler) => {
      sonBirakma = performance.now();
      const d = dugumler[0];
      if (!d || !bagli) return;
      const p = d.getAbsolutePosition();
      a.tasindi(bagli, kisaKonum([p.x, p.y, p.z]));
    });
    gizmo = g;
    return g;
  };

  function isaretYap(id: string): Mesh {
    const m = CreateSphere(`isik_isareti_${id}`, { diameter: ISARET_YARICAPI * 2, segments: 8 }, a.sahne);
    const mat = new StandardMaterial(`isik_isareti_mat_${id}`, a.sahne);
    mat.disableLighting = true;
    m.material = mat;
    m.isPickable = false;
    m.metadata = { cizgisiz: true };   // stil çizgisi (kontur) zincirine girmez
    return m;
  }

  const kare = a.sahne.onBeforeRenderObservable.add(() => {
    const l = a.level();
    const acik = a.gorunur() && l !== null;
    if (!acik) {
      if (gorunuyordu) {
        for (const m of isaretler.values()) m.dispose(false, true);
        isaretler.clear();
        gizmo?.bagla([]); bagli = null;
        gorunuyordu = false;
      }
      return;
    }
    gorunuyordu = true;
    const var_ = new Set<string>();
    for (const id of l.isiklar.kimlikler()) {
      const isik = l.isiklar.isik(id);
      if (!isik) continue;
      var_.add(id);
      let m = isaretler.get(id);
      if (!m) { m = isaretYap(id); isaretler.set(id, m); }
      m.position.copyFrom(isik.position);
      const mat = m.material as StandardMaterial;
      if (!mat.emissiveColor.equals(isik.diffuse)) mat.emissiveColor = isik.diffuse.clone();
      const goster = isik.isEnabled(false);
      if (m.isVisible !== goster) m.isVisible = goster;
    }
    for (const [id, m] of isaretler) if (!var_.has(id)) { m.dispose(false, true); isaretler.delete(id); }

    // Gizmo: panelin seçili ışığına bağlı; yoksa sökülü. Vekil, ışığın konumunu izler (panelden yazılan konum gizmoyu da taşır).
    const hedef = a.secili();
    const hedefIsik = hedef ? l.isiklar.isik(hedef) : null;
    if (!hedefIsik || !hedef) {
      if (bagli !== null) { gizmo?.bagla([]); bagli = null; }
      return;
    }
    const g = hazirla();
    if (bagli !== hedef) { bagli = hedef; vekil!.position.copyFrom(hedefIsik.position); g.bagla([vekil!]); }
    else if (g.surukleniyor()) { vekil!.computeWorldMatrix(true); hedefIsik.position.copyFrom(vekil!.getAbsolutePosition()); }   // canlı geri bildirim: ışık okları izler
    else if (!vekil!.position.equals(hedefIsik.position)) { vekil!.position.copyFrom(hedefIsik.position); g.bagla([vekil!]); }
  });

  /** Tıklanan noktaya EKRANDA en yakın işaret (piksel payı içinde); yoksa null. */
  function enYakin(e: MouseEvent): string | null {
    const kamera = a.sahne.activeCamera;
    if (!kamera) return null;
    const motor = a.sahne.getEngine();
    const r = a.tuval.getBoundingClientRect();
    const ox = motor.getRenderWidth() / r.width, oy = motor.getRenderHeight() / r.height;
    const x = (e.clientX - r.left) * ox, y = (e.clientY - r.top) * oy;
    const goruntu = kamera.viewport.toGlobal(motor.getRenderWidth(), motor.getRenderHeight());
    const donusum = a.sahne.getTransformMatrix();
    let en: string | null = null, enMesafe = SECIM_PIKSELI * Math.max(ox, oy);
    for (const [id, m] of isaretler) {
      if (!m.isVisible) continue;
      const p = Vector3.Project(m.position, Matrix.IdentityReadOnly, donusum, goruntu);
      if (p.z < 0 || p.z > 1) continue;   // kameranın arkasında
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < enMesafe) { enMesafe = d; en = id; }
    }
    return en;
  }

  const tiklama = (e: MouseEvent) => {
    if (!a.gorunur() || !a.level()) return;
    // Gizmo tutamağının üstünde ya da az önce bırakıldı: başka seçime gitmesin.
    if (gizmo?.ustunde() || performance.now() - sonBirakma < BIRAKMA_PENCERESI_MS) { e.stopImmediatePropagation(); return; }
    const id = enYakin(e);
    if (id === null) return;
    e.stopImmediatePropagation();
    a.sec(id);
  };
  const tusBas = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !gizmo?.iptal()) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const l = a.level();
    if (l) l.ayarla(l.tanim());   // canlı izlenen ışık tanımdaki yerine döner
    a.altyazi("ışık taşıma iptal edildi", 1500);
  };
  a.tuval.addEventListener("click", tiklama, { capture: true });
  addEventListener("keydown", tusBas, { capture: true });

  return {
    bagliId: () => bagli,
    isaretSayisi: () => [...isaretler.values()].filter((m) => m.isVisible).length,
    ekranNoktasi(id) {
      const m = isaretler.get(id), kamera = a.sahne.activeCamera;
      if (!m || !m.isVisible || !kamera) return null;
      const motor = a.sahne.getEngine(), r = a.tuval.getBoundingClientRect();
      const p = Vector3.Project(m.position, Matrix.IdentityReadOnly, a.sahne.getTransformMatrix(), kamera.viewport.toGlobal(motor.getRenderWidth(), motor.getRenderHeight()));
      if (p.z < 0 || p.z > 1) return null;
      return { clientX: r.left + (p.x * r.width) / motor.getRenderWidth(), clientY: r.top + (p.y * r.height) / motor.getRenderHeight() };
    },
    gizmo: () => gizmo,
    yokEt() {
      a.sahne.onBeforeRenderObservable.remove(kare);
      a.tuval.removeEventListener("click", tiklama, { capture: true });
      removeEventListener("keydown", tusBas, { capture: true });
      for (const m of isaretler.values()) m.dispose(false, true);
      isaretler.clear();
      gizmo?.yokEt(); gizmo = null;
      vekil?.dispose(); vekil = null;
    },
  };
}
