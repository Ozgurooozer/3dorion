// uygulama/yapi/ortak/yanSekmeler.ts — SAĞ PANELİN SEKMELERİ (DOM; spec 38 §6): Ayrıntılar · Rig · Kamera… Her sekmenin içeriği kendi modülünün öğesidir; burası yalnız hangisinin
// görünür olduğunu tutar. Seçilen sekme `localStorage`'da hatırlanır (yalnız kolaylık; depo yoksa her açılışta ilk sekme).
"use strict";
import { el } from "./dom.ts";

export interface YanSekme { id: string; etiket: string; ipucu?: string; icerik: HTMLElement }
export interface YanSekmeler {
  kok: HTMLElement;
  sec(id: string): void;
  etkin(): string;
  /** Sekme adındaki işaret (ör. "●" rig açıkken). */
  rozet(id: string, metin: string): void;
}

export function yanSekmelerKur(anahtar: string, sekmeler: readonly YanSekme[]): YanSekmeler {
  const kok = el("div", "kb-yan");
  const serit = el("div", "kb-yan-seritler");
  const icerik = el("div", "kb-yan-icerik");
  const dugmeler = new Map<string, HTMLButtonElement>();
  const rozetler = new Map<string, string>();
  const oku = (): string => { try { const v = localStorage.getItem(anahtar); return v && sekmeler.some((s) => s.id === v) ? v : sekmeler[0]!.id; } catch { return sekmeler[0]!.id; } };
  let etkin = oku();

  for (const s of sekmeler) {
    const d = el("button", "kb-yan-sekme", s.etiket); d.type = "button"; if (s.ipucu) d.title = s.ipucu;
    d.addEventListener("click", () => sec(s.id));
    dugmeler.set(s.id, d); serit.append(d);
    s.icerik.dataset.sekme = s.id; icerik.append(s.icerik);
  }
  function ciz(): void {
    for (const s of sekmeler) {
      const d = dugmeler.get(s.id)!;
      d.dataset.etkin = s.id === etkin ? "1" : "0";
      d.textContent = `${s.etiket}${rozetler.get(s.id) ? ` ${rozetler.get(s.id)}` : ""}`;
      s.icerik.dataset.etkin = s.id === etkin ? "1" : "0";
    }
  }
  function sec(id: string): void {
    if (!sekmeler.some((s) => s.id === id)) return;
    etkin = id; try { localStorage.setItem(anahtar, id); } catch { /* depo yok: yalnız bu açılış */ }
    ciz();
  }
  kok.append(serit, icerik);
  ciz();
  return { kok, sec, etkin: () => etkin, rozet(id, metin) { rozetler.set(id, metin); ciz(); } };
}
