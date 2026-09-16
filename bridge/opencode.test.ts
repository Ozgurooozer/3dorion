// bridge/opencode.test.ts — sağlayıcı arızası karşısındaki davranış.
//
// Gerçek sunucu YOK: `fetch` yerine konur. Sınanan şey ağ değil, arıza
// karşısındaki KARAR — kota dolduğunda dünyanın ne yaptığı.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OpenCodeBeyni } from "./opencode.ts";
import { araclariUret } from "./araclar.ts";

const GIRDI = { ozetler: [], dunya: "oda", gecmis: [], araclar: araclariUret() };

/** fetch'i sahteyle değiştirir, testten sonra geri verir. */
function fetchYerineKoy(cevap: (yol: string) => unknown): () => void {
  const eski = globalThis.fetch;
  globalThis.fetch = (async (u: string | URL) => {
    const yol = String(u);
    const g = cevap(yol);
    return { ok: true, status: 200, text: async () => JSON.stringify(g) } as Response;
  }) as typeof fetch;
  return () => { globalThis.fetch = eski; };
}

/** Oturum açma her testte aynı; yalnızca mesaj yanıtı değişir. */
function sunucu(mesajYaniti: unknown) {
  return fetchYerineKoy((yol) =>
    yol.endsWith("/session") ? { id: "ses_test" } : mesajYaniti);
}

test("gövdeye gömülü 429 SESSİZ geçmez — hata olarak yükselir", async () => {
  const geri = sunucu({
    info: { error: { name: "APIError", data: { message: "Rate limit exceeded: free-models-per-day", statusCode: 429 } } },
    parts: [],
  });
  try {
    const b = new OpenCodeBeyni();
    await assert.rejects(() => b.dusun(GIRDI), (e: Error) => {
      // Sebep okunabilir olmalı: odada "bir şeyler oldu" demek yetmez.
      assert.match(e.message, /429/);
      assert.match(e.message, /free-models-per-day/);
      return true;
    });
  } finally { geri(); }
});

test("üst üste arıza DEVREYİ KESER — dünya her algıda 30 sn beklemez", async () => {
  const geri = sunucu({
    info: { error: { data: { message: "kota", statusCode: 429 } } }, parts: [],
  });
  try {
    const b = new OpenCodeBeyni();
    for (let i = 0; i < 3; i++) await b.dusun(GIRDI).catch(() => {});
    assert.ok(b.kesikSaniye > 0, "3 arızadan sonra devre kesilmeli");

    // Kesikken istek ANINDA döner — asıl kazanç bu.
    const t0 = Date.now();
    await assert.rejects(() => b.dusun(GIRDI), /gecici kapali/);
    assert.ok(Date.now() - t0 < 50, "kesikken beklemeden dönmeli");
  } finally { geri(); }
});

test("BAŞARI seriyi kırar — tek tük arıza devreyi kesmemeli", async () => {
  let kotaVer = true;
  const geri = fetchYerineKoy((yol) => {
    if (yol.endsWith("/session")) return { id: "ses_test" };
    return kotaVer
      ? { info: { error: { data: { message: "kota", statusCode: 429 } } }, parts: [] }
      : { parts: [{ type: "text", text: "tamam" }] };
  });
  try {
    const b = new OpenCodeBeyni();
    await b.dusun(GIRDI).catch(() => {});
    await b.dusun(GIRDI).catch(() => {});
    kotaVer = false;
    await b.dusun(GIRDI);              // başarı
    kotaVer = true;
    await b.dusun(GIRDI).catch(() => {});
    assert.equal(b.kesikSaniye, 0, "araya giren başarıdan sonra devre kesilmemeli");
  } finally { geri(); }
});

test("satır sözleşmesi canlı yolda çağrıya dönüşür", async () => {
  const geri = sunucu({
    parts: [{ type: "text", text: "`gti` yazım hatası, `git` olmalı.\nKOMUT: git status | GEREKCE: durumu gor" }],
  });
  try {
    const c = await new OpenCodeBeyni().dusun(GIRDI);
    const komut = c.cagrilar.find((x) => x.ad === "dunya_komut");
    assert.ok(komut, "KOMUT satırı dunya_komut çağrısına dönmeli");
    assert.deepEqual(komut.girdi, { metin: "git status", gerekce: "durumu gor" });
    // Sözleşme satırı SÖZE karışmamalı — Orion onu sesli okumamalı.
    assert.ok(!c.metin.includes("KOMUT"), `soz kirli: "${c.metin}"`);
    assert.match(c.metin, /yaz[ıi]m hatas[ıi]/i);
  } finally { geri(); }
});

test("metne sızan araç JSON'u seslendirilmez, çağrıya çevrilir", async () => {
  const geri = sunucu({
    parts: [{ type: "text", text: 'Bakıyorum. {"name":"dunya_bak","arguments":{"hedef":"monitor"}}' }],
  });
  try {
    const c = await new OpenCodeBeyni().dusun(GIRDI);
    assert.ok(!c.metin.includes("{"), `JSON soze karisti: "${c.metin}"`);
    assert.ok(c.cagrilar.some((x) => x.ad === "dunya_bak"), "sizan cagri kurtarilmali");
  } finally { geri(); }
});

test("GÜNLÜK kota TEK arızada keser — üç deneme × 70 sn beklenmez", async () => {
  const geri = sunucu({
    info: { error: { name: "APIError", data: {
      message: "Rate limit exceeded: free-models-per-day. Add 10 credits", statusCode: 429 } } },
    parts: [],
  });
  try {
    const b = new OpenCodeBeyni();
    await b.dusun(GIRDI).catch(() => {});
    assert.ok(b.kesikSaniye > 0, "gunluk kota ilk arizada kesmeli");
    // Ve kesik UZUN olmalı: günlük kota 5 dakikada açılmaz.
    assert.ok(b.kesikSaniye > 10 * 60,
      `gunluk kota icin uzun kesik beklenir, kalan=${b.kesikSaniye} sn`);
  } finally { geri(); }
});

test("GEÇİCİ arıza tek seferde kesmez — seri beklenir", async () => {
  const geri = sunucu({
    info: { error: { name: "APIError", data: { message: "upstream timeout", statusCode: 503 } } },
    parts: [],
  });
  try {
    const b = new OpenCodeBeyni();
    await b.dusun(GIRDI).catch(() => {});
    assert.equal(b.kesikSaniye, 0, "gecici ariza tek seferde kesmemeli");
    await b.dusun(GIRDI).catch(() => {});
    await b.dusun(GIRDI).catch(() => {});
    assert.ok(b.kesikSaniye > 0, "uc ardisik ariza kesmeli");
    // Geçici arıza kesiği, günlük kota kesiğinden KISA olmalı.
    assert.ok(b.kesikSaniye <= 5 * 60, `gecici kesik kisa olmali, kalan=${b.kesikSaniye} sn`);
  } finally { geri(); }
});

test("sağlayıcı DIŞARIDAN verilebilir — kota dolunca kod değişmemeli", async () => {
  const b = new OpenCodeBeyni({ providerID: "nvidia", modelID: "meta/llama-3.1-70b" });
  assert.match(b.ad, /llama-3\.1-70b/, "ad modeli yansitmali");
  // Sağlayıcının isteğe gerçekten girdiğini gönderilen gövdeden doğrula.
  let govde: Record<string, unknown> | null = null;
  const eski = globalThis.fetch;
  globalThis.fetch = (async (u: string | URL, o?: RequestInit) => {
    const yol = String(u);
    if (!yol.endsWith("/session")) govde = JSON.parse(String(o?.body ?? "{}"));
    return {
      ok: true, status: 200,
      text: async () => JSON.stringify(yol.endsWith("/session")
        ? { id: "s1" } : { parts: [{ type: "text", text: "tamam" }] }),
    } as Response;
  }) as typeof fetch;
  try {
    // `await` şart: `try { return promise } finally {...}` kalıbında finally
    // promise ÇÖZÜLMEDEN çalışır ve fetch'i erken geri yükler.
    await b.dusun(GIRDI);
    const m = (govde as unknown as { model?: { providerID?: string } } | null)?.model;
    assert.equal(m?.providerID, "nvidia", "providerID istege girmeli");
  } finally { globalThis.fetch = eski; }
});

// ── OTURUM = HAFIZA ───────────────────────────────────────────────────────
// Ölçüldü: OpenCode oturumu konuşma geçmişini kendi tutuyor. Oturumu atmak
// Orion'un hafızasını silmek demektir; geçici bir arıza bunu yapmamalı.

/** Kaç kez yeni oturum açıldığını sayar. */
function oturumSayan(mesajYaniti: unknown): { geri: () => void; sayi: () => number } {
  let n = 0;
  const eski = globalThis.fetch;
  globalThis.fetch = (async (u: string | URL) => {
    const yol = String(u);
    if (yol.endsWith("/session")) n++;
    return {
      ok: true, status: 200,
      text: async () => JSON.stringify(yol.endsWith("/session") ? { id: `s${n}` } : mesajYaniti),
    } as Response;
  }) as typeof fetch;
  return { geri: () => { globalThis.fetch = eski; }, sayi: () => n };
}

test("ZAMAN AŞIMI oturumu ATMAZ — geçici arıza hafızayı silmemeli", async () => {
  // Asıl kayıp burada yaşanıyordu: `_istek` içinde fırlayan her hata (zaman
  // aşımı dahil) oturumu düşürüyordu. Kota hatası `info.error` ile catch'in
  // DIŞINDA fırladığı için o yoldan zaten geçmiyordu — testin ilk sürümü
  // yanlış senaryoyu ölçüyordu ve düzeltmeyi geri alınca bile yeşil kalıyordu.
  let acilan = 0;
  let ilk = true;
  const eski = globalThis.fetch;
  globalThis.fetch = (async (u: string | URL) => {
    const yol = String(u);
    if (yol.endsWith("/session")) {
      acilan++;
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: `s${acilan}` }) } as Response;
    }
    if (ilk) { ilk = false; const e = new Error("This operation was aborted"); e.name = "AbortError"; throw e; }
    return { ok: true, status: 200, text: async () => JSON.stringify({ parts: [{ type: "text", text: "tamam" }] }) } as Response;
  }) as typeof fetch;
  try {
    const b = new OpenCodeBeyni();
    await b.dusun(GIRDI).catch(() => {});   // zaman aşımı
    await b.dusun(GIRDI);                    // ikinci tur başarılı
    assert.equal(acilan, 1, `zaman asimi oturum actirmamali, acilan=${acilan}`);
  } finally { globalThis.fetch = eski; }
});

test("OTURUM GEÇERSİZSE yenisi açılır — kalıcı hatada takılı kalmayız", async () => {
  let ilk = true;
  const eski = globalThis.fetch;
  let acilan = 0;
  globalThis.fetch = (async (u: string | URL) => {
    const yol = String(u);
    if (yol.endsWith("/session")) { acilan++; return { ok: true, status: 200, text: async () => JSON.stringify({ id: `s${acilan}` }) } as Response; }
    if (ilk) { ilk = false; return { ok: false, status: 404, text: async () => "session not found" } as Response; }
    return { ok: true, status: 200, text: async () => JSON.stringify({ parts: [{ type: "text", text: "tamam" }] }) } as Response;
  }) as typeof fetch;
  try {
    const b = new OpenCodeBeyni();
    await b.dusun(GIRDI).catch(() => {});   // 404 → oturum atılmalı
    await b.dusun(GIRDI);                    // yeni oturum açılıp başarılı olmalı
    assert.equal(acilan, 2, `gecersiz oturum sonrasi yenisi acilmali, acilan=${acilan}`);
  } finally { globalThis.fetch = eski; }
});
