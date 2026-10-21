// host/sesIndir.test.ts — Ses indirme (spec 34): YEREL http sunucusuyla (gerçek ağ YOK). Atomik ad değiştirme, boyut/JSON doğrulaması, 404,
// yarım bağlantı, iptal; hiçbir hatada `.part` ya da yarım çift kalmaz, var olan dosyaya dokunulmaz.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { sesIndir } from "./sesIndir.js";
import { kuruluSesler, type KatalogSesi, type SesIndirmeIlerlemesi } from "./sesler.js";

const SES: KatalogSesi = { dil: "tr_TR", konusmaci: "deneme", kalite: "medium", baslik: "deneme", dahili: false, boyut: { onnx: 2000, json: 20 } };
const JSON_ICERIK = JSON.stringify({ language: { code: "tr_TR" }, x: 1 });   // 20 bayt değil; tolerans içinde kalsın diye boyut aşağıda ayarlı
const ONNX = Buffer.alloc(2000, 7);

interface Davranis { json?: "404" | "bozuk" | "kopuk" | "buyuk"; onnx?: "404" | "kopuk" | "yavas" }
async function sunucu(d: Davranis = {}): Promise<{ kok: string; kapat(): Promise<void> }> {
  const s = http.createServer((istek, yanit) => {
    const url = istek.url ?? "";
    if (url.endsWith(".onnx.json")) {
      if (d.json === "404") { yanit.writeHead(404); yanit.end("yok"); return; }
      const govde = d.json === "bozuk" ? "{yarım-json-kırk-bayt-...........xx" : d.json === "buyuk" ? "x".repeat(400) : JSON_ICERIK;
      if (d.json === "kopuk") { yanit.writeHead(200, { "content-length": "40" }); yanit.write(govde.slice(0, 5)); yanit.destroy(); return; }
      yanit.writeHead(200, { "content-length": String(Buffer.byteLength(govde)) }); yanit.end(govde); return;
    }
    if (url.endsWith(".onnx")) {
      if (d.onnx === "404") { yanit.writeHead(404); yanit.end("yok"); return; }
      yanit.writeHead(200, { "content-length": String(ONNX.length) });
      if (d.onnx === "kopuk") { yanit.write(ONNX.subarray(0, 500)); yanit.destroy(); return; }
      if (d.onnx === "yavas") { yanit.write(ONNX.subarray(0, 500)); return; }   // asla bitmez: iptal testi
      yanit.end(ONNX); return;
    }
    yanit.writeHead(404); yanit.end();
  });
  await new Promise<void>((c) => s.listen(0, "127.0.0.1", c));
  const port = (s.address() as AddressInfo).port;
  return { kok: `http://127.0.0.1:${port}`, kapat: () => new Promise<void>((c) => { s.closeAllConnections(); s.close(() => c()); }) };
}
const SES_JSONLU: KatalogSesi = { ...SES, boyut: { onnx: 2000, json: Buffer.byteLength(JSON_ICERIK) } };
function gecici(): string { return fs.mkdtempSync(path.join(os.tmpdir(), "orion-sesindir-test-")); }
const kalanlar = (d: string) => fs.readdirSync(d).sort();

test("indirme: iki dosya da iner ve ses KURULU görünür", async () => {
  const s = await sunucu(); const d = gecici();
  try { await sesIndir({ ses: SES_JSONLU, dizin: d, kok: s.kok }); } finally { await s.kapat(); }
  assert.deepEqual(kuruluSesler(d).gecerli.map((x) => x.ad), ["tr_TR-deneme-medium"]);
});

test("indirme: başarıda hiç .part kalmaz", async () => {
  const s = await sunucu(); const d = gecici();
  try { await sesIndir({ ses: SES_JSONLU, dizin: d, kok: s.kok }); } finally { await s.kapat(); }
  assert.deepEqual(kalanlar(d), ["tr_TR-deneme-medium.onnx", "tr_TR-deneme-medium.onnx.json"]);
});

test("indirme: ilerleme her dosyanın sonunda tam boyutu bildirir", async () => {
  const s = await sunucu(); const d = gecici();
  const olaylar: SesIndirmeIlerlemesi[] = [];
  try { await sesIndir({ ses: SES_JSONLU, dizin: d, kok: s.kok, ilerleme: (o) => olaylar.push(o) }); } finally { await s.kapat(); }
  assert.deepEqual(olaylar.filter((o) => o.alinan === o.toplam).map((o) => o.dosya), ["json", "onnx"]);
});

test("indirme: 404 → kod 'ag', dizinde hiçbir şey kalmaz", async () => {
  const s = await sunucu({ onnx: "404" }); const d = gecici();
  try { await assert.rejects(sesIndir({ ses: SES_JSONLU, dizin: d, kok: s.kok }), (e: { kod?: string }) => e.kod === "ag"); } finally { await s.kapat(); }
  assert.deepEqual(kalanlar(d), []);
});

test("indirme: bağlantı yarıda koparsa yarım dosya kalmaz", async () => {
  const s = await sunucu({ onnx: "kopuk" }); const d = gecici();
  try { await assert.rejects(sesIndir({ ses: SES_JSONLU, dizin: d, kok: s.kok })); } finally { await s.kapat(); }
  assert.deepEqual(kalanlar(d), []);
});

test("indirme: json ayrışmazsa kod 'bozuk' ve çift kurulmaz", async () => {
  const s = await sunucu({ json: "bozuk" }); const d = gecici();
  const ses = { ...SES, boyut: { onnx: 2000, json: Buffer.byteLength("{yarım-json-kırk-bayt-...........xx") } };
  try { await assert.rejects(sesIndir({ ses, dizin: d, kok: s.kok }), (e: { kod?: string }) => e.kod === "bozuk"); } finally { await s.kapat(); }
  assert.deepEqual(kalanlar(d), []);
});

test("indirme: sunucu kataloğa uymayan boyut bildirirse (±%20 dışı) kod 'boyut'", async () => {
  const s = await sunucu({ json: "buyuk" }); const d = gecici();
  try { await assert.rejects(sesIndir({ ses: SES_JSONLU, dizin: d, kok: s.kok }), (e: { kod?: string }) => e.kod === "boyut"); } finally { await s.kapat(); }
  assert.deepEqual(kalanlar(d), []);
});

test("indirme: iptal edilirse kod 'iptal' ve .part silinir", async () => {
  const s = await sunucu({ onnx: "yavas" }); const d = gecici();
  const ab = new AbortController();
  const ilerleme = (o: SesIndirmeIlerlemesi) => { if (o.dosya === "onnx") ab.abort(); };
  try { await assert.rejects(sesIndir({ ses: SES_JSONLU, dizin: d, kok: s.kok, sinyal: ab.signal, ilerleme }), (e: { kod?: string }) => e.kod === "iptal"); } finally { await s.kapat(); }
  assert.deepEqual(kalanlar(d), []);
});

test("indirme: hata olursa önceden var olan başka sese dokunulmaz", async () => {
  const s = await sunucu({ onnx: "404" }); const d = gecici();
  fs.writeFileSync(path.join(d, "tr_TR-dfki-medium.onnx"), "eski");
  try { await assert.rejects(sesIndir({ ses: SES_JSONLU, dizin: d, kok: s.kok })); } finally { await s.kapat(); }
  assert.deepEqual(kalanlar(d), ["tr_TR-dfki-medium.onnx"]);
});
