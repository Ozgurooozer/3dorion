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
  assert.deepEqual(a, ["Orion", "Asset", "Yapıştır (Bank)", "Kopyalanamayanlar (ağaç, kaya, çim…)", "Sohbet", "Özellikler…"]);
});

test("dosya (Hafıza sekmesi): Düzenle… | Bağlama ekle | İçeriği kopyala, Adı kopyala; zemin/nesne öğeleri YOK", () => {
  const m = menu({ tur: "dosya", dosya: { ad: "persona.md", aktif: false, sistem: false } });
  assert.deepEqual(adlar(m), ["Düzenle…", "—", "Bağlama ekle", "—", "İçeriği kopyala", "Adı kopyala"]);
  assert.deepEqual(yaprak(m, "Düzenle…").eylem, { tur: "mdAc", ad: "persona.md" });
  assert.deepEqual(yaprak(m, "Bağlama ekle").eylem, { tur: "mdAktif", ad: "persona.md", aktif: true });
  assert.deepEqual(yaprak(m, "İçeriği kopyala").eylem, { tur: "mdKopyala", ad: "persona.md" });
  assert.deepEqual(yaprak(m, "Adı kopyala").eylem, { tur: "mdAdKopyala", ad: "persona.md" });
});

test("dosya: aktifse öğe 'Bağlamdan çıkar' olur ve yükü aktif=false'tur (aynı kimlik, ad değişir)", () => {
  const m = menu({ tur: "dosya", dosya: { ad: "anlik-hafiza.md", aktif: true, sistem: true } });
  assert.deepEqual(yaprak(m, "Bağlamdan çıkar").eylem, { tur: "mdAktif", ad: "anlik-hafiza.md", aktif: false });
  assert.equal(m.some((d) => d.tur === "eylem" && d.ad === "Bağlama ekle"), false);
});

test("dosya menüsünde Sohbet ▸ Sıkıştır ve Özellikler… YOK (anlamsız); öteki hedeflerde kalır", () => {
  const m = adlar(menu({ tur: "dosya", dosya: { ad: "a.md", aktif: false, sistem: false } }));
  assert.equal(m.includes("Sohbet"), false);
  assert.equal(m.includes("Özellikler…"), false);
  assert.ok(adlar(menu({ tur: "orion", orion })).includes("Sohbet"));
});

test("zemin: 'Kopyalanamayanlar' satırı GRİ ve nedeni dekor olduğunu söyler (sessiz kalmaz)", () => {
  const o = yaprak(zeminMenu({ ...bos, pano: null }), "Kopyalanamayanlar (ağaç, kaya, çim…)");
  assert.equal(o.uygun, false);
  assert.match(o.neden ?? "", /ağaç.*dekor/);
});

// ── Ajan (Flash) menüsü: Orion dışındaki bedene sağ tık ──
const flashMenu = (oturuyor: boolean) => menu({ tur: "ajan", ajan: { id: "flash", ad: "Flash", oturuyor } });

test("ajan: ayaktayken Otur çıkar, Kalk ÇIKMAZ; komutlar sırayla, Özellikler en sonda", () => {
  assert.deepEqual(adlar(flashMenu(false)), ["Otur", "Bana gel", "Beni takip et", "Takibi bırak", "Pencereye bak", "—", "Özellikler…"]);
});

test("ajan: otururken Kalk çıkar, Otur ÇIKMAZ", () => {
  const a = adlar(flashMenu(true));
  assert.deepEqual([a.includes("Kalk"), a.includes("Otur")], [true, false]);
});

test("ajan: her komut O ajana giden söz olur (kimlik taşır, komut sözlüğünün kalıbıyla aynı)", () => {
  assert.deepEqual(yaprak(flashMenu(false), "Bana gel").eylem, { tur: "ajanSoz", ajan: "flash", metin: "bana gel" });
  assert.deepEqual(yaprak(flashMenu(false), "Beni takip et").eylem, { tur: "ajanSoz", ajan: "flash", metin: "beni takip et" });
});

test("ajan menüsünde Orion'a özgü öğeler YOK (Sohbet ▸ Sıkıştır, Asset, Düzenle)", () => {
  const a = adlar(flashMenu(false));
  assert.deepEqual([a.includes("Sohbet"), a.includes("Asset"), a.includes("Düzenle")], [false, false, false]);
});

test("BEKÇİ: ajan menüsündeki her söz gerçekten tanınır (komut sözlüğü ya da takip sözü); menü yalan söylemez", async () => {
  const { komutCoz } = await import("../mind/komutSozlugu.ts");
  const { takipEylemi } = await import("../mind/takipSozu.ts");
  const tanimayan: string[] = [];
  for (const oturuyor of [false, true]) {
    for (const d of flashMenu(oturuyor)) {
      if (d.tur !== "eylem" || d.eylem.tur !== "ajanSoz") continue;
      const soz = d.eylem.metin;
      if (komutCoz(soz) === null && takipEylemi(soz) === null) tanimayan.push(soz);
    }
  }
  assert.deepEqual(tanimayan, []);
});

// ── "Flash ▸ …" girişleri: zemin ve nesne menüleri yalnız Orion'u tanımıyor (Ozyn, 2026-10-21: "sağ tık menüsünü de unutmuşsun") ──
const FLASH = [{ id: "flash", ad: "Flash" }];
const zeminAjanli = (ajanlar?: typeof FLASH): D[] =>
  menuKur<HedefMenuBaglami, MenuEylemi>({ hedef: { tur: "zemin", nokta: { x: 1, y: 0, z: 2 }, alan, ...(ajanlar ? { ajanlar } : {}) } }, MENU_KATKILARI, MENU_AYARI);

test("zemin: bedenli ajan varken 'Flash ▸ Buraya ▸ Git | Bak' çıkar (Orion'unkiyle aynı eylem verisi, eylem Flash'a gider)", () => {
  const buraya = altOgeleri(altOgeleri(zeminAjanli(FLASH), "Flash"), "Buraya");
  assert.deepEqual(buraya.map((d) => (d.tur === "ayrac" ? "—" : d.ad)), ["Git", "Bak"]);
  const git = buraya.find((d) => d.tur === "eylem" && d.ad === "Git") as Extract<D, { tur: "eylem" }>;
  assert.deepEqual([git.eylem.tur, git.eylem.tur === "ajanEylem" ? git.eylem.ajan : null, git.eylem.tur === "ajanEylem" ? git.eylem.eylem.niyet?.tur : null], ["ajanEylem", "flash", "git"]);
});

test("zemin: ajan YOKSA (ya da boş liste) menü eskisiyle AYNI: 'Flash' girişi yok", () => {
  assert.equal(adlar(zeminAjanli()).includes("Flash"), false);
  assert.equal(adlar(zeminAjanli([])).includes("Flash"), false);
});

test("zemin: Orion'un girişi duruyor, Flash'ınki onun YANINDA (ikisi de ayrı)", () => {
  const a = adlar(zeminAjanli(FLASH));
  assert.deepEqual([a.includes("Orion"), a.includes("Flash")], [true, true]);
});

test("zemin: yürünemez noktada Flash'ın 'Git'i de GRİ ve nedeni Orion'unkiyle aynı (engel)", () => {
  const engelli = menuKur<HedefMenuBaglami, MenuEylemi>({ hedef: { tur: "zemin", nokta: { x: 5, y: 0, z: 5 }, alan, ajanlar: FLASH } }, MENU_KATKILARI, MENU_AYARI);
  const git = altOgeleri(altOgeleri(engelli, "Flash"), "Buraya").find((d) => d.tur === "eylem" && d.ad === "Git") as Extract<D, { tur: "eylem" }>;
  assert.deepEqual([git.uygun, /engel/.test(git.neden ?? "")], [false, true]);
});

test("nesne: 'Flash ▸ …' girişleri Orion'un eylemleriyle AYNI adlarda çıkar ve Flash'a gider", () => {
  const eylemler = eylemlerBank();
  const m = menu({ tur: "nesne", ad: "bank", eylemler, ajanlar: FLASH });
  const orionAdlari = altOgeleri(m, "Orion").map((d) => (d.tur === "ayrac" ? "—" : d.ad));
  const flashAdlari = altOgeleri(m, "Flash").map((d) => (d.tur === "ayrac" ? "—" : d.ad));
  assert.deepEqual(flashAdlari, orionAdlari);
  const ilk = altOgeleri(m, "Flash").find((d) => d.tur === "eylem") as Extract<D, { tur: "eylem" }>;
  assert.deepEqual([ilk.eylem.tur, ilk.eylem.tur === "ajanEylem" ? ilk.eylem.ajan : null], ["ajanEylem", "flash"]);
});

test("nesne: ajan yoksa 'Flash' alt menüsü YOK (eski menü bozulmaz)", () => {
  assert.equal(adlar(menu({ tur: "nesne", ad: "bank", eylemler: eylemlerBank() })).includes("Flash"), false);
});
