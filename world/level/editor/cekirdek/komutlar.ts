// world/level/editor/cekirdek/komutlar.ts — Level tanımı üzerinde saf düzenleme işlemleri (spec 22).
//
// Her işlem tanımı DEĞİŞTİRMEZ, yenisini döner (geçmiş anlık görüntü saklar — gecmis.ts). Sahneye ihtiyaç duyan
// bilgi (zemin/yüzey yüksekliği, nesne sınır kutuları) PARAMETRE olarak gelir: işlemler Node'da test edilir,
// sahne katmanı (editor/sahne/) yalnız ölçüp verir.
//
// Kimlikler: nesne `n<sayı>`, grup `g<sayı>` (cekirdek/kimlik.ts). Konum/dönüş/ölçek dosyaya kısa biçimle
// yazılır (cekirdek/donusum.ts) — dosya farkı okunur kalsın.
"use strict";
import type { GrupTanimi, KameraYeri, LevelTanimi, NesneYeri, Vec3 } from "../../cekirdek/levelTanimi.ts";
import { yeniId, yeniIdler } from "../../cekirdek/kimlik.ts";
import { donusVec, olcekVec, kisaDonus, kisaOlcek, kisaKonum } from "../../cekirdek/donusum.ts";
import { grupZinciri } from "../../cekirdek/grup.ts";

/** İşlem sonucu: yeni tanım + (varsa) işlemin ürettiği/etkilediği nesne kimlikleri (yeni seçim). */
export interface Sonuc { tanim: LevelTanimi; idler: string[] }

/** Dünya eksenli sınır kutusu (sahneden ölçülür). */
export interface Kutu { min: Vec3; max: Vec3 }

/** Bir nesnenin tam dönüşümü (editör hesaplarında). */
export interface Donusum { konum: Vec3; donus: Vec3; olcek: Vec3 }

const nesneler = (t: LevelTanimi): NesneYeri[] => t.nesneler ?? [];
const gruplar = (t: LevelTanimi): GrupTanimi[] => t.gruplar ?? [];
const kumesi = (idler: readonly string[]) => new Set(idler);

/** Nesnenin tam dönüşümü. */
export const donusumu = (n: NesneYeri): Donusum => ({ konum: [...n.konum], donus: donusVec(n.donus), olcek: olcekVec(n.olcek) });

/** Tam dönüşümü nesneye kısa biçimle yazar. */
export const donusumYaz = (n: NesneYeri, d: Partial<Donusum>): NesneYeri => ({
  ...n,
  ...(d.konum ? { konum: kisaKonum(d.konum) } : {}),
  ...(d.donus ? { donus: kisaDonus(d.donus) } : {}),
  ...(d.olcek ? { olcek: kisaOlcek(d.olcek) } : {}),
});

/** Seçili nesnelere işlev uygular (seçili olmayanlar aynen). */
export function nesneleriDegistir(t: LevelTanimi, idler: readonly string[], f: (n: NesneYeri) => NesneYeri): Sonuc {
  const k = kumesi(idler);
  return { tanim: { ...t, nesneler: nesneler(t).map((n) => (n.id && k.has(n.id) ? f(n) : n)) }, idler: [...idler] };
}

// ── ekle / sil / çoğalt ──

/** Yeni nesneler (kimlik verilir). */
export function nesneEkle(t: LevelTanimi, yeni: readonly Omit<NesneYeri, "id">[]): Sonuc {
  const idler = yeniIdler(nesneler(t).map((n) => n.id ?? ""), yeni.length);
  const eklenen = yeni.map((n, i) => ({ id: idler[i]!, ...n, konum: kisaKonum(n.konum) }));
  return { tanim: { ...t, nesneler: [...nesneler(t), ...eklenen] }, idler };
}

export function nesneSil(t: LevelTanimi, idler: readonly string[]): Sonuc {
  const k = kumesi(idler);
  return { tanim: { ...t, nesneler: nesneler(t).filter((n) => !n.id || !k.has(n.id)) }, idler: [] };
}

/** Kopyalar `kayma` kadar ötede; grup ve bayraklar korunur, kilit kalkar (kopya oynatılabilsin). Sıra korunur. */
export function nesneCogalt(t: LevelTanimi, idler: readonly string[], kayma: Vec3 = [0, 0, 0]): Sonuc {
  const k = kumesi(idler);
  const kaynak = nesneler(t).filter((n) => n.id && k.has(n.id));
  return nesneEkle(t, kaynak.map(({ id: _id, kilitli: _k, ...n }) => ({
    ...n, konum: [n.konum[0] + kayma[0], n.konum[1] + kayma[1], n.konum[2] + kayma[2]] as Vec3,
  })));
}

// ── dönüşüm ──

/** Sahneden gelen son dönüşümleri yazar (gizmo/sürükleme bitişi). */
export function donusumleriYaz(t: LevelTanimi, harita: ReadonlyMap<string, Partial<Donusum>>): Sonuc {
  return nesneleriDegistir(t, [...harita.keys()], (n) => donusumYaz(n, harita.get(n.id!)!));
}

/** Konuma ekler (ok tuşuyla kaydırma). */
export const kaydir = (t: LevelTanimi, idler: readonly string[], d: Vec3): Sonuc =>
  nesneleriDegistir(t, idler, (n) => donusumYaz(n, { konum: [n.konum[0] + d[0], n.konum[1] + d[1], n.konum[2] + d[2]] }));

/** Her nesneyi kendi ekseninde Y'de döndürür (derece) — Q/E değil, `[`/`]` ve tekerlek. */
export const yDondur = (t: LevelTanimi, idler: readonly string[], derece: number): Sonuc =>
  nesneleriDegistir(t, idler, (n) => { const d = donusVec(n.donus); d[1] += derece; return donusumYaz(n, { donus: d }); });

/** Dönüş ve ölçeği sıfırla (birim). */
export const donusumuSifirla = (t: LevelTanimi, idler: readonly string[], ne: "donus" | "olcek"): Sonuc =>
  nesneleriDegistir(t, idler, (n) => ({ ...n, ...(ne === "donus" ? { donus: 0 } : { olcek: 1 }) }));

/**
 * Zemine/yüzeye indir (End): nesnenin TABANI `yukseklik(x, z, id)`ye oturur. Yükseklik işlevi sahneden gelir
 * (zemin + altındaki diğer nesneler; nesnenin kendisi hariç). Taban = konum (varlık pivotu taban ortası).
 */
export const zemineIndir = (t: LevelTanimi, idler: readonly string[], yukseklik: (x: number, z: number, id: string) => number): Sonuc =>
  nesneleriDegistir(t, idler, (n) => donusumYaz(n, { konum: [n.konum[0], yukseklik(n.konum[0], n.konum[2], n.id!), n.konum[2]] }));

// ── hizala / dağıt ──

export type HizaYeri = "min" | "orta" | "maks";

/**
 * Seçilileri bir eksende hizalar: hepsinin kutusunun `yer`i (en küçük kenar / orta / en büyük kenar) seçimin
 * ortak değerine gelir. Ortak değer: min → en küçük, maks → en büyük, orta → seçimin bütün kutusunun ortası.
 */
export function hizala(t: LevelTanimi, idler: readonly string[], eksen: 0 | 1 | 2, yer: HizaYeri, kutular: ReadonlyMap<string, Kutu>): Sonuc {
  const var_ = idler.filter((id) => kutular.has(id));
  if (var_.length < 2) return { tanim: t, idler: [...idler] };
  const deger = (k: Kutu) => (yer === "min" ? k.min[eksen] : yer === "maks" ? k.max[eksen] : (k.min[eksen] + k.max[eksen]) / 2);
  const hepsi = var_.map((id) => kutular.get(id)!);
  const hedef = yer === "min" ? Math.min(...hepsi.map(deger)) : yer === "maks" ? Math.max(...hepsi.map(deger))
    : (Math.min(...hepsi.map((k) => k.min[eksen])) + Math.max(...hepsi.map((k) => k.max[eksen]))) / 2;
  return nesneleriDegistir(t, var_, (n) => {
    const konum: Vec3 = [...n.konum];
    konum[eksen] += hedef - deger(kutular.get(n.id!)!);
    return donusumYaz(n, { konum });
  });
}

/** Seçilileri bir eksende EŞİT ARALIKLA dağıtır: uçtakiler yerinde, aradakilerin kutu ortaları eşit adımlı. */
export function dagit(t: LevelTanimi, idler: readonly string[], eksen: 0 | 1 | 2, kutular: ReadonlyMap<string, Kutu>): Sonuc {
  const orta = (id: string) => { const k = kutular.get(id)!; return (k.min[eksen] + k.max[eksen]) / 2; };
  const sirali = idler.filter((id) => kutular.has(id)).sort((a, b) => orta(a) - orta(b));
  if (sirali.length < 3) return { tanim: t, idler: [...idler] };
  const bas = orta(sirali[0]!), adim = (orta(sirali[sirali.length - 1]!) - bas) / (sirali.length - 1);
  const hedef = new Map(sirali.map((id, i) => [id, bas + adim * i]));
  return nesneleriDegistir(t, sirali, (n) => {
    const konum: Vec3 = [...n.konum];
    konum[eksen] += hedef.get(n.id!)! - orta(n.id!);
    return donusumYaz(n, { konum });
  });
}

// ── bayraklar, ad, varlık ──

export const bayrakAyarla = (t: LevelTanimi, idler: readonly string[], alan: "gizli" | "kilitli", deger: boolean): Sonuc =>
  nesneleriDegistir(t, idler, (n) => { const { [alan]: _eski, ...geri } = n; return deger ? { ...geri, [alan]: true } : geri; });

export function grupBayrakAyarla(t: LevelTanimi, grupId: string, alan: "gizli" | "kilitli", deger: boolean): LevelTanimi {
  return { ...t, gruplar: gruplar(t).map((g) => { if (g.id !== grupId) return g; const { [alan]: _e, ...geri } = g; return deger ? { ...geri, [alan]: true } : geri; }) };
}

/** Alt+H: her nesne ve grup görünür. */
export function hepsiniGoster(t: LevelTanimi): LevelTanimi {
  return {
    ...t,
    nesneler: nesneler(t).map(({ gizli: _g, ...n }) => n),
    gruplar: gruplar(t).map(({ gizli: _g, ...g }) => g),
  };
}

export const adlandir = (t: LevelTanimi, id: string, ad: string): Sonuc =>
  nesneleriDegistir(t, [id], (n) => { const { ad: _a, ...geri } = n; return ad.trim() ? { ...geri, ad: ad.trim() } : geri; });

export const varlikDegistir = (t: LevelTanimi, idler: readonly string[], varlik: string): Sonuc =>
  nesneleriDegistir(t, idler, (n) => ({ ...n, varlik }));

// ── gruplar ──

/** Seçilileri yeni bir gruba alır. Hepsi aynı gruptaysa yeni grup onun içine açılır. */
export function grupla(t: LevelTanimi, idler: readonly string[], ad = "grup"): { tanim: LevelTanimi; grupId: string; idler: string[] } {
  const k = kumesi(idler);
  const secili = nesneler(t).filter((n) => n.id && k.has(n.id));
  const grupId = yeniId(gruplar(t).map((g) => g.id), "g");
  const ortak = secili.length > 0 && secili.every((n) => n.grup === secili[0]!.grup) ? secili[0]!.grup : undefined;
  const grup: GrupTanimi = { id: grupId, ad, ...(ortak ? { ust: ortak } : {}) };
  return {
    tanim: { ...t, gruplar: [...gruplar(t), grup], nesneler: nesneler(t).map((n) => (n.id && k.has(n.id) ? { ...n, grup: grupId } : n)) },
    grupId,
    idler: [...idler],
  };
}

/** Grubu çözer: içindeki nesne ve alt gruplar grubun üstüne çıkar, grup silinir. */
export function grubuCoz(t: LevelTanimi, grupId: string): LevelTanimi {
  const g = gruplar(t).find((x) => x.id === grupId);
  if (!g) return t;
  const ustune = <T extends { grup?: string; ust?: string }>(x: T, alan: "grup" | "ust"): T => {
    if (x[alan] !== grupId) return x;
    const { [alan]: _e, ...geri } = x;
    return (g.ust ? { ...geri, [alan]: g.ust } : geri) as T;
  };
  return {
    ...t,
    nesneler: nesneler(t).map((n) => ustune(n, "grup")),
    gruplar: gruplar(t).filter((x) => x.id !== grupId).map((x) => ustune(x, "ust")),
  };
}

/** Grubun (alt gruplar dahil) bütün nesne kimlikleri. */
export function grubunNesneleri(t: LevelTanimi, grupId: string): string[] {
  const gs = gruplar(t);
  return nesneler(t).filter((n) => n.id && grupZinciri(n.grup, gs).some((g) => g.id === grupId)).map((n) => n.id!);
}

/** Grubu siler; `icerikle` ise içindeki nesneleri ve alt grupları da, değilse çözer gibi üstüne bırakır. */
export function grupSil(t: LevelTanimi, grupId: string, icerikle: boolean): LevelTanimi {
  if (!icerikle) return grubuCoz(t, grupId);
  const gs = gruplar(t);
  const altlar = new Set(gs.filter((g) => grupZinciri(g.id, gs).some((x) => x.id === grupId)).map((g) => g.id));
  const silinecek = new Set(grubunNesneleri(t, grupId));
  return { ...t, nesneler: nesneler(t).filter((n) => !n.id || !silinecek.has(n.id)), gruplar: gs.filter((g) => !altlar.has(g.id)) };
}

/** Nesneleri bir gruba taşır (`grupId` yoksa gruptan çıkarır). */
export const grubaTasi = (t: LevelTanimi, idler: readonly string[], grupId?: string): Sonuc =>
  nesneleriDegistir(t, idler, (n) => { const { grup: _g, ...geri } = n; return grupId ? { ...geri, grup: grupId } : geri; });

/** Grubu başka grubun içine taşır; döngü oluşacaksa (kendi altına) dokunmaz. */
export function grubuTasi(t: LevelTanimi, grupId: string, ustId?: string): LevelTanimi {
  const gs = gruplar(t);
  if (ustId && grupZinciri(ustId, gs).some((g) => g.id === grupId)) return t;
  return { ...t, gruplar: gs.map((g) => { if (g.id !== grupId) return g; const { ust: _u, ...geri } = g; return ustId ? { ...geri, ust: ustId } : geri; }) };
}

export const grubuAdlandir = (t: LevelTanimi, grupId: string, ad: string): LevelTanimi =>
  ({ ...t, gruplar: gruplar(t).map((g) => (g.id === grupId ? { ...g, ad: ad.trim() || g.ad } : g)) });

// ── kamera yer imleri ──

/** Yer imi yuvası (1–9) adla eşleşir: "3" adlı yer Shift+3'tür. Varsa üzerine yazar, yoksa ekler. */
export function yerImiYaz(t: LevelTanimi, yuva: number, yer: Omit<KameraYeri, "ad">): LevelTanimi {
  const ad = String(yuva), liste = t.kameraYerleri ?? [];
  const yeni: KameraYeri = { ad, konum: kisaKonum(yer.konum), hedef: kisaKonum(yer.hedef) };
  return { ...t, kameraYerleri: liste.some((y) => y.ad === ad) ? liste.map((y) => (y.ad === ad ? yeni : y)) : [...liste, yeni] };
}
export const yerImi = (t: LevelTanimi, yuva: number): KameraYeri | null => t.kameraYerleri?.find((y) => y.ad === String(yuva)) ?? null;
