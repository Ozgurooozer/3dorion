// protocol/bedenTanimi.ts — Orion'un bedeninin KÜNYESİ (datasheet).
//
// NEDEN VAR. Donanımcılar bir gövdeyi kodla değil VERİYLE tarif eder: URDF/SDF
// dosyası link'leri, eklemleri ve her eklemin LİMİTLERİNİ (alt/üst açı,
// `effort`, `velocity`) sayar; sensörler menzili ve güncelleme hızıyla yazılır.
// Sebebi estetik değil — aynı tarif hem simülasyonu hem gerçek donanımı sürer,
// ve limitler tek yerde durunca ikisi ayrışamaz.
//
// Bizde bu bilgi dağınıktı: hızlar ve boyun sınırları `world/avatar/yurutucu.ts`
// içinde tek tek `export const`, boyutlar `world/avatar/prosedurel.ts` içinde
// `BOY` oranlarına gömülü, görüş konisi `mind/algiHizmeti.ts` içinde ayrı bir
// sabit. VRM iskeleti ise bu bilgiyi hiç paylaşmıyor. Aynı gövdenin ölçüleri
// üç dosyada üç kez yaşıyordu.
//
// NEDEN `protocol/`. `world/` ile `mind/` birbirini import EDEMEZ (K4). Görüş
// konisi duyunun, eklem sınırı gövdenin; ikisi de aynı bedene ait ama iki ayrı
// katmandan okunuyor. Künye ikisinin de bağlı olduğu tek yere konur — zaten
// beyinle beden arasındaki sözleşme burası. Donanımda da datasheet üreticinin
// değil, ORTAK belgedir.
//
// NE BURAYA GİRMEZ: mobilyaya bağlı ölçüler (`OTURMA_YUKSELMESI` sandalyenin
// yüksekliğinden türer), iş denetimi (`IS_ZAMAN_ASIMI` bir watchdog),
// animasyon süreleri. Bunlar bedenin künyesi değil, sahnenin ayarı.
//
// SAF: bağımlılık yok.
"use strict";

const DER = Math.PI / 180;

/** Bir eklemin künyesi: dönebildiği açı ve dönme hızı. */
export interface Eklem {
  /**
   * Radyan cinsinden mutlak sınır (± bu değer). `null` = sınırsız dönebilir.
   * Aşılırsa hareket başka bir ekleme devredilir — bkz. `yurutucu.ts`
   * `_bakisGuncelle`: boyun yaw sınırını aşan bakış GÖVDEYİ döndürür,
   * kafa donuk bir şekilde arkaya bükülmez.
   */
  readonly sinir: number | null;
  /** Açısal hız (rad/s). */
  readonly aciHiz: number;
}

export const BEDEN = {
  /** Toplam boy (m). Prosedürel iskeletin bütün oranları buna göredir. */
  boy: 1.75,
  /** Baş yüksekliği, ayak hizasından (m). Bakış ışını buradan çıkar. */
  basYuksekligi: 1.55,
  /** Bir yürüme adımının uzunluğu (m). Yürüme fazı buradan türer. */
  adimUzunlugu: 0.72,

  eklem: {
    /** Gövde yaw'ı. Sınırsız: gövde istediği kadar döner. */
    govdeYaw: { sinir: null, aciHiz: 4.2 },
    /** Baş yaw'ı. İnsan boyun sınırı; aşılırsa gövde devralır. */
    basYaw: { sinir: 80 * DER, aciHiz: 6.5 },
    /** Baş pitch'i. Aşılamaz — gövde pitch'i telafi etmez. */
    basPitch: { sinir: 40 * DER, aciHiz: 6.5 },
  } satisfies Record<string, Eklem>,

  hareket: {
    /** Yürüme hızı (m/s). Sakin, ofis içi tempo. */
    yurumeHizi: 1.25,
    /** Koşma hızı (m/s). Uzun mesafede kendiliğinden devreye girer. */
    kosmaHizi: 2.45,
    /** Kalan yol bundan uzunsa avatar koşar (m). 10×8 m odada nadiren aşılır. */
    kosmaEsigi: 4.0,

    /**
     * İvme (m/s²) — AKTÜATÖR DOYUMU.
     *
     * Bu alan olmadan komut = gerçekleşen oluyordu: gövde ilk tikte azami
     * hıza sıçrıyordu, yani ışınlanıyordu. Gerçek bir aktüatörde tork
     * sonludur ve kütle atalet taşır; hızlanmak zaman alır.
     *
     * Asıl kazanç görsel değil: komut ile gerçekleşen arasında ÖLÇÜLEBİLİR
     * bir fark doğuyor. Hata payı olmayan bir bedende propriyosepsiyon süstür
     * — düzeltilecek bir şey yoksa duyunun işlevi de yok.
     *
     * 2.0 m/s²: yürüme hızına (1.25 m/s) ~0,6 sn'de çıkar. İnsan temposu.
     */
    ivme: 2.0,
    /**
     * Frenleme (m/s²). Durmak hızlanmaktan hızlıdır — ağırlığı geriye vermek
     * itmekten kolay. Varış bu profille yumuşar, duvara çarpar gibi durmaz.
     */
    fren: 3.0,
  },

  duyu: {
    /**
     * Görüş konisinin YARIM açısı (radyan). ~40°, insan odak alanına yakın.
     * `onumde` sorgusu yalnızca bu koninin içini görür.
     */
    koniYarim: 0.70,
    /** `yakin` sorgusunun menzili (m). */
    yakinMenzil: 2.5,
  },
} as const;
