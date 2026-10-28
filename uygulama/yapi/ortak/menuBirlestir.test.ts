// uygulama/yapi/ortak/menuBirlestir.test.ts — ana menü katmanlarının birleşimi (spec 39 D2): aynı ad tek menü, sıra, Yardım son, girdi bozulmaz.
import { test } from "node:test";
import assert from "node:assert/strict";
import { AYIRICI, type Menu, type MenuOgesi } from "./menuModeli.ts";
import { menuleriBirlestir } from "./menuBirlestir.ts";

const oge = (etiket: string): MenuOgesi => ({ etiket, calistir: () => undefined });
const adlar = (m: readonly Menu[]) => m.map((x) => x.ad);
const satir = (m: Menu) => m.satirlar.map((s) => (s === AYIRICI ? "—" : s.etiket));

test("aynı adlı menüler tek menüde: editörün satırları önde, aralarında ayırıcı; ilk görülme sırası", () => {
  const editor: Menu[] = [{ ad: "Dosya", satirlar: [oge("Kaydet")] }, { ad: "Düzen", satirlar: [oge("Geri al")] }];
  const taban: Menu[] = [{ ad: "Dosya", satirlar: [oge("Yeni proje…"), oge("Proje aç…")] }, { ad: "Pencere", satirlar: [oge("Yapı çubuğu")] }];
  const b = menuleriBirlestir([editor, taban]);
  assert.deepEqual(adlar(b), ["Dosya", "Düzen", "Pencere"]);
  assert.deepEqual(satir(b[0]!), ["Kaydet", "—", "Yeni proje…", "Proje aç…"]);
});

test("Yardım her zaman SON (taban sonradan eklese de, editörde ortada olsa da)", () => {
  const editor: Menu[] = [{ ad: "Yardım", satirlar: [oge("Kısayollar")] }, { ad: "Rig", satirlar: [oge("Rig kipi")] }];
  const taban: Menu[] = [{ ad: "Dosya", satirlar: [oge("Yeni")] }, { ad: "Pencere", satirlar: [oge("Yapı")] }];
  assert.deepEqual(adlar(menuleriBirlestir([editor, taban])), ["Rig", "Dosya", "Pencere", "Yardım"]);
  const yardimli = menuleriBirlestir([[{ ad: "Yardım", satirlar: [oge("A")] }], [{ ad: "Yardım", satirlar: [oge("B")] }]]);
  assert.deepEqual(satir(yardimli[0]!), ["A", "—", "B"]);
});

test("editör yokken yalnız taban; boş katman ve boş menü ayırıcı bırakmaz; girdi değişmez", () => {
  const taban: Menu[] = [{ ad: "Dosya", satirlar: [oge("Yeni")] }];
  assert.deepEqual(adlar(menuleriBirlestir([[], taban])), ["Dosya"]);
  const b = menuleriBirlestir([[{ ad: "Dosya", satirlar: [] }], taban]);
  assert.deepEqual(satir(b[0]!), ["Yeni"]);
  const girdi: Menu[] = [{ ad: "Dosya", satirlar: [oge("A")] }];
  const once = JSON.stringify(girdi.map((m) => m.satirlar.length));
  menuleriBirlestir([girdi, girdi]);
  assert.equal(JSON.stringify(girdi.map((m) => m.satirlar.length)), once);
  assert.deepEqual(menuleriBirlestir([]), []);
});
