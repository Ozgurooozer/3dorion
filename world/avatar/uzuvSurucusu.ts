// world/avatar/uzuvSurucusu.ts — UZUV SÜRÜCÜSÜ (spec 35 Dilim 5a): klip değerlerini Babylon düğümlerine uygular. Karar vermez; ne uygulanacağını
// örnekleyici söyler (`klipOrnekleyici.ts`), hangi düğüm olduğunu eşleme tablosu (`uzuvEslemesi.ts`).
//
// KATMANLAMA (neden "üstüne ekle"): klip uzvun o anki duruşunu EZMEZ. VRM'de `bosta`/`yuru` klipleri her karede kemikleri yazar; prosedürelde poz
// kodu omuzu her karede sıfırlar. Klibin dönmesi bu duruşun ÜSTÜNE, uzvun eklem noktası etrafında, GÖVDE UZAYINDA uygulanır:
//     yerel' = yerel × (P × R × P⁻¹)        (Babylon satır-vektör sırası)
// P = ebeveynin gövde-kökü düğümüne göre doğrusal kısmı (VRM'de glTF kökünün ayna ölçeği −1 ve boy ölçeği DAHİL — eşlenik alındığı için ikisi de
// sadeleşir, sonuç saf dönmedir), R = gövde uzayındaki dönme. Böylece "sağ kol donme_z +150" hangi gövdede olursa olsun kolu yana-yukarı kaldırır.
//
// BİRİKME KALKANI: önceki karede yazdığımız değer hâlâ duruyorsa (üstüne animasyon yazmadıysa: prosedürelde `rotation.y` kimse sıfırlamaz; VRM'de
// hiç klip oynamıyorsa) taban olarak ÖNCEKİ tabanı alırız; yoksa ofset her kare üst üste eklenip kol dönmeye başlardı. Klip bitince taban geri yazılır.
//
// Kök (`kok` uzvu: bütün beden) iskeletin kendi ara düğümüne MUTLAK yazılır (eğilme, zıplama) — modelin kendi düğümlerine dokunmaz.
"use strict";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Uzuv } from "../../protocol/animasyon.ts";
import { uzuvPozlari, type UzuvDegeri, type UzuvPozu } from "./klipOrnekleyici.ts";

const DERECE = Math.PI / 180;

export interface UzuvSurucusu {
  /** Bu sürücünün gerçekten döndürebildiği uzuvlar (`kok` dahil). */
  readonly uzuvlar: ReadonlySet<Uzuv>;
  /** Bu karenin değerleri; boş dizi = klip yok (yazılanlar tabanına döner). */
  uygula(degerler: readonly UzuvDegeri[]): void;
}

/** Düğümün yerel dönmesini dörtlü olarak okur (VRM kemikleri dörtlü, prosedürel düğümler Euler taşır). */
function donmeOku(d: TransformNode): Quaternion {
  return d.rotationQuaternion ? d.rotationQuaternion.clone() : Quaternion.FromEulerVector(d.rotation);
}

function donmeYaz(d: TransformNode, q: Quaternion): void {
  // Euler düğümüne dörtlü ATANMAZ: atanırsa Babylon `rotation`'ı yok sayar ve poz kodunun her karedeki `rotation.x = …` yazımı ölü kalırdı.
  if (d.rotationQuaternion) d.rotationQuaternion = q.clone();
  else q.toEulerAnglesToRef(d.rotation);
}

/** İki dörtlü aynı dönme mi (q ve −q aynıdır; Euler gidiş-dönüşü işareti çevirebilir). */
const ayniDonme = (a: Quaternion, b: Quaternion): boolean => Math.abs(Quaternion.Dot(a, b)) > 1 - 1e-7;

const sifirMi = (v: { x: number; y: number; z: number }): boolean => v.x === 0 && v.y === 0 && v.z === 0;

/** Babylon'un Euler kuralıyla (YXZ: önce y, sonra x, sonra z) gövde uzayı dönmesi. */
const donmeMatrisi = (p: UzuvPozu): Matrix => Matrix.RotationYawPitchRoll(p.donme.y * DERECE, p.donme.x * DERECE, p.donme.z * DERECE);

/** Düğümün atalarını KÖKTEN aşağı tazeler: ebeveynin dünya matrisi bu karede okunacak (animasyon az önce yerel değerleri yazdı). */
function zincirTazele(d: TransformNode | null): void {
  const zincir: TransformNode[] = [];
  for (let x: TransformNode | null = d; x; x = x.parent as TransformNode | null) zincir.push(x);
  for (let i = zincir.length - 1; i >= 0; i--) zincir[i]!.computeWorldMatrix(true);
}

const derinlik = (d: TransformNode): number => { let n = 0; for (let x = d.parent; x; x = x.parent) n++; return n; };

interface Kayit { taban: Quaternion; yazilan: Quaternion }

/**
 * `kokDugumu`: iskeletin klip için eklediği ara düğüm (gövde kökünün hemen altında; modelin bütün düğümleri onun altında). Gövde uzayı onun
 * çerçevesidir: `kok` eğilince kol dönmeleri de eğilmiş gövdeye göre okunur.
 */
export function uzuvSurucusuKur(kokDugumu: TransformNode, dugumler: ReadonlyMap<Uzuv, TransformNode>): UzuvSurucusu {
  // Ebeveyn önce: çocuğun P'si ebeveynin BU KAREDEKİ ofsetini içersin (ön kol, kalkmış kolun ucunda sallansın).
  const sirali = [...dugumler.entries()].sort((a, b) => derinlik(a[1]) - derinlik(b[1]));
  const kayitlar = new Map<TransformNode, Kayit>();
  const uzuvlar = new Set<Uzuv>(["kok", ...dugumler.keys()]);
  let kokYazildi = false;

  function kokUygula(p: UzuvPozu | undefined): void {
    if (!p) {
      if (kokYazildi) { kokDugumu.position.setAll(0); kokDugumu.rotationQuaternion = Quaternion.Identity(); kokYazildi = false; }
      return;
    }
    kokDugumu.position.set(p.oteleme.x, p.oteleme.y, p.oteleme.z);
    kokDugumu.rotationQuaternion = Quaternion.FromRotationMatrix(donmeMatrisi(p));
    kokYazildi = true;
  }

  function uzuvUygula(d: TransformNode, p: UzuvPozu | undefined): void {
    const simdi = donmeOku(d);
    const k = kayitlar.get(d);
    const taban = k && ayniDonme(simdi, k.yazilan) ? k.taban : simdi;
    if (!p || sifirMi(p.donme)) {
      // Klip bitti/uzuv bu karede dönmüyor: bizim yazdığımız hâlâ duruyorsa tabanı geri koy (animasyon ezdiyse zaten tabandadır).
      if (k) { if (taban !== simdi) { donmeYaz(d, taban); d.computeWorldMatrix(true); } kayitlar.delete(d); }
      return;
    }
    zincirTazele(d.parent as TransformNode | null);
    const ref = kokDugumu.getWorldMatrix();
    const ebeveyn = (d.parent as TransformNode | null)?.getWorldMatrix() ?? Matrix.Identity();
    const P = ebeveyn.multiply(Matrix.Invert(ref));
    P.setTranslationFromFloats(0, 0, 0);
    const C = P.multiply(donmeMatrisi(p)).multiply(Matrix.Invert(P));
    const yerel = new Matrix();
    taban.toRotationMatrix(yerel);
    const yeni = Quaternion.FromRotationMatrix(yerel.multiply(C));
    yeni.normalize();
    donmeYaz(d, yeni);
    // Yerel matris HEMEN tazelenir: iskelet bu karede kemiği bağlı düğümün yerel matrisinden okur; bu karede başka biri (bakış denetleyicisi) matrisi
    // zaten hesapladıysa "senkron" sanılıp eski değer kalabilirdi.
    d.computeWorldMatrix(true);
    kayitlar.set(d, { taban: taban.clone(), yazilan: donmeOku(d) });
  }

  return {
    uzuvlar,
    uygula(degerler) {
      const pozlar = uzuvPozlari(degerler);
      kokUygula(pozlar.get("kok"));
      for (const [uzuv, d] of sirali) uzuvUygula(d, pozlar.get(uzuv));
    },
  };
}

/** Testler ve ölçüm için: düğümün gövde-kökü çerçevesindeki konumu (ebeveyn zinciri tazelenerek). */
export function govdeKonumu(kokDugumu: TransformNode, d: TransformNode): Vector3 {
  zincirTazele(d);
  return Vector3.TransformCoordinates(d.getAbsolutePosition(), Matrix.Invert(kokDugumu.getWorldMatrix()));
}
