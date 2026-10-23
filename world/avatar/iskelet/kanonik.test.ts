// world/avatar/iskelet/kanonik.test.ts — kanonik iskelet (yapı) ve kaynak tabloları: zincir tablosu eski tek-tablo hâliyle AYNI sonucu verir (spec 38 §2).
import { test } from "node:test";
import assert from "node:assert/strict";
import { UZUVLAR } from "../../../protocol/animasyon.ts";
import { KANONIK_KOK, KANONIK_ZINCIRLER, kanonikAta, kanonikUzuvlar, uzuvZinciri } from "./kanonik.ts";
import { KAYNAK_KEMIKLERI } from "./kaynaklar.ts";
import { RETARGET_KOKU, ZINCIRLER, butunEklemler, uzuvAtasi } from "../zincirler.ts";

test("kanonik: her zincir uzvu yalnız bir zincirde, ve kök zincirlerde değil", () => {
  const hepsi = KANONIK_ZINCIRLER.flatMap((z) => z.uzuvlar);
  assert.equal(new Set(hepsi).size, hepsi.length);
  assert.ok(!hepsi.includes(KANONIK_KOK));
});

test("kanonik: ebeveyn zinciri her uzuvdan köke (kalca) çıkar, döngü yok", () => {
  for (const u of kanonikUzuvlar()) {
    let x: typeof u | null = u, adim = 0;
    while (x && x !== KANONIK_KOK) { x = kanonikAta(x); assert.ok(++adim < 10, `${u}: döngü`); }
    assert.equal(x, KANONIK_KOK, `${u} köke ulaşmıyor`);
  }
});

test("kanonik: ebeveyn önce sıralı (bir uzvun atası kendisinden önce)", () => {
  const l = kanonikUzuvlar();
  for (const u of l) { const a = kanonikAta(u); if (a) assert.ok(l.indexOf(a) < l.indexOf(u), `${u} atasından önce`); }
});

test("kanonik: iki kemikli IK yalnız kol ve bacakta; kutup dirsek GERİ, diz İLERİ", () => {
  const ik = KANONIK_ZINCIRLER.filter((z) => z.kutup);
  assert.deepEqual(ik.map((z) => z.ad), ["sag_kol", "sol_kol", "sag_bacak", "sol_bacak"]);
  for (const z of ik) assert.equal(z.kutup!.z, z.ad.endsWith("kol") ? -1 : 1);
});

test("zincirler: kanonik uzuv kümesi UZUVLAR'ın alt kümesi, kaynak tablosu hepsini kapsar", () => {
  for (const u of kanonikUzuvlar()) { assert.ok(UZUVLAR.includes(u), u); assert.ok(KAYNAK_KEMIKLERI[u], `${u} için kaynak adı yok`); }
});

test("zincirler: birleşik tablo eski tek-tablo değerlerini taşır (anlık görüntü)", () => {
  assert.deepEqual(RETARGET_KOKU, { uzuv: "kalca", kemik: { vrm: "hips" }, kaynak: { soma: "Hips" }, yon: { vrm: "spine", soma: "Spine1" } });
  const sagKol = ZINCIRLER.find((z) => z.ad === "sag_kol")!;
  assert.deepEqual(sagKol.eklemler[0], { uzuv: "sag_kol", kemik: { vrm: "rightUpperArm", prosedurel: "omuzL" }, kaynak: { soma: "RightArm" }, yon: { vrm: "rightLowerArm", soma: "RightForeArm" } });
  assert.deepEqual(sagKol.ik, { ust: "sag_kol", orta: "sag_on_kol", uc: "sag_el", kutup: { x: 0, y: 0, z: -1 } });
  const bas = ZINCIRLER.find((z) => z.ad === "bas_boyun")!.eklemler[1]!;
  assert.deepEqual(bas.yon, { vrm: null, soma: "HeadEnd" });
  assert.equal(bas.kemik.prosedurel, "boyun");
  assert.equal(butunEklemler().length, 17);
  assert.equal(uzuvAtasi("sol_el"), "sol_on_kol");
  assert.equal(uzuvAtasi("sag_kol"), "gogus");
  assert.equal(uzuvAtasi("sag_bacak"), "kalca");
  assert.equal(uzuvAtasi("kalca"), null);
});

test("kanonik: uzuvZinciri kol ve bacak için yer verir, kök için null", () => {
  assert.deepEqual({ ad: uzuvZinciri("sol_diz")!.zincir.ad, sira: uzuvZinciri("sol_diz")!.sira }, { ad: "sol_bacak", sira: 1 });
  assert.equal(uzuvZinciri("kalca"), null);
});
