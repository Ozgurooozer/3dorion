// uygulama/yapi/diyalogKutusu.ts — SEÇİMLİ DİYALOG KUTUSU (spec 35 dilim 2): altyazının hemen üstünde, ajan renginde başlık, metin ve 2–4 numaralı seçenek.
// DOM katmanı; mantık `uygulama/graf/diyalogDenetimi.ts`te (saf, testli). Bu dosya yalnız çizer ve Ozyn'in seçimini denetimciye verir.
//
// SEÇİM YALNIZ OZYN'İN ELİ: tıklama ya da 1–4 tuşu `isTrusted` değilse (betikten `.click()`, `dispatchEvent`) yok sayılır.
// 1–4 TUŞU OYUNA SIZMAZ: diyalog açıkken bu tuşlar diyaloğundur. Pencereye YAKALAMA evresinde (capture) dinlenir ve tuş yutulur
// (`stopImmediatePropagation`): hızlı deneme tuşları (uygulama/dunyaKancasi.ts: "1" → Orion tahtaya yürür) ve alt çubuğun 1–9 sekme kısayolları onu
// görmez. Ama tuş SERBEST değilse (sohbet kutusu açık, terminal odakta, onay bekliyor, hedef bir yazı alanı) diyalog tuşa DOKUNMAZ: orada "1" harftir
// (`tusSerbest` deseni, dunyaKancasi.ts). İmleç kilitliyken (oyun kipi) fare kutuya ulaşamaz; tuşlar yine çalışır (ipucu satırı söyler).
"use strict";
import { DIYALOG_SECENEK_AZAMI, type DiyalogDenetimi, type DiyalogGorunumu } from "../graf/diyalogDenetimi.ts";
import { yaziHedefiMi } from "../dunyaKancasi.ts";

/**
 * Tuşun diyalogdaki anlamı: `{ sec: i }` (0'dan) seçer, `{ sec: null }` yalnız yutar (diyalog açık, tuş 1–4 ama o numarada seçenek yok: 3 seçenekte "4"
 * yine oyuna gitmesin), null diyaloğun değil. Saf (DOM'suz testte de çalışır).
 */
export function diyalogTusu(
  e: { key: string; code?: string; target: EventTarget | null; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; isComposing?: boolean; repeat?: boolean },
  d: { acik: boolean; secenekSayisi: number; tusSerbest: boolean },
): { sec: number | null } | null {
  if (!d.acik || !d.tusSerbest || yaziHedefiMi(e.target) || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return null;
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code ?? "");
  const n = /^[1-9]$/.test(e.key) ? Number(e.key) : m ? Number(m[1]) : NaN;
  if (!(n >= 1 && n <= DIYALOG_SECENEK_AZAMI)) return null;
  // Basılı tutulan tuşun tekrarı seçim yapmaz ama yine yutulur (tekrar, kapandıktan sonra oyuna "1" sızdırmasın).
  if (e.repeat) return { sec: null };
  return { sec: n <= d.secenekSayisi ? n - 1 : null };
}

const CSS = `
#diyalogKutusu { position: fixed; left: 50%; bottom: calc(7% + var(--alt-cubuk, 0px) + 58px); transform: translateX(-50%); z-index: 32;
  min-width: 300px; max-width: 62ch; padding: 10px 14px 12px; border-radius: 8px; background: rgba(7,7,13,.9); border: 1px solid #2a3246;
  color: #e6e9f5; font: 15px/1.45 "Segoe UI", system-ui, sans-serif; display: none; flex-direction: column; gap: 8px; user-select: none; }
#diyalogKutusu[data-acik="1"] { display: flex; }
#diyalogKutusu .dk-baslik { font-weight: 700; font-size: 13px; letter-spacing: .02em; display: flex; justify-content: space-between; gap: 12px; }
#diyalogKutusu .dk-sure { color: #6b7794; font-weight: 400; }
#diyalogKutusu .dk-metin { white-space: pre-line; }
#diyalogKutusu .dk-secenekler { display: flex; flex-direction: column; gap: 4px; }
#diyalogKutusu button { text-align: left; background: #121726; color: #d7dcea; border: 1px solid #2a3246; border-radius: 6px; padding: 5px 10px; font: inherit; cursor: pointer; }
#diyalogKutusu button:hover { border-color: #58c1ff; }
#diyalogKutusu .dk-no { color: #8fa0c8; margin-right: 8px; font-family: 'Cascadia Mono', Consolas, monospace; }
#diyalogKutusu .dk-ipucu { color: #6b7794; font-size: 11px; }
`;

export interface DiyalogKutusuAyari {
  denetim: DiyalogDenetimi;
  /** 1–4 tuşu diyaloğun mu (sohbet kapalı, terminal odakta değil, onay beklemiyor)? */
  tusSerbest: () => boolean;
}

export function diyalogKutusuKur(a: DiyalogKutusuAyari): void {
  const stil = document.createElement("style");
  stil.textContent = CSS;
  document.head.append(stil);
  const kok = document.createElement("div");
  kok.id = "diyalogKutusu";
  kok.dataset.acik = "0";
  const baslik = document.createElement("div"); baslik.className = "dk-baslik";
  const ad = document.createElement("span");
  const sure = document.createElement("span"); sure.className = "dk-sure";
  baslik.append(ad, sure);
  const metin = document.createElement("div"); metin.className = "dk-metin";
  const secenekler = document.createElement("div"); secenekler.className = "dk-secenekler";
  const ipucu = document.createElement("div"); ipucu.className = "dk-ipucu";
  kok.append(baslik, metin, secenekler, ipucu);
  document.body.append(kok);

  let saat: ReturnType<typeof setInterval> | null = null;
  let gorunum: DiyalogGorunumu | null = null;
  const sureCiz = () => { if (gorunum) sure.textContent = `${Math.max(0, Math.ceil((gorunum.bitis - Date.now()) / 1000))} sn`; };

  function ciz(g: DiyalogGorunumu | null): void {
    gorunum = g;
    if (saat) { clearInterval(saat); saat = null; }
    if (!g) { kok.dataset.acik = "0"; secenekler.replaceChildren(); return; }
    ad.textContent = g.ajan.ad;
    ad.style.color = g.renk ?? "#ffcf8a";
    kok.style.borderColor = g.renk ?? "";
    metin.textContent = g.metin;
    secenekler.replaceChildren(...g.secenekler.map((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      const no = document.createElement("span"); no.className = "dk-no"; no.textContent = `${i + 1}.`;
      b.append(no, document.createTextNode(s));
      // YALNIZ GERÇEK TIKLAMA: betik NPC'nin sorusunu Ozyn adına cevaplayamaz.
      b.addEventListener("click", (e) => { b.blur(); if (!e.isTrusted) return; a.denetim.sec(i); });
      return b;
    }));
    ipucu.textContent = `1–${g.secenekler.length} tuşu ya da tıkla (fare için Tab: imleç)`;
    kok.dataset.acik = "1";
    sureCiz();
    saat = setInterval(sureCiz, 250);
  }
  a.denetim.dinle(ciz);

  addEventListener("keydown", (e) => {
    const g = a.denetim.acik();
    // Diyalog kapalıyken `tusSerbest`e hiç sorulmaz: her tuşta boşuna çalışmasın (ve kompozisyon kökü henüz kurulurken çağrılmasın).
    if (!g) return;
    const r = diyalogTusu(e, { acik: true, secenekSayisi: g.secenekler.length, tusSerbest: a.tusSerbest() });
    if (!r) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (r.sec !== null && e.isTrusted) a.denetim.sec(r.sec);
  }, { capture: true });
}
