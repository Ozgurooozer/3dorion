// uygulama/yapi/ortak/dokBoyutu.ts — YENİDEN BOYUTLANIR DOK (spec 38 §6): editörün üst kenarındaki tutamak, yükseklik sınırlı ve hatırlanır; 3B sahne dokun ÜSTÜNDE kalır.
//
// SAHNE DOKUN ALTINDA KALMASIN: dok açıkken yüksekliği `--editor-alt` CSS değişkenine yazılır; `index.html` tuvalin yüksekliğini bundan düşürür ve tuvalin
// ResizeObserver'ı motoru yeniden boyutlandırır (giris.ts). Karakter dokun arkasında kesilmez; ▶'de bedeni görürsün. Kapanınca değişken kalkar.
// Sınırlar: en az 220 px, en çok pencerenin %75'i (sahnede en az çeyrek kalır). Yükseklik ekran boyutuna göre sınırlanır, kayıt piksel değil ORAN tutar.
"use strict";
import { el } from "./dom.ts";

const EN_AZ = 220, EN_COK_ORAN = 0.75, VARSAYILAN_ORAN = 0.46;

export interface DokBoyutu {
  /** Tutamak öğesi: dokun hemen üstüne (kök içinde ilk çocuk) konur. */
  tutamak: HTMLElement;
  /** Dok açıldı/kapandı: değişkeni yazar/kaldırır. */
  goster(acik: boolean): void;
  yukseklik(): number;
}

export function dokBoyutuKur(kok: HTMLElement, anahtar: string): DokBoyutu {
  const tutamak = el("div", "kb-boyut");
  tutamak.title = "Sürükle: editörün yüksekliğini değiştir";
  let oran = (() => { try { const v = Number(localStorage.getItem(anahtar)); return v > 0.1 && v <= EN_COK_ORAN ? v : VARSAYILAN_ORAN; } catch { return VARSAYILAN_ORAN; } })();
  let acik = false;
  const sinirla = (px: number): number => Math.max(EN_AZ, Math.min(innerHeight * EN_COK_ORAN, px));
  const yuk = (): number => Math.round(sinirla(innerHeight * oran));
  function yay(): void {
    kok.style.height = `${yuk()}px`;
    if (acik) document.documentElement.style.setProperty("--editor-alt", `${yuk()}px`);
  }
  tutamak.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); tutamak.dataset.surukle = "1"; tutamak.setPointerCapture(e.pointerId);
    const hareket = (m: PointerEvent): void => { oran = sinirla(innerHeight - m.clientY) / innerHeight; yay(); };
    const bitir = (): void => {
      tutamak.dataset.surukle = "0"; tutamak.removeEventListener("pointermove", hareket); tutamak.removeEventListener("pointerup", bitir); tutamak.removeEventListener("pointercancel", bitir);
      try { localStorage.setItem(anahtar, String(Math.round(oran * 1000) / 1000)); } catch { /* depo yok: yalnız bu açılış */ }
    };
    tutamak.addEventListener("pointermove", hareket); tutamak.addEventListener("pointerup", bitir); tutamak.addEventListener("pointercancel", bitir);
  });
  addEventListener("resize", () => { if (acik) yay(); });
  return {
    tutamak,
    goster(a) {
      acik = a;
      if (a) yay(); else document.documentElement.style.removeProperty("--editor-alt");
    },
    yukseklik: yuk,
  };
}
