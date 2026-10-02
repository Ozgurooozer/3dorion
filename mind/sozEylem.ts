// mind/sozEylem.ts — "Söyledi ama yapmadı" bekçisi (spec 13 Faz 1).
//
// NEDEN VAR (ortak canlı test, 2026-10-02): Ozyn "otur", "bana gel",
// "önündeki bilgisayarı aç" dedi; Orion üçünde de yalnız konuştu —
// "Oturuyorum Ozyn.", "Geliyorum Ozyn.", "Bilgisayarı açıyorum Ozyn." — ve
// hiçbir beden niyeti göndermedi. Daha önce "tahtaya yaz"da da aynısı oldu
// ("Yazıyorum"). Bu hata sessizdir: kayıtta uyanış "üretken" görünür (bir
// `soyle` var), Ozyn ise Orion'un yalan söylediğini sanır.
//
// Bekçi YALNIZ GÖZLEMLER (spec 08: kayıt davranışı değiştirmez). Sözdeki
// birinci tekil eylem iddiasını ("-iyorum", "-acağım") bulur ve aynı turda o
// eylemin niyeti gitmiş mi bakar. Gitmemişse karar kaydına ve günlüğe yazılır.
//
// Sözlük bilerek DAR: yalnız Orion'un bedeninin yapabildiği eylemler. "Bekliyorum",
// "anlıyorum" gibi iddialar eylem değildir; "Yaklaştın" ikinci tekildir.
//
// Bağımlılık: protocol/. Saf.
"use strict";
import { katla } from "../protocol/temel.ts";
import type { NiyetTur } from "../protocol/niyet.ts";

interface Iddia {
  /** Sözde iddia edilen eylem. */
  eylem: NiyetTur;
  /** Katlanmış (Türkçe karaktersiz, küçük harf) sözde aranan birinci tekil biçimler. */
  bicim: RegExp;
  /** Bu niyetlerden biri aynı turda gittiyse iddia karşılanmıştır. */
  karsilar: readonly NiyetTur[];
}

const IDDIALAR: readonly Iddia[] = [
  { eylem: "otur", bicim: /\botur(uyorum|acagim)\b/, karsilar: ["otur"] },
  { eylem: "kalk", bicim: /\bkalk(iyorum|acagim)\b/, karsilar: ["kalk"] },
  // "Geliyorum" / "gidiyorum" / "yürüyorum": yürümek. `otur` da yürür (çapasız
  // sandalyeye gider), ama "geliyorum" Ozyn'e gelmektir; yalnız `git` karşılar.
  { eylem: "git", bicim: /\b(geliyorum|gelecegim|gidiyorum|gidecegim|yuruyorum|yaklasiyorum)\b/, karsilar: ["git"] },
  { eylem: "yaz", bicim: /\byaz(iyorum|acagim)\b/, karsilar: ["yaz"] },
  // "Bilgisayarı açıyorum": monitöre odaklanmak; bir komut önerisi de karşılar.
  { eylem: "odaklan", bicim: /\bac(iyorum|acagim)\b/, karsilar: ["odaklan", "komut"] },
  // "Bakıyorum": dönüp bakmak da odaya bakmak (`sor`) da karşılar.
  { eylem: "bak", bicim: /\bbak(iyorum|acagim)\b/, karsilar: ["bak", "sor"] },
];

/** Sözdeki eylem iddiaları, sırasız ve tekrarsız. */
export function eylemIddialari(soz: string): NiyetTur[] {
  const k = katla(soz);
  return IDDIALAR.filter((i) => i.bicim.test(k)).map((i) => i.eylem);
}

/**
 * Bir turun sözlerinde iddia edilip AYNI turda niyeti gitmeyen eylemler.
 * Boş dizi = uçurum yok.
 */
export function sozEylemUcurumu(sozler: readonly string[], niyetler: readonly NiyetTur[]): NiyetTur[] {
  const giden = new Set(niyetler);
  const eksik = new Set<NiyetTur>();
  for (const s of sozler) {
    for (const i of IDDIALAR) {
      if (i.bicim.test(katla(s)) && !i.karsilar.some((n) => giden.has(n))) eksik.add(i.eylem);
    }
  }
  return [...eksik];
}
