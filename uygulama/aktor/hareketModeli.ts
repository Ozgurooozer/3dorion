// uygulama/aktor/hareketModeli.ts — HAREKET BİLEŞENİ (kinematik) MANTIĞI (spec 45 B4). SAF: Babylon, DOM, zaman ve rastgelelik YOK.
//
// Kinematik: fizik motoru yok (Havok en sona, spec 45 §10); komut (hedef hız + dönme hızı) ivmeyle yumuşatılır ve konum/yön her karede ilerler.
// Eksenler Babylon sol elli: yön `yaw` (rad), ileri vektörü (sin yaw, cos yaw) (`rotation.y` ile aynı; yaw 0 → +Z). Çarpışma yok: duvara yürür,
// engel tanımaz (spec 45 §12). Zemine yapışma yüksekliği çalışma zamanının işi (burada yalnız yatay düzlem).
"use strict";
import { kodlu } from "../../world/level/cekirdek/aktorHatalari.ts";

export interface HareketAyari {
  /** m/s */
  readonly azamiHiz: number;
  /** m/s² (hem hızlanma hem yavaşlama) */
  readonly ivme: number;
  /** °/s */
  readonly donmeHizi: number;
}

export interface HareketDurumu {
  readonly x: number;
  readonly z: number;
  /** rad */
  readonly yaw: number;
  /** İleri yönde işaretli hız (m/s). */
  readonly hiz: number;
}

/** Komut: hedef ileri hız (m/s, eksi = geri) ve hedef dönme hızı (°/s, + = sağa/saat yönü Babylon yaw artışı). Sıfır sıfır = dur. */
export interface HareketKomutu { readonly hiz: number; readonly donus: number }

/** Bu eşiğin altındaki hız "duruyor" sayılır (m/s): ivmeyle sıfıra yaklaşırken sonsuz yarım adım olmasın. */
export const DURMA_ESIGI = 0.01;

const sinirla = (v: number, a: number): number => Math.max(-a, Math.min(a, v));

/** Komutun geçerliliği (sayı sonlu mu); geçerliyse null. */
export function hareketKomutuHatasi(k: HareketKomutu, a: HareketAyari): string | null {
  if (!Number.isFinite(k.hiz) || !Number.isFinite(k.donus)) return kodlu("AKT-HRK-002", "hız ve dönüş sonlu sayı olmalı");
  if (Math.abs(k.hiz) > a.azamiHiz) return kodlu("AKT-HRK-003", `hız azami hızı aşıyor (|${k.hiz}| > ${a.azamiHiz} m/s)`);
  if (Math.abs(k.donus) > a.donmeHizi) return kodlu("AKT-HRK-004", `dönüş hızı azami dönme hızını aşıyor (|${k.donus}| > ${a.donmeHizi} °/s)`);
  return null;
}

/** Bir adım (dt sn). Hız hedefe `ivme·dt`'den hızlı yaklaşmaz, hedefi AŞMAZ; dönme anında komuttur (dönme ivmesi yok: ölçülmedi). */
export function hareketAdimi(d: HareketDurumu, k: HareketKomutu, a: HareketAyari, dt: number): { durum: HareketDurumu; hareketli: boolean } {
  if (!(dt > 0)) return { durum: d, hareketli: Math.abs(d.hiz) > DURMA_ESIGI };
  const hedef = sinirla(k.hiz, a.azamiHiz);
  const fark = hedef - d.hiz, adim = a.ivme * dt;
  let hiz = Math.abs(fark) <= adim ? hedef : d.hiz + Math.sign(fark) * adim;
  if (hedef === 0 && Math.abs(hiz) < DURMA_ESIGI) hiz = 0;
  const yaw = d.yaw + (sinirla(k.donus, a.donmeHizi) * Math.PI / 180) * dt;
  // Konum, adım içindeki ORTALAMA hızla (yamuk): hızlanırken ilk adımda hedef hıza fırlamasın.
  const ort = (d.hiz + hiz) / 2;
  const x = d.x + Math.sin(yaw) * ort * dt, z = d.z + Math.cos(yaw) * ort * dt;
  return { durum: { x, z, yaw, hiz }, hareketli: Math.abs(hiz) > DURMA_ESIGI };
}
