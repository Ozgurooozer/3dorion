// mind/aniSuzgeci.test.ts — Uzun vadeli hafızaya ne yazılır (spec 16 F1).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { aniKaydi, eskiHafizayiTemizle, terminalKirp, MIKROFON_ONEMI, TERMINAL_BAS, TERMINAL_SON, TERMINAL_TAVANI } from "./aniSuzgeci.ts";
import { kuralOnemi } from "./hafiza.ts";

const satirlar = (n: number) => Array.from({ length: n }, (_, i) => `satir ${i + 1}`).join("\n");

test("dünya olayı (ozyn_*) hafızaya yazılmaz — durumdur", () => {
  assert.equal(aniKaydi({ tur: "olay", ad: "ozyn_yaklasti" }, "olay", "ozyn_yaklasti"), null);
});

test("inisiyatif dürtüsü hafızaya yazılmaz", () => {
  const ad = "nobody has spoken for 15 minutes — this is your own initiative: say something only if it is useful";
  assert.equal(aniKaydi({ tur: "olay", ad, ayrinti: { kaynak: "inisiyatif" } }, "olay", ad), null);
});

test("klavyeden söz kural önemiyle yazılır", () => {
  assert.deepEqual(aniKaydi({ tur: "duydum", metin: "otur", kesin: true }, "konusma", "otur"), { icerik: "otur", onem: kuralOnemi("konusma", "otur") });
});

test("mikrofondan söz daha düşük önemle yazılır", () => {
  assert.equal(aniKaydi({ tur: "duydum", metin: "sit down", kesin: true, kaynak: "mikrofon" }, "konusma", "sit down")?.onem, MIKROFON_ONEMI);
});

test("mikrofon sözü klavye sözünden önemsizdir", () => {
  assert.ok(MIKROFON_ONEMI < kuralOnemi("konusma", "x"));
});

test("sonuç (hata) anısı değişmeden yazılır", () => {
  const a = aniKaydi({ tur: "sonuc", sonuc: { niyet_id: "n1", durum: "hata", not: "tahtaya oturulmaz" } }, "sonuc", "hata: tahtaya oturulmaz");
  assert.deepEqual(a, { icerik: "hata: tahtaya oturulmaz", onem: kuralOnemi("sonuc", "") });
});

test("kısa terminal çıktısı olduğu gibi kalır", () => {
  assert.equal(terminalKirp(satirlar(TERMINAL_BAS + TERMINAL_SON + 1)), satirlar(TERMINAL_BAS + TERMINAL_SON + 1));
});

test("uzun terminal çıktısı baş + son satırlara iner", () => {
  const k = terminalKirp(satirlar(30)).split("\n");
  assert.deepEqual([k[0], k[TERMINAL_BAS - 1], k.at(-1)], ["satir 1", `satir ${TERMINAL_BAS}`, "satir 30"]);
});

test("kırpıldığı metinde atlanan satır sayısıyla yazılır", () => {
  assert.match(terminalKirp(satirlar(30)), new RegExp(`\\(… ${30 - TERMINAL_BAS - TERMINAL_SON} satır …\\)`));
});

test("terminal anısı kırpılmış hâliyle ve çıkış koduyla önemlenir", () => {
  const k = aniKaydi({ tur: "terminal", kuyruk: satirlar(30), kesildi: false, kod: 1 }, "terminal", satirlar(30));
  assert.deepEqual([k?.icerik.split("\n").length, k?.onem], [TERMINAL_BAS + TERMINAL_SON + 1, kuralOnemi("terminal", "", 1)]);
});

// ── Eski hafızanın göçü ──
const ani = (tur: string, metin: string, onem = 5) => ({ tur, metin, onem, olusma: 1, sonErisim: 1 });

test("göç: olay anıları atılır", () => {
  const r = eskiHafizayiTemizle([ani("olay", "ozyn_yaklasti", 10), ani("konusma", "otur")]);
  assert.deepEqual([r.aniler.length, r.atilan], [1, 1]);
});

test("göç: söz ve sonuç anılarına dokunulmaz", () => {
  const eski = [ani("konusma", "Pendulum on a negative.", 8), ani("sonuc", "hata: tahtaya oturulmaz", 10)];
  assert.deepEqual(eskiHafizayiTemizle(eski).aniler, eski);
});

test("göç: uzun terminal anısı kırpılır", () => {
  const r = eskiHafizayiTemizle([ani("terminal", satirlar(30), 2)]);
  assert.deepEqual([(r.aniler[0] as { metin: string }).metin, r.kirpilan], [terminalKirp(satirlar(30)), 1]);
});

test("göç: tekrarla şişmiş terminal önemi tavana iner", () => {
  const r = eskiHafizayiTemizle([ani("terminal", "(komut çıktı üretmedi)", 10)]);
  assert.deepEqual([(r.aniler[0] as { onem: number }).onem, r.indirilen], [TERMINAL_TAVANI, 1]);
});

test("göç iki kez koşunca ikincisi hiçbir şey değiştirmez", () => {
  const bir = eskiHafizayiTemizle([ani("olay", "x"), ani("terminal", satirlar(30), 10), ani("konusma", "selam")]);
  const iki = eskiHafizayiTemizle(bir.aniler);
  assert.deepEqual([iki.atilan, iki.kirpilan, iki.indirilen], [0, 0, 0]);
});

test("göç tanımadığı kaydı olduğu gibi bırakır", () => {
  assert.deepEqual(eskiHafizayiTemizle([null, 42]).aniler, [null, 42]);
});
