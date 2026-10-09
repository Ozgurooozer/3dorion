// world/level/editor/arayuz/ortak.ts — Editör arayüzünün ortak parçaları: `el()`, CSS belirteçleri, yuva (dock),
// sekme, sayı kutusu (etiketinden sürüklenerek değişir), localStorage sarmalayıcıları (spec 22).
//
// Bütün editör CSS'i burada tek <style> olarak (ayrı dosya yok: Electron/vite yolu farkı olmasın); her parça kendi
// sınıf önekini kullanır (ed-…). Renk belirteçleri :root değişkenleri — tek yerden ton.
"use strict";

export const el = <K extends keyof HTMLElementTagNameMap>(etiketAdi: K, sinif = "", metin = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(etiketAdi);
  if (sinif) e.className = sinif;
  if (metin) e.textContent = metin;
  return e;
};

export function oku<T>(anahtar: string, varsayilan: T): T {
  try { const h = localStorage.getItem(anahtar); return h === null ? varsayilan : { ...varsayilan as object, ...JSON.parse(h) } as T; } catch { return varsayilan; }
}
export function okuDizi<T>(anahtar: string): T[] {
  try { const h = localStorage.getItem(anahtar); const v = h ? JSON.parse(h) as unknown : []; return Array.isArray(v) ? v as T[] : []; } catch { return []; }
}
export function yaz(anahtar: string, deger: unknown): void {
  try { localStorage.setItem(anahtar, JSON.stringify(deger)); } catch { /* özel pencere: önemsiz */ }
}

const CSS = `
:root { --ed-zemin: rgba(14,19,30,.94); --ed-zemin2: #0b101a; --ed-cizgi: #222c41; --ed-yazi: #dde5f2; --ed-soluk: #7f93b7;
  --ed-vurgu: #3b6fd8; --ed-vurgu2: #5b8cff; --ed-uyari: #f2b544; --ed-hata: #ff9a8a; --ed-iyi: #8fd18f; --ed-secim: #ff9e26;
  --ed-dugme: #24304a; --ed-dugme2: #31426a; --ed-ust: 40px; --ed-alt: 22px; }
.ed-kok { font: 12px/1.35 system-ui, sans-serif; color: var(--ed-yazi); }
.ed-kok button { background: var(--ed-dugme); color: var(--ed-yazi); border: 1px solid transparent; border-radius: 5px; padding: 3px 8px;
  cursor: pointer; font: inherit; white-space: nowrap; }
.ed-kok button:hover { background: var(--ed-dugme2); }
.ed-kok button.secili { background: var(--ed-vurgu); border-color: #8fb4ff; color: #fff; }
.ed-kok button:disabled { opacity: .4; cursor: default; }
.ed-kok button.ana { background: #2f5fd0; }
.ed-kok button.ana.kirli { background: #e09b1a; color: #111; }
.ed-kok input[type=text], .ed-kok input[type=number], .ed-kok input[type=search], .ed-kok select {
  background: var(--ed-zemin2); color: var(--ed-yazi); border: 1px solid #2a3654; border-radius: 4px; padding: 2px 5px; font: inherit; box-sizing: border-box; }
.ed-kok input[type=checkbox] { accent-color: var(--ed-vurgu2); }
.ed-kok kbd { background: #1b2336; border: 1px solid #34405a; border-bottom-width: 2px; border-radius: 4px; padding: 0 4px; font: 11px ui-monospace, monospace; color: #c9d6ee; }
.ed-yuva { position: fixed; background: var(--ed-zemin); display: flex; flex-direction: column; z-index: 10; overflow: hidden; }
.ed-yuva.kapali > .ed-yuva-govde { display: none; }
.ed-yuva-bas { display: flex; align-items: center; gap: 4px; padding: 4px 6px; border-bottom: 1px solid var(--ed-cizgi); min-height: 22px; }
.ed-yuva-bas .bosluk { flex: 1; }
.ed-yuva-govde { flex: 1; overflow: auto; min-height: 0; display: flex; flex-direction: column; }
.ed-sekme { background: none !important; border: 0 !important; color: var(--ed-soluk) !important; padding: 3px 6px !important; border-radius: 0 !important;
  border-bottom: 2px solid transparent !important; font-weight: 600; }
.ed-sekme.secili { color: var(--ed-yazi) !important; border-bottom-color: var(--ed-vurgu2) !important; }
.ed-tutamak { position: absolute; background: transparent; z-index: 2; }
.ed-tutamak:hover, .ed-tutamak.surukle { background: rgba(91,140,255,.35); }
.ed-ipucu { color: var(--ed-soluk); font-size: 11px; padding: 4px 8px; }
.ed-bolum { padding: 6px 8px; border-bottom: 1px solid #1d2638; }
.ed-bolum > h4 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--ed-soluk); font-weight: 600; }
.ed-satir { display: grid; grid-template-columns: 64px 1fr; gap: 6px; align-items: center; margin: 3px 0; }
.ed-satir > label { color: #c3cee2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ed-uclu { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.ed-sayi { display: grid; grid-template-columns: 12px 1fr; align-items: center; background: var(--ed-zemin2); border: 1px solid #2a3654; border-radius: 4px; }
.ed-sayi > b { cursor: ew-resize; text-align: center; font-size: 10px; user-select: none; }
.ed-sayi > b.x { color: #ff7a7a; } .ed-sayi > b.y { color: #8be08b; } .ed-sayi > b.z { color: #7aa8ff; } .ed-sayi > b.n { color: var(--ed-soluk); }
.ed-sayi > input { border: 0 !important; background: transparent !important; width: 100%; min-width: 0; padding: 2px 3px !important; }
.ed-sayi.karisik > input::placeholder { color: var(--ed-soluk); }
body.ed-ucus .ed-yuva, body.ed-ucus #ed-ust, body.ed-ucus #ed-alt { display: none !important; }
#ed-ucus-ipucu { position: fixed; left: 50%; top: 10px; transform: translateX(-50%); background: rgba(14,19,30,.8); color: var(--ed-yazi);
  padding: 4px 12px; border-radius: 12px; font: 12px system-ui, sans-serif; z-index: 20; display: none; pointer-events: none; }
body.ed-ucus #ed-ucus-ipucu { display: block; }
#ed-kutu { position: fixed; border: 1px solid var(--ed-secim); background: rgba(255,158,38,.12); pointer-events: none; z-index: 9; display: none; }
`;

let cssKuruldu = false;
export function cssKur(): void {
  if (cssKuruldu || document.getElementById("edStil")) return;
  cssKuruldu = true;
  const s = el("style"); s.id = "edStil"; s.textContent = CSS; document.head.append(s);
}

/** Ek CSS (parça kendi kurallarını ekler, bir kez). */
export function cssEkle(kimlik: string, metin: string): void {
  if (document.getElementById(kimlik)) return;
  const s = el("style"); s.id = kimlik; s.textContent = metin; document.head.append(s);
}

/**
 * Sayı kutusu: kutuya yazılır ya da ETİKETİ yatay sürüklenerek değiştirilir (Blender/Unreal gibi; Shift ince,
 * Ctrl kaba). `karisik`: çoklu seçimde değerler farklı — kutu boş, yer tutucu "—".
 * Sürüklerken `canli` (geçmişsiz önizleme), bırakınca/yazınca `bitti`.
 */
export function sayiKutusu(o: {
  etiket: string; sinif?: string; deger: number | null; adim: number; basamak?: number;
  canli(v: number): void; bitti(v: number, surukleme: boolean): void; baslarken?(): void;
}): HTMLElement {
  const kap = el("div", `ed-sayi${o.deger === null ? " karisik" : ""}`);
  const b = el("b", o.sinif ?? "n", o.etiket);
  const i = el("input"); i.type = "number"; i.step = String(o.adim);
  const yazDeger = (v: number) => { i.value = String(Number(v.toFixed(o.basamak ?? 3))); };
  if (o.deger === null) i.placeholder = "—"; else yazDeger(o.deger);
  i.onchange = () => { const v = Number(i.value); if (Number.isFinite(v) && i.value !== "") o.bitti(v, false); };
  i.onkeydown = (e) => { if (e.key === "Enter") i.blur(); if (e.key === "Escape") { i.blur(); } e.stopPropagation(); };
  let surukle: { x: number; bas: number; v: number } | null = null;
  b.onpointerdown = (e) => {
    surukle = { x: e.clientX, bas: Number(i.value) || 0, v: Number(i.value) || 0 };
    b.setPointerCapture(e.pointerId);
    o.baslarken?.();
    e.preventDefault();
  };
  b.onpointermove = (e) => {
    if (!surukle) return;
    const k = e.shiftKey ? 0.1 : e.ctrlKey ? 10 : 1;
    surukle.v = surukle.bas + (e.clientX - surukle.x) * o.adim * k;
    yazDeger(surukle.v);
    o.canli(surukle.v);
  };
  b.onpointerup = () => {
    if (!surukle) return;
    const s = surukle; surukle = null;
    if (s.v !== s.bas) o.bitti(s.v, true);
  };
  kap.append(b, i);
  return kap;
}

/** Yuva kenarından boyutlandırma tutamağı (boyut localStorage'a). */
export function boyutTutamagi(yuva: HTMLElement, kenar: "sag" | "sol" | "ust", anahtar: string, varsayilan: number, min: number, max: number, uygula: (v: number) => void): void {
  const t = el("div", "ed-tutamak");
  Object.assign(t.style, kenar === "ust" ? { left: "0", right: "0", top: "-2px", height: "6px", cursor: "ns-resize" }
    : { top: "0", bottom: "0", [kenar === "sag" ? "right" : "left"]: "-2px", width: "6px", cursor: "ew-resize" });
  let deger = oku<{ v: number }>(anahtar, { v: varsayilan }).v;
  uygula(deger);
  let bas: { p: number; v: number } | null = null;
  t.onpointerdown = (e) => { bas = { p: kenar === "ust" ? e.clientY : e.clientX, v: deger }; t.setPointerCapture(e.pointerId); t.classList.add("surukle"); e.preventDefault(); };
  t.onpointermove = (e) => {
    if (!bas) return;
    const d = (kenar === "ust" ? e.clientY : e.clientX) - bas.p;
    deger = Math.max(min, Math.min(max, bas.v + (kenar === "sag" ? d : -d)));
    uygula(deger);
  };
  t.onpointerup = () => { bas = null; t.classList.remove("surukle"); yaz(anahtar, { v: deger }); };
  yuva.append(t);
}
