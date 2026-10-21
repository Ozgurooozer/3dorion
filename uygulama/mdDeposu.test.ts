// uygulama/mdDeposu.test.ts — md deposu: yükleme, aktif/pasif bağlam, anlık hafıza güncelleme ve kaydetme birleştirmesi, kuyruk, olaylar, IPC/yerel kaynaklar.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import { MdHatasi, calismayanKaynak, ipcKaynagi, mdDeposuKur, yerelKaynak, type MdBilgisi, type MdKaynagi, type MdKopruYuzu } from "./mdDeposu.ts";
import { ANLIK_HAFIZA } from "../mind/mdBaglami.ts";
import { ISARET_BASI, ISARET_SONU, bolumuOku } from "../mind/anlikHafiza.ts";

/** Bellekte sahte kaynak (host dosyaları gibi davranır: yaz → yoksa 'yok', yeni → varsa 'var'). */
function sahteKaynak(ilk: Record<string, { metin: string; aktif: boolean }> = {}) {
  const dosyalar = new Map(Object.entries(ilk).map(([ad, x]) => [ad, { ...x }]));
  const yazilanlar: string[] = [];
  let gecikme = 0;
  const k: MdKaynagi = {
    async liste(): Promise<MdBilgisi[]> {
      return [...dosyalar].map(([ad, x]) => ({ ad, boyut: x.metin.length, degisti: 1, aktif: x.aktif, sistem: ad === ANLIK_HAFIZA }))
        .sort((a, b) => Number(b.sistem) - Number(a.sistem) || a.ad.localeCompare(b.ad));
    },
    async oku(ad) { const x = dosyalar.get(ad); if (!x) throw new MdHatasi("yok", `yok: ${ad}`); return x.metin; },
    async yaz(ad, metin) {
      if (gecikme) await new Promise((r) => setTimeout(r, gecikme));
      const x = dosyalar.get(ad); if (!x) throw new MdHatasi("yok", `yok: ${ad}`); x.metin = metin; yazilanlar.push(ad);
    },
    async yeni(ad, metin) { if (dosyalar.has(ad)) throw new MdHatasi("var", `var: ${ad}`); dosyalar.set(ad, { metin, aktif: false }); yazilanlar.push(ad); },
    async aktifYap(ad, aktif) { const x = dosyalar.get(ad); if (!x) throw new MdHatasi("yok", `yok: ${ad}`); x.aktif = aktif; },
  };
  return { k, dosyalar, yazilanlar, gecikmeAyarla: (ms: number) => { gecikme = ms; } };
}
const dosya = (blok: string, onde = "ÖN") => `${onde}\n${ISARET_BASI}\n${blok}\n${ISARET_SONU}\n`;

test("başlat: liste gelir; yalnız AKTİF dosyalar bağlama girer", async () => {
  const s = sahteKaynak({ "a.md": { metin: "Alfa", aktif: true }, "b.md": { metin: "Beta", aktif: false } });
  const d = mdDeposuKur(s.k);
  await d.baslat();
  assert.deepEqual(d.liste().map((x) => x.ad), ["a.md", "b.md"]);
  assert.match(d.baglam().metin, /Alfa/);
  assert.doesNotMatch(d.baglam().metin, /Beta/);
});

test("aktifYap: açınca metni yüklenip bağlama girer, kapatınca çıkar", async () => {
  const s = sahteKaynak({ "b.md": { metin: "Beta", aktif: false } });
  const d = mdDeposuKur(s.k);
  await d.baslat();
  assert.equal(d.baglam().metin, "");
  await d.aktifYap("b.md", true);
  assert.match(d.baglam().metin, /Beta/);
  await d.aktifYap("b.md", false);
  assert.equal(d.baglam().metin, "");
});

test("yaz: aktif dosyanın bağlamı HEMEN yeni metni görür (sonraki tur günceli okur)", async () => {
  const s = sahteKaynak({ "a.md": { metin: "eski", aktif: true } });
  const d = mdDeposuKur(s.k);
  await d.baslat();
  await d.yaz("a.md", "yeni");
  assert.match(d.baglam().metin, /yeni/);
  assert.doesNotMatch(d.baglam().metin, /eski/);
  assert.equal(await d.oku("a.md"), "yeni");
});

test("yaz: olmayan dosya hata fırlatır (sessiz yutulmaz) ve sonraki işler çalışmaya devam eder", async () => {
  const s = sahteKaynak({ "a.md": { metin: "x", aktif: false } });
  const d = mdDeposuKur(s.k);
  await d.baslat();
  await assert.rejects(d.yaz("yok.md", "z"), (e: MdHatasi) => e.kod === "yok");
  await d.yaz("a.md", "y");
  assert.equal(await d.oku("a.md"), "y");
});

test("yeni: pasif başlar, listede görünür; var olanı ezmez (hata)", async () => {
  const s = sahteKaynak({});
  const d = mdDeposuKur(s.k);
  await d.baslat();
  await d.yeni("notlar.md", "# merhaba");
  assert.deepEqual(d.liste().map((x) => [x.ad, x.aktif]), [["notlar.md", false]]);
  await assert.rejects(d.yeni("notlar.md"), (e: MdHatasi) => e.kod === "var");
});

test("anlık hafıza: yalnız otomatik bölüm güncellenir, Ozyn'in notu kalır", async () => {
  const s = sahteKaynak({ [ANLIK_HAFIZA]: { metin: dosya("eski", "OZYN NOTU"), aktif: true } });
  const d = mdDeposuKur(s.k);
  await d.baslat();
  assert.equal(await d.anlikGuncelle("- Yer: masa"), true);
  const m = await d.oku(ANLIK_HAFIZA);
  assert.match(m, /^OZYN NOTU/);
  assert.equal(bolumuOku(m), "- Yer: masa");
  assert.match(d.baglam().metin, /Yer: masa/);
  assert.doesNotMatch(d.baglam().metin, /orion:otomatik/);   // işaretler beyne gitmez
});

test("anlık hafıza: blok değişmediyse diske YAZILMAZ (her tikte yeniden yazma yok)", async () => {
  const s = sahteKaynak({ [ANLIK_HAFIZA]: { metin: dosya("- Yer: masa"), aktif: true } });
  const d = mdDeposuKur(s.k);
  await d.baslat();
  assert.equal(await d.anlikGuncelle("- Yer: masa"), false);
  assert.deepEqual(s.yazilanlar, []);
});

test("anlık hafıza: dosya yoksa oluşturulur ve bloğu içerir", async () => {
  const s = sahteKaynak({});
  const d = mdDeposuKur(s.k);
  await d.baslat();
  assert.equal(await d.anlikGuncelle("- Yer: masa"), true);
  assert.equal(bolumuOku(await d.oku(ANLIK_HAFIZA)), "- Yer: masa");
  assert.equal(d.liste()[0]!.ad, ANLIK_HAFIZA);
});

test("anlık hafıza kaydı: Ozyn bölümün İÇİNİ değiştirse bile sistemin bloğu korunur, dışı kaydedilir", async () => {
  const s = sahteKaynak({ [ANLIK_HAFIZA]: { metin: dosya("sistem-blok", "ÖN"), aktif: true } });
  const d = mdDeposuKur(s.k);
  await d.baslat();
  const kaydedilen = await d.yaz(ANLIK_HAFIZA, dosya("OZYN-ELLE", "ÖN + Ozyn'in yeni notu"));
  assert.equal(bolumuOku(kaydedilen), "sistem-blok");
  assert.match(kaydedilen, /Ozyn'in yeni notu/);
  assert.equal(bolumuOku(await d.oku(ANLIK_HAFIZA)), "sistem-blok");
});

test("sıra: art arda yazan işler birbirinin üstüne binmez (gecikmeli yazımda bile)", async () => {
  const s = sahteKaynak({ [ANLIK_HAFIZA]: { metin: dosya("0", "ÖN"), aktif: true } });
  s.gecikmeAyarla(15);
  const d = mdDeposuKur(s.k);
  await d.baslat();
  const p1 = d.anlikGuncelle("1");
  const p2 = d.yaz(ANLIK_HAFIZA, `ÖN + not\n${ISARET_BASI}\nx\n${ISARET_SONU}\n`);
  const p3 = d.anlikGuncelle("2");
  await Promise.all([p1, p2, p3]);
  const son = await d.oku(ANLIK_HAFIZA);
  assert.equal(bolumuOku(son), "2");
  assert.match(son, /ÖN \+ not/);   // Ozyn'in notu sistem güncellemeleriyle ezilmedi
});

test("olaylar: liste ve içerik değişimi haber verilir; abonelik bırakılır", async () => {
  const s = sahteKaynak({ [ANLIK_HAFIZA]: { metin: dosya("0"), aktif: true } });
  const d = mdDeposuKur(s.k);
  const olaylar: string[] = [];
  const birak = d.dinle((o) => olaylar.push(o.tur === "icerik" ? `icerik:${o.ad}` : "liste"));
  await d.baslat();
  await d.anlikGuncelle("1");
  assert.ok(olaylar.includes("liste"));
  assert.ok(olaylar.includes(`icerik:${ANLIK_HAFIZA}`));
  birak();
  const n = olaylar.length;
  await d.anlikGuncelle("2");
  assert.equal(olaylar.length, n);
});

test("ipcKaynagi: {ok,deger} açılır; {ok:false} MdHatasi olur (kod korunur)", async () => {
  const yuz: MdKopruYuzu = {
    mdListe: async () => ({ ok: true, deger: [{ ad: "a.md", boyut: 1, degisti: 1, aktif: true, sistem: false }] }),
    mdOku: async () => ({ ok: false, kod: "yok", mesaj: "md dosyası yok: a.md" }),
    mdYaz: async () => ({ ok: true, deger: true }), mdYeni: async () => ({ ok: true, deger: true }), mdAktif: async () => ({ ok: true, deger: true }),
  };
  const k = ipcKaynagi(yuz);
  assert.equal((await k.liste())[0]!.ad, "a.md");
  await assert.rejects(k.oku("a.md"), (e: MdHatasi) => e.kod === "yok" && /yok/.test(e.message));
  await k.yaz("a.md", "x"); await k.yeni("b.md", ""); await k.aktifYap("a.md", false);
});

test("yerelKaynak: yeni → yaz → oku → aktif → liste gidiş-dönüş; kurallar host'unkiyle aynı", async () => {
  const depo = new Map<string, string>();
  const k = yerelKaynak({ getItem: (a) => depo.get(a) ?? null, setItem: (a, v) => { depo.set(a, v); } }, () => 5);
  await k.yeni("notlar.md", "bir");
  await k.yaz("notlar.md", "iki");
  assert.equal(await k.oku("notlar.md"), "iki");
  await k.aktifYap("notlar.md", true);
  assert.deepEqual((await k.liste()).map((x) => [x.ad, x.aktif, x.degisti]), [["notlar.md", true, 5]]);
  await assert.rejects(k.yeni("notlar.md", ""), (e: MdHatasi) => e.kod === "var");
  await assert.rejects(k.yaz("yok.md", "x"), (e: MdHatasi) => e.kod === "yok");
  await assert.rejects(k.yeni("../kacis.md", ""), (e: MdHatasi) => e.kod === "gecersiz-ad");
});

test("çalışmayan kaynak: liste boş, her işlem NEDENLE hata verir (sessiz boş liste değil)", async () => {
  const k = calismayanKaynak("depo yok");
  assert.deepEqual(await k.liste(), []);
  await assert.rejects(k.oku("a.md"), /depo yok/);
  await assert.rejects(k.yaz("a.md", "x"), (e: MdHatasi) => e.kod === "hata");
  const d = mdDeposuKur(k);
  await d.baslat();
  assert.deepEqual(d.liste(), []);
  await assert.rejects(d.yeni("a.md"), /depo yok/);
});

// ── Ayarlanabilir bağlam bütçesi (Ozyn, 2026-10-21): sınır ÇAĞRI ANINDA okunur ──
test("bütçe sınırı canlı okunur: aynı depo, sınır düşünce bağlam KISALIR (yeniden kurmadan)", async () => {
  const s = sahteKaynak({ "a.md": { metin: "x".repeat(1500), aktif: true } });
  let toplam = 5000;
  const d = mdDeposuKur(s.k, () => ({ dosyaBasina: 2000, toplam, anlikTavan: 6000 }));
  await d.baslat();
  assert.equal(d.baglam().kullanilan.length, 1);
  toplam = 1000;   // pano düğmesi değişti
  const b = d.baglam();
  assert.deepEqual([b.kullanilan.length, b.atlanan.map((x) => x.ad)], [0, ["a.md"]]);
});

test("tek not sınırı canlı okunur: 1500 karakterlik not 800'e inince KESİLDİ olur", async () => {
  const s = sahteKaynak({ "a.md": { metin: "satır\n".repeat(250), aktif: true } });
  let dosyaBasina = 2000;
  const d = mdDeposuKur(s.k, () => ({ dosyaBasina, toplam: 5000, anlikTavan: 6000 }));
  await d.baslat();
  assert.equal(d.baglam().kullanilan[0]?.kesildi, false);
  dosyaBasina = 800;
  assert.deepEqual([d.baglam().kullanilan[0]?.kesildi, (d.baglam().kullanilan[0]?.karakter ?? 0) <= 800], [true, true]);
});
