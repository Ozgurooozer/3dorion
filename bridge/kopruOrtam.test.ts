// bridge/kopruOrtam.test.ts — Köprü + öğrenen ortam sözlüğü: LLM bir kez doğru yapınca söz kaydedilir, sonra LLM uyanmaz.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi } from "./beyin.ts";
import type { Niyet } from "../protocol/niyet.ts";
import { OrtamSozlugu, type OgrenilenKayit, type OrtamNiyeti } from "../mind/ortamSozlugu.ts";
import { KARAR_ONEKI, KararKaydi, type KararSatiri } from "../mind/kararKaydi.ts";

type Cagri = { ad: string; girdi: Record<string, unknown> };

class SenaryoBeyin implements Beyin {
  readonly ad = "sahte";
  gordugu: BeyinGirdisi[] = [];
  cikti: () => BeyinCikti;
  /** İlk çağrının gecikmesi (ms): turun sürerken gelen sözler tamponda birikir. */
  ilkGecikmeMs = 0;
  constructor(cikti: () => BeyinCikti) { this.cikti = cikti; }
  async hazirMi() { return true; }
  async dusun(g: BeyinGirdisi): Promise<BeyinCikti> {
    const ilk = this.gordugu.length === 0;
    this.gordugu.push(structuredClone(g));
    if (ilk && this.ilkGecikmeMs) await bekle(this.ilkGecikmeMs);
    return this.cikti();
  }
}

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ortamCagrisi = (girdi: Record<string, unknown>): Cagri => ({ ad: "dunya_ortam", girdi });

/** `sonuc`: tüm ortam niyetlerine verilen sonuç ya da i. ortam niyeti için bir işlev. */
type SonucKurali = "bitti" | "hata" | "yok" | ((i: number) => "bitti" | "hata" | "yok");

function kur(cikti: () => BeyinCikti, ek: Record<string, unknown> = {}, sonuc: SonucKurali = "bitti") {
  const beyin = new SenaryoBeyin(cikti);
  const ogrenilen: { soz: string; komutlar: OrtamNiyeti[] }[] = [];
  const niyetler: { n: Niyet; id: string }[] = [];
  let ortamSayisi = 0;
  let k!: Kopru;
  k = new Kopru({
    beyin, dunyaDurumu: () => "Oda.", toplamaMs: 20, simdi: () => 1_000, hafizaGetirme: 0,
    ortamKullanilabilir: () => true,
    ortamOgren: (soz, komutlar) => { ogrenilen.push({ soz, komutlar: [...komutlar] }); },
    niyetGonder: (n, id) => {
      niyetler.push({ n, id });
      if (n.tur !== "ortam") return;
      const durum = typeof sonuc === "function" ? sonuc(ortamSayisi++) : sonuc;
      if (durum !== "yok") queueMicrotask(() => k.sonuc({ niyet_id: id, durum, ...(durum === "hata" ? { not: "yapılamadı" } : {}) }));
    },
    ...ek,
  });
  return { k, beyin, ogrenilen, niyetler };
}
const soyle = (k: Kopru, metin: string, kesin = true) => k.algi({ tur: "duydum", metin, kesin });

test("LLM tek kesin sözle ortam komutu gönderip başarırsa söz+komut öğrenilir", async () => {
  const { k, ogrenilen } = kur(() => ({ metin: "", cagrilar: [ortamCagrisi({ ne: "isik", deger: "ac" }), ortamCagrisi({ ne: "sis", deger: "kapat" })] }));
  soyle(k, "burası çok karanlık");
  await bekle(120);
  assert.equal(ogrenilen.length, 1);
  assert.equal(ogrenilen[0]!.soz, "burası çok karanlık");
  assert.deepEqual(ogrenilen[0]!.komutlar, [{ tur: "ortam", ne: "isik", deger: "ac" }, { tur: "ortam", ne: "sis", deger: "kapat" }]);
});

test("eşlik eden söz öğrenmeyi engellemez ('Tamam, açtım.')", async () => {
  const { k, ogrenilen } = kur(() => ({ metin: "", cagrilar: [ortamCagrisi({ ne: "isik", deger: "ac" }), { ad: "dunya_soyle", girdi: { metin: "Tamam, açtım." } }] }));
  soyle(k, "burası çok karanlık");
  await bekle(120);
  assert.equal(ogrenilen.length, 1);
});

test("ortam niyeti HATA verirse öğrenilmez", async () => {
  const { k, ogrenilen } = kur(() => ({ metin: "", cagrilar: [ortamCagrisi({ ne: "stil", deger: "suluboya" })] }), {}, "hata");
  soyle(k, "suluboya yapsana");
  await bekle(120);
  assert.equal(ogrenilen.length, 0);
});

test("çoklu ortam niyetinden biri hata verirse hiçbiri öğrenilmez", async () => {
  const { k, ogrenilen } = kur(() => ({ metin: "", cagrilar: [ortamCagrisi({ ne: "isik", deger: "ac" }), ortamCagrisi({ ne: "sis", deger: "kapat" })] }), {}, (i) => (i === 0 ? "bitti" : "hata"));
  soyle(k, "burası çok karanlık");
  await bekle(120);
  assert.equal(ogrenilen.length, 0);
});

test("başka bir niyet karışmışsa (git/yaz/komut/sor) öğrenilmez", async () => {
  const { k, ogrenilen } = kur(() => ({ metin: "", cagrilar: [ortamCagrisi({ ne: "isik", deger: "ac" }), { ad: "dunya_git", girdi: { hedef: { tip: "capa", ad: "pencere" } } }] }));
  soyle(k, "pencereye git ve ışığı aç ya da öyle bir şey");
  await bekle(120);
  assert.equal(ogrenilen.length, 0);
});

test("kesin olmayan söz öğrenilmez", async () => {
  const { k, ogrenilen } = kur(() => ({ metin: "", cagrilar: [ortamCagrisi({ ne: "isik", deger: "ac" })] }));
  soyle(k, "burası çok karanlık", false);
  await bekle(120);
  assert.equal(ogrenilen.length, 0);
});

test("ofiste (ova yok) ortam sözü LLM'e gider ve öğrenme zaten olmaz (sonuç hata)", async () => {
  const { k, beyin, ogrenilen } = kur(() => ({ metin: "", cagrilar: [ortamCagrisi({ ne: "isik", deger: "ac" })] }), { ortamKullanilabilir: () => false }, "hata");
  soyle(k, "ışığı aç");
  await bekle(120);
  assert.ok(beyin.gordugu.length >= 1, "söz LLM'e gitmeli (sonuç hatası onu bir kez daha uyandırabilir)");
  assert.equal(ogrenilen.length, 0);
});

test("öğrenme yapılandırılmamışsa köprü bozulmaz (kanca yok)", async () => {
  const { k, niyetler } = kur(() => ({ metin: "", cagrilar: [ortamCagrisi({ ne: "isik", deger: "ac" })] }), { ortamOgren: undefined });
  soyle(k, "burası çok karanlık");
  await bekle(120);
  assert.equal(niyetler.filter((x) => x.n.tur === "ortam").length, 1);
});

test("UÇTAN UCA: ilk sefer LLM, ikinci sefer öğrenen sözlük (LLM uyanmaz, ortam niyeti aynı)", async () => {
  const depo = { veri: [] as OgrenilenKayit[] };
  const sozluk = new OrtamSozlugu({ depo: { oku: () => structuredClone(depo.veri), yaz: (x) => { depo.veri = structuredClone([...x]); } }, simdi: () => 5_000 });
  const { k, beyin, niyetler } = kur(() => ({ metin: "", cagrilar: [ortamCagrisi({ ne: "isik", deger: "kis" }), ortamCagrisi({ ne: "sis", deger: "ac" })] }), {
    ortamOgren: (soz: string, komutlar: readonly OrtamNiyeti[]) => { sozluk.ogren(soz, komutlar); },
    ortamOgrenilen: (soz: string) => sozluk.esle(soz),
  });
  soyle(k, "kasvetli bir hava olsun");
  await bekle(120);
  assert.equal(beyin.gordugu.length, 1, "ilk sefer LLM düşünür");
  assert.equal(sozluk.liste().length, 1);
  const ilkSeferOrtam = niyetler.filter((x) => x.n.tur === "ortam").map((x) => x.n);

  soyle(k, "kasvetli bir hava olsun");
  await bekle(120);
  assert.equal(beyin.gordugu.length, 1, "ikinci sefer LLM uyanmaz (token yok)");
  const hepsi = niyetler.filter((x) => x.n.tur === "ortam").map((x) => x.n);
  assert.deepEqual(hepsi.slice(ilkSeferOrtam.length), ilkSeferOrtam, "aynı komutlar yeniden uygulanmalı");
});

test("sözlükten gelen eylem kayda 'komut:ortam-ogrenilen' diye yazılır", async () => {
  const sozluk = new OrtamSozlugu({ depo: { oku: () => [], yaz: () => {} }, simdi: () => 1 });
  sozluk.ogren("kasvetli bir hava olsun", [{ tur: "ortam", ne: "isik", deger: "kis" }]);
  const satirlar: KararSatiri[] = [];
  const kayit = new KararKaydi({ yaz: (s) => satirlar.push(JSON.parse(s.slice(KARAR_ONEKI.length + 1))), simdi: () => 1_000 });
  const { k } = kur(() => ({ metin: "", cagrilar: [] }), { ortamOgrenilen: (soz: string) => sozluk.esle(soz), kararKaydi: kayit });
  soyle(k, "kasvetli bir hava olsun");
  await bekle(120);
  assert.deepEqual(satirlar.filter((s) => s.tur === "program").map((s) => (s as { program?: string }).program), ["komut:ortam-ogrenilen"]);
});

test("sorgu (sor) ya da hatırla karışmışsa öğrenilmez", async () => {
  const { k, ogrenilen } = kur(() => ({ metin: "", cagrilar: [{ ad: "dunya_sor", girdi: { ne: "dunya" } }, ortamCagrisi({ ne: "isik", deger: "ac" })] }));
  soyle(k, "burası çok karanlık");
  await bekle(120);
  assert.equal(ogrenilen.length, 0);
});

test("aynı turda iki ayrı söz varsa (hangisinin sonucu belli değil) öğrenilmez", async () => {
  let n = 0;
  const { k, beyin, ogrenilen } = kur(() => (n++ === 0 ? { metin: "", cagrilar: [] } : { metin: "", cagrilar: [ortamCagrisi({ ne: "isik", deger: "ac" })] }));
  beyin.ilkGecikmeMs = 60;
  soyle(k, "birinci söz");            // tur başlar, 60 ms sürer
  await bekle(15);
  soyle(k, "burası çok karanlık");    // tur sürerken ikisi de tamponda birikir
  soyle(k, "hem de sisli olsun");
  await bekle(250);
  assert.equal(beyin.gordugu.length, 2, "ikinci tur iki sözle koşmalı");
  assert.equal(ogrenilen.length, 0);
});

test("ofiste (ova yok) öğrenilmiş söz sahiplenilmez: LLM'e gider", async () => {
  const sozluk = new OrtamSozlugu({ depo: { oku: () => [], yaz: () => {} }, simdi: () => 1 });
  sozluk.ogren("kasvetli bir hava olsun", [{ tur: "ortam", ne: "isik", deger: "kis" }]);
  const { k, beyin } = kur(() => ({ metin: "", cagrilar: [] }), { ortamKullanilabilir: () => false, ortamOgrenilen: (soz: string) => sozluk.esle(soz) });
  soyle(k, "kasvetli bir hava olsun");
  await bekle(120);
  assert.equal(beyin.gordugu.length, 1);
});
