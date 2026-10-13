// world/level/ofisYeri.test.ts — Ofisin ova içindeki yeri (spec 27): plato, çim maskesi, kayan yerleşimler, saflık.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ofisiOvayaKur, PLATO, OFIS_IZI } from "./ofisYeri.ts";
import { levelTanimiDogrula, type LevelTanimi } from "./cekirdek/levelTanimi.ts";
import { ornekTanim } from "./cekirdek/ornekTanim.ts";
import { ZEMIN_VARSAYILAN, zeminTabanYuksekligi, platoFarki, type ZeminAyari } from "./moduller/zemin.ts";
import { seyrekOku, ornekle } from "./cekirdek/arazi.ts";

const ovaYolu = path.join(path.dirname(fileURLToPath(import.meta.url)), "ova", "ova.level.json");
const ova = (): LevelTanimi => { const d = levelTanimiDogrula(JSON.parse(fs.readFileSync(ovaYolu, "utf8")) as unknown); if (!d.ok) throw new Error(d.hata); return d.deger; };
const zeminAyari = (t: LevelTanimi): ZeminAyari => ({ ...ZEMIN_VARSAYILAN, ...(t.katmanlar.find((k) => k.tur === "zemin")!.ayar as Partial<ZeminAyari>) });
const tanimZemin = (): LevelTanimi => {
  const t = ornekTanim();
  t.katmanlar = [{ tur: "zemin", etiket: "z", ayar: {} } as never, { tur: "su", ayar: { x: -30, z: -32, seviye: -0.25 } } as never];
  t.nesneler = [{ id: "n1", varlik: "A", konum: [20, 0.5, 5], donus: 0, olcek: 1 } as never, { id: "ofis", varlik: "B", konum: [0, 0, 22], donus: 0, olcek: 1 } as never];
  t.gecitler = [{ ad: "ofis", konum: [-2, 15], yon: 180, hedef: "oda" } as never];
  return t;
};

test("gerçek ova + ofis yerleştirmesi geçerli tanım kalır", () => {
  const s = ofisiOvayaKur(ova());
  const d = levelTanimiDogrula(s);
  assert.ok(d.ok, d.ok ? "" : d.hata);
});

test("girdiyi değiştirmez; iki kez uygulamak bir kez uygulamakla aynı (eşgüçlü)", () => {
  const t = ova(), onceki = JSON.stringify(t);
  const bir = ofisiOvayaKur(t);
  assert.equal(JSON.stringify(t), onceki);
  assert.deepEqual(ofisiOvayaKur(bir), bir);
});

test("ofis ayak izi ve terasta zemin TAM düz ve ofis zemininin (y=0) hemen altında", () => {
  const f = zeminTabanYuksekligi(zeminAyari(ofisiOvayaKur(ova())));
  for (const [x, z] of [[0, 0], [OFIS_IZI.yariX, OFIS_IZI.yariZ], [-OFIS_IZI.yariX, -OFIS_IZI.yariZ], [2.6, 7], [PLATO.yaricap - 0.01, 0], [0, -(PLATO.yaricap - 0.01)]] as const) {
    assert.equal(f(x, z), PLATO.yukseklik, `(${x},${z})`);
  }
  assert.ok(PLATO.yukseklik < 0 && PLATO.yukseklik > -0.2, "ofis zemininin altında ama görünür basamak yok");
});

test("plato çevresi PLATO.cukur kadar çöker, çukur uzakta doğal araziye döner (uzak arazi ile dikiş yok)", () => {
  const a = zeminAyari(ofisiOvayaKur(ova()));
  const farkli = platoFarki(a);
  assert.ok(Math.abs(farkli(100, 0) - -PLATO.cukur) < 1e-9, `d=100: ${farkli(100, 0)}`);   // çukur tam derinlikte
  assert.ok(Math.abs(farkli(300, 0)) < 1e-9, `d=300 (zemin kenarı): ${farkli(300, 0)}`);   // doğal arazi
  assert.ok(Math.abs(farkli(0, 310)) < 1e-9);
});

test("plato eğimi yürünebilir: hiçbir yönde eğim 0,6'yı (≈31°) aşmaz", () => {
  const f = zeminTabanYuksekligi(zeminAyari(ofisiOvayaKur(ova())));
  let enDik = 0;
  for (let aci = 0; aci < Math.PI * 2; aci += Math.PI / 24) {
    for (let d = 0; d < 90; d += 0.5) {
      const h0 = f(Math.cos(aci) * d, Math.sin(aci) * d), h1 = f(Math.cos(aci) * (d + 0.5), Math.sin(aci) * (d + 0.5));
      enDik = Math.max(enDik, Math.abs(h1 - h0) / 0.5);
    }
  }
  assert.ok(enDik < 0.6, `en dik eğim ${enDik.toFixed(2)}`);
});

test("plato yokken (eski dosyalar) zemin yüksekliği BİREBİR aynı", () => {
  const a = { ...ZEMIN_VARSAYILAN };
  const f = zeminTabanYuksekligi(a), g = zeminTabanYuksekligi({ ...a, platoYaricap: 0, platoCukur: 5 });
  for (const [x, z] of [[0, 0], [30, -40], [-120, 77]] as const) assert.equal(f(x, z), g(x, z));
  assert.equal(platoFarki(a)(10, 10), 0);
});

test("çim maskesi ofis ayak izini tam kapsar; Ozyn'un mevcut fırça maskesi korunur", () => {
  const t = tanimZemin();
  t.katmanlar.push({ tur: "cim", ayar: { maske: [4096 * 3000 + 100, 0.5] } } as never);
  const s = ofisiOvayaKur(t);
  const maske = (s.katmanlar.find((k) => k.tur === "cim")!.ayar as { maske: number[] }).maske;
  const m = seyrekOku(maske);
  for (const [x, z] of [[0, 0], [OFIS_IZI.yariX, OFIS_IZI.yariZ], [-OFIS_IZI.yariX, OFIS_IZI.yariZ], [OFIS_IZI.yariX, -OFIS_IZI.yariZ]] as const) {
    assert.ok(ornekle(m, 2, x, z) > 0.999, `(${x},${z}) çim kalıyor`);
  }
  assert.equal(m.get(4096 * 3000 + 100), 0.5, "önceki fırça hücresi korunmalı");
});

test("kaya/dekor iç yarıçapı platoyu ve eteğini boş bırakır (önceki değer daha büyükse o kalır)", () => {
  const t = tanimZemin();
  t.katmanlar.push({ tur: "kaya", ayar: { icYaricap: 6 } } as never, { tur: "dekor", ayar: { icYaricap: 40 } } as never);
  const s = ofisiOvayaKur(t);
  assert.equal((s.katmanlar.find((k) => k.tur === "kaya")!.ayar as { icYaricap: number }).icYaricap, PLATO.yaricap + 2);
  assert.equal((s.katmanlar.find((k) => k.tur === "dekor")!.ayar as { icYaricap: number }).icYaricap, 40);
});

test("mutlak y'li yerleşim ve su yüzeyi arazi kadar kayar; konum x/z değişmez", () => {
  const t = tanimZemin();
  const s = ofisiOvayaKur(t);
  const fark = platoFarki(zeminAyari(s));
  const n1 = s.nesneler!.find((n) => n.id === "n1")!;
  assert.deepEqual([n1.konum[0], n1.konum[2]], [20, 5]);
  assert.ok(Math.abs(n1.konum[1] - (0.5 + fark(20, 5))) < 0.002);
  const su = s.katmanlar.find((k) => k.tur === "su")!.ayar as { seviye: number };
  assert.ok(Math.abs(su.seviye - (-0.25 + fark(-30, -32))) < 0.002);
  assert.ok(su.seviye < -3, `su ${su.seviye}`);
});

test("HEAD'deki eski 'ofis' bina yerleşimi ve ofis geçidi kalkar; başka yerleşimler durur", () => {
  const s = ofisiOvayaKur(tanimZemin());
  assert.deepEqual(s.nesneler!.map((n) => n.id), ["n1"]);
  assert.equal(s.gecitler, undefined);
});

test("zemin katmanı olmayan tanımda fırlatır (plato olmadan ofis havada kalırdı)", () => {
  assert.throws(() => ofisiOvayaKur(ornekTanim()), /zemin katmanı yok/);
});
