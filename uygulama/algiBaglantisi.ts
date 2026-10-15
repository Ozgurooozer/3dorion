// uygulama/algiBaglantisi.ts — Algı hizmetine dünya görüşünü veren bağ (`algiSor`).
//
// Eskiden uygulama/giris.ts'teydi (mimari düzenleme B1–B2). Sorguyu `mind/algiHizmeti.ts` yanıtlar; burası Orion'un
// ŞU ANKİ yerinin nesnelerini, çapalarını ve görüş ışınını ona verir.
"use strict";
import { sorguYanitla, type Cevap, type Soru } from "../mind/algiHizmeti.ts";
import { isinTara } from "../world/player/isinTarama.ts";
import { gorunenNesneler } from "../world/player/gorunurluk.ts";
import { GOZ_YUKSEKLIK } from "../world/level/olculer.ts";
import type { Oyuncu } from "../world/player/oyuncu.ts";
import type { Avatar } from "../world/avatar/index.ts";
import type { Yerler } from "./yerGecisi.ts";

export interface AlgiBaglantisiGirdisi {
  yerler: Yerler;
  oyuncu: Oyuncu;
  /** Sonradan atanır (avatar asenkron yüklenir): çağrı anında okunur. */
  orion: () => Avatar | null;
}

export function algiSorKur(girdi: AlgiBaglantisiGirdisi): (ne: Soru) => Cevap {
  const { yerler, oyuncu } = girdi;
  /**
   * Algı hizmetine dünya görüşünü verir.
   *
   * Görünürlük GERÇEK ışınla sınanır (`isinTara`, `KATI_YUZEYLER`): duvar,
   * kapı, raf ışını durdurur. Orion'un cevabı bu yüzden bulunduğu yere bağlıdır
   * — tahtanın önündeyken gördüğü ile kapıdayken gördüğü aynı değildir.
   */
  function algiSor(ne: Soru): Cevap {
    const d = girdi.orion()?.durum();
    const konum = d?.konum ?? { x: 0, y: 0, z: 0 };
    // Avatarın baktığı yön; yoksa odanın içine doğru makul bir varsayılan.
    const bakis = d?.bakis ?? { x: 0, y: 0, z: -1 };

    // NPC ALGISI (Ozyn 2026-10-11): Orion'un yerindeki algılanır nesneler; görüş hattı nesnenin 9 noktasından
    // (gorunurluk.ts — tek ışın büyük nesnede kendi duvarına çarpıyordu). Menzil ve seçim algı hizmetinde (mind/).
    const gorunum = new Map(gorunenNesneler(konum, bakis, GOZ_YUKSEKLIK, yerler.orion.nesneler, yerler.orion.katiYuzeyler).map((g) => [g.id, g]));
    const nesneler = yerler.orion.nesneler.map((n) => ({
      ad: n.ad, konum: { x: n.kutu.x, y: n.kutu.y, z: n.kutu.z }, gorunur: gorunum.get(n.id)?.gorunur ?? false,
    }));
    return sorguYanitla(ne, {
      konum, bakis,
      gozYuksekligi: GOZ_YUKSEKLIK,
      nesneler,
      ...(yerler.orion.algiMenzil !== undefined ? { menzil: yerler.orion.algiMenzil } : {}),
      // Sanal çapalar (oda_ortasi) elenir: gidilebilir hedeftirler ama
      // görülebilir nesne değildirler.
      capalar: yerler.orion.capalar
        .filter((c) => !c.sanal)
        .map((c) => ({ ad: c.ad, konum: c.konum, etiket: c.etiket })),
      oyuncu: oyuncu.oyuncuDurumu().konum,
      gorunurMu: (kaynak, hedef) => {
        const dx = hedef.x - kaynak.x, dy = hedef.y - kaynak.y, dz = hedef.z - kaynak.z;
        const u = Math.hypot(dx, dy, dz);
        if (u < 1e-4) return true;
        const isabet = isinTara(kaynak, { x: dx / u, y: dy / u, z: dz / u }, u, yerler.orion.katiYuzeyler);
        // Işın hedefe VARMADAN bir şeye çarptıysa engel var demektir.
        // 0.25 m pay: hedefin kendi yüzeyi ışını durdurur, bu engel sayılmaz.
        return !isabet || isabet.mesafe >= u - 0.25;
      },
    });
  }
  return algiSor;
}
