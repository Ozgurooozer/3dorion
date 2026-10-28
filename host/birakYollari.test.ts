// host/birakYollari.test.ts — Explorer'dan bırakılan dosyaların yolu preload'da bırakma anında saklanır (host/birakYollari.cjs). Gerçek webUtils/Electron yok: yolAl sahte.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { birakYollariKur, OMUR_MS } = require("./birakYollari.cjs") as {
  birakYollariKur: (h: EventTarget, yolAl: (f: unknown) => string, simdi?: () => number) => { al(d: unknown): string[] };
  OMUR_MS: number;
};

const dosya = (ad: string) => ({ ad });
const yolAl = (f: unknown): string => { const ad = (f as { ad?: string }).ad; if (!ad) throw new Error("yol yok"); return `C:\\Masaüstü\\${ad}`; };
function birak(hedef: EventTarget, dosyalar: unknown[]): void {
  const o = new Event("drop") as Event & { dataTransfer?: unknown };
  o.dataTransfer = { files: dosyalar };
  hedef.dispatchEvent(o);
}

test("bırakma olayında yollar saklanır; renderer'dan gelen (köprüde bozulmuş) File'lar yerine bunlar kullanılır", () => {
  const h = new EventTarget();
  const y = birakYollariKur(h, yolAl);
  birak(h, [dosya("a.glb"), dosya("b.png")]);
  assert.deepEqual(y.al([{}, {}]), ["C:\\Masaüstü\\a.glb", "C:\\Masaüstü\\b.png"]);
});

test("saklanan yol bir kez tüketilir; ikinci çağrı eski bırakmayı tekrarlamaz", () => {
  const h = new EventTarget();
  const y = birakYollariKur(h, yolAl);
  birak(h, [dosya("a.glb")]);
  assert.equal(y.al([]).length, 1);
  assert.deepEqual(y.al([]), []);
});

test("yolu alınamayan dosya atlanır, diğerleri geçer", () => {
  const h = new EventTarget();
  const y = birakYollariKur(h, yolAl);
  birak(h, [{}, dosya("b.png")]);
  assert.deepEqual(y.al([]), ["C:\\Masaüstü\\b.png"]);
});

test("bırakma yoksa verilen File'lar doğrudan çözülür (düğme/yedek yol); hiçbiri çözülmezse boş", () => {
  const h = new EventTarget();
  const y = birakYollariKur(h, yolAl);
  assert.deepEqual(y.al([dosya("c.webp")]), ["C:\\Masaüstü\\c.webp"]);
  assert.deepEqual(y.al([{}]), []);
  assert.deepEqual(y.al(undefined), []);
});

test("eskimiş saklanan yol kullanılmaz (başka bırakmaya karışmasın)", () => {
  const h = new EventTarget();
  let t = 1000;
  const y = birakYollariKur(h, yolAl, () => t);
  birak(h, [dosya("a.glb")]);
  t += OMUR_MS + 1;
  assert.deepEqual(y.al([]), []);
});

test("dosyasız bırakma (metin sürükleme) saklananı ezmez", () => {
  const h = new EventTarget();
  const y = birakYollariKur(h, yolAl);
  birak(h, [dosya("a.glb")]);
  birak(h, []);
  assert.deepEqual(y.al([]), ["C:\\Masaüstü\\a.glb"]);
});
