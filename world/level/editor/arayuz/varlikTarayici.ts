// world/level/editor/arayuz/varlikTarayici.ts — Varlık tarayıcısı (alt yuva, spec 22).
//
// İki sekme: VARLIKLAR (katalog: assets/sehir/katalog.json) ve HAZIR YAPILAR (world/level/hazir/*.hazir.json —
// gruptan kaydedilen nesne takımları). Kart: önizleme, ad, boyut; ☆ yıldızla (yıldızlılar süzgeci), son
// kullanılanlar süzgeci, boyut süzgeci (en büyük kenar), arama (Ctrl+F), kart boyu kaydırıcısı.
//
// Yerleştirme iki yoldan: karta TIKLA → hayalet imleci izler, sahnede tıkla koy (art arda; Esc bitir);
// ya da kartı sahneye SÜRÜKLE-BIRAK → bırakılan yere tek kopya. Yüzey, yaslama ve döndürme editörden (tekerlek).
"use strict";
import type { Editor } from "../editor.ts";
import { KATEGORI_ADLARI, kisaAd, type Katalog, type Varlik } from "../../cekirdek/katalog.ts";
import type { Parca } from "../cekirdek/pano.ts";
import { varlik } from "../../../varlik.ts";
import { el, cssEkle, oku, okuDizi, yaz } from "./ortak.ts";

const VT_CSS = `
.ed-vt { display: flex; flex-direction: column; min-height: 0; flex: 1; }
.ed-vt .ust { display: flex; align-items: center; gap: 5px; padding: 4px 6px; border-bottom: 1px solid var(--ed-cizgi); flex-wrap: wrap; }
.ed-vt .ust input[type=search] { width: 170px; }
.ed-vt .cipler { display: flex; gap: 3px; flex-wrap: wrap; }
.ed-vt .cipler button { padding: 2px 7px; }
.ed-vt .ust .bosluk { flex: 1; }
.ed-vt .izgara { flex: 1; overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--kart, 104px), 1fr)); gap: 6px; padding: 6px; align-content: start; }
.ed-vt .kart { position: relative; background: #151c2b; border: 1px solid #222c41; border-radius: 6px; padding: 4px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
.ed-vt .kart:hover { border-color: #4a69b0; }
.ed-vt .kart.secili { border-color: var(--ed-secim); box-shadow: 0 0 0 1px var(--ed-secim) inset; }
.ed-vt .kart img { width: 100%; aspect-ratio: 1; object-fit: contain; background: #0d1320; border-radius: 4px; pointer-events: none; }
.ed-vt .kart span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ed-vt .kart i { color: var(--ed-soluk); font-size: 10px; font-style: normal; }
.ed-vt .kart .yildiz { position: absolute; right: 4px; top: 3px; color: #8a97ad; font-size: 14px; line-height: 1; }
.ed-vt .kart .yildiz.acik { color: var(--ed-uyari); }
.ed-vt .kart .hazir-ikon { width: 100%; aspect-ratio: 1; display: grid; place-items: center; font-size: 32px; background: #0d1320; border-radius: 4px; }
.ed-vt .bos { color: var(--ed-soluk); padding: 12px; }
`;

const YILDIZ = "orion.editor.yildizli", SON = "orion.editor.son", AYAR = "orion.editor.tarayici";

/** Hazır yapı kaynağı (dev sunucusu listeler/okur; arayuz/editorArayuzu bağlar). */
export interface HazirKaynagi {
  liste(): Promise<string[]>;
  oku(ad: string): Promise<Parca>;
}

export interface VarlikTarayicisi { kok: HTMLElement; araOdakla(): void; hazirlariYenile(): void }

export function varlikTarayicisiKur(ed: Editor, hazir: HazirKaynagi | null): VarlikTarayicisi {
  cssEkle("edVtStil", VT_CSS);
  const kok = el("div", "ed-vt");
  const ayar = oku(AYAR, { sekme: "varlik" as "varlik" | "hazir", kategori: "", boyut: "", kart: 104, suzgec: "" as "" | "yildiz" | "son" });
  const yildizli = new Set(okuDizi<string>(YILDIZ));
  let son = okuDizi<string>(SON);
  let katalog: Katalog | null = null, hata = "";
  let hazirlar: string[] | null = null;
  let arama = "";

  const ust = el("div", "ust");
  const sekmeV = el("button", "ed-sekme", "Varlıklar"), sekmeH = el("button", "ed-sekme", "Hazır yapılar");
  const ara = el("input"); ara.type = "search"; ara.placeholder = "Ara… (Ctrl+F)";
  ara.oninput = () => { arama = ara.value.trim().toLocaleLowerCase("tr"); ciz(); };
  ara.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Escape") { ara.value = ""; arama = ""; ara.blur(); ciz(); } };
  const cipler = el("div", "cipler");
  const boyutSec = el("select");
  for (const [d, ad] of [["", "her boy"], ["k", "küçük < 2 m"], ["o", "orta 2–8 m"], ["b", "büyük > 8 m"]] as const) boyutSec.add(new Option(ad, d));
  boyutSec.value = ayar.boyut;
  boyutSec.onchange = () => { ayar.boyut = boyutSec.value; kaydet(); ciz(); boyutSec.blur(); };
  const kartBoyu = el("input"); kartBoyu.type = "range"; kartBoyu.min = "72"; kartBoyu.max = "180"; kartBoyu.value = String(ayar.kart);
  kartBoyu.title = "kart boyu";
  kartBoyu.oninput = () => { ayar.kart = Number(kartBoyu.value); izgara.style.setProperty("--kart", `${ayar.kart}px`); kaydet(); };
  ust.append(sekmeV, sekmeH, ara, cipler, el("span", "bosluk"), boyutSec, kartBoyu);
  const izgara = el("div", "izgara");
  izgara.style.setProperty("--kart", `${ayar.kart}px`);
  kok.append(ust, izgara);

  const kaydet = () => yaz(AYAR, ayar);
  sekmeV.onclick = () => { ayar.sekme = "varlik"; kaydet(); ciz(); sekmeV.blur(); };
  sekmeH.onclick = () => { ayar.sekme = "hazir"; kaydet(); if (!hazirlar) hazirlariYenile(); ciz(); sekmeH.blur(); };

  const kullanildi = (ad: string) => { son = [ad, ...son.filter((x) => x !== ad)].slice(0, 16); yaz(SON, son); };
  const boyutUyar = (v: Varlik) => {
    const m = Math.max(...v.boyut);
    return !ayar.boyut || (ayar.boyut === "k" ? m < 2 : ayar.boyut === "o" ? m >= 2 && m <= 8 : m > 8);
  };

  const cip = (yazi: string, secili: boolean, is: () => void) => { const b = el("button", secili ? "secili" : "", yazi); b.onclick = () => { is(); b.blur(); }; return b; };

  /** Kart sürüklenip tuvale bırakılınca (tuval dinleyicileri editorArayuzu'nda). */
  const surukleBasla = (e: DragEvent, kaynak: Parameters<Editor["yerlestirmeyeBasla"]>[0], img: HTMLImageElement | null) => {
    e.dataTransfer?.setData("application/x-3dorion", kaynak.ad);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
    if (img && e.dataTransfer) e.dataTransfer.setDragImage(img, 24, 24);
    ed.yerlestirmeyeBasla(kaynak);
  };

  const varlikKarti = (v: Varlik) => {
    const k = el("div", `kart${ed.yerlestiriliyor()?.ad === v.ad ? " secili" : ""}`);
    k.title = `${v.ad}\n${v.boyut.map((x) => x.toFixed(1)).join(" × ")} m · ${v.ucgen} üçgen · ${(v.bayt / 1024).toFixed(0)} KB\nTıkla: yerleştir (art arda) · Sürükle: sahneye bırak`;
    const r = el("img"); r.src = varlik(v.onizleme); r.alt = ""; r.loading = "lazy";
    const y = el("span", `yildiz${yildizli.has(v.ad) ? " acik" : ""}`, yildizli.has(v.ad) ? "★" : "☆");
    y.title = "yıldızla";
    y.onclick = (e) => { e.stopPropagation(); if (yildizli.has(v.ad)) yildizli.delete(v.ad); else yildizli.add(v.ad); yaz(YILDIZ, [...yildizli]); ciz(); };
    k.append(r, y, el("span", "", kisaAd(v.ad)), el("i", "", `${v.boyut[0].toFixed(1)}×${v.boyut[2].toFixed(1)}×${v.boyut[1].toFixed(1)} m`));
    k.onclick = () => { kullanildi(v.ad); ed.yerlestirmeyeBasla({ tur: "varlik", ad: v.ad }); };
    k.draggable = true;
    k.ondragstart = (e) => { kullanildi(v.ad); surukleBasla(e, { tur: "varlik", ad: v.ad }, r); };
    return k;
  };

  const hazirKarti = (ad: string) => {
    const k = el("div", `kart${ed.yerlestiriliyor()?.ad === ad ? " secili" : ""}`);
    k.title = `${ad}\nTıkla: yerleştir · Sürükle: sahneye bırak`;
    k.append(el("div", "hazir-ikon", "🏗"), el("span", "", ad));
    const yukleVeBasla = async (e?: DragEvent) => {
      if (!hazir) return;
      try {
        const p = await hazir.oku(ad);
        if (e) surukleBasla(e, { tur: "parca", parca: p, ad }, null);
        else ed.yerlestirmeyeBasla({ tur: "parca", parca: p, ad });
      } catch (err) { ed.durum.bildir(`hazır yapı okunamadı: ${err instanceof Error ? err.message : String(err)}`, true); }
    };
    k.onclick = () => { void yukleVeBasla(); };
    // Sürükleme olayı eşzamanlı ister: önbellekte yoksa önce tıklayarak yüklenir.
    k.draggable = !!onbellek.get(ad);
    k.ondragstart = (e) => { const p = onbellek.get(ad); if (p) surukleBasla(e, { tur: "parca", parca: p, ad }, null); };
    if (hazir && !onbellek.has(ad)) void hazir.oku(ad).then((p) => { onbellek.set(ad, p); k.draggable = true; }).catch(() => undefined);
    return k;
  };
  const onbellek = new Map<string, Parca>();

  function hazirlariYenile() {
    if (!hazir) { hazirlar = []; return; }
    hazir.liste().then((l) => { hazirlar = l; onbellek.clear(); ciz(); }).catch(() => { hazirlar = []; ciz(); });
  }

  const ciz = () => {
    sekmeV.classList.toggle("secili", ayar.sekme === "varlik");
    sekmeH.classList.toggle("secili", ayar.sekme === "hazir");
    const varlikSekmesi = ayar.sekme === "varlik";
    boyutSec.style.display = varlikSekmesi ? "" : "none";
    if (!varlikSekmesi) {
      cipler.replaceChildren();
      if (!hazir) { izgara.replaceChildren(el("div", "bos", "Hazır yapılar yalnız geliştirme sunucusunda (npm run dev).")); return; }
      if (!hazirlar) { izgara.replaceChildren(el("div", "bos", "yükleniyor…")); return; }
      const l = hazirlar.filter((a) => !arama || a.toLocaleLowerCase("tr").includes(arama));
      izgara.replaceChildren(...(l.length ? l.map(hazirKarti) : [el("div", "bos", "Hazır yapı yok — sahnede birkaç nesne seç, sağdaki Özellikler'de “Hazır yapı olarak kaydet”.")]));
      return;
    }
    if (!katalog) { izgara.replaceChildren(el("div", "bos", hata || "katalog yükleniyor…")); return; }
    const sayilar = new Map<string, number>();
    for (const v of katalog.varliklar) sayilar.set(v.kategori, (sayilar.get(v.kategori) ?? 0) + 1);
    cipler.replaceChildren(
      cip(`tümü ${katalog.varliklar.length}`, !ayar.kategori && !ayar.suzgec, () => { ayar.kategori = ""; ayar.suzgec = ""; kaydet(); ciz(); }),
      cip(`★ ${yildizli.size}`, ayar.suzgec === "yildiz", () => { ayar.suzgec = ayar.suzgec === "yildiz" ? "" : "yildiz"; kaydet(); ciz(); }),
      cip("son", ayar.suzgec === "son", () => { ayar.suzgec = ayar.suzgec === "son" ? "" : "son"; kaydet(); ciz(); }),
      ...[...sayilar].map(([k, n]) => cip(`${KATEGORI_ADLARI[k] ?? k} ${n}`, ayar.kategori === k, () => { ayar.kategori = ayar.kategori === k ? "" : k; kaydet(); ciz(); })),
    );
    let liste = katalog.varliklar.filter((v) => (!ayar.kategori || v.kategori === ayar.kategori) && boyutUyar(v)
      && (!arama || `${v.ad} ${kisaAd(v.ad)} ${KATEGORI_ADLARI[v.kategori] ?? ""}`.toLocaleLowerCase("tr").includes(arama)));
    if (ayar.suzgec === "yildiz") liste = liste.filter((v) => yildizli.has(v.ad));
    if (ayar.suzgec === "son") liste = son.map((ad) => liste.find((v) => v.ad === ad)).filter((v): v is Varlik => !!v);
    izgara.replaceChildren(...(liste.length ? liste.map(varlikKarti) : [el("div", "bos", "eşleşen varlık yok")]));
  };

  ed.katalog().then((k) => { katalog = k; ciz(); })
    .catch((err: unknown) => { hata = `katalog yok: ${err instanceof Error ? err.message : String(err)} — assets/kaynak/sehir-kiti.py ile üret`; ciz(); });
  ed.yerlestirmeDegisince(() => {
    const ad = ed.yerlestiriliyor()?.ad;
    for (const k of izgara.querySelectorAll<HTMLElement>(".kart")) k.classList.toggle("secili", !!ad && k.querySelector("span:not(.yildiz)")?.textContent === (ayar.sekme === "varlik" ? kisaAd(ad) : ad));
  });
  if (ayar.sekme === "hazir") hazirlariYenile();
  ciz();
  return { kok, araOdakla: () => { ara.focus(); ara.select(); }, hazirlariYenile };
}
