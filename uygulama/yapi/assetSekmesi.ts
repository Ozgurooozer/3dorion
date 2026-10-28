// uygulama/yapi/assetSekmesi.ts — ALT ÇUBUK · ASSET SEKMESİ: kategori listesi + yatay kaydırmalı kart şeridi (Sims'in "satın alma" çubuğu gibi). DOM katmanı.
//
// Karta TIK = "Çağır": asset imleci izleyen hayalet olur, sahnede sol tık koyar (art arda), sağ tık / Esc bitirir, tekerlek döndürür (spec 30). Aynı karta tekrar
// tık hayaleti bırakır. Sol listeden süzgeç (Tümü / ★ Favoriler / Son kullanılan / kategoriler), üstte arama; ★ ile favori. Hangi kartın görüneceği
// `assetSuzgeci.ts`te (testli); burası çizer. Katalog dünya hazır olunca yüklenir: o zamana dek "yükleniyor" yazar ve yarım saniyede bir yoklar.
"use strict";
import type { Sekme, SekmeAraci, SekmeIcerigi } from "./ortak/yapiPaneli.ts";
import type { AssetKarti } from "../assetListesi.ts";
import { SUZGEC_FAVORI, SUZGEC_SON, SUZGEC_TUM, favoriDegistir, kartlariSuz, listeyiOku, listeyiYaz, sonEkle, suzgeciDogrula, suzgecSayilari } from "./assetSuzgeci.ts";

export interface AssetSekmesiAyari {
  /** Katalog kartları (dünya/katalog hazır değilse null). */
  kartlar: () => readonly AssetKarti[] | null;
  /** Karta tıklandı: varlığı hayalet olarak çağır. */
  cagir: (varlik: string, ad: string) => void;
  /** Çağrılan hayaletin varlığı (yoksa null) ve hayaleti bırakma. */
  cagrilan: () => string | null;
  birak: () => void;
  /** Hayalet başlayınca/bitince haber (kart vurgusu). Abonelikten çıkış işlevi döner. */
  hayaletDegisince: (f: () => void) => () => void;
  /** Önizleme dosya yolu → tarayıcı adresi (`world/varlik.ts`). */
  onizlemeAdresi: (yol: string) => string;
  /** Verilmezse localStorage; null: kalıcılık yok. */
  depo?: { getItem(k: string): string | null; setItem(k: string, v: string): void } | null;
}

const FAVORI_ANAHTARI = "orion.yapi.favoriler.v1";
const SON_ANAHTARI = "orion.yapi.son.v1";
const YOKLAMA_MS = 500;
const ARAMA_BEKLEME_MS = 90;

const CSS = `
.as-kok { display: flex; height: 100%; min-height: 0; }
.as-yan { flex: 0 0 168px; overflow-y: auto; padding: 8px 6px 8px 10px; border-right: 1px solid #2a3246; display: flex; flex-direction: column; gap: 1px; }
.as-sut { display: flex; justify-content: space-between; gap: 8px; width: 100%; padding: 5px 9px; background: transparent; color: #aab4d0; border: 0; border-radius: 6px; font: inherit; cursor: pointer; text-align: left; }
.as-sut:hover { background: rgba(88,193,255,0.08); color: #eef1fa; }
.as-sut[data-etkin="1"] { background: rgba(88,193,255,0.18); color: #fff; }
.as-sut i { font-style: normal; color: #6b7794; font-size: 11px; align-self: center; }
.as-ayrac { height: 1px; background: #2a3246; margin: 5px 4px; }
.as-ana { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.as-ust { display: flex; align-items: center; gap: 10px; padding: 8px 12px 4px; }
.as-ust input { width: 220px; background: #121726; color: #eef1fa; border: 1px solid #2a3246; border-radius: 6px; padding: 4px 9px; font: inherit; user-select: text; }
.as-ust input:focus { outline: none; border-color: #58c1ff; }
.as-sayi { color: #7c88a6; font-size: 12px; }
.as-serit { flex: 1; min-height: 0; overflow-x: auto; overflow-y: hidden; padding: 4px 12px 10px; display: grid; grid-auto-flow: column; grid-auto-columns: 112px; grid-template-rows: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; align-content: start; }
.as-kart { position: relative; display: flex; flex-direction: column; gap: 3px; padding: 5px; background: #151c2b; border: 1px solid #222c41; border-radius: 8px; cursor: pointer; overflow: hidden; }
.as-kart:hover { border-color: #4a69b0; background: #19223a; }
.as-kart[data-secili="1"] { border-color: #58c1ff; box-shadow: 0 0 0 1px #58c1ff inset; background: #1a2a44; }
.as-kart img, .as-kart .as-resimsiz { width: 100%; height: 86px; object-fit: contain; background: #0d1320; border-radius: 5px; pointer-events: none; display: grid; place-items: center; color: #3d4968; font-size: 26px; }
.as-ad { font-size: 12px; line-height: 1.25; color: #dfe4f3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 30px; }
.as-boy { font-size: 10px; color: #6b7794; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.as-yildiz { position: absolute; right: 4px; top: 3px; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 11px; background: rgba(10,14,24,0.55); color: #8a97ad; font-size: 14px; line-height: 22px; cursor: pointer; opacity: 0; transition: opacity .1s; }
.as-kart:hover .as-yildiz, .as-yildiz[data-acik="1"] { opacity: 1; }
.as-yildiz[data-acik="1"] { color: #ffb454; }
.as-bos { grid-row: 1; padding: 18px 6px; color: #7c88a6; width: 420px; }
`;

function varsayilanDepo(): AssetSekmesiAyari["depo"] { try { return globalThis.localStorage ?? null; } catch { return null; } }

export function assetSekmesi(a: AssetSekmesiAyari): Sekme {
  const depo = a.depo === undefined ? varsayilanDepo() : a.depo;
  return {
    id: "asset", ad: "Asset", simge: "🧱", sira: 10,
    ipucu: "Nesne kataloğu: karta tıkla, sahnede tıklayarak yerleştir",
    kur(sayfa, arac): SekmeIcerigi { return kur(sayfa, arac, a, depo); },
  };
}

function kur(sayfa: HTMLElement, arac: SekmeAraci, a: AssetSekmesiAyari, depo: AssetSekmesiAyari["depo"]): SekmeIcerigi {
  const stil = document.createElement("style");
  stil.textContent = CSS;
  document.head.append(stil);
  const el = <K extends keyof HTMLElementTagNameMap>(ad: K, sinif = "", metin = ""): HTMLElementTagNameMap[K] => {
    const e = document.createElement(ad); if (sinif) e.className = sinif; if (metin) e.textContent = metin; return e;
  };

  const oku = (anahtar: string): string[] => {
    try { return listeyiOku(depo?.getItem(anahtar) ?? null); }
    catch (err) { console.warn(`[YAPI] ${anahtar} okunamadı, boş başlıyor:`, err instanceof Error ? err.message : String(err)); return []; }
  };
  const yaz = (anahtar: string, liste: Iterable<string>) => {
    try { depo?.setItem(anahtar, listeyiYaz(liste)); } catch (err) { console.warn(`[YAPI] ${anahtar} kaydedilemedi:`, err instanceof Error ? err.message : String(err)); }
  };
  let favoriler: Set<string> = new Set(oku(FAVORI_ANAHTARI));
  let son: string[] = oku(SON_ANAHTARI);
  let suzgec = SUZGEC_TUM;
  let arama = "";

  const kok = el("div", "as-kok");
  const yan = el("div", "as-yan");
  const ana = el("div", "as-ana");
  const ust = el("div", "as-ust");
  const ara = el("input"); ara.type = "search"; ara.placeholder = "Ara… (ad, kategori)"; ara.autocomplete = "off"; ara.spellcheck = false;
  const sayi = el("span", "as-sayi");
  ust.append(ara, sayi);
  const serit = el("div", "as-serit");
  ana.append(ust, serit);
  kok.append(yan, ana);
  sayfa.append(kok);

  // Dikey tekerlek yatay kaydırır (şerit yataydır).
  serit.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { serit.scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive: false });

  let aramaZamani: ReturnType<typeof setTimeout> | undefined;
  ara.addEventListener("input", () => {
    clearTimeout(aramaZamani);
    aramaZamani = setTimeout(() => { arama = ara.value; kartlariCiz(); }, ARAMA_BEKLEME_MS);
  });
  ara.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); ara.value = ""; arama = ""; ara.blur(); kartlariCiz(); }
  });

  let yoklama: ReturnType<typeof setInterval> | undefined;

  const sut = (anahtar: string, yazi: string, adet: number): HTMLButtonElement => {
    const b = el("button", "as-sut"); b.type = "button";
    b.dataset.etkin = suzgec === anahtar ? "1" : "0";
    b.append(el("span", "", yazi), el("i", "", String(adet)));
    b.addEventListener("click", () => { suzgec = anahtar; yanCiz(); kartlariCiz(); b.blur(); });
    return b;
  };

  function yanCiz(): void {
    const k = a.kartlar();
    if (!k) { yan.replaceChildren(); return; }
    const s = suzgecSayilari(k, favoriler, son);
    suzgec = suzgeciDogrula(suzgec, s);
    yan.replaceChildren(
      sut(SUZGEC_TUM, "Tümü", s.tum), sut(SUZGEC_FAVORI, "★ Favoriler", s.favori), sut(SUZGEC_SON, "🕘 Son kullanılan", s.son),
      el("div", "as-ayrac"), ...s.kategoriler.map((c) => sut(c.ad, c.ad, c.sayi)),
    );
  }

  function kart(k: AssetKarti): HTMLElement {
    const e = el("div", "as-kart");
    e.dataset.varlik = k.varlik;
    e.dataset.secili = a.cagrilan() === k.varlik ? "1" : "0";
    e.title = `${k.ad}\n${k.varlik}\n${k.boyut[0].toFixed(1)} × ${k.boyut[2].toFixed(1)} × ${k.boyut[1].toFixed(1)} m (en × boy × yükseklik)\nTıkla: sahnede yerleştir`;
    if (k.onizleme) {
      const r = el("img"); r.src = a.onizlemeAdresi(k.onizleme); r.alt = ""; r.loading = "lazy"; r.draggable = false;
      r.addEventListener("error", () => { const y = el("div", "as-resimsiz", "▦"); r.replaceWith(y); });
      e.append(r);
    } else e.append(el("div", "as-resimsiz", "▦"));
    const y = el("button", "as-yildiz", favoriler.has(k.varlik) ? "★" : "☆"); y.type = "button";
    y.dataset.acik = favoriler.has(k.varlik) ? "1" : "0";
    y.title = "favorilere ekle / çıkar";
    y.addEventListener("click", (ev) => {
      ev.stopPropagation();
      favoriler = favoriDegistir(favoriler, k.varlik);
      yaz(FAVORI_ANAHTARI, favoriler);
      yanCiz();
      if (suzgec === SUZGEC_FAVORI) kartlariCiz(); else { y.textContent = favoriler.has(k.varlik) ? "★" : "☆"; y.dataset.acik = favoriler.has(k.varlik) ? "1" : "0"; }
      y.blur();
    });
    e.append(y, el("div", "as-ad", k.ad), el("div", "as-boy", `${k.boyut[0].toFixed(1)}×${k.boyut[2].toFixed(1)}×${k.boyut[1].toFixed(1)} m`));
    e.addEventListener("click", () => {
      if (a.cagrilan() === k.varlik) { a.birak(); return; }
      son = sonEkle(son, k.varlik);
      yaz(SON_ANAHTARI, son);
      a.cagir(k.varlik, k.ad);
      yanCiz();
    });
    return e;
  }

  function kartlariCiz(): void {
    const k = a.kartlar();
    if (!k) { serit.replaceChildren(el("div", "as-bos", "Katalog yükleniyor… (dünya hazır olunca burada görünür)")); sayi.textContent = ""; return; }
    const liste = kartlariSuz(k, suzgec, arama, favoriler, son);
    sayi.textContent = `${liste.length} öğe`;
    if (!liste.length) {
      const neden = arama.trim() ? "Aramaya uyan öğe yok." : suzgec === SUZGEC_FAVORI ? "Henüz favori yok: bir kartın ☆ işaretine bas." : suzgec === SUZGEC_SON ? "Henüz bir şey yerleştirmedin." : "Bu kategoride öğe yok.";
      serit.replaceChildren(el("div", "as-bos", neden));
      return;
    }
    serit.replaceChildren(...liste.map(kart));
    serit.scrollLeft = 0;
  }

  function vurguyuTazele(): void {
    const c = a.cagrilan();
    for (const e of serit.querySelectorAll<HTMLElement>(".as-kart")) e.dataset.secili = e.dataset["varlik"] === c ? "1" : "0";
    arac.rozet(c ? "●" : null);
    arac.ipucu(c ? "Sol tık koy · tekerlek döndür (Shift 90°) · Ctrl ızgaraya yasla · sağ tık / Esc bitir" : "Karta tıkla, sahnede istediğin yere tıklayarak yerleştir");
  }
  // Abonelik sekme ömrü boyunca açık kalır (sekme yok edilmez); çubuk kapalıyken de vurgu ve rozet doğru tutulur.
  a.hayaletDegisince(vurguyuTazele);

  function hepsiniCiz(): void { yanCiz(); kartlariCiz(); vurguyuTazele(); }

  return {
    goster() {
      hepsiniCiz();
      // Katalog henüz yoksa hazır olunca kendiliğinden dolsun.
      clearInterval(yoklama);
      if (!a.kartlar()) yoklama = setInterval(() => { if (a.kartlar()) { hepsiniCiz(); clearInterval(yoklama); } }, YOKLAMA_MS);
    },
    gizle() { clearInterval(yoklama); },
  };
}
