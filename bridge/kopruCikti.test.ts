// bridge/kopruCikti.test.ts — köprüden ayrılan çıktı işleme (kopruCikti.ts) ve hafıza getirmesi (kopruGetirme.ts) için bozma denemesinin açığa çıkardığı gözlemler:
// sayaçlar (niyet, kurtarılan çağrı, yutulan çöp), ardışık ret kalkanının sıfırlanması ve çekmece getirmesinde tekrar eden anının bir kez gelmesi.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi, AracCagrisi } from "./beyin.ts";
import type { Niyet } from "../protocol/niyet.ts";
import { Hafiza } from "../mind/hafiza.ts";
import { istenenAnilar } from "./kopruGetirme.ts";

class SahteBeyin implements Beyin {
  readonly ad = "sahte";
  gordugu: BeyinGirdisi[] = [];
  cevaplar: BeyinCikti[];
  constructor(...cevaplar: BeyinCikti[]) { this.cevaplar = cevaplar; }
  async hazirMi() { return true; }
  async dusun(g: BeyinGirdisi): Promise<BeyinCikti> {
    this.gordugu.push(structuredClone(g));
    return this.cevaplar.shift() ?? { metin: "", cagrilar: [] };
  }
}
const cagri = (ad: string, girdi: unknown): AracCagrisi => ({ ad, girdi });
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
function kur(beyin: Beyin) {
  const niyetler: { n: Niyet; id: string }[] = [];
  const soylenen: string[] = [];
  const k = new Kopru({ komutYetkisi: false, beyin, niyetGonder: (n, id) => niyetler.push({ n, id }), dunyaDurumu: () => "oda", toplamaMs: 5 });
  k.konusmaDinle((m) => soylenen.push(m));
  return { k, niyetler, soylenen };
}

test("geçerli araç çağrısı niyet sayacını artırır (her gönderilen niyet bir kez)", async () => {
  const { k, niyetler } = kur(new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_bak", { hedef_tip: "oyuncu" }), cagri("dunya_bak", { hedef_tip: "oyuncu" })] }));
  k.algi({ tur: "duydum", metin: "bak", kesin: true });
  await bekle(80);
  assert.equal(niyetler.length, 1, "beden niyetleri sırayla gider: ikincisi ilkinin `bitti`sini bekler");
  assert.equal(k.sayac().niyet, 2, "sayaç işlenen niyetleri sayar (sıradakiler dahil)");
});

test("metinden kurtarılan araç çağrısı sayılır ve çöp seslendirilmez", async () => {
  const { k, niyetler, soylenen } = kur(new SahteBeyin({ metin: 'orld {"name": "dunya_bak", "arguments": {"hedef_tip": "oyuncu"}}', cagrilar: [] }));
  k.algi({ tur: "duydum", metin: "bak", kesin: true });
  await bekle(80);
  assert.equal(k.sayac().kurtarilanCagri, 1);
  assert.equal(niyetler.length, 1);
  assert.deepEqual(soylenen, [], "JSON çöpü konuşulmadı");
});

test("kurtarılamayan araç çöpü yutulur ve sayılır (duyulmaz)", async () => {
  const { k, niyetler, soylenen } = kur(new SahteBeyin({ metin: '{"name": "dunya_ucmak", "arguments": {}}', cagrilar: [] }));
  k.algi({ tur: "duydum", metin: "uç", kesin: true });
  await bekle(80);
  assert.equal(k.sayac().yutulanCop, 1);
  assert.equal(niyetler.length, 0);
  assert.deepEqual(soylenen, []);
});

test("ardışık ret kalkanı: geçerli bir çağrı sayacı SIFIRLAR (ret–ret–[geçerli+ret]–… döngüsü erken kesilmez)", async () => {
  const gecersiz = cagri("dunya_poz", { poz: "zıplıyor" });
  const gecerli = cagri("dunya_bak", { hedef_tip: "oyuncu" });
  const b = new SahteBeyin(
    { metin: "", cagrilar: [gecersiz] },            // tur 1: ret → sayaç 1
    { metin: "", cagrilar: [gecersiz] },            // tur 2: ret → sayaç 2
    { metin: "", cagrilar: [gecerli, gecersiz] },   // tur 3: geçerli (sayaç 0) + ret (sayaç 1) → 4. tur hâlâ açık
    { metin: "", cagrilar: [] },                    // tur 4
  );
  const { k } = kur(b);
  k.algi({ tur: "duydum", metin: "dene", kesin: true });
  await bekle(200);
  assert.equal(b.gordugu.length, 4, "geçerli çağrı sayacı sıfırlamazsa döngü 3. turda kesilirdi");
});

test("istenenAnilar: aynı anı iki çekmece isteğinden gelirse BİR kez döner", () => {
  const h = new Hafiza({});
  h.ekle("Ozyn kahve sever", "konusma", 0.9);
  h.ekle("Ozyn çay sevmez", "konusma", 0.9);
  const sonuc = istenenAnilar(h, [
    { mod: "son", cekmeceler: ["konusma"], adet: 5 },
    { mod: "son", cekmeceler: ["konusma"], adet: 5 },
  ], [], []);
  const metinler = sonuc.map((x) => x.ani.metin);
  assert.equal(metinler.length, new Set(metinler).size, `tekrar var: ${metinler.join(" | ")}`);
  assert.equal(metinler.length, 2);
});
