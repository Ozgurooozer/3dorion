// uygulama/yapi/level/yeniLevelModeli.test.ts — Yeni level modeli (spec 42 Y4): şablon listesi dosyalarla aynı, ad → klasör, tanım üretimi, hata metinleri.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACIK_LEVEL_KOPYASI, YENI_LEVEL_SABLONLARI, klasorAdi, olusturmaHatasi, yeniTanim } from "./yeniLevelModeli.ts";
import { ornekTanim } from "../../../world/level/cekirdek/ornekTanim.ts";

const SABLON_KLASORU = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "world", "level", "sablon");

test("şablon listesi sablon klasöründeki dosyalarla AYNI kimlikler (+ açık level kopyası)", () => {
  const dosyalar = fs.readdirSync(SABLON_KLASORU).filter((f) => f.endsWith(".level.json")).map((f) => f.slice(0, -".level.json".length)).sort();
  assert.deepEqual(YENI_LEVEL_SABLONLARI.map((s) => s.id).filter((i) => i !== ACIK_LEVEL_KOPYASI).sort(), dosyalar);
  assert.ok(YENI_LEVEL_SABLONLARI.some((s) => s.id === ACIK_LEVEL_KOPYASI));
});
test("her şablon dosyası yeni level tanımına çevrilir ve görünen adı yazılan metin olur", () => {
  for (const s of YENI_LEVEL_SABLONLARI.filter((x) => x.id !== ACIK_LEVEL_KOPYASI)) {
    const ham = JSON.parse(fs.readFileSync(path.join(SABLON_KLASORU, `${s.id}.level.json`), "utf8")) as unknown;
    const r = yeniTanim(ham, "  Liman Gece  ");
    assert.ok(r.ok, s.id);
    if (r.ok) assert.equal(r.deger.ad, "Liman Gece");
  }
});
test("klasör adı: Türkçe harf sadeleşir; boş ya da simge-yalnız ad reddedilir", () => {
  assert.deepEqual(klasorAdi("Işıklı Çarşı"), { ok: true, deger: "isikli-carsi" });
  assert.equal(klasorAdi("   ").ok, false);
  assert.equal(klasorAdi("***").ok, false);
});
test("yeni tanım: boş ad ve bozuk şablon reddedilir (neden söylenir)", () => {
  assert.deepEqual(yeniTanim(ornekTanim(), "  "), { ok: false, neden: "bir ad yaz" });
  const bozuk = yeniTanim({ surum: 1 }, "x");
  assert.equal(bozuk.ok, false);
  if (!bozuk.ok) assert.match(bozuk.neden, /şablon geçersiz/);
});
test("şablon nesnesine dokunulmaz (kopya)", () => {
  const s = ornekTanim(); const r = yeniTanim(s, "kopya");
  assert.ok(r.ok);
  if (r.ok) { r.deger.palet["mavi"] = "#000000"; assert.equal(s.palet["mavi"], "#2040c0"); }
});
test("açık level kopyası: nesne, grup, ışık aktörü ve geçit taşınmaz; ışık/ortam/katman kalır", () => {
  const t = ornekTanim();
  t.nesneler = [{ id: "n1", varlik: "a", konum: [0, 0, 0], donus: 0, olcek: 1 }];
  t.gruplar = [{ id: "g1", ad: "grup" }];
  t.isiklar = [{ id: "i1", tur: "nokta", konum: [0, 1, 0], renk: "mavi", siddet: 1, menzil: 5 }];
  t.gecitler = [{ ad: "ofis", konum: [0, 0], yon: 0, hedef: "oda" }];
  const r = yeniTanim(t, "kopya", true);
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual([r.deger.nesneler, r.deger.gruplar, r.deger.isiklar, r.deger.gecitler], [undefined, undefined, undefined, undefined]);
    assert.deepEqual(r.deger.katmanlar, t.katmanlar);
    assert.deepEqual(r.deger.isik, t.isik);
  }
  assert.ok(t.nesneler && t.isiklar && t.gecitler, "kaynak bozulmadı");
});
test("host hata kodları Türkçe cümleye döner; bilinmeyen kod mesajla söylenir", () => {
  assert.match(olusturmaHatasi(409, "x"), /zaten var/);
  assert.match(olusturmaHatasi("proje-yok", "x"), /açık proje yok/);
  assert.match(olusturmaHatasi(400, "x"), /geçersiz/);
  assert.equal(olusturmaHatasi("hata", "disk dolu"), "level oluşturulamadı: disk dolu");
});
