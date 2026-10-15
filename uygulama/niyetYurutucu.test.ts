// uygulama/niyetYurutucu.test.ts — Tek niyet yönlendirme noktası: her niyet doğru yere mi gidiyor?
//
// Bu yönlendirme giris.ts'in içindeyken yalnız canlı koşuyla sınanabiliyordu (spec 14 R4). Burada
// dünya sahtedir: beden, köprü, tahta, monitör ve onay kapısı yalnız ne istendiğini kaydeder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { niyetYurutucusuKur, type YurutucuBaglami } from "./niyetYurutucu.ts";
import { capaBul, type Capa } from "../world/level/capalar.ts";
import type { Niyet, NiyetSonucu } from "../protocol/niyet.ts";
import type { Algi, OrionDurumu } from "../protocol/algi.ts";
import type { Vec3 } from "../protocol/temel.ts";

import type { KomutKipi } from "./komutKipi.ts";
import type { RiskSeviyesi } from "../mind/komutRiski.ts";

const TAHTA_ONU: Vec3 = capaBul("tahta")!.durak;
const UZAK: Vec3 = { x: TAHTA_ONU.x + 6, y: 0, z: TAHTA_ONU.z };

/** Sahte dünya: her çağrıyı kaydeder. `bedenCevabi` bedenin bir niyete vereceği sonucu seçer. */
function sahneKur(ayar: {
  konum?: Vec3;
  beden?: boolean;
  onerKabul?: boolean;
  /** Komut kipi (spec 26 F2) ve önerilen komutun risk seviyesi; kip verilmezse eski davranış (hepsi onay bekler). */
  komutKipi?: KomutKipi;
  risk?: RiskSeviyesi;
  /** `hatirla` (spec 26 F3): olgu yazıcısı; verilmezse hafıza yok. */
  olguHatirla?: (anahtar: string, deger: string) => "yeni" | "guncellendi" | "ayni" | null;
  bedenCevabi?: (n: Niyet) => { durum: NiyetSonucu["durum"]; varis?: Vec3 } | null;
  /** Orion'un bulunduğu yerin çapaları (spec 24); verilmezse yürütücü odayı varsayar. */
  capalar?: readonly Capa[];
  /** `ortam` (ova'nın ışığı/stili/zamanı): verilirse bağlantı; `uygula` sonucu kontrol eder. */
  ortam?: (k: Extract<Niyet, { tur: "ortam" }>) => { ok: boolean; not: string };
  /** Görme (spec 25 Faz 2): verilirse göz bağlı; `gor` modelin cevabı ya da fırlattığı. */
  goz?: { kare?: string | null; gor: (png: string, algi: string) => Promise<string> };
  /** Göz muayenesi yolu (uygulama/gozlem.ts): verilirse `sor gor` BURADAN gider; `metin` yoksa bakış null döner ve `hata` nedeni söyler. */
  gozlem?: { metin?: string; hata?: string };
} = {}) {
  const kayit = {
    bedeneGiden: [] as { n: Niyet; id: string }[],
    kopruSonuc: [] as NiyetSonucu[],
    kopruAlgi: [] as Algi[],
    tahtaYazilan: [] as string[],
    onerilen: [] as string[],
    panelCizildi: 0,
    otomatikOnay: 0,
    gordumBildirildi: 0,
    gozeGiden: [] as { png: string; algi: string }[],
    gozlemBakis: 0,
    ortamGelen: [] as Extract<Niyet, { tur: "ortam" }>[],
  };
  let konum = ayar.konum ?? TAHTA_ONU;
  const dinleyiciler = new Set<(s: NiyetSonucu) => void>();
  const durum = (): OrionDurumu => ({
    konum, bakis: { x: 0, y: 0, z: -1 }, poz: "duruyor", mesgul: false, elinde: null, oturuyor_mu: false,
  });
  const beden = {
    durum,
    sonucDinle(cb: (s: NiyetSonucu) => void) { dinleyiciler.add(cb); return () => { dinleyiciler.delete(cb); }; },
    niyet(n: Niyet, id: string) {
      kayit.bedeneGiden.push({ n, id });
      const c = ayar.bedenCevabi?.(n);
      if (!c) return;
      if (c.varis) konum = c.varis;
      for (const d of [...dinleyiciler]) d({ niyet_id: id, durum: c.durum });
    },
  };
  const b: YurutucuBaglami = {
    beden: () => (ayar.beden === false ? null : beden),
    kopru: () => ({ sonuc: (s) => { kayit.kopruSonuc.push(s); }, algi: (a) => { kayit.kopruAlgi.push(a); } }),
    tahta: { yaz: (m) => { kayit.tahtaYazilan.push(m); return { eklenen: 1, dusen: 0 }; } },
    monitor: { acikMi: () => false, ac: async () => {} },
    onayKapisi: {
      oner: (_id, komut) => {
        kayit.onerilen.push(komut);
        return ayar.onerKabul === false ? { kabul: false, sebep: "zaten bekleyen var" } : { kabul: true };
      },
      get bekleyen() { return kayit.onerilen.length ? ({ risk: { seviye: ayar.risk ?? "okur", nedenler: [] } } as never) : null; },
    },
    sema: { vur: () => {} },
    gunluk: { ekle: () => {} },
    algiSor: (ne) => ({ metin: ne === "oyuncu" ? "Ozyn yanında" : "tahta görünüyor", maliyet: 15, kirpildi: false }),
    altyazi: () => {},
    onayPaneliCiz: () => { kayit.panelCizildi++; },
    ...(ayar.olguHatirla ? { olguHatirla: ayar.olguHatirla } : {}),
    ...(ayar.komutKipi ? { komutKipi: () => ayar.komutKipi!, otomatikOnay: () => { kayit.otomatikOnay++; } } : {}),
    gordumBildir: () => { kayit.gordumBildirildi++; },
    ...(ayar.ortam ? { ortam: { uygula: (k) => { kayit.ortamGelen.push(k); return ayar.ortam!(k); } } } : {}),
    ...(ayar.capalar ? { orionCapalari: () => ayar.capalar! } : {}),
    ...(ayar.gozlem ? { gozlem: {
      bak: async () => { kayit.gozlemBakis++; return ayar.gozlem!.metin ? { metin: ayar.gozlem!.metin } : null; },
      sonHata: () => ayar.gozlem!.hata ?? null,
    } } : {}),
    ...(ayar.goz ? { goz: {
      kare: async () => (ayar.goz!.kare === undefined ? "UE5H" : ayar.goz!.kare),
      gor: (png: string, algi: string) => { kayit.gozeGiden.push({ png, algi }); return ayar.goz!.gor(png, algi); },
    } } : {}),
  };
  return { kayit, y: niyetYurutucusuKur(b) };
}

const bekleBiraz = () => new Promise((r) => setTimeout(r, 0));
/** Algı birleşiminin her varyantında `metin` yok: olan varyantlardan oku. */
const algiMetni = (a: Algi | undefined): string | undefined => (a && "metin" in a ? a.metin : undefined);

test("soyle bedene gitmez (ses hattının işi)", () => {
  const { kayit, y } = sahneKur();
  y.niyetiYurut({ tur: "soyle", metin: "merhaba" }, "n1");
  assert.equal(kayit.bedeneGiden.length, 0);
});

test("git bedene aynı kimlikle gider", () => {
  const { kayit, y } = sahneKur();
  y.niyetiYurut({ tur: "git", hedef: { tip: "oyuncu" } }, "n1");
  assert.deepEqual(kayit.bedeneGiden.map((g) => g.id), ["n1"]);
});

test("tahtanın önündeyken yaz hemen tahtaya yazar", () => {
  const { kayit, y } = sahneKur({ konum: TAHTA_ONU });
  y.niyetiYurut({ tur: "yaz", metin: "not" }, "n1");
  assert.deepEqual(kayit.tahtaYazilan, ["not"]);
});

test("tahtasız yerde (ova) odanın tahta koordinatında olsa da yaz yazmaz", () => {
  const { kayit, y } = sahneKur({ konum: TAHTA_ONU, capalar: [] });
  y.niyetiYurut({ tur: "yaz", metin: "not" }, "n1");
  assert.deepEqual(kayit.tahtaYazilan, []);
});

test("uzaktan yaz hemen yazmaz", () => {
  const { kayit, y } = sahneKur({ konum: UZAK });
  y.niyetiYurut({ tur: "yaz", metin: "not" }, "n1");
  assert.deepEqual(kayit.tahtaYazilan, []);
});

test("uzaktan yaz önce tahtaya yürür", () => {
  const { kayit, y } = sahneKur({ konum: UZAK });
  y.niyetiYurut({ tur: "yaz", metin: "not" }, "n1");
  assert.deepEqual(kayit.bedeneGiden.map((g) => g.n), [{ tur: "git", hedef: { tip: "capa", ad: "tahta" } }]);
});

test("uzaktan yaz: vardıktan sonra yazar", async () => {
  const { kayit, y } = sahneKur({ konum: UZAK, bedenCevabi: () => ({ durum: "bitti", varis: TAHTA_ONU }) });
  y.niyetiYurut({ tur: "yaz", metin: "not" }, "n1");
  await bekleBiraz();
  assert.deepEqual(kayit.tahtaYazilan, ["not"]);
});

test("uzaktan yaz: yürüyemezse köprüye hata döner", async () => {
  const { kayit, y } = sahneKur({ konum: UZAK, bedenCevabi: () => ({ durum: "hata" }) });
  y.niyetiYurut({ tur: "yaz", metin: "not" }, "n1");
  await bekleBiraz();
  assert.deepEqual(kayit.kopruSonuc.map((s) => [s.niyet_id, s.durum]), [["n1", "hata"]]);
});

test("komut bedene değil onay kapısına gider", () => {
  const { kayit, y } = sahneKur();
  y.niyetiYurut({ tur: "komut", metin: "dir", gerekce: "listele" }, "n1");
  assert.deepEqual([kayit.onerilen, kayit.bedeneGiden.length], [["dir"], 0]);
});

test("kabul edilen komut onay panelini çizer", () => {
  const { kayit, y } = sahneKur();
  y.niyetiYurut({ tur: "komut", metin: "dir", gerekce: "listele" }, "n1");
  assert.equal(kayit.panelCizildi, 1);
});

test("kip otomatik: okuyan komut Ozyn'in tuşu beklenmeden onaylanır, panel çizilmez (spec 26 F2)", () => {
  const { kayit, y } = sahneKur({ komutKipi: "otomatik", risk: "okur" });
  y.niyetiYurut({ tur: "komut", metin: "ls", gerekce: "listele" }, "n1");
  assert.deepEqual([kayit.otomatikOnay, kayit.panelCizildi], [1, 0]);
});

test("kip otomatik: YIKICI komut yine onay bekler (panel çizilir, otomatik onay yok)", () => {
  const { kayit, y } = sahneKur({ komutKipi: "otomatik", risk: "yikici" });
  y.niyetiYurut({ tur: "komut", metin: "rm -rf .", gerekce: "temizle" }, "n1");
  assert.deepEqual([kayit.otomatikOnay, kayit.panelCizildi], [0, 1]);
});

test("kip tam: yıkıcı komut da onaysız; kip onayli: okuyan komut bile onay bekler", () => {
  const tam = sahneKur({ komutKipi: "tam", risk: "yikici" });
  tam.y.niyetiYurut({ tur: "komut", metin: "rm -rf .", gerekce: "x" }, "n1");
  const onayli = sahneKur({ komutKipi: "onayli", risk: "okur" });
  onayli.y.niyetiYurut({ tur: "komut", metin: "ls", gerekce: "x" }, "n1");
  assert.deepEqual([tam.kayit.otomatikOnay, onayli.kayit.otomatikOnay, onayli.kayit.panelCizildi], [1, 0, 1]);
});

test("kapı komutu reddettiyse (bekleyen var) otomatik onay da yok", () => {
  const { kayit, y } = sahneKur({ komutKipi: "tam", onerKabul: false });
  y.niyetiYurut({ tur: "komut", metin: "ls", gerekce: "x" }, "n1");
  assert.equal(kayit.otomatikOnay, 0);
});

test("kapının reddettiği komut köprüye sebebiyle hata döner", () => {
  const { kayit, y } = sahneKur({ onerKabul: false });
  y.niyetiYurut({ tur: "komut", metin: "dir", gerekce: "listele" }, "n1");
  assert.deepEqual(kayit.kopruSonuc, [{ niyet_id: "n1", durum: "hata", not: "zaten bekleyen var" }]);
});

test("sor cevabı beyne `gordum` olarak ulaşır", () => {
  const { kayit, y } = sahneKur();
  y.niyetiYurut({ tur: "sor", ne: "dunya" }, "n1");
  assert.deepEqual(kayit.kopruAlgi, [{ tur: "gordum", ne: "dunya", metin: "tahta görünüyor" }]);
});

test("sor `gordum` geldiğini bildirir", () => {
  const { kayit, y } = sahneKur();
  y.niyetiYurut({ tur: "sor", ne: "dunya" }, "n1");
  assert.equal(kayit.gordumBildirildi, 1);
});

// ── GÖRME (spec 25 Faz 2): algı + kare → görme modeli → `gordum` ──
const GOREN = { gor: async () => "Oda loş, tahta beyaz parlıyor." };

test("sor gor kareyi görme modeline verir", async () => {
  const { kayit, y } = sahneKur({ goz: GOREN });
  y.niyetiYurut({ tur: "sor", ne: "gor" }, "n1");
  await bekleBiraz();
  assert.deepEqual(kayit.gozeGiden.map((g) => g.png), ["UE5H"]);
});

test("sor gor algıyı (dünya + Ozyn) modele bağlam olarak verir", async () => {
  const { kayit, y } = sahneKur({ goz: GOREN });
  y.niyetiYurut({ tur: "sor", ne: "gor" }, "n1");
  await bekleBiraz();
  assert.equal(kayit.gozeGiden[0]?.algi, "tahta görünüyor. Ozyn: Ozyn yanında");
});

test("sor gor modelin betimini beyne `gordum` (gor) olarak verir", async () => {
  const { kayit, y } = sahneKur({ goz: GOREN });
  y.niyetiYurut({ tur: "sor", ne: "gor" }, "n1");
  await bekleBiraz();
  assert.deepEqual(kayit.kopruAlgi, [{ tur: "gordum", ne: "gor", metin: "Oda loş, tahta beyaz parlıyor." }]);
});

test("sor gor niyeti `bitti` ile kapatır", async () => {
  const { kayit, y } = sahneKur({ goz: GOREN });
  y.niyetiYurut({ tur: "sor", ne: "gor" }, "n1");
  await bekleBiraz();
  assert.deepEqual(kayit.kopruSonuc.map((s) => [s.niyet_id, s.durum]), [["n1", "bitti"]]);
});

test("model çalışmazsa `gordum` dürüst: gözlerin çalışmıyor + algı", async () => {
  const { kayit, y } = sahneKur({ goz: { gor: async () => { throw new Error("model yok"); } } });
  y.niyetiYurut({ tur: "sor", ne: "gor" }, "n1");
  await bekleBiraz();
  assert.equal(algiMetni(kayit.kopruAlgi[0]), "Your eyes are not working right now (model yok). Your perception: tahta görünüyor. Ozyn: Ozyn yanında");
});

test("model çalışmazsa niyet sebebiyle `hata` kapanır", async () => {
  const { kayit, y } = sahneKur({ goz: { gor: async () => { throw new Error("model yok"); } } });
  y.niyetiYurut({ tur: "sor", ne: "gor" }, "n1");
  await bekleBiraz();
  assert.deepEqual(kayit.kopruSonuc, [{ niyet_id: "n1", durum: "hata", not: "model yok" }]);
});

test("göz bağlı değilse `gordum` bunu söyler", async () => {
  const { kayit, y } = sahneKur();
  y.niyetiYurut({ tur: "sor", ne: "gor" }, "n1");
  await bekleBiraz();
  assert.match(algiMetni(kayit.kopruAlgi[0]) ?? "", /^Your eyes are not working right now \(gözün bağlı değil\)/);
});

test("kare yoksa (beden hazır değil) modele gidilmez", async () => {
  const { kayit, y } = sahneKur({ goz: { ...GOREN, kare: null } });
  y.niyetiYurut({ tur: "sor", ne: "gor" }, "n1");
  await bekleBiraz();
  assert.equal(kayit.gozeGiden.length, 0);
});

test("bakarken ikinci sor gor `zaten bakıyorum` ile kapanır", async () => {
  const { kayit, y } = sahneKur({ goz: GOREN });
  y.niyetiYurut({ tur: "sor", ne: "gor" }, "n1");
  y.niyetiYurut({ tur: "sor", ne: "gor" }, "n2");
  await bekleBiraz();
  assert.deepEqual(kayit.kopruSonuc.find((s) => s.niyet_id === "n2"), { niyet_id: "n2", durum: "hata", not: "zaten bakıyorum" });
});

test("bakış bitince yeniden bakılabilir", async () => {
  const { kayit, y } = sahneKur({ goz: GOREN });
  y.niyetiYurut({ tur: "sor", ne: "gor" }, "n1");
  await bekleBiraz();
  y.niyetiYurut({ tur: "sor", ne: "gor" }, "n2");
  await bekleBiraz();
  assert.equal(kayit.gozeGiden.length, 2);
});

test("sonGorme son bakışın algısını ve metnini tutar", async () => {
  const { y } = sahneKur({ goz: GOREN });
  y.niyetiYurut({ tur: "sor", ne: "gor" }, "n1");
  await bekleBiraz();
  const g = y.sonGorme();
  assert.deepEqual([g?.niyetId, g?.metin], ["n1", "Oda loş, tahta beyaz parlıyor."]);
});

test("monitör dışı odaklan o çapaya yürür", () => {
  const { kayit, y } = sahneKur();
  y.niyetiYurut({ tur: "odaklan", capa: "pencere" }, "n1");
  assert.deepEqual(kayit.bedeneGiden, [{ n: { tur: "git", hedef: { tip: "capa", ad: "pencere" } }, id: "n1" }]);
});

test("bedenAdimi: beden yokken hata ile çözülür", async () => {
  const { y } = sahneKur({ beden: false });
  const s = await y.bedenAdimi({ tur: "otur" });
  assert.equal(s.durum, "hata");
});

test("bedenAdimi: bedenin sonucu ile çözülür", async () => {
  const { y } = sahneKur({ bedenCevabi: () => ({ durum: "bitti" }) });
  const s = await y.bedenAdimi({ tur: "otur" });
  assert.equal(s.durum, "bitti");
});

test("bedenAdimi: cevap gelmezse süre dolunca hata", async () => {
  const { y } = sahneKur();
  const s = await y.bedenAdimi({ tur: "otur" }, 20);
  assert.equal(s.not, "zaman aşımı");
});

test("hatirla olguyu hafızaya yazar, bedene gitmez, köprüye 'bitti' döner (spec 26 F3)", () => {
  const yazilan: [string, string][] = [];
  const { kayit, y } = sahneKur({ olguHatirla: (a, d) => { yazilan.push([a, d]); return "yeni"; } });
  y.niyetiYurut({ tur: "hatirla", anahtar: "terminal_araci", deger: "Ozyn terminalde claude kullanır." }, "n1");
  assert.deepEqual([yazilan, kayit.bedeneGiden.length, kayit.kopruSonuc.map((s) => s.durum)], [[["terminal_araci", "Ozyn terminalde claude kullanır."]], 0, ["bitti"]]);
});

test("hatirla: hafıza yoksa 'hatırladım' denmez, hata döner", () => {
  const { kayit, y } = sahneKur();
  y.niyetiYurut({ tur: "hatirla", anahtar: "k", deger: "v" }, "n1");
  assert.deepEqual(kayit.kopruSonuc.map((s) => [s.durum, s.not]), [["hata", "memory is not available"]]);
});

test("ortam bedene gitmez; başarı 'bitti' döner (beyni uyandırmaz), metin kopruya gider", () => {
  const { kayit, y } = sahneKur({ ortam: () => ({ ok: true, not: "saat 21:00 yapıldı" }) });
  y.niyetiYurut({ tur: "ortam", ne: "saat", sayi: 21 }, "n1");
  assert.deepEqual([kayit.bedeneGiden.length, kayit.ortamGelen.map((k) => k.ne), kayit.kopruSonuc.map((s) => [s.durum, s.not])],
    [0, ["saat"], [["bitti", "saat 21:00 yapıldı"]]]);
});

test("ortam reddi 'hata' döner ve metni korur (ova'da değilim modele gider)", () => {
  const { kayit, y } = sahneKur({ ortam: () => ({ ok: false, not: "I am not outside" }) });
  y.niyetiYurut({ tur: "ortam", ne: "stil", deger: "toon" }, "n1");
  assert.deepEqual(kayit.kopruSonuc.map((s) => [s.durum, s.not]), [["hata", "I am not outside"]]);
});

test("ortam: bağlantı yoksa 'bitti' denmez, hata döner", () => {
  const { kayit, y } = sahneKur();
  y.niyetiYurut({ tur: "ortam", ne: "isik", deger: "kis" }, "n1");
  assert.equal(kayit.kopruSonuc[0]?.durum, "hata");
  assert.equal(kayit.bedeneGiden.length, 0);
});

// ── Göz muayenesi yolu (Ozyn, 2026-10-15): "gözünle bak" döngüde bu yoldan; düz sorgu, algı/rol modele GİTMEZ ──
test("gözlem verilirse sor gor ESKİ yoldan değil göz muayenesinden gider (eski goz çağrılmaz)", async () => {
  const { kayit, y } = sahneKur({ goz: GOREN, gozlem: { metin: "Loş bir oda; beyaz tahta parlıyor." } });
  y.niyetiYurut({ tur: "sor", ne: "gor" }, "n1");
  await bekleBiraz();
  assert.equal(kayit.gozlemBakis, 1);
  assert.deepEqual(kayit.gozeGiden, [], "eski, algılı/rollü görme yolu çağrılmamalı");
});

test("göz muayenesinin cevabı beyne `gordum` olarak girer ve niyet `bitti` ile kapanır", async () => {
  const { kayit, y } = sahneKur({ gozlem: { metin: "Loş bir oda; beyaz tahta parlıyor." } });
  y.niyetiYurut({ tur: "sor", ne: "gor" }, "n1");
  await bekleBiraz();
  assert.deepEqual(kayit.kopruAlgi, [{ tur: "gordum", ne: "gor", metin: "Loş bir oda; beyaz tahta parlıyor." }]);
  assert.deepEqual(kayit.kopruSonuc.map((s) => [s.niyet_id, s.durum]), [["n1", "bitti"]]);
  assert.equal(kayit.gordumBildirildi, 1);
});

test("göz muayenesi null dönerse sonHata nedeni hata olarak söylenir; beyin dürüst metin alır", async () => {
  const { kayit, y } = sahneKur({ gozlem: { hata: "görme modeli 30 sn içinde cevap vermedi" } });
  y.niyetiYurut({ tur: "sor", ne: "gor" }, "n1");
  await bekleBiraz();
  assert.equal(kayit.kopruSonuc[0]?.durum, "hata");
  assert.match(kayit.kopruSonuc[0]?.not ?? "", /30 sn içinde cevap vermedi/);
  assert.match(algiMetni(kayit.kopruAlgi[0]) ?? "", /Your eyes are not working right now \(görme modeli 30 sn/);
});
