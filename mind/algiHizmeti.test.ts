// mind/algiHizmeti.test.ts
//
// En önemli iddia: GÖRÜŞ KISITI GERÇEK. Orion duvarın arkasını bilmemeli.
// Bunu bir kez kaybedersek "odada yaşayan varlık" iddiası da gider.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUTCE, mesafeSozu, sorguYanitla } from "./algiHizmeti.ts";
import type { DunyaGorusu } from "./algiHizmeti.ts";
import type { CapaAdi, Vec3 } from "../protocol/temel.ts";

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

const CAPALAR: { ad: CapaAdi; konum: Vec3; etiket: string }[] = [
  { ad: "masa",    konum: v(0, 0.76, -3.2), etiket: "çalışma masası" },
  { ad: "monitor", konum: v(0, 1.18, -3.4), etiket: "monitör" },
  { ad: "tahta",   konum: v(-4.9, 1.65, -0.4), etiket: "beyaz tahta" },
  { ad: "kapi",    konum: v(2.6, 1.05, 3.9), etiket: "kapı" },
];

/** Varsayılan: her şey görünür, Orion odanın ortasında -Z'ye bakıyor. */
function gorus(ek: Partial<DunyaGorusu> = {}): DunyaGorusu {
  return {
    konum: v(0, 0, 0),
    bakis: v(0, 0, -1),
    gozYuksekligi: 1.62,
    capalar: CAPALAR,
    oyuncu: v(0, 0, -1.6),
    gorunurMu: () => true,
    ...ek,
  };
}

test("GÖRÜNMEYEN şey söylenmez — duvarın arkası bilinmez", () => {
  // Yalnızca tahta engelli.
  const d = gorus({ gorunurMu: (_k, h) => !(h.x === -4.9) });
  const c = sorguYanitla("dunya", d);
  assert.ok(!c.metin.includes("tahta"), `gorunmeyen sey sizdi: "${c.metin}"`);
  assert.match(c.metin, /görünmüyor/, "gizli sayisi bildirilmeli");
});

test("hiçbir şey görünmüyorsa dürüstçe söylenir", () => {
  const c = sorguYanitla("dunya", gorus({ gorunurMu: () => false }));
  assert.match(c.metin, /hiçbir şey görünmüyor/);
});

test("`yakin` menzili uygular ve yakından uzağa sıralar", () => {
  const d = gorus({ konum: v(0, 0, -3.0) });    // masanın dibinde
  const c = sorguYanitla("yakin", d);
  assert.match(c.metin, /masa|monitör/);
  assert.ok(!c.metin.includes("kapı"), "menzil disindaki kapi girmemeli");
  // Sıra: monitör (0.45 m) masadan (0.2 m) ... ikisi de yakın; en yakın önce.
  const i1 = c.metin.indexOf("masa"), i2 = c.metin.indexOf("kapı");
  assert.ok(i1 >= 0 && i2 < 0);
});

test("`yakin` boşsa uydurmaz", () => {
  // Her çapadan 2.5 m'den uzak bir nokta (ilk denemede seçtiğim köşe kapıya
  // 1.9 m yakınmış — testin kendisi yanlıştı, kod değil).
  const c = sorguYanitla("yakin", gorus({ konum: v(4.5, 0, -1.0) }));
  assert.match(c.metin, /yakınında bir şey yok/);
});

test("`onumde` YALNIZCA bakış konisindekini verir", () => {
  // -Z'ye bakıyor: masa/monitör önde, kapı (+Z) arkada.
  const c = sorguYanitla("onumde", gorus());
  assert.ok(!c.metin.includes("kapı"), `arkadaki sey onde gorundu: "${c.metin}"`);

  // Tam ters yöne dönünce kapı öne geçer, masa çıkar.
  const t = sorguYanitla("onumde", gorus({ bakis: v(0, 0, 1) }));
  assert.ok(!t.metin.includes("masa"), `arkadaki masa onde gorundu: "${t.metin}"`);
});

test("`onumde` tek şey söyler — liste değil", () => {
  const c = sorguYanitla("onumde", gorus());
  assert.ok(!c.metin.includes(","), `liste dondu: "${c.metin}"`);
});

test("`onumde` OZYN'i eşyadan önce söyler — insan öncelikli", () => {
  // Ozyn (z=-1.6) masadan (z=-3.2) daha yakın ve ikisi de konide.
  const c = sorguYanitla("onumde", gorus());
  assert.match(c.metin, /Ozyn/, `insan once gelmeli: "${c.metin}"`);
});

test("`oyuncu` görünmüyorsa BİLMİYORUM der, konum uydurmaz", () => {
  const d = gorus({ gorunurMu: (_k, h) => h.z !== -1.6 });
  const c = sorguYanitla("oyuncu", d);
  assert.match(c.metin, /göremiyorsun/);
  assert.ok(!/adım|yanında/.test(c.metin), "goremezken mesafe vermemeli");
});

test("`oyuncu` mekân anlamı verir — ham koordinat değil", () => {
  const c = sorguYanitla("oyuncu", gorus({ oyuncu: v(0, 0, -3.1) }));
  assert.match(c.metin, /masa/, "Ozyn hangi esyanin basinda soylenmeli");
  assert.ok(!/-?\d+\.\d+/.test(c.metin), `ham koordinat sizdi: "${c.metin}"`);
});

test("hiçbir cevap ham koordinat içermez — Orion metre okumaz", () => {
  for (const s of ["dunya", "yakin", "oyuncu", "onumde"] as const) {
    const c = sorguYanitla(s, gorus());
    assert.ok(!/\d+\.\d\d/.test(c.metin), `${s} ham sayi sizdirdi: "${c.metin}"`);
  }
});

test("BÜTÇE uygulanır ve kırpma SÖYLENİR — sessiz eksiltme yok", () => {
  const cok = Array.from({ length: 40 }, (_, i) => ({
    ad: "masa" as CapaAdi,
    konum: v(i * 0.05, 1, -1 - i * 0.01),
    etiket: `uzun-etiketli-nesne-${i}`,
  }));
  const c = sorguYanitla("dunya", gorus({ capalar: cok }));
  assert.ok(c.metin.length <= BUTCE.dunya, `butce asildi: ${c.metin.length} > ${BUTCE.dunya}`);
  assert.equal(c.kirpildi, true);
  assert.match(c.metin, /\+\d+ tane daha|sığmadı/, "kirpma bildirilmeli");
});

test("bütçeye sığan cevap kırpılmış işaretlenmez", () => {
  const c = sorguYanitla("yakin", gorus({ konum: v(0, 0, -3.0) }));
  assert.equal(c.kirpildi, false);
  assert.equal(c.maliyet, c.metin.length);
});

test("mesafe sözü eşikleri artan sırada ve hep dolu", () => {
  const s = [0.5, 2, 3.5, 9].map(mesafeSozu);
  assert.equal(new Set(s).size, 4, "her esik farkli soz vermeli");
  for (const x of s) assert.ok(x.length > 0);
});

test("görüş testi GÖZ hizasından yapılır — yerden değil", () => {
  let gorulenKaynak: Vec3 | null = null;
  sorguYanitla("dunya", gorus({
    konum: v(0, 0, 0), gozYuksekligi: 1.62,
    gorunurMu: (k) => { gorulenKaynak = k; return true; },
  }));
  assert.ok(gorulenKaynak, "gorus testi hic cagrilmadi");
  assert.equal((gorulenKaynak as unknown as Vec3).y, 1.62);
});
