// bridge/baglamOlcusu.ts — Bir uyanışta modele giden bağlamın boyu, bölüm başına (spec 16 F0).
//
// Saf: `BeyinGirdisi` → karakter sayıları. Bağlamı küçültme işinin (çekmeceli hafıza, durum
// defteri, yönlendirici) ölçüsü bu; davranışı değiştirmez, yalnız karar kaydına yazılır.
//
// Neden karakter: her beyinde aynı biçimde ölçülür ve tekrarlanabilir. Token yalnız beyin bildirirse
// (bridge/ollama.ts `girdiToken`, bridge/apiBeyni.ts) yanına eklenir. Araç ve örnekler JSON
// olarak sayılır: modele o biçimde gidiyorlar (bridge/ollama.ts). Geçmişteki beden çağrısı da
// araç adı + argüman JSON'u olarak sayılır.
"use strict";
import type { BeyinGirdisi } from "./beyin.ts";
import type { BaglamOlcusu } from "../mind/kararKaydi.ts";

const uzunluk = (s: string | undefined): number => s?.length ?? 0;
const json = (v: unknown): number => (v === undefined ? 0 : JSON.stringify(v).length);

export function baglamOlcusu(g: BeyinGirdisi): BaglamOlcusu {
  const gecmis = g.gecmis.reduce((t, k) => t + k.metin.length + (k.cagri ? k.cagri.ad.length + json(k.cagri.girdi) : 0), 0);
  const o = {
    talimat: uzunluk(g.talimat),
    sabit: uzunluk(g.sabit),
    araclar: g.araclar.length ? json(g.araclar) : 0,
    ornekler: g.ornekler?.length ? json(g.ornekler) : 0,
    gecmis,
    dunya: g.dunya.length,
    anilar: (g.anilar ?? []).reduce((t, a) => t + a.length, 0),
    ozetler: g.ozetler.reduce((t, a) => t + a.length, 0),
  };
  const toplam = Object.values(o).reduce((t, v) => t + v, 0);
  return { ...o, gecmisKayit: g.gecmis.length, toplam };
}
