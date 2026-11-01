// uygulama/yapi/level/detayPaneli.ts — DETAILS ÇİZİCİSİ (spec 43 A2; Unreal Details). DOM katmanı: satırlar `detayModeli.ts`ten (testli), yazma işlemleri çağırandan gelir.
//
// Bir aktörün bileşen şemasındaki her alanı türüne göre çizer (sayı, mantıksal, renk, metin, [x,y,z]); altına "Graf" seçimi ve "Değişkenler" (örnek başına başlangıç değerleri) ekler.
// Hiçbir yazma burada yapılmaz: giriş değişince çağıranın `yaz`ı çağrılır (şema + tanım doğrulaması orada; hata altyazıda, giriş eski değere döner). Yazı alanlarında tuşlar oyuna sızmaz (panel kökü yakalar).
"use strict";
import type { AktorDegiskeni, LevelTanimi } from "../../../world/level/cekirdek/levelTanimi.ts";
import type { AlanDegeri } from "../../../world/level/cekirdek/bilesen.ts";
import { degiskenSayisiDoluMu } from "../../../world/level/cekirdek/bilesen.ts";
import { YAPI_RENK as R } from "../../../world/arayuz/arayuzJetonlari.ts";
import { dugmeYap, el } from "../ortak/dom.ts";
import { DEGISKEN_ILK_DEGERI, DEGISKEN_TIPLERI, DEGISKEN_TIP_ADI, degiskenDegeriCoz, detaySatirlari, type DegiskenTipi, type DetaySatiri } from "./detayModeli.ts";

export const DETAY_CSS = `
.il-detay .il-bolum { grid-column: 1 / -1; color: ${R.yaziSoluk}; font-size: 11.5px; border-top: 1px solid ${R.cizgi}; padding-top: 5px; margin-top: 3px; }
.il-detay .il-tam { grid-column: 1 / -1; display: flex; gap: 6px; align-items: center; } .il-detay .il-tam > * { min-width: 0; }
.il-detay select { background: ${R.dugme}; color: ${R.yaziParlak}; border: 1px solid ${R.cizgi}; border-radius: 5px; padding: 2px 4px; font: inherit; width: 100%; box-sizing: border-box; }
.il-detay .il-uyari { color: ${R.uyari}; font-size: 11.5px; grid-column: 1 / -1; }
.il-detay input[type=checkbox] { width: 16px; height: 16px; justify-self: start; }
.il-detay .il-degisken-ad { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

const dugme = dugmeYap("");
const hexMi = (r: string): boolean => /^#[0-9a-fA-F]{6}$/.test(r);

export interface DetayGirdisi {
  /** `.il-detay` ızgarası: içi bu çağrıda doldurulur (önceki içerik çağıranca silinmiş olmalı). */
  hedef: HTMLElement;
  tanim: () => LevelTanimi;
  id: string;
  grafAdlari: () => readonly string[];
  /** Görünen ad satırı (şemada değil: tek yerde, nesne ve ışık aynı). */
  ad?: { deger: string; yaz: (v: string) => void };
  alanYaz: (ad: string, deger: AlanDegeri) => void;
  grafAta: (graf: string | null) => void;
  degiskenYaz: (ad: string, deger: AktorDegiskeni | undefined) => void;
  /** Giriş geçersiz/yazma reddedildi: kısa neden (altyazı). */
  bildir: (metin: string) => void;
  /** Graf satırının yanına eklenecek düğmeler (▶ ■; A3). */
  grafEylemleri?: (graf: string | null) => HTMLElement[];
}

export function detayCiz(g: DetayGirdisi): void {
  const t = g.tanim();
  const r = detaySatirlari(t, g.id, g.grafAdlari());
  if (!r.ok) { g.hedef.append(el("div", "il-bos", r.neden)); return; }
  if (g.ad) {
    const adG = el("input"); adG.type = "text"; adG.value = g.ad.deger;
    const yaz = g.ad.yaz; adG.addEventListener("change", () => yaz(adG.value));
    g.hedef.append(el("label", "", "Ad"), adG);
  }
  for (const s of r.deger.satirlar) {
    if (s.tur === "alan") alanSatiri(g, s);
    else if (s.tur === "graf") grafSatiri(g, s);
  }
  degiskenBolumu(g, t, r.deger.satirlar.filter((s): s is Extract<DetaySatiri, { tur: "degisken" }> => s.tur === "degisken"));
}

function sayiGirdisi(deger: number, s: { adim?: number; en?: number; cok?: number }, degisti: (v: number) => void, tazele: () => void): HTMLInputElement {
  const g = el("input"); g.type = "number"; g.step = String(s.adim ?? 0.1); g.value = String(Math.round(deger * 1000) / 1000);
  if (s.en !== undefined) g.min = String(s.en);
  if (s.cok !== undefined) g.max = String(s.cok);
  g.addEventListener("change", () => { const v = Number(g.value); if (g.value.trim() !== "" && Number.isFinite(v)) degisti(v); else tazele(); });
  return g;
}

const alanSatiri = (g: DetayGirdisi, s: Extract<DetaySatiri, { tur: "alan" }>): void => alanSatiriCiz(g.hedef, s, g.alanYaz);

/** Tek alan satırını `hedef`e çizer (etiket + tipine uygun giriş). Aktörün kendi alanları ve bileşen alanları (`bilesenDetayPaneli.ts`) AYNI çiziciyi kullanır. */
export function alanSatiriCiz(hedef: HTMLElement, s: Extract<DetaySatiri, { tur: "alan" }>, yaz: (ad: string, deger: AlanDegeri) => void): void {
  const etiket = el("label", "", s.birim ? `${s.etiket} (${s.birim})` : s.etiket);
  const tazele = () => yaz(s.ad, s.deger);   // geçersiz giriş: eski değeri yeniden yazıp paneli tazeler (yazma no-op)
  if (s.tip === "sayi") { hedef.append(etiket, sayiGirdisi(s.deger as number, s, (v) => yaz(s.ad, v), tazele)); return; }
  if (s.tip === "bool") {
    const c = el("input"); c.type = "checkbox"; c.checked = s.deger === true;
    c.addEventListener("change", () => yaz(s.ad, c.checked));
    hedef.append(etiket, c); return;
  }
  if (s.tip === "renk") {
    const c = el("input"); c.type = "color"; c.value = typeof s.deger === "string" && hexMi(s.deger) ? s.deger : "#ffd9a0";
    c.addEventListener("change", () => yaz(s.ad, c.value));
    hedef.append(etiket, c); return;
  }
  if (s.tip === "vec3") {
    const v = s.deger as [number, number, number];
    const uc = el("div", "il-uc");
    for (const k of [0, 1, 2] as const) {
      const i = sayiGirdisi(v[k], s, (y) => { const yeni: [number, number, number] = [...v]; yeni[k] = y; yaz(s.ad, yeni); }, tazele);
      i.title = "XYZ"[k]!; uc.append(i);
    }
    hedef.append(etiket, uc); return;
  }
  if (s.secenekler?.length) {
    // Kapalı küme (tetik şekli, "kim girince"): yazım hatası yapılamasın.
    const sec = el("select");
    for (const o of s.secenekler) { const x = el("option", "", o); x.value = o; sec.append(x); }
    sec.value = String(s.deger);
    sec.addEventListener("change", () => yaz(s.ad, sec.value));
    hedef.append(etiket, sec); return;
  }
  const m = el("input"); m.type = "text"; m.value = String(s.deger);
  m.addEventListener("change", () => yaz(s.ad, m.value));
  hedef.append(etiket, m);
}

function grafSatiri(g: DetayGirdisi, s: Extract<DetaySatiri, { tur: "graf" }>): void {
  g.hedef.append(el("div", "il-bolum", "Graf (event graph)"));
  const sec = el("select"); sec.title = "Bu aktörün grafı (Graf sekmesinde yazılır)";
  const yok = el("option", "", "(yok)"); yok.value = ""; sec.append(yok);
  const adlar = s.secili !== null && s.eksik ? [s.secili, ...s.secenekler] : [...s.secenekler];
  for (const a of adlar) { const o = el("option", "", s.eksik && a === s.secili ? `⚠ ${a} (depoda yok)` : a); o.value = a; sec.append(o); }
  sec.value = s.secili ?? "";
  sec.addEventListener("change", () => g.grafAta(sec.value === "" ? null : sec.value));
  const satir = el("div", "il-tam"); satir.append(sec, ...(g.grafEylemleri?.(s.secili) ?? []));
  g.hedef.append(satir);
  if (s.eksik) g.hedef.append(el("div", "il-uyari", `'${s.secili}' grafik deposunda yok: çalıştırılamaz (Graf sekmesinde oluştur ya da başka graf seç)`));
}

function degiskenBolumu(g: DetayGirdisi, t: LevelTanimi, liste: readonly Extract<DetaySatiri, { tur: "degisken" }>[]): void {
  g.hedef.append(el("div", "il-bolum", "Değişkenler (örnek başına başlangıç değeri; graf `aktor.degisken_oku` ile okur)"));
  for (const d of liste) {
    const ad = el("span", "il-degisken-ad", d.ad); ad.title = `${d.ad} · ${DEGISKEN_TIP_ADI[d.tip]}`;
    let girdi: HTMLInputElement;
    if (d.tip === "bool") { girdi = el("input"); girdi.type = "checkbox"; girdi.checked = d.deger === true; girdi.addEventListener("change", () => g.degiskenYaz(d.ad, girdi.checked)); }
    else {
      girdi = el("input"); girdi.type = d.tip === "sayi" ? "number" : "text"; girdi.value = String(d.deger);
      girdi.addEventListener("change", () => {
        const c = degiskenDegeriCoz(d.tip, girdi.value);
        if (c.ok) g.degiskenYaz(d.ad, c.deger); else { g.bildir(`${d.ad}: ${c.neden}`); g.degiskenYaz(d.ad, d.deger); }
      });
    }
    const sil = dugme("✕", "", "Değişkeni sil"); sil.addEventListener("click", () => g.degiskenYaz(d.ad, undefined));
    const satir = el("div", "il-tam"); satir.append(ad, girdi, sil);
    g.hedef.append(satir);
  }
  // Ekleme satırı: ad + tür + "+". Tavan dolunca pasif.
  const adG = el("input"); adG.type = "text"; adG.placeholder = "yeni değişken adı";
  const tipG = el("select");
  for (const tp of DEGISKEN_TIPLERI) { const o = el("option", "", DEGISKEN_TIP_ADI[tp]); o.value = tp; tipG.append(o); }
  const ekle = dugme("+", "", "Değişken ekle (türün sıfır değeriyle)");
  const dolu = degiskenSayisiDoluMu(t, g.id);
  ekle.disabled = dolu; if (dolu) ekle.title = "değişken tavanı doldu";
  const ekleIs = (): void => {
    const ad = adG.value.trim();
    if (liste.some((x) => x.ad === ad)) { g.bildir(`'${ad}' zaten var`); return; }
    g.degiskenYaz(ad, DEGISKEN_ILK_DEGERI[tipG.value as DegiskenTipi]);
  };
  ekle.addEventListener("click", ekleIs);
  adG.addEventListener("keydown", (e) => { if (e.key === "Enter") ekleIs(); });
  const satir = el("div", "il-tam"); satir.append(adG, tipG, ekle);
  g.hedef.append(satir);
}
