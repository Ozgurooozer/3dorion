// bridge/kopruBenlik.test.ts — Anlık benlik köprüde (spec 12 Faz 1–2): yazma noktaları,
// süzülen algıdan güncelleme, `tik` dokunulmazlığı, kayıtta "kim yaptı". Davranış değişmez.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi, AracCagrisi } from "./beyin.ts";
import type { Niyet } from "../protocol/niyet.ts";
import { KARAR_ONEKI, KararKaydi, type AlgiSatiri } from "../mind/kararKaydi.ts";

class SahteBeyin implements Beyin {
  readonly ad = "sahte";
  cevaplar: BeyinCikti[];
  bekleme = 0;
  constructor(...c: BeyinCikti[]) { this.cevaplar = c; }
  async hazirMi() { return true; }
  async dusun(_g: BeyinGirdisi): Promise<BeyinCikti> {
    if (this.bekleme) await new Promise((r) => setTimeout(r, this.bekleme));
    return this.cevaplar.shift() ?? { metin: "", cagrilar: [] };
  }
}

const cagri = (ad: string, girdi: unknown = {}): AracCagrisi => ({ ad, girdi });
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

function kur(beyin: Beyin, poz = "duruyor") {
  const algilar: AlgiSatiri[] = [];
  const kayit = new KararKaydi({
    yaz: (s) => { const x = JSON.parse(s.slice(KARAR_ONEKI.length + 1)); if (x.tur === "algi") algilar.push(x); },
    simdi: () => 1_000,
  });
  const niyetler: { n: Niyet; id: string }[] = [];
  const k = new Kopru({
    komutYetkisi: false, beyin, niyetGonder: (n, id) => niyetler.push({ n, id }), dunyaDurumu: () => "Oda.",
    toplamaMs: 20, kararKaydi: kayit, hafizaGetirme: 0,
    bedenDurumu: () => ({ poz, oturuyor: poz === "oturuyor" }),
  });
  return { k, niyetler, algilar };
}

test("LLM'in beden niyeti 'yapıyorum'a girer, sonucu gelince çıkar", async () => {
  const { k, niyetler } = kur(new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_git", { hedef: { tip: "capa", ad: "tahta" } })] }));
  k.algi({ tur: "duydum", metin: "tahtaya git", kesin: true });
  await bekle(60);
  const once = k.benlik.oku().yapiyorum.map((y) => y.ozet);
  k.sonuc({ niyet_id: niyetler[0]!.id, durum: "bitti" });
  assert.deepEqual({ once, sonra: k.benlik.oku().yapiyorum.length }, { once: ["git → tahta"], sonra: 0 });
});

test("ÖNERİ YAŞAM DÖNGÜSÜ köprüde: önerildi → onay → (SÜZÜLEN) onay bildirimi → sonuç bekleniyor → terminal → kapandı", async () => {
  const { k, niyetler } = kur(new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_komut", { metin: "git status", gerekce: "durum" })] }));
  k.algi({ tur: "duydum", metin: "durumu kontrol et", kesin: true });
  await bekle(60);
  const adim: string[] = [k.benlik.oku().bekliyorum?.ne ?? "-"];
  k.sonuc({ niyet_id: niyetler[0]!.id, durum: "bitti", not: "Ozyn onayladi" });   // rutin: beyne çıkmaz
  adim.push(k.benlik.oku().bekliyorum?.ne ?? "-");
  k.algi({ tur: "terminal", kuyruk: "PS C:\\> git status\nnothing to commit", kesildi: false, kod: 0 });
  adim.push(k.benlik.oku().bekliyorum?.ne ?? "kapandı");
  assert.deepEqual(adim, ["onay", "komut_sonucu", "kapandı"]);
});

test("düşünürken benlik 'uyanık', bitince değil", async () => {
  const b = new SahteBeyin();
  b.bekleme = 80;
  const { k } = kur(b);
  k.algi({ tur: "duydum", metin: "naber", kesin: true });
  await bekle(30);
  const sirasinda = k.benlik.oku().dusunce.uyanik;
  await bekle(120);
  assert.deepEqual([sirasinda, k.benlik.oku().dusunce.uyanik], [true, false]);
});

test("tik benliği DEĞİŞTİRMEZ (maliyet tavanı yolu)", () => {
  const { k } = kur(new SahteBeyin());
  const once = JSON.stringify({ ...k.benlik.oku(), an: 0 });
  for (let i = 0; i < 20; i++) k.algi({ tur: "tik", t: i, dt: 0.05, orion: {} as never, oyuncu: {} as never });
  assert.equal(JSON.stringify({ ...k.benlik.oku(), an: 0 }), once);
});

test("kayıt: Ozyn'in sözü eden=ozyn, Ozyn'in tuşunun sonucu eden=ozyn, Orion'unki ben", async () => {
  const { k, algilar } = kur(new SahteBeyin());
  k.algi({ tur: "duydum", metin: "naber", kesin: true });
  k.sonuc({ niyet_id: "elle_x", durum: "hata", not: "zaten ayaktasın" });
  k.sonuc({ niyet_id: "n_x", durum: "hata", not: "yol yok" });
  await bekle(40);
  assert.deepEqual(algilar.map((a) => a.eden), ["ozyn", "ozyn", "ben"]);
});

test("kayıt (B8): Orion yürürken gelen 'Ozyn yaklaştı' eden=ben", async () => {
  const { k, algilar } = kur(new SahteBeyin(), "yürüyor");
  k.algi({ tur: "olay", ad: "ozyn_yaklasti", ayrinti: { mesafe: 1.7 } });
  await bekle(40);
  assert.equal(algilar[0]?.eden, "ben");
});

test("kayıt: onaylanan komutun terminal sonucu eden=ortak (benlik kapanmadan ÖNCE hesaplanır)", async () => {
  const { k, niyetler, algilar } = kur(new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_komut", { metin: "git status", gerekce: "x" })] }));
  k.algi({ tur: "duydum", metin: "kontrol et", kesin: true });
  await bekle(60);
  k.sonuc({ niyet_id: niyetler[0]!.id, durum: "bitti" });
  k.algi({ tur: "terminal", kuyruk: "PS> git status\nclean", kesildi: false, kod: 0 });
  await bekle(40);
  assert.equal(algilar.filter((a) => a.algi === "terminal")[0]?.eden, "ortak");
});

test("davranış değişmez: benlik varken de aynı niyetler aynı sırayla gider", async () => {
  const cevap = { metin: "", cagrilar: [cagri("dunya_soyle", { metin: "Tamam." }), cagri("dunya_otur")] };
  const { k, niyetler } = kur(new SahteBeyin(cevap));
  k.algi({ tur: "duydum", metin: "otur", kesin: true });
  await bekle(60);
  assert.deepEqual(niyetler.map((x) => x.n.tur), ["soyle", "otur"]);
});

// ── Süzgeç merceği (spec 12 Faz 4–5): gölge ve yetki ─────────────────────────

/** Gerçek refleks gibi: başarılı terminal ve sonuç rutin (ezilebilir) → süzülür. */
function rutinSuzgec() {
  return (a: { tur: string }) => a.tur === "terminal"
    ? { gecsin: false, kural: "refleks.terminal.kod_rutin" as const }
    : a.tur === "olay" ? { gecsin: true, kural: "refleks.olay.dunya" as const }
    : { gecsin: false, kural: "refleks.sonuc.rutin" as const };
}

async function onayliKomutKur(yetki: boolean) {
  const algilar: AlgiSatiri[] = [];
  const kayit = new KararKaydi({ yaz: (s) => { const x = JSON.parse(s.slice(KARAR_ONEKI.length + 1)); if (x.tur === "algi") algilar.push(x); } });
  const niyetler: { n: Niyet; id: string }[] = [];
  const beyin = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_komut", { metin: "ls", gerekce: "liste" })] });
  const gordugu: string[][] = [];
  const asil = beyin.dusun.bind(beyin);
  beyin.dusun = async (g) => { gordugu.push(g.ozetler); return asil(g); };
  const k = new Kopru({
    komutYetkisi: false, beyin, niyetGonder: (n, id) => niyetler.push({ n, id }), dunyaDurumu: () => "Oda.",
    toplamaMs: 20, kararKaydi: kayit, hafizaGetirme: 0, suzgec: rutinSuzgec() as never, benlikSuzgecYetkisi: yetki,
  });
  k.algi({ tur: "duydum", metin: "dosyaları listele", kesin: true });
  await bekle(60);
  k.sonuc({ niyet_id: niyetler[0]!.id, durum: "bitti", not: "Ozyn onayladi" });
  k.algi({ tur: "terminal", kuyruk: "PS C:\Users\ozigo> ls\nd----- .crush", kesildi: false, kod: 0 });
  await bekle(80);
  return { algilar, gordugu };
}

test("GÖLGE (yetki kapalı): onaylanan komutun sonucu yine süzülür ama kayıtta mercek 'geçir' der", async () => {
  const { algilar, gordugu } = await onayliKomutKur(false);
  const t = algilar.find((a) => a.algi === "terminal")!;
  assert.deepEqual({ uyanis: gordugu.length, kural: t.kapi.kural, mercek: t.mercek },
    { uyanis: 1, kural: "refleks.terminal.kod_rutin", mercek: { oneri: "gecir", kural: "benlik.beklenen_cevap" } });
});

test("YETKİ: onaylanan komutun sonucu beyne gider ve Orion'a KENDİ önerisinin sonucu olduğu söylenir", async () => {
  const { algilar, gordugu } = await onayliKomutKur(true);
  const t = algilar.find((a) => a.algi === "terminal")!;
  assert.deepEqual({ uyanis: gordugu.length, kural: t.kapi.kural, gecti: t.kapi.gecti, not: /YOU suggested/.test(gordugu[1]?.join(" ") ?? "") },
    { uyanis: 2, kural: "benlik.beklenen_cevap", gecti: true, not: true });
});

test("YETKİ: Orion yürürken 'Ozyn yaklaştı' süzülür (kendi yürüyüşünün yan ürünü)", async () => {
  const algilar: AlgiSatiri[] = [];
  const kayit = new KararKaydi({ yaz: (s) => { const x = JSON.parse(s.slice(KARAR_ONEKI.length + 1)); if (x.tur === "algi") algilar.push(x); } });
  const b = new SahteBeyin();
  let uyanis = 0;
  b.dusun = async () => { uyanis++; return { metin: "", cagrilar: [] }; };
  const k = new Kopru({ komutYetkisi: false, beyin: b, niyetGonder: () => {}, dunyaDurumu: () => "", toplamaMs: 20, kararKaydi: kayit,
    suzgec: rutinSuzgec() as never, benlikSuzgecYetkisi: true, bedenDurumu: () => ({ poz: "yürüyor", oturuyor: false }) });
  k.algi({ tur: "olay", ad: "ozyn_yaklasti", ayrinti: { mesafe: 1.7 } });
  await bekle(60);
  assert.deepEqual({ uyanis, kural: algilar[0]?.kapi.kural }, { uyanis: 0, kural: "benlik.yan_urun" });
});

test("YETKİ bile konuşmayı süzemez: Orion yürürken Ozyn'in sözü beyni uyandırır", async () => {
  const b = new SahteBeyin();
  let uyanis = 0;
  b.dusun = async () => { uyanis++; return { metin: "", cagrilar: [] }; };
  const k = new Kopru({ komutYetkisi: false, beyin: b, niyetGonder: () => {}, dunyaDurumu: () => "", toplamaMs: 20,
    suzgec: rutinSuzgec() as never, benlikSuzgecYetkisi: true, bedenDurumu: () => ({ poz: "yürüyor", oturuyor: false }) });
  k.algi({ tur: "duydum", metin: "dur", kesin: true });
  await bekle(60);
  assert.equal(uyanis, 1);
});
