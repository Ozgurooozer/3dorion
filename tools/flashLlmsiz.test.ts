// tools/flashLlmsiz.test.ts — FLASH KESİNLİKLE LLM'SİZ (spec 33; Ozyn, 2026-10-21: "orion flash kesinlikle LLM siz").
//
// Runtime testi (`flash/beyinsizBeyin.test.ts`: ağ sayacı) bugünkü davranışı sınar; bu bekçi YARINKİ kazayı yakalar: biri Flash koduna bir model
// modülü (Ollama, API, harici beyin, MCP, görme modeli, beyin seçimi) bağlarsa ya da ağa çıkan bir çağrı yazarsa, kimse fark etmeden Flash LLM'li olurdu.
// Kapsam: `flash/` ve Flash'ın uygulama katmanı kablolaması (`uygulama/ajanlar/`). Testler ve test düzeneği (`flashTest.ts`) kapsam dışı değil: onlar da
// model çağıran bir şeyi içeri sokmamalı. Üretim kodu bu dosyayı import etmez.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { KOK, depoYolu, ithaller, kaynaklar } from "./ithaller.ts";

const KLASORLER = ["flash", "uygulama/ajanlar"].map((k) => path.join(KOK, k));

/** Model/ağ konuşan bridge modülleri (beyinler, katalog taramaları, görme/ölçüm). `bridge/kopru.ts` ve `beyin.ts` (arayüz) serbest. */
const YASAK_MODULLER = [
  "bridge/ollama.ts", "bridge/apiBeyni.ts", "bridge/disBeyin.ts", "bridge/mcpBeyin.ts", "bridge/opencode.ts",
  "bridge/beyinKatalogu.ts", "bridge/ollamaKatalog.ts", "bridge/opencodeKatalog.ts", "bridge/apiKatalog.ts",
  "bridge/secilebilirBeyin.ts", "bridge/kayitBeyni.ts", "bridge/goz.ts", "bridge/ozerkYetenek.ts",
  "uygulama/beyinSecimi.ts", "uygulama/doktor.ts",
];

/** Ağa çıkan her API. */
const AG_DESENI = /\b(fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|child_process|spawn\s*\()/;

/** `mind/refleks.ts` iki şey barındırır: kural (serbest) ve Ollama'ya fetch atan küçük model refleksi (YASAK). Yalnız kural tarafının adları alınabilir. */
const REFLEKS_SERBEST = new Set(["KuralRefleksi", "refleksGirdisi"]);

const dosyalar = KLASORLER.flatMap((k) => kaynaklar(k, { testler: true }));

test("kapsam boş değil (bekçi yanlış klasöre bakıp 'geçmesin')", () => {
  assert.ok(dosyalar.length >= 10, `yalnız ${dosyalar.length} dosya bulundu`);
});

test("Flash kodu hiçbir model/ağ modülünü import etmez", () => {
  const ihlaller: string[] = [];
  for (const d of dosyalar) {
    for (const i of ithaller(fs.readFileSync(d, "utf8"))) {
      const hedef = depoYolu(path.resolve(path.dirname(d), i.yol));
      if (YASAK_MODULLER.includes(hedef)) ihlaller.push(`${depoYolu(d)} → ${hedef}`);
    }
  }
  assert.deepEqual(ihlaller, []);
});

test("Flash kodu ağa çıkan hiçbir API kullanmaz (fetch, WebSocket, XHR, süreç başlatma); yorum satırları sayılmaz", () => {
  const ihlaller: string[] = [];
  for (const d of dosyalar) {
    if (d.endsWith(".test.ts")) continue;   // testler ağ çağrısını SAHTELİYOR (fetch'i yakalayıp sayıyor); onlar yasak değil, aranan şey üretim kodu
    const govde = fs.readFileSync(d, "utf8").split("\n").filter((s) => !/^\s*(\/\/|\*|\/\*)/.test(s)).join("\n");
    const m = AG_DESENI.exec(govde);
    if (m) ihlaller.push(`${depoYolu(d)}: ${m[0]}`);
  }
  assert.deepEqual(ihlaller, []);
});

test("mind/refleks.ts'ten yalnız KURAL tarafı alınır (küçük model refleksi Ollama'ya konuşur)", () => {
  const ihlaller: string[] = [];
  for (const d of dosyalar) {
    const metin = fs.readFileSync(d, "utf8");
    for (const m of metin.matchAll(/^\s*import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'][^"']*mind\/refleks\.ts["']/gm)) {
      for (const ad of m[1]!.split(",").map((x) => x.replace(/^\s*type\s+/, "").trim()).filter(Boolean)) {
        if (!REFLEKS_SERBEST.has(ad)) ihlaller.push(`${depoYolu(d)}: ${ad}`);
      }
    }
  }
  assert.deepEqual(ihlaller, []);
});

test("bekçi kendini sınar: yasaklı bir import ve fetch gerçekten YAKALANIR", () => {
  const kotu = `import { OllamaBeyni } from "../bridge/ollama.ts";\nawait fetch("http://x");`;
  assert.ok(ithaller(kotu).some((i) => depoYolu(path.resolve(KOK, "flash", i.yol)) === "bridge/ollama.ts"));
  assert.ok(AG_DESENI.test(kotu));
});
