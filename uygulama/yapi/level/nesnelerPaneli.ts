// uygulama/yapi/level/nesnelerPaneli.ts — NESNELER PANELİ (spec 43 A5; Unreal Outliner'ın nesne kısmı + Details). DOM katmanı; satırlar `nesneModeli.ts`te (testli).
//
// Açık level'ın yerleştirilmiş nesnelerini (glb) listeler, seçileni Details'te gösterir: şemadaki alanlar (konum, dönüş, ölçek, gizli, kilitli), graf seçimi + ▶ ■, değişkenler.
// Ortak çizici `detayCiz` (ışık paneliyle AYNI); yazma yolu tek: `bilesen.ts` işlemi → `level.ayarla` (level doğrular, bozuksa eski hâlinde kalır, neden altyazıda).
// KAYDETMEZ: nesne değişiklikleri oturum içidir (diske yazılan tek şey Işıklar panelindeki ışık listesidir; nesne yerleşimi asset menüsünün işi). Bu yüzden "● oturum içi" rozeti.
// Mesh/ses/tetik bileşenleri YOK: yeni nesne türü kurulumu `nesneSistemi.ts` değişikliği ister (spec 43 §9). Dok paneli (Pencere ▸ Nesneler), ilk açılışta kapalı.
"use strict";
import type { Level } from "../../../world/level/cekirdek/levelKur.ts";
import type { LevelTanimi } from "../../../world/level/cekirdek/levelTanimi.ts";
import { alanYaz, degiskenYaz, grafAta } from "../../../world/level/cekirdek/bilesen.ts";
import { YAPI_RENK as R } from "../../../world/arayuz/arayuzJetonlari.ts";
import { dugmeYap, el } from "../ortak/dom.ts";
import type { DokYoneticisi } from "../ortak/dok/dokYoneticisi.ts";
import { DETAY_CSS, detayCiz } from "./detayPaneli.ts";
import { levelPaneliStiliEkle } from "./isiklarPaneli.ts";
import { nesneListesi } from "./nesneModeli.ts";

export const NESNELER_PANELI_KIMLIGI = "nesneler";

export interface NesnelerPaneliAyari {
  dok: DokYoneticisi;
  level: () => Level | null;
  altyazi: (metin: string, ms?: number) => void;
  /** Grafik deposundaki olay grafiklerinin adları (Details'te graf seçimi). */
  grafAdlari?: () => readonly string[];
  /** Graf satırının yanındaki düğmeler (▶ ■): aktör kimliği ve seçili graf. */
  grafEylemleri?: (id: string, graf: string | null) => HTMLElement[];
}
export interface NesnelerPaneli {
  readonly kok: HTMLElement;
  tazele(): void;
  secili(): string | null;
  /** Nesneyi seç; listede olmayan kimlikte değişmez. */
  sec(id: string): void;
}

const EK_CSS = `
.nl-ara { flex: 1; min-width: 0; background: ${R.dugme}; color: ${R.yaziParlak}; border: 1px solid ${R.cizgi}; border-radius: 5px; padding: 2px 6px; font: inherit; user-select: text; }
.nl-graf { color: ${R.vurgu}; font-size: 11px; }
${DETAY_CSS}
`;
let ekStilEklendi = false;
const dugme = dugmeYap("");

export function nesnelerPaneliKur(a: NesnelerPaneliAyari): NesnelerPaneli {
  levelPaneliStiliEkle();
  if (!ekStilEklendi) { const s = document.createElement("style"); s.textContent = EK_CSS; document.head.append(s); ekStilEklendi = true; }
  const kok = el("div", "il-kok"); kok.tabIndex = 0;
  const ara = el("input", "nl-ara"); ara.type = "text"; ara.placeholder = "nesne ara (ad ya da kimlik)";
  const rozet = el("span", "il-rozet");
  const arac = el("div", "il-arac"); arac.append(ara, rozet);
  const liste = el("div", "il-liste"), detay = el("div", "il-detay"), durum = el("div", "il-durum");
  kok.append(arac, liste, detay, durum);

  let secili: string | null = null;
  let ilkImza: string | null = null;
  const imza = (t: LevelTanimi): string => JSON.stringify(t.nesneler ?? []);

  /** Tanımı dönüştür → canlı uygula (ışık paneliyle aynı kural). */
  function uygula(f: (t: LevelTanimi) => { ok: true; deger: LevelTanimi } | { ok: false; neden: string }): void {
    const l = a.level(); if (!l) { a.altyazi("level hazır değil", 1800); return; }
    if (ilkImza === null) ilkImza = imza(l.tanim());
    const r = f(l.tanim());
    if (!r.ok) { a.altyazi(`nesne: ${r.neden}`, 3000); tazele(); return; }
    try { l.ayarla(r.deger); } catch (e) { a.altyazi(`nesne uygulanamadı: ${e instanceof Error ? e.message : String(e)}`, 4000); }
    tazele();
  }

  function detayCizHepsi(id: string | null): void {
    detay.replaceChildren();
    const l = a.level();
    if (!id || !l) { detay.append(el("div", "il-bos", "Listeden bir nesne seç")); detay.style.display = "block"; return; }
    detay.style.display = "grid";
    const ad = l.tanim().nesneler?.find((n) => n.id === id)?.ad ?? "";
    detayCiz({
      hedef: detay, tanim: () => l.tanim(), id, grafAdlari: () => a.grafAdlari?.() ?? [],
      ad: { deger: ad, yaz: (v) => uygula((t) => adYaz(t, id, v)) },
      alanYaz: (alan, deger) => uygula((t) => alanYaz(t, id, alan, deger)),
      grafAta: (graf) => uygula((t) => grafAta(t, id, graf)),
      degiskenYaz: (d, v) => uygula((t) => degiskenYaz(t, id, d, v)),
      bildir: (m) => a.altyazi(m, 2500),
      ...(a.grafEylemleri ? { grafEylemleri: (graf: string | null) => a.grafEylemleri!(id, graf) } : {}),
    });
  }

  function tazele(): void {
    const l = a.level();
    const t = l ? l.tanim() : null;
    if (t && ilkImza === null) ilkImza = imza(t);
    const r = t ? nesneListesi(t, ara.value) : { satirlar: [], toplam: 0, kesildi: false };
    if (secili && t && !(t.nesneler ?? []).some((n) => n.id === secili)) secili = null;
    liste.replaceChildren();
    if (!t) liste.append(el("div", "il-bos", "Level hazır değil"));
    else if (!r.satirlar.length) liste.append(el("div", "il-bos", ara.value.trim() ? "Eşleşen nesne yok" : "Bu level'da kimlikli nesne yok"));
    for (const s of r.satirlar) {
      const satir = el("div", "il-satir"); satir.dataset.id = s.id; satir.dataset.secili = s.id === secili ? "1" : "0"; satir.dataset.gizli = s.gizli ? "1" : "0";
      const adEl = el("span", "il-ad", `${s.kilitli ? "🔒 " : ""}${s.ad}`); adEl.title = `${s.id} · ${s.varlik}`;
      satir.append(adEl);
      if (s.graf) { const g = el("span", "nl-graf", `ƒ ${s.graf}`); g.title = "Bu nesnenin grafı var"; satir.append(g); }
      satir.addEventListener("click", () => { secili = s.id; tazele(); });
      liste.append(satir);
    }
    detayCizHepsi(secili);
    const kirli = t !== null && ilkImza !== null && imza(t) !== ilkImza;
    rozet.textContent = kirli ? "● oturum içi" : "";
    rozet.title = "Nesne değişiklikleri diske yazılmaz (yalnız bu oturumda geçerli)";
    durum.textContent = `${r.toplam} nesne${r.kesildi ? " (liste kesildi: ara)" : ""}${secili ? ` · seçili: ${secili}` : ""}`;
  }

  ara.addEventListener("input", () => tazele());
  kok.addEventListener("keydown", (e) => { if (e.target instanceof HTMLInputElement && e.target.type !== "color") e.stopPropagation(); });
  kok.addEventListener("keyup", (e) => { if (e.target instanceof HTMLInputElement) e.stopPropagation(); });

  a.dok.kaydet({
    kayit: { id: NESNELER_PANELI_KIMLIGI, ad: "Nesneler", bolgeler: ["sol", "sag", "alt", "yuzer"], varsayilan: "sol", baslangicKapali: true },
    icerik: kok, gorunur: true, ipucu: "Level nesneleri: seç, Details'te düzenle, graf ata",
  });
  // Görünürken yavaşça tazele (asset menüsü nesne ekleyebilir); yazı/arama alanında yazarken ve görünmezken dokunma.
  setInterval(() => { if (a.dok.ekrandaMi(NESNELER_PANELI_KIMLIGI) && !kok.contains(document.activeElement)) tazele(); }, 1000);
  tazele();

  return {
    kok, tazele, secili: () => secili,
    sec(id) {
      const t = a.level()?.tanim();
      if (!t || !(t.nesneler ?? []).some((n) => n.id === id)) return;
      secili = id; tazele();
    },
  };
}

/** Görünen adı yazar (boş = `ad` alanı kalkar, varlığın kısa adına döner). Doğrulamayı `level.ayarla` yapar (bozuk sonuç eski hâlinde kalır). */
function adYaz(t: LevelTanimi, id: string, ad: string): { ok: true; deger: LevelTanimi } | { ok: false; neden: string } {
  const nesneler = (t.nesneler ?? []).map((n) => {
    if (n.id !== id) return n;
    const { ad: _eski, ...gerisi } = n;
    return ad.trim() ? { ...gerisi, ad: ad.trim() } : gerisi;
  });
  return { ok: true, deger: { ...t, nesneler } };
}
