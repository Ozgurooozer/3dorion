// uygulama/yapi/graf/tuval.ts — GÖRSEL EDİTÖRÜN TUVALİ (spec 35 dilim 2b): düğümler (DOM), bağlar (SVG), ızgara; kaydırma, imleç merkezli yakınlaştırma,
// düğüm sürükleme, Shift/kutu seçimi, pinden pine bağ çekme, bağ kaldırma. DOM katmanı — matematiği ve kuralları saf modüllerden:
// tuvalMatematigi.ts (dönüşüm), dugumGeometrisi.ts (pin yerleri, bağ eğrisi), bagKurali.ts (bırakınca kabul/ret), editorOturumu.ts (komutlar).
//
// Fare: SOL tık düğümü seçer (Shift ekler/çıkarır) ve sürükler; boşlukta sürükle KAYDIRIR, Shift+sürükle KUTU SEÇER; ORTA tuş her yerde kaydırır;
// tekerlek imlecin olduğu yere yakınlaşır; SAĞ tık boşlukta paleti açar, bağda bağı kaldırır. Pinden sürüklerken uyumsuz pinler sönükleşir, uyumlular
// parlar (görsel ipucu tür uyumundan; kabul kararı bırakınca bagKurali'nin TAM kuralıyla: tek-bağ, döngü). Boşluğa bırakılan bağ paleti açar.
// Sürükleme bırakılınca konum ızgaraya yaslanır (Alt basılıysa serbest). Taşıma TEK geri al adımıdır (bırakınca yazılır, her harekette değil).
"use strict";
import type { GrafBagi, PinTipi } from "../../../protocol/graf.ts";
import { uyumlu } from "../../graf/grafTurDenetimi.ts";
import { DESEN_CAGIR_TIPI } from "../../graf/grafTurDenetimi.ts";
import { IZGARA, dunyadanEkrana, ekrandanDunyaya, izgarayaYasla, kaydir, koselerdenKutu, kutularKesisir, sigdir as sigdirGorunumu, tekerlekCarpani, yakinlastir, type Nokta } from "../../graf/editor/tuvalMatematigi.ts";
import { bagUcu, bagYolu, dugumKutusu, pinBul, type DugumKutusu } from "../../graf/editor/dugumGeometrisi.ts";
import { bagKaldirKomutu, bagKomutu, tasiKomutu } from "../../graf/editor/editorOturumu.ts";
import { bagTipi, type PinRef } from "../../graf/editor/bagKurali.ts";
import { PIN_RENGI } from "../../graf/editor/renkler.ts";
import type { EditorBaglami } from "./editorBaglami.ts";
import { dugumOgesi } from "./dugumOgesi.ts";
import { el } from "./dom.ts";

export interface Tuval {
  readonly kok: HTMLElement;
  ciz(): void;
  /** Son imleç yeri (dünya): yapıştırma oraya. */
  imlecDunya(): Nokta;
  ortaDunya(): Nokta;
  sigdir(): void;
  dugumeOdaklan(id: string): void;
  /** Süren sürükleme varsa iptal (Esc). İptal edildi mi. */
  iptal(): boolean;
}

type Surukleme =
  | { tur: "kaydir"; x0: number; y0: number; gx: number; gy: number; oynadi: boolean; shift: boolean }
  | { tur: "tasi"; ids: Set<string>; d0: Nokta; dx: number; dy: number; oynadi: boolean; tik: string }
  | { tur: "kutu"; a: Nokta; b: Nokta; ekle: boolean }
  | { tur: "bag"; kaynak: PinRef & { tip: PinTipi }; uc: Nokta };

const SVG = "http://www.w3.org/2000/svg";
const CIFT_TIK_MS = 350;

export function tuvalKur(b: EditorBaglami, bosTiklama: () => void): Tuval {
  const kok = el("div", "ge-tuval"); kok.tabIndex = -1;
  const dunya = el("div", "ge-dunya");
  const svg = document.createElementNS(SVG, "svg"); svg.classList.add("ge-baglar");
  const dugumKatmani = el("div");
  dunya.append(svg, dugumKatmani);
  const kutuOgesi = el("div", "ge-secim-kutusu");
  const bos = el("div", "ge-bos");
  kok.append(dunya, kutuOgesi, bos);

  let kutular: DugumKutusu[] = [];
  let surukleme: Surukleme | null = null;
  let imlec: Nokta = { x: 0, y: 0 };
  let sonTik = { id: "", an: 0 };
  const ogeler = new Map<string, HTMLElement>();

  const yerel = (e: { clientX: number; clientY: number }): Nokta => { const r = kok.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const oturum = () => b.oturum();

  function gorunumuUygula(): void {
    const o = oturum();
    if (!o) return;
    const g = o.gorunum;
    dunya.style.transform = `translate(${g.x}px, ${g.y}px) scale(${g.olcek})`;
    kok.style.backgroundSize = `${IZGARA * g.olcek}px ${IZGARA * g.olcek}px`;
    kok.style.backgroundPosition = `${g.x}px ${g.y}px`;
  }

  /** Bağları çiz; `ofset` sürüklenen düğümleri geçici olarak kaydırır (bırakılana dek grafik değişmez). */
  function baglariCiz(ofset: { ids: ReadonlySet<string>; dx: number; dy: number } | null = null): void {
    const o = oturum();
    svg.replaceChildren();
    if (!o) return;
    const g = o.graf(), cozum = o.cozum();
    const harita = new Map(kutular.map((k) => [k.id, ofset?.ids.has(k.id) ? kaydirilmis(k, ofset.dx, ofset.dy) : k]));
    const bozukBag = new Set(o.hatalar.filter((h) => h.bag !== null).map((h) => h.bag));
    for (const [i, bag] of g.baglar.entries()) {
      const k = harita.get(bag.kaynak[0]), h = harita.get(bag.hedef[0]);
      if (!k || !h) continue;
      const a = bagUcu(k, bag.kaynak[1], "cikis"), z = bagUcu(h, bag.hedef[1], "giris");
      const tip = bagTipi(cozum, bag);
      const yol = bagYolu(a.nokta, z.nokta);
      const vurus = document.createElementNS(SVG, "path");
      vurus.setAttribute("d", yol); vurus.classList.add("ge-bag-vurus"); vurus.dataset.i = String(i);
      const t = document.createElementNS(SVG, "title"); t.textContent = `${bag.kaynak.join(".")} → ${bag.hedef.join(".")} — tık / sağ tık: kaldır`; vurus.append(t);
      const cizgi = document.createElementNS(SVG, "path");
      cizgi.setAttribute("d", yol); cizgi.classList.add("ge-bag");
      cizgi.style.stroke = tip ? PIN_RENGI[tip] : "#ff8c84";
      cizgi.dataset.akis = tip === "akis" ? "1" : "0";
      cizgi.dataset.bozuk = !a.bulundu || !z.bulundu || !tip || bozukBag.has(i) ? "1" : "0";
      svg.append(vurus, cizgi);
    }
    if (surukleme?.tur === "bag") {
      const k = harita.get(surukleme.kaynak.dugum);
      if (k) {
        const p = bagUcu(k, surukleme.kaynak.pin, surukleme.kaynak.yon).nokta;
        const gecici = document.createElementNS(SVG, "path");
        gecici.setAttribute("d", surukleme.kaynak.yon === "cikis" ? bagYolu(p, surukleme.uc) : bagYolu(surukleme.uc, p));
        gecici.classList.add("ge-bag-gecici");
        svg.append(gecici);
      }
    }
  }

  const kaydirilmis = (k: DugumKutusu, dx: number, dy: number): DugumKutusu => ({
    ...k, x: k.x + dx, y: k.y + dy,
    girisler: k.girisler.map((p) => ({ ...p, nokta: { x: p.nokta.x + dx, y: p.nokta.y + dy } })),
    cikislar: k.cikislar.map((p) => ({ ...p, nokta: { x: p.nokta.x + dx, y: p.nokta.y + dy } })),
  });

  function isaretleriGuncelle(): void {
    const o = oturum();
    for (const [id, e] of ogeler) e.dataset.secili = o?.secim.has(id) ? "1" : "0";
  }

  function ciz(): void {
    const o = oturum();
    ogeler.clear();
    if (!o) { dugumKatmani.replaceChildren(); svg.replaceChildren(); kutular = []; bos.textContent = "Açık grafik yok. Graf sekmesinde bir grafiğe çift tıkla ya da 'Aç'."; bos.style.display = ""; return; }
    gorunumuUygula();
    const g = o.graf(), cozum = o.cozum(), calisma = b.calisma();
    kutular = g.dugumler.map((d) => { const c = cozum.get(d.id); return dugumKutusu(d, c?.pinler ?? null, c?.tanim.saf ?? false); });
    const hatalar = new Map<string, string[]>();
    for (const h of o.hatalar) if (h.dugum) (hatalar.get(h.dugum) ?? hatalar.set(h.dugum, []).get(h.dugum)!).push(h.mesaj);
    const bagliGiris = new Map<string, Set<string>>(), bagliCikis = new Map<string, Set<string>>();
    const ekle = (m: Map<string, Set<string>>, id: string, pin: string) => (m.get(id) ?? m.set(id, new Set()).get(id)!).add(pin);
    for (const x of g.baglar) { ekle(bagliCikis, x.kaynak[0], x.kaynak[1]); ekle(bagliGiris, x.hedef[0], x.hedef[1]); }
    const bosKume: ReadonlySet<string> = new Set();
    dugumKatmani.replaceChildren(...g.dugumler.map((d, i) => {
      const e = dugumOgesi(b, d, kutular[i]!, cozum.get(d.id), {
        secili: o.secim.has(d.id), suan: calisma?.suan === d.id, calismaHatasi: calisma?.hataDugumu === d.id ? calisma.hataMesaji : null,
        hatalar: hatalar.get(d.id) ?? [], bagliGirisler: bagliGiris.get(d.id) ?? bosKume, bagliCikislar: bagliCikis.get(d.id) ?? bosKume,
      });
      ogeler.set(d.id, e);
      return e;
    }));
    baglariCiz();
    bos.style.display = g.dugumler.length ? "none" : "";
    bos.textContent = "Boş grafik. Sağ tıkla ya da Boşluk'a bas: düğüm ekle. Soldaki listelerden de eklenir.";
  }

  function bagBaslat(p: HTMLElement): void {
    const d = p.dataset;
    const kaynak = { dugum: d["dugum"]!, pin: d["pin"]!, yon: d["yon"] as PinRef["yon"], tip: d["tip"] as PinTipi };
    surukleme = { tur: "bag", kaynak, uc: ekrandanDunyaya(oturum()!.gorunum, imlec) };
    kok.dataset.baglaniyor = "1";
    // Görsel ipucu: yönü ters ve türü uyumlu pinler parlak, ötekiler sönük. Kabul kararı bırakınca TAM kuralla (bagKurali: tek-bağ, döngü).
    for (const x of kok.querySelectorAll<HTMLElement>(".ge-pin")) {
      const yon = x.dataset["yon"], tip = x.dataset["tip"] as PinTipi;
      const uygun = x.dataset["dugum"] !== kaynak.dugum && yon !== kaynak.yon && (kaynak.yon === "cikis" ? uyumlu(kaynak.tip, tip) : uyumlu(tip, kaynak.tip));
      x.dataset.uygun = uygun ? "1" : "0";
    }
  }

  function surukleBitir(): void {
    surukleme = null;
    delete kok.dataset.baglaniyor;
    delete kok.dataset.kaydiriyor;
    kutuOgesi.style.display = "none";
  }

  kok.addEventListener("pointerdown", (e) => {
    const h = e.target as HTMLElement;
    imlec = yerel(e);
    if (h.closest(".ge-palet, .ge-yardim")) return;
    bosTiklama();
    if (h.closest("input, select, textarea, button")) return;
    const o = oturum();
    if (!o) return;
    (kok.closest(".ge-kok") as HTMLElement | null)?.focus({ preventScroll: true });
    e.preventDefault();
    if (e.button === 1) { surukleme = { tur: "kaydir", x0: imlec.x, y0: imlec.y, gx: o.gorunum.x, gy: o.gorunum.y, oynadi: false, shift: true }; kok.dataset.kaydiriyor = "1"; kok.setPointerCapture(e.pointerId); return; }
    if (e.button !== 0) return;
    const pinOgesi = h.closest<HTMLElement>(".ge-pin");
    if (pinOgesi) { bagBaslat(pinOgesi); kok.setPointerCapture(e.pointerId); return; }
    const bagOgesi = h.closest<SVGElement>(".ge-bag-vurus");
    if (bagOgesi) { bagSil(Number(bagOgesi.dataset["i"])); return; }
    const dugum = h.closest<HTMLElement>(".ge-dugum");
    if (dugum) {
      const id = dugum.dataset["id"]!;
      if (e.shiftKey) { if (o.secim.has(id)) o.secim.delete(id); else o.secim.add(id); }
      else if (!o.secim.has(id)) o.secim = new Set([id]);
      isaretleriGuncelle();
      b.tazele();
      if (o.secim.has(id)) surukleme = { tur: "tasi", ids: new Set(o.secim), d0: ekrandanDunyaya(o.gorunum, imlec), dx: 0, dy: 0, oynadi: false, tik: id };
      kok.setPointerCapture(e.pointerId);
      return;
    }
    if (e.shiftKey) surukleme = { tur: "kutu", a: imlec, b: imlec, ekle: true };
    else { surukleme = { tur: "kaydir", x0: imlec.x, y0: imlec.y, gx: o.gorunum.x, gy: o.gorunum.y, oynadi: false, shift: false }; kok.dataset.kaydiriyor = "1"; }
    kok.setPointerCapture(e.pointerId);
  });

  kok.addEventListener("pointermove", (e) => {
    imlec = yerel(e);
    const o = oturum(), s = surukleme;
    if (!o || !s) return;
    if (s.tur === "kaydir") {
      if (Math.hypot(imlec.x - s.x0, imlec.y - s.y0) > 3) s.oynadi = true;
      o.gorunum = { ...o.gorunum, x: s.gx + imlec.x - s.x0, y: s.gy + imlec.y - s.y0 };
      gorunumuUygula();
    } else if (s.tur === "tasi") {
      const p = ekrandanDunyaya(o.gorunum, imlec);
      s.dx = p.x - s.d0.x; s.dy = p.y - s.d0.y;
      if (Math.hypot(s.dx, s.dy) * o.gorunum.olcek > 3) s.oynadi = true;
      if (!s.oynadi) return;
      for (const k of kutular) if (s.ids.has(k.id)) { const x = ogeler.get(k.id); if (x) { x.style.left = `${k.x + s.dx}px`; x.style.top = `${k.y + s.dy}px`; } }
      baglariCiz({ ids: s.ids, dx: s.dx, dy: s.dy });
    } else if (s.tur === "kutu") {
      s.b = imlec;
      const k = koselerdenKutu(s.a, s.b);
      Object.assign(kutuOgesi.style, { display: "block", left: `${k.x}px`, top: `${k.y}px`, width: `${k.g}px`, height: `${k.h}px` });
    } else {
      s.uc = ekrandanDunyaya(o.gorunum, imlec);
      baglariCiz();
    }
  });

  const birak = (e: PointerEvent) => {
    const o = oturum(), s = surukleme;
    if (kok.hasPointerCapture?.(e.pointerId)) kok.releasePointerCapture(e.pointerId);
    if (!o || !s) { surukleBitir(); return; }
    surukleBitir();
    if (s.tur === "kaydir") {
      if (!s.oynadi && !s.shift && o.secim.size) { o.secim.clear(); b.tazele(); }
      return;
    }
    if (s.tur === "tasi") {
      if (!s.oynadi) {
        // Çift tık: Desen düğümü deseni yeni sekmede açar (DOM yeniden çizildiği için tarayıcının dblclick'ine güvenilmez).
        const an = performance.now();
        if (sonTik.id === s.tik && an - sonTik.an < CIFT_TIK_MS) {
          const d = o.graf().dugumler.find((x) => x.id === s.tik);
          const ad = d?.tip === DESEN_CAGIR_TIPI ? d.ayar?.["desen"] : null;
          if (typeof ad === "string" && ad) b.desenAc(ad);
          sonTik = { id: "", an: 0 };
        } else sonTik = { id: s.tik, an };
        if (!e.shiftKey && o.secim.size > 1) { o.secim = new Set([s.tik]); b.tazele(); }
        return;
      }
      // Izgaraya yasla: sürüklenen (tıklanan) düğümün yeni yeri ızgaraya otursun, ötekiler aynı kaydırmayla (dizilişleri bozulmasın).
      const ana = o.graf().dugumler.find((x) => x.id === s.tik);
      const ax = ana?.konum?.[0] ?? 0, ay = ana?.konum?.[1] ?? 0;
      const dx = e.altKey ? Math.round(s.dx) : izgarayaYasla(ax + s.dx) - ax, dy = e.altKey ? Math.round(s.dy) : izgarayaYasla(ay + s.dy) - ay;
      b.sonuc(tasiKomutu(o, s.ids, dx, dy));
      return;
    }
    if (s.tur === "kutu") {
      const a = ekrandanDunyaya(o.gorunum, s.a), z = ekrandanDunyaya(o.gorunum, s.b);
      const secim = koselerdenKutu(a, z);
      for (const k of kutular) if (kutularKesisir(secim, k)) o.secim.add(k.id);
      b.tazele();
      return;
    }
    // Bağ bırakıldı: pinin üstündeyse dene (TAM kural), boşluktaysa yalnız uyanları gösteren palet.
    const p = ekrandanDunyaya(o.gorunum, yerel(e));
    const hedef = pinBul(kutular, p);
    if (hedef) { b.sonuc(bagKomutu(o, s.kaynak, { dugum: hedef.dugum, pin: hedef.ad, yon: hedef.yon })); return; }
    baglariCiz();
    b.paletAc(yerel(e), p, s.kaynak);
  };
  kok.addEventListener("pointerup", birak);
  kok.addEventListener("pointercancel", (e) => { if (kok.hasPointerCapture?.(e.pointerId)) kok.releasePointerCapture(e.pointerId); surukleBitir(); ciz(); });

  function bagSil(i: number): void {
    const o = oturum();
    const bag: GrafBagi | undefined = o?.graf().baglar[i];
    if (o && bag) b.sonuc(bagKaldirKomutu(o, bag));
  }

  kok.addEventListener("wheel", (e) => {
    const h = e.target as HTMLElement;
    if (h.closest(".ge-palet, .ge-yardim")) return;
    const o = oturum();
    if (!o) return;
    e.preventDefault();
    o.gorunum = yakinlastir(o.gorunum, yerel(e), tekerlekCarpani(e.deltaY));
    gorunumuUygula();
  }, { passive: false });

  kok.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const h = e.target as HTMLElement;
    if (h.closest(".ge-palet, .ge-yardim, input, select, textarea")) return;
    const o = oturum();
    if (!o) return;
    const bagOgesi = h.closest<SVGElement>(".ge-bag-vurus");
    if (bagOgesi) { bagSil(Number(bagOgesi.dataset["i"])); return; }
    const dugum = h.closest<HTMLElement>(".ge-dugum");
    if (dugum) { o.secim = new Set([dugum.dataset["id"]!]); b.tazele(); return; }
    const p = yerel(e);
    b.paletAc(p, ekrandanDunyaya(o.gorunum, p));
  });

  const ekranBoyu = () => ({ g: kok.clientWidth, h: kok.clientHeight });
  return {
    kok,
    ciz,
    imlecDunya: () => { const o = oturum(); return o ? ekrandanDunyaya(o.gorunum, imlec) : imlec; },
    ortaDunya: () => { const o = oturum(); const e = ekranBoyu(); return o ? ekrandanDunyaya(o.gorunum, { x: e.g / 2, y: e.h / 2 }) : { x: 0, y: 0 }; },
    sigdir() {
      const o = oturum();
      if (!o) return;
      const secili = kutular.filter((k) => o.secim.has(k.id));
      o.gorunum = sigdirGorunumu(secili.length ? secili : kutular, ekranBoyu());
      gorunumuUygula();
    },
    dugumeOdaklan(id) {
      const o = oturum();
      const k = kutular.find((x) => x.id === id);
      if (!o || !k) return;
      const e = ekranBoyu();
      const merkez = dunyadanEkrana(o.gorunum, { x: k.x + k.g / 2, y: k.y + k.h / 2 });
      o.gorunum = kaydir(o.gorunum, e.g / 2 - merkez.x, e.h / 2 - merkez.y);
      o.secim = new Set([id]);
      b.tazele();
    },
    iptal() { if (!surukleme) return false; surukleBitir(); ciz(); return true; },
  };
}

