// world/avatar/rig/rig.test.ts — Control Rig çekirdeği: kontrol kaydı (kanonik iskeletten) ve eksen döndürme matematiği (spec 38).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import { UZUVLAR } from "../../../protocol/animasyon.ts";
import { kanonikUzuvlar } from "../iskelet/kanonik.ts";
import { KONTROLLER, kontrolBul, kontrolRengi, uzuvKontrolu, zincirKontrolleri } from "./kontroller.ts";
import { DERECE, carp, eulerdenMatris, aciFarki, Rx, Ry } from "./matris.ts";
import { dereceYazisi, eksendeDondur, eulerEsit, kisEuler } from "./poz.ts";

test("kontroller: kanonik her uzuv için TAM BİR kontrol, kimlikler tekil", () => {
  assert.equal(KONTROLLER.length, kanonikUzuvlar().length);
  assert.equal(new Set(KONTROLLER.map((k) => k.id)).size, KONTROLLER.length);
  for (const u of kanonikUzuvlar()) assert.ok(uzuvKontrolu(u), u);
  for (const k of KONTROLLER) assert.ok(UZUVLAR.includes(k.uzuv));
});

test("kontroller: şekiller Unreal kuralı — pelvis disk, el ve ayak kutu, omurga ve baş halka", () => {
  const s = (u: Parameters<typeof uzuvKontrolu>[0]) => uzuvKontrolu(u)!.sekil;
  assert.deepEqual([s("kalca"), s("sag_el"), s("sol_ayak"), s("govde"), s("bas")], ["disk", "kutu", "kutu", "halka", "halka"]);
});

test("kontroller: taraf uzuv adından, renk sağ kırmızı / sol mavi / orta sarı; seçilince açılır", () => {
  assert.equal(uzuvKontrolu("sag_kol")!.taraf, "sag");
  assert.equal(uzuvKontrolu("sol_diz")!.taraf, "sol");
  assert.equal(uzuvKontrolu("bas")!.taraf, "orta");
  assert.equal(kontrolRengi("sag", false), "#d83030");
  assert.equal(kontrolRengi("sol", false), "#3060d8");
  assert.equal(kontrolRengi("orta", false), "#e0b020");
  assert.notEqual(kontrolRengi("sag", true), kontrolRengi("sag", false));
});

test("kontroller: zincirKontrolleri kökten uca, kimlikle bulunur", () => {
  assert.deepEqual(zincirKontrolleri("sol_kol").map((k) => k.uzuv), ["sol_kol", "sol_on_kol", "sol_el"]);
  assert.equal(kontrolBul("k_sag_el")!.uzuv, "sag_el");
  assert.equal(kontrolBul("yok"), null);
  assert.deepEqual(zincirKontrolleri("omurga").map((k) => k.uzuv), ["govde", "gogus"]);
});

test("poz: sıfır dönmeyi x ekseninde döndürmek donme_x'e eşittir (yön kuralı: kanal işareti korunur)", () => {
  for (const [e, ekseni] of [["x", "x"], ["y", "y"], ["z", "z"]] as const) {
    const y = eksendeDondur({ x: 0, y: 0, z: 0 }, e, 25);
    assert.ok(Math.abs(y[ekseni] - 25) < 1e-6 && Object.entries(y).every(([k, v]) => k === ekseni || Math.abs(v) < 1e-6), `${e}: ${JSON.stringify(y)}`);
  }
});

test("poz: döndür ve geri döndür aynı Euler'e döner (geri alınabilir)", () => {
  const e0 = { x: 20, y: -35, z: 50 };
  const g = eksendeDondur(eksendeDondur(e0, "y", 30), "y", -30);
  assert.ok(eulerEsit(g, e0, 1e-4), JSON.stringify(g));
});

test("poz: sonuç matrisi = Eksen · mevcut (gövde uzayında SOLDAN), Babylon'un kendi Euler matrisiyle de aynı dönme", () => {
  const e0 = { x: 15, y: 40, z: -25 };
  const yeni = eksendeDondur(e0, "x", 33);
  const beklenen = carp(Rx(33 * DERECE), eulerdenMatris(e0.x, e0.y, e0.z));
  assert.ok(aciFarki(eulerdenMatris(yeni.x, yeni.y, yeni.z), beklenen) < 1e-6);
  // Babylon: aynı Euler üçlüsü RotationYawPitchRoll(y, x, z) — devriği sütun biçimi (kimodoCevir.test.ts bekçisi). Burada yalnız çapraz kontrol.
  const b = Matrix.RotationYawPitchRoll(yeni.y * DERECE, yeni.x * DERECE, yeni.z * DERECE).m;
  const m = eulerdenMatris(yeni.x, yeni.y, yeni.z);
  let en = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) en = Math.max(en, Math.abs(b[j * 4 + i]! - m[i * 3 + j]!));
  assert.ok(en < 1e-5, `fark ${en}`);
});

test("poz: eksen sırası önemli — Y sonra X ile X sonra Y farklı sonuç verir (soldan çarpım)", () => {
  const a = eksendeDondur(eksendeDondur({ x: 0, y: 0, z: 0 }, "x", 40), "y", 40);
  const b = eksendeDondur(eksendeDondur({ x: 0, y: 0, z: 0 }, "y", 40), "x", 40);
  assert.ok(!eulerEsit(a, b, 1e-3));
  assert.ok(aciFarki(eulerdenMatris(a.x, a.y, a.z), carp(Ry(40 * DERECE), Rx(40 * DERECE))) < 1e-6);
});

test("poz: ±180 sarma — 170°'ye +30° eklemek aynı dönmeyi öncekine yakın Euler ile verir (süreksizlik yok)", () => {
  const y = eksendeDondur({ x: 0, y: 0, z: 170 }, "z", 30);
  assert.ok(Math.abs(y.z - 200) < 1e-6 || Math.abs(y.z + 160) < 1e-6);
  assert.ok(aciFarki(eulerdenMatris(y.x, y.y, y.z), Rz200()) < 1e-6);
});
function Rz200() { return eulerdenMatris(0, 0, 200); }

test("poz: kisEuler tavanı kanal kanal uygular, dereceYazisi okunur", () => {
  assert.deepEqual(kisEuler({ x: 200, y: -300, z: 5 }, 180), { x: 180, y: -180, z: 5 });
  assert.equal(dereceYazisi(12.34), "12.3°");
  assert.equal(dereceYazisi(-0.04), "0.0°", "eksi sıfır yazılmaz");
});

test("bekçi: saf rig modülleri Babylon import etmez (poz.ts, kontroller.ts, matris.ts, iskelet/*)", () => {
  for (const d of ["rig/poz.ts", "rig/kontroller.ts", "rig/matris.ts", "iskelet/kanonik.ts", "iskelet/kaynaklar.ts", "zincirler.ts"]) {
    const m = readFileSync(new URL(`../${d}`, import.meta.url), "utf8");
    assert.ok(!/from\s+["']@babylonjs/.test(m), `${d} Babylon import ediyor`);
  }
});
