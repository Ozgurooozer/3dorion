import { performance } from 'node:perf_hooks';
import { AliceBob, BeceriMotoru, KucukDunya } from './brain-ir/v03.ts';
const tekrar = 1_000_000;
const dunya = new KucukDunya(); const g = dunya.gozlemle();
const motor = new BeceriMotoru(); motor.beceri.level = 5; motor.beceri.reflex = 'aktif'; motor.beceri.confidence = 0.95; motor.beceri.predictionError = 0.05;
const yonetici = new AliceBob(); yonetici.derle(motor.beceri, 'ileri', g.baglam); const bob = new AliceBob();
function olc(fn) { for (let i = 0; i < 10000; i++) fn(); const t0 = performance.now(); for (let i = 0; i < tekrar; i++) fn(); const ms = performance.now() - t0; return { ms, ns: ms * 1e6 / tekrar }; }
const alice = olc(() => yonetici.sec(g, motor.beceri));
motor.beceri.reflex = 'askida';
const deliberative = olc(() => bob.sec(g, motor.beceri));
motor.beceri.reflex = 'aktif';
const compile = olc(() => yonetici.derle(motor.beceri, 'ileri', g.baglam));
console.log(JSON.stringify({ tekrar, alice, deliberative, compile, speedup: deliberative.ns / alice.ns, yollar: yonetici.yolSayisi() }, null, 2));
