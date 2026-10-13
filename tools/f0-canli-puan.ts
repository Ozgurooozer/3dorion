// tools/f0-canli-puan.ts — f0 ham sonuçlarını CANLI KÖPRÜNÜN gördüğü gibi yeniden puanlar.
//
// Neden: `f0-olc.ts` modelin ham çıktısını puanlar; canlı köprü ise (bridge/kopru.ts `_ciktiyiIsle`) önce (1) bu turda
// SUNULMAYAN çağrıyı düşürür, (2) araç çağrılmadıysa düz metinden çağrı KURTARIR (bridge/metinKurtarma.ts), (3) kalan
// İngilizce düz metni sesli değil iç ses olarak tutar. Ozyn'in duyduğu budur. Ölçüm 2026-10-13: gemma4'ün "susamadı"
// sonucu, kendi şablonunda yazdığı `dunya_poz{...}` çağrısının söz sayılmasıydı.
//
// İki puan AYRI raporlanır: ham (ön-kayıtlı ölçüt) ve canlı yol (sonradan; aynı ham çıktı, yeniden model çağrısı yok).
// Kullanım: node --experimental-strip-types tools/f0-canli-puan.ts <fixture.json> <sonuc.jsonl> [<sonuc.jsonl> …]
"use strict";
import fs from "node:fs";
import { metinKurtar } from "../bridge/metinKurtarma.ts";
import { OZERK_ARACLAR, araclariUret } from "../bridge/araclar.ts";
import { ingilizceMi } from "../mind/dilSecimi.ts";
import { f0Puanla, type F0Beklenti } from "./f0.ts";

interface Cagri { ad: string; girdi: Record<string, unknown> }
interface HamSonuc { id: string; kume: string; gecti: boolean; cagrilar?: Cagri[]; metin?: string }

/** Köprünün çıktıdan ürettiği: uygulanan çağrılar ve SESLİ söylenen düz metin. */
export function canliYol(cagrilar: Cagri[], metin: string, sunulan: ReadonlySet<string>): { cagrilar: Cagri[]; sesli: string } {
  const gecen = cagrilar.filter((c) => sunulan.has(c.ad));
  if (cagrilar.length > 0 || !metin) return { cagrilar: gecen, sesli: "" };
  const k = metinKurtar(metin, [...sunulan]);
  return { cagrilar: k.cagrilar, sesli: k.konusulabilir && !ingilizceMi(k.konusulabilir) ? k.konusulabilir : "" };
}

if (import.meta.main) {
  const [fixtureYolu, ...dosyalar] = process.argv.slice(2);
  if (!fixtureYolu || dosyalar.length === 0) { console.error("kullanım: f0-canli-puan.ts <fixture> <sonuc.jsonl>…"); process.exit(1); }
  const f = JSON.parse(fs.readFileSync(fixtureYolu, "utf8")) as { senaryolar: { id: string; ozerk?: boolean; bekle: F0Beklenti }[] };
  const tum = new Set(araclariUret().map((a) => a.ad));
  for (const d of dosyalar) {
    const satirlar = fs.readFileSync(d, "utf8").trim().split("\n").map((l) => JSON.parse(l) as HamSonuc);
    const kume: Record<string, { ham: number; canli: number; toplam: number }> = {};
    for (const s of satirlar) {
      const sn = f.senaryolar.find((x) => x.id === s.id);
      if (!sn) continue;
      const y = canliYol(s.cagrilar ?? [], s.metin ?? "", sn.ozerk ? OZERK_ARACLAR : tum);
      const p = f0Puanla(y.cagrilar, y.sesli, sn.bekle);
      const k = (kume[s.kume] ??= { ham: 0, canli: 0, toplam: 0 });
      k.toplam++; if (s.gecti) k.ham++; if (p.gecti) k.canli++;
      if (s.gecti !== p.gecti) console.log(`  ${s.id}: ham ${s.gecti ? "GEÇTİ" : "KALDI"} → canlı ${p.gecti ? "GEÇTİ" : "KALDI"}${p.nedenler.length ? ` (${p.nedenler.join("; ")})` : ""}`);
    }
    const ozet = Object.entries(kume).map(([ad, k]) => `${ad} ham ${k.ham}/${k.toplam} · canlı ${k.canli}/${k.toplam}`).join(" | ");
    console.log(`${d.replace(/^.*f0-/, "")}: ${ozet}`);
  }
}
