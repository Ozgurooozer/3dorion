// uygulama/graf/aktorOlayKaynagi.ts — ⚡ DİNLEME KAYNAĞI: ajan olayları + aktör olayları tek `OlayKaynagi` arkasında (spec 45 B3). SAF: DOM, depolama yok.
//
// `grafDinleyici` olayları bir adresle dinler. Ajan adresi ajan kimliğidir ("flash"); aktör adresi `aktor:<id>`dir ve `AktorOlayYolu`na (world/level/cekirdek/aktorOlayYolu.ts)
// yönlenir. İkisini ayırmak için önek (ajan kimliğinde `:` yok); ajan tarafı olduğu gibi geçer, orada hiçbir davranış değişmez.
// Aktör olayının verisi dinleyiciye `ayrinti` olarak gider: `{...olayVerisi, kaynak (yayınlayan), aktor (ulaştığı adres)}` — yayıncının verisi bu ikisini EZEMEZ.
"use strict";
import type { AktorOlayYolu } from "../../world/level/cekirdek/aktorOlayYolu.ts";
import { AKTOR_ADRES_ONEKI } from "./aktorDugumleri.ts";
import type { DunyaOlayi, OlayKaynagi } from "./grafDinleyici.ts";

export function aktorOlayKaynagiKur(g: { ajan: OlayKaynagi; olay: AktorOlayYolu; aktorVar: (id: string) => boolean }): OlayKaynagi {
  return {
    ajanlar: () => g.ajan.ajanlar(),
    aktorVar: (id) => g.aktorVar(id),
    dinle(adres, cb) {
      if (!adres.startsWith(AKTOR_ADRES_ONEKI)) return g.ajan.dinle(adres, cb);
      // Her olay adı için tek abonelik: dinleyici (`grafDinleyici.kur`) kendi olay adını `o.ad`la süzer.
      return g.olay.dinle(adres.slice(AKTOR_ADRES_ONEKI.length), "*", (o) => {
        const d: DunyaOlayi = { ad: o.ad, ayrinti: { ...o.veri, kaynak: o.kaynak, aktor: o.aktor } };
        cb(d);
      });
    },
  };
}
