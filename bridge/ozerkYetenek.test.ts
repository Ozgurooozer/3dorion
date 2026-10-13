// bridge/ozerkYetenek.test.ts — Sessizlik uyanışı yalnız susabildiği ölçülen beyinlere.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { sessizlikIzinliMi } from "./ozerkYetenek.ts";

test("susabildiği ölçülen beyinler izinli (kayıttaki ad biçimiyle, :latest ekiyle de)", () => {
  assert.deepEqual(["claude:haiku", "ornith-32k:latest"].map(sessizlikIzinliMi), [true, true]);
});

test("susamadığı ölçülen beyinler izinsiz", () => {
  assert.deepEqual(["qwen2.5:7b", "gemma4:e2b"].map(sessizlikIzinliMi), [false, false]);
});

test("ölçülmemiş beyin izinsiz (varsayımla izin yok)", () => {
  assert.deepEqual(["mcp", "lfm25-tb:latest", ""].map(sessizlikIzinliMi), [false, false, false]);
});
