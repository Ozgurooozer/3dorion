// world/level/editor/arayuz/durumCubugu.ts — Alt durum çubuğu (spec 22): son mesaj (hata kırmızı), seçim, imlecin
// altındaki dünya noktası, yükleniyor sayısı, fps / çizim çağrısı, kip.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Editor } from "../editor.ts";
import { kisaAd } from "../../cekirdek/katalog.ts";
import { el, cssEkle } from "./ortak.ts";

const D_CSS = `
#ed-alt { position: fixed; left: 0; right: 0; bottom: 0; height: var(--ed-alt); background: var(--ed-zemin); border-top: 1px solid var(--ed-cizgi);
  display: flex; align-items: center; gap: 14px; padding: 0 10px; z-index: 11; font-size: 11px; white-space: nowrap; overflow: hidden; }
#ed-alt .mesaj { flex: 1; overflow: hidden; text-overflow: ellipsis; color: var(--ed-iyi); }
#ed-alt .mesaj.hata { color: var(--ed-hata); }
#ed-alt .soluk { color: var(--ed-soluk); }
`;

export function durumCubuguKur(ed: Editor, sahne: Scene, imlecNoktasi: () => { x: number; y: number } | null): HTMLElement {
  cssEkle("edDurumStil", D_CSS);
  const { durum } = ed;
  const kok = el("div", "ed-kok"); kok.id = "ed-alt";
  const mesaj = el("span", "mesaj", "hazır — F1 kısayol kartı");
  const secim = el("span"), imlec = el("span", "soluk"), yuk = el("span", "soluk"), olcum = el("span", "soluk");
  kok.append(mesaj, secim, imlec, yuk, olcum);
  document.body.append(kok);

  durum.abone("mesaj", () => { const m = durum.sonMesaj(); mesaj.textContent = m.metin; mesaj.classList.toggle("hata", m.hata); mesaj.title = m.metin; });
  const secimYaz = () => {
    const s = durum.secim();
    const son = s.length ? durum.tanim().nesneler?.find((n) => n.id === s[s.length - 1]) : null;
    secim.textContent = s.length ? `seçili ${s.length}${son ? ` · ${son.ad ?? kisaAd(son.varlik)}` : ""}` : "seçim yok";
  };
  durum.abone("secim", secimYaz);
  durum.abone("tanim", secimYaz);
  secimYaz();

  // Ağır işler (ışın, fps) saniyede 5 kez.
  let kare = 0, son = performance.now();
  sahne.onAfterRenderObservable.add(() => { kare++; });
  setInterval(() => {
    const p = imlecNoktasi();
    const h = p ? ed.yuzey.ekrandan(p.x, p.y) : null;
    imlec.textContent = h ? `imleç ${h.nokta.map((v) => v.toFixed(2)).join(", ")}${h.id ? ` (${h.id})` : ""}` : "";
    const b = ed.level.nesneler.bekleyen();
    yuk.textContent = b ? `yükleniyor ${b}` : "";
    const simdi = performance.now();
    const fps = (kare * 1000) / (simdi - son);
    kare = 0; son = simdi;
    olcum.textContent = `${fps.toFixed(0)} fps · ${sahne.getActiveMeshes().length} mesh · ${durum.kip() === "editor" ? "editör" : "uçuş"}`;
  }, 200);
  return kok;
}
