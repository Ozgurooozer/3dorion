// tools/kimodo/govde.test.ts — KİMODO ÇEVİRİSİ GERÇEK GÖVDEDE (spec 37 §6): gerçek `assets/orion-lowpoly.glb`, başsız NullEngine, ürünün oynatma yolu
// (derleyici → klip → jest niyeti → uzuv sürücüsü, bosta altta). Ölçülen şey kemiklerin YERİ, deri değil; görüntü canlıda GÖRÜLMEDİ.
// Ölçüt (govdeKarsilastir.ts): uç etkileyici (el, ayak, baş) zincir köküne göre, zincir boyu oranıyla ölçekli, kaynak BVH'nin aynı eklemiyle.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { kimodoCevir, tablolariOku } from "../kimodoCevir.ts";
import { bvhCevir } from "./cevir.ts";
import { govdedeKarsilastir, pearson, type GovdeOlcusu } from "./govdeKarsilastir.ts";
import { BVH_KLASORU, KLIP_AYARLARI } from "./hepsi.ts";
import { orionGovdesiniOlc } from "./orionOlc.ts";
import { butunEklemler, uzuvAtasi } from "../../world/avatar/zincirler.ts";

const Z = { timeout: 120_000 };
const T = tablolariOku();
const olcumler = new Map<string, Promise<GovdeOlcusu>>();
/** Bir klibin gövde ölçümü (döngülüde döngüsüz çeviriyle: kaynakla kare kare karşılaştırılabilsin). Dosya içinde bir kez. */
function olc(a: string): Promise<GovdeOlcusu> {
  let p = olcumler.get(a);
  if (!p) {
    const metin = readFileSync(join(BVH_KLASORU, `${a}.bvh`), "utf8");
    const ayar = { ...KLIP_AYARLARI[a], dongu: false };
    const { sekans } = kimodoCevir(metin, { ...ayar, ad: `kimodo_${a}` }, T);
    p = govdedeKarsilastir(sekans, bvhCevir(metin, T.tpoz, T.orion, { yerinde: ayar.yerinde ?? true }), T.tpoz);
    olcumler.set(a, p);
  }
  return p;
}

test("orionGovdesi.json güncel: gerçek glb'den yeniden ölçüm dosyayla aynı (glb ya da bosta klibi değişirse kırmızı: yeniden ölç)", Z, async () => {
  const yeni = await orionGovdesiniOlc();
  const kotu: string[] = [];
  for (const [u, e] of Object.entries(T.orion.eklemler)) {
    const y = yeni.eklemler[u];
    const sayilar = (x: typeof e) => [...x.dinlenme, ...(x.yonDinlenme ?? []), ...x.bosta, ...x.A];
    if (!y || sayilar(e).some((v, i) => Math.abs(v - sayilar(y)[i]!) > 1e-4)) kotu.push(u);
  }
  assert.deepEqual(kotu, []);
});

test("zincir kemikleri gerçek glb'de var ve her uzvun ATASI glb hiyerarşisindeki en yakın eşlenmiş ata", Z, async () => {
  const { NullEngine } = await import("@babylonjs/core/Engines/nullEngine.js");
  const { Scene } = await import("@babylonjs/core/scene.js");
  const { vrmIskeletYukle } = await import("../../world/avatar/vrm.ts");
  const motor = new NullEngine();
  const sahne = new Scene(motor);
  const u = console.warn; console.warn = () => {};
  try {
    await vrmIskeletYukle(sahne, `data:model/gltf-binary;base64,${readFileSync(new URL("../../assets/orion-lowpoly.glb", import.meta.url)).toString("base64")}`, { onek: "z" });
    const dugumler = sahne.getTransformNodeByName("z_klip_kok")!.getChildTransformNodes(false);
    const kemikUzvu = new Map(butunEklemler().map((e) => [e.kemik.vrm, e.uzuv]));
    const kotu: string[] = [];
    for (const e of butunEklemler()) {
      const d = dugumler.find((n) => n.name === e.kemik.vrm);
      if (!d) { kotu.push(`${e.uzuv}: '${e.kemik.vrm}' yok`); continue; }
      if (e.yon.vrm && !dugumler.some((n) => n.name === e.yon.vrm)) kotu.push(`${e.uzuv}: yön '${e.yon.vrm}' yok`);
      let ata: string | null = null;
      for (let x = d.parent; x; x = x.parent) { const k = kemikUzvu.get(x.name); if (k) { ata = k; break; } }
      if (ata !== uzuvAtasi(e.uzuv)) kotu.push(`${e.uzuv}: glb atası ${ata}, tablo ${uzuvAtasi(e.uzuv)}`);
    }
    assert.deepEqual(kotu, []);
  } finally { console.warn = u; motor.dispose(); }
});

for (const a of Object.keys(KLIP_AYARLARI)) {
  test(`${a}: her uç etkileyicinin (eller, ayaklar, baş) ortalama hatası zincir boyunun %8'inden az`, Z, async () => {
    const o = await olc(a);
    assert.deepEqual(o.uclar.filter((u) => u.hataOrani >= 0.08).map((u) => `${u.ad} %${(u.hataOrani * 100).toFixed(1)}`), []);
  });
  test(`${a}: kaynakta ≥ 10 cm oynayan her eksende Orion'un yolu kaynakla aynı yönde (korelasyon > 0,85; eşik ilk ölçümden sonra kondu, en düşük ölçülen 0,882)`, Z, async () => {
    const o = await olc(a);
    const kotu = o.uclar.flatMap((u) => (["x", "y", "z"] as const).filter((e) => (u.genlikCm[e] ?? 0) >= 10 && (u.korelasyon[e] ?? 0) <= 0.85).map((e) => `${u.ad}.${e} ${u.korelasyon[e]}`));
    assert.deepEqual(kotu, []);
  });
}

test("el_salla: Orion'un SAĞ eli omzun en az 25 cm üstüne çıkar, SOL eli omzun altında kalır", Z, async () => {
  const o = await olc("el_salla");
  const tepe = (ad: string) => Math.max(...o.uclar.find((u) => u.ad === ad)!.orionYolu.map((p) => p[1]));
  assert.deepEqual([tepe("sag_el") > 0.25, tepe("sol_el") < 0], [true, true], `sağ ${tepe("sag_el").toFixed(2)} sol ${tepe("sol_el").toFixed(2)}`);
});

test("zipla: Orion'un kalçası en az 20 cm yükselir ve kaynağın kalçasını izler (korelasyon > 0,95)", Z, async () => {
  const o = await olc("zipla");
  const y = o.kalcaY.orion;
  assert.deepEqual([Math.max(...y) - y[0]! > 0.2, pearson(y, o.kalcaY.kaynak) > 0.95], [true, true], `yükselme ${(Math.max(...y) - y[0]!).toFixed(2)} m`);
});

test("yuru: bacaklar karşılıklı sallanır — sağ ve sol ayağın ileri-geri (z) yolları ters ilişkili (< −0,5)", Z, async () => {
  const o = await olc("yuru");
  const z = (ad: string) => o.uclar.find((u) => u.ad === ad)!.orionYolu.map((p) => p[2]);
  const r = pearson(z("sag_ayak"), z("sol_ayak"));
  assert.ok(r < -0.5, `korelasyon ${r.toFixed(3)}`);
});

test("bütün kliplerde ayak tabanı yüksekliği kaynağınkinden ortalama 4 cm'den az sapar (ayak yere iner, havada kalmaz)", { timeout: 600_000 }, async () => {
  const kotu: string[] = [];
  for (const a of Object.keys(KLIP_AYARLARI)) { const o = await olc(a); if (o.ayakTabaniCm >= 4) kotu.push(`${a} ${o.ayakTabaniCm} cm`); }
  assert.deepEqual(kotu, []);
});
