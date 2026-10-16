// world/level/bank.ts — Ofisin DIŞINDAKİ bank: kapının önündeki terasta, oturulabilir. SAF VERİ (Babylon yok; mesh `bankMesh.ts`te).
//
// Ozyn 2026-10-16: "dışarıya bi bank koy, oturma yapabilelim". Ofis gibi KODLA tanımlıdır (`olculer.ts` deseni): `ova.level.json` ve level şeması
// DEĞİŞMEZ (ofisin yeri de `ofisYeri.ts`te koddan uygulanır). Çarpışma, ışın (etkileşim ipucu), çapa ve Orion'un nesne kaydı AYNI tablodan gelir; yalnız
// ofis ova'nın içindeyken (birleşik dünya, `world/yer/birlesikYer.ts`) vardır: ofis tek başına yaşarken dışarısı boştur ve bank havada kalırdı.
//
// Yer: kapının sağında (+X), kapıdan ~2,6 m dışarıda, platonun TAM DÜZ terasında (`ofisYeri.ts` PLATO, zemin y = TERAS_YUKSEKLIGI). Kapı kanadı menteşe
// kenarından (+X) 1 m dışarı döner; bank kanat erişiminin (z ≈ 5) çok ötesinde, kapıdan düz çıkan yolu kesmez. Oturanın yüzü ova'ya (+Z), sırtı ofise.
//
// Oturma: ORION oturabilir (`BANK_CAPASI.oturma`; `otur` klibi, önden yanaşır, yüzü ova'ya). OZYN'in bedeninde oturma klibi yok (yalnız yürü ve boşta): oturan
// beden kalçası oturma yüzeyine denk gelecek kadar aşağı iner (`world/player/oturma.ts`); bacaklar zemine gömülür. Ozyn için gerçek poz Blender'da gerekir.
"use strict";
import { CAPA_ETIKETLERI, type Vec3 } from "../../protocol/temel.ts";
import { KAPI, ODA, type Kutu, type KatiYuzey } from "./olculer.ts";
import { TERAS_YUKSEKLIGI } from "./ofisYeri.ts";
import type { Capa } from "./capalar.ts";
import type { Nesne } from "./cekirdek/nesneTipi.ts";

export const BANK = {
  /** Merkez XZ: kapının sağında, teras içinde. */
  x: KAPI.x + 2, z: ODA.derinlik / 2 + 2.6,
  genislik: 1.6, derinlik: 0.5,
  /** Oturma yüzeyi yüksekliği (zeminden). */
  oturma: 0.45,
  /** Sırtlığın üst kenarı (zeminden). */
  sirt: 0.88,
  /** Teras zemini (ofis zemininin 5 cm altı). */
  zemin: TERAS_YUKSEKLIGI,
} as const;

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** Bankın tüm dış kutusu: yürüme engeli, bakış ışını ve Orion'un nesne kaydı bunu okur (parçalar hepsini kapsar, `bank.test.ts`). */
export const BANK_KUTUSU: Kutu = { x: BANK.x, y: BANK.zemin + BANK.sirt / 2, z: BANK.z, g: BANK.genislik, yuk: BANK.sirt, d: BANK.derinlik };

export type BankMalzemesi = "tahta" | "demir";
export interface BankParcasi { ad: string; kutu: Kutu; malzeme: BankMalzemesi }

const { x, z, genislik: g, derinlik: d, oturma, sirt, zemin } = BANK;
const arka = z - d / 2;                 // sırtlığın olduğu yan (−Z, ofise dönük)
const ayakX = g / 2 - 0.08;             // yan ayakların merkezden uzaklığı

/** Bankın parçaları (yerleşim tek yerde): mesh bunlardan kurulur, dış kutu bunların birleşimidir. */
export const BANK_PARCALARI: readonly BankParcasi[] = [
  { ad: "oturma", malzeme: "tahta", kutu: { x, y: zemin + oturma - 0.03, z, g, yuk: 0.06, d } },
  { ad: "sirtlik", malzeme: "tahta", kutu: { x, y: zemin + (0.55 + sirt) / 2, z: arka + 0.03, g, yuk: sirt - 0.55, d: 0.06 } },
  { ad: "ayak_sol", malzeme: "demir", kutu: { x: x - ayakX, y: zemin + (oturma - 0.06) / 2, z, g: 0.06, yuk: oturma - 0.06, d: d - 0.04 } },
  { ad: "ayak_sag", malzeme: "demir", kutu: { x: x + ayakX, y: zemin + (oturma - 0.06) / 2, z, g: 0.06, yuk: oturma - 0.06, d: d - 0.04 } },
  { ad: "direk_sol", malzeme: "demir", kutu: { x: x - ayakX, y: zemin + 0.2 + (sirt - 0.2) / 2, z: arka + 0.03, g: 0.06, yuk: sirt - 0.2, d: 0.05 } },
  { ad: "direk_sag", malzeme: "demir", kutu: { x: x + ayakX, y: zemin + 0.2 + (sirt - 0.2) / 2, z: arka + 0.03, g: 0.06, yuk: sirt - 0.2, d: 0.05 } },
];

/**
 * Bank çapası: `otur` / `kalk`. `konum` oturma noktasıdır (yüzeyin ortası); `durak` bankın ÖNÜ (+Z), kalkınca konulacak yer; `yon` durakta bankı
 * görmek için −Z; `oturmaYonu` oturanın baktığı yön (+Z, ova'ya): ikisi zıt olduğu için ayrı alan.
 */
export const BANK_CAPASI: Capa = {
  ad: "bank",
  konum: v(BANK.x, BANK.zemin + BANK.oturma, BANK.z),
  durak: v(BANK.x, BANK.zemin, BANK.z + BANK.derinlik / 2 + 0.7),
  yon: v(0, 0, -1),
  oturmaYonu: v(0, 0, 1),
  // Orion önden (+Z) gelir, sırtı banka döner, geri oturur; yüzü zaten ova'ya (+Z) bakar. Nokta oturağın ORTASI: `yariBoy` bu noktadan ön yüze uzaklık
  // olduğu için kayma yanaşma ekseninde olsaydı yanaşma noktası çarpışma yarıçapının içine düşerdi (ilk denemede oldu: "yanaşılacak serbest yer yok").
  oturma: { nokta: { x: BANK.x, z: BANK.z }, yanlar: [v(0, 0, 1)], yariBoy: BANK.derinlik / 2 },
  yaklasmaYaricapi: 1.6,
  eylemler: ["otur", "kalk"],
  etiket: CAPA_ETIKETLERI.bank,
};

/** Bakış ışınının bankı çapa olarak tanıması için (etkileşim ipucu `[F] bank — otur`). */
export const BANK_KATI: KatiYuzey = { capa: "bank", kutu: BANK_KUTUSU };

/** Orion'un nesne kaydı: görüş/algıda "bank" olarak görünür. */
export const BANK_NESNESI: Nesne = { id: "bank", ad: CAPA_ETIKETLERI.bank, tur: "mobilya", capa: "bank", kutu: BANK_KUTUSU };
