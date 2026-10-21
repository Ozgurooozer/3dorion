// host/ses.test.ts — Piper istemcisi (host/ses.js), SAHTE süreçle (piper.exe açılmaz, ses çalınmaz): seri sıra, çalışma anında ses değişimi
// (boşta hemen; uçuşta cümle eski sesle biter, sıradaki yeni sesle), kapatılan eski sürecin geç `exit`'inin yeni süreci bozmaması.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PiperSesi, type SurecAcici } from "./ses.js";

interface SahteSurec {
  model: string;
  satirlar: string[];
  olduruldu: boolean;
  /** Bekleyen satıra yanıt ver (wav dosyasını da yazar). */
  yanitla(): void;
}

/** Sahte piper: argv'den modeli okur, stdin satırlarını biriktirir; `kendiligindenYanitla` ise her satıra hemen wav yolu basar. */
function sahte(kendiligindenYanitla: boolean) {
  const dizin = fs.mkdtempSync(path.join(os.tmpdir(), "orion-piper-sahte-"));
  const modelDosyalari = ["a.onnx", "b.onnx"].map((f) => { const y = path.join(dizin, f); fs.writeFileSync(y, "m"); return y; });
  const surecler: SahteSurec[] = [];
  let sayac = 0;
  const surecAc: SurecAcici = (_exe, argv) => {
    const olaylar = new EventEmitter();
    const stdout = new EventEmitter();
    let bekleyen = 0;
    const s: SahteSurec = {
      model: path.basename(String(argv[argv.indexOf("--model") + 1])),
      satirlar: [], olduruldu: false,
      yanitla: () => {
        if (bekleyen === 0) return;
        bekleyen--;
        const wav = path.join(dizin, `${s.model}-${++sayac}.wav`);
        fs.writeFileSync(wav, "RIFF");
        stdout.emit("data", `${wav}\n`);
      },
    };
    surecler.push(s);
    return {
      stdin: { write: (v: string) => { s.satirlar.push(v.trim()); bekleyen++; if (kendiligindenYanitla) setImmediate(() => s.yanitla()); return true; }, end: () => {} },
      stdout: { setEncoding: () => {}, on: (_o: "data", f: (parca: string) => void) => stdout.on("data", f) },
      stderr: { setEncoding: () => {}, on: () => {} },
      on: (o: "error" | "exit", f: (x: unknown) => void) => olaylar.on(o, f),
      kill: () => { s.olduruldu = true; setImmediate(() => olaylar.emit("exit", 1)); },
    };
  };
  const ses = new PiperSesi(dizin, { exe: "piper.exe", model: modelDosyalari[0]!, surecAc, hazirBeklemeMs: 0 });
  return { ses, surecler, a: modelDosyalari[0]!, b: modelDosyalari[1]! };
}
const bekle = (ms = 5) => new Promise((c) => setTimeout(c, ms));

test("sıra: art arda iki cümle sırayla aynı süreçte üretilir", async () => {
  const t = sahte(true);
  const [r1, r2] = await Promise.all([t.ses.uret("bir"), t.ses.uret("iki")]);
  assert.deepEqual([r1.ok && path.basename(r1.yol), r2.ok && path.basename(r2.yol), t.surecler.length], ["a.onnx-1.wav", "a.onnx-2.wav", 1]);
  t.ses.kapat();
});

test("ses değişimi BOŞTAYKEN: eski süreç kapanır, sonraki cümle yeni modelle açılan süreçte", async () => {
  const t = sahte(true);
  await t.ses.uret("bir");
  t.ses.modelAyarla(t.b);
  const r = await t.ses.uret("iki");
  assert.deepEqual([t.surecler[0]!.olduruldu, t.surecler[1]?.model, r.ok], [true, "b.onnx", true]);
  t.ses.kapat();
});

test("ses değişimi UÇUŞTAYKEN: bekleyen cümle ESKİ sesle tamamlanır (kesilmez)", async () => {
  const t = sahte(false);
  const ilk = t.ses.uret("bir");
  await bekle();   // "bir" piper'a yazıldı, yanıt bekleniyor
  t.ses.modelAyarla(t.b);
  t.surecler[0]!.yanitla();
  const r = await ilk;
  assert.equal(r.ok && path.basename(r.yol), "a.onnx-1.wav");
  t.ses.kapat();
});

test("ses değişimi UÇUŞTAYKEN: kuyruktaki sonraki cümle yeni süreçte, yanıtlar kaymaz", async () => {
  const t = sahte(false);
  const ilk = t.ses.uret("bir");
  await bekle();
  t.ses.modelAyarla(t.b);
  const ikinci = t.ses.uret("iki");
  await bekle();
  t.surecler[0]!.yanitla();
  await ilk;
  await bekle();
  t.surecler[1]!.yanitla();
  const r = await ikinci;
  assert.deepEqual([t.surecler[0]!.satirlar, t.surecler[1]!.satirlar, r.ok && path.basename(r.yol)], [["bir"], ["iki"], "b.onnx-2.wav"]);
  t.ses.kapat();
});

test("kapatılan ESKİ sürecin geç gelen exit'i yeni sürecin işini reddetmez", async () => {
  const t = sahte(false);
  const ilk = t.ses.uret("bir");
  await bekle();
  t.ses.modelAyarla(t.b);
  const ikinci = t.ses.uret("iki");
  await bekle();
  t.surecler[0]!.yanitla();
  await ilk;
  await bekle(20);   // eski sürecin kill → exit olayı bu arada geldi
  t.surecler[1]!.yanitla();
  assert.equal((await ikinci).ok, true);
  t.ses.kapat();
});

test("aynı modele 'değiştirmek' süreci yeniden başlatmaz", async () => {
  const t = sahte(true);
  await t.ses.uret("bir");
  t.ses.modelAyarla(t.a);
  await t.ses.uret("iki");
  assert.equal(t.surecler.length, 1);
  t.ses.kapat();
});

test("model kaldırılırsa (null) üretim nedenle düşer, istisna atmaz", async () => {
  const t = sahte(true);
  t.ses.modelAyarla(null);
  const r = await t.ses.uret("bir");
  assert.equal(r.ok, false);
});

test("kapat: bekleyen cümle 'kapatıldı' ile düşer", async () => {
  const t = sahte(false);
  const ilk = t.ses.uret("bir");
  await bekle();
  t.ses.kapat();
  const r = await ilk;
  assert.equal(!r.ok && r.hata, "piper kapatıldı");
});
