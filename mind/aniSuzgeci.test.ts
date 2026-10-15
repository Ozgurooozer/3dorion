// mind/aniSuzgeci.test.ts — Uzun vadeli hafızaya ne yazılır (spec 16 F1).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { aniKaydi, eskiHafizayiTemizle, eskiSozleriTemizle, KOMUT_ONEMI, terminalKirp, MIKROFON_ONEMI, TERMINAL_BAS, TERMINAL_SON, TERMINAL_TAVANI } from "./aniSuzgeci.ts";
import { kuralOnemi, DERS_TAVANI } from "./hafiza.ts";

const satirlar = (n: number) => Array.from({ length: n }, (_, i) => `satir ${i + 1}`).join("\n");

test("dünya olayı (ozyn_*) hafızaya yazılmaz — durumdur", () => {
  assert.equal(aniKaydi({ tur: "olay", ad: "ozyn_yaklasti" }, "olay", "ozyn_yaklasti"), null);
});

test("inisiyatif dürtüsü hafızaya yazılmaz", () => {
  const ad = "nobody has spoken for 15 minutes — this is your own initiative: say something only if it is useful";
  assert.equal(aniKaydi({ tur: "olay", ad, ayrinti: { kaynak: "inisiyatif" } }, "olay", ad), null);
});

test("klavyeden söz kural önemiyle yazılır", () => {
  // "otur" gibi doğuştan komutlar düşük önemle yazılır (mind/aniPolitikasi.test.ts); kural önemi bilgi taşıyan söze uygulanır.
  const m = "ben terminalde claude kullanırım";
  assert.deepEqual(aniKaydi({ tur: "duydum", metin: m, kesin: true }, "konusma", m), { icerik: m, onem: kuralOnemi("konusma", m) });
});

test("mikrofondan söz daha düşük önemle yazılır", () => {
  assert.equal(aniKaydi({ tur: "duydum", metin: "I use claude in the terminal", kesin: true, kaynak: "mikrofon" }, "konusma", "I use claude in the terminal")?.onem, MIKROFON_ONEMI);
});

test("mikrofon sözü klavye sözünden önemsizdir", () => {
  assert.ok(MIKROFON_ONEMI < kuralOnemi("konusma", "x"));
});

test("sonuç (hata) anısı değişmeden yazılır", () => {
  const a = aniKaydi({ tur: "sonuc", sonuc: { niyet_id: "n1", durum: "hata", not: "tahtaya oturulmaz" } }, "sonuc", "hata: tahtaya oturulmaz");
  assert.deepEqual(a, { icerik: "hata: tahtaya oturulmaz", onem: kuralOnemi("sonuc", "") });
});

test("ortam parametre hatası hafızaya yazılmaz; başka hata yazılır", () => {
  const hata = (not: string) => aniKaydi({ tur: "sonuc", sonuc: { niyet_id: "n1", durum: "hata", not } }, "sonuc", `hata: ${not}`);
  assert.equal(hata('ortam efekt: "ac" geçersiz (geçerli: bloom, vinyet)'), null);
  assert.notEqual(hata("tahtaya oturulmaz"), null);
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

// ── Söz ve sonuç göçü (gerçek hafıza 2026-10-15: 86 anının 13'ü süzgeçten önce yazılmıştı) ──
test("söz göçü: selam sözü atılır", () => {
  const r = eskiSozleriTemizle([ani("konusma", "hey", 8)]);
  assert.deepEqual([r.aniler.length, r.atilan], [0, 1]);
});

test("söz göçü: ortam parametre hatası atılır", () => {
  const r = eskiSozleriTemizle([ani("sonuc", "hata: ortam shader: geçersiz", 6)]);
  assert.deepEqual([r.aniler.length, r.atilan], [0, 1]);
});

test("söz göçü: doğuştan komut sözünün önemi KOMUT_ONEMI'ne iner, metni değişmez", () => {
  const r = eskiSozleriTemizle([ani("konusma", "otursana", 8)]);
  assert.deepEqual([r.aniler[0], r.indirilen], [{ ...ani("konusma", "otursana"), onem: KOMUT_ONEMI }, 1]);
});

test("söz göçü: zaten düşük önemli komut sözüne dokunulmaz", () => {
  const eski = [ani("konusma", "gece yap", KOMUT_ONEMI)];
  assert.deepEqual(eskiSozleriTemizle(eski).aniler, eski);
});

test("söz göçü: hata dersinin ayrıntısı atılır", () => {
  const r = eskiSozleriTemizle([ani("sonuc", "hata: masaya oturamadım: 'otur' kesildi", 6)]);
  assert.deepEqual([(r.aniler[0] as { metin: string }).metin, r.normallesen], ["hata: masaya oturamadım: kesildi", 1]);
});

test("söz göçü: bilgi taşıyan söze, yazım hatalı söze, ortam dışı hataya ve tanınmayan kayda dokunulmaz", () => {
  const eski = [ani("konusma", "ben terminalde claude kullanırım", 8), ani("konusma", "gçz", 8), ani("sonuc", "hata: zaten bakıyorum", 6), null, 42];
  assert.deepEqual(eskiSozleriTemizle(eski).aniler, eski);
});

test("söz göçü iki kez koşunca ikincisi hiçbir şey değiştirmez", () => {
  const bir = eskiSozleriTemizle([ani("konusma", "hey", 8), ani("konusma", "otursana", 8), ani("sonuc", "hata: ortam efekt: geçersiz", 6), ani("sonuc", "hata: a 'x' b", 6)]);
  const iki = eskiSozleriTemizle(bir.aniler);
  assert.deepEqual([bir.atilan, bir.indirilen, bir.normallesen, iki.atilan, iki.indirilen, iki.normallesen], [2, 1, 1, 0, 0, 0]);
});

test("söz göçü: tekrarla 10'a tırmanmış hata dersi DERS_TAVANI'na iner; tavandaki ve düşük ders yerinde kalır", () => {
  const r = eskiSozleriTemizle([ani("sonuc", "hata: bilinmeyen çapa/nesne.", 10), ani("sonuc", "hata: zaten bakıyorum", DERS_TAVANI), ani("sonuc", "hata: a", 6)]);
  assert.deepEqual(r.aniler.map((a) => (a as { onem: number }).onem), [DERS_TAVANI, DERS_TAVANI, 6]);
  assert.equal(r.indirilen, 1);
});
