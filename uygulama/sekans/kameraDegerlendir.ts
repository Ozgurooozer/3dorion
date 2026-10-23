// uygulama/sekans/kameraDegerlendir.ts — SEKANSIN KAMERASI (spec 38 §7): verilen karede hangi kamera, nerede. SAF ve DURUMSUZ (aynı kare → aynı poz).
//
// KURAL: kare k'da etkin kesme = kare ≤ k olan SON kesme. İlk kesmeden önce poz YOK (null: oyunun kendi kamerası sürer). `yumusak` kesme önceki kesmenin
// kamerasından `gecis_kare` karede harmanlar (smoothstep: başlangıç ve sonda hız 0); önceki kesme yoksa ani. Harman konum, hedef ve görüş alanını ayrı
// ayrı doğrusal karıştırır (iki kameranın arası düz çizgi: duvardan geçebilir — sinematik aracı, çarpışma yok).
"use strict";
import type { KameraKesmesi, Nokta3, Sekans, SekansKamerasi } from "../../protocol/sekans.ts";

export interface KameraPozu { konum: Nokta3; hedef: Nokta3; fov: number; /** Etkin kamera kimliği (harmanda hedef kamera). */ kamera: string }
type KameraVerisi = Pick<Sekans, "kameralar" | "kesmeler">;

const yumusat = (t: number): number => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
const karistir = (a: Nokta3, b: Nokta3, t: number): Nokta3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const kameraPozuDuz = (k: SekansKamerasi): KameraPozu => ({ konum: [...k.konum], hedef: [...k.hedef], fov: k.fov, kamera: k.id });

/** Karedeki etkin kesme ve sırası (yoksa null). */
export function etkinKesme(s: KameraVerisi, kare: number): { kesme: KameraKesmesi; i: number } | null {
  const l = s.kesmeler ?? [];
  let bulunan = -1;
  for (let i = 0; i < l.length; i++) if (l[i]!.kare <= kare) bulunan = i; else break;
  return bulunan < 0 ? null : { kesme: l[bulunan]!, i: bulunan };
}

export function kameraPozu(s: KameraVerisi, kare: number): KameraPozu | null {
  const e = etkinKesme(s, kare);
  if (!e) return null;
  const kameralar = s.kameralar ?? [];
  const hedef = kameralar.find((k) => k.id === e.kesme.kamera);
  if (!hedef) return null;
  const onceki = e.i > 0 ? (s.kesmeler ?? [])[e.i - 1] : null;
  const oncekiKamera = onceki ? kameralar.find((k) => k.id === onceki.kamera) : null;
  const gecen = kare - e.kesme.kare;
  if (e.kesme.gecis === "yumusak" && e.kesme.gecis_kare > 0 && gecen < e.kesme.gecis_kare && oncekiKamera) {
    const t = yumusat(gecen / e.kesme.gecis_kare);
    return { konum: karistir(oncekiKamera.konum, hedef.konum, t), hedef: karistir(oncekiKamera.hedef, hedef.hedef, t), fov: oncekiKamera.fov + (hedef.fov - oncekiKamera.fov) * t, kamera: hedef.id };
  }
  return kameraPozuDuz(hedef);
}
