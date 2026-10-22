// uygulama/yapi/graf/sekmeSeridi.ts — EDİTÖRÜN SEKME ŞERİDİ ve AD KUTUSU (spec 35 dilim 2b; "farklı canvas'lar"). DOM katmanı.
//
// Sekme başına: ad, kaydedilmemiş değişiklik noktası (•), ⚡ dinlemede / ▶ çalışıyor rozeti, ✕ kapat. KİRLİ SEKME ONAYSIZ KAPANMAZ: ilk ✕ "Kaydedilmedi!
// tekrar tıkla" der (3 sn), ikinci ✕ değişikliği atarak kapatır — kural `sekmeler.ts`te (saf, testli), burası yalnız iki tıkı sayar.
// Ad kutusu: "Yeniden adlandır" ve "Kopyasını oluştur" için tek satırlık girdi (Enter onay, Esc vazgeç); işin kendisi denetimcide (grafEditoru.ts → depo).
"use strict";
import type { EditorOturumu } from "../../graf/editor/editorOturumu.ts";
import type { SekmeListesi } from "../../graf/editor/sekmeler.ts";
import { dugme, el } from "./dom.ts";

const ONAY_MS = 3000;

export interface SekmeSeridiAyari {
  sekmeler: SekmeListesi<EditorOturumu>;
  rozet(ad: string): string;
  sec(ad: string): void;
  /** Sekme kapandı (yeniden çiz). */
  kapandi(ad: string): void;
}

export function sekmeSeridiKur(a: SekmeSeridiAyari): { kok: HTMLElement; ciz(): void } {
  const kok = el("div", "ge-sekmeler");
  let onayBekleyen: string | null = null;
  let onayZamani: ReturnType<typeof setTimeout> | undefined;

  function ciz(): void {
    const etkin = a.sekmeler.etkin()?.ad ?? null;
    kok.replaceChildren(...a.sekmeler.hepsi().map((s) => {
      const t = el("div", "ge-sekme");
      t.dataset.etkin = s.ad === etkin ? "1" : "0";
      t.dataset.kirli = s.icerik.gecmis.kirli() ? "1" : "0";
      const g = s.icerik.graf();
      t.title = `${g.tur === "fonksiyon" ? "desen" : "grafik"} '${s.ad}'${s.icerik.gecmis.kirli() ? " — kaydedilmemiş değişiklik var (Ctrl+S)" : ""}`;
      const kapat = el("button", "ge-kapat", onayBekleyen === s.ad ? "Kaydedilmedi! tekrar tıkla" : "✕");
      kapat.type = "button";
      kapat.dataset.onay = onayBekleyen === s.ad ? "1" : "0";
      kapat.title = "Sekmeyi kapat (kaydedilmemişse önce sorar)";
      kapat.addEventListener("click", (e) => {
        e.stopPropagation(); kapat.blur();
        const r = a.sekmeler.kapat(s.ad, onayBekleyen === s.ad);
        if (r === "onay-gerek") {
          onayBekleyen = s.ad; clearTimeout(onayZamani);
          onayZamani = setTimeout(() => { onayBekleyen = null; ciz(); }, ONAY_MS);
          ciz();
          return;
        }
        onayBekleyen = null; clearTimeout(onayZamani);
        a.kapandi(s.ad);
      });
      t.append(el("span", "", `${g.tur === "fonksiyon" ? "🧩 " : ""}${s.ad}`), el("span", "ge-nokta", "●"), el("span", "ge-rozet", a.rozet(s.ad)), kapat);
      t.addEventListener("click", () => a.sec(s.ad));
      return t;
    }));
  }
  return { kok, ciz };
}

export interface AdKutusu {
  readonly kok: HTMLElement;
  /** Kutuyu aç: `baslik` ("yeni ad:"), ilk değer; Enter'de `onay(ad)` (söz çözülünce kapanır, hata olursa açık kalır). */
  ac(baslik: string, ilk: string, onay: (ad: string) => Promise<void>): void;
  kapat(): boolean;
}

export function adKutusuKur(bildirHata: (m: string) => void): AdKutusu {
  const kok = el("div", "ge-adkutu");
  const yazi = el("span", "ge-soluk");
  const girdi = el("input"); girdi.spellcheck = false; girdi.autocomplete = "off"; girdi.style.width = "160px";
  const tamam = dugme("Tamam"), vazgec = dugme("Vazgeç");
  kok.append(yazi, girdi, tamam, vazgec);
  let onay: ((ad: string) => Promise<void>) | null = null;
  const kapat = (): boolean => { if (kok.dataset.acik !== "1") return false; kok.dataset.acik = "0"; onay = null; return true; };
  const yap = () => {
    const f = onay;
    if (!f) return;
    tamam.disabled = true;
    f(girdi.value.trim()).then(() => kapat(), (err: unknown) => bildirHata(err instanceof Error ? err.message : String(err))).finally(() => { tamam.disabled = false; });
  };
  tamam.addEventListener("click", () => { tamam.blur(); yap(); });
  vazgec.addEventListener("click", () => { vazgec.blur(); kapat(); });
  girdi.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); yap(); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); kapat(); }
  });
  return {
    kok,
    ac(baslik, ilk, f) { onay = f; yazi.textContent = baslik; girdi.value = ilk; kok.dataset.acik = "1"; girdi.focus(); girdi.select(); },
    kapat,
  };
}
