// mind/kararKaydi.test.ts — Karar kaydının biçimi: okunur, sıralı, dürüst kesilmiş.
//
// Köprüye bağlı davranışı (hangi kapı yolu hangi satırı yazar, zincir) ayrı
// dosya sınar: bridge/kopruKarar.test.ts. Burada yalnızca kaydın kendisi var.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { KARAR_ONEKI, KARAR_SURUMU, KararKaydi, SINIR, kisalt, type AlgiSatiri, type KararSatiri, type UyanisBilgisi } from "./kararKaydi.ts";
import type { KapiKarari } from "./kararKaydi.ts";

/** Satırları JSON olarak toplayan kayıt; saat sabit. */
function kaydedici(): { kayit: KararKaydi; ham: string[]; satirlar: () => KararSatiri[] } {
  const ham: string[] = [];
  const kayit = new KararKaydi({ yaz: (s) => ham.push(s), simdi: () => 1_000, oturum: "o_test" });
  return { kayit, ham, satirlar: () => ham.map((s) => JSON.parse(s.slice(KARAR_ONEKI.length + 1)) as KararSatiri) };
}

const GECTI: KapiKarari = { gecti: true, kural: "kopru.konusma" };

const BOS_UYANIS: UyanisBilgisi = {
  algilar: [], geriBesleme: 0, beyin: "sahte", sureMs: 0, koken: "dis", takip: false,
  anilar: 0, dunya: "", cagrilar: [], niyetler: [], reddedilen: 0, kurtarilan: 0,
  konusulanMetin: false, yutulanSoz: 0,
};

test("satır önek, tek boşluk ve JSON'dan oluşur", () => {
  const { kayit, ham } = kaydedici();
  kayit.oturumBasi("sahte");
  assert.ok(ham[0]!.startsWith(`${KARAR_ONEKI} {`), `satır biçimi: ${ham[0]}`);
});

test("oturum satırı biçim sürümünü, oturumu ve beyni taşır", () => {
  const { kayit, satirlar } = kaydedici();
  kayit.oturumBasi("qwen");
  assert.deepEqual(satirlar()[0], { tur: "oturum", surum: KARAR_SURUMU, o: "o_test", t: 1_000, beyin: "qwen" });
});

test("algı kimlikleri oturum içinde sırayla artar", () => {
  const { kayit } = kaydedici();
  const idler = [1, 2, 3].map((i) => kayit.algi({ tur: "duydum", metin: `söz ${i}`, kesin: true }, `söz ${i}`, GECTI));
  assert.deepEqual(idler, ["a1", "a2", "a3"]);
});

test("uyanış kimlikleri algılardan ayrı sayılır", () => {
  const { kayit } = kaydedici();
  kayit.algi({ tur: "duydum", metin: "x", kesin: true }, "x", GECTI);
  assert.deepEqual([kayit.uyanis(BOS_UYANIS), kayit.uyanis(BOS_UYANIS)], ["u1", "u2"]);
});

test("algı satırı kapının kararını ve kuralını olduğu gibi taşır", () => {
  const { kayit, satirlar } = kaydedici();
  const kapi: KapiKarari = { gecti: false, kural: "refleks.terminal.gurultu", gerekce: "rutin terminal gürültüsü" };
  kayit.algi({ tur: "terminal", kuyruk: "ls", kesildi: false }, "ozet", kapi);
  assert.deepEqual((satirlar()[0] as AlgiSatiri).kapi, kapi);
});

test("terminal algısı çıkış kodunu taşır", () => {
  const { kayit, satirlar } = kaydedici();
  kayit.algi({ tur: "terminal", kuyruk: "boom", kesildi: false, kod: 2 }, "ozet", GECTI);
  assert.equal((satirlar()[0] as AlgiSatiri).kod, 2);
});

test("olay algısı olay adını ve kaynağını taşır", () => {
  const { kayit, satirlar } = kaydedici();
  kayit.algi({ tur: "olay", ad: "kendiliginden", ayrinti: { kaynak: "inisiyatif" } }, "ozet", GECTI);
  const s = satirlar()[0] as AlgiSatiri;
  assert.deepEqual({ olay: s.olay, kaynak: s.kaynak }, { olay: "kendiliginden", kaynak: "inisiyatif" });
});

test("sonuç algısı niyet kimliğini ve durumunu taşır — uyanışa geri bağ", () => {
  const { kayit, satirlar } = kaydedici();
  kayit.algi({ tur: "sonuc", sonuc: { niyet_id: "n_1", durum: "hata", not: "reddedildi" } }, "ozet", GECTI);
  const s = satirlar()[0] as AlgiSatiri;
  assert.deepEqual({ niyet: s.niyet, durum: s.durum }, { niyet: "n_1", durum: "hata" });
});

test("kısa özet olduğu gibi kalır ve kesik alanı hiç yazılmaz", () => {
  const { kayit, satirlar } = kaydedici();
  kayit.algi({ tur: "duydum", metin: "kısa", kesin: true }, "kısa", GECTI);
  const s = satirlar()[0] as AlgiSatiri;
  assert.deepEqual({ ozet: s.ozet, kesikVar: "kesik" in s }, { ozet: "kısa", kesikVar: false });
});

test("uzun özet sınırda kesilir, baş ve son korunur, kesik işaretlenir", () => {
  const { kayit, satirlar } = kaydedici();
  const uzun = `BAS${"x".repeat(2_000)}SON`;
  kayit.algi({ tur: "terminal", kuyruk: uzun, kesildi: false }, uzun, GECTI);
  const s = satirlar()[0] as AlgiSatiri;
  assert.deepEqual(
    { uzunluk: s.ozet.length, bas: s.ozet.startsWith("BAS"), son: s.ozet.endsWith("SON"), kesik: s.kesik },
    { uzunluk: SINIR.ozet, bas: true, son: true, kesik: true },
  );
});

test("kisalt: sınırdaki ve altındaki metne dokunmaz, üstündekini tam sınıra indirir", () => {
  // Izgara: sınırın altı, tam sınır, bir fazlası, çok fazlası; küçük ve büyük sınır.
  for (const sinir of [5, 10, 500]) {
    for (const uzunluk of [0, 1, sinir - 1, sinir, sinir + 1, sinir * 7]) {
      const metin = "a".repeat(Math.max(0, uzunluk));
      const k = kisalt(metin, sinir);
      const beklenenUzunluk = Math.min(uzunluk, sinir);
      assert.equal(k.metin.length, beklenenUzunluk, `sınır ${sinir}, uzunluk ${uzunluk}`);
      assert.equal(k.kesik, uzunluk > sinir, `sınır ${sinir}, uzunluk ${uzunluk}: kesik bayrağı`);
    }
  }
});

test("uyanış satırının dünya metni sınırda kesilir", () => {
  const { kayit, satirlar } = kaydedici();
  kayit.uyanis({ ...BOS_UYANIS, dunya: "d".repeat(5_000) });
  const s = satirlar()[0]!;
  assert.equal(s.tur === "uyanis" && s.dunya.length, SINIR.dunya);
});

test("uyanış satırı düz metin yoksa metin alanını hiç yazmaz", () => {
  const { kayit, satirlar } = kaydedici();
  kayit.uyanis(BOS_UYANIS);
  assert.equal("metin" in satirlar()[0]!, false);
});

test("yazıcı patlarsa kayıt fırlatmaz ve kaybı sayar", () => {
  const kayit = new KararKaydi({ yaz: () => { throw new Error("disk dolu"); } });
  kayit.oturumBasi("sahte");
  kayit.algi({ tur: "duydum", metin: "x", kesin: true }, "x", GECTI);
  assert.equal(kayit.yazilamayan, 2);
});

test("varsayılan yazıcı console.log'dur — canlıda host o satırı dosyaya ekler", (t) => {
  const yakalanan: string[] = [];
  t.mock.method(console, "log", (s: string) => { yakalanan.push(s); });
  new KararKaydi({ oturum: "o_konsol" }).oturumBasi("sahte");
  assert.ok(yakalanan.some((s) => s.startsWith(`${KARAR_ONEKI} `) && s.includes("o_konsol")), `konsola düşen: ${yakalanan.join(" | ")}`);
});

test("iki kayıt iki ayrı oturum kimliği alır", () => {
  const a = new KararKaydi({ yaz: () => {} });
  const b = new KararKaydi({ yaz: () => {} });
  assert.notEqual(a.oturum, b.oturum);
});
