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
import { capaBul, mesafeXZ } from "../level/capalar.ts";
import { SANDALYE } from "../level/olculer.ts";
import { PozMakinesi, hareketliMi } from "./durumMakinesi.ts";
import {
  AVATAR_YARICAP, enYakinSerbest, noktaSerbestMi, yolBul, yolUzunlugu,
  type Nokta2,
} from "./yolBulma.ts";

const DER = Math.PI / 180;

// ── Ölçüler ve hızlar ──────────────────────────────────────────────────────

/** Yürüme hızı (m/s). Sakin, ofis içi tempo. */
export const YURUME_HIZI = 1.25;
/** Koşma hızı (m/s). Uzun mesafede kendiliğinden devreye girer. */
export const KOSMA_HIZI = 2.45;
/** Kalan yol bundan uzunsa avatar koşar. 10×8 m odada nadiren aşılır. */
export const KOSMA_ESIGI = 4.0;
/** Gövde dönüş hızı (rad/s). */
export const GOVDE_DONME_HIZI = 4.2;
/** Baş dönüş hızı (rad/s) — gövdeden hızlı, insan böyle. */
export const BAS_DONME_HIZI = 6.5;

/** İnsan boyun sınırı, yaw. Aşılırsa GÖVDE döner — donuk kafa dönüşü yok. */
export const BOYUN_YAW_SINIRI = 80 * DER;
/** İnsan boyun sınırı, pitch. Aşılamaz; gövde pitch'i telafi etmez. */
export const BOYUN_PITCH_SINIRI = 40 * DER;

/** `git {tip:"nokta"}` için varsayılan varış toleransı. */
export const NOKTA_TOLERANSI = 0.25;
/** Ara noktanın "geçildi" sayılma yarıçapı. */
export const ARA_NOKTA_TOLERANSI = 0.02;
/**
 * `otur` için varış toleransı. Çapanın `yaklasmaYaricapi`sı (0.9 m) kullanılmaz:
 * 90 cm öteden sandalyeye oturmak ışınlanma gibi görünür.
 */
export const OTURMA_TOLERANSI = 0.35;

/** Bir `git`/`otur` işi bu süreyi aşarsa `hata` yayılır. Sonsuz döngü kalkanı. */
export const IS_ZAMAN_ASIMI = 20;

export const OTURMA_SURESI = 0.8;
export const KALKMA_SURESI = 0.7;
export const JEST_SURESI = 1.1;

/** Baş yüksekliği (ayak hizasından). Bakış açısı buradan hesaplanır. */
export const BAS_YUKSEKLIGI = 1.55;
/** Bir yürüme adımının uzunluğu — yürüme fazı buradan türer. */
export const ADIM_UZUNLUGU = 0.72;

/**
 * Otururken kökün yükselmesi. Bacaklar bükülür, kalça oturma yüzeyine oturur;
 * kök (ayak hizası) bu kadar yukarı taşınır.
 */
export const OTURMA_YUKSELMESI = SANDALYE.oturma - 0.30;
/** Oturunca gövdenin sandalye üstüne geçtiği nokta. */
const OTURMA_NOKTASI: Nokta2 = { x: SANDALYE.x, z: SANDALYE.z - 0.04 };

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
}

// ── İç iş tanımı ───────────────────────────────────────────────────────────

type IsTuru = "git" | "otur" | "kalk";
type Asama = "kalkiyor" | "yuruyor" | "donuyor" | "poz";

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

  private _jest: Jest | null = null;
  private _jestKalan = 0;

  private _bakis: Hedef | null = null;
  private _aktif: AktifIs | null = null;
  /** `niyet()` dışarıdan (render/IPC) çağrılır; işlenme TİKTE olur. */
  private _gelen: { n: Niyet; id: string }[] = [];
  /** Kalkınca dönülecek zemin noktası. */
  private _oturmaCikisi: Nokta2 = { x: 0, z: -1.62 };

  private _oyuncuKonumu: (() => Vec3) | null;

  constructor(ayar: YurutucuAyari = {}) {
    const s = ayar.spawn ?? { x: 0, y: 0, z: 0 };
    this._konum = { x: s.x, y: s.y, z: s.z };
    this._govdeYaw = ayar.yaw ?? 0;
    this._govdeHedefYaw = this._govdeYaw;
    this._oyuncuKonumu = ayar.oyuncuKonumu ?? null;
  }

  // ── Dış yüzey ────────────────────────────────────────────────────────────

  /** Niyeti kuyruğa alır. Doğrulama ÇAĞIRANIN işi (protocol/dogrula.ts). */
  niyet(n: Niyet, niyetId: string): void {
    this._gelen.push({ n, id: niyetId });
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
    this._hiz = 0;
    if (this._aktif) this._isIlerle(this._aktif, dt, sonuclar);

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

    const capa = n.hedef.tip === "capa" || n.hedef.tip === "nesne" ? capaBul(n.hedef.ad) : null;
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
    if (!noktaSerbestMi(istenen, AVATAR_YARICAP)) {
      varis = enYakinSerbest(istenen, AVATAR_YARICAP, Math.max(tolerans, zatenOrada));
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
    if (is.asama === "kalkiyor") this._poz.gec("duruyor");
    else {
      const hata = this._yoluKur(is);
      if (hata) { cikti.push(this._hata(id, hata)); return; }
    }
    this._aktif = is;
    cikti.push({ niyet_id: id, durum: "basladi" });
  }

  // ── otur / kalk ──────────────────────────────────────────────────────────

  private _otur(n: Extract<Niyet, { tur: "otur" }>, id: string, cikti: NiyetSonucu[]): void {
    const ad = n.capa ?? "sandalye";
    const capa = capaBul(ad);
    if (!capa) { cikti.push(this._hata(id, `bilinmeyen çapa: '${ad}'. Oturulabilir: sandalye.`)); return; }
    if (!capa.eylemler.includes("otur")) {
      cikti.push(this._hata(id, `'${ad}' çapasına oturulmaz (eylemleri: ${capa.eylemler.join(", ")}). Oturulabilir: sandalye.`));
      return;
    }
    if (this._oturuyor) { cikti.push(this._hata(id, "zaten oturuyorsun. Önce `kalk` niyeti gönder.")); return; }

    this._aktifIptal(cikti);
    const varis: Nokta2 = { x: capa.durak.x, z: capa.durak.z };
    const is: AktifIs = {
      id, tur: "otur",
      asama: mesafeXZ(this._konum, varis) <= OTURMA_TOLERANSI ? "donuyor" : "yuruyor",
      asamaGecen: 0, toplamGecen: 0,
      hedef: varis, tolerans: OTURMA_TOLERANSI,
      varisYaw: yonYaw(capa.yon.x, capa.yon.z),
      yol: [], kosuyor: false, capa: ad,
      pozBasKonum: { x: this._konum.x, z: this._konum.z },
      pozBasY: this._konum.y,
      kalkildi: false,
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
    const g = this._poz.gec("duruyor");
    if (!g.ok) { cikti.push(this._hata(id, g.neden ?? "poz geçişi reddedildi")); return; }
    this._aktif = {
      id, tur: "kalk", asama: "poz", asamaGecen: 0, toplamGecen: 0,
      hedef: null, tolerans: 0, varisYaw: null, yol: [], kosuyor: false, capa: null,
      pozBasKonum: { x: this._konum.x, z: this._konum.z },
      pozBasY: this._konum.y,
      kalkildi: false,
    };
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
    const c = capaBul(nesne);
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
        const c = capaBul(h.ad);
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
    const yol = yolBul({ x: this._konum.x, z: this._konum.z }, hedef);
    if (!yol) {
      return `hedefe giden yol yok: (${hedef.x.toFixed(2)}, ${hedef.z.toFixed(2)}) engellerin arkasında kalıyor. Ulaşılabilir bir çapa ya da nokta seç.`;
    }
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
    }
  }

  /** `git` oturur hâlde geldiğinde: önce kalk, sonra yürü. */
  private _asamaKalkiyor(is: AktifIs, cikti: NiyetSonucu[]): void {
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
        const hiz = (is.kosuyor ? KOSMA_HIZI : YURUME_HIZI) * carpan;
        const adim = Math.min(hiz * dt, uz);
        this._konum.x += (dx / uz) * adim;
        this._konum.z += (dz / uz) * adim;
        this._hiz = dt > 0 ? adim / dt : 0;
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
