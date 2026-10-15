// uygulama/gozlem.test.ts — Göz muayenesi: akış sırası, sıra bekleme (iki yönlü), tek uçuş, dürüst hatalar. Sahte kare/model/panel.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { gozlemKur, type GozlemBagi, type GozlemKaresi } from "./gozlem.ts";

const KARE: GozlemKaresi = { png: "AAAA", en: 896, boy: 504 };

function sahte(ek: Partial<GozlemBagi> & { mesgulSayisi?: number } = {}) {
  const olaylar: string[] = [];
  let mesgul = ek.mesgulSayisi ?? 0;
  const b: GozlemBagi = {
    kare: async () => KARE,
    model: { model: "gemma4:e4b", incele: async () => "Bir ofis odası görünüyor." },
    beyinMesgul: () => (mesgul > 0 ? (mesgul--, true) : false),
    panel: {
      ac: () => olaylar.push("ac"),
      durum: (m) => olaylar.push(`durum:${m}`),
      onizleme: (u, en, boy) => olaylar.push(`onizleme:${u.slice(0, 22)}:${en}x${boy}`),
      cevap: (m, model) => olaylar.push(`cevap:${model}:${m}`),
      hata: (m) => olaylar.push(`hata:${m}`),
    },
    bekle: async () => {},
    ...ek,
  };
  return { b, olaylar };
}

test("akış: panel açılır → kare çekilir → ÖNİZLEME hemen görünür → model bakar → cevap panelde; kayıt döner", async () => {
  const { b, olaylar } = sahte();
  const g = gozlemKur(b);
  const k = await g.bak();
  assert.deepEqual(olaylar.map((o) => o.split(":")[0]), ["ac", "durum", "onizleme", "durum", "cevap"]);
  assert.ok(olaylar.find((o) => o.startsWith("onizleme"))!.includes("data:image/png;base64"), "önizleme PNG data URL olmalı");
  assert.deepEqual([k?.metin, k?.model, k?.en, k?.boy], ["Bir ofis odası görünüyor.", "gemma4:e4b", 896, 504]);
  assert.equal(g.son(), k);
});

test("model yalnız resmi alır: Orion'un sohbeti/algısı/rolü bu yola HİÇ girmez (incele tek argüman)", async () => {
  const alinan: unknown[][] = [];
  const { b } = sahte({ model: { model: "m", incele: async (...a: unknown[]) => { alinan.push(a); return "x"; } } as GozlemBagi["model"] });
  await gozlemKur(b).bak();
  assert.deepEqual(alinan, [["AAAA"]]);
});

test("beden yoksa (kare null): dürüst hata, model çağrılmaz", async () => {
  let cagri = 0;
  const { b, olaylar } = sahte({ kare: async () => null, model: { model: "m", incele: async () => { cagri++; return "x"; } } });
  assert.equal(await gozlemKur(b).bak(), null);
  assert.equal(cagri, 0);
  assert.ok(olaylar.some((o) => o.startsWith("hata:Orion'un bedeni yok")));
});

test("kare çekimi fırlatırsa hata panelde yazılır ve çalışma kilidi açılır (sonraki bakış çalışır)", async () => {
  let ilk = true;
  const { b, olaylar } = sahte({ kare: async () => { if (ilk) { ilk = false; throw new Error("tuval yok"); } return KARE; } });
  const g = gozlemKur(b);
  assert.equal(await g.bak(), null);
  assert.ok(olaylar.some((o) => o.includes("kare çekilemedi: tuval yok")));
  assert.equal(g.suruyor(), false);
  assert.ok(await g.bak(), "ikinci bakış çalışmalı");
});

test("model hata verirse (kapalı, zaman aşımı) hata panelde, önizleme yine görünür", async () => {
  const { b, olaylar } = sahte({ model: { model: "m", incele: async () => { throw new Error("görme modeli 30 sn içinde cevap vermedi"); } } });
  assert.equal(await gozlemKur(b).bak(), null);
  assert.ok(olaylar.some((o) => o.startsWith("onizleme")));
  assert.ok(olaylar.some((o) => o.startsWith("hata:görme modeli 30 sn")));
});

test("SIRA: beyin düşünüyorsa model ÇAĞRILMADAN önce beklenir; panel nedenini söyler", async () => {
  const sira: string[] = [];
  const { b, olaylar } = sahte({
    mesgulSayisi: 3,
    model: { model: "m", incele: async () => { sira.push("model"); return "x"; } },
    bekle: async () => { sira.push("bekle"); },
  });
  await gozlemKur(b).bak();
  assert.deepEqual(sira, ["bekle", "bekle", "bekle", "model"]);
  assert.ok(olaylar.some((o) => o.includes("beyin düşünüyor, sıra bekleniyor")));
});

test("beyin tavan süresince boşalmazsa vazgeçer ve söyler (sonsuz bekleme yok)", async () => {
  let t = 0;
  const { b, olaylar } = sahte({ beyinMesgul: () => true, simdi: () => (t += 40_000), siraTavaniMs: 90_000 });
  assert.equal(await gozlemKur(b).bak(), null);
  assert.ok(olaylar.some((o) => o.startsWith("hata:beyin 90 sn içinde boşalmadı")));
});

test("TEK UÇUŞ: sürerken suruyor() true (beyin kapısı bunu okur), ikinci bak() yeni muayene açmaz", async () => {
  let birak!: () => void;
  const bekletici = new Promise<void>((r) => { birak = r; });
  const { b } = sahte({ model: { model: "m", incele: () => bekletici.then(() => "uzun") } });
  const g = gozlemKur(b);
  const ilk = g.bak();
  await Promise.resolve();
  assert.equal(g.suruyor(), true);
  assert.equal(await g.bak(), null, "ikinci istek null");
  birak();
  assert.equal((await ilk)?.metin, "uzun");
  assert.equal(g.suruyor(), false);
});
