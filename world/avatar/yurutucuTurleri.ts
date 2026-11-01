// world/avatar/yurutucu.ts'ten ayrıldı (kalite turu, 2026-11-01; davranış AYNI): yürütücünün DIŞA VERDİĞİ görünüm/ayar arayüzleri ve İÇ iş tanımı. Yalnız tip.
"use strict";
import type { Vec3 } from "../../protocol/temel.ts";
import type { Jest, Poz } from "../../protocol/niyet.ts";
import type { AnimasyonKlibi, Uzuv } from "../../protocol/animasyon.ts";
import type { Yer } from "../yer/yer.ts";
import type { KlipBulucu } from "./klipKutuphanesi.ts";
import type { Nokta2 } from "./yolBulma.ts";

// ── Dışa verilen görünüm ───────────────────────────────────────────────────

/** Bedenin çizmek için ihtiyacı olan her şey. Karar yok, yalnızca durum. */
export interface AvatarGorunumu {
  konum: Vec3;
  /** Gövde yaw'ı (radyan, 0 = +Z). */
  govdeYaw: number;
  /** Baş yaw'ı — GÖVDEYE GÖRELİ. */
  basYaw: number;
  /** Baş pitch'i, pozitif = yukarı bakıyor. */
  basPitch: number;
  poz: Poz;
  /** Poz geçişinin üstünden geçen süre — beden harmanlama için okur. */
  pozYasi: number;
  oturuyor: boolean;
  elinde: string | null;
  mesgul: boolean;
  /** Aktif jest ve 0..1 ilerlemesi. */
  jest: Jest | null;
  jestIlerlemesi: number;
  /** Oynayan JSON klibi (Dilim 5a) ya da null. Klip oynarken `jest` null'dır: klip jestin yerine geçer. */
  klip: KlipGorunumu | null;
  /** Yürüme fazı 0..1 — ayak/kol salınımı. */
  yurumeFazi: number;
  /** Anlık hız (m/s) — beden salınım genliğini buna göre ölçekler. */
  hiz: number;
  /** Ağız açıklığı 0..1 (TTS bağlar). */
  agiz: number;
  /** Kalan yol — hata ayıklama/görselleştirme. */
  yol: readonly Nokta2[];
}

/** Oynayan klip: hangi niyetin, ne kadar geçti (sn, sarılmamış; örnekleyici sarar), anlamı (uzvu olmayan gövde bunu gösterir). */
export interface KlipGorunumu {
  readonly id: string;
  readonly klip: AnimasyonKlibi;
  readonly gecen: number;
  readonly jest: Jest;
}

export interface YurutucuAyari {
  spawn?: Vec3;
  /** Başlangıç gövde yaw'ı (radyan). */
  yaw?: number;
  /**
   * Oyuncu konumu sağlayıcısı. `bak {tip:"oyuncu"}` ve `git {tip:"oyuncu"}`
   * bunu kullanır. Verilmezse o hedefler `hata` döner — sessizce yerinde
   * durmak yerine sebebini söyler.
   */
  oyuncuKonumu?: () => Vec3;
  /**
   * Orion'un bulunduğu yer (spec 24): yol bulma, engeller ve çapalar buradan. Varsayılan oda.
   * Geri çağrı, çünkü kapıdan geçince yer değişir; yürütücü yeniden kurulmaz. Oturma çapanın `oturma`
   * geometrisinden okunur (sandalye, bank) — çapası olmayan yerde `otur` zaten "bilinmeyen çapa" döner.
   */
  yer?: () => Yer;
  /**
   * OTURMA İZNİ (spec 33, iki beden): çapa (kanonik ad) başka bir bedenin koltuğuysa onun ADI, boşsa null. `otur` işe başlamadan
   * sorulur; doluysa açık bir hata döner. Verilmezse her koltuk boş sayılır (tek beden: eski davranış birebir).
   * NEDEN: başsız deneme (2026-10-21) — iki avatar aynı sandalyeye "otur" alınca ikisi de AYNI noktaya oturdu, hata yok.
   */
  koltukDolu?: (capa: string) => string | null;
  /**
   * JSON klip kütüphanesi (spec 35 Dilim 5a): `jest` niyetinin `klip`i buradan ÇAĞRI ANINDA aranır (yükleme asenkron, kütüphane sonradan dolar).
   * Verilmezse klipli jest nedenle `hata` döner (sessiz düz jeste düşmez).
   */
  klipler?: KlipBulucu;
  /** Gövdenin klip uygulayabildiği uzuvlar (`AvatarIskeleti.klipUzuvlari`): uygulanamayan izler `basladi` sonucunda adlarıyla bildirilir. */
  klipUzuvlari?: ReadonlySet<Uzuv>;
}

// ── İç iş tanımı ───────────────────────────────────────────────────────────

export type IsTuru = "git" | "otur" | "kalk";
/** `sandalyeDon`: oturur hâlde döner sandalyeyle dönüş (otur sonu / kalk başı). */
export type Asama = "kalkiyor" | "yuruyor" | "donuyor" | "poz" | "sandalyeDon";

export interface AktifIs {
  id: string;
  tur: IsTuru;
  asama: Asama;
  asamaGecen: number;
  toplamGecen: number;
  /** Yürünecek son nokta (XZ). `kalk` için null. */
  hedef: Nokta2 | null;
  tolerans: number;
  /** Varışta dönülecek yaw; null = yön serbest. */
  varisYaw: number | null;
  yol: Nokta2[];
  kosuyor: boolean;
  capa: string | null;
  /** Oturma/kalkma ara değeri: başlangıç konumu. */
  pozBasKonum: Nokta2;
  pozBasY: number;
  /** `git` otomatik kalkma yaptıysa sonuçta bildirilir. */
  kalkildi: boolean;
  /**
   * Yol bulmanın gideceği son SERBEST nokta; `hedef` ondan sonra düz adımla
   * eklenir. Yalnızca `otur` kullanır (oturma yeri çarpışma payının içinde).
   */
  yanasma?: Nokta2;
  /** `otur`: oturduktan sonra oturakla dönülecek yaw (sandalye: masaya, bank: ova'ya). */
  oturmaYaw?: number;
  /** `otur`: oturunca kökün geleceği nokta (XZ) ve mutlak y (çapanın oturma yüzeyi − `OTURMA_KALCA_PAYI`). */
  oturmaNoktasi?: Nokta2;
  oturmaY?: number;
  /** `kalk`/`kalkiyor`: sandalye çıkışa döndü mü — kalkma ondan sonra başlar. */
  dondu?: boolean;
  /** `otur`: tutulan koltuk (çapanın KANONİK adı; `capa` istenen addır ve sonuçta öyle bildirilir). */
  koltuk?: string;
}
