// mind/kararZinciri.test.ts — Kayıttan zincir: kimlikle bağ, oturum sınırı,
// son kesin durum, Ozyn'in tepkisi. Satırlar gerçek `KararKaydi`dan üretilir:
// okuyucu yazıcının biçimiyle kayarsa bu testler düşer.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { KARAR_ONEKI, KararKaydi, niyetKaydi, type KapiKarari, type UyanisBilgisi } from "./kararKaydi.ts";
import { TEPKI_PENCERESI_MS, kayitOku, uyanisEyleme, zincirKur } from "./kararZinciri.ts";

const GECTI: KapiKarari = { gecti: true, kural: "kopru.konusma" };
const UYANIS: UyanisBilgisi = {
  algilar: [], geriBesleme: 0, beyin: "sahte", sureMs: 5, koken: "dis", takip: false,
  anilar: 0, dunya: "oda", cagrilar: [], niyetler: [], reddedilen: 0, kurtarilan: 0,
  konusulanMetin: false, yutulanSoz: 0,
};

/** Gerçek kayıt + elle ilerleyen saat; JSONL metnini verir. */
function kayitci(oturum: string) {
  let t = 0;
  const satirlar: string[] = [];
  const kayit = new KararKaydi({ oturum, simdi: () => t, yaz: (s) => satirlar.push(s.slice(KARAR_ONEKI.length + 1)) });
  kayit.oturumBasi("sahte");
  return {
    kayit,
    saat: (yeni: number) => { t = yeni; },
    metin: () => satirlar.join("\n"),
  };
}

test("kayitOku boş satırları atlar, bozuk ve tanınmayan satırları sayar", () => {
  const { satirlar, bozuk } = kayitOku(['{"tur":"oturum","o":"x","surum":1,"t":0,"beyin":"b"}', "", "{bozuk", '{"tur":"baska","o":"x"}', "  "].join("\n"));
  assert.deepEqual({ satir: satirlar.length, bozuk }, { satir: 1, bozuk: 2 });
});

test("kayitOku Windows satır sonlarını da okur", () => {
  const { satirlar } = kayitOku('{"tur":"oturum","o":"x","surum":1,"t":0,"beyin":"b"}\r\n{"tur":"oturum","o":"y","surum":1,"t":0,"beyin":"b"}\r\n');
  assert.equal(satirlar.length, 2);
});

test("uyanış onu tetikleyen algılara kimlikle bağlanır", () => {
  const k = kayitci("o1");
  const a1 = k.kayit.algi({ tur: "olay", ad: "oyuncu_odaya_girdi" }, "Event: oyuncu_odaya_girdi", GECTI);
  k.kayit.algi({ tur: "olay", ad: "kamera_degisti" }, "Event: kamera_degisti", { gecti: false, kural: "dikkat.onemsiz" });
  k.kayit.uyanis({ ...UYANIS, algilar: [a1] });
  const z = zincirKur(kayitOku(k.metin()).satirlar);
  assert.deepEqual(z.uyanislar[0]!.tetikleyenler.map((a) => a.olay), ["oyuncu_odaya_girdi"]);
});

test("aynı kimlik iki oturumda iki ayrı algıdır — bağ oturumu aşmaz", () => {
  const a = kayitci("oA");
  a.kayit.algi({ tur: "olay", ad: "birinci" }, "Event: birinci", GECTI);
  const b = kayitci("oB");
  const id = b.kayit.algi({ tur: "olay", ad: "ikinci" }, "Event: ikinci", GECTI);
  b.kayit.uyanis({ ...UYANIS, algilar: [id] });
  const z = zincirKur(kayitOku(`${a.metin()}\n${b.metin()}`).satirlar);
  assert.deepEqual({ id, olay: z.uyanislar[0]!.tetikleyenler.map((x) => x.olay) }, { id: "a1", olay: ["ikinci"] });
});

test("niyetin akıbeti son kesin durumdur; 'basladi' sayılmaz", () => {
  const k = kayitci("o1");
  k.kayit.uyanis({ ...UYANIS, niyetler: [{ id: "n_1", tur: "git" }] });
  k.kayit.algi({ tur: "sonuc", sonuc: { niyet_id: "n_1", durum: "basladi" } }, "Intent n_1 → basladi", { gecti: false, kural: "refleks.sonuc.rutin" });
  k.kayit.algi({ tur: "sonuc", sonuc: { niyet_id: "n_1", durum: "hata", not: "çapa yok" } }, "Intent n_1 → hata (çapa yok)", { gecti: true, kural: "refleks.sonuc.hata" });
  const z = zincirKur(kayitOku(k.metin()).satirlar);
  assert.deepEqual(z.uyanislar[0]!.niyetler[0], { id: "n_1", tur: "git", durum: "hata", not: "Intent n_1 → hata (çapa yok)" });
});

test("sonucu hiç gelmeyen niyetin durumu yoktur", () => {
  const k = kayitci("o1");
  k.kayit.uyanis({ ...UYANIS, niyetler: [{ id: "n_9", tur: "soyle" }] });
  const z = zincirKur(kayitOku(k.metin()).satirlar);
  assert.deepEqual(z.uyanislar[0]!.niyetler[0], { id: "n_9", tur: "soyle" });
});

test("uyanıştan sonra pencere içinde gelen ilk söz tepkidir", () => {
  const k = kayitci("o1");
  k.saat(1_000); k.kayit.uyanis({ ...UYANIS, niyetler: [{ id: "n_1", tur: "soyle" }] });
  k.saat(4_000); k.kayit.algi({ tur: "duydum", metin: "teşekkürler", kesin: true }, 'Ozyn said: "teşekkürler"', GECTI);
  k.saat(9_000); k.kayit.algi({ tur: "duydum", metin: "ikinci", kesin: true }, 'Ozyn said: "ikinci"', GECTI);
  const z = zincirKur(kayitOku(k.metin()).satirlar);
  assert.deepEqual({ gecikme: z.uyanislar[0]!.tepki?.gecikmeMs, ozet: z.uyanislar[0]!.tepki?.algi.ozet }, { gecikme: 3_000, ozet: 'Ozyn said: "teşekkürler"' });
});

test("pencere dışındaki söz tepki sayılmaz", () => {
  const k = kayitci("o1");
  k.saat(1_000); k.kayit.uyanis(UYANIS);
  k.saat(1_000 + TEPKI_PENCERESI_MS + 1); k.kayit.algi({ tur: "duydum", metin: "geç", kesin: true }, 'Ozyn said: "geç"', GECTI);
  const z = zincirKur(kayitOku(k.metin()).satirlar);
  assert.equal(z.uyanislar[0]!.tepki, undefined);
});

test("uyanıştan ÖNCEKİ söz tepki sayılmaz", () => {
  const k = kayitci("o1");
  k.saat(500); k.kayit.algi({ tur: "duydum", metin: "önce", kesin: true }, 'Ozyn said: "önce"', GECTI);
  k.saat(1_000); k.kayit.uyanis(UYANIS);
  const z = zincirKur(kayitOku(k.metin()).satirlar);
  assert.equal(z.uyanislar[0]!.tepki, undefined);
});

test("oturumlar sırayla ve tekil listelenir", () => {
  const a = kayitci("oA");
  const b = kayitci("oB");
  const z = zincirKur(kayitOku(`${a.metin()}\n${b.metin()}\n${a.metin()}`).satirlar);
  assert.deepEqual(z.oturumlar, ["oA", "oB"]);
});

test("uyanış niyet ürettiyse ya da metni konuşulduysa eylemdir, değilse boşa uyanıştır", () => {
  const u = (ek: Partial<UyanisBilgisi>) => ({ tur: "uyanis" as const, o: "o", id: "u1", t: 0, ...UYANIS, ...ek });
  assert.deepEqual(
    [uyanisEyleme(u({})), uyanisEyleme(u({ niyetler: [{ id: "n", tur: "bak" }] })), uyanisEyleme(u({ konusulanMetin: true }))],
    [false, true, true],
  );
});

// ── Niyet gövdesi zincirde (spec 10, Faz A) ────────────────────────────────

test("niyet akıbeti niyetin gövdesini taşır", () => {
  const k = kayitci("o1");
  k.kayit.uyanis({ ...UYANIS, niyetler: [niyetKaydi("n_1", { tur: "git", hedef: { tip: "capa", ad: "masa" } })] });
  k.kayit.algi({ tur: "sonuc", sonuc: { niyet_id: "n_1", durum: "bitti" } }, "Intent n_1 → bitti", { gecti: false, kural: "refleks.sonuc.rutin" });
  const z = zincirKur(kayitOku(k.metin()).satirlar);
  assert.deepEqual(z.uyanislar[0]!.niyetler[0]?.govde, { tur: "git", hedef: { tip: "capa", ad: "masa" } });
});

test("gövdesiz eski uyanış satırı da okunur; akıbette gövde alanı hiç yok", () => {
  const k = kayitci("o1");
  k.kayit.uyanis({ ...UYANIS, niyetler: [{ id: "n_1", tur: "git" }] });
  const z = zincirKur(kayitOku(k.metin()).satirlar);
  assert.deepEqual(z.uyanislar[0]!.niyetler[0], { id: "n_1", tur: "git" });
});

// ── Refleks (spec 10, Faz D) ────────────────────────────────────────────────

test("kayitOku refleks satırını tanır (bozuk saymaz)", () => {
  const { satirlar, bozuk } = kayitOku('{"tur":"refleks","o":"x","id":"r1","t":1,"algi":"a1","beceri":"B1","niyetler":[],"bitis":"basari","sureMs":1}');
  assert.deepEqual({ satir: satirlar.length, bozuk }, { satir: 1, bozuk: 0 });
});

test("refleks tetikleyen söze ve adımlarının sonuçlarına kimlikle bağlanır", () => {
  const k = kayitci("o1");
  k.saat(1_000);
  const a = k.kayit.algi({ tur: "duydum", metin: "sandalyeye git", kesin: true }, "ozet", GECTI);
  const adim = niyetKaydi("refleks_2", { tur: "git", hedef: { tip: "capa", ad: "sandalye" } });
  k.kayit.algi({ tur: "sonuc", sonuc: { niyet_id: "refleks_2", durum: "bitti" } }, "ozet", { gecti: false, kural: "kopru.refleks" });
  k.kayit.refleks({ algi: a, beceri: "B1", niyetler: [adim], bitis: "basari", sureMs: 3000 });
  const [r] = zincirKur(kayitOku(k.metin()).satirlar).refleksler;
  assert.deepEqual(
    { soz: r?.soz?.soz?.metin, niyetler: r?.niyetler.map((n) => ({ id: n.id, durum: n.durum, govde: n.govde })) },
    { soz: "sandalyeye git", niyetler: [{ id: "refleks_2", durum: "bitti", govde: adim.govde }] },
  );
});

test("tanınmayan satır türü öğretim sayılmaz (zincire dışarıdan gelen satır)", () => {
  const z = zincirKur([{ tur: "baska", o: "x", t: 1 } as unknown as Parameters<typeof zincirKur>[0][number]]);
  assert.equal(z.ogretimler.length, 0);
});
