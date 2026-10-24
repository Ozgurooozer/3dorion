// uygulama/sekans/editor/serbestKamera.ts — EDİTÖR SERBEST KAMERASI (spec 38 §7): orbit, pan, yakınlaş, uç. SAF: DOM ve Babylon yok.
//
// Sekans editörü açıkken oyunun kendi kamerası (WASD/fare) çalışmaz; animasyonu her açıdan inceleyebilmek için Blender/Unreal viewport'u gibi bir kamera lazım.
// Model HEDEF NOKTA etrafında küresel (yatay açı, yükselti, mesafe) + görüş alanı: konum = hedef + küresel (`kameraYardimcilari.konumdan`).
//   orbit   hedefin etrafında dön (sağ tuş sürükle / Alt + sol tuş)     pan   hedefi kamera düzleminde kaydır (orta tuş sürükle)
//   zoom    hedefe yaklaş/uzaklaş (tekerlek; mesafeyle orantılı)         uç    WASD/QE: hedef ve konum birlikte kamera yönünde gider (sağ tuş basılıyken)
// Eksenler Babylon dünyası (Y yukarı, sol elli): yatay açı 0 = hedefin +Z'sinde, artı = +X'e; kamera sağı = yukarı × ileri.
"use strict";
import type { Nokta3 } from "../../../protocol/sekans.ts";
import { EN_UZAK, EN_YAKIN, konumdan, kuresel } from "./kameraYardimcilari.ts";

export interface SerbestKamera { hedef: Nokta3; yatay: number; yukselti: number; mesafe: number; /** Dikey görüş alanı (derece). */ fov: number }

export const ORBIT_DERECE_PIKSEL = 0.3;
const YUKSELTI_SINIRI = 85;

/** Konum ve hedeften serbest kamera (görüş alanı verilir). */
export function serbestKameradan(konum: Nokta3, hedef: Nokta3, fov: number): SerbestKamera {
  const k = kuresel({ konum, hedef });
  return { hedef: [...hedef], yatay: k.yatay, yukselti: Math.max(-YUKSELTI_SINIRI, Math.min(YUKSELTI_SINIRI, k.yukselti)), mesafe: Math.max(EN_YAKIN, Math.min(EN_UZAK, k.mesafe)), fov };
}

export const serbestKonum = (k: SerbestKamera): Nokta3 => konumdan(k.hedef, k.yatay, k.yukselti, k.mesafe);

/** Kamera ekseni: ileri (konumdan hedefe), sağ (yatay düzlemde), yukarı (kameranın kendi yukarısı). */
export function kameraEksenleri(k: SerbestKamera): { ileri: Nokta3; sag: Nokta3; yukari: Nokta3 } {
  const p = serbestKonum(k);
  const ix = k.hedef[0] - p[0], iy = k.hedef[1] - p[1], iz = k.hedef[2] - p[2];
  const l = Math.hypot(ix, iy, iz) || 1;
  const ileri: Nokta3 = [ix / l, iy / l, iz / l];
  // sağ = yukarı(0,1,0) × ileri, yataya normalleştirilir (kutba çok yaklaşınca yükselti sınırı sayesinde sıfırlanmaz)
  const sx = ileri[2], sz = -ileri[0], sl = Math.hypot(sx, sz) || 1;
  const sag: Nokta3 = [sx / sl, 0, sz / sl];
  // yukarı = ileri × sağ (sol elli: ileri +Z, sağ +X → +Y)
  const yukari: Nokta3 = [ileri[1] * sag[2] - ileri[2] * sag[1], ileri[2] * sag[0] - ileri[0] * sag[2], ileri[0] * sag[1] - ileri[1] * sag[0]];
  return { ileri, sag, yukari };
}

/** Orbit: fare kayması (piksel). Sağa sürükleyince kamera hedefin etrafında SAĞA döner (sahne sola kayar); yukarı sürükleyince kamera yükselir. */
export function orbit(k: SerbestKamera, dx: number, dy: number): SerbestKamera {
  return { ...k, yatay: k.yatay - dx * ORBIT_DERECE_PIKSEL, yukselti: Math.max(-YUKSELTI_SINIRI, Math.min(YUKSELTI_SINIRI, k.yukselti + dy * ORBIT_DERECE_PIKSEL)) };
}

/** Pan: hedefi kamera düzleminde kaydırır; sürüklenen nokta imlecin altında kalsın diye mesafe ve görüş alanıyla ölçeklenir (`yukseklikPx` tuval yüksekliği). */
export function pan(k: SerbestKamera, dx: number, dy: number, yukseklikPx: number): SerbestKamera {
  const { sag, yukari } = kameraEksenleri(k);
  const pikselMetre = (2 * k.mesafe * Math.tan((k.fov * Math.PI) / 360)) / Math.max(1, yukseklikPx);
  return { ...k, hedef: [k.hedef[0] - (sag[0] * dx - yukari[0] * dy) * pikselMetre, k.hedef[1] - (sag[1] * dx - yukari[1] * dy) * pikselMetre, k.hedef[2] - (sag[2] * dx - yukari[2] * dy) * pikselMetre] };
}

/** Zoom: tekerlek adımı (artı = uzaklaş). Mesafenin yüzdesi (her adımda %10), sınırlı. */
export function zoom(k: SerbestKamera, adim: number): SerbestKamera {
  return { ...k, mesafe: Math.max(EN_YAKIN, Math.min(EN_UZAK, k.mesafe * Math.pow(1.1, adim))) };
}

/** Uç (fly): kamera yönünde ileri, yanlara, yukarı; hedef ve konum BİRLİKTE gider (mesafe aynı kalır). `hiz` m/sn, `dt` sn. */
export function uc(k: SerbestKamera, ileri: number, sag: number, yukari: number, hiz: number, dt: number): SerbestKamera {
  if (!ileri && !sag && !yukari) return k;
  const e = kameraEksenleri(k);
  const m = hiz * dt;
  return { ...k, hedef: [
    k.hedef[0] + (e.ileri[0] * ileri + e.sag[0] * sag + 0 * yukari) * m,
    k.hedef[1] + (e.ileri[1] * ileri + e.sag[1] * sag + yukari) * m,
    k.hedef[2] + (e.ileri[2] * ileri + e.sag[2] * sag + 0 * yukari) * m,
  ] };
}

/** Görüş alanı sınırları (derece): sekans kamerasınınkiyle aynı. */
export const FOV_EN_AZ = 10, FOV_EN_COK = 120;
