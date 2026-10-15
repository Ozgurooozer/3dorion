// world/surfaces/web/webEkrani.test.ts — 3. monitörün saf kısımları: UV → sayfa eşlemesi (W3) ve kare yokken ekranda yazan dürüst metin (W4).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { uvdenSayfaya, yerTutucuMetni, type WebDurumu } from "./webEkrani.ts";

test("W3 UV → sayfa: dört köşe + merkez (v yukarı artar, sayfa y aşağı artar)", () => {
  assert.deepEqual(uvdenSayfaya(0, 1), { x: 0, y: 0 }, "sol-üst");
  assert.deepEqual(uvdenSayfaya(1, 1), { x: 1, y: 0 }, "sağ-üst");
  assert.deepEqual(uvdenSayfaya(0, 0), { x: 0, y: 1 }, "sol-alt");
  assert.deepEqual(uvdenSayfaya(1, 0), { x: 1, y: 1 }, "sağ-alt");
  assert.deepEqual(uvdenSayfaya(0.5, 0.5), { x: 0.5, y: 0.5 }, "merkez");
});

test("UV → sayfa: tersi tutarlı (sayfa → UV → sayfa) ve sınır dışı/NaN kenara sıkışır", () => {
  for (const [x, y] of [[0.1, 0.9], [0.73, 0.21], [0.5, 0.5]] as const) {
    const s = uvdenSayfaya(x, 1 - y);   // sayfa (x,y) noktasının UV'si (x, 1−y)
    assert.ok(Math.abs(s.x - x) < 1e-12 && Math.abs(s.y - y) < 1e-12, `(${x},${y}) → ${JSON.stringify(s)}`);
  }
  assert.deepEqual(uvdenSayfaya(-2, 7), { x: 0, y: 0 });
  assert.deepEqual(uvdenSayfaya(Number.NaN, Number.NaN), { x: 0, y: 0 }, "NaN iki eksende de 0");
});

test("W4 dürüst boşluk: her durumun ekranda yazan metni var; 'kapali' groma'nın nasıl açılacağını söyler", () => {
  const durumlar: WebDurumu[] = ["baglaniyor", "yukleniyor", "acik", "kapali", "yok"];
  for (const d of durumlar) {
    const m = yerTutucuMetni(d);
    assert.ok(m.baslik.length > 0 && m.ayrinti.length > 0, `${d}: boş metin (sessiz siyah ekran)`);
  }
  assert.match(yerTutucuMetni("kapali").baslik, /groma kapalı/);
  assert.match(yerTutucuMetni("kapali").ayrinti, /groma-haritasi\.bat/);
});
