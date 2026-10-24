// uygulama/rig/grupIslemleri.test.ts — rig toplu işlemleri ve genişletilmiş poz matematiği (spec 38 §8).
import { test } from "node:test";
import assert from "node:assert/strict";
import { sekansDogrula, type Sekans } from "../../protocol/sekans.ts";
import { KONTROL_GRUPLARI, dunyaEkseniGovdeye, eksendeDondur, eksenVektorundeDondur, eulerEsit, grupBul, karsiUzuv, uzuvGrubu, yansit, type KlipBulucu } from "../../world/avatar/index.ts";
import { rigDuzenle, rigOtelemeDuzenle, uzuvEuleri, uzuvOtelemesi } from "./anahtarla.ts";
import { bedeniSifirla, grubuSifirla, grubuYansit, pozuOku, pozuYapistir } from "./grupIslemleri.ts";

const bos: KlipBulucu = { bul: () => null, adlar: () => [] };
const sekans = (ek: Record<string, unknown> = {}): Sekans => {
  const r = sekansDogrula({ surum: 1, ad: "t", fps: 30, sure_kare: 90, baglamalar: [{ id: "b1", ajan: "orion" }], izler: [], ...ek });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
};
const ok = <T>(r: { ok: boolean; deger?: T; hata?: string }): T => { assert.ok(r.ok, r.hata ?? ""); return r.deger as T; };
const yaz = (s: Sekans, u: Parameters<typeof rigDuzenle>[2], kare: number, e: { x: number; y: number; z: number }): Sekans => ok(rigDuzenle(s, "b1", u, kare, e, bos)).sekans;

test("eksenVektorundeDondur: x/y/z birim vektörleriyle eksendeDondur'a eşit; keyfi eksende geri döndürünce başa döner", () => {
  const e0 = { x: 10, y: -20, z: 30 };
  for (const [ek, v] of [["x", [1, 0, 0]], ["y", [0, 1, 0]], ["z", [0, 0, 1]]] as [("x" | "y" | "z"), [number, number, number]][]) assert.ok(eulerEsit(eksenVektorundeDondur(e0, v, 33), eksendeDondur(e0, ek, 33), 1e-4));
  const d = Math.SQRT1_2;
  const gidis = eksenVektorundeDondur(e0, [d, d, 0], 40);
  assert.ok(!eulerEsit(gidis, e0, 1e-2));
  assert.ok(eulerEsit(eksenVektorundeDondur(gidis, [d, d, 0], -40), e0, 1e-4));
});

test("dunyaEkseniGovdeye: yaw 0'da aynı; yaw 90°'de (gövde +X'e bakıyor) dünya +X gövdenin ÖNÜ (+Z) olur", () => {
  assert.deepEqual(dunyaEkseniGovdeye([1, 0, 0], 0).map((v) => Math.round(v * 1e6) / 1e6), [1, 0, 0]);
  const g = dunyaEkseniGovdeye([1, 0, 0], Math.PI / 2);
  assert.ok(Math.abs(g[0]) < 1e-9 && Math.abs(g[2] - 1) < 1e-9, JSON.stringify(g));
  assert.deepEqual(dunyaEkseniGovdeye([0, 1, 0], 1.3).map((v) => Math.round(v * 1e6) / 1e6), [0, 1, 0]);
});

test("yansit: iki kez yansıtmak aynı dönmeyi verir; yan eksen (x) aynı, y ve z işaret değiştirir", () => {
  const e = { x: 25, y: -40, z: 60 };
  assert.ok(eulerEsit(yansit(yansit(e)), e, 1e-4));
  const y = yansit({ x: 25, y: 0, z: 0 }), z = yansit({ x: 0, y: 0, z: 50 });
  assert.ok(eulerEsit(y, { x: 25, y: 0, z: 0 }, 1e-4) && eulerEsit(z, { x: 0, y: 0, z: -50 }, 1e-4), `${JSON.stringify(y)} ${JSON.stringify(z)}`);
  assert.ok(eulerEsit(yansit({ x: 0, y: 30, z: 0 }), { x: 0, y: -30, z: 0 }, 1e-4));
});

test("gruplar: 5 grup (gövde+baş, sol/sağ kol, sol/sağ bacak), 17 uzuv tam bir grupta; karşı gruplar çift", () => {
  assert.deepEqual(KONTROL_GRUPLARI.map((g) => g.id), ["govde", "sag_kol", "sol_kol", "sag_bacak", "sol_bacak"]);
  const hepsi = KONTROL_GRUPLARI.flatMap((g) => g.uzuvlar);
  assert.equal(hepsi.length, 17); assert.equal(new Set(hepsi).size, 17);
  assert.deepEqual(grupBul("govde")!.uzuvlar, ["kalca", "govde", "gogus", "boyun", "bas"]);
  assert.equal(grupBul("sag_kol")!.karsi, "sol_kol"); assert.equal(grupBul("sol_bacak")!.karsi, "sag_bacak"); assert.equal(grupBul("govde")!.karsi, null);
  assert.equal(uzuvGrubu("sol_diz")!.id, "sol_bacak");
});

test("karsiUzuv: sağ↔sol eş; gövde ve baş için null", () => {
  assert.equal(karsiUzuv("sag_on_kol"), "sol_on_kol"); assert.equal(karsiUzuv("sol_ayak"), "sag_ayak");
  assert.equal(karsiUzuv("bas"), null); assert.equal(karsiUzuv("kalca"), null);
});

test("grubuSifirla: grubun bütün uzuvları o karede 0; öteki grup ve öteki kareler dokunulmaz", () => {
  let s = yaz(sekans(), "sol_kol", 30, { x: 0, y: 0, z: -50 });
  s = yaz(s, "sol_on_kol", 30, { x: 40, y: 0, z: 0 });
  s = yaz(s, "sag_kol", 30, { x: 0, y: 0, z: 60 });
  const r = ok(grubuSifirla(s, "b1", 30, grupBul("sol_kol")!, bos));
  assert.equal(r.degisen, 2);
  assert.ok(eulerEsit(uzuvEuleri(r.sekans, "b1", "sol_kol", 30, bos), { x: 0, y: 0, z: 0 }, 1e-3));
  assert.ok(eulerEsit(uzuvEuleri(r.sekans, "b1", "sol_on_kol", 30, bos), { x: 0, y: 0, z: 0 }, 1e-3));
  assert.ok(eulerEsit(uzuvEuleri(r.sekans, "b1", "sag_kol", 30, bos), { x: 0, y: 0, z: 60 }, 1e-3), "öteki kol aynen");
});

test("grubuSifirla: zaten sıfır olan grupta hiçbir şey yazılmaz (degisen 0)", () => {
  const r = ok(grubuSifirla(sekans(), "b1", 10, grupBul("govde")!, bos));
  assert.equal(r.degisen, 0); assert.equal(r.sekans.izler.length, 0);
});

test("grubuYansit: sol kolun duruşu sağ kola yansır (z işaret değiştirir), kaynak aynı kalır; gövdede neden", () => {
  let s = yaz(sekans(), "sol_kol", 20, { x: 10, y: 5, z: -70 });
  s = yaz(s, "sol_on_kol", 20, { x: 45, y: 0, z: 0 });
  const r = ok(grubuYansit(s, "b1", 20, grupBul("sol_kol")!, bos));
  assert.ok(eulerEsit(uzuvEuleri(r.sekans, "b1", "sag_kol", 20, bos), yansit({ x: 10, y: 5, z: -70 }), 1e-3));
  assert.ok(Math.abs(uzuvEuleri(r.sekans, "b1", "sag_kol", 20, bos).z - 70) < 0.1, "z 70°");
  assert.ok(eulerEsit(uzuvEuleri(r.sekans, "b1", "sol_kol", 20, bos), { x: 10, y: 5, z: -70 }, 1e-3));
  const h = grubuYansit(s, "b1", 20, grupBul("govde")!, bos);
  assert.equal(h.ok, false); assert.match((h as { hata: string }).hata, /karşı tarafı yok/);
});

test("pozu kopyala/yapıştır: bir karenin bütün bedeni başka kareye yazılır", () => {
  let s = yaz(sekans(), "bas", 10, { x: 20, y: 0, z: 0 });
  s = yaz(s, "sag_diz", 10, { x: 0, y: 0, z: 0 });
  s = yaz(s, "sol_bacak", 10, { x: -30, y: 0, z: 0 });
  const pano = pozuOku(s, "b1", 10, bos);
  const r = ok(pozuYapistir(s, "b1", 50, pano, bos));
  assert.ok(eulerEsit(uzuvEuleri(r.sekans, "b1", "bas", 50, bos), { x: 20, y: 0, z: 0 }, 1e-3));
  assert.ok(eulerEsit(uzuvEuleri(r.sekans, "b1", "sol_bacak", 50, bos), { x: -30, y: 0, z: 0 }, 1e-3));
  assert.equal(pano.size, 17);
});

test("bedeniSifirla: bütün uzuvlar o karede 0", () => {
  const s = yaz(yaz(sekans(), "bas", 40, { x: 20, y: 10, z: 0 }), "sag_el", 40, { x: 0, y: 0, z: 30 });
  const r = ok(bedeniSifirla(s, "b1", 40, bos));
  assert.equal(r.degisen, 2);
  assert.ok(eulerEsit(uzuvEuleri(r.sekans, "b1", "bas", 40, bos), { x: 0, y: 0, z: 0 }, 1e-3));
});

test("toplu işlem YARIM KALMAZ: bir uzuv reddedilirse (kilitli iz) hiçbir değişiklik dönmez", () => {
  let s = yaz(sekans(), "sol_kol", 30, { x: 0, y: 0, z: -50 });
  s = { ...s, izler: s.izler.map((z) => (z.tur === "uzuv" && z.uzuv === "sol_kol" ? { ...z, kilitli: true } : z)) };
  const r = grubuSifirla(s, "b1", 30, grupBul("sol_kol")!, bos);
  assert.equal(r.ok, false);
  assert.match((r as { hata: string }).hata, /sol_kol/);
});

test("rigOtelemeDuzenle: kök ötelemesi anahtar olur, ±0,5 m'ye kısılır, komşu sıfırlarla yalnız o kareyi değiştirir", () => {
  const r = ok(rigOtelemeDuzenle(sekans(), "b1", 45, { x: 0.2, y: 0, z: 0.9 }, bos));
  assert.equal(r.yazilan, 2);
  assert.ok(Math.abs(uzuvOtelemesi(r.sekans, "b1", "kok", 45, bos).x - 0.2) < 1e-9);
  assert.equal(uzuvOtelemesi(r.sekans, "b1", "kok", 45, bos).z, 0.5, "0,9 → 0,5 m");
  assert.equal(uzuvOtelemesi(r.sekans, "b1", "kok", 0, bos).x, 0);
  assert.equal(uzuvOtelemesi(r.sekans, "b1", "kok", 89, bos).z, 0);
});

test("rigOtelemeDuzenle: değişmeyen hedef iz açmaz; bilinmeyen bağlama reddedilir", () => {
  assert.equal(ok(rigOtelemeDuzenle(sekans(), "b1", 10, { x: 0, y: 0, z: 0 }, bos)).sekans.izler.length, 0);
  assert.equal(rigOtelemeDuzenle(sekans(), "yok", 10, { x: 0.1, y: 0, z: 0 }, bos).ok, false);
});
