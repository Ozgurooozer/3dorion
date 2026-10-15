// world/level/stil/mrtParcacik.test.ts — BEKÇİ: çok çıkışlı hedefe (MRT) çizen her yapı parçacıkları ve sprite'ları KAPATMALI.
//
// Neden (2026-10-15): GI'ın yansıtıcı gölge haritası (`ReflectiveShadowMap`) 3 çıkışlı hedefe çizer ve Babylon orada `renderParticles = false`
// yapmayı UNUTMUŞ; parçacık tek çıkışlı shader'la 3 çıkışlı hedefe çizilince her karede `glDrawArraysInstanced: Active draw buffers with
// missing fragment shader outputs`, ekran bozulur, nesneler kaybolur. Duman koşuları bunu görmedi (efektler açılışta kuruluyordu).
// Bu test kaynağı metin olarak tarar: RSM ya da çıplak MultiRenderTarget kuran dosya `renderParticles = false` içermiyorsa KIRMIZI.
// Canlı kanıtı `3dorion.bat efektdene` (CLAUDE.md kuralı).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DIZIN = path.dirname(fileURLToPath(import.meta.url));
const DUNYA = path.join(DIZIN, "..", "..");

function kaynaklar(dizin: string): string[] {
  return readdirSync(dizin, { withFileTypes: true }).flatMap((e) => {
    const yol = path.join(dizin, e.name);
    if (e.isDirectory()) return kaynaklar(yol);
    return e.name.endsWith(".ts") && !e.name.endsWith(".test.ts") ? [yol] : [];
  });
}

test("MRT kuran her dosya parçacık ve sprite çizimini kapatır (renderParticles = false)", () => {
  const ihlal: string[] = [];
  for (const yol of kaynaklar(DUNYA)) {
    const kaynak = readFileSync(yol, "utf8");
    const mrtKurar = /new\s+ReflectiveShadowMap\s*\(/.test(kaynak) || /new\s+MultiRenderTarget\s*\(/.test(kaynak);
    if (mrtKurar && !/renderParticles\s*=\s*false/.test(kaynak)) ihlal.push(path.relative(DUNYA, yol));
  }
  assert.deepEqual(ihlal, [], `çok çıkışlı hedefe parçacık çizilir (WebGL: missing fragment shader outputs): ${ihlal.join(", ")}`);
});

test("bekçi gerçekten tarıyor: GI dosyası taranan kümede ve RSM kuruyor", () => {
  const gi = kaynaklar(DUNYA).find((y) => y.endsWith(path.join("stil", "isikSonrasi.ts")));
  assert.ok(gi, "isikSonrasi.ts taranan dosyalarda yok");
  assert.match(readFileSync(gi!, "utf8"), /new\s+ReflectiveShadowMap\s*\(/);
});
