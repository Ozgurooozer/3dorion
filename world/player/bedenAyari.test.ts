// world/player/bedenAyari.test.ts — Beden ayarının sözleşmesi: bozuk kayıt alan bazında düzelir, glb ile slot tablosu uyuşur.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ayariDuzelt, ayariOku, ayariYaz, gorunenMeshler, meshRengi, BEKLENEN_MESHLER, VARSAYILAN, TEN_MESHI } from "./bedenAyari.ts";

test("varsayılan: gömlek + ceket + pantolon + ayakkabı + çıplak gövde görünür", () => {
  assert.deepEqual(gorunenMeshler(ayariDuzelt(null)).sort(),
    [TEN_MESHI, "oyuncu_gomlek_uzun", "oyuncu_ceket", "oyuncu_pantolon_uzun", "oyuncu_ayakkabi"].sort());
});

test("slot \"yok\" seçilince o parça görünmez; ten yine görünür", () => {
  const a = ayariDuzelt({ secim: { ust: "yok", dis: "yok", alt: "pantolon_sort", ayakkabi: "yok" } });
  assert.deepEqual(gorunenMeshler(a).sort(), [TEN_MESHI, "oyuncu_pantolon_sort"].sort());
});

test("bozuk kayıt alan bazında varsayılana döner: biri bozuk diye ötekiler kaybolmaz", () => {
  const a = ayariDuzelt({ secim: { ust: "yelek", alt: "pantolon_sort" }, renk: { ten: "kırmızı", ceket: "#ff0000", dis: "#AABBCC" } });
  assert.equal(a.secim.ust, VARSAYILAN.secim.ust, "bilinmeyen seçenek → varsayılan");
  assert.equal(a.secim.alt, "pantolon_sort", "geçerli alan korunur");
  assert.equal(a.renk.ten, VARSAYILAN.renk.ten, "geçersiz renk → varsayılan");
  assert.equal(a.renk.dis, "#aabbcc", "geçerli renk küçük harfe çevrilip korunur");
});

test("ayrıştırılamayan metin / null → varsayılan; yaz→oku gidiş dönüş eşit", () => {
  assert.deepEqual(ayariOku("{bozuk"), ayariDuzelt(null));
  assert.deepEqual(ayariOku(null), ayariDuzelt(null));
  const a = ayariDuzelt({ secim: { ust: "gomlek_kisa" }, renk: { ust: "#112233" } });
  assert.deepEqual(ayariOku(ayariYaz(a)), a);
});

test("meshRengi: her slot seçeneği kendi renk anahtarına, uzun/kısa gömlek AYNI renge bağlı", () => {
  assert.equal(meshRengi(TEN_MESHI), "ten");
  assert.equal(meshRengi("oyuncu_gomlek_uzun"), "ust");
  assert.equal(meshRengi("oyuncu_gomlek_kisa"), "ust");
  assert.equal(meshRengi("oyuncu_pantolon_sort"), "alt");
  assert.equal(meshRengi("orion_govde"), null);
});

test("tablo ↔ glb sözleşmesi: slot tablosundaki her mesh glb'de VAR, glb'deki her oyuncu_ mesh'i tabloda", () => {
  const b = readFileSync(new URL("../../assets/oyuncu-beden.glb", import.meta.url));
  const j = JSON.parse(b.toString("utf8", 20, 20 + b.readUInt32LE(12))) as { nodes: { name?: string; mesh?: number }[] };
  const glbde = j.nodes.filter((n) => n.mesh !== undefined && n.name?.startsWith("oyuncu_")).map((n) => n.name!).sort();
  assert.deepEqual(glbde, [...BEKLENEN_MESHLER].sort());
});
