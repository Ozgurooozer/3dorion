// bridge/kopruKanca.test.ts — eklenti kancaları köprüde (spec 40): kancasız köprü BİREBİR bugünkü gibi; talimat eki sona girer; ret mevcut ret yolundan modele döner.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi } from "./beyin.ts";
import type { KopruKancasi } from "./kopruKancalari.ts";
import { KARAR_ONEKI, KararKaydi, type KararSatiri, type UyanisSatiri } from "../mind/kararKaydi.ts";
import type { Niyet } from "../protocol/niyet.ts";

class SahteBeyin implements Beyin {
  readonly ad = "sahte";
  gordugu: BeyinGirdisi[] = [];
  readonly cevaplar: BeyinCikti[];
  constructor(cevaplar: BeyinCikti[]) { this.cevaplar = cevaplar; }
  async hazirMi() { return true; }
  async dusun(g: BeyinGirdisi): Promise<BeyinCikti> { this.gordugu.push(structuredClone(g)); return this.cevaplar.shift() ?? { metin: "", cagrilar: [] }; }
}
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
const kalk: BeyinCikti = { metin: "", cagrilar: [{ ad: "dunya_kalk", girdi: {} }] };

function kur(cevaplar: BeyinCikti[], ek: Record<string, unknown> = {}) {
  const satirlar: KararSatiri[] = [];
  const gonderilen: Niyet[] = [];
  const b = new SahteBeyin(cevaplar);
  const k = new Kopru({ komutYetkisi: false, beyin: b, niyetGonder: (n) => { gonderilen.push(n); }, dunyaDurumu: () => "oda", toplamaMs: 5,
    kararKaydi: new KararKaydi({ yaz: (s) => satirlar.push(JSON.parse(s.slice(KARAR_ONEKI.length + 1))) }), ...ek });
  const soyle = async (metin: string) => { k.algi({ tur: "duydum", metin, kesin: true }); await bekle(40); };
  const uyanislar = () => satirlar.filter((s): s is UyanisSatiri => s.tur === "uyanis");
  return { b, soyle, gonderilen, uyanislar };
}

test("kancasız köprü ile boş kanca listesi AYNI talimatı üretir ve kayıtta 'kip' yazılmaz", async () => {
  const a = kur([{ metin: "", cagrilar: [] }]), c = kur([{ metin: "", cagrilar: [] }], { kancalar: () => [] });
  await a.soyle("merhaba orion"); await c.soyle("merhaba orion");
  assert.equal(a.b.gordugu[0]!.talimat, c.b.gordugu[0]!.talimat);
  assert.equal(c.uyanislar()[0]!.kip, undefined); assert.equal(c.uyanislar()[0]!.kancaReddi, undefined);
});

test("talimat eki talimatın SONUNA girer (öncekiler aynen kalır) ve kayıtta kancanın adı yazılır", async () => {
  const temel = kur([{ metin: "", cagrilar: [] }]);
  await temel.soyle("merhaba orion");
  const kanca: KopruKancasi = { ad: "dusunme-kipi", talimatEki: () => "MODE: deneme." };
  const k = kur([{ metin: "", cagrilar: [] }], { kancalar: () => [kanca] });
  await k.soyle("merhaba orion");
  const t = k.b.gordugu[0]!.talimat!;
  assert.equal(t, `${temel.b.gordugu[0]!.talimat}\n\nMODE: deneme.`);
  assert.equal(k.uyanislar()[0]!.kip, "dusunme-kipi");
});

test("kanca niyeti reddederse niyet DÜNYAYA GİTMEZ, ret modele geri beslenir ve kayda sayılır", async () => {
  const red: KopruKancasi = { ad: "dogrulayici", niyetDogrula: () => ({ ok: false, neden: "yeni bir şey yok" }) };
  const k = kur([kalk, { metin: "", cagrilar: [] }], { kancalar: () => [red] });
  await k.soyle("kalk");
  await bekle(60);
  assert.deepEqual(k.gonderilen, [], "reddedilen niyet gönderilmedi");
  const ikinci = k.b.gordugu[1];
  assert.ok(ikinci, "geri besleme yeni bir tur açtı");
  assert.ok(ikinci.ozetler.some((o) => /Araç reddedildi \(dunya_kalk\): yeni bir şey yok/.test(o)));
  assert.equal(k.uyanislar()[0]!.kancaReddi, 1);
});

test("kanca geçirirse niyet normal gider; kancalar işlevi her turda yeniden okunur (canlı aç/kapa)", async () => {
  let acik = false;
  const red: KopruKancasi = { ad: "dogrulayici", niyetDogrula: () => ({ ok: false, neden: "hayır" }) };
  const k = kur([kalk, kalk], { kancalar: () => (acik ? [red] : []) });
  await k.soyle("bir"); await bekle(30);
  assert.equal(k.gonderilen.length, 1, "kapalıyken geçti");
  acik = true;
  await k.soyle("iki"); await bekle(30);
  assert.equal(k.gonderilen.length, 1, "açıkken reddedildi");
});
