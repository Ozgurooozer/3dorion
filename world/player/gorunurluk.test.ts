// world/player/gorunurluk.test.ts — spec 15 S1 ölçümü (P1, P2, P4) + temel doğruluk.
//
// REFERANS BAĞIMSIZDIR: çekirdek `isinAabb` (slab) kullanır; burada ışın yerine 2 cm adımlı
// yürüme + "nokta bir kutunun içinde mi" testi var. Aynı hatayı iki yerde yapmamak için
// ortak yardımcı yok. Nesnenin 9 örnek noktası (merkez + 8 köşe, merkeze %10 çekilmiş):
// dokuzu da aynı diyorsa çift BELİRSİZ DEĞİLDİR ve çekirdek onunla aynı olmalıdır (P1).
// Dokuzu ayrışan çift = kısmi örtülme: ayrı sayılır, P1'i çürütmez.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { CAPA_ETIKETLERI, CAPALAR } from "../../protocol/temel.ts";
import { BEDEN } from "../../protocol/bedenTanimi.ts";
import { GOZ_YUKSEKLIK, KATI_YUZEYLER, type Kutu, type KatiYuzey } from "../level/olculer.ts";
import { NESNELER, type Nesne } from "../level/nesneKaydi.ts";
import { acikMi, gorunenNesneler, konideMi } from "./gorunurluk.ts";

// ── P4: kayıt bekçisi ────────────────────────────────────────────────────

test("P4 kayıt: kimlikler = çapalı kutular ∪ açıkça sayılan eşyalar; adlar tek kaynaktan", () => {
  const capaliKutular = KATI_YUZEYLER.filter((s) => s.capa !== null).map((s) => s.capa as string).sort();
  const kayittaCapa = NESNELER.filter((n) => n.capa !== null).map((n) => n.id).sort();
  assert.deepEqual(kayittaCapa, capaliKutular, "çapalı kayıt, KATI_YUZEYLER'deki çapalı kutularla birebir olmalı");

  const eşyalar = NESNELER.filter((n) => n.capa === null).map((n) => n.id).sort();
  assert.deepEqual(eşyalar, ["ayakli_lamba", "banker_lamba", "berjer", "raf", "yigin"]);

  for (const n of NESNELER.filter((x) => x.capa !== null)) {
    assert.equal(n.ad, CAPA_ETIKETLERI[n.capa!], `${n.id}: ad CAPA_ETIKETLERI'nden gelmeli`);
  }
  assert.equal(new Set(NESNELER.map((n) => n.id)).size, NESNELER.length, "kimlikler tekil");
  // oda_ortasi yer, nesne değil.
  assert.ok(!NESNELER.some((n) => n.id === "oda_ortasi"));
  assert.ok(CAPALAR.includes("oda_ortasi"));
});

test("P4 kayıt: çapasız mobilya kutuları ışın yüzeylerindeki kutuyla AYNI nesne (kopya yok)", () => {
  for (const id of ["raf", "berjer", "yigin"]) {
    const n = NESNELER.find((x) => x.id === id)!;
    assert.ok(KATI_YUZEYLER.some((s) => s.kutu === n.kutu), `${id}: kutu KATI_YUZEYLER'deki ile aynı referans olmalı`);
  }
});

// ── P1: bağımsız referansla karşılaştırma ────────────────────────────────

const AY = 0.02;
const icinde = (p: { x: number; y: number; z: number }, k: Kutu): boolean =>
  Math.abs(p.x - k.x) < k.g / 2 && Math.abs(p.y - k.y) < k.yuk / 2 && Math.abs(p.z - k.z) < k.d / 2;

function referansNokta(goz: { x: number; y: number; z: number }, hedef: { x: number; y: number; z: number }, kendi: Kutu): boolean {
  const boy = Math.hypot(hedef.x - goz.x, hedef.y - goz.y, hedef.z - goz.z);
  const adim = Math.max(1, Math.ceil(boy / AY));
  for (let i = 1; i < adim; i++) { // son adım hedefin kendisi: onu sayma
    const f = i / adim;
    const p = { x: goz.x + (hedef.x - goz.x) * f, y: goz.y + (hedef.y - goz.y) * f, z: goz.z + (hedef.z - goz.z) * f };
    for (const y of KATI_YUZEYLER) {
      if (y.kutu === kendi) continue;
      if (icinde(p, y.kutu)) return false;
    }
  }
  return true;
}

function ornekler(k: Kutu): { x: number; y: number; z: number }[] {
  const f = 0.9; // köşeleri merkeze %10 çek: yüzeye teğet noktalar belirsizlik üretmesin
  const o = [{ x: k.x, y: k.y, z: k.z }];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    o.push({ x: k.x + sx * (k.g / 2) * f, y: k.y + sy * (k.yuk / 2) * f, z: k.z + sz * (k.d / 2) * f });
  }
  return o;
}

const KONUMLAR = [
  { x: 0, y: 0, z: 0 }, { x: -3, y: 0, z: 1 }, { x: 3, y: 0, z: 0.5 }, { x: 0, y: 0, z: 2.5 }, { x: 2, y: 0, z: -1.5 },
];
const YONLER = Array.from({ length: 8 }, (_, i) => ({ x: Math.cos((i * Math.PI) / 4), y: 0, z: Math.sin((i * Math.PI) / 4) }));

test("P1b çekirdek = bağımsız referans (5 konum × 8 yön = 40 görünüm, TÜM çiftler, en az bir örnek açık)", () => {
  let karsilastirilan = 0, belirsiz = 0, koniKarsi = 0, koniSinir = 0;
  const ayrisan: string[] = [];
  for (const konum of KONUMLAR) {
    const goz = { x: konum.x, y: GOZ_YUKSEKLIK, z: konum.z };
    // Konumlar katı bir kutunun içinde olmamalı (ölçüm geçerliliği).
    assert.ok(!KATI_YUZEYLER.some((s) => icinde(goz, s.kutu)), `konum katı yüzeyin içinde: ${JSON.stringify(konum)}`);
    for (const bakis of YONLER) {
      const g = gorunenNesneler(konum, bakis, GOZ_YUKSEKLIK, NESNELER);
      for (const n of NESNELER) {
        const cekirdek = g.find((x) => x.id === n.id)!;
        const oy = ornekler(n.kutu).map((p) => referansNokta(goz, p, n.kutu));
        // P1b: belirsizlik ayrımı YOK — her çift karşılaştırılır. Kural: en az bir örnek açık.
        const refGorunur = oy.some((v) => v), refKismen = refGorunur && !oy[0];
        karsilastirilan++;
        if (!oy.every((v) => v === oy[0])) belirsiz++;
        if (cekirdek.gorunur !== refGorunur) ayrisan.push(`${n.id} @${JSON.stringify(konum)} yon=${JSON.stringify(bakis)}: çekirdek=${cekirdek.gorunur} referans=${refGorunur}`);
        if (cekirdek.kismen !== refKismen) ayrisan.push(`KISMEN ${n.id} @${JSON.stringify(konum)} yon=${JSON.stringify(bakis)}: çekirdek=${cekirdek.kismen} referans=${refKismen}`);

        // Koni: atan2 ile bağımsız.
        const aci = Math.atan2(n.kutu.z - konum.z, n.kutu.x - konum.x);
        const yonAci = Math.atan2(bakis.z, bakis.x);
        let fark = Math.abs(aci - yonAci) % (2 * Math.PI);
        if (fark > Math.PI) fark = 2 * Math.PI - fark;
        if (Math.abs(fark - BEDEN.duyu.koniYarim) < 1e-6) { koniSinir++; continue; }
        koniKarsi++;
        if (cekirdek.konide !== (fark <= BEDEN.duyu.koniYarim)) ayrisan.push(`KONİ ${n.id} @${JSON.stringify(konum)} yon=${JSON.stringify(bakis)}`);
      }
    }
  }
  console.log(`P1b: ${KONUMLAR.length * YONLER.length} görünüm, ${NESNELER.length} nesne → karşılaştırılan çift=${karsilastirilan} (hepsi), bunlardan kısmi örtülmeli=${belirsiz}, koni karşılaştırması=${koniKarsi} (sınırda atlanan=${koniSinir}), ayrışan=${ayrisan.length}`);
  assert.deepEqual(ayrisan, [], `ayrışan çiftler:\n${ayrisan.join("\n")}`);
  assert.ok(karsilastirilan > 0);
});

// ── Temel doğruluk (ölçümden bağımsız, hızlı) ─────────────────────────────

test("açıkMi: araya giren engel görünürlüğü keser, kendi kutusu engel sayılmaz", () => {
  const goz = { x: 0, y: 1.6, z: 0 };
  const hedef = { x: 0, y: 1.6, z: 4 };
  const duvar: KatiYuzey = { capa: null, kutu: { x: 0, y: 1.6, z: 2, g: 2, yuk: 2, d: 0.1 } };
  assert.equal(acikMi(goz, hedef, null, [duvar]), false);
  assert.equal(acikMi(goz, hedef, null, []), true);
  const kendi: Kutu = { x: 0, y: 1.6, z: 4, g: 1, yuk: 1, d: 1 };
  assert.equal(acikMi(goz, hedef, kendi, [{ capa: null, kutu: kendi }]), true, "kendi kutusu engel değil");
});

test("konideMi: önünde evet, arkasında hayır, sıfır bakışta yalnız aynı nokta", () => {
  const k = { x: 0, y: 0, z: 0 };
  assert.equal(konideMi(k, { x: 1, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }), true);
  assert.equal(konideMi(k, { x: 1, y: 0, z: 0 }, { x: -5, y: 0, z: 0 }), false);
  assert.equal(konideMi(k, { x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }), false);
  assert.equal(konideMi(k, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), true);
});

test("gerçek oda: oda ortasından masaya bakınca masa+monitör görünür ve konidedir", () => {
  const g = gorunenNesneler({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, GOZ_YUKSEKLIK, NESNELER);
  const al = (id: string) => g.find((x) => x.id === id)!;
  assert.ok(al("masa").gorunur && al("masa").konide);
  assert.ok(al("monitor").gorunur && al("monitor").konide);
  assert.equal(al("kapi").konide, false, "kapı arkada");
});

// ── P2: maliyet ──────────────────────────────────────────────────────────

test("P2 maliyet: 60 nesnelik tam tarama p95 ≤ 1 ms", () => {
  // Gerçek 14 nesne + 46 sentetik (oda içinde, deterministik LCG).
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const sentetik: Nesne[] = Array.from({ length: 46 }, (_, i) => ({
    id: `s${i}`, ad: `s${i}`, tur: "mobilya", capa: null,
    kutu: { x: (rnd() - 0.5) * 8, y: 0.3 + rnd(), z: (rnd() - 0.5) * 6, g: 0.3 + rnd() * 0.5, yuk: 0.3 + rnd() * 0.5, d: 0.3 + rnd() * 0.5 },
  }));
  const hepsi = [...NESNELER, ...sentetik];
  assert.equal(hepsi.length, 60);
  const bakis = { x: 1, y: 0, z: 0 };
  for (let i = 0; i < 500; i++) gorunenNesneler({ x: 0, y: 0, z: 0 }, bakis, GOZ_YUKSEKLIK, hepsi); // ısınma
  const sureler: number[] = [];
  for (let i = 0; i < 3000; i++) {
    const t0 = performance.now();
    gorunenNesneler({ x: (i % 7) - 3, y: 0, z: (i % 5) - 2 }, bakis, GOZ_YUKSEKLIK, hepsi);
    sureler.push(performance.now() - t0);
  }
  sureler.sort((a, b) => a - b);
  const p50 = sureler[Math.floor(sureler.length * 0.5)]!, p95 = sureler[Math.floor(sureler.length * 0.95)]!, p99 = sureler[Math.floor(sureler.length * 0.99)]!;
  console.log(`P2: 60 nesne, 3000 tarama → p50=${p50.toFixed(4)} ms, p95=${p95.toFixed(4)} ms, p99=${p99.toFixed(4)} ms`);
  assert.ok(p95 <= 1, `p95=${p95.toFixed(4)} ms > 1 ms`);
});

// ── Mutasyon geçişinde kaçanları kapatan hedefli testler (spec 15 karnesi, koşu 3) ─────

test("konideMi: tam sınırda (90°, kos=0) konide sayılır (<=)", () => {
  const k = { x: 0, y: 0, z: 0 };
  assert.equal(konideMi(k, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 5 }, Math.PI / 2), true);
  assert.equal(konideMi(k, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 5 }, Math.PI / 2 - 1e-6), false);
});

test("mesafe XZ düzleminde: nesnenin yüksekliği mesafeyi değiştirmez", () => {
  const yuksek: Nesne = { id: "y", ad: "y", tur: "mobilya", capa: null, kutu: { x: 3, y: 2.9, z: 4, g: 0.2, yuk: 0.2, d: 0.2 } };
  const [g] = gorunenNesneler({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, GOZ_YUKSEKLIK, [yuksek], []);
  assert.ok(Math.abs(g!.mesafe - 5) < 1e-9, `mesafe=${g!.mesafe}, beklenen 5 (3-4-5, Y yok)`);
});

test("nesnenin İÇİNDE kalan engel: merkeze giden ışın önce nesneye girer, içerideki engel örtmez", () => {
  const goz = { x: 0, y: 1.6, z: 0 };
  const nesne: Kutu = { x: 0, y: 1.6, z: 6, g: 2, yuk: 2, d: 4 }; // z ∈ [4, 8]
  const gomulu: KatiYuzey = { capa: null, kutu: { x: 0, y: 1.6, z: 6.5, g: 0.4, yuk: 0.4, d: 0.4 } }; // nesnenin içinde, merkezin ötesinde
  assert.equal(acikMi(goz, { x: 0, y: 1.6, z: 7 }, nesne, [{ capa: null, kutu: nesne }, gomulu]), true,
    "nesneye girdikten sonraki iç engel (varış = ilk giriş) görünürlüğü kesmemeli");
});

test("tek taraflı örtülme: merkez ve + köşeler kapalı, − köşe açık → görünür ve kısmen", () => {
  const nesne: Nesne = { id: "o", ad: "o", tur: "mobilya", capa: null, kutu: { x: 0, y: 1.6, z: 6, g: 2, yuk: 2, d: 2 } };
  const perde: KatiYuzey = { capa: null, kutu: { x: 4.9, y: 1.6, z: 3, g: 10.2, yuk: 6, d: 0.1 } }; // x ∈ [-0.2, 10.0]: merkez (x=0) kapalı
  const [g] = gorunenNesneler({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, GOZ_YUKSEKLIK, [nesne], [perde]);
  assert.equal(g!.gorunur, true, "−x tarafındaki köşeler perdenin dışından görünüyor");
  assert.equal(g!.kismen, true, "merkez örtülü, nesne kısmen görünüyor");
});

test("kayıt: türler ve kutu boyutları anlamlı, çapasız eşyalar kendi sabitlerinden", async () => {
  const { BERJER, YIGIN, LAMBA } = await import("../level/olculer.ts");
  const tur = (id: string) => NESNELER.find((n) => n.id === id)!.tur;
  for (const id of ["masa", "sandalye", "raf", "berjer", "yigin"]) assert.equal(tur(id), "mobilya", id);
  for (const id of ["banker_lamba", "ayakli_lamba"]) assert.equal(tur(id), "aydinlatma", id);
  for (const id of ["monitor", "tahta", "pencere", "kapi", "sema", "gunluk", "admin"]) assert.equal(tur(id), "yuzey", id);
  for (const n of NESNELER) assert.ok(n.kutu.g > 0 && n.kutu.yuk > 0 && n.kutu.d > 0, `${n.id}: kutu boyutları > 0 olmalı`);
  const kutu = (id: string) => NESNELER.find((n) => n.id === id)!.kutu;
  assert.equal(kutu("berjer").x as number, BERJER.x as number); assert.equal(kutu("berjer").z as number, BERJER.z as number);
  assert.equal(kutu("yigin").x as number, YIGIN.x as number); assert.equal(kutu("yigin").z as number, YIGIN.z as number);
  assert.equal(kutu("banker_lamba").x as number, LAMBA.banker.x as number); assert.equal(kutu("ayakli_lamba").z as number, LAMBA.ayakli.z as number);
});
