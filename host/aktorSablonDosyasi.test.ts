// host/aktorSablonDosyasi.test.ts — aktör şablonu dosyası (spec 45 §8, B6): Content/Actors 8. korumalı klasör, `<ad>.aktor.json` ad kuralı, `aktorYaz` (üstüne yazmaz, atomik, JSON/boyut/ad denetimi).
// `icerik.test.ts` kalabalık olmasın diye ayrı dosya; aynı sahte proje düzeni.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AKTOR_TAVAN, adlandir, aktorYaz, cogalt, icerikListe, icerikMetin, sil, yeniKlasor } from "./icerik.js";
import { ICERIK_KLASORLERI } from "./proje.js";

const kod = (f: () => unknown): string | undefined => { try { f(); } catch (e) { return (e as { kod?: string }).kod; } return undefined; };
const kur = (actorsKlasoruVar = true) => {
  const content = fs.mkdtempSync(path.join(os.tmpdir(), "orion-aktor-test-"));
  for (const k of Object.values(ICERIK_KLASORLERI)) if (actorsKlasoruVar || k !== "Actors") fs.mkdirSync(path.join(content, k), { recursive: true });
  return { content, kokler: { Content: content, Engine: content } };
};
const SABLON = JSON.stringify({ surum: 1, ad: "kutu", kok: "s1", aktorler: [] });

test("Actors proje klasörleri arasında ve korumalı: yeniden adlandırılamaz/silinemez", () => {
  assert.equal(ICERIK_KLASORLERI.aktor, "Actors");
  const { kokler } = kur();
  assert.equal(kod(() => adlandir(kokler, "Content/Actors", "Aktorler")), "korumali");
  assert.equal(kod(() => sil(kokler, "Content/Actors", () => 1)), "korumali");
});

test("aktorYaz: dosyayı yazar, adresi döner, içerik okunur; geçici dosya kalmaz", () => {
  const { kokler, content } = kur();
  const adres = aktorYaz(kokler, "kutu", SABLON);
  assert.equal(adres, "Content/Actors/kutu.aktor.json");
  assert.equal(icerikMetin(kokler, adres), SABLON);
  assert.deepEqual(fs.readdirSync(path.join(content, "Actors")), ["kutu.aktor.json"]);
  assert.ok(icerikListe(kokler, "Content").ogeler.some((o) => o.adres === adres));
});

test("aktorYaz: Actors klasörü yoksa (eski proje) açar", () => {
  const { kokler, content } = kur(false);
  assert.equal(fs.existsSync(path.join(content, "Actors")), false);
  aktorYaz(kokler, "kutu", SABLON);
  assert.ok(fs.existsSync(path.join(content, "Actors", "kutu.aktor.json")));
});

test("aktorYaz: var olanın üstüne YAZMAZ (var) ve içeriği korur", () => {
  const { kokler, content } = kur();
  aktorYaz(kokler, "kutu", SABLON);
  assert.equal(kod(() => aktorYaz(kokler, "kutu", JSON.stringify({ baska: 1 }))), "var");
  assert.equal(fs.readFileSync(path.join(content, "Actors", "kutu.aktor.json"), "utf8"), SABLON);
});

test("aktorYaz: geçersiz ad, metin olmayan, JSON olmayan, dizi/boş, büyük içerik reddedilir; hiçbiri dosya bırakmaz", () => {
  const { kokler, content } = kur();
  for (const ad of ["", "kötü ad", "a/b", "..", "a.b", "x".repeat(49), null, 5]) assert.equal(kod(() => aktorYaz(kokler, ad as string, SABLON)), "gecersiz-ad", String(ad));
  assert.equal(kod(() => aktorYaz(kokler, "a", 5 as unknown as string)), "gecersiz-icerik");
  assert.equal(kod(() => aktorYaz(kokler, "a", "{bozuk")), "gecersiz-icerik");
  assert.equal(kod(() => aktorYaz(kokler, "a", "[]")), "gecersiz-icerik");
  assert.equal(kod(() => aktorYaz(kokler, "a", "null")), "gecersiz-icerik");
  assert.equal(kod(() => aktorYaz(kokler, "a", JSON.stringify({ x: "a".repeat(AKTOR_TAVAN) }))), "cok-buyuk");
  assert.deepEqual(fs.readdirSync(path.join(content, "Actors")), []);
});

test("aktorYaz: kök yoksa (proje açık değil) kok-yok", () => {
  assert.equal(kod(() => aktorYaz({ Engine: "x" }, "kutu", SABLON)), "kok-yok");
});

test("türün ad kuralı: Actors'a yalnız '<ad>.aktor.json' girer, alt klasör açılmaz; çoğalt '<ad> kopya.aktor.json' ad kuralına takılır mı gösterilir", () => {
  const { kokler } = kur();
  assert.equal(kod(() => yeniKlasor(kokler, "Content/Actors/alt")), "gecersiz-ad");
  aktorYaz(kokler, "kutu", SABLON);
  assert.equal(kod(() => adlandir(kokler, "Content/Actors/kutu.aktor.json", "kutu.json")), "gecersiz-ad");
  assert.equal(kod(() => adlandir(kokler, "Content/Actors/kutu.aktor.json", "uzunbirdosyaadi.json")), "gecersiz-ad", "uzantı kuralı ad uzunluğundan bağımsız");
  assert.equal(kod(() => yeniKlasor(kokler, "Content/Actors/x.aktor.json")), "gecersiz-ad", "uzantılı ad klasör olamaz");
  assert.equal(kod(() => adlandir(kokler, "Content/Actors/kutu.aktor.json", "kötü ad.aktor.json")), "gecersiz-ad");
  assert.equal(adlandir(kokler, "Content/Actors/kutu.aktor.json", "kasa.aktor.json"), "Content/Actors/kasa.aktor.json");
});

test("çoğalt/adlandır: düz klasör ayracı '_' ('kasa_kopya.aktor.json'); şablonun içindeki ad dosya adına uydurulur, başka adlı içeriğe dokunulmaz", () => {
  const { kokler, content } = kur();
  aktorYaz(kokler, "kasa", JSON.stringify({ ad: "kasa", surum: 1 }));
  const kopya = cogalt(kokler, "Content/Actors/kasa.aktor.json");
  assert.equal(kopya, "Content/Actors/kasa_kopya.aktor.json");
  assert.equal(JSON.parse(icerikMetin(kokler, kopya)).ad, "kasa_kopya");
  assert.equal(cogalt(kokler, "Content/Actors/kasa.aktor.json"), "Content/Actors/kasa_kopya_2.aktor.json");
  const yeni = adlandir(kokler, kopya, "sandik.aktor.json");
  assert.equal(JSON.parse(icerikMetin(kokler, yeni)).ad, "sandik");
  assert.equal(JSON.parse(fs.readFileSync(path.join(content, "Actors", "kasa.aktor.json"), "utf8")).ad, "kasa", "özgün dosya değişmez");
  aktorYaz(kokler, "baska", JSON.stringify({ ad: "tamamen-farkli" }));
  const b = adlandir(kokler, "Content/Actors/baska.aktor.json", "diger.aktor.json");
  assert.equal(JSON.parse(icerikMetin(kokler, b)).ad, "tamamen-farkli", "içteki ad dosya adıyla eşit değilse dokunulmaz");
});
