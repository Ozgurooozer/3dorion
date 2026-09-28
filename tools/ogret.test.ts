// tools/ogret.test.ts — Öğretme aracı: kayıt yeri, liste, bulma, yazma, hafıza dökümü.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { KARAR_ONEKI, KararKaydi, niyetKaydi, type AlgiSatiri, type KararSatiri } from "../mind/kararKaydi.ts";
import { beceriHafizasiKur } from "../mind/beceriHafizasi.ts";
import { sozAnahtari, type GorevOrnegi } from "../mind/gorev.ts";
import type { Niyet } from "../protocol/niyet.ts";
import { kuralHafizasiKur, ogretimKur } from "../mind/ogretim.ts";
import { zincirKur } from "../mind/kararZinciri.ts";
import { spawnSync } from "node:child_process";
import { BECERI_ACIKLAMASI, adimMetni, algiBul, beceriMetni, cevapCoz, dersVer, gozdenListesi, gozdenMetni, hafizaMetni, kayitYeri, kayitYukle, ogrenilebilirListe, ogretimYaz } from "./ogret.ts";

const ELLE = ["durum:hata", "icgudu:refleks.sonuc.hata", "k:zaten", "niyet_kaynagi:elle", "tur:sonuc"];

/** Gerçek kayıt satırları: bir öğrenilebilir algı (uyandırdı, LLM sustu), bir konuşma (öğrenilemez). */
function kayit(): KararSatiri[] {
  const satirlar: KararSatiri[] = [];
  let t = 1_000;
  const k = new KararKaydi({ oturum: "o1", simdi: () => (t += 1_000), yaz: (s) => satirlar.push(JSON.parse(s.slice(KARAR_ONEKI.length + 1))) });
  k.oturumBasi("sahte");
  const a1 = k.algi({ tur: "sonuc", sonuc: { niyet_id: "elle_x", durum: "hata", not: "zaten ayaktasın" } }, "Intent elle_x → hata", { gecti: true, kural: "refleks.sonuc.hata" }, { isaret: ELLE, golge: null });
  k.uyanis({ algilar: [a1], geriBesleme: 0, beyin: "sahte", sureMs: 5, koken: "dis", takip: false, anilar: 0, dunya: "", cagrilar: [], niyetler: [], reddedilen: 0, kurtarilan: 0, konusulanMetin: false, yutulanSoz: 0 });
  k.algi({ tur: "duydum", metin: "merhaba", kesin: true }, 'Ozyn said: "merhaba"', { gecti: true, kural: "kopru.konusma" });
  return satirlar;
}

function geciciDizin(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "orion-ogret-"));
}

test("kayıt yeri: klasörde her .jsonl okunur, öğretim klasöre yazılır", () => {
  const d = geciciDizin();
  fs.writeFileSync(path.join(d, "2026-09-27.jsonl"), "");
  fs.writeFileSync(path.join(d, "not.txt"), "");
  const y = kayitYeri(d);
  assert.deepEqual({ dosyalar: y.dosyalar.map((f) => path.basename(f)), ogretim: y.ogretimDosyasi }, { dosyalar: ["2026-09-27.jsonl"], ogretim: path.join(d, "ogretim.jsonl") });
});

test("kayıt yeri: sabit dosya verilirse o dosya ve yanındaki öğretim dosyası", () => {
  const d = geciciDizin();
  const f = path.join(d, "canli.jsonl");
  fs.writeFileSync(f, "");
  fs.writeFileSync(path.join(d, "ogretim.jsonl"), "");
  assert.deepEqual(kayitYeri(f).dosyalar.map((x) => path.basename(x)), ["canli.jsonl", "ogretim.jsonl"]);
});

test("liste yalnız öğrenilebilir algıları gösterir; uyandırdığı uyanışta LLM'in sustuğu görünür", () => {
  const z = zincirKur(kayit());
  const liste = ogrenilebilirListe(z, kuralHafizasiKur([]).hafiza, 20);
  assert.deepEqual(liste.map((s) => ({ anahtar: s.anahtar, sonra: s.sonra, ders: s.ders })), [{ anahtar: "o1/a1", sonra: "sustu", ders: null }]);
});

test("liste verilmiş dersi ve bugünkü hafızanın kararını gösterir", () => {
  const satirlar = kayit();
  const a = satirlar.find((s): s is AlgiSatiri => s.tur === "algi" && s.id === "a1")!;
  const ders = ogretimKur(a, "sus", "ogret-araci", 99_999);
  assert.ok(!("hata" in ders));
  const hepsi = [...satirlar, ders];
  const [s] = ogrenilebilirListe(zincirKur(hepsi), kuralHafizasiKur(hepsi).hafiza, 20);
  assert.deepEqual({ ders: s!.ders, simdi: s!.simdi, golge: s!.golge }, { ders: "sus", simdi: "sus (K1)", golge: "—" });
});

test("algiBul oturum/algı anahtarıyla bulur; yanlış anahtar null", () => {
  const z = zincirKur(kayit());
  assert.deepEqual([algiBul(z, "o1/a1")?.id, algiBul(z, "o1/a99"), algiBul(z, "a1"), algiBul(z, "o2/a1")], ["a1", null, null, null]);
});

test("öğretim dosyaya bir satır olarak eklenir ve kayıttan yeniden okunur", () => {
  const d = geciciDizin();
  const satirlar = kayit();
  fs.writeFileSync(path.join(d, "2026-09-27.jsonl"), satirlar.map((s) => JSON.stringify(s)).join("\n") + "\n");
  const a = satirlar.find((s): s is AlgiSatiri => s.tur === "algi" && s.id === "a1")!;
  const s = ogretimKur(a, "sus", "ogret-araci", 50_000);
  assert.ok(!("hata" in s));
  const yer = kayitYeri(d);
  ogretimYaz(yer.ogretimDosyasi, s);
  const { zincir } = kayitYukle(kayitYeri(d));
  assert.deepEqual(zincir.ogretimler.map((o) => ({ hedef: o.hedef, yon: o.yon })), [{ hedef: { o: "o1", id: "a1" }, yon: "sus" }]);
});

test("hafıza dökümü: boşken söyler; doluyken kural, yön, sayaç ve kanıt", () => {
  const bos = hafizaMetni(kuralHafizasiKur([]).hafiza);
  const a = kayit().find((s): s is AlgiSatiri => s.tur === "algi" && s.id === "a1")!;
  const ders = ogretimKur(a, "sus", "ogret-araci", 1);
  assert.ok(!("hata" in ders));
  const dolu = hafizaMetni(kuralHafizasiKur([ders]).hafiza);
  assert.deepEqual(
    { bos, dolu: dolu[0] },
    { bos: ["(hafıza boş: henüz ders yok)"], dolu: `K1: ${ELLE.join(" ∧ ")} → sus (uyan 0 · sus 1) · kanıt 1: o1/a1` },
  );
});

// ── Gözden geçirme (gozden) ────────────────────────────────────────────────

/** Kaydı geçici bir klasöre yazar; araç onu gerçek kayıt gibi okur. */
function kayitKlasoru(satirlar: KararSatiri[]): string {
  const d = geciciDizin();
  fs.writeFileSync(path.join(d, "2026-09-27.jsonl"), satirlar.map((s) => JSON.stringify(s)).join("\n") + "\n");
  return d;
}

test("cevap: u uyan, s sus, g ve Enter geç, ç/c/q çık; büyük harf de; tanınmayan null", () => {
  const tuslar = ["u", "S", "g", "", "  ", "ç", "Ç", "c", "q", "x", "uyan"];
  assert.deepEqual(tuslar.map(cevapCoz), ["uyan", "sus", "gec", "gec", "gec", "cik", "cik", "cik", "cik", null, null]);
});

test("gözden listesi yalnız dersi olmayan kararları alır", () => {
  const satirlar = kayit();
  const a = satirlar.find((s): s is AlgiSatiri => s.tur === "algi" && s.id === "a1")!;
  const ders = ogretimKur(a, "sus", "ogret-araci", 99_999);
  assert.ok(!("hata" in ders));
  const once = gozdenListesi(ogrenilebilirListe(zincirKur(satirlar), kuralHafizasiKur(satirlar).hafiza, 20));
  const sonra = gozdenListesi(ogrenilebilirListe(zincirKur([...satirlar, ders]), kuralHafizasiKur([...satirlar, ders]).hafiza, 20));
  assert.deepEqual({ once: once.map((s) => s.anahtar), sonra: sonra.length }, { once: ["o1/a1"], sonra: 0 });
});

test("gözden metni: sıra, kapının kararı, uyanışın sonucu, gölge ve hafıza görünür", () => {
  const [s] = ogrenilebilirListe(zincirKur(kayit()), kuralHafizasiKur([]).hafiza, 20);
  const [bas, golge] = gozdenMetni(s!, 1, 3);
  assert.deepEqual(
    { sira: bas!.startsWith("[1/3]"), kapi: bas!.includes("GEÇTİ (refleks.sonuc.hata) → sustu"), golge },
    { sira: true, kapi: true, golge: "  gölge: — · şimdi: —" },
  );
});

test("ders ver: öğretim dosyaya eklenir ve hafızanın yeni kararı söylenir", () => {
  const satirlar = kayit();
  const yer = kayitYeri(kayitKlasoru(satirlar));
  const a = satirlar.find((s): s is AlgiSatiri => s.tur === "algi" && s.id === "a1")!;
  const d = dersVer(yer, satirlar, a, "sus", 50_000);
  assert.ok(!("hata" in d), "ders verilemedi");
  const yazilan = fs.readFileSync(yer.ogretimDosyasi, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(
    { yazilan: yazilan.map((o) => o.yon), hafiza: d.metin[2] },
    { yazilan: ["sus"], hafiza: `  hafıza artık: sus — K1: ${ELLE.join(" ∧ ")}` },
  );
});

test("ders ver: öğrenilemez algı (konuşma) reddedilir, dosyaya bir şey yazılmaz", () => {
  const satirlar = kayit();
  const yer = kayitYeri(kayitKlasoru(satirlar));
  const soz = satirlar.find((s): s is AlgiSatiri => s.tur === "algi" && s.algi === "duydum")!;
  const d = dersVer(yer, satirlar, soz, "sus", 50_000);
  assert.deepEqual({ hata: "hata" in d, dosya: fs.existsSync(yer.ogretimDosyasi) }, { hata: true, dosya: false });
});

/** Aracı gerçek süreç olarak koşar; cevaplar stdin'den gelir. */
function gozdenKos(klasor: string, girdi: string): { cikti: string; dersler: string[] } {
  const kok = path.resolve(import.meta.dirname, "..");
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", path.join(kok, "tools", "ogret.ts"), "gozden", `--kayit=${klasor}`], { input: girdi, encoding: "utf8" });
  const dosya = path.join(klasor, "ogretim.jsonl");
  const dersler = fs.existsSync(dosya) ? fs.readFileSync(dosya, "utf8").trim().split("\n").map((l) => JSON.parse(l).yon) : [];
  return { cikti: r.stdout, dersler };
}

test("uçtan uca: tanınmayan tuş yeniden sorulur, 's' ders yazar", () => {
  const r = gozdenKos(kayitKlasoru(kayit()), "x\ns\n");
  assert.deepEqual({ dersler: r.dersler, ozet: r.cikti.includes("1 ders verildi") }, { dersler: ["sus"], ozet: true });
});

/** İki öğrenilebilir kararlı kayıt. `ayniKod`: iki kararın durum kodu aynı (ders ikinciye yansımalı). */
function ikiKararliKayit(ayniKod = false): KararSatiri[] {
  const satirlar: KararSatiri[] = [];
  let t = 1_000;
  const k = new KararKaydi({ oturum: "o2", simdi: () => (t += 1_000), yaz: (s) => satirlar.push(JSON.parse(s.slice(KARAR_ONEKI.length + 1))) });
  k.oturumBasi("sahte");
  for (const id of ["n_a", "n_b"]) {
    k.algi({ tur: "sonuc", sonuc: { niyet_id: id, durum: "hata", not: "bilinmeyen çapa" } }, `Intent ${id} → hata`, { gecti: true, kural: "refleks.sonuc.hata" },
      { isaret: ["durum:hata", "icgudu:refleks.sonuc.hata", `k:${ayniKod ? "ortak" : id}`, "niyet_kaynagi:n", "tur:sonuc"], golge: null });
  }
  return satirlar;
}

test("uçtan uca: girdi biterse (EOF) ilk kararda ders yazmadan çıkar", () => {
  const r = gozdenKos(kayitKlasoru(ikiKararliKayit()), "");
  assert.deepEqual(
    { dersler: r.dersler, ilk: r.cikti.includes("[1/2]"), ikinci: r.cikti.includes("[2/2]"), ozet: r.cikti.includes("0 ders verildi") },
    { dersler: [], ilk: true, ikinci: false, ozet: true },
  );
});

test("uçtan uca: ders sonraki kararın 'şimdi'sine hemen yansır (hafıza her dersten sonra yeniden kurulur)", () => {
  const r = gozdenKos(kayitKlasoru(ikiKararliKayit(true)), "s\nç\n");
  const ikinci = r.cikti.slice(r.cikti.indexOf("[2/2]"));
  assert.deepEqual({ dersler: r.dersler, simdi: ikinci.includes("şimdi: sus (K1)") }, { dersler: ["sus"], simdi: true });
});

// ── Beceriler (spec 10) ────────────────────────────────────────────────────

test("adım metni ızgarası: her bedensel niyet kısa haliyle, yuva köşeli parantezde", () => {
  const capa = (ad: string) => ({ tip: "capa" as const, ad });
  const HEDEF = new Set(["hedef.ad"]), CAPA = new Set(["capa"]);
  const izgara: [Niyet, ReadonlySet<string>, string][] = [
    [{ tur: "git", hedef: capa("masa") }, new Set(), "git masa"],
    [{ tur: "git", hedef: capa("pencere") }, HEDEF, "git [pencere]"],
    [{ tur: "git", hedef: { tip: "nesne", ad: "kupa" } }, new Set(), "git nesne:kupa"],
    [{ tur: "git", hedef: { tip: "oyuncu" } }, new Set(), "git Ozyn"],
    [{ tur: "git", hedef: { tip: "nokta", x: 1, y: 0, z: 2 } }, new Set(), "git (1, 0, 2)"],
    [{ tur: "git", hedef: capa("masa"), mesafe: 1.5 }, new Set(), "git masa (1.5 m)"],
    [{ tur: "bak", hedef: null }, new Set(), "bak serbest"],
    [{ tur: "bak", hedef: capa("tahta") }, HEDEF, "bak [tahta]"],
    [{ tur: "jest", jest: "başını_sallıyor" }, new Set(), "jest başını_sallıyor"],
    [{ tur: "jest", jest: "işaret_ediyor", hedef: capa("kapi") }, HEDEF, "jest işaret_ediyor → [kapi]"],
    [{ tur: "otur" }, new Set(), "otur"],
    [{ tur: "otur", capa: "sandalye" }, CAPA, "otur [sandalye]"],
    [{ tur: "odaklan", capa: "monitor" }, new Set(), "odaklan monitor"],
    [{ tur: "poz", poz: "oturuyor" }, new Set(), "poz oturuyor"],
    [{ tur: "al", nesne: "kupa" }, new Set(), "al kupa"],
    [{ tur: "birak" }, new Set(), "birak"],
    [{ tur: "kalk" }, new Set(), "kalk"],
    [{ tur: "dur" }, new Set(), "dur"],
  ];
  assert.deepEqual(izgara.map(([n, y]) => adimMetni(n, y)), izgara.map(([, , m]) => m));
});

/** Bir görev örneği: adımların hepsi bitti. */
function gorevOrnegi(soz: string, adimlar: Niyet[], sonuc: "basari" | "hata", t: number): GorevOrnegi {
  return {
    kaynak: "uyanis", kimlik: `o1/u${t}`, t, soz, anahtar: sozAnahtari(soz)!,
    adimlar: adimlar.map((govde) => ({ govde, durum: "bitti" as const })), eslik: 0, sonuc, sureMs: 1000,
  };
}

test("beceri dökümü: boş hafıza söylenir", () => {
  assert.deepEqual(beceriMetni(beceriHafizasiKur([])), ["(beceri yok: henüz bir kez başarılmış bedensel görev yok)"]);
});

test("beceri dökümü: etkin beceri — durum, pay, sayaç, kanıt, ilk söz, çerçeve, yuva, adımlar", () => {
  const git = (ad: string): Niyet => ({ tur: "git", hedef: { tip: "capa", ad } });
  const h = beceriHafizasiKur([
    gorevOrnegi("pencereye git otur", [git("pencere"), { tur: "otur" }], "basari", 1),
    gorevOrnegi("masaya git otur", [git("masa"), { tur: "otur" }], "basari", 2),
  ]);
  assert.deepEqual(beceriMetni(h), [
    `${h.beceriler[0]!.id} · ETKİN · pay 1,00 (başarı 2 · hata 0) · kanıt 2: o1/u1, o1/u2`,
    `  ilk söz: "pencereye git otur" · çerçeve: git otur · yuva: 1`,
    "  adımlar: git [pencere] → otur",
  ]);
});

test("beceri dökümü: payı 0,75'in altındaki beceri ASKIDA", () => {
  const h = beceriHafizasiKur([
    gorevOrnegi("masaya otur", [{ tur: "otur" }], "basari", 1),
    gorevOrnegi("masaya otur", [{ tur: "otur" }], "hata", 2),
  ]);
  assert.match(beceriMetni(h)[0]!, / · ASKIDA · pay 0,50 \(başarı 1 · hata 1\)/);
});

test("uçtan uca: `beceriler` kayıttan kurulan becerileri açıklamasıyla yazar", () => {
  const satirlar: KararSatiri[] = [];
  let t = 1_000;
  const k = new KararKaydi({ oturum: "o1", simdi: () => (t += 1_000), yaz: (s) => satirlar.push(JSON.parse(s.slice(KARAR_ONEKI.length + 1))) });
  k.oturumBasi("sahte");
  const a = k.algi({ tur: "duydum", metin: "pencereye git", kesin: true }, "ozet", { gecti: true, kural: "kopru.konusma" });
  k.uyanis({ algilar: [a], geriBesleme: 0, beyin: "sahte", sureMs: 5, koken: "dis", takip: false, anilar: 0, dunya: "", cagrilar: [], niyetler: [niyetKaydi("n_1", { tur: "git", hedef: { tip: "capa", ad: "pencere" } })], reddedilen: 0, kurtarilan: 0, konusulanMetin: false, yutulanSoz: 0 });
  k.algi({ tur: "sonuc", sonuc: { niyet_id: "n_1", durum: "bitti" } }, "ozet", { gecti: false, kural: "refleks.sonuc.rutin" });
  const kok = path.resolve(import.meta.dirname, "..");
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", path.join(kok, "tools", "ogret.ts"), "beceriler", `--kayit=${kayitKlasoru(satirlar)}`], { encoding: "utf8" });
  const cikti = r.stdout.split(/\r?\n/);
  assert.deepEqual(
    { aciklama: cikti.slice(0, BECERI_ACIKLAMASI.length), adimlar: cikti.find((l) => l.startsWith("  adımlar:")) },
    { aciklama: BECERI_ACIKLAMASI, adimlar: "  adımlar: git [pencere]" },
  );
});

test("beceri dökümü: bağ yalnız kendi adımında — aynı alan adlı sabit adım köşesiz kalır", () => {
  const h = beceriHafizasiKur([gorevOrnegi("sandalyeye otur", [{ tur: "otur", capa: "sandalye" }, { tur: "odaklan", capa: "monitor" }], "basari", 1)]);
  assert.equal(beceriMetni(h)[2], "  adımlar: otur [sandalye] → odaklan monitor");
});
