// mind/sikistir.test.ts — Hafıza sıkıştırma: plan, cevap çözme, güvenlik ilkeleri (spec 26 F3-C).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Hafiza, type Ani, type AniTuru } from "./hafiza.ts";
import { KORU, TAZE_MS, OTO_ESIK, OTO_ARALIK_MS, OTO_ARALIK_DK_ARALIGI, OTO_ESIK_ARALIGI, OTO_VARSAYILAN, EN_AZ_PLAN, otoSikistirmaGerekli, sikistirmaCoz, sikistirmaIstegi, sikistirmaPlani, sinirdaKes } from "./sikistir.ts";

const SIMDI = 10_000_000_000;
const ani = (i: number, tur: AniTuru = "konusma", yasMs = 24 * 3600_000): Ani => ({ metin: `kayıt ${i}`, tur, onem: 5, olusma: SIMDI - yasMs - i * 1000, sonErisim: SIMDI - yasMs });
const ham = (n: number, tur: AniTuru = "konusma") => Array.from({ length: n }, (_, i) => ani(i, tur));

test("istek: /compact ve eşdeğerleri TAM eşleşir; cümle içinde geçmesi tetiklemez", () => {
  for (const s of ["/compact", "Compact", "hafızayı sıkıştır", "Sıkıştır!"]) assert.equal(sikistirmaIstegi(s), true, s);
  for (const s of ["compact diye bir komut var mı", "hafızayı sıkıştırmak ister misin", "merhaba"]) assert.equal(sikistirmaIstegi(s), false, s);
});

test("plan: en yeni KORU kayıt ve olgu anıları korunur, en eskiler seçilir", () => {
  const aniler = [...ham(60), { ...ani(0, "olgu"), anahtar: "k" }];
  const plan = sikistirmaPlani(aniler, SIMDI);
  assert.equal(plan.length, 60 - KORU);
  assert.equal(plan.some((a) => a.tur === "olgu"), false);
  const korunan = aniler.filter((a) => a.tur !== "olgu" && !plan.includes(a));
  assert.ok(Math.min(...korunan.map((a) => a.olusma)) > Math.max(...plan.map((a) => a.olusma)), "plan, korunanlardan hep daha eski");
});

test("plan: son TAZE_MS içindeki kayıt sıkışmaz", () => {
  const taze = Array.from({ length: 60 }, (_, i) => ani(i, "konusma", TAZE_MS / 2));
  assert.deepEqual(sikistirmaPlani(taze, SIMDI), []);
});

test("oto tetik: eşik altı ve aralık dolmadan tetiklemez; eşik üstü + aralık dolunca tetikler", () => {
  assert.equal(otoSikistirmaGerekli(ham(OTO_ESIK), 0, SIMDI), false);
  assert.equal(otoSikistirmaGerekli(ham(OTO_ESIK + 1), SIMDI - OTO_ARALIK_MS / 2, SIMDI), false);
  assert.equal(otoSikistirmaGerekli(ham(OTO_ESIK + 1), 0, SIMDI), true);
});

test("çöz: FACT ve SUMMARY satırları; geçersiz anahtar ve başıboş satır atılır ve SAYILIR", () => {
  const r = sikistirmaCoz("FACT arac: claude\nFACT Kötü Anahtar: x\nSUMMARY: Ozyn terminalde çalıştı.\nbaşıboş satır")!;
  assert.deepEqual(r.olgular, [{ anahtar: "arac", deger: "claude" }]);
  assert.equal(r.ozet, "Ozyn terminalde çalıştı.");
  assert.equal(r.atilan, 2);
});

test("çöz: ne olgu ne özet varsa null (silme yok)", () => {
  assert.equal(sikistirmaCoz("Sure! Here is the summary of the memory."), null);
  assert.equal(sikistirmaCoz(""), null);
});

test("Hafiza.sikistir: yalnız verilen ham kayıtlar gider; olgu ve verilmeyenler kalır; özet + olgu eklenir", () => {
  const h = new Hafiza({ simdi: () => SIMDI });
  h.yukle([...ham(40), { ...ani(0, "olgu"), metin: "mavi", anahtar: "renk" }]);
  const plan = sikistirmaPlani(h.dok(), SIMDI);
  const s = h.sikistir(plan, "Konuşmalar özetlendi.", [{ anahtar: "arac", deger: "claude" }]);
  assert.deepEqual(s, { silinen: 10, olgu: 1 });
  const k = h.dok();
  assert.equal(k.filter((a) => a.tur === "konusma").length, 30);
  assert.deepEqual(h.olgular().map((o) => o.anahtar).sort(), ["arac", "renk"]);
  assert.ok(k.some((a) => a.metin === "Summary of earlier chat: Konuşmalar özetlendi."));
});

test("Hafiza.sikistir: olgu anısı listede olsa bile silinmez", () => {
  const h = new Hafiza({ simdi: () => SIMDI });
  h.olguEkle("renk", "mavi");
  const olgu = h.dok()[0]!;
  assert.equal(h.sikistir([olgu], "", []).silinen, 0);
  assert.equal(h.olgular().length, 1);
});

// ── Özet sınırı (canlıdaki ilk sıkıştırma kelime ortasında kesilmişti) ──

test("sınırı aşan özet son tam cümlede kesilir", () => {
  const m = `${"a".repeat(300)}. ${"b".repeat(300)}`;
  assert.equal(sinirdaKes(m, 500), `${"a".repeat(300)}.`);
});

test("cümle sonu yoksa son kelimede kesilir ve … eklenir; kelime bölünmez", () => {
  const m = "Orion is still stuck in the home folder without a git repository and more words";
  assert.equal(sinirdaKes(m, 70), "Orion is still stuck in the home folder without a git repository and…");
});

test("sınır içindeki özet aynen kalır", () => {
  assert.equal(sinirdaKes("kısa özet.", 500), "kısa özet.");
});

// ── Ayarlanabilir otomatik sıkıştırma sınırı (Ozyn, 2026-10-21) ──

test("ayar verilmezse eski sabitler geçerli (davranış DEĞİŞMEZ)", () => {
  assert.deepEqual(OTO_VARSAYILAN, { esik: OTO_ESIK, aralikMs: OTO_ARALIK_MS });
  assert.equal(otoSikistirmaGerekli(ham(OTO_ESIK + 1), 0, SIMDI), otoSikistirmaGerekli(ham(OTO_ESIK + 1), 0, SIMDI, OTO_VARSAYILAN));
});

test("eşik DÜŞÜRÜLÜNCE (70) daha az ham kayıtla tetikler; varsayılan eşikte aynı kayıt tetiklemezdi", () => {
  const aniler = ham(80);
  assert.equal(otoSikistirmaGerekli(aniler, 0, SIMDI), false);
  assert.equal(otoSikistirmaGerekli(aniler, 0, SIMDI, { esik: 70, aralikMs: OTO_ARALIK_MS }), true);
});

test("eşik YÜKSELTİLİNCE (300) varsayılanın tetiklediği kayıt artık tetiklemez", () => {
  assert.equal(otoSikistirmaGerekli(ham(OTO_ESIK + 50), 0, SIMDI), true);
  assert.equal(otoSikistirmaGerekli(ham(OTO_ESIK + 50), 0, SIMDI, { esik: 300, aralikMs: OTO_ARALIK_MS }), false);
});

test("aralık ayarlanabilir: 1 dk aralıkta 2 dk önceki sıkıştırma sonrası tetikler, 15 dk aralıkta tetiklemez", () => {
  const aniler = ham(OTO_ESIK + 1);
  assert.equal(otoSikistirmaGerekli(aniler, SIMDI - 2 * 60_000, SIMDI, { esik: OTO_ESIK, aralikMs: 60_000 }), true);
  assert.equal(otoSikistirmaGerekli(aniler, SIMDI - 2 * 60_000, SIMDI), false);
});

test("izin verilen eşik aralığının ALT ucu anlamlı: KORU + EN_AZ_PLAN'ın altı hiç plan üretemez", () => {
  assert.equal(OTO_ESIK_ARALIGI.en, KORU + EN_AZ_PLAN);
  assert.ok(OTO_ARALIK_DK_ARALIGI.en >= 1);
});

test("alt uçtaki eşikte (55) tam 56 ham kayıt gerçekten tetikler (ayar 'çalışıyor ama hiçbir şey olmuyor' olmasın)", () => {
  assert.equal(otoSikistirmaGerekli(ham(OTO_ESIK_ARALIGI.en + 1), 0, SIMDI, { esik: OTO_ESIK_ARALIGI.en, aralikMs: 60_000 }), true);
});
