// mind/takipSozu.ts — "Beni takip et" ve onu bitiren sözler (içgüdü `kopru.takip`). Saf.
//
// Ozyn (2026-10-08): "oriona beni takip et komutu ekle". Takip SÜREN bir davranıştır — tek adımlık
// doğuştan program değil (mind/komutSozlugu.ts; orası başka oturumun alanı, dokunulmaz). Söz burada,
// TAM eşleşmeyle tanınır; davranışın kendisi dünya tarafında (uygulama/takip.ts).
//
// Bitirmek: "takibi bırak" gibi sözler burada; "dur", "otur", "tahtaya git" gibi YENİ BİR EMİR de takibi
// bitirir (yeni emir kazanır) — onları köprü komut programı yolunda yakalar. Bu yüzden çıplak "dur" bu
// listede YOK: o, komut sözlüğünün `komut:dur` programıdır ve hem durdurur hem takibi bitirir.
//
// Seslenme ve rica sözcükleri ("orion", "lütfen", "hadi") eşleşmeden önce atılır.
"use strict";
import { sadelestir } from "./hafizaYonlendirici.ts";

export type TakipEylemi = "basla" | "birak";

/** Tek kaynak (sadeleştirilmiş, noktalamasız). Testler buradan türer. */
export const TAKIP_IFADELERI: Readonly<Record<TakipEylemi, readonly string[]>> = {
  basla: ["beni takip et", "takip et", "beni izle", "pesimden gel", "arkamdan gel", "benimle gel", "beni takip eder misin",
    "follow me", "come with me", "follow"],
  birak: ["takibi birak", "takip etme", "beni takip etme", "takibi kes", "takip etmeyi birak", "beni izleme", "artik takip etme",
    "pesimden gelme", "stop following", "stop following me", "dont follow me"],
};

/** Orion'un onayı (sabit; model uyanmaz). */
export const TAKIP_ONAYI: Readonly<Record<TakipEylemi, string>> = {
  basla: "Peşindeyim.",
  birak: "Tamam, takibi bıraktım.",
};

const DOLGU = new Set(["orion", "lutfen", "hadi", "please", "ok", "tamam"]);

const normal = (m: string) => sadelestir(m).replace(/[^\p{L}\p{N} ]+/gu, " ").split(/\s+/)
  .filter((k) => k && !DOLGU.has(k)).join(" ");

/** Söz takibi başlatıyor ya da bitiriyor mu? Yalnız TAM eşleşme (dolgu sözcükleri atıldıktan sonra). */
export function takipEylemi(metin: string): TakipEylemi | null {
  const m = normal(metin);
  for (const [e, ifadeler] of Object.entries(TAKIP_IFADELERI) as [TakipEylemi, readonly string[]][]) {
    if (ifadeler.includes(m)) return e;
  }
  return null;
}
