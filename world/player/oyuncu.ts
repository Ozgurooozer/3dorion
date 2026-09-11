// world/player/oyuncu.ts — Oyuncu (Ozyn) denetleyicisi.
//
// Sorumluluk: klavye → hareket, çarpışma, bakış ışını, `E`/`Esc` etkileşimi
// ve `OyuncuDurumu` biçiminde OKUNUR durum.
//
// KATI SINIR: burada protokol MESAJI üretilmez, hiçbir kanala yazılmaz.
// `oyuncuDurumu()` salt-okunur bir görüntü döner; onu `Algi` zarfına çevirmek
// T4'ün (bridge) işidir. `world/` beyne doğrudan konuşmaz.
//
// Hareket 20Hz mantık tick'inde işlenir — kare hızından bağımsız. Yer çekimi
// simülasyonu yok: zemin düz, zıplama yok, `y` her zaman 0. Bu bilinçli; MVP'de
// yükseklik farkı olan tek şey sandalye ve oraya `otur` niyetiyle çıkılır.
"use strict";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CreateCapsule } from "@babylonjs/core/Meshes/Builders/capsuleBuilder";
import type { OyuncuDurumu } from "../../protocol/algi.ts";
import type { KameraHedefi, KameraRig } from "../engine/kamera.ts";
import type { OdaKurulumu } from "../level/oda.ts";
import { capaBul } from "../level/capalar.ts";
import { vec3 } from "../level/capaGeometri.ts";
import {
  carpisiyorMu, GOZ_YUKSEKLIK, GOVDE_YUKSEKLIK, OYUNCU_YARICAP, SANDALYE,
} from "../level/olculer.ts";
import { EtkilesimOlaylari, ipucuMetni, type EtkilesimYayici } from "./etkilesim.ts";
import { bakilanCapa } from "./isinTarama.ts";

/** Yürüme / koşma hızı (m/s). */
const HIZ_YURU = 2.6;
const HIZ_KOS = 4.6;
/** Etkileşim ışını menzili — spec: 2.5 m. */
const ISIN_MENZIL = 2.5;
/** "Orion'a bakıyor" konik toleransı (yarı açı ≈ 28°). */
const BAKIS_KOSINUS = Math.cos(0.49);

export interface OyuncuSecenekleri {
  /** Başlangıç konumu (ayak). Varsayılan: kapının önü. */
  dogumYeri?: Vector3;
  /** Olay yayıcısı. Varsayılan: süreç geneli `EtkilesimOlaylari`. */
  yayici?: EtkilesimYayici;
}

export class Oyuncu implements KameraHedefi {
  /** Ayak konumu. y her zaman 0 (düz zemin). */
  readonly konum: Vector3;
  readonly gozYuksekligi = GOZ_YUKSEKLIK;
  /** Görünür gövde — 3. şahısta kendini görmek için. VRM T2'nin işi. */
  readonly govde: Mesh;

  private _rig: KameraRig;
  private _yayici: EtkilesimYayici;

  private _tuslar = new Set<string>();
  private _cozucular: Array<() => void> = [];
  /** Dünya zamanı — olaylara damga basmak için tick'ten güncellenir. */
  private _t = 0;
  /** Son karede gerçekten hareket etti mi (HUD/animasyon ipucu). */
  private _hareketli = false;
  /**
   * Orion'un konumu. T2 avatarı gelene kadar sandalye kabul edilir; avatar
   * geldiğinde `orionKonumuAyarla` ile gerçek konum bağlanır.
   */
  private _orion = new Vector3(SANDALYE.x, SANDALYE.oturma + 0.5, SANDALYE.z);

  constructor(sahne: Scene, oda: OdaKurulumu, rig: KameraRig, sec: OyuncuSecenekleri = {}) {
    this._rig = rig;
    this._yayici = sec.yayici ?? EtkilesimOlaylari;

    this.konum = (sec.dogumYeri ?? new Vector3(2.6, 0, 2.6)).clone();
    this.konum.y = 0;

    this.govde = CreateCapsule("oyuncu_govde", {
      radius: OYUNCU_YARICAP,
      height: GOVDE_YUKSEKLIK,
      tessellation: 10,
      subdivisions: 1,
    }, sahne);
    const m = new StandardMaterial("m_oyuncu", sahne);
    m.diffuseColor = new Color3(0.30, 0.42, 0.62);
    m.emissiveColor = new Color3(0.03, 0.05, 0.09);
    m.specularColor = new Color3(0.05, 0.05, 0.06);
    this.govde.material = m;
    // Kendi gövdesi bakış ışınını ve kamera duvar testini engellemesin.
    this.govde.isPickable = false;
    this._govdeyiYerlestir();

    rig.hedefAyarla(this);
    rig.isinDisiTut(this.govde, ...oda.seffaflar);

    this._olaylariBagla();
  }

  get hareketliMi(): boolean { return this._hareketli; }
  get yayici(): EtkilesimYayici { return this._yayici; }

  /** T2 avatarı hazır olduğunda gerçek Orion konumunu bağlar. */
  orionKonumuAyarla(v: Vector3): void { this._orion.copyFrom(v); }

  /**
   * 20Hz mantık adımı. Hareket + çarpışma + etkileşim taraması.
   * @param t  dünya zamanı (saniye)
   * @param dt sabit adım (saniye)
   */
  guncelle(t: number, dt: number): void {
    this._t = t;
    this._hareket(dt);
    this._etkilesimTara();
  }

  /** Protokol biçiminde salt-okunur durum. Mesaj YAYMAZ — T4 yayar. */
  oyuncuDurumu(): OyuncuDurumu {
    const goz = new Vector3(this.konum.x, this.konum.y + GOZ_YUKSEKLIK, this.konum.z);
    const bakis = this._rig.bakisYonu();
    const oraya = this._orion.subtract(goz);
    const mesafe = oraya.length();
    const bakiyor = mesafe > 1e-3 && Vector3.Dot(bakis, oraya.scale(1 / mesafe)) >= BAKIS_KOSINUS;
    return {
      konum: vec3(goz),
      bakis: vec3(bakis),
      bakiyor,
      mesafe,
      etkilesim: this._yayici.aktif?.capa ?? null,
    };
  }

  sok(): void {
    for (const c of this._cozucular) c();
    this._cozucular = [];
  }

  // ── Hareket ─────────────────────────────────────────────────────────────

  private _hareket(dt: number): void {
    const ileri = (this._basili("KeyW") ? 1 : 0) - (this._basili("KeyS") ? 1 : 0);
    const yan = (this._basili("KeyD") ? 1 : 0) - (this._basili("KeyA") ? 1 : 0);
    this._hareketli = ileri !== 0 || yan !== 0;
    if (!this._hareketli) return;

    const f = this._rig.ileriXZ();
    const s = this._rig.sagXZ();
    let dx = f.x * ileri + s.x * yan;
    let dz = f.z * ileri + s.z * yan;
    const boy = Math.hypot(dx, dz) || 1;
    dx /= boy; dz /= boy;

    const kos = this._basili("ShiftLeft") || this._basili("ShiftRight");
    const adim = (kos ? HIZ_KOS : HIZ_YURU) * dt;

    // Eksen ayrıştırmalı çarpışma: X ve Z ayrı denenir → duvara sürtünürken
    // durmak yerine kayar. Babylon moveWithCollisions'a gerek yok; oda
    // eksen hizalı kutulardan oluşuyor, AABB testi hem doğru hem bedava.
    const yeniX = this.konum.x + dx * adim;
    if (!carpisiyorMu(yeniX, this.konum.z)) this.konum.x = yeniX;
    const yeniZ = this.konum.z + dz * adim;
    if (!carpisiyorMu(this.konum.x, yeniZ)) this.konum.z = yeniZ;

    this.konum.y = 0;
    this._govdeyiYerlestir();
  }

  private _govdeyiYerlestir(): void {
    this.govde.position.set(this.konum.x, GOVDE_YUKSEKLIK / 2, this.konum.z);
    // Gövde bakışın yatay yönüne döner (kamera pitch'i gövdeyi eğmez).
    this.govde.rotation.y = this._rig.yaw;
    // 1. şahısta kamera gövdenin içinde: kendi kafasını görmesin.
    this.govde.isVisible = this._rig.mod !== "birinci" || this._rig.gecisteMi;
  }

  // ── Etkileşim ───────────────────────────────────────────────────────────

  /**
   * Bakış ışınını 2.5 m tarar ve OKLUZYONA saygı duyar.
   *
   * `scene.pickWithRay` + etiket süzgeci KULLANILMAZ: süzgeç isabetten önce
   * çalıştığı için duvar ve masa ışını durdurmuyor, oyuncu duvarın arkasından
   * monitöre `E` basabiliyordu. Artık `isinTarama.ts` odanın tüm katı
   * yüzeylerini tarar, EN YAKIN isabeti verir; etiket süzmesi ondan SONRA olur.
   */
  private _etkilesimTara(): void {
    if (this._yayici.aktif) { this._yayici.ipucuAyarla(null); return; }

    const kaynak = { x: this.konum.x, y: this.konum.y + GOZ_YUKSEKLIK, z: this.konum.z };
    const ad = bakilanCapa(kaynak, this._rig.bakisYonu(), ISIN_MENZIL);
    const capa = ad ? capaBul(ad) : null;
    if (!capa) { this._yayici.ipucuAyarla(null); return; }

    const eylem = this._birincilEylem(capa.eylemler);
    if (!eylem) { this._yayici.ipucuAyarla(null); return; }
    this._yayici.ipucuAyarla({ capa: capa.ad, eylem, metin: ipucuMetni(capa.etiket, eylem) });
  }

  /** "bak" dışındaki ilk eylem — ipucunun ve `E`nin varsayılan eylemi. */
  private _birincilEylem(eylemler: readonly string[]): string | null {
    for (const e of eylemler) if (e !== "bak") return e;
    return null;
  }

  private _eTusu(): void {
    const i = this._yayici.sonIpucu;
    if (!i) return;
    this._yayici.baslat({
      capa: i.capa,
      eylem: i.eylem,
      kaynak: { x: this.konum.x, y: this.konum.y, z: this.konum.z },
      t: this._t,
    });
    this._yayici.ipucuAyarla(null);
  }

  // ── Girdi ───────────────────────────────────────────────────────────────

  private _basili(kod: string): boolean { return this._tuslar.has(kod); }

  private _olaylariBagla(): void {
    const bas = (e: KeyboardEvent) => {
      const hedef = e.target as HTMLElement | null;
      // Bir metin alanına yazılıyorsa dünya klavyeyi çalmaz (T3 terminali).
      if (hedef && (hedef.tagName === "INPUT" || hedef.tagName === "TEXTAREA")) return;
      this._tuslar.add(e.code);
      if (e.code === "KeyF") { this._rig.modDegistir(); this._govdeyiYerlestir(); }
      else if (e.code === "KeyE") this._eTusu();
      else if (e.code === "Escape") {
        // Esc önce etkileşimi kapatır; etkileşim yoksa fare kilidini bırakır.
        if (!this._yayici.bitir()) this._rig.fareKilitBirak();
      }
    };
    const birak = (e: KeyboardEvent) => { this._tuslar.delete(e.code); };
    // Pencere odağı kaybolunca tuşlar "basılı kalmasın".
    const bosalt = () => this._tuslar.clear();

    addEventListener("keydown", bas);
    addEventListener("keyup", birak);
    addEventListener("blur", bosalt);
    this._cozucular.push(
      () => removeEventListener("keydown", bas),
      () => removeEventListener("keyup", birak),
      () => removeEventListener("blur", bosalt),
    );
  }
}
