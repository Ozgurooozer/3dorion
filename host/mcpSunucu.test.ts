// host/mcpSunucu.test.ts — MCP HTTP ucu: JSON-RPC doğru, yerel, takılmaz.
//
// NAİF ÇÖZÜMDEN ÖNCE yazıldı. Hedeflenen çöküş biçimleri:
//   - tarayıcıdaki bir sayfa yerel porta POST atıp araç çağırır (DNS rebinding)
//   - bildirim (id'siz mesaj) cevap bekler → istemci takılır
//   - röle cevap vermezse HTTP isteği sonsuza kadar açık kalır
//   - bilinmeyen yöntem sessizce yutulur
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mcpSunucuKur } from "./mcpSunucu.js";

async function sunucu(role: (yontem: string, param: unknown) => Promise<unknown>, releSiniriMs = 2000) {
  const s = mcpSunucuKur({ port: 0, role, releSiniriMs });
  await s.hazir;
  return s;
}

async function rpc(port: number, govde: unknown, basliklar: Record<string, string> = {}) {
  const y = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...basliklar },
    body: JSON.stringify(govde),
  });
  const metin = await y.text();
  return { durum: y.status, json: metin ? JSON.parse(metin) : null };
}

test("initialize: sürüm ve araç yeteneği döner", async () => {
  const s = await sunucu(async () => ({}));
  try {
    const r = await rpc(s.port, { jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } });
    assert.equal(r.durum, 200);
    assert.equal(r.json.id, 1);
    assert.equal(r.json.result.protocolVersion, "2025-06-18");
    assert.ok(r.json.result.capabilities.tools, "arac yetenegi bildirilmedi");
  } finally { s.kapat(); }
});

test("BİLDİRİM (id yok) cevap beklemez — 202, gövde yok", async () => {
  const s = await sunucu(async () => ({}));
  try {
    const r = await rpc(s.port, { jsonrpc: "2.0", method: "notifications/initialized" });
    assert.equal(r.durum, 202);
    assert.equal(r.json, null);
  } finally { s.kapat(); }
});

test("tools/list ve tools/call RÖLEYE gider, sonucu aynen döner", async () => {
  const gorulen: string[] = [];
  const s = await sunucu(async (yontem, param) => {
    gorulen.push(yontem);
    if (yontem === "tools/list") return { tools: [{ name: "dunya_soyle", inputSchema: { type: "object" } }] };
    return { content: [{ type: "text", text: `cagrildi: ${(param as { name: string }).name}` }] };
  });
  try {
    const l = await rpc(s.port, { jsonrpc: "2.0", id: 2, method: "tools/list" });
    assert.equal(l.json.result.tools[0].name, "dunya_soyle");
    const c = await rpc(s.port, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "dunya_soyle", arguments: { metin: "x" } } });
    assert.equal(c.json.result.content[0].text, "cagrildi: dunya_soyle");
    assert.deepEqual(gorulen, ["tools/list", "tools/call"]);
  } finally { s.kapat(); }
});

test("GÜVENLİK: yabancı Origin REDDEDİLİR — tarayıcı sayfası araç çağıramaz", async () => {
  let cagrildi = false;
  const s = await sunucu(async () => { cagrildi = true; return {}; });
  try {
    const r = await rpc(s.port, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "dunya_komut" } },
      { Origin: "https://kotu-niyetli.example" });
    assert.equal(r.durum, 403);
    assert.equal(cagrildi, false, "yabanci Origin roleye ulasti");
  } finally { s.kapat(); }
});

test("GÜVENLİK: localhost Origin'e izin verilir (yerel araçlar)", async () => {
  const s = await sunucu(async () => ({ tools: [] }));
  try {
    const r = await rpc(s.port, { jsonrpc: "2.0", id: 5, method: "tools/list" }, { Origin: "http://localhost:5173" });
    assert.equal(r.durum, 200);
  } finally { s.kapat(); }
});

test("röle CEVAP VERMEZSE istek takılmaz — JSON-RPC hatası döner", async () => {
  const s = await sunucu(() => new Promise(() => {}), 150);
  try {
    const t0 = Date.now();
    const r = await rpc(s.port, { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "dunya_bekle" } });
    assert.ok(Date.now() - t0 < 1500, "istek takildi");
    assert.ok(r.json.error, "hata donmedi");
  } finally { s.kapat(); }
});

test("bilinmeyen yöntem -32601 ile reddedilir, sessizce yutulmaz", async () => {
  const s = await sunucu(async () => ({}));
  try {
    const r = await rpc(s.port, { jsonrpc: "2.0", id: 7, method: "resources/list" });
    assert.equal(r.json.error.code, -32601);
  } finally { s.kapat(); }
});

test("bozuk JSON -32700 ile reddedilir", async () => {
  const s = await sunucu(async () => ({}));
  try {
    const y = await fetch(`http://127.0.0.1:${s.port}/mcp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bozuk" });
    const j = await y.json();
    assert.equal(j.error.code, -32700);
  } finally { s.kapat(); }
});

test("initialize OTURUM BAŞLANGICINI bildirir — talimat yeniden gitsin", async () => {
  let bildirim = 0;
  const s = mcpSunucuKur({ port: 0, role: async () => ({}), oturumBasladi: () => { bildirim++; } });
  await s.hazir;
  try {
    await rpc(s.port, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
    assert.equal(bildirim, 1, "initialize oturum baslangicini bildirmedi");
  } finally { s.kapat(); }
});

test("İSTEMCİ BAĞLANTIYI KOPARIRSA röleye iptal sinyali gider (R1)", async () => {
  let iptal: AbortSignal | undefined;
  const s = mcpSunucuKur({
    port: 0, releSiniriMs: 5000,
    role: (_y, _p, sinyal) => { iptal = sinyal; return new Promise(() => {}); },
  });
  await s.hazir;
  try {
    const ac = new AbortController();
    const istek = fetch(`http://127.0.0.1:${s.port}/mcp`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ac.signal,
      body: JSON.stringify({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "dunya_bekle" } }),
    }).catch(() => {});
    await new Promise((r) => setTimeout(r, 100));
    ac.abort();                       // ajan öldü
    await istek;
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(iptal, "role sinyal almadi");
    assert.equal(iptal!.aborted, true, "kopan baglanti roleye bildirilmedi");
  } finally { s.kapat(); }
});
