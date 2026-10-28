// host/proje.test.ts — proje (spec 39 D1): ad kuralı, kök önceliği, oluştur (şablon + göç KOPYA, kaynak dokunulmaz, üstüne yazılmaz, tanım EN SON),
// aç/doğrula, liste (bozuk görünür), seçim önceliği, son açılanlar, ilk açılışta hazırla.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ICERIK_KLASORLERI, PROJE_SURUMU, icerikDizini, kopyala, projeAc, projeAdiGecerli, projeHazirla, projeListe, projeOlustur, projelerKoku, projeSec,
  projeTanimiHatasi, sonProjelerOku, sonProjeYaz, SABLON_ADLARI, projeSablonu, projeDurumu,
} from "./proje.js";

const gecici = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "orion-proje-test-"));
const kod = (f: () => unknown): string | undefined => { try { f(); } catch (e) { return (e as { kod?: string }).kod; } return undefined; };
const SABLON = { varsayilanLevel: "ova", kopyalar: [] as { kaynak: string; hedef: string }[], yazilacaklar: [] as { hedef: string; metin: string }[] };

test("ad kuralı: harf/rakamla başlar, boşluk/_/- olur, Türkçe harf olur; yol, nokta, sonda boşluk, ayrılmış ad, uzun ad olmaz", () => {
  for (const a of ["Ofis", "Benim Oyunum", "çay-ocağı_2", "A", "a".repeat(48)]) assert.equal(projeAdiGecerli(a), true, a);
  for (const a of ["", " Ofis", "Ofis ", "../x", "x/y", "x\\y", ".gizli", "x.y", "CON", "nul", "com1", "a".repeat(49), null, 5]) assert.equal(projeAdiGecerli(a), false, String(a));
});

test("kök: env > senaryo (geçici) > Belgeler/3dorion Projeleri", () => {
  assert.equal(projelerKoku({ ORION_PROJELER_KOKU: "/x", ORION_SMOKE: "1" }, "/b", "/t"), "/x");
  assert.equal(projelerKoku({ ORION_SMOKE: "1" }, "/b", "/t"), path.join("/t", "3dorion-projeler-deneme"));
  assert.equal(projelerKoku({}, "/b", "/t"), path.join("/b", "3dorion Projeleri"));
});

test("oluştur: Content klasörleri + Saved + tanım; şablon ve göç KOPYALANIR, kaynak yerinde kalır; aynı ad 'var'", () => {
  const kok = gecici(), kaynak = gecici();
  fs.writeFileSync(path.join(kaynak, "ova.level.json"), "{\"ad\":\"ova\"}");
  const eski = path.join(kaynak, "orion-sekans"); fs.mkdirSync(path.join(eski, ".silinenler"), { recursive: true });
  fs.writeFileSync(path.join(eski, "a.json"), "{}"); fs.writeFileSync(path.join(eski, ".silinenler", "b.json.1"), "{}"); fs.writeFileSync(path.join(eski, "c.json.tmp"), "x");
  const p = projeOlustur(kok, "Ofis", { ...SABLON, kopyalar: [{ kaynak: path.join(kaynak, "ova.level.json"), hedef: "Levels/ova/ova.level.json" }],
    yazilacaklar: [{ hedef: "Characters/Orion/Orion.karakter.json", metin: "{}" }] }, { goc: [{ kaynak: eski, hedef: "Sequences" }], simdi: () => 42 });
  for (const k of Object.values(ICERIK_KLASORLERI)) assert.ok(fs.existsSync(path.join(p.icerik, k)), k);
  assert.ok(fs.existsSync(p.kayitli));
  assert.equal(fs.readFileSync(path.join(p.icerik, "Levels", "ova", "ova.level.json"), "utf8"), "{\"ad\":\"ova\"}");
  assert.ok(fs.existsSync(path.join(p.icerik, "Sequences", "a.json")));
  assert.ok(!fs.existsSync(path.join(p.icerik, "Sequences", ".silinenler")), "çöp kutusu taşınmaz");
  assert.ok(!fs.existsSync(path.join(p.icerik, "Sequences", "c.json.tmp")), "yarım yazım taşınmaz");
  assert.ok(fs.existsSync(path.join(p.icerik, "Characters", "Orion", "Orion.karakter.json")));
  assert.equal(p.kopyalanan, 2);
  assert.ok(fs.existsSync(path.join(eski, "a.json")) && fs.existsSync(path.join(kaynak, "ova.level.json")), "kaynak SİLİNMEZ");
  const t = JSON.parse(fs.readFileSync(path.join(p.dizin, "Ofis.orionproj"), "utf8"));
  assert.deepEqual(t, { surum: PROJE_SURUMU, ad: "Ofis", motorSurumu: "", varsayilanLevel: "ova", olusturuldu: 42 });
  assert.equal(kod(() => projeOlustur(kok, "Ofis", SABLON)), "var");
  assert.equal(kod(() => projeOlustur(kok, "../kacak", SABLON)), "gecersiz-ad");
  assert.ok(!fs.existsSync(path.join(path.dirname(kok), "kacak")));
});

test("kopyala var olanın ÜSTÜNE YAZMAZ; kaynak yoksa 0", () => {
  const d = gecici();
  fs.writeFileSync(path.join(d, "k"), "yeni"); fs.writeFileSync(path.join(d, "h"), "eski");
  assert.equal(kopyala(path.join(d, "k"), path.join(d, "h")), 0);
  assert.equal(fs.readFileSync(path.join(d, "h"), "utf8"), "eski");
  assert.equal(kopyala(path.join(d, "yok"), path.join(d, "z")), 0);
});

test("aç: tanımı doğrular; yok 'yok', bozuk 'bozuk'; içerik dizini türe göre, bilinmeyen tür hata", () => {
  const kok = gecici();
  projeOlustur(kok, "A", SABLON);
  const p = projeAc(kok, "A");
  assert.equal(p.varsayilanLevel, "ova");
  assert.equal(icerikDizini(p, "sekans"), path.join(p.icerik, "Sequences"));
  assert.equal(icerikDizini(p, "graf"), path.join(p.icerik, "Graphs"));
  assert.equal(kod(() => icerikDizini(p, "sekanslar" as never)), "gecersiz-tur");
  assert.equal(kod(() => projeAc(kok, "B")), "yok");
  fs.writeFileSync(path.join(kok, "A", "A.orionproj"), "{bozuk");
  assert.equal(kod(() => projeAc(kok, "A")), "bozuk");
  fs.writeFileSync(path.join(kok, "A", "A.orionproj"), JSON.stringify({ surum: 99, ad: "A", varsayilanLevel: "ova", olusturuldu: 1 }));
  assert.equal(kod(() => projeAc(kok, "A")), "bozuk");
});

test("tanım hatası: sürüm, ad, level, tarih", () => {
  const iyi = { surum: PROJE_SURUMU, ad: "A", motorSurumu: "", varsayilanLevel: "ova", olusturuldu: 1 };
  assert.equal(projeTanimiHatasi(iyi), null);
  for (const k of [{ surum: 2 }, { ad: "../x" }, { varsayilanLevel: "" }, { olusturuldu: "dün" }]) assert.ok(projeTanimiHatasi({ ...iyi, ...k }), JSON.stringify(k));
  assert.ok(projeTanimiHatasi(null)); assert.ok(projeTanimiHatasi([]));
});

test("liste: yalnız tanımlı klasörler, ada göre; bozuk ve adı uyuşmayan 'hata' ile GÖRÜNÜR; kök yoksa boş", () => {
  const kok = gecici();
  assert.deepEqual(projeListe(path.join(kok, "yok")), []);
  projeOlustur(kok, "Zeta", SABLON); projeOlustur(kok, "Alfa", SABLON);
  fs.mkdirSync(path.join(kok, "tanimsiz"));
  fs.mkdirSync(path.join(kok, "Bozuk")); fs.writeFileSync(path.join(kok, "Bozuk", "Bozuk.orionproj"), "{");
  fs.mkdirSync(path.join(kok, "Ayri")); fs.writeFileSync(path.join(kok, "Ayri", "Ayri.orionproj"), JSON.stringify({ surum: 1, ad: "Baska", varsayilanLevel: "ova", olusturuldu: 1 }));
  const l = projeListe(kok);
  assert.deepEqual(l.map((p) => p.ad), ["Alfa", "Ayri", "Bozuk", "Zeta"]);
  assert.deepEqual(l.map((p) => !!p.hata), [false, true, true, false]);
});

test("son açılanlar: başa alınır, tekrar yok, en çok 10; bozuk dosya boş liste", () => {
  const d = gecici(), y = path.join(d, "alt", "projeler.json");
  assert.deepEqual(sonProjelerOku(y).gecmis, []);
  sonProjeYaz(y, "A"); sonProjeYaz(y, "B"); sonProjeYaz(y, "A");
  assert.deepEqual(sonProjelerOku(y).gecmis, ["A", "B"]);
  for (let i = 0; i < 12; i++) sonProjeYaz(y, `P${i}`);
  assert.equal(sonProjelerOku(y).gecmis.length, 10);
  assert.equal((JSON.parse(fs.readFileSync(y, "utf8")) as { gecmis: string[] }).gecmis.length, 10, "dosya da büyümez (okuma kırpsa bile)");
  fs.writeFileSync(y, "çöp");
  assert.deepEqual(sonProjelerOku(y).gecmis, []);
});

test("seçim: ORION_PROJE > son açılan (varsa) > ilk; bozuk seçilmez; ORION_PROJE yoksa 'yok' (sessiz başka proje açılmaz)", () => {
  const kok = gecici(), son = path.join(kok, "..", `son-${path.basename(kok)}.json`);
  assert.equal(projeSec({}, kok, son), null);
  projeOlustur(kok, "B", SABLON); projeOlustur(kok, "C", SABLON);
  assert.equal(projeSec({}, kok, son), "B");
  sonProjeYaz(son, "C");
  assert.equal(projeSec({}, kok, son), "C");
  assert.equal(projeSec({ ORION_PROJE: "B" }, kok, son), "B");
  assert.equal(kod(() => projeSec({ ORION_PROJE: "Q" }, kok, son)), "yok");
  sonProjeYaz(son, "Silinmis");
  assert.equal(projeSec({}, kok, son), "C");
  fs.writeFileSync(path.join(kok, "C", "C.orionproj"), "{");
  sonProjeYaz(son, "C");
  assert.equal(projeSec({}, kok, son), "B");
});

test("hazırla: proje yoksa ilk adla OLUŞTURUR (bir kez), sonra AÇAR; son açılanlara yazar", () => {
  const kok = gecici(), son = path.join(gecici(), "projeler.json");
  const a = projeHazirla({ env: {}, kok, sonYolu: son, ilkAd: "Ofis", sablon: SABLON });
  assert.equal(a.olusturuldu, true); assert.equal(a.ad, "Ofis");
  const b = projeHazirla({ env: {}, kok, sonYolu: son, ilkAd: "Ofis", sablon: SABLON });
  assert.equal(b.olusturuldu, false); assert.equal(b.dizin, a.dizin);
  assert.deepEqual(sonProjelerOku(son).gecmis, ["Ofis"]);
});

test("şablonlar: ofis=ova, bos=bos level (motorun dosyasından KOPYA yolu), ikisinde de Orion tanımı; bilinmeyen şablon hata; gerçek repo dosyaları var", () => {
  const motor = path.resolve(import.meta.dirname, "..");
  assert.deepEqual([...SABLON_ADLARI], ["ofis", "bos"]);
  const o = projeSablonu("ofis", motor), b = projeSablonu("bos", motor);
  assert.equal(o.varsayilanLevel, "ova"); assert.equal(b.varsayilanLevel, "bos");
  assert.equal(o.kopyalar![0]!.kaynak, path.join(motor, "world", "level", "ova", "ova.level.json"));
  assert.equal(b.kopyalar![0]!.kaynak, path.join(motor, "world", "level", "sablon", "bos.level.json"));
  assert.equal(b.kopyalar![0]!.hedef, path.join("Levels", "bos", "bos.level.json"));
  for (const t of [o, b]) {
    assert.ok(fs.existsSync(t.kopyalar![0]!.kaynak), "kaynak level repoda var");
    const k = JSON.parse(t.yazilacaklar![0]!.metin) as { tur: string; beden: string };
    assert.deepEqual([t.yazilacaklar![0]!.hedef, k.tur, k.beden], [path.join("Characters", "Orion", "Orion.karakter.json"), "karakter", "Engine/orion-lowpoly.glb"]);
    assert.ok(fs.existsSync(path.join(motor, "assets", "orion-lowpoly.glb")), "karakterin gövdesi motor içeriğinde var");
  }
  assert.equal(kod(() => projeSablonu("ofiss", motor)), "gecersiz-sablon");
  const kok = gecici(); const p = projeOlustur(kok, "Bos Deneme", b);
  assert.ok(fs.existsSync(path.join(p.icerik, "Levels", "bos", "bos.level.json")));
  assert.equal(p.varsayilanLevel, "bos");
});

test("durum: son açılanlar ÖNDE (sıra no), sonra ada göre; açık işaretli; bozuk görünür", () => {
  const kok = gecici(), son = path.join(gecici(), "p.json");
  for (const a of ["Cem", "Ali", "Bora"]) projeOlustur(kok, a, SABLON);
  fs.mkdirSync(path.join(kok, "Bz")); fs.writeFileSync(path.join(kok, "Bz", "Bz.orionproj"), "{");
  sonProjeYaz(son, "Cem"); sonProjeYaz(son, "Bora");
  const d = projeDurumu(kok, son, "Cem");
  assert.deepEqual(d.projeler.map((p) => [p.ad, p.son, p.acik, !!p.hata]), [["Bora", 0, false, false], ["Cem", 1, true, false], ["Ali", null, false, false], ["Bz", null, false, true]]);
  assert.equal(d.acik, "Cem"); assert.equal(d.kok, kok);
  assert.equal(projeDurumu(kok, son, undefined).acik, null);
});

test("BEKÇİ: proje değişiminde yeniden başlatma app.quit() ile (app.exit before-quit'i atlar: Ollama/MCP/Piper/pty yetim kalır)", () => {
  const main = fs.readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(main, /app\.relaunch\(\);\s*app\.quit\(\);\s*setTimeout\(\(\) => app\.exit\(0\), \d+\)/);   // quit ÖNCE; exit yalnız takılırsa son çare
  assert.equal((main.match(/app\.exit\(/g) ?? []).length, 1, "app.exit yalnız bu emniyette olmalı");
});
