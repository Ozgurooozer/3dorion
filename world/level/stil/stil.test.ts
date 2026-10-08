// world/level/stil/stil.test.ts — Stil verisi, önayarlar, palet listesi, ışık durumu ve Babylon shader bekçisi.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { ornekTanim } from "../cekirdek/ornekTanim.ts";
import { levelTanimiDogrula } from "../cekirdek/levelTanimi.ts";
import { malzemeKur } from "../cekirdek/malzeme.ts";
import { hex, type Renk } from "../cekirdek/renk.ts";
import {
  ONAYARLAR, ONAYAR_ADLARI, VARSAYILAN_STIL, onayarUygula, onayarAdi, paletDuzeniUygula, paletDuzeniAdi, stilHatasi,
} from "./stilTanimi.ts";
import { paletListesi, PALET_SINIRI } from "./efektler.ts";
import { isikDurumunuYaz } from "./stilSistemi.ts";
import { isikStiliDurumuYap, ISIK_STILI_GLSL } from "./isikEklentisi.ts";

const renkMi = (r: unknown) => typeof r === "string" && /^#[0-9a-f]{6}$/i.test(r);

// ── veri ──
test("her önayar stil şemasından geçer", () => {
  for (const ad of ONAYAR_ADLARI) assert.equal(stilHatasi(ONAYARLAR[ad]!.stil, renkMi), null, ad);
});
test("önayar uygulanınca adı geri okunur (G tuşu ve panel seçicisi buna dayanır)", () => {
  for (const ad of ONAYAR_ADLARI) assert.equal(onayarAdi(onayarUygula(ornekTanim(), ad)), ad);
});
test("önayar uygulanmış tanım geçerli bir level tanımı", () => {
  for (const ad of ONAYAR_ADLARI) assert.ok(levelTanimiDogrula(onayarUygula(ornekTanim(), ad)).ok, ad);
});
test("önayar piksel boyunu da getirir (piksel-sanat düşük çözünürlükte)", () => {
  assert.equal(onayarUygula(ornekTanim(), "piksel").ortam.piksel, ONAYARLAR["piksel"]!.piksel);
});
test("bilinmeyen önayar hata verir", () => {
  assert.throws(() => onayarUygula(ornekTanim(), "yok"), /bilinmeyen stil/);
});
test("elle değiştirilmiş stil 'özel' sayılır", () => {
  const t = onayarUygula(ornekTanim(), "toon");
  t.stil!.isik.bant = 4;
  assert.equal(onayarAdi(t), "özel");
});
test("stil alanında yazım hatası reddedilir", () => {
  const s = structuredClone(VARSAYILAN_STIL) as unknown as Record<string, Record<string, unknown>>;
  s["isik"]!["bantt"] = 2;
  assert.match(String(stilHatasi(s, renkMi)), /bantt/);
});
test("stil rengi renk değilse reddedilir", () => {
  const s = structuredClone(VARSAYILAN_STIL);
  s.cizgi.renk = "mor değil";
  assert.match(String(stilHatasi(s, renkMi)), /cizgi.renk/);
});
test("renk düzeni yalnız paletteki adları değiştirir ve adı geri okunur", () => {
  const t = ornekTanim();
  const p = paletDuzeniUygula({ ...t, palet: { ...t.palet, gokZenit: "#000000" } }, "pastel");
  assert.deepEqual([Object.keys(p.palet).length, p.palet["gokZenit"]], [Object.keys(t.palet).length + (("gokZenit" in t.palet) ? 0 : 1), "#5b4a9e"]);
});
test("pastel düzeni uygulanan paletin düzen adı 'pastel'", () => {
  const t = ornekTanim();
  assert.equal(paletDuzeniAdi(paletDuzeniUygula({ ...t, palet: { ...t.palet, gokZenit: "#000000", gokUfuk: "#000000" } }, "pastel")), "pastel");
});

// ── palet listesi (renk efekti) ──
const P: Renk[] = [hex("#ff0000"), hex("#00ff00"), hex("#0000ff")];
test("palet listesi: ana renkler başta, sonra iki koyu ton", () => {
  const l = paletListesi(P, hex("#4b4f8f"), 0);
  assert.deepEqual([l.length, l[0]], [9, P[0]]);
});
test("palet listesi: koyu tonlar ana renkten koyu", () => {
  const l = paletListesi(P, hex("#4b4f8f"), 0);
  assert.ok(l[3]![0] < l[0]![0] && l[6]![0] < l[3]![0]);
});
test("palet listesi sınırı aşmaz (uniform dizi boyu)", () => {
  assert.equal(paletListesi(Array.from({ length: 40 }, () => P[0]!), P[2]!, 0.5).length, PALET_SINIRI);
});

// ── ışık durumu ──
test("tam ışık zemine göre: güneş alçaldıkça küçülür (düz zemin aydınlık basamakta kalsın)", () => {
  const tam = (y: number) => {
    const t = onayarUygula(ornekTanim(), "toon");
    t.isik.gunes.yon = [0.5, y, 0.5];
    const d = isikStiliDurumuYap();
    isikDurumunuYaz(d, t, (ad) => (ad.startsWith("#") ? hex(ad) : hex(t.palet[ad]!)));
    return d.c[2];
  };
  assert.ok(tam(0.3) < tam(3));
});
test("stil kapalıyken eklenti kapalı bayrağı alır", () => {
  const t = ornekTanim();
  const d = isikStiliDurumuYap();
  isikDurumunuYaz(d, { ...t, stil: VARSAYILAN_STIL }, (ad) => (ad.startsWith("#") ? hex(ad) : hex(t.palet[ad]!)));
  assert.equal(d.a[0], 0);
});

// ── malzeme ──
test("ışıklı malzeme stil durumu verilince stil eklentisini taşır", () => {
  const m = malzemeKur(new Scene(new NullEngine()), "x", "isikli", { stil: isikStiliDurumuYap() });
  assert.ok(m.pluginManager?.getPlugin("IsikStili"));
});

// ── Babylon bekçisi: eklentinin dayandığı shader yerleri hâlâ var mı (Babylon güncellemesinde sessiz bozulmasın) ──
test("Babylon Standard fragment shader'ı eklentinin kullandığı yer ve değişkenleri içeriyor", () => {
  const yol = createRequire(import.meta.url).resolve("@babylonjs/core/package.json").replace(/package\.json$/, "Shaders/default.fragment.js");
  const kaynak = fs.readFileSync(yol, "utf8");
  const gerekli = ["vec3 finalDiffuse=", "vec3 diffuseBase=", "vec3 normalW=", "vec3 viewDirectionW=", "float aggShadow=", "float numLights="];
  assert.deepEqual(gerekli.filter((g) => !kaynak.includes(g)), []);
});
test("eklenti GLSL'i yalnız bekçideki Babylon değişkenlerine dayanır", () => {
  for (const ad of ["diffuseBase", "normalW", "viewDirectionW", "aggShadow", "numLights"]) assert.ok(ISIK_STILI_GLSL.includes(ad), ad);
});
