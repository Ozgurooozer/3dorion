// world/level/bank.test.ts — Ofisin dışındaki bank: dış kutu parçaların birleşimi, ofisin/kapının dışında, terasta, çapa alanları.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { BANK, BANK_KUTUSU, BANK_PARCALARI, BANK_CAPASI, BANK_KATI, BANK_NESNESI } from "./bank.ts";
import { KAPI } from "./olculer.ts";
import { OFIS_IZI, PLATO, TERAS_YUKSEKLIGI } from "./ofisYeri.ts";
import { CAPALAR, CAPA_ETIKETLERI } from "../../protocol/temel.ts";

const YARIM = { x: BANK_KUTUSU.g / 2, y: BANK_KUTUSU.yuk / 2, z: BANK_KUTUSU.d / 2 };
const AZ = 1e-9;

test("parçaların birleşimi tam olarak dış kutudur (kutu ile mesh ayrışamaz): x, y, z sınırları", () => {
  const alt = { x: Infinity, y: Infinity, z: Infinity }, ust = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const { kutu: k } of BANK_PARCALARI) {
    alt.x = Math.min(alt.x, k.x - k.g / 2); ust.x = Math.max(ust.x, k.x + k.g / 2);
    alt.y = Math.min(alt.y, k.y - k.yuk / 2); ust.y = Math.max(ust.y, k.y + k.yuk / 2);
    alt.z = Math.min(alt.z, k.z - k.d / 2); ust.z = Math.max(ust.z, k.z + k.d / 2);
  }
  const bekle = { alt: { x: BANK_KUTUSU.x - YARIM.x, y: BANK_KUTUSU.y - YARIM.y, z: BANK_KUTUSU.z - YARIM.z }, ust: { x: BANK_KUTUSU.x + YARIM.x, y: BANK_KUTUSU.y + YARIM.y, z: BANK_KUTUSU.z + YARIM.z } };
  for (const e of ["x", "y", "z"] as const) {
    assert.ok(Math.abs(alt[e] - bekle.alt[e]) < AZ, `alt ${e}: ${alt[e]} ≠ ${bekle.alt[e]}`);
    assert.ok(Math.abs(ust[e] - bekle.ust[e]) < AZ, `üst ${e}: ${ust[e]} ≠ ${bekle.ust[e]}`);
  }
});

test("bank terasın zeminine oturur: alt yüzü TERAS_YUKSEKLIGI", () => {
  assert.ok(Math.abs(BANK_KUTUSU.y - YARIM.y - TERAS_YUKSEKLIGI) < AZ);
});

test("bank ofisin yer izinin (duvarlar dahil) en az 1 m dışında", () => {
  assert.ok(BANK_KUTUSU.z - YARIM.z >= OFIS_IZI.yariZ + 1);
});

test("bank kapıdan düz çıkan yolu kesmez: x aralığı kapı genişliğiyle kesişmez", () => {
  assert.ok(BANK_KUTUSU.x - YARIM.x > KAPI.x + KAPI.genislik / 2);
});

test("bank kapı kanadının erişiminin (kanat boyu kadar dışarı) en az 1 m ötesinde", () => {
  assert.ok(BANK_KUTUSU.z - YARIM.z >= KAPI.z + KAPI.genislik + 1);
});

test("bank platonun TAM DÜZ terasında: köşegen dahil yarıçapın içinde, kenardan 1 m pay", () => {
  const uzak = Math.hypot(BANK_KUTUSU.x, BANK_KUTUSU.z) + Math.hypot(YARIM.x, YARIM.z);
  assert.ok(uzak <= PLATO.yaricap - 1, `uzaklık ${uzak.toFixed(2)} > ${PLATO.yaricap - 1}`);
});

test("çapa: 'bank' protokolün listesinde, etiketi protokolün tablosundan", () => {
  assert.ok((CAPALAR as readonly string[]).includes(BANK_CAPASI.ad));
  assert.equal(BANK_CAPASI.etiket, CAPA_ETIKETLERI.bank);
});

test("çapa: otur ve kalk eylemleri var", () => {
  assert.deepEqual([...BANK_CAPASI.eylemler], ["otur", "kalk"]);
});

test("çapa: oturma noktası bankın üstünde ve oturma yüzeyi yüksekliğinde", () => {
  assert.ok(Math.abs(BANK_CAPASI.konum.y - (BANK.zemin + BANK.oturma)) < AZ);
  assert.ok(Math.abs(BANK_CAPASI.konum.x - BANK_KUTUSU.x) < AZ && Math.abs(BANK_CAPASI.konum.z - BANK_KUTUSU.z) < AZ);
});

test("çapa: durak bankın ÖNÜNDE (+Z) ve kutunun dışında; oturanın yönü ova'ya (+Z), durak yönü bankı görmek için tersi (−Z)", () => {
  assert.ok(BANK_CAPASI.durak.z > BANK_KUTUSU.z + YARIM.z + 0.5);
  assert.equal(BANK_CAPASI.oturmaYonu?.z, 1);
  assert.equal(BANK_CAPASI.yon.z, -1);
});

test("yüzey ve nesne kaydı aynı kutuyu ve 'bank' çapasını taşır", () => {
  assert.equal(BANK_KATI.capa, "bank");
  assert.equal(BANK_KATI.kutu, BANK_KUTUSU);
  assert.deepEqual([BANK_NESNESI.id, BANK_NESNESI.capa, BANK_NESNESI.tur], ["bank", "bank", "mobilya"]);
});
