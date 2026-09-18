// world/avatar/beden.ts — Babylon SUNUMU. Karar vermez, çizer.
//
// Sözleşme: `yurutucu.ts` bir `AvatarGorunumu` üretir; bu dosya onu iskelete
// uygular. Burada yol bulma, varış tespiti, poz kuralı YOKTUR ve olmamalıdır.
// Bir "if (mesafe < x) dur" satırı buraya sızarsa T2'nin iki katman ayrımı
// çökmüş demektir.
//
// İKİ DÖNGÜ (T1 kamerasındaki desenin aynısı):
//   mantikUygula(g)  → 20 Hz tikinden. HEDEF konum/yaw'ı kaydeder, pozu ve
//                      jesti uygular.
//   cizimGuncelle(dt)→ render karesinden. Kökü hedefe yumuşatır, boşta
//                      mikro-hareketi ve göz kırpmayı uygular.
// 20 Hz'de sıçrayan bir kök 144 Hz ekranda basamaklı görünür; yumuşatma
// SUNUMDUR, dünya durumunu değiştirmez.
"use strict";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AvatarIskeleti } from "./iskelet.ts";
import type { AvatarGorunumu } from "./yurutucu.ts";
import { aciSar } from "./yurutucu.ts";
import { bostaHesapla } from "./bosta.ts";
import { hareketliMi } from "./durumMakinesi.ts";

/** Konum yumuşatma katsayısı (1/s). Büyük = daha sıkı takip. */
const KONUM_YUMUSATMA = 14;
/** Yaw yumuşatma katsayısı (1/s). */
const YAW_YUMUSATMA = 12;

/** `elindekiGoster` uygulayan iskeletler (prosedürel) için isteğe bağlı kanca. */
interface ElKancasi { elindekiGoster?(v: boolean): void }

export class Beden {
  readonly iskelet: AvatarIskeleti;

  private _hedefKonum = new Vector3(0, 0, 0);
  private _hedefYaw = 0;
  private _cizimKonum = new Vector3(0, 0, 0);
  private _cizimYaw = 0;
  private _basYaw = 0;
  private _basPitch = 0;
  private _poz: AvatarGorunumu["poz"] = "duruyor";
  private _faz = 0;
  private _hiz = 0;
  private _jest: AvatarGorunumu["jest"] = null;
  private _jestIlerleme = 0;
  private _agiz = 0;
  private _elinde: string | null = null;
  /** Boşta hareket zamanı — dünya saatinden bağımsız, çizim zamanı yeter. */
  private _t = 0;
  private _tohum: number;

  constructor(iskelet: AvatarIskeleti, tohum = 0.37) {
    this.iskelet = iskelet;
    this._tohum = tohum;
  }

  /** İlk kareden önce ışınlanma olmasın diye başlangıç konumunu oturtur. */
  yerlestir(x: number, y: number, z: number, yaw: number): void {
    this._hedefKonum.set(x, y, z);
    this._cizimKonum.set(x, y, z);
    this._hedefYaw = yaw;
    this._cizimYaw = yaw;
    this.iskelet.konumUygula(this._cizimKonum.x, this._cizimKonum.y, this._cizimKonum.z);
    this.iskelet.govdeUygula(yaw);
  }

  /** 20 Hz mantık tikinden. Yalnızca durumu alır. */
  mantikUygula(g: AvatarGorunumu): void {
    this._hedefKonum.set(g.konum.x, g.konum.y, g.konum.z);
    this._hedefYaw = g.govdeYaw;
    this._basYaw = g.basYaw;
    this._basPitch = g.basPitch;
    this._poz = g.poz;
    this._faz = g.yurumeFazi;
    this._hiz = g.hiz;
    this._jest = g.jest;
    this._jestIlerleme = g.jestIlerlemesi;
    this._agiz = g.agiz;
    if (this._elinde !== g.elinde) {
      this._elinde = g.elinde;
      (this.iskelet as AvatarIskeleti & ElKancasi).elindekiGoster?.(g.elinde !== null);
    }
  }

  /** Render karesinden. Yumuşatma ve mikro-hareket — dünya durumu değişmez. */
  cizimGuncelle(dt: number): void {
    this._t += dt;

    const k = 1 - Math.exp(-KONUM_YUMUSATMA * dt);
    this._cizimKonum.x += (this._hedefKonum.x - this._cizimKonum.x) * k;
    this._cizimKonum.y += (this._hedefKonum.y - this._cizimKonum.y) * k;
    this._cizimKonum.z += (this._hedefKonum.z - this._cizimKonum.z) * k;

    const ky = 1 - Math.exp(-YAW_YUMUSATMA * dt);
    this._cizimYaw = aciSar(this._cizimYaw + aciSar(this._hedefYaw - this._cizimYaw) * ky);

    const i = this.iskelet;
    i.konumUygula(this._cizimKonum.x, this._cizimKonum.y, this._cizimKonum.z);
    i.govdeUygula(this._cizimYaw);
    i.pozUygula(this._poz, this._faz, this._hiz);
    i.basUygula(this._basYaw, this._basPitch);

    // Boşta mikro-hareket: hareket hâlindeyken nefes genliği kısılır, ağırlık
    // aktarımı tamamen kesilir — yürürken yana yalpalamak sarhoş gösterir.
    const b = bostaHesapla(this._t, this._tohum);
    const durgun = !hareketliMi(this._poz);
    i.bostaUygula(b.nefes * (durgun ? 1 : 0.35), durgun ? b.agirlik : 0);
    if (this._jest) i.jestUygula(this._jest, this._jestIlerleme);

    // Ağız sesin, göz kırpma boştalığın: ağız açıkken göz kırpması bastırılmaz,
    // ikisi bağımsızdır (insanlar konuşurken de kırpar).
    i.agizUygula(this._agiz);
    i.gozKirp(b.gozKapali);
  }

  gorunur(g: boolean): void { this.iskelet.gorunur(g); }
  yokEt(): void { this.iskelet.yokEt(); }
}
