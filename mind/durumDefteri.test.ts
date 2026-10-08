// mind/durumDefteri.test.ts — Kalıcı "şu an" bilgisi (spec 16 F2).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { DurumDefteri, KONUM_OTURMA_MS, SOZ_SINIRI } from "./durumDefteri.ts";

const DK = 60_000;
function saatli(baslangic = 1_000_000) {
  let t = baslangic;
  return { simdi: () => t, ilerle: (ms: number) => { t += ms; } };
}
/** Konumu "oturmuş" hâliyle yazar: gözlem, bekleme, gözlem. */
function konumaGel(d: DurumDefteri, s: ReturnType<typeof saatli>, ad: string) {
  d.konumGozlem(ad); s.ilerle(KONUM_OTURMA_MS); d.konumGozlem(ad);
}

test("boş defter hiçbir satır üretmez", () => {
  assert.deepEqual(new DurumDefteri().satirlar(["konum", "son_is", "son_ozyn", "onceki_oturum"]), []);
});

test("yeni yer, orada kalınca konum olur", () => {
  const s = saatli(); const d = new DurumDefteri({ simdi: s.simdi });
  konumaGel(d, s, "beyaz tahta");
  assert.equal(d.oku("konum")?.deger, "beyaz tahta");
});

test("yanından geçilen yer konum olmaz", () => {
  const s = saatli(); const d = new DurumDefteri({ simdi: s.simdi });
  d.konumGozlem("pencere"); s.ilerle(KONUM_OTURMA_MS / 2); d.konumGozlem("çalışma masası");
  assert.equal(d.oku("konum"), undefined);
});

test("konum değişince eskisi önceki konuma kayar", () => {
  const s = saatli(); const d = new DurumDefteri({ simdi: s.simdi });
  konumaGel(d, s, "beyaz tahta");
  konumaGel(d, s, "çalışma masası");
  assert.deepEqual([d.oku("konum")?.deger, d.oku("onceki_konum")?.deger], ["çalışma masası", "beyaz tahta"]);
});

test("konumun zamanı oraya VARIŞ anıdır, oturma süresinin sonu değil", () => {
  const s = saatli(5_000); const d = new DurumDefteri({ simdi: s.simdi });
  konumaGel(d, s, "pencere");
  assert.equal(d.oku("konum")?.t, 5_000);
});

test("aynı yerde kalmak satırı yeniden yazmaz (zamanı korunur)", () => {
  const s = saatli(); const d = new DurumDefteri({ simdi: s.simdi });
  konumaGel(d, s, "pencere");
  const t = d.oku("konum")?.t;
  s.ilerle(10 * DK); d.konumGozlem("pencere");
  assert.equal(d.oku("konum")?.t, t);
});

test("konum satırı yaşıyla yazılır", () => {
  const s = saatli(); const d = new DurumDefteri({ simdi: s.simdi });
  konumaGel(d, s, "çalışma masası"); s.ilerle(4 * DK);
  assert.deepEqual(d.satirlar(["konum"]), ["You are at: çalışma masası (arrived 4 minutes ago)."]);
});

test("iş bitince 'yapıyor' düşer, 'son iş' sonucuyla yazılır", () => {
  const d = new DurumDefteri({ simdi: saatli().simdi });
  d.isBasladi("git → beyaz tahta");
  d.isBitti("git → beyaz tahta", "bitti");
  assert.deepEqual([d.oku("yapiyor"), d.oku("son_is")?.deger], [undefined, "git → beyaz tahta → bitti"]);
});

test("başka bir işin bitişi süren işi düşürmez", () => {
  const d = new DurumDefteri({ simdi: saatli().simdi });
  d.isBasladi("otur");
  d.isBitti("bak → Ozyn", "bitti");
  assert.equal(d.oku("yapiyor")?.deger, "otur");
});

test("uzun söz kesilir", () => {
  const d = new DurumDefteri({ simdi: saatli().simdi });
  d.ozynDedi("a".repeat(500));
  assert.equal(d.oku("son_ozyn")?.deger.length, SOZ_SINIRI);
});

test("istenmeyen anahtar satıra girmez", () => {
  const s = saatli(); const d = new DurumDefteri({ simdi: s.simdi });
  konumaGel(d, s, "pencere"); d.ozynDedi("selam");
  assert.equal(d.satirlar(["son_ozyn"]).length, 1);
});

test("defter diskten geri kurulur", () => {
  const s = saatli(); const d = new DurumDefteri({ simdi: s.simdi });
  konumaGel(d, s, "pencere"); d.ozynDedi("selam");
  const d2 = new DurumDefteri({ simdi: s.simdi, kayitlar: d.kayitlar() });
  assert.deepEqual(d2.kayitlar(), d.kayitlar());
});

test("süren iş oturumdan oturuma taşınmaz", () => {
  const d = new DurumDefteri({ simdi: saatli().simdi });
  d.isBasladi("otur");
  assert.equal(new DurumDefteri({ kayitlar: d.kayitlar() }).oku("yapiyor"), undefined);
});

test("bozuk ve tanınmayan satırlar atlanır", () => {
  const d = new DurumDefteri({ kayitlar: [null, { anahtar: "uydurma", deger: "x", t: 1 }, { anahtar: "konum", deger: 5, t: 1 }, { anahtar: "konum", deger: "pencere", t: 1 }] });
  assert.deepEqual(d.kayitlar(), [{ anahtar: "konum", deger: "pencere", t: 1 }]);
});

test("önceki oturumun bitişi yüklenen en yeni satırdan türer", () => {
  const s = saatli(10 * DK);
  const d = new DurumDefteri({ simdi: s.simdi, kayitlar: [{ anahtar: "konum", deger: "pencere", t: 1 * DK }, { anahtar: "son_ozyn", deger: "selam", t: 4 * DK }] });
  assert.deepEqual(d.satirlar(["onceki_oturum"]), ["Your previous session in this room ended 6 minutes ago."]);
});

test("gelecek zamanlı satır şimdiye çekilir", () => {
  const s = saatli(1_000);
  assert.equal(new DurumDefteri({ simdi: s.simdi, kayitlar: [{ anahtar: "konum", deger: "pencere", t: 9e12 }] }).oku("konum")?.t, 1_000);
});

test("değişiklik dinleyiciye bildirilir, aynı değer bildirilmez", () => {
  let n = 0;
  const d = new DurumDefteri({ simdi: saatli().simdi, degisti: () => { n++; } });
  d.monitor(true); d.monitor(true); d.monitor(false);
  assert.equal(n, 2);
});

test("dinleyici patlasa da defter yazar", () => {
  const d = new DurumDefteri({ simdi: saatli().simdi, degisti: () => { throw new Error("x"); } });
  d.monitor(true);
  assert.equal(d.oku("monitor")?.deger, "open");
});
