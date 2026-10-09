// world/level/editor/arayuz/gorunum.ts — Hızlı görünüm (Dünya sekmesinin başı, spec 22): stil önayarları, renk
// düzeni, ışık sonrası çipleri, özel shader çipleri, zaman (saat kaydırıcısı, akış, dünya paleti).
// Eskiden ova-deneme'nin sağ üst çubuğuydu; artık her tıklama `durum.degistir`den geçer (geri alınır, kirli yapar).
"use strict";
import type { Editor } from "../editor.ts";
import type { LevelTanimi } from "../../cekirdek/levelTanimi.ts";
import type { SonStili } from "../../stil/stilTanimi.ts";
import { ONAYARLAR, ONAYAR_ADLARI, onayarUygula, onayarAdi, PALET_DUZENI_ADLARI, paletDuzeniUygula, paletDuzeniAdi } from "../../stil/stilTanimi.ts";
import type { ShaderKaydi } from "../../shader/shaderSistemi.ts";
import { DUNYA_ADLARI } from "../../shader/paletler.ts";
import { ZAMAN_VARSAYILAN } from "../../shader/dunyaDurumu.ts";
import { el, cssEkle } from "./ortak.ts";

const G_CSS = `
.ed-gor { padding: 6px 8px; border-bottom: 1px solid #1d2638; }
.ed-gor .grup { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; margin-bottom: 4px; }
.ed-gor .grup > span { width: 50px; color: var(--ed-soluk); font-size: 11px; }
.ed-gor .grup button { padding: 2px 6px; font-size: 11px; }
.ed-gor .aciklama { color: var(--ed-soluk); font-size: 11px; }
.ed-gor b { min-width: 38px; display: inline-block; color: #ffe2a8; }
.ed-gor input[type=range] { flex: 1; min-width: 80px; }
`;

const ISIK_CIPLERI: [Exclude<keyof SonStili, "tonlama">, string][] = [["gi", "GI"], ["ao", "AO"], ["huzme", "huzme"], ["parilti", "parıltı"], ["bloom", "bloom"],
  ["egri", "eğri"], ["vinyet", "vinyet"], ["gren", "gren"], ["sapma", "sapma"], ["keskinlik", "keskinlik"], ["derinlik", "derinlik"]];

export function gorunumKur(ed: Editor, shaderlar: ShaderKaydi): HTMLElement {
  cssEkle("edGorStil", G_CSS);
  const { durum } = ed;
  const kok = el("div", "ed-gor");
  const dugmeler = new Map<string, HTMLButtonElement>();
  const degistir = (f: (t: LevelTanimi) => void, mesaj: string) => durum.degistir((t) => { const x = structuredClone(t); f(x); return x; }, mesaj);

  const grup = (baslik: string) => { const g = el("div", "grup"); g.append(el("span", "", baslik)); kok.append(g); return g; };
  const dugme = (g: HTMLElement, anahtar: string, yazi: string, baslik: string, is: () => void) => {
    const d = el("button", "", yazi); d.title = baslik;
    d.onclick = () => { is(); d.blur(); };
    dugmeler.set(anahtar, d); g.append(d);
  };
  const stilG = grup("stil");
  for (const ad of ONAYAR_ADLARI) dugme(stilG, `stil:${ad}`, ad, `${ONAYARLAR[ad]?.aciklama ?? ad} (P: sıradaki)`, () => durum.degistir((t) => onayarUygula(t, ad), `stil: ${ad}`));
  const renkG = grup("renk");
  for (const ad of PALET_DUZENI_ADLARI) dugme(renkG, `renk:${ad}`, ad, `renk düzeni: ${ad} (Shift+P: sıradaki)`, () => durum.degistir((t) => paletDuzeniUygula(t, ad), `renk düzeni: ${ad}`));
  const isikG = grup("ışık (B)");
  for (const [k, ad] of ISIK_CIPLERI) {
    dugme(isikG, `isik:${k}`, ad, `ışık sonrası: ${ad} aç/kapa — B basılıyken hepsi kapalı (önce/sonra)`, () => degistir((t) => {
      const g = t.stil?.son?.[k]; if (g) g.acik = !g.acik;
    }, `${ad} aç/kapa`));
  }
  const shaderG = grup("shader");
  for (const [tur, m] of shaderlar) {
    dugme(shaderG, `shader:${tur}`, tur, m.aciklama, () => degistir((t) => {
      const l = t.shaderlar ?? (t.shaderlar = []);
      const s = l.find((x) => x.tur === tur);
      if (s) s.acik = !s.acik; else l.push({ tur, acik: true, ayar: {} });
    }, `shader ${tur}`));
  }
  const zamanG = grup("zaman");
  const saat = el("b");
  const kaydirici = el("input"); kaydirici.type = "range"; kaydirici.min = "0"; kaydirici.max = "24"; kaydirici.step = "0.25";
  let surukleOnce: ReturnType<typeof durum.hal> | null = null;
  kaydirici.onpointerdown = () => { surukleOnce = durum.hal(); };
  const saatYaz = (t: LevelTanimi, v: number): LevelTanimi => ({ ...t, zaman: { ...(t.zaman ?? ZAMAN_VARSAYILAN), saat: v } });
  kaydirici.oninput = () => { durum.onizle(saatYaz(durum.tanim(), Number(kaydirici.value))); };
  kaydirici.onchange = () => {
    const once = surukleOnce; surukleOnce = null;
    durum.degistir((t) => saatYaz(t, Number(kaydirici.value)), `saat ${kaydirici.value}`, once ? { onceki: once } : {});
    kaydirici.blur();
  };
  const akis = el("button", "", "zaman aksın"); akis.title = "Saat kendiliğinden ilerlesin";
  akis.onclick = () => { degistir((t) => { const z = t.zaman ?? { ...ZAMAN_VARSAYILAN }; t.zaman = { ...z, akiyor: !z.akiyor, saat: ed.level.dunya.saat }; }, "zaman akışı"); akis.blur(); };
  dugmeler.set("zaman:akis", akis);
  const dunyaSec = el("select");
  DUNYA_ADLARI.forEach((ad, i) => dunyaSec.add(new Option(ad, String(i))));
  dunyaSec.onchange = () => { degistir((t) => { t.zaman = { ...(t.zaman ?? ZAMAN_VARSAYILAN), dunya: Number(dunyaSec.value), saat: ed.level.dunya.saat }; }, `dünya ${dunyaSec.selectedOptions[0]?.text}`); dunyaSec.blur(); };
  zamanG.append(saat, kaydirici, akis, dunyaSec);
  const aciklama = el("div", "aciklama");
  kok.append(aciklama);

  const ciz = () => {
    const t = durum.tanim();
    const s = onayarAdi(t), r = paletDuzeniAdi(t), son = t.stil?.son;
    for (const [k, d] of dugmeler) {
      const [tur, ad] = k.split(":") as [string, string];
      const acik = tur === "stil" ? ad === s : tur === "renk" ? ad === r
        : tur === "isik" ? !!son?.[ad as Exclude<keyof SonStili, "tonlama">]?.acik
        : tur === "shader" ? !!t.shaderlar?.some((x) => x.tur === ad && x.acik)
        : !!t.zaman?.akiyor;
      d.classList.toggle("secili", acik);
    }
    if (!surukleOnce) kaydirici.value = String(t.zaman?.saat ?? 13);
    dunyaSec.value = String(t.zaman?.dunya ?? 0);
    aciklama.textContent = ONAYARLAR[s]?.aciklama ?? "Stil elle değiştirildi (aşağıdaki Stil bölümünden).";
  };
  durum.abone("tanim", ciz);
  setInterval(() => {
    const st = ed.level.dunya.saat;
    saat.textContent = `${String(Math.floor(st)).padStart(2, "0")}:${String(Math.floor((st % 1) * 60)).padStart(2, "0")}`;
  }, 250);
  ciz();
  return kok;
}
