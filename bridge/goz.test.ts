// bridge/goz.test.ts — görme bağdaştırıcısı Ollama'ya ne GÖNDERİYOR, ne DÖNDÜRÜYOR (spec 25 Faz 2).
// Modelin ne gördüğü burada sınanmaz (canlı: `3dorion.bat gozdene`, ön kayıt spec 25 §7).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GozModeli, betimiTemizle, gozIstemi, GOZ_VARSAYILAN_MODEL } from "./goz.ts";

function sunucu(cevap: { ok?: boolean; status?: number; govde?: unknown; gecikmeMs?: number } = {}) {
  const eski = globalThis.fetch;
  const istekler: { yol: string; govde: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (u: string | URL, o?: RequestInit) => {
    istekler.push({ yol: String(u), govde: JSON.parse(String(o?.body)) });
    if (cevap.gecikmeMs) {
      await new Promise((coz, red) => {
        const s = setTimeout(coz, cevap.gecikmeMs);
        o?.signal?.addEventListener("abort", () => { clearTimeout(s); red(Object.assign(new Error("aborted"), { name: "AbortError" })); });
      });
    }
    const g = cevap.govde ?? { message: { content: "Oda loş, monitör mavi ışık saçıyor." } };
    return { ok: cevap.ok ?? true, status: cevap.status ?? 200, json: async () => g, text: async () => JSON.stringify(g) } as Response;
  }) as typeof fetch;
  return { geri: () => { globalThis.fetch = eski; }, istekler };
}

test("varsayılan model e4b (V0: daha çok gördü)", () => {
  assert.equal(new GozModeli().model, GOZ_VARSAYILAN_MODEL);
});

test("kare kullanıcı mesajında görüntü olarak gider", async () => {
  const s = sunucu();
  try {
    await new GozModeli().gor("UE5H", "masa (önünde)");
    const mesajlar = s.istekler[0]!.govde.messages as { role: string; images?: string[] }[];
    assert.deepEqual(mesajlar.find((m) => m.role === "user")?.images, ["UE5H"]);
  } finally { s.geri(); }
});

test("algı metni sistem mesajına bağlam olarak girer", async () => {
  const s = sunucu();
  try {
    await new GozModeli().gor("UE5H", "beyaz tahta (önünde), raf (sağında)");
    const mesajlar = s.istekler[0]!.govde.messages as { role: string; content: string }[];
    assert.match(mesajlar.find((m) => m.role === "system")!.content, /beyaz tahta \(önünde\), raf \(sağında\)/);
  } finally { s.geri(); }
});

test("istek /api/chat'e, düşünme kapalı, sıcaklık 0", async () => {
  const s = sunucu();
  try {
    await new GozModeli().gor("UE5H", "x");
    const g = s.istekler[0]!.govde;
    assert.deepEqual([s.istekler[0]!.yol.endsWith("/api/chat"), g.think, (g.options as { temperature: number }).temperature], [true, false, 0]);
  } finally { s.geri(); }
});

test("cevap temizlenmiş tek paragraf döner", async () => {
  const s = sunucu({ govde: { message: { content: "**Oda loş.**\n- Monitör mavi.\n" } } });
  try {
    assert.equal(await new GozModeli().gor("UE5H", "x"), "Oda loş. Monitör mavi.");
  } finally { s.geri(); }
});

test("HTTP hatası durum koduyla fırlatır", async () => {
  const s = sunucu({ ok: false, status: 404, govde: { error: "model not found" } });
  try {
    await assert.rejects(new GozModeli().gor("UE5H", "x"), /görme modeli 404/);
  } finally { s.geri(); }
});

test("boş cevap fırlatır (sessizce boş betim dönmez)", async () => {
  const s = sunucu({ govde: { message: { content: "  " } } });
  try {
    await assert.rejects(new GozModeli().gor("UE5H", "x"), /boş cevap/);
  } finally { s.geri(); }
});

test("zaman aşımı Türkçe sebeple fırlatır", async () => {
  const s = sunucu({ gecikmeMs: 500 });
  try {
    await assert.rejects(new GozModeli({ zamanAsimiMs: 20 }).gor("UE5H", "x"), /0 sn içinde cevap vermedi/);
  } finally { s.geri(); }
});

test("istem: adları algıdan kullan, olmayanı kesinmiş gibi söyleme", () => {
  const i = gozIstemi("x");
  assert.match(i, /algındaki adlarıyla/);
  assert.match(i, /kesinmiş gibi söyleme/);
});

test("betimiTemizle madde işaretlerini ve satır sonlarını kaldırır", () => {
  assert.equal(betimiTemizle("- bir\n• iki\n\n### üç"), "bir iki üç");
});
