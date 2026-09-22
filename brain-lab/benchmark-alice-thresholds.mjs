import { performance } from 'node:perf_hooks';
import { AliceBob, BeceriMotoru, KucukDunya } from './brain-ir/v03.ts';
import { DeliberativePlanner } from './brain-ir/deliberative.ts';
function trained(){const m=new BeceriMotoru();m.beceri.level=5;m.beceri.reflex='aktif';m.beceri.confidence=.95;m.beceri.predictionError=.1;m.beceri.successRate=.95;return m}
function measure(label, setup, n){const router=new AliceBob(new DeliberativePlanner({derinlik:4,nodeBudget:512}));const dunya=new KucukDunya();const m=trained();const g=dunya.gozlemle();const compiled=setup({router,dunya,m,g});for(let i=0;i<100;i++)router.sec(g,m);const t=performance.now();let last;for(let i=0;i<n;i++)last=router.sec(g,m);const ms=performance.now()-t;return {label,n,totalMs:ms,avgUs:ms*1000/n,source:last.kaynak,action:last.eylem,compiled:Boolean(compiled)}}
const g0=new KucukDunya().gozlemle();
const cases=[
 measure('alice: tüm eşikler geçerli',({router,m,g})=>router.derle(m.beceri,'ileri',g.baglam),100000),
 measure('bob: reflex askida',({router,m,dunya,g})=>{m.beceri.reflex='askida';},1000),
 measure('bob: confidence < 0.75',({router,m})=>{m.beceri.confidence=.74;},1000),
 measure('bob: predictionError >= 0.4',({router,m})=>{m.beceri.predictionError=.4;},1000),
 measure('bob: context cache miss',({router,m})=>{},1000),
];
console.log(JSON.stringify({thresholds:{level:5,reflex:'aktif',confidence:0.75,predictionError:'< 0.4'},cases},null,2));
