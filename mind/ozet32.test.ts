// mind/ozet32.test.ts — FNV-1a 32 bit: yayımlanmış test vektörleri (isthe.com/chongo/tech/comp/fnv).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ozet32 } from "./ozet32.ts";

test("FNV-1a 32 bit, bilinen değerler: boş dizgi, 'a', 'foobar'", () => {
  assert.deepEqual(["", "a", "foobar"].map(ozet32), [0x811c9dc5, 0xe40c292c, 0xbf9cf968]);
});
