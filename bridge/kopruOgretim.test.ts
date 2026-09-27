// bridge/kopruOgretim.test.ts — Öğrenen kapı köprüde: gölge karar, Ozyn'in öğretimi,
// kayıttan yeniden kurulum (toplantı 2026-09-27 K1, K3, K5).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi } from "./beyin.ts";
import type { Algi } from "../protocol/algi.ts";
import { KARAR_ONEKI, KararKaydi, type AlgiSatiri, type KararSatiri, type OgretimSatiri } from "../mind/kararKaydi.ts";
import { KuralRefleksi } from "../mind/refleks.ts";

class SahteBeyin implements Beyin {
  readonly ad = "sahte";
  gordugu: BeyinGirdisi[] = [];
  async hazirMi() { return true; }
  async dusun(g: BeyinGirdisi): Promise<BeyinCikti> { this.gordugu.push(structuredClone(g)); return { metin: "", cagrilar: [] }; }
}

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Canlıdaki gibi: içerik süzgeci kural refleksi, kimliğiyle. Saat ilerler: dikkatin tekrar penceresi karışmasın. */
function kur(ek: { ogretimler?: OgretimSatiri[] } = {}) {
  const satirlar: KararSatiri[] = [];
  let saat = 1_000_000;
  const refleks = new KuralRefleksi();
  const beyin = new SahteBeyin();
  const k = new Kopru({
    beyin,
    niyetGonder: () => {},
    dunyaDurumu: () => "Oda.",
    toplamaMs: 10,
    simdi: () => saat,
    dikkat: { simdi: () => (saat += 10_000) },
    suzgec: (a, ozet) => {
      const r = refleks.karar({ ozet, tur: a.tur, kod: a.tur === "terminal" ? a.kod : undefined });
      return { gecsin: r.terfi, kural: r.kural, gerekce: r.gerekce };
    },
    kararKaydi: new KararKaydi({ yaz: (s) => satirlar.push(JSON.parse(s.slice(KARAR_ONEKI.length + 1))), simdi: () => saat, oturum: "o_test" }),
    ...ek,
  });
  const algilar = () => satirlar.filter((s): s is AlgiSatiri => s.tur === "algi");
  const ogretimler = () => satirlar.filter((s): s is OgretimSatiri => s.tur === "ogretim");
  return { k, beyin, satirlar, algilar, ogretimler };
}

/** Elle verilen `kalk` niyetinin hatası — gerçek kayıttaki (2026-09-27) biçim. */
const elleHata = (n: number): Algi => ({ tur: "sonuc", sonuc: { niyet_id: `elle_x${n}`, durum: "hata", not: "zaten ayaktasın; `kalk` yapacak bir şey yok" } });

test("öğrenilebilir algı durum kodunu taşır; boş hafızada gölge kararı null", () => {
  const { k, algilar } = kur();
  k.algi(elleHata(1));
  const a = algilar()[0]!;
  assert.deepEqual({ isaret: a.isaret?.includes("niyet_kaynagi:elle"), golge: a.golge }, { isaret: true, golge: null });
});

test("güvenlik içgüdüsünün kararı öğrenilemez: konuşma ve yerel kanal algısında durum kodu da gölge de yok", () => {
  const { k, algilar } = kur();
  k.algi({ tur: "duydum", metin: "merhaba", kesin: true });
  k.algi({ tur: "yakin", nesneler: [] });
  assert.deepEqual(algilar().map((a) => ({ isaret: "isaret" in a, golge: "golge" in a })), [{ isaret: false, golge: false }, { isaret: false, golge: false }]);
});

test("ezilemez içgüdünün (dikkat.tekrar) düşürdüğü algı öğrenilemez — kanalı açık, kodu dolu olsa bile", () => {
  // Saat durur: aynı olay tekrar penceresinde ikinci kez gelir.
  const satirlar: KararSatiri[] = [];
  const k = new Kopru({
    beyin: new SahteBeyin(), niyetGonder: () => {}, dunyaDurumu: () => "Oda.", toplamaMs: 10,
    dikkat: { simdi: () => 5_000_000 },
    kararKaydi: new KararKaydi({ yaz: (s) => satirlar.push(JSON.parse(s.slice(KARAR_ONEKI.length + 1))) }),
  });
  k.algi({ tur: "olay", ad: "ozyn_yaklasti", ayrinti: { mesafe: 1 } });
  k.algi({ tur: "olay", ad: "ozyn_yaklasti", ayrinti: { mesafe: 1 } });
  const ikinci = satirlar.filter((s): s is AlgiSatiri => s.tur === "algi")[1]!;
  assert.deepEqual({ kural: ikinci.kapi.kural, isaret: "isaret" in ikinci, golge: "golge" in ikinci }, { kural: "dikkat.tekrar", isaret: false, golge: false });
});

test("TEK DENEME: Ozyn bir kez öğretince aynı türden sonraki algının gölge kararı öğretilen yöndür", () => {
  const { k, algilar } = kur();
  k.algi(elleHata(1));
  k.ogret(algilar()[0]!.id, "sus");
  k.algi(elleHata(2));
  assert.deepEqual(algilar()[1]!.golge, { yon: "sus", noron: "K1", pay: 1 });
});

test("gölge karar kapıyı değiştirmez: öğretimden sonra da içgüdü geçirir ve beyin uyanır", async () => {
  const { k, beyin, algilar } = kur();
  k.algi(elleHata(1));
  k.ogret(algilar()[0]!.id, "sus");
  await bekle(40);
  const onceki = beyin.gordugu.length;
  k.algi(elleHata(2));
  await bekle(40);
  assert.deepEqual({ gecti: algilar()[1]!.kapi.gecti, yeniUyanis: beyin.gordugu.length - onceki }, { gecti: true, yeniUyanis: 1 });
});

test("öğretim kayda yazılır: hedef algı ve onun durum kodu", () => {
  const { k, algilar, ogretimler } = kur();
  k.algi(elleHata(1));
  const a = algilar()[0]!;
  k.ogret(a.id, "sus");
  const o = ogretimler()[0]!;
  assert.deepEqual({ hedef: o.hedef, yon: o.yon, kaynak: o.kaynak, isaret: o.isaret }, { hedef: { o: "o_test", id: a.id }, yon: "sus", kaynak: "ozyn", isaret: a.isaret });
});

test("öğrenilemez algıya öğretim reddedilir ve kayda bir şey yazılmaz", () => {
  const { k, algilar, ogretimler } = kur();
  k.algi({ tur: "duydum", metin: "merhaba", kesin: true });
  assert.deepEqual({ sonuc: k.ogret(algilar()[0]!.id, "sus"), ogretim: ogretimler().length }, { sonuc: null, ogretim: 0 });
});

test("bilinmeyen algı kimliğine öğretim reddedilir", () => {
  const { k } = kur();
  assert.equal(k.ogret("a999", "uyan"), null);
});

test("dışarıdan gelen öğretim hafızaya uygulanır ama kayda yeniden yazılmaz", () => {
  const { k, algilar, ogretimler } = kur();
  k.algi(elleHata(1));
  const isaret = algilar()[0]!.isaret!;
  k.ogretimUygula({ tur: "ogretim", o: "ogret-araci", t: 1, hedef: { o: "o_eski", id: "a7" }, yon: "sus", kaynak: "ozyn", isaret });
  k.algi(elleHata(2));
  assert.deepEqual({ golge: algilar()[1]!.golge?.yon, yeniOgretim: ogretimler().length }, { golge: "sus", yeniOgretim: 0 });
});

test("K5: kayıttan yeniden kurulan hafıza aynı gölge kararı verir", () => {
  // Birinci oturum: öğretim.
  const bir = kur();
  bir.k.algi(elleHata(1));
  bir.k.ogret(bir.algilar()[0]!.id, "sus");
  bir.k.algi(elleHata(2));
  const canli = bir.algilar()[1]!.golge;
  // İkinci oturum: hafıza yalnız kayıttaki öğretim satırlarından kurulur.
  const iki = kur({ ogretimler: bir.ogretimler() });
  iki.k.algi(elleHata(3));
  assert.deepEqual(iki.algilar()[0]!.golge, canli);
});

test("aynı öğretim satırı iki yoldan gelirse (açılış + izleyici) bir kez uygulanır", () => {
  const bir = kur();
  bir.k.algi(elleHata(1));
  bir.k.ogret(bir.algilar()[0]!.id, "sus");
  const satir = bir.ogretimler()[0]!;
  const iki = kur({ ogretimler: [satir] });
  const ikinciKez = iki.k.ogretimUygula(satir);
  assert.deepEqual({ ikinciKez, sayac: iki.k.kuralHafizasi.noronlar[0]!.sayac }, { ikinciKez: false, sayac: { uyan: 0, sus: 1 } });
});

test("aynı algının FARKLI zamanda yeniden öğretimi ayrı bir derstir", () => {
  const { k, algilar } = kur();
  k.algi(elleHata(1));
  const id = algilar()[0]!.id;
  k.ogret(id, "sus");
  k.ogretimUygula({ tur: "ogretim", o: "ogret-araci", t: 99, hedef: { o: "o_test", id }, yon: "sus", kaynak: "ozyn", isaret: algilar()[0]!.isaret! });
  assert.deepEqual(k.kuralHafizasi.noronlar[0]!.sayac, { uyan: 0, sus: 2 });
});

test("LLM'in kendi niyetinin hatası, elle niyetinkinden öğrenilen kurala takılmaz — istisna değil, ayrı durum", () => {
  const { k, algilar } = kur();
  k.algi(elleHata(1));
  k.ogret(algilar()[0]!.id, "sus");
  k.algi({ tur: "sonuc", sonuc: { niyet_id: "n_abc", durum: "hata", not: "çapa bulunamadı: tahtaa" } });
  assert.equal(algilar()[1]!.golge, null);
});
