// uygulama/yapi/ortak/sekmeSeridi.ts — EDİTÖRLERİN SEKME ŞERİDİ ve AD KUTUSU (spec 35 dilim 2b; "farklı canvas'lar"). DOM katmanı.
//
// Sekme başına: ad, kaydedilmemiş değişiklik noktası (•), durum rozeti (graf: ⚡ dinlemede / ▶ çalışıyor; sekans: ▶ oynuyor), ✕ kapat. KİRLİ SEKME ONAYSIZ
// KAPANMAZ: ilk ✕ "Kaydedilmedi! tekrar tıkla" der (3 sn), ikinci ✕ değişikliği atarak kapatır — kural `uygulama/duzenleyici/sekmeler.ts`te (saf, testli),
// burası yalnız iki tıkı sayar. Ad kutusu: "Yeniden adlandır" ve "Kopyasını oluştur" için tek satırlık girdi (Enter onay, Esc vazgeç); işin kendisi
// denetimcide (depoda).
// İKİ KULLANICI (graf editörü `ge-`, sekans editörü `sk-`, spec 36): önce graf editörünün dosyasıydı; sekans ikinci kopyayı yazmasın diye türden bağımsız
// yapıldı (içerik `S`; kirli/etiket/ipucu çağıranın) ve sınıf öneki parametre oldu. Bekçi: `uygulama/yapi/graf/grafEditoruBekci.test.ts` (✕ modele sorar).
"use strict";
import type { SekmeListesi } from "../../duzenleyici/sekmeler.ts";
import { el } from "./dom.ts";

const ONAY_MS = 3000;

export interface SekmeSeridiAyari<S> {
  sekmeler: SekmeListesi<S>;
  /** CSS sınıf öneki ("ge" → `ge-sekmeler`, `ge-sekme`, `ge-nokta`, `ge-rozet`, `ge-kapat`). */
  onek: string;
  kirli(s: S): boolean;
  /** Sekmede görünen ad (örn. desen için "🧩 ad"). */
  etiket(ad: string, s: S): string;
  /** Üzerine gelince (türü, kirli mi). */
  ipucu(ad: string, s: S): string;
  rozet(ad: string): string;
  sec(ad: string): void;
  /** Sekme kapandı (yeniden çiz). */
  kapandi(ad: string): void;
}

export function sekmeSeridiKur<S>(a: SekmeSeridiAyari<S>): { kok: HTMLElement; ciz(): void } {
  const o = a.onek;
  const kok = el("div", `${o}-sekmeler`);
  let onayBekleyen: string | null = null;
  let onayZamani: ReturnType<typeof setTimeout> | undefined;

  function ciz(): void {
    const etkin = a.sekmeler.etkin()?.ad ?? null;
    kok.replaceChildren(...a.sekmeler.hepsi().map((s) => {
      const t = el("div", `${o}-sekme`);
      t.dataset.etkin = s.ad === etkin ? "1" : "0";
      t.dataset.kirli = a.kirli(s.icerik) ? "1" : "0";
      t.title = a.ipucu(s.ad, s.icerik);
      const kapat = el("button", `${o}-kapat`, onayBekleyen === s.ad ? "Kaydedilmedi! tekrar tıkla" : "✕");
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
      t.append(el("span", "", a.etiket(s.ad, s.icerik)), el("span", `${o}-nokta`, "●"), el("span", `${o}-rozet`, a.rozet(s.ad)), kapat);
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

/** `dugme`: çağıran editörün düğme yapıcısı (kendi sınıfıyla); `onek`: kutunun sınıf öneki (`ge-adkutu`). */
export function adKutusuKur(bildirHata: (m: string) => void, dugme: (metin: string) => HTMLButtonElement, onek: string): AdKutusu {
  const kok = el("div", `${onek}-adkutu`);
  const yazi = el("span", `${onek}-soluk`);
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
