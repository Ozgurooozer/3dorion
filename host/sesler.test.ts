// host/sesler.test.ts — Orion'un sesleri (spec 34): katalog→adres, kurulu ses taraması (çift + json), seçim önceliği (env > seçim > varsayılan > ilk),
// ayar dosyasının kalıcılığı ve bozukluğu, yöneticinin seç/indir/sil kuralları (yalnız indirilen silinir, çalan ses silinmez, env kilidi).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  HF_KOK, SES_KATALOGU, VARSAYILAN_SES, katalogdaBul, kuruluSesler, sesAdi, sesAdiGecerli, sesAdresi, sesAyariOku, sesAyariYaz,
  sesAyariYolu, sesDurumu, sesSecimiCoz, sesYoneticisiKur, type KuruluSes,
} from "./sesler.js";

function gecici(): string { return fs.mkdtempSync(path.join(os.tmpdir(), "orion-ses-test-")); }
/** Diskte bir ses çifti kur (gerçek model değil: tarama yalnız varlık, boyut ve json'a bakar). */
function sesKoy(dizin: string, ad: string, json: string = JSON.stringify({ language: { code: ad.split("-")[0] } })): void {
  fs.writeFileSync(path.join(dizin, `${ad}.onnx`), "model");
  fs.writeFileSync(path.join(dizin, `${ad}.onnx.json`), json);
}
const kod = (f: () => unknown): string | undefined => { try { f(); } catch (e) { return (e as { kod?: string }).kod; } return undefined; };
const kurulu = (...adlar: string[]): KuruluSes[] => adlar.map((ad) => ({ ad, yol: `/s/${ad}.onnx`, boyut: 5, dil: "tr_TR" }));

test("katalog: ad ve adres girdiden türer (resmî depo şeması)", () => {
  const dfki = katalogdaBul("tr_TR-dfki-medium")!;
  assert.equal(sesAdresi(dfki, "onnx"), `${HF_KOK}/tr/tr_TR/dfki/medium/tr_TR-dfki-medium.onnx`);
});

test("katalog: varsayılan ses katalogda ve dahili (panelden silinmez)", () => {
  assert.equal(katalogdaBul(VARSAYILAN_SES)?.dahili, true);
});

test("katalog: ses sahiplerinin isteğiyle kaldırılan fahrettin ve fettah YOK (2025-12-30, spec 34 §3)", () => {
  assert.deepEqual(SES_KATALOGU.map(sesAdi).filter((a) => /fahrettin|fettah/.test(a)), []);
});

test("ad kuralı: dizin dışına çıkan ya da nokta ile başlayan ad geçersiz", () => {
  for (const kotu of ["", "../x", "a/b", "a\\b", ".gizli", "x..y", 5, null]) assert.equal(sesAdiGecerli(kotu), false, String(kotu));
});

test("ayar yolu: env > senaryo (geçici dizin) > kullanıcı verisi", () => {
  assert.deepEqual(
    [sesAyariYolu({ ORION_SES_AYARI: "/x.json" }, "/u", "/t"), sesAyariYolu({ ORION_SMOKE: "1" }, "/u", "/t"), sesAyariYolu({}, "/u", "/t")],
    ["/x.json", path.join("/t", "orion-ses-ayari-senaryo.json"), path.join("/u", "ses-ayari.json")],
  );
});

test("tarama: çifti tam ve json'u ayrışan ses geçerli", () => {
  const d = gecici();
  sesKoy(d, "tr_TR-dfki-medium");
  assert.deepEqual(kuruluSesler(d).gecerli.map((s) => [s.ad, s.dil]), [["tr_TR-dfki-medium", "tr_TR"]]);
});

test("tarama: json'u eksik ya da bozuk ses BOZUK listesine nedenle düşer", () => {
  const d = gecici();
  fs.writeFileSync(path.join(d, "yarim.onnx"), "model");
  sesKoy(d, "bozuk", "{yarım");
  assert.deepEqual(kuruluSesler(d).bozuk, [{ ad: "bozuk", neden: "ayar dosyası (.onnx.json) bozuk" }, { ad: "yarim", neden: "eşi olan .onnx.json yok" }]);
});

test("tarama: yarım indirme (.part) hiç sayılmaz", () => {
  const d = gecici();
  fs.writeFileSync(path.join(d, "x.onnx.part"), "m");
  fs.writeFileSync(path.join(d, "x.onnx.json.part"), "{}");
  assert.deepEqual(kuruluSesler(d), { gecerli: [], bozuk: [] });
});

test("tarama: dizin yoksa boş (hata değil)", () => {
  assert.deepEqual(kuruluSesler(path.join(gecici(), "yok")), { gecerli: [], bozuk: [] });
});

test("seçim: ORION_PIPER_MODEL varsa o çalar ve panel seçimi kilitli", () => {
  const c = sesSecimiCoz({ envModel: "/e/en_US-lessac-medium.onnx", envVarMi: () => true, secili: "tr_TR-dfki-medium", kurulu: kurulu("tr_TR-dfki-medium") });
  assert.deepEqual([c.ad, c.kaynak, c.kilit !== null], ["en_US-lessac-medium", "env", true]);
});

test("seçim: env yolu diskte yoksa varsayılana düşer ve uyarır (eski piperBul gibi)", () => {
  const c = sesSecimiCoz({ envModel: "/yok.onnx", envVarMi: () => false, secili: null, kurulu: kurulu("tr_TR-dfki-medium") });
  assert.deepEqual([c.ad, c.kaynak, c.kilit, c.uyari !== null], ["tr_TR-dfki-medium", "varsayilan", null, true]);
});

test("seçim: env yokken kurulu panel seçimi kazanır", () => {
  const c = sesSecimiCoz({ envModel: null, secili: "en_US-lessac-medium", kurulu: kurulu("tr_TR-dfki-medium", "en_US-lessac-medium") });
  assert.deepEqual([c.ad, c.kaynak], ["en_US-lessac-medium", "secim"]);
});

test("seçim: seçili ses silinmişse varsayılan, uyarıyla", () => {
  const c = sesSecimiCoz({ envModel: null, secili: "silindi", kurulu: kurulu("tr_TR-dfki-medium") });
  assert.deepEqual([c.ad, c.kaynak, /silindi/.test(c.uyari ?? "")], ["tr_TR-dfki-medium", "varsayilan", true]);
});

test("seçim: varsayılan da yoksa kurulu ilk ses; hiç yoksa null", () => {
  assert.deepEqual(
    [sesSecimiCoz({ envModel: null, secili: null, kurulu: kurulu("en_US-lessac-medium") }).kaynak, sesSecimiCoz({ envModel: null, secili: null, kurulu: [] }).ad],
    ["ilk", null],
  );
});

test("ayar dosyası: yazılan geri okunur", () => {
  const y = path.join(gecici(), "alt", "ses-ayari.json");
  sesAyariYaz(y, { surum: 1, secili: "en_US-lessac-medium", indirilenler: ["en_US-lessac-medium"] });
  assert.deepEqual(sesAyariOku(y), { ayar: { surum: 1, secili: "en_US-lessac-medium", indirilenler: ["en_US-lessac-medium"] }, uyari: null });
});

test("ayar dosyası: bozuksa boş ayar + uyarı (fırlatmaz)", () => {
  const y = path.join(gecici(), "ses-ayari.json");
  fs.writeFileSync(y, "{bozuk");
  const r = sesAyariOku(y);
  assert.deepEqual([r.ayar.secili, r.uyari !== null], [null, true]);
});

test("ayar dosyası: geçersiz ad içeren kayıt o alanı düşürür (yol kaçışı ayara giremez)", () => {
  const y = path.join(gecici(), "ses-ayari.json");
  fs.writeFileSync(y, JSON.stringify({ surum: 1, secili: "../kacis", indirilenler: ["iyi", "../x"] }));
  assert.deepEqual(sesAyariOku(y).ayar, { surum: 1, secili: null, indirilenler: ["iyi"] });
});

// ── durum satırları ──
const bosAyar = { surum: 1 as const, secili: null, indirilenler: [] as string[] };
const cozum = (ad: string | null) => ({ ad, yol: ad, kaynak: "varsayilan" as const, kilit: null, uyari: null });

test("durum: katalogdaki kurulu olmayan ses indirilebilir", () => {
  const d = sesDurumu({ kurulu: kurulu("tr_TR-dfki-medium"), ayar: bosAyar, cozum: cozum("tr_TR-dfki-medium"), piperVar: true });
  assert.equal(d.sesler.find((s) => s.ad === "en_US-lessac-medium")?.indirilebilir, true);
});

test("durum: elle kurulmuş (indirilenlerde olmayan) ses silinemez, nedeniyle", () => {
  const d = sesDurumu({ kurulu: kurulu("tr_TR-dfki-medium", "en_US-lessac-medium"), ayar: bosAyar, cozum: cozum("tr_TR-dfki-medium"), piperVar: true });
  assert.equal(d.sesler.find((s) => s.ad === "en_US-lessac-medium")?.silinemezNeden, "bu ses elle kurulmuş; yalnız panelden indirilenler silinir");
});

test("durum: panelden indirilmiş ama ŞU AN çalan ses silinemez", () => {
  const d = sesDurumu({ kurulu: kurulu("en_US-lessac-medium"), ayar: { ...bosAyar, indirilenler: ["en_US-lessac-medium"] }, cozum: cozum("en_US-lessac-medium"), piperVar: true });
  assert.equal(d.sesler.find((s) => s.ad === "en_US-lessac-medium")?.silinemezNeden, "şu an bu ses çalıyor; önce başka ses seç");
});

test("durum: katalogda olmayan ama diskte kurulu ses de listelenir (elle eklenen)", () => {
  const d = sesDurumu({ kurulu: kurulu("de_DE-thorsten-medium"), ayar: bosAyar, cozum: cozum(null), piperVar: true });
  assert.equal(d.sesler.some((s) => s.ad === "de_DE-thorsten-medium" && s.kurulu && !s.katalogda), true);
});

// ── yönetici ──
function yonetici(env: Record<string, string> = {}) {
  const dizin = gecici();
  const ayarYolu = path.join(gecici(), "ses-ayari.json");
  const modeller: (string | null)[] = [];
  const ses = { modelAyarla: (y: string | null) => { modeller.push(y); }, kullanilabilir: () => true };
  const indirilenler: string[] = [];
  const y = sesYoneticisiKur({
    dizin, ayarYolu, env, ses, uyari: () => {},
    indir: async ({ ad }) => { indirilenler.push(ad); sesKoy(dizin, ad); },
  });
  return { y, dizin, ayarYolu, modeller, indirilenler };
}

test("yönetici: seçim kalıcı ve sürece bir sonraki cümle için verilir", () => {
  const t = yonetici();
  sesKoy(t.dizin, "tr_TR-dfki-medium"); sesKoy(t.dizin, "en_US-lessac-medium");
  t.y.sec("en_US-lessac-medium");
  assert.deepEqual([sesAyariOku(t.ayarYolu).ayar.secili, t.modeller.at(-1)], ["en_US-lessac-medium", path.join(t.dizin, "en_US-lessac-medium.onnx")]);
});

test("yönetici: kurulu olmayan ses seçilemez (yok)", () => {
  const t = yonetici();
  assert.equal(kod(() => t.y.sec("en_US-lessac-medium")), "yok");
});

test("yönetici: ORION_PIPER_MODEL varken seçim reddedilir (kilitli) ve ayar değişmez", () => {
  const t = yonetici({ ORION_PIPER_MODEL: "/e/x.onnx" });
  sesKoy(t.dizin, "tr_TR-dfki-medium");
  assert.deepEqual([kod(() => t.y.sec("tr_TR-dfki-medium")), fs.existsSync(t.ayarYolu)], ["kilitli", false]);
});

test("yönetici: açılışta kayıtlı seçim çözülüp sürece verilir (selam da o sesle)", () => {
  const t = yonetici();
  sesKoy(t.dizin, "tr_TR-dfki-medium"); sesKoy(t.dizin, "en_US-lessac-medium");
  sesAyariYaz(t.ayarYolu, { surum: 1, secili: "en_US-lessac-medium", indirilenler: [] });
  const y2 = sesYoneticisiKur({ dizin: t.dizin, ayarYolu: t.ayarYolu, ses: { modelAyarla: (m) => { t.modeller.push(m); }, kullanilabilir: () => true }, indir: async () => {}, uyari: () => {} });
  assert.equal(y2.baslat().ad, "en_US-lessac-medium");
});

test("yönetici: yalnız KATALOGDAKİ ses indirilir (renderer adres veremez)", async () => {
  const t = yonetici();
  await assert.rejects(t.y.indir("de_DE-thorsten-medium"), (e: { kod?: string }) => e.kod === "yok");
});

test("yönetici: kurulu ses yeniden indirilmez (var)", async () => {
  const t = yonetici();
  sesKoy(t.dizin, "en_US-lessac-medium");
  await assert.rejects(t.y.indir("en_US-lessac-medium"), (e: { kod?: string }) => e.kod === "var");
});

test("yönetici: indirilen ses 'indirildi' olarak kaydedilir, seçilmez", async () => {
  const t = yonetici();
  sesKoy(t.dizin, "tr_TR-dfki-medium");
  const d = await t.y.indir("en_US-lessac-medium");
  assert.deepEqual([sesAyariOku(t.ayarYolu).ayar.indirilenler, d.etkin], [["en_US-lessac-medium"], "tr_TR-dfki-medium"]);
});

test("yönetici: aynı anda ikinci indirme reddedilir (suruyor)", async () => {
  const t = yonetici();
  let birak: () => void = () => {};
  const y = sesYoneticisiKur({ dizin: t.dizin, ayarYolu: t.ayarYolu, ses: { modelAyarla: () => {}, kullanilabilir: () => true }, uyari: () => {},
    indir: () => new Promise<void>((c) => { birak = c; }) });
  const ilk = y.indir("en_US-lessac-medium");
  await assert.rejects(y.indir("en_US-lessac-medium"), (e: { kod?: string }) => e.kod === "suruyor");
  birak(); await ilk;
});

test("yönetici: indirilmiş ve çalmayan ses silinir, iki dosyası da gider", async () => {
  const t = yonetici();
  sesKoy(t.dizin, "tr_TR-dfki-medium");
  await t.y.indir("en_US-lessac-medium");
  t.y.sil("en_US-lessac-medium");
  assert.deepEqual(fs.readdirSync(t.dizin).filter((f) => f.startsWith("en_US")), []);
});

test("yönetici: dahili ses silinemez (silinemez)", () => {
  const t = yonetici();
  sesKoy(t.dizin, "tr_TR-dfki-medium"); sesKoy(t.dizin, "en_US-lessac-medium");
  t.y.sec("en_US-lessac-medium");
  assert.equal(kod(() => t.y.sil("tr_TR-dfki-medium")), "silinemez");
});
