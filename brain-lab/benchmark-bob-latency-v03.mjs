import { performance } from 'node:perf_hooks';
import { AliceBob, BeceriMotoru, KucukDunya, deneyimOlustur } from './brain-ir/v03.ts';
import { DeliberativePlanner } from './brain-ir/deliberative.ts';

const tekrar = 1000;
const configs = [
  { derinlik: 2, nodeBudget: 64 },
  { derinlik: 4, nodeBudget: 512 },
  { derinlik: 6, nodeBudget: 4096 },
];

function tekBob(config) {
  const dunya = new KucukDunya();
  const motor = new BeceriMotoru();
  const router = new AliceBob(new DeliberativePlanner(config));
  const gozlem = dunya.gozlemle();
  const durum = dunya.durumunuVer();
  const t0 = performance.now();
  const karar = router.sec(gozlem, motor.beceri, durum);
  const kararMs = performance.now() - t0;
  const t1 = performance.now();
  const sonuc = dunya.adim(karar.eylem);
  const dunyaMs = performance.now() - t1;
  const t2 = performance.now();
  motor.deneyimUygula(deneyimOlustur('LAT', gozlem, karar.eylem, { basarili: true, enerji: sonuc.enerjiMaliyeti }, sonuc, 'bob'));
  const ogrenmeMs = performance.now() - t2;
  return { kararMs, dunyaMs, ogrenmeMs, toplamMs: kararMs + dunyaMs + ogrenmeMs, nodes: karar.ziyaretEdilenDugum ?? 0, action: karar.eylem };
}

function olc(config) {
  for (let i = 0; i < 20; i++) tekBob(config);
  const toplam = { karar: 0, dunya: 0, ogrenme: 0, toplam: 0, nodes: 0, action: '' };
  const t0 = performance.now();
  for (let i = 0; i < tekrar; i++) {
    const r = tekBob(config);
    toplam.karar += r.kararMs; toplam.dunya += r.dunyaMs; toplam.ogrenme += r.ogrenmeMs; toplam.toplam += r.toplamMs; toplam.nodes += r.nodes; toplam.action = r.action;
  }
  const wallMs = performance.now() - t0;
  return { config, tekrar, wallMs, avgUs: { karar: toplam.karar * 1000 / tekrar, dunya: toplam.dunya * 1000 / tekrar, ogrenme: toplam.ogrenme * 1000 / tekrar, toplam: toplam.toplam * 1000 / Math.max(1, tekrar) }, nodes: toplam.nodes / tekrar, action: toplam.action };
}

const results = configs.map(olc);
console.log(JSON.stringify({ results }, null, 2));
