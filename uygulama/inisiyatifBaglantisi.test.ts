// uygulama/inisiyatifBaglantisi.test.ts — Kapı + GERÇEK köprü: açık iş bir kez hatırlatılır, sonraki iş aç kalmaz.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "../bridge/kopru.ts";
import type { Beyin, BeyinCikti } from "../bridge/beyin.ts";
import type { Algi } from "../protocol/algi.ts";
import { Inisiyatif, inisiyatifOlayi, type InisiyatifDurumu } from "../mind/inisiyatif.ts";
import { inisiyatifTik } from "./inisiyatifBaglantisi.ts";

const DK = 60_000;
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Her turda bir komut önerir: Ozyn'in sözü → `dunya_komut`. */
class KomutBeyni implements Beyin {
  readonly ad = "komutcu";
  private _n = 0;
  async hazirMi() { return true; }
  async dusun(): Promise<BeyinCikti> {
    this._n++;
    return { metin: "", cagrilar: [{ ad: "dunya_komut", girdi: { metin: `echo ${this._n}`, gerekce: "Ozyn istedi" } }] };
  }
}

/** Gerçek köprü; saat elde. `verilen`: bağlantının köprüye verdiği algılar (beyin turu açmadan yakalanır). */
function kur() {
  let simdi = 0;
  const komutlar: string[] = [];
  const k = new Kopru({
    beyin: new KomutBeyni(), toplamaMs: 5, dunyaDurumu: () => "oda", simdi: () => simdi,
    niyetGonder: (n, id) => { if (n.tur === "komut") komutlar.push(id); },
  });
  const verilen: Algi[] = [];
  const kopru = { acikIs: () => k.acikIs(), acikIsAnildi: (a: string) => k.acikIsAnildi(a), algi: (a: Algi) => { verilen.push(a); } };
  const saat = (ms: number) => { simdi = ms; };
  return { k, kopru, komutlar, verilen, saat };
}

async function oner(k: Kopru, metin: string) {
  k.algi({ tur: "duydum", metin, kesin: true });
  await bekle(60);
}
const dus = (k: Kopru, id: string) =>
  k.algi({ tur: "sonuc", sonuc: { niyet_id: id, durum: "hata", kod: "onay_dustu", not: "oneri zaman asimina ugradi" } });

const durum = (simdiMs: number): Omit<InisiyatifDurumu, "acikIs"> => ({
  simdiMs, mesgul: false, ozynMonitorde: false, ozynOdada: true, sessizlikMs: 1 * DK, guc: 1, girdiYasiMs: 1 * DK,
});
const nedenler = (v: Algi[]) => v.map((a) => (a.tur === "olay" ? a.ayrinti?.["neden"] : a.tur));

test("aynı açık iş TEK kez hatırlatılır: ikinci tikte (refrakter geçse de) yeniden uyanılmaz", async () => {
  const { k, kopru, komutlar, verilen, saat } = kur();
  await oner(k, "bir şey çalıştır");
  dus(k, komutlar[0]!);
  const i = new Inisiyatif();
  saat(3 * DK); inisiyatifTik(i, kopru, durum(3 * DK));
  saat(40 * DK); inisiyatifTik(i, kopru, durum(40 * DK));
  assert.deepEqual(nedenler(verilen), ["acik_is"]);
});

test("iki açık iş: ilki hatırlatılınca ikincisi de sırası gelince hatırlatılır (aç kalmaz)", async () => {
  const { k, kopru, komutlar, verilen, saat } = kur();
  await oner(k, "birinciyi çalıştır");
  await oner(k, "ikinciyi çalıştır");
  dus(k, komutlar[0]!);
  dus(k, komutlar[1]!);
  const i = new Inisiyatif();
  saat(3 * DK); inisiyatifTik(i, kopru, durum(3 * DK));
  saat(20 * DK); inisiyatifTik(i, kopru, durum(20 * DK));
  assert.deepEqual(nedenler(verilen), ["acik_is", "acik_is"]);
  const adlar = verilen.map((a) => (a.tur === "olay" ? a.ad : ""));
  assert.ok(/echo 1/.test(adlar[0]!) && /echo 2/.test(adlar[1]!), adlar.join(" | "));
});

test("geri alma (eski kip): açık iş okunmaz, uyanma yalnız sessizlikten", async () => {
  const { k, kopru, komutlar, verilen, saat } = kur();
  await oner(k, "bir şey çalıştır");
  dus(k, komutlar[0]!);
  saat(3 * DK);
  inisiyatifTik(new Inisiyatif(), kopru, { ...durum(3 * DK), sessizlikMs: 20 * DK }, true);
  assert.deepEqual(nedenler(verilen), ["sessizlik"]);
  assert.notEqual(k.acikIs(), null, "eski kip açık işi tüketmemeli");
});

test("olay metni: köken ve neden yapısal alanda; özet çift ters tırnağa sarılmaz", () => {
  const a = inisiyatifOlayi({ neden: "acik_is", dakika: 3, acikIs: { ozet: "komut `git status`", yasMs: 3 * DK, anahtar: "n" } }, 0);
  assert.deepEqual(a.ayrinti, { kaynak: "inisiyatif", neden: "acik_is", derinlik: 0 });
  assert.equal(a.ad.includes("``"), false, a.ad);
});
