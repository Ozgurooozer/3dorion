// world/yer/nesneEylemleri.test.ts — etkileşim menüsünün beyni: Orion/ben eylemleri, uygunluk ve NEDEN, hedef türü (çapa/nokta).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { nesneEylemleri, type NesneEylemi } from "./nesneEylemleri.ts";
import { ETKILESIM_MENZILI } from "../player/etkilesim.ts";
import { tumCapalar } from "../level/capalar.ts";
import { BANK_CAPASI, BANK_NESNESI } from "../level/bank.ts";
import { NESNELER } from "../level/nesneKaydi.ts";
import type { Nesne } from "../level/nesneKaydi.ts";

const CAPALAR = [...tumCapalar(), BANK_CAPASI];
const YAKIN = { x: BANK_CAPASI.durak.x, z: BANK_CAPASI.durak.z };
const UZAK = { x: BANK_CAPASI.konum.x + 20, z: BANK_CAPASI.konum.z };
const bul = (l: readonly NesneEylemi[], kimlik: string) => l.find((e) => e.kimlik === kimlik);
const ofisNesnesi = (id: string) => NESNELER.find((n) => n.id === id)!;

test("her nesnede 'Yanına git' ve 'Ona bak' vardır ve uygundur", () => {
  const l = nesneEylemleri(BANK_NESNESI, { capalar: CAPALAR, oyuncu: YAKIN });
  assert.deepEqual([bul(l, "orion.git")?.uygun, bul(l, "orion.bak")?.uygun], [true, true]);
});

test("çapalı nesnede git/bak hedefi ÇAPADIR (avatar durağına gider, yönüne döner)", () => {
  const l = nesneEylemleri(BANK_NESNESI, { capalar: CAPALAR, oyuncu: YAKIN });
  assert.deepEqual(bul(l, "orion.git")?.niyet, { tur: "git", hedef: { tip: "capa", ad: "bank" } });
  assert.deepEqual(bul(l, "orion.bak")?.niyet, { tur: "bak", hedef: { tip: "capa", ad: "bank" } });
});

test("ÇAPASIZ nesnede hedef NOKTA'dır (avatar adla yalnız çapa çözer) ve durma mesafesi nesnenin yarıçapından büyüktür", () => {
  const raf = ofisNesnesi("raf");
  const l = nesneEylemleri(raf, { capalar: CAPALAR, oyuncu: UZAK });
  const git = bul(l, "orion.git")!.niyet as Extract<NesneEylemi["niyet"], { tur: "git" }>;
  assert.equal(git.hedef.tip, "nokta");
  assert.ok((git.mesafe ?? 0) > Math.max(raf.kutu.g, raf.kutu.d) / 2, `mesafe ${git.mesafe}`);
});

test("bank: Orion 'Otur' UYGUN ve niyeti bankın çapasıyla (Faz 4: oturma geometrisi var)", () => {
  const otur = bul(nesneEylemleri(BANK_NESNESI, { capalar: CAPALAR, oyuncu: YAKIN }), "orion.otur")!;
  assert.equal(otur.uygun, true);
  assert.deepEqual(otur.niyet, { tur: "otur", capa: "bank" });
});

test("oturma geometrisi OLMAYAN 'otur' eylemli çapa: Orion 'Otur' GRİ ve nedeni yazılı", () => {
  const { oturma: _o, ...oturmasiz } = BANK_CAPASI;
  const otur = bul(nesneEylemleri(BANK_NESNESI, { capalar: [...tumCapalar(), oturmasiz], oyuncu: YAKIN }), "orion.otur")!;
  assert.equal(otur.uygun, false);
  assert.match(otur.neden ?? "", /oturma geometrisi tanımlı değil/);
});

test("sandalye: Orion 'Otur' UYGUN ve niyeti çapalı", () => {
  const l = nesneEylemleri(ofisNesnesi("sandalye"), { capalar: CAPALAR, oyuncu: YAKIN });
  const otur = bul(l, "orion.otur")!;
  assert.equal(otur.uygun, true);
  assert.deepEqual(otur.niyet, { tur: "otur", capa: "sandalye" });
});

test("monitör: Orion 'Odaklan' uygun ve niyeti çapalı", () => {
  const l = nesneEylemleri(ofisNesnesi("monitor"), { capalar: CAPALAR, oyuncu: YAKIN });
  assert.deepEqual(bul(l, "orion.odaklan")?.niyet, { tur: "odaklan", capa: "monitor" });
});

test("bank: 'Ben: Otur' yakınken UYGUN, etkileşimi çapa ve eylemle", () => {
  const o = bul(nesneEylemleri(BANK_NESNESI, { capalar: CAPALAR, oyuncu: YAKIN }), "ozyn.otur")!;
  assert.deepEqual([o.uygun, o.etkilesim], [true, { capa: "bank", eylem: "otur" }]);
});

test("bank: 'Ben: Otur' UZAKTAYKEN gri ve nedeni mesafeyi söyler", () => {
  const o = bul(nesneEylemleri(BANK_NESNESI, { capalar: CAPALAR, oyuncu: UZAK }), "ozyn.otur")!;
  assert.equal(o.uygun, false);
  assert.match(o.neden ?? "", /yaklaş/);
});

test("'Ben' listesinde bak/kalk/geç yok (anlık durumlar), 'Orion' listesinde 'kalk' yok", () => {
  const l = nesneEylemleri(BANK_NESNESI, { capalar: CAPALAR, oyuncu: YAKIN });
  assert.deepEqual(l.filter((e) => e.kim === "ozyn").map((e) => e.kimlik), ["ozyn.otur"]);
  assert.equal(bul(l, "orion.kalk"), undefined);
});

test("menzil sınırı: tam sınırda uygun, ötesinde gri", () => {
  const k = BANK_CAPASI.konum;
  const sinirda = nesneEylemleri(BANK_NESNESI, { capalar: CAPALAR, oyuncu: { x: k.x + ETKILESIM_MENZILI, z: k.z } });
  const otede = nesneEylemleri(BANK_NESNESI, { capalar: CAPALAR, oyuncu: { x: k.x + ETKILESIM_MENZILI + 0.01, z: k.z } });
  assert.deepEqual([bul(sinirda, "ozyn.otur")?.uygun, bul(otede, "ozyn.otur")?.uygun], [true, false]);
});

test("level nesnesi (çapasız, anlam eylemleri): 'al' ve 'yaz' gri ve nedenli, 'ben' satırı yok", () => {
  const agac: Nesne & { eylemler: string[] } = { id: "k1", ad: "kutu", tur: "esya", capa: null, kutu: { x: 30, y: 0.5, z: 30, g: 1, yuk: 1, d: 1 }, eylemler: ["bak", "al", "yaz"] };
  const l = nesneEylemleri(agac, { capalar: CAPALAR, oyuncu: UZAK });
  assert.deepEqual([bul(l, "orion.al")?.uygun, bul(l, "orion.yaz")?.uygun], [false, false]);
  assert.ok(bul(l, "orion.al")?.neden && bul(l, "orion.yaz")?.neden);
  assert.equal(l.some((e) => e.kim === "ozyn"), false);
});

test("eylemleri olmayan nesnede (yalnız 'bak') git ve bak kalır", () => {
  const l = nesneEylemleri(ofisNesnesi("raf"), { capalar: CAPALAR, oyuncu: UZAK });
  assert.deepEqual(l.map((e) => e.kimlik), ["orion.git", "orion.bak"]);
});

test("kimlikler her nesnede benzersiz", () => {
  for (const n of [...NESNELER, BANK_NESNESI]) {
    const idler = nesneEylemleri(n, { capalar: CAPALAR, oyuncu: YAKIN }).map((e) => e.kimlik);
    assert.equal(new Set(idler).size, idler.length, `${n.id}: ${idler.join(",")}`);
  }
});

test("her UYGUN Orion eyleminin niyeti, her UYGUN ben eyleminin etkileşimi vardır; gri olanın nedeni vardır", () => {
  for (const n of [...NESNELER, BANK_NESNESI]) {
    for (const e of nesneEylemleri(n, { capalar: CAPALAR, oyuncu: YAKIN })) {
      if (!e.uygun) assert.ok(e.neden, `${n.id}/${e.kimlik}: gri ama nedensiz`);
      else if (e.kim === "orion") assert.ok(e.niyet, `${n.id}/${e.kimlik}: niyetsiz`);
      else assert.ok(e.etkilesim, `${n.id}/${e.kimlik}: etkileşimsiz`);
    }
  }
});

test("gri ORION eyleminin söyleyeceği cümle (soz) vardır: oturamayacağı çapada 'buraya otur' bunu söyler", () => {
  const { oturma: _o, ...oturmasiz } = BANK_CAPASI;
  const l = nesneEylemleri(BANK_NESNESI, { capalar: [...tumCapalar(), oturmasiz], oyuncu: YAKIN });
  assert.equal(bul(l, "orion.otur")?.soz, "Buraya oturamıyorum.");
});

test("her GRİ Orion eyleminin sözü vardır; UYGUN eylemin sözü yoktur", () => {
  for (const n of [...NESNELER, BANK_NESNESI]) {
    for (const e of nesneEylemleri(n, { capalar: CAPALAR, oyuncu: YAKIN }).filter((x) => x.kim === "orion")) {
      if (e.uygun) assert.equal(e.soz, undefined, `${n.id}/${e.kimlik}: uygun ama sözlü`);
      else assert.ok(e.soz, `${n.id}/${e.kimlik}: gri ama sözsüz`);
    }
  }
});
