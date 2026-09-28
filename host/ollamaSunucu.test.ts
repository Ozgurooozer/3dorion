// host/ollamaSunucu.test.ts — Ollama'yı yalnızca GEREKİRSE başlat, yalnızca
// KENDİ başlattığını kapat, hiçbir durumda açılışı düşürme.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { ollamaAdresi, ollamaHazirla } from "./ollamaSunucu.js";

/** Kaçıncı yoklamada ayağa kalkacağı ayarlanabilen sahte sunucu. */
function sahteFetch(kacinciYoklamada: number) {
  let n = 0;
  return (async () => {
    n++;
    if (n < kacinciYoklamada) throw new TypeError("fetch failed");
    return { ok: true } as Response;
  }) as unknown as typeof fetch;
}

function sahteSurec() {
  const s = Object.assign(new EventEmitter(), { stderr: new EventEmitter(), olduruldu: false, kill() { s.olduruldu = true; } });
  return s;
}

const sessiz = () => {};

test("ayaktaysa İKİNCİ süreç açılmaz ve kapat() hiçbir şeyi öldürmez", async () => {
  let spawnSayisi = 0;
  const h = await ollamaHazirla({
    env: {}, fetch: sahteFetch(1), log: sessiz,
    spawn: () => { spawnSayisi++; return sahteSurec(); },
  });
  assert.equal(h.durum, "zaten-ayakta");
  assert.equal(spawnSayisi, 0);
  h.kapat();
});

test("kapalıysa `ollama serve` başlatılır; kapat() yalnızca onu öldürür", async () => {
  const s = sahteSurec();
  let argv: string[] = [];
  const h = await ollamaHazirla({
    env: {}, fetch: sahteFetch(3), log: sessiz, aralikMs: 1,
    spawn: (k, a) => { argv = [k, ...a]; return s; },
  });
  assert.equal(h.durum, "baslatildi");
  assert.deepEqual(argv, ["ollama", "serve"]);
  assert.equal(s.olduruldu, false);
  h.kapat();
  assert.equal(s.olduruldu, true);
});

test("ORION_OLLAMA=0 → hiç dokunulmaz", async () => {
  let dokunuldu = false;
  const h = await ollamaHazirla({
    env: { ORION_OLLAMA: "0" }, log: sessiz,
    fetch: (async () => { dokunuldu = true; return { ok: true }; }) as unknown as typeof fetch,
    spawn: () => { dokunuldu = true; return sahteSurec(); },
  });
  assert.equal(h.durum, "kapali-istendi");
  assert.equal(dokunuldu, false);
});

test("kurulu değilse (spawn 'error') FIRLATMAZ, hemen döner", async () => {
  const s = sahteSurec();
  const t0 = Date.now();
  const h = await ollamaHazirla({
    env: {}, fetch: sahteFetch(Infinity), log: sessiz, aralikMs: 5, beklemeMs: 3000,
    spawn: () => { setTimeout(() => s.emit("error", new Error("spawn ollama ENOENT")), 1); return s; },
  });
  assert.equal(h.durum, "baslatilamadi");
  assert.ok(Date.now() - t0 < 1000, "hata sonrası tavana kadar beklendi");
});

test("spawn senkron fırlatsa da açılış düşmez", async () => {
  const h = await ollamaHazirla({
    env: {}, fetch: sahteFetch(Infinity), log: sessiz,
    spawn: () => { throw new Error("EACCES"); },
  });
  assert.equal(h.durum, "baslatilamadi");
});

test("OLLAMA_HOST biçimleri bağlanılabilir adrese çevrilir", () => {
  assert.equal(ollamaAdresi(undefined), "http://127.0.0.1:11434");
  assert.equal(ollamaAdresi("0.0.0.0:11434"), "http://127.0.0.1:11434");
  assert.equal(ollamaAdresi("127.0.0.1"), "http://127.0.0.1:11434");
  assert.equal(ollamaAdresi("http://10.0.0.5:9000/"), "http://10.0.0.5:9000");
});
