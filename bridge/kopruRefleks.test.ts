// bridge/kopruRefleks.test.ts — Beceri refleksi köprüde, YETKİYLE (spec 10, Faz D).
//
// Anahtar (`beceriYetkisi`) varsayılan kapalı; kapalıyken köprü Faz C'dekiyle birebir
// aynıdır (B12). Açıkken parametre içinde eşleşen kesin sözde LLM uyanmaz: önce onay
// jesti, sonra becerinin adımları SIRAYLA, her birinin sonucu beklenerek, `niyetGonder`
// ile gider (B13). Bir adım hata verir ya da zaman aşarsa kalanlar gönderilmez, söz notla
// LLM'e döner; yeni bir emir adımı geçerse (iptal) refleks sessizce kesilir.
"use strict";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { AracCagrisi, Beyin, BeyinCikti, BeyinGirdisi } from "./beyin.ts";
import type { Niyet } from "../protocol/niyet.ts";
import { KARAR_ONEKI, KararKaydi, niyetKaydi, type AlgiSatiri, type KararSatiri, type RefleksSatiri, type UyanisBilgisi } from "../mind/kararKaydi.ts";
import { kayitOku, zincirKur } from "../mind/kararZinciri.ts";
import { gorevler, niyetSinifi } from "../mind/gorev.ts";
import { beceriHafizasiKur } from "../mind/beceriHafizasi.ts";
import { niyetKaynagi } from "../mind/durumKodu.ts";
import { KuralRefleksi, refleksGirdisi } from "../mind/refleks.ts";

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
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Dünyaya giden niyetin JSON hali: doğrulayıcı `undefined` alan koyar (ör. `git.mesafe`), kayıt ve karşılaştırma onu görmez. */
const json = (x: unknown): unknown => JSON.parse(JSON.stringify(x));
const git = (ad: string): Niyet => ({ tur: "git", hedef: { tip: "capa", ad } });
const OTUR: Niyet = { tur: "otur" };
const ONAY: Niyet = { tur: "jest", jest: "başını_sallıyor" };

const UYANIS: UyanisBilgisi = {
  algilar: [], geriBesleme: 0, beyin: "sahte", sureMs: 2000, koken: "dis", takip: false,
  anilar: 0, dunya: "oda", cagrilar: [], niyetler: [], reddedilen: 0, kurtarilan: 0,
  konusulanMetin: false, yutulanSoz: 0,
};

/** Geçmiş bir oturum: her söze LLM verilen niyetlerle cevap verdi, hepsi bitti. Beceriler buradan doğar. */
function gecmisOturum(...gorevlerListesi: [string, Niyet[]][]): KararSatiri[] {
  const metin: string[] = [];
  let t = 0;
  const k = new KararKaydi({ oturum: "o_gecmis", simdi: () => (t += 1000), yaz: (s) => metin.push(s.slice(KARAR_ONEKI.length + 1)) });
  k.oturumBasi("sahte");
  gorevlerListesi.forEach(([soz, niyetler], i) => {
    const a = k.algi({ tur: "duydum", metin: soz, kesin: true }, "ozet", { gecti: true, kural: "kopru.konusma" });
    const kayitlar = niyetler.map((n, j) => niyetKaydi(`n_${i}_${j}`, n));
    k.uyanis({ ...UYANIS, algilar: [a], niyetler: kayitlar });
    for (const n of kayitlar) k.algi({ tur: "sonuc", sonuc: { niyet_id: n.id, durum: "bitti" } }, "ozet", { gecti: false, kural: "refleks.sonuc.rutin" });
  });
  return kayitOku(metin.join("\n")).satirlar;
}

/** Kurulan köprüler: dosyanın sonunda durdurulur ki bekleyen refleksin zaman aşımı süreci tutmasın. */
const kopruler: Kopru[] = [];
after(() => { for (const k of kopruler) k.durdur(); });

/**
 * Yetkili köprü. `otomatik`: dünya her niyete hemen `bitti` der; değilse sonuçları test verir.
 * Süzgeç canlıdaki kural refleksi (rutin başarı LLM'i uyandırmaz).
 */
function kur(ayar: { beyin?: SahteBeyin; gecmis?: KararSatiri[]; yetki?: boolean | null; otomatik?: boolean; zamanAsimiMs?: number } = {}) {
  let saat = 1_000_000;
  const metin: string[] = [];
  const niyetler: { n: Niyet; id: string }[] = [];
  const beyin = ayar.beyin ?? new SahteBeyin();
  const refleks = new KuralRefleksi();
  let k: Kopru;
  k = new Kopru({
    beyin,
    niyetGonder: (n, id) => {
      niyetler.push({ n, id });
      if (ayar.otomatik) queueMicrotask(() => k.sonuc({ niyet_id: id, durum: "bitti" }));
    },
    dunyaDurumu: () => "Oda.",
    toplamaMs: 10,
    simdi: () => saat,
    dikkat: { simdi: () => (saat += 10_000) },
    suzgec: (a, ozet) => { const r = refleks.karar(refleksGirdisi(a, ozet)); return { gecsin: r.terfi, kural: r.kural, gerekce: r.gerekce }; },
    kararKaydi: new KararKaydi({ yaz: (s) => metin.push(s.slice(KARAR_ONEKI.length + 1)), simdi: () => (saat += 1), oturum: "o_simdi" }),
    gorevSatirlari: ayar.gecmis ?? [],
    ...(ayar.yetki === undefined ? { beceriYetkisi: true } : ayar.yetki === null ? {} : { beceriYetkisi: ayar.yetki }),
    ...(ayar.zamanAsimiMs ? { refleksZamanAsimiMs: ayar.zamanAsimiMs } : {}),
  });
  kopruler.push(k);
  const satirlar = () => kayitOku(metin.join("\n")).satirlar;
  const refleksler = () => satirlar().filter((s): s is RefleksSatiri => s.tur === "refleks");
  const soyle = async (soz: string, kesin = true) => { k.algi({ tur: "duydum", metin: soz, kesin }); await bekle(60); };
  const sonuc = async (i: number, durum: "bitti" | "hata" | "iptal", not?: string) => {
    k.sonuc({ niyet_id: niyetler[i]!.id, durum, ...(not ? { not } : {}) });
    await bekle(60);
  };
  return { k, beyin, niyetler, satirlar, refleksler, soyle, sonuc };
}

const PENCERE = gecmisOturum(["pencereye git", [git("pencere")]]);
const MASA_OTUR = gecmisOturum(["masaya git otur", [git("masa"), OTUR]]);

// ── Anahtar kapalı (B12) ───────────────────────────────────────────────────

test("YETKİ KAPALI (B12): eşleşen becerisi olan köprü LLM'i uyandırır, refleks niyeti ve satırı yok", async () => {
  const { beyin, niyetler, refleksler, soyle } = kur({ gecmis: PENCERE, yetki: false, beyin: new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_git", { hedef: { tip: "capa", ad: "sandalye" } })] }) });
  await soyle("sandalyeye git");
  assert.deepEqual(
    { uyanis: beyin.gordugu.length, refleksNiyeti: niyetler.some((x) => niyetKaynagi(x.id) === "refleks"), refleksSatiri: refleksler().length },
    { uyanis: 1, refleksNiyeti: false, refleksSatiri: 0 },
  );
});

test("YETKİ KAPALI (B12): anahtarı hiç verilmeyen köprüyle `false` verilen köprü aynı niyetleri gönderir, aynı sayıda uyanır", async () => {
  const kos = async (yetki: false | null) => {
    const beyin = new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_git", { hedef: { tip: "capa", ad: "sandalye" } })] });
    const { niyetler, soyle } = kur({ gecmis: PENCERE, yetki, beyin, otomatik: true });
    await soyle("sandalyeye git");
    return { niyetler: niyetler.map((x) => json(x.n)), uyanis: beyin.gordugu.length };
  };
  assert.deepEqual(await kos(null), await kos(false));
});

// ── Anahtar açık (B13) ─────────────────────────────────────────────────────

test("YETKİ AÇIK: eşleşen kesin sözde LLM uyanmaz; önce onay jesti, sonra becerinin adımı, refleks kimlikleriyle", async () => {
  const { beyin, niyetler, soyle } = kur({ gecmis: PENCERE });
  await soyle("sandalyeye git");
  assert.deepEqual(
    { uyanis: beyin.gordugu.length, niyetler: niyetler.map((x) => json(x.n)), kaynak: niyetler.map((x) => niyetKaynagi(x.id)) },
    { uyanis: 0, niyetler: [ONAY, git("sandalye")], kaynak: ["refleks", "refleks"] },
  );
});

test("adımlar sırayla: ikinci adım ancak birincinin `bitti`si gelince gönderilir", async () => {
  const { niyetler, soyle, sonuc } = kur({ gecmis: MASA_OTUR });
  await soyle("pencereye git otur");
  const once = niyetler.map((x) => json(x.n));
  await sonuc(1, "bitti");
  assert.deepEqual({ once, sonra: niyetler.map((x) => json(x.n)) }, { once: [ONAY, git("pencere")], sonra: [ONAY, git("pencere"), OTUR] });
});

test("bütün adımlar bitince refleks satırı: söz, beceri, onay, adımlar gövdeleriyle, bitiş başarı", async () => {
  const { k, satirlar, refleksler, niyetler, soyle } = kur({ gecmis: MASA_OTUR, otomatik: true });
  await soyle("pencereye git otur");
  const soz = satirlar().find((s): s is AlgiSatiri => s.tur === "algi" && s.algi === "duydum")!;
  const [r] = refleksler();
  assert.deepEqual(
    { algi: r?.algi, beceri: r?.beceri, onay: r?.onay, niyetler: r?.niyetler, bitis: r?.bitis },
    {
      algi: soz.id, beceri: k.beceriHafizasi.beceriler[0]!.id, onay: niyetKaydi(niyetler[0]!.id, ONAY),
      niyetler: [niyetKaydi(niyetler[1]!.id, git("pencere")), niyetKaydi(niyetler[2]!.id, OTUR)], bitis: "basari",
    },
  );
});

test("bir adım hata verirse kalanlar gönderilmez; söz, hatanın notuyla LLM'e döner ve LLM uyanır", async () => {
  const { beyin, niyetler, refleksler, soyle, sonuc } = kur({ gecmis: MASA_OTUR });
  await soyle("pencereye git otur");
  await sonuc(1, "hata", "yol kapalı");
  const g = beyin.gordugu[0];
  assert.deepEqual(
    {
      niyetler: niyetler.map((x) => json(x.n)), bitis: refleksler()[0]?.bitis, uyanis: beyin.gordugu.length,
      soz: g?.ozetler.some((o) => o.includes("pencereye git otur")), not: g?.ozetler.some((o) => o.includes("yol kapalı")),
      gecmis: g?.gecmis.some((x) => x.rol === "kullanici" && x.metin === "pencereye git otur"),
    },
    { niyetler: [ONAY, git("pencere")], bitis: "hata", uyanis: 1, soz: true, not: true, gecmis: true },
  );
});

test("yeni emir adımı geçerse (iptal) refleks kesilir ve LLM'e dönmez", async () => {
  const { beyin, refleksler, soyle, sonuc } = kur({ gecmis: MASA_OTUR });
  await soyle("pencereye git otur");
  await sonuc(1, "iptal");
  assert.deepEqual({ bitis: refleksler()[0]?.bitis, uyanis: beyin.gordugu.length }, { bitis: "kesildi", uyanis: 0 });
});

test("sonuç gelmezse zaman aşımı: refleks biter, söz LLM'e döner", async () => {
  const { beyin, refleksler, soyle } = kur({ gecmis: PENCERE, zamanAsimiMs: 30 });
  await soyle("sandalyeye git");
  await bekle(80);
  assert.deepEqual({ bitis: refleksler()[0]?.bitis, uyanis: beyin.gordugu.length }, { bitis: "zaman_asimi", uyanis: 1 });
});

test("refleks sürerken yeni söz refleksi keser; eski adımın geç gelen sonucu kalan adımı göndermez", async () => {
  const { beyin, niyetler, refleksler, soyle, sonuc } = kur({ gecmis: MASA_OTUR });
  await soyle("pencereye git otur");
  await soyle("merhaba");
  await sonuc(1, "bitti");
  assert.deepEqual(
    { bitis: refleksler()[0]?.bitis, otur: niyetler.some((x) => x.n.tur === "otur"), uyanis: beyin.gordugu.length },
    { bitis: "kesildi", otur: false, uyanis: 1 },
  );
});

test("refleksin adım sonuçları beyne gitmez: kayıtta `kopru.refleks` kuralıyla, geçmedi", async () => {
  const { beyin, satirlar, soyle } = kur({ gecmis: PENCERE, otomatik: true });
  await soyle("sandalyeye git");
  const sonuclar = satirlar().filter((s): s is AlgiSatiri => s.tur === "algi" && s.algi === "sonuc");
  assert.deepEqual(
    { kapi: [...new Set(sonuclar.map((s) => `${s.kapi.gecti}:${s.kapi.kural}`))], adet: sonuclar.length, uyanis: beyin.gordugu.length },
    { kapi: ["false:kopru.refleks"], adet: 2, uyanis: 0 },
  );
});

test("refleks söz söylemez, komut göndermez: yalnız onay jesti ve bedensel adımlar", async () => {
  const { niyetler, soyle } = kur({ gecmis: MASA_OTUR, otomatik: true });
  await soyle("pencereye git otur");
  assert.deepEqual([...new Set(niyetler.map((x) => niyetSinifi(x.n.tur)))], ["bedensel"]);
});

test("kesin olmayan sözde (ara tanıma) refleks yok", async () => {
  const { niyetler, refleksler, soyle } = kur({ gecmis: PENCERE, otomatik: true });
  await soyle("sandalyeye git", false);
  assert.deepEqual({ niyet: niyetler.length, refleks: refleksler().length }, { niyet: 0, refleks: 0 });
});

// ── Refleks ve hafıza ──────────────────────────────────────────────────────

test("onay jesti adım değildir: başarılı refleksten sonra beceri tek, başarı 2", async () => {
  const { k, soyle } = kur({ gecmis: PENCERE, otomatik: true });
  await soyle("sandalyeye git");
  assert.deepEqual(k.beceriHafizasi.beceriler.map((b) => b.sayac), [{ basari: 2, hata: 0 }]);
});

test("refleksin hatası becerinin payını düşürür; askıya alınan becerili söz LLM'e gider", async () => {
  const { k, beyin, refleksler, soyle, sonuc } = kur({ gecmis: PENCERE });
  await soyle("sandalyeye git");
  await sonuc(1, "hata", "yol kapalı");
  const uyanisOnce = beyin.gordugu.length;
  await soyle("kapıya git");
  assert.deepEqual(
    { sayac: k.beceriHafizasi.beceriler[0]?.sayac, refleks: refleksler().length, yeniUyanis: beyin.gordugu.length - uyanisOnce },
    { sayac: { basari: 1, hata: 1 }, refleks: 1, yeniUyanis: 1 },
  );
});

test("başarılı reflekste söz konuşma geçmişine girmez: LLM sonraki turda cevapsız bir istek görmez", async () => {
  const { beyin, soyle } = kur({ gecmis: PENCERE, otomatik: true, beyin: new SahteBeyin() });
  await soyle("sandalyeye git");
  await soyle("merhaba");
  assert.deepEqual(beyin.gordugu[0]?.gecmis.map((x) => x.metin), ["merhaba"]);
});

test("canlı = kayıt, refleksle: refleks turlarından sonra canlı hafıza kayıttan kurulana eşit", async () => {
  const { k, satirlar, soyle, sonuc, niyetler } = kur({ gecmis: PENCERE });
  await soyle("sandalyeye git");
  await sonuc(1, "bitti");
  await soyle("kapıya git");
  await sonuc(niyetler.length - 1, "hata", "kapı kilitli");
  const kayittan = beceriHafizasiKur(gorevler(zincirKur([...PENCERE, ...satirlar()])));
  assert.equal(JSON.stringify(k.beceriHafizasi.beceriler), JSON.stringify(kayittan.beceriler));
});

// ── Kenarlar ───────────────────────────────────────────────────────────────

test("doğrulayıcı atlanmaz: kayıttan gelen geçersiz adım gönderilmez, refleks hatayla biter, söz LLM'e döner", async () => {
  // Kayıt elle bozulmuş gibi: geçersiz poz. Doğrulayıcı reddeder (protocol/dogrula.ts).
  const bozuk = gecmisOturum(["havalan", [{ tur: "poz", poz: "uçuyor" } as unknown as Niyet]]);
  const { beyin, niyetler, refleksler, soyle } = kur({ gecmis: bozuk, otomatik: true });
  await soyle("havalan");
  assert.deepEqual(
    { niyetler: niyetler.map((x) => json(x.n)), bitis: refleksler()[0]?.bitis, uyanis: beyin.gordugu.length },
    { niyetler: [ONAY], bitis: "hata", uyanis: 1 },
  );
});

test("onay jestinin sonucu adımı ilerletmez: yalnız beklenen adımın sonucu ilerletir", async () => {
  const { niyetler, soyle, sonuc } = kur({ gecmis: MASA_OTUR });
  await soyle("pencereye git otur");
  await sonuc(0, "bitti");
  assert.deepEqual(niyetler.map((x) => json(x.n)), [ONAY, git("pencere")]);
});

test("ara durum (basladi) refleksi ne ilerletir ne keser", async () => {
  const { niyetler, refleksler, soyle, k } = kur({ gecmis: MASA_OTUR });
  await soyle("pencereye git otur");
  k.sonuc({ niyet_id: niyetler[1]!.id, durum: "basladi" });
  await bekle(40);
  assert.deepEqual({ niyet: niyetler.length, refleks: refleksler().length }, { niyet: 2, refleks: 0 });
});

test("durdurulan köprü süren refleksi keser: satırı `kesildi` olarak yazılır", async () => {
  const { k, refleksler, soyle } = kur({ gecmis: PENCERE });
  await soyle("sandalyeye git");
  k.durdur();
  assert.deepEqual(refleksler().map((r) => r.bitis), ["kesildi"]);
});
