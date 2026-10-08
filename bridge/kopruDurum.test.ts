// bridge/kopruDurum.test.ts — Köprünün durum defterine NE yazdığı (spec 16 F2).
//
// Defterin kendisi mind/durumDefteri.test.ts'te; burada köprünün olaylardan defteri doğru beslediği:
// iş niyeti → "yapıyor", sonucu → "son iş", Ozyn'in sözü, Orion'un sözü, ve kalıcılık.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi, AracCagrisi } from "./beyin.ts";
import type { Niyet } from "../protocol/niyet.ts";

class SahteBeyin implements Beyin {
  readonly ad = "sahte";
  cevaplar: BeyinCikti[];
  constructor(...cevaplar: BeyinCikti[]) { this.cevaplar = cevaplar; }
  async hazirMi() { return true; }
  async dusun(_g: BeyinGirdisi): Promise<BeyinCikti> { return this.cevaplar.shift() ?? { metin: "", cagrilar: [] }; }
}
const cagri = (ad: string, girdi: unknown): AracCagrisi => ({ ad, girdi });
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

function kur(beyin: Beyin, ek: Record<string, unknown> = {}) {
  const niyetler: { n: Niyet; id: string }[] = [];
  const k = new Kopru({ komutYetkisi: false, beyin, niyetGonder: (n, id) => niyetler.push({ n, id }),
    dunyaDurumu: () => "oda", toplamaMs: 5, hafizaGetirme: 0, ...ek });
  return { k, niyetler };
}

test("iş niyeti gidince 'yapıyor' yazılır", async () => {
  const { k } = kur(new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_git", { hedef: { tip: "capa", ad: "tahta" } })] }));
  k.algi({ tur: "duydum", metin: "tahtaya git", kesin: true });
  await bekle(30);
  assert.equal(k.durum.oku("yapiyor")?.deger, "git → tahta");
});

test("iş bitince 'son iş' sonucuyla yazılır ve 'yapıyor' düşer", async () => {
  const { k, niyetler } = kur(new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_otur", {})] }));
  k.algi({ tur: "duydum", metin: "otur", kesin: true });
  await bekle(30);
  k.sonuc({ niyet_id: niyetler.find((x) => x.n.tur === "otur")!.id, durum: "bitti" });
  assert.deepEqual([k.durum.oku("yapiyor"), k.durum.oku("son_is")?.deger], [undefined, "otur → done"]);
});

test("başarısız iş nedeniyle yazılır", async () => {
  const { k, niyetler } = kur(new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_otur", {})] }));
  k.algi({ tur: "duydum", metin: "otur", kesin: true });
  await bekle(30);
  k.sonuc({ niyet_id: niyetler.find((x) => x.n.tur === "otur")!.id, durum: "hata", not: "sandalye dolu" });
  assert.equal(k.durum.oku("son_is")?.deger, "otur → hata: sandalye dolu");
});

test("bakış ve jest iş sayılmaz", async () => {
  const { k } = kur(new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_bak", { hedef: { tip: "oyuncu" } }), cagri("dunya_jest", { jest: "el_salliyor" })] }));
  k.algi({ tur: "duydum", metin: "bana bak", kesin: true });
  await bekle(30);
  assert.equal(k.durum.oku("yapiyor"), undefined);
});

test("Ozyn'in kesin sözü 'son Ozyn' olur", async () => {
  const { k } = kur(new SahteBeyin());
  k.algi({ tur: "duydum", metin: "naber", kesin: true });
  assert.equal(k.durum.oku("son_ozyn")?.deger, "naber");
});

test("ara tanıma (kesin değil) defteri değiştirmez", () => {
  const { k } = kur(new SahteBeyin());
  k.algi({ tur: "duydum", metin: "nab", kesin: false });
  assert.equal(k.durum.oku("son_ozyn"), undefined);
});

test("Orion'un sözü 'son Orion' olur", async () => {
  const { k } = kur(new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_soyle", { metin: "İyiyim." })] }));
  k.konusmaDinle(() => {});
  k.algi({ tur: "duydum", metin: "naber", kesin: true });
  await bekle(30);
  assert.equal(k.durum.oku("son_orion")?.deger, "İyiyim.");
});

test("defter depodan kurulur", () => {
  const { k } = kur(new SahteBeyin(), { durumDeposu: { oku: () => [{ anahtar: "konum", deger: "pencere", t: 1 }], yaz: () => {} } });
  assert.equal(k.durum.oku("konum")?.deger, "pencere");
});

test("okunamayan depo köprüyü durdurmaz: defter boş başlar", () => {
  const { k } = kur(new SahteBeyin(), { durumDeposu: { oku: () => { throw new Error("bozuk"); }, yaz: () => {} } });
  assert.equal(k.durum.kayitlar().length, 0);
});

test("kapanışta bekleyen defter yazımı hemen tamamlanır", () => {
  const yazilan: unknown[][] = [];
  const { k } = kur(new SahteBeyin(), { durumDeposu: { oku: () => [], yaz: (x: unknown[]) => yazilan.push(x) } });
  k.algi({ tur: "duydum", metin: "naber", kesin: true });
  k.durdur();
  assert.equal((yazilan.at(-1) as { deger: string }[] | undefined)?.find((x) => x.deger === "naber")?.deger, "naber");
});
