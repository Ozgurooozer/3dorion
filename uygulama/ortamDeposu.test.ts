// uygulama/ortamDeposu.test.ts — Modüler kalıcılık: günlük sıkıştırma (saf), iki depo, iki kip, kip geçişleri.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { gunluguEkle, bellekDeposu, yerelDepo, OrtamGunlugu, GUNLUK_SINIRI, type DepoYuzeyi } from "./ortamDeposu.ts";
import { ortamBaglantisiKur, type OrtamLevel } from "./ortamBaglantisi.ts";
import { ornekTanim } from "../world/level/cekirdek/ornekTanim.ts";
import type { LevelTanimi } from "../world/level/cekirdek/levelTanimi.ts";
import type { OrtamKomutu } from "../world/level/stil/ortamKomutu.ts";

const k = (ne: OrtamKomutu["ne"], deger?: string, sayi?: number): OrtamKomutu =>
  ({ tur: "ortam", ne, ...(deger !== undefined ? { deger } : {}), ...(sayi !== undefined ? { sayi } : {}) });
const ozet = (l: readonly OrtamKomutu[]) => l.map((x) => `${x.ne}${x.deger ? ":" + x.deger : ""}${x.sayi !== undefined ? "=" + x.sayi : ""}`);

/** Sahte tarayıcı deposu. */
function sahteDepo(): DepoYuzeyi & { veri: Map<string, string> } {
  const veri = new Map<string, string>();
  return { veri, getItem: (a) => veri.get(a) ?? null, setItem: (a, d) => { veri.set(a, d); }, removeItem: (a) => { veri.delete(a); } };
}

// ── günlük sıkıştırma ──

test("mutlak komut aynı konudaki eskisini düşürür (saat, akis, dunya, renk)", () => {
  let l: OrtamKomutu[] = [];
  for (const x of [k("saat", undefined, 21), k("saat_kaydir", undefined, 2), k("saat", undefined, 9), k("renk", "pastel"), k("renk", "gunduz"),
    k("akis", "ac"), k("akis", "kapat"), k("dunya", "buyu"), k("dunya", "ova")]) l = gunluguEkle(l, x);
  assert.deepEqual(ozet(l), ["saat=9", "renk:gunduz", "akis:kapat", "dunya:ova"]);
});

test("göreli komutlar birikir (kıs/aç, sıcak, saat_kaydir, sis yoğun)", () => {
  let l: OrtamKomutu[] = [];
  for (const x of [k("isik", "kis"), k("isik", "kis"), k("saat_kaydir", undefined, 1), k("sis", "yogun"), k("sis", "yogun")]) l = gunluguEkle(l, x);
  assert.equal(l.length, 5);
});

test("sis ac/kapat önceki sis komutlarını ezer; yoğun/hafif ezmez", () => {
  let l: OrtamKomutu[] = [];
  for (const x of [k("sis", "ac"), k("sis", "yogun"), k("sis", "kapat")]) l = gunluguEkle(l, x);
  assert.deepEqual(ozet(l), ["sis:kapat"]);
  l = gunluguEkle(l, k("sis", "yogun"));
  assert.deepEqual(ozet(l), ["sis:kapat", "sis:yogun"]);
});

test("efekt ve shader: aynı grup/ad ezilir, farklısı kalır", () => {
  let l: OrtamKomutu[] = [];
  for (const x of [k("efekt", "bloom:kapat"), k("efekt", "ao:ac"), k("efekt", "bloom:ac"), k("shader", "atmosfer:ac"), k("shader", "atmosfer:kapat"), k("shader", "firca:ac")]) l = gunluguEkle(l, x);
  assert.deepEqual(ozet(l), ["efekt:ao:ac", "efekt:bloom:ac", "shader:atmosfer:kapat", "shader:firca:ac"]);
});

test("stil önayarı eski stil, efekt ve sıcak/soğuk komutlarını düşürür; pozlama, sis, zaman, shader kalır", () => {
  let l: OrtamKomutu[] = [];
  for (const x of [k("stil", "cel"), k("efekt", "bloom:ac"), k("isik", "sicak"), k("isik", "kis"), k("sis", "ac"), k("saat", undefined, 3), k("shader", "firca:ac"), k("stil", "toon")]) l = gunluguEkle(l, x);
  assert.deepEqual(ozet(l), ["isik:kis", "sis:ac", "saat=3", "shader:firca:ac", "stil:toon"]);
});

test("sifirla günlüğü boşaltır ve kendisi girmez", () => {
  let l = gunluguEkle([], k("stil", "toon"));
  l = gunluguEkle(l, k("sifirla"));
  assert.deepEqual(l, []);
});

test("günlük sınırı: en eskisi düşer, girdi değişmez", () => {
  let l: OrtamKomutu[] = [];
  const girdi = k("isik", "kis");
  for (let i = 0; i < GUNLUK_SINIRI + 10; i++) l = gunluguEkle(l, girdi);
  assert.equal(l.length, GUNLUK_SINIRI);
  const onceki = [...l];
  gunluguEkle(l, k("isik", "ac"));
  assert.deepEqual(l, onceki, "girdi liste değişmemeli");
});

// ── depolar ──

test("bellekDeposu: yaz/oku kopya döner, sil boşaltır", () => {
  const d = bellekDeposu();
  const kayit = { surum: 1 as const, komutlar: [k("stil", "toon")] };
  d.yaz(kayit);
  kayit.komutlar.push(k("isik", "kis"));
  assert.equal(d.oku().komutlar.length, 1);
  d.sil();
  assert.deepEqual(d.oku().komutlar, []);
});

test("yerelDepo: yazdığını okur; bozuk, eski sürüm ve tanınmayan komut sessizce boş/süzülmüş döner", () => {
  const s = sahteDepo(), d = yerelDepo("a", s);
  d.yaz({ surum: 1, komutlar: [k("saat", undefined, 21)] });
  assert.deepEqual(ozet(d.oku().komutlar), ["saat=21"]);
  s.veri.set("a", "{bozuk");
  assert.deepEqual(d.oku().komutlar, []);
  s.veri.set("a", JSON.stringify({ surum: 9, komutlar: [k("stil", "toon")] }));
  assert.deepEqual(d.oku().komutlar, []);
  s.veri.set("a", JSON.stringify({ surum: 1, komutlar: [k("stil", "toon"), { tur: "ortam", ne: "bilinmeyen" }, { tur: "soyle", metin: "x" }, null, { tur: "ortam", ne: "saat", sayi: "21" }] }));
  assert.deepEqual(ozet(d.oku().komutlar), ["stil:toon"]);
});

test("yerelDepo: depo erişilemezse (özel pencere) fırlatmaz, boş döner", () => {
  const bozuk: DepoYuzeyi = { getItem() { throw new Error("engelli"); }, setItem() { throw new Error("engelli"); }, removeItem() { throw new Error("engelli"); } };
  const d = yerelDepo("a", bozuk);
  assert.doesNotThrow(() => d.yaz({ surum: 1, komutlar: [] }));
  assert.deepEqual(d.oku().komutlar, []);
  assert.doesNotThrow(() => d.sil());
});

// ── iki kip ──

test("OTURUM kipi: günlük bellekte, tarayıcı deposuna GÖRÜNÜR ŞEY yazılmaz", () => {
  const s = sahteDepo();
  const g = new OrtamGunlugu({ depo: s, kip: "oturum" });
  g.kaydet(k("stil", "toon")); g.kaydet(k("saat", undefined, 21));
  assert.deepEqual(ozet(g.komutlar()), ["stil:toon", "saat=21"]);
  assert.equal(s.veri.has("orion.ortam.gunluk"), false);
});

test("KALICI kip: her komut yerel depoya yazılır; yeni örnek (= yeniden açılış) onu okur", () => {
  const s = sahteDepo();
  const a = new OrtamGunlugu({ depo: s, kip: "kalici" });
  a.kaydet(k("stil", "toon")); a.kaydet(k("isik", "kis"));
  const b = new OrtamGunlugu({ depo: s, kip: "kalici" });
  assert.deepEqual(ozet(b.komutlar()), ["stil:toon", "isik:kis"]);
});

test("OTURUM kipinde açılışta önceki kalıcı günlük OKUNMAZ (sızmaz)", () => {
  const s = sahteDepo();
  new OrtamGunlugu({ depo: s, kip: "kalici" }).kaydet(k("stil", "toon"));
  assert.deepEqual(new OrtamGunlugu({ depo: s, kip: "oturum" }).komutlar(), []);
});

test("kip geçişleri: oturum→kalıcı günlüğü hemen yazar; kalıcı→oturum yerel kaydı SİLER; kip tarayıcıda saklanır", () => {
  const s = sahteDepo();
  const g = new OrtamGunlugu({ depo: s, kip: "oturum" });
  g.kaydet(k("stil", "cel"));
  g.kipAyarla("kalici");
  assert.equal(g.kip, "kalici");
  assert.deepEqual(ozet(new OrtamGunlugu({ depo: s, kip: "kalici" }).komutlar()), ["stil:cel"]);
  assert.equal(OrtamGunlugu.kayitliKip(s), "kalici");
  g.kipAyarla("oturum");
  assert.equal(s.veri.has("orion.ortam.gunluk"), false, "oturuma dönünce yerel kayıt silinmeli");
  assert.equal(OrtamGunlugu.kayitliKip(s), "oturum");
  assert.deepEqual(ozet(g.komutlar()), ["stil:cel"], "bellekteki oturum günlüğü kalır");
});

test("unut: bellek ve kalıcı kayıt gider", () => {
  const s = sahteDepo();
  const g = new OrtamGunlugu({ depo: s, kip: "kalici" });
  g.kaydet(k("stil", "toon"));
  g.unut();
  assert.deepEqual(g.komutlar(), []);
  assert.equal(s.veri.has("orion.ortam.gunluk"), false);
});

test("kayıtlı kip tanınmazsa oturum (güvenli varsayılan)", () => {
  const s = sahteDepo();
  assert.equal(OrtamGunlugu.kayitliKip(s), "oturum");
  s.veri.set("orion.ortam.kalicilik", "garip");
  assert.equal(OrtamGunlugu.kayitliKip(s), "oturum");
});

// ── yeniden oynatma: taze level üzerine ──

function sahteLevel(): OrtamLevel & { son(): LevelTanimi; ayarlaSayisi(): number } {
  let t = ornekTanim(), n = 0;
  return { tanim: () => structuredClone(t), ayarla(y) { t = y as LevelTanimi; n++; }, dunya: { saat: 12 }, son: () => t, ayarlaSayisi: () => n };
}

test("günlük taze level'a TEK ayarla ile oynatılır ve dinleyiciler çağrılmaz (tekrar günlüğe yazılmaz)", () => {
  const b = ortamBaglantisiKur(), l = sahteLevel();
  b.ova(l);
  let duyulan = 0;
  b.dinle(() => { duyulan++; });
  const r = b.oynat([k("stil", "toon"), k("isik", "kis"), k("saat", undefined, 21), k("sis", "ac")]);
  assert.deepEqual([r.uygulanan, r.atlanan.length, l.ayarlaSayisi(), duyulan], [4, 0, 1, 0]);
  assert.equal(l.son().zaman?.saat, 21);
  assert.equal(l.son().ortam.sis.acik, true);
  assert.ok(l.son().ortam.tonlama.pozlama < 1);
});

test("oynatma: bozuk komut atlanır ve sayılır, kalanlar uygulanır; level yoksa 0", () => {
  const b = ortamBaglantisiKur();
  assert.deepEqual(b.oynat([k("stil", "toon")]), { uygulanan: 0, atlanan: [] });
  const l = sahteLevel();
  b.ova(l);
  const r = b.oynat([k("stil", "yok-boyle-stil"), k("isik", "ac")]);
  assert.equal(r.uygulanan, 1);
  assert.equal(r.atlanan.length, 1);
  assert.match(r.atlanan[0]!, /stil yok-boyle-stil/);
});

test("oynatma: hiç uygulanamazsa ayarla çağrılmaz", () => {
  const b = ortamBaglantisiKur(), l = sahteLevel();
  b.ova(l);
  b.oynat([k("stil", "yok")]);
  assert.equal(l.ayarlaSayisi(), 0);
});

test("uçtan uca: komut → günlük → yeniden açılış → taze level aynı görünüme gelir", () => {
  const s = sahteDepo();
  // oturum 1 (kalıcı kip)
  const b1 = ortamBaglantisiKur(), l1 = sahteLevel(), g1 = new OrtamGunlugu({ depo: s, kip: "kalici" });
  b1.ova(l1); b1.dinle((komut) => g1.kaydet(komut));
  b1.uygula(k("stil", "anime90")); b1.uygula(k("saat", undefined, 3)); b1.uygula(k("isik", "kis"));
  // oturum 2: yeni örnekler, taze level
  const b2 = ortamBaglantisiKur(), l2 = sahteLevel(), g2 = new OrtamGunlugu({ depo: s, kip: "kalici" });
  b2.ova(l2);
  b2.oynat(g2.komutlar());
  assert.deepEqual(l2.son(), l1.son());
});
