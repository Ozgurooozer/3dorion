import { performance } from 'node:perf_hooks';
import { AliceBob, BeceriMotoru, KucukDunya, deneyimOlustur } from './brain-ir/v03.ts';
import { DeliberativePlanner } from './brain-ir/deliberative.ts';

const tekrar = 1000;
const plannerConfig = { derinlik: 4, nodeBudget: 512 };

function olc(fn) {
  for (let i = 0; i < 20; i++) fn();
  const t0 = performance.now();
  let result;
  for (let i = 0; i < tekrar; i++) result = fn();
  const ms = performance.now() - t0;
  return { totalMs: ms, avgUs: ms * 1000 / tekrar, result };
}

function bobStep() {
  const dunya = new KucukDunya();
  const motor = new BeceriMotoru();
  const router = new AliceBob(new DeliberativePlanner(plannerConfig));
  const g = dunya.gozlemle();
  const karar = router.sec(g, motor.beceri, dunya.durumunuVer());
  const sonuc = dunya.adim(karar.eylem);
  motor.deneyimUygula(deneyimOlustur('BENCH', g, karar.eylem, { basarili: true, enerji: sonuc.enerjiMaliyeti }, sonuc, karar.kaynak));
  return { karar, sonuc, beceri: motor.snapshot() };
}

function aliceStep() {
  const dunya = new KucukDunya();
  const motor = new BeceriMotoru();
  motor.beceri.level = 5; motor.beceri.reflex = 'aktif'; motor.beceri.confidence = 0.95; motor.beceri.predictionError = 0.1;
  const router = new AliceBob(new DeliberativePlanner(plannerConfig));
  const g = dunya.gozlemle(); router.derle(motor.beceri, 'sol', g.baglam);
  const karar = router.sec(g, motor.beceri, dunya.durumunuVer());
  const sonuc = dunya.adim(karar.eylem);
  return { karar, sonuc };
}

function failureCycle() {
  const dunya = new KucukDunya();
  const motor = new BeceriMotoru();
  motor.beceri.level = 5; motor.beceri.reflex = 'aktif'; motor.beceri.confidence = 0.95; motor.beceri.successRate = 0.95; motor.beceri.predictionError = 0.1;
  const router = new AliceBob(new DeliberativePlanner(plannerConfig));
  const g = dunya.gozlemle();
  router.derle(motor.beceri, 'ileri', g.baglam);
  const before = motor.beceri.reflex;
  const alice = router.sec(g, motor.beceri, dunya.durumunuVer());
  const outcome = dunya.adim(alice.eylem);
  const error = deneyimOlustur('FAIL', g, alice.eylem, { basarili: true, enerji: outcome.enerjiMaliyeti }, outcome, 'alice');
  motor.deneyimUygula(error);
  const suspended = motor.beceri.reflex;
  const bob = router.sec(dunya.gozlemle(), motor.beceri, dunya.durumunuVer());
  return { before, alice: alice.kaynak, outcome: outcome.carpisma ? 'collision' : 'safe', suspended, bob: bob.kaynak, fallbackAction: bob.eylem, nodes: bob.ziyaretEdilenDugum };
}

const bob = olc(bobStep);
const alice = olc(aliceStep);
const failure = olc(failureCycle);
console.log(JSON.stringify({ tekrar, plannerConfig, bob: { totalMs: bob.totalMs, avgUs: bob.avgUs, nodes: bob.result.karar.ziyaretEdilenDugum, action: bob.result.karar.eylem }, alice: { totalMs: alice.totalMs, avgUs: alice.avgUs, action: alice.result.karar.eylem }, failure: { totalMs: failure.totalMs, avgUs: failure.avgUs, transition: failure.result } }, null, 2));
