// world/level/ufuk/ufukSehri.ts — Ova GECESİNİN ufuk katmanı, SAF çekirdek: uzak şehir siluetleri + pencereler, sokak lambaları,
// gece ağırlığı, renk sınıfları. Babylon yok (sahnesiz test edilir); sahneye kurulumu `ufuk.ts`.
//
// Neden (Ozyn, ışık dili kararları 2026-10-14, docs/arastirma/isik-dili-kararlari-2026-10-14.md): referansların altısı gece; hepsinde
// SICAK yerel ışık + SOĞUK dolgu ikilisi ve ufukta ışıklı şehir var. Ova gecesinde ikisi de yoktu (tek renk mavi; ölçüm:
// docs/olcum/on-kayit-isik-dili-1.md). Karar 6: "ufukta uzak şehir arka planı, ova'nın kendisine dokunulmaz" → bu katman level
// tanımına GİRMEZ (ova.level.json Ozyn'in dosyası), birleşik dünya onu koddan ekler (`yer/birlesikDunya.ts`).
//
// Şehir NEREDE: uzak arazinin tepe halkası 215–430 m, gök kubbesi 480 m (kameraya yapışık). Şehir halkaların ARKASINDA (433–447 m),
// kameraya yapışık (gök gibi): tepelerin geçitlerinden ve alçak sırtların üstünden görünür, yürüyerek ulaşılamaz, kubbenin arkasına
// düşmez. Ufuk profili glb'den ölçüldü (ön kayıt `docs/olcum/on-kayit-isik-dili-2.md`): −z yönünde (ofisin cam duvarı) 170–230°'de
// geçit (≈2°); yoğunluk tepeleri bu yüzden 195° (geçit), 15° (kapıdan dışarı bakış) ve 300°'de.
// Pencere sistemi: ışık noktaları GEOMETRİ (dörtgen), doku/shader yok — tek mesh, tek çizim; renkler köşe renginde ve SINIF tablosundan
// (halka × duvar/pencere tonu/fener): saat ya da sis değişince yalnız tablo ve köşe renkleri yeniden yazılır.
"use strict";
import { rastgele } from "../cekirdek/rastgele.ts";
import { hex, karistir, type Renk } from "../cekirdek/renk.ts";
import type { LevelTanimi } from "../cekirdek/levelTanimi.ts";

/**
 * Gece sıcak paleti (katı palet kararının — 7: dünya başına 8–12 renk, önce gece — sıcak yarısının ilk renkleri). Soğuk yarısı
 * ova paletinin gece kareleri (`shader/paletler.ts`): dolgu, ay, ufuk, r0/r1.
 */
export const GECE_SICAK = {
  lamba: "#ffb347",
  pencere: ["#ffd27a", "#ffb347", "#ff8c42"],
  fener: "#ff3b30",
} as const;

export interface Halka {
  /** Merkeze bakan ön yüzün uzaklığı (m). */
  yaricap: number;
  /** Bina tepesinin göze göre yüksekliği aralığı (m). */
  tepe: readonly [number, number];
  /** Bina genişliği aralığı (m, teğet yönde). */
  genislik: readonly [number, number];
  /** Pencere yanma olasılığı. */
  yanma: number;
  /** Duvarın sis rengine karışma oranı (atmosfer perspektifi: uzak halka soluk). */
  pus: number;
  /** Pencere parlaklık çarpanı. */
  parlaklik: number;
}

export const HALKALAR: readonly Halka[] = [
  { yaricap: 433, tepe: [4, 40], genislik: [14, 30], yanma: 0.3, pus: 0.22, parlaklik: 1 },
  { yaricap: 438, tepe: [10, 70], genislik: [14, 28], yanma: 0.26, pus: 0.42, parlaklik: 0.85 },
  { yaricap: 443, tepe: [22, 100], genislik: [12, 26], yanma: 0.22, pus: 0.6, parlaklik: 0.7 },
];

export const SEHIR = {
  /** Bina tabanı (göze göre, m): tepeler altını örter — havada duran bina olmasın. */
  taban: -30,
  /**
   * Bina derinliği (radyal, m). Sığ: kubbe (480 m, 18 dilim × 7 bant, kameraya yapışık) düz yüzlü — en yakın yüzünün düzlemi
   * merkezden 469 m'de (test bunu gerçek kubbe geometrisinden ölçer). Bütün köşeler (yükseklik dahil, 3B uzaklık) onun içinde
   * kalmalı, yoksa kubbe binanın tepesini keser. Halkaların yarıçap farkı bu yüzden küçük; uzaklık hissi renkten (pus).
   */
  derinlik: 4,
  /** İki bina arası boşluk aralığı (m). */
  aralik: [0.5, 5] as const,
  /** Pencere ızgarası: kolon ve kat adımı, pencere eni/boyu (m). */
  kolon: 3.4, kat: 3.8, pencereEn: 1.6, pencereBoy: 2.2,
  /** Bu yükseklikten (göze göre) aşağıda pencere yok: tepelerin arkasında kalır, köşe boşa gider. */
  pencereAlt: -4,
  /** Bir katın bütünüyle yanık olma olasılığı (ofis katı). */
  katYanik: 0.06,
  /** En dış halkada bu tepeyi aşan bina taç + ince kule + fener alır. */
  kuleEsik: 80,
  /** Pencerenin duvardan merkeze doğru ayrılması (m): aynı düzlemde titremesin. */
  ayrilma: 0.2,
  tohum: 1453,
} as const;

/** Yoğunluk tepeleri (azimut derece: 0 = +z, 90 = +x; σ derece). Gerekçe dosya başında. */
export const MERKEZLER: readonly { aci: number; sigma: number }[] = [
  { aci: 195, sigma: 35 }, { aci: 15, sigma: 25 }, { aci: 300, sigma: 20 },
];

/** Azimutta (radyan) yoğunluk tepesi 0..1 (en yakın merkezin Gauss'u). */
export function tepeDegeri(aci: number): number {
  let en = 0;
  for (const m of MERKEZLER) {
    const d = ((((aci * 180) / Math.PI - m.aci) % 360) + 540) % 360 - 180;
    en = Math.max(en, Math.exp(-0.5 * (d / m.sigma) ** 2));
  }
  return en;
}

export interface Bina {
  halka: number;
  /** Azimut (radyan; 0 = +z, π/2 = +x), binanın ortası. */
  aci: number;
  en: number;
  tepe: number;
  /** Geri çekilmiş taç (yalnız en dış halkanın yüksekleri). */
  tac?: { en: number; tepe: number };
  /** İnce kule ve tepesinde fener. */
  kule?: { tepe: number };
  /** Pencere deseni tohumu. */
  tohum: number;
}

const ara = (r: () => number, a: readonly [number, number]) => a[0] + (a[1] - a[0]) * r();

/** Tohumlu, deterministik bina listesi (aynı tohum → aynı şehir). */
export function ufukBinalari(tohum: number = SEHIR.tohum): Bina[] {
  const binalar: Bina[] = [];
  HALKALAR.forEach((h, hi) => {
    const r = rastgele((tohum + hi * 7919) >>> 0);
    let aci = r() * 0.02;
    while (true) {
      const en = ara(r, h.genislik), bosluk = ara(r, SEHIR.aralik);
      const orta = aci + en / 2 / h.yaricap;
      if (aci + (en + bosluk) / h.yaricap > Math.PI * 2) break;
      const tepe = tepeDegeri(orta);
      const varMi = r() < 0.2 + 0.8 * tepe;
      const boy = h.tepe[0] + (h.tepe[1] - h.tepe[0]) * r() ** 1.4 * (0.45 + 0.55 * tepe);
      const desen = Math.floor(r() * 2 ** 31);
      const tacR = r(), kuleR = r();
      if (varMi) {
        const b: Bina = { halka: hi, aci: orta, en, tepe: boy, tohum: desen };
        if (hi === HALKALAR.length - 1 && boy > SEHIR.kuleEsik) {
          const tacTepe = boy + (boy - SEHIR.taban) * (0.06 + 0.06 * tacR);
          b.tac = { en: en * 0.6, tepe: tacTepe };
          b.kule = { tepe: tacTepe + 5 + 5 * kuleR };
        }
        binalar.push(b);
      }
      aci += (en + bosluk) / h.yaricap;
    }
  });
  return binalar;
}

// ── Geometri ────────────────────────────────────────────────────────────────

/** Köşe sınıfı: halka × tür. Tür: 0 duvar, 1–3 pencere tonu, 4 fener. */
export const SINIF_TURU = 5;
export const sinifNo = (halka: number, tur: number) => halka * SINIF_TURU + tur;

export interface SehirGeometrisi {
  konum: Float32Array;
  normal: Float32Array;
  indeks: Uint32Array;
  /** Köşe başına sınıf (renk tablosunun dizini). */
  sinif: Uint8Array;
  pencere: number;
}

type V = [number, number, number];

/** Dörtgen ekleyici: 4 köşe (sırayla çevre), dışa bakan normal. Sarım `cekirdek/geometri.ts flatGeometri` ile aynı sözleşme. */
function dortgenci() {
  const konum: number[] = [], normal: number[] = [], indeks: number[] = [], sinif: number[] = [];
  const ekle = (p: readonly V[], n: V, s: number) => {
    const t = konum.length / 3;
    for (const k of p) { konum.push(k[0], k[1], k[2]); normal.push(n[0], n[1], n[2]); sinif.push(s); }
    // (b−a)×(c−a) normale bakıyorsa Babylon (sol elli) ön yüzü a, c, b sırasıdır (flatGeometri'deki not).
    const [a, b, c] = [p[0]!, p[1]!, p[2]!];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cx = e1[1]! * e2[2]! - e1[2]! * e2[1]!, cy = e1[2]! * e2[0]! - e1[0]! * e2[2]!, cz = e1[0]! * e2[1]! - e1[1]! * e2[0]!;
    const ayni = cx * n[0] + cy * n[1] + cz * n[2] >= 0;
    if (ayni) indeks.push(t, t + 2, t + 1, t, t + 3, t + 2);
    else indeks.push(t, t + 1, t + 2, t, t + 2, t + 3);
  };
  return { konum, normal, indeks, sinif, ekle };
}

/** Bina geometrisi (merkeze bakan yüz + iki yan + üst) ve merkeze bakan yüzde yanık pencereler. */
export function sehirGeometrisi(binalar: readonly Bina[]): SehirGeometrisi {
  const d = dortgenci();
  let pencere = 0;
  for (const b of binalar) {
    const h = HALKALAR[b.halka]!;
    const r: V = [Math.sin(b.aci), 0, Math.cos(b.aci)], t: V = [Math.cos(b.aci), 0, -Math.sin(b.aci)];
    const nokta = (radyal: number, teget: number, y: number): V => [r[0] * radyal + t[0] * teget, y, r[2] * radyal + t[2] * teget];
    const ic: V = [-r[0], 0, -r[2]];
    const duvar = sinifNo(b.halka, 0);
    const kutu = (on: number, en: number, alt: number, ust: number, derinlik: number = SEHIR.derinlik) => {
      const arka = on + derinlik, y = en / 2;
      d.ekle([nokta(on, -y, alt), nokta(on, y, alt), nokta(on, y, ust), nokta(on, -y, ust)], ic, duvar);
      d.ekle([nokta(on, -y, alt), nokta(on, -y, ust), nokta(arka, -y, ust), nokta(arka, -y, alt)], [-t[0], 0, -t[2]], duvar);
      d.ekle([nokta(on, y, alt), nokta(arka, y, alt), nokta(arka, y, ust), nokta(on, y, ust)], t, duvar);
      d.ekle([nokta(on, -y, ust), nokta(on, y, ust), nokta(arka, y, ust), nokta(arka, -y, ust)], [0, 1, 0], duvar);
    };
    const rnd = rastgele(b.tohum);
    const pencereler = (on: number, en: number, alt: number, ust: number) => {
      const kolonlar = Math.floor((en - 1.5) / SEHIR.kolon);
      if (kolonlar < 1) return;
      const bas = -((kolonlar - 1) * SEHIR.kolon) / 2;
      const yuz = on - SEHIR.ayrilma;
      for (let y = Math.max(alt + 1.5, SEHIR.pencereAlt); y + SEHIR.pencereBoy <= ust - 1.2; y += SEHIR.kat) {
        const katYanik = rnd() < SEHIR.katYanik;
        for (let k = 0; k < kolonlar; k++) {
          const yanik = rnd() < h.yanma, ton = rnd();
          if (!(katYanik || yanik)) continue;
          const x = bas + k * SEHIR.kolon, w = SEHIR.pencereEn / 2;
          const tur = 1 + Math.min(2, Math.floor(ton * 3));
          d.ekle([nokta(yuz, x - w, y), nokta(yuz, x + w, y), nokta(yuz, x + w, y + SEHIR.pencereBoy), nokta(yuz, x - w, y + SEHIR.pencereBoy)], ic, sinifNo(b.halka, tur));
          pencere++;
        }
      }
    };
    kutu(h.yaricap, b.en, SEHIR.taban, b.tepe);
    pencereler(h.yaricap, b.en, SEHIR.taban, b.tepe);
    if (b.tac) {
      const on = h.yaricap + SEHIR.derinlik * 0.2;
      kutu(on, b.tac.en, b.tepe - 0.5, b.tac.tepe);
      pencereler(on, b.tac.en, b.tepe, b.tac.tepe);
      if (b.kule) {
        const kon = on + SEHIR.derinlik * 0.3;
        kutu(kon, 1.2, b.tac.tepe - 0.5, b.kule.tepe, 1.2);
        const f = 0.8, fy = b.kule.tepe + 0.2;
        d.ekle([nokta(kon - 0.25, -f, fy), nokta(kon - 0.25, f, fy), nokta(kon - 0.25, f, fy + 2 * f), nokta(kon - 0.25, -f, fy + 2 * f)], ic, sinifNo(b.halka, 4));
      }
    }
  }
  return {
    konum: new Float32Array(d.konum), normal: new Float32Array(d.normal), indeks: new Uint32Array(d.indeks),
    sinif: new Uint8Array(d.sinif), pencere,
  };
}

// ── Gece ve renk ────────────────────────────────────────────────────────────

/** Katmanın kapandığı ağırlık (altında şehir ve lambalar kapalı: gündüz çizim/ışık maliyeti yok). */
export const GECE_ESIGI = 0.02;

/**
 * Gece ağırlığı 0..1 (SAF): gece tam, alacakaranlıkta (şafak/akşam) da yanar — lambalar akşam yanar. Zaman tanımsız level'da 0
 * (saat yok: gündüz kabul edilir, `isikSistemi` de öyle).
 */
export function geceAgirligi(d: { gece: number; alacakaranlik: number }, zamanVar: boolean): number {
  if (!zamanVar) return 0;
  return Math.max(0, Math.min(1, Math.max(d.gece, 0.85 * d.alacakaranlik)));
}

const VARSAYILAN_R0 = hex("#0c1428"), VARSAYILAN_R1 = hex("#1f3260");
/** Her karede çağrılır: hex bir kez çözülür. */
const SICAK_ISIKLAR: readonly Renk[] = [...GECE_SICAK.pencere.map(hex), hex(GECE_SICAK.fener)];
const carp = (c: Renk, k: number): Renk => [c[0] * k, c[1] * k, c[2] * k];

/**
 * Sınıf renk tablosu (SAF): duvar = koyu gece (palet r0–r1) → sise `pus` kadar; pencere/fener = sıcak palet × parlaklık, sise biraz.
 * Gece ağırlığı düştükçe hepsi sis rengine solar (gündüze geçişte şehir ufukta erir, sonra kapanır).
 */
export function sinifRenkleri(palet: Readonly<Record<string, Renk>>, sis: Renk, g: number): Renk[] {
  const gece = karistir(palet["r0"] ?? VARSAYILAN_R0, palet["r1"] ?? VARSAYILAN_R1, 0.35);
  const tablo: Renk[] = [];
  for (const h of HALKALAR) {
    const duvar = karistir(sis, karistir(gece, sis, h.pus), g);
    const isik = (r: Renk) => karistir(duvar, karistir(carp(r, h.parlaklik), sis, h.pus * 0.35), g);
    tablo.push(duvar, ...SICAK_ISIKLAR.map(isik));
  }
  return tablo;
}

// ── Sokak lambaları ─────────────────────────────────────────────────────────

export interface SokakLambasi {
  x: number; z: number;
  /** Kolun yönü (+1: +x, −1: −x) — kapı yoluna (x ≈ 2,6) doğru. */
  kol: 1 | -1;
}

/**
 * Ofis terası (plato düz yarıçapı 14 m, `ofisYeri.ts PLATO`): kapının önü ve terasın kenarı, kapı yolunun (x = 2,6) iki yanında.
 * Ofisin ön duvarı z = 4,1; L1 duvardan ~2 m önde (ışığı ofisi aydınlatmaz: ova ışık grubundadır, `birlesikDunya.ts`).
 */
export const SOKAK_LAMBALARI: readonly SokakLambasi[] = [
  { x: 0.9, z: 6.4, kol: 1 },
  { x: 5.6, z: 12.6, kol: -1 },
];

export const LAMBA = {
  boy: 4.6, kol: 1.1, direk: 0.16,
  renk: GECE_SICAK.lamba,
  /** Gece tam şiddet (× gece ağırlığı). Ay ≈ 0,88, dolgu ≈ 0,40 (saat 22): lambanın dibinde lamba baskın olsun. */
  siddet: 2.4,
  /** Menzil (m): Standard malzemede doğrusal düşüş, menzilde 0. */
  menzil: 12,
  /** Işık kaynağı başlığın bu kadar altında (başlığın alt yüzü). */
  kafaAlti: 0.25,
} as const;

/** Lambanın başlık merkezi (ışık bundan `kafaAlti` aşağıda). */
export function lambaKafasi(l: SokakLambasi, zemin: number): V {
  return [l.x + l.kol * LAMBA.kol, zemin + LAMBA.boy - 0.12, l.z];
}

/**
 * Ufuk katmanı açıkken level tanımına yükleme anında uygulanan TEK düzenleme (SAF, girdi değişmez; `ofisYeri.ts ofisiOvayaKur` gibi —
 * ova.level.json değişmez): palet haritası shader'ı gece sıcak pikselleri korusun (`sicakKoru` = 1). Neden: gece rampası mavi; lamba
 * ve pencerelerin sıcağı rampaya boyanıp pembe-griye dönüyordu (sağlık koşusu, ön kayıt dosyası "sapma"). Tanımda alan ZATEN varsa
 * (Ozyn elle koyduysa) dokunulmaz.
 */
export function ufukTanimi(t: LevelTanimi): LevelTanimi {
  const y = structuredClone(t);
  for (const s of y.shaderlar ?? []) {
    if (s.tur !== "paletHaritasi") continue;
    const ayar = (s.ayar ?? {}) as Record<string, unknown>;
    if (!("sicakKoru" in ayar)) s.ayar = { ...ayar, sicakKoru: 1 };
  }
  return y;
}

/** `?ufuk=0` → kapalı; başka her şey (yok dahil) açık. */
export function ufukAcikMi(sorgu: string): boolean {
  return new URLSearchParams(sorgu).get("ufuk") !== "0";
}
