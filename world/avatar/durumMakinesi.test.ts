// world/avatar/durumMakinesi.test.ts — Poz geçiş kurallarının düşman testleri.
//
// Koşum: node --experimental-strip-types --test world/avatar/durumMakinesi.test.ts
// Babylon YÜKLENMEZ — durum makinesinin motordan bağımsız olduğunun kanıtı.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GECISLER, PozMakinesi, hareketliMi } from "./durumMakinesi.ts";
import { POZLAR, type Poz } from "../../protocol/niyet.ts";

test("protokoldeki her POZ için geçiş kuralı tanımlı", () => {
  for (const p of POZLAR) {
    assert.ok(Array.isArray(GECISLER[p]), `'${p}' için geçiş listesi yok`);
  }
  // Ters yön: uydurulmuş bir poz kuralı sızmasın.
  for (const k of Object.keys(GECISLER)) {
    assert.ok((POZLAR as readonly string[]).includes(k), `'${k}' protokolde yok`);
  }
});

test("hiçbir geçiş listesi kendisini içermez (no-op ayrıca ele alınır)", () => {
  for (const p of POZLAR) {
    assert.ok(!GECISLER[p].includes(p), `'${p}' kendi listesinde`);
  }
});

test("oturuyor → koşuyor REDDEDİLİR ve gerekçe `kalk` der", () => {
  const m = new PozMakinesi("oturuyor");
  const s = m.gec("koşuyor");
  assert.equal(s.ok, false);
  assert.equal(m.poz, "oturuyor", "reddedilen geçiş durumu bozmamalı");
  assert.match(s.neden ?? "", /kalk/i);
  assert.match(s.neden ?? "", /geçersiz/i);
});

test("oturuyor → duruyor TEK çıkış yolu", () => {
  assert.deepEqual([...GECISLER.oturuyor], ["duruyor"]);
  const m = new PozMakinesi("oturuyor");
  assert.equal(m.gec("duruyor").ok, true);
  assert.equal(m.poz, "duruyor");
});

test("yürüyor → oturuyor reddedilir (sandalyeye uçarak oturulmaz)", () => {
  const m = new PozMakinesi("yürüyor");
  const s = m.gec("oturuyor");
  assert.equal(s.ok, false);
  assert.equal(m.poz, "yürüyor");
});

test("aynı poza geçiş ok ama degisti:false — geçiş yaşı sıfırlanmaz", () => {
  const m = new PozMakinesi("duruyor");
  m.ilerle(1.5);
  const s = m.gec("duruyor");
  assert.equal(s.ok, true);
  assert.equal(s.degisti, false);
  assert.equal(m.yas, 1.5);
});

test("gerçek geçiş yaşı sıfırlar ve önceki pozu saklar", () => {
  const m = new PozMakinesi("duruyor");
  m.ilerle(2);
  assert.equal(m.gec("yürüyor").degisti, true);
  assert.equal(m.yas, 0);
  assert.equal(m.onceki, "duruyor");
  assert.equal(m.poz, "yürüyor");
});

test("yürüyor ↔ koşuyor serbest, geri dönüş de var", () => {
  const m = new PozMakinesi("yürüyor");
  assert.equal(m.gec("koşuyor").ok, true);
  assert.equal(m.gec("yürüyor").ok, true);
  assert.equal(m.gec("duruyor").ok, true);
});

test("hareketliMi yalnızca yürüyor/koşuyor için doğru", () => {
  const beklenen: Record<Poz, boolean> = {
    duruyor: false, oturuyor: false, yatıyor: false, eğiliyor: false,
    yürüyor: true, koşuyor: true, bakıyor: false,
  };
  for (const p of POZLAR) assert.equal(hareketliMi(p), beklenen[p], p);
});

test("her poz duruyor'a dönebilir — kilitlenen durum yok", () => {
  for (const p of POZLAR) {
    if (p === "duruyor") continue;
    const m = new PozMakinesi(p);
    assert.equal(m.gec("duruyor").ok, true, `'${p}' kilitli kalıyor`);
  }
});

test("gecebilirMi durumu DEĞİŞTİRMEZ", () => {
  const m = new PozMakinesi("oturuyor");
  assert.equal(m.gecebilirMi("koşuyor"), false);
  assert.equal(m.gecebilirMi("duruyor"), true);
  assert.equal(m.poz, "oturuyor");
});
