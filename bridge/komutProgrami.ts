// bridge/komutProgrami.ts — Doğuştan bir komut programının (mind/komutSozlugu.ts) yürütme PLANI
// (spec 13 Faz 2b; spec 14 R7'de bridge/kopru.ts `_programYurut`tan ayrıldı, davranış aynı).
//
// Saf: adımlar doğrulanır, her birine `komut` önekli kimlik verilir; kayıt satırının niyetleri ve
// konuşma geçmişine girecek araç çağrıları (`dunya_<tur>`) kurulur. Söz kayda/anıya yazılması,
// onay jesti ve eylem sırası köprüde kalır. Geçmiş, gerçekte olanı taşır (spec 13 Faz 1): model
// "otur → dunya_otur" çiftini görür, isteği tekrar yapmaz.
"use strict";
import { kimlik } from "../protocol/temel.ts";
import { niyetDogrula } from "../protocol/dogrula.ts";
import { niyetKaydi, type NiyetKaydi } from "../mind/kararKaydi.ts";
import type { KomutEslesmesi } from "../mind/komutSozlugu.ts";
import type { SiraAdimi } from "./eylemSirasi.ts";

export interface ProgramPlani {
  /** Eylem sırasına verilecek adımlar (doğrulanmış). */
  adimlar: SiraAdimi[];
  /** Program satırının niyetleri (mind/kararKaydi.ts). */
  niyetler: NiyetKaydi[];
  /** Konuşma geçmişine, söz satırının ardından girecek araç çağrıları. */
  cagrilar: { ad: string; girdi: Record<string, unknown> }[];
  /**
   * Geçersiz bir adım: program tablosu testli, bu bir yazılım hatasıdır — sessiz kalmasın.
   * Varsa plan YÜRÜTÜLMEZ; `cagrilar` yalnız geçersiz adımdan ÖNCEKİLERİ taşır (köprü onları
   * geçmişe yine yazar: ayrılmadan önceki davranış buydu).
   */
  hata?: string;
}

export function programPlani(p: KomutEslesmesi, kimlikUret: () => string = () => kimlik("komut")): ProgramPlani {
  const plan: ProgramPlani = { adimlar: [], niyetler: [], cagrilar: [] };
  for (const n of p.adimlar) {
    const d = niyetDogrula(n);
    if (!d.ok) return { ...plan, hata: `gecersiz adim "${n.tur}": ${d.hata}` };
    const id = kimlikUret();
    plan.niyetler.push(niyetKaydi(id, d.deger));
    plan.adimlar.push({ niyet: d.deger, id });
    const { tur: nt, ...girdi } = d.deger;
    plan.cagrilar.push({ ad: `dunya_${nt}`, girdi });
  }
  return plan;
}
