// world/avatar/iskeletSecim.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { iskeletSec } from "./iskeletSecim.ts";
import type { IskeletBilgisi } from "./iskelet.ts";

const bilgi = (uzerine: Partial<IskeletBilgisi> = {}): IskeletBilgisi => ({
  tur: "vrm", kaynak: "deneme.vrm",
  agizDestegi: true, kirpmaDestegi: true, basDestegi: true, hamBoy: 1.7,
  ...uzerine,
});

test("VRM yüklenemediyse prosedürel seçilir", () => {
  const k = iskeletSec(null);
  assert.equal(k.secim, "prosedurel");
  assert.match(k.gerekce, /yüklenemedi/);
});

test("tam yetenekli VRM kullanılır", () => {
  const k = iskeletSec(bilgi());
  assert.equal(k.secim, "vrm");
  assert.match(k.gerekce, /tüm yetenekler/);
});

test("ağzı OLMAYAN VRM reddedilir — konuşma görünmez olurdu", () => {
  // GERÇEK durum: assets/orion.vrm dosyası aslında Khronos'un `Cesium_Man`
  // örneği; VRM eklentisi yok, 0 morph target. Ağız/göz fiziksel olarak
  // imkânsız. Eskiden bu model kabul edilip yalnızca uyarı basılıyordu.
  const k = iskeletSec(bilgi({ kaynak: "orion.vrm", agizDestegi: false, kirpmaDestegi: false }));
  assert.equal(k.secim, "prosedurel");
  assert.match(k.gerekce, /ağız desteği sunmuyor/);
});

test("vrmZorla ile görünüş ifadeye tercih edilebilir — ama sessizce değil", () => {
  const k = iskeletSec(bilgi({ agizDestegi: false }), { vrmZorla: true });
  assert.equal(k.secim, "vrm");
  assert.match(k.gerekce, /ZORLANDI/);
  assert.match(k.gerekce, /ölü görünecek/, "bedeli açıkça yazılmalı");
});

test("ağzı olan ama gözü/başı olmayan VRM kullanılır, eksikler bildirilir", () => {
  const k = iskeletSec(bilgi({ kirpmaDestegi: false, basDestegi: false }));
  assert.equal(k.secim, "vrm");
  assert.match(k.gerekce, /göz kırpma/);
  assert.match(k.gerekce, /baş dönüşü/);
});

test("karar her zaman gerekçe taşır — sessiz seçim yok", () => {
  const durumlar = [
    null,
    bilgi(),
    bilgi({ agizDestegi: false }),
    bilgi({ kirpmaDestegi: false }),
  ];
  for (const d of durumlar) {
    const k = iskeletSec(d);
    assert.ok(k.gerekce.length > 10, "gerekçe boş olmamalı");
  }
});
