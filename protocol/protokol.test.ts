// protocol/protokol.test.ts — Sözleşmenin kendisi test edilir.
// Buradaki testler "LLM ne uydurursa uydursun dünya çökmez" iddiasını ölçer.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { niyetDogrula, METIN_SINIRI } from "./dogrula.ts";
import { CAPALAR, CAPA_ETIKETLERI, capaCoz } from "./temel.ts";
import { POZLAR, JESTLER, SURELI_NIYETLER, okunurMu } from "./niyet.ts";
import { VARSAYILAN_KANAL, ozetle, OZET_ONEKI } from "./algi.ts";
import { zarfla, SURUM } from "./temel.ts";

test("geçerli poz kabul edilir", () => {
  const r = niyetDogrula({ tur: "poz", poz: "oturuyor" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.deger.tur, "poz");
});

test("sözlük dışı poz reddedilir ve geçerli listeyi söyler", () => {
  const r = niyetDogrula({ tur: "poz", poz: "zıplıyor" });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.hata, /zıplıyor/);
    assert.match(r.hata, /duruyor/); // hata mesajı çözümü içerir
  }
});

test("uydurulmuş niyet türü reddedilir", () => {
  const r = niyetDogrula({ tur: "ucmak", yukseklik: 10 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.hata, /bilinmeyen niyet türü/);
});

test("niyet nesne değilse çökmez", () => {
  for (const kotu of [null, undefined, 42, "poz", [], true]) {
    const r = niyetDogrula(kotu);
    assert.equal(r.ok, false, `${String(kotu)} kabul edildi`);
  }
});

test("git: hedef hatası açık raporlanır", () => {
  assert.equal(niyetDogrula({ tur: "git" }).ok, false);
  const r = niyetDogrula({ tur: "git", hedef: { tip: "nokta", x: 1, y: NaN, z: 3 } });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.hata, /sonlu sayı/);
});

test("git: geçerli nokta ve mesafe geçer", () => {
  const r = niyetDogrula({ tur: "git", hedef: { tip: "capa", ad: "tahta" }, mesafe: 1.2 });
  assert.equal(r.ok, true);
  if (r.ok && r.deger.tur === "git") assert.equal(r.deger.hedef.tip, "capa");
});

test("negatif mesafe reddedilir", () => {
  assert.equal(niyetDogrula({ tur: "git", hedef: { tip: "oyuncu" }, mesafe: -3 }).ok, false);
});

test("bak: null serbest bakış demektir, geçerlidir", () => {
  const r = niyetDogrula({ tur: "bak", hedef: null });
  assert.equal(r.ok, true);
});

// ── Çapa adı çözümü (BY39-2d) ──────────────────────────────────────────────
// LLM odadaki çapaları görünen etiketleriyle görür ("beyaz tahta") ve iç adı bazen yanlış
// yazar ("odanin_ortasi"; canlı, 2026-09-28). Doğrulayıcı bilinen biçimleri iç ada çevirir;
// bilinmeyeni olduğu gibi bırakır: dünya reddeder, hata metni LLM'e döner (bugünkü gibi).

test("capaCoz ızgarası: iç ad, etiket, büyük harf, Türkçe karakter ve boşluk/alt çizgi biçimleri iç ada çözülür", () => {
  const izgara: [string, string | null][] = [
    ["tahta", "tahta"], ["beyaz tahta", "tahta"], ["Beyaz Tahta", "tahta"], ["beyaz_tahta", "tahta"],
    ["çalışma masası", "masa"], ["calisma masasi", "masa"], ["masa", "masa"],
    ["odanın ortası", "oda_ortasi"], ["odanin_ortasi", "oda_ortasi"], ["oda_ortasi", "oda_ortasi"], ["oda ortasi", "oda_ortasi"],
    ["monitör", "monitor"], ["Monitor", "monitor"], ["kapı", "kapi"], ["KAPI", "kapi"],
    ["yönetim terminali", "admin"], ["beyin şeması", "sema"], ["beyin günlüğü", "gunluk"],
    ["  pencere ", "pencere"], ["sandalye", "sandalye"],
    ["mutfak", null], ["oda", null], ["tahtalar", null], ["", null],
  ];
  assert.deepEqual(izgara.map(([ad]) => capaCoz(ad)), izgara.map(([, c]) => c));
});

test("her çapanın etiketi kendi çapasına çözülür: iki çapa aynı biçime düşmez", () => {
  assert.deepEqual(CAPALAR.map((c) => capaCoz(CAPA_ETIKETLERI[c])), [...CAPALAR]);
});

test("doğrulayıcı çapa adını iç ada çevirir: git/bak/jest hedefi, otur ve odaklan çapası", () => {
  const sonuc = [
    niyetDogrula({ tur: "git", hedef: { tip: "capa", ad: "beyaz tahta" } }),
    niyetDogrula({ tur: "bak", hedef: { tip: "capa", ad: "Monitör" } }),
    niyetDogrula({ tur: "jest", jest: "işaret_ediyor", hedef: { tip: "capa", ad: "kapı" } }),
    niyetDogrula({ tur: "otur", capa: "Sandalye" }),
    niyetDogrula({ tur: "odaklan", capa: "beyin şeması" }),
  ].map((r) => (r.ok ? JSON.parse(JSON.stringify(r.deger)) : r.hata));
  assert.deepEqual(sonuc, [
    { tur: "git", hedef: { tip: "capa", ad: "tahta" } },
    { tur: "bak", hedef: { tip: "capa", ad: "monitor" } },
    { tur: "jest", jest: "işaret_ediyor", hedef: { tip: "capa", ad: "kapi" } },
    { tur: "otur", capa: "sandalye" },
    { tur: "odaklan", capa: "sema" },
  ]);
});

test("bilinmeyen çapa adı ve nesne adı doğrulayıcıdan olduğu gibi geçer (dünya karar verir)", () => {
  const sonuc = [
    niyetDogrula({ tur: "git", hedef: { tip: "capa", ad: "mutfak" } }),
    niyetDogrula({ tur: "git", hedef: { tip: "nesne", ad: "beyaz tahta" } }),
  ].map((r) => (r.ok ? JSON.parse(JSON.stringify(r.deger)) : r.hata));
  assert.deepEqual(sonuc, [
    { tur: "git", hedef: { tip: "capa", ad: "mutfak" } },
    { tur: "git", hedef: { tip: "nesne", ad: "beyaz tahta" } },
  ]);
});

test("soyle: boş metin reddedilir, sınır aşımı reddedilir", () => {
  assert.equal(niyetDogrula({ tur: "soyle", metin: "" }).ok, false);
  const uzun = niyetDogrula({ tur: "soyle", metin: "a".repeat(METIN_SINIRI + 1) });
  assert.equal(uzun.ok, false);
  if (!uzun.ok) assert.match(uzun.hata, /çok uzun/);
  assert.equal(niyetDogrula({ tur: "soyle", metin: "merhaba" }).ok, true);
});

test("argümansız niyetler fazlalık alanla da geçer", () => {
  for (const tur of ["kalk", "birak", "dur"]) {
    assert.equal(niyetDogrula({ tur, sacma: 1 }).ok, true, tur);
  }
});

test("sor salt-okunurdur, diğerleri değil", () => {
  const s = niyetDogrula({ tur: "sor", ne: "dunya" });
  assert.equal(s.ok, true);
  if (s.ok) assert.equal(okunurMu(s.deger), true);
  const g = niyetDogrula({ tur: "git", hedef: { tip: "oyuncu" } });
  if (g.ok) assert.equal(okunurMu(g.deger), false);
});

test("tik yerel kanalda kalır — maliyet tavanı kuralı", () => {
  assert.equal(VARSAYILAN_KANAL.tik, "yerel");
  assert.equal(VARSAYILAN_KANAL.duydum, "beyin");
  // tik beyin kanalına girmediği için özeti boştur
  assert.equal(ozetle({ tur: "tik", t: 1, dt: 0.05, orion: {} as never, oyuncu: {} as never }), "");
});

test("ozetle beyin algılarını tek satıra indirir", () => {
  // Çerçeve İngilizce, Ozyn'in KENDİ sözü Türkçe (spec 06 §6.8).
  assert.match(ozetle({ tur: "duydum", metin: "selam", kesin: true }), /Ozyn said: "selam"/);
  const d = ozetle({
    tur: "dunya",
    orion: { poz: "duruyor" } as never,
    oyuncu: { mesafe: 2.34, bakiyor: true } as never,
    nesneler: [{ ad: "monitor", mesafe: 1.1, konum: { x: 0, y: 0, z: 0 }, eylemler: ["odaklan"] }],
    capalar: ["masa"],
  });
  assert.match(d, /monitor\(1\.1m\)/);
  assert.match(d, /looking at you/);
});

// `mind/refleks.ts` algı türü yokken satırı ÖNEKİNDEN tanır. Önek bir yerde
// üretilip başka yerde elle aranınca kayıyor: `ozetle` "Ozyn'in terminalinde…"
// üretirken refleks hâlâ "Terminal çıktısı" arıyordu, yani o dal ölüydü.
// Bu test öneki ÜRETİMDEN doğrular; kayma bir daha sessiz kalamaz.
test("özet satırları OZET_ONEKI ile başlar — refleks eşleşmesi kaymasın", () => {
  assert.ok(ozetle({ tur: "duydum", metin: "x", kesin: true }).startsWith(OZET_ONEKI.duydum));
  assert.ok(ozetle({ tur: "olay", ad: "kapi_acildi" }).startsWith(OZET_ONEKI.olay));
  assert.ok(ozetle({ tur: "yakin", nesneler: [] }).startsWith(OZET_ONEKI.yakin));
  assert.ok(ozetle({ tur: "gordum", ne: "onumde", metin: "tahta" }).startsWith(OZET_ONEKI.gordum));
  assert.ok(ozetle({ tur: "terminal", kuyruk: "x", kesildi: false }).startsWith(OZET_ONEKI.terminal));
});

test("süreli niyetler listesi git ve soyle içerir", () => {
  assert.ok(SURELI_NIYETLER.includes("git"));
  assert.ok(SURELI_NIYETLER.includes("soyle"));
  assert.ok(!SURELI_NIYETLER.includes("jest")); // jest anlık
});

test("sözlükler molp core/sahne.ts ile aynı büyüklükte", () => {
  assert.equal(POZLAR.length, 7);
  assert.equal(JESTLER.length, 8);
});

test("zarf sürüm ve benzersiz kimlik taşır", () => {
  const a = zarfla("niyet", { tur: "dur" });
  const b = zarfla("niyet", { tur: "dur" });
  assert.equal(a.v, SURUM);
  assert.equal(a.yon, "niyet");
  assert.notEqual(a.id, b.id);
  assert.ok(a.ts > 0);
});

test("GERİLEME: her araç türü doğrulayıcı tarafından TANINIR", () => {
  // Gercek hata: `komut` niyeti arac tablosuna eklendi ama dogrulayicinin
  // TURLER listesine eklenmedi. Model araci dogru cagiriyor, kopru
  // "bilinmeyen niyet turu" deyip reddediyordu. Canli olcumde "model komut
  // onermiyor" sanildi; oysa oneriyordu, biz dusuruyorduk.
  // Bu test protokol ile dogrulayiciyi birbirine BAGLAR.
  const ornekler: Record<string, Record<string, unknown>> = {
    poz: { poz: "duruyor" },
    jest: { jest: "gülümsüyor" },
    // serbest bakis NULL ile belirtilir; alanin hic olmamasi gecersizdir
    bak: { hedef: null },
    git: { hedef: { tip: "capa", ad: "tahta" } },
    otur: {},
    kalk: {},
    soyle: { metin: "selam" },
    yaz: { metin: "not" },
    al: { nesne: "kalem" },
    birak: {},
    odaklan: { capa: "monitor" },
    dur: {},
    sor: { ne: "dunya" },
    komut: { metin: "git status", gerekce: "durumu gor" },
  };
  for (const [tur, govde] of Object.entries(ornekler)) {
    const d = niyetDogrula({ ...govde, tur });
    assert.ok(d.ok, `'${tur}' dogrulayici tarafindan reddedildi: ${d.ok ? "" : d.hata}`);
  }
});
