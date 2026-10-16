// uygulama/nesneEtkilesimi.test.ts — menü düğmesi: Orion'a niyet, ben yapayım, gri eylem reddi, başarısız etkileşimin altyazısı.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { nesneEtkilesimiKur } from "./nesneEtkilesimi.ts";
import type { NesneEylemi } from "../world/yer/nesneEylemleri.ts";
import type { Niyet } from "../protocol/niyet.ts";

function duzenek(oyuncuBasari = true) {
  const g = { niyet: [] as { n: Niyet; id: string }[], etkilesim: [] as [string, string][], altyazi: [] as string[] };
  const k = nesneEtkilesimiKur({
    niyetiYurut: (n, id) => { g.niyet.push({ n, id }); },
    oyuncuEtkilesim: (c, e) => { g.etkilesim.push([c, e]); return oyuncuBasari; },
    altyazi: (m) => { g.altyazi.push(m); },
  });
  return { k, g };
}

const GIT: NesneEylemi = { kimlik: "orion.git", ad: "Yanına git", kim: "orion", uygun: true, niyet: { tur: "git", hedef: { tip: "capa", ad: "bank" } } };
const OZYN_OTUR: NesneEylemi = { kimlik: "ozyn.otur", ad: "Otur", kim: "ozyn", uygun: true, etkilesim: { capa: "bank", eylem: "otur" } };

test("Orion eylemi: niyet TEK yola (niyetiYurut) gider ve altyazı Orion'a ne dendiğini söyler", () => {
  const { k, g } = duzenek();
  k.calistir(GIT);
  assert.deepEqual(g.niyet.map((x) => x.n), [GIT.niyet]);
  assert.deepEqual(g.altyazi, ["Orion'a: Yanına git"]);
  assert.deepEqual(g.etkilesim, []);
});

test("niyet kimlikleri her çağrıda yeni (kayıtta ayırt edilir) ve eylem kimliğini taşır", () => {
  const { k, g } = duzenek();
  k.calistir(GIT); k.calistir(GIT);
  const idler = g.niyet.map((x) => x.id);
  assert.equal(new Set(idler).size, 2);
  assert.ok(idler.every((i) => i.startsWith("menu_") && i.endsWith("_orion.git")), idler.join(","));
});

test("ben yapayım: oyuncunun KENDİ etkileşimi çağrılır, niyet gönderilmez", () => {
  const { k, g } = duzenek();
  k.calistir(OZYN_OTUR);
  assert.deepEqual(g.etkilesim, [["bank", "otur"]]);
  assert.deepEqual(g.niyet, []);
});

test("ben yapayım başarısızsa (uzak/başka etkileşim açık) altyazı söyler, sessiz kalmaz", () => {
  const { k, g } = duzenek(false);
  k.calistir(OZYN_OTUR);
  assert.match(g.altyazi[0] ?? "", /Otur: şu an yapılamıyor/);
});

test("GRİ eylem çalıştırılmaz ve nedeni altyazıda söylenir", () => {
  const { k, g } = duzenek();
  k.calistir({ ...GIT, uygun: false, neden: "Orion şimdilik yalnız sandalyeye oturabilir" });
  assert.deepEqual([g.niyet.length, g.etkilesim.length], [0, 0]);
  assert.equal(g.altyazi[0], "Yanına git: Orion şimdilik yalnız sandalyeye oturabilir");
});

test("niyeti olmayan Orion eylemi sessizce yutulmaz", () => {
  const { k, g } = duzenek();
  const { niyet: _n, ...niyetsiz } = GIT;
  k.calistir(niyetsiz);
  assert.deepEqual([g.niyet.length, g.altyazi.length], [0, 1]);
});
