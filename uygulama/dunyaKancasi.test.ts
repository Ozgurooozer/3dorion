// uygulama/dunyaKancasi.test.ts — hızlı deneme tuşları (1-6) oyuna YALNIZ oyun tuşuyken gider: sohbet/yazı alanı/değiştirici tuş/IME'de gitmez.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { HIZLI_NIYETLER, hizliTusNiyeti, yaziHedefiMi } from "./dunyaKancasi.ts";

const hedef = (ek: Record<string, unknown> = {}) => ({ tagName: "CANVAS", isContentEditable: false, ...ek }) as unknown as EventTarget;

test("serbest, gövdede, değiştirici yok: tuş niyete döner (1 → tahtaya git, 3 → otur)", () => {
  assert.deepEqual([hizliTusNiyeti({ key: "1", target: hedef() }, true)?.[0], hizliTusNiyeti({ key: "3", target: hedef() }, true)?.[0]], ["git", "otur"]);
});

test("SOHBET AÇIKKEN (serbest değil) rakamlar oyuna gitmez: 'sohbette 1 yazınca Orion tahtaya yürüyordu' hatası", () => {
  for (const k of ["1", "2", "3", "4", "5", "6"]) assert.equal(hizliTusNiyeti({ key: k, target: hedef() }, false), null, k);
});

test("hedef bir yazı alanıysa (input, textarea, select, contentEditable) serbest görünse bile gitmez", () => {
  for (const h of [hedef({ tagName: "INPUT" }), hedef({ tagName: "TEXTAREA" }), hedef({ tagName: "SELECT" }), hedef({ isContentEditable: true })]) {
    assert.equal(hizliTusNiyeti({ key: "1", target: h }, true), null);
  }
});

test("Ctrl/Alt/Meta ile basılan rakam (tarayıcı kısayolu, sekme seçimi) oyuna gitmez", () => {
  for (const d of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }]) assert.equal(hizliTusNiyeti({ key: "1", target: hedef(), ...d }, true), null);
});

test("IME yazımı sürerken (isComposing) rakam oyuna gitmez", () => {
  assert.equal(hizliTusNiyeti({ key: "1", target: hedef(), isComposing: true }, true), null);
});

test("rakam olmayan tuş niyet doğurmaz; hedef yoksa (null) gövde sayılır", () => {
  assert.deepEqual([hizliTusNiyeti({ key: "a", target: hedef() }, true), hizliTusNiyeti({ key: "1", target: null }, true)?.[0]], [null, "git"]);
});

test("yaziHedefiMi: null ve sıradan eleman değil; yalnız yazı alanları", () => {
  assert.deepEqual([null, hedef(), hedef({ tagName: "INPUT" })].map((h) => yaziHedefiMi(h)), [false, false, true]);
});

test("hızlı tablo bozulmadı: 1-6, 6 niyet", () => {
  assert.deepEqual(Object.keys(HIZLI_NIYETLER), ["1", "2", "3", "4", "5", "6"]);
});
