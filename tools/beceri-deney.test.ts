// tools/beceri-deney.test.ts — Beceri ölçümünün KALİBRASYONU (Themis 1.1): ölçü, cevabı
// bilinen politikalarda sınanır; sonra gerçek hafıza cevabı bilinen görev akışlarında.
//
//   taban      "hic"        hiç eşleşmez                  → kapsam 0
//   tavan      "kahin"      her görevde LLM'in adımları    → kapsam %100, uyum %100
//   alışkanlık sabit adımlar her görevde aynı adımlar     → kapsam %100, uyum = o adımlı görevlerin payı
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BeceriHafizasi } from "../mind/beceriHafizasi.ts";
import { sozAnahtari, type GorevOrnegi, type GorevSonucu } from "../mind/gorev.ts";
import { KARAR_ONEKI, KararKaydi, niyetKaydi, type KararSatiri, type UyanisBilgisi } from "../mind/kararKaydi.ts";
import type { Niyet } from "../protocol/niyet.ts";
import { golgeDenetimi, kayittanOlc, olc } from "./beceri-deney.ts";
import { Kopru } from "../bridge/kopru.ts";
import { KuralRefleksi, refleksGirdisi } from "../mind/refleks.ts";
import { kayitOku } from "../mind/kararZinciri.ts";

const git = (ad: string): Niyet => ({ tur: "git", hedef: { tip: "capa", ad } });
const OTUR: Niyet = { tur: "otur" };

/** Bir görev örneği: adımların hepsi bitti; sonuç, zaman, süre, kaynak ve eşlik sayısı verilir. */
function gorev(soz: string, adimlar: Niyet[], t: number, ek: { sonuc?: GorevSonucu; sureMs?: number; kaynak?: GorevOrnegi["kaynak"]; eslik?: number } = {}): GorevOrnegi {
  return {
    kaynak: ek.kaynak ?? "uyanis", kimlik: `o1/u${t}`, t, soz, anahtar: sozAnahtari(soz)!,
    adimlar: adimlar.map((govde) => ({ govde, durum: "bitti" as const })), eslik: ek.eslik ?? 0,
    sonuc: ek.sonuc ?? "basari", sureMs: ek.sureMs ?? 1000,
  };
}

/** Dört görev: üçünün adımı [git, otur], birininki [otur]. Süreler 1, 2, 3, 4 sn. */
const DORT = [
  gorev("masaya git otur", [git("masa"), OTUR], 1, { sureMs: 1000 }),
  gorev("pencereye git otur", [git("pencere"), OTUR], 2, { sureMs: 2000 }),
  gorev("sandalyeye otur", [OTUR], 3, { sureMs: 3000 }),
  gorev("kapıya git otur", [git("kapi"), OTUR], 4, { sureMs: 4000 }),
];

// ── Kalibrasyon: bilinen cevaplı politikalar ───────────────────────────────

test("kalibrasyon, taban (hiç eşleşmez): kapsam 0, kazanç 0", () => {
  const o = olc("hic", DORT);
  assert.deepEqual({ gorev: o.gorev, eslesen: o.eslesen, kazancMs: o.kazancMs }, { gorev: 4, eslesen: 0, kazancMs: 0 });
});

test("kalibrasyon, tavan (kâhin): kapsam 4/4, uyum 4/4, kazanç bütün süre", () => {
  const o = olc("kahin", DORT);
  assert.deepEqual({ eslesen: o.eslesen, uyumlu: o.uyumlu, kazancMs: o.kazancMs }, { eslesen: 4, uyumlu: 4, kazancMs: 10_000 });
});

test("kalibrasyon, alışkanlık [otur]: kapsam 4/4, uyum yalnız adımı [otur] olan görevde (1/4)", () => {
  const o = olc({ aliskanlik: [OTUR] }, DORT);
  assert.deepEqual({ eslesen: o.eslesen, uyumlu: o.uyumlu }, { eslesen: 4, uyumlu: 1 });
});

test("kalibrasyon, güvensiz adım: komut veren alışkanlığın her eşleşmesi güvensiz sayılır", () => {
  const o = olc({ aliskanlik: [{ tur: "komut", metin: "dir", gerekce: "g" }] }, DORT);
  assert.equal(o.guvensizAdim, 4);
});

test("kalibrasyon, güvensiz adım: bedensel adımlı politikada 0", () => {
  assert.equal(olc("kahin", DORT).guvensizAdim, 0);
});

// ── Gerçek hafıza, cevabı bilinen akışlar ──────────────────────────────────

test("aynı görev 5 kez: ilk kez eşleşmez (sıralı), sonraki 4'ü eşleşir ve uyar", () => {
  const akis = [1, 2, 3, 4, 5].map((t) => gorev("masaya git otur", [git("masa"), OTUR], t));
  const o = olc(new BeceriHafizasi(), akis);
  assert.deepEqual({ gorev: o.gorev, eslesen: o.eslesen, uyumlu: o.uyumlu }, { gorev: 5, eslesen: 4, uyumlu: 4 });
});

test("kazanç: eşleşen görevlerin LLM süresi toplanır (ilk görevinki hariç)", () => {
  const akis = [1, 2, 3].map((t) => gorev("masaya git otur", [git("masa"), OTUR], t, { sureMs: 1000 * t }));
  assert.equal(olc(new BeceriHafizasi(), akis).kazancMs, 5000);
});

test("hepsi farklı çerçeve: hiçbiri eşleşmez", () => {
  const akis = [
    gorev("masaya git", [git("masa")], 1),
    gorev("pencereye bak", [{ tur: "bak", hedef: { tip: "capa", ad: "pencere" } }], 2),
    gorev("sandalyeye otur", [OTUR], 3),
  ];
  assert.equal(olc(new BeceriHafizasi(), akis).eslesen, 0);
});

test("aynı çerçeve başka çapa: yuva üzerinden eşleşir ve uyar (3 görevde 2)", () => {
  const akis = [
    gorev("masaya git otur", [git("masa"), OTUR], 1),
    gorev("pencereye git otur", [git("pencere"), OTUR], 2),
    gorev("kapıya git otur", [git("kapi"), OTUR], 3),
  ];
  const o = olc(new BeceriHafizasi(), akis);
  assert.deepEqual({ eslesen: o.eslesen, uyumlu: o.uyumlu }, { eslesen: 2, uyumlu: 2 });
});

test("LLM aynı söze iki tarifi sırayla verirse beceri hep öbürünü önerir: 3 eşleşme, 0 uyum", () => {
  // t1 [git,otur] doğar · t2 [otur] önerilen [git,otur] (tek beceri), [otur] doğar ·
  // t3 eşit başarı, en yeni [otur] önerilir · t4 [git,otur] 2 başarıyla önde, önerilir.
  const akis = [
    gorev("masaya otur", [git("masa"), OTUR], 1),
    gorev("masaya otur", [OTUR], 2),
    gorev("masaya otur", [git("masa"), OTUR], 3),
    gorev("masaya otur", [OTUR], 4),
  ];
  const o = olc(new BeceriHafizasi(), akis);
  assert.deepEqual({ eslesen: o.eslesen, uyumlu: o.uyumlu }, { eslesen: 3, uyumlu: 0 });
});

test("askıdaki beceri eşleşmez: başarı, sonra hata (eşleşir, LLM de başaramadı), sonra askıda", () => {
  const akis = [
    gorev("masaya otur", [OTUR], 1),
    gorev("masaya otur", [OTUR], 2, { sonuc: "hata" }),
    gorev("masaya otur", [OTUR], 3),
  ];
  const o = olc(new BeceriHafizasi(), akis);
  assert.deepEqual({ eslesen: o.eslesen, sonuc: o.eslesenSonuc }, { eslesen: 1, sonuc: { basari: 0, hata: 1, belirsiz: 0 } });
});

test("refleks yürütümü hafızayı besler ama ölçüye girmez: beceri kendini doğrulamaz", () => {
  const akis = [
    gorev("masaya otur", [OTUR], 1, { kaynak: "refleks" }),
    gorev("masaya otur", [OTUR], 2),
  ];
  const o = olc(new BeceriHafizasi(), akis);
  assert.deepEqual({ gorev: o.gorev, eslesen: o.eslesen, uyumlu: o.uyumlu }, { gorev: 1, eslesen: 1, uyumlu: 1 });
});

test("sıra: görevler karışık gelse de zaman sırasıyla ölçülür", () => {
  const akis = [1, 2, 3].map((t) => gorev("masaya git otur", [git("masa"), OTUR], t, { sureMs: 1000 * t }));
  assert.deepEqual(olc(new BeceriHafizasi(), [...akis].reverse()), olc(new BeceriHafizasi(), akis));
});

test("eşlik: eşleşen görevde LLM konuştu ya da sorduysa ayrıca sayılır (refleks orada sessiz kalırdı)", () => {
  const akis = [
    gorev("masaya otur", [OTUR], 1, { eslik: 1 }),
    gorev("masaya otur", [OTUR], 2, { eslik: 1 }),
    gorev("masaya otur", [OTUR], 3),
  ];
  assert.equal(olc(new BeceriHafizasi(), akis).eslikli, 1);
});

test("eşleşme dökümü: görev, söz, beceri, uyum, LLM'in eşliği ve sonucu", () => {
  const akis = [gorev("masaya otur", [OTUR], 1), gorev("masaya otur", [OTUR], 2, { eslik: 2 })];
  const h = new BeceriHafizasi();
  const o = olc(h, akis);
  assert.deepEqual(o.eslesmeler, [{ gorev: "o1/u2", soz: "masaya otur", beceri: h.beceriler[0]!.id, uyum: true, eslik: 2, sonuc: "basari" }]);
});

test("ölçü sonunda hafızadaki beceri sayısı", () => {
  assert.equal(olc(new BeceriHafizasi(), DORT).beceri, 2);
});

// ── Uçtan uca: gerçek kayıt yazıcısının dosyasından ────────────────────────

const UYANIS: UyanisBilgisi = {
  algilar: [], geriBesleme: 0, beyin: "sahte", sureMs: 2500, koken: "dis", takip: false,
  anilar: 0, dunya: "oda", cagrilar: [], niyetler: [], reddedilen: 0, kurtarilan: 0,
  konusulanMetin: false, yutulanSoz: 0,
};

test("uçtan uca: kayıt dosyasından iki kez söylenen görev → 1 eşleşme, uyumlu, kazanç bir uyanış", () => {
  const klasor = fs.mkdtempSync(path.join(os.tmpdir(), "beceri-deney-"));
  try {
    let t = 0;
    const satirlar: string[] = [];
    const k = new KararKaydi({ oturum: "o1", simdi: () => t, yaz: (s) => satirlar.push(s.slice(KARAR_ONEKI.length + 1)) });
    k.oturumBasi("sahte");
    for (const tur of [1, 2]) {
      t = tur * 10_000;
      const soz = k.algi({ tur: "duydum", metin: "masaya git otur", kesin: true }, "ozet", { gecti: true, kural: "kopru.konusma" });
      k.uyanis({ ...UYANIS, algilar: [soz], niyetler: [niyetKaydi(`n${tur}_1`, git("masa")), niyetKaydi(`n${tur}_2`, OTUR)] });
      for (const [i, durum] of (["iptal", "bitti"] as const).entries()) {
        k.algi({ tur: "sonuc", sonuc: { niyet_id: `n${tur}_${i + 1}`, durum } }, "ozet", { gecti: false, kural: "refleks.sonuc.rutin" });
      }
    }
    fs.writeFileSync(path.join(klasor, "o1.jsonl"), `${satirlar.join("\n")}\n`, "utf8");
    const r = kayittanOlc([klasor]);
    assert.deepEqual(
      { dosya: r.dosyalar.length, uyanis: r.uyanis, gorev: r.olcum.gorev, eslesen: r.olcum.eslesen, uyumlu: r.olcum.uyumlu, kazancMs: r.olcum.kazancMs },
      { dosya: 1, uyanis: 2, gorev: 2, eslesen: 1, uyumlu: 1, kazancMs: 2500 },
    );
  } finally {
    fs.rmSync(klasor, { recursive: true, force: true });
  }
});

// ── Gölge denetimi: canlı = kayıt (B11) ────────────────────────────────────

/** Gerçek köprüyle bir oturum: sahte beyin her söze sıradaki `git <çapa>`yı verir, dünya hemen `bitti` der. */
async function kopruOturumu(sozler: [string, string][], ayar: { oturum: string; saat: number; gecmis?: readonly KararSatiri[] }): Promise<KararSatiri[]> {
  let saat = ayar.saat;
  const metin: string[] = [];
  const cevaplar = sozler.map(([, capa]) => ({ metin: "", cagrilar: [{ ad: "dunya_git", girdi: { hedef: { tip: "capa", ad: capa } } }] }));
  const beyin = { ad: "sahte", hazirMi: async () => true, dusun: async () => cevaplar.shift() ?? { metin: "", cagrilar: [] } };
  const refleks = new KuralRefleksi();
  let k: Kopru;
  k = new Kopru({
    beyin,
    niyetGonder: (_n, id) => queueMicrotask(() => k.sonuc({ niyet_id: id, durum: "bitti" })),
    dunyaDurumu: () => "Oda.", toplamaMs: 10, simdi: () => saat,
    dikkat: { simdi: () => (saat += 10_000) },
    suzgec: (a, ozet) => { const r = refleks.karar(refleksGirdisi(a, ozet)); return { gecsin: r.terfi, kural: r.kural, gerekce: r.gerekce }; },
    kararKaydi: new KararKaydi({ yaz: (s) => metin.push(s.slice(KARAR_ONEKI.length + 1)), simdi: () => (saat += 1), oturum: ayar.oturum }),
    ...(ayar.gecmis ? { gorevSatirlari: ayar.gecmis } : {}),
  });
  for (const [soz] of sozler) {
    k.algi({ tur: "duydum", metin: soz, kesin: true });
    await new Promise((r) => setTimeout(r, 80));
  }
  k.durdur();
  return kayitOku(metin.join("\n")).satirlar;
}

test("gölge denetimi: köprünün yazdığı her gölge, kayıttan aynı sırayla yeniden hesaplanınca aynı", async () => {
  const satirlar = await kopruOturumu([["pencereye git", "pencere"], ["sandalyeye git", "sandalye"], ["masaya git", "masa"]], { oturum: "o1", saat: 1_000_000 });
  const d = golgeDenetimi(satirlar);
  assert.deepEqual({ golgeli: d.golgeli, eslesen: d.eslesen, ayni: d.ayni }, { golgeli: 3, eslesen: 2, ayni: 3 });
});

test("gölge denetimi, iki oturum: ikincinin geçmişi birincinin satırları (köprünün açılışta okuduğu gibi)", async () => {
  const bir = await kopruOturumu([["pencereye git", "pencere"]], { oturum: "o1", saat: 1_000_000 });
  const iki = await kopruOturumu([["sandalyeye git", "sandalye"]], { oturum: "o2", saat: 2_000_000, gecmis: bir });
  const d = golgeDenetimi([...bir, ...iki]);
  assert.deepEqual({ golgeli: d.golgeli, eslesen: d.eslesen, ayni: d.ayni }, { golgeli: 2, eslesen: 1, ayni: 2 });
});

test("gölge denetimi farkı yakalar (kalibrasyon): kayıttaki gölge bozulursa o söz farklı sayılır", async () => {
  const satirlar = await kopruOturumu([["pencereye git", "pencere"], ["sandalyeye git", "sandalye"]], { oturum: "o1", saat: 1_000_000 });
  const bozuk = satirlar.map((s) => (s.tur === "algi" && s.beceriGolge ? { ...s, beceriGolge: { ...s.beceriGolge, adimlar: [] } } : s));
  const d = golgeDenetimi(bozuk);
  assert.deepEqual({ ayni: d.ayni, farkli: d.farkli.map((f) => f.soz) }, { ayni: 1, farkli: ["sandalyeye git"] });
});

test("gölge denetimi: oturum sırası satır sırasından değil zamandan (dosyalar karışık verilse de)", async () => {
  const bir = await kopruOturumu([["pencereye git", "pencere"]], { oturum: "o1", saat: 1_000_000 });
  const iki = await kopruOturumu([["sandalyeye git", "sandalye"]], { oturum: "o2", saat: 2_000_000, gecmis: bir });
  assert.equal(golgeDenetimi([...iki, ...bir]).ayni, 2);
});

test("uçtan uca gölge: köprü oturumunun kayıt dosyası okununca gölgeler denetlenir, hepsi aynı", async () => {
  const klasor = fs.mkdtempSync(path.join(os.tmpdir(), "beceri-deney-golge-"));
  try {
    const satirlar = await kopruOturumu([["pencereye git", "pencere"], ["sandalyeye git", "sandalye"]], { oturum: "o1", saat: 1_000_000 });
    fs.writeFileSync(path.join(klasor, "o1.jsonl"), `${satirlar.map((s) => JSON.stringify(s)).join("\n")}\n`, "utf8");
    const g = kayittanOlc([klasor]).golge;
    assert.deepEqual({ golgeli: g.golgeli, eslesen: g.eslesen, ayni: g.ayni }, { golgeli: 2, eslesen: 1, ayni: 2 });
  } finally {
    fs.rmSync(klasor, { recursive: true, force: true });
  }
});
