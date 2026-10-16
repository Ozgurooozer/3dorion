// world/arayuz/nesnePaneli.ts — NESNE PANELİ (sağ tık, spec 28): seçili nesnenin özellikleri ve YAPILABİLECEKLER (Orion yapsın / ben yapayım).
//
// Panel imlecin yanında açılır (ekran sınırına sığdırılır). Saf kısım `panelModeli` (testli): hangi satır, hangi düğme, hangisi gri ve nedeni. DOM kısmı ince.
// Yüzeyler alt-sistemi: Sahne'deki tiplere BAĞLANMAZ (bedenPaneli deseni); nesne ve eylemler yapısal tiplerle dışarıdan verilir, düğme `kimlik` ile döner.
// Kapanış: Esc (yakalama aşamasında: oyuncunun Esc yığını paneli kapatırken imleç kipini de kapatmasın), panel dışına basış, "Kapat" ya da bir düğmeye basış.
"use strict";

export interface PanelNesne {
  id: string;
  ad: string;
  tur: string;
  capa: string | null;
  kutu: { x: number; y: number; z: number; g: number; yuk: number; d: number };
  /** Orion'a not (level nesnesi anlamından). */
  not?: string;
}

export interface PanelEylem {
  kimlik: string;
  ad: string;
  kim: "orion" | "ozyn";
  uygun: boolean;
  neden?: string;
}

export interface PanelDugmesi { kimlik: string; ad: string; uygun: boolean; neden: string | null }
export interface PanelGrubu { baslik: string; dugmeler: PanelDugmesi[] }
export interface PanelModeli {
  baslik: string;
  altbaslik: string;
  ozellikler: [string, string][];
  gruplar: PanelGrubu[];
}

const m = (v: number): string => v.toFixed(2).replace(/\.?0+$/, "");

/** Panelin ne göstereceği (SAF): başlık, özellik satırları ve "Orion yapsın" / "Ben yapayım" grupları (boş grup yok). */
export function panelModeli(n: PanelNesne, eylemler: readonly PanelEylem[]): PanelModeli {
  const ozellikler: [string, string][] = [
    ["Kimlik", n.id],
    ["Tür", n.tur],
    ["Çapa", n.capa ?? "—"],
    ["Konum", `${m(n.kutu.x)}, ${m(n.kutu.z)} (yükseklik ${m(n.kutu.y)})`],
    ["Boyut", `${m(n.kutu.g)} × ${m(n.kutu.d)} × ${m(n.kutu.yuk)} m`],
  ];
  if (n.not) ozellikler.push(["Orion'a not", n.not]);
  const grup = (baslik: string, kim: PanelEylem["kim"]): PanelGrubu => ({
    baslik,
    dugmeler: eylemler.filter((e) => e.kim === kim).map((e) => ({ kimlik: e.kimlik, ad: e.ad, uygun: e.uygun, neden: e.neden ?? null })),
  });
  return {
    baslik: n.ad,
    altbaslik: `${n.tur}${n.capa ? ` · çapa: ${n.capa}` : ""}`,
    ozellikler,
    gruplar: [grup("Orion yapsın", "orion"), grup("Ben yapayım", "ozyn")].filter((g) => g.dugmeler.length > 0),
  };
}

/** Panelin ekran sınırına sığan sol-üst köşesi (SAF): imleç konumuna konur, taşarsa içeri çekilir. */
export function panelKonumu(x: number, y: number, panelEn: number, panelBoy: number, ekranEn: number, ekranBoy: number, pay = 8): { sol: number; ust: number } {
  const sol = Math.max(pay, Math.min(x, ekranEn - panelEn - pay));
  const ust = Math.max(pay, Math.min(y, ekranBoy - panelBoy - pay));
  return { sol, ust };
}

export interface NesnePaneliAyari {
  /** Düğmeye basıldı (kimlik); panel kapanmış olur. */
  calistir: (kimlik: string) => void;
  /** "Seçimi kaldır" düğmesi. */
  secimiKaldir?: () => void;
  ata?: HTMLElement;
}

export interface NesnePaneli {
  ac(n: PanelNesne, eylemler: readonly PanelEylem[], x: number, y: number): void;
  kapat(): void;
  acikMi(): boolean;
}

const CSS = `
#nesnePaneli { position: fixed; width: 300px; max-width: calc(100vw - 16px); z-index: 57; display: none; flex-direction: column; gap: 6px;
  background: rgba(10,14,24,0.97); color: #d7dcea; border: 1px solid #2a3246; border-radius: 10px; padding: 10px 12px; font: 13px/1.45 'Segoe UI', system-ui, sans-serif; }
#nesnePaneli[data-acik="1"] { display: flex; }
#nesnePaneli .np-baslik { display: flex; align-items: center; gap: 8px; }
#nesnePaneli .np-baslik b { color: #ffd93a; font-size: 14px; font-weight: 600; flex: 1; }
#nesnePaneli .np-alt { color: #7c88a6; font-size: 12px; margin-top: -4px; }
#nesnePaneli button { background: #121726; color: #d7dcea; border: 1px solid #2a3246; border-radius: 6px; padding: 3px 9px; font: inherit; cursor: pointer; }
#nesnePaneli button:hover:not(:disabled) { border-color: #58c1ff; }
#nesnePaneli button:disabled { opacity: 0.45; cursor: not-allowed; }
#nesnePaneli .np-bolum { color: #7c88a6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 4px; }
#nesnePaneli .np-ozellik { display: flex; gap: 8px; font-size: 12px; }
#nesnePaneli .np-ozellik span:first-child { flex: 0 0 78px; color: #7c88a6; }
#nesnePaneli .np-dugmeler { display: flex; flex-wrap: wrap; gap: 6px; }
#nesnePaneli .np-neden { flex-basis: 100%; color: #8a93ad; font-size: 11px; margin: -2px 0 2px; }
`;

export function nesnePaneliKur(a: NesnePaneliAyari): NesnePaneli {
  const stil = document.createElement("style");
  stil.textContent = CSS;
  document.head.append(stil);

  const kok = document.createElement("div");
  kok.id = "nesnePaneli";
  kok.dataset.acik = "0";
  (a.ata ?? document.body).append(kok);

  const olustur = <K extends keyof HTMLElementTagNameMap>(ad: K, sinif: string, metin = ""): HTMLElementTagNameMap[K] => {
    const e = document.createElement(ad); e.className = sinif; if (metin) e.textContent = metin; return e;
  };

  let acik = false;
  function kapat(): void {
    if (!acik) return;
    acik = false;
    kok.dataset.acik = "0";
    kok.replaceChildren();
  }

  function ac(n: PanelNesne, eylemler: readonly PanelEylem[], x: number, y: number): void {
    const mod = panelModeli(n, eylemler);
    kok.replaceChildren();

    const baslik = olustur("div", "np-baslik");
    const kapatDugme = olustur("button", "", "Kapat");
    kapatDugme.addEventListener("click", kapat);
    baslik.append(olustur("b", "", mod.baslik), kapatDugme);
    kok.append(baslik, olustur("div", "np-alt", mod.altbaslik));

    kok.append(olustur("div", "np-bolum", "Özellikler"));
    for (const [k, d] of mod.ozellikler) {
      const s = olustur("div", "np-ozellik");
      s.append(olustur("span", "", k), olustur("span", "", d));
      kok.append(s);
    }

    for (const g of mod.gruplar) {
      kok.append(olustur("div", "np-bolum", g.baslik));
      const kutu = olustur("div", "np-dugmeler");
      for (const d of g.dugmeler) {
        const b = olustur("button", "", d.ad);
        b.disabled = !d.uygun;
        if (d.neden) b.title = d.neden;
        b.addEventListener("click", () => { kapat(); a.calistir(d.kimlik); });
        kutu.append(b);
        if (d.neden) kutu.append(olustur("div", "np-neden", `${d.ad}: ${d.neden}`));
      }
      kok.append(kutu);
    }

    if (a.secimiKaldir) {
      const kaldir = olustur("button", "", "Seçimi kaldır");
      kaldir.addEventListener("click", () => { kapat(); a.secimiKaldir?.(); });
      kok.append(kaldir);
    }

    acik = true;
    kok.dataset.acik = "1";
    const p = panelKonumu(x, y, kok.offsetWidth || 300, kok.offsetHeight || 200, innerWidth, innerHeight);
    kok.style.left = `${p.sol}px`;
    kok.style.top = `${p.ust}px`;
  }

  // Esc YAKALAMA aşamasında: oyuncunun Esc yığınına ulaşmasın (yoksa panel kapanırken imleç kipi de kapanırdı).
  addEventListener("keydown", (e) => {
    if (!acik || e.key !== "Escape") return;
    e.stopImmediatePropagation();
    e.preventDefault();
    kapat();
  }, true);
  // Panelin dışına basış kapatır (sağ tıkın kendisi panel DIŞINDA da yeni bir panel açar: önce kapanır, sonra açılır).
  addEventListener("mousedown", (e) => {
    if (acik && !kok.contains(e.target as Node | null)) kapat();
  }, true);

  return { ac, kapat, acikMi: () => acik };
}
