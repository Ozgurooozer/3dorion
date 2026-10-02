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

test("konuşma turunda iş isteği örneği de var: beden araçları sözün yanında çağrılır", () => {
  const o = ornekUret({ terminal: false, konusma: true });
  const adlar = o.flatMap((m) => m.tool_calls ?? []).map((c) => c.function.name);
  assert.deepEqual(adlar, ["dunya_soyle", "dunya_kalk", "dunya_git", "dunya_soyle"]);
});

test("çok çağrılı örnekte her çağrıyı kendi tool sonucu izler", () => {
  const o = ornekUret({ terminal: false, konusma: true });
  for (let i = 0; i < o.length; i++) {
    const n = o[i]!.tool_calls?.length ?? 0;
    for (let k = 1; k <= n; k++) assert.equal(o[i + k]?.role, "tool", `mesaj ${i}: ${k}. çağrının sonucu yok`);
  }
});

test("eylem örneği ölçümdeki komutların kopyası değil — ölçüm kendini doğrulamasın", () => {
  const metin = JSON.stringify(ornekUret({ terminal: false, konusma: true })).toLocaleLowerCase("tr-TR");
  for (const komut of ["otur", "bana gel", "yanıma gel", "bilgisayar", "tahta", "pencere"]) {
    assert.ok(!metin.includes(komut), `örnekte ölçüm komutu geçiyor: ${komut}`);
  }
});
