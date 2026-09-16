// bridge/ornekler.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ornekUret } from "./ornekler.ts";

test("bağlam yoksa örnek de yok — bedava token harcanmaz", () => {
  assert.deepEqual(ornekUret({ terminal: false, konusma: false }), []);
});

test("terminal bağlamında komut önerme örneği verilir", () => {
  const o = ornekUret({ terminal: true, konusma: false });
  assert.ok(o.length > 0);
  const cagri = o.find((m) => m.tool_calls)?.tool_calls?.[0];
  assert.equal(cagri?.function.name, "dunya_komut");
});

test("konuşma bağlamında cevap verme örneği verilir", () => {
  const o = ornekUret({ terminal: false, konusma: true });
  const cagri = o.find((m) => m.tool_calls)?.tool_calls?.[0];
  assert.equal(cagri?.function.name, "dunya_soyle");
});

test("EN FAZLA bir örnek — bağlam iki katına çıkmasın", () => {
  const o = ornekUret({ terminal: true, konusma: true });
  const cagriSayisi = o.filter((m) => m.tool_calls).length;
  assert.equal(cagriSayisi, 1);
});

test("örnek, sınavdaki vakanın KOPYASI değil — ölçüm kendini doğrulamasın", () => {
  const metin = JSON.stringify(ornekUret({ terminal: true, konusma: false }));
  assert.ok(!metin.includes("gti"), "ölçümde kullanılan 'gti' örnekte geçmemeli");
  assert.ok(metin.includes("pyhton"), "örnek farklı bir yazım hatası kullanmalı");
});

test("örnek mesajları geçerli biçimde: arac cagrisini tool sonucu izler", () => {
  const o = ornekUret({ terminal: true, konusma: false });
  const i = o.findIndex((m) => m.tool_calls);
  assert.ok(i >= 0);
  assert.equal(o[i + 1]?.role, "tool", "arac cagrisini tool mesaji izlemeli");
});
