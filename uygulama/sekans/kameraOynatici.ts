// uygulama/sekans/kameraOynatici.ts — SEKANS KAMERASINI SAHNEYE VURUR (spec 38 §7): ▶ sürerken oynatma karesinin, durunca (isteğe bağlı) playhead'in kamera pozunu canlı kameraya verir.
//
// İKİ KAYNAK, TEK SÜRÜCÜ: (1) ▶ OYNUYORSA oynatıcının anlık görüntüsündeki kamera verisi ve oynatıcının karesi — oynarken düzenleme kamerayı değiştirmez;
// (2) oynamıyorsa editörün ÖNİZLEME isteği (`onizleme`): her karede yeniden sorulur (playhead kayarken kamera kayar). İkisi de yoksa ya da poz null ise
// (ilk kesmeden önce) kamera OYUNUN kendisine bırakılır. Sürücü Babylon bilmez: `KameraSurucusu` (giris.ts `KameraRig`e bağlar); kare döngüsü dışarıdan
// (`kareGozcusu`: render öncesi) — başsız testte sahte döngü.
// BIRAKMA: ▶ biter/durur ya da önizleme kapanırsa sürücü BİR KEZ `uygula(null)` alır (kamera oyuncuya döner); boştayken her karede null gönderilmez.
"use strict";
import type { SekansOynatici } from "./oynatici.ts";
import { kameraPozu, type KameraPozu } from "./kameraDegerlendir.ts";
import type { Sekans } from "../../protocol/sekans.ts";

export interface KameraSurucusu {
  /** Poz verilirse kamerayı o pozda tutar; null → oyunun kendi kamerasına döner. */
  uygula(p: KameraPozu | null): void;
}

export interface KameraOynatici {
  /** Editör: oynamıyorken kamera şu sekansın şu karesini göstersin (null ya da `null` döndüren işlev = kapalı). */
  onizleme(f: (() => { sekans: Pick<Sekans, "kameralar" | "kesmeler">; kare: number } | null) | null): void;
  onizlemeAcikMi(): boolean;
  /** Dinlemeyi bırak (test ve kapanış). */
  yokEt(): void;
}

export function kameraOynaticiKur(a: { oynatici: SekansOynatici; surucu: KameraSurucusu; kareGozcusu: (f: () => void) => () => void }): KameraOynatici {
  let onizleme: (() => { sekans: Pick<Sekans, "kameralar" | "kesmeler">; kare: number } | null) | null = null;
  let uygulandi = false;

  const birak = (): void => { if (uygulandi) { uygulandi = false; a.surucu.uygula(null); } };
  const ver = (p: KameraPozu | null): void => { if (p) { uygulandi = true; a.surucu.uygula(p); } else birak(); };

  const dur = a.kareGozcusu(() => {
    const c = a.oynatici.durum().calisiyor;
    if (c) {
      const k = a.oynatici.kare();
      ver(c.kamera.kesmeler?.length && k !== null ? kameraPozu(c.kamera, k) : null);
      return;
    }
    const o = onizleme?.() ?? null;
    ver(o ? kameraPozu(o.sekans, o.kare) : null);
  });

  return {
    onizleme(f) { onizleme = f; if (!f) birak(); },
    onizlemeAcikMi: () => onizleme !== null,
    yokEt() { dur(); birak(); },
  };
}
