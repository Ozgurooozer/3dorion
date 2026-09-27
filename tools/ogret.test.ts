// tools/ogret.test.ts — Öğretme aracı: kayıt yeri, liste, bulma, yazma, hafıza dökümü.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { KARAR_ONEKI, KararKaydi, type AlgiSatiri, type KararSatiri } from "../mind/kararKaydi.ts";
import { kuralHafizasiKur, ogretimKur } from "../mind/ogretim.ts";
import { zincirKur } from "../mind/kararZinciri.ts";
import { algiBul, hafizaMetni, kayitYeri, kayitYukle, ogrenilebilirListe, ogretimYaz } from "./ogret.ts";

const ELLE = ["durum:hata", "icgudu:refleks.sonuc.hata", "k:zaten", "niyet_kaynagi:elle", "tur:sonuc"];

/** Gerçek kayıt satırları: bir öğrenilebilir algı (uyandırdı, LLM sustu), bir konuşma (öğrenilemez). */
function kayit(): KararSatiri[] {
  const satirlar: KararSatiri[] = [];
  let t = 1_000;
  const k = new KararKaydi({ oturum: "o1", simdi: () => (t += 1_000), yaz: (s) => satirlar.push(JSON.parse(s.slice(KARAR_ONEKI.length + 1))) });
  k.oturumBasi("sahte");
  const a1 = k.algi({ tur: "sonuc", sonuc: { niyet_id: "elle_x", durum: "hata", not: "zaten ayaktasın" } }, "Intent elle_x → hata", { gecti: true, kural: "refleks.sonuc.hata" }, { isaret: ELLE, golge: null });
  k.uyanis({ algilar: [a1], geriBesleme: 0, beyin: "sahte", sureMs: 5, koken: "dis", takip: false, anilar: 0, dunya: "", cagrilar: [], niyetler: [], reddedilen: 0, kurtarilan: 0, konusulanMetin: false, yutulanSoz: 0 });
  k.algi({ tur: "duydum", metin: "merhaba", kesin: true }, 'Ozyn said: "merhaba"', { gecti: true, kural: "kopru.konusma" });
  return satirlar;
}

function geciciDizin(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "orion-ogret-"));
}

test("kayıt yeri: klasörde her .jsonl okunur, öğretim klasöre yazılır", () => {
  const d = geciciDizin();
  fs.writeFileSync(path.join(d, "2026-09-27.jsonl"), "");
  fs.writeFileSync(path.join(d, "not.txt"), "");
  const y = kayitYeri(d);
  assert.deepEqual({ dosyalar: y.dosyalar.map((f) => path.basename(f)), ogretim: y.ogretimDosyasi }, { dosyalar: ["2026-09-27.jsonl"], ogretim: path.join(d, "ogretim.jsonl") });
});

test("kayıt yeri: sabit dosya verilirse o dosya ve yanındaki öğretim dosyası", () => {
  const d = geciciDizin();
  const f = path.join(d, "canli.jsonl");
  fs.writeFileSync(f, "");
  fs.writeFileSync(path.join(d, "ogretim.jsonl"), "");
  assert.deepEqual(kayitYeri(f).dosyalar.map((x) => path.basename(x)), ["canli.jsonl", "ogretim.jsonl"]);
});

test("liste yalnız öğrenilebilir algıları gösterir; uyandırdığı uyanışta LLM'in sustuğu görünür", () => {
  const z = zincirKur(kayit());
  const liste = ogrenilebilirListe(z, kuralHafizasiKur([]).hafiza, 20);
  assert.deepEqual(liste.map((s) => ({ anahtar: s.anahtar, sonra: s.sonra, ders: s.ders })), [{ anahtar: "o1/a1", sonra: "sustu", ders: null }]);
});

test("liste verilmiş dersi ve bugünkü hafızanın kararını gösterir", () => {
  const satirlar = kayit();
  const a = satirlar.find((s): s is AlgiSatiri => s.tur === "algi" && s.id === "a1")!;
  const ders = ogretimKur(a, "sus", "ogret-araci", 99_999);
  assert.ok(!("hata" in ders));
  const hepsi = [...satirlar, ders];
  const [s] = ogrenilebilirListe(zincirKur(hepsi), kuralHafizasiKur(hepsi).hafiza, 20);
  assert.deepEqual({ ders: s!.ders, simdi: s!.simdi, golge: s!.golge }, { ders: "sus", simdi: "sus (K1)", golge: "—" });
});

test("algiBul oturum/algı anahtarıyla bulur; yanlış anahtar null", () => {
  const z = zincirKur(kayit());
  assert.deepEqual([algiBul(z, "o1/a1")?.id, algiBul(z, "o1/a99"), algiBul(z, "a1"), algiBul(z, "o2/a1")], ["a1", null, null, null]);
});

test("öğretim dosyaya bir satır olarak eklenir ve kayıttan yeniden okunur", () => {
  const d = geciciDizin();
  const satirlar = kayit();
  fs.writeFileSync(path.join(d, "2026-09-27.jsonl"), satirlar.map((s) => JSON.stringify(s)).join("\n") + "\n");
  const a = satirlar.find((s): s is AlgiSatiri => s.tur === "algi" && s.id === "a1")!;
  const s = ogretimKur(a, "sus", "ogret-araci", 50_000);
  assert.ok(!("hata" in s));
  const yer = kayitYeri(d);
  ogretimYaz(yer.ogretimDosyasi, s);
  const { zincir } = kayitYukle(kayitYeri(d));
  assert.deepEqual(zincir.ogretimler.map((o) => ({ hedef: o.hedef, yon: o.yon })), [{ hedef: { o: "o1", id: "a1" }, yon: "sus" }]);
});

test("hafıza dökümü: boşken söyler; doluyken kural, yön, sayaç ve kanıt", () => {
  const bos = hafizaMetni(kuralHafizasiKur([]).hafiza);
  const a = kayit().find((s): s is AlgiSatiri => s.tur === "algi" && s.id === "a1")!;
  const ders = ogretimKur(a, "sus", "ogret-araci", 1);
  assert.ok(!("hata" in ders));
  const dolu = hafizaMetni(kuralHafizasiKur([ders]).hafiza);
  assert.deepEqual(
    { bos, dolu: dolu[0] },
    { bos: ["(hafıza boş: henüz ders yok)"], dolu: `K1: ${ELLE.join(" ∧ ")} → sus (uyan 0 · sus 1) · kanıt 1: o1/a1` },
  );
});
