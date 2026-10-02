// mind/gunlukSatirlari.test.ts — Karar kaydı → günlük satırları (spec 13 Faz 5).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { gunlukBicimleyiciKur } from "./gunlukSatirlari.ts";
import type { AlgiSatiri, UyanisSatiri, ProgramSatiri } from "./kararKaydi.ts";

const algi = (id: string, ozet: string, gecti: boolean, kural: AlgiSatiri["kapi"]["kural"], eden?: AlgiSatiri["eden"]): AlgiSatiri =>
  ({ tur: "algi", o: "o", id, t: 1, algi: "duydum", ozet, kapi: { gecti, kural }, ...(eden ? { eden } : {}) });

const uyanis = (ek: Partial<UyanisSatiri>): UyanisSatiri => ({
  tur: "uyanis", o: "o", id: "u1", t: 2, algilar: ["a1"], geriBesleme: 0, beyin: "yerel:ornith-32k:latest", sureMs: 2300,
  koken: "dis", takip: false, anilar: 0, dunya: "", cagrilar: [], niyetler: [], reddedilen: 0, kurtarilan: 0,
  konusulanMetin: false, yutulanSoz: 0, ...ek,
});

test("uyanış: neyin uyandırdığı, kuralı, faili, süresi, modeli ve seçtiği tek satırda", () => {
  const g = gunlukBicimleyiciKur();
  g.satir(algi("a1", 'Ozyn said: "otur"', true, "kopru.konusma", "ozyn"));
  const s = g.satir(uyanis({ niyetler: [{ id: "n1", tur: "otur" }, { id: "n2", tur: "soyle" }] }));
  assert.deepEqual(s, { seviye: "bilgi", kaynak: "uyandı",
    metin: '← Ozyn: "otur" [kopru.konusma · ozyn] · 2,3 sn ornith-32k:latest → otur + soyle' });
});

test("hareket zincirinde sesi kısılan uyanış bunu söyler; seçtiği 'iç ses'", () => {
  const g = gunlukBicimleyiciKur();
  g.satir(algi("a1", "Event: ozyn_yaklasti", true, "refleks.olay.dunya", "ozyn"));
  const s = g.satir(uyanis({ icSes: "Yaklaştın.", susturan: "kopru.hareket_sessiz" }))!;
  assert.match(s.metin, /→ iç ses · sesi kısıldı \(kopru\.hareket_sessiz\)$/);
});

test("hatalı uyanış kırmızı ve hatayı söyler", () => {
  const g = gunlukBicimleyiciKur();
  g.satir(algi("a1", 'Ozyn said: "x"', true, "kopru.konusma"));
  const s = g.satir(uyanis({ hata: "yerel model 60 sn icinde cevap vermedi" }))!;
  assert.deepEqual({ seviye: s.seviye, hata: s.metin.includes("HATA: yerel model 60 sn") }, { seviye: "hata", hata: true });
});

test("elenen algılar tek tek yazılmaz, sayılır", () => {
  const g = gunlukBicimleyiciKur();
  const ciktilar = [
    g.satir(algi("a1", "Event: ozyn_yaklasti", false, "dikkat.tekrar")),
    g.satir(algi("a2", "Event: ozyn_uzaklasti", false, "refleks.olay.gurultu")),
  ];
  assert.deepEqual({ ciktilar, elenen: g.elenen }, { ciktilar: [null, null], elenen: 2 });
});

test("program (LLM'siz) satırı sözü ve adımları söyler", () => {
  const g = gunlukBicimleyiciKur();
  g.satir(algi("a1", 'Ozyn said: "bana gel"', true, "kopru.komut", "ozyn"));
  const p: ProgramSatiri = { tur: "program", o: "o", id: "p1", t: 3, algi: "a1", program: "komut:gel", niyetler: [{ id: "k1", tur: "git" }] };
  assert.deepEqual(g.satir(p), { seviye: "iyi", kaynak: "program", metin: 'Ozyn: "bana gel" → komut:gel: git (LLM\'siz)' });
});

test("kendi bakışının cevabıyla uyanan takip turu bunu söyler", () => {
  const g = gunlukBicimleyiciKur();
  const s = g.satir(uyanis({ algilar: [], takip: true }))!;
  assert.match(s.metin, /^← kendi bakışının cevabı/);
});

test("inisiyatif uyanışı ayrı işaretlenir", () => {
  const g = gunlukBicimleyiciKur();
  assert.equal(g.satir(uyanis({ koken: "inisiyatif", algilar: [] }))!.kaynak, "uyandı*");
});
