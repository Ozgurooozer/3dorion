// uygulama/sekans/editor/kameraYardimcilari.test.ts — kamera yörüngesi ve Orion karşısı (spec 38 §7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { EN_UZAK, EN_YAKIN, fovDerece, fovRadyan, konumdan, kuresel, orionKarsisi, orionYanindan, yorungele } from "./kameraYardimcilari.ts";

const yakin = (a: number, b: number, t = 1e-9): void => assert.ok(Math.abs(a - b) < t, `${a} ≠ ${b}`);

test("kuresel ↔ konumdan gidiş-dönüş aynı konumu verir", () => {
  const k = { konum: [2, 3, 4] as [number, number, number], hedef: [0.5, 1, -1] as [number, number, number] };
  const s = kuresel(k);
  const p = konumdan(k.hedef, s.yatay, s.yukselti, s.mesafe);
  for (let i = 0; i < 3; i++) yakin(p[i]!, k.konum[i]!);
});

test("yörünge: mesafe ve hedef korunur, yatay açı döner (hedefin +Z'sinden +X'e)", () => {
  const k = { konum: [0, 1.5, 3] as [number, number, number], hedef: [0, 1.5, 0] as [number, number, number] };
  const p = yorungele(k, 90, 0, 0);
  yakin(p[0]!, 3); yakin(p[2]!, 0, 1e-9); yakin(p[1]!, 1.5);
  yakin(kuresel({ konum: p, hedef: k.hedef }).mesafe, 3);
});

test("yörünge: yükselti ±85° ile sınırlı (kutupta yön bozulmaz), mesafe 0,3–40 m", () => {
  const k = { konum: [0, 1.5, 3] as [number, number, number], hedef: [0, 1.5, 0] as [number, number, number] };
  yakin(kuresel({ konum: yorungele(k, 0, 500, 0), hedef: k.hedef }).yukselti, 85, 1e-6);
  yakin(kuresel({ konum: yorungele(k, 0, -500, 0), hedef: k.hedef }).yukselti, -85, 1e-6);
  yakin(kuresel({ konum: yorungele(k, 0, 0, -99), hedef: k.hedef }).mesafe, EN_YAKIN, 1e-9);
  yakin(kuresel({ konum: yorungele(k, 0, 0, 999), hedef: k.hedef }).mesafe, EN_UZAK, 1e-9);
});

test("Orion karşısı: Orion'un baktığı yönde önünde (yaw 0 = +Z), hedef göğsü", () => {
  const g = orionKarsisi({ x: 1, y: 0, z: -2 }, 0, 2);
  assert.deepEqual(g.konum, [1, 1.45, 0]);
  assert.deepEqual(g.hedef, [1, 1.15, -2]);
  const d = orionKarsisi({ x: 0, y: 0, z: 0 }, Math.PI / 2, 2);
  yakin(d.konum[0], 2); yakin(d.konum[2], 0, 1e-9);
});

test("Orion yanından: baktığı yöne dik (yaw 0 → +X tarafı)", () => {
  const g = orionYanindan({ x: 0, y: 0, z: 0 }, 0, 3);
  yakin(g.konum[0], 3); yakin(g.konum[2], 0);
});

test("görüş alanı dönüşümü gidiş-dönüş", () => { yakin(fovDerece(fovRadyan(50)), 50); });
