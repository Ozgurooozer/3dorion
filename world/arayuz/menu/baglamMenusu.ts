// world/arayuz/menu/baglamMenusu.ts — BAĞLAM MENÜSÜ GÖRÜNÜMÜ (spec 29): `menuKur`un ağacını kademeli açılan listelerle çizer. İnce DOM; mantık `menuModeli.ts`/`menuKonum.ts`te (testli).
//
// Davranış (Windows/Unreal): satırın üzerine gelince alt liste kısa gecikmeyle açılır (hızlı geçişte titremesin), tıklayınca hemen; alt liste varsayılan SAĞA, sığmazsa SOLA.
// Klavye: ↑/↓ satır, → alt listeye gir, ← bir üst listeye dön, Enter çalıştır, Esc kapat. Gri satır tıklanmaz ama nedeni ipucu olarak görünür.
// Esc YAKALAMA aşamasında: oyuncunun Esc yığınına ulaşmasın (yoksa menü kapanırken imleç kipi de kapanırdı; `nesnePaneli.ts` ile aynı desen). Menü dışına basış kapatır.
// Yüzeyler alt-sistemi: hiçbir sahne tipine bağlanmaz; ağaç ve yük yapısal tiplerle gelir, tıklanınca yük `calistir`a döner (tek eylem yolu kökte).
"use strict";
import { sonrakiSatir, type MenuDugumu } from "./menuModeli.ts";
import { altKonumu, kokKonumu } from "./menuKonum.ts";

export interface BaglamMenusuAyari<E> {
  /** Bir eylem yaprağına basıldı; menü kapanmış olur. */
  calistir: (eylem: E, kimlik: string) => void;
  ata?: HTMLElement;
}

export interface BaglamMenusu<E> {
  ac(agac: readonly MenuDugumu<E>[], x: number, y: number): void;
  kapat(): void;
  acikMi(): boolean;
}

/** Üzerine gelince alt listenin açılma gecikmesi (ms). */
export const ACILMA_GECIKMESI = 150;

const CSS = `
.bm-liste { position: fixed; z-index: 58; min-width: 170px; max-width: 320px; max-height: calc(100vh - 16px); overflow-y: auto; padding: 4px; background: rgba(10,14,24,0.98); color: #d7dcea;
  border: 1px solid #2a3246; border-radius: 8px; font: 13px/1.4 'Segoe UI', system-ui, sans-serif; user-select: none; }
.bm-satir { display: flex; align-items: center; gap: 14px; padding: 4px 10px; border-radius: 5px; cursor: default; }
.bm-satir[data-aktif="1"]:not([data-gri="1"]) { background: #1c2740; }
.bm-satir[data-gri="1"] { opacity: 0.45; cursor: not-allowed; }
.bm-ad { flex: 1; white-space: nowrap; }
.bm-kisayol { color: #7c88a6; font-size: 11px; }
.bm-ok { color: #7c88a6; font-size: 11px; }
.bm-ayrac { height: 1px; margin: 4px 6px; background: #2a3246; }
`;

export function baglamMenusuKur<E>(a: BaglamMenusuAyari<E>): BaglamMenusu<E> {
  const stil = document.createElement("style");
  stil.textContent = CSS;
  document.head.append(stil);

  interface Seviye { dugumler: readonly MenuDugumu<E>[]; el: HTMLElement; satirlar: (HTMLElement | null)[]; aktif: number | null }
  let seviyeler: Seviye[] = [];
  let zamanlayici: ReturnType<typeof setTimeout> | null = null;

  const bekletmeyiBirak = (): void => { if (zamanlayici !== null) { clearTimeout(zamanlayici); zamanlayici = null; } };

  function kapat(): void {
    bekletmeyiBirak();
    for (const s of seviyeler) s.el.remove();
    seviyeler = [];
  }

  /** `derinlik`ten derindeki listeleri kapat. */
  function kes(derinlik: number): void {
    while (seviyeler.length > derinlik) seviyeler.pop()!.el.remove();
  }

  function aktifYap(s: Seviye, i: number | null): void {
    s.aktif = i;
    s.satirlar.forEach((el, k) => { if (el) el.dataset.aktif = k === i ? "1" : "0"; });
    if (i !== null) s.satirlar[i]?.scrollIntoView?.({ block: "nearest" });   // uzun listede klavyeyle gezerken satır görünür kalsın
  }

  function sec(d: Extract<MenuDugumu<E>, { tur: "eylem" }>): void {
    kapat();
    a.calistir(d.eylem, d.kimlik);
  }

  /** `derinlik` düzeyinde yeni liste çiz; `konum` dışarıdan (kök: imleç, alt: ata satır). */
  function listeCiz(dugumler: readonly MenuDugumu<E>[], derinlik: number, konum: (en: number, boy: number) => { sol: number; ust: number }): Seviye {
    kes(derinlik);
    const el = document.createElement("div");
    el.className = "bm-liste";
    const s: Seviye = { dugumler, el, satirlar: [], aktif: null };
    dugumler.forEach((d, i) => {
      if (d.tur === "ayrac") { const r = document.createElement("div"); r.className = "bm-ayrac"; el.append(r); s.satirlar.push(null); return; }
      const satir = document.createElement("div");
      satir.className = "bm-satir";
      satir.dataset.gri = d.uygun ? "0" : "1";
      if (d.neden) satir.title = d.neden;
      const ad = document.createElement("span"); ad.className = "bm-ad"; ad.textContent = d.ad;
      satir.append(ad);
      if (d.tur === "eylem" && d.kisayol) { const k = document.createElement("span"); k.className = "bm-kisayol"; k.textContent = d.kisayol; satir.append(k); }
      if (d.tur === "alt") { const o = document.createElement("span"); o.className = "bm-ok"; o.textContent = "▸"; satir.append(o); }
      satir.addEventListener("mouseenter", () => {
        bekletmeyiBirak();
        aktifYap(s, i);
        if (d.tur === "alt" && d.uygun) zamanlayici = setTimeout(() => altAc(derinlik, i), ACILMA_GECIKMESI);
        else zamanlayici = setTimeout(() => kes(derinlik + 1), ACILMA_GECIKMESI);
      });
      satir.addEventListener("click", () => {
        if (!d.uygun) return;
        if (d.tur === "alt") { bekletmeyiBirak(); altAc(derinlik, i); } else if (d.tur === "eylem") sec(d);
      });
      el.append(satir);
      s.satirlar.push(satir);
    });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    (a.ata ?? document.body).append(el);
    const p = konum(el.offsetWidth || 180, el.offsetHeight || 100);
    el.style.left = `${p.sol}px`;
    el.style.top = `${p.ust}px`;
    seviyeler.push(s);
    return s;
  }

  /** `derinlik` listesinin `i`. satırının alt listesini aç. */
  function altAc(derinlik: number, i: number): Seviye | null {
    const ata = seviyeler[derinlik];
    const d = ata?.dugumler[i];
    const satir = ata?.satirlar[i];
    if (!ata || !satir || d?.tur !== "alt") return null;
    const r = ata.el.getBoundingClientRect();
    const sr = satir.getBoundingClientRect();
    return listeCiz(d.ogeler, derinlik + 1, (en, boy) =>
      altKonumu({ sol: r.left, ust: r.top, en: r.width, boy: r.height }, sr.top - 4, en, boy, innerWidth, innerHeight));
  }

  function ac(agac: readonly MenuDugumu<E>[], x: number, y: number): void {
    kapat();
    if (agac.length === 0) return;
    listeCiz(agac, 0, (en, boy) => kokKonumu(x, y, en, boy, innerWidth, innerHeight));
  }

  // ── klavye (YAKALAMA aşamasında) ──
  addEventListener("keydown", (e) => {
    if (seviyeler.length === 0) return;
    const tus = e.key;
    const s = seviyeler[seviyeler.length - 1]!;
    const durdur = (): void => { e.stopImmediatePropagation(); e.preventDefault(); };
    if (tus === "Escape") { durdur(); kapat(); return; }
    if (tus === "ArrowDown" || tus === "ArrowUp") {
      durdur(); bekletmeyiBirak();
      const i = sonrakiSatir(s.dugumler, s.aktif, tus === "ArrowDown" ? 1 : -1);
      aktifYap(s, i);
      return;
    }
    if (tus === "ArrowRight") {
      durdur(); bekletmeyiBirak();
      if (s.aktif === null) return;
      const d = s.dugumler[s.aktif];
      if (d?.tur !== "alt" || !d.uygun) return;
      const yeni = altAc(seviyeler.length - 1, s.aktif);
      if (yeni) aktifYap(yeni, sonrakiSatir(yeni.dugumler, null, 1));
      return;
    }
    if (tus === "ArrowLeft") {
      durdur(); bekletmeyiBirak();
      if (seviyeler.length > 1) kes(seviyeler.length - 1);
      return;
    }
    if (tus === "Enter") {
      durdur();
      if (s.aktif === null) return;
      const d = s.dugumler[s.aktif];
      if (!d || d.tur === "ayrac" || !d.uygun) return;
      if (d.tur === "alt") { const yeni = altAc(seviyeler.length - 1, s.aktif); if (yeni) aktifYap(yeni, sonrakiSatir(yeni.dugumler, null, 1)); } else sec(d);
    }
  }, true);

  // Menü dışına basış kapatır (sağ tıkın kendisi dışarıda yeni menü açar: önce kapanır, sonra açılır).
  addEventListener("mousedown", (e) => {
    if (seviyeler.length === 0) return;
    const hedef = e.target as Node | null;
    if (!seviyeler.some((s) => s.el.contains(hedef))) kapat();
  }, true);

  return { ac, kapat, acikMi: () => seviyeler.length > 0 };
}
