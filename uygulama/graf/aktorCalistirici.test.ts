// uygulama/graf/aktorCalistirici.test.ts — aktör grafı ▶/■ (spec 43 A3): aktör başına tek çalışma, toplam tavan, `@bu` bağlamı, bitince geri alma, ▶ tek yerden.
//
// Asılı kalabilecek her test zaman aşımlıdır (bozulan ■ kırmızı yanmak yerine sonsuza dek beklerdi; dilim 0 dersi).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { grafDogrula, type Graf, type GrafBagi, type GrafDugumu } from "../../protocol/graf.ts";
import { NESNELER } from "../../world/level/nesneKaydi.ts";
import { tumCapalar } from "../../world/level/capalar.ts";
import { grafYetenegiKur, type AktorYetenegi, type GrafYetenegi } from "./grafYetenegi.ts";
import { grafKutuphanesi } from "./kutuphane.ts";
import { aktorCalistiriciKur, AKTOR_CALISMA_TAVANI } from "./aktorCalistirici.ts";
import { AKTOR_DUGUMU } from "./aktorDugumleri.ts";

const ZAMAN = { timeout: 3000 };

const graf = (ad: string, dugumler: GrafDugumu[], baglar: [string, string, string, string][]): Graf => {
  const r = grafDogrula({ surum: 1, ad, tur: "olay", dugumler, baglar: baglar.map(([a, b, c, d]): GrafBagi => ({ kaynak: [a, b], hedef: [c, d] })) });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
};
/** Başla → şiddeti 0.1 yap → (ms kadar bekle) → menzili 2 yap. Bekleme ■ testi için uzun tutulur. */
const kisici = (ad: string, ms: number): Graf => graf(ad, [
  { id: "b", tip: "olay.basla" },
  { id: "w1", tip: AKTOR_DUGUMU.yaz, ayar: { alan: "siddet", deger: 0.1 } },
  { id: "bk", tip: "akis.bekle", ayar: { ms } },
  { id: "w2", tip: AKTOR_DUGUMU.yaz, ayar: { alan: "menzil", deger: 2 } },
], [["b", "sonra", "w1", "giris"], ["w1", "sonra", "bk", "giris"], ["bk", "sonra", "w2", "giris"]]);

function kur(graflar: Graf[], ek: { tavan?: number } = {}) {
  const aktorler: Record<string, { siddet: number; menzil: number }> = { i1: { siddet: 1.5, menzil: 8 }, i2: { siddet: 1.5, menzil: 8 }, i3: { siddet: 1.5, menzil: 8 } };
  const geriAlinan: string[] = [];
  const gunluk: string[] = [];
  const yetenek: AktorYetenegi = {
    var: (id) => aktorler[id] !== undefined,
    alanOku: (id, alan) => aktorler[id]![alan as "siddet" | "menzil"],
    alanYaz: (id, alan, d) => { aktorler[id]![alan as "siddet" | "menzil"] = d as number; },
    degiskenOku: () => undefined, degiskenYaz: () => {},
  };
  const dunya: GrafYetenegi = grafYetenegiKur({ ajanlar: () => [], kapi: () => null, nesneler: () => NESNELER, capalar: () => tumCapalar(), aktor: yetenek });
  const c = aktorCalistiriciKur({
    tabani: {
      kayit: grafKutuphanesi(), depo: { al: (ad) => graflar.find((g) => g.ad === ad) ?? null, desen: () => null },
      yetenek: dunya, ajanlar: () => [], gunluk: (_s, m) => { gunluk.push(m); },
    },
    geriAl: (id) => { geriAlinan.push(id); aktorler[id] = { siddet: 1.5, menzil: 8 }; },
    var: (id) => aktorler[id] !== undefined,
    ...(ek.tavan ? { tavan: ek.tavan } : {}),
  });
  return { c, aktorler, geriAlinan, gunluk };
}

test("▶: graf @bu aktörünü sürer; bitince geri alınır, son sonuç 'bitti' ve diğer aktöre dokunulmaz", ZAMAN, async () => {
  const { c, aktorler, geriAlinan } = kur([kisici("kis", 0)]);
  assert.deepEqual(c.calistir("i1", "kis"), { ok: true });
  await c.bitti();
  assert.equal(c.son("i1")?.durum, "bitti");
  assert.deepEqual(geriAlinan, ["i1"], "çalışma bitince geri alma çağrılır");
  assert.deepEqual(aktorler["i1"], { siddet: 1.5, menzil: 8 }, "geri alındı");
  assert.deepEqual(aktorler["i2"], { siddet: 1.5, menzil: 8 }, "başka aktör dokunulmadı");
  assert.equal(c.sayi(), 0);
});

test("çalışırken aktör yazılmış durumdadır (@bu doğru aktöre bağlanır) ve ■ bekleyen çalışmayı keser, yine geri alır", ZAMAN, async () => {
  const { c, aktorler, geriAlinan } = kur([kisici("kis", 10_000)]);
  assert.deepEqual(c.calistir("i2", "kis"), { ok: true });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(aktorler["i2"]!.siddet, 0.1, "i2 kısıldı");
  assert.equal(aktorler["i1"]!.siddet, 1.5);
  assert.equal(c.calisiyor("i2")?.graf, "kis");
  assert.equal(c.durdur("i2"), true);
  await c.bitti();
  assert.equal(c.son("i2")?.durum, "durdu");
  assert.deepEqual(geriAlinan, ["i2"]);
  assert.equal(aktorler["i2"]!.siddet, 1.5, "durdurulunca eski hâle döndü");
  assert.equal(c.durdur("i2"), false, "çalışma yokken ■ false");
});

test("aktör başına tek çalışma, toplam tavan, olmayan aktör/graf nedenle reddedilir", ZAMAN, async () => {
  const { c } = kur([kisici("kis", 10_000)], { tavan: 2 });
  assert.deepEqual(c.calistir("i1", "kis"), { ok: true });
  const ikinci = c.calistir("i1", "kis");
  assert.ok(!ikinci.ok && /zaten/.test(ikinci.neden), "aynı aktör ikinci kez");
  assert.deepEqual(c.calistir("i2", "kis"), { ok: true });
  const tavan = c.calistir("i3", "kis");
  assert.ok(!tavan.ok && /en çok 2/.test(tavan.neden), "tavan aşıldı");
  const yokAktor = c.calistir("hayalet", "kis");
  assert.ok(!yokAktor.ok && /level'da yok/.test(yokAktor.neden));
  const yokGraf = c.calistir("i3", "yok");
  assert.ok(!yokGraf.ok && /yüklenemedi/.test(yokGraf.neden));
  assert.equal(c.durdurHepsi(), 2);
  await c.bitti();
  assert.equal(c.sayi(), 0);
  assert.equal(AKTOR_CALISMA_TAVANI, 4, "ürün tavanı sabit 4 (ölçümsüz oynamasın)");
});

test("desen (fonksiyon grafı) tek başına çalıştırılmaz: nedenle reddedilir", ZAMAN, () => {
  const r = grafDogrula({ surum: 1, ad: "des", tur: "fonksiyon", girisler: [], cikislar: [], dugumler: [{ id: "g", tip: "fonksiyon.giris" }], baglar: [] });
  if (!r.ok) throw new Error(r.hata);
  const { c } = kur([r.deger]);
  const s = c.calistir("i1", "des");
  assert.ok(!s.ok && /desen/.test(s.neden), s.ok ? "kabul edildi" : s.neden);
  assert.equal(c.sayi(), 0);
});

test("hata: graf düğümü düşerse son sonuç 'hata', nedeni satırda, yine geri alır", ZAMAN, async () => {
  const bozuk = graf("bozuk", [{ id: "b", tip: "olay.basla" }, { id: "w", tip: AKTOR_DUGUMU.yaz, ayar: { aktor: "hayalet", alan: "siddet", deger: 1 } }], [["b", "sonra", "w", "giris"]]);
  const { c, geriAlinan, gunluk } = kur([bozuk]);
  assert.deepEqual(c.calistir("i1", "bozuk"), { ok: true });
  await c.bitti();
  assert.equal(c.son("i1")?.durum, "hata");
  assert.match(c.son("i1")?.hata ?? "", /'hayalet' level'da yok/);
  assert.deepEqual(geriAlinan, ["i1"]);
  assert.ok(gunluk.some((m) => /✗ bozuk/.test(m) && /aktör i1/.test(m)), "günlükte hata satırı aktörle");
});

test("dinleyici her değişimde çağrılır; aboneliği bırakınca susar", ZAMAN, async () => {
  const { c } = kur([kisici("kis", 0)]);
  let n = 0;
  const birak = c.dinle(() => { n++; });
  c.calistir("i1", "kis");
  await c.bitti();
  assert.ok(n >= 2, `başlama ve bitiş bildirimi (n=${n})`);
  birak();
  const once = n;
  c.calistir("i1", "kis");
  await c.bitti();
  assert.equal(n, once);
});

// ── bekçi: ▶ yalnız Ozyn'in gerçek tıklamasından ──
test("▶ TEK YERDEN: aktör grafı yalnız Details ▶'sında (isTrusted korumalı) ve senaryo yüzünde çalıştırılır", () => {
  const kok = path.resolve(import.meta.dirname, "..", "..");
  const tara = (klasor: string): string[] => fs.readdirSync(path.join(kok, klasor), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tara(path.join(klasor, e.name)) : /\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [path.join(klasor, e.name).split(path.sep).join("/")] : []);
  const uretim = ["uygulama", "bridge", "mind", "flash", "world", "voice", "protocol"].flatMap(tara);
  const desen = /aktorCalistirici(?:\(\))?[!?]?\.calistir\(/;
  const oku = (d: string): string => fs.readFileSync(path.join(kok, d), "utf8");
  const cagiranlar = uretim.filter((d) => desen.test(oku(d)));
  assert.deepEqual(cagiranlar, ["uygulama/giris.ts", "uygulama/levelBaglantisi.ts"]);
  const bag = oku("uygulama/levelBaglantisi.ts");
  const i = bag.search(desen);
  assert.ok(/isTrusted/.test(bag.slice(Math.max(0, i - 400), i)), "Details ▶: çağrının hemen öncesinde isTrusted denetimi olmalı");
  const gir = oku("uygulama/giris.ts");
  const j = gir.search(desen);
  assert.ok(/aktorGraf:/.test(gir.slice(Math.max(0, j - 200), j)), "giris.ts'teki tek çağrı `aktorGraf` senaryo yüzünde olmalı");
  assert.equal(gir.match(new RegExp(desen.source, "g"))?.length, 1, "giris.ts'te ikinci bir çağrı yok");
  const arka = uretim.filter((d) => /^(bridge|mind|flash)\//.test(d) && /aktorCalistirici|aktorYetenegi/.test(oku(d)));
  assert.deepEqual(arka, [], "arka katmanlar aktör çalıştırıcısına dokunmaz");
});
