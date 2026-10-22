// uygulama/graf/editor/bagKurali.test.ts — editörde bağ çekme kuralı: uyumlu/uyumsuz (nedenli), yön serbest, tek-bağ kuralında ESKİ BAĞIN DEĞİŞMESİ,
// döngü reddi. BEKÇİ: editörün kuralı "Kontrol et"in kuralıyla HER TÜR ÇİFTİNDE aynı (ayrışırsa kırmızı) ve editör dosyalarında ikinci bir uyum kuralı yok.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PIN_TIPLERI, grafDogrula, type Graf, type GrafBagi, type GrafDugumu, type PinTipi } from "../../../protocol/graf.ts";
import { AKIS_GIRIS, AKIS_SONRA, DugumKaydi, type PinOrtami } from "../dugumKaydi.ts";
import { dugumleriCozYapili, grafTurDenetle } from "../grafTurDenetimi.ts";
import { grafKutuphanesi } from "../kutuphane.ts";
import { bagDenetle, uyumluIlkPin, type PinRef } from "./bagKurali.ts";

const KAYIT = grafKutuphanesi();
const ORTAM: PinOrtami = { desen: () => null, buGraf: null, ajanlar: () => ["orion", "flash"] };
const bag = (a: string, b: string, c: string, d: string): GrafBagi => ({ kaynak: [a, b], hedef: [c, d] });
const graf = (dugumler: GrafDugumu[], baglar: GrafBagi[] = []): Graf => {
  const r = grafDogrula({ surum: 1, ad: "deneme", tur: "olay", dugumler, baglar });
  if (!r.ok) throw new Error(r.hata);
  return r.deger;
};
const cik = (dugum: string, pin: string): PinRef => ({ dugum, pin, yon: "cikis" });
const gir = (dugum: string, pin: string): PinRef => ({ dugum, pin, yon: "giris" });
const dene = (g: Graf, a: PinRef, b: PinRef) => bagDenetle(g, dugumleriCozYapili(g, KAYIT, ORTAM).cozum, a, b);
const neden = (r: ReturnType<typeof dene>) => (r.ok ? "KABUL" : r.neden);

const TEMEL: GrafDugumu[] = [
  { id: "b", tip: "olay.basla" }, { id: "s", tip: "veri.sayi" }, { id: "m", tip: "veri.metin" },
  { id: "bek", tip: "akis.bekle" }, { id: "e", tip: "akis.eger" }, { id: "soz", tip: "ajan.soyle" },
];

test("uyumlu veri bağı kabul: Sayı.deger → Bekle.ms", () => {
  const r = dene(graf(TEMEL), cik("s", "deger"), gir("bek", "ms"));
  assert.deepEqual(r, { ok: true, bag: bag("s", "deger", "bek", "ms"), degisen: [] });
});

test("yön serbest: girişten çıkışa sürüklemek de aynı bağı kurar", () => {
  const r = dene(graf(TEMEL), gir("bek", "ms"), cik("s", "deger"));
  assert.deepEqual(r.ok ? r.bag : null, bag("s", "deger", "bek", "ms"));
});

test("uyumsuz tür NEDENLE reddedilir: metin → sayı", () => {
  assert.equal(neden(dene(graf(TEMEL), cik("m", "deger"), gir("bek", "ms"))), "tür uyuşmuyor: metin → sayı");
});

test("akış ile veri bağlanmaz (beyaz pin yalnız beyaza)", () => {
  assert.match(neden(dene(graf(TEMEL), cik("b", "sonra"), gir("bek", "ms"))), /akış \(beyaz\) yalnız akışla/);
});

test("akış 'herhangi'ye de bağlanmaz: Başla.sonra → Söyle.metin reddedilir (bozma #15'te bulunan boşluk: bu çift hiç sınanmıyordu)", () => {
  assert.match(neden(dene(graf(TEMEL), cik("b", "sonra"), gir("soz", "metin"))), /tür uyuşmuyor: akış → herhangi/);
});

test("'herhangi' her veriyle bağlanır: Sayı → Söyle.metin", () => {
  assert.equal(neden(dene(graf(TEMEL), cik("s", "deger"), gir("soz", "metin"))), "KABUL");
});

test("iki giriş, iki çıkış ve düğümün kendisi reddedilir", () => {
  const g = graf(TEMEL);
  assert.deepEqual([neden(dene(g, gir("bek", "ms"), gir("e", "kosul"))), neden(dene(g, cik("s", "deger"), cik("m", "deger"))), neden(dene(g, cik("bek", "sonra"), gir("bek", "giris")))],
    ["iki giriş birbirine bağlanamaz (bir çıkıştan girişe çek)", "iki çıkış birbirine bağlanamaz (bir çıkıştan girişe çek)", "düğüm kendi pinine bağlanamaz"]);
});

test("aynı bağ ikinci kez kurulmaz", () => {
  const g = graf(TEMEL, [bag("s", "deger", "bek", "ms")]);
  assert.equal(neden(dene(g, cik("s", "deger"), gir("bek", "ms"))), "bu bağ zaten var");
});

test("tek-bağ: dolu VERİ GİRİŞİNE yeni bağ eskisini DEĞİŞTİRİR (değişen döner)", () => {
  const g = graf([...TEMEL, { id: "s2", tip: "veri.sayi" }], [bag("s", "deger", "bek", "ms")]);
  const r = dene(g, cik("s2", "deger"), gir("bek", "ms"));
  assert.deepEqual(r.ok ? r.degisen : null, [bag("s", "deger", "bek", "ms")]);
});

test("tek-bağ: dolu AKIŞ ÇIKIŞINDAN yeni bağ eskisini değiştirir", () => {
  const g = graf([...TEMEL, { id: "bek2", tip: "akis.bekle" }], [bag("b", "sonra", "bek", "giris")]);
  const r = dene(g, cik("b", "sonra"), gir("bek2", "giris"));
  assert.deepEqual(r.ok ? r.degisen : null, [bag("b", "sonra", "bek", "giris")]);
});

test("akış GİRİŞİNE birden çok bağ serbest: hiçbir bağ değişmez", () => {
  const g = graf([...TEMEL, { id: "bek2", tip: "akis.bekle" }], [bag("b", "sonra", "bek", "giris")]);
  const r = dene(g, cik("bek2", "sonra"), gir("bek", "giris"));
  assert.deepEqual(r.ok ? r.degisen : null, []);
});

test("akış döngüsü kuracak bağ reddedilir (Tekrar düğümünü önerir)", () => {
  const g = graf([...TEMEL, { id: "bek2", tip: "akis.bekle" }], [bag("bek", "sonra", "bek2", "giris")]);
  assert.match(neden(dene(g, cik("bek2", "sonra"), gir("bek", "giris"))), /akış döngüsü olur.*Tekrar/);
});

test("veri döngüsü kuracak bağ reddedilir", () => {
  const g = graf([{ id: "v1", tip: "mantik.degil" }, { id: "v2", tip: "mantik.degil" }], [bag("v1", "sonuc", "v2", "a")]);
  assert.match(neden(dene(g, cik("v2", "sonuc"), gir("v1", "a"))), /veri döngüsü olur/);
});

test("pini olmayan uç nedenle reddedilir (pin kalktı)", () => {
  assert.match(neden(dene(graf(TEMEL), cik("s", "yok"), gir("bek", "ms"))), /'s\.yok' çıkışı yok/);
});

test("uyumluIlkPin: aynı tür herhangi'den önce; akış sürüklenince akış girişi", () => {
  const pinler = { girisler: [AKIS_GIRIS, { ad: "a", tip: "herhangi" as PinTipi }, { ad: "b", tip: "sayi" as PinTipi }], cikislar: [AKIS_SONRA] };
  assert.deepEqual([uyumluIlkPin(pinler, { yon: "cikis", tip: "sayi" }), uyumluIlkPin(pinler, { yon: "cikis", tip: "akis" }), uyumluIlkPin(pinler, { yon: "giris", tip: "sayi" })], ["b", "giris", null]);
});

// ── BEKÇİ: editörün kuralı denetimin kuralıyla aynı (her tür çifti) ──
test("BEKÇİ: her (çıkış türü, giriş türü) çiftinde editör kabul eder ⇔ 'Kontrol et' tür hatası vermez", () => {
  const k = new DugumKaydi<unknown>();
  for (const t of PIN_TIPLERI) {
    k.kaydet({ tip: `t.cik_${t}`, ad: t, kategori: "veri", saf: false, aciklama: "", pinler: () => ({ girisler: [], cikislar: [{ ad: "o", tip: t }] }), calistir: () => ({}) });
    k.kaydet({ tip: `t.gir_${t}`, ad: t, kategori: "veri", saf: false, aciklama: "", pinler: () => ({ girisler: [{ ad: "i", tip: t }], cikislar: [] }), calistir: () => ({}) });
  }
  const ayrisan: string[] = [];
  for (const a of PIN_TIPLERI) {
    for (const b of PIN_TIPLERI) {
      const g = graf([{ id: "c", tip: `t.cik_${a}` }, { id: "g", tip: `t.gir_${b}` }]);
      const editor = bagDenetle(g, dugumleriCozYapili(g, k, ORTAM).cozum, cik("c", "o"), gir("g", "i")).ok;
      const denetim = !grafTurDenetle({ ...g, baglar: [bag("c", "o", "g", "i")] }, k, ORTAM).some((h) => h.includes("tür uyuşmuyor"));
      if (editor !== denetim) ayrisan.push(`${a}→${b}: editör ${editor}, denetim ${denetim}`);
    }
  }
  assert.deepEqual(ayrisan, []);
});

test("BEKÇİ: editör dosyalarında İKİNCİ bir tür uyumu kuralı yazılmaz ('herhangi' karşılaştırması yalnız grafTurDenetimi.ts'te)", () => {
  const kok = path.resolve(import.meta.dirname, "..", "..", "..");
  const tara = (klasor: string): string[] => !fs.existsSync(path.join(kok, klasor)) ? [] : fs.readdirSync(path.join(kok, klasor), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tara(path.join(klasor, e.name)) : /\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [path.join(klasor, e.name).split(path.sep).join("/")] : []);
  const kopya = [...tara("uygulama/graf/editor"), ...tara("uygulama/yapi/graf")].filter((d) => /===\s*"herhangi"|"herhangi"\s*===/.test(fs.readFileSync(path.join(kok, d), "utf8")));
  assert.deepEqual(kopya, []);
});
