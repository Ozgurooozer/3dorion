// mind/durumKodu.test.ts — Doğuştan kodlayıcı: algı → işaret kümesi.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { KELIME_SINIRI, durumKodu, kelimeler, niyetKaynagi, terminalAyristir } from "./durumKodu.ts";

test("konuşma, bakış cevabı ve tik kodlanmaz — öğrenen kapı onlara karar veremez", () => {
  assert.deepEqual(
    [
      durumKodu({ tur: "duydum", metin: "merhaba", kesin: true }, "kopru.konusma"),
      durumKodu({ tur: "gordum", ne: "onumde", metin: "masa" }, "refleks.gordum.cevap"),
      durumKodu({ tur: "tik", t: 0, dt: 0.05, orion: {} as never, oyuncu: {} as never }, "dikkat.tik_yasak"),
    ],
    [[], [], []],
  );
});

test("her kod algı türünü ve kararı veren içgüdüyü taşır", () => {
  const k = durumKodu({ tur: "olay", ad: "ozyn_sana_bakti" }, "refleks.olay.dunya");
  assert.deepEqual([k.includes("tur:olay"), k.includes("icgudu:refleks.olay.dunya")], [true, true]);
});

test("kod sıralı ve tekrarsız bir kümedir", () => {
  const k = durumKodu({ tur: "terminal", kuyruk: "error error ERROR hata hata", kesildi: false }, "refleks.terminal.hata_deseni");
  assert.deepEqual(k, [...new Set(k)].sort());
});

test("terminal: çıkış kodu sınıfı ve kesin değeri", () => {
  const kod = (kod?: number) => durumKodu({ tur: "terminal", kuyruk: "x", kesildi: false, kod }, "refleks.terminal.gurultu").filter((s) => s.startsWith("kod"));
  assert.deepEqual([kod(undefined), kod(0), kod(127)], [["kod:yok"], ["kod:0"], ["kod:hata", "kod=127"]]);
});

test("terminal: çıktıyı üreten SON komut istemden okunur, istem satırı kelime sayılmaz", () => {
  const kuyruk = "PS C:\\Users\\ozigo> dir\nnotlar.txt\nPS C:\\Users\\ozigo> npm test\nℹ tests 3\nℹ pass 3";
  const k = durumKodu({ tur: "terminal", kuyruk, kesildi: false, kod: 0 }, "refleks.terminal.kod_bitis");
  assert.deepEqual(
    { komut: k.filter((s) => s.startsWith("komut:")), ozygo: k.includes("k:ozigo"), tests: k.includes("k:tests") },
    { komut: ["komut:npm", "komut:npm test"], ozygo: false, tests: true },
  );
});

test("terminalAyristir: sh ve cmd istemleri de tanınır; boş istem komut değildir", () => {
  assert.deepEqual(
    [terminalAyristir("$ git status\nclean").komut, terminalAyristir("C:\\proje> node x.js\nboom").komut, terminalAyristir("PS C:\\a> \nçıktı").komut],
    ["git status", "node x.js", null],
  );
});

test("sonuç: niyeti kimin verdiği ve durumu kodlanır", () => {
  const k = durumKodu({ tur: "sonuc", sonuc: { niyet_id: "elle_mujgw1q1", durum: "hata", not: "zaten ayaktasın" } }, "refleks.sonuc.hata");
  assert.deepEqual(k.filter((s) => s.startsWith("durum:") || s.startsWith("niyet_kaynagi:")), ["durum:hata", "niyet_kaynagi:elle"]);
});

test("niyetKaynagi: önek alt çizgiden öncesidir; önek yoksa tamamı", () => {
  assert.deepEqual([niyetKaynagi("n_abc_1"), niyetKaynagi("ajanda_x"), niyetKaynagi("k1")], ["n", "ajanda", "k1"]);
});

test("olay: ad, yüzey ve mesafe kovası; inisiyatifte ad değil kaynak", () => {
  const yaklas = durumKodu({ tur: "olay", ad: "ozyn_yaklasti", ayrinti: { mesafe: 1.2 } }, "refleks.olay.dunya");
  const inis = durumKodu({ tur: "olay", ad: "nobody has spoken for 10 minutes", ayrinti: { kaynak: "inisiyatif" } }, "refleks.olay.dunya");
  assert.deepEqual(
    { yaklas: yaklas.filter((s) => /^(olay|mesafe):/.test(s)), inis: inis.filter((s) => /^(olay|kaynak):/.test(s)), kelime: inis.includes("k:nobody") },
    { yaklas: ["mesafe:yakin", "olay:ozyn_yaklasti"], inis: ["kaynak:inisiyatif"], kelime: true },
  );
});

test("mesafe kovaları: 1,5 m ve 3,5 m sınırları", () => {
  const kova = (m: number) => durumKodu({ tur: "olay", ad: "ozyn_yaklasti", ayrinti: { mesafe: m } }, "refleks.olay.dunya").find((s) => s.startsWith("mesafe:"));
  assert.deepEqual([0, 1.49, 1.5, 3.49, 3.5, 9].map(kova), ["mesafe:yakin", "mesafe:yakin", "mesafe:orta", "mesafe:orta", "mesafe:uzak", "mesafe:uzak"]);
});

test("kelimeler: küçük harf, 3–24 harf, dolgu atılır, tekrar yok, sırası korunur", () => {
  assert.deepEqual(kelimeler("The Error: ve IS bir hata, HATA! ab abc"), ["error", "hata", "abc"]);
});

test("kelimeler: Türkçe büyük İ doğru küçülür", () => {
  assert.deepEqual(kelimeler("İPTAL"), ["iptal"]);
});

test("kelimeler en çok KELIME_SINIRI tane alır", () => {
  const metin = Array.from({ length: 40 }, (_, i) => `kelime${"abcdefghijklmnopqrstuvwxyz"[i % 26]}${"abcdefghijklmnopqrstuvwxyz"[Math.floor(i / 26)]}`).join(" ");
  assert.equal(kelimeler(metin).length, KELIME_SINIRI);
});

// ── Bağlam (toplantı 2026-09-27 K4) ────────────────────────────────────────

const HATA = { tur: "terminal" as const, kuyruk: "boom", kesildi: false, kod: 1 };
const baglamIsaretleri = (b?: Parameters<typeof durumKodu>[2]) =>
  durumKodu(HATA, "refleks.terminal.kod_hata", b).filter((s) => s.startsWith("ozyn"));

test("bağlam yoksa kodda Ozyn işareti yok — eski kod birebir", () => {
  assert.deepEqual(baglamIsaretleri(), []);
});

test("bağlam: mesafe kovası, bakış ve yüzey kodlanır", () => {
  assert.deepEqual(baglamIsaretleri({ mesafe: 1.1, bakiyor: true, yuzey: "monitor" }), ["ozyn:bakiyor", "ozyn:yakin", "ozyn_yuzey:monitor"]);
});

test("bağlam: mesafe kovaları olayınkiyle aynı sınırlar (1,5 m ve 3,5 m)", () => {
  assert.deepEqual([1.49, 1.5, 3.49, 3.5].map((m) => baglamIsaretleri({ mesafe: m })), [["ozyn:yakin"], ["ozyn:orta"], ["ozyn:orta"], ["ozyn:uzak"]]);
});

test("bağlam: bakmıyorsa, yüzey yoksa ya da mesafe sayı değilse o işaret kodlanmaz", () => {
  assert.deepEqual(baglamIsaretleri({ mesafe: Number.NaN, bakiyor: false, yuzey: null }), []);
});

test("bağlam öğrenilemez algıya işaret eklemez: konuşmanın kodu boş kalır", () => {
  assert.deepEqual(durumKodu({ tur: "duydum", metin: "x", kesin: true }, "kopru.konusma", { mesafe: 1, bakiyor: true }), []);
});
