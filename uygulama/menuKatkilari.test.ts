// uygulama/menuKatkilari.test.ts — sağ tık menüsünün katkıları: hedefe göre yol, gri+neden, Orion yaprakları söz sözlüğüyle tutarlı.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { menuKur, type MenuDugumu } from "../world/arayuz/menu/menuModeli.ts";
import { MENU_KATKILARI, type HedefMenuBaglami, type MenuEylemi, type MenuHedefi } from "./menuKatkilari.ts";
import { nesneEylemleri } from "../world/yer/nesneEylemleri.ts";
import { seciliSozOlustur } from "./nesneEtkilesimi.ts";
import { BANK_CAPASI, BANK_NESNESI } from "../world/level/bank.ts";
import { tumCapalar } from "../world/level/capalar.ts";

type D = MenuDugumu<MenuEylemi>;
const menu = (hedef: MenuHedefi): D[] => menuKur<HedefMenuBaglami, MenuEylemi>({ hedef }, MENU_KATKILARI);
const adlar = (l: readonly D[]): string[] => l.map((d) => (d.tur === "ayrac" ? "—" : d.ad));
const altOgeleri = (l: readonly D[], ad: string): D[] => {
  const d = l.find((x) => x.tur === "alt" && x.ad === ad);
  assert.ok(d && d.tur === "alt", `alt menü yok: ${ad}`);
  return (d as Extract<D, { tur: "alt" }>).ogeler;
};
const yaprak = (l: readonly D[], ad: string) => {
  const d = l.find((x) => x.tur === "eylem" && x.ad === ad);
  assert.ok(d && d.tur === "eylem", `eylem yok: ${ad}`);
  return d as Extract<D, { tur: "eylem" }>;
};

const alan = { sinir: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, engeller: [{ x: 5, y: 0, z: 5, g: 2, yuk: 1, d: 2 }] };
const orion = { oturuyor: false, poz: "ayakta", mesgul: false, elinde: null, konum: { x: 0, z: 0 } };

test("zemin: 'Buraya ▸ Git/Bak' + Özellikler…; nesneye özgü 'Seçimi kaldır' YOK", () => {
  const m = menu({ tur: "zemin", nokta: { x: 1, y: 0, z: 2 }, alan });
  assert.deepEqual(adlar(m), ["Buraya", "—", "Özellikler…"]);
  assert.deepEqual(adlar(altOgeleri(m, "Buraya")), ["Git", "Bak"]);
});

test("zemin: engel içindeki noktada 'Git' gri ve NEDENLİ, 'Bak' uygun", () => {
  const alt = altOgeleri(menu({ tur: "zemin", nokta: { x: 5, y: 0, z: 5 }, alan }), "Buraya");
  const git = alt.find((d) => d.tur === "eylem" && d.ad === "Git");
  assert.ok(git?.tur === "eylem" && !git.uygun && /engel/.test(git.neden ?? ""));
  assert.equal(alt.find((d) => d.tur === "eylem" && d.ad === "Bak")?.tur === "eylem", true);
});

test("Orion: komutlar doğrudan listede; ayakta iken 'Kalk' yok, oturuyorsa var", () => {
  assert.deepEqual(adlar(menu({ tur: "orion", orion })).filter((a) => a !== "—"), ["Yanıma gel", "Bana bak", "El salla", "Dur", "Özellikler…"]);
  assert.ok(adlar(menu({ tur: "orion", orion: { ...orion, oturuyor: true } })).includes("Kalk"));
});

test("Orion: yaprağın yükü bugünkü NesneEylemi'dir (tek eylem yolu)", () => {
  const y = yaprak(menu({ tur: "orion", orion }), "Dur");
  assert.equal(y.eylem.tur === "eylem" && y.eylem.eylem.niyet?.tur, "dur");
});

const CAPALAR = [...tumCapalar(), BANK_CAPASI];
const eylemlerBank = () => nesneEylemleri(BANK_NESNESI, { capalar: CAPALAR, oyuncu: { x: BANK_CAPASI.durak.x, z: BANK_CAPASI.durak.z } });

test("nesne (bank): 'Orion ▸ …', 'Ben ▸ …', Özellikler…, Seçimi kaldır", () => {
  const m = menu({ tur: "nesne", ad: "bank", eylemler: eylemlerBank() });
  assert.deepEqual(adlar(m).filter((a) => a !== "—"), ["Orion", "Ben", "Özellikler…", "Seçimi kaldır"]);
  assert.ok(adlar(altOgeleri(m, "Orion")).includes("Otur"));
  assert.ok(adlar(altOgeleri(m, "Ben")).includes("Otur"));
});

test("nesne: menüdeki Orion yaprakları söz sözlüğünün görünümüyle AYNI (menü ↔ söz tutarlılığı)", () => {
  const eylemler = eylemlerBank();
  const m = menu({ tur: "nesne", ad: "bank", eylemler });
  const menuKimlikleri = altOgeleri(m, "Orion").flatMap((d) => (d.tur === "eylem" ? [d.kimlik] : [])).sort();
  const soz = seciliSozOlustur("bank", eylemler).eylemler.map((e) => e.kimlik).sort();
  assert.deepEqual(menuKimlikleri, soz);
});

test("nesne: uzaktaki Ozyn için 'Ben ▸ Otur' gri ve nedenli", () => {
  const eylemler = nesneEylemleri(BANK_NESNESI, { capalar: CAPALAR, oyuncu: { x: BANK_CAPASI.konum.x + 20, z: BANK_CAPASI.konum.z } });
  const otur = altOgeleri(menu({ tur: "nesne", ad: "bank", eylemler }), "Ben").find((d) => d.tur === "eylem" && d.ad === "Otur");
  assert.ok(otur?.tur === "eylem" && !otur.uygun && /yaklaş/.test(otur.neden ?? ""));
});

test("katkı kimlikleri menüde çakışmaz: üç hedef de hatasız kurulur", () => {
  assert.doesNotThrow(() => { menu({ tur: "zemin", nokta: { x: 0, y: 0, z: 0 }, alan }); menu({ tur: "orion", orion }); menu({ tur: "nesne", ad: "bank", eylemler: eylemlerBank() }); });
});
