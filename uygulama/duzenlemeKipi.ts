// uygulama/duzenlemeKipi.ts — OYUN İÇİ DÜZENLEME (spec 30): "Çağır" hayaleti ve seçili nesnede taşı/döndür/ölçekle gizmosu. İnce Babylon yapıştırıcısı.
//
// Editörün (Ova Stil Deneme) sahne parçaları AYNEN kullanılır, kopya yok: hayalet (`editor/sahne/yerlestirme.ts`), yüzey ışını (`yuzey.ts`), gizmo (`gizmo.ts`).
// Editörün kamerası, tuş haritası ve araç çubuğu GELMEZ: Orion'da gezinme, seçim ve menü zaten var; burada yalnız iki şey eklenir —
//   • Çağır: asset imleci izler (yarı saydam hayalet, yüzeye oturur), SOL TIK koyar, sağ tık / Esc vazgeçer, tekerlek döndürür (Shift 90°). Art arda koyulabilir.
//   • Düzenle: seçili nesneye oklar / halkalar / ölçek kutuları takılır; sürükleme bitince yeni dönüşüm TEK adımda kayda yazılır (`yerlestirmeBaglantisi.donustur`).
// Yaslama varsayılan KAPALI (serbest); Ctrl basılıyken geçici olarak ızgaraya/açıya yaslanır (editördeki "Ctrl = tersle" ile aynı kural).
// Bu modül tıklamayı SAHİPLENİR: hayalet açıkken ya da imleç bir gizmo tutamağının üstündeyken `click`/`contextmenu` nesne seçimine (`nesneSecimi.ts`) GİTMEZ
// (yakalama aşamasında durdurulur; nesneSecimi'nden önce çalışır).
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Level } from "../world/level/cekirdek/levelKur.ts";
import type { Vec3 } from "../world/level/cekirdek/levelTanimi.ts";
import { kisaDonus, kisaKonum, kisaOlcek } from "../world/level/cekirdek/donusum.ts";
import { yuzeyKur } from "../world/level/editor/sahne/yuzey.ts";
import { yerlestirmeKur as hayaletKur, type Yerlestirme as Hayalet } from "../world/level/editor/sahne/yerlestirme.ts";
import { gizmoKatmaniKur, type GizmoKatmani } from "../world/level/editor/sahne/gizmo.ts";
import { YASLAMA_VARSAYILAN, type YaslamaAyari } from "../world/level/editor/cekirdek/yaslama.ts";
import type { DuzenlemeAraci } from "./menuKatkilari.ts";
import type { Degisim } from "./yerlestirme.ts";

/** Orion'da yaslama KAPALI başlar (serbest yerleşim); Ctrl geçici olarak ızgara/açı yaslaması açar. */
export const ORION_YASLAMA: YaslamaAyari = { ...YASLAMA_VARSAYILAN, konum: false, aci: false, olcek: false };
/** Hayalet tekerlek adımı (derece); Shift ile 90. */
export const TEKERLEK_ADIMI = 15;
/** Gizmo bırakıldıktan sonra bu kadar ms içindeki `click` nesne seçimine gitmez (bırakma tıklaması seçimi kaldırmasın). */
const BIRAKMA_PENCERESI_MS = 300;

export interface DuzenlemeKipiAyari {
  sahne: Scene;
  kamera: Camera;
  tuval: HTMLCanvasElement;
  /** Birleşik dünyanın level'ı (hazır değilse null). */
  level: () => Level | null;
  /** Seçili nesnenin kimliği (yoksa null): gizmo ona takılır, seçim değişince taşınır. */
  secili: () => string | null;
  /** Hayalet tıklanınca: koyulacak varlık, taban ortası ve derece cinsinden dönüş. */
  koy: (varlik: string, konum: Vec3, donus: Vec3) => void;
  /** Gizmo sürüklemesi bitti: nesnelerin yeni dönüşümü. */
  donustur: (degisim: ReadonlyMap<string, Degisim>, mesaj: string) => void;
  altyazi: (metin: string, ms?: number) => void;
}

export interface DuzenlemeKipi {
  /** Asset hayaletini başlat (imleç kipi açıkken). Önceki hayalet/gizmo kapanır. */
  cagir(varlik: string, ad: string): Promise<void>;
  /** Seçili nesneye gizmo tak (araç: taşı/döndür/ölçekle). */
  duzenle(arac: DuzenlemeAraci): void;
  /** Hayalet ve gizmo kapanır (imleç kipi kapanırken de çağrılır). */
  bitir(): void;
  /** Hayalet açık ya da gizmo kurulu mu. */
  etkin(): boolean;
  /** Hayaletin varlığı (hayalet yoksa null); alt çubuktaki kart vurgusu için. */
  cagrilan(): string | null;
  /** Hayalet başlayınca/bitince haber verir. Abonelikten çıkış işlevi döner. */
  dinle(f: () => void): () => void;
  /** Dinleyicileri sök, gizmo katmanını yok et. */
  yokEt(): void;
}

const ARAC_MESAJI: Record<DuzenlemeAraci, string> = { tasi: "taşındı", dondur: "döndürüldü", olcek: "ölçeklendi" };
const ARAC_IPUCU: Record<DuzenlemeAraci, string> = {
  tasi: "taşı: oklara/düzlemlere sürükle",
  dondur: "döndür: halkaları sürükle",
  olcek: "ölçekle: kutuları sürükle",
};

export function duzenlemeKipiKur(a: DuzenlemeKipiAyari): DuzenlemeKipi {
  let hayalet: Hayalet | null = null;
  let hayaletVarlik: string | null = null;
  let gizmo: GizmoKatmani | null = null;
  let arac: DuzenlemeAraci | null = null;
  let bagliId: string | null = null;
  let ctrl = false;
  let sonBirakma = -Infinity;
  const dinleyiciler = new Set<() => void>();
  const yay = () => { for (const f of [...dinleyiciler]) f(); };
  /** Son imleç konumu: hayalet yüklenince ilk karede imlecin altında görünsün. */
  let sonImlec: { x: number; y: number } | null = null;

  const noktaOf = (e: { clientX: number; clientY: number }) => { const r = a.tuval.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  /** Gizmo henüz yoksa kur; dinleyicileri bir kez bağla. */
  function gizmoyuHazirla(): GizmoKatmani {
    if (gizmo) return gizmo;
    const g = gizmoKatmaniKur(a.sahne);
    g.bitince((dugumler) => {
      sonBirakma = performance.now();
      const l = a.level();
      const harita = new Map<string, Degisim>();
      for (const d of dugumler) {
        const id = l?.nesneler.idsi(d) ?? null;
        if (!id) continue;
        const r = d.rotationQuaternion ? d.rotationQuaternion.toEulerAngles() : d.rotation;
        harita.set(id, {
          konum: kisaKonum([d.position.x, d.position.y, d.position.z]),
          donus: kisaDonus([(r.x * 180) / Math.PI, (r.y * 180) / Math.PI, (r.z * 180) / Math.PI]),
          olcek: kisaOlcek([d.scaling.x, d.scaling.y, d.scaling.z]),
        });
      }
      if (harita.size) a.donustur(harita, `${harita.size} nesne ${ARAC_MESAJI[arac ?? "tasi"]}`);
    });
    gizmo = g;
    return g;
  }

  const gizmoAyarla = () => {
    if (!gizmo || !arac) return;
    gizmo.ayarla({ arac, uzay: "dunya", yaslama: ORION_YASLAMA, ctrl });
  };

  /** Seçimle gizmo'yu eşitle (her karede ucuz kimlik karşılaştırması). */
  const gizmoyuSecimeBagla = () => {
    if (!gizmo || !arac) return;
    const id = a.secili();
    if (id === bagliId) return;
    bagliId = id;
    const d: TransformNode | null = id ? a.level()?.nesneler.dugum(id) ?? null : null;
    gizmo.bagla(d ? [d] : []);
  };

  const kareGozcu = a.sahne.onBeforeRenderObservable.add(gizmoyuSecimeBagla);

  // ── hayalet: işaretçi / tekerlek / tuş ──
  const hareket = (e: PointerEvent) => { sonImlec = noktaOf(e); if (hayalet?.etkin()) hayalet.tasi(sonImlec.x, sonImlec.y, ORION_YASLAMA, ctrl); };
  const tiklama = (e: MouseEvent) => {
    if (hayalet?.etkin()) {
      e.stopImmediatePropagation(); e.preventDefault();
      const k = hayalet.koyulacak();
      if (k && hayaletVarlik) a.koy(hayaletVarlik, k.konum, k.donus);
      else a.altyazi("buraya konamaz: imleç bir yüzeyin üstünde değil", 1800);
      return;
    }
    // Gizmo tutamağının üstünde ya da az önce bırakıldı: nesne seçimine gitmesin.
    if (gizmo?.ustunde() || performance.now() - sonBirakma < BIRAKMA_PENCERESI_MS) { e.stopImmediatePropagation(); }
  };
  const sagTik = (e: MouseEvent) => {
    if (!hayalet?.etkin()) return;
    e.stopImmediatePropagation(); e.preventDefault();
    kapatHayalet("yerleştirme bitti");
  };
  const tekerlek = (e: WheelEvent) => {
    if (!hayalet?.etkin()) return;
    hayalet.dondur((e.shiftKey ? 90 : TEKERLEK_ADIMI) * Math.sign(e.deltaY || e.deltaX));
    e.preventDefault(); e.stopImmediatePropagation();
  };
  const tusBas = (e: KeyboardEvent) => {
    if (e.key === "Control" || e.key === "Meta") { ctrl = true; gizmoAyarla(); }
    if (e.key !== "Escape") return;
    if (hayalet?.etkin()) { e.stopImmediatePropagation(); e.preventDefault(); kapatHayalet("yerleştirme bitti"); return; }
    if (gizmo?.iptal()) { e.stopImmediatePropagation(); e.preventDefault(); a.altyazi("düzenleme iptal edildi", 1500); }
  };
  const tusBirak = (e: KeyboardEvent) => { if (e.key === "Control" || e.key === "Meta") { ctrl = false; gizmoAyarla(); } };

  a.tuval.addEventListener("pointermove", hareket);
  a.tuval.addEventListener("click", tiklama, { capture: true });
  a.tuval.addEventListener("contextmenu", sagTik, { capture: true });
  a.tuval.addEventListener("wheel", tekerlek, { capture: true, passive: false });
  addEventListener("keydown", tusBas, { capture: true });
  addEventListener("keyup", tusBirak);

  function kapatHayalet(mesaj?: string): void {
    const vardi = hayalet?.etkin() ?? false;
    const cagriliydi = hayaletVarlik !== null;
    hayalet?.bitir();
    hayalet = null; hayaletVarlik = null;
    if (vardi && mesaj) a.altyazi(mesaj, 1500);
    if (cagriliydi) yay();
  }

  function gizmoyuKapat(): void {
    arac = null; bagliId = null;
    gizmo?.iptal();
    gizmo?.bagla([]);
    gizmo?.ayarla({ arac: "sec", uzay: "dunya", yaslama: ORION_YASLAMA, ctrl });
  }

  return {
    async cagir(varlik, ad) {
      const l = a.level();
      if (!l) { a.altyazi("dünya henüz hazır değil", 2000); return; }
      gizmoyuKapat();
      kapatHayalet();
      hayalet = hayaletKur(a.sahne, l, yuzeyKur(a.sahne, a.kamera, l));
      hayaletVarlik = varlik;
      yay();
      a.altyazi(`${ad}: sol tık koy · tekerlek döndür (Shift 90°) · sağ tık / Esc bitir · Ctrl: ızgaraya yasla`, 6000);
      const h = hayalet;
      await h.basla({ tur: "varlik", ad: varlik });
      if (hayalet === h && sonImlec) h.tasi(sonImlec.x, sonImlec.y, ORION_YASLAMA, ctrl);
    },
    duzenle(yeni) {
      kapatHayalet();
      const g = gizmoyuHazirla();
      arac = yeni; bagliId = null;
      gizmoAyarla();
      g.goster(true);
      gizmoyuSecimeBagla();
      a.altyazi(`${ARAC_IPUCU[yeni]} · Ctrl: yasla · Esc: sürüklemeyi iptal · menüden Düzenlemeyi bitir`, 5000);
    },
    bitir() {
      kapatHayalet();
      gizmoyuKapat();
    },
    etkin: () => (hayalet?.etkin() ?? false) || arac !== null,
    cagrilan: () => hayaletVarlik,
    dinle(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
    yokEt() {
      kapatHayalet();
      gizmoyuKapat();
      a.sahne.onBeforeRenderObservable.remove(kareGozcu);
      a.tuval.removeEventListener("pointermove", hareket);
      a.tuval.removeEventListener("click", tiklama, { capture: true });
      a.tuval.removeEventListener("contextmenu", sagTik, { capture: true });
      a.tuval.removeEventListener("wheel", tekerlek, { capture: true });
      removeEventListener("keydown", tusBas, { capture: true });
      removeEventListener("keyup", tusBirak);
      gizmo?.yokEt(); gizmo = null;
    },
  };
}
