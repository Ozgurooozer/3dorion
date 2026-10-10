// world/level/editor/levelPaneli.ts — Dünya paneli (editörün sol yuvasında "Dünya" sekmesi): stil, palet, ışık,
// ortam, zaman, özel shader'lar, katmanlar — tanımı canlı düzenler.
//
// Panel tanımdan OTOMATİK kurulur (editor/alanlar.ts): her yaprak türüne bir denetim — sayı: kaydırıcı + kutu
// (aralık modülden ya da editor/aralik.ts'ten), renk/palet adı: renk kartlı seçici, mantıksal: anahtar,
// dizi: alt alta. Kaydırıcı sürüklenirken değişiklik kareye BİR KEZ, geçmişsiz uygulanır (`durum.onizle`; ağır
// katman takılmasın); bırakınca TEK geri al adımı olur (sürükleme başındaki hâl). Geri/ileri al, kaydet ve
// kısayollar editörün (spec 22: editor/cekirdek/durum.ts) — panel yalnız `durum.degistir` çağırır.
// Nesneler burada değil: sahne ağacı ve özellikler panelinde.
"use strict";
import type { ModulKaydi } from "../cekirdek/levelKur.ts";
import type { LevelTanimi } from "../cekirdek/levelTanimi.ts";
import type { EditorDurumu, Hal } from "./cekirdek/durum.ts";
import type { ShaderKaydi } from "../shader/shaderSistemi.ts";
import { alanlar, yolaYaz, yoldanOku, type Alan, type Yol } from "./alanlar.ts";
import { aralikBul, etiket, type Aralik } from "./aralik.ts";
import { ONAYARLAR, ONAYAR_ADLARI, onayarUygula, onayarAdi, PALET_DUZENI_ADLARI, paletDuzeniUygula, paletDuzeniAdi } from "../stil/stilTanimi.ts";

export interface PanelAyari {
  durum: EditorDurumu;
  moduller: ModulKaydi;
  /** Özel shader kaydı (spec 20): "Shader'lar" bölümü bundan şema/aralık/açıklama alır. */
  shaderlar?: ShaderKaydi;
}

const ACIK_ANAHTARI = "orion.levelPaneli.acik";

const STIL = `
#lp { display: flex; flex-direction: column; flex: 1; min-height: 0; color: #dde5f2; font: 12px/1.35 system-ui, sans-serif; }
#lp .bas { padding: 8px 10px 6px; border-bottom: 1px solid #222c41; }
#lp .baslik { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 13px; }
#lp .nokta { width: 8px; height: 8px; border-radius: 50%; background: #3a4a66; }
#lp .nokta.kirli { background: #f2b544; }
#lp .dugmeler { display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap; }
#lp button { background: #24304a; color: #dde5f2; border: 0; border-radius: 5px; padding: 4px 8px; cursor: pointer; font: inherit; }
#lp button:hover { background: #31426a; }
#lp button.ana { background: #2f5fd0; }
#lp button.ana.kirli { background: #e09b1a; color: #111; }
#lp button:disabled { opacity: .4; cursor: default; }
#lp input.ara { width: 100%; margin-top: 6px; box-sizing: border-box; padding: 4px 7px; border-radius: 5px; border: 1px solid #2a3654;
  background: #0b101a; color: #dde5f2; font: inherit; }
#lp .govde { overflow: auto; flex: 1; padding-bottom: 6px; }
#lp details { border-bottom: 1px solid #1d2638; }
#lp summary { list-style: none; padding: 7px 10px; cursor: pointer; display: flex; align-items: center; gap: 6px; color: #a9bde0; font-weight: 600; }
#lp summary::-webkit-details-marker { display: none; }
#lp summary .ok { width: 10px; transition: transform .12s; color: #6f84a8; }
#lp details[open] > summary .ok { transform: rotate(90deg); }
#lp summary .bosluk { flex: 1; }
#lp summary .tur { color: #6f84a8; font-weight: 400; }
#lp .alt { padding: 2px 10px 2px 20px; color: #7f93b7; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; margin-top: 4px; }
#lp .satir { display: grid; grid-template-columns: 112px 1fr; gap: 6px; padding: 3px 10px 3px 20px; align-items: center; }
#lp .satir > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #c3cee2; }
#lp .satir.gizle { display: none; }
#lp .surgu { display: grid; grid-template-columns: 1fr 58px; gap: 5px; align-items: center; }
#lp input[type=range] { width: 100%; accent-color: #5b8cff; }
#lp input[type=number], #lp select, #lp input[type=text] { width: 100%; box-sizing: border-box; background: #0b101a; color: #dde5f2;
  border: 1px solid #2a3654; border-radius: 4px; padding: 2px 4px; font: inherit; }
#lp .renk { display: grid; grid-template-columns: 22px 1fr; gap: 5px; align-items: center; }
#lp .kart { width: 22px; height: 18px; border-radius: 4px; border: 1px solid rgba(255,255,255,.25); }
#lp input[type=color] { width: 22px; height: 20px; padding: 0; border: 0; background: none; cursor: pointer; }
#lp .palet { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; padding: 4px 10px 8px 20px; }
#lp .palet label { display: grid; grid-template-columns: 22px 1fr; gap: 5px; align-items: center; color: #c3cee2; overflow: hidden; }
#lp .anahtar { position: relative; width: 30px; height: 16px; }
#lp .anahtar input { opacity: 0; width: 0; height: 0; }
#lp .anahtar i { position: absolute; inset: 0; background: #34405a; border-radius: 9px; transition: .15s; cursor: pointer; }
#lp .anahtar i::after { content: ""; position: absolute; left: 2px; top: 2px; width: 12px; height: 12px; border-radius: 50%; background: #dde5f2; transition: .15s; }
#lp .anahtar input:checked + i { background: #3f7bff; }
#lp .anahtar input:checked + i::after { transform: translateX(14px); }
#lp .dizi { display: grid; gap: 3px; }
#lp .dizi > div { display: grid; grid-template-columns: 12px 1fr; gap: 4px; align-items: center; }
#lp .dizi > div.etiketsiz { grid-template-columns: 1fr; }
#lp .dizi .etk { color: #7f93b7; font-size: 11px; }
#lp details.kapali-katman > summary .ad { color: #66779a; text-decoration: line-through; }
#lp .ipucu { color: #6f84a8; font-size: 11px; margin-top: 4px; }
`;

const el = <K extends keyof HTMLElementTagNameMap>(etiketAdi: K, sinif = "", metin = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(etiketAdi);
  if (sinif) e.className = sinif;
  if (metin) e.textContent = metin;
  return e;
};

/**
 * Açık bölümler (hatırlanır). İlk açılışta "Stil" ve "Işık" açık: en sık oynanan yerler. Stil bölümü sonradan
 * geldi (spec 18): kayıtlı tercihi olana bir kez açık gelsin, sonra kullanıcının seçimi geçerli.
 */
function acikOku(): Set<string> {
  try {
    const ham = localStorage.getItem(ACIK_ANAHTARI);
    const s = new Set(ham === null ? ["stil", "isik"] : JSON.parse(ham) as string[]);
    if (localStorage.getItem("orion.levelPaneli.stilGoruldu") === null) { s.add("stil"); localStorage.setItem("orion.levelPaneli.stilGoruldu", "1"); }
    return s;
  } catch { return new Set(["stil", "isik"]); }
}
function acikYaz(s: Set<string>): void {
  try { localStorage.setItem(ACIK_ANAHTARI, JSON.stringify([...s])); } catch { /* önemsiz */ }
}

export interface LevelPaneli {
  kok: HTMLElement;
  yenile(): void;
  /** Bölümü açıp görünür yap (sahne ağacında katmana tıklayınca: "katman:<ad>"). */
  bolumAc(anahtar: string): void;
}

/**
 * Panelin gösterdiği kısım (nesneler ve modüllerin VERİ alanları — arazi fırçası — hariç): yalnız bu değişince
 * yeniden çizilir (gizmo sürüklemesi ya da arazi vuruşu paneli her damgada yeniden kurmasın).
 */
const dunyaImzasi = (t: LevelTanimi, veri: ReadonlySet<string>) =>
  JSON.stringify({ ...t, nesneler: undefined, gruplar: undefined, kameraYerleri: undefined }, (k, v: unknown) => (veri.has(k) ? undefined : v));

export function levelPaneliKur(p: PanelAyari): LevelPaneli {
  if (!document.getElementById("lpStil")) { const s = el("style"); s.id = "lpStil"; s.textContent = STIL; document.head.append(s); }
  const { durum } = p;
  const kok = el("div"); kok.id = "lp";

  const acik = acikOku();
  let surukleOnce: Hal | null = null;
  let bekleyen: { yol: Yol; deger: unknown } | null = null;
  let arama = "";
  const veriAlanlari = new Set([...p.moduller.values()].flatMap((m) => m.veri ?? []));
  let sonImza = dunyaImzasi(durum.tanim(), veriAlanlari);

  const metin = (yol: Yol, deger: unknown) => `${yol.map(etiket).join(" › ")} = ${Array.isArray(deger) ? `[${deger.join(", ")}]` : String(deger)}`;
  /** Kaydırıcı sürüklenirken: kareye bir kez, geçmişsiz uygula (son değer kazanır). */
  const kareyeUygula = (yol: Yol, deger: unknown) => {
    const ilk = bekleyen === null;
    bekleyen = { yol, deger };
    if (ilk) requestAnimationFrame(() => {
      const x = bekleyen; bekleyen = null;
      if (x && surukleOnce) durum.onizle(yolaYaz(durum.tanim(), x.yol, x.deger));
    });
  };
  /** Bütün tanımı değiştiren işlem (stil önayarı, renk düzeni). */
  const tanimDegistir = (yeni: (t: LevelTanimi) => LevelTanimi, mesaj: string) => { durum.degistir(yeni, mesaj); };
  const secici = (secenekler: readonly string[], simdiki: string, yaz: (v: string) => void) => {
    const s = el("select");
    for (const ad of secenekler) s.add(new Option(ad, ad, false, ad === simdiki));
    if (!secenekler.includes(simdiki)) s.add(new Option(`${simdiki} (elle ayarlı)`, simdiki, false, true));
    s.onchange = () => yaz(s.value);
    return s;
  };
  const degistir = (yol: Yol, deger: unknown) => { durum.degistir((t) => yolaYaz(t, yol, deger), metin(yol, deger)); };

  // ── denetimler ──
  const surgu = (yol: Yol, deger: number, a: Aralik, yaz: (v: number) => void, birak: (v: number) => void) => {
    const kap = el("div", "surgu");
    const r = el("input"); r.type = "range"; r.min = String(a.min); r.max = String(a.max); r.step = String(a.adim); r.value = String(deger);
    const n = el("input"); n.type = "number"; n.step = String(a.adim); n.value = String(deger);
    r.onpointerdown = () => { surukleOnce = durum.hal(); };
    r.oninput = () => { n.value = r.value; yaz(Number(r.value)); };
    r.onchange = () => birak(Number(r.value));
    n.onchange = () => { const v = Number(n.value); if (Number.isFinite(v)) { r.value = String(v); surukleOnce = null; birak(v); } };
    n.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") n.blur(); };
    kap.title = yol.join(".");
    kap.append(r, n);
    return kap;
  };
  /** Sürükleme bitince: son değeri geçmişe yazarak uygula (sürükleme başındaki tanım geri alma noktası). */
  const birakici = (yol: Yol) => (v: unknown) => {
    const once = surukleOnce;
    surukleOnce = null;
    bekleyen = null;
    durum.degistir((t) => yolaYaz(once ? once.tanim : t, yol, v), metin(yol, v), once ? { onceki: once } : {});
  };

  const renkSecici = (deger: string, palet: Record<string, string>, yaz: (v: string) => void) => {
    const kap = el("div", "renk");
    const kart = el("div", "kart");
    const s = el("select");
    for (const ad of Object.keys(palet)) s.add(new Option(ad, ad, false, ad === deger));
    if (deger.startsWith("#")) s.add(new Option(`özel ${deger}`, deger, false, true));
    const boya = () => { kart.style.background = s.value.startsWith("#") ? s.value : palet[s.value] ?? "#000"; };
    boya();
    s.onchange = () => { boya(); yaz(s.value); };
    kap.append(kart, s);
    return kap;
  };

  const anahtar = (deger: boolean, yaz: (v: boolean) => void) => {
    const l = el("label", "anahtar");
    const i = el("input"); i.type = "checkbox"; i.checked = deger;
    i.onchange = () => yaz(i.checked);
    l.append(i, el("i"));
    l.onclick = (e) => e.stopPropagation();   // özet satırındayken bölümü açıp kapatmasın
    return l;
  };

  const denetim = (a: Alan, t: LevelTanimi, modulAraligi?: Readonly<Record<string, Aralik>>): HTMLElement => {
    switch (a.tur) {
      case "sayi": {
        const v = a.deger as number;
        return surgu(a.yol, v, aralikBul(a.yol, v, modulAraligi), (x) => kareyeUygula(a.yol, x), birakici(a.yol));
      }
      case "mantik": return anahtar(a.deger as boolean, (v) => degistir(a.yol, v));
      case "renk": case "paletAdi": return renkSecici(a.deger as string, t.palet, (v) => degistir(a.yol, v));
      case "metin": {
        const i = el("input"); i.type = "text"; i.value = a.deger as string;
        i.onchange = () => degistir(a.yol, i.value);
        i.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") i.blur(); };
        return i;
      }
      case "sayiDizisi": case "metinDizisi": {
        const kap = el("div", "dizi");
        const xyz = a.yol.at(-1) === "yon" ? ["x", "y", "z"] : null;
        (a.deger as unknown[]).forEach((v, k) => {
          const elemanYolu = [...a.yol, k];
          const dizideYaz = (x: unknown) => {
            const d = (yoldanOku(durum.tanim(), a.yol) as unknown[]).slice(); d[k] = x; return d;
          };
          const satir = el("div", xyz ? "" : "etiketsiz");
          if (xyz) satir.append(el("span", "etk", xyz[k] ?? String(k)));
          if (typeof v === "number") {
            satir.append(surgu(elemanYolu, v, aralikBul(elemanYolu, v, modulAraligi),
              (x) => kareyeUygula(a.yol, dizideYaz(x)), (x) => birakici(a.yol)(dizideYaz(x))));
          } else {
            satir.append(renkSecici(String(v), t.palet, (x) => degistir(a.yol, dizideYaz(x))));
          }
          kap.append(satir);
        });
        return kap;
      }
    }
  };

  const satir = (ad: string, d: HTMLElement, yol: Yol) => {
    const s = el("div", "satir");
    const span = el("span", "", ad); span.title = yol.join(".");
    s.dataset["ara"] = `${ad} ${yol.join(" ")}`.toLocaleLowerCase("tr");
    s.append(span, d);
    return s;
  };

  const bolum = (anahtarAdi: string, baslik: HTMLElement | string, govde: HTMLElement[], ekSinif = "") => {
    const d = el("details"); if (ekSinif) d.className = ekSinif;
    d.open = acik.has(anahtarAdi) || arama !== "";
    d.ontoggle = () => { if (arama) return; if (d.open) acik.add(anahtarAdi); else acik.delete(anahtarAdi); acikYaz(acik); };
    const s = el("summary"); s.append(el("span", "ok", "▸"));
    if (typeof baslik === "string") s.append(el("span", "ad", baslik)); else s.append(baslik);
    d.append(s, ...govde);
    return d;
  };

  /** Bir nesnenin alanlarını, iç içe nesneleri alt başlıkla gruplayarak satırlara açar. */
  const alanSatirlari = (kokYol: Yol, nesne: unknown, t: LevelTanimi, modulAraligi?: Readonly<Record<string, Aralik>>): HTMLElement[] => {
    const adlar = new Set(Object.keys(t.palet));
    const cikti: HTMLElement[] = [];
    let altBaslik = "";
    for (const a of alanlar(nesne, adlar, kokYol)) {
      const goreli = a.yol.slice(kokYol.length);
      // Alt başlık = alanın üst yolu (son parça hariç): "güneş", "güneş › gölge", "gök dolgusu"…
      const grup = goreli.slice(0, -1).filter((x): x is string => typeof x === "string").map(etiket).join(" › ");
      if (grup !== altBaslik) { altBaslik = grup; if (grup) cikti.push(el("div", "alt", grup)); }
      cikti.push(satir(etiket(goreli.at(-1) ?? ""), denetim(a, t, modulAraligi), a.yol));
    }
    return cikti;
  };

  // ── iskelet ──
  const bas = el("div", "bas");
  const dugmeler = el("div", "dugmeler");
  const dugme = (yazi: string, baslikMetni: string, is: () => void) => { const x = el("button", "", yazi); x.title = baslikMetni; x.onclick = () => { is(); x.blur(); }; dugmeler.append(x); return x; };
  dugme("JSON", "Tanımı panoya kopyala", () => { void navigator.clipboard.writeText(JSON.stringify(durum.tanim(), null, 2)).then(() => durum.bildir("tanım panoya kopyalandı")); });
  const ara = el("input", "ara"); ara.type = "text"; ara.placeholder = "Ara… (ör. gölge, sayı, renk)";
  ara.oninput = () => { arama = ara.value.trim().toLocaleLowerCase("tr"); ciz(); ara.focus(); };
  ara.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Escape") { ara.value = ""; arama = ""; ara.blur(); ciz(); } };
  bas.append(dugmeler, ara);
  const govde = el("div", "govde");
  kok.append(bas, govde);

  const ciz = () => {
    const t = durum.tanim();
    sonImza = dunyaImzasi(t, veriAlanlari);
    const kaydir = govde.scrollTop;
    const bolumler: HTMLElement[] = [];

    // Palet: renk kartları.
    const paletKap = el("div", "palet");
    for (const [ad, r] of Object.entries(t.palet)) {
      const l = el("label");
      l.dataset["ara"] = `palet ${ad}`.toLocaleLowerCase("tr");
      const i = el("input"); i.type = "color"; i.value = r;
      i.oninput = () => kareyeUygula(["palet", ad], i.value);
      i.onchange = () => { birakici(["palet", ad])(i.value); };
      i.onpointerdown = () => { surukleOnce = durum.hal(); };
      l.append(i, el("span", "", ad));
      paletKap.append(l);
    }
    // Stil (spec 18): önayar ve renk düzeni seçicisi + bütün stil alanları (önayar seç → ince ayar → Kaydet).
    const stilAdi = onayarAdi(t);
    const stilSatirlari = [
      satir("önayar", secici(ONAYAR_ADLARI, stilAdi, (ad) => tanimDegistir((x) => onayarUygula(x, ad), `stil: ${ad} — ${ONAYARLAR[ad]?.aciklama ?? ""}`)), ["stil"]),
      satir("renk düzeni", secici(PALET_DUZENI_ADLARI, paletDuzeniAdi(t), (ad) => tanimDegistir((x) => paletDuzeniUygula(x, ad), `renk düzeni: ${ad}`)), ["palet"]),
      el("div", "ipucu", ONAYARLAR[stilAdi]?.aciklama ?? "Önayardan değiştirildi. P / Shift+P tuşları da geçer."),
      ...alanSatirlari(["stil"], t.stil, t),
    ];
    bolumler.push(bolum("stil", `Stil · ${stilAdi}`, stilSatirlari));
    bolumler.push(bolum("palet", "Palet", [paletKap]));
    bolumler.push(bolum("isik", "Işık", alanSatirlari(["isik"], t.isik, t)));
    bolumler.push(bolum("ortam", "Ortam", alanSatirlari(["ortam"], t.ortam, t)));

    // Zaman (gün/gece) ve özel shader'lar (spec 20): katman deseni — aç/kapa, ↺ varsayılan, kaydırıcılar.
    if (t.zaman) {
      const zs = [el("div", "ipucu", "Saat güneşi ve ışığı yönetir (isik.gunes.yon yok sayılır); dünya: 0 ova · 1 siberpunk · 2 ortaçağ · 3 büyü."), ...alanSatirlari(["zaman"], t.zaman, t)];
      bolumler.push(bolum("zaman", "Zaman (gün/gece)", zs));
    }
    (t.shaderlar ?? []).forEach((s, i) => {
      const modul = p.shaderlar?.get(s.tur);
      const ozet = el("span", "bosluk");
      ozet.append(el("span", "ad", s.tur), el("span", "tur", " shader"));
      const sifirla = el("button", "", "↺"); sifirla.title = "varsayılana dön";
      sifirla.onclick = (e) => { e.preventDefault(); e.stopPropagation(); if (modul) degistir(["shaderlar", i, "ayar"], { ...modul.varsayilan }); };
      const bas3 = el("span"); bas3.style.display = "contents";
      bas3.append(anahtar(s.acik, (v) => { degistir(["shaderlar", i, "acik"], v); }), ozet, sifirla);
      const satirlar = alanSatirlari(["shaderlar", i, "ayar"], s.ayar, t, modul?.aralik as Readonly<Record<string, Aralik>> | undefined);
      if (modul) satirlar.unshift(el("div", "ipucu", modul.aciklama));
      bolumler.push(bolum(`shader:${s.tur}`, bas3, satirlar, s.acik ? "" : "kapali-katman"));
    });

    t.katmanlar.forEach((k, i) => {
      const modul = p.moduller.get(k.tur);
      const ozet = el("span", "bosluk");
      const ad = el("span", "ad", k.ad);
      const tur = el("span", "tur", ` ${k.tur}`);
      ozet.append(ad, tur);
      const sifirla = el("button", "", "↺"); sifirla.title = "varsayılana dön";
      sifirla.onclick = (e) => { e.preventDefault(); e.stopPropagation(); if (modul) degistir(["katmanlar", i, "ayar"], { ...modul.varsayilan }); };
      const bas2 = el("span"); bas2.style.display = "contents";
      bas2.append(anahtar(k.acik, (v) => { degistir(["katmanlar", i, "acik"], v); }), ozet, sifirla);
      const veri = new Set<string>(modul?.veri ?? []);
      const gorunen = Object.fromEntries(Object.entries(k.ayar).filter(([a]) => !veri.has(a)));
      const satirlar = alanSatirlari(["katmanlar", i, "ayar"], gorunen, t, modul?.aralik as Readonly<Record<string, Aralik>> | undefined);
      if (veri.size) satirlar.push(el("div", "ipucu", `${[...veri].join(", ")}: arazi aracıyla çizilir (editör, 7)`));
      if (modul) satirlar.unshift(el("div", "ipucu", modul.aciklama));
      const b = bolum(`katman:${k.ad}`, bas2, satirlar, k.acik ? "" : "kapali-katman");
      b.dataset["bolum"] = `katman:${k.ad}`;
      bolumler.push(b);
    });

    govde.replaceChildren(...bolumler);
    if (arama) {
      for (const s of govde.querySelectorAll<HTMLElement>("[data-ara]")) s.classList.toggle("gizle", !s.dataset["ara"]!.includes(arama));
      for (const d of govde.querySelectorAll("details")) {
        const gorunen = d.querySelectorAll("[data-ara]:not(.gizle)").length;
        (d as HTMLElement).style.display = gorunen ? "" : "none";
      }
    }
    govde.scrollTop = kaydir;
  };



  // Dışarıdan değişince (geri al, araç çubuğu, sahne ağacındaki katman gözü) yeniden çiz: panelin gösterdiği kısım
  // değiştiyse ve kaydırıcı sürüklenmiyorsa; bir kutuya yazılıyorsa odak kaybolmasın diye bırakınca.
  let bekliyor = false;
  durum.abone("tanim", () => {
    if (surukleOnce || bekliyor || dunyaImzasi(durum.tanim(), veriAlanlari) === sonImza) return;
    const odak = document.activeElement as HTMLElement | null;
    if (odak && kok.contains(odak) && odak.matches("input[type=text], input[type=number]")) {
      bekliyor = true;
      odak.addEventListener("blur", () => { bekliyor = false; ciz(); }, { once: true });
      return;
    }
    ciz();
  });

  ciz();
  return {
    kok,
    yenile: ciz,
    bolumAc(anahtarAdi) {
      acik.add(anahtarAdi); acikYaz(acik);
      ciz();
      govde.querySelector<HTMLElement>(`[data-bolum="${anahtarAdi.replace(/"/g, "")}"]`)?.scrollIntoView({ block: "start" });
    },
  };
}
