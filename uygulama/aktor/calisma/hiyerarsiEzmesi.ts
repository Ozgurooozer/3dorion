// uygulama/aktor/calisma/hiyerarsiEzmesi.ts — ÇALIŞMA ZAMANI HİYERARŞİ EZMESİ (spec 45 B4). SAF.
//
// `aktor.sokete_tak/sokettan_al` level DOSYASINA/tanıma yazmaz (graf geçici/çalışma zamanı durumudur): aktörün üstünü bellekte ezer. Etkin hiyerarşi =
// tanımdaki `ust` + ezme (`null` = tanımdaki üstten AYRILDI). Olay yolu ve çalışma zamanı AYNI etkin hiyerarşiyi görür (iki doğru olmasın).
"use strict";
import { aktorHiyerarsisi, type AktorOlayYoluAyari } from "../../../world/level/cekirdek/aktorOlayYolu.ts";
import { kodlu } from "../../../world/level/cekirdek/aktorHatalari.ts";
import { BEDEN_ONEKI, HIYERARSI_DERINLIGI } from "../../../world/level/cekirdek/bilesenKaydi.ts";

export interface Ezme { readonly ust: string | null; readonly soket?: string }

/** Tanım aktörleri + ezme → etkin üst/alt arama (`aktorHiyerarsisi` biçimi). */
export function etkinHiyerarsi(aktorler: readonly { id?: unknown; ust?: unknown }[], ezme: ReadonlyMap<string, Ezme>): Pick<AktorOlayYoluAyari, "ustu" | "altlari"> {
  return aktorHiyerarsisi(aktorler.map((a) => {
    const e = typeof a.id === "string" ? ezme.get(a.id) : undefined;
    return e === undefined ? a : { id: a.id, ust: e.ust ?? undefined };
  }));
}

/** `id`'yi `ust` altına koymak güvenli mi: kendi üstü değil, `ust` bilinen bir aktör ya da `beden:`, döngü ve derinlik yok. Güvenliyse null, değilse neden. */
export function ustAtamaHatasi(id: string, ust: string, bilinen: (a: string) => boolean, ustu: (a: string) => string | undefined): string | null {
  if (id === ust) return kodlu("AKT-BAG-003", "bir aktör kendi üstü olamaz");
  if (ust.startsWith(BEDEN_ONEKI)) return ust.length > BEDEN_ONEKI.length ? null : kodlu("AKT-BAG-006", "beden adı boş");
  if (!bilinen(ust)) return kodlu("AKT-BAG-002", `üst aktör level'da yok: ${ust}`);
  let derinlik = 1;
  for (let u: string | undefined = ust; u !== undefined; u = ustu(u)) {
    if (u === id) return kodlu("AKT-BAG-004", `döngü: '${ust}' zaten '${id}'in altında`);
    if (u.startsWith(BEDEN_ONEKI)) break;
    if (++derinlik > HIYERARSI_DERINLIGI) return kodlu("AKT-BAG-005", `hiyerarşi en çok ${HIYERARSI_DERINLIGI} kat derin olabilir`);
  }
  return null;
}
