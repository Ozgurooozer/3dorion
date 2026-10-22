// uygulama/yapi/graf/dugumOgesi.ts — TUVALDEKİ BİR DÜĞÜMÜN DOM'U (spec 35 dilim 2b): başlık (kategori renginde), solda giriş, sağda çıkış pinleri (türe göre renk;
// akış beyaz üçgen), bağlı olmayan veri girişinin yanında satır içi değer alanı. DOM katmanı.
//
// Konum ve boyut `dugumKutusu`ndan (hesaplanır, ölçülmez); satırlar mutlak konumlu: pin noktası geometrinin söylediği yerde durur, bağ oraya gider.
// Satır içi alan düğümün `ayar`ını yazar (Blueprint'teki bağsız pinin kutusu): değer `alanlar.ts`ten doğrulanır, geçersizse YAZILMAZ ve neden söylenir.
// Ayar değişince pinler yeniden hesaplanır ve pini kalkan bağ budanır (editorOturumu.ayarKomutu): bu öğe yalnız komutu çağırır.
"use strict";
import type { GrafDugumu } from "../../../protocol/graf.ts";
import type { CozulmusDugum } from "../../graf/grafTurDenetimi.ts";
import { DESEN_CAGIR_TIPI } from "../../graf/grafTurDenetimi.ts";
import { DEGISKEN_DUGUMU } from "../../graf/durumDugumleri.ts";
import { DUGUM_OLCU, type DugumKutusu } from "../../graf/editor/dugumGeometrisi.ts";
import { alanDegeriCoz, dugumAlanlari, pinAlani } from "../../graf/editor/alanlar.ts";
import { ayarKomutu } from "../../graf/editor/editorOturumu.ts";
import { KATEGORI_RENGI, PIN_RENGI } from "../../graf/editor/renkler.ts";
import { PIN_TIP_ADI } from "../../graf/editor/bagKurali.ts";
import type { EditorBaglami } from "./editorBaglami.ts";
import { alanGirdisi, el } from "./dom.ts";

export interface DugumIsareti {
  secili: boolean;
  /** Şu an yürüyen düğüm (çalışma görünümü). */
  suan: boolean;
  /** Son çalışma bu düğümde düştü. */
  calismaHatasi: string | null;
  /** Denetim hataları (kırmızı çerçeve + ipucu). */
  hatalar: readonly string[];
  bagliGirisler: ReadonlySet<string>;
  bagliCikislar: ReadonlySet<string>;
}

const DEGISKEN_TURLERI: ReadonlySet<string> = new Set(Object.values(DEGISKEN_DUGUMU));

/** Başlığın sonuna düğümü tanıtan ayar ("Desen: selamla", "Değişken oku: ziyaret"): iki Değişken düğümü birbirinden ayırt edilsin. */
function baslikEki(d: GrafDugumu): string {
  const a = d.ayar ?? {};
  if (d.tip === DESEN_CAGIR_TIPI && typeof a["desen"] === "string") return `: ${a["desen"]}`;
  if (DEGISKEN_TURLERI.has(d.tip) && typeof a["ad"] === "string") return `: ${a["ad"]}`;
  return "";
}

export function dugumOgesi(b: EditorBaglami, d: GrafDugumu, k: DugumKutusu, c: CozulmusDugum | undefined, i: DugumIsareti): HTMLElement {
  const o = b.oturum()!;
  const t = c?.tanim ?? b.kayit.al(d.tip);
  const kok = el("div", "ge-dugum");
  kok.dataset.id = d.id;
  kok.dataset.saf = k.saf ? "1" : "0";
  kok.dataset.secili = i.secili ? "1" : "0";
  kok.dataset.hata = i.hatalar.length ? "1" : "0";
  kok.dataset.suan = i.suan ? "1" : "0";
  kok.dataset.calismaHata = i.calismaHatasi ? "1" : "0";
  Object.assign(kok.style, { left: `${k.x}px`, top: `${k.y}px`, width: `${k.g}px`, height: `${k.h}px` });
  kok.title = [
    `${t?.ad ?? d.tip} (${d.tip}) · kimlik: ${d.id}`, t?.aciklama ?? "bilinmeyen düğüm türü",
    ...i.hatalar.map((h) => `✗ ${h}`), ...(i.calismaHatasi ? [`✗ son çalışma: ${i.calismaHatasi}`] : []),
    d.tip === DESEN_CAGIR_TIPI ? "Çift tık: deseni aç" : "",
  ].filter(Boolean).join("\n");

  const baslik = el("div", "ge-dbaslik");
  baslik.style.background = t ? KATEGORI_RENGI[t.kategori] : "#5a2020";
  baslik.append(el("span", "", `${t?.ad ?? `? ${d.tip}`}${baslikEki(d)}`), el("span", "ge-kimlik", d.id));
  kok.append(baslik);

  if (!c) {
    const sebep = i.hatalar[0] ?? "çözülemedi";
    kok.append(el("div", "ge-cozumsuz", `⚠ ${sebep}`));
    return kok;
  }
  const alanlar = t ? dugumAlanlari(t, c.pinler, o.ortam()) : [];
  const baslikH = k.saf ? DUGUM_OLCU.safBaslik : DUGUM_OLCU.baslik;
  const satirSayisi = Math.max(1, c.pinler.girisler.length, c.pinler.cikislar.length);
  for (let s = 0; s < satirSayisi; s++) {
    const satir = el("div", "ge-dsatir");
    satir.style.top = `${baslikH + s * DUGUM_OLCU.satir}px`;
    const sol = el("div", "ge-dsol"), sag = el("div", "ge-dsag");
    const gp = c.pinler.girisler[s], cp = c.pinler.cikislar[s];
    if (gp) {
      const bagli = i.bagliGirisler.has(gp.ad);
      satir.append(pin(d.id, gp.ad, gp.tip, "giris", bagli));
      // Akış girişinin adı yazılmaz (Blueprint gibi: üçgen yeter); veri girişinin adı ve bağsızsa değer alanı.
      if (gp.tip !== "akis" || gp.ad !== "giris") sol.append(el("span", "ge-detiket", gp.ad));
      const alan = !bagli && gp.tip !== "akis" ? pinAlani(alanlar, gp.ad) : null;
      if (alan) {
        sol.append(alanGirdisi(alan, d.ayar?.[alan.ad], (ham) => {
          const r = alanDegeriCoz(alan, ham);
          if (!r.ok) { b.bildir(r.hata, "hata"); b.tazele(); return; }
          b.sonuc(ayarKomutu(o, b.kayit, d.id, alan.ad, r.deger));
        }));
      }
    }
    if (cp) {
      if (cp.tip !== "akis" || cp.ad !== "sonra") sag.append(el("span", "ge-detiket", cp.ad));
      satir.append(pin(d.id, cp.ad, cp.tip, "cikis", i.bagliCikislar.has(cp.ad)));
    }
    satir.prepend(sol);
    satir.append(sag);
    kok.append(satir);
  }
  return kok;
}

function pin(dugum: string, ad: string, tip: keyof typeof PIN_RENGI, yon: "giris" | "cikis", bagli: boolean): HTMLElement {
  const p = el("span", "ge-pin");
  Object.assign(p.dataset, { dugum, pin: ad, yon, tip, bagli: bagli ? "1" : "0" });
  p.style.setProperty("--renk", PIN_RENGI[tip]);
  p.title = `${ad} · ${PIN_TIP_ADI[tip]} ${yon === "giris" ? "girişi" : "çıkışı"} — sürükle: bağla${bagli ? " · bağlı" : ""}`;
  return p;
}
