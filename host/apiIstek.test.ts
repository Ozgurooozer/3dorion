// host/apiIstek.test.ts — Ana süreçten API isteği: başlığı burası ekler, hata metni anahtarı sızdırmaz.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { apiIstek, maskele } from "./apiIstek.js";

const ANAHTAR = "nvapi-TEST-0123456789abcdef";
const depo = { anahtar: (ad: string) => (ad === "nvidia" ? { adres: "https://api.ornek/v1", anahtar: ANAHTAR } : null) };

function sahteGetir(durum: number, govde: string) {
  const istekler: { url: string; init?: RequestInit }[] = [];
  const getir = (async (url: string, init?: RequestInit) => {
    istekler.push({ url, init });
    return { ok: durum < 400, status: durum, text: async () => govde } as Response;
  }) as unknown as typeof fetch;
  return { getir, istekler };
}

test("istek adrese yol eklenerek, Bearer başlığıyla gider", async () => {
  const s = sahteGetir(200, '{"data":[]}');
  await apiIstek({ depo, getir: s.getir, saglayici: "nvidia", yol: "/models" });
  const h = s.istekler[0]!.init!.headers as Record<string, string>;
  assert.deepEqual({ url: s.istekler[0]!.url, auth: h.Authorization, yontem: s.istekler[0]!.init!.method },
    { url: "https://api.ornek/v1/models", auth: `Bearer ${ANAHTAR}`, yontem: "GET" });
});

test("gövde varsa POST ve JSON", async () => {
  const s = sahteGetir(200, '{"ok":1}');
  const r = await apiIstek({ depo, getir: s.getir, saglayici: "nvidia", yol: "/chat/completions", govde: { a: 1 } });
  assert.deepEqual({ yontem: s.istekler[0]!.init!.method, govde: s.istekler[0]!.init!.body, r }, { yontem: "POST", govde: '{"a":1}', r: { ok: true, veri: { ok: 1 } } });
});

test("sağlayıcı anahtarı geri yansıtsa bile hata metninde anahtar YOK", async () => {
  const s = sahteGetir(401, `{"error":"invalid key ${ANAHTAR}"}`);
  const r = await apiIstek({ depo, getir: s.getir, saglayici: "nvidia", yol: "/models" });
  assert.ok(!r.ok && !r.hata.includes(ANAHTAR) && r.hata.includes("***"), JSON.stringify(r));
});

test("anahtar yoksa istek hiç atılmaz", async () => {
  const s = sahteGetir(200, "{}");
  const r = await apiIstek({ depo, getir: s.getir, saglayici: "yok", yol: "/models" });
  assert.deepEqual({ r, istek: s.istekler.length }, { r: { ok: false, hata: "yok için anahtar yok" }, istek: 0 });
});

test("ağ hatası mesajı da maskelenir", async () => {
  const getir = (async () => { throw new Error(`baglanti kurulamadi ${ANAHTAR}`); }) as unknown as typeof fetch;
  const r = await apiIstek({ depo, getir, saglayici: "nvidia", yol: "/models" });
  assert.ok(!r.ok && !r.hata.includes(ANAHTAR), JSON.stringify(r));
});

test("zaman aşımı süreyle söylenir", async () => {
  const getir = ((_u: string, init?: RequestInit) => new Promise((_c, ret) => {
    init?.signal?.addEventListener("abort", () => ret(Object.assign(new Error("aborted"), { name: "AbortError" })));
  })) as unknown as typeof fetch;
  const r = await apiIstek({ depo, getir, saglayici: "nvidia", yol: "/models", zamanAsimiMs: 20 });
  assert.deepEqual(r, { ok: false, hata: "nvidia 0 sn içinde cevap vermedi" });
});

test("maskele: her geçişi gizler, boş anahtar metni değiştirmez", () => {
  assert.equal(maskele("a K b K", "K"), "a *** b ***");
  assert.equal(maskele("metin", ""), "metin");
});
