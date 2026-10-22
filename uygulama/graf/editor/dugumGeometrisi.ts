// uygulama/graf/editor/dugumGeometrisi.ts — DÜĞÜM KUTUSU VE PİN YERLERİ, BAĞ EĞRİSİ (spec 35 dilim 2b). SAF: DOM yok.
//
// Düğümün boyutu ve pinlerinin dünya koordinatı BURADA hesaplanır, DOM'da ölçülmez: bağ eğrileri düğümler çizilmeden de doğru yere gider, "sığdır" ve
// kutu seçimi DOM'a sormaz, testler geometriyi görür. DOM katmanı aynı ölçüleri (başlık, satır yüksekliği, genişlik) CSS'e bu sabitlerden yazar —
// ölçüler iki yerde YAZILMAZ (CSS bu dosyadan türer; uygulama/yapi/graf/editorStili.ts).
// Yerleşim (Blueprint gibi): başlık, altında satırlar; satır i'de solda i. giriş, sağda i. çıkış. Saf düğümün başlığı ince (akış pini yok, hafif görünüm).
"use strict";
import type { GrafDugumu, PinTanimi } from "../../../protocol/graf.ts";
import type { DugumPinleri } from "../dugumKaydi.ts";
import type { Kutu, Nokta } from "./tuvalMatematigi.ts";

export const DUGUM_OLCU = {
  genislik: 230,
  safGenislik: 180,
  baslik: 28,
  safBaslik: 22,
  satir: 26,
  altBosluk: 8,
  /** Pin dairesinin yarıçapı (vuruş alanı biraz geniş: `PIN_VURUS`). */
  pinYaricap: 6,
} as const;
/** Pinin tıklanabilir yarıçapı (dünya birimi): küçük daireyi tutturmak zor olmasın. */
export const PIN_VURUS = 11;

export type PinYonu = "giris" | "cikis";
export interface PinYeri { ad: string; tip: PinTanimi["tip"]; yon: PinYonu; sira: number; nokta: Nokta }
export interface DugumKutusu extends Kutu { id: string; saf: boolean; girisler: PinYeri[]; cikislar: PinYeri[] }

/** Konumu olmayan düğümün geçici yeri (otomatik yerleşimden önce): sol üst. Davranışı etkilemez. */
const konumu = (d: GrafDugumu): Nokta => ({ x: d.konum?.[0] ?? 0, y: d.konum?.[1] ?? 0 });

/**
 * Düğümün kutusu ve pin yerleri. `pinler` null = düğüm çözülemedi (bilinmeyen tür, eksik ayar): pinsiz, tek satırlık hata kutusu çizilir; bağları
 * yine görünür (uçları düğümün kenarına düşer) ki "nereye bağlıydı" kaybolmasın.
 */
export function dugumKutusu(d: GrafDugumu, pinler: DugumPinleri | null, saf: boolean): DugumKutusu {
  const { x, y } = konumu(d);
  const g = saf ? DUGUM_OLCU.safGenislik : DUGUM_OLCU.genislik;
  const baslik = saf ? DUGUM_OLCU.safBaslik : DUGUM_OLCU.baslik;
  const gir = pinler?.girisler ?? [], cik = pinler?.cikislar ?? [];
  const satirSayisi = Math.max(1, gir.length, cik.length);
  const h = baslik + satirSayisi * DUGUM_OLCU.satir + DUGUM_OLCU.altBosluk;
  const satirY = (i: number) => y + baslik + i * DUGUM_OLCU.satir + DUGUM_OLCU.satir / 2;
  return {
    id: d.id, x, y, g, h, saf,
    girisler: gir.map((p, i) => ({ ad: p.ad, tip: p.tip, yon: "giris", sira: i, nokta: { x, y: satirY(i) } })),
    cikislar: cik.map((p, i) => ({ ad: p.ad, tip: p.tip, yon: "cikis", sira: i, nokta: { x: x + g, y: satirY(i) } })),
  };
}

/**
 * Bağın ucunun noktası. Pin yoksa (düğüm çözülemedi ya da pin kalktı) düğüm kenarının ortası: bağ yine çizilir, kırmızı gösterilir; çizimden
 * kaybolması "sessiz kayıp" olurdu.
 */
export function bagUcu(k: DugumKutusu, pin: string, yon: PinYonu): { nokta: Nokta; bulundu: boolean } {
  const p = (yon === "giris" ? k.girisler : k.cikislar).find((x) => x.ad === pin);
  if (p) return { nokta: p.nokta, bulundu: true };
  return { nokta: { x: yon === "giris" ? k.x : k.x + k.g, y: k.y + DUGUM_OLCU.baslik / 2 }, bulundu: false };
}

/**
 * Bağ eğrisi (SVG yolu): çıkıştan sağa, girişe soldan giren kübik Bézier — Blueprint'in "tel"i. Kontrol kolu uzaklığa göre büyür ama en az 40: geri
 * dönen bağ (hedef kaynağın solunda) düğümün içinden geçmesin diye dışarı kıvrılır.
 */
export function bagYolu(a: Nokta, b: Nokta): string {
  const kol = Math.max(40, Math.abs(b.x - a.x) * 0.5, Math.min(160, Math.abs(b.y - a.y) * 0.5));
  const s = (v: number) => Number(v.toFixed(1));
  return `M ${s(a.x)} ${s(a.y)} C ${s(a.x + kol)} ${s(a.y)}, ${s(b.x - kol)} ${s(b.y)}, ${s(b.x)} ${s(b.y)}`;
}

/** Noktaya en yakın pin (vuruş yarıçapı içinde); yoksa null. Bağ bırakılırken hedef pin böyle bulunur. */
export function pinBul(kutular: readonly DugumKutusu[], p: Nokta, yaricap = PIN_VURUS): PinYeri & { dugum: string } | null {
  let en: (PinYeri & { dugum: string }) | null = null;
  let enD = yaricap;
  for (const k of kutular) {
    for (const pin of [...k.girisler, ...k.cikislar]) {
      const d = Math.hypot(pin.nokta.x - p.x, pin.nokta.y - p.y);
      if (d <= enD) { enD = d; en = { ...pin, dugum: k.id }; }
    }
  }
  return en;
}

/** Noktanın üstündeki düğüm (en üstte çizilen = listede sonraki kazanır). */
export function dugumBul(kutular: readonly DugumKutusu[], p: Nokta): DugumKutusu | null {
  for (let i = kutular.length - 1; i >= 0; i--) {
    const k = kutular[i]!;
    if (p.x >= k.x && p.x <= k.x + k.g && p.y >= k.y && p.y <= k.y + k.h) return k;
  }
  return null;
}
