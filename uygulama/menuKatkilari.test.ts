// uygulama/menuKatkilari.test.ts — sağ tık menüsünün katkıları: hedefe göre yol, gri+neden, Orion yaprakları söz sözlüğüyle tutarlı.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { menuKur, type MenuDugumu } from "../world/arayuz/menu/menuModeli.ts";
import { sikistirmaIstegi } from "../mind/sikistir.ts";
import { MENU_KATKILARI, SIKISTIR_KOMUTU, type HedefMenuBaglami, type MenuEylemi, type MenuHedefi } from "./menuKatkilari.ts";
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

test("zemin: 'Orion ▸ Buraya ▸ Git/Bak' + Özellikler…; nesneye özgü 'Seçimi kaldır' YOK", () => {
  const m = menu({ tur: "zemin", nokta: { x: 1, y: 0, z: 2 }, alan });
  assert.deepEqual(adlar(m), ["Orion", "—", "Sohbet", "—", "Özellikler…"]);
  assert.deepEqual(adlar(altOgeleri(altOgeleri(m, "Orion"), "Buraya")), ["Git", "Bak"]);
});

test("zemin: engel içindeki noktada 'Git' gri ve NEDENLİ, 'Bak' uygun", () => {
  const alt = altOgeleri(altOgeleri(menu({ tur: "zemin", nokta: { x: 5, y: 0, z: 5 }, alan }), "Orion"), "Buraya");
  const git = alt.find((d) => d.tur === "eylem" && d.ad === "Git");
  assert.ok(git?.tur === "eylem" && !git.uygun && /engel/.test(git.neden ?? ""));
  assert.equal(alt.find((d) => d.tur === "eylem" && d.ad === "Bak")?.tur === "eylem", true);
});

test("Orion: komutlar doğrudan listede; ayakta iken 'Kalk' yok, oturuyorsa var", () => {
  assert.deepEqual(adlar(menu({ tur: "orion", orion })).filter((a) => a !== "—"), ["Yanıma gel", "Bana bak", "El salla", "Dur", "Sohbet", "Özellikler…"]);
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
  assert.deepEqual(adlar(m).filter((a) => a !== "—"), ["Orion", "Ben", "Sohbet", "Özellikler…", "Seçimi kaldır"]);
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

test("Sohbet ▸ Sıkıştır HER hedefte var; yükü köprünün tanıdığı '/compact' sözü", () => {
  const hedefler: MenuHedefi[] = [{ tur: "zemin", nokta: { x: 0, y: 0, z: 0 }, alan }, { tur: "orion", orion }, { tur: "nesne", ad: "bank", eylemler: eylemlerBank() }];
  for (const h of hedefler) {
    const y = altOgeleri(menu(h), "Sohbet")[0];
    assert.ok(y?.tur === "eylem" && y.uygun, `${h.tur}: Sohbet ▸ Sıkıştır yok`);
    assert.deepEqual((y as Extract<D, { tur: "eylem" }>).eylem, { tur: "soz", metin: SIKISTIR_KOMUTU });
  }
});

test("menünün '/compact' sözü köprünün sıkıştırma içgüdüsünce TANINIR (söz ayrışırsa kırılır)", () => {
  assert.equal(sikistirmaIstegi(SIKISTIR_KOMUTU), true);
});

// ── asset yerleştirme menüsü (spec 30) ──
import { MENU_AYARI } from "./menuKatkilari.ts";
const GRUPLAR = [{ ad: "binalar", ogeler: [{ varlik: "B1", ad: "Kule" }, { varlik: "B2", ad: "Ev" }] }, { ad: "eşya", ogeler: [{ varlik: "E1", ad: "Bank" }] }];
const zeminMenu = (y: { gruplar: typeof GRUPLAR | null; pano: { ad: string } | null }): D[] =>
  menuKur<HedefMenuBaglami, MenuEylemi>({ hedef: { tur: "zemin", nokta: { x: 1, y: 0, z: 2 }, alan, yerlestirme: y } }, MENU_KATKILARI, MENU_AYARI);
const bos = { gruplar: GRUPLAR, pano: null };

test("asset: zemin menüsünde Asset ▸ Kategori ▸ Ad ▸ Yerleştir | Çağır", () => {
  const m = zeminMenu(bos);
  const asset = altOgeleri(m, "Asset");
  assert.deepEqual(adlar(asset), ["binalar", "eşya"]);
  assert.deepEqual(adlar(altOgeleri(asset, "binalar")), ["Ev", "Kule"]);   // ada göre Türkçe sıralı
  assert.deepEqual(adlar(altOgeleri(altOgeleri(asset, "binalar"), "Kule")), ["Yerleştir", "Çağır"]);
});

test("asset: Yerleştir (hemen koy) ve Çağır (imleçle taşı, tıklayınca koy) yükleri varlığı taşır", () => {
  const kule = altOgeleri(altOgeleri(altOgeleri(zeminMenu(bos), "Asset"), "binalar"), "Kule");
  assert.deepEqual((yaprak(kule, "Yerleştir")).eylem, { tur: "yerlestir", varlik: "B1" });
  assert.deepEqual((yaprak(kule, "Çağır")).eylem, { tur: "cagir", varlik: "B1" });
});

test("asset: katalog yüklenmediyse tek gri 'Asset (yükleniyor…)' satırı", () => {
  const m = zeminMenu({ ...bos, gruplar: null });
  const y = yaprak(m, "Asset (yükleniyor…)");
  assert.equal(y.uygun, false);
  assert.match(y.neden!, /yüklenmedi/);
});

test("asset: uzun listede 'Diğer ▸' YOK (sınırsız kök); 40 kategori × öğe de tam görünür", () => {
  const cok = Array.from({ length: 40 }, (_, i) => ({ ad: `k${String(i).padStart(2, "0")}`, ogeler: [{ varlik: `V${i}`, ad: `Ad${i}` }] }));
  const asset = altOgeleri(zeminMenu({ ...bos, gruplar: cok as unknown as typeof GRUPLAR }), "Asset");
  assert.equal(asset.length, 40);
  assert.equal(adlar(asset).includes("Diğer"), false);
});

test("yapıştır: pano boşken gri ve nedenli; doluyken adıyla uygun", () => {
  const bosPano = yaprak(zeminMenu(bos), "Yapıştır");
  assert.equal(bosPano.uygun, false);
  assert.match(bosPano.neden!, /Kopyala/);
  const dolu = yaprak(zeminMenu({ ...bos, pano: { ad: "Bank" } }), "Yapıştır (Bank)");
  assert.deepEqual([dolu.uygun, dolu.eylem], [true, { tur: "yapistir" }]);
});

test("asset menüsü yalnız ZEMİNDE: Orion ve nesne menüsünde Asset yok", () => {
  assert.equal(adlar(menu({ tur: "orion", orion })).includes("Asset"), false);
  assert.equal(adlar(menu({ tur: "nesne", ad: "bank", eylemler: eylemlerBank() })).includes("Asset"), false);
});

test("nesne: Kopyala / Düzenle ▸ (Taşı, Döndür, Ölçekle, Bitir) / Kaldır düzenleme bilgisine göre; gri ise nedenli", () => {
  const duzenleme = { id: "n1", kopyalanabilir: { uygun: true }, duzenlenebilir: { uygun: true }, kaldirilabilir: { uygun: false, neden: "level dosyasındaki nesne" } };
  const m = menuKur<HedefMenuBaglami, MenuEylemi>({ hedef: { tur: "nesne", ad: "bank", eylemler: eylemlerBank(), duzenleme } }, MENU_KATKILARI, MENU_AYARI);
  assert.deepEqual(yaprak(m, "Kopyala").eylem, { tur: "kopyala", id: "n1" });
  const duzenle = altOgeleri(m, "Düzenle");
  assert.deepEqual(adlar(duzenle), ["Taşı (oklar)", "Döndür (halkalar)", "Ölçekle (kutular)", "Düzenlemeyi bitir"]);
  assert.deepEqual(yaprak(duzenle, "Taşı (oklar)").eylem, { tur: "duzenle", id: "n1", arac: "tasi" });
  assert.deepEqual(yaprak(duzenle, "Döndür (halkalar)").eylem, { tur: "duzenle", id: "n1", arac: "dondur" });
  assert.deepEqual(yaprak(duzenle, "Ölçekle (kutular)").eylem, { tur: "duzenle", id: "n1", arac: "olcek" });
  assert.deepEqual(yaprak(duzenle, "Düzenlemeyi bitir").eylem, { tur: "duzenleBitir" });
  const kaldir = yaprak(m, "Kaldır");
  assert.deepEqual([kaldir.uygun, kaldir.neden], [false, "level dosyasındaki nesne"]);
});

test("nesne: düzenleme bilgisi verilmezse Kopyala/Düzenle/Kaldır hiç görünmez (eski davranış)", () => {
  const a = adlar(menu({ tur: "nesne", ad: "bank", eylemler: eylemlerBank() }));
  assert.ok(!a.includes("Kopyala") && !a.includes("Düzenle") && !a.includes("Kaldır"));
});

test("nesne: düzenlenemeyen nesnede (ofis eşyası) Düzenle altındaki üç araç gri ve nedenli, 'bitir' hep açık", () => {
  const neden = "level nesnesi değil";
  const duzenleme = { id: "masa", kopyalanabilir: { uygun: false, neden }, duzenlenebilir: { uygun: false, neden }, kaldirilabilir: { uygun: false, neden } };
  const m = menuKur<HedefMenuBaglami, MenuEylemi>({ hedef: { tur: "nesne", ad: "masa", eylemler: eylemlerBank(), duzenleme } }, MENU_KATKILARI, MENU_AYARI);
  const duzenle = altOgeleri(m, "Düzenle");
  assert.deepEqual(["Taşı (oklar)", "Döndür (halkalar)", "Ölçekle (kutular)"].map((a) => [yaprak(duzenle, a).uygun, yaprak(duzenle, a).neden]), [[false, neden], [false, neden], [false, neden]]);
  assert.equal(yaprak(duzenle, "Düzenlemeyi bitir").uygun, true);
});

test("zemin menüsü sırası: Orion | Asset ve düzenleme | Sohbet | Özellikler", () => {
  const a = adlar(zeminMenu({ ...bos, pano: { ad: "Bank" } })).filter((x) => x !== "—");
  assert.deepEqual(a, ["Orion", "Asset", "Yapıştır (Bank)", "Sohbet", "Özellikler…"]);
});
