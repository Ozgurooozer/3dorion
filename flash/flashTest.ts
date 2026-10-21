// flash/flashTest.ts — Flash testlerinin ORTAK düzeneği: sahte beden + gerçek Flash köprüsü (aynı `Kopru` sınıfı).
// Bir `*.test.ts` değil: test dosyası import edilirse testleri ikinci kez koşar (tools/ithaller.ts ile aynı kural). Üretim kodu
// bunu import etmez.
"use strict";
import type { Niyet, NiyetSonucu } from "../protocol/niyet.ts";
import type { KararSatiri } from "../mind/kararKaydi.ts";
import { flashKur, type Flash, type NiyetYonu } from "./flashKur.ts";
import { FLASH, type NpcTanimi } from "./npcTanimi.ts";

export interface FlashDuzenegi {
  f: Flash;
  /** Bedene ulaşan niyetler (sıralı). */
  bedene: Niyet[];
  /** Köprünün yönlendirdiği her niyet ve yönü. */
  yonler: { tur: string; yon: NiyetYonu }[];
  /** Flash'ın söyledikleri (konuşma dinleyicisi). */
  sozler: string[];
  /** Karar kaydı satırları (diske gidenin aynısı). */
  satirlar: KararSatiri[];
  takip: boolean[];
  /** Ozyn'in kesin sözü. */
  soyle(metin: string): void;
  /** Bekleyen mikro görevler ve zamanlayıcılar boşalsın (köprü düşünmesi async). */
  bekle(ms?: number): Promise<void>;
  kapat(): void;
}

/**
 * `sonuc`: sahte bedenin her niyete vereceği sonuç (varsayılan hemen `bitti`). Sonuç mikro görevle döner: gerçek avatar da tikte,
 * gönderimden SONRA verir.
 */
export function flashDuzenegi(secenek: {
  tanim?: NpcTanimi; sonuc?: (n: Niyet) => Pick<NiyetSonucu, "durum" | "not">; bedenYok?: boolean;
  /** Ek niyet dinleyicisi (şema kancası gibi), düzeneğin kendi kaydına EK olarak. */
  niyetDinle?: (n: Niyet, yon: NiyetYonu) => void;
} = {}): FlashDuzenegi {
  const bedene: Niyet[] = [], yonler: { tur: string; yon: NiyetYonu }[] = [], sozler: string[] = [], satirlar: KararSatiri[] = [], takip: boolean[] = [];
  const sonucu = secenek.sonuc ?? (() => ({ durum: "bitti" as const }));
  let f!: Flash;
  const beden = {
    niyet(n: Niyet, id: string) {
      bedene.push(n);
      const s = sonucu(n);
      queueMicrotask(() => f.kopru.sonuc({ niyet_id: id, ...s }));
    },
  };
  f = flashKur({
    tanim: secenek.tanim ?? FLASH,
    beden: () => (secenek.bedenYok ? null : beden),
    takipDinle: (a) => { takip.push(a); },
    niyetDinle: (n, yon) => { yonler.push({ tur: n.tur, yon }); secenek.niyetDinle?.(n, yon); },
    toplamaMs: 1,
  });
  f.kopru.konusmaDinle((m) => { sozler.push(m); });
  f.kararDinle((s) => { satirlar.push(s); });
  return {
    f, bedene, yonler, sozler, satirlar, takip,
    soyle: (metin) => f.kopru.algi({ tur: "duydum", metin, kesin: true, kaynak: "klavye" }),
    bekle: (ms = 5) => new Promise((r) => setTimeout(r, ms)),
    kapat: () => f.kopru.durdur(),
  };
}

/** Karar kaydında bir sözün algı satırının kapı kuralı (yoksa null). */
export function sozunKurali(satirlar: readonly KararSatiri[], metin: string): string | null {
  for (const s of satirlar) if (s.tur === "algi" && s.algi === "duydum" && s.soz?.metin === metin) return s.kapi.kural;
  return null;
}
