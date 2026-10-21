// uygulama/ajanlar/cipModeli.ts — AJAN ÇİPLERİ modeli (spec 33). SAF: DOM yok; iki yerde kullanılır:
//   • Yapı çubuğu · Zihin sekmesi: hangi ajanın zihin haritası (Orion | Flash);
//   • sohbet kutusu: söz kime gidecek (Orion | Flash | İkisi).
// Tek sekme + çipler (plan kararı): 300 ajanda sekme şeridi taşar, çip şeridi kaydırılır/süzülür.
//
// SEÇİM NİYETTİR, GÖRÜNEN GERÇEKTİR: Ozyn "flash"ı seçtiyse seçim hatırlanır; Flash henüz yoksa (beden yükleniyor) görünen ve geçerli olan
// ilk seçenektir (Orion). Ekrandaki vurgulu çip ile sözün gittiği yer AYRIŞAMAZ: ikisi de `etkin()`ten okur.
"use strict";
import { HEPSI, type AjanKaydi } from "./ajanKaydi.ts";

export interface Cip {
  readonly id: string;
  readonly etiket: string;
  readonly renk: string;
}

export class CipSecimi {
  private _secenekler: () => readonly Cip[];
  private _istenen: string | null;
  private _dinleyiciler = new Set<(id: string | null) => void>();

  /** `istenen`: başlangıç seçimi (ör. hatırlanan); yoksa ilk seçenek. */
  constructor(secenekler: () => readonly Cip[], istenen: string | null = null) {
    this._secenekler = secenekler;
    this._istenen = istenen;
  }

  secenekler(): readonly Cip[] { return this._secenekler(); }

  /** Geçerli seçim: istenen seçeneklerdeyse o, değilse ilk seçenek; hiç seçenek yoksa null. */
  etkin(): string | null {
    const l = this._secenekler();
    return l.some((c) => c.id === this._istenen) ? this._istenen : (l[0]?.id ?? null);
  }

  /** Bilinmeyen kimlik seçilmez (false). Seçim değişirse dinleyiciler çağrılır. */
  sec(id: string): boolean {
    if (!this._secenekler().some((c) => c.id === id)) return false;
    const once = this.etkin();
    this._istenen = id;
    if (this.etkin() !== once) this._yay();
    return true;
  }

  /** Sıradaki (yon 1) ya da önceki (−1) çip; uçta başa döner (Tab ile tek tuşla gezilir). */
  dongu(yon: 1 | -1): string | null {
    const l = this._secenekler();
    if (l.length === 0) return null;
    const i = l.findIndex((c) => c.id === this.etkin());
    const sonraki = l[(i + yon + l.length) % l.length]!.id;
    this.sec(sonraki);
    return sonraki;
  }

  /** Seçim değişince (çip yeniden çizilsin, seçim hatırlansın). Çıkış fonksiyonu döner. */
  dinle(cb: (id: string | null) => void): () => void { this._dinleyiciler.add(cb); return () => { this._dinleyiciler.delete(cb); }; }

  /** Seçenek listesi değişti (ajan geldi/gitti): etkin seçim kayabilir, dinleyicilere söylenir. */
  secenekDegisti(): void { this._yay(); }

  private _yay(): void {
    const id = this.etkin();
    for (const d of this._dinleyiciler) {
      try { d(id); } catch (err) { console.error("[CIP] dinleyici hatası:", err); }
    }
  }
}

/** "Hepsi" çipinin rengi: hiçbir ajanın rengi değil (nötr). */
export const HEPSI_RENGI = "#c9cbd6";

/** Sohbet hedef çipleri: her ajan + (iki ya da daha çok ajan varsa) hepsi. İki ajanda "İkisi", fazlasında "Hepsi". */
export function hedefCipleri(ajanlar: readonly Pick<AjanKaydi, "id" | "ad" | "renk">[]): Cip[] {
  const c: Cip[] = ajanlar.map((a) => ({ id: a.id, etiket: a.ad, renk: a.renk }));
  if (ajanlar.length >= 2) c.push({ id: HEPSI, etiket: ajanlar.length === 2 ? "İkisi" : "Hepsi", renk: HEPSI_RENGI });
  return c;
}
