import { AliceBob, BeceriMotoru, KucukDunya } from './brain-ir/v03.ts';
const d=new KucukDunya(),m=new BeceriMotoru();m.beceri.level=5;m.beceri.reflex='aktif';m.beceri.confidence=.95;m.beceri.predictionError=.1;const g=d.gozlemle();const r=new AliceBob();console.log({baglam:g.baglam,compile:r.derle(m.beceri,'ileri',g.baglam),decision:r.sec(g,m.beceri),skill:m.snapshot()});
