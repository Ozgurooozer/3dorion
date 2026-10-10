// world/level/editor/arayuz/orionIcin.ts — Özellikler panelinde "Orion için" bölümü (spec 23 B).
//
// Seçili nesnenin Orion için anlamı: ne olduğu (tür), onunla ne yapılabileceği (eylemler — protokolün sözlüğü),
// algılanıp algılanmadığı ve kısa bir not. Değer sözlükten geliyorsa soluk gösterilir; değiştirmek yerleşime yazar
// (`NesneYeri.anlam`), "Sözlüğe dön" siler. Çoklu seçimde gösterilen etkin (son) nesnenin değeri, yazılan HEPSİNE.
// Ad bu bölümde değil: üstteki "Ad" alanı Orion'un kullandığı ad.
"use strict";
import type { Editor } from "../editor.ts";
import type { NesneYeri } from "../../cekirdek/levelTanimi.ts";
import { NESNE_EYLEMLERI, type NesneEylemi } from "../../../../protocol/temel.ts";
import { NESNE_TURLERI, type NesneTuru } from "../../cekirdek/anlam.ts";
import * as K from "../cekirdek/komutlar.ts";
import type { AnlamBilgisi } from "./anlamBilgisi.ts";
import { el, cssEkle } from "./ortak.ts";

export const TUR_ADI: Readonly<Record<NesneTuru, string>> = {
  yapi: "yapı", mobilya: "mobilya", esya: "eşya", aydinlatma: "aydınlatma", yuzey: "ekran/yüzey", tabela: "tabela",
  yol: "yol", bitki: "bitki", altyapi: "altyapı", arac: "araç", detay: "ayrıntı",
};
export const EYLEM_ADI: Readonly<Record<NesneEylemi, string>> = {
  bak: "bakılır", git: "yanına gidilir", otur: "oturulur", al: "alınır", odaklan: "odaklanılır", yaz: "yazılır", kullan: "kullanılır",
};

const O_CSS = `
.ed-orion .ozet { color: #cfe0ff; margin-bottom: 4px; }
.ed-orion .ozet.gormez { color: #b49ac4; }
.ed-orion .eylemler { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 8px; }
.ed-orion label { display: flex; gap: 4px; align-items: center; white-space: nowrap; }
.ed-orion .sozluk { color: var(--ed-soluk); font-style: italic; }
.ed-orion select, .ed-orion input[type=text] { width: 100%; }
`;

export function orionBolumu(ed: Editor, ab: AnlamBilgisi): (sec: NesneYeri[]) => HTMLElement | null {
  cssEkle("edOrionStil", O_CSS);
  const { durum } = ed;
  const yaz = (sec: NesneYeri[], f: Parameters<typeof K.anlamYaz>[2], mesaj: string) =>
    durum.degistir((t) => K.anlamYaz(t, sec.map((n) => n.id!), f).tanim, `Orion için: ${mesaj}${sec.length > 1 ? ` (${sec.length} nesne)` : ""}`);
  return (sec) => {
    const n = sec.at(-1);
    if (!n) return null;
    const e = ab.etkin(n);
    const b = el("div", "ed-bolum ed-orion");
    b.append(el("h4", "", "🤖 Orion için"));
    b.append(el("div", `ozet${e.algilanir ? "" : " gormez"}`, e.algilanir
      ? `“${e.ad}” — ${TUR_ADI[e.tur]}; ${e.eylemler.map((x) => EYLEM_ADI[x]).join(", ") || "eylem yok"}`
      : `Orion bunu görmez (${e.kaynak.algilanir === "yerlesim" ? "elle" : "sözlükte görsel kalabalık"})`));

    const satir = (etiket: string, icerik: HTMLElement) => { const s = el("div", "ed-satir"); s.append(el("label", "", etiket), icerik); return s; };
    const tur = el("select");
    const sozlukTuru = ab.etkin({ ...n, anlam: { ...n.anlam, tur: undefined } }).tur;   // elle tür yokken ne olurdu
    tur.add(new Option(`sözlükten (${TUR_ADI[sozlukTuru]})`, ""));
    for (const t of NESNE_TURLERI) tur.add(new Option(TUR_ADI[t], t));
    tur.value = n.anlam?.tur ?? "";
    tur.onchange = () => { const v = tur.value as NesneTuru | ""; yaz(sec, (a) => ({ ...a, tur: v || undefined }), `tür ${v ? TUR_ADI[v] : "sözlükten"}`); };
    b.append(satir("Tür", tur));

    const eyl = el("div", "eylemler");
    const sozluktenEylem = e.kaynak.eylemler !== "yerlesim";
    for (const x of NESNE_EYLEMLERI) {
      const l = el("label", sozluktenEylem ? "sozluk" : "");
      const c = el("input"); c.type = "checkbox"; c.checked = e.eylemler.includes(x);
      c.onchange = () => {
        const yeni = NESNE_EYLEMLERI.filter((y) => (y === x ? c.checked : e.eylemler.includes(y)));
        yaz(sec, (a) => ({ ...a, eylemler: [...yeni] }), `${EYLEM_ADI[x]} ${c.checked ? "açık" : "kapalı"}`);
      };
      l.title = sozluktenEylem ? "sözlükten geliyor — değiştirirsen bu nesneye yazılır" : "bu nesneye elle yazılmış";
      l.append(c, document.createTextNode(EYLEM_ADI[x]));
      eyl.append(l);
    }
    b.append(satir("Eylemler", eyl));

    const gor = el("label"); const gc = el("input"); gc.type = "checkbox"; gc.checked = e.algilanir;
    gc.onchange = () => yaz(sec, (a) => ({ ...a, algilanir: gc.checked }), gc.checked ? "algılanır" : "algılanmaz");
    gor.append(gc, document.createTextNode(" Orion görsün"));
    if (e.kaynak.algilanir !== "yerlesim") gor.classList.add("sozluk");
    b.append(satir("", gor));

    const not = el("input"); not.type = "text"; not.value = n.anlam?.not ?? ""; not.placeholder = e.not || "Orion'a kısa not (ör. kapısı kilitli)";
    not.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === "Enter") not.blur(); };
    not.onchange = () => yaz(sec, (a) => ({ ...a, not: not.value.trim() || undefined }), "not");
    b.append(satir("Not", not));

    if (sec.some((x) => x.anlam)) {
      const geri = el("button", "", "Sözlüğe dön");
      geri.title = "Bu nesnedeki elle anlamı sil (ad ayrı: üstteki Ad alanı)";
      geri.onclick = () => yaz(sec, () => undefined, "sözlüğe dönüldü");
      b.append(geri);
    }
    return b;
  };
}
