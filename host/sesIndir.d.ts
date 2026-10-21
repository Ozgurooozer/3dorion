// host/sesIndir.d.ts — `sesIndir.js` için tip bildirimi.
import type { KatalogSesi, SesIndirmeIlerlemesi } from "./sesler.js";
/** Hata nesnesinin `kod` alanı: ag | boyut | bozuk | iptal | hata. */
export function sesIndir(g: {
  ses: KatalogSesi; dizin: string; kok?: string;
  getir?: (adres: string, istek: { redirect: "follow"; signal?: AbortSignal }) => Promise<Response>;
  ilerleme?: (o: SesIndirmeIlerlemesi) => void;
  sinyal?: AbortSignal;
}): Promise<{ ad: string; onnx: number; json: number }>;
