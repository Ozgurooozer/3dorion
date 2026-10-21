// flash/secenek.test.ts — "bilmiyorum + seçenek" cümleleri ve en yakın komut (spec 33 dilim 2).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { eylemIddialari } from "../mind/sozEylem.ts";
import { FLASH } from "./npcTanimi.ts";
import { LISTE_AZAMI, bilmiyorumCumlesi, enYakinKomutlar, yapamadimCumlesi } from "./secenek.ts";

const adlar = (soz: string) => enYakinKomutlar(soz, FLASH.komutlar).map((k) => k.soz);

test("soru ekli söz kökünden tanınır: 'oturabilir misin' → otur", () => {
  assert.deepEqual(adlar("oturabilir misin"), ["otur"]);
});

test("başka ekle çekimli yer adı tanınır: 'pencereden dışarı bakar mısın' en çok 'pencereye bak'a yakın", () => {
  assert.equal(adlar("pencereden dışarı bakar mısın")[0], "pencereye bak");
});

test("İngilizce biçim eşleşmeye girer ama öneri Türkçe biçimi söyler: 'please sit down now' → otur", () => {
  assert.deepEqual(adlar("please sit down now"), ["otur"]);
});

test("Türkçe karakter fark etmez: 'kapiya gidebilir misin' → kapıya git", () => {
  assert.equal(adlar("kapiya gidebilir misin")[0], "kapıya git");
});

test("hiçbir komuta benzemeyen söz yakın vermez", () => {
  assert.deepEqual(adlar("bugün hava nasıl"), []);
});

test("iki harfli ortak önek benzerlik sayılmaz ('bi' ≠ 'bir')", () => {
  assert.deepEqual(adlar("bi şarkı söyle"), []);
});

test("sözdeki kısa kelime komut kelimesinin yalnız başıysa yakın sayılmaz: 'bir şiir oku' ≠ 'takibi bırak'", () => {
  assert.deepEqual(adlar("bir şiir oku"), []);
});

test("zamir tek başına öneri doğurmaz: 'bana bir şiir yaz' 'bana gel'e yakın değil", () => {
  assert.deepEqual(adlar("bana bir şiir yaz"), []);
});

test("ünsüz yumuşaması tanınır: 'tahtaya gidebilir misin' → tahtaya git", () => {
  assert.equal(adlar("tahtaya gidebilir misin")[0], "tahtaya git");
});

test("en çok iki öneri döner", () => {
  assert.ok(enYakinKomutlar("bana bir şey getir", FLASH.komutlar).length <= 2);
});

test("tek yakın komutta cümle onu sorar", () => {
  assert.equal(bilmiyorumCumlesi("oturabilir misin", FLASH.komutlar), "Bunu bilmiyorum. Şunu mu demek istedin: «otur»?");
});

test("yakın komut yoksa bildiklerinden ilk LISTE_AZAMI tanesini sayar", () => {
  const ilkler = FLASH.komutlar.slice(0, LISTE_AZAMI).map((k) => k.soz).join(", ");
  assert.equal(bilmiyorumCumlesi("bugün hava nasıl", FLASH.komutlar), `Bunu bilmiyorum. Bildiklerim: ${ilkler}…`);
});

test("bilmiyorum cümlesi eylem iddiası taşımaz (söz-eylem bekçisi 'söyledi ama yapmadı' saymasın)", () => {
  assert.deepEqual(eylemIddialari(bilmiyorumCumlesi("oturabilir misin", FLASH.komutlar)), []);
});

test("'bildiklerim' listesi de eylem iddiası taşımaz", () => {
  assert.deepEqual(eylemIddialari(bilmiyorumCumlesi("bugün hava nasıl", FLASH.komutlar)), []);
});

test("yapamadım cümlesi nedenin yalnız ilk cümlesini söyler", () => {
  assert.equal(yapamadimCumlesi("bilinmeyen çapa: 'raf'. Oturulabilir: sandalye, bank."), "Yapamadım: bilinmeyen çapa: 'raf'.");
});

test("nedensiz hata yine de cevaplanır", () => {
  assert.equal(yapamadimCumlesi(undefined), "Yapamadım.");
});
