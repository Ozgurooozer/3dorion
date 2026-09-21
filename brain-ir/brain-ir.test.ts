// brain-ir/brain-ir.test.ts — Orion için ilk kapı: küçük grafik, görünür iz, deterministik karar.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { BrainSimulator } from "./simulator.ts";
import { BrainIrBeyni } from "./orion.ts";
import type { BrainGrafi, BrainInputlari } from "./ir.ts";
import { araclariUret, cagriyiNiyete } from "../bridge/araclar.ts";
import { OlayDefteri, OlayHafizasi } from "./olayGunlugu.ts";

const GRAF: BrainGrafi = {
  name: "orion-dikkat-test",
  nodes: [
    { id: "terminal_alarm", type: "input" },
    { id: "oyuncu_yakin", type: "input" },
    { id: "dikkat", type: "neuron", decay: 0.25 },
    { id: "tehdit", type: "decision", threshold: 0.7 },
    { id: "bak", type: "action", threshold: 0.5 },
  ],
  connections: [
    { from: "terminal_alarm", to: "dikkat", weight: 0.9 },
    { from: "oyuncu_yakin", to: "dikkat", weight: 0.35 },
    { from: "dikkat", to: "tehdit", weight: 1 },
    { from: "tehdit", to: "bak", weight: 1 },
  ],
};

const GIRDI = {
  ozetler: ["terminal hata: komut bulunamadı"],
  dunya: "monitor önünde terminal",
  gecmis: [],
  araclar: araclariUret(),
};

test("sinyal grafik boyunca adım adım ilerler ve izlenebilir", () => {
  const sim = new BrainSimulator(GRAF);
  const ilk = sim.step({ terminal_alarm: 1, oyuncu_yakin: 0 });
  assert.equal(ilk.outputs.tehdit, 0, "tehdit aynı tikte sıçramamalı");

  const calisma = sim.run({ terminal_alarm: 1, oyuncu_yakin: 0 }, 3);
  assert.equal(calisma.final.outputs.tehdit, 1);
  assert.equal(calisma.final.outputs.bak, 1);
  assert.equal(calisma.steps.length, 3);
  assert.ok(calisma.steps[0].states.dikkat > 0);
});

test("eşik altındaki karar ham state ile aksiyonu tetiklemez", () => {
  const grafik: BrainGrafi = {
    nodes: [
      { id: "input", type: "input" },
      { id: "karar", type: "decision", threshold: 0.7 },
      { id: "eylem", type: "action", threshold: 0.5 },
    ],
    connections: [
      { from: "input", to: "karar", weight: 1 },
      { from: "karar", to: "eylem", weight: 1 },
    ],
  };
  const sim = new BrainSimulator(grafik);
  sim.run({ input: 0.6 }, 4);
  assert.equal(sim.step({ input: 0 }).outputs.eylem, 0);

  sim.reset();
  const güçlü = sim.run({ input: 0.8 }, 3);
  assert.equal(güçlü.final.outputs.karar, 1);
  assert.equal(güçlü.final.outputs.eylem, 1);
});

test("memory node τ=0.92 ile kontrollü state persistence üretir", () => {
  const grafik: BrainGrafi = {
    nodes: [{ id: "input", type: "input" }, { id: "memory", type: "memory", decay: 0.92, activation: "linear" }],
    connections: [{ from: "input", to: "memory", weight: 1 }],
  };
  const sim = new BrainSimulator(grafik);
  sim.step({ input: 1 });
  const aktif = sim.step({ input: 0 });
  const sonraki = sim.step({ input: 0 });
  assert.equal(aktif.states.memory, 1);
  assert.equal(sonraki.states.memory, 0.92);
});

test("inhibition pozitif excitation'ı bastırır", () => {
  const grafik: BrainGrafi = {
    nodes: [
      { id: "threat", type: "input" }, { id: "safety", type: "input" },
      { id: "escape", type: "action", threshold: 0.5 },
    ],
    connections: [
      { from: "threat", to: "escape", weight: 0.9 },
      { from: "safety", to: "escape", weight: -0.8 },
    ],
  };
  const inhibited = new BrainSimulator(grafik).run({ threat: 1, safety: 1 }, 2);
  const positiveOnly = new BrainSimulator({ ...grafik, connections: [grafik.connections[0]] })
    .run({ threat: 1, safety: 0 }, 2);
  assert.ok(Math.abs(inhibited.final.states.escape - 0.1) < 1e-12);
  assert.equal(inhibited.final.outputs.escape, 0);
  assert.equal(positiveOnly.final.outputs.escape, 1);
  const trace = inhibited.final.trace.find((x) => x.node === "escape")!;
  assert.equal(trace.excitation, 0.9);
  assert.equal(trace.inhibition, -0.8);
});

test("inhibitor düğümü kendi state'ini negatif katkıya çevirir", () => {
  const grafik: BrainGrafi = {
    nodes: [
      { id: "safety", type: "input" },
      { id: "brake", type: "inhibitor", activation: "linear" },
      { id: "escape", type: "action", threshold: 0.5 },
    ],
    connections: [
      { from: "safety", to: "brake", weight: 1 },
      { from: "brake", to: "escape", weight: 1 },
    ],
  };
  const sim = new BrainSimulator(grafik);
  const result = sim.run({ safety: 1 }, 3);
  const trace = result.final.trace.find((x) => x.node === "escape")!;
  assert.equal(trace.inhibition, -1);
  assert.equal(result.final.outputs.escape, 0);
});

test("recurrent loop stable, decaying, oscillating ve unstable durumları ayırır", () => {
  const grafik = (weight: number): BrainGrafi => ({
    nodes: [{ id: "loop", type: "neuron", activation: "linear" }],
    connections: [{ from: "loop", to: "loop", weight }],
  });
  const stable = new BrainSimulator(grafik(1), { loop: 1 }).run({}, 3);
  const decaying = new BrainSimulator(grafik(0.5), { loop: 1 }).run({}, 3);
  const oscillating = new BrainSimulator(grafik(-1), { loop: 1 }).run({}, 3);
  const unstable = new BrainSimulator(grafik(1.2), { loop: 1 }).run({}, 3);
  assert.equal(stable.final.states.loop, 1);
  assert.equal(decaying.final.states.loop, 0.125);
  assert.deepEqual(oscillating.steps.map((x) => x.states.loop), [-1, 1, -1]);
  assert.equal(unstable.final.states.loop, 1.728);
});

test("immutable trace causal chain'i inputtan action'a taşır", () => {
  const grafik: BrainGrafi = {
    nodes: [
      { id: "vision", type: "input" }, { id: "motion", type: "neuron" },
      { id: "threat", type: "decision", threshold: 0.5 }, { id: "escape", type: "action", threshold: 0.5 },
    ],
    connections: [
      { from: "vision", to: "motion", weight: 1 }, { from: "motion", to: "threat", weight: 1 },
      { from: "threat", to: "escape", weight: 1 },
    ],
  };
  const sim = new BrainSimulator(grafik);
  const calisma = sim.run({ vision: { deger: 1, olaylar: ["OLY-00000037"] } }, 4);
  const trace = calisma.final.trace.find((x) => x.node === "escape")!;
  assert.equal(trace.activated, true);
  assert.deepEqual(trace.causeEvents, ["OLY-00000037"]);
  assert.deepEqual(trace.causeNodes, ["escape", "motion", "threat", "vision"]);
  assert.ok(Object.isFrozen(trace));
  assert.ok(Object.isFrozen(trace.causeEvents));
});

test("aynı replay kaydı aynı state ve trace'i üretir", () => {
  const grafik: BrainGrafi = {
    version: "v0.2-test",
    nodes: [{ id: "input", type: "input" }, { id: "memory", type: "memory", decay: 0.92, activation: "linear" }],
    connections: [{ from: "input", to: "memory", weight: 1 }],
  };
  const inputs: BrainInputlari[] = [{ input: 1 }, { input: 0 }, { input: 0 }];
  const originalSim = new BrainSimulator(grafik);
  const originalSteps = inputs.map((x) => originalSim.step(x));
  const kayit = originalSim.replayKaydi("seed-1842", inputs, { input: 0, memory: 0 });
  const replay = BrainSimulator.replay(grafik, kayit);
  assert.deepEqual(replay.steps, originalSteps);
  assert.equal(replay.replay?.seed, "seed-1842");
  assert.equal(replay.replay?.graphVersion, "v0.2-test");
});

test("decay, giriş kesilince nöron state'ini azaltır", () => {
  const grafik: BrainGrafi = {
    nodes: [{ id: "input", type: "input" }, { id: "hafiza", type: "neuron", decay: 0.5 }],
    connections: [{ from: "input", to: "hafiza", weight: 1 }],
  };
  const sim = new BrainSimulator(grafik);
  sim.step({ input: 1 });
  const aktif = sim.step({ input: 0 });
  const sönük = sim.step({ input: 0 });
  assert.equal(aktif.states.hafiza, 1);
  assert.equal(sönük.states.hafiza, 0.5);
});

test("reset tik sayacını ve state'i başlangıca döndürür", () => {
  const sim = new BrainSimulator(GRAF);
  sim.step({ terminal_alarm: 1 });
  sim.reset();
  const adım = sim.step({ terminal_alarm: 0 });
  assert.equal(adım.tick, 1);
  assert.equal(adım.states.dikkat, 0);
});

test("run(0) ekstra tik tüketmez", () => {
  const sim = new BrainSimulator(GRAF);
  const boş = sim.run({ terminal_alarm: 1 }, 0);
  assert.equal(boş.steps.length, 0);
  assert.equal(boş.final.tick, 0);
});

test("Orion adaptörü sessiz girdide araç çağırmaz", async () => {
  const beyin = new BrainIrBeyni(GRAF, {
    duyarga: () => ({ terminal_alarm: 0, oyuncu_yakin: 0 }),
    aksiyonlar: [{ node: "bak", arac: "dunya_bak", girdi: { hedef: { tip: "oyuncu" } } }],
  });
  const sonuc = await beyin.dusun(GIRDI);
  assert.deepEqual(sonuc.cagrilar, []);
  assert.equal(sonuc.metin, "");
  assert.equal((sonuc.bilgi as { motor: string }).motor, "brain-ir");
});

test("Orion adaptörü alarmı mevcut araç çağrısına çevirir", async () => {
  const beyin = new BrainIrBeyni(GRAF, {
    duyarga: (girdi) => ({
      terminal_alarm: girdi.ozetler.some((x) => /hata|error/i.test(x)) ? 1 : 0,
      oyuncu_yakin: 0,
    }),
    aksiyonlar: [{ node: "bak", arac: "dunya_bak", girdi: { hedef: { tip: "oyuncu" } } }],
    // Eşzamanlı güncelleme: input → dikkat → tehdit → aksiyon = 4 tik.
    adim: 4,
  });
  const sonuc = await beyin.dusun(GIRDI);
  assert.equal(sonuc.cagrilar.length, 1);
  assert.equal(sonuc.cagrilar[0].ad, "dunya_bak");
  assert.deepEqual(sonuc.cagrilar[0].girdi, { hedef: { tip: "oyuncu" } });
  assert.equal(beyin.iz()?.aksiyonlar.length, 1);
});

test("Brain IR arac çıktısı mevcut niyet doğrulamasından geçer", async () => {
  const beyin = new BrainIrBeyni(GRAF, {
    duyarga: () => ({ terminal_alarm: 1, oyuncu_yakin: 0 }),
    aksiyonlar: [{ node: "bak", arac: "dunya_bak", girdi: { hedef: { tip: "oyuncu" } } }],
    adim: 4,
  });
  const sonuc = await beyin.dusun(GIRDI);
  const niyet = cagriyiNiyete(sonuc.cagrilar[0].ad, sonuc.cagrilar[0].girdi);
  assert.equal(niyet.ok, true);
  if (niyet.ok) assert.equal(niyet.deger.tur, "bak");
});

test("olay günlüğü her kayda kararlı özel numara verir ve numarayla çağırır", () => {
  const gunluk = new OlayDefteri({ simdi: () => 123 });
  const ilk = gunluk.kaydet({ tur: "beyin_cagrisi", metin: "ilk düşünme" });
  const ikinci = gunluk.kaydet({ tur: "beyin_aksiyonu", metin: "bak üretildi", veri: { node: "bak" } });
  assert.equal(ilk.id, "OLY-00000001");
  assert.equal(ikinci.id, "OLY-00000002");
  assert.deepEqual(gunluk.cagir(ikinci.id)?.veri, { node: "bak" });
  assert.equal(gunluk.cagir("OLY-99999999"), null);
});

test("olay numarası dışa aktarım ve yeniden yüklemede devam eder", () => {
  const ilk = new OlayDefteri({ simdi: () => 123 });
  ilk.kaydet({ tur: "beyin_cagrisi", metin: "kalıcı ilk kayıt" });
  const yeniden = new OlayDefteri({ simdi: () => 456, kayitlar: ilk.dok() });
  const devam = yeniden.kaydet({ tur: "beyin_cagrisi", metin: "kalıcı ikinci kayıt" });
  assert.equal(devam.id, "OLY-00000002");
  assert.equal(devam.zaman, 456);
});

test("yeniden yüklenen olay günlüğü hafıza indeksini yeniden besler", () => {
  const ilk = new OlayHafizasi({ simdi: () => 123 });
  const olay = ilk.kaydet({ tur: "beyin_aksiyonu", metin: "terminal alarmından sonra bak", veri: {} });
  const yenidenGunluk = new OlayDefteri({ simdi: () => 456, kayitlar: ilk.dok() });
  const yenidenHafiza = new OlayHafizasi({ simdi: () => 456, gunluk: yenidenGunluk });
  assert.equal(yenidenHafiza.ilgili("terminal alarm", 1)[0]?.id, olay.id);
});

test("olay hafızası ilgili kaydı seçip tam olaya geri döner", () => {
  const hafiza = new OlayHafizasi({ simdi: () => 1000 });
  const hedef = hafiza.kaydet({
    tur: "beyin_aksiyonu",
    metin: "terminal alarmı sonrası bak aksiyonu",
    veri: { risk: "yüksek" },
  });
  hafiza.kaydet({ tur: "beyin_cagrisi", metin: "pencere ışığı gözlemi", veri: {} });
  const ilgili = hafiza.ilgili("terminal alarmı", 3);
  assert.equal(ilgili.length, 1);
  assert.equal(ilgili[0].id, hedef.id);
  assert.equal(ilgili[0].olay.veri.risk, "yüksek");
  assert.equal(hafiza.hatirla(hedef.id)?.metin, hedef.metin);
});

test("Orion çağrısı ve üretilen aksiyon olay günlüğüne ayrı kayıt olur", async () => {
  const hafiza = new OlayHafizasi({ simdi: () => 2000 });
  const beyin = new BrainIrBeyni(GRAF, {
    duyarga: () => ({ terminal_alarm: 1, oyuncu_yakin: 0 }),
    aksiyonlar: [{ node: "bak", arac: "dunya_bak", girdi: { hedef: { tip: "oyuncu" } } }],
    olayGunlugu: hafiza,
    adim: 4,
  });
  const sonuc = await beyin.dusun(GIRDI);
  const bilgi = sonuc.bilgi as { olayId: string; aksiyonOlaylari: string[] };
  assert.match(bilgi.olayId, /^OLY-\d{8}$/);
  assert.equal(bilgi.aksiyonOlaylari.length, 1);
  assert.equal(hafiza.dok().length, 2);
  assert.equal(hafiza.cagir(bilgi.olayId)?.tur, "beyin_cagrisi");
  assert.equal(hafiza.cagir(bilgi.aksiyonOlaylari[0])?.tur, "beyin_aksiyonu");
});

test("olay günlüğü bozulsa bile Brain IR kararı kaybolmaz", async () => {
  const beyin = new BrainIrBeyni(GRAF, {
    duyarga: () => ({ terminal_alarm: 1, oyuncu_yakin: 0 }),
    aksiyonlar: [{ node: "bak", arac: "dunya_bak", girdi: { hedef: { tip: "oyuncu" } } }],
    olayGunlugu: { kaydet: () => { throw new Error("disk dolu"); }, cagir: () => null, ara: () => [], dok: () => [] },
    adim: 4,
  });
  const sonuc = await beyin.dusun(GIRDI);
  assert.equal(sonuc.cagrilar.length, 1);
});

test("adaptör yanlış action düğümünü ve aracı baştan reddeder", () => {
  assert.throws(() => new BrainIrBeyni(GRAF, {
    duyarga: () => ({}),
    aksiyonlar: [{ node: "tehdit", arac: "dunya_bak", girdi: {} }],
  }), /action olmalı/);
  assert.throws(() => new BrainIrBeyni(GRAF, {
    duyarga: () => ({}),
    aksiyonlar: [{ node: "bak", arac: "rastgele_arac", girdi: {} }],
  }), /dunya_/);
});

test("grafik şeması hataları çalışmadan önce reddedilir", () => {
  assert.throws(() => new BrainSimulator({
    nodes: [{ id: "a", type: "input" }, { id: "a", type: "neuron" }],
    connections: [],
  }), /tekrar düğüm/);
  assert.throws(() => new BrainSimulator({
    nodes: [{ id: "a", type: "input" }],
    connections: [{ from: "a", to: "yok", weight: 1 }],
  }), /kopuk bağlantı/);
  assert.throws(() => new BrainSimulator({
    nodes: [{ id: "a", type: "neuron", decay: 2 }],
    connections: [],
  }), /decay/);
  assert.throws(() => new BrainSimulator({
    nodes: [{ id: "a", type: "decision", threshold: Number.NaN }],
    connections: [],
  }), /eşik/);
});
