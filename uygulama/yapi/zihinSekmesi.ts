// uygulama/yapi/zihinSekmesi.ts — ALT ÇUBUK · ZİHİN SEKMESİ: duvardaki beyin şeması + hafıza bulutu, 2B tuvalde (duvara bakmadan Orion'un zihnini izle). DOM katmanı.
//
// Yeni bir görünüm ÇİZİLMEZ: duvardaki `sema` panelinin kendisi (algıdan eyleme akış, düğüm detayı, hafıza bulutu, kural grafiği) bu tuvale de çizilir ve aynı
// durumu paylaşır — sekmede düğüme tıklamak duvarda da o düğümü açar, tersi de doğru. Tuval duvar dokusuyla AYNI piksel boyutundadır (`sema.olcu()`): tıklama
// bölgeleri son çizimden geldiği için iki yüzeyin yerleşimi birebir aynı olmalı; CSS yalnız ölçekler. Çizim yalnız sekme AÇIKKEN koşar (kapalıyken sıfır maliyet).
//
// AJAN ÇİPLERİ (spec 33): birden çok ajanın (Orion | Flash | …) zihin haritası TEK sekmede, üstteki çiplerle seçilir (300 ajanda sekme
// şeridi taşardı). Seçim modeli saf ve ortak (`uygulama/ajanlar/cipModeli.ts`, sohbet hedefiyle aynı); burada yalnız çizim. Orion'un
// sayfası duvardaki şemanın kendisidir (yukarıdaki kural); Flash'ın duvarı yok, sayfası mesh'siz şemadır (`semaTuvali.ts`, tıklanmaz).
"use strict";
import type { Sekme, SekmeAraci, SekmeIcerigi } from "../../world/arayuz/altCubuk.ts";
import type { SemaPaneli } from "../../world/surfaces/duvar/sema.ts";
import { CipSecimi } from "../ajanlar/cipModeli.ts";
import { ORION_AJANI } from "../ajanlar/ajanKaydi.ts";

export type ZihinSemasi = Pick<SemaPaneli, "ciz" | "olcu" | "tikla" | "hedef" | "secili" | "sec">;

/** Bir ajanın zihin sayfası. */
export interface ZihinSayfasi {
  readonly id: string;
  readonly ad: string;
  readonly renk: string;
  readonly sema: ZihinSemasi;
}

export interface ZihinSekmesiAyari {
  /** Tek sayfa (Orion): `sayfalar` verilmezse yalnız bu çizilir — eski davranış. */
  sema: ZihinSemasi;
  /** Ajan sayfaları (spec 33), ilk Orion'unki; çağrı ANINDA okunur (Flash sonradan gelir). Birden çok sayfa varsa çipler görünür. */
  sayfalar?: () => readonly ZihinSayfasi[];
  /** Sayfa listesi değişince haber ver (çipler yeniden çizilsin). Çıkış fonksiyonu döner. */
  sayfaDegisti?: (cb: () => void) => () => void;
  /** Her kare çizimi sürdüren zamanlayıcı (testte sahte; varsayılan requestAnimationFrame). */
  kare?: (f: () => void) => number;
  kareIptal?: (id: number) => void;
}

const CSS = `
.zh-kok { display: flex; flex-direction: column; height: 100%; min-height: 0; align-items: stretch; padding: 6px; box-sizing: border-box; gap: 6px; }
.zh-cipler { display: flex; gap: 6px; flex: none; overflow-x: auto; }
.zh-cipler:empty { display: none; }
.zh-cip { font: 600 12px "Segoe UI", system-ui, sans-serif; color: #c9cbd6; background: #10131d; border: 1px solid #2a3246; border-radius: 12px;
  padding: 3px 10px 3px 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.zh-cip i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.zh-cip[data-secili="1"] { color: #fff; border-color: var(--cip, #4d5fa8); background: #182033; }
.zh-alan { flex: 1; min-height: 0; display: flex; justify-content: center; }
.zh-tuval { height: 100%; width: auto; max-width: 100%; object-fit: contain; border: 1px solid #2a3246; border-radius: 6px; background: #07080e; }
.zh-tuval[data-tikla="1"] { cursor: pointer; }
`;

export function zihinSekmesi(a: ZihinSekmesiAyari): Sekme {
  return {
    id: "zihin", ad: "Zihin", simge: "🧠", sira: 40,
    ipucu: "Orion'un zihin haritası: düğüme tıkla → ayrıntı · üst şerit: geri",
    kur(sayfa, arac): SekmeIcerigi { return kur(sayfa, arac, a); },
  };
}

function kur(sayfa: HTMLElement, arac: SekmeAraci, a: ZihinSekmesiAyari): SekmeIcerigi {
  const kare = a.kare ?? ((f) => requestAnimationFrame(f));
  const kareIptal = a.kareIptal ?? ((id) => cancelAnimationFrame(id));
  const stil = document.createElement("style");
  stil.textContent = CSS;
  document.head.append(stil);

  // Sayfalar: verilmediyse tek sayfa (Orion). Seçim modeli sohbet hedefiyle ortak (saf, testli).
  const sayfalar = (): readonly ZihinSayfasi[] => a.sayfalar?.() ?? [{ ...ORION_AJANI, sema: a.sema }];
  const secim = new CipSecimi(() => sayfalar().map((s) => ({ id: s.id, etiket: s.ad, renk: s.renk })));
  const etkinSayfa = (): ZihinSayfasi => sayfalar().find((s) => s.id === secim.etkin()) ?? sayfalar()[0]!;

  const kok = document.createElement("div"); kok.className = "zh-kok";
  const cipler = document.createElement("div"); cipler.className = "zh-cipler";
  const alan = document.createElement("div"); alan.className = "zh-alan";
  const tuval = document.createElement("canvas"); tuval.className = "zh-tuval";
  alan.append(tuval); kok.append(cipler, alan); sayfa.append(kok);
  const bag = tuval.getContext("2d");
  if (!bag) {
    kok.textContent = "bu ortamda 2B tuval yok: zihin haritası duvardan izlenir";
    return {};
  }

  /** Tuval etkin şemanın piksel boyutunda (tıklama bölgeleri son çizimden gelir; yerleşim birebir aynı olmalı). */
  const boyutla = (): void => {
    const o = etkinSayfa().sema.olcu();
    if (tuval.width !== o.genislik) tuval.width = o.genislik;
    if (tuval.height !== o.yukseklik) tuval.height = o.yukseklik;
  };
  /** Çip şeridi: tek sayfada boş (gizli) — eski görünüm. */
  const ciplerCiz = (): void => {
    const l = secim.secenekler();
    cipler.replaceChildren();
    if (l.length < 2) return;
    for (const c of l) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "zh-cip"; b.dataset.secili = c.id === secim.etkin() ? "1" : "0";
      b.style.setProperty("--cip", c.renk);
      const nokta = document.createElement("i"); nokta.style.background = c.renk;
      b.append(nokta, c.etiket);
      b.addEventListener("click", () => { secim.sec(c.id); });
      cipler.append(b);
    }
  };
  let dongu: number | null = null;
  let sonIpucu = "";
  secim.dinle(() => { ciplerCiz(); boyutla(); sonIpucu = ""; });
  a.sayfaDegisti?.(() => secim.secenekDegisti());
  ciplerCiz(); boyutla();

  /** Fare konumu → doku UV'si (v yukarı doğru artar: duvar dokusuyla aynı kural, `uvdenPiksel` tersi). */
  const uv = (e: MouseEvent): { u: number; v: number } => {
    const r = tuval.getBoundingClientRect();
    return { u: (e.clientX - r.left) / r.width, v: 1 - (e.clientY - r.top) / r.height };
  };
  tuval.addEventListener("click", (e) => { const { u, v } = uv(e); etkinSayfa().sema.tikla(u, v); });
  tuval.addEventListener("mousemove", (e) => { const { u, v } = uv(e); tuval.dataset.tikla = etkinSayfa().sema.hedef(u, v) !== null ? "1" : "0"; });
  // Çubuğun kısayol/oyun tuşları tuvale basınca oyuna kaçmasın (tuval odak almaz; yine de fare tekerleği sahneyi zoomlamasın).
  tuval.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });

  const ciz = (): void => {
    const p = etkinSayfa();
    p.sema.ciz(bag);
    const s = p.sema.secili();
    // Orion'un sayfası tıklanır (duvarla aynı detay); duvarsız ajanın sayfası salt izlenir (semaTuvali: detay yok).
    const ipucu = s ? `Zihin · ${s}: ayrıntıda · üst şeride tıkla: geri`
      : p.id === ORION_AJANI.id ? "Orion'un zihin haritası: düğüme tıkla → ayrıntı"
      : `Zihin haritası · ${p.ad} (salt izlenir; LLM düğümü yok)`;
    if (ipucu !== sonIpucu) { sonIpucu = ipucu; arac.ipucu(ipucu); }
    dongu = kare(ciz);
  };
  return {
    goster() { if (dongu === null) ciz(); },
    gizle() { if (dongu !== null) { kareIptal(dongu); dongu = null; } },
  };
}
