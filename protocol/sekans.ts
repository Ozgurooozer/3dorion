// protocol/sekans.ts — SEKANS biçimi (spec 36; Unreal Sequencer'ın küçük, okunur hâli): zaman çizelgesi, bağlamalar, izler, anahtarlar, klip bölümleri.
//
// NEDEN PROTOKOLDE: sekans Ozyn'in görsel editörde yazdığı (ileride Orion'un önereceği) GÜVENİLMEZ girdidir; `graf.ts`/`animasyon.ts` gibi bağımlılıksız
// (yalnız protokolün kendi dosyaları), elle doğrulanır, TEMİZ kopya döner (bilinmeyen alanlar atılır). Burası YALNIZ BİÇİMİ bilir; değerlendirme
// (`uygulama/sekans/degerlendir.ts`) ve oynatma (`uygulama/sekans/oynatici.ts`) uygulama katmanında. Bağlamanın ajanının defterde olması ve klip
// bölümünün adının yüklü bir klibe karşılık gelmesi ÇALIŞMA ANININ bilgisidir (oynatıcı nedenle reddeder), dosyanınki değil.
//
// KAVRAMLAR:
//   • ZAMAN KARE TABANLIDIR: sabit 30 kare/sn, her zaman alanı TAMSAYI kare (saniye = kare / 30). Kayan nokta zamanı (0.1 + 0.2) iki anahtarı aynı
//     ana düşürüp düşürmeme sorusunu doğurur; tamsayı karede "aynı an" kesindir ve geri sarma/scrub hep aynı kareye oturur.
//   • BAĞLAMA (binding): sekansın sürdüğü ajan — `{ id, ajan }`. İzler ajana ADIYLA değil bağlamanın KİMLİĞİYLE bağlanır: ajanı değiştirmek (orion →
//     flash) izlere dokunmaz. `ajan` ajan defteri kimliği ya da `@ben` ("bu sekansı oynatan ajan"; bugün yalnız oynatıcıya verilirse çözülür).
//   • İZ (track): `tur` KAPALI BİRLEŞİMDİR — bu sürümde `uzuv` (bir soyut uzvun bir kanalı + anahtarlar; anahtar ve yumuşatma biçimi klibinkiyle aynı:
//     `protocol/animasyon.ts`) ve `klip` (klip bölümleri). Bilinmeyen tür ("olay", "kamera") NEDENLE reddedilir: yeni tür yeni sürüm kararıdır
//     (genişleme payı: olay izi, kamera izi buraya yeni bir `tur` olarak girer).
//   • KLİP BÖLÜMÜ (section): `assets/animasyon/<klip>.json` klibinin sekanstaki bir oynanışı: başlangıç karesi, uzunluk, klibin içindeki başlangıç ofseti
//     (kırpılan baş). Bölüm klipten uzunsa döngüsüz klip SON değerinde durur (klibin kendi kuralı); bir izin bölümleri ÜST ÜSTE BİNMEZ (iki klip aynı
//     uzvu aynı anda yazmak isterse ikinci bir iz açılır: değerleri toplanır — uygulama/sekans/degerlendir.ts).
//   • KAMERA (spec 38 §7): sekansın İSİMLİ kameraları (`kameralar`: konum, hedef, görüş alanı) ve KAMERA KESMELERİ (`kesmeler`: şu karede şu kameraya geç,
//     "kesme" ani ya da "yumusak" N karede harmanlı). İz değil, üst düzey alan: kamera bir ajana bağlı değil, sahnenin kendisidir (Unreal'daki Camera Cut
//     izi gibi tek). Alanlar İSTEĞE BAĞLI (yoksa kamera yok; eski dosyalar aynen geçerli, sürüm değişmez). İlk kesmeden ÖNCE oyunun kendi kamerası sürer.
//   • `gizli` iz değerlendirilmez (Unreal'daki "mute"), `kilitli` iz editörde değiştirilmez. İkisi de dosyada tutulur (Ozyn'in kararı kalıcıdır).
// Eksenler, birimler ve öteleme kuralı klibinkiyle AYNI (gövde uzayı; öteleme yalnız `kok`).
"use strict";
import type { Sonuc } from "./dogrula.ts";
import { grafAdiGecerli } from "./graf.ts";
import { KANALLAR, KLIP_SINIRLARI, UZUVLAR, YUMUSATMALAR, klipAdiGecerli, otelemeMi, type Kanal, type Uzuv, type Yumusatma } from "./animasyon.ts";

export const SEKANS_SURUMU = 1;
/** Sabit kare hızı (bu sürümde başka fps yok: dosyadaki `fps` 30 değilse reddedilir). */
export const SEKANS_FPS = 30;

/**
 * Tavanlar: bozuk bir dosya ya da LLM çıktısı editörü/bedeni boğmasın. Süre 60 sn (1800 kare): bir sahne; daha uzunu sekans zinciridir. 8 bağlama (odada
 * bugün 2 ajan), 64 iz (spec 37: tam beden hareketi 17 uzuv × 3 dönme + kök ötelemesi = 52–54 iz; 32'de Kimodo çevirisi 10–15°'lik izleri atmak
 * zorunda kalıyordu — ölçüldü), iz başına 256 anahtar (kare başına bir anahtarla 8.5 sn — elle yazılan için bol), iz başına 32 bölüm, klip içi ofset en çok
 * 300 kare (klip tavanı 10 sn). Ölçülmedi; editörün çizim yükü bu sayılarla sınırlı kalsın diye.
 */
export const SEKANS_SINIRLARI = {
  sure_kare: 1800, baglama: 8, iz: 64, anahtar: 256, bolum: 32, ofset_kare: KLIP_SINIRLARI.sure * SEKANS_FPS, ad: 48, id: 32, aciklama: 300,
  /** Kamera: sekans başına 8 isimli kamera, 64 kesme, ad en çok 32, koordinat ±1000 m, görüş alanı 10–120°, harman en çok 90 kare (3 sn). */
  kamera: 8, kesme: 64, kamera_ad: 32, koordinat: 1000, fov_en_az: 10, fov_en_cok: 120, harman_kare: 90,
} as const;

export const IZ_TURLERI = ["uzuv", "klip"] as const;
export type IzTuru = (typeof IZ_TURLERI)[number];

/** "Bu sekansı oynatan ajan" (grafiğin `@ben`iyle aynı yazım). */
export const BEN = "@ben";

export interface SekansAnahtari {
  /** Sekansın başından kare (0 ≤ kare ≤ sure_kare, tamsayı); bir izde KESİN artan. */
  kare: number;
  /** Derece (dönme) ya da metre (öteleme). */
  deger: number;
  /** Bu anahtardan sonrakine geçiş (klip anahtarının kuralı; temiz kopyada hep dolu). */
  yumusatma: Yumusatma;
}

interface IzOrtak {
  /** İzin kimliği (sekans içinde tekil; editör seçimi ve geri al bununla). */
  id: string;
  /** Bağlamanın kimliği (ajanın adı DEĞİL). */
  baglama: string;
  gizli: boolean;
  kilitli: boolean;
}

export interface UzuvIzi extends IzOrtak {
  tur: "uzuv";
  uzuv: Uzuv;
  kanal: Kanal;
  anahtarlar: SekansAnahtari[];
}

export interface KlipBolumu {
  /** Klip adı (`assets/animasyon/<klip>.json`). */
  klip: string;
  baslangic_kare: number;
  uzunluk_kare: number;
  /** Klibin içinden başlanan kare (kırpılan baş); 0 = klibin başı. */
  ofset_kare: number;
}

export interface SekansKlipIzi extends IzOrtak {
  tur: "klip";
  /** Başlangıca göre sıralı, üst üste binmeyen bölümler. */
  bolumler: KlipBolumu[];
}

export type SekansIzi = UzuvIzi | SekansKlipIzi;

export type Nokta3 = [number, number, number];
export const KAMERA_GECISLERI = ["kesme", "yumusak"] as const;
export type KameraGecisi = (typeof KAMERA_GECISLERI)[number];

/** İsimli kamera: dünya konumu, baktığı nokta (metre) ve dikey görüş alanı (derece). */
export interface SekansKamerasi { id: string; ad: string; konum: Nokta3; hedef: Nokta3; fov: number }

/** "Bu karede şu kameraya geç": `kesme` ani; `yumusak` önceki kameradan `gecis_kare` karede harmanlar (önceki kamera yoksa ani). */
export interface KameraKesmesi { kare: number; kamera: string; gecis: KameraGecisi; gecis_kare: number }

export interface Baglama {
  id: string;
  /** Ajan defteri kimliği ("orion", "flash") ya da `@ben`. */
  ajan: string;
}

/** Oynatma aralığı (Unreal'daki yeşil/kırmızı işaretler): ▶ ve döngü bu aralıkta; 0 ≤ bas < bit ≤ sure_kare. */
export interface OynatmaAraligi { bas: number; bit: number }

export interface Sekans {
  surum: typeof SEKANS_SURUMU;
  /** Ad = dosya adı (`<userData>/orion-sekans/<ad>.json`); kural grafik adınınki (aynı fonksiyon). */
  ad: string;
  aciklama?: string;
  fps: typeof SEKANS_FPS;
  /** Sekansın uzunluğu (kare, 1..1800). */
  sure_kare: number;
  aralik: OynatmaAraligi;
  baglamalar: Baglama[];
  izler: SekansIzi[];
  /** İsimli kameralar (boşsa alan yazılmaz). */
  kameralar?: SekansKamerasi[];
  /** Kamera kesmeleri, kareye göre KESİN artan (boşsa alan yazılmaz). */
  kesmeler?: KameraKesmesi[];
}

/** Sekans adı kuralı grafik/NPC adınınkiyle AYNI (dosya adı olarak güvenli: harf, rakam, _ ve -; en çok 48). Kopya kural yok: aynı fonksiyon. */
export const sekansAdiGecerli = grafAdiGecerli;

const KIMLIK_DESENI = /^[a-z0-9_]+$/;
/** İz ve bağlama kimliği: küçük harf, rakam, `_` (en çok 32). */
export const kimlikGecerli = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= SEKANS_SINIRLARI.id && KIMLIK_DESENI.test(v);
/** Bağlamanın ajanı: ajan kimliği biçimi ya da `@ben`. Defterde olması oynatırken denetlenir. */
export const ajanYazimiGecerli = (v: unknown): v is string => v === BEN || kimlikGecerli(v);

export const kareSaniye = (kare: number): number => kare / SEKANS_FPS;

const nesneMi = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const tamsayi = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const hata = (m: string): Sonuc<never> => ({ ok: false, hata: m });

function bayrak(v: unknown, alan: string): Sonuc<boolean> {
  if (v === undefined) return { ok: true, deger: false };
  return typeof v === "boolean" ? { ok: true, deger: v } : hata(`${alan}: true/false olmalı`);
}

function anahtarlarDogrula(v: unknown, alan: string, kanal: Kanal, sure: number): Sonuc<SekansAnahtari[]> {
  if (!Array.isArray(v)) return hata(`${alan}: dizi olmalı (boş olabilir)`);
  if (v.length > SEKANS_SINIRLARI.anahtar) return hata(`${alan}: en çok ${SEKANS_SINIRLARI.anahtar} anahtar (gelen ${v.length})`);
  const sinir = otelemeMi(kanal) ? KLIP_SINIRLARI.oteleme : KLIP_SINIRLARI.donme;
  const birim = otelemeMi(kanal) ? "m" : "°";
  const l: SekansAnahtari[] = [];
  for (const [i, a] of v.entries()) {
    const ya = `${alan}[${i}]`;
    if (!nesneMi(a)) return hata(`${ya}: nesne olmalı`);
    if (!tamsayi(a.kare)) return hata(`${ya}.kare: tamsayı olmalı (kare; saniye = kare / ${SEKANS_FPS})`);
    if (a.kare < 0 || a.kare > sure) return hata(`${ya}.kare: ${a.kare} sekansın dışında (0–${sure})`);
    const onceki = l[l.length - 1];
    if (onceki && a.kare <= onceki.kare) return hata(`${ya}.kare: anahtarlar karece KESİN artmalı (${onceki.kare} → ${a.kare})`);
    if (typeof a.deger !== "number" || !Number.isFinite(a.deger)) return hata(`${ya}.deger: sonlu sayı olmalı`);
    if (Math.abs(a.deger) > sinir) return hata(`${ya}.deger: ${a.deger}${birim} aralık dışı (±${sinir}${birim})`);
    if (a.yumusatma !== undefined && !YUMUSATMALAR.includes(a.yumusatma as Yumusatma)) return hata(`${ya}.yumusatma geçersiz: ${JSON.stringify(a.yumusatma)} (geçerli: ${YUMUSATMALAR.join(", ")})`);
    l.push({ kare: a.kare, deger: a.deger, yumusatma: (a.yumusatma as Yumusatma | undefined) ?? "dogrusal" });
  }
  return { ok: true, deger: l };
}

function bolumlerDogrula(v: unknown, alan: string, sure: number): Sonuc<KlipBolumu[]> {
  if (!Array.isArray(v)) return hata(`${alan}: dizi olmalı (boş olabilir)`);
  if (v.length > SEKANS_SINIRLARI.bolum) return hata(`${alan}: en çok ${SEKANS_SINIRLARI.bolum} bölüm (gelen ${v.length})`);
  const l: KlipBolumu[] = [];
  for (const [i, b] of v.entries()) {
    const ya = `${alan}[${i}]`;
    if (!nesneMi(b)) return hata(`${ya}: nesne olmalı`);
    if (!klipAdiGecerli(b.klip)) return hata(`${ya}.klip geçersiz: ${JSON.stringify(b.klip)} (klip adı: küçük harf, rakam ve _)`);
    if (!tamsayi(b.baslangic_kare) || b.baslangic_kare < 0) return hata(`${ya}.baslangic_kare: 0 ya da büyük tamsayı olmalı`);
    if (!tamsayi(b.uzunluk_kare) || b.uzunluk_kare < 1) return hata(`${ya}.uzunluk_kare: en az 1 olan tamsayı olmalı`);
    if (b.baslangic_kare + b.uzunluk_kare > sure) return hata(`${ya}: bölüm sekansın sonunu aşıyor (${b.baslangic_kare} + ${b.uzunluk_kare} > ${sure})`);
    const ofset = b.ofset_kare ?? 0;
    if (!tamsayi(ofset) || ofset < 0 || ofset > SEKANS_SINIRLARI.ofset_kare) return hata(`${ya}.ofset_kare: 0–${SEKANS_SINIRLARI.ofset_kare} tamsayı olmalı (klibin içinden başlanan kare)`);
    l.push({ klip: b.klip, baslangic_kare: b.baslangic_kare, uzunluk_kare: b.uzunluk_kare, ofset_kare: ofset });
  }
  // Temiz kopya başlangıca göre SIRALI (editörün vuruş ve komşu kuralları sıraya dayanır); üst üste binme reddi sıralı listede.
  l.sort((a, b) => a.baslangic_kare - b.baslangic_kare);
  for (let i = 1; i < l.length; i++) {
    const o = l[i - 1]!, s = l[i]!;
    if (s.baslangic_kare < o.baslangic_kare + o.uzunluk_kare) return hata(`${alan}: '${o.klip}' (${o.baslangic_kare}–${o.baslangic_kare + o.uzunluk_kare}) ile '${s.klip}' (${s.baslangic_kare}…) üst üste biniyor (bir izde bölümler ayrı; aynı anda iki klip için ikinci bir klip izi aç)`);
  }
  return { ok: true, deger: l };
}

const SAYI3 = (v: unknown): v is Nokta3 => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x));

function kameralarDogrula(v: unknown): Sonuc<SekansKamerasi[]> {
  if (!Array.isArray(v)) return hata("kameralar: dizi olmalı");
  if (v.length > SEKANS_SINIRLARI.kamera) return hata(`kameralar: en çok ${SEKANS_SINIRLARI.kamera} (gelen ${v.length})`);
  const l: SekansKamerasi[] = [];
  for (const [i, k] of v.entries()) {
    const ya = `kameralar[${i}]`;
    if (!nesneMi(k)) return hata(`${ya}: nesne olmalı`);
    if (!kimlikGecerli(k.id)) return hata(`${ya}.id geçersiz: ${JSON.stringify(k.id)} (küçük harf, rakam, _)`);
    if (l.some((x) => x.id === k.id)) return hata(`${ya}.id: '${k.id}' iki kez`);
    if (typeof k.ad !== "string" || !k.ad.trim() || k.ad.length > SEKANS_SINIRLARI.kamera_ad) return hata(`${ya}.ad: 1–${SEKANS_SINIRLARI.kamera_ad} karakterlik metin olmalı`);
    for (const alan of ["konum", "hedef"] as const) {
      const n = k[alan];
      if (!SAYI3(n)) return hata(`${ya}.${alan}: [x, y, z] üç sayı olmalı`);
      if (n.some((x) => Math.abs(x) > SEKANS_SINIRLARI.koordinat)) return hata(`${ya}.${alan}: koordinat ±${SEKANS_SINIRLARI.koordinat} m dışında`);
    }
    const konum = k.konum as Nokta3, hedef = k.hedef as Nokta3;
    if (Math.hypot(konum[0] - hedef[0], konum[1] - hedef[1], konum[2] - hedef[2]) < 0.01) return hata(`${ya}: konum ile hedef aynı nokta (yön belirsiz; en az 1 cm uzakta olmalı)`);
    if (typeof k.fov !== "number" || !Number.isFinite(k.fov) || k.fov < SEKANS_SINIRLARI.fov_en_az || k.fov > SEKANS_SINIRLARI.fov_en_cok) return hata(`${ya}.fov: ${SEKANS_SINIRLARI.fov_en_az}–${SEKANS_SINIRLARI.fov_en_cok}° olmalı (gelen ${String(k.fov)})`);
    l.push({ id: k.id, ad: k.ad.trim(), konum: [...konum], hedef: [...hedef], fov: k.fov });
  }
  return { ok: true, deger: l };
}

function kesmelerDogrula(v: unknown, sure: number, kameralar: readonly SekansKamerasi[]): Sonuc<KameraKesmesi[]> {
  if (!Array.isArray(v)) return hata("kesmeler: dizi olmalı");
  if (v.length > SEKANS_SINIRLARI.kesme) return hata(`kesmeler: en çok ${SEKANS_SINIRLARI.kesme} (gelen ${v.length})`);
  const l: KameraKesmesi[] = [];
  for (const [i, k] of v.entries()) {
    const ya = `kesmeler[${i}]`;
    if (!nesneMi(k)) return hata(`${ya}: nesne olmalı`);
    if (!tamsayi(k.kare) || k.kare < 0 || k.kare > sure) return hata(`${ya}.kare: 0–${sure} tamsayı olmalı`);
    const o = l[l.length - 1];
    if (o && k.kare <= o.kare) return hata(`${ya}.kare: kesmeler karece KESİN artmalı (${o.kare} → ${k.kare})`);
    if (typeof k.kamera !== "string" || !kameralar.some((x) => x.id === k.kamera)) return hata(`${ya}.kamera: ${JSON.stringify(k.kamera)} kameralarda yok (var: ${kameralar.map((x) => x.id).join(", ") || "yok"})`);
    const gecis = k.gecis ?? "kesme";
    if (!KAMERA_GECISLERI.includes(gecis as KameraGecisi)) return hata(`${ya}.gecis geçersiz: ${JSON.stringify(k.gecis)} (geçerli: ${KAMERA_GECISLERI.join(", ")})`);
    let gk: unknown = k.gecis_kare ?? 0;
    if (!tamsayi(gk) || gk < 0 || gk > SEKANS_SINIRLARI.harman_kare) return hata(`${ya}.gecis_kare: 0–${SEKANS_SINIRLARI.harman_kare} tamsayı olmalı`);
    if (gecis === "yumusak" && gk < 1) return hata(`${ya}: 'yumusak' geçiş için gecis_kare en az 1 olmalı (ani geçiş için 'kesme')`);
    if (gecis === "kesme") gk = 0;
    l.push({ kare: k.kare, kamera: k.kamera, gecis: gecis as KameraGecisi, gecis_kare: gk as number });
  }
  return { ok: true, deger: l };
}

function izDogrula(v: unknown, alan: string, sure: number, baglamalar: ReadonlySet<string>): Sonuc<SekansIzi> {
  if (!nesneMi(v)) return hata(`${alan}: nesne olmalı`);
  if (!kimlikGecerli(v.id)) return hata(`${alan}.id geçersiz: ${JSON.stringify(v.id)} (küçük harf, rakam, _; en çok ${SEKANS_SINIRLARI.id})`);
  if (typeof v.baglama !== "string" || !baglamalar.has(v.baglama)) return hata(`${alan}.baglama: ${JSON.stringify(v.baglama)} bağlamalarda yok (var: ${[...baglamalar].join(", ") || "yok"})`);
  if (!IZ_TURLERI.includes(v.tur as IzTuru)) return hata(`${alan}.tur: bilinmeyen iz türü ${JSON.stringify(v.tur)} (bu sürümde: ${IZ_TURLERI.join(", ")})`);
  const gizli = bayrak(v.gizli, `${alan}.gizli`); if (!gizli.ok) return gizli;
  const kilitli = bayrak(v.kilitli, `${alan}.kilitli`); if (!kilitli.ok) return kilitli;
  const ortak = { id: v.id, baglama: v.baglama, gizli: gizli.deger, kilitli: kilitli.deger };
  if (v.tur === "klip") {
    const b = bolumlerDogrula(v.bolumler, `${alan}.bolumler`, sure);
    return b.ok ? { ok: true, deger: { ...ortak, tur: "klip", bolumler: b.deger } } : b;
  }
  if (!UZUVLAR.includes(v.uzuv as Uzuv)) return hata(`${alan}.uzuv geçersiz: ${JSON.stringify(v.uzuv)} (geçerli: ${UZUVLAR.join(", ")})`);
  if (!KANALLAR.includes(v.kanal as Kanal)) return hata(`${alan}.kanal geçersiz: ${JSON.stringify(v.kanal)} (geçerli: ${KANALLAR.join(", ")})`);
  const uzuv = v.uzuv as Uzuv, kanal = v.kanal as Kanal;
  if (otelemeMi(kanal) && uzuv !== "kok") return hata(`${alan}: '${kanal}' yalnız 'kok' uzvunda olur (tek uzvu ötelemek gövdeyi yırtar)`);
  const a = anahtarlarDogrula(v.anahtarlar, `${alan}.anahtarlar`, kanal, sure);
  return a.ok ? { ok: true, deger: { ...ortak, tur: "uzuv", uzuv, kanal, anahtarlar: a.deger } } : a;
}

/** Gelen sekans GÜVENİLMEZ girdidir: biçimi doğrular ve TEMİZ bir kopya döner. Hata metni neyin NEREDE bozuk olduğunu ve geçerli seçenekleri söyler. */
export function sekansDogrula(ham: unknown): Sonuc<Sekans> {
  if (!nesneMi(ham)) return hata("sekans nesne olmalı");
  if (ham.surum !== SEKANS_SURUMU) return hata(`surum ${SEKANS_SURUMU} olmalı (gelen: ${String(ham.surum)})`);
  if (!sekansAdiGecerli(ham.ad)) return hata(`ad geçersiz: ${JSON.stringify(ham.ad)} (harf, rakam, _ ve -; en çok ${SEKANS_SINIRLARI.ad})`);
  if (ham.aciklama !== undefined && (typeof ham.aciklama !== "string" || ham.aciklama.length > SEKANS_SINIRLARI.aciklama)) return hata(`aciklama metin olmalı (en çok ${SEKANS_SINIRLARI.aciklama})`);
  if (ham.fps !== SEKANS_FPS) return hata(`fps: yalnız ${SEKANS_FPS} (bu sürümde sabit; gelen: ${String(ham.fps)})`);
  if (!tamsayi(ham.sure_kare) || ham.sure_kare < 1 || ham.sure_kare > SEKANS_SINIRLARI.sure_kare) return hata(`sure_kare: 1–${SEKANS_SINIRLARI.sure_kare} tamsayı olmalı (${SEKANS_SINIRLARI.sure_kare / SEKANS_FPS} sn; gelen: ${String(ham.sure_kare)})`);
  const sure = ham.sure_kare;
  let aralik: OynatmaAraligi = { bas: 0, bit: sure };
  if (ham.aralik !== undefined) {
    const r = ham.aralik;
    if (!nesneMi(r) || !tamsayi(r.bas) || !tamsayi(r.bit)) return hata("aralik: { bas, bit } tamsayı kareler olmalı");
    if (r.bas < 0 || r.bit > sure || r.bas >= r.bit) return hata(`aralik: 0 ≤ bas < bit ≤ ${sure} olmalı (gelen ${r.bas}–${r.bit})`);
    aralik = { bas: r.bas, bit: r.bit };
  }
  if (!Array.isArray(ham.baglamalar)) return hata("baglamalar: dizi olmalı");
  if (ham.baglamalar.length > SEKANS_SINIRLARI.baglama) return hata(`baglamalar: en çok ${SEKANS_SINIRLARI.baglama} (gelen ${ham.baglamalar.length})`);
  const baglamalar: Baglama[] = [];
  for (const [i, b] of ham.baglamalar.entries()) {
    const ya = `baglamalar[${i}]`;
    if (!nesneMi(b)) return hata(`${ya}: nesne olmalı`);
    if (!kimlikGecerli(b.id)) return hata(`${ya}.id geçersiz: ${JSON.stringify(b.id)} (küçük harf, rakam, _)`);
    if (baglamalar.some((x) => x.id === b.id)) return hata(`${ya}.id: '${b.id}' iki kez`);
    if (!ajanYazimiGecerli(b.ajan)) return hata(`${ya}.ajan geçersiz: ${JSON.stringify(b.ajan)} (ajan kimliği — orion, flash — ya da ${BEN})`);
    // Aynı ajan iki bağlamada: iki iz kümesi aynı bedeni yazmak isterdi (hangisi kazanır sorusu). Biçim reddeder; tek bağlama altında izler toplanır.
    if (baglamalar.some((x) => x.ajan === b.ajan)) return hata(`${ya}.ajan: '${b.ajan}' başka bir bağlamada da var (bir ajan tek bağlama)`);
    baglamalar.push({ id: b.id, ajan: b.ajan });
  }
  if (!Array.isArray(ham.izler)) return hata("izler: dizi olmalı");
  if (ham.izler.length > SEKANS_SINIRLARI.iz) return hata(`izler: en çok ${SEKANS_SINIRLARI.iz} iz (gelen ${ham.izler.length})`);
  const bset = new Set(baglamalar.map((b) => b.id));
  const izler: SekansIzi[] = [];
  const uzuvAnahtari = new Set<string>();
  for (const [i, v] of ham.izler.entries()) {
    const r = izDogrula(v, `izler[${i}]`, sure, bset);
    if (!r.ok) return r;
    if (izler.some((x) => x.id === r.deger.id)) return hata(`izler[${i}].id: '${r.deger.id}' iki kez`);
    if (r.deger.tur === "uzuv") {
      // Aynı bağlamanın aynı uzuv+kanalı iki izde: sessiz ezme ya da gizli toplama yerine biçim reddeder (klibin kuralı).
      const k = `${r.deger.baglama}.${r.deger.uzuv}.${r.deger.kanal}`;
      if (uzuvAnahtari.has(k)) return hata(`izler[${i}]: '${k}' iki kez (bir bağlamanın bir uzuv kanalı tek izdir)`);
      uzuvAnahtari.add(k);
    }
    izler.push(r.deger);
  }
  let kameralar: SekansKamerasi[] = [], kesmeler: KameraKesmesi[] = [];
  if (ham.kameralar !== undefined) { const r = kameralarDogrula(ham.kameralar); if (!r.ok) return r; kameralar = r.deger; }
  if (ham.kesmeler !== undefined) { const r = kesmelerDogrula(ham.kesmeler, sure, kameralar); if (!r.ok) return r; kesmeler = r.deger; }
  return {
    ok: true,
    deger: {
      surum: SEKANS_SURUMU, ad: ham.ad, ...(typeof ham.aciklama === "string" ? { aciklama: ham.aciklama } : {}),
      fps: SEKANS_FPS, sure_kare: sure, aralik, baglamalar, izler,
      ...(kameralar.length ? { kameralar } : {}), ...(kesmeler.length ? { kesmeler } : {}),
    },
  };
}

/** Kartın ve günlüğün gördüğü özet. */
export interface SekansOzeti { ad: string; aciklama?: string; sure_kare: number; ajanlar: string[]; iz: number; klipler: string[] }

export function sekansOzeti(s: Sekans): SekansOzeti {
  const klipler: string[] = [];
  for (const iz of s.izler) if (iz.tur === "klip") for (const b of iz.bolumler) if (!klipler.includes(b.klip)) klipler.push(b.klip);
  return { ad: s.ad, ...(s.aciklama !== undefined ? { aciklama: s.aciklama } : {}), sure_kare: s.sure_kare, ajanlar: s.baglamalar.map((b) => b.ajan), iz: s.izler.length, klipler };
}
