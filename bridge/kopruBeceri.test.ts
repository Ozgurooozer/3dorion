// bridge/kopruBeceri.test.ts — Beceri refleksi köprüde, GÖLGEDE (spec 10, Faz C): kesin
// sözde beceri hafızasının ne yapacağı söz satırına yazılır (`beceriGolge`); kapı,
// uyanış ve niyetler değişmez. Hafıza geçmiş oturumların satırlarından ve köprünün
// kendi kaydından kurulur (defter ilkesi).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { AracCagrisi, Beyin, BeyinCikti, BeyinGirdisi } from "./beyin.ts";
import type { Niyet } from "../protocol/niyet.ts";
import { KARAR_ONEKI, KararKaydi, niyetKaydi, type AlgiSatiri, type KararSatiri } from "../mind/kararKaydi.ts";
import { kayitOku, zincirKur } from "../mind/kararZinciri.ts";
import { gorevler } from "../mind/gorev.ts";
import { beceriHafizasiKur } from "../mind/beceriHafizasi.ts";
import { KuralRefleksi, refleksGirdisi } from "../mind/refleks.ts";

/** Sahte beyin: her uyanışta sıradaki cevabı verir; cevap kalmadıysa susar. */
class SahteBeyin implements Beyin {
  readonly ad = "sahte";
  gordugu: BeyinGirdisi[] = [];
  cevaplar: BeyinCikti[];
  constructor(...cevaplar: BeyinCikti[]) { this.cevaplar = cevaplar; }
  async hazirMi() { return true; }
  async dusun(g: BeyinGirdisi): Promise<BeyinCikti> {
    this.gordugu.push(structuredClone(g));
    return this.cevaplar.shift() ?? { metin: "", cagrilar: [] };
  }
}

const cagri = (ad: string, girdi: unknown): AracCagrisi => ({ ad, girdi });
const gitCagrisi = (ad: string): BeyinCikti => ({ metin: "", cagrilar: [cagri("dunya_git", { hedef: { tip: "capa", ad } })] });
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Kaydı JSONL metni olarak toplanan köprü; dünya gönderilen her niyete hemen `bitti` der.
 * Süzgeç canlıdaki kural refleksi: rutin başarı LLM'i uyandırmaz (sıradaki cevabı tüketmesin).
 */
function kur(beyin: Beyin, ek: { gorevSatirlari?: readonly KararSatiri[]; oturum?: string } = {}) {
  let saat = 1_000_000;
  const metin: string[] = [];
  const niyetler: { n: Niyet; id: string }[] = [];
  const refleks = new KuralRefleksi();
  let k: Kopru;
  k = new Kopru({
    beyin,
    niyetGonder: (n, id) => { niyetler.push({ n, id }); queueMicrotask(() => k.sonuc({ niyet_id: id, durum: "bitti" })); },
    dunyaDurumu: () => "Oda.",
    toplamaMs: 10,
    simdi: () => saat,
    dikkat: { simdi: () => (saat += 10_000) },
    suzgec: (a, ozet) => {
      const r = refleks.karar(refleksGirdisi(a, ozet));
      return { gecsin: r.terfi, kural: r.kural, gerekce: r.gerekce };
    },
    kararKaydi: new KararKaydi({ yaz: (s) => metin.push(s.slice(KARAR_ONEKI.length + 1)), simdi: () => (saat += 1), oturum: ek.oturum ?? "o_test" }),
    ...(ek.gorevSatirlari ? { gorevSatirlari: ek.gorevSatirlari } : {}),
  });
  const satirlar = () => kayitOku(metin.join("\n")).satirlar;
  const sozler = () => satirlar().filter((s): s is AlgiSatiri => s.tur === "algi" && s.algi === "duydum");
  const soyle = async (soz: string, kesin = true) => { k.algi({ tur: "duydum", metin: soz, kesin }); await bekle(80); };
  return { k, niyetler, satirlar, sozler, soyle };
}

const git = (ad: string): Niyet => ({ tur: "git", hedef: { tip: "capa", ad } });

test("ilk kesin söz: hafıza boş, gölge null", async () => {
  const { sozler, soyle } = kur(new SahteBeyin(gitCagrisi("pencere")));
  await soyle("pencereye git");
  assert.equal(sozler()[0]?.beceriGolge, null);
});

test("görev bitince aynı çerçeveli ikinci sözün satırında gölge: adımlar yeni çapayla", async () => {
  const { k, sozler, soyle } = kur(new SahteBeyin(gitCagrisi("pencere"), gitCagrisi("sandalye")));
  await soyle("pencereye git");
  await soyle("sandalyeye git");
  const id = k.beceriHafizasi.beceriler[0]?.id;
  assert.deepEqual(sozler()[1]?.beceriGolge, { beceri: id, pay: 1, adimlar: [git("sandalye")] });
});

test("kesin olmayan sözde (ara tanıma) gölge alanı yok", async () => {
  const { sozler, soyle } = kur(new SahteBeyin());
  await soyle("pencereye", false);
  assert.equal("beceriGolge" in sozler()[0]!, false);
});

test("geçmiş oturumun satırlarıyla açılan köprü ilk sözde eşleşir", async () => {
  const onceki = kur(new SahteBeyin(gitCagrisi("pencere")), { oturum: "o_onceki" });
  await onceki.soyle("pencereye git");
  const { sozler, soyle } = kur(new SahteBeyin(), { gorevSatirlari: onceki.satirlar() });
  await soyle("sandalyeye git");
  assert.deepEqual(sozler()[0]?.beceriGolge?.adimlar, [git("sandalye")]);
});

test("GÖLGE DAVRANIŞI DEĞİŞTİRMEZ (B10): eşleşen becerili ve becerisiz köprü aynı niyetleri gönderir, aynı sayıda uyanır", async () => {
  const onceki = kur(new SahteBeyin(gitCagrisi("pencere")), { oturum: "o_onceki" });
  await onceki.soyle("pencereye git");
  const kos = async (gorevSatirlari: readonly KararSatiri[]) => {
    const beyin = new SahteBeyin(gitCagrisi("sandalye"), gitCagrisi("masa"));
    const { niyetler, soyle } = kur(beyin, { gorevSatirlari });
    await soyle("sandalyeye git");
    await soyle("masaya git");
    return { niyetler: niyetler.map((x) => x.n), uyanis: beyin.gordugu.length };
  };
  assert.deepEqual(JSON.stringify(await kos(onceki.satirlar())), JSON.stringify(await kos([])));
});

test("canlı = kayıt (B11): köprünün canlı hafızası, yazdığı satırlardan kurulan hafızaya eşit", async () => {
  const { k, satirlar, soyle } = kur(new SahteBeyin(gitCagrisi("pencere"), gitCagrisi("sandalye"), gitCagrisi("masa")));
  await soyle("pencereye git");
  await soyle("sandalyeye git");
  await soyle("masaya git");
  const kayittan = beceriHafizasiKur(gorevler(zincirKur(satirlar())));
  assert.equal(JSON.stringify(k.beceriHafizasi.beceriler), JSON.stringify(kayittan.beceriler));
});

test("bozuk geçmiş satırı köprüyü durdurmaz: geçmişsiz başlar, bu oturumdan öğrenir", async () => {
  const bozuk = [{ tur: "uyanis", o: "o_x", id: "u1", t: 1 }] as unknown as KararSatiri[];
  const { sozler, soyle } = kur(new SahteBeyin(gitCagrisi("pencere"), gitCagrisi("sandalye")), { gorevSatirlari: bozuk });
  await soyle("pencereye git");
  await soyle("sandalyeye git");
  assert.deepEqual(sozler()[1]?.beceriGolge?.adimlar, [git("sandalye")]);
});

test("durdurulan köprü kayıttan öğrenmeyi bırakır: aynı kayda sonradan yazılan görev hafızaya girmez", () => {
  const kayit = new KararKaydi({ yaz: () => {}, oturum: "o_ortak" });
  const k = new Kopru({ beyin: new SahteBeyin(), niyetGonder: () => {}, dunyaDurumu: () => "Oda.", kararKaydi: kayit });
  k.durdur();
  const a = kayit.algi({ tur: "duydum", metin: "pencereye git", kesin: true }, "ozet", { gecti: true, kural: "kopru.konusma" });
  kayit.uyanis({ algilar: [a], geriBesleme: 0, beyin: "sahte", sureMs: 5, koken: "dis", takip: false, anilar: 0, dunya: "", cagrilar: [], niyetler: [niyetKaydi("n_1", git("pencere"))], reddedilen: 0, kurtarilan: 0, konusulanMetin: false, yutulanSoz: 0 });
  kayit.algi({ tur: "sonuc", sonuc: { niyet_id: "n_1", durum: "bitti" } }, "ozet", { gecti: false, kural: "refleks.sonuc.rutin" });
  assert.equal(k.beceriHafizasi.beceriler.length, 0);
});
