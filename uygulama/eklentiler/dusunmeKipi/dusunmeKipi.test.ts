// uygulama/eklentiler/dusunmeKipi/dusunmeKipi.test.ts — kip eklentisi: kapalıyken kanca YOK; seçim canlı; doğrulayıcı yalnız Doğrulayıcı kipinde ret verir.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { eklentiDefteriKur } from "../../eklenti/eklentiDefteri.ts";
import { ORION_SEMASI } from "../../../world/surfaces/duvar/semaCekirdek.ts";
import { COZUCU_EKI, DOGRULAYICI_EKI, DUSUNME_KIPI, dusunmeKipiKur, kipSemasi } from "./dusunmeKipi.ts";
import type { Niyet } from "../../../protocol/niyet.ts";

const b = { koken: "dis" as const, simdi: 0 };
const git: Niyet = { tur: "git", hedef: { tip: "capa", ad: "tahta" } };

function kur() {
  const defter = eklentiDefteriKur();
  const kip = dusunmeKipiKur(defter);
  defter.kaydet(kip.eklenti);
  defter.baslat();
  return { defter, kip };
}

test("varsayılan KAPALI: kanca yok, etkin null (bugünkü davranış)", () => {
  const { kip } = kur();
  assert.deepEqual(kip.kancalar(), []);
  assert.equal(kip.etkin(), null);
});

test("açılınca varsayılan seçim Doğrulayıcı: talimat eki + niyet sınaması; ikinci aynı eylem reddedilir", () => {
  const { defter, kip } = kur();
  assert.equal(defter.ac(DUSUNME_KIPI).ok, true);
  const [k] = kip.kancalar(); assert.ok(k);
  assert.equal(kip.etkin(), "dogrulayici");
  assert.equal(k.talimatEki?.(b), DOGRULAYICI_EKI);
  assert.equal(k.niyetDogrula?.(git, b).ok, true);
  assert.equal(k.niyetDogrula?.(git, { ...b, simdi: 10 }).ok, false);
});

test("Çözücü: yalnız talimat eki, niyet sınaması YOK (aynı eylem tekrarı geçer)", () => {
  const { defter, kip } = kur();
  defter.ac(DUSUNME_KIPI); defter.secenekYaz(DUSUNME_KIPI, "cozucu");
  const [k] = kip.kancalar(); assert.ok(k);
  assert.equal(kip.etkin(), "cozucu");
  assert.equal(k.talimatEki?.(b), COZUCU_EKI);
  assert.equal(k.niyetDogrula, undefined);
});

test("seçim canlı: kip değişince aynı kip nesnesi yeni kancayı verir; kapatınca tekrar boş", () => {
  const { defter, kip } = kur();
  defter.ac(DUSUNME_KIPI);
  assert.equal(kip.kancalar()[0]!.talimatEki?.(b), DOGRULAYICI_EKI);
  defter.secenekYaz(DUSUNME_KIPI, "cozucu");
  assert.equal(kip.kancalar()[0]!.talimatEki?.(b), COZUCU_EKI);
  defter.kapat(DUSUNME_KIPI);
  assert.deepEqual(kip.kancalar(), []);
});

test("kapatıp açınca doğrulayıcı halkası boşalır (eski kabuller sayılmaz)", () => {
  const { defter, kip } = kur();
  defter.ac(DUSUNME_KIPI);
  kip.kancalar()[0]!.niyetDogrula!(git, b);
  defter.kapat(DUSUNME_KIPI); defter.ac(DUSUNME_KIPI);
  assert.equal(kip.kancalar()[0]!.niyetDogrula!(git, { ...b, simdi: 5 }).ok, true);
});

test("bilinmeyen seçim kaydı Doğrulayıcı'ya düşer (Çözücü yalnız açıkça seçilince)", () => {
  const kip = dusunmeKipiKur({ acikMi: () => true, secenek: () => "saçma" });
  assert.equal(kip.etkin(), "dogrulayici");
});

test("şema: kapalıyken Orion şemasının AYNI nesnesi; açıkken yalnız başlık rozeti değişir", () => {
  assert.equal(kipSemasi(null), ORION_SEMASI);
  assert.equal(kipSemasi("bilinmeyen"), ORION_SEMASI);
  const d = kipSemasi("dogrulayici"), c = kipSemasi("cozucu");
  assert.equal(d.baslik, "ZİHİN AKIŞI · P≠NP"); assert.equal(c.baslik, "ZİHİN AKIŞI · P=NP");
  assert.equal(d.dugumler, ORION_SEMASI.dugumler); assert.equal(d.oklar, ORION_SEMASI.oklar);
});
