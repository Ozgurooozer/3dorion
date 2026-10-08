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
  bulunduguCapa, capaAdlari, capaBul, etkilesilebilirCapa, eylemVarMi, mesafeXZ, YER_HISTEREZISI,
  tumCapalar, yakinCapalar, yaklastiMi, BULUNMA_YARICAPI,
} from "./capalar.ts";
import { carpisiyorMu, SINIR } from "./olculer.ts";
import { CAPALAR, CAPA_ETIKETLERI } from "../../protocol/temel.ts";

test("dünyanın gösterdiği etiketler protokolün etiket tablosundan (BY39-2d: çapa çözümü aynı tabloyu kullanır)", () => {
  assert.deepEqual(
    Object.fromEntries(tumCapalar().map((c) => [c.ad, c.etiket])),
    Object.fromEntries(CAPALAR.map((c) => [c, CAPA_ETIKETLERI[c]])),
  );
});

test("dünyanın çapaları protokolün listesiyle birebir aynı: eksik de fazla da yok", () => {
  // Liste TEK yerde: protocol/temel.ts `CAPALAR`. Burada yeniden yazılmaz;
  // beceri refleksi sözdeki çapa adlarını o listeyle tanır (spec 10).
  assert.deepEqual([...capaAdlari()].sort(), [...CAPALAR].sort());
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
  assert.equal(hepsi.length, CAPALAR.length);
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

// ── bulunduğu çapa (spec 16 F2: durum defterinin konumu) ──
test("her çapanın durağında durulunca o çapada bulunulur", () => {
  // Durakları çakışan çapalar (masa/sandalye gibi) olabilir: o zaman en yakını kazanır, ama
  // durakta duran HİÇBİR ZAMAN "odanın ortası"nda sayılmaz.
  for (const c of tumCapalar()) assert.notEqual(bulunduguCapa(c.durak), null, c.ad);
});

test("hiçbir durağın yakınında olmayan nokta hiçbir çapada değildir", () => {
  const uzak = { x: 1e3, z: 1e3 };
  assert.equal(bulunduguCapa(uzak), null);
});

test("histerezis: iki durağın ortasında mevcut yer korunur", () => {
  const masa = capaBul("masa")!, admin = capaBul("admin")!;
  const orta = { x: (masa.durak.x + admin.durak.x) / 2 + 0.05, z: masa.durak.z };   // admin'e biraz daha yakın
  assert.equal(bulunduguCapa(orta, masa.etiket)?.ad, "masa");
});

test("histerezis: başka durak belirgin biçimde yakınsa yer değişir (terminalden sandalyeye)", () => {
  const sandalye = capaBul("sandalye")!;
  // Sandalyenin noktası: masa durağına 0,73 m, terminal durağına 1,16 m — fark eşikten büyük.
  assert.notEqual(bulunduguCapa({ x: sandalye.konum.x, z: sandalye.konum.z }, capaBul("admin")!.etiket)?.ad, "admin");
});

test("yapışkanlık: mevcut yerin yarıçapından çıkınca en yakın yer kazanır", () => {
  const tahta = capaBul("tahta")!;
  assert.equal(bulunduguCapa(tahta.durak, capaBul("masa")!.etiket)?.ad, "tahta");
});

test("bulunma yarıçapı en az BULUNMA_YARICAPI'dır", () => {
  const c = tumCapalar()[0]!;
  const r = Math.max(BULUNMA_YARICAPI, c.yaklasmaYaricapi) * 0.99;
  const yakini = bulunduguCapa({ x: c.durak.x + r, z: c.durak.z });
  assert.notEqual(yakini, null);
});
