import { performance } from 'node:perf_hooks';

const ACTIONS = 4;
const tekrar = 100;

function reason(depth, branching) {
  let leaves = 0;
  let checksum = 0;
  function search(d, state) {
    if (d === 0) { leaves++; checksum = (checksum + state * 17 + 3) % 1000003; return; }
    for (let a = 0; a < branching; a++) search(d - 1, (state * 31 + a * 7 + d) % 1000003);
  }
  search(depth, 1);
  return { leaves, checksum };
}

function olc(depth, branching) {
  for (let i = 0; i < 100; i++) reason(depth, branching);
  const t0 = performance.now(); let sonuc;
  for (let i = 0; i < tekrar; i++) sonuc = reason(depth, branching);
  const ms = performance.now() - t0;
  return { depth, branching, leaves: sonuc.leaves, totalMs: ms, usPerDecision: ms * 1000 / tekrar };
}

console.log(JSON.stringify({ tekrar, baselineBobNs: 24.05, cases: [
  olc(2, 4), olc(4, 4), olc(6, 4), olc(8, 4), olc(4, 8), olc(6, 8)
] }, null, 2));
