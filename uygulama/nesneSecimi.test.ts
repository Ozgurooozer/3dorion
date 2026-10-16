// uygulama/nesneSecimi.test.ts — fare → seçim: imleç kipi ve odak kapıları, sol tık seç, sağ tık menü, boşluğa tık kaldırır.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { nesneSecimiKur, type FareOlayi } from "./nesneSecimi.ts";
import { secimDurumuKur } from "./secimDurumu.ts";
import type { Nesne } from "../world/level/nesneKaydi.ts";

const kutu = (x: number, z: number) => ({ x, y: 0, z, g: 1, yuk: 1, d: 1 });
const BANK: Nesne = { id: "bank", ad: "bank", tur: "mobilya", capa: "bank", kutu: kutu(0, 5) };
const RAF: Nesne = { id: "raf", ad: "raf", tur: "mobilya", capa: null, kutu: kutu(10, 5) };

function duzenek(baslangic: { imlec?: boolean; odakta?: boolean } = {}) {
  const kayit = new Map<string, Set<(e: FareOlayi) => void>>();
  const tuval = {
    addEventListener: (t: string, f: (e: FareOlayi) => void) => { (kayit.get(t) ?? kayit.set(t, new Set()).get(t)!).add(f); },
    removeEventListener: (t: string, f: (e: FareOlayi) => void) => { kayit.get(t)?.delete(f); },
  };
  const durum = { imlec: baslangic.imlec ?? true, odakta: baslangic.odakta ?? false, menu: [] as { id: string; x: number; y: number }[], altyazi: [] as string[], onleme: 0, isinX: 0 };
  const nesneler = [BANK, RAF];
  const secim = secimDurumuKur({ nesneler: () => nesneler, degisti: () => {} });
  const kip = nesneSecimiKur({
    tuval,
    imlec: { get acik() { return durum.imlec; } },
    odakta: () => durum.odakta,
    nesneler: () => nesneler,
    // Ekranın x'i dünyanın x'idir (test): kaynak (x, 0, 0), +Z'ye bakar.
    isin: (x) => { durum.isinX = x; return { kaynak: { x, y: 0, z: 0 }, yon: { x: 0, y: 0, z: 1 } }; },
    secim,
    menuAc: (n, x, y) => { durum.menu.push({ id: n.id, x, y }); },
    altyazi: (m) => { durum.altyazi.push(m); },
  });
  const olay = (x: number, istemciX = x + 100, istemciY = 50): FareOlayi => ({ offsetX: x, offsetY: 0, clientX: istemciX, clientY: istemciY, preventDefault: () => { durum.onleme++; } });
  const yay = (tur: string, e: FareOlayi) => { for (const f of kayit.get(tur) ?? []) f(e); };
  return { kip, durum, secim, kayit, sol: (x: number) => yay("click", olay(x)), sag: (x: number) => yay("contextmenu", olay(x)) };
}

test("imleç kipinde sol tık nesneyi SEÇER (ışın bankı vuruyor)", () => {
  const { sol, secim } = duzenek();
  sol(0);
  assert.equal(secim.oku()?.id, "bank");
});

test("sol tık seçimi altyazıyla bildirir ve menü ipucu verir", () => {
  const { sol, durum } = duzenek();
  sol(0);
  assert.deepEqual(durum.altyazi, ["seçildi: bank · sağ tık: menü"]);
});

test("boşluğa sol tık seçimi KALDIRIR", () => {
  const { sol, secim, durum } = duzenek();
  sol(0); sol(5);
  assert.equal(secim.oku(), null);
  assert.equal(durum.altyazi.at(-1), "seçim kaldırıldı");
});

test("başka nesneye sol tık seçimi değiştirir", () => {
  const { sol, secim } = duzenek();
  sol(0); sol(10);
  assert.equal(secim.oku()?.id, "raf");
});

test("sağ tık nesneyi seçer VE menüyü açar (imleç konumunda)", () => {
  const { sag, secim, durum } = duzenek();
  sag(10);
  assert.equal(secim.oku()?.id, "raf");
  assert.deepEqual(durum.menu, [{ id: "raf", x: 110, y: 50 }]);
});

test("sağ tık tarayıcının bağlam menüsünü ENGELLER", () => {
  const { sag, durum } = duzenek();
  sag(0);
  assert.equal(durum.onleme, 1);
});

test("boşluğa sağ tık menü AÇMAZ ama bağlam menüsünü yine engeller", () => {
  const { sag, durum } = duzenek();
  sag(5);
  assert.deepEqual([durum.menu.length, durum.onleme], [0, 1]);
});

test("imleç kipi KAPALIYKEN hiçbir şey olmaz: seçim yok, menü yok, bağlam menüsü engellenmez", () => {
  const { sol, sag, secim, durum } = duzenek({ imlec: false });
  sol(0); sag(0);
  assert.deepEqual([secim.oku(), durum.menu.length, durum.onleme, durum.altyazi.length], [null, 0, 0, 0]);
});

test("ODAKTAYKEN (terminal/panel) hiçbir şey olmaz: mevcut tıklama davranışı bozulmaz", () => {
  const { sol, sag, secim, durum } = duzenek({ odakta: true });
  sol(0); sag(0);
  assert.deepEqual([secim.oku(), durum.menu.length, durum.onleme], [null, 0, 0]);
});

test("sok() dinleyicileri çözer", () => {
  const { kip, kayit, sol, secim } = duzenek();
  kip.sok();
  sol(0);
  assert.equal(secim.oku(), null);
  assert.deepEqual([...kayit.values()].map((k) => k.size), [0, 0]);
});
