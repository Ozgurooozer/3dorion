// uygulama/terminalYazici.test.ts — Onaylanan komut, Orion nerede olursa olsun terminale (kamera kaçırmadan).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { komutuTerminaleYaz, type YazilacakTerminal } from "./terminalYazici.ts";

function sahte(acik: boolean, acilmaz = false) {
  const olaylar: string[] = [];
  const t: YazilacakTerminal = {
    acikMi: () => acik,
    ac: async () => { if (acilmaz) throw new Error("pty yok"); olaylar.push("ac"); acik = true; },
    yaz: (v) => { olaylar.push(`yaz:${JSON.stringify(v)}`); },
  };
  return { t, olaylar };
}

test("açık terminale komut Enter'la yazılır", async () => {
  const { t, olaylar } = sahte(true);
  await komutuTerminaleYaz(t, "ls");
  assert.deepEqual(olaylar, ['yaz:"ls\\r"']);
});

test("kapalı terminal önce açılır, sonra yazılır", async () => {
  const { t, olaylar } = sahte(false);
  await komutuTerminaleYaz(t, "git status");
  assert.deepEqual(olaylar, ["ac", 'yaz:"git status\\r"']);
});

test("açılamayan terminal hata verir ve hiçbir şey yazılmaz", async () => {
  const { t, olaylar } = sahte(false, true);
  await assert.rejects(komutuTerminaleYaz(t, "ls"), /pty yok/);
  assert.deepEqual(olaylar, []);
});
