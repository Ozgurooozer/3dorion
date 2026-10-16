// uygulama/kabuk.ts — Electron kabuk köprüsünün (preload'un `window.kopru`'su, tipi `host/kopru.ts`) TEK tipli erişimcisi.
//
// Eskiden `(globalThis as { kopru?: Partial<…Kopru> }).kopru` dönüşümü 10 yerde birebir kopyaydı (hafizaDeposu 7, kopruDinleyicileri 1, mcpBaglantisi 2;
// giris'te bir 11. biçim). Hangi modülün kabukla konuştuğu aranarak bulunuyordu. Artık tek kapı: bu dosya. Bekçi `kabuk.test.ts` başka dosyada
// bu dönüşümün yeniden yazılmasını reddeder.
//
// Kabuk dışında (tarayıcıda `npm run dev`, testler) köprü YOKTUR: dönüş `undefined`, çağıranlar `k?.alan` ile ele alır (bugünkü davranış aynen).
// `Partial`: kabuk sürümü eski olabilir, her alan yokluğa karşı korunur.
"use strict";
import type { Kopru as KabukKoprusu } from "../host/kopru.ts";

export function kabukKoprusu(): Partial<KabukKoprusu> | undefined {
  return (globalThis as { kopru?: Partial<KabukKoprusu> }).kopru;
}
