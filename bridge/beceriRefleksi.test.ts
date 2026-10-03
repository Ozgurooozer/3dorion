// bridge/beceriRefleksi.test.ts — Beceri refleksinin durum makinesi, köprüsüz (spec 14 R7).
//
// Köprü üzerinden davranış bridge/kopruRefleks.test.ts'te (değişmeden geçiyor). Burada sınıf tek
// başına: gönderim, kayıt satırı ve LLM'e geri verme sahte geri çağrılardır.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BeceriRefleksi, type RefleksGeriVerme } from "./beceriRefleksi.ts";
import { REFLEKS_ONEKI } from "./kopruTurleri.ts";
import { niyetKaynagi } from "../mind/durumKodu.ts";
import type { Niyet, NiyetSonucu } from "../protocol/niyet.ts";
import type { RefleksSatiri } from "../mind/kararKaydi.ts";

const OTUR: Niyet = { tur: "otur" };
const KALK: Niyet = { tur: "kalk" };
/** Doğrulayıcının reddettiği bir adım (kayıttan bozuk gelmiş gibi). */
const BOZUK = JSON.parse('{"tur":"poz","poz":"uçuyor"}') as Niyet;

/**
 * Sahte köprü. `cevap` verilirse dünya o adımın sonucunu SENKRON döndürür
 * (gönderim anında; beklenen kimlik önceden kurulmuş olmalı).
 */
function kur(ayar: { zamanAsimiMs?: number; cevap?: (n: Niyet) => NiyetSonucu["durum"] | null } = {}) {
  const giden: { n: Niyet; id: string }[] = [];
  const satirlar: Omit<RefleksSatiri, "tur" | "o" | "id" | "t">[] = [];
  const geriVerilen: RefleksGeriVerme[] = [];
  const r: BeceriRefleksi = new BeceriRefleksi({
    gonder: (n, id) => {
      giden.push({ n, id });
      const durum = ayar.cevap?.(n);
      if (durum) r.sonuc({ niyet_id: id, durum });
    },
    zamanAsimiMs: () => ayar.zamanAsimiMs ?? 30_000,
    satirYaz: (b) => { satirlar.push(b); },
    geriVer: (g) => { geriVerilen.push(g); },
  });
  const baslat = (adimlar: Niyet[]) =>
    r.baslat({ algi: "a1", soz: "otur ve kalk", ozet: "Ozyn said: otur ve kalk", beceri: "b1", adimlar });
  /** Sonucu beklenen son adıma (onay jesti değil) cevap ver. */
  const cevapla = (durum: NiyetSonucu["durum"], not?: string) =>
    r.sonuc({ niyet_id: giden.at(-1)!.id, durum, ...(not ? { not } : {}) });
  return { r, giden, satirlar, geriVerilen, baslat, cevapla };
}

test("önce onay jesti, sonra ilk adım gider", () => {
  const { giden, baslat } = kur();
  baslat([OTUR, KALK]);
  assert.deepEqual(giden.map((g) => g.n.tur), ["jest", "otur"]);
});

test("gönderilen her kimlik refleks önekini taşır (sonucu köprü bu önekle yakalar)", () => {
  const { giden, baslat } = kur();
  baslat([OTUR]);
  assert.deepEqual(giden.map((g) => niyetKaynagi(g.id)), [REFLEKS_ONEKI, REFLEKS_ONEKI]);
});

test("ikinci adım ilkinin `bitti`ini bekler", () => {
  const { giden, baslat, cevapla } = kur();
  baslat([OTUR, KALK]);
  cevapla("bitti");
  assert.deepEqual(giden.map((g) => g.n.tur), ["jest", "otur", "kalk"]);
});

test("onay jestinin sonucu refleksi ilerletmez", () => {
  const { r, giden, baslat } = kur();
  baslat([OTUR, KALK]);
  r.sonuc({ niyet_id: giden[0]!.id, durum: "bitti" });
  assert.equal(giden.length, 2);
});

test("bütün adımlar bitince satır `basari` ile yazılır", () => {
  const { satirlar, baslat, cevapla } = kur();
  baslat([OTUR]);
  cevapla("bitti");
  assert.deepEqual(satirlar.map((s) => s.bitis), ["basari"]);
});

test("başarı LLM'e geri verilmez", () => {
  const { geriVerilen, baslat, cevapla } = kur();
  baslat([OTUR]);
  cevapla("bitti");
  assert.equal(geriVerilen.length, 0);
});

test("hata sonucu sözü sebebiyle LLM'e geri verir", () => {
  const { geriVerilen, baslat, cevapla } = kur();
  baslat([OTUR, KALK]);
  cevapla("hata", "sandalye dolu");
  assert.deepEqual(geriVerilen, [{ algi: "a1", soz: "otur ve kalk", ozet: "Ozyn said: otur ve kalk", adim: "otur", neden: "sandalye dolu" }]);
});

test("hatadan sonra kalan adım gönderilmez", () => {
  const { giden, baslat, cevapla } = kur();
  baslat([OTUR, KALK]);
  cevapla("hata", "sandalye dolu");
  assert.deepEqual(giden.map((g) => g.n.tur), ["jest", "otur"]);
});

test("iptal sessizce `kesildi` olur", () => {
  const { satirlar, geriVerilen, baslat, cevapla } = kur();
  baslat([OTUR, KALK]);
  cevapla("iptal");
  assert.deepEqual([satirlar.map((s) => s.bitis), geriVerilen.length], [["kesildi"], 0]);
});

test("sonuç gelmezse zaman aşımı LLM'e geri verir", async () => {
  const { geriVerilen, baslat } = kur({ zamanAsimiMs: 10 });
  baslat([OTUR]);
  await new Promise((r) => setTimeout(r, 30));
  assert.deepEqual(geriVerilen.map((g) => g.neden), ["no result in time"]);
});

test("geçersiz adım `hata` ile biter ve LLM'e döner", () => {
  const { geriVerilen, baslat } = kur();
  baslat([BOZUK]);
  assert.match(geriVerilen[0]?.neden ?? "", /is not valid/);
});

test("dünya sonucu senkron verse de refleks ilerler", () => {
  const { satirlar, baslat } = kur({ cevap: (n) => (n.tur === "jest" ? null : "bitti") });
  baslat([OTUR, KALK]);
  assert.deepEqual(satirlar.map((s) => s.bitis), ["basari"]);
});

test("satır gönderilen adımları sırayla taşır", () => {
  const { satirlar, baslat, cevapla } = kur();
  baslat([OTUR, KALK]);
  cevapla("bitti");
  cevapla("bitti");
  assert.deepEqual(satirlar[0]?.niyetler.map((n) => n.tur), ["otur", "kalk"]);
});

test("refleks yokken bitir bir şey yazmaz", () => {
  const { r, satirlar } = kur();
  r.bitir("kesildi");
  assert.equal(satirlar.length, 0);
});

test("bitince `suruyor` düşer", () => {
  const { r, baslat, cevapla } = kur();
  baslat([OTUR]);
  cevapla("bitti");
  assert.equal(r.suruyor, false);
});
