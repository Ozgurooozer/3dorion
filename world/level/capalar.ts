// world/level/capalar.ts — Çapa kayıt defteri. Babylon import'u YOK (saf veri).
//
// Çapa: sahnede isimle anılan sabit bir nokta. `protocol/temel.ts` içindeki
// `CapaAdi` birliği ile eşleşir. Niyetler ("git masa", "otur sandalye",
// "odaklan monitor") ve algılar (`YakinNesne`) bu deftere bakar.
//
// Neden Babylon yok: T2 (avatar) ve T4 (köprü) bu API'yi okuyacak; ikisi de
// çapa aritmetiği için bir render motoru yüklemek zorunda kalmamalı. Ayrıca
// bu dosya `node --test` altında doğrudan koşabiliyor (capalar.test.ts).
// Babylon `Vector3` gereken yerde `capaGeometri.ts` dönüştürür.
"use strict";
import type { CapaAdi, Vec3 } from "../../protocol/temel.ts";
import { MASA, MONITOR, SANDALYE, TAHTA, PENCERE, KAPI } from "./olculer.ts";

/**
 * Protokoldeki `CapaAdi` + dünyanın eklediği yüzeyler.
 *
 * `monitor` protokolün `CapaAdi` birliğinde YOK ama `OyuncuDurumu.etkilesim`
 * alanı onu isimle anıyor ("monitor" ise terminalde çalışıyor) ve `odaklan`
 * niyeti `capa: string` alıyor — yani protokol kırılmadan genişletilebilir.
 * `protocol/` sabit olduğu için burada genişletiyoruz; protokol sürümü
 * artarsa `CapaAdi` içine taşınmalı.
 */
export type CapaAdiGenis = CapaAdi | "monitor";

/** Dünyada bir çapa tanımı. */
export interface Capa {
  /** Kanonik ad. Niyetlerde bu dize geçer. */
  ad: CapaAdiGenis;
  /** Çapanın kendi noktası — bakılacak/odaklanılacak yer. */
  konum: Vec3;
  /**
   * Avatar/oyuncu buraya gelince duracağı zemin noktası.
   * `konum`dan ayrı: monitöre bakmak için monitörün İÇİNDE durulmaz.
   */
  durak: Vec3;
  /** Durakta hangi yöne bakılacak. Birim vektör, XZ düzleminde. */
  yon: Vec3;
  /**
   * Bu mesafenin altına girildiğinde çapa "erişildi" / "etkileşilebilir"
   * sayılır. `git` niyetinin varış toleransı ve `E` ipucu eşiği budur.
   */
  yaklasmaYaricapi: number;
  /** İzin verilen eylemler: "otur" | "odaklan" | "yaz" | "bak" | "al" ... */
  eylemler: readonly string[];
  /** HUD/altyazıda gösterilecek insan-okur ad. */
  etiket: string;
}

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** Geriye, oyuncuya doğru (+Z'den -Z'ye bakış). */
const ARKAYA = v(0, 0, -1);
const ONE    = v(0, 0, 1);
const SOLA   = v(-1, 0, 0);

/**
 * Kayıt defteri. Sıra anlamlı değil; `capaBul` ada göre arar.
 * Koordinatlar `olculer.ts`'ten türetilir — iki yerde sayı tutulmaz.
 */
const KAYIT: readonly Capa[] = [
  {
    ad: "masa",
    konum: v(MASA.x, MASA.ustYuzey, MASA.z),
    durak: v(MASA.x, 0, -1.85),
    yon: ARKAYA,
    yaklasmaYaricapi: 1.6,
    eylemler: ["odaklan", "al", "birak", "bak"],
    etiket: "çalışma masası",
  },
  {
    ad: "monitor",
    konum: v(MONITOR.x, MONITOR.y, MONITOR.z),
    durak: v(MONITOR.x, 0, -1.85),
    yon: ARKAYA,
    yaklasmaYaricapi: 2.0,
    eylemler: ["odaklan", "kullan", "bak"],
    etiket: "monitör",
  },
  {
    ad: "sandalye",
    konum: v(SANDALYE.x, SANDALYE.oturma, SANDALYE.z),
    durak: v(SANDALYE.x, 0, -1.85),
    yon: ARKAYA,
    yaklasmaYaricapi: 0.9,
    eylemler: ["otur", "kalk"],
    etiket: "sandalye",
  },
  {
    ad: "tahta",
    konum: v(TAHTA.x, TAHTA.y, TAHTA.z),
    durak: v(TAHTA.x + 1.1, 0, TAHTA.z),
    yon: SOLA,
    yaklasmaYaricapi: 1.5,
    eylemler: ["yaz", "odaklan", "bak"],
    etiket: "beyaz tahta",
  },
  {
    ad: "pencere",
    konum: v(PENCERE.x, PENCERE.y, PENCERE.z),
    durak: v(PENCERE.x, 0, PENCERE.z + 1.15),
    yon: ARKAYA,
    yaklasmaYaricapi: 1.6,
    eylemler: ["bak", "odaklan"],
    etiket: "pencere",
  },
  {
    ad: "kapi",
    konum: v(KAPI.x, KAPI.y, KAPI.z),
    durak: v(KAPI.x, 0, KAPI.z - 1.1),
    yon: ONE,
    yaklasmaYaricapi: 1.4,
    eylemler: ["bak"],
    etiket: "kapı",
  },
  {
    ad: "oda_ortasi",
    konum: v(0, 0, 0),
    durak: v(0, 0, 0),
    yon: ARKAYA,
    yaklasmaYaricapi: 1.0,
    eylemler: ["bak"],
    etiket: "odanın ortası",
  },
];

const INDEKS = new Map<string, Capa>(KAYIT.map((c) => [c.ad, c]));

/** Tüm çapalar. Çağıran değiştirmemeli (readonly). */
export function tumCapalar(): readonly Capa[] {
  return KAYIT;
}

/** Yalnızca adlar — `algi: "dunya"` içindeki `capalar` alanı için. */
export function capaAdlari(): string[] {
  return KAYIT.map((c) => c.ad);
}

/**
 * Ada göre çapa bulur. Bilinmeyen ad `null` döner — asla exception atmaz,
 * çünkü ad LLM çıktısından gelebilir ve dünya çökmemeli (bkz. SOZLESME
 * "güvenilmezlik varsayımı"). Çağıran `null`u `sonuc: "hata"`ya çevirir.
 */
export function capaBul(ad: string): Capa | null {
  return INDEKS.get(ad) ?? null;
}

/** Bir çapanın belirli eylemi destekleyip desteklemediği. */
export function eylemVarMi(ad: string, eylem: string): boolean {
  const c = INDEKS.get(ad);
  return c ? c.eylemler.includes(eylem) : false;
}

/** XZ düzleminde mesafe. Y yok sayılır — zeminde yürüyoruz. */
export function mesafeXZ(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * Bir noktanın `yaklasmaYaricapi` içinde kalıp kalmadığı.
 * `git` niyetinin "vardım" kararı ve `E` ipucu eşiği aynı fonksiyonu kullanır.
 */
export function yaklastiMi(ad: string, nokta: { x: number; z: number }): boolean {
  const c = INDEKS.get(ad);
  if (!c) return false;
  return mesafeXZ(nokta, c.durak) <= c.yaklasmaYaricapi;
}

export interface YakinCapa { capa: Capa; mesafe: number }

/**
 * Verilen noktaya `menzil` metre içindeki çapalar, yakından uzağa.
 * T4 bunu `YakinNesne[]` algısına çevirir.
 */
export function yakinCapalar(nokta: { x: number; z: number }, menzil = 3): YakinCapa[] {
  const sonuc: YakinCapa[] = [];
  for (const capa of KAYIT) {
    const mesafe = mesafeXZ(nokta, capa.konum);
    if (mesafe <= menzil) sonuc.push({ capa, mesafe });
  }
  return sonuc.sort((a, b) => a.mesafe - b.mesafe);
}

/**
 * Etkileşimli (en az bir eylemi `bak`tan fazla olan) ve `yaklasmaYaricapi`
 * içindeki en yakın çapa. `E` ipucunu bu belirler.
 */
export function etkilesilebilirCapa(nokta: { x: number; z: number }): Capa | null {
  let enIyi: Capa | null = null;
  let enIyiMesafe = Infinity;
  for (const c of KAYIT) {
    if (c.eylemler.length === 0) continue;
    if (c.eylemler.every((e) => e === "bak")) continue;
    const m = mesafeXZ(nokta, c.durak);
    if (m <= c.yaklasmaYaricapi && m < enIyiMesafe) { enIyi = c; enIyiMesafe = m; }
  }
  return enIyi;
}
