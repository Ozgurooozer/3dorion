// bridge/kopruTakip.test.ts — "Beni takip et" köprüde (içgüdü `kopru.takip`).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi, AracCagrisi } from "./beyin.ts";
import { KARAR_ONEKI, KararKaydi, type AlgiSatiri, type KararSatiri } from "../mind/kararKaydi.ts";
import { TAKIP_ONAYI } from "../mind/takipSozu.ts";

class SahteBeyin implements Beyin {
  readonly ad = "sahte";
  gordugu: BeyinGirdisi[] = [];
  cevaplar: BeyinCikti[];
  constructor(...c: BeyinCikti[]) { this.cevaplar = c; }
  async hazirMi() { return true; }
  async dusun(g: BeyinGirdisi): Promise<BeyinCikti> { this.gordugu.push(structuredClone(g)); return this.cevaplar.shift() ?? { metin: "", cagrilar: [] }; }
}
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cagri = (ad: string, girdi: unknown): AracCagrisi => ({ ad, girdi });

function kur(beyin = new SahteBeyin(), ek: Record<string, unknown> = {}) {
  const satirlar: KararSatiri[] = [];
  const takip: boolean[] = [];
  const k = new Kopru({ beyin, niyetGonder: () => {}, dunyaDurumu: () => "oda", toplamaMs: 5,
    takipDinle: (a: boolean) => takip.push(a),
    kararKaydi: new KararKaydi({ yaz: (s) => satirlar.push(JSON.parse(s.slice(KARAR_ONEKI.length + 1))) }), ...ek });
  const soylenen: string[] = [];
  k.konusmaDinle((m) => soylenen.push(m));
  const soyle = async (metin: string) => { k.algi({ tur: "duydum", metin, kesin: true }); await bekle(25); };
  const algilar = () => satirlar.filter((s): s is AlgiSatiri => s.tur === "algi");
  return { k, beyin, takip, soylenen, soyle, algilar };
}

test("'beni takip et' takibi açar ve LLM'i uyandırmaz", async () => {
  const { k, beyin, takip, soyle } = kur();
  await soyle("Orion, beni takip et");
  assert.deepEqual([k.takipte, takip, beyin.gordugu.length], [true, [true], 0]);
});

test("söz kayda kopru.takip kuralıyla yazılır", async () => {
  const { soyle, algilar } = kur();
  await soyle("beni takip et");
  assert.equal(algilar().at(-1)?.kapi.kural, "kopru.takip");
});

test("Orion sabit cümleyle onaylar", async () => {
  const { soyle, soylenen } = kur();
  await soyle("beni takip et");
  assert.deepEqual(soylenen, [TAKIP_ONAYI.basla]);
});

test("'takibi bırak' takibi kapatır", async () => {
  const { k, takip, soyle } = kur();
  await soyle("beni takip et"); await soyle("takibi bırak");
  assert.deepEqual([k.takipte, takip], [false, [true, false]]);
});

test("'dur' (komut programı) takibi bitirir", async () => {
  const { k, takip, soyle } = kur();
  await soyle("beni takip et"); await soyle("dur");
  assert.deepEqual([k.takipte, takip.at(-1)], [false, false]);
});

test("LLM'in başlattığı yeni iş takibi bitirir", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_git", { hedef: { tip: "capa", ad: "tahta" } })] });
  const { k, soyle } = kur(b);
  await soyle("beni takip et");
  await soyle("tahtada ne yazıyor bir bak");
  assert.equal(k.takipte, false);
});

test("takip ederken sonraki LLM turu takip ettiğini geçmişte görür", async () => {
  const { beyin, soyle } = kur();
  await soyle("beni takip et");
  await soyle("naber");
  assert.ok(beyin.gordugu.at(-1)?.gecmis.some((g) => g.metin === TAKIP_ONAYI.basla));
});

test("durum defterinde takip 'yapıyor' olarak görünür, bitince son iş olur", async () => {
  const { k, soyle } = kur();
  await soyle("beni takip et");
  const yapiyor = k.durum.oku("yapiyor")?.deger;
  await soyle("takibi bırak");
  assert.deepEqual([yapiyor, k.durum.oku("son_is")?.deger], ["takip → Ozyn", "takip → Ozyn → bitti (söz)"]);
});

test("takip etmezken 'takibi bırak' dinleyiciyi çağırmaz", async () => {
  const { takip, soyle } = kur();
  await soyle("takibi bırak");
  assert.deepEqual(takip, []);
});
