// uygulama/zeminKalemi.ts — OYUN İÇİ ZEMİN KALEMİ (Yapı çubuğu · Zemin sekmesi): fırça halkası + basılı tutarak şekillendirme. İnce Babylon yapıştırıcısı.
//
// Editörün (Ova Stil Deneme) arazi kalemi AYNEN kullanılır, kopya yok: damga matematiği ve "nesneleri oturt" (`editor/cekirdek/araziKomutu.ts`), fırça halkası
// (`editor/sahne/firca.ts`), yüzey ışını (`editor/sahne/yuzey.ts`). Editörün kamerası, geçmişi ve araç çubuğu GELMEZ: Orion'da gezinme, seçim ve alt çubuk var.
//   • Sol tık basılı tut / sürükle: şekillendirir (fare durunca da ~90 ms'de bir damga: heykel fırçası). Shift: ters işlem (yükselt ⇄ alçalt).
//   • Ctrl+tekerlek: fırça yarıçapı. Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z): geri al / ileri al. Esc: süren vuruşu iptal eder, yoksa kalemi bırakır. Sağ tık: kalemi bırakır.
//   • Vuruş boyunca level CANLI değişir (`level.ayarla`, editörün önizlemesiyle aynı); vuruş BİTİNCE `vurusBitti` ile kayda/geçmişe/Yer'e işlenir (`zeminBaglantisi.ts`).
// Bu modül tıklamayı SAHİPLENİR (yakalama aşaması): kalem açıkken `pointerdown`/`click`/`contextmenu` nesne seçimine ve bağlam menüsüne GİTMEZ.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { Level } from "../world/level/cekirdek/levelKur.ts";
import type { LevelTanimi, Vec3 } from "../world/level/cekirdek/levelTanimi.ts";
import type { Bolge } from "../world/level/cekirdek/modul.ts";
import { bolgeBirlesim } from "../world/level/cekirdek/arazi.ts";
import { zeminTabanYuksekligi } from "../world/level/moduller/zemin.ts";
import { yuzeyKur } from "../world/level/editor/sahne/yuzey.ts";
import { fircaImleciKur, type FircaImleci } from "../world/level/editor/sahne/firca.ts";
import { ARAZI_VARSAYILAN, araziDamgasiUygula, araziIslemAdi, araziKatmani, type AraziAyari } from "../world/level/editor/cekirdek/araziKomutu.ts";
import { KALEM_VARSAYILAN, aracBilgisi, kalemAyariniDuzelt, yaricapAdimi, type KalemAyari, type ZeminAraci } from "./zeminAraclari.ts";
import { zeminAyari, zeminOku } from "./zemin.ts";
import type { Vurus } from "./zeminBaglantisi.ts";

/** Fare durup basılı dururken de damga vurulan aralık (ms). */
const DAMGA_ARALIGI_MS = 90;

export interface ZeminKalemiAyari {
  sahne: Scene;
  kamera: Camera;
  tuval: HTMLCanvasElement;
  /** Birleşik dünyanın level'ı (hazır değilse null). */
  level: () => Level | null;
  /** Kalem açılırken: öteki düzenleme kipleri (hayalet, gizmo) kapansın. */
  baslarken: () => void;
  /** Vuruş bitti: kayda/geçmişe/Yer'e işle. */
  vurusBitti: (v: Vurus) => void;
  geriAl: () => void;
  ileriAl: () => void;
  altyazi: (metin: string, ms?: number) => void;
}

export interface ZeminKalemi {
  /** Aracı seç (null: kalemi bırak). Level hazır değilse seçilmez, neden altyazıda. */
  sec(arac: ZeminAraci | null): void;
  arac(): ZeminAraci | null;
  ayar(): Readonly<KalemAyari>;
  ayarla(p: Partial<KalemAyari>): void;
  /** Vuruş sürüyor mu. */
  vuruyor(): boolean;
  /** Araç ya da ayar değişince (sekme tazelensin). */
  dinle(f: () => void): () => void;
  yokEt(): void;
}

interface Vurus_ {
  /** Vuruş başındaki level (iptalde buna dönülür) ve şekli. */
  onceTanim: LevelTanimi;
  ters: boolean;
  /** Düzle hedefi: vuruş başladığındaki yükseklik. */
  hedefY: number;
  bolge: Bolge | null;
  nokta: Vec3;
  son: number;
  damga: number;
}

const yazilabilirMi = (h: EventTarget | null): boolean => {
  const e = h as HTMLElement | null;
  if (!e?.matches) return false;
  return e.isContentEditable || e.matches("textarea, select") || (e.matches("input") && !e.matches("input[type=range], input[type=checkbox], input[type=radio], input[type=color], input[type=button]"));
};

export function zeminKalemiKur(a: ZeminKalemiAyari): ZeminKalemi {
  let arac: ZeminAraci | null = null;
  let ayar: KalemAyari = { ...KALEM_VARSAYILAN };
  let firca: FircaImleci | null = null;
  let kurulanLevel: Level | null = null;
  let vurus: Vurus_ | null = null;
  let sonImlec: { x: number; y: number } | null = null;
  let shift = false;
  const dinleyiciler = new Set<() => void>();
  const yay = () => { for (const f of [...dinleyiciler]) f(); };

  const noktaOf = (e: { clientX: number; clientY: number }) => { const r = a.tuval.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  /** Yüzey ve halka level'a bağlıdır: level değiştiyse yeniden kur. */
  function hazirla(l: Level): FircaImleci {
    if (firca && kurulanLevel === l) return firca;
    firca?.yokEt();
    firca = fircaImleciKur(a.sahne, yuzeyKur(a.sahne, a.kamera, l));
    kurulanLevel = l;
    return firca;
  }

  const kalemAyari = (): AraziAyari => ({ ...ARAZI_VARSAYILAN, hedef: "yukseklik", islem: arac ?? "yukselt", yaricap: ayar.yaricap, guc: ayar.guc, sertlik: ayar.sertlik, nesneleriOturt: ayar.nesneleriOturt });

  function damga(): void {
    const l = a.level();
    if (!vurus || !l || !arac) return;
    const t = l.tanim();
    const z = zeminAyari(t);
    const taban = z ? zeminTabanYuksekligi(z) : () => 0;
    const n = vurus.nokta;
    l.ayarla(araziDamgasiUygula(t, kalemAyari(), { x: n[0], z: n[2], yaricap: ayar.yaricap, guc: ayar.guc, sertlik: ayar.sertlik }, vurus.ters, taban, { hedef: vurus.hedefY, tohum: 1 + vurus.damga }));
    vurus.bolge = bolgeBirlesim(vurus.bolge, { x0: n[0] - ayar.yaricap, z0: n[2] - ayar.yaricap, x1: n[0] + ayar.yaricap, z1: n[2] + ayar.yaricap });
    vurus.son = performance.now();
    vurus.damga++;
  }

  /** Vuruşu bitir (kayda işle) ya da iptal et (level vuruş başındaki hâline döner). */
  function vurusuBitir(iptal: boolean): void {
    if (!vurus) return;
    const v = vurus; vurus = null;
    firca?.bitir();
    const l = a.level();
    if (!l) return;
    if (iptal) { l.ayarla(v.onceTanim); a.altyazi("vuruş iptal edildi", 1200); return; }
    const once = zeminOku(v.onceTanim);
    if (!once) return;
    a.vurusBitti({ once, bolge: v.bolge, ad: araziIslemAdi(kalemAyari(), v.ters), nesneleriOturt: ayar.nesneleriOturt });
  }

  function halkayiTazele(): void {
    if (!firca || !arac || !sonImlec) return;
    firca.imlec(sonImlec.x, sonImlec.y, ayar.yaricap, vurus ? vurus.ters : shift, true);
  }

  // ── işaretçi / tekerlek / tuş (yakalama aşaması: nesne seçiminden ve menüden önce) ──
  const asagi = (e: PointerEvent) => {
    if (!arac || e.button !== 0) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const l = a.level();
    if (!l || !firca) return;
    if (araziKatmani(l.tanim(), "yukseklik") < 0) { a.altyazi("bu level'da açık bir zemin katmanı yok", 2500); return; }
    sonImlec = noktaOf(e);
    const n = firca.imlec(sonImlec.x, sonImlec.y, ayar.yaricap, e.shiftKey, true);
    if (!n) { a.altyazi("imleç zeminin üstünde değil", 1500); return; }
    vurus = { onceTanim: l.tanim(), ters: e.shiftKey, hedefY: l.yukseklik(n[0], n[2]), bolge: null, nokta: n, son: 0, damga: 0 };
    firca.basla();
    damga();
    a.tuval.setPointerCapture?.(e.pointerId);
  };
  const hareket = (e: PointerEvent) => {
    sonImlec = noktaOf(e);
    shift = e.shiftKey;
    if (!arac || !firca) return;
    const n = firca.imlec(sonImlec.x, sonImlec.y, ayar.yaricap, vurus ? vurus.ters : shift, true);
    if (vurus && n) vurus.nokta = n;
  };
  const yukari = (e: PointerEvent) => { if (vurus && e.button === 0) vurusuBitir(false); };
  const tiklama = (e: MouseEvent) => { if (arac) { e.stopImmediatePropagation(); e.preventDefault(); } };
  const sagTik = (e: MouseEvent) => {
    if (!arac) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (!vurus) kalem.sec(null);
  };
  const tekerlek = (e: WheelEvent) => {
    if (!arac || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    ayar = kalemAyariniDuzelt(ayar, { yaricap: yaricapAdimi(ayar.yaricap, e.deltaY < 0 ? 1 : -1) });
    halkayiTazele(); yay();
    a.altyazi(`fırça yarıçapı ${ayar.yaricap} m`, 900);
  };
  const tusBas = (e: KeyboardEvent) => {
    if (e.key === "Shift") { shift = true; halkayiTazele(); return; }
    if (!arac) return;
    if (e.key === "Escape") {
      e.stopImmediatePropagation(); e.preventDefault();
      if (vurus) vurusuBitir(true); else kalem.sec(null);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !yazilabilirMi(e.target)) {
      if (e.code === "KeyZ" && !e.shiftKey) { e.stopImmediatePropagation(); e.preventDefault(); a.geriAl(); }
      else if (e.code === "KeyY" || (e.code === "KeyZ" && e.shiftKey)) { e.stopImmediatePropagation(); e.preventDefault(); a.ileriAl(); }
    }
  };
  const tusBirak = (e: KeyboardEvent) => { if (e.key === "Shift") { shift = false; halkayiTazele(); } };
  const odakKaybi = () => { if (vurus) vurusuBitir(false); };

  a.tuval.addEventListener("pointerdown", asagi, { capture: true });
  a.tuval.addEventListener("pointermove", hareket);
  addEventListener("pointerup", yukari);
  a.tuval.addEventListener("click", tiklama, { capture: true });
  a.tuval.addEventListener("contextmenu", sagTik, { capture: true });
  a.tuval.addEventListener("wheel", tekerlek, { capture: true, passive: false });
  addEventListener("keydown", tusBas, { capture: true });
  addEventListener("keyup", tusBirak);
  addEventListener("blur", odakKaybi);
  const kareGozcu = a.sahne.onBeforeRenderObservable.add(() => {
    if (vurus && performance.now() - vurus.son > DAMGA_ARALIGI_MS) damga();
  });

  const kalem: ZeminKalemi = {
    sec(yeni) {
      if (yeni === null) {
        if (vurus) vurusuBitir(true);
        const vardi = arac !== null;
        arac = null;
        firca?.goster(false);
        if (vardi) { a.altyazi("zemin kalemi bırakıldı", 1200); yay(); }
        return;
      }
      const l = a.level();
      if (!l) { a.altyazi("dünya henüz hazır değil", 2000); return; }
      if (araziKatmani(l.tanim(), "yukseklik") < 0) { a.altyazi("bu level'da açık bir zemin katmanı yok", 2500); return; }
      a.baslarken();
      const f = hazirla(l);
      arac = yeni;
      f.goster(true);
      halkayiTazele();
      a.altyazi(`${aracBilgisi(yeni).ad}: basılı tut ve sürükle · Shift ters · Ctrl+tekerlek boyut · Ctrl+Z geri al · sağ tık / Esc bırak`, 6000);
      yay();
    },
    arac: () => arac,
    ayar: () => ayar,
    ayarla(p) { ayar = kalemAyariniDuzelt(ayar, p); halkayiTazele(); yay(); },
    vuruyor: () => vurus !== null,
    dinle(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
    yokEt() {
      if (vurus) vurusuBitir(true);
      arac = null;
      a.sahne.onBeforeRenderObservable.remove(kareGozcu);
      a.tuval.removeEventListener("pointerdown", asagi, { capture: true });
      a.tuval.removeEventListener("pointermove", hareket);
      removeEventListener("pointerup", yukari);
      a.tuval.removeEventListener("click", tiklama, { capture: true });
      a.tuval.removeEventListener("contextmenu", sagTik, { capture: true });
      a.tuval.removeEventListener("wheel", tekerlek, { capture: true });
      removeEventListener("keydown", tusBas, { capture: true });
      removeEventListener("keyup", tusBirak);
      removeEventListener("blur", odakKaybi);
      firca?.yokEt(); firca = null;
    },
  };
  return kalem;
}
