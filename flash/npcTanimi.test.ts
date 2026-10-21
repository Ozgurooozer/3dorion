// flash/npcTanimi.test.ts — NPC TANIMI BEKÇİSİ: Flash'ın önerdiği her komut gerçekten LLM'siz yoldan geçer ve bedeni onu yapabilir.
// Komut sözlüğü değişir de bir örnek artık eşleşmezse Flash "şunu mu demek istedin: «X»?" deyip X'i de anlamazdı (spec 33 dilim 2).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { FLASH } from "./npcTanimi.ts";
import { flashDuzenegi, sozunKurali } from "./flashTest.ts";

const LLMSIZ = new Set(["kopru.komut", "kopru.takip", "kopru.sohbet"]);

test("her komut örneği Flash'ın LLM'siz yolundan geçer (bilmiyorum'a düşmez)", async () => {
  const dusen: string[] = [];
  for (const k of FLASH.komutlar) {
    const d = flashDuzenegi();
    try { d.soyle(k.soz); await d.bekle(); } finally { d.kapat(); }
    const kural = sozunKurali(d.satirlar, k.soz);
    if (!kural || !LLMSIZ.has(kural)) dusen.push(`${k.soz} → ${kural}`);
  }
  assert.deepEqual(dusen, []);
});

test("her komut örneğinin doğurduğu niyet Flash'ın bedeninde var ('yapamam' önerilmez)", async () => {
  const yapamaz: string[] = [];
  for (const k of FLASH.komutlar) {
    const d = flashDuzenegi();
    try { d.soyle(k.soz); await d.bekle(); } finally { d.kapat(); }
    for (const y of d.yonler) if (y.yon === "yapamaz") yapamaz.push(`${k.soz} → ${y.tur}`);
  }
  assert.deepEqual(yapamaz, []);
});

test("komut örnekleri tekil (aynı öneri iki kez sayılmaz)", () => {
  const s = FLASH.komutlar.map((k) => k.soz);
  assert.equal(new Set(s).size, s.length);
});
