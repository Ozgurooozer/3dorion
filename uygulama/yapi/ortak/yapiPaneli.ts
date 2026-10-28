// uygulama/yapi/ortak/yapiPaneli.ts — YAPI PANELLERİ (spec 41): Asset, Zemin, Hafıza, Zihin, Graf ve Sekans artık DOK PANELLERİDİR.
//
// Eski "Yapı çubuğu" (ekranın altına yapışık sabit şerit, `world/arayuz/altCubuk.ts`) kaldırıldı: her sekme dok sisteminde bir panel. Sol, sağ, alt ya da
// yüzer bölgeye sürüklenir, düzen hatırlanır, Pencere menüsünden geri açılır. Bu dosya yalnız ÇEVİRİDİR: `Sekme` sözleşmesini (içerik ilk gösterimde kurulur,
// ipucu, rozet, kapat) dok araçlarına eşler. Sekmenin İÇERİĞİ kendi modülünde kalır (assetSekmesi, grafSekmesi, sekans/sekansSekmesi…).
//   • Görünürlük iki kapılı: imleç kipi açıkken (fare serbest değilken tıklanamaz, oyun alanı daralmaz) VE Y ile gizlenmemişken.
//   • Y: gizle / göster (düzen değişmez). 1–9: görünür sekmeleri `sira` sırasıyla seçer; yazı yazılırken tuşlar harftir.
"use strict";
import type { DokYoneticisi } from "./dok/dokYoneticisi.ts";
import { el } from "./dom.ts";

/** Sekmenin sahibine verilen araçlar: şeridin sağındaki ipucu, sekme köşesindeki rozet, paneli gizleme. */
export interface SekmeAraci {
  ipucu(metin: string): void;
  rozet(metin: string | null): void;
  kapat(): void;
}
/** Sekme ekranda göründüğünde / gizlendiğinde. */
export interface SekmeIcerigi {
  goster?(): void;
  gizle?(): void;
}
/** Bir yapı sekmesi: kimlik, şerit görünümü, sıra (1–9 kısayolu) ve içeriğini ilk gösterimde kuran fabrika. */
export interface Sekme {
  readonly id: string;
  readonly ad: string;
  readonly simge: string;
  readonly sira: number;
  readonly ipucu?: string;
  kur(sayfa: HTMLElement, arac: SekmeAraci): SekmeIcerigi;
}

export interface YapiPaneli {
  ekle(s: Sekme): void;
  /** Paneli açar: gizliyse gösterir, `id` verilmezse son açılan ya da ilk görünür sekme. İzin verilmezse ya da açılamazsa false. */
  ac(id?: string): boolean;
  /** Bütün yapı panellerini gizler (düzen kalır). */
  kapat(): void;
  /** Y: görünürse gizler, değilse açar. */
  degistir(): void;
  /** Y ile gizlenmemiş mi (imleç kipinden bağımsız). */
  acikMi(): boolean;
  /** Şu an gerçekten ekranda mı (imleç kipi açık VE gizlenmemiş). */
  gorunurMu(): boolean;
  /** İmleç kipi açıldı/kapandı: panel bölgeleri yalnız kip açıkken görünür. */
  gorunur(acik: boolean): void;
}

export interface YapiPaneliAyari {
  /** Yazı yazılırken (sohbet, onay, terminal) tuşlar harftir: false dönerse kısayollar yok sayılır. */
  tusSerbest?(): boolean;
  /** Açmadan önce sorulur (ör. imleç kipini aç); false dönerse açılmaz. */
  izin?(): boolean;
  /** Gizle/göster kısayolu (KeyboardEvent.code). */
  kisayol?: string;
}

const yazilabilirMi = (h: EventTarget | null): boolean => {
  const e = h as HTMLElement | null;
  if (!e?.matches) return false;
  if (e.isContentEditable || e.matches("textarea, select")) return true;
  return e.matches("input") && !e.matches("input[type=range], input[type=checkbox], input[type=radio], input[type=color], input[type=button]");
};

export function yapiPaneliKur(dok: DokYoneticisi, a: YapiPaneliAyari = {}): YapiPaneli {
  const kisayol = a.kisayol ?? "KeyY";
  let sekmeler: { id: string; sira: number }[] = [];
  let son: string | null = null;

  function ac(id?: string): boolean {
    if (a.izin && !a.izin()) return false;
    dok.tumunuGoster(true);
    const hedef = id ?? (son && dok.ekrandaMi(son) ? son : undefined) ?? sekmeler.find((k) => dok.ekrandaMi(k.id))?.id ?? sekmeler[0]?.id;
    if (!hedef) return false;
    dok.sec(hedef);
    son = hedef;
    return dok.ekrandaMi(hedef);
  }
  const degistir = (): void => {
    if (dok.gorunurMu()) { dok.tumunuGoster(false); return; }
    ac();
  };

  // Klavye: yazı kutusundaki tuşlar oyuna ve kısayollara sızmaz; kısayol ve 1–9 (görünür sekme seçer).
  addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || yazilabilirMi(e.target)) return;
    if (a.tusSerbest && !a.tusSerbest()) return;
    if (e.code === kisayol) { e.preventDefault(); degistir(); return; }
    const m = /^Digit([1-9])$/.exec(e.code);
    if (!m || !dok.gorunurMu()) return;
    const id = sekmeler[Number(m[1]) - 1]?.id;
    if (id) { e.preventDefault(); dok.sec(id); son = id; }
  });

  return {
    ekle(s) {
      const sayfa = el("div", "yp-sayfa");
      let icerik: SekmeIcerigi | null = null;
      const arac: SekmeAraci = {
        ipucu: (m) => dok.bilgi(s.id, m),
        rozet: (m) => dok.rozet(s.id, m ?? ""),
        kapat: () => dok.kapat(s.id),
      };
      dok.kaydet({
        kayit: { id: s.id, ad: s.ad, bolgeler: ["sol", "sag", "alt", "yuzer"], varsayilan: "alt" },
        icerik: sayfa, simge: s.simge, ipucu: s.ipucu,
        // İçerik ilk gösterimde kurulur (sekme hiç açılmadıysa maliyeti yok); sonra yalnız gösterilip gizlenir.
        goster() { if (!icerik) icerik = s.kur(sayfa, arac); icerik.goster?.(); },
        gizle() { icerik?.gizle?.(); },
      });
      sekmeler = [...sekmeler, { id: s.id, sira: s.sira }].sort((x, y) => x.sira - y.sira);
    },
    ac,
    kapat() { dok.tumunuGoster(false); },
    degistir,
    acikMi: () => dok.acikMi(),
    gorunurMu: () => dok.gorunurMu(),
    gorunur(acik) { dok.kipGorunur(acik); },
  };
}
