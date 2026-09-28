// world/arayuz/modelSeciciCekirdek.test.ts — seçici penceresinin kararları.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  suzVeGrupla, duzListe, sonrakiIndeks, baslangicIndeksi, kartHali, taramaSatiri,
  type ModelKarti, type SeciciDurumu,
} from "./modelSeciciCekirdek.ts";

const k = (ad: string, grup: ModelKarti["grup"], uygun = true, rozet = ""): ModelKarti => ({
  ad, baslik: ad.replace(/^yerel:/, ""), grup, aciklama: "", uygun,
  rozetler: rozet ? [{ metin: rozet, ton: "notr" }] : [],
});
const KARTLAR = [
  k("claude:haiku", "bulut"),
  k("yerel:qwen2.5:7b", "yerel", true, "araç ✓"),
  k("mcp", "dis"),
  k("yerel:nomic-embed-text", "yerel", false),
  k("yerel:qwen3:4b", "yerel", true, "4.7 GB"),
];
const D = (o: Partial<SeciciDurumu> = {}): SeciciDurumu =>
  ({ aktif: "claude:haiku", istenen: "claude:haiku", gecis: "sakin", ...o });

test("gruplar yerel → bulut → dış; boş grup yok", () => {
  const g = suzVeGrupla(KARTLAR, "");
  assert.deepEqual(g.map((x) => x.grup), ["yerel", "bulut", "dis"]);
  assert.deepEqual(duzListe(g).map((x) => x.ad),
    ["yerel:qwen2.5:7b", "yerel:nomic-embed-text", "yerel:qwen3:4b", "claude:haiku", "mcp"]);
  assert.deepEqual(suzVeGrupla(KARTLAR, "qwen").map((x) => x.grup), ["yerel"]);
});

test("süzgeç rozetlerde de arar ve Türkçe harf duyarsız", () => {
  assert.deepEqual(duzListe(suzVeGrupla(KARTLAR, "ARAÇ")).map((x) => x.ad), ["yerel:qwen2.5:7b"]);
  assert.deepEqual(duzListe(suzVeGrupla(KARTLAR, "gb")).map((x) => x.ad), ["yerel:qwen3:4b"]);
  assert.deepEqual(suzVeGrupla(KARTLAR, "yokboyle"), []);
});

test("ok tuşu seçilemeyen kartı ATLAR, uçta durur", () => {
  const l = duzListe(suzVeGrupla(KARTLAR, ""));
  assert.equal(sonrakiIndeks(l, 0, 1), 2, "gömme modeline durdu");
  assert.equal(sonrakiIndeks(l, 2, -1), 0);
  assert.equal(sonrakiIndeks(l, 4, 1), 4, "sondan başa döndü");
  assert.equal(sonrakiIndeks(l, 0, -1), 0);
  assert.equal(sonrakiIndeks([k("x", "yerel", false)], 0, 1), -1);
  assert.equal(sonrakiIndeks(l, -1, 1), 0);
});

test("açılış imleci istenen karta, yoksa aktif karta", () => {
  const l = duzListe(suzVeGrupla(KARTLAR, ""));
  assert.equal(baslangicIndeksi(l, D({ istenen: "yerel:qwen3:4b" })), 2);
  assert.equal(baslangicIndeksi(l, D()), 3);
  assert.equal(baslangicIndeksi(l, D({ aktif: "yok", istenen: "yok" })), 0);
});

test("kart hâli geçişi doğru kartta gösterir", () => {
  const q = KARTLAR[1]!;
  assert.equal(kartHali(KARTLAR[0]!, D()), "aktif");
  assert.equal(kartHali(q, D()), "hazir");
  assert.equal(kartHali(q, D({ gecis: "kontrol", hedef: q.ad, istenen: q.ad })), "kontrol");
  assert.equal(kartHali(q, D({ gecis: "reddedildi", hedef: q.ad })), "reddedildi");
  assert.equal(kartHali(KARTLAR[3]!, D()), "uygunsuz");
});

test("tarama satırı: taranıyor / yok / taze", () => {
  assert.match(taramaSatiri(null, 0), /taranıyor/);
  assert.match(taramaSatiri({ ulasildi: false, surum: null, modelSayisi: 0, hata: "kapalı", an: 0 }, 0),
    /Ollama yok — kapalı · `ollama serve`/);
  assert.equal(taramaSatiri({ ulasildi: true, surum: "0.12.3", modelSayisi: 4, an: 1000 }, 3000),
    "Ollama 0.12.3 · 4 model · az önce tarandı");
  assert.match(taramaSatiri({ ulasildi: true, surum: null, modelSayisi: 1, an: 0 }, 125_000), /^Ollama · 1 model · 2 dk önce/);
});
