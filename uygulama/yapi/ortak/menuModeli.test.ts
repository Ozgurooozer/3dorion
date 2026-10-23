// uygulama/yapi/ortak/menuModeli.test.ts — menü çözümü: ayırıcı düzeltme, etkin/işaretli durumu, pasif satır çalışmaz (spec 38 §6).
import { test } from "node:test";
import assert from "node:assert/strict";
import { AYIRICI, menuSatiriniCalistir, menuyuCoz, type MenuOgesi } from "./menuModeli.ts";

const oge = (etiket: string, ek: Partial<MenuOgesi> = {}): MenuOgesi => ({ etiket, calistir: () => undefined, ...ek });

test("ayırıcılar: başta, sonda ve art arda olanlar çizilmez", () => {
  const m = menuyuCoz({ ad: "Dosya", satirlar: [AYIRICI, oge("A"), AYIRICI, AYIRICI, oge("B"), AYIRICI] });
  assert.deepEqual(m.satirlar.map((s) => (s.tur === "ayirici" ? "—" : s.etiket)), ["A", "—", "B"]);
});

test("etkin/işaretli satır çizim anında çözülür (durum değişince menü de değişir)", () => {
  let acik = false;
  const m = { ad: "Görünüm", satirlar: [oge("Yasla", { isaretli: () => acik, etkin: () => acik })] };
  const c1 = menuyuCoz(m).satirlar[0]!;
  assert.ok(c1.tur === "oge" && !c1.isaretli && !c1.etkin);
  acik = true;
  const c2 = menuyuCoz(m).satirlar[0]!;
  assert.ok(c2.tur === "oge" && c2.isaretli && c2.etkin);
});

test("pasif satır çalıştırılamaz, etkin satır olayı iletir", () => {
  let n = 0, olayVardi = false;
  const m = menuyuCoz({ ad: "x", satirlar: [oge("Pasif", { etkin: () => false, calistir: () => { n++; } }), oge("Etkin", { calistir: (e) => { n += 10; olayVardi = e !== undefined; } })] });
  assert.equal(menuSatiriniCalistir(m.satirlar[0]!, null), false);
  assert.equal(n, 0);
  assert.equal(menuSatiriniCalistir(m.satirlar[1]!, null), true);
  assert.equal(n, 10);
  assert.ok(olayVardi, "olay (null da olsa) iletilir");
});

test("etkinVar: bütün satırlar pasifse menü soluk", () => {
  assert.equal(menuyuCoz({ ad: "x", satirlar: [oge("a", { etkin: () => false })] }).etkinVar, false);
  assert.equal(menuyuCoz({ ad: "x", satirlar: [oge("a", { etkin: () => false }), oge("b")] }).etkinVar, true);
  assert.equal(menuyuCoz({ ad: "x", satirlar: [] }).etkinVar, false);
});

test("kısayol ve ipucu boşsa boş metin (undefined yazılmaz)", () => {
  const s = menuyuCoz({ ad: "x", satirlar: [oge("a")] }).satirlar[0]!;
  assert.ok(s.tur === "oge" && s.kisayol === "" && s.ipucu === "");
});
