// host/dinleme.test.ts — Orion'un kulağının süreç istemcisi, gerçek Python/mikrofon olmadan.
//
// Sahte süreç: stdout'a JSON satırı basar, stdin'e yazılanı toplar.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Dinleyici, satirCoz, type DinlemeOlayi } from "./dinleme.js";

function sahteSurec() {
  const s = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    yazilan: [] as string[],
    olduruldu: false,
    stdin: { write(v: string) { s.yazilan.push(v); }, end() {} },
    kill() { s.olduruldu = true; },
  });
  return s;
}

function kur() {
  const surec = sahteSurec();
  const olaylar: DinlemeOlayi[] = [];
  let acilis = 0;
  const d = new Dinleyici((o) => olaylar.push(o), { spawn: () => { acilis++; return surec; } });
  return { d, surec, olaylar, acilisSayisi: () => acilis };
}

test("JSON olmayan satır (kütüphane uyarısı) olay sayılmaz", () => {
  assert.equal(satirCoz("UserWarning: max_length"), null);
});

test("`olay` alanı olmayan JSON olay sayılmaz", () => {
  assert.equal(satirCoz('{"metin":"x"}'), null);
});

test("geçerli satır olaya çevrilir", () => {
  assert.deepEqual(satirCoz('{"olay":"bos","neden":"sessiz"}'), { olay: "bos", neden: "sessiz" });
});

test("süreç tembel başlar: kurucu bir şey açmaz", () => {
  assert.equal(kur().acilisSayisi(), 0);
});

test("ikinci baslat() ikinci süreç açmaz", () => {
  const { d, acilisSayisi } = kur();
  d.baslat(); d.baslat();
  assert.equal(acilisSayisi(), 1);
});

test("stdout'tan gelen tanıma renderer olayına çıkar", () => {
  const { d, surec, olaylar } = kur();
  d.baslat();
  surec.stdout.emit("data", Buffer.from('{"olay":"tanima","metin":"sit down","ms":300,"sure":1.2,"tepe":0.4}\n'));
  assert.deepEqual(olaylar, [{ olay: "tanima", metin: "sit down", ms: 300, sure: 1.2, tepe: 0.4 }]);
});

test("satır iki parçada gelse de bir olay olur", () => {
  const { d, surec, olaylar } = kur();
  d.baslat();
  surec.stdout.emit("data", Buffer.from('{"olay":"bos","ned'));
  surec.stdout.emit("data", Buffer.from('en":"sessiz"}\n'));
  assert.equal(olaylar.length, 1);
});

test("Türkçe/Unicode metin parça sınırında bozulmaz", () => {
  const { d, surec, olaylar } = kur();
  d.baslat();
  const b = Buffer.from('{"olay":"tanima","metin":"şişe","ms":1,"sure":1,"tepe":1}\n', "utf8");
  const kes = b.indexOf(0xc5) + 1;   // "ş"nin iki baytının ortası
  surec.stdout.emit("data", b.subarray(0, kes));
  surec.stdout.emit("data", b.subarray(kes));
  assert.equal((olaylar[0] as { metin: string }).metin, "şişe");
});

test("kayit() ve dur() sürece satır olarak gider", () => {
  const { d, surec } = kur();
  d.baslat(); d.kayit(); d.dur();
  assert.deepEqual(surec.yazilan, ["kayit\n", "dur\n"]);
});

test("süreç yokken kayit() false döner ve çökmez", () => {
  assert.equal(kur().d.kayit(), false);
});

test("süreç kapanırsa `kapandi` olayı gelir ve yeniden başlatılabilir", () => {
  const { d, surec, olaylar, acilisSayisi } = kur();
  d.baslat();
  surec.emit("close", 1);
  d.baslat();
  assert.deepEqual([olaylar.at(-1)?.olay, acilisSayisi()], ["kapandi", 2]);
});

test("açılamayan süreç `hata` olayı verir, sessiz kalmaz", () => {
  const olaylar: DinlemeOlayi[] = [];
  const d = new Dinleyici((o) => olaylar.push(o), { spawn: () => { throw new Error("ENOENT"); } });
  d.baslat();
  assert.match((olaylar[0] as { hata: string }).hata, /ENOENT/);
});

test("kapat() cik gönderir ve süreci öldürür", () => {
  const { d, surec } = kur();
  d.baslat(); d.kapat();
  assert.deepEqual([surec.yazilan.at(-1), surec.olduruldu], ["cik\n", true]);
});
