// uygulama/senaryoBaglami.test.ts — Senaryo listesi tek kaynak: SENARYOLAR ↔ dosyalar ↔ 3dorion.bat.
//
// Yükleyici (world/giris.ts) yalnız SENARYOLAR'daki adları `import()` eder. Listeye eklenip dosyası
// unutulan bir senaryo canlıda sessizce "yüklenemedi" olur; dosyası olup listede olmayan hiç koşmaz.
// Bu test ikisini de derlemede yakalar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { SENARYOLAR, istenenSenaryolar } from "./senaryoBaglami.ts";

const KLASOR = new URL("./senaryolar/", import.meta.url);
const dosyalar = readdirSync(KLASOR)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => f.slice(0, -3));

test("her senaryo adının bir dosyası var", () => {
  const eksik = SENARYOLAR.filter((ad) => !dosyalar.includes(ad));
  assert.deepEqual(eksik, []);
});

test("her senaryo dosyası listede", () => {
  const listedeYok = dosyalar.filter((f) => !(SENARYOLAR as readonly string[]).includes(f));
  assert.deepEqual(listedeYok, []);
});

test("her senaryo dosyası `kos(d)` dışa aktarır", () => {
  const kosYok = dosyalar.filter((f) =>
    !readFileSync(new URL(`${f}.ts`, KLASOR), "utf8").includes("export async function kos(d: SenaryoBaglami)"));
  assert.deepEqual(kosYok, []);
});

test("istenenSenaryolar yalnız URL'de olanları verir", () => {
  assert.deepEqual(istenenSenaryolar("?sessiz=1&eylemdene=1"), ["eylemdene"]);
});

test("istenenSenaryolar bilinmeyen anahtarı yok sayar", () => {
  assert.deepEqual(istenenSenaryolar("?fps=1&beceri=1"), []);
});
