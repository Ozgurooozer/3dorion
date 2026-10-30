// uygulama/levelKapsamliDepo.test.ts — kayıtlar level'a ait: başka level'a sızmaz, ova eski kaydı devralır, kapsamsızken eski davranış (spec 42 2. aşama).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { GOC_LEVELI, kapsamAnahtari, levelKapsamliDepo, type LevelKapsami } from "./levelKapsamliDepo.ts";
import type { Depo } from "./yerlestirmeKaydi.ts";
import { yerlestirmeyiKaydet, yerlestirmeyiYukle, YERLESTIRME_ANAHTARI } from "./yerlestirmeKaydi.ts";
import { zeminiKaydet, zeminiYukle } from "./zeminKaydi.ts";
import { bosDurum, ekle } from "./yerlestirme.ts";
import { ZEMIN_ANAHTARI } from "./zemin.ts";

const bellek = (): Depo & { veri: Map<string, string> } => {
  const veri = new Map<string, string>();
  return { veri, getItem: (k) => veri.get(k) ?? null, setItem: (k, v) => { veri.set(k, v); } };
};
const kapsam = (level: string, proje = "Ofis"): LevelKapsami => ({ proje, level });
const durumlu = () => ekle(bosDurum(), "kit/agac.glb", [1, 0, 2]).durum;

test("yazma kapsamlı anahtara gider; ekisiz anahtara DOKUNULMAZ", () => {
  const b = bellek();
  const d = levelKapsamliDepo(() => kapsam("duz-zemin"), b)!;
  d.setItem("orion.x", "1");
  assert.deepEqual([...b.veri.keys()], ["orion.x@Ofis/duz-zemin"]);
  assert.equal(d.getItem("orion.x"), "1");
});

test("SIZMA YOK: ova'nın kaydı başka level'da görünmez, başka level'ın kaydı ova'da görünmez", () => {
  const b = bellek();
  let k = kapsam("ova");
  const d = levelKapsamliDepo(() => k, b)!;
  d.setItem("orion.x", "ova-verisi");
  k = kapsam("duz-zemin");
  assert.equal(d.getItem("orion.x"), null, "yeni level boş başlar");
  d.setItem("orion.x", "duz-verisi");
  k = kapsam("ova");
  assert.equal(d.getItem("orion.x"), "ova-verisi");
  k = kapsam("duz-zemin");
  assert.equal(d.getItem("orion.x"), "duz-verisi");
});

test("proje de kapsamdır: aynı level adı iki projede ayrı kayıt", () => {
  const b = bellek();
  let k = kapsam("ova", "A");
  const d = levelKapsamliDepo(() => k, b)!;
  d.setItem("orion.x", "A-verisi");
  k = kapsam("ova", "B");
  assert.equal(d.getItem("orion.x"), null, "B projesi A'nın kaydını görmez (yeni anahtar var olduğu için göç de devralmaz)");
});

test(`GÖÇ: eski ekisiz kayıt yalnız '${GOC_LEVELI}' level'ına devredilir; yeniye yazınca eskisi bırakılır ama artık okunmaz`, () => {
  const b = bellek();
  b.veri.set("orion.x", "eski");
  let k = kapsam("duz-zemin");
  const d = levelKapsamliDepo(() => k, b)!;
  assert.equal(d.getItem("orion.x"), null, "ova olmayan level eski kaydı DEVRALMAZ");
  k = kapsam(GOC_LEVELI);
  assert.equal(d.getItem("orion.x"), "eski", "ova eski kaydı okur");
  d.setItem("orion.x", "yeni");
  assert.equal(d.getItem("orion.x"), "yeni");
  assert.equal(b.veri.get("orion.x"), "eski", "eski anahtar silinmez (geri dönüş yolu)");
});

test("kapsam yok (null) → eski davranış birebir; depo yok → null", () => {
  const b = bellek();
  const d = levelKapsamliDepo(() => null, b)!;
  d.setItem("orion.x", "1");
  assert.deepEqual([...b.veri.keys()], ["orion.x"]);
  assert.equal(d.getItem("orion.x"), "1");
  assert.equal(levelKapsamliDepo(() => kapsam("ova"), null), null);
});

test("kapsam her çağrıda okunur (açılış level'ı sonradan çözülür)", () => {
  const b = bellek();
  let k: LevelKapsami | null = null;
  const d = levelKapsamliDepo(() => k, b)!;
  d.setItem("orion.x", "erken");
  k = kapsam("ova");
  assert.equal(d.getItem("orion.x"), "erken", "kapsam çözülünce ova eski anahtardan devralır");
});

test("GERÇEK KAYITLAR: yerleştirme ve zemin kayıt kodları sarmalayıcıyla level'a göre ayrılır", () => {
  const b = bellek();
  let k = kapsam("ova");
  const d = levelKapsamliDepo(() => k, b);
  assert.equal(yerlestirmeyiKaydet(durumlu(), d), true);
  assert.equal(zeminiKaydet({ duzenleme: [1, 2], hucre: 2 }, d), true);
  assert.equal(yerlestirmeyiYukle(d).eklenen.length, 1);
  assert.deepEqual(zeminiYukle(d), { duzenleme: [1, 2], hucre: 2 });
  k = kapsam("duz-zemin");
  assert.equal(yerlestirmeyiYukle(d).eklenen.length, 0, "düz zemin ova'nın nesnelerini DEVRALMAZ");
  assert.equal(zeminiYukle(d), null, "düz zemin ova'nın arazi vuruşlarını devralmaz");
  assert.ok(b.veri.has(kapsamAnahtari(YERLESTIRME_ANAHTARI, kapsam("ova"))));
  assert.ok(b.veri.has(kapsamAnahtari(ZEMIN_ANAHTARI, kapsam("ova"))));
  assert.deepEqual([...b.veri.keys()].filter((x) => !x.includes("@")), [], "ekisiz anahtar yazılmadı");
});
