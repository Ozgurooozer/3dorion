// bridge/kopruKarar.test.ts — Köprünün karar kaydı (spec 08): her kapı yolu,
// her uyanış, her sonuç bir satır; zincir kimliklerle kurulur; kayıt davranışa
// dokunmaz.
//
// Kaydın biçimi mind/kararKaydi.test.ts'te; burada köprünün NEYİ yazdığı var.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru, ZINCIR_AZAMI } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi, AracCagrisi } from "./beyin.ts";
import type { Niyet } from "../protocol/niyet.ts";
import type { Algi } from "../protocol/algi.ts";
import { KARAR_ONEKI, KararKaydi, type AlgiSatiri, type KararSatiri, type UyanisSatiri } from "../mind/kararKaydi.ts";

/** Sahte beyin: ne döndüreceğini test belirler, ne gördüğünü test okur. */
class SahteBeyin implements Beyin {
  readonly ad = "sahte";
  gordugu: BeyinGirdisi[] = [];
  cevaplar: BeyinCikti[];
  patlasin = false;
  constructor(...cevaplar: BeyinCikti[]) { this.cevaplar = cevaplar; }
  async hazirMi() { return true; }
  async dusun(g: BeyinGirdisi): Promise<BeyinCikti> {
    this.gordugu.push(structuredClone(g));
    if (this.patlasin) throw new Error("beyin çöktü");
    return this.cevaplar.shift() ?? { metin: "", cagrilar: [] };
  }
}

const cagri = (ad: string, girdi: unknown): AracCagrisi => ({ ad, girdi });
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Kaydı toplanan köprü. Saat sabit: anıların zaman etiketi koşudan koşuya aynı kalsın. */
function kur(beyin: Beyin, ek: Record<string, unknown> = {}, yaz?: (s: string) => void) {
  const satirlar: KararSatiri[] = [];
  const kayit = new KararKaydi({
    yaz: yaz ?? ((s) => satirlar.push(JSON.parse(s.slice(KARAR_ONEKI.length + 1)))),
    simdi: () => 1_000,
  });
  const niyetler: { n: Niyet; id: string }[] = [];
  const k = new Kopru({ komutYetkisi: false,
    beyin,
    niyetGonder: (n, id) => niyetler.push({ n, id }),
    dunyaDurumu: () => "Oda: masa, tahta. Ozyn 2m uzakta.",
    toplamaMs: 20,
    simdi: () => 1_000,
    kararKaydi: kayit,
    ...ek,
  });
  const algilar = () => satirlar.filter((s): s is AlgiSatiri => s.tur === "algi");
  const uyanislar = () => satirlar.filter((s): s is UyanisSatiri => s.tur === "uyanis");
  return { k, niyetler, satirlar, algilar, uyanislar };
}

// ── Kapı yolları: her biri tek satır, doğru içgüdüyle ──────────────────────

test("oturumun ilk satırı oturum satırıdır ve beynin adını taşır", () => {
  const { satirlar } = kur(new SahteBeyin());
  assert.deepEqual({ tur: satirlar[0]?.tur, beyin: satirlar[0]?.tur === "oturum" && satirlar[0].beyin }, { tur: "oturum", beyin: "sahte" });
});

test("tik kayda hiç yazılmaz", async () => {
  const { k, algilar } = kur(new SahteBeyin());
  for (let i = 0; i < 50; i++) k.algi({ tur: "tik", t: i, dt: 0.05, orion: {} as never, oyuncu: {} as never });
  await bekle(40);
  assert.equal(algilar().length, 0);
});

test("konuşma geçer ve onu geçiren içgüdü kopru.konusma", async () => {
  const { k, algilar } = kur(new SahteBeyin());
  k.algi({ tur: "duydum", metin: "merhaba", kesin: true });
  await bekle(40);
  assert.deepEqual(algilar()[0]?.kapi, { gecti: true, kural: "kopru.konusma" });
});

test("konuşma süzgece hiç sorulmaz — süzgeç hep hayır dese de geçer", async () => {
  const { k, algilar } = kur(new SahteBeyin(), { suzgec: () => false });
  k.algi({ tur: "duydum", metin: "merhaba", kesin: true });
  await bekle(40);
  assert.equal(algilar()[0]?.kapi.gecti, true);
});

test("süzgecin kimlikli kararı kayda aynen geçer", async () => {
  const { k, algilar } = kur(new SahteBeyin(), {
    suzgec: () => ({ gecsin: false, kural: "refleks.terminal.gurultu", gerekce: "rutin terminal gürültüsü" }),
  });
  k.algi({ tur: "terminal", kuyruk: "resolving 1/9", kesildi: false });
  assert.deepEqual(algilar()[0]?.kapi, { gecti: false, kural: "refleks.terminal.gurultu", gerekce: "rutin terminal gürültüsü" });
});

test("süzgecin geçirdiği algının kuralı da yazılır", async () => {
  const { k, algilar } = kur(new SahteBeyin(), {
    suzgec: () => ({ gecsin: true, kural: "refleks.terminal.kod_hata" }),
  });
  k.algi({ tur: "terminal", kuyruk: "boom", kesildi: false, kod: 1 });
  await bekle(40);
  assert.deepEqual(algilar()[0]?.kapi, { gecti: true, kural: "refleks.terminal.kod_hata" });
});

test("süzgeç düz evet/hayır dönerse kural kopru.suzgec yazılır", () => {
  const { k, algilar } = kur(new SahteBeyin(), { suzgec: () => false });
  k.algi({ tur: "olay", ad: "herhangi" });
  assert.deepEqual(algilar()[0]?.kapi, { gecti: false, kural: "kopru.suzgec" });
});

test("süzgeç çökerse algı geçer ve kural kopru.guvenli_taraf yazılır", async (t) => {
  t.mock.method(console, "warn", () => {});
  const { k, algilar } = kur(new SahteBeyin(), { suzgec: () => { throw new Error("süzgeç bozuk"); } });
  k.algi({ tur: "olay", ad: "herhangi" });
  await bekle(40);
  assert.deepEqual(algilar()[0]?.kapi, { gecti: true, kural: "kopru.guvenli_taraf" });
});

test("süzgeç yokken dikkatten geçen algının kuralı dikkat.gecti", async () => {
  const { k, algilar } = kur(new SahteBeyin());
  k.algi({ tur: "olay", ad: "oyuncu_odaya_girdi" });
  await bekle(40);
  assert.deepEqual(algilar()[0]?.kapi, { gecti: true, kural: "dikkat.gecti" });
});

test("dikkatin tekrar penceresinde düşen algı dikkat.tekrar ile yazılır", async () => {
  const { k, algilar } = kur(new SahteBeyin());
  k.algi({ tur: "olay", ad: "oyuncu_odaya_girdi" });
  k.algi({ tur: "olay", ad: "oyuncu_odaya_girdi" });
  await bekle(40);
  assert.deepEqual(algilar().map((a) => a.kapi.kural), ["dikkat.gecti", "dikkat.tekrar"]);
});

test("yerel kanaldaki algı dikkat.yerel_kanal ile yazılır", () => {
  const { k, algilar } = kur(new SahteBeyin());
  k.algi({ tur: "yakin", nesneler: [] });
  assert.deepEqual(algilar()[0]?.kapi, { gecti: false, kural: "dikkat.yerel_kanal" });
});

test("hakkı biten bakış cevabı kopru.zincir ile yazılır", async () => {
  // Her turda bakan beyin; dünya her `sor`a bir `gordum` ile cevap verir.
  const b = new SahteBeyin(...Array.from({ length: 10 }, () => ({ metin: "", cagrilar: [cagri("dunya_sor", { ne: "dunya" })] })));
  const { k, niyetler, algilar } = kur(b);
  k.algi({ tur: "olay", ad: "kendiliginden" });
  let islenen = 0;
  for (let i = 0; i < 12; i++) {
    await bekle(30);
    for (; islenen < niyetler.length; islenen++) {
      const n = niyetler[islenen]!.n;
      if (n.tur === "sor") k.algi({ tur: "gordum", ne: n.ne, metin: `nesne ${islenen}` });
    }
  }
  const gordumler = algilar().filter((a) => a.algi === "gordum");
  // İlk ZINCIR_AZAMI cevap geçer, sonraki kesilir.
  assert.deepEqual(
    gordumler.slice(0, ZINCIR_AZAMI + 1).map((a) => a.kapi.kural),
    [...Array(ZINCIR_AZAMI).fill("dikkat.gecti"), "kopru.zincir"],
  );
});

// ── Uyanış: tetikleyen algılar, LLM'in yaptıkları ─────────────────────────

test("uyanış satırı onu tetikleyen algıların kimliklerini sırayla taşır", async () => {
  const { k, algilar, uyanislar } = kur(new SahteBeyin());
  k.algi({ tur: "olay", ad: "oyuncu_odaya_girdi" });
  k.algi({ tur: "olay", ad: "monitor_acildi" });
  await bekle(60);
  assert.deepEqual(uyanislar()[0]?.algilar, algilar().map((a) => a.id));
});

test("düşen algı hiçbir uyanışın tetikleyicisi olarak görünmez", async () => {
  const { k, algilar, uyanislar } = kur(new SahteBeyin(), { suzgec: (a: Algi) => a.tur !== "terminal" });
  k.algi({ tur: "terminal", kuyruk: "gürültü", kesildi: false });
  k.algi({ tur: "olay", ad: "oyuncu_odaya_girdi" });
  await bekle(60);
  const dusen = algilar().find((a) => !a.kapi.gecti)!;
  assert.equal(uyanislar().some((u) => u.algilar.includes(dusen.id)), false);
});

test("uyanış satırı dünyaya giden niyetin kimliğini, türünü ve gövdesini taşır", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_git", { hedef: { tip: "capa", ad: "tahta" } })] });
  const { k, niyetler, uyanislar } = kur(b);
  k.algi({ tur: "duydum", metin: "tahtaya git", kesin: true });
  await bekle(60);
  assert.deepEqual(uyanislar()[0]?.niyetler, [{ id: niyetler[0]!.id, tur: "git", govde: { tur: "git", hedef: { tip: "capa", ad: "tahta" } } }]);
});

test("uyanış satırındaki gövde dünyaya gönderilen niyetin aynısıdır (spec 10, Faz A)", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_git", { hedef: { tip: "capa", ad: "masa" } }), cagri("dunya_otur", {})] });
  const { k, niyetler, uyanislar } = kur(b);
  k.algi({ tur: "duydum", metin: "masaya git otur", kesin: true });
  await bekle(60);
  // Eylem sırası (spec 13): `otur`, `git`in `bitti` sonucundan sonra gider.
  k.sonuc({ niyet_id: niyetler[0]!.id, durum: "bitti" });
  // Kayıt JSON'dur: doğrulayıcının koyduğu `undefined` alanlar (ör. `mesafe`) yazılmaz.
  // Karşılaştırma gönderilen niyetin JSON haliyle.
  assert.deepEqual(uyanislar()[0]?.niyetler.map((n) => n.govde), niyetler.map((x) => JSON.parse(JSON.stringify(x.n))));
});

test("söz algısının satırı sözün metnini ve kesinliğini taşır (spec 10, Faz A)", async () => {
  const { k, algilar } = kur(new SahteBeyin());
  k.algi({ tur: "duydum", metin: "masaya git otur", kesin: true });
  await bekle(40);
  assert.deepEqual(algilar()[0]?.soz, { metin: "masaya git otur", kesin: true });
});

test("uyanış satırı LLM'in çağırdığı araçları ve beynin adını taşır", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_soyle", { metin: "Merhaba." })] });
  const { k, uyanislar } = kur(b);
  k.algi({ tur: "duydum", metin: "selam", kesin: true });
  await bekle(60);
  const u = uyanislar()[0]!;
  assert.deepEqual({ cagrilar: u.cagrilar, beyin: u.beyin }, { cagrilar: ["dunya_soyle"], beyin: "sahte" });
});

test("hiçbir şey yapmayan uyanış boş niyet listesiyle yazılır — boşa uyanış görünür", async () => {
  const { k, uyanislar } = kur(new SahteBeyin({ metin: "", cagrilar: [] }));
  k.algi({ tur: "olay", ad: "oyuncu_odaya_girdi" });
  await bekle(60);
  const u = uyanislar()[0]!;
  assert.deepEqual({ niyet: u.niyetler.length, cagri: u.cagrilar.length, metin: "metin" in u }, { niyet: 0, cagri: 0, metin: false });
});

test("uyanış satırı dünya zeminini taşır", async () => {
  const { k, uyanislar } = kur(new SahteBeyin());
  k.algi({ tur: "duydum", metin: "selam", kesin: true });
  await bekle(60);
  assert.match(uyanislar()[0]!.dunya, /^Oda: masa, tahta\. Ozyn 2m uzakta\./);
});

test("uyanış satırı bağlam ölçüsünü taşır: dünya bölümü beynin gördüğü dünya metninin boyudur (spec 16 F0)", async () => {
  const b = new SahteBeyin();
  const { k, uyanislar } = kur(b);
  k.algi({ tur: "duydum", metin: "merhaba", kesin: true });
  await bekle(40);
  assert.equal(uyanislar()[0]?.baglam?.dunya, b.gordugu[0]?.dunya.length);
});

test("beyin girdi token sayısını bildirirse bağlam ölçüsüne yazılır", async () => {
  const { k, uyanislar } = kur(new SahteBeyin({ metin: "", cagrilar: [], bilgi: { girdiToken: 1234 } }));
  k.algi({ tur: "duydum", metin: "merhaba", kesin: true });
  await bekle(40);
  assert.equal(uyanislar()[0]?.baglam?.token, 1234);
});

test("beyin token bildirmezse bağlam ölçüsünde token alanı yoktur", async () => {
  const { k, uyanislar } = kur(new SahteBeyin());
  k.algi({ tur: "duydum", metin: "merhaba", kesin: true });
  await bekle(40);
  assert.equal(uyanislar()[0]?.baglam?.token, undefined);
});

test("reddedilen çağrı sayılır; geri beslemesi sonraki uyanışta algı olmayan girdi olarak görünür", async (t) => {
  t.mock.method(console, "warn", () => {});
  const b = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_git", { hedef: 42 })] }, { metin: "", cagrilar: [] });
  const { k, uyanislar } = kur(b);
  k.algi({ tur: "duydum", metin: "git", kesin: true });
  await bekle(120);
  const [ilk, ikinci] = uyanislar();
  assert.deepEqual(
    { reddedilen: ilk?.reddedilen, geriBesleme: ikinci?.geriBesleme, algilar: ikinci?.algilar },
    { reddedilen: 1, geriBesleme: 1, algilar: [] },
  );
});

test("inisiyatif olayıyla başlayan uyanışın kökeni inisiyatif, Ozyn'in sözüyle başlayanınki dış", async () => {
  const { k, uyanislar } = kur(new SahteBeyin());
  k.algi({ tur: "olay", ad: "sessizlik", ayrinti: { kaynak: "inisiyatif" } });
  await bekle(60);
  k.algi({ tur: "duydum", metin: "selam", kesin: true });
  await bekle(60);
  assert.deepEqual(uyanislar().map((u) => u.koken), ["inisiyatif", "dis"]);
});

test("yalnız bakış cevabından oluşan uyanış takip turudur, tetik turu değildir", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_sor", { ne: "onumde" })] });
  const { k, niyetler, uyanislar } = kur(b);
  k.algi({ tur: "duydum", metin: "önünde ne var", kesin: true });
  await bekle(60);
  k.algi({ tur: "gordum", ne: "onumde", metin: "masa" });
  await bekle(60);
  assert.deepEqual({ sor: niyetler[0]?.n.tur, takip: uyanislar().map((u) => u.takip) }, { sor: "sor", takip: [false, true] });
});

test("uyanış süresi beynin düşünme süresini kapsar", async () => {
  const b = new SahteBeyin();
  const yavas: Beyin = { ad: "yavas", hazirMi: async () => true, dusun: async (g) => { await bekle(40); return b.dusun(g); } };
  const { k, uyanislar } = kur(yavas);
  k.algi({ tur: "duydum", metin: "selam", kesin: true });
  await bekle(120);
  // Zamanlayıcı birkaç ms erken uyanabilir (Windows saat çözünürlüğü): 30 ms alt sınır.
  assert.ok((uyanislar()[0]?.sureMs ?? 0) >= 30, `süre: ${uyanislar()[0]?.sureMs}`);
});

test("inisiyatifte yutulan susma ilanı uyanış satırında sayılır", async (t) => {
  t.mock.method(console, "log", () => {});
  const b = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_soyle", { metin: "Sessiz kalıyorum. Ozyn çalışıyor." })] });
  const { k, uyanislar } = kur(b);
  k.algi({ tur: "olay", ad: "sessizlik", ayrinti: { kaynak: "inisiyatif" } });
  await bekle(60);
  assert.deepEqual({ yutulan: uyanislar()[0]?.yutulanSoz, niyet: uyanislar()[0]?.niyetler.length }, { yutulan: 1, niyet: 0 });
});

test("araç çağrılmayıp konuşmaya çevrilen metin uyanış satırında işaretlenir", async (t) => {
  t.mock.method(console, "warn", () => {});
  const { k, uyanislar } = kur(new SahteBeyin({ metin: "Terminalde bir hata var.", cagrilar: [] }));
  k.konusmaDinle(() => {});
  k.algi({ tur: "duydum", metin: "ne oldu", kesin: true });
  await bekle(60);
  assert.deepEqual({ konusulan: uyanislar()[0]?.konusulanMetin, metin: uyanislar()[0]?.metin }, { konusulan: true, metin: "Terminalde bir hata var." });
});

test("düz metnin içinden kurtarılan çağrı sayılır ve niyeti listelenir", async (t) => {
  t.mock.method(console, "warn", () => {});
  const b = new SahteBeyin({ metin: '{"name": "dunya_bak", "arguments": {"hedef": {"tip": "oyuncu"}}}', cagrilar: [] });
  const { k, niyetler, uyanislar } = kur(b);
  k.algi({ tur: "duydum", metin: "bana bak", kesin: true });
  await bekle(60);
  const u = uyanislar()[0]!;
  assert.deepEqual(
    { kurtarilan: u.kurtarilan, niyetler: u.niyetler },
    { kurtarilan: 1, niyetler: [{ id: niyetler[0]!.id, tur: "bak", govde: niyetler[0]!.n }] },
  );
});

test("uyanış satırı getirilen anı sayısını taşır", async (t) => {
  t.mock.method(console, "log", () => {});
  const { k, uyanislar } = kur(new SahteBeyin(), { hafizaGetirme: 3 });
  k.algi({ tur: "duydum", metin: "terminal suzgeci uzerinde calisiyorum", kesin: true });
  await bekle(60);
  k.algi({ tur: "duydum", metin: "suzgec nasil gidiyor", kesin: true });
  await bekle(60);
  assert.deepEqual(uyanislar().map((u) => u.anilar > 0), [false, true]);
});

test("beyin çökerse uyanış satırı hatayı taşır", async (t) => {
  t.mock.method(console, "error", () => {});
  const b = new SahteBeyin();
  b.patlasin = true;
  const { k, uyanislar } = kur(b);
  k.algi({ tur: "duydum", metin: "selam", kesin: true });
  await bekle(60);
  assert.equal(uyanislar()[0]?.hata, "beyin çöktü");
});

test("niyetin sonucu niyet kimliğiyle geri bağlanır", async () => {
  const b = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_git", { hedef: { tip: "capa", ad: "tahta" } })] });
  const { k, niyetler, algilar, uyanislar } = kur(b);
  k.algi({ tur: "duydum", metin: "tahtaya git", kesin: true });
  await bekle(60);
  k.sonuc({ niyet_id: niyetler[0]!.id, durum: "hata", not: "çapa bulunamadı" });
  const sonuc = algilar().find((a) => a.algi === "sonuc")!;
  assert.deepEqual(
    { niyet: sonuc.niyet, durum: sonuc.durum, uyanistaVar: uyanislar()[0]!.niyetler.some((n) => n.id === sonuc.niyet) },
    { niyet: niyetler[0]!.id, durum: "hata", uyanistaVar: true },
  );
});

// ── Kayıt davranışa dokunmaz ──────────────────────────────────────────────

/** Aynı senaryo: söz, olay, gürültü, geçersiz çağrı, konuşma, bakış. */
async function senaryo(yaz?: (s: string) => void) {
  const b = new SahteBeyin(
    { metin: "", cagrilar: [cagri("dunya_soyle", { metin: "Selam." }), cagri("dunya_git", { hedef: 42 })] },
    { metin: "", cagrilar: [cagri("dunya_sor", { ne: "onumde" })] },
    { metin: "Önümde masa var.", cagrilar: [] },
  );
  const { k, niyetler } = kur(b, { suzgec: (a: Algi) => a.tur !== "terminal" }, yaz);
  k.algi({ tur: "duydum", metin: "merhaba", kesin: true });
  k.algi({ tur: "terminal", kuyruk: "gürültü", kesildi: false });
  await bekle(80);
  k.algi({ tur: "olay", ad: "oyuncu_masaya_oturdu" });
  await bekle(80);
  k.algi({ tur: "gordum", ne: "onumde", metin: "masa" });
  await bekle(120);
  return { girdiler: b.gordugu, niyetler: niyetler.map((x) => x.n), sayac: k.sayac() };
}

test("kayıt davranışı değiştirmez: patlayan yazıcıyla da beyin aynı girdileri görür", async (t) => {
  t.mock.method(console, "warn", () => {});
  const toplanan = await senaryo();
  const patlayan = await senaryo(() => { throw new Error("disk dolu"); });
  assert.deepEqual(patlayan.girdiler, toplanan.girdiler);
});

test("kayıt davranışı değiştirmez: patlayan yazıcıyla da aynı niyetler çıkar", async (t) => {
  t.mock.method(console, "warn", () => {});
  const toplanan = await senaryo();
  const patlayan = await senaryo(() => { throw new Error("disk dolu"); });
  assert.deepEqual(patlayan.niyetler, toplanan.niyetler);
});

test("yazılamayan kayıt satırları köprünün sayacında görünür", async (t) => {
  t.mock.method(console, "warn", () => {});
  const patlayan = await senaryo(() => { throw new Error("disk dolu"); });
  assert.ok(patlayan.sayac.kayitYazilamayan > 0, `sayaç: ${patlayan.sayac.kayitYazilamayan}`);
});

test("kayıt İÇGÜDÜDÜR: verilmezse köprü satırları [KARAR] önekiyle konsola yazar", (t) => {
  const yakalanan: string[] = [];
  t.mock.method(console, "log", (s: unknown) => { if (typeof s === "string") yakalanan.push(s); });
  const k = new Kopru({ komutYetkisi: false, beyin: new SahteBeyin(), niyetGonder: () => {}, dunyaDurumu: () => "", toplamaMs: 20 });
  k.algi({ tur: "yakin", nesneler: [] });
  const kararlar = yakalanan.filter((s) => s.startsWith(`${KARAR_ONEKI} `));
  assert.deepEqual(kararlar.map((s) => JSON.parse(s.slice(KARAR_ONEKI.length + 1)).tur), ["oturum", "algi"]);
});
