// uygulama/aktor/aktorSablonu.ts — AKTÖR ŞABLONU (spec 45 §8, B6). SAF: Babylon, DOM, dosya YOK.
//
// Şablon = bir aktörün ALT AĞACI (kök + çocuklar + bileşenler + graf adı/değişkenler) tek JSON olarak; Unreal'ın Blueprint sınıfı gibi. Level'a "şablondan yerleştir"
// yeni kimliklerle kopya koyar, mevcut aktörden "şablon olarak kaydet" alt ağacı çıkarır. Dosya `Content/Actors/<ad>.aktor.json` (saklama host'ta; bu modül yalnız biçim).
//
// KURALLAR:
//   • Kimlikler şablonda YEREL (`s1`, `s2`…); yerleştirmede level'ın kullanmadığı yeni kimlik verilir (`n<sayı>` nesne, `i<sayı>` ışık) ve `ust` bağları yeniden eşlenir.
//   • Kök: tek, `ust`suz. Çıkarırken kökün `ust/soket`i ve konumu SİLİNİR (şablon bağımsızdır; yerleştirmede konum verilir); çocukların konumu üste göre yereldir (spec 45 §3), dokunulmaz.
//   • `grup` taşınmaz (level'a özgü); `beden:<ad>` üstleri olduğu gibi kalır (bedenin varlığı çalışma anında denetlenir).
//   • Hiçbir işlev fırlatmaz: sonuç `{ ok }` ya da hata metni; her hata AKT-SBL-NNN kodludur (spec 45 §13). Yerleştirme level'a YAZMAZ, yeni aktör listelerini döndürür (yazma kapısı çağırandadır).
"use strict";
import { grafAdiGecerli } from "../../protocol/graf.ts";
import { AKTOR_DEGISKEN_SINIRI, ISIK_TAVANI, type IsikAktoru, type NesneYeri, type Vec3 } from "../../world/level/cekirdek/levelTanimi.ts";
import { BEDEN_ONEKI, BILESEN_TAVANI, bilesenlerHatasi, hiyerarsiHatasi, ustHatasi, type BilesenKaydi } from "../../world/level/cekirdek/bilesenKaydi.ts";
import { yeniIdler } from "../../world/level/cekirdek/kimlik.ts";
import { kodlu } from "../../world/level/cekirdek/aktorHatalari.ts";

export const SABLON_SURUMU = 1;
/** Bir şablondaki en çok aktör (veri koruması; level'ın aktör tavanı ayrıca geçerli). */
export const SABLON_AKTOR_TAVANI = 32;
/** glb düğümü bu önekle başlıyorsa soket olur (`soket_namlu` → `namlu` soketi). */
export const GLB_SOKET_ONEKI = "soket_";

/** Şablondaki aktör: `nesne` YA DA `isik` (tam biri). Kimlik şablona yerel; `grup` yok. */
export interface SablonAktoru {
  id: string;
  nesne?: Omit<NesneYeri, "id" | "grup">;
  isik?: Omit<IsikAktoru, "id" | "grup">;
}
export interface AktorSablonu {
  surum: typeof SABLON_SURUMU;
  ad: string;
  aciklama?: string;
  /** Kök aktörün şablon-yerel kimliği (üstsüz tek aktör). */
  kok: string;
  aktorler: SablonAktoru[];
}
export interface AktorKumesi { nesneler?: readonly NesneYeri[]; isiklar?: readonly IsikAktoru[] }
export type SablonSonucu<T> = { ok: true; deger: T } | { ok: false; neden: string };

const nesneMi = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const vec3Mi = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x));
const SABLON_ALANLARI = ["surum", "ad", "aciklama", "kok", "aktorler"];
const ORTAK = ["graf", "degiskenler", "bilesenler", "ust", "soket"];
const NESNE_ALANLARI = [...ORTAK, "varlik", "ad", "konum", "donus", "olcek", "gizli", "kilitli", "anlam"];
const ISIK_ALANLARI = [...ORTAK, "ad", "tur", "konum", "renk", "siddet", "menzil", "gizli", "kilitli"];

/** Aktörün ortak (ust/graf/değişken/bileşen) alanlarının ilk hatası; yoksa null. */
function ortakHata(a: Record<string, unknown>): string | null {
  const u = ustHatasi(a); if (u) return `${u.alan}: ${u.neden}`;
  const b = bilesenlerHatasi(a["bilesenler"]); if (b) return `${b.alan}: ${b.neden}`;
  if (a["graf"] !== undefined && !grafAdiGecerli(a["graf"])) return "graf: geçerli graf adı olmalı (harf, rakam, _ ve -)";
  const d = a["degiskenler"];
  if (d !== undefined) {
    if (!nesneMi(d)) return "degiskenler: nesne olmalı";
    const e = Object.entries(d);
    if (e.length > AKTOR_DEGISKEN_SINIRI.adet) return `degiskenler: en çok ${AKTOR_DEGISKEN_SINIRI.adet} değişken`;
    for (const [k, v] of e) {
      if (!grafAdiGecerli(k)) return `degiskenler.${k}: ad geçersiz`;
      if (typeof v === "string" ? v.length > AKTOR_DEGISKEN_SINIRI.metin : typeof v !== "number" && typeof v !== "boolean") return `degiskenler.${k}: sayı, mantıksal ya da ≤ ${AKTOR_DEGISKEN_SINIRI.metin} karakter metin olmalı`;
    }
  }
  return null;
}

function nesneHata(n: Record<string, unknown>): string | null {
  for (const k of Object.keys(n)) if (!NESNE_ALANLARI.includes(k)) return `nesne.${k}: bilinmeyen alan`;
  if (typeof n["varlik"] !== "string" || !n["varlik"].trim()) return "nesne.varlik: boş olmayan metin olmalı";
  if (!vec3Mi(n["konum"])) return "nesne.konum: üç sayı olmalı";
  const d = n["donus"]; if (!(typeof d === "number" ? Number.isFinite(d) : vec3Mi(d))) return "nesne.donus: sayı ya da üç sayı olmalı";
  const o = n["olcek"]; if (!(typeof o === "number" ? Number.isFinite(o) && o > 0 : vec3Mi(o) && o.every((x) => x > 0))) return "nesne.olcek: pozitif sayı ya da üç pozitif sayı olmalı";
  return ortakHata(n);
}
function isikHata(n: Record<string, unknown>): string | null {
  for (const k of Object.keys(n)) if (!ISIK_ALANLARI.includes(k)) return `isik.${k}: bilinmeyen alan`;
  if (n["tur"] !== "nokta") return "isik.tur: 'nokta' olmalı";
  if (!vec3Mi(n["konum"])) return "isik.konum: üç sayı olmalı";
  if (typeof n["renk"] !== "string" || !n["renk"]) return "isik.renk: metin olmalı";
  for (const k of ["siddet", "menzil"]) if (typeof n[k] !== "number" || !Number.isFinite(n[k]) || (n[k] as number) < 0) return `isik.${k}: negatif olmayan sayı olmalı`;
  return ortakHata(n);
}

/** Şablonun ilk hatası (kodlu metin); geçerliyse null. Dosyadan okunan her şey buradan geçer. */
export function sablonHatasi(v: unknown): string | null {
  if (!nesneMi(v)) return kodlu("AKT-SBL-001", "şablon nesne olmalı");
  for (const k of Object.keys(v)) if (!SABLON_ALANLARI.includes(k)) return kodlu("AKT-SBL-001", `${k}: bilinmeyen alan (${SABLON_ALANLARI.join(", ")})`);
  if (v["surum"] !== SABLON_SURUMU) return kodlu("AKT-SBL-001", `surum ${SABLON_SURUMU} olmalı (${JSON.stringify(v["surum"])} bu sürümde tanınmaz)`);
  if (!grafAdiGecerli(v["ad"])) return kodlu("AKT-SBL-001", "ad: geçerli olmalı (harf, rakam, _ ve -; en çok 48; dosya adı olur)");
  if (v["aciklama"] !== undefined && (typeof v["aciklama"] !== "string" || v["aciklama"].length > 300)) return kodlu("AKT-SBL-001", "aciklama: en çok 300 karakter metin olmalı");
  const liste = v["aktorler"];
  if (!Array.isArray(liste) || liste.length < 1) return kodlu("AKT-SBL-001", "aktorler: en az bir aktör içeren dizi olmalı");
  if (liste.length > SABLON_AKTOR_TAVANI) return kodlu("AKT-SBL-001", `aktorler: en çok ${SABLON_AKTOR_TAVANI} aktör (${liste.length} var)`);
  const idler = new Set<string>();
  const duz: { id: string; ust?: unknown }[] = [];
  for (const [i, a] of liste.entries()) {
    const yol = `aktorler[${i}]`;
    if (!nesneMi(a)) return kodlu("AKT-SBL-002", `${yol}: nesne olmalı`);
    for (const k of Object.keys(a)) if (!["id", "nesne", "isik"].includes(k)) return kodlu("AKT-SBL-002", `${yol}.${k}: bilinmeyen alan (id, nesne, isik)`);
    if (!grafAdiGecerli(a["id"])) return kodlu("AKT-SBL-002", `${yol}.id: geçerli kimlik olmalı (harf, rakam, _ ve -)`);
    if (idler.has(a["id"])) return kodlu("AKT-SBL-002", `${yol}.id: yinelenen kimlik "${a["id"]}"`);
    idler.add(a["id"]);
    const n = a["nesne"], k = a["isik"];
    if ((n === undefined) === (k === undefined)) return kodlu("AKT-SBL-002", `${yol}: 'nesne' ya da 'isik' alanlarından TAM biri olmalı`);
    const g = n !== undefined ? (nesneMi(n) ? nesneHata(n) : "nesne: nesne olmalı") : (nesneMi(k) ? isikHata(k) : "isik: nesne olmalı");
    if (g) return kodlu("AKT-SBL-002", `${yol} (${a["id"]}) ${g}`);
    duz.push({ id: a["id"], ust: (nesneMi(n) ? n : nesneMi(k) ? k : {})["ust"] });
  }
  const kokler = duz.filter((a) => a.ust === undefined);
  if (kokler.length !== 1) return kodlu("AKT-SBL-003", `üstsüz TAM bir kök aktör olmalı (${kokler.length} var)`);
  if (v["kok"] !== kokler[0]!.id) return kodlu("AKT-SBL-003", `kok "${String(v["kok"])}" üstsüz aktör "${kokler[0]!.id}" ile aynı olmalı`);
  const h = hiyerarsiHatasi(duz);
  if (h) return kodlu("AKT-SBL-003", `${h.id}: ${h.neden}`);
  return null;
}

type Kayit = { id: string; ust?: string; soket?: string; nesne?: NesneYeri; isik?: IsikAktoru };

/** Level'daki kökün alt ağacı, kökten başlayıp genişlik sırasıyla. */
function altAgac(kume: AktorKumesi, kokId: string): Kayit[] | null {
  const hepsi: Kayit[] = [];
  for (const n of kume.nesneler ?? []) if (n.id) hepsi.push({ id: n.id, ...(n.ust !== undefined ? { ust: n.ust } : {}), nesne: n });
  for (const i of kume.isiklar ?? []) if (i.id) hepsi.push({ id: i.id, ...(i.ust !== undefined ? { ust: i.ust } : {}), isik: i });
  const kok = hepsi.find((a) => a.id === kokId);
  if (!kok) return null;
  const sonuc = [kok], goruldu = new Set([kokId]);
  for (let i = 0; i < sonuc.length; i++) {
    for (const a of hepsi) if (a.ust === sonuc[i]!.id && !goruldu.has(a.id)) { goruldu.add(a.id); sonuc.push(a); }
  }
  return sonuc;
}

/** Derin kopya (JSON güvenli veri; level tanımı zaten JSON). */
const kopya = <T>(v: T): T => structuredClone(v);

/** Level'daki `kokId` aktörünün alt ağacından şablon çıkarır (level'a dokunmaz). `ad` şablon adı (geçerli olmalı). */
export function sablonCikar(ad: string, kume: AktorKumesi, kokId: string, aciklama?: string): SablonSonucu<AktorSablonu> {
  const agac = altAgac(kume, kokId);
  if (!agac) return { ok: false, neden: kodlu("AKT-SBL-004", `'${kokId}' level'da yok`) };
  if (agac.length > SABLON_AKTOR_TAVANI) return { ok: false, neden: kodlu("AKT-SBL-001", `alt ağaç ${agac.length} aktör; şablon en çok ${SABLON_AKTOR_TAVANI}`) };
  const yerel = new Map(agac.map((a, i) => [a.id, `s${i + 1}`]));
  const aktorler: SablonAktoru[] = agac.map((a, i) => {
    const kok = i === 0;
    const eski = (a.nesne ?? a.isik)!;
    const { grup: _grup, id: _id, ...govde } = kopya(eski) as typeof eski & { grup?: string; id?: string };
    const yeni: Record<string, unknown> = govde;
    if (kok) { delete yeni["ust"]; delete yeni["soket"]; yeni["konum"] = [0, 0, 0]; }
    else if (typeof yeni["ust"] === "string") yeni["ust"] = yerel.get(yeni["ust"]);   // alt ağaçtaki çocuğun üstü hep ağaçtadır (beden üstlü aktör ağaçta olmaz)
    return { id: yerel.get(a.id)!, ...(a.nesne ? { nesne: yeni } : { isik: yeni }) } as SablonAktoru;
  });
  const s: AktorSablonu = { surum: SABLON_SURUMU, ad, ...(aciklama ? { aciklama } : {}), kok: "s1", aktorler };
  const h = sablonHatasi(s);
  return h ? { ok: false, neden: h } : { ok: true, deger: s };
}

/**
 * Şablonu level'a yerleştirmek için YENİ aktör listeleri üretir (level'a yazmaz): kök `konum`a konur, kimlikler level'ın kullanmadığı yenilerle değişir,
 * `ust` bağları eşlenir. Geçersiz şablon ya da ışık tavanı aşımı nedenle reddedilir.
 */
export function sablonYerlestir(sablon: unknown, kume: AktorKumesi, konum: Vec3): SablonSonucu<{ nesneler: NesneYeri[]; isiklar: IsikAktoru[]; kok: string }> {
  const h = sablonHatasi(sablon);
  if (h) return { ok: false, neden: h };
  const s = sablon as AktorSablonu;
  const isikSayisi = s.aktorler.filter((a) => a.isik).length;
  const mevcutIsik = kume.isiklar?.length ?? 0;
  if (mevcutIsik + isikSayisi > ISIK_TAVANI) return { ok: false, neden: kodlu("AKT-SBL-005", `${mevcutIsik} ışık var + şablonda ${isikSayisi} = ${mevcutIsik + isikSayisi}; en çok ${ISIK_TAVANI}`) };
  if (!vec3Mi(konum)) return { ok: false, neden: kodlu("AKT-SBL-002", "yerleştirme konumu üç sayı olmalı") };
  const kullanilan = [...(kume.nesneler ?? []), ...(kume.isiklar ?? [])].flatMap((a) => (a.id ? [a.id] : []));
  const nIdler = yeniIdler(kullanilan, s.aktorler.length - isikSayisi, "n");
  const iIdler = yeniIdler(kullanilan, isikSayisi, "i");
  const yeniId = new Map<string, string>();
  for (const a of s.aktorler) yeniId.set(a.id, (a.isik ? iIdler : nIdler).shift()!);
  const nesneler: NesneYeri[] = [], isiklar: IsikAktoru[] = [];
  for (const a of s.aktorler) {
    const id = yeniId.get(a.id)!;
    const govde: Record<string, unknown> = { ...kopya((a.nesne ?? a.isik)!) };
    if (a.id === s.kok) govde["konum"] = [...konum];
    else if (typeof govde["ust"] === "string" && !govde["ust"].startsWith(BEDEN_ONEKI)) govde["ust"] = yeniId.get(govde["ust"]);
    if (a.nesne) nesneler.push({ ...(govde as Omit<NesneYeri, "id">), id });
    else isiklar.push({ ...(govde as Omit<IsikAktoru, "id">), id });
  }
  return { ok: true, deger: { nesneler, isiklar, kok: yeniId.get(s.kok)! } };
}

/** glb içindeki adlı boş düğüm (yerel dönüşüyle): `ad` glb'deki adıdır (`soket_namlu`). Dönüş derece. */
export interface GlbDugumu { ad: string; konum: Vec3; donus: Vec3 }

/**
 * glb'den "Aktör oluştur" (spec 45 §8): kök nesne + `soket_<ad>` adlı boş düğümlerden otomatik `soket` bileşenleri; graf yok (boş). Atlanan düğümler
 * `uyarilar`da kodlu (AKT-SBL-006); hiçbiri sessiz yutulmaz. Babylon'dan düğümleri okumak çağıranın işi (bu işlev düz listeyle çalışır).
 */
export function glbdenSablon(ad: string, varlik: string, dugumler: readonly GlbDugumu[]): SablonSonucu<{ sablon: AktorSablonu; uyarilar: string[] }> {
  const uyarilar: string[] = [], bilesenler: BilesenKaydi[] = [], goruldu = new Set<string>();
  for (const d of dugumler) {
    if (!d.ad.startsWith(GLB_SOKET_ONEKI)) continue;
    const soket = d.ad.slice(GLB_SOKET_ONEKI.length);
    if (!grafAdiGecerli(soket)) { uyarilar.push(kodlu("AKT-SBL-006", `'${d.ad}': soket adı geçersiz`)); continue; }
    if (goruldu.has(soket)) { uyarilar.push(kodlu("AKT-SBL-006", `'${d.ad}': '${soket}' soketi zaten var`)); continue; }
    if (bilesenler.length >= BILESEN_TAVANI) { uyarilar.push(kodlu("AKT-SBL-006", `'${d.ad}': bileşen tavanı (${BILESEN_TAVANI}) dolu`)); continue; }
    goruldu.add(soket);
    bilesenler.push({ id: `soket_${soket}`, tur: "soket", ayar: { ad: soket, konum: [...d.konum], donus: [...d.donus] } });
  }
  const nesne: SablonAktoru["nesne"] = { varlik, konum: [0, 0, 0], donus: 0, olcek: 1, ...(bilesenler.length ? { bilesenler } : {}) };
  const sablon: AktorSablonu = { surum: SABLON_SURUMU, ad, kok: "s1", aktorler: [{ id: "s1", nesne }] };
  const h = sablonHatasi(sablon);
  return h ? { ok: false, neden: h } : { ok: true, deger: { sablon, uyarilar } };
}
