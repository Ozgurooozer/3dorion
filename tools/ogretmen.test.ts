// tools/ogretmen.test.ts — Öğretmen gerçek köprüden soruyor mu, ve sayıları doğru mu.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Beyin, BeyinCikti, BeyinGirdisi } from "../bridge/beyin.ts";
import { KUME } from "../mind/refleksKumesi.ts";
import { BAGLAMLAR, SABIT, cogunluk, durumdanAlgi, kalibrasyonOzeti, ogretmenSor, sorulamadi, type KalibrasyonSatiri } from "./ogretmen.ts";

/** Ne döneceğini test belirler, ne gördüğünü test okur. */
class SahteBeyin implements Beyin {
  readonly ad = "sahte";
  gordugu: BeyinGirdisi[] = [];
  private cevap: BeyinCikti | Error;
  constructor(cevap: BeyinCikti | Error) { this.cevap = cevap; }
  async hazirMi() { return true; }
  async dusun(g: BeyinGirdisi): Promise<BeyinCikti> {
    this.gordugu.push(structuredClone(g));
    if (this.cevap instanceof Error) throw this.cevap;
    return this.cevap;
  }
}

test("öğretmen: LLM bir araç çağırırsa eylem", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [{ ad: "dunya_soyle", girdi: { metin: "Derleme bitti." } }] });
  const c = await ogretmenSor(b, { tur: "terminal", kuyruk: "✓ built in 3.88s", kesildi: false }, BAGLAMLAR.masada);
  assert.deepEqual({ gecti: c.gecti, eylem: c.eylem }, { gecti: true, eylem: true });
});

test("öğretmen: LLM hiçbir şey yapmazsa eylem yok", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [] });
  const c = await ogretmenSor(b, { tur: "terminal", kuyruk: "npm WARN deprecated", kesildi: false }, BAGLAMLAR.masada);
  assert.equal(c.eylem, false);
});

test("öğretmen: araçsız temiz metin canlıdaki gibi konuşmaya çevrilir ve eylem sayılır", async (t) => {
  t.mock.method(console, "warn", () => {});
  const b = new SahteBeyin({ metin: "Bir hata var.", cagrilar: [] });
  const c = await ogretmenSor(b, { tur: "terminal", kuyruk: "Error: boom", kesildi: false }, BAGLAMLAR.masada);
  assert.equal(c.eylem, true);
});

test("öğretmen: içerik süzgeci YOK — içgüdü süzse de LLM'e sorulur", async () => {
  // "rutin terminal gürültüsü" içgüdüsü bunu süzerdi; öğretmen yine sorar.
  const b = new SahteBeyin({ metin: "", cagrilar: [] });
  await ogretmenSor(b, { tur: "terminal", kuyruk: "resolving dependencies... 47/312", kesildi: false }, BAGLAMLAR.masada);
  assert.equal(b.gordugu.length, 1);
});

test("öğretmen: beyin canlıdaki dünya satırını ve oda bilgisini görür", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [] });
  await ogretmenSor(b, { tur: "olay", ad: "oyuncu_odaya_girdi" }, BAGLAMLAR.uzakta);
  const g = b.gordugu[0]!;
  assert.deepEqual({ dunya: g.dunya.startsWith(BAGLAMLAR.uzakta), sabit: g.sabit }, { dunya: true, sabit: SABIT });
});

test("öğretmen: dikkatin kanal içgüdüsünün düşürdüğü algı sorulamaz", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [] });
  const c = await ogretmenSor(b, { tur: "sonuc", sonuc: { niyet_id: "n_1", durum: "bitti" } }, BAGLAMLAR.masada);
  assert.deepEqual({ gecti: c.gecti, eylem: c.eylem, kural: c.kapi.kural, soruldu: b.gordugu.length }, { gecti: false, eylem: null, kural: "dikkat.yerel_kanal", soruldu: 0 });
});

test("öğretmen: beyin çökerse karar yok (null), eylemsizlik sayılmaz", async (t) => {
  t.mock.method(console, "error", () => {});
  const c = await ogretmenSor(new SahteBeyin(new Error("404")), { tur: "olay", ad: "monitor_acildi" }, BAGLAMLAR.masada);
  assert.equal(c.eylem, null);
});

test("oda bilgisi canlı çapa etiketlerinden gelir", () => {
  assert.match(SABIT, /^In the room: .*yönetim terminali.*\.$/);
});

test("etiketli kümedeki görüntü dışındaki her durum algıya çevrilir", () => {
  for (const d of KUME) {
    const a = durumdanAlgi(d);
    assert.equal(a === null, d.grup === "goruntu", `${d.grup}: ${d.ozet.slice(0, 40)}`);
  }
});

test("terminal durumunun gövdesi önekten sonrasıdır — eski ve yeni önek", () => {
  const eski = KUME.find((d) => d.ozet.startsWith("Terminal çıktısı:"))!;
  const a = durumdanAlgi(eski);
  assert.equal(a?.tur === "terminal" && a.kuyruk, eski.ozet.slice(eski.ozet.indexOf("\n") + 1));
});

test("olay, konuşma ve sonuç durumları doğru alanlara ayrışır", () => {
  const bul = (s: string) => KUME.find((d) => d.ozet === s)!;
  assert.deepEqual(
    [durumdanAlgi(bul("Olay: monitor_acildi")), durumdanAlgi(bul('Ozyn dedi: "merhaba"')), durumdanAlgi(bul("Niyet n_a1 → hata (çapa bulunamadı: tahtaa)"))],
    [
      { tur: "olay", ad: "monitor_acildi" },
      { tur: "duydum", metin: "merhaba", kesin: true },
      { tur: "sonuc", sonuc: { niyet_id: "n_a1", durum: "hata", not: "çapa bulunamadı: tahtaa" } },
    ],
  );
});

test("çoğunluk: eşitlikte kararsız", () => {
  assert.deepEqual([cogunluk([true, true, false]), cogunluk([false, false, true]), cogunluk([true, false]), cogunluk([])], [true, false, null, null]);
});

test("kalibrasyon özeti: uyuşma, kaçırılan, boşa, oybirliği; konuşma ve sorulamayan sayılmaz", () => {
  const s = (grup: KalibrasyonSatiri["grup"], beklenen: boolean, oylar: (boolean | null)[], niyetTurleri: string[] = []): KalibrasyonSatiri => ({
    sira: 0, grup, beklenen, ozet: "", oylar, cogunluk: cogunluk(oylar.filter((x): x is boolean => x !== null)), niyetTurleri, sureMs: [],
  });
  const o = kalibrasyonOzeti([
    s("terminal", true, [true, true, true]),     // uyuşan, oybirliği
    s("terminal", true, [false, false, true]),   // kaçırılan
    s("olay", false, [true, true, false]),       // boşa
    s("dusman", false, [true, false]),           // kararsız
    s("konusma", true, [true, true, true]),      // sayılmaz
    s("olay", false, [null, null], ["dustu:dikkat.onemsiz", "dustu:dikkat.onemsiz"]),  // sorulamadı
  ]);
  assert.deepEqual(o, { sorulamayan: 1, sorulan: 4, uyusan: 1, kacirilan: 1, bosa: 1, oybirligi: 1, kararsiz: 1 });
});

test("beyin hatasıyla gelen boş oy 'sorulamadı' değildir — kararsız sayılır", () => {
  const s: KalibrasyonSatiri = { sira: 0, grup: "olay", beklenen: true, ozet: "", oylar: [null, null], cogunluk: null, niyetTurleri: ["hata", "hata"], sureMs: [] };
  assert.deepEqual([sorulamadi(s), kalibrasyonOzeti([s]).kararsiz], [false, 1]);
});
