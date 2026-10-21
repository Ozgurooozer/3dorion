// uygulama/yapi/zihinSekmesi.ts — ALT ÇUBUK · ZİHİN SEKMESİ: duvardaki beyin şeması + hafıza bulutu, 2B tuvalde (duvara bakmadan Orion'un zihnini izle). DOM katmanı.
//
// Yeni bir görünüm ÇİZİLMEZ: duvardaki `sema` panelinin kendisi (algıdan eyleme akış, düğüm detayı, hafıza bulutu, kural grafiği) bu tuvale de çizilir ve aynı
// durumu paylaşır — sekmede düğüme tıklamak duvarda da o düğümü açar, tersi de doğru. Tuval duvar dokusuyla AYNI piksel boyutundadır (`sema.olcu()`): tıklama
// bölgeleri son çizimden geldiği için iki yüzeyin yerleşimi birebir aynı olmalı; CSS yalnız ölçekler. Çizim yalnız sekme AÇIKKEN koşar (kapalıyken sıfır maliyet).
"use strict";
import type { Sekme, SekmeAraci, SekmeIcerigi } from "../../world/arayuz/altCubuk.ts";
import type { SemaPaneli } from "../../world/surfaces/duvar/sema.ts";

export type ZihinSemasi = Pick<SemaPaneli, "ciz" | "olcu" | "tikla" | "hedef" | "secili" | "sec">;

export interface ZihinSekmesiAyari {
  sema: ZihinSemasi;
  /** Her kare çizimi sürdüren zamanlayıcı (testte sahte; varsayılan requestAnimationFrame). */
  kare?: (f: () => void) => number;
  kareIptal?: (id: number) => void;
}

const CSS = `
.zh-kok { display: flex; height: 100%; min-height: 0; align-items: stretch; justify-content: center; padding: 6px; box-sizing: border-box; }
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
  const { sema } = a;
  const kare = a.kare ?? ((f) => requestAnimationFrame(f));
  const kareIptal = a.kareIptal ?? ((id) => cancelAnimationFrame(id));
  const stil = document.createElement("style");
  stil.textContent = CSS;
  document.head.append(stil);

  const kok = document.createElement("div"); kok.className = "zh-kok";
  const tuval = document.createElement("canvas"); tuval.className = "zh-tuval";
  const olcu = sema.olcu();
  tuval.width = olcu.genislik; tuval.height = olcu.yukseklik;
  const bag = tuval.getContext("2d");
  kok.append(tuval); sayfa.append(kok);
  if (!bag) {
    kok.textContent = "bu ortamda 2B tuval yok: zihin haritası duvardan izlenir";
    return {};
  }

  /** Fare konumu → doku UV'si (v yukarı doğru artar: duvar dokusuyla aynı kural, `uvdenPiksel` tersi). */
  const uv = (e: MouseEvent): { u: number; v: number } => {
    const r = tuval.getBoundingClientRect();
    return { u: (e.clientX - r.left) / r.width, v: 1 - (e.clientY - r.top) / r.height };
  };
  tuval.addEventListener("click", (e) => { const { u, v } = uv(e); sema.tikla(u, v); });
  tuval.addEventListener("mousemove", (e) => { const { u, v } = uv(e); tuval.dataset.tikla = sema.hedef(u, v) !== null ? "1" : "0"; });
  // Çubuğun kısayol/oyun tuşları tuvale basınca oyuna kaçmasın (tuval odak almaz; yine de fare tekerleği sahneyi zoomlamasın).
  tuval.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });

  let dongu: number | null = null;
  let sonSecili: string | null | undefined;
  const ciz = (): void => {
    sema.ciz(bag);
    const s = sema.secili();
    if (s !== sonSecili) { sonSecili = s; arac.ipucu(s ? `Zihin · ${s}: ayrıntıda · üst şeride tıkla: geri` : "Orion'un zihin haritası: düğüme tıkla → ayrıntı"); }
    dongu = kare(ciz);
  };
  return {
    goster() { if (dongu === null) ciz(); },
    gizle() { if (dongu !== null) { kareIptal(dongu); dongu = null; } },
  };
}
