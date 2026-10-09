// world/level/editor/arayuz/yardim.ts — Kısayol kartı (F1 / ?): tuş haritasından ve fare hareketlerinden ÜRETİLİR
// (elle yazılmış ikinci liste yok — harita değişince kart da değişir).
"use strict";
import { KISAYOLLAR, FARE_HAREKETLERI, tusMetni, type Kisayol } from "../cekirdek/kisayol.ts";
import { el, cssEkle } from "./ortak.ts";

const Y_CSS = `
#ed-yardim { position: fixed; inset: 0; background: rgba(5,8,14,.55); z-index: 30; display: none; place-items: center; }
#ed-yardim.acik { display: grid; }
#ed-yardim .kart { background: var(--ed-zemin); border: 1px solid var(--ed-cizgi); border-radius: 10px; padding: 14px 18px; max-width: min(980px, 94vw);
  max-height: 86vh; overflow: auto; columns: 2 380px; column-gap: 28px; }
#ed-yardim h3 { margin: 0 0 6px; font-size: 13px; color: #a9bde0; break-after: avoid; }
#ed-yardim .bolum { break-inside: avoid; margin-bottom: 12px; }
#ed-yardim .s { display: grid; grid-template-columns: 150px 1fr; gap: 8px; padding: 2px 0; }
#ed-yardim .s > span:first-child { text-align: right; }
#ed-yardim .alt { color: var(--ed-soluk); font-size: 11px; margin-top: 4px; column-span: all; }
`;

/** Aynı eylemin birden çok tuşu tek satırda ("Delete / Backspace"); yer imleri 1–9 tek satıra sıkışır. */
function satirlar(liste: readonly Kisayol[]): [string, string][] {
  const harita = new Map<string, string[]>();
  for (const k of liste) {
    const aciklama = k.yuva !== undefined ? k.aciklama.replace(String(k.yuva), "1–9") : k.aciklama;
    const tus = k.yuva !== undefined ? tusMetni(k).replace(/\d$/, "1…9") : tusMetni(k);
    const l = harita.get(aciklama) ?? [];
    if (!l.includes(tus)) l.push(tus);
    harita.set(aciklama, l);
  }
  return [...harita].map(([a, t]) => [t.join(" / "), a]);
}

export function yardimKur(): { acKapa(): void; acikMi(): boolean } {
  cssEkle("edYardimStil", Y_CSS);
  const kok = el("div", "ed-kok"); kok.id = "ed-yardim";
  const kart = el("div", "kart");
  const bolum = (baslik: string, s: [string, string][]) => {
    const b = el("div", "bolum");
    b.append(el("h3", "", baslik));
    for (const [tus, aciklama] of s) {
      const r = el("div", "s");
      const t = el("span");
      for (const [i, parca] of tus.split(" / ").entries()) { if (i) t.append(" / "); t.append(el("kbd", "", parca)); }
      r.append(t, el("span", "", aciklama));
      b.append(r);
    }
    kart.append(b);
  };
  bolum("Fare", FARE_HAREKETLERI.map((f) => [f.hareket, f.aciklama]));
  for (const g of [...new Set(KISAYOLLAR.map((k) => k.grup))]) bolum(g, satirlar(KISAYOLLAR.filter((k) => k.grup === g)));
  kart.append(el("div", "alt", "Sağ tık basılıyken tuşlar uçuşa gider, kısayollar çalışmaz. Metin kutusundayken yalnız Ctrl+S ve Esc. Kapatmak için tıkla ya da F1."));
  kok.append(kart);
  kok.onclick = () => kok.classList.remove("acik");
  document.body.append(kok);
  return { acKapa: () => kok.classList.toggle("acik"), acikMi: () => kok.classList.contains("acik") };
}
