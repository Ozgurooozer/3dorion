// bridge/kopruSikistir.test.ts — /compact ve otomatik sıkıştırma köprüde (içgüdü `kopru.sikistir`, spec 26 F3-C).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi } from "./beyin.ts";
import { KARAR_ONEKI, KararKaydi, type AlgiSatiri, type KararSatiri } from "../mind/kararKaydi.ts";
import { SIKISTIR_SOZLERI } from "../mind/sikistir.ts";

class SahteBeyin implements Beyin {
  readonly ad = "sahte";
  gordugu: BeyinGirdisi[] = [];
  cevaplar: BeyinCikti[];
  constructor(...c: BeyinCikti[]) { this.cevaplar = c; }
  async hazirMi() { return true; }
  async dusun(g: BeyinGirdisi): Promise<BeyinCikti> { this.gordugu.push(structuredClone(g)); return this.cevaplar.shift() ?? { metin: "", cagrilar: [] }; }
}
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ESKI = Date.now() - 3 * 24 * 3600_000;
const eskiAniler = (n: number) => Array.from({ length: n }, (_, i) => ({ metin: `Ozyn said: "kayıt ${i}"`, tur: "konusma", onem: 5, olusma: ESKI + i * 1000, sonErisim: ESKI }));

function kur(beyin: SahteBeyin, n: number, yedek = true) {
  const satirlar: KararSatiri[] = [];
  const yedekler: unknown[][] = [];
  const k = new Kopru({ beyin, niyetGonder: () => {}, dunyaDurumu: () => "oda", toplamaMs: 5,
    hafizaDeposu: { oku: () => eskiAniler(n), yaz: () => {} },
    ...(yedek ? { hafizaYedegi: { yaz: (a: unknown[]) => { yedekler.push(a); } } } : {}),
    kararKaydi: new KararKaydi({ yaz: (s) => satirlar.push(JSON.parse(s.slice(KARAR_ONEKI.length + 1))) }) });
  const soylenen: string[] = [];
  k.konusmaDinle((m) => soylenen.push(m));
  const soyle = async (metin: string) => { k.algi({ tur: "duydum", metin, kesin: true }); await bekle(60); };
  return { k, soylenen, soyle, yedekler, algilar: () => satirlar.filter((s): s is AlgiSatiri => s.tur === "algi") };
}
const IYI: BeyinCikti = { metin: "FACT arac: claude\nSUMMARY: Ozyn çok komut verdi.", cagrilar: [] };

test("'/compact': eski ham kayıtlar olgu+özete iner, yedek ÖNCE alınır, Orion sabit cümleyle bildirir", async () => {
  const b = new SahteBeyin(IYI);
  const { k, soyle, yedekler, soylenen, algilar } = kur(b, 60);
  await soyle("/compact");
  assert.equal(yedekler.length, 1);
  assert.equal(yedekler[0]!.length, 60, "yedek silmeden ÖNCEKİ tam hafıza");
  assert.equal(k.hafizaGorunumu().derin.filter((a) => a.tur === "konusma").length, 30);
  assert.deepEqual(soylenen, [SIKISTIR_SOZLERI.tamam(30, 1)]);
  assert.equal(algilar().at(-1)?.kapi.kural, "kopru.sikistir");
  assert.equal(b.gordugu.length, 1, "tek model çağrısı (sohbet turu değil)");
});

test("model çöpse hiçbir şey silinmez ve yedek de alınmaz", async () => {
  const b = new SahteBeyin({ metin: "Sure, here is a summary!", cagrilar: [] });
  const { k, soyle, yedekler, soylenen } = kur(b, 60);
  await soyle("/compact");
  assert.equal(k.hafizaGorunumu().derin.length, 60);
  assert.deepEqual([yedekler.length, soylenen], [0, [SIKISTIR_SOZLERI.basarisiz]]);
});

test("model hata fırlatırsa hiçbir şey silinmez", async () => {
  const b = new SahteBeyin();
  b.dusun = async () => { throw new Error("model kapalı"); };
  const { k, soyle, soylenen } = kur(b, 60);
  await soyle("/compact");
  assert.equal(k.hafizaGorunumu().derin.length, 60);
  assert.deepEqual(soylenen, [SIKISTIR_SOZLERI.basarisiz]);
});

test("yedek yoksa sıkıştırma yapılmaz (yedeksiz silme yok) ve model çağrılmaz", async () => {
  const b = new SahteBeyin(IYI);
  const { k, soyle, soylenen } = kur(b, 60, false);
  await soyle("/compact");
  assert.deepEqual([k.hafizaGorunumu().derin.length, b.gordugu.length, soylenen], [60, 0, [SIKISTIR_SOZLERI.basarisiz]]);
});

test("sıkıştıracak kadar kayıt yoksa model çağrılmaz", async () => {
  const b = new SahteBeyin(IYI);
  const { soyle, soylenen } = kur(b, 40);
  await soyle("/compact");
  assert.deepEqual([b.gordugu.length, soylenen], [0, [SIKISTIR_SOZLERI.yok]]);
});

test("cümle içinde 'compact' geçmesi sıkıştırmayı tetiklemez", async () => {
  const b = new SahteBeyin(IYI);
  const { soyle, yedekler } = kur(b, 60);
  await soyle("compact diye bir komut var mı");
  assert.equal(yedekler.length, 0);
});

test("otomatik: ham kayıt eşiği aşılınca sohbet turundan sonra, beyin boştayken sıkıştırır; sonra aralık dolmadan tekrar çalışmaz", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [] }, IYI, { metin: "", cagrilar: [] }, IYI);
  const { k, soyle, yedekler } = kur(b, 130);
  await soyle("merhaba nasılsın");
  await bekle(150);
  assert.equal(yedekler.length, 1, "bir otomatik sıkıştırma");
  assert.ok(k.hafizaGorunumu().derin.filter((a) => a.tur === "konusma").length < 130);
  await soyle("bugün hava nasıl");
  await bekle(150);
  assert.equal(yedekler.length, 1, "aralık dolmadan ikinci sıkıştırma yok");
});

test("otomatik: eşik altında hiç tetiklenmez", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [] }, IYI);
  const { soyle, yedekler } = kur(b, 60);
  await soyle("merhaba nasılsın");
  await bekle(150);
  assert.equal(yedekler.length, 0);
});
