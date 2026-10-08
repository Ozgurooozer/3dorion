// tools/baglam-ozet.ts — Karar kayıtlarından bağlam ölçüsü (spec 16 P1 ve P6).
//
//   node --experimental-strip-types tools/baglam-ozet.ts <kayit.jsonl> [<kayit2.jsonl> …]
//
// Her dosya için KONUŞMA uyanışlarının (tetikleyen algılardan biri `duydum`) medyan bağlamı: toplam
// karakter, token (beyin bildirdiyse) ve bölüm başına. P6: hafıza isteği BOŞ olduğu hâlde bağlama anı
// ya da durum satırı giren uyanış sayısı (yönlendirici kipinde 0 olmalı).
"use strict";
import fs from "node:fs";
import type { KararSatiri, UyanisSatiri, AlgiSatiri, BaglamOlcusu } from "../mind/kararKaydi.ts";

const medyan = (x: number[]) => {
  if (!x.length) return NaN;
  const s = [...x].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
/** Durum defterinin bağlam satırlarının başları (mind/durumDefteri.ts `satirlar`). */
const DURUM_SATIRI = /You are at: |Before that you were at: |You are doing: |The last thing you did: |Ozyn's last words to you|Your last words \(|Your terminal is (open|closed)|Your previous session/;

export interface BaglamOzeti {
  dosya: string; konusmaUyanisi: number; medyanToplam: number; medyanToken: number;
  bolum: Partial<Record<keyof BaglamOlcusu, number>>; p6Ihlal: number; yonlendiriciUyanisi: number;
}

export function ozetle(dosya: string, satirlar: KararSatiri[]): BaglamOzeti {
  const duyulan = new Set(satirlar.filter((s): s is AlgiSatiri => s.tur === "algi" && s.algi === "duydum").map((s) => `${s.o}/${s.id}`));
  const uyanis = satirlar.filter((s): s is UyanisSatiri => s.tur === "uyanis" && !!s.baglam);
  const konusma = uyanis.filter((u) => u.algilar.some((a) => duyulan.has(`${u.o}/${a}`)));
  const bolum: BaglamOzeti["bolum"] = {};
  for (const b of ["talimat", "araclar", "ornekler", "gecmis", "dunya", "anilar", "ozetler"] as const) {
    bolum[b] = medyan(konusma.map((u) => u.baglam![b]));
  }
  const yon = uyanis.filter((u) => Array.isArray(u.hafizaIstegi));
  const p6Ihlal = yon.filter((u) => u.hafizaIstegi!.length === 0 && (u.anilar > 0 || DURUM_SATIRI.test(u.dunya))).length;
  return {
    dosya, konusmaUyanisi: konusma.length,
    medyanToplam: medyan(konusma.map((u) => u.baglam!.toplam)),
    medyanToken: medyan(konusma.map((u) => u.baglam!.token).filter((t): t is number => t !== undefined)),
    bolum, p6Ihlal, yonlendiriciUyanisi: yon.length,
  };
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.endsWith("baglam-ozet.ts")) {
  for (const dosya of process.argv.slice(2)) {
    const satirlar = fs.readFileSync(dosya, "utf8").split(/\r?\n/).filter(Boolean)
      .map((l) => { try { return JSON.parse(l.replace(/^\[KARAR\] /, "")) as KararSatiri; } catch { return null; } })
      .filter((x): x is KararSatiri => x !== null);
    console.log(JSON.stringify(ozetle(dosya.split(/[\\/]/).at(-1)!, satirlar)));
  }
}
