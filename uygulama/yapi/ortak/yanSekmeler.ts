// uygulama/yapi/ortak/yanSekmeler.ts — EDİTÖR PANELLERİNİ DOK SİSTEMİNE BAĞLAR (spec 38 §6 → spec 39 D3): Ayrıntılar · Rig · Kamera…
// Eskiden editörün sağ sütununda sabit sekmelerdi (`kb-yan`); artık her biri dok paneli: sürüklenip sol/sağ/alt bölgeye ya da yüzer pencereye bırakılır.
// Editör eski arayüzle (`sec`, `rozet`) konuşmaya devam eder; panel kimlikleri `sekans-<id>` (dokta başka panellerle çakışmasın). Editör GİZLİYKEN paneller
// görünmez (bölge açmaz, tuvali daraltmaz); açıkken bölgeleri nerede bıraktıysan orada belirir.
"use strict";
import type { Bolge } from "./dok/dokDuzeni.ts";
import type { DokYoneticisi } from "./dok/dokYoneticisi.ts";

export interface YanSekme {
  id: string; etiket: string; ipucu?: string; icerik: HTMLElement;
  /** İzinli dok bölgeleri; yoksa dördü de. */
  bolgeler?: readonly Bolge[];
}
export interface YanSekmeler {
  /** Paneli açar (kapalıysa) ve etkin sekme yapar. */
  sec(id: string): void;
  /** Sekme adındaki işaret (ör. "●" rig açıkken). */
  rozet(id: string, metin: string): void;
  /** Editör açıldı/kapandı: panellerin görünürlüğü. */
  gorunur(g: boolean): void;
  /** Odak/öğe panellerden birinin içinde mi (yazılan yarım değer silinmesin diye). */
  iceriyor(n: Node | null): boolean;
}

export const yanPanelKimligi = (id: string): string => `sekans-${id}`;

export function yanSekmeleriDokaBagla(dok: DokYoneticisi, sekmeler: readonly YanSekme[]): YanSekmeler {
  for (const s of sekmeler) {
    dok.kaydet({ kayit: { id: yanPanelKimligi(s.id), ad: s.etiket, bolgeler: s.bolgeler ?? ["sol", "sag", "alt", "yuzer"], varsayilan: "sag" }, icerik: s.icerik, gorunur: false, ipucu: s.ipucu });
  }
  return {
    sec: (id) => dok.sec(yanPanelKimligi(id)),
    rozet: (id, metin) => dok.rozet(yanPanelKimligi(id), metin),
    gorunur(g) { for (const s of sekmeler) dok.gorunur(yanPanelKimligi(s.id), g); },
    iceriyor: (n) => sekmeler.some((s) => !!n && s.icerik.contains(n)),
  };
}
