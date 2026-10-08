// world/level/editor/levelPaneli.ts — Level paneli: tanımı canlı düzenle, dosyaya kaydet.
//
// Panel tanımdan OTOMATİK kurulur (editor/alanlar.ts): her yaprak türüne bir girdi — sayı, renk seçici,
// palet adı listesi, onay kutusu, dizi. Değişiklik anında `level.ayarla` ile sahneye gider (yalnız değişen
// katman yeniden kurulur). "Kaydet" tanımı geliştirme sunucusuna gönderir; sunucu doğrulayıp
// world/level/<ad>/<ad>.level.json'a yazar (vite.config.ts `levelKaydet`). H paneli gizler, F8 Inspector.
"use strict";
import type { Level } from "../cekirdek/levelKur.ts";
import { alanlar, yolaYaz, yoldanOku, type Alan, type Yol } from "./alanlar.ts";

export interface PanelAyari {
  level: Level;
  /** Kaydetme ve yeniden yükleme adresi için level adı (ova → world/level/ova/ova.level.json). */
  ad: string;
  /** Dosyadaki tanımı getirir (yeniden yükle). */
  dosyadanOku(): Promise<unknown>;
  inspektor(): Promise<boolean>;
}

const STIL = `
#levelPaneli { position: fixed; top: 8px; right: 8px; width: 300px; max-height: calc(100% - 16px); overflow: auto;
  background: rgba(16,22,34,.88); color: #dfe6f3; font: 12px system-ui, sans-serif; border-radius: 6px; z-index: 10; }
#levelPaneli header { position: sticky; top: 0; background: #101622; padding: 6px 8px; display: flex; gap: 4px; flex-wrap: wrap; }
#levelPaneli button { background: #26324a; color: #dfe6f3; border: 0; border-radius: 4px; padding: 3px 7px; cursor: pointer; font: inherit; }
#levelPaneli button:hover { background: #33446a; }
#levelPaneli details { border-top: 1px solid #222c40; }
#levelPaneli summary { padding: 5px 8px; cursor: pointer; color: #9fb4d8; }
#levelPaneli .alan { display: grid; grid-template-columns: 1fr 130px; gap: 4px; padding: 2px 8px; align-items: center; }
#levelPaneli .alan span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #b9c4d8; }
#levelPaneli input, #levelPaneli select { width: 100%; box-sizing: border-box; background: #0c111b; color: #dfe6f3; border: 1px solid #2a3550; border-radius: 3px; font: inherit; }
#levelPaneli .cok { display: flex; gap: 2px; }
#levelPaneli #durum { padding: 4px 8px; color: #8fd18f; min-height: 16px; }
#levelPaneli #durum.hata { color: #ff9a8a; }
`;

/** Sayı girdisinin adımı: tamsayıysa 1, değilse büyüklüğüne göre. */
function adim(v: number): string {
  if (Number.isInteger(v)) return "1";
  const b = Math.abs(v);
  return b >= 10 ? "0.5" : b >= 1 ? "0.05" : b >= 0.1 ? "0.01" : "0.001";
}

export function levelPaneliKur(p: PanelAyari): { yenile(): void } {
  if (!document.getElementById("levelPaneliStil")) {
    const s = document.createElement("style"); s.id = "levelPaneliStil"; s.textContent = STIL; document.head.append(s);
  }
  const kok = document.createElement("div");
  kok.id = "levelPaneli";
  document.body.append(kok);
  const acikBolumler = new Set<string>(["isik", "ortam"]);

  const durum = (m: string, hata = false) => {
    const d = kok.querySelector<HTMLDivElement>("#durum");
    if (d) { d.textContent = m; d.className = hata ? "hata" : ""; }
  };

  const degistir = (yol: Yol, deger: unknown) => {
    try {
      p.level.ayarla(yolaYaz(p.level.tanim(), yol, deger));
      durum(`değişti: ${yol.join(".")} (kaydedilmedi)`);
      if (yol[0] === "palet") ciz();   // palet adları listeleri etkiler
    } catch (err) {
      durum(err instanceof Error ? err.message : String(err), true);
    }
  };

  const girdi = (a: Alan, paletAdlari: string[]): HTMLElement => {
    const sec = (deger: string, secenekler: string[], yaz: (v: string) => void) => {
      const s = document.createElement("select");
      for (const o of secenekler) s.add(new Option(o, o, false, o === deger));
      s.onchange = () => yaz(s.value);
      return s;
    };
    const sayi = (deger: number, yaz: (v: number) => void) => {
      const i = document.createElement("input");
      i.type = "number"; i.value = String(deger); i.step = adim(deger);
      i.onchange = () => { const v = Number(i.value); if (Number.isFinite(v)) yaz(v); };
      return i;
    };
    switch (a.tur) {
      case "sayi": return sayi(a.deger as number, (v) => degistir(a.yol, v));
      case "mantik": {
        const i = document.createElement("input"); i.type = "checkbox"; i.checked = a.deger as boolean;
        i.onchange = () => degistir(a.yol, i.checked);
        return i;
      }
      case "renk": {
        const i = document.createElement("input"); i.type = "color"; i.value = a.deger as string;
        i.oninput = () => degistir(a.yol, i.value);
        return i;
      }
      case "paletAdi": return sec(a.deger as string, paletAdlari, (v) => degistir(a.yol, v));
      case "metin": {
        const i = document.createElement("input"); i.value = a.deger as string;
        i.onchange = () => degistir(a.yol, i.value);
        return i;
      }
      case "sayiDizisi": case "metinDizisi": {
        const d = document.createElement("div"); d.className = "cok";
        (a.deger as unknown[]).forEach((v, k) => {
          const yaz = (x: unknown) => {
            const dizi = (yoldanOku(p.level.tanim(), a.yol) as unknown[]).slice();
            dizi[k] = x;
            degistir(a.yol, dizi);
          };
          d.append(typeof v === "number" ? sayi(v, yaz) : paletAdlari.includes(v as string) ? sec(v as string, paletAdlari, yaz) : (() => {
            const i = document.createElement("input"); i.value = String(v); i.onchange = () => yaz(i.value); return i;
          })());
        });
        return d;
      }
    }
  };

  const bolum = (anahtar: string, baslik: string, liste: Alan[], paletAdlari: string[], kirp: number) => {
    const d = document.createElement("details");
    d.open = acikBolumler.has(anahtar);
    d.ontoggle = () => { if (d.open) acikBolumler.add(anahtar); else acikBolumler.delete(anahtar); };
    const s = document.createElement("summary"); s.textContent = baslik; d.append(s);
    for (const a of liste) {
      const satir = document.createElement("div"); satir.className = "alan";
      const ad = document.createElement("span");
      ad.textContent = a.yol.slice(kirp).filter((x) => x !== "ayar").join(" · ");
      ad.title = a.yol.join(".");
      satir.append(ad, girdi(a, paletAdlari));
      d.append(satir);
    }
    return d;
  };

  const ciz = () => {
    const t = p.level.tanim();
    const paletAdlari = Object.keys(t.palet);
    const adlar = new Set(paletAdlari);
    kok.replaceChildren();
    const ust = document.createElement("header");
    const dugme = (yazi: string, is: () => void) => { const b = document.createElement("button"); b.textContent = yazi; b.onclick = is; ust.append(b); };
    dugme("Kaydet", () => { void kaydet(); });
    dugme("Dosyadan yükle", () => { void yukle(); });
    dugme("JSON kopyala", () => { void navigator.clipboard.writeText(JSON.stringify(p.level.tanim(), null, 2)).then(() => durum("panoya kopyalandı")); });
    dugme("Inspector (F8)", () => { void p.inspektor(); });
    const d = document.createElement("div"); d.id = "durum";
    kok.append(ust, d);
    kok.append(bolum("palet", "palet", alanlar(t.palet, adlar, ["palet"]), paletAdlari, 1));
    kok.append(bolum("isik", "ışık", alanlar(t.isik, adlar, ["isik"]), paletAdlari, 1));
    kok.append(bolum("ortam", "ortam", alanlar(t.ortam, adlar, ["ortam"]), paletAdlari, 1));
    t.katmanlar.forEach((k, i) => {
      kok.append(bolum(`katman:${k.ad}`, `katman · ${k.ad} (${k.tur})${k.acik ? "" : " — kapalı"}`,
        [{ yol: ["katmanlar", i, "acik"], deger: k.acik, tur: "mantik" }, ...alanlar(k.ayar, adlar, ["katmanlar", i, "ayar"])], paletAdlari, 2));
    });
  };

  const kaydet = async () => {
    try {
      const r = await fetch(`/__level/kaydet?ad=${encodeURIComponent(p.ad)}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p.level.tanim()),
      });
      const m = await r.text();
      durum(r.ok ? `kaydedildi: ${m}` : `kaydedilemedi: ${m}`, !r.ok);
    } catch (err) { durum(`kaydedilemedi: ${err instanceof Error ? err.message : err}`, true); }
  };
  const yukle = async () => {
    try { p.level.ayarla(await p.dosyadanOku()); ciz(); durum("dosyadan yüklendi"); }
    catch (err) { durum(err instanceof Error ? err.message : String(err), true); }
  };

  addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
    if (e.code === "KeyH") kok.style.display = kok.style.display === "none" ? "" : "none";
    if (e.code === "F8") { e.preventDefault(); void p.inspektor(); }
  });
  ciz();
  return { yenile: ciz };
}
