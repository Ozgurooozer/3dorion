// tools/beceri-curut.test.ts — Çürütme bataryasının KALİBRASYONU (Themis 1.1): her denetçi, bilerek
// bozulmuş bir kayıtta alarm verir; temiz kayıtta vermez. Düzenek tekrarlanabilir.
//
// Tohum bataryanınkinden (1–40) ayrı: 101. Zamanlama bataryanınkiyle aynı; saat sanal (node:test sahte
// zamanlayıcısı): her test kendi koşusunu kendi saatiyle kurar, temiz durumla başlar.
"use strict";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { akisKos, akisKur, fark, r1, r4, r5, r6, sanalSaat, type DunyaOlayi, type KosuSonucu, type Saat } from "./beceri-curut.ts";
import type { AlgiSatiri, RefleksSatiri } from "../mind/kararKaydi.ts";

const TOHUM = 101;
const AKIS = akisKur(TOHUM, 2, 20);

/** Testin sanal saati: setTimeout ve Date sahte; test bitince node:test geri alır. */
function saatKur(t: TestContext): Saat {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_790_000_000_000 });
  return sanalSaat((ms) => t.mock.timers.tick(ms));
}
const kos = (saat: Saat, yetki: boolean | null, gecmisli = true): Promise<KosuSonucu> => akisKos(TOHUM, AKIS, { yetki, gecmisli, saat });
const refleksler = (k: KosuSonucu) => k.oturumlar.flatMap((o) => o.satirlar).filter((s): s is RefleksSatiri => s.tur === "refleks");

test("sanal saat milisaniye çözünürlüklü: bir söz zincirinin kurduğu zamanlayıcı bir sonraki milisaniyede çalışır", async (t) => {
  const saat = saatKur(t);
  const iz: string[] = [];
  void new Promise((r) => setTimeout(r, 5)).then(() => { iz.push("5"); setTimeout(() => iz.push("6"), 1); });
  await saat.ilerle(6);
  assert.deepEqual(iz, ["5", "6"]);
});

test("akış belirlenimci: aynı tohum aynı olaylar; olayların yarısından çoğu söz", () => {
  const sozOrani = AKIS.flat().filter((o) => o.tur === "soz").length / AKIS.flat().length;
  assert.deepEqual({ ayni: JSON.stringify(akisKur(TOHUM, 2, 20)) === JSON.stringify(AKIS), cogu: sozOrani > 0.5 }, { ayni: true, cogu: true });
});

test("koşu tekrarlanabilir: aynı akış iki kez, dünyaya giden niyetler ve uyanışlar aynı (R2, R3 yanlış alarm vermesin)", async (t) => {
  const saat = saatKur(t);
  const [bir, iki] = [await kos(saat, false), await kos(saat, false)];
  assert.equal(fark(bir, iki), 0);
});

test("temiz koşu, yetki açık: R4'ün bütün denetimleri 0 ihlal ve en az iki refleks sınandı", async (t) => {
  const o = r4(await kos(saatKur(t), true));
  assert.deepEqual({ ...o, refleks: o.refleks >= 2 }, { refleks: true, a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 });
});

test("temiz koşu: R1 gölge denetimi ve canlı hafıza = kayıt, iki kipte", async (t) => {
  const saat = saatKur(t);
  const [a, k] = [r1(await kos(saat, true)), r1(await kos(saat, false))];
  assert.deepEqual(
    [a.golge.ayni === a.golge.golgeli, a.hafizaEsit, k.golge.ayni === k.golge.golgeli, k.hafizaEsit, a.golge.golgeli > 0],
    [true, true, true, true, true],
  );
});

// ── Her denetçi bozulmuş kayıtta alarm verir ───────────────────────────────

test("R4a alarm: refleks kimliğiyle giden bir komut", async (t) => {
  const k = await kos(saatKur(t), true);
  k.dunya.push({ tur: "gonder", id: "refleks_sahte_1", n: { tur: "komut", metin: "dir", gerekce: "g" } });
  assert.equal(r4(k).a, 1);
});

test("R4b alarm: ikinci adım birincinin `bitti`sinden önce gitmiş gibi", async (t) => {
  const k = await kos(saatKur(t), true);
  const r = refleksler(k).find((x) => x.niyetler.length >= 2);
  assert.ok(r, "ön koşul: iki adımlı en az bir refleks olmalı");
  const ikinci = k.dunya.findIndex((x) => x.tur === "gonder" && x.id === r.niyetler[1]!.id);
  const [olay] = k.dunya.splice(ikinci, 1) as [DunyaOlayi];
  k.dunya.unshift(olay);
  assert.ok(r4(k).b >= 1);
});

test("R4c alarm: refleksin adım sonucu kapıdan geçmiş gibi", async (t) => {
  const k = await kos(saatKur(t), true);
  const s = k.oturumlar.flatMap((o) => o.satirlar).find((x): x is AlgiSatiri => x.tur === "algi" && x.algi === "sonuc" && x.kapi.kural === "kopru.refleks");
  assert.ok(s, "ön koşul: refleks sonucu olmalı");
  s.kapi.gecti = true;
  assert.equal(r4(k).c, 1);
});

test("R4d alarm: başarıyla biten refleks hata diye yazılmış (LLM devralmamış)", async (t) => {
  const k = await kos(saatKur(t), true);
  const r = refleksler(k).find((x) => x.bitis === "basari");
  assert.ok(r, "ön koşul: başarılı refleks olmalı");
  r.bitis = "hata";
  assert.equal(r4(k).d, 1);
});

test("R4e alarm: gölgesi dolu, kapıdan geçen sözün refleks satırı yok", async (t) => {
  const k = await kos(saatKur(t), true);
  const o = k.oturumlar.find((x) => x.satirlar.some((s) => s.tur === "refleks"))!;
  o.satirlar.splice(o.satirlar.findIndex((s) => s.tur === "refleks"), 1);
  assert.ok(r4(k).e >= 1);
});

test("R4e alarm vermez: kapının düşürdüğü söz, gölgesi dolu olsa da refleks gerektirmez", async (t) => {
  const k = await kos(saatKur(t), true);
  const o = k.oturumlar.find((x) => x.satirlar.some((s) => s.tur === "refleks"))!;
  const i = o.satirlar.findIndex((s) => s.tur === "refleks");
  const r = o.satirlar[i] as RefleksSatiri;
  const soz = o.satirlar.find((s): s is AlgiSatiri => s.tur === "algi" && s.id === r.algi)!;
  o.satirlar.splice(i, 1);
  soz.kapi = { gecti: false, kural: "dikkat.tekrar" };
  assert.equal(r4(k).e, 0);
});

test("R4f alarm: refleksin yaptığı adım gölgede yazılandan farklı", async (t) => {
  const k = await kos(saatKur(t), true);
  refleksler(k)[0]!.niyetler[0]!.govde = { tur: "dur" };
  assert.equal(r4(k).f, 1);
});

test("R2/R3 alarm: bir oturumda tek niyet farklı; ya da yalnız uyanış sayısı farklı", async (t) => {
  const saat = saatKur(t);
  const a = await kos(saat, false);
  const [niyet, uyanis] = [structuredClone(a), structuredClone(a)];
  niyet.oturumlar.find((x) => x.niyetler.length > 0)!.niyetler[0] = { tur: "dur" };
  uyanis.oturumlar[0]!.uyanis++;
  assert.deepEqual([fark(a, structuredClone(a)), fark(a, niyet), fark(a, uyanis)], [0, 1, 1]);
});

test("R1 alarm: kayıttaki bir gölge bozulmuş; canlı hafıza kayıttan farklı", async (t) => {
  const k = await kos(saatKur(t), false);
  const s = k.oturumlar.flatMap((o) => o.satirlar).find((x): x is AlgiSatiri => x.tur === "algi" && !!x.beceriGolge)!;
  s.beceriGolge!.adimlar = [];
  k.oturumlar.at(-1)!.hafiza = "[]";
  const d = r1(k);
  assert.deepEqual({ farkli: d.golge.golgeli - d.golge.ayni >= 1, hafizaEsit: d.hafizaEsit }, { farkli: true, hafizaEsit: false });
});

test("R5 kalibrasyon: karıştırma yokken karışık uyum gerçek uyuma eşit", async (t) => {
  const x = r5(await kos(saatKur(t), false), TOHUM, false);
  assert.deepEqual(x.karisik, x.gercek);
});

test("R5 kalibrasyon: karıştırınca uyum payı düşer", async (t) => {
  const x = r5(await kos(saatKur(t), false), TOHUM);
  const pay = ([u, e]: [number, number]) => (e === 0 ? 0 : u / e);
  assert.ok(pay(x.karisik) < pay(x.gercek), `gerçek ${x.gercek.join("/")} · karışık ${x.karisik.join("/")}`);
});

test("R6 kalibrasyon: silmeden hedef beceri kayıttan da önerilir, fark yok; silince önerilmez, her fark ondan", async (t) => {
  const k = await kos(saatKur(t), false);
  const [silmeden, silince] = [r6(k, false)!, r6(k)!];
  assert.deepEqual(
    { oneren: silmeden.oneren > 0, fark: silmeden.fark, sonra: { oneren: silince.oneren, yabanci: silince.yabanciFark, silinen: silince.silinen > 0 } },
    { oneren: true, fark: 0, sonra: { oneren: 0, yabanci: 0, silinen: true } },
  );
});

test("R6 alarm: silinen beceriyle ilgisiz bir gölge bozulursa yabancı fark sayılır", async (t) => {
  const k = await kos(saatKur(t), false);
  const hedef = r6(k)!.beceri;
  const s = k.oturumlar.flatMap((o) => o.satirlar).find((x): x is AlgiSatiri => x.tur === "algi" && x.beceriGolge !== undefined && x.beceriGolge?.beceri !== hedef);
  assert.ok(s, "ön koşul: silinen beceriyle ilgisiz gölgeli söz olmalı");
  s.beceriGolge = { beceri: "B00000000", pay: 1, adimlar: [] };
  assert.ok(r6(k)!.yabanciFark >= 1);
});
