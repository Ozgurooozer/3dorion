// uygulama/duzenleyici/gecmisSekme.test.ts — geri al / yinele yığını (TAVANLI, kirli işareti) ve editör sekmeleri (kirli sekme ONAYSIZ KAPANMAZ).
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { GECMIS_TAVANI, gecmisKur } from "./gecmis.ts";
import { sekmeListesiKur } from "./sekmeler.ts";

test("geri al / yinele sırayla eski hâlleri verir", () => {
  const g = gecmisKur("a");
  g.kaydet("b"); g.kaydet("c");
  assert.deepEqual([g.geriAl(), g.geriAl(), g.geriAl(), g.yinele(), g.simdiki()], ["b", "a", null, "b", "b"]);
});

test("yeni değişiklik yinele dalını siler", () => {
  const g = gecmisKur("a");
  g.kaydet("b"); g.geriAl(); g.kaydet("x");
  assert.equal(g.yinelenebilir(), false);
});

test("aynı değer yığına girmez (işlem bir şey değiştirmedi)", () => {
  const g = gecmisKur("a");
  g.kaydet("a");
  assert.equal(g.boyut(), 1);
});

test(`TAVAN: en çok ${GECMIS_TAVANI} görüntü; aşınca EN ESKİ düşer`, () => {
  const g = gecmisKur(0);
  for (let i = 1; i <= GECMIS_TAVANI + 50; i++) g.kaydet(i);
  let son: number | null = null;
  while (g.geriAlinabilir()) son = g.geriAl();
  assert.deepEqual([g.boyut(), son], [GECMIS_TAVANI, 51]);
});

test("küçük tavan da uyulur (3)", () => {
  const g = gecmisKur("a", 3);
  for (const x of ["b", "c", "d", "e"]) g.kaydet(x);
  assert.equal(g.boyut(), 3);
});

test("kirli: kaydedilince temiz; değişince kirli; geri alıp kaydedilen hâle dönünce yine temiz", () => {
  const g = gecmisKur("a");
  g.kaydedildi();
  g.kaydet("b");
  const kirliIken = g.kirli();
  g.geriAl();
  assert.deepEqual([kirliIken, g.kirli()], [true, false]);
});

test("ilk hâl kaydedilmiş sayılır (diskten açılan grafik kirli değildir)", () => {
  assert.equal(gecmisKur("disk").kirli(), false);
});

test("sıfırla: dışarıdan yeniden yükleme yığını boşaltır, kirli değil", () => {
  const g = gecmisKur("a");
  g.kaydet("b");
  g.sifirla("disk");
  assert.deepEqual([g.boyut(), g.kirli(), g.geriAlinabilir()], [1, false, false]);
});

// ── sekmeler ──
const kirliler = new Set<string>();
const liste = () => sekmeListesiKur<{ ad: string }>((s) => kirliler.has(s.ad));

test("aynı grafik ikinci kez açılınca yeni sekme doğmaz, var olan etkin olur", () => {
  const l = liste();
  l.ac("a", () => ({ ad: "a" })); l.ac("b", () => ({ ad: "b" })); l.ac("a", () => ({ ad: "YENİ" }));
  assert.deepEqual([l.hepsi().length, l.etkin()?.icerik.ad], [2, "a"]);
});

test("KİRLİ sekme ONAYSIZ KAPANMAZ: ilk istek 'onay-gerek', sekme durur", () => {
  kirliler.clear(); kirliler.add("a");
  const l = liste();
  l.ac("a", () => ({ ad: "a" }));
  assert.deepEqual([l.kapat("a", false), l.hepsi().length], ["onay-gerek", 1]);
});

test("onaylı ikinci istek kirli sekmeyi kapatır", () => {
  kirliler.clear(); kirliler.add("a");
  const l = liste();
  l.ac("a", () => ({ ad: "a" }));
  assert.deepEqual([l.kapat("a", true), l.hepsi().length], ["kapandi", 0]);
});

test("temiz sekme hemen kapanır; etkin kapanınca sağdaki etkin olur", () => {
  kirliler.clear();
  const l = liste();
  for (const x of ["a", "b", "c"]) l.ac(x, () => ({ ad: x }));
  l.etkinYap("b");
  assert.deepEqual([l.kapat("b", false), l.etkin()?.ad], ["kapandi", "c"]);
});

test("adı değişen sekme içeriğini korur; yeni ad zaten açıksa değişmez", () => {
  kirliler.clear();
  const l = liste();
  l.ac("a", () => ({ ad: "a-icerik" })); l.ac("b", () => ({ ad: "b" }));
  assert.deepEqual([l.adDegistir("a", "b"), l.adDegistir("a", "z"), l.al("z")?.icerik.ad], [false, true, "a-icerik"]);
});

test("eşzamansız kaydetme: yazarken yeni değişiklik yapıldıysa yalnız YAZILAN hâl temiz sayılır, sekme kirli kalır", () => {
  const g = gecmisKur("a");
  g.kaydet("b");
  const yazilan = g.simdiki();
  g.kaydet("c");             // kaydetme sürerken değişti
  g.kaydedildi(yazilan);     // kaydetme bitti
  const simdiKirli = g.kirli();
  g.geriAl();
  assert.deepEqual([simdiKirli, g.kirli()], [true, false]);
});
