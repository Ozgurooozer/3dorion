// world/avatar/yurutucu.ts — Niyet yürütücüsü: SAF matematik, Babylon YOK.
//
// Bu dosya T2'nin kalbidir. Ozyn'in onayladığı karar: "avatar ifade süsü
// değil, gerçek araç yürütücüsü" (spec K7). Orion `git tahta` derse avatar
// GERÇEKTEN yürür ve tahtanın önünde durur.
//
// İKİ KATMAN AYRIMI (pazarlık konusu değil):
//   yurutucu.ts  → KARAR. Yol bulma, dönme, varış tespiti, poz geçişi, sıra
//                  yönetimi. Babylon import'u SIFIR, baştan sona test edilebilir.
//   beden.ts     → SUNUM. Bu dosyanın ürettiği durumu mesh'e uygular. Karar vermez.
//
// Yol bulmayı Babylon çağrılarının içine gömmek, "masanın arkasına giderken
// çarpmıyor mu" sorusunu ölçülemez hâle getirirdi. Burada ölçülebiliyor.
//
// ZAMAN: `ilerle(dt)` YALNIZCA 20 Hz mantık tikinden çağrılır. Render
// karesinden çağrılmaz — yoksa Orion'un davranışı FPS'e göre değişir.
"use strict";
import type { Hedef, Vec3 } from "../../protocol/temel.ts";
import type { Jest, Niyet, NiyetSonucu, Poz } from "../../protocol/niyet.ts";
import type { OrionDurumu } from "../../protocol/algi.ts";
import { BEDEN } from "../../protocol/bedenTanimi.ts";
import { capaBul, mesafeXZ } from "../level/capalar.ts";
import type { Yer } from "../yer/yer.ts";
import { ODA_YERI } from "../yer/odaYeri.ts";
import { SANDALYE } from "../level/olculer.ts";
import { PozMakinesi, hareketliMi } from "./durumMakinesi.ts";
import {
  AVATAR_YARICAP, enYakinSerbest, noktaSerbestMi, yolBul, yolUzunlugu,
  type Nokta2,
} from "./yolBulma.ts";

// ── Ölçüler ve hızlar ──────────────────────────────────────────────────────
//
// Sayılar artık BURADA DEĞİL: `protocol/bedenTanimi.ts` künyesinden geliyor.
// Aynı gövdenin ölçüleri üç dosyada üç kez yaşıyordu (burası, `prosedurel.ts`,
// `mind/algiHizmeti.ts`) ve VRM iskeleti hiçbirini paylaşmıyordu.
//
// Adlar dışa verilmeye DEVAM EDİYOR: `yurutucu.test.ts` sınırları buradan
// import ediyor ve testin künyeyi değil DAVRANIŞI sınaması doğru — sınır
// künyede değişirse test yine gerçek sınırı görür.

/** Yürüme hızı (m/s). Sakin, ofis içi tempo. */
export const YURUME_HIZI = BEDEN.hareket.yurumeHizi;
/** Koşma hızı (m/s). Uzun mesafede kendiliğinden devreye girer. */
export const KOSMA_HIZI = BEDEN.hareket.kosmaHizi;
/** Kalan yol bundan uzunsa avatar koşar. 10×8 m odada nadiren aşılır. */
export const KOSMA_ESIGI = BEDEN.hareket.kosmaEsigi;
/** Gövde dönüş hızı (rad/s). */
export const GOVDE_DONME_HIZI = BEDEN.eklem.govdeYaw.aciHiz;
/** Baş dönüş hızı (rad/s) — gövdeden hızlı, insan böyle. */
export const BAS_DONME_HIZI = BEDEN.eklem.basYaw.aciHiz;
/** İvme (m/s²) — aktüatör doyumu; hız azami değere sıçramaz. */
export const IVME = BEDEN.hareket.ivme;
/** Frenleme (m/s²) — durmak hızlanmaktan hızlı. */
export const FREN = BEDEN.hareket.fren;

/** İnsan boyun sınırı, yaw. Aşılırsa GÖVDE döner — donuk kafa dönüşü yok. */
export const BOYUN_YAW_SINIRI = BEDEN.eklem.basYaw.sinir;
/** İnsan boyun sınırı, pitch. Aşılamaz; gövde pitch'i telafi etmez. */
export const BOYUN_PITCH_SINIRI = BEDEN.eklem.basPitch.sinir;

/** `git {tip:"nokta"}` için varsayılan varış toleransı. */
export const NOKTA_TOLERANSI = 0.25;
/** Ara noktanın "geçildi" sayılma yarıçapı. */
export const ARA_NOKTA_TOLERANSI = 0.02;
/** Bir `git`/`otur` işi bu süreyi aşarsa `hata` yayılır. Sonsuz döngü kalkanı. */
export const IS_ZAMAN_ASIMI = 20;

export const OTURMA_SURESI = 0.8;
export const KALKMA_SURESI = 0.7;
export const JEST_SURESI = 1.1;

/** Baş yüksekliği (ayak hizasından). Bakış açısı buradan hesaplanır. */
export const BAS_YUKSEKLIGI = BEDEN.basYuksekligi;
/** Bir yürüme adımının uzunluğu — yürüme fazı buradan türer. */
export const ADIM_UZUNLUGU = BEDEN.adimUzunlugu;

/**
 * Otururken kökün yükselmesi. Bacaklar bükülür, kalça oturma yüzeyine oturur;
 * kök (ayak hizası) bu kadar yukarı taşınır.
 */
export const OTURMA_YUKSELMESI = SANDALYE.oturma - 0.30;
/** Oturunca gövdenin sandalye üstüne geçtiği nokta. */
const OTURMA_NOKTASI: Nokta2 = { x: SANDALYE.x, z: SANDALYE.z - 0.04 };

/**
 * Sandalyeye YANDAN, sırtı dönük oturulur; oturunca döner sandalye masaya
 * çevrilir (2026-09-26).
 *
 * NEDEN. Eskiden kök masa/monitör durağından (z=-1.62) oturma noktasına
 * düz ileri kayıyordu: sandalyenin SIRTLIĞININ içinden, yüzü masaya dönük,
 * ~0.9 m. Prosedürel robotta göze batmıyordu; iskeletli low-poly bedende
 * `otur` klibi kökün 0.45 m GERİ gittiğini varsayıp ayakları buna göre
 * telafi ediyor. Canlı ölçüm (deneme `?kamera=yan`): kök 0.93 m İLERİ gitti,
 * ayaklar masanın altına ~1.4 m kaydı.
 *
 * Önden oturmak mümkün değil: oturağın ön kenarı ile masa kenarı arası
 * 0.215 m — ayakta durulacak yer yok. Sandalyenin kolçağı yok (`sandalye_kol`
 * tabanın yıldız kolları), yani YANDAN yaklaşılabilir: yana gel, arkanı dön,
 * geri otur, sonra sandalyeyle masaya dön. Gerçek bir döner sandalyede de
 * böyle oturulur.
 *
 * `OTURMA_ADIMI` klipteki telafiyle AYNI olmalı (assets/orion-lowpoly.glb
 * `otur`/`kalk`: ayakta bilek → oturmuş bilek = 0.453 m). Değişirse klip
 * yeniden bake edilir; biri değişip öteki değişmezse ayak kayar.
 */
export const OTURMA_ADIMI = 0.45;
/**
 * Yol bulmanın gidebildiği en yakın yan nokta: sandalye kutusu + avatar
 * yarıçapı. Oturma yeri (0.45) bunun İÇİNDE kalır — çarpışma yarıçapı
 * omuz genişliğine göre cömert, sandalye ise diz hizasında. Son 17 cm'yi
 * `_yoluKur` düz bir adım olarak ekler.
 */
const YANASMA_UZAKLIGI = SANDALYE.genislik / 2 + AVATAR_YARICAP + 0.02;
/** Oturma yerine varış eşiği — klibin varsaydığı mesafeyi bozmayacak kadar sıkı. */
const OTURMA_YERI_TOLERANSI = 0.03;

/** `poz` niyetiyle doğrudan girilebilen pozlar. Diğerleri kendi niyetini ister. */
const SERBEST_POZLAR: readonly Poz[] = ["duruyor", "eğiliyor", "yatıyor", "bakıyor"];

// ── Yardımcılar ────────────────────────────────────────────────────────────

/** Açıyı (-π, π] aralığına sarar. */
export function aciSar(a: number): number {
  let x = (a + Math.PI) % (Math.PI * 2);
  if (x < 0) x += Math.PI * 2;
  return x - Math.PI;
}

function kis(v: number, alt: number, ust: number): number {
  return v < alt ? alt : v > ust ? ust : v;
}

/** `a`dan `b`ye en fazla `azami` kadar yaklaş (açı sarmalı). */
function aciYaklas(a: number, b: number, azami: number): number {
  const fark = aciSar(b - a);
  if (Math.abs(fark) <= azami) return aciSar(b);
  return aciSar(a + Math.sign(fark) * azami);
}

/** Babylon sol-elli yaw: ileri = (sin ψ, 0, cos ψ). */
function yonYaw(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

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
  /** Yürüme fazı 0..1 — ayak/kol salınımı. */
  yurumeFazi: number;
  /** Anlık hız (m/s) — beden salınım genliğini buna göre ölçekler. */
  hiz: number;
  /** Ağız açıklığı 0..1 (TTS bağlar). */
  agiz: number;
  /** Kalan yol — hata ayıklama/görselleştirme. */
  yol: readonly Nokta2[];
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
   * Geri çağrı, çünkü kapıdan geçince yer değişir; yürütücü yeniden kurulmaz. Oturma (sandalye) oda
   * sabitlerine bağlı kalır — sandalye çapası olmayan yerde `otur` zaten "bilinmeyen çapa" döner.
   */
  yer?: () => Yer;
}

// ── İç iş tanımı ───────────────────────────────────────────────────────────

type IsTuru = "git" | "otur" | "kalk";
/** `sandalyeDon`: oturur hâlde döner sandalyeyle dönüş (otur sonu / kalk başı). */
type Asama = "kalkiyor" | "yuruyor" | "donuyor" | "poz" | "sandalyeDon";

interface AktifIs {
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
  /** `otur`: oturduktan sonra sandalyeyle dönülecek yaw (masaya). */
  oturmaYaw?: number;
  /** `kalk`/`kalkiyor`: sandalye çıkışa döndü mü — kalkma ondan sonra başlar. */
  dondu?: boolean;
}

// ── Yürütücü ───────────────────────────────────────────────────────────────

/**
 * Niyet → hareket. Kuyruk, sıra yönetimi, yol bulma, poz geçişleri.
 *
 * SIRA YÖNETİMİ KARARI — "en son emir kazanır":
 *   Süreli bir niyet (`git`/`otur`/`kalk`) işlenirken YENİ bir süreli niyet
 *   gelirse, eskisi İPTAL edilir ve yenisi başlar.
 *
 *   Gerekçe: niyetleri üreten bir beyindir, bir oyuncu değil. Orion 3 saniye
 *   önce "git tahta" dedi, şimdi "git kapı" diyorsa fikrini değiştirmiştir;
 *   önce tahtaya gidip sonra kapıya yürümek onun kararını değil, kuyruğun
 *   gecikmesini gösterir. Kuyruğa almak ayrıca gecikme biriktirir: LLM'in 5
 *   niyeti üst üste yayması sırasında avatar 20 saniye eski emirleri işler.
 *
 *   Sessiz yutma YOK: iptal edilen niyet için açıkça
 *   `NiyetSonucu{durum:"iptal"}` yayılır, beyin ne olduğunu görür.
 *
 *   Anlık niyetler (`poz`,`jest`,`bak`,`al`,`birak`) süreli işi İPTAL ETMEZ —
 *   üstüne binerler. Yürürken el sallanabilir, yürürken bakılabilir.
 */
export class Yurutucu {
  private _konum: Vec3;
  private _govdeYaw: number;
  private _govdeHedefYaw: number;
  private _basYaw = 0;
  private _basPitch = 0;
  private _basHedefYaw = 0;
  private _basHedefPitch = 0;

  private _poz = new PozMakinesi("duruyor");
  private _oturuyor = false;
  private _elinde: string | null = null;
  private _agiz = 0;
  private _yurumeFazi = 0;
  private _hiz = 0;
  /** Bu tik yurume asamasi kostu mu — kosmadiysa hiz frenle iner. */
  private _yurudu = false;

  private _jest: Jest | null = null;
  private _jestKalan = 0;

  private _bakis: Hedef | null = null;
  private _aktif: AktifIs | null = null;
  /** `niyet()` dışarıdan (render/IPC) çağrılır; işlenme TİKTE olur. */
  private _gelen: { n: Niyet; id: string }[] = [];
  /** Kalkınca dönülecek zemin noktası. */
  private _oturmaCikisi: Nokta2 = { x: 0, z: -1.62 };

  private _oyuncuKonumu: (() => Vec3) | null;
  private _yer: () => Yer;

  constructor(ayar: YurutucuAyari = {}) {
    const s = ayar.spawn ?? { x: 0, y: 0, z: 0 };
    this._konum = { x: s.x, y: s.y, z: s.z };
    this._govdeYaw = ayar.yaw ?? 0;
    this._govdeHedefYaw = this._govdeYaw;
    this._oyuncuKonumu = ayar.oyuncuKonumu ?? null;
    this._yer = ayar.yer ?? (() => ODA_YERI);
  }

  // ── Dış yüzey ────────────────────────────────────────────────────────────

  /** Niyeti kuyruğa alır. Doğrulama ÇAĞIRANIN işi (protocol/dogrula.ts). */
  niyet(n: Niyet, niyetId: string): void {
    this._gelen.push({ n, id: niyetId });
  }

  /**
   * Başka bir noktaya taşı — kapıdan geçiş (spec 24). Süren iş `iptal` olur (beyin beklemesin), oturuyorsa
   * ayakta belirir. Yer `yer` geri çağrısından: çağıran önce yeri değiştirir. Kuyruktaki niyetler yeni yerde işlenir.
   */
  isinla(x: number, z: number, yaw: number): NiyetSonucu[] {
    const cikti: NiyetSonucu[] = [];
    this._aktifIptal(cikti);
    if (this._oturuyor) { this._oturuyor = false; this._poz.gec("duruyor"); }
    this._konum = { x, y: this._yer().yukseklik(x, z), z };
    this._govdeYaw = yaw;
    this._govdeHedefYaw = yaw;
    this._hiz = 0;
    return cikti;
  }

  agizAyarla(aciklik: number): void {
    this._agiz = kis(Number.isFinite(aciklik) ? aciklik : 0, 0, 1);
  }

  /** protocol biçiminde anlık durum — T4 algı yayarken okur. */
  durum(): OrionDurumu {
    const yaw = this._govdeYaw + this._basYaw;
    const cp = Math.cos(this._basPitch);
    return {
      konum: { x: this._konum.x, y: this._konum.y, z: this._konum.z },
      bakis: { x: Math.sin(yaw) * cp, y: Math.sin(this._basPitch), z: Math.cos(yaw) * cp },
      poz: this._poz.poz,
      mesgul: this._aktif !== null,
      elinde: this._elinde,
      oturuyor_mu: this._oturuyor,
      // Propriyosepsiyon: aktüatörün GERÇEK durumu, komut edilen değil.
      hiz: this._hiz,
      hedefeKalan: this._aktif?.hedef
        ? mesafeXZ(this._konum, this._aktif.hedef)
        : undefined,
    };
  }

  /** Bedenin okuduğu tam görünüm. */
  gorunum(): AvatarGorunumu {
    return {
      konum: { x: this._konum.x, y: this._konum.y, z: this._konum.z },
      govdeYaw: this._govdeYaw,
      basYaw: this._basYaw,
      basPitch: this._basPitch,
      poz: this._poz.poz,
      pozYasi: this._poz.yas,
      oturuyor: this._oturuyor,
      elinde: this._elinde,
      mesgul: this._aktif !== null,
      jest: this._jest,
      jestIlerlemesi: this._jest ? 1 - this._jestKalan / JEST_SURESI : 0,
      yurumeFazi: this._yurumeFazi,
      hiz: this._hiz,
      agiz: this._agiz,
      yol: this._aktif ? this._aktif.yol : [],
    };
  }

  /**
   * Bir mantık adımı. SONUÇLARI DÖNER — çağıran bunları dinleyicilere yayar.
   * 20 Hz tikinden çağrılır, render karesinden ASLA.
   */
  ilerle(dt: number): NiyetSonucu[] {
    const sonuclar: NiyetSonucu[] = [];

    // 1) Gelen niyetler — geliş sırasıyla.
    const gelen = this._gelen;
    this._gelen = [];
    for (const g of gelen) this._isle(g.n, g.id, sonuclar);

    // 2) Zamanlayıcılar.
    this._poz.ilerle(dt);
    if (this._jest) {
      this._jestKalan -= dt;
      if (this._jestKalan <= 0) { this._jest = null; this._jestKalan = 0; }
    }

    // 3) Aktif iş.
    //
    // `_hiz` ARTIK HER TİK SIFIRLANMIYOR. Eskiden türetilmiş bir değerdi
    // (`adim / dt`) ve burada sıfırlamak doğruydu; aktüatörün DURUMU olunca
    // sıfırlamak ivmeyi her tik baştan başlatıyor ve gövde `IVME * dt`de
    // takılı kalıyor — ölçüldü: 0.100 m/s'de saplandı, masaya hiç varamadı.
    this._yurudu = false;
    if (this._aktif) this._isIlerle(this._aktif, dt, sonuclar);
    // Ayak zeminde (spec 24: ovada tepeler). Oturma/kalkma gövde yüksekliğini kendisi sürer — o aşamalarda dokunma.
    // Oda düz (yükseklik 0): orada bu satır eskiden de doğru olan y = 0'ı yazar.
    if (!this._oturuyor && !(this._aktif && (this._aktif.asama === "poz" || this._aktif.asama === "kalkiyor" || this._aktif.asama === "sandalyeDon"))) {
      this._konum.y = this._yer().yukseklik(this._konum.x, this._konum.z);
    }
    // Yürüme aşaması bu tik koşmadıysa beden YAVAŞLAR. Durmak da bir süreç:
    // dönerken, otururken ya da iş bittiğinde hız aniden kesilmez.
    if (!this._yurudu) this._hiz = Math.max(0, this._hiz - FREN * dt);

    // 4) Gövde ve baş dönüşü (iş bittikten sonra: varış yönü aynı tikte işler).
    this._govdeYaw = aciYaklas(this._govdeYaw, this._govdeHedefYaw, GOVDE_DONME_HIZI * dt);
    this._bakisGuncelle();
    this._basYaw = aciYaklas(this._basYaw, this._basHedefYaw, BAS_DONME_HIZI * dt);
    const pFark = this._basHedefPitch - this._basPitch;
    const pAdim = BAS_DONME_HIZI * dt;
    this._basPitch += kis(pFark, -pAdim, pAdim);

    return sonuclar;
  }

  // ── Niyet işleme ─────────────────────────────────────────────────────────

  private _isle(n: Niyet, id: string, cikti: NiyetSonucu[]): void {
    switch (n.tur) {
      case "git":   return this._git(n, id, cikti);
      case "otur":  return this._otur(n, id, cikti);
      case "kalk":  return this._kalk(id, cikti);
      case "dur":   return this._dur(id, cikti);
      case "poz":   return this._pozNiyeti(n.poz, id, cikti);
      case "jest":  return this._jestNiyeti(n.jest, id, cikti);
      case "bak":   return this._bakNiyeti(n.hedef, id, cikti);
      case "al":    return this._al(n.nesne, id, cikti);
      case "birak": return this._birak(id, cikti);
      // Avatarın işi değil — ama SESSİZ YUTULMAZ, nereye ait olduğu söylenir.
      case "soyle":
        return void cikti.push(this._hata(id, "`soyle` avatarın işi değil: ses hattı (voice/) yürütür. Avatar yalnızca ağız senkronunu uygular."));
      case "yaz":
        return void cikti.push(this._hata(id, "`yaz` avatarın işi değil: tahta yüzeyi (world/surfaces) yürütür."));
      case "odaklan":
        return void cikti.push(this._hata(id, "`odaklan` avatarın işi değil: kamera/köprü yürütür. Avatarı çevirmek için `bak` kullan."));
      case "sor":
        return void cikti.push(this._hata(id, "`sor` salt-okunur bir sorgudur; köprü yanıtlar. Avatar durumu için `durum()` okunur."));
    }
  }

  private _hata(id: string, not: string): NiyetSonucu {
    return { niyet_id: id, durum: "hata", not };
  }

  // ── git ──────────────────────────────────────────────────────────────────

  private _git(n: Extract<Niyet, { tur: "git" }>, id: string, cikti: NiyetSonucu[]): void {
    const coz = this._hedefNoktasi(n.hedef);
    if (!coz.ok) { cikti.push(this._hata(id, coz.not)); return; }

    const capa = n.hedef.tip === "capa" || n.hedef.tip === "nesne" ? capaBul(n.hedef.ad, this._yer().capalar) : null;
    const mesafeVerildi = n.mesafe !== undefined && Number.isFinite(n.mesafe) && n.mesafe > 0;
    // İKİ AYRI TOLERANS — bilerek:
    //   `tolerans`      yürürken "vardım" eşiği. SIKI olmalı, yoksa avatar
    //                   tahtanın 1.5 m uzağında durur ("önünde durur" değil).
    //   `zatenOrada`    işe hiç başlamadan "buradayım" eşiği. Çapanın
    //                   `yaklasmaYaricapi`sı budur: etkileşim menzili.
    const tolerans = mesafeVerildi ? n.mesafe! : NOKTA_TOLERANSI;
    const zatenOrada = mesafeVerildi ? n.mesafe! : capa ? capa.yaklasmaYaricapi : NOKTA_TOLERANSI;

    const ham: Nokta2 = { x: coz.nokta.x, z: coz.nokta.z };
    // Çapa varsa "durak" noktasına gidilir: monitörün İÇİNDE durulmaz.
    const istenen: Nokta2 = capa ? { x: capa.durak.x, z: capa.durak.z } : ham;

    // Hedef bir engelin içindeyse tolerans dahilinde dışına çık.
    let varis: Nokta2 | null = istenen;
    if (!noktaSerbestMi(istenen, AVATAR_YARICAP, this._yer())) {
      varis = enYakinSerbest(istenen, AVATAR_YARICAP, Math.max(tolerans, zatenOrada), undefined, this._yer());
    }
    if (!varis) {
      cikti.push(this._hata(id,
        `hedefe ulaşılamıyor: (${istenen.x.toFixed(2)}, ${istenen.z.toFixed(2)}) bir engelin/duvarın içinde ve ${Math.max(tolerans, zatenOrada).toFixed(2)} m yarıçapında boş yer yok. Daha büyük 'mesafe' ver ya da başka bir hedef seç.`));
      return;
    }

    const varisYaw = capa ? yonYaw(capa.yon.x, capa.yon.z) : null;

    // Zaten menzildeyse: anında biter, yürüme animasyonu TETİKLENMEZ.
    if (!this._oturuyor && mesafeXZ(this._konum, varis) <= zatenOrada) {
      this._aktifIptal(cikti);
      if (varisYaw !== null) {
        this._bakis = null;              // bkz. `_vardi`: varış yönü bakış kilidini düşürür
        this._govdeHedefYaw = varisYaw;
      }
      cikti.push({ niyet_id: id, durum: "basladi" });
      cikti.push({ niyet_id: id, durum: "bitti", veri: { x: this._konum.x, y: this._konum.y, z: this._konum.z } });
      return;
    }

    this._aktifIptal(cikti);
    const is: AktifIs = {
      id, tur: "git",
      asama: this._oturuyor ? "kalkiyor" : "yuruyor",
      asamaGecen: 0, toplamGecen: 0,
      hedef: varis, tolerans, varisYaw,
      yol: [], kosuyor: false, capa: capa ? capa.ad : null,
      pozBasKonum: { x: this._konum.x, z: this._konum.z },
      pozBasY: this._konum.y,
      kalkildi: this._oturuyor,
    };
    // "kalkiyor": poz burada DEĞİŞMEZ — önce sandalye çıkışa döner (bkz. `_asamaKalkiyor`).
    if (is.asama !== "kalkiyor") {
      const hata = this._yoluKur(is);
      if (hata) { cikti.push(this._hata(id, hata)); return; }
    }
    this._aktif = is;
    cikti.push({ niyet_id: id, durum: "basladi" });
  }

  // ── otur / kalk ──────────────────────────────────────────────────────────

  private _otur(n: Extract<Niyet, { tur: "otur" }>, id: string, cikti: NiyetSonucu[]): void {
    const ad = n.capa ?? "sandalye";
    const capa = capaBul(ad, this._yer().capalar);
    if (!capa) { cikti.push(this._hata(id, `bilinmeyen çapa: '${ad}'. Oturulabilir: sandalye.`)); return; }
    if (!capa.eylemler.includes("otur")) {
      cikti.push(this._hata(id, `'${ad}' çapasına oturulmaz (eylemleri: ${capa.eylemler.join(", ")}). Oturulabilir: sandalye.`));
      return;
    }
    if (this._oturuyor) { cikti.push(this._hata(id, "zaten oturuyorsun. Önce `kalk` niyeti gönder.")); return; }

    // Hangi yandan: avatara yakın olan yan; o yanın yanaşma noktası bir
    // engele (duvar/masa) denk geliyorsa öbürü. İkisi de kapalıysa hata —
    // sandalyenin içinden geçerek oturmak yok.
    const yakinYan = this._konum.x >= OTURMA_NOKTASI.x ? 1 : -1;
    const yan = [yakinYan, -yakinYan].find((s) =>
      noktaSerbestMi({ x: OTURMA_NOKTASI.x + s * YANASMA_UZAKLIGI, z: OTURMA_NOKTASI.z }, AVATAR_YARICAP, this._yer()));
    if (yan === undefined) {
      cikti.push(this._hata(id, "sandalyenin iki yanı da kapalı; oturmak için yandan yaklaşılacak yer yok."));
      return;
    }
    const oturmaYeri: Nokta2 = { x: OTURMA_NOKTASI.x + yan * OTURMA_ADIMI, z: OTURMA_NOKTASI.z };

    this._aktifIptal(cikti);
    const is: AktifIs = {
      id, tur: "otur",
      asama: mesafeXZ(this._konum, oturmaYeri) <= OTURMA_YERI_TOLERANSI ? "donuyor" : "yuruyor",
      asamaGecen: 0, toplamGecen: 0,
      hedef: oturmaYeri, tolerans: OTURMA_YERI_TOLERANSI,
      // Varışta SANDALYEYE SIRTINI döner: yüz, sandalyeden dışarı (yan yönü).
      varisYaw: yonYaw(yan, 0),
      yol: [], kosuyor: false, capa: ad,
      pozBasKonum: { x: this._konum.x, z: this._konum.z },
      pozBasY: this._konum.y,
      kalkildi: false,
      yanasma: { x: OTURMA_NOKTASI.x + yan * YANASMA_UZAKLIGI, z: OTURMA_NOKTASI.z },
      oturmaYaw: yonYaw(capa.yon.x, capa.yon.z),
    };
    if (is.asama === "yuruyor") {
      const hata = this._yoluKur(is);
      if (hata) { cikti.push(this._hata(id, hata)); return; }
    } else if (is.varisYaw !== null) {
      this._bakis = null;                // bkz. `_vardi`
      this._govdeHedefYaw = is.varisYaw;
    }
    this._aktif = is;
    cikti.push({ niyet_id: id, durum: "basladi" });
  }

  private _kalk(id: string, cikti: NiyetSonucu[]): void {
    if (!this._oturuyor) { cikti.push(this._hata(id, "zaten ayaktasın; `kalk` yapacak bir şey yok.")); return; }
    this._aktifIptal(cikti);
    // Önce sandalye çıkışa döner, poz ondan SONRA değişir (`_asamaSandalyeDon`):
    // `kalk` klibi 0.7 s boyunca kökün çıkışa doğru ilerlediğini varsayar;
    // dönerken oynarsa ayak kayar.
    this._aktif = {
      id, tur: "kalk", asama: "sandalyeDon", asamaGecen: 0, toplamGecen: 0,
      hedef: null, tolerans: 0, varisYaw: this._cikisYaw(), yol: [], kosuyor: false, capa: null,
      pozBasKonum: { x: this._konum.x, z: this._konum.z },
      pozBasY: this._konum.y,
      kalkildi: false,
    };
    this._bakis = null;
    this._govdeHedefYaw = this._aktif.varisYaw!;
    cikti.push({ niyet_id: id, durum: "basladi" });
  }

  // ── dur ──────────────────────────────────────────────────────────────────

  private _dur(id: string, cikti: NiyetSonucu[]): void {
    this._aktifIptal(cikti);
    // Bekleyen (aynı tikte gelmiş ama henüz işlenmemiş) niyet yok: kuyruk bu
    // döngüde sırayla tüketiliyor. Yürüyen/oynayan her şeyi kes:
    this._jest = null;
    this._jestKalan = 0;
    if (hareketliMi(this._poz.poz)) this._poz.gec("duruyor");
    this._hiz = 0;
    this._govdeHedefYaw = this._govdeYaw;
    cikti.push({ niyet_id: id, durum: "bitti" });
  }

  /** Aktif işi iptal eder ve `iptal` sonucu yayar. Sessiz yutma yok. */
  private _aktifIptal(cikti: NiyetSonucu[]): void {
    const a = this._aktif;
    if (!a) return;
    this._aktif = null;
    if (hareketliMi(this._poz.poz)) this._poz.gec("duruyor");
    cikti.push({ niyet_id: a.id, durum: "iptal", not: `'${a.tur}' kesildi` });
  }

  // ── anlık niyetler ───────────────────────────────────────────────────────

  private _pozNiyeti(p: Poz, id: string, cikti: NiyetSonucu[]): void {
    if (!SERBEST_POZLAR.includes(p)) {
      cikti.push(this._hata(id,
        `'${p}' pozuna doğrudan geçilmez; onu üreten niyeti kullan (oturuyor → \`otur\`, yürüyor/koşuyor → \`git\`). Doğrudan verilebilen pozlar: ${SERBEST_POZLAR.join(", ")}.`));
      return;
    }
    if (this._aktif) {
      cikti.push(this._hata(id, `şu an '${this._aktif.tur}' niyeti işleniyor; poz değiştirmek için önce \`dur\` gönder.`));
      return;
    }
    const g = this._poz.gec(p);
    if (!g.ok) { cikti.push(this._hata(id, g.neden ?? "poz geçişi reddedildi")); return; }
    cikti.push({ niyet_id: id, durum: "bitti" });
  }

  private _jestNiyeti(j: Jest, id: string, cikti: NiyetSonucu[]): void {
    this._jest = j;
    this._jestKalan = JEST_SURESI;
    // Jest SURELI_NIYETLER içinde değil: anında biter, animasyon üstüne biner.
    cikti.push({ niyet_id: id, durum: "bitti" });
  }

  private _bakNiyeti(h: Hedef | null, id: string, cikti: NiyetSonucu[]): void {
    if (h === null) {
      this._bakis = null;
      cikti.push({ niyet_id: id, durum: "bitti" });
      return;
    }
    const coz = this._hedefNoktasi(h);
    if (!coz.ok) { cikti.push(this._hata(id, coz.not)); return; }
    this._bakis = h;
    cikti.push({ niyet_id: id, durum: "bitti" });
  }

  private _al(nesne: string, id: string, cikti: NiyetSonucu[]): void {
    if (this._elinde) {
      cikti.push(this._hata(id, `elinde zaten '${this._elinde}' var; önce \`birak\`.`));
      return;
    }
    const c = capaBul(nesne, this._yer().capalar);
    if (!c || !c.eylemler.includes("al")) {
      cikti.push(this._hata(id, `'${nesne}' alınabilir değil. Şu an alınabilen: masa.`));
      return;
    }
    const m = mesafeXZ(this._konum, c.durak);
    if (m > c.yaklasmaYaricapi) {
      cikti.push(this._hata(id, `'${nesne}' çok uzakta (${m.toFixed(2)} m > ${c.yaklasmaYaricapi} m). Önce \`git ${nesne}\`.`));
      return;
    }
    this._elinde = nesne;
    cikti.push({ niyet_id: id, durum: "bitti" });
  }

  private _birak(id: string, cikti: NiyetSonucu[]): void {
    if (!this._elinde) { cikti.push(this._hata(id, "elin boş; bırakacak bir şey yok.")); return; }
    this._elinde = null;
    cikti.push({ niyet_id: id, durum: "bitti" });
  }

  // ── Hedef çözümü ─────────────────────────────────────────────────────────

  private _hedefNoktasi(h: Hedef): { ok: true; nokta: Vec3 } | { ok: false; not: string } {
    switch (h.tip) {
      case "nokta": {
        if (![h.x, h.y, h.z].every((v) => Number.isFinite(v)))
          return { ok: false, not: "nokta hedefinde NaN/Infinity var." };
        return { ok: true, nokta: { x: h.x, y: h.y, z: h.z } };
      }
      case "capa":
      case "nesne": {
        const c = capaBul(h.ad, this._yer().capalar);
        if (!c) return { ok: false, not: `bilinmeyen çapa/nesne: '${h.ad}'.` };
        return { ok: true, nokta: c.konum };
      }
      case "oyuncu": {
        if (!this._oyuncuKonumu)
          return { ok: false, not: "oyuncu konumu bu avatara bağlanmadı (AvatarAyari.oyuncuKonumu verilmedi)." };
        return { ok: true, nokta: this._oyuncuKonumu() };
      }
    }
  }

  // ── Yol kurulumu ve yürüme ───────────────────────────────────────────────

  /** Yolu hesaplar. Hata dizesi döner, yoksa null. */
  private _yoluKur(is: AktifIs): string | null {
    const hedef = is.hedef;
    if (!hedef) return null;
    // `yanasma` varsa yol ona kurulur, `hedef` son düz adım olarak eklenir
    // (bkz. YANASMA_UZAKLIGI). Zaten yanaşma yarıçapının içindeysek (ör. kalkıp
    // yeniden oturuyor) yol yalnızca o düz adımdır.
    const bas = { x: this._konum.x, z: this._konum.z };
    const yanasmada = is.yanasma !== undefined
      && mesafeXZ(bas, hedef) <= mesafeXZ(is.yanasma, hedef) + 1e-6;
    const yol = yanasmada ? [] : yolBul(bas, is.yanasma ?? hedef, AVATAR_YARICAP, this._yer());
    if (!yol) {
      return `hedefe giden yol yok: (${hedef.x.toFixed(2)}, ${hedef.z.toFixed(2)}) engellerin arkasında kalıyor. Ulaşılabilir bir çapa ya da nokta seç.`;
    }
    if (is.yanasma) yol.push(hedef);
    is.yol = yol;
    is.kosuyor = yolUzunlugu({ x: this._konum.x, z: this._konum.z }, yol) > KOSMA_ESIGI;
    const g = this._poz.gec(is.kosuyor ? "koşuyor" : "yürüyor");
    if (!g.ok) return g.neden ?? "poz geçişi reddedildi";
    return null;
  }

  private _isIlerle(is: AktifIs, dt: number, cikti: NiyetSonucu[]): void {
    is.toplamGecen += dt;
    is.asamaGecen += dt;
    if (is.toplamGecen > IS_ZAMAN_ASIMI) {
      this._aktif = null;
      if (hareketliMi(this._poz.poz)) this._poz.gec("duruyor");
      cikti.push(this._hata(is.id, `'${is.tur}' ${IS_ZAMAN_ASIMI} sn içinde tamamlanamadı; iş düşürüldü (sonsuz döngü kalkanı).`));
      return;
    }

    switch (is.asama) {
      case "kalkiyor": return this._asamaKalkiyor(is, cikti);
      case "yuruyor":  return this._asamaYuruyor(is, dt, cikti);
      case "donuyor":  return this._asamaDonuyor(is, cikti);
      case "poz":      return this._asamaPoz(is, cikti);
      case "sandalyeDon": return this._asamaSandalyeDon(is, cikti);
    }
  }

  /** Oturur hâlde kalkış yönü: sandalyeden oturmaya gelinen yana doğru. */
  private _cikisYaw(): number {
    const dx = this._oturmaCikisi.x - this._konum.x;
    const dz = this._oturmaCikisi.z - this._konum.z;
    return Math.hypot(dx, dz) > 1e-6 ? yonYaw(dx, dz) : this._govdeYaw;
  }

  /** Gövde hedef yaw'a oturdu mu (ya da dönüş takıldıysa süre doldu mu). */
  private _donduMu(is: AktifIs): boolean {
    const kalan = Math.abs(aciSar(this._govdeHedefYaw - this._govdeYaw));
    return kalan <= 0.06 || is.asamaGecen >= 2.5;
  }

  /**
   * Döner sandalyeyle oturur hâlde dönüş.
   *   otur: oturduktan sonra masaya dön → bitti.
   *   kalk: çıkışa dön → poz "duruyor", kök çıkışa ilerler (`_asamaPoz`).
   */
  private _asamaSandalyeDon(is: AktifIs, cikti: NiyetSonucu[]): void {
    if (is.varisYaw !== null) this._govdeHedefYaw = is.varisYaw;
    if (!this._donduMu(is)) return;
    if (is.tur === "otur") { this._bitir(is, cikti); return; }
    const g = this._poz.gec("duruyor");
    if (!g.ok) {
      this._aktif = null;
      cikti.push(this._hata(is.id, g.neden ?? "poz geçişi reddedildi"));
      return;
    }
    is.asama = "poz";
    is.asamaGecen = 0;
    is.pozBasKonum = { x: this._konum.x, z: this._konum.z };
    is.pozBasY = this._konum.y;
  }

  /** `git` oturur hâlde geldiğinde: önce sandalye çıkışa döner, kalkar, sonra yürür. */
  private _asamaKalkiyor(is: AktifIs, cikti: NiyetSonucu[]): void {
    if (!is.dondu) {
      this._bakis = null;
      this._govdeHedefYaw = this._cikisYaw();
      if (!this._donduMu(is)) return;
      const g = this._poz.gec("duruyor");
      if (!g.ok) {
        this._aktif = null;
        cikti.push(this._hata(is.id, g.neden ?? "poz geçişi reddedildi"));
        return;
      }
      is.dondu = true;
      is.asamaGecen = 0;
      is.pozBasKonum = { x: this._konum.x, z: this._konum.z };
      is.pozBasY = this._konum.y;
    }
    const u = kis(is.asamaGecen / KALKMA_SURESI, 0, 1);
    this._konum.x = is.pozBasKonum.x + (this._oturmaCikisi.x - is.pozBasKonum.x) * u;
    this._konum.z = is.pozBasKonum.z + (this._oturmaCikisi.z - is.pozBasKonum.z) * u;
    this._konum.y = is.pozBasY * (1 - u);
    if (u < 1) return;
    this._oturuyor = false;
    this._konum.y = 0;
    is.asama = "yuruyor";
    is.asamaGecen = 0;
    const hata = this._yoluKur(is);
    if (hata) {
      this._aktif = null;
      cikti.push(this._hata(is.id, hata));
    }
  }

  private _asamaYuruyor(is: AktifIs, dt: number, cikti: NiyetSonucu[]): void {
    const hedef = is.hedef!;
    // Gövde dönüşü yürümeden ÖNCE: dönüş hâlinde ileri hız cos ile kısılır,
    // 180° dönüşte avatar kendi ekseninde döner, yan yan kaymaz.
    const ara = is.yol[0];
    if (ara) {
      const dx = ara.x - this._konum.x;
      const dz = ara.z - this._konum.z;
      if (Math.hypot(dx, dz) > 1e-6) this._govdeHedefYaw = yonYaw(dx, dz);
    }
    this._govdeYaw = aciYaklas(this._govdeYaw, this._govdeHedefYaw, GOVDE_DONME_HIZI * dt);

    if (ara) {
      const dx = ara.x - this._konum.x;
      const dz = ara.z - this._konum.z;
      const uz = Math.hypot(dx, dz);
      if (uz > 1e-6) {
        const sapma = Math.abs(aciSar(this._govdeHedefYaw - this._govdeYaw));
        const carpan = Math.max(0, Math.cos(sapma));
        // İSTENEN hız. Gerçekleşen hız bu değil — aktüatör doyuma girer.
        let istenen = (is.kosuyor ? KOSMA_HIZI : YURUME_HIZI) * carpan;

        // Frenleme profili: DURACAĞI noktaya kadar yavaşlayabilmeli.
        // v² = 2·a·s → durabileceğim azami hız = √(2·fren·kalan).
        //
        // `kalan` hedefin MERKEZİNE değil, gerçekten durduğu yere ölçülür:
        // varış `tolerans` yarıçapında gerçekleşiyor ve orada `_hiz` sıfıra
        // çekiliyor. Merkeze göre frenlersek tolerans sınırına hâlâ 1,22 m/s
        // ile giriyor ve hız sıçrayarak kesiliyordu — fren hiç devreye
        // girmiyordu (ölçüldü). Durma noktası tolerans sınırıdır.
        const kalan = Math.max(0, mesafeXZ(this._konum, hedef) - is.tolerans);
        istenen = Math.min(istenen, Math.sqrt(2 * FREN * Math.max(0, kalan)));

        // İVME SINIRI: hız istenene ANINDA ulaşamaz. Komut ≠ gerçekleşen.
        const tavan = (istenen > this._hiz ? IVME : FREN) * dt;
        this._hiz += Math.max(-tavan, Math.min(tavan, istenen - this._hiz));
        if (this._hiz < 0) this._hiz = 0;

        this._yurudu = true;
        const adim = Math.min(this._hiz * dt, uz);
        this._konum.x += (dx / uz) * adim;
        this._konum.z += (dz / uz) * adim;
        // `_hiz` ARTIK TÜRETİLMİYOR: eskiden `adim / dt` ile geri hesaplanıyordu,
        // yani her zaman komut edilene eşitti. Şimdi aktüatörün gerçek durumu.
        this._yurumeFazi = (this._yurumeFazi + adim / ADIM_UZUNLUGU) % 1;
        if (uz - adim <= ARA_NOKTA_TOLERANSI) is.yol.shift();
      } else {
        is.yol.shift();
      }
    }

    if (mesafeXZ(this._konum, hedef) <= is.tolerans || is.yol.length === 0) {
      this._vardi(is, cikti);
    }
  }

  private _vardi(is: AktifIs, cikti: NiyetSonucu[]): void {
    this._hiz = 0;
    if (hareketliMi(this._poz.poz)) this._poz.gec("duruyor");
    if (is.varisYaw !== null) {
      // ESKİ BAKIŞ KİLİDİ BURADA DÜŞER.
      //
      // `bak` niyeti kalıcı bir hedef bırakıyor ve `_bakisGuncelle` boyun
      // sınırı aşıldığında GÖVDEYİ de o hedefe çeviriyor. İş bitip `_aktif`
      // null olunca bu her tikte yeniden oluyordu: Orion tahtaya varıyor,
      // varış yönüne dönüyor, sonra sessizce monitöre geri dönüyordu.
      // Canlı ölçümde tam olarak bu görüldü (bakış tahtada değil monitörde,
      // 9 sn boyunca sabit).
      //
      // Karar: açık bir varış yönü olan `git`/`otur`, eski bakış kilidini
      // GEÇERSİZ KILAR — daha yeni ve hedef hakkında daha somut bir emirdir.
      // Orion başka bir yere bakmak isterse yeni bir `bak` gönderir.
      this._bakis = null;
      this._govdeHedefYaw = is.varisYaw;
      is.asama = "donuyor";
      is.asamaGecen = 0;
      return;
    }
    this._bitir(is, cikti);
  }

  private _asamaDonuyor(is: AktifIs, cikti: NiyetSonucu[]): void {
    // Dönüş `ilerle` sonunda uygulanıyor; burada yalnızca bitişi bekliyoruz.
    if (is.varisYaw !== null) this._govdeHedefYaw = is.varisYaw;
    const kalan = Math.abs(aciSar(this._govdeHedefYaw - this._govdeYaw));
    if (kalan > 0.06 && is.asamaGecen < 2.5) return;
    if (is.tur === "otur") {
      is.asama = "poz";
      is.asamaGecen = 0;
      is.pozBasKonum = { x: this._konum.x, z: this._konum.z };
      is.pozBasY = this._konum.y;
      const g = this._poz.gec("oturuyor");
      if (!g.ok) {
        this._aktif = null;
        cikti.push(this._hata(is.id, g.neden ?? "oturma pozuna geçilemedi"));
        return;
      }
      this._oturuyor = true;
      this._oturmaCikisi = { x: is.pozBasKonum.x, z: is.pozBasKonum.z };
      return;
    }
    this._bitir(is, cikti);
  }

  /** Oturma/kalkma gövde hareketi. */
  private _asamaPoz(is: AktifIs, cikti: NiyetSonucu[]): void {
    const sure = is.tur === "otur" ? OTURMA_SURESI : KALKMA_SURESI;
    const u = kis(is.asamaGecen / sure, 0, 1);
    const varisXZ = is.tur === "otur" ? OTURMA_NOKTASI : this._oturmaCikisi;
    const varisY = is.tur === "otur" ? OTURMA_YUKSELMESI : 0;
    this._konum.x = is.pozBasKonum.x + (varisXZ.x - is.pozBasKonum.x) * u;
    this._konum.z = is.pozBasKonum.z + (varisXZ.z - is.pozBasKonum.z) * u;
    this._konum.y = is.pozBasY + (varisY - is.pozBasY) * u;
    if (u < 1) return;
    if (is.tur === "otur" && is.oturmaYaw !== undefined) {
      // Oturdu; şimdi sandalyeyle masaya dön. "bitti" dönüş bitince yayılır —
      // beyin "oturdum" duyduğunda monitöre bakıyor olmalı.
      is.asama = "sandalyeDon";
      is.asamaGecen = 0;
      is.varisYaw = is.oturmaYaw;
      this._govdeHedefYaw = is.oturmaYaw;
      return;
    }
    if (is.tur === "kalk") this._oturuyor = false;
    this._bitir(is, cikti);
  }

  private _bitir(is: AktifIs, cikti: NiyetSonucu[]): void {
    this._aktif = null;
    this._hiz = 0;
    const veri: Record<string, unknown> = {
      x: +this._konum.x.toFixed(3), y: +this._konum.y.toFixed(3), z: +this._konum.z.toFixed(3),
    };
    if (is.capa) veri["capa"] = is.capa;
    if (is.kalkildi) veri["kalkildi"] = true;
    cikti.push({ niyet_id: is.id, durum: "bitti", veri });
  }

  // ── Bakış ────────────────────────────────────────────────────────────────

  /**
   * Baş/gövde ayrımı. Baş hedefe döner; boyun sınırı aşılırsa GÖVDE de döner.
   * Yürüme işi varken gövde yönü yola aittir — bakış onu ele geçirmez, baş
   * sınırda kalır (insan da yürürken omzunun ötesine bakamaz).
   */
  private _bakisGuncelle(): void {
    if (!this._bakis) { this._basHedefYaw = 0; this._basHedefPitch = 0; return; }
    const coz = this._hedefNoktasi(this._bakis);
    if (!coz.ok) return; // hedef kaybolduysa son bakışı koru
    const dx = coz.nokta.x - this._konum.x;
    const dz = coz.nokta.z - this._konum.z;
    const dy = coz.nokta.y - (this._konum.y + BAS_YUKSEKLIGI);
    const yatay = Math.hypot(dx, dz);
    if (yatay < 1e-4) return;

    const mutlak = yonYaw(dx, dz);
    let rel = aciSar(mutlak - this._govdeYaw);
    if (Math.abs(rel) > BOYUN_YAW_SINIRI) {
      if (!this._aktif) this._govdeHedefYaw = mutlak; // gövde de dönsün
      rel = kis(rel, -BOYUN_YAW_SINIRI, BOYUN_YAW_SINIRI);
    }
    this._basHedefYaw = rel;
    this._basHedefPitch = kis(Math.atan2(dy, yatay), -BOYUN_PITCH_SINIRI, BOYUN_PITCH_SINIRI);
  }
}
