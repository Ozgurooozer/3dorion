// uygulama/yapi/sekans/ayrintiPaneli.ts — SEKANS EDİTÖRÜNÜN AYRINTILAR PANELİ (spec 36 S2): seçili anahtarın/bölümün/izin/bağlamanın — seçim yoksa
// sekansın — alanları; her alanın altında birimi ve anlamı. DOM katmanı. Alanlar ve kuralları saf modelde (`ayrintiAlanlari.ts`: sayı kutusu "1+1"i
// REDDEDER, kare tamsayı); değer `change` ile (Enter / odak kaybı) uygulanır, her alan değişikliği TEK geri al adımı. Kabul edilmezse kutu eski değere döner,
// neden alt şeritte ve panelde kırmızı.
"use strict";
import { SEKANS_FPS } from "../../../protocol/sekans.ts";
import { ayrintiAlanlari, ayrintiUygula, type AyrintiAlani } from "../../sekans/editor/ayrintiAlanlari.ts";
import { el } from "../ortak/dom.ts";
import type { SekansBaglami } from "./editorBaglami.ts";

export function ayrintiPaneliKur(b: SekansBaglami): { kok: HTMLElement; ciz(): void } {
  const kok = el("div", "sk-sag");
  let sonHata = "";

  function girdi(a: AyrintiAlani, degisti: (ham: string | boolean) => void): HTMLElement {
    if (a.tur === "bool") { const c = el("input"); c.type = "checkbox"; c.checked = a.deger === true; c.addEventListener("change", () => degisti(c.checked)); return c; }
    if (a.tur === "secim") {
      const s = el("select");
      for (const x of a.secenekler ?? []) { const o = el("option", "", x === "" ? "— seç —" : x); o.value = x; if (x === a.deger) o.selected = true; s.append(o); }
      s.addEventListener("change", () => degisti(s.value));
      return s;
    }
    const i = el("input"); i.type = "text"; i.spellcheck = false; i.autocomplete = "off"; i.value = String(a.deger);
    if (a.tur === "sayi") i.inputMode = "decimal";
    i.title = a.ipucu;
    i.addEventListener("change", () => degisti(i.value));
    i.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); i.blur(); } });
    return i;
  }

  function ciz(): void {
    const o = b.oturum();
    kok.replaceChildren();
    if (!o) return;
    const s = o.sekans();
    const ortam = {
      klipler: b.klipler.adlar(), ajanlar: b.ajanlar(),
      klipKaresi: (ad: string) => { const k = b.klipler.bul(ad); return k ? Math.round(k.sure * SEKANS_FPS) : null; },
    };
    const ay = ayrintiAlanlari(s, o.secim, ortam);
    kok.append(el("div", "sk-baslik2", `Ayrıntılar · ${ay.baslik}`));
    const alanlar = el("div", "sk-alanlar");
    for (const a of ay.alanlar) {
      alanlar.append(el("label", "", a.etiket), girdi(a, (ham) => {
        const r = ayrintiUygula(o.sekans(), o.secim, a, ham);
        if (!r.ok) { sonHata = r.hata; b.bildir(`yazılmadı: ${r.hata}`, "hata"); ciz(); return; }
        sonHata = "";
        b.sonuc(o.uygula({ ok: true, deger: r.deger.sekans }, `${a.etiket} değişti`, r.deger.secim));
      }), el("small", "", a.ipucu));
    }
    kok.append(alanlar);
    for (const m of ay.bilgi) kok.append(el("div", m.startsWith("✗") ? "sk-hata" : "sk-soluk", m));
    if (sonHata) kok.append(el("div", "sk-hata", `✗ ${sonHata}`));
    kok.append(el("div", "sk-baslik2", "Ne nedir"),
      el("div", "sk-soluk", "Zaman KARE ile: 30 kare = 1 sn. ◆ anahtar (değer o karede), ● yumuşak geçiş, ■ basamak. Mavi kutu = klip bölümü (taranmış kısım: klip bitti, son değerinde durur). Yeşil/kırmızı çizgi: ▶'nin oynadığı aralık. Sarı çizgi: playhead."));
  }
  return { kok, ciz };
}
