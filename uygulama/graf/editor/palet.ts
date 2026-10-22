// uygulama/graf/editor/palet.ts — DÜĞÜM PALETİ (spec 35 dilim 2b): eklenebilecek düğümler, arama ve PİN UYUMU süzgeci. SAF.
//
// Palet KÜTÜPHANEDEN beslenir (`DugumKaydi.hepsi()`): yeni bir düğüm türü kaydedilince burada KENDİLİĞİNDEN görünür (ad, açıklama, kategori kayıttan;
// ayrı bir menü listesi yazılmaz). Orion da aynı kütüphanenin JSON'unu yazar. Eklemeler:
//   • `desen.cagir` tek öğe değil, KAYITLI HER DESEN bir öğedir ("Desen: selamla", ayarı dolu) — adı boş bir Desen düğümü pinsiz ve bozuk olurdu;
//   • grafik türüne uymayan düğüm önerilmez (olay grafiğinde Fonksiyon girişi, desende ▶ Başla ve dünya olayları: denetim zaten reddeder);
//   • bir pinden sürüklenip boşluğa bırakılınca YALNIZ o pine bağlanabilecek düğümler (Blueprint'in "context sensitive" listesi). Kural bağ kuralının
//     aynısı (`uyumluIlkPin` → grafTurDenetimi.ts `uyumlu`); pinleri hesaplanamayan öğe bu süzgeçte çıkar (bağlanacağı yer bilinmiyor).
// Yeni düğümün ilk ayarı: ayar tanımlarının `ornek` değerleri; pinler yine de çözülemezse (seçenekli zorunlu ayar: Ajan seç, olay ajanı) seçeneklerin İLKİ.
"use strict";
import type { GrafDegeri, PinTipi } from "../../../protocol/graf.ts";
import { secenekleriCoz, type DugumKaydi, type DugumKategorisi, type DugumPinleri, type DugumTanimi, type PinOrtami } from "../dugumKaydi.ts";
import { BASLA_TIPI, DESEN_CAGIR_TIPI, FONKSIYON_DONUS_TIPI, FONKSIYON_GIRIS_TIPI } from "../grafTurDenetimi.ts";
import { uyumluIlkPin } from "./bagKurali.ts";
import type { PinYonu } from "./dugumGeometrisi.ts";

export interface PaletOgesi {
  /** Listede tekil anahtar (desen öğelerinde `desen.cagir:<ad>`). */
  anahtar: string;
  tip: string;
  ad: string;
  aciklama: string;
  kategori: DugumKategorisi;
  /** Eklenince düğüme yazılacak ilk ayar. */
  ayar: Record<string, GrafDegeri>;
  /** İlk ayarla pinler (çözülemediyse null: pin süzgecinde çıkar). */
  pinler: DugumPinleri | null;
}

export const KATEGORI_SIRASI: readonly DugumKategorisi[] = ["olay", "akis", "ajan", "dunya", "veri", "desen"];
export const KATEGORI_ADI: Readonly<Record<DugumKategorisi, string>> = {
  olay: "Olaylar", akis: "Akış", ajan: "Ajan eylemleri", dunya: "Dünya değişkenleri", veri: "Veri ve mantık", desen: "Desenler",
};

function pinlerDene(t: DugumTanimi<unknown>, ayar: Record<string, GrafDegeri>, ortam: PinOrtami): DugumPinleri | null {
  const tam: Record<string, GrafDegeri> = {};
  for (const a of t.ayarlar ?? []) if (a.varsayilan !== undefined) tam[a.ad] = a.varsayilan;
  Object.assign(tam, ayar);
  try { return t.pinler(tam, ortam); } catch { return null; }
}

/** Yeni düğümün ilk ayarı ve o ayarla pinleri (bkz. dosya başı). */
export function yeniDugumAyari(t: DugumTanimi<unknown>, ortam: PinOrtami, ek: Record<string, GrafDegeri> = {}): { ayar: Record<string, GrafDegeri>; pinler: DugumPinleri | null } {
  const ayar: Record<string, GrafDegeri> = {};
  for (const a of t.ayarlar ?? []) if (a.ornek !== undefined) ayar[a.ad] = a.ornek;
  Object.assign(ayar, ek);
  let pinler = pinlerDene(t, ayar, ortam);
  if (pinler) return { ayar, pinler };
  // Seçenekli ama varsayılansız ayar zorunlu olabilir (pinler onsuz çözülmez): ilk seçenekle dene.
  for (const a of t.ayarlar ?? []) {
    if (ayar[a.ad] !== undefined || a.varsayilan !== undefined) continue;
    const s = secenekleriCoz(a, ortam);
    if (s?.length) ayar[a.ad] = s[0]!;
  }
  pinler = pinlerDene(t, ayar, ortam);
  return { ayar, pinler };
}

/** Grafik türüne göre önerilmeyen düğüm (denetim reddederdi). */
function turaUymaz(t: DugumTanimi<unknown>, tur: "olay" | "fonksiyon"): boolean {
  if (tur === "olay") return t.tip === FONKSIYON_GIRIS_TIPI || t.tip === FONKSIYON_DONUS_TIPI;
  return t.tip === BASLA_TIPI || t.dunyaOlayi !== undefined;
}

/**
 * Paletin bütün öğeleri. `desenler`: kayıtlı desen adları (desen.cagir öğeleri; grafiğin kendisi hariç tutulur — desen kendini çağıramaz).
 * Sıra: kategori sırası, sonra Türkçe ad.
 */
export function paletOgeleri(kayit: DugumKaydi<unknown>, ortam: PinOrtami, grafTuru: "olay" | "fonksiyon", desenler: readonly string[], grafAdi = ""): PaletOgesi[] {
  const l: PaletOgesi[] = [];
  for (const t of kayit.hepsi()) {
    if (turaUymaz(t, grafTuru)) continue;
    if (t.tip === DESEN_CAGIR_TIPI) {
      for (const ad of desenler) {
        if (ad === grafAdi) continue;
        const y = yeniDugumAyari(t, ortam, { desen: ad });
        l.push({ anahtar: `${t.tip}:${ad}`, tip: t.tip, ad: `Desen: ${ad}`, aciklama: ortam.desen(ad)?.aciklama ?? t.aciklama, kategori: t.kategori, ...y });
      }
      continue;
    }
    l.push({ anahtar: t.tip, tip: t.tip, ad: t.ad, aciklama: t.aciklama, kategori: t.kategori, ...yeniDugumAyari(t, ortam) });
  }
  const sira = (k: DugumKategorisi) => KATEGORI_SIRASI.indexOf(k);
  return l.sort((a, b) => sira(a.kategori) - sira(b.kategori) || a.ad.localeCompare(b.ad, "tr"));
}

const norm = (s: string) => s.toLocaleLowerCase("tr");

/**
 * Süz: arama (boşlukla ayrılmış sözcüklerin HEPSİ ad, tür ya da açıklamada geçmeli; Türkçe küçük harf) ve isteğe bağlı pin uyumu (sürüklenen pin:
 * yönü ve türü). Pin verildiyse pinleri bilinmeyen öğe çıkar.
 */
export function paletSuz(ogeler: readonly PaletOgesi[], s: { arama?: string; pin?: { yon: PinYonu; tip: PinTipi } | null }): PaletOgesi[] {
  const sozcukler = norm(s.arama ?? "").split(/\s+/).filter(Boolean);
  return ogeler.filter((o) => {
    if (s.pin && (!o.pinler || uyumluIlkPin(o.pinler, s.pin) === null)) return false;
    const metin = norm(`${o.ad} ${o.tip} ${o.aciklama}`);
    return sozcukler.every((w) => metin.includes(w));
  });
}

/** Kategorilere göre grupla (sıra korunur, boş grup yok). */
export function paletGrupla(ogeler: readonly PaletOgesi[]): { kategori: DugumKategorisi; ad: string; ogeler: PaletOgesi[] }[] {
  return KATEGORI_SIRASI.map((k) => ({ kategori: k, ad: KATEGORI_ADI[k], ogeler: ogeler.filter((o) => o.kategori === k) })).filter((g) => g.ogeler.length);
}
