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
import { CAPA_ETIKETLERI, type CapaAdi, type Vec3 } from "../../protocol/temel.ts";
import { MASA, MONITOR, SANDALYE, TAHTA, PENCERE, KAPI, SEMA, GUNLUK, ADMIN } from "./olculer.ts";

/**
 * @deprecated `monitor` artık protokolün `CapaAdi` birliğinde. Doğrudan
 * `CapaAdi` kullan; bu takma ad geçiş için duruyor.
 */
export type CapaAdiGenis = CapaAdi;

/** Dünyada bir çapa tanımı. */
export interface Capa {
  /** Kanonik ad. Niyetlerde bu dize geçer. */
  ad: CapaAdi;
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
  /**
   * SANAL çapa: gidilebilir bir hedef ama GÖRÜLEBİLİR bir nesne değil.
   *
   * `oda_ortasi` böyledir — orada duran bir şey yok, yalnızca bir koordinat.
   * Algı hizmeti bunları atlar; yoksa Orion "yakınında odanın ortası var"
   * gibi anlamsız şeyler söylüyor (canlı ölçümde tam olarak bu oldu).
   */
  sanal?: true;
}

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** Geriye, oyuncuya doğru (+Z'den -Z'ye bakış). */
const ARKAYA = v(0, 0, -1);
const ONE    = v(0, 0, 1);
const SOLA   = v(-1, 0, 0);
const SAGA   = v(1, 0, 0);

/**
 * Kayıt defteri. Sıra anlamlı değil; `capaBul` ada göre arar.
 * Koordinatlar `olculer.ts`'ten türetilir — iki yerde sayı tutulmaz.
 */
const KAYIT: readonly Capa[] = [
  {
    ad: "masa",
    konum: v(MASA.x, MASA.ustYuzey, MASA.z),
    durak: v(MASA.x, 0, -1.62),
    yon: ARKAYA,
    yaklasmaYaricapi: 1.6,
    eylemler: ["odaklan", "al", "birak", "bak"],
    etiket: CAPA_ETIKETLERI.masa,
  },
  {
    ad: "monitor",
    konum: v(MONITOR.x, MONITOR.y, MONITOR.z),
    durak: v(MONITOR.x, 0, -1.62),
    yon: ARKAYA,
    yaklasmaYaricapi: 2.0,
    eylemler: ["odaklan", "kullan", "bak"],
    etiket: CAPA_ETIKETLERI.monitor,
  },
  {
    ad: "sandalye",
    konum: v(SANDALYE.x, SANDALYE.oturma, SANDALYE.z),
    durak: v(SANDALYE.x, 0, -1.62),
    yon: ARKAYA,
    yaklasmaYaricapi: 0.9,
    eylemler: ["otur", "kalk"],
    etiket: CAPA_ETIKETLERI.sandalye,
  },
  {
    ad: "tahta",
    konum: v(TAHTA.x, TAHTA.y, TAHTA.z),
    durak: v(TAHTA.x + 1.1, 0, TAHTA.z),
    yon: SOLA,
    yaklasmaYaricapi: 1.5,
    eylemler: ["yaz", "odaklan", "bak"],
    etiket: CAPA_ETIKETLERI.tahta,
  },
  {
    ad: "pencere",
    konum: v(PENCERE.x, PENCERE.y, PENCERE.z),
    durak: v(PENCERE.x, 0, PENCERE.z + 1.15),
    yon: ARKAYA,
    yaklasmaYaricapi: 1.6,
    eylemler: ["bak", "odaklan"],
    etiket: CAPA_ETIKETLERI.pencere,
  },
  {
    ad: "kapi",
    konum: v(KAPI.x, KAPI.y, KAPI.z),
    durak: v(KAPI.x, 0, KAPI.z - 1.1),
    yon: ONE,
    yaklasmaYaricapi: 1.4,
    eylemler: ["bak"],
    etiket: CAPA_ETIKETLERI.kapi,
  },
  // ── Zihin duvarı (sağ duvar, normal -X) ────────────────────────────────
  // Durak panelin SOLUNDA (-X yönünde), yüzü duvara dönük: SAGA bakış.
  {
    ad: "sema",
    konum: v(SEMA.x, SEMA.y, SEMA.z),
    durak: v(SEMA.x - 1.35, 0, SEMA.z),
    yon: SAGA,
    yaklasmaYaricapi: 1.8,
    eylemler: ["bak", "odaklan"],
    etiket: CAPA_ETIKETLERI.sema,
  },
  {
    ad: "gunluk",
    konum: v(GUNLUK.x, GUNLUK.y, GUNLUK.z),
    durak: v(GUNLUK.x - 1.35, 0, GUNLUK.z),
    yon: SAGA,
    yaklasmaYaricapi: 1.8,
    eylemler: ["bak", "odaklan"],
    etiket: CAPA_ETIKETLERI.gunluk,
  },
  {
    ad: "admin",
    konum: v(ADMIN.x, ADMIN.y, ADMIN.z),
    durak: v(ADMIN.x, 0, -1.62),
    yon: ARKAYA,
    yaklasmaYaricapi: 1.6,
    eylemler: ["odaklan", "kullan", "bak"],
    etiket: CAPA_ETIKETLERI.admin,
  },
  {
    ad: "oda_ortasi",
    sanal: true,
    konum: v(0, 0, 0),
    durak: v(0, 0, 0),
    yon: ARKAYA,
    yaklasmaYaricapi: 1.0,
    eylemler: ["bak"],
    etiket: CAPA_ETIKETLERI.oda_ortasi,
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

/** `bulunduguCapa`nın asgari yarıçapı (m): küçük yaklaşma yarıçaplı çapada da "orada" sayılabilsin. */
export const BULUNMA_YARICAPI = 1.2;
/** Mevcut yerin bırakılması için başka bir durağın ondan ne kadar daha yakın olması gerektiği (m). */
export const YER_HISTEREZISI = 0.3;

/**
 * Noktanın BULUNDUĞU çapa: durağı en yakın olan, `max(BULUNMA_YARICAPI, yaklasmaYaricapi)` içindeyse.
 * Hiçbirinin yanında değilse `null` (odanın ortası). Durum defterinin "konum"u bundan türer
 * (spec 16 F2) — ham koordinat modele bir şey anlatmıyordu.
 */
export function bulunduguCapa(nokta: { x: number; z: number }, mevcutEtiket?: string): Capa | null {
  let en: Capa | null = null;
  let enMesafe = Infinity;
  for (const c of KAYIT) {
    const m = mesafeXZ(nokta, c.durak);
    if (m < enMesafe) { enMesafe = m; en = c; }
  }
  // HİSTEREZİS: masa, monitör, sandalye ve yönetim terminalinin durakları 0,9 m içinde; kalkınca en
  // yakın durak bir masa bir terminal oluyordu (baglamdene 2. koşu). Mevcut yer, başka bir durak
  // ondan en az `YER_HISTEREZISI` daha yakın olana kadar korunur. Salt "yarıçaptaysa koru" kuralı
  // (3.–7. koşu) yanlıştı: Orion terminalin yanında doğup sandalyeye oturunca da "terminalde" kalıyordu.
  if (mevcutEtiket && en) {
    const m = KAYIT.find((c) => c.etiket === mevcutEtiket);
    if (m && m !== en) {
      const d = mesafeXZ(nokta, m.durak);
      if (d <= Math.max(BULUNMA_YARICAPI, m.yaklasmaYaricapi) && d - enMesafe < YER_HISTEREZISI) return m;
    }
  }
  return en && enMesafe <= Math.max(BULUNMA_YARICAPI, en.yaklasmaYaricapi) ? en : null;
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
