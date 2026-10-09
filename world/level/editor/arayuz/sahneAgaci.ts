// world/level/editor/arayuz/sahneAgaci.ts — Sahne ağacı (outliner, spec 22): gruplar (iç içe) + nesneler + katmanlar.
//
// Satıra tık seçer (Shift ekle, Ctrl çıkar/ekle), grup satırı içindekilerin hepsini seçer. Göz = gizle, kilit =
// sahnede seçilemez. Çift tık adı düzenler (Enter kaydeder), ◎ odaklar. Satırı bir grubun üstüne sürükle-bırak
// gruba taşır (seçiliyse bütün seçimi), "kök" alanına bırakmak gruptan çıkarır. Katmanlar (çim, su…) en altta:
// göz katmanı kapatır/açar (dünya panelindeki anahtarla aynı alan).
"use strict";
import type { Editor } from "../editor.ts";
import type { GrupTanimi, LevelTanimi, NesneYeri } from "../../cekirdek/levelTanimi.ts";
import { kisaAd } from "../../cekirdek/katalog.ts";
import { etkinBayrak } from "../../cekirdek/grup.ts";
import { yeniId } from "../../cekirdek/kimlik.ts";
import * as K from "../cekirdek/komutlar.ts";
import { secimUygula, secilebilir, type SecimKipi } from "../cekirdek/secim.ts";
import { el, cssEkle, okuDizi, yaz } from "./ortak.ts";

const KAPALI_ANAHTARI = "orion.editor.agacKapali";

const AGAC_CSS = `
.ed-agac { flex: 1; overflow: auto; padding: 2px 0 8px; user-select: none; }
.ed-agac .s { display: flex; align-items: center; gap: 3px; padding: 1px 6px; cursor: default; white-space: nowrap; min-height: 21px; }
.ed-agac .s:hover { background: #18213a; }
.ed-agac .s.secili { background: #2b4a8f; }
.ed-agac .s.yarim { background: #1d2e55; }
.ed-agac .s.ustune { outline: 1px dashed var(--ed-vurgu2); }
.ed-agac .s .ac { width: 12px; color: var(--ed-soluk); cursor: pointer; text-align: center; }
.ed-agac .s .ad { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.ed-agac .s .ad input { width: 100%; }
.ed-agac .s .sayi { color: var(--ed-soluk); font-size: 11px; }
.ed-agac .s .ik { width: 18px; text-align: center; cursor: pointer; opacity: .35; font-size: 11px; }
.ed-agac .s .ik.acik { opacity: 1; }
.ed-agac .s .ik:hover { opacity: 1; }
.ed-agac .s .gor { visibility: hidden; }
.ed-agac .s:hover .gor { visibility: visible; }
.ed-agac .s.soluk .ad { color: #66779a; }
.ed-agac .grupS .ad { font-weight: 600; color: #c8d6f0; }
.ed-agac .baslikS { color: var(--ed-soluk); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; padding: 6px 8px 2px; }
.ed-agac .kok-birak { min-height: 18px; margin: 4px 6px; border: 1px dashed transparent; border-radius: 4px; color: var(--ed-soluk); font-size: 11px; text-align: center; }
.ed-agac .kok-birak.ustune { border-color: var(--ed-vurgu2); }
.ed-agac-ust { display: flex; gap: 4px; padding: 4px 6px; border-bottom: 1px solid var(--ed-cizgi); }
.ed-agac-ust input { flex: 1; min-width: 0; }
`;

export interface SahneAgaci { kok: HTMLElement; yenile(): void }

export function sahneAgaciKur(ed: Editor, katmanSec: (ad: string) => void): SahneAgaci {
  cssEkle("edAgacStil", AGAC_CSS);
  const { durum } = ed;
  const kok = el("div"); kok.style.cssText = "display:flex;flex-direction:column;min-height:0;flex:1";
  const ust = el("div", "ed-agac-ust");
  const ara = el("input"); ara.type = "search"; ara.placeholder = "Ara (ad, varlık, kimlik)…";
  const yeniGrup = el("button", "", "+ Grup"); yeniGrup.title = "Seçimi yeni gruba al (Ctrl+G); seçim yoksa boş grup";
  ust.append(ara, yeniGrup);
  const agac = el("div", "ed-agac");
  kok.append(ust, agac);

  const kapali = new Set(okuDizi<string>(KAPALI_ANAHTARI));
  let arama = "";
  let suruklenen: { tur: "nesne" | "grup"; id: string } | null = null;
  let adlandirilan: string | null = null;

  ara.oninput = () => { arama = ara.value.trim().toLocaleLowerCase("tr"); ciz(); };
  yeniGrup.onclick = () => {
    const s = durum.secim();
    if (s.length) ed.eylem("grupla");
    else durum.degistir((t) => ({ ...t, gruplar: [...(t.gruplar ?? []), { id: yeniId((t.gruplar ?? []).map((g) => g.id), "g"), ad: `grup ${(t.gruplar?.length ?? 0) + 1}` }] }), "boş grup");
    yeniGrup.blur();
  };

  const mod = (e: MouseEvent): SecimKipi => (e.shiftKey ? "ekle" : e.ctrlKey || e.metaKey ? "tersle" : "yeni");
  const nesneAdi = (n: NesneYeri) => n.ad ?? kisaAd(n.varlik);
  const eslesir = (n: NesneYeri) => !arama || `${nesneAdi(n)} ${n.varlik} ${n.id}`.toLocaleLowerCase("tr").includes(arama);

  const ikon = (yazi: string, acik: boolean, baslik: string, is: () => void, gorunurHep = false) => {
    const i = el("span", `ik${acik ? " acik" : ""}${!acik && !gorunurHep ? " gor" : ""}`, yazi);
    i.title = baslik;
    i.onclick = (e) => { e.stopPropagation(); is(); };
    return i;
  };
  const adAlani = (metin: string, kimlik: string, kaydet: (ad: string) => void) => {
    const s = el("span", "ad");
    if (adlandirilan === kimlik) {
      const i = el("input"); i.type = "text"; i.value = metin;
      const bitir = (yazilsin: boolean) => { if (adlandirilan !== kimlik) return; adlandirilan = null; if (yazilsin && i.value.trim() !== metin) kaydet(i.value); else ciz(); };
      i.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") bitir(true); if (e.key === "Escape") bitir(false); };
      i.onblur = () => bitir(true);
      s.append(i);
      setTimeout(() => { i.focus(); i.select(); });
    } else s.textContent = metin;
    return s;
  };
  const birakmaHedefi = (s: HTMLElement, birak: () => void) => {
    s.ondragover = (e) => { if (!suruklenen) return; e.preventDefault(); s.classList.add("ustune"); };
    s.ondragleave = () => s.classList.remove("ustune");
    s.ondrop = (e) => { e.preventDefault(); s.classList.remove("ustune"); if (suruklenen) birak(); suruklenen = null; };
  };
  const nesneleriTasi = (hedef?: string) => {
    if (!suruklenen) return;
    if (suruklenen.tur === "grup") {
      const g = suruklenen.id;
      durum.degistir((t) => K.grubuTasi(t, g, hedef), hedef ? "grup taşındı" : "grup köke taşındı");
      return;
    }
    const ids = durum.secim().includes(suruklenen.id) ? durum.secim() : [suruklenen.id];
    durum.degistir((t) => K.grubaTasi(t, ids, hedef).tanim, hedef ? `${ids.length} nesne gruba taşındı` : `${ids.length} nesne gruptan çıkarıldı`);
  };

  const nesneSatiri = (t: LevelTanimi, n: NesneYeri, derinlik: number): HTMLElement => {
    const id = n.id!;
    const g = t.gruplar ?? [];
    const gizli = etkinBayrak(n, g, "gizli"), kilitli = etkinBayrak(n, g, "kilitli");
    const s = el("div", `s${durum.secim().includes(id) ? " secili" : ""}${gizli || kilitli ? " soluk" : ""}`);
    s.style.paddingLeft = `${6 + derinlik * 14}px`;
    s.title = `${id} · ${n.varlik}\n${n.konum.map((v) => v.toFixed(2)).join(", ")}`;
    s.dataset["id"] = id;
    s.append(el("span", "ac", "·"),
      adAlani(nesneAdi(n), id, (ad) => durum.degistir((x) => K.adlandir(x, id, ad).tanim, `ad: ${ad}`)),
      ikon("◎", false, "Odakla (F)", () => { durum.secimAyarla([id]); ed.eylem("odakla"); }),
      ikon(n.gizli ? "◌" : "👁", !!n.gizli, n.gizli ? "Göster" : "Gizle (H)", () => durum.degistir((x) => K.bayrakAyarla(x, [id], "gizli", !n.gizli).tanim, n.gizli ? "gösterildi" : "gizlendi")),
      ikon(n.kilitli ? "🔒" : "🔓", !!n.kilitli, n.kilitli ? "Kilidi aç" : "Kilitle (L)", () => durum.degistir((x) => K.bayrakAyarla(x, [id], "kilitli", !n.kilitli).tanim, n.kilitli ? "kilit açıldı" : "kilitlendi")));
    s.onclick = (e) => {
      if (!secilebilir(durum.tanim(), id)) { durum.bildir(kilitli ? "kilitli — önce kilidi aç" : "gizli — önce göster"); return; }
      durum.secimAyarla(secimUygula(durum.secim(), id, mod(e)));
    };
    s.ondblclick = () => { adlandirilan = id; ciz(); };
    s.draggable = true;
    s.ondragstart = (e) => { suruklenen = { tur: "nesne", id }; e.dataTransfer?.setData("text/plain", id); };
    return s;
  };

  const grupSatirlari = (t: LevelTanimi, g: GrupTanimi, derinlik: number, cikti: HTMLElement[]) => {
    const icerik = K.grubunNesneleri(t, g.id);
    const gorunen = (t.nesneler ?? []).filter((n) => n.grup === g.id && eslesir(n));
    const altlar = (t.gruplar ?? []).filter((x) => x.ust === g.id);
    if (arama && !icerik.some((id) => eslesir(t.nesneler!.find((n) => n.id === id)!)) && !g.ad.toLocaleLowerCase("tr").includes(arama)) return;
    const secilen = icerik.filter((id) => durum.secim().includes(id)).length;
    const acik = !kapali.has(g.id) || !!arama;
    const s = el("div", `s grupS${secilen && secilen === icerik.length ? " secili" : secilen ? " yarim" : ""}${g.gizli || g.kilitli ? " soluk" : ""}`);
    s.style.paddingLeft = `${6 + derinlik * 14}px`;
    const ac = el("span", "ac", acik ? "▾" : "▸");
    ac.onclick = (e) => { e.stopPropagation(); if (kapali.has(g.id)) kapali.delete(g.id); else kapali.add(g.id); yaz(KAPALI_ANAHTARI, [...kapali]); ciz(); };
    s.append(ac, adAlani(`📁 ${g.ad}`, g.id, (ad) => durum.degistir((x) => K.grubuAdlandir(x, g.id, ad.replace(/^📁\s*/, "")), `grup adı: ${ad}`)),
      el("span", "sayi", String(icerik.length)),
      ikon("✕", false, "Grubu sil (içindekiler üst gruba çıkar; Shift: içindekilerle sil)", () => {
        durum.degistir((x) => K.grupSil(x, g.id, kaydirmaBasili), kaydirmaBasili ? `grup içindekilerle silindi: ${g.ad}` : `grup çözüldü: ${g.ad}`);
      }),
      ikon(g.gizli ? "◌" : "👁", !!g.gizli, g.gizli ? "Grubu göster" : "Grubu gizle", () => durum.degistir((x) => K.grupBayrakAyarla(x, g.id, "gizli", !g.gizli), g.gizli ? "grup gösterildi" : "grup gizlendi")),
      ikon(g.kilitli ? "🔒" : "🔓", !!g.kilitli, g.kilitli ? "Grubun kilidini aç" : "Grubu kilitle", () => durum.degistir((x) => K.grupBayrakAyarla(x, g.id, "kilitli", !g.kilitli), g.kilitli ? "grup kilidi açıldı" : "grup kilitlendi")));
    s.onclick = (e) => {
      const ids = icerik.filter((id) => secilebilir(durum.tanim(), id));
      if (!ids.length) { durum.bildir(icerik.length ? "grup gizli ya da kilitli" : "grup boş"); return; }
      durum.secimAyarla(secimUygula(durum.secim(), ids, mod(e)));
    };
    s.ondblclick = () => { adlandirilan = g.id; ciz(); };
    s.draggable = true;
    s.ondragstart = (e) => { suruklenen = { tur: "grup", id: g.id }; e.dataTransfer?.setData("text/plain", g.id); };
    birakmaHedefi(s, () => nesneleriTasi(g.id));
    cikti.push(s);
    if (!acik) return;
    for (const a of altlar) grupSatirlari(t, a, derinlik + 1, cikti);
    for (const n of gorunen) cikti.push(nesneSatiri(t, n, derinlik + 1));
  };

  let kaydirmaBasili = false;
  addEventListener("keydown", (e) => { if (e.key === "Shift") kaydirmaBasili = true; });
  addEventListener("keyup", (e) => { if (e.key === "Shift") kaydirmaBasili = false; });

  const ciz = () => {
    const t = durum.tanim();
    const kaydir = agac.scrollTop;
    const satirlar: HTMLElement[] = [];
    const nesneler = t.nesneler ?? [];
    satirlar.push(el("div", "baslikS", `Nesneler · ${nesneler.length}${durum.secim().length ? ` · ${durum.secim().length} seçili` : ""}`));
    for (const g of (t.gruplar ?? []).filter((x) => !x.ust)) grupSatirlari(t, g, 0, satirlar);
    for (const n of nesneler.filter((x) => !x.grup && eslesir(x))) satirlar.push(nesneSatiri(t, n, 0));
    if (!nesneler.length) satirlar.push(el("div", "ed-ipucu", "Henüz nesne yok — alttaki varlık tarayıcısından bir karta tıkla ya da sahneye sürükle."));
    const kokAlani = el("div", "kok-birak", "gruptan çıkarmak için buraya bırak");
    birakmaHedefi(kokAlani, () => nesneleriTasi(undefined));
    satirlar.push(kokAlani);
    satirlar.push(el("div", "baslikS", "Katmanlar"));
    for (const [i, k] of t.katmanlar.entries()) {
      const s = el("div", `s${k.acik ? "" : " soluk"}`);
      s.title = `${k.tur} — tıkla: dünya panelinde aç`;
      s.append(el("span", "ac", "◆"), el("span", "ad", `${k.ad}`), el("span", "sayi", k.tur),
        ikon(k.acik ? "👁" : "◌", !k.acik, k.acik ? "Katmanı kapat" : "Katmanı aç", () => durum.degistir((x) => ({ ...x, katmanlar: x.katmanlar.map((y, j) => (j === i ? { ...y, acik: !y.acik } : y)) }), `katman ${k.ad}: ${k.acik ? "kapalı" : "açık"}`), true));
      s.onclick = () => katmanSec(k.ad);
      satirlar.push(s);
    }
    agac.replaceChildren(...satirlar);
    agac.scrollTop = kaydir;
  };
  const secimeKaydir = () => {
    const son = durum.secim().at(-1);
    if (son) agac.querySelector<HTMLElement>(`[data-id="${CSS.escape(son)}"]`)?.scrollIntoView({ block: "nearest" });
  };
  durum.abone("tanim", ciz);
  durum.abone("secim", () => { ciz(); secimeKaydir(); });
  ciz();
  return { kok, yenile: ciz };
}
