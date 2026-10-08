// bridge/kopruBaglam.test.ts — Yönlendirici kipinde modele NE gider (spec 16 F5).
//
// Yönlendirici tek başına mind/hafizaYonlendirici.test.ts'te; burada köprünün isteği bağlama doğru
// çevirdiği: sorulmayan girmez, sorulan durum satırı ŞİMDİ'de yaşıyla, eski konuşma çekmeceden,
// yakın pencere küçük. "otomatik" kip (eski davranış) bridge/kopru.test.ts'te değişmeden geçiyor.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi } from "./beyin.ts";
import { KARAR_ONEKI, KararKaydi, type KararSatiri, type UyanisSatiri } from "../mind/kararKaydi.ts";

class SahteBeyin implements Beyin {
  readonly ad = "sahte";
  gordugu: BeyinGirdisi[] = [];
  async hazirMi() { return true; }
  async dusun(g: BeyinGirdisi): Promise<BeyinCikti> { this.gordugu.push(structuredClone(g)); return { metin: "", cagrilar: [] }; }
}
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

function kur(ek: Record<string, unknown> = {}) {
  let t = 1_000_000;
  const saat = { simdi: () => t, ilerle: (ms: number) => { t += ms; } };
  const satirlar: KararSatiri[] = [];
  const b = new SahteBeyin();
  const k = new Kopru({ komutYetkisi: false, beyin: b, niyetGonder: () => {}, dunyaDurumu: () => "You: duruyor.",
    toplamaMs: 5, simdi: saat.simdi, hafizaKipi: "yonlendirici", yerAdlari: () => ["beyaz tahta", "pencere"],
    kararKaydi: new KararKaydi({ yaz: (s) => satirlar.push(JSON.parse(s.slice(KARAR_ONEKI.length + 1))), simdi: saat.simdi }),
    ...ek });
  const soyle = async (metin: string) => { k.algi({ tur: "duydum", metin, kesin: true }); await bekle(25); return b.gordugu.at(-1)!; };
  const uyanislar = () => satirlar.filter((s): s is UyanisSatiri => s.tur === "uyanis");
  return { k, b, saat, soyle, uyanislar };
}

test("sorulmayan söz: modele anı gitmez", async () => {
  const { k, soyle } = kur();
  k.hafiza.ekle("tahta temizlendi", "konusma", 8);
  assert.deepEqual((await soyle("tahta nasıl")).anilar, []);
});

test("sorulmayan söz: dünya satırına durum defteri girmez", async () => {
  const { k, soyle, saat } = kur();
  k.durum.konumGozlem("pencere"); saat.ilerle(3000); k.durum.konumGozlem("pencere");
  assert.equal((await soyle("merhaba")).dunya, "You: duruyor.");
});

test("'neredesin': konum satırı ŞİMDİ'de yaşıyla gelir", async () => {
  const { k, soyle, saat } = kur();
  k.durum.konumGozlem("pencere"); saat.ilerle(3000); k.durum.konumGozlem("pencere");
  assert.match((await soyle("neredesin")).dunya, /\nYou are at: pencere \(arrived just now\)\./);
});

test("'ne konuşmuştuk': pencerenin DIŞINDA kalan sözler çekmeceden gelir, ortak kelime olmasa da", async () => {
  const { soyle } = kur({ yakinPencere: { kayit: 2, yasMs: 60_000 } });
  await soyle("kahve içtim");
  await soyle("terminal süzgeci üzerinde çalışıyorum");
  await soyle("hava güzel");
  const g = await soyle("ne konuşmuştuk");
  assert.deepEqual(g.anilar?.map((a) => a.replace(/^\[[^\]]+\] /, "")), ["terminal süzgeci üzerinde çalışıyorum", "kahve içtim"]);
});

test("'ne konuşmuştuk': pencerede zaten görünen söz çekmeceden tekrar gelmez", async () => {
  const { soyle } = kur({ yakinPencere: { kayit: 2, yasMs: 60_000 } });
  await soyle("kahve içtim");
  await soyle("hava güzel");
  const g = await soyle("ne konuşmuştuk");
  assert.equal(g.anilar?.some((a) => a.endsWith("hava güzel")), false);
});

test("başarısız niyet: ders çekmecesinden ilgili ders gelir", async () => {
  const { k, b } = kur();
  k.hafiza.ekle("hata: tahtaya oturulmaz", "sonuc", 6);
  // Bu turun hatası başka; dersle ortak kelimesi var ("tahtaya"). Aynı metin olsaydı bu turun
  // içeriği sayılır ve dışarıda kalırdı (kendini tekrar etmek hatırlamak değildir).
  k.sonuc({ niyet_id: "n_x", durum: "hata", not: "tahtaya yürüyemedim" });
  await bekle(25);
  assert.ok(b.gordugu.at(-1)?.anilar?.some((a) => a.endsWith("hata: tahtaya oturulmaz")));
});

test("yakın pencere: modele yalnız son N kayıt gider", async () => {
  const { soyle } = kur({ yakinPencere: { kayit: 2, yasMs: 60_000 } });
  await soyle("bir"); await soyle("iki");
  const g = await soyle("üç");
  assert.deepEqual(g.gecmis.map((x) => x.metin), ["iki", "üç"]);
});

test("yakın pencere: yaş sınırını aşan kayıt gitmez", async () => {
  const { soyle, saat } = kur({ yakinPencere: { kayit: 4, yasMs: 60_000 } });
  await soyle("eski söz");
  saat.ilerle(120_000);
  const g = await soyle("yeni söz");
  assert.deepEqual(g.gecmis.map((x) => x.metin), ["yeni söz"]);
});

test("karar kaydı yönlendiricinin kurallarını taşır", async () => {
  const { soyle, uyanislar } = kur();
  await soyle("neredeydin");
  assert.deepEqual(uyanislar().at(-1)?.hafizaIstegi, ["konum.once"]);
});

test("karar kaydı: hiçbir şey istenmeyen uyanışta istek boş", async () => {
  const { soyle, uyanislar } = kur();
  await soyle("naber");
  assert.deepEqual(uyanislar().at(-1)?.hafizaIstegi, []);
});

test("çıkarılan araç modele sunulmaz (spec 16 F6)", async () => {
  const { soyle } = kur({ cikarilanAraclar: ["dunya_al", "dunya_birak"] });
  const g = await soyle("merhaba");
  assert.equal(g.araclar.some((a) => a.ad === "dunya_al" || a.ad === "dunya_birak"), false);
});

test("çıkarılan araç verilmezse bütün araçlar sunulur", async () => {
  const { soyle } = kur();
  assert.ok((await soyle("merhaba")).araclar.some((a) => a.ad === "dunya_al"));
});
