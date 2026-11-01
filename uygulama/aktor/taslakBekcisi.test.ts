// uygulama/aktor/taslakBekcisi.test.ts — Orion taslak kapısının GÜVENLİK sınırı (spec 45 B8; CLAUDE.md: Orion'un araç yüzeyine aktör/graf düzenleme EKLENMEZ, onay yalnız gerçek tıklama).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const oku = (yol: string): string => readFileSync(yol, "utf8");
function uretimDosyalari(kok: string): string[] {
  const cikti: string[] = [];
  for (const ad of readdirSync(kok)) {
    if (ad === "node_modules" || ad.startsWith(".")) continue;
    const yol = join(kok, ad);
    if (statSync(yol).isDirectory()) cikti.push(...uretimDosyalari(yol));
    else if (/\.(ts|js|cjs)$/.test(ad) && !/\.test\.ts$/.test(ad) && !ad.endsWith(".d.ts")) cikti.push(yol.replace(/\\/g, "/"));
  }
  return cikti;
}
const KOKLER = ["uygulama", "world", "bridge", "protocol", "mind", "host", "flash", "voice"];
const TUMU = KOKLER.flatMap(uretimDosyalari);

test("bekçi: taslakOnayla/taslakReddet çağrısı üretimde YALNIZ taslakCubugu.ts'te (tanım taslakIslemleri.ts'te)", () => {
  const izinli = new Set(["uygulama/yapi/level/taslakCubugu.ts", "uygulama/aktor/taslakIslemleri.ts"]);
  const kacaklar = TUMU.filter((d) => !izinli.has(d) && /\btaslak(Onayla|Reddet)\s*\(/.test(oku(d)));
  assert.deepEqual(kacaklar, [], `onay/red yolu gerçek-tıklama çubuğu dışında çağrılamaz:\n${kacaklar.join("\n")}`);
});

test("bekçi: taslakCubugu'nda onay ve red düğmeleri isTrusted ister (betikten üretilen tık hiçbir şey yapmaz)", () => {
  const k = oku("uygulama/yapi/level/taslakCubugu.ts");
  for (const dugme of ["onayla", "reddet"]) {
    const m = new RegExp(`${dugme}\\.addEventListener\\("click", \\(e\\) => \\{[^]*?\\n  \\}\\);`).exec(k);
    assert.ok(m, `${dugme} tıklama işleyicisi bulunamadı`);
    assert.match(m![0], /if \(!e\.isTrusted\) return;/, `${dugme}: isTrusted denetimi yok`);
    assert.ok(m![0].indexOf("isTrusted") < m![0].search(/taslak(Onayla|Reddet)\(/), `${dugme}: isTrusted denetimi işlemden ÖNCE olmalı`);
  }
});

test("bekçi: Orion'un araç yüzeyinde (niyet, araçlar, köprü) taslak/Drafts yolu YOK", () => {
  const yuzey = ["protocol/niyet.ts", "bridge/araclar.ts", "bridge/kopru.ts", "protocol/dogrula.ts"];
  const bulunan = yuzey.filter((d) => /taslak|Drafts/i.test(oku(d)));
  assert.deepEqual(bulunan, [], "Orion taslağı araç yüzeyiyle DEĞİL, dosya bırakarak önerir");
});

test("bekçi: Content/Drafts yolunu yalnız taslak kapısı bilir (başka dosya oraya yazamaz)", () => {
  const izinli = new Set(["uygulama/aktor/taslakKapisi.ts"]);
  // Yol İNŞA eden kod aranır: yorum satırları ve klasör adı anan metinler ("Content/Drafts'a") sayılmaz, eğik çizgili yol ("Content/Drafts/") sayılır.
  const kod = (d: string): string => oku(d).split(/\r?\n/).filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n");
  const kacaklar = TUMU.filter((d) => !izinli.has(d) && /Content\/Drafts\//.test(kod(d)));
  assert.deepEqual(kacaklar, [], `Content/Drafts yalnız taslakKapisi.ts'te:\n${kacaklar.join("\n")}`);
});
