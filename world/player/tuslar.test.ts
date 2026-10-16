// world/player/tuslar.test.ts — oyun tuşları: F etkileşim, C kamera; kod ile ekrandaki etiket tutarlı; eski etiketler yazıda kalmadı.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TUSLAR, tusKarari } from "./tuslar.ts";
import { ipucuMetni } from "./etkilesim.ts";

const KOK = path.resolve(import.meta.dirname, "..", "..");
const oku = (...yol: string[]): string => fs.readFileSync(path.join(KOK, ...yol), "utf8");

test("F etkileşim tuşudur", () => {
  assert.equal(tusKarari("KeyF"), "etkilesim");
});

test("C kamera tuşudur", () => {
  assert.equal(tusKarari("KeyC"), "kamera");
});

test("Tab imleç kipidir", () => {
  assert.equal(tusKarari("Tab"), "imlec");
});

test("E artık hiçbir oyun eylemini tetiklemez (eski etkileşim tuşu boşta)", () => {
  assert.equal(tusKarari("KeyE"), null);
});

test("hareket ve diğer tuşlar oyun eylemi tetiklemez", () => {
  assert.deepEqual(["KeyW", "Space", "ShiftLeft", "KeyT"].map(tusKarari), [null, null, null, null]);
});

test("hiçbir iki oyun eylemi AYNI tuşta değil (çakışma yok)", () => {
  const kodlar = Object.values(TUSLAR).map((t) => t.kod);
  assert.equal(new Set(kodlar).size, kodlar.length);
});

test("her tuşun etiketi kodundan türer: 'KeyF' ↔ 'F', 'Tab' ↔ 'Tab' (yazı ile gerçek tuş ayrışamaz)", () => {
  for (const t of Object.values(TUSLAR)) assert.ok(t.kod === `Key${t.etiket}` || t.kod === t.etiket, `${t.kod} ↔ ${t.etiket}`);
});

test("HUD ipucu etkileşim tuşunun etiketiyle başlar", () => {
  assert.equal(ipucuMetni("monitör", "kullan"), `[${TUSLAR.etkilesim.etiket}] monitör — kullan`);
});

test("yazılı metinler: HUD kamera satırı kamera tuşunu söyler", () => {
  const hud = oku("uygulama", "hud.ts");
  assert.ok(hud.includes("${kameraTusu}"), "hud.ts kamera tuşunu tablodan almıyor");
});

test("yazılı metinler: Bedenim paneli doğru kamera tuşunu söyler", () => {
  assert.ok(oku("world", "arayuz", "bedenPaneli.ts").includes(`${TUSLAR.kamera.etiket} ile omuz kamerasına geç`));
});

test("yazılı metinler: eski etiketler (F kamera, F ile omuz, Monitore E) hiçbir yerde kalmadı", () => {
  const metin = [oku("uygulama", "hud.ts"), oku("world", "arayuz", "bedenPaneli.ts"), oku("3dorion.bat")].join("\n");
  const eskiler = ["F kamera", "F ile omuz", "(F: ", "Monitore E ile", "E etkilesim", "E terminal"];
  assert.deepEqual(eskiler.filter((e) => metin.includes(e)), []);
});

test("oyuncu.ts tuşları TABLODAN okur: tusKarari çağırır, KeyE/KeyF/KeyC değişmezi yazmaz (tablo ile gerçek tuş ayrışamaz)", () => {
  const kaynak = oku("world", "player", "oyuncu.ts");
  assert.ok(kaynak.includes("tusKarari("), "oyuncu.ts tusKarari kullanmıyor");
  assert.deepEqual(['"KeyE"', '"KeyF"', '"KeyC"'].filter((d) => kaynak.includes(d)), []);
});
