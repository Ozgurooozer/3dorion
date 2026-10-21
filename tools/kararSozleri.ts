// tools/kararSozleri.ts — Karar kaydındaki gerçek sözler (metin → kaç kez). TEK okuyucu: tools/komut-tara.ts ve tools/flash-tavan.ts.
//
// Önceden komut-tara'nın içindeydi; Flash'ın tavan ölçüsü (spec 33 §0) aynı sözleri okuyunca ikinci kopya yazılmasın diye ayrıldı.
// Satır: `{"tur":"algi",…,"soz":{"metin":…,"kesin":true}}`. `girdi` satırlarında da `"soz":1` var (sayı): metni olmayan atlanır.
"use strict";
import fs from "node:fs";
import path from "node:path";

/** Varsayılan klasör: %APPDATA%/3dorion/karar-kaydi. */
export function varsayilanKlasor(): string {
  return path.join(process.env.APPDATA ?? "", "3dorion", "karar-kaydi");
}

/**
 * Klasördeki bütün `.jsonl` günlerinin sözleri (dosya adı sırasıyla, ilk görülüş sırası korunur).
 * `yalnizKesinAlgi`: yalnız `tur:"algi"`, `algi:"duydum"`, `soz.kesin === true` satırları (spec 33 §0 ön kaydı). Verilmezse komut-tara'nın
 * eski davranışı: metni olan her `soz`.
 */
export function kararSozleri(klasor: string, secenek: { yalnizKesinAlgi?: boolean } = {}): Map<string, number> {
  const sozler = new Map<string, number>();
  for (const ad of fs.readdirSync(klasor).filter((f) => f.endsWith(".jsonl")).sort()) {
    for (const satir of fs.readFileSync(path.join(klasor, ad), "utf8").split("\n")) {
      if (!satir.includes('"soz"')) continue;
      let x: { tur?: unknown; algi?: unknown; soz?: { metin?: unknown; kesin?: unknown } };
      try { x = JSON.parse(satir); } catch { continue; }
      if (secenek.yalnizKesinAlgi && !(x.tur === "algi" && x.algi === "duydum" && x.soz?.kesin === true)) continue;
      const m = x.soz?.metin;
      if (typeof m === "string" && m.trim()) sozler.set(m, (sozler.get(m) ?? 0) + 1);
    }
  }
  return sozler;
}
