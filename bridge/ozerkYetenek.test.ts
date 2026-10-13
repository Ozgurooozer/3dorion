// bridge/ozerkYetenek.test.ts — Sessizlik uyanışı yalnız susabildiği ölçülen beyinlere.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { sessizlikIzinliMi } from "./ozerkYetenek.ts";

test("iki sette de susabildiği ölçülen beyinler izinli (kayıttaki ad biçimiyle, :latest ekiyle de)", () => {
  assert.deepEqual(["claude:haiku", "gemma4:e2b", "gemma4:e2b:latest"].map(sessizlikIzinliMi), [true, true, true]);
});

test("görmediği sette susamayan ya da hiç susamayan beyinler izinsiz", () => {
  assert.deepEqual(["ornith-32k:latest", "qwen2.5:7b"].map(sessizlikIzinliMi), [false, false]);
});

test("ölçülmemiş beyin izinsiz (varsayımla izin yok)", () => {
  assert.deepEqual(["mcp", "lfm25-tb:latest", ""].map(sessizlikIzinliMi), [false, false, false]);
});
