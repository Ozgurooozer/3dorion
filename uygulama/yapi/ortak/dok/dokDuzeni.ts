// uygulama/yapi/ortak/dok/dokDuzeni.ts — DOK DÜZENİ: hangi panel hangi bölgede (spec 39 D3). SAF mantık: DOM/Babylon YOK, her işlem YENİ düzen döndürür.
//
// Unreal'ın sekme kuyusu gibi: bölgeler sol · sağ · alt (her biri sekmeli bir grup) ve yüzer (kendi penceresi). Her panel kayıtta İZİNLİ bölgelerini söyler;
// izinsiz bölgeye bırakma REDDEDİLİR ve nedeni söylenir (sessiz yutma yok). Kapatılan panel `kapali` listesine gider, Pencere menüsünden geri açılır.
// Düzen JSON'a döner (`serilestir`/`oku`); `oku` bozuk/eski kaydı toleranslı okur: bilinmeyen panel düşer, yeni panel varsayılan bölgesine eklenir,
// izinsiz bölgedeki panel varsayılanına döner — yarım kalan bir kayıt dokun açılmasını engellemez.
"use strict";

export type Bolge = "sol" | "sag" | "alt" | "yuzer";
export const BOLGELER: readonly Bolge[] = ["sol", "sag", "alt", "yuzer"];
/** Sekmeli (kenara yaslı) bölgeler; yüzer bölgenin sekmesi/boyutu panel başınadır. */
export type KenarBolge = "sol" | "sag" | "alt";
export const KENAR_BOLGELER: readonly KenarBolge[] = ["sol", "sag", "alt"];

export interface PanelKaydi {
  readonly id: string; readonly ad: string; readonly bolgeler: readonly Bolge[]; readonly varsayilan: Bolge;
  /** Düzen ilk kurulurken (ya da sıfırlanınca) KAPALI başlar, Pencere menüsünden açılır (oyun alanını kendiliğinden daraltmayan paneller: İçerik gezgini). */
  readonly baslangicKapali?: boolean;
}
export interface YuzerKonum { readonly x: number; readonly y: number; readonly g: number; readonly yuk: number }

export interface Duzen {
  readonly gruplar: Readonly<Record<Bolge, readonly string[]>>;
  /** Kenar bölgesinde görünen sekme (grup boşsa null). */
  readonly etkin: Readonly<Record<KenarBolge, string | null>>;
  readonly kapali: readonly string[];
  /** Kenar bölgesinin kalınlığı (px): sol/sağ genişlik, alt yükseklik. */
  readonly boyut: Readonly<Record<KenarBolge, number>>;
  readonly yuzerKonum: Readonly<Record<string, YuzerKonum>>;
}

export const BOYUT_SINIRI: Readonly<Record<KenarBolge, { readonly en_az: number; readonly en_cok: number; readonly varsayilan: number }>> = {
  sol: { en_az: 240, en_cok: 720, varsayilan: 360 },
  sag: { en_az: 240, en_cok: 720, varsayilan: 360 },
  alt: { en_az: 120, en_cok: 600, varsayilan: 300 },
};
export const YUZER_VARSAYILAN: YuzerKonum = { x: 120, y: 120, g: 360, yuk: 300 };
const YUZER_EN_AZ = 160, YUZER_EN_COK = 4000;

export type Ret = "bilinmeyen-panel" | "bolge-izinsiz" | "bilinmeyen-bolge";
export type Sonuc = { readonly ok: true; readonly duzen: Duzen } | { readonly ok: false; readonly ret: Ret; readonly neden: string };

const bolgeAdi: Readonly<Record<Bolge, string>> = { sol: "sol", sag: "sağ", alt: "alt", yuzer: "yüzer" };

function bos(): { sol: string[]; sag: string[]; alt: string[]; yuzer: string[] } { return { sol: [], sag: [], alt: [], yuzer: [] }; }
const kenarEtkin = (g: Readonly<Record<Bolge, readonly string[]>>, onceki: Readonly<Record<KenarBolge, string | null>> | null): Record<KenarBolge, string | null> => {
  const e = { sol: null, sag: null, alt: null } as Record<KenarBolge, string | null>;
  for (const b of KENAR_BOLGELER) e[b] = onceki?.[b] && g[b].includes(onceki[b]!) ? onceki[b]! : (g[b][0] ?? null);
  return e;
};
const boyutSinirla = (b: KenarBolge, px: number): number => Math.round(Math.max(BOYUT_SINIRI[b].en_az, Math.min(BOYUT_SINIRI[b].en_cok, Number.isFinite(px) ? px : BOYUT_SINIRI[b].varsayilan)));

/** Kayıttaki sıra ve varsayılan bölgelerle ilk düzen. */
export function varsayilanDuzen(kayitlar: readonly PanelKaydi[]): Duzen {
  const g = bos(), kapali: string[] = [];
  for (const k of kayitlar) { if (k.baslangicKapali) kapali.push(k.id); else g[k.varsayilan].push(k.id); }
  return {
    gruplar: g, etkin: kenarEtkin(g, null), kapali,
    boyut: { sol: BOYUT_SINIRI.sol.varsayilan, sag: BOYUT_SINIRI.sag.varsayilan, alt: BOYUT_SINIRI.alt.varsayilan },
    yuzerKonum: {},
  };
}

/** Kayıt tutarsızlığı (geliştirici hatası): varsayılan bölge izinli değil, yinelenen kimlik. Boş liste = tutarlı. */
export function kayitHatalari(kayitlar: readonly PanelKaydi[]): string[] {
  const h: string[] = [], gorulen = new Set<string>();
  for (const k of kayitlar) {
    if (gorulen.has(k.id)) h.push(`yinelenen panel kimliği: ${k.id}`);
    gorulen.add(k.id);
    if (k.bolgeler.length === 0) h.push(`${k.id}: izinli bölge yok`);
    if (!k.bolgeler.includes(k.varsayilan)) h.push(`${k.id}: varsayılan bölge (${k.varsayilan}) izinli değil`);
  }
  return h;
}

export const panelBolgesi = (d: Duzen, id: string): Bolge | null => BOLGELER.find((b) => d.gruplar[b].includes(id)) ?? null;

function ret(r: Ret, neden: string): Sonuc { return { ok: false, ret: r, neden }; }
const kayitBul = (kayitlar: readonly PanelKaydi[], id: string): PanelKaydi | undefined => kayitlar.find((k) => k.id === id);

/**
 * Paneli `bolge`ye taşır (`sira`: grup içindeki yer, yoksa sona). Paneli o bölgenin etkin sekmesi yapar. Kapalı panel de taşınınca açılır.
 * İzinsiz bölge → ret + nedeni ("Rig paneli alt bölgeye bırakılamaz: izinli bölgeler sol, sağ").
 */
export function tasi(d: Duzen, kayitlar: readonly PanelKaydi[], id: string, bolge: Bolge, sira?: number): Sonuc {
  const k = kayitBul(kayitlar, id);
  if (!k) return ret("bilinmeyen-panel", `bilinmeyen panel: ${id}`);
  if (!BOLGELER.includes(bolge)) return ret("bilinmeyen-bolge", `bilinmeyen bölge: ${String(bolge)}`);
  if (!k.bolgeler.includes(bolge)) return ret("bolge-izinsiz", `${k.ad} paneli ${bolgeAdi[bolge]} bölgeye bırakılamaz: izinli bölgeler ${k.bolgeler.map((b) => bolgeAdi[b]).join(", ")}`);
  const g = { sol: [...d.gruplar.sol], sag: [...d.gruplar.sag], alt: [...d.gruplar.alt], yuzer: [...d.gruplar.yuzer] };
  for (const b of BOLGELER) g[b] = g[b].filter((x) => x !== id);
  const yer = sira === undefined ? g[bolge].length : Math.max(0, Math.min(g[bolge].length, Math.trunc(sira)));
  g[bolge].splice(yer, 0, id);
  const etkin = { ...kenarEtkin(g, d.etkin) };
  if (bolge !== "yuzer") etkin[bolge] = id;
  const yuzerKonum = bolge === "yuzer" && !d.yuzerKonum[id] ? { ...d.yuzerKonum, [id]: YUZER_VARSAYILAN } : d.yuzerKonum;
  return { ok: true, duzen: { ...d, gruplar: g, etkin, kapali: d.kapali.filter((x) => x !== id), yuzerKonum } };
}

/** Paneli kapatır (Pencere menüsünden geri açılır). Zaten kapalıysa aynı düzen. */
export function kapat(d: Duzen, id: string): Duzen {
  const b = panelBolgesi(d, id);
  if (!b) return d;
  const g = { sol: [...d.gruplar.sol], sag: [...d.gruplar.sag], alt: [...d.gruplar.alt], yuzer: [...d.gruplar.yuzer] };
  g[b] = g[b].filter((x) => x !== id);
  return { ...d, gruplar: g, etkin: kenarEtkin(g, d.etkin), kapali: [...d.kapali, id] };
}

/** Kapalı paneli varsayılan bölgesine açar; zaten açıksa yalnız etkin sekme yapar. */
export function ac(d: Duzen, kayitlar: readonly PanelKaydi[], id: string): Sonuc {
  const k = kayitBul(kayitlar, id);
  if (!k) return ret("bilinmeyen-panel", `bilinmeyen panel: ${id}`);
  const mevcut = panelBolgesi(d, id);
  return mevcut ? tasi(d, kayitlar, id, mevcut, d.gruplar[mevcut].indexOf(id)) : tasi(d, kayitlar, id, k.varsayilan);
}

/** Sekmeye tıklama: o panelin bölgesinde etkin sekme yap. Kenar dışı/bilinmeyen: aynı düzen. */
export function etkinYap(d: Duzen, id: string): Duzen {
  const b = panelBolgesi(d, id);
  if (!b || b === "yuzer" || d.etkin[b] === id) return d;
  return { ...d, etkin: { ...d.etkin, [b]: id } };
}

export function boyutAyarla(d: Duzen, bolge: KenarBolge, px: number): Duzen {
  const v = boyutSinirla(bolge, px);
  return d.boyut[bolge] === v ? d : { ...d, boyut: { ...d.boyut, [bolge]: v } };
}

export function yuzerKonumla(d: Duzen, id: string, k: Partial<YuzerKonum>): Duzen {
  if (!d.gruplar.yuzer.includes(id)) return d;
  const o = d.yuzerKonum[id] ?? YUZER_VARSAYILAN;
  const s = (v: number | undefined, eski: number, en_az: number, en_cok: number) => Math.round(Math.max(en_az, Math.min(en_cok, Number.isFinite(v) ? v! : eski)));
  return { ...d, yuzerKonum: { ...d.yuzerKonum, [id]: { x: s(k.x, o.x, -YUZER_EN_COK, YUZER_EN_COK), y: s(k.y, o.y, 0, YUZER_EN_COK), g: s(k.g, o.g, YUZER_EN_AZ, YUZER_EN_COK), yuk: s(k.yuk, o.yuk, YUZER_EN_AZ, YUZER_EN_COK) } } };
}

export const serilestir = (d: Duzen): string => JSON.stringify({ surum: 1, gruplar: d.gruplar, etkin: d.etkin, kapali: d.kapali, boyut: d.boyut, yuzerKonum: d.yuzerKonum });

const dizi = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const sayi = (v: unknown): number | undefined => typeof v === "number" && Number.isFinite(v) ? v : undefined;

/** Kayıtlı düzeni toleranslı oku. Bozuk metin/sürüm → varsayılan. Her kayıtlı panel EN FAZLA bir yerde: gruplarda ya da `kapali`de. */
export function oku(metin: string | null | undefined, kayitlar: readonly PanelKaydi[]): Duzen {
  const vars = varsayilanDuzen(kayitlar);
  let ham: unknown;
  try { ham = metin ? JSON.parse(metin) : null; } catch { return vars; }
  if (!ham || typeof ham !== "object" || (ham as { surum?: unknown }).surum !== 1) return vars;
  const o = ham as Record<string, unknown>;
  const gHam = (o.gruplar && typeof o.gruplar === "object" ? o.gruplar : {}) as Record<string, unknown>;
  const g = bos(), gorulen = new Set<string>();
  for (const b of BOLGELER) {
    for (const id of dizi(gHam[b])) {
      const k = kayitBul(kayitlar, id);
      if (!k || gorulen.has(id)) continue;
      gorulen.add(id);
      (k.bolgeler.includes(b) ? g[b] : g[k.varsayilan]).push(id);   // izinsiz bölge → varsayılanına dön
    }
  }
  const kapali = dizi(o.kapali).filter((id, i, a) => kayitBul(kayitlar, id) && !gorulen.has(id) && a.indexOf(id) === i);
  for (const k of kayitlar) if (!gorulen.has(k.id) && !kapali.includes(k.id)) { if (k.baslangicKapali) kapali.push(k.id); else g[k.varsayilan].push(k.id); }   // kayıttan sonra eklenen panel
  const eHam = (o.etkin && typeof o.etkin === "object" ? o.etkin : {}) as Record<string, unknown>;
  const bHam = (o.boyut && typeof o.boyut === "object" ? o.boyut : {}) as Record<string, unknown>;
  const boyut = { sol: boyutSinirla("sol", sayi(bHam.sol) ?? vars.boyut.sol), sag: boyutSinirla("sag", sayi(bHam.sag) ?? vars.boyut.sag), alt: boyutSinirla("alt", sayi(bHam.alt) ?? vars.boyut.alt) };
  const etkin = kenarEtkin(g, { sol: typeof eHam.sol === "string" ? eHam.sol : null, sag: typeof eHam.sag === "string" ? eHam.sag : null, alt: typeof eHam.alt === "string" ? eHam.alt : null });
  let d: Duzen = { gruplar: g, etkin, kapali, boyut, yuzerKonum: {} };
  const kHam = (o.yuzerKonum && typeof o.yuzerKonum === "object" ? o.yuzerKonum : {}) as Record<string, Record<string, unknown> | undefined>;
  for (const id of g.yuzer) d = yuzerKonumla({ ...d, yuzerKonum: { ...d.yuzerKonum, [id]: YUZER_VARSAYILAN } }, id, { x: sayi(kHam[id]?.x), y: sayi(kHam[id]?.y), g: sayi(kHam[id]?.g), yuk: sayi(kHam[id]?.yuk) });
  return d;
}
