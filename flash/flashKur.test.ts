// flash/flashKur.test.ts — Flash köprüsü: aynı Kopru, LLM'siz yollar, NPC'nin bedeni ve "yapamam" (spec 33 dilim 2).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { KARAR_ONEKI } from "../mind/kararKaydi.ts";
import { TAKIP_ONAYI } from "../mind/takipSozu.ts";
import { FLASH } from "./npcTanimi.ts";
import { niyetYonu } from "./flashKur.ts";
import { flashDuzenegi, sozunKurali } from "./flashTest.ts";

test("niyet yönü: konuşma ses hattına", () => {
  assert.equal(niyetYonu(FLASH, { tur: "soyle", metin: "x" }), "ses");
});

test("niyet yönü: oturmak bedene", () => {
  assert.equal(niyetYonu(FLASH, { tur: "otur" }), "beden");
});

test("niyet yönü: monitöre odaklanmak NPC'nin yapamadığı", () => {
  assert.equal(niyetYonu(FLASH, { tur: "odaklan", capa: "monitor" }), "yapamaz");
});

test("'otur' doğuştan programdan geçer (kapı kuralı kopru.komut)", async () => {
  const d = flashDuzenegi();
  try { d.soyle("otur"); await d.bekle(); } finally { d.kapat(); }
  assert.equal(sozunKurali(d.satirlar, "otur"), "kopru.komut");
});

test("'otur': bedene önce onay jesti, sonra otur niyeti gider", async () => {
  const d = flashDuzenegi();
  try { d.soyle("otur"); await d.bekle(); } finally { d.kapat(); }
  assert.deepEqual(d.bedene.map((n) => n.tur), ["jest", "otur"]);
});

test("'otur': beyinsiz beyin hiç uyanmaz", async () => {
  const d = flashDuzenegi();
  try { d.soyle("otur"); await d.bekle(); } finally { d.kapat(); }
  assert.equal(d.f.beyin.sayac().dusun, 0);
});

test("anlaşılmayan söz kopru.konusma'dan beyinsiz beyne düşer", async () => {
  const d = flashDuzenegi();
  try { d.soyle("bugün hava nasıl"); await d.bekle(); } finally { d.kapat(); }
  assert.equal(sozunKurali(d.satirlar, "bugün hava nasıl"), "kopru.konusma");
});

test("anlaşılmayan söze Flash 'bilmiyorum' diye cevap verir", async () => {
  const d = flashDuzenegi();
  try { d.soyle("bugün hava nasıl"); await d.bekle(); } finally { d.kapat(); }
  assert.match(d.sozler[0] ?? "", /^Bunu bilmiyorum\. Bildiklerim: /);
});

test("NPC'nin yapamadığı program (bilgisayarı aç) bedene GİTMEZ", async () => {
  const d = flashDuzenegi();
  try { d.soyle("bilgisayarı aç"); await d.bekle(20); } finally { d.kapat(); }
  assert.deepEqual(d.bedene.map((n) => n.tur), ["jest"]);
});

test("NPC'nin yapamadığı program: Flash nedenini söyler", async () => {
  const d = flashDuzenegi();
  try { d.soyle("bilgisayarı aç"); await d.bekle(20); } finally { d.kapat(); }
  assert.match(d.sozler.join(" | "), /Yapamadım: Flash bunu yapamaz \(odaklan\)/);
});

test("bedenin hatası (dolu sandalye) Flash'a söyletilir", async () => {
  const d = flashDuzenegi({ sonuc: (n) => (n.tur === "otur" ? { durum: "hata", not: "sandalye dolu: Orion oturuyor." } : { durum: "bitti" }) });
  try { d.soyle("otur"); await d.bekle(20); } finally { d.kapat(); }
  assert.deepEqual(d.sozler, ["Yapamadım: sandalye dolu: Orion oturuyor."]);
});

test("beden yüklenmediyse niyet hata sonucuyla döner ve Flash söyler", async () => {
  const d = flashDuzenegi({ bedenYok: true });
  try { d.soyle("kalk"); await d.bekle(20); } finally { d.kapat(); }
  assert.deepEqual(d.sozler, ["Yapamadım: bedenim henüz yüklenmedi"]);
});

test("'beni takip et' takip içgüdüsünden geçer ve dünyaya bildirilir", async () => {
  const d = flashDuzenegi();
  try { d.soyle("beni takip et"); await d.bekle(); } finally { d.kapat(); }
  assert.deepEqual(d.takip, [true]);
});

test("'beni takip et': Flash takip onayını söyler", async () => {
  const d = flashDuzenegi();
  try { d.soyle("beni takip et"); await d.bekle(); } finally { d.kapat(); }
  assert.deepEqual(d.sozler, [TAKIP_ONAYI.basla]);
});

test("Flash'ın karar kaydı konsola [KARAR] satırı basmaz (host onu Orion'un dosyasına yazardı)", async () => {
  const eski = console.log;
  const basilan: string[] = [];
  console.log = (...a: unknown[]) => { basilan.push(a.map(String).join(" ")); };
  const d = flashDuzenegi();
  try { d.soyle("otur"); d.soyle("bugün hava nasıl"); await d.bekle(); } finally { d.kapat(); console.log = eski; }
  assert.deepEqual(basilan.filter((s) => s.startsWith(KARAR_ONEKI)), []);
});
