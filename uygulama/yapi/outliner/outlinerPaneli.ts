// uygulama/yapi/outliner/outlinerPaneli.ts — LEVEL OUTLINER PANELİ (spec 39 D6; Unreal World Outliner). DOM katmanı; mantık `outlinerModeli.ts`te (testli).
//
// Sahnedeki anlamlı nesneleri türe göre gruplayıp listeler (kaynak `Yer.nesneler`: oda + level + yerleştirilen varlıklar), aratır. Satıra tıklamak nesneyi SEÇER: seçim sahnedeki
// seçimle AYNI durumdur (`secimDurumu`, spec 28) — sahnede kutu vurgusu çıkar, HUD adı gösterir; sahnede bir nesne seçilince panelde de işaretlenir. "İçerikte göster", nesnenin
// ait olduğu level dosyasını İçerik gezgininde seçer. Panel dok sistemine kayıtlıdır (sol/sağ/alt/yüzer), ilk açılışta kapalıdır. Liste yer değiştikçe tazelenir (görünürken 1 sn'de bir
// imzaya bakar; değişmediyse DOM'a dokunmaz).
"use strict";
import { YAPI_RENK as R, YAPI_YAZI } from "../../../world/arayuz/arayuzJetonlari.ts";
import { el } from "../ortak/dom.ts";
import type { DokYoneticisi } from "../ortak/dok/dokYoneticisi.ts";
import { gruplariKur, imza, satirSayisi, type OutlinerNesnesi } from "./outlinerModeli.ts";

export const OUTLINER_KIMLIGI = "outliner";
const TAZELEME_MS = 1000;

export interface OutlinerAyari {
  dok: DokYoneticisi;
  nesneler: () => readonly OutlinerNesnesi[];
  /** Şu an seçili nesnenin kimliği (sahnedeki seçimle aynı durum). */
  secili: () => string | null;
  /** Nesneyi seç (null = kaldır). Değişiklik oldu mu. */
  sec: (id: string | null) => boolean;
  /** "İçerikte göster": nesnenin level dosyasını İçerik gezgininde seçer. */
  icerikteGoster: () => void | Promise<void>;
  /** Satıra çift tık: kamera nesneye gider (Unreal'daki "F: seçili nesneye odaklan"). Dönüş: gidilen nesnenin adı ya da gidilemediyse null. */
  git?: (id: string) => string | null;
}

export interface OutlinerPaneli {
  readonly kok: HTMLElement;
  /** Listeyi şimdi yeniden oku ve çiz (imza aynıysa yalnız seçimi işaretle). */
  tazele(): void;
  /** Dışarıdan seçim değişti (sahnede tıklandı): işareti güncelle. */
  seciliGuncelle(): void;
  ara(metin: string): void;
  /** Çizilen satırlar (kimlik, ad, grup) — senaryo ölçüsü. */
  satirlar(): { id: string; ad: string; tur: string; secili: boolean }[];
  grupSayisi(): number;
}

const CSS = `
.ot-kok { display: flex; flex-direction: column; height: 100%; min-height: 0; background: #0c111e; color: ${R.yazi}; font: ${YAPI_YAZI.govde}; user-select: none; outline: none; }
.ot-arac { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 5px 8px; border-bottom: 1px solid ${R.cizgi}; flex: none; }
.ot-arac input { flex: 1; min-width: 100px; background: ${R.dugme}; color: ${R.yaziParlak}; border: 1px solid ${R.cizgi}; border-radius: 5px; padding: 2px 8px; font: inherit; user-select: text; }
.ot-arac button { background: ${R.dugme}; color: ${R.yazi}; border: 1px solid ${R.cizgi}; border-radius: 5px; padding: 2px 9px; font: inherit; cursor: pointer; }
.ot-arac button:hover:not(:disabled) { border-color: ${R.vurgu}; color: ${R.yaziParlak}; } .ot-arac button:disabled { opacity: 0.4; cursor: not-allowed; }
.ot-liste { flex: 1; min-height: 0; overflow: auto; padding: 3px 0; }
.ot-grup { display: flex; align-items: center; gap: 4px; padding: 3px 8px; color: ${R.yaziOrta}; cursor: pointer; font-weight: 600; }
.ot-grup:hover { background: rgba(255,255,255,0.04); } .ot-grup .ot-sayi { margin-left: auto; font-weight: 400; color: ${R.yaziSoluk}; }
.ot-satir { display: flex; align-items: baseline; gap: 8px; padding: 1px 8px 1px 26px; cursor: default; white-space: nowrap; }
.ot-satir:hover { background: rgba(255,255,255,0.05); }
.ot-satir[data-secili="1"] { background: rgba(255,214,64,0.16); color: ${R.yaziParlak}; }
.ot-satir .ot-id { color: ${R.yaziSoluk}; font-size: 11px; } .ot-satir .ot-konum { margin-left: auto; color: ${R.yaziSoluk}; font-size: 11px; }
.ot-bos { padding: 18px; color: ${R.yaziSoluk}; text-align: center; }
.ot-durum { padding: 3px 10px; border-top: 1px solid ${R.cizgi}; color: ${R.yaziSoluk}; font-size: 11.5px; flex: none; }
`;
let stilEklendi = false;

export function outlinerPaneliKur(a: OutlinerAyari): OutlinerPaneli {
  if (!stilEklendi) { const s = document.createElement("style"); s.textContent = CSS; document.head.append(s); stilEklendi = true; }
  const kok = el("div", "ot-kok"); kok.tabIndex = 0;
  const araGirdisi = el("input"); araGirdisi.placeholder = "ara (ad, kimlik, tür)"; araGirdisi.spellcheck = false;
  const icerikD = el("button", "", "📁 İçerikte göster"); icerikD.type = "button"; icerikD.title = "Level dosyasını İçerik gezgininde seç";
  const birakD = el("button", "", "✕ Seçimi kaldır"); birakD.type = "button"; birakD.title = "Sahnedeki seçimi kaldır";
  const arac = el("div", "ot-arac"); arac.append(araGirdisi, icerikD, birakD);
  const liste = el("div", "ot-liste"), durum = el("div", "ot-durum");
  kok.append(arac, liste, durum);

  let arama = "", sonImza: string | null = null, sonArama = "";
  const kapaliGruplar = new Set<string>();

  function ciz(): void {
    const nesneler = a.nesneler();
    const gruplar = gruplariKur(nesneler, arama);
    const secili = a.secili();
    liste.replaceChildren();
    if (!gruplar.length) liste.append(el("div", "ot-bos", nesneler.length ? "Eşleşen nesne yok" : "Sahnede nesne yok"));
    for (const g of gruplar) {
      const baslik = el("div", "ot-grup"); baslik.dataset.tur = g.tur;
      baslik.append(el("span", "", kapaliGruplar.has(g.tur) ? "▸" : "▾"), el("span", "", g.ad), el("span", "ot-sayi", String(g.satirlar.length)));
      baslik.addEventListener("click", () => { if (kapaliGruplar.has(g.tur)) kapaliGruplar.delete(g.tur); else kapaliGruplar.add(g.tur); sonImza = null; tazele(); });
      liste.append(baslik);
      if (kapaliGruplar.has(g.tur) && !arama) continue;
      for (const s of g.satirlar) {
        const r = el("div", "ot-satir"); r.dataset.id = s.id; r.dataset.tur = s.tur; r.dataset.secili = s.id === secili ? "1" : "0";
        r.append(el("span", "", s.ad), el("span", "ot-id", s.id), el("span", "ot-konum", s.konum));
        r.title = `${s.ad} (${s.id}) · ${s.konum}`;
        r.addEventListener("click", () => { a.sec(s.id === a.secili() ? null : s.id); seciliGuncelle(); });
        r.addEventListener("dblclick", () => {
          if (a.secili() !== s.id) { a.sec(s.id); seciliGuncelle(); }   // iki tıkın ikincisi seçimi kaldırmış olabilir: çift tık HER ZAMAN seçili bırakır
          a.git?.(s.id);
        });
        liste.append(r);
      }
    }
    durum.textContent = `${satirSayisi(gruplar)} / ${nesneler.length} nesne${secili ? ` · seçili: ${secili}` : ""}`;
    birakD.disabled = secili === null;
  }

  function tazele(): void {
    const yeni = imza(a.nesneler());
    if (yeni === sonImza && arama === sonArama) { seciliGuncelle(); return; }
    sonImza = yeni; sonArama = arama; ciz();
  }
  function seciliGuncelle(): void {
    const secili = a.secili();
    for (const r of liste.querySelectorAll<HTMLElement>(".ot-satir")) r.dataset.secili = r.dataset.id === secili ? "1" : "0";
    const toplam = a.nesneler().length;
    durum.textContent = `${liste.querySelectorAll(".ot-satir").length} satır / ${toplam} nesne${secili ? ` · seçili: ${secili}` : ""}`;
    birakD.disabled = secili === null;
  }

  araGirdisi.addEventListener("input", () => { arama = araGirdisi.value; tazele(); });
  araGirdisi.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") { araGirdisi.value = ""; arama = ""; tazele(); kok.focus(); } });
  icerikD.addEventListener("click", () => { void a.icerikteGoster(); });
  birakD.addEventListener("click", () => { a.sec(null); seciliGuncelle(); });

  a.dok.kaydet({
    kayit: { id: OUTLINER_KIMLIGI, ad: "Outliner", bolgeler: ["sol", "sag", "alt", "yuzer"], varsayilan: "sag", baslangicKapali: true },
    icerik: kok, gorunur: true, ipucu: "Level Outliner: sahnedeki nesneler",
  });
  // Görünürken yavaşça tazele (level yüklenir, varlık yerleştirilir, nesne yerden kalkar); görünmezken hiçbir şey yapma.
  setInterval(() => { if (a.dok.ekrandaMi(OUTLINER_KIMLIGI)) tazele(); }, TAZELEME_MS);
  kok.addEventListener("pointerenter", tazele);   // panele gelince hemen güncel (zamanlayıcıyı bekletme)
  ciz(); sonImza = imza(a.nesneler());

  return {
    kok, tazele, seciliGuncelle,
    ara(m) { arama = m; araGirdisi.value = m; tazele(); },
    satirlar: () => [...liste.querySelectorAll<HTMLElement>(".ot-satir")].map((r) => ({ id: r.dataset.id ?? "", ad: r.firstElementChild?.textContent ?? "", tur: r.dataset.tur ?? "", secili: r.dataset.secili === "1" })),
    grupSayisi: () => liste.querySelectorAll(".ot-grup").length,
  };
}
