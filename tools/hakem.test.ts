// tools/hakem.test.ts — Hakemin cevabı nasıl okunur, neyi görür, hangi bayraklarla çalışır.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CLAUDE_BAYRAKLARI, HAKEM_TALIMATI, hakemCevabi, hakemMetni } from "./hakem.ts";
import { BAGLAMLAR, SABIT } from "./ogretmen.ts";

test("hakem cevabı: ilk kelime YES/EVET → evet, NO/HAYIR → hayır; büyük/küçük harf fark etmez", () => {
  assert.deepEqual(
    ["YES", "Yes.", "**yes** because", "EVET", "NO", "no, routine", "Hayır", "HAYIR"].map(hakemCevabi),
    [true, true, true, true, false, false, false, false],
  );
});

test("hakem cevabı: anlaşılmayan cevap null — tahmin edilmez", () => {
  assert.deepEqual(["Maybe", "", "   ", "Answer: YES", "Y", "1"].map(hakemCevabi), [null, null, null, null, null, null]);
});

test("hakem metni oda bilgisini, dünya durumunu ve köprünün özetini taşır", () => {
  const m = hakemMetni({ tur: "terminal", kuyruk: "boom", kesildi: false, kod: 1 }, BAGLAMLAR.masada);
  assert.deepEqual(
    { oda: m.startsWith(SABIT), dunya: m.includes(BAGLAMLAR.masada), ozet: m.includes("the command finished with an ERROR (exit code 1)"), soru: m.endsWith("Answer YES or NO.") },
    { oda: true, dunya: true, ozet: true, soru: true },
  );
});

test("hakem talimatı kural vermez: 'error', 'routine output' gibi içgüdü ipuçları yok", () => {
  // Kural verirse hakem içgüdüleri tekrar eder; öğrenen kapı yeni bir şey öğrenmez.
  assert.doesNotMatch(HAKEM_TALIMATI, /\b(error|fail|exit code|warning|success)/i);
});

test("claude bayrakları claude-beyin.ts'teki güvenlik bayraklarıyla aynı — araç, MCP ve ayar yok", () => {
  const kaynak = fs.readFileSync(new URL("./claude-beyin.ts", import.meta.url), "utf8");
  assert.ok(kaynak.includes('"--tools", ""'), "claude-beyin.ts araçları kapatmıyor mu?");
  for (const b of CLAUDE_BAYRAKLARI.filter((x) => x.startsWith("--"))) {
    assert.ok(kaynak.includes(`"${b}"`), `claude-beyin.ts'te olmayan bayrak: ${b}`);
  }
});
