// world/engine/kamera.ts — İki modlu kamera rig'i: omuz-üstü ve 1. şahıs.
//
// Neden iki mod: spec'te sabitlenmiş karar — "beden dili projenin değeri; saf
// FPS'te görünmez". Varsayılan 3. şahıs, `F` ile 1. şahıs.
//
// İki fazlı güncelleme (bilinçli):
//   guncelle(dt)      — 20Hz mantık tick'inden. HEDEF pozu hesaplar (mod,
//                       duvar sıkıştırma, sinematik). Dünya durumu burada.
//   cizimGuncelle(dt) — render karesinden. Kamerayı hedefe yumuşatır. Bu
//                       yalnızca SUNUM: 20Hz'de lerp'lenen kamera 144Hz
//                       ekranda basamaklı görünür. Dünya durumu değişmez.
//
// molp `SceneManager._tickFps`/`_applyFpsView` mantığı referans alındı:
// Euler rotation kullanılır, quaternion DEĞİL — Babylon 9'da setTarget'ten
// kalan quaternion mod geçişinde sıçrama yapıyor.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Ray } from "@babylonjs/core/Culling/ray";
import { ODA } from "../level/olculer.ts";
import { fareKipiKur, type FareKipi } from "./fareKipi.ts";

/** Kameranın takip ettiği şey. `world/player/oyuncu.ts` bunu uygular. */
export interface KameraHedefi {
  /** Ayak konumu (y = 0 zemin). */
  readonly konum: Vector3;
  /** Zeminden göz hizasına yükseklik. */
  readonly gozYuksekligi: number;
}

export type KameraModu = "omuz" | "birinci";

/** Omuz-üstü yerleşimi. Sağ omuz, hafif yukarıdan. */
const OMUZ = {
  /** Hedefin arkasında kaç metre. */
  geri: 2.8,
  /** Göz hizasının kaç metre üstünde. */
  yukari: 0.45,
  /**
   * Sağa kayma (0 = tam arka).
   *
   * 0.55 düşüktü: gövde çerçevenin TAM ORTASINDA duruyor ve odanın görünümünü
   * kapatıyordu. Omuz kamerasının amacı zaten yandan bakmaktır — karakter
   * kenarda, manzara açık. 0.85 ile kapsül sağa kayıyor ve orta alan açılıyor.
   */
  yan: 0.85,
  /** Duvara çarpınca bırakılacak boşluk. */
  tampon: 0.25,
} as const;

/** Mod geçiş süresi (saniye). Sert atlama olmasın. */
const GECIS_SURESI = 0.38;

const FARE_DUYARLIK = 0.0026;
const PITCH_SINIR = 1.15;

export class KameraRig {
  readonly kamera: FreeCamera;

  private _sahne: Scene;
  private _tuval: HTMLCanvasElement;
  private _hedef: KameraHedefi | null = null;

  private _mod: KameraModu = "omuz";
  /** Geçiş ilerlemesi: 1 = geçiş bitti. */
  private _gecis = 1;

  private _yaw = Math.PI;      // başlangıçta odanın arkasına (-Z) bakar
  private _pitch = 0.06;

  /** Tick'te hesaplanan hedef poz; render karesinde buna yumuşatılır. */
  private _hedefKonum = new Vector3(0, 1.7, 3);
  private _hedefYaw = Math.PI;
  private _hedefPitch = 0.06;

  /** Sinematik çekim (T7). Aktifse oyuncu takibini geçersiz kılar. */
  private _sinematik: { konum: Vector3; bakis: Vector3; kalan: number } | null = null;
  /** Odak kipi: terminal gibi bir yüzeyde sabitlenmiş kamera. Fare bozamaz. */
  private _odak: { konum: Vector3; bakis: Vector3 } | null = null;

  /** Işın testinde yok sayılacak mesh'ler (oyuncu gövdesi, cam, manzara). */
  private _isinDisi = new Set<AbstractMesh>();

  private _fareAktif = false;
  /** Fare kipi (girdi kararı) — kurulum `_olaylariBagla` içinde. */
  private _fare: FareKipi | null = null;
  private _cozucular: Array<() => void> = [];

  constructor(sahne: Scene, tuval: HTMLCanvasElement) {
    this._sahne = sahne;
    this._tuval = tuval;

    this.kamera = new FreeCamera("kamera", new Vector3(0, 1.7, 3), sahne);
    // Varsayılan girdileri BAĞLAMIYORUZ: hareketi oyuncu denetler, kamera
    // yalnızca izler. attachControl çağrılırsa WASD iki kez işlenir.
    this.kamera.rotationQuaternion = null;
    this.kamera.minZ = 0.08;
    this.kamera.maxZ = 60;
    this.kamera.fov = 0.9;
    this.kamera.inertia = 0;
    sahne.activeCamera = this.kamera;

    this._olaylariBagla();
  }

  get mod(): KameraModu { return this._mod; }
  get yaw(): number { return this._yaw; }
  get pitch(): number { return this._pitch; }
  /** Mod geçişi sürüyor mu — oyuncu bu sırada da hareket edebilir. */
  get gecisteMi(): boolean { return this._gecis < 1; }
  get sinematikAktifMi(): boolean { return this._sinematik !== null; }
  /**
   * Fare şu an kamerayı mı sürüyor? HUD için.
   *
   * Odakta Ctrl'ye, gezinirken kilide bağlı — iki kip iki farklı koşul.
   */
  get fareKamerada(): boolean { return this._fare?.kamerada ?? false; }

  hedefAyarla(h: KameraHedefi): void { this._hedef = h; }

  /**
   * Bakış açısını doğrudan kur (radyan). Doğuş yönü, sahne kurulumu ve
   * ölçüm/test için — fare girdisinden bağımsız tek giriş noktası.
   */
  bakisAyarla(yaw: number, pitch = this._pitch): void {
    this._yaw = yaw;
    this._pitch = Math.max(-PITCH_SINIR, Math.min(PITCH_SINIR, pitch));
  }

  /** Işın testinden muaf tut (oyuncu gövdesi, cam, pencere manzarası). */
  isinDisiTut(...meshler: AbstractMesh[]): void {
    for (const m of meshler) this._isinDisi.add(m);
  }

  /** `F` davranışı: modu değiştirir, geçişi başlatır. */
  modDegistir(): KameraModu {
    this._mod = this._mod === "omuz" ? "birinci" : "omuz";
    this._gecis = 0;
    // Kilit durumuna DOKUNMAZ: kilit odağa bağlı (bkz. `_olaylariBagla`),
    // moda değil. Mod değiştirmek fare kipini değiştirmemeli.
    return this._mod;
  }

  /** Fare kilidi (pointer lock). Kilitliyken bakış fareyle döner. */
  fareKilitIste(): void {
    if (document.pointerLockElement !== this._tuval) {
      void this._tuval.requestPointerLock?.();
    }
  }

  /**
   * ODAK KİPİ — terminal gibi bir yüzeyde çalışırken kamerayı sabitler.
   *
   * Sinematikten AYRI bir kip olmak zorunda: sinematik, fare oynayınca
   * bilerek iptal olur (kullanıcı kontrolü kazanır). Terminalde ise tam
   * tersi isteniyor — fareyi oynatmak kamerayı kaçırmamalı, yoksa ekranda
   * yazarken görüntü kayıyor. Odak yalnızca `odakBirak()` ile çözülür.
   *
   * Fare kilidi BIRAKILIR: ekrandayken imleç serbest olmalı ki tıklayıp
   * nesne seçebilesin. Kamerayı ayarlamak istersen Ctrl basılı tut.
   */
  odakKilitle(hedefNokta: Vector3, mesafe = 0.95, yukseklik = 0.05, yon?: Vector3): void {
    // YÖN: verilirse kamera yüzeyin KENDİ normali boyunca konumlanır.
    //
    // Verilmezse "oda ortasına doğru" varsayılır — duvara asılı düz yüzeyler
    // için bu doğru, ama AÇILI bir yüzey için değil. Yönetim terminali masada
    // 24° çevrilmiş duruyor ve varsayılan hesap kamerayı ekrana eğik
    // koyuyordu: görüntüde ekran çerçeveyi taşıdı ve yamuk göründü.
    const ortaya = yon
      ? new Vector3(yon.x, 0, yon.z)
      : new Vector3(-hedefNokta.x, 0, -hedefNokta.z);
    if (ortaya.lengthSquared() < 1e-4) ortaya.set(0, 0, 1);
    ortaya.normalize();
    this._odak = {
      konum: new Vector3(
        hedefNokta.x + ortaya.x * mesafe,
        hedefNokta.y + yukseklik,
        hedefNokta.z + ortaya.z * mesafe,
      ),
      bakis: hedefNokta.clone(),
    };
    this._sinematik = null;
    this.fareKilitBirak();
  }

  /**
   * Odaktan çık: kamera yeniden fareye devredilir.
   *
   * Kilit HEMEN istenir — "ekrandan çıkınca fare ile normal kamera" beklentisi
   * bir tıklama daha gerektirmemeli. Tarayıcı isteği reddedebilir (Esc sonrası
   * kısa bir bekleme uygular); o durumda tuvale tıklamak kilidi geri alır.
   */
  odakBirak(): void {
    this._odak = null;
    this.fareKilitIste();
  }
  get odakta(): boolean { return this._odak !== null; }

  fareKilitBirak(): void {
    if (document.pointerLockElement === this._tuval) document.exitPointerLock();
  }

  /** Bakış ışınının başlangıcı ve birim yönü. Oyuncu etkileşimi bunu kullanır. */
  isin(uzunluk = 2.5): Ray {
    const h = this._hedef;
    const kaynak = h
      ? new Vector3(h.konum.x, h.konum.y + h.gozYuksekligi, h.konum.z)
      : this.kamera.position.clone();
    return new Ray(kaynak, this.bakisYonu(), uzunluk);
  }

  /** Bakışın birim yön vektörü (yaw/pitch'ten türetilir, matrise bağımlı değil). */
  bakisYonu(): Vector3 {
    const cp = Math.cos(this._pitch);
    return new Vector3(cp * Math.sin(this._yaw), -Math.sin(this._pitch), cp * Math.cos(this._yaw));
  }

  /** Yerde ileri yönü (pitch'siz) — oyuncu hareketi bunu taban alır. */
  ileriXZ(): Vector3 {
    return new Vector3(Math.sin(this._yaw), 0, Math.cos(this._yaw));
  }

  /** Yerde sağ yönü. */
  sagXZ(): Vector3 {
    return new Vector3(Math.cos(this._yaw), 0, -Math.sin(this._yaw));
  }

  /**
   * Demo/pazarlama çekimi: kamerayı bir dünya noktasına yumuşak çerçeveler.
   * T7 kullanacak. `sure` bitince takip kendiliğinden geri döner.
   *
   * @param hedefNokta Çerçevelenecek nokta (ör. `capaKonumu("tahta")`).
   * @param mesafe     Noktadan kaç metre geride durulacak.
   * @param yukseklik  Noktanın kaç metre üstünden bakılacak.
   * @param sure       Saniye. 0 veya negatifse elle `sinematikBitir()` gerekir.
   */
  sinematikBak(hedefNokta: Vector3, mesafe = 2.6, yukseklik = 0.7, sure = 4): void {
    // Kamera, noktanın oda ortasına bakan tarafında konumlanır: böylece
    // duvara gömülmez ve sahne ortası çerçeveye girer.
    const ortaya = new Vector3(-hedefNokta.x, 0, -hedefNokta.z);
    if (ortaya.lengthSquared() < 1e-4) ortaya.set(0, 0, 1);
    ortaya.normalize();
    const konum = new Vector3(
      this._kis(hedefNokta.x + ortaya.x * mesafe, ODA.genislik / 2 - 0.4),
      hedefNokta.y + yukseklik,
      this._kis(hedefNokta.z + ortaya.z * mesafe, ODA.derinlik / 2 - 0.4),
    );
    // sure <= 0 → süresiz: yalnızca sinematikBitir() serbest bırakır.
    // (Önceden 0 geçilince ilk tikte kendiliğinden temizleniyordu; belge ile
    //  davranış uyuşmuyordu. Terminale odaklanma bu kipi kullanıyor.)
    this._sinematik = { konum, bakis: hedefNokta.clone(), kalan: sure > 0 ? sure : Infinity };
  }

  sinematikBitir(): void { this._sinematik = null; }

  /**
   * 20Hz mantık adımı. Hedef pozu hesaplar; kamerayı DOĞRUDAN taşımaz.
   */
  guncelle(dt: number): void {
    if (this._gecis < 1) this._gecis = Math.min(1, this._gecis + dt / GECIS_SURESI);

    // Odak, sinematikten önce gelir ve süresizdir.
    if (this._odak) {
      this._hedefKonum.copyFrom(this._odak.konum);
      const y = this._odak.bakis.subtract(this._odak.konum);
      const yatayU = Math.hypot(y.x, y.z) || 1e-6;
      this._hedefYaw = Math.atan2(y.x, y.z);
      this._hedefPitch = -Math.atan2(y.y, yatayU);
      return;
    }

    const s = this._sinematik;
    if (s) {
      s.kalan -= dt;
      if (s.kalan <= 0) {
        this._sinematik = null;
      } else {
        this._hedefKonum.copyFrom(s.konum);
        const yon = s.bakis.subtract(s.konum);
        const yatay = Math.hypot(yon.x, yon.z) || 1e-6;
        this._hedefYaw = Math.atan2(yon.x, yon.z);
        this._hedefPitch = -Math.atan2(yon.y, yatay);
        return;
      }
    }

    const h = this._hedef;
    if (!h) return;

    this._hedefYaw = this._yaw;
    this._hedefPitch = this._pitch;

    const goz = new Vector3(h.konum.x, h.konum.y + h.gozYuksekligi, h.konum.z);

    if (this._mod === "birinci" && this._gecis >= 1) {
      this._hedefKonum.copyFrom(goz);
      return;
    }

    // Omuz-üstü: gözün arkasında ve sağında bir nokta.
    const ileri = this.ileriXZ();
    const sag = this.sagXZ();
    const istenen = new Vector3(
      goz.x - ileri.x * OMUZ.geri + sag.x * OMUZ.yan,
      goz.y + OMUZ.yukari,
      goz.z - ileri.z * OMUZ.geri + sag.z * OMUZ.yan,
    );

    // Duvara girmesin: gözden istenen noktaya ışın at, çarparsa yaklaş.
    const yon = istenen.subtract(goz);
    const uzak = yon.length();
    if (uzak > 1e-4) {
      yon.scaleInPlace(1 / uzak);
      const vurus = this._sahne.pickWithRay(
        new Ray(goz, yon, uzak),
        (m) => m.isPickable && !this._isinDisi.has(m),
      );
      if (vurus?.hit && vurus.distance > 0) {
        const d = Math.max(0.35, vurus.distance - OMUZ.tampon);
        istenen.copyFrom(goz).addInPlace(yon.scaleInPlace(d));
      }
    }

    if (this._mod === "birinci") {
      // Geçiş sürüyor: omuz pozundan göze doğru karıştır.
      const k = this._yumusat(this._gecis);
      this._hedefKonum.set(
        istenen.x + (goz.x - istenen.x) * k,
        istenen.y + (goz.y - istenen.y) * k,
        istenen.z + (goz.z - istenen.z) * k,
      );
    } else if (this._gecis < 1) {
      const k = this._yumusat(this._gecis);
      this._hedefKonum.set(
        goz.x + (istenen.x - goz.x) * k,
        goz.y + (istenen.y - goz.y) * k,
        goz.z + (istenen.z - goz.z) * k,
      );
    } else {
      this._hedefKonum.copyFrom(istenen);
    }
  }

  /**
   * Render karesi. Yalnızca sunum: kamerayı hedef poza yumuşatır.
   * `dt` render delta'sı (saniye).
   */
  cizimGuncelle(dt: number): void {
    // Kare hızından bağımsız yumuşatma: exp(-k·dt).
    // 1. şahısta kamera göze YAPIŞIR (k=1): gecikme baş sallanması gibi hissedilir.
    // Ama ODAKTA değil — orada kamera gözden ayrılıp ekranın önüne gider ve bu
    // yolculuk yumuşak olmalı, yoksa terminale geçiş sert bir ışınlanma olur.
    const hizli = this._mod === "birinci" && this._gecis >= 1
      && !this._sinematik && !this._odak;
    const k = hizli ? 1 : 1 - Math.exp(-14 * Math.min(dt, 0.1));
    const p = this.kamera.position;
    p.x += (this._hedefKonum.x - p.x) * k;
    p.y += (this._hedefKonum.y - p.y) * k;
    p.z += (this._hedefKonum.z - p.z) * k;

    // Rotasyon: Euler, quaternion YOK (bkz. dosya başı notu).
    this.kamera.rotationQuaternion = null;
    if (this._sinematik || this._odak) {
      // ODAK da yönü SÜRÜR. Eskiden yalnızca sinematik bu dala giriyordu ve
      // odakta kamera ekranın önüne gidip OYUNCUNUN baktığı yöne bakmaya devam
      // ediyordu. 3. şahısta fark edilmiyordu (oyuncu zaten monitöre dönük
      // yürüyor), 1. şahısta açı tutmuyordu — bildirilen arıza tam buydu.
      const rk = 1 - Math.exp(-6 * Math.min(dt, 0.1));
      this.kamera.rotation.x += (this._hedefPitch - this.kamera.rotation.x) * rk;
      this.kamera.rotation.y += this._aciFarki(this._hedefYaw, this.kamera.rotation.y) * rk;

      // Odakta oyuncunun bakışını da kameraya YETİŞTİR: odak bırakılınca
      // `else` dalı `_yaw/_pitch`'e anında set ediyor; senkron olmazsa
      // masadan kalkarken görüntü sert biçimde sıçrar.
      if (this._odak) {
        this._pitch = this.kamera.rotation.x;
        this._yaw = this.kamera.rotation.y;
      }
    } else {
      this.kamera.rotation.set(this._pitch, this._yaw, 0);
    }
  }

  sok(): void {
    for (const c of this._cozucular) c();
    this._cozucular = [];
  }

  // ── İç yardımcılar ──────────────────────────────────────────────────────

  private _yumusat(t: number): number {
    // smoothstep — geçişin başı ve sonu yumuşak, ortası hızlı.
    return t * t * (3 - 2 * t);
  }

  private _aciFarki(hedef: number, su: number): number {
    let d = hedef - su;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  private _kis(v: number, sinir: number): number {
    return Math.max(-sinir, Math.min(sinir, v));
  }

  private _olaylariBagla(): void {
    // Fare kipi KARARI ayrı bir modülde (`fareKipi.ts`): kamera geometrisiyle
    // ilgisi yok ve orada tek başına sınanabiliyor. Rig yalnızca "döndür"
    // hizmetini ve odak durumunu sunar.
    this._fare = fareKipiKur({
      tuval: this._tuval,
      odaktaMi: () => this._odak !== null,
      kilitIste: () => this.fareKilitIste(),
      kilitliMi: () => this._fareAktif,
      dondur: (dx, dy) => this._fareyleDondur(dx, dy),
    });

    const kilitDegisti = () => { this._fareAktif = document.pointerLockElement === this._tuval; };
    document.addEventListener("pointerlockchange", kilitDegisti);

    this._cozucular.push(
      () => this._fare?.sok(),
      () => document.removeEventListener("pointerlockchange", kilitDegisti),
    );
  }

  /** Ham fare deltasını bakışa çevirir. Duyarlılık ve sınırlar burada. */
  private _fareyleDondur(dx: number, dy: number): void {
    this._yaw += dx * FARE_DUYARLIK;
    this._pitch = Math.max(-PITCH_SINIR, Math.min(PITCH_SINIR, this._pitch + dy * FARE_DUYARLIK));
    // Sinematik çekim sırasında fare oynatmak çekimi keser — kullanıcı
    // kontrolü her zaman kazanır. (Odak öyle DEĞİL: orada kamera bilerek
    // sabit ve yalnızca `odakBirak()` çözer.)
    if (this._sinematik) this._sinematik = null;
  }
}
