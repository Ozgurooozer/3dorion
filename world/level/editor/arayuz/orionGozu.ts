// world/level/editor/arayuz/orionGozu.ts — "Orion'un gözü" (spec 23 B, tuş O): sahnede Orion'un bildiği nesneleri
// adıyla ve eylemleriyle etiketler; şu anki kameradan GÖRÜNEN etiket parlak, örtülü olan soluk.
//
// Neden: anlam katmanı görünmez veridir; tasarımcı Orion'un level'ı nasıl "okuyacağını" görmeden ad/eylem
// hatası yakalayamaz. Görünürlük, Orion'un odada kullandığı kodun AYNISI (world/player/gorunurluk.ts) — kamera
// Orion'un gözü sayılır, engel = level nesnelerinin kutuları (arazi engel sayılmaz: bilinen sınır).
// Kayıt saf işlevden: cekirdek/anlam.ts `levelNesneleri` (Orion level'a taşınınca algı da bunu kullanacak, spec 24).
"use strict";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Editor } from "../editor.ts";
import { levelNesneleri, type LevelNesnesi } from "../../cekirdek/anlam.ts";
import { gorunenNesneler } from "../../../player/gorunurluk.ts";
import type { AnlamBilgisi } from "./anlamBilgisi.ts";
import { EYLEM_ADI } from "./orionIcin.ts";
import { el, cssEkle } from "./ortak.ts";

const G_CSS = `
#ed-orion-gozu { position: fixed; inset: 0; pointer-events: none; z-index: 8; display: none; }
#ed-orion-gozu.acik { display: block; }
#ed-orion-gozu .etiket { position: absolute; transform: translate(-50%, -100%); background: rgba(10,16,28,.82); color: #e6efff;
  border: 1px solid #4a6db0; border-radius: 6px; padding: 1px 6px; font: 11px system-ui, sans-serif; white-space: nowrap; }
#ed-orion-gozu .etiket.ortulu { opacity: .35; border-style: dashed; }
#ed-orion-gozu .etiket small { color: #9fb6dc; margin-left: 4px; }
#ed-orion-gozu .ozet { position: fixed; left: 50%; transform: translateX(-50%); top: calc(var(--ed-ust) + 8px); background: rgba(10,16,28,.9); color: #e6efff;
  border: 1px solid #4a6db0; border-radius: 8px; padding: 4px 10px; font: 12px system-ui, sans-serif; }
body.ed-ucus #ed-orion-gozu .ozet { top: 44px; }
`;

export interface OrionGozu { acKapa(): boolean; acikMi(): boolean }

export function orionGozuKur(ed: Editor, ab: AnlamBilgisi): OrionGozu {
  cssEkle("edOrionGozuStil", G_CSS);
  const kok = el("div"); kok.id = "ed-orion-gozu";
  const ozet = el("div", "ozet");
  kok.append(ozet);
  document.body.append(kok);
  const etiketler = new Map<string, HTMLElement>();
  let acik = false, zamanlayici: ReturnType<typeof setInterval> | null = null;

  const ciz = () => {
    const t = ed.durum.tanim(), nesneler = t.nesneler ?? [];
    const kutular = ed.kutular(nesneler.map((n) => n.id!).filter(Boolean));
    // Kayıt saf işlevden; etkin anlam ab'den (sözlük yüklenmemişse varsayılan).
    const kayit: LevelNesnesi[] = levelNesneleri(nesneler, kutular, (n) => ab.etkin(n));
    const kam = ed.sahne.activeCamera!;
    const ileri = kam.getDirection(Vector3.Forward());
    const gorunum = new Map(gorunenNesneler({ x: kam.position.x, y: kam.position.y, z: kam.position.z }, { x: ileri.x, y: 0, z: ileri.z }, 0, kayit,
      kayit.map((n) => ({ kutu: n.kutu, capa: null }))).map((g) => [g.id, g]));
    const tuval = ed.tuval, r = tuval.getBoundingClientRect();
    const vp = kam.viewport.toGlobal(tuval.clientWidth, tuval.clientHeight), m = ed.sahne.getTransformMatrix();
    const kalan = new Set(etiketler.keys());
    let gorunen = 0;
    for (const n of kayit) {
      const p = Vector3.Project(new Vector3(n.kutu.x, n.kutu.y + n.kutu.yuk / 2, n.kutu.z), Matrix.IdentityReadOnly, m, vp);
      const g = gorunum.get(n.id);
      if (p.z <= 0 || p.z >= 1 || !g?.konide) continue;
      kalan.delete(n.id);
      let e = etiketler.get(n.id);
      if (!e) { e = el("div", "etiket"); etiketler.set(n.id, e); kok.append(e); }
      e.replaceChildren(document.createTextNode(n.ad), el("small", "", n.eylemler.map((x) => EYLEM_ADI[x].split(" ")[0]).join(" · ")));
      e.title = `${n.id} · ${n.tur}${n.not ? ` · ${n.not}` : ""}`;
      e.classList.toggle("ortulu", !g.gorunur);
      e.style.left = `${r.left + p.x}px`; e.style.top = `${r.top + p.y}px`;
      if (g.gorunur) gorunen++;
    }
    for (const id of kalan) { etiketler.get(id)?.remove(); etiketler.delete(id); }
    const algilanmaz = nesneler.filter((n) => !n.gizli && !ab.etkin(n).algilanir).length;
    ozet.textContent = `🤖 Orion'un gözü — bilir: ${kayit.length} · bu açıdan görür: ${gorunen} · görmez (kalabalık): ${algilanmaz}`;
  };

  return {
    acikMi: () => acik,
    acKapa() {
      acik = !acik;
      kok.classList.toggle("acik", acik);
      if (acik) { ciz(); zamanlayici = setInterval(ciz, 150); }
      else if (zamanlayici) { clearInterval(zamanlayici); zamanlayici = null; }
      return acik;
    },
  };
}
