// uygulama/sekans/editor/sekansOturumu.ts — BİR SEKANS SEKMESİNİN OTURUMU (spec 36 S2): geri al yığını, görünüm, playhead, seçim, yaslama, sürükleme ve
// komutlar. SAF: DOM yok. Her komut TEK geri al adımıdır (sürükleme dahil: bırakınca bir adım) ve kullanıcıya söylenecek bir sonuç döner.
//
// SÜRÜKLEME önizlemedir: başlarken taban sekans saklanır, her harekette TOPLAM kayma tabana uygulanır (adım adım birikme yok; geçersiz bir ara konum son
// geçerli önizlemeyi bozmaz), bırakınca yığına tek görüntü girer, Esc tabana döner. Geri al yığını ortak modül (`uygulama/duzenleyici/gecmis.ts`).
"use strict";
import type { Sonuc } from "../../../protocol/dogrula.ts";
import { otelemeMi } from "../../../protocol/animasyon.ts";
import type { Sekans } from "../../../protocol/sekans.ts";
import { gecmisKur, type Gecmis } from "../../duzenleyici/gecmis.ts";
import { refAnahtari, type AnahtarRef, type BolumBolgesi } from "./izDuzeni.ts";
import { anahtarEkle, anahtarlariSil, anahtarlariTasi, bolumKirp, bolumSil, bolumTasi, bolumUzat } from "./sekansIslemleri.ts";
import { BASLANGIC_ZAMANI, eksenKisiti, kareyiYasla, type ZamanGorunumu } from "./zamanEkseni.ts";

export type Secim =
  | { tur: "yok" }
  | { tur: "anahtar"; refs: AnahtarRef[] }
  | { tur: "bolum"; iz: string; i: number }
  | { tur: "iz"; iz: string }
  | { tur: "baglama"; id: string }
  /** Kamera kesmesi (kare = kimlik; bir karede tek kesme). */
  | { tur: "kesme"; kare: number };

export interface KomutSonucu { ok: boolean; mesaj?: string }

/** Dikey sürüklemede piksel başına değer: dönme 1°, öteleme 0,005 m (yukarı = artı). */
export const DEGER_PIKSELI = { donme: 1, oteleme: 0.005 } as const;

type Surukleme =
  | { tur: "anahtar"; taban: Sekans; refs: AnahtarRef[]; birim: number; onizleme: Sekans; sonRefs: AnahtarRef[] }
  | { tur: "bolum"; taban: Sekans; iz: string; i: number; bolge: BolumBolgesi; onizleme: Sekans };

export interface SekansOturumu {
  readonly gecmis: Gecmis<Sekans>;
  /** Ekrandaki sekans (sürüklerken önizleme). */
  sekans(): Sekans;
  gorunum: ZamanGorunumu;
  /** Playhead (tamsayı kare, 0..sure). */
  kare: number;
  secim: Secim;
  yasla: boolean;
  dongu: boolean;
  /** Dosya editör dışında değişti/silindi (sekmeDosyalari kuralı). */
  dis: "degisti" | "silindi" | null;
  /** İşlem sonucunu yığına yazar (başarısızsa nedenle döner, yığın değişmez). */
  uygula(r: Sonuc<Sekans>, mesaj: string, secim?: Secim): KomutSonucu;
  seciliIz(): string | null;
  kareyeGit(k: number): void;
  adim(n: number): void;
  basa(): void;
  sona(): void;
  /** Seçili izde (yoksa bütün izlerde) önceki/sonraki anahtar ya da bölüm kenarı. */
  anahtaraAtla(yon: -1 | 1): KomutSonucu;
  anahtarEkle(): KomutSonucu;
  sil(): KomutSonucu;
  tumunuSec(): KomutSonucu;
  geriAl(): KomutSonucu;
  yinele(): KomutSonucu;
  anahtarSurukleBasla(refs: AnahtarRef[]): void;
  bolumSurukleBasla(iz: string, i: number, bolge: BolumBolgesi): void;
  /** Toplam fare kayması (px). Geçersiz konumda önizleme son geçerli hâlde kalır ve neden döner. */
  surukle(dxPx: number, dyPx: number, shift: boolean): KomutSonucu | null;
  surukleBitir(): KomutSonucu | null;
  surukleIptal(): boolean;
  suruklemede(): boolean;
}

const kenarlar = (s: Sekans, haric: (iz: string, kare: number) => boolean): number[] => {
  const l: number[] = [s.aralik.bas, s.aralik.bit];
  for (const iz of s.izler) {
    if (iz.tur === "uzuv") { for (const a of iz.anahtarlar) if (!haric(iz.id, a.kare)) l.push(a.kare); }
    else for (const b of iz.bolumler) l.push(b.baslangic_kare, b.baslangic_kare + b.uzunluk_kare);
  }
  return l;
};

export function sekansOturumuKur(ilk: Sekans): SekansOturumu {
  const gecmis = gecmisKur<Sekans>(ilk);
  let sur: Surukleme | null = null;
  const o: SekansOturumu = {
    gecmis,
    sekans: () => sur?.onizleme ?? gecmis.simdiki(),
    gorunum: { ...BASLANGIC_ZAMANI },
    kare: ilk.aralik.bas,
    secim: { tur: "yok" },
    yasla: true,
    dongu: false,
    dis: null,
    uygula(r, mesaj, secim) {
      if (!r.ok) return { ok: false, mesaj: r.hata };
      gecmis.kaydet(r.deger);
      if (secim) o.secim = secim;
      o.kare = Math.min(o.kare, r.deger.sure_kare);
      return { ok: true, mesaj };
    },
    seciliIz() {
      const s = o.secim;
      return s.tur === "anahtar" ? s.refs[0]?.iz ?? null : s.tur === "bolum" || s.tur === "iz" ? s.iz : null;
    },
    kareyeGit(k) { o.kare = Math.max(0, Math.min(o.sekans().sure_kare, Math.round(k))); },
    adim(n) { o.kareyeGit(o.kare + n); },
    basa() { o.kare = o.sekans().aralik.bas; },
    sona() { o.kare = o.sekans().aralik.bit; },
    anahtaraAtla(yon) {
      const s = o.sekans(), iz = o.seciliIz();
      const adaylar = [...new Set(kenarlar({ ...s, izler: iz ? s.izler.filter((x) => x.id === iz) : s.izler, aralik: { bas: o.kare, bit: o.kare } }, () => false))]
        .filter((k) => (yon > 0 ? k > o.kare : k < o.kare)).sort((a, b) => a - b);
      const k = yon > 0 ? adaylar[0] : adaylar[adaylar.length - 1];
      if (k === undefined) return { ok: false, mesaj: yon > 0 ? "ileride anahtar yok" : "geride anahtar yok" };
      o.kare = k;
      return { ok: true };
    },
    anahtarEkle() {
      const iz = o.seciliIz();
      const x = iz ? o.sekans().izler.find((z) => z.id === iz) : null;
      if (!x || x.tur !== "uzuv") return { ok: false, mesaj: "önce bir UZUV izi seç (sol sütunda satıra tık): K o izin playhead karesine anahtar ekler" };
      return o.uygula(anahtarEkle(o.sekans(), x.id, o.kare), `anahtar eklendi: ${x.id} · kare ${o.kare}`, { tur: "anahtar", refs: [{ iz: x.id, kare: o.kare }] });
    },
    sil() {
      const s = o.secim;
      if (s.tur === "anahtar") return o.uygula(anahtarlariSil(o.sekans(), s.refs), `${s.refs.length} anahtar silindi (Ctrl+Z geri getirir)`, { tur: "yok" });
      if (s.tur === "bolum") return o.uygula(bolumSil(o.sekans(), s.iz, s.i), "bölüm silindi (Ctrl+Z geri getirir)", { tur: "iz", iz: s.iz });
      return { ok: false, mesaj: "silinecek seçim yok (iz silmek için sol sütundaki ✕)" };
    },
    tumunuSec() {
      const iz = o.seciliIz();
      const refs: AnahtarRef[] = [];
      for (const x of o.sekans().izler) if (x.tur === "uzuv" && (!iz || x.id === iz)) for (const a of x.anahtarlar) refs.push({ iz: x.id, kare: a.kare });
      o.secim = refs.length ? { tur: "anahtar", refs } : { tur: "yok" };
      return { ok: true, mesaj: `${refs.length} anahtar seçildi` };
    },
    geriAl() {
      if (sur) o.surukleIptal();
      const g = gecmis.geriAl();
      if (!g) return { ok: false, mesaj: "geri alınacak bir şey yok" };
      o.secim = { tur: "yok" }; o.kareyeGit(o.kare);
      return { ok: true, mesaj: "geri alındı" };
    },
    yinele() {
      const g = gecmis.yinele();
      if (!g) return { ok: false, mesaj: "yinelenecek bir şey yok" };
      o.secim = { tur: "yok" }; o.kareyeGit(o.kare);
      return { ok: true, mesaj: "yinelendi" };
    },
    anahtarSurukleBasla(refs) {
      const taban = gecmis.simdiki();
      const iz = taban.izler.find((x) => x.id === refs[0]?.iz);
      const birim = iz?.tur === "uzuv" && otelemeMi(iz.kanal) ? DEGER_PIKSELI.oteleme : DEGER_PIKSELI.donme;
      sur = { tur: "anahtar", taban, refs, birim, onizleme: taban, sonRefs: refs };
    },
    bolumSurukleBasla(iz, i, bolge) { const taban = gecmis.simdiki(); sur = { tur: "bolum", taban, iz, i, bolge, onizleme: taban }; },
    surukle(dxPx, dyPx, shift) {
      if (!sur) return null;
      const { dx, dy } = eksenKisiti(dxPx, dyPx, shift);
      const g = o.gorunum;
      if (sur.tur === "anahtar") {
        const x = sur;
        const secili = new Set(x.refs.map(refAnahtari));
        const capa = x.refs[0]!.kare;
        const hedef = kareyiYasla(capa + dx / g.olcek, g, o.yasla, [...kenarlar(x.taban, (iz, k) => secili.has(refAnahtari({ iz, kare: k }))), o.kare]);
        const r = anahtarlariTasi(x.taban, x.refs, hedef - capa, -dy * x.birim);
        if (!r.ok) return { ok: false, mesaj: r.hata };
        x.onizleme = r.deger.sekans; x.sonRefs = r.deger.refs;
        return { ok: true };
      }
      const y = sur;
      const b = y.taban.izler.find((z) => z.id === y.iz);
      const bolum = b?.tur === "klip" ? b.bolumler[y.i] : undefined;
      if (!bolum) return { ok: false, mesaj: "bölüm yok" };
      const capa = y.bolge === "sag" ? bolum.baslangic_kare + bolum.uzunluk_kare : bolum.baslangic_kare;
      // Yaslama komşuları: öteki bölümlerin kenarları, anahtarlar, aralık, playhead — sürüklenen bölümün kendi kenarları HARİÇ.
      const komsu = [...kenarlar({ ...y.taban, izler: y.taban.izler.map((z) => (z.id === y.iz && z.tur === "klip" ? { ...z, bolumler: z.bolumler.filter((_, j) => j !== y.i) } : z)) }, () => false), o.kare];
      const dk = kareyiYasla(capa + dx / g.olcek, g, o.yasla, komsu) - capa;
      const f = y.bolge === "ic" ? bolumTasi : y.bolge === "sag" ? bolumUzat : bolumKirp;
      const r = f(y.taban, y.iz, y.i, dk);
      if (!r.ok) return { ok: false, mesaj: r.hata };
      y.onizleme = r.deger;
      return { ok: true };
    },
    surukleBitir() {
      const x = sur;
      if (!x) return null;
      sur = null;
      if (x.onizleme === x.taban) return null;
      gecmis.kaydet(x.onizleme);
      if (x.tur === "anahtar") { o.secim = { tur: "anahtar", refs: x.sonRefs }; return { ok: true, mesaj: `${x.refs.length} anahtar taşındı (Ctrl+Z geri alır)` }; }
      return { ok: true, mesaj: x.bolge === "ic" ? "bölüm taşındı" : x.bolge === "sag" ? "bölüm uzunluğu değişti" : "bölüm kırpıldı (klibin başı)" };
    },
    surukleIptal() { if (!sur) return false; sur = null; return true; },
    suruklemede: () => sur !== null,
  };
  return o;
}
