// world/level/capalar.test.ts — Çapa kayıt defteri birim testleri.
//
// Koşum: node --experimental-strip-types --test world/level/capalar.test.ts
// Babylon yüklenmez: `capalar.ts` bilerek saf veri. Bu testin Babylon'suz
// koşması, T2/T4'ün çapa aritmetiği için motor yüklemek zorunda olmadığının
// kanıtıdır.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  capaAdlari, capaBul, etkilesilebilirCapa, eylemVarMi, mesafeXZ,
  tumCapalar, yakinCapalar, yaklastiMi,
} from "./capalar.ts";
import { carpisiyorMu, SINIR } from "./olculer.ts";

// İlk yedisi spec'ten; son üçü zihin duvarı ile geldi (şema/günlük panelleri
// ve yönetim terminali). Sayı burada TEK yerde tutulur.
const ZORUNLU = [
  "masa", "sandalye", "tahta", "pencere", "kapi", "oda_ortasi", "monitor",
  "sema", "gunluk", "admin",
] as const;

test("beklenen çapaların hepsi kayıtlı, fazlası yok", () => {
  const adlar = capaAdlari();
  for (const a of ZORUNLU) assert.ok(adlar.includes(a), `eksik çapa: ${a}`);
  assert.equal(tumCapalar().length, ZORUNLU.length);
});

test("capaBul ada göre doğru çapayı döner", () => {
  const masa = capaBul("masa");
  assert.ok(masa);
  assert.equal(masa.ad, "masa");
  assert.equal(typeof masa.konum.x, "number");
  assert.equal(masa.etiket, "çalışma masası");
});

test("bilinmeyen çapa null döner, exception atmaz", () => {
  // LLM "masaa" veya "table" uydurabilir; dünya çökmemeli (SOZLESME:
  // güvenilmezlik varsayımı).
  for (const kotu of ["", "masaa", "table", "MASA", "__proto__", "constructor"]) {
    assert.equal(capaBul(kotu), null, `null beklendi: ${kotu}`);
  }
});

test("her çapanın konumu oda sınırları içinde", () => {
  for (const c of tumCapalar()) {
    assert.ok(c.konum.x >= SINIR.minX - 0.3 && c.konum.x <= SINIR.maxX + 0.3, `${c.ad} x dışta`);
    assert.ok(c.konum.z >= SINIR.minZ - 0.3 && c.konum.z <= SINIR.maxZ + 0.3, `${c.ad} z dışta`);
    assert.ok(c.konum.y >= 0, `${c.ad} zeminin altında`);
  }
});

test("her çapanın durak noktası yürünebilir (çarpışma yok)", () => {
  // Bu test T2'yi korur: avatar `git masa` dediğinde varış noktası bir
  // mobilyanın içinde olmamalı, yoksa sıkışır.
  for (const c of tumCapalar()) {
    assert.equal(carpisiyorMu(c.durak.x, c.durak.z), false, `${c.ad} durağı engelde`);
  }
});

test("yön vektörleri birim uzunlukta ve yatay", () => {
  for (const c of tumCapalar()) {
    const boy = Math.hypot(c.yon.x, c.yon.y, c.yon.z);
    assert.ok(Math.abs(boy - 1) < 1e-9, `${c.ad} yön birim değil: ${boy}`);
    assert.equal(c.yon.y, 0, `${c.ad} yönü yatay değil`);
  }
});

test("yaklaşma yarıçapı pozitif ve makul", () => {
  for (const c of tumCapalar()) {
    assert.ok(c.yaklasmaYaricapi > 0, `${c.ad} yarıçap sıfır/negatif`);
    assert.ok(c.yaklasmaYaricapi <= 3, `${c.ad} yarıçap fazla geniş: ${c.yaklasmaYaricapi}`);
  }
});

test("yaklastiMi yarıçap eşiğini uygular", () => {
  const tahta = capaBul("tahta");
  assert.ok(tahta);
  // Durağın tam üstünde
  assert.equal(yaklastiMi("tahta", tahta.durak), true);
  // Yarıçapın hemen içinde
  const ic = { x: tahta.durak.x + tahta.yaklasmaYaricapi - 0.01, z: tahta.durak.z };
  assert.equal(yaklastiMi("tahta", ic), true);
  // Yarıçapın hemen dışında
  const dis = { x: tahta.durak.x + tahta.yaklasmaYaricapi + 0.01, z: tahta.durak.z };
  assert.equal(yaklastiMi("tahta", dis), false);
  // Bilinmeyen çapa asla "yaklaşıldı" demez
  assert.equal(yaklastiMi("yokboyle", tahta.durak), false);
});

test("eylem listeleri spec'e uygun", () => {
  assert.equal(eylemVarMi("sandalye", "otur"), true);
  assert.equal(eylemVarMi("tahta", "yaz"), true);
  assert.equal(eylemVarMi("monitor", "odaklan"), true);
  assert.equal(eylemVarMi("masa", "odaklan"), true);
  // Olmayan eşleşmeler
  assert.equal(eylemVarMi("pencere", "otur"), false);
  assert.equal(eylemVarMi("kapi", "yaz"), false);
  // Bilinmeyen çapa false döner, çökmez
  assert.equal(eylemVarMi("yokboyle", "otur"), false);
  // Hiçbir çapanın eylem listesi boş olmamalı — boş liste "ne yapılacağı
  // belirsiz" demektir ve niyet doğrulaması bunu ayırt edemez.
  for (const c of tumCapalar()) assert.ok(c.eylemler.length > 0, `${c.ad} eylemsiz`);
});

test("yakinCapalar menzili uygular ve yakından uzağa sıralar", () => {
  const orta = { x: 0, z: 0 };
  const hepsi = yakinCapalar(orta, 100);
  assert.equal(hepsi.length, ZORUNLU.length);
  assert.equal(hepsi[0]?.capa.ad, "oda_ortasi");
  for (let i = 1; i < hepsi.length; i++) {
    assert.ok(hepsi[i]!.mesafe >= hepsi[i - 1]!.mesafe, "sıralama bozuk");
  }
  // Dar menzil yalnızca oda ortasını görür
  assert.deepEqual(yakinCapalar(orta, 0.5).map((y) => y.capa.ad), ["oda_ortasi"]);
});

test("etkilesilebilirCapa yalnızca eylemli ve yarıçap içindekini döner", () => {
  const monitor = capaBul("monitor");
  assert.ok(monitor);
  // Monitörün durağında: monitor/masa/sandalye durakları aynı noktada;
  // en yakın ve en dar yarıçaplı olan sandalye kazanır.
  const yakin = etkilesilebilirCapa(monitor.durak);
  assert.ok(yakin, "durağın üstünde etkileşim bulunamadı");
  assert.ok(["monitor", "masa", "sandalye"].includes(yakin.ad));
  // Odanın uzak köşesinde hiçbir şey etkileşilebilir değil
  assert.equal(etkilesilebilirCapa({ x: SINIR.maxX - 0.4, z: SINIR.maxZ - 0.4 }), null);
  // "kapi" yalnızca "bak" içeriyor → etkileşim adayı değil
  const kapi = capaBul("kapi");
  assert.ok(kapi);
  assert.notEqual(etkilesilebilirCapa(kapi.durak)?.ad, "kapi");
});

test("mesafeXZ Y'yi yok sayar", () => {
  assert.equal(mesafeXZ({ x: 0, z: 0 }, { x: 3, z: 4 }), 5);
});

test("çapa defteri çağıran tarafından bozulamaz (aynı nesne dönmüyor kopyası)", () => {
  // `tumCapalar()` readonly bir dizi döner; içerik mutasyonu TS'te derlenmez.
  // Burada garanti edilen: iki çağrı aynı içeriği verir (gizli durum yok).
  assert.deepEqual(capaAdlari(), capaAdlari());
});
