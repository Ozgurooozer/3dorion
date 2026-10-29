// uygulama/graf/hataAyiklayici.ts — KESME NOKTASI + ADIM ADIM (spec 43 A4; Unreal Blueprint debugger). SAF: DOM yok.
//
// Düğüme KESME NOKTASI konur (graf adı + düğüm kimliği); çalışma o düğüme gelince BAŞLAMADAN durur ("duraklar"), Ozyn Devam ya da Adım der.
//   • Devam: durmuş çalışmaları bırakır ve adım modunu kapatır (sonraki kesme noktasına kadar akar).
//   • Adım: yalnız ilk durmuşu bırakır, adım modu AÇIK kalır: sıradaki akışlı düğümde yine durur.
//   • ■ Durdur duraklamayı keser (yorumlayıcı duraklama sözünü ■'ye karşı bekler); çalışma bitince/durunca `bitir()` o çalışmanın bekleyenlerini temizler.
// Yorumlayıcı yalnız AKIŞLI düğümlerde sorar (saf düğümler başka bir düğümün girişi okunurken hesaplanır; onlarda durmak anlamsız olurdu).
// KULLANICI TETİKLİ çalışmalara (Graf ▶, aktör ▶) takılır; ⚡ dinleme çalışmalarına TAKILMAZ (unutulmuş bir duraklama NPC'nin olay yolunu kilitlemesin).
// Devam/Adım düğmeleri yalnız gerçek tıklamayla (`isTrusted`; editör tarafında): çalıştıran Ozyn'in tuşudur.
"use strict";

export interface DuraklamaYeri { kaynak: string; graf: string; id: string; derinlik: number }

export type Duraklat = (graf: string, id: string, derinlik: number) => Promise<void> | null;

export interface HataAyiklayiciCalismasi {
  readonly duraklat: Duraklat;
  /** Çalışma bitti/durdu: bu çalışmanın bekleyenleri temizlenir; çalışan kalmadıysa adım modu kapanır. */
  bitir(): void;
}

export interface HataAyiklayici {
  /** Yeni bir çalışma için duraklatıcı. `kaynak` günlükte/duraklama satırında görünür. */
  calisma(kaynak: string): HataAyiklayiciCalismasi;
  kesmeVar(graf: string, id: string): boolean;
  /** Kesme noktasını koyar/kaldırır; yeni durumu (var mı) döner. */
  kesmeDegistir(graf: string, id: string): boolean;
  /** Bu grafın kesme noktası olan düğüm kimlikleri. */
  kesmeler(graf: string): readonly string[];
  /** Şu an duran çalışmalar (ilk eleman Adım'ın bırakacağı). */
  duraklamalar(): readonly DuraklamaYeri[];
  adimModu(): boolean;
  devam(): boolean;
  adim(): boolean;
  dinle(f: () => void): () => void;
}

interface Bekleyen { yer: DuraklamaYeri; coz: () => void; calisma: object }

const anahtar = (graf: string, id: string): string => `${graf}\u0000${id}`;

export function hataAyiklayiciKur(): HataAyiklayici {
  const kesme = new Set<string>();
  let bekleyenler: Bekleyen[] = [];
  const aktif = new Set<object>();
  let adim = false;
  const dinleyiciler = new Set<() => void>();
  const yay = (): void => { for (const f of [...dinleyiciler]) { try { f(); } catch (err) { console.error("[graf] hata ayıklayıcı dinleyicisi hatası:", err); } } };

  const birak = (b: Bekleyen): void => { bekleyenler = bekleyenler.filter((x) => x !== b); b.coz(); };

  return {
    calisma(kaynak) {
      const kimlik = {};
      aktif.add(kimlik);
      return {
        duraklat(graf, id, derinlik) {
          if (!adim && !kesme.has(anahtar(graf, id))) return null;
          let coz: () => void = () => {};
          const soz = new Promise<void>((r) => { coz = r; });
          bekleyenler.push({ yer: { kaynak, graf, id, derinlik }, coz, calisma: kimlik });
          yay();
          return soz;
        },
        bitir() {
          aktif.delete(kimlik);
          const benim = bekleyenler.filter((b) => b.calisma === kimlik);
          bekleyenler = bekleyenler.filter((b) => b.calisma !== kimlik);
          for (const b of benim) b.coz();
          if (aktif.size === 0) adim = false;
          yay();
        },
      };
    },
    kesmeVar: (graf, id) => kesme.has(anahtar(graf, id)),
    kesmeDegistir(graf, id) {
      const k = anahtar(graf, id);
      const var_ = !kesme.has(k);
      if (var_) kesme.add(k); else kesme.delete(k);
      yay();
      return var_;
    },
    kesmeler: (graf) => [...kesme].filter((k) => k.startsWith(`${graf}\u0000`)).map((k) => k.slice(graf.length + 1)),
    duraklamalar: () => bekleyenler.map((b) => b.yer),
    adimModu: () => adim,
    devam() {
      const vardi = bekleyenler.length > 0;
      adim = false;
      for (const b of [...bekleyenler]) birak(b);
      yay();
      return vardi;
    },
    adim() {
      const ilk = bekleyenler[0];
      if (!ilk) return false;
      adim = true;
      birak(ilk);
      yay();
      return true;
    },
    dinle(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
  };
}
