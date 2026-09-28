// mind/gorev.test.ts — Görev (spec 10): Ozyn'in tek bir kesin sözüyle başlayan, bedensel
// niyetlerle yapılan iş. Anahtar, başarı ve kayıttan çıkarma.
//
// Kayıt satırları gerçek `KararKaydi`dan üretilir: okuyucu yazıcının biçimiyle kayarsa
// bu testler düşer (mind/kararZinciri.test.ts ile aynı ilke).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { KARAR_ONEKI, KararKaydi, niyetKaydi, type KararSatiri, type UyanisBilgisi } from "./kararKaydi.ts";
import { kayitOku, zincirKur } from "./kararZinciri.ts";
import { gorevler, gorevSatiriMi, gorevSonucu, niyetSinifi, sozAnahtari, zamanSirali } from "./gorev.ts";
import type { Niyet, NiyetTur } from "../protocol/niyet.ts";

// ── Niyet sınıfları ────────────────────────────────────────────────────────

test("her niyet türü tek bir sınıfta: bedensel tekrar edilir, eşlik eden atlanır, engel beceriyi durdurur", () => {
  const turler: NiyetTur[] = ["git", "otur", "kalk", "bak", "al", "birak", "dur", "jest", "poz", "odaklan", "soyle", "sor", "yaz", "komut"];
  assert.deepEqual(Object.fromEntries(turler.map((t) => [t, niyetSinifi(t)])), {
    git: "bedensel", otur: "bedensel", kalk: "bedensel", bak: "bedensel", al: "bedensel", birak: "bedensel",
    dur: "bedensel", jest: "bedensel", poz: "bedensel", odaklan: "bedensel",
    soyle: "eslik", sor: "eslik",
    yaz: "engel", komut: "engel",
  });
});

// ── Söz anahtarı ───────────────────────────────────────────────────────────

test("anahtar: çapa adı yuva olur, kalan sözcükler çerçeve", () => {
  assert.deepEqual(sozAnahtari("masaya git otur"), { cerceve: ["git", "otur"], yuvalar: ["masa"] });
});

test("anahtar: sözcük sırası çerçeveyi değiştirmez", () => {
  assert.deepEqual(sozAnahtari("git masaya otur"), sozAnahtari("masaya git otur"));
});

test("anahtar: büyük harf ve Türkçe karakter katlanır (Şemaya → sema)", () => {
  assert.deepEqual(sozAnahtari("Şemaya GİT"), { cerceve: ["git"], yuvalar: ["sema"] });
});

test("anahtar: iki yuva sözdeki sırayla tutulur", () => {
  assert.deepEqual(sozAnahtari("masadan pencereye git")?.yuvalar, ["masa", "pencere"]);
});

test("anahtar: çapa adının ekli biçimleri aynı yuvaya gider (ızgara)", () => {
  const izgara: Record<string, string> = {
    masa: "masa", masaya: "masa", masada: "masa", masadan: "masa", "masayı": "masa", "masanın": "masa",
    masayla: "masa", "masası": "masa", "masasına": "masa", "masasında": "masa", "masasından": "masa", "masasını": "masa",
    pencereye: "pencere", pencerede: "pencere", "penceresine": "pencere",
    "kapıya": "kapi", "kapıdan": "kapi", "kapıyı": "kapi", "kapısı": "kapi",
    tahtaya: "tahta", "tahtasına": "tahta",
    "monitöre": "monitor", "monitörde": "monitor", "monitörden": "monitor", "monitörü": "monitor", "monitörün": "monitor",
    "günlüğe": "gunluk", "günlükte": "gunluk", "günlüğü": "gunluk",
    sandalyeye: "sandalye", "sandalyesine": "sandalye", admine: "admin",
  };
  const bulunan = Object.fromEntries(Object.keys(izgara).map((w) => [w, sozAnahtari(`${w} git`)?.yuvalar[0] ?? "(yok)"]));
  assert.deepEqual(bulunan, izgara);
});

test("anahtar: çapa adıyla başlayan ama çapa olmayan sözcük çerçevede kalır (masal, masaj, kapital, semaver, tahtalar)", () => {
  const yuvalar = ["masal anlat", "masaj yap", "kapital oku", "semaver getir", "tahtalar boya"].map((s) => sozAnahtari(s)?.yuvalar);
  assert.deepEqual(yuvalar, [[], [], [], [], []]);
});

test("anahtar: dolgu ve rica sözcükleri çerçeveye girmez (Orion, lütfen, hadi, bir, ve)", () => {
  assert.deepEqual(sozAnahtari("Hadi Orion lütfen bir masaya git ve otur")?.cerceve, sozAnahtari("masaya git otur")?.cerceve);
});

test("anahtar: iki kelimelik iç ad (oda_ortasi) v1'de yuva olmaz, sözcükleri çerçevede kalır", () => {
  assert.deepEqual(sozAnahtari("odanın ortasına git"), { cerceve: ["git", "odanin", "ortasina"], yuvalar: [] });
});

test("anahtar: iki harfli fiil çerçevededir, kupayı al ile kupayı at ayrı anahtar", () => {
  assert.deepEqual([sozAnahtari("kupayı al")?.cerceve, sozAnahtari("kupayı at")?.cerceve], [["al", "kupayi"], ["at", "kupayi"]]);
});

test("anahtar: uzun söz kesilmez, 16 sözcükten sonraki çapa ve fiil de anahtarda", () => {
  const uzun = Array.from("abcdefghijklmnop", (h) => `kelime${h}`).join(" ");
  const a = sozAnahtari(`${uzun} masaya git`);
  assert.deepEqual({ cerceve: a?.cerceve.length, git: a?.cerceve.includes("git"), yuvalar: a?.yuvalar }, { cerceve: 17, git: true, yuvalar: ["masa"] });
});

test("anahtar: aynı sözcük iki kez tek yuvadır (masaya git, masaya otur)", () => {
  assert.deepEqual(sozAnahtari("masaya git, masaya otur"), { cerceve: ["git", "otur"], yuvalar: ["masa"] });
});

test("anahtar yok: aynı çapa iki ayrı yuvada (masaya git masada otur): bağ belirsiz", () => {
  assert.equal(sozAnahtari("masaya git masada otur"), null);
});

test("anahtar yok: çerçeve boş (yalnız çapa adı)", () => {
  assert.equal(sozAnahtari("Masaya!"), null);
});

// ── Zaman sırası ───────────────────────────────────────────────────────────

test("zaman sırası: küçük t önce, eşit t'de verilen sıra korunur", () => {
  const liste = [{ t: 2, ad: "a" }, { t: 1, ad: "b" }, { t: 2, ad: "c" }, { t: 1, ad: "d" }];
  assert.deepEqual(zamanSirali(liste).map((x) => x.ad), ["b", "d", "a", "c"]);
});

// ── Görev sonucu ───────────────────────────────────────────────────────────

test("görev sonucu (ızgara): hata varsa hata; son adım bitti ve hepsi geldiyse başarı; yoksa belirsiz", () => {
  type D = "bitti" | "iptal" | "hata" | undefined;
  const izgara: [D[], string][] = [
    [["bitti"], "basari"],
    [["iptal", "bitti"], "basari"],
    [["hata", "bitti"], "hata"],
    [["bitti", "hata"], "hata"],
    [["bitti", undefined], "belirsiz"],
    [[undefined, "bitti"], "belirsiz"],
    [["bitti", "iptal"], "belirsiz"],
    [[], "belirsiz"],
  ];
  assert.deepEqual(izgara.map(([d]) => gorevSonucu(d.map((durum) => ({ durum })))), izgara.map(([, s]) => s));
});

// ── Kayıttan görev çıkarma ─────────────────────────────────────────────────

const UYANIS: UyanisBilgisi = {
  algilar: [], geriBesleme: 0, beyin: "sahte", sureMs: 2700, koken: "dis", takip: false,
  anilar: 0, dunya: "oda", cagrilar: [], niyetler: [], reddedilen: 0, kurtarilan: 0,
  konusulanMetin: false, yutulanSoz: 0,
};
const GECTI = { gecti: true, kural: "kopru.konusma" } as const;
const GIT_MASA: Niyet = { tur: "git", hedef: { tip: "capa", ad: "masa" } };
const OTUR: Niyet = { tur: "otur" };

/** Gerçek kayıtla bir söz + uyanış + sonuçlar yazar; görevleri döner. */
function kayittanGorev(ayar: {
  soz?: string; kesin?: boolean; niyetler?: Niyet[]; durumlar?: ("bitti" | "iptal" | "hata" | null)[];
  koken?: "dis" | "inisiyatif"; ekTetik?: boolean; govdesiz?: boolean; geriBesleme?: number;
  /** Satırlar host'un okuduğu gibi süzülür (`gorevSatiriMi`): tetikleyen olay satırı düşer. */
  suz?: boolean;
}) {
  const satirlar: string[] = [];
  const k = new KararKaydi({ oturum: "o1", simdi: () => 1_000, yaz: (s) => satirlar.push(s.slice(KARAR_ONEKI.length + 1)) });
  k.oturumBasi("sahte");
  const algilar = [k.algi({ tur: "duydum", metin: ayar.soz ?? "masaya git otur", kesin: ayar.kesin ?? true }, "ozet", GECTI)];
  if (ayar.ekTetik) algilar.push(k.algi({ tur: "olay", ad: "oyuncu_odaya_girdi" }, "ozet", { gecti: true, kural: "refleks.olay.dunya" }));
  const niyetler = (ayar.niyetler ?? [GIT_MASA, OTUR]).map((n, i) => (ayar.govdesiz ? { id: `n_${i}`, tur: n.tur } : niyetKaydi(`n_${i}`, n)));
  k.uyanis({ ...UYANIS, algilar, niyetler, koken: ayar.koken ?? "dis", geriBesleme: ayar.geriBesleme ?? 0 });
  (ayar.durumlar ?? ["iptal", "bitti"]).forEach((durum, i) => {
    if (durum) k.algi({ tur: "sonuc", sonuc: { niyet_id: `n_${i}`, durum } }, `Intent n_${i} → ${durum}`, { gecti: false, kural: "refleks.sonuc.rutin" });
  });
  const okunan = kayitOku(satirlar.join("\n")).satirlar;
  return gorevler(zincirKur(ayar.suz ? okunan.filter(gorevSatiriMi) : okunan));
}

test("tek kesin sözle tetiklenen, son adımı bitti olan uyanış bir başarılı görevdir", () => {
  const [g] = kayittanGorev({});
  assert.deepEqual(
    { kaynak: g?.kaynak, kimlik: g?.kimlik, soz: g?.soz, anahtar: g?.anahtar, adimlar: g?.adimlar, eslik: g?.eslik, sonuc: g?.sonuc, sureMs: g?.sureMs },
    {
      kaynak: "uyanis", kimlik: "o1/u1", soz: "masaya git otur", anahtar: { cerceve: ["git", "otur"], yuvalar: ["masa"] },
      adimlar: [{ govde: GIT_MASA, durum: "iptal" }, { govde: OTUR, durum: "bitti" }], eslik: 0, sonuc: "basari", sureMs: 2700,
    },
  );
});

test("eşlik eden niyetler (söz, sorgu) adım olmaz, sayıları görevde durur", () => {
  const [g] = kayittanGorev({ niyetler: [{ tur: "soyle", metin: "Tamam." }, { tur: "sor", ne: "yakin" }, GIT_MASA], durumlar: [null, null, "bitti"] });
  assert.deepEqual({ adimlar: g?.adimlar.map((a) => a.govde.tur), eslik: g?.eslik }, { adimlar: ["git"], eslik: 2 });
});

test("görev doğmaz: sözün anahtarı yok (aynı çapa iki yuvada)", () => {
  assert.equal(kayittanGorev({ soz: "masaya git masada otur" }).length, 0);
});

test("görev doğmaz: yaz içeren uyanış (yazının içeriği sözden gelir)", () => {
  assert.equal(kayittanGorev({ niyetler: [GIT_MASA, { tur: "yaz", metin: "x" }], durumlar: ["bitti", "bitti"] }).length, 0);
});

test("görev doğmaz: komut içeren uyanış (kabuk komutu kendiliğinden tekrarlanmaz)", () => {
  assert.equal(kayittanGorev({ niyetler: [GIT_MASA, { tur: "komut", metin: "dir", gerekce: "g" }], durumlar: ["bitti", "bitti"] }).length, 0);
});

test("görev doğmaz: bedensel niyeti olmayan uyanış (yalnız söz)", () => {
  assert.equal(kayittanGorev({ niyetler: [{ tur: "soyle", metin: "Merhaba." }], durumlar: [null] }).length, 0);
});

test("görev doğmaz: iki algıyla tetiklenen uyanış (tetik belirsiz)", () => {
  assert.equal(kayittanGorev({ ekTetik: true }).length, 0);
});

test("görev doğmaz: iki algıyla tetiklenen uyanış, öbür algının satırı süzülüp okunmamış olsa da", () => {
  assert.equal(kayittanGorev({ ekTetik: true, suz: true }).length, 0);
});

test("görev doğmaz: tetikte geri besleme de var (reddedilen çağrının düzeltme turu)", () => {
  assert.equal(kayittanGorev({ geriBesleme: 1 }).length, 0);
});

test("süzülmüş okuma görev kaybetmez: tek sözlü görev süzülünce de aynı", () => {
  assert.deepEqual(kayittanGorev({ suz: true }), kayittanGorev({}));
});

test("görev satırı seçimi (ızgara): uyanış, söz ve sonuç satırları; başka algı, oturum ve öğretim değil", () => {
  const satir = (x: object) => x as KararSatiri;
  const izgara: [KararSatiri, boolean][] = [
    [satir({ tur: "uyanis" }), true],
    [satir({ tur: "algi", algi: "duydum" }), true],
    [satir({ tur: "algi", algi: "sonuc" }), true],
    [satir({ tur: "algi", algi: "terminal" }), false],
    [satir({ tur: "algi", algi: "olay" }), false],
    [satir({ tur: "algi", algi: "gordum" }), false],
    [satir({ tur: "oturum" }), false],
    [satir({ tur: "ogretim" }), false],
  ];
  assert.deepEqual(izgara.map(([s]) => gorevSatiriMi(s)), izgara.map(([, b]) => b));
});

test("görev doğmaz: kesin olmayan söz (ara tanıma)", () => {
  assert.equal(kayittanGorev({ kesin: false }).length, 0);
});

test("görev doğmaz: inisiyatif kökenli uyanış (Orion'un kendi girişimi)", () => {
  assert.equal(kayittanGorev({ koken: "inisiyatif" }).length, 0);
});

test("görev doğmaz: gövdesiz eski satır (Faz A öncesi)", () => {
  assert.equal(kayittanGorev({ govdesiz: true }).length, 0);
});

test("görev doğmaz: çerçevesi boş söz (yalnız çapa adı)", () => {
  assert.equal(kayittanGorev({ soz: "masa" }).length, 0);
});

test("hata veren görev de çıkarılır (sayaç için), sonucu hata", () => {
  const [g] = kayittanGorev({ durumlar: ["hata", null] });
  assert.equal(g?.sonuc, "hata");
});
