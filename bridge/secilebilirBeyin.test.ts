// bridge/secilebilirBeyin.test.ts — beyin değiştiricinin YALAN SÖYLEYEBİLECEĞİ yerler.
//
// Naif bir değiştirici (`this._ic = yeni`) çalışıyor gibi görünür. Kırıldığı
// yerler: yarım kalan düşünceyi başka beyne vermek, sağlıksız beyne geçmek,
// eşzamanlı iki isteğin yarım durum bırakması, geçişte oturum bağlamını
// sessizce çöpe atmak. Testler bunları hedefliyor.
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { SecilebilirBeyin } from "./secilebilirBeyin.ts";
import type { Beyin, BeyinGirdisi, BeyinCikti } from "./beyin.ts";

const GIRDI = { talimat: "", mesajlar: [], araclar: [] } as unknown as BeyinGirdisi;

/** Elle yönetilen sahte beyin: düşünmeyi dışarıdan bitirebiliriz. */
function sahte(ad: string, saglik: boolean | (() => Promise<boolean>) = true) {
  const bekleyen: ((c: BeyinCikti) => void)[] = [];
  let dusunmeSayisi = 0;
  const b: Beyin = {
    ad,
    hazirMi: typeof saglik === "function" ? saglik : async () => saglik,
    dusun: () => {
      dusunmeSayisi++;
      return new Promise<BeyinCikti>((r) => bekleyen.push(r));
    },
  };
  return {
    b,
    bitir: () => bekleyen.shift()!({ metin: `${ad} dedi`, cagrilar: [] }),
    sayi: () => dusunmeSayisi,
  };
}

/** Kurulum sayacı — tembellik ve önbellek testleri için. */
function sayacli(beyin: Beyin) {
  let n = 0;
  return { kur: () => { n++; return beyin; }, kac: () => n };
}

test("YARIM DÜŞÜNCE eski beyinde biter, sonraki tur yeni beyne gider", async () => {
  // Tasarımın ilk kuralı. Geçiş yarım düşünceyi başka beyne devretseydi,
  // A'nın başlattığı akıl yürütmeyi B bitirirdi.
  const a = sahte("A"), bb = sahte("B");
  const s = new SecilebilirBeyin([
    { ad: "a", kur: () => a.b }, { ad: "b", kur: () => bb.b },
  ], "a");

  const suren = s.dusun(GIRDI);                // A'da düşünüyor
  assert.equal(s.iste("b"), "");
  await s.gecisBitti();
  assert.equal(s.aktif, "b", "geçiş olmadı");

  a.bitir();                                    // A şimdi bitiriyor
  assert.equal((await suren).metin, "A dedi", "yarım düşünce başka beyne kaydı");

  const sonraki = s.dusun(GIRDI);
  bb.bitir();
  assert.equal((await sonraki).metin, "B dedi");
  assert.equal(a.sayi(), 1, "A ikinci turu da aldı");
});

test("SAĞLIKSIZ hedefe GEÇİLMEZ — aktif kalır, istenen geri döner, sebep yazılır", async () => {
  const s = new SecilebilirBeyin([
    { ad: "a", kur: () => sahte("A").b },
    { ad: "b", kur: () => sahte("B", false).b },
  ], "a");

  assert.equal(s.iste("b"), "", "istek kontrol başlatmalıydı");
  assert.equal(s.istenen, "b", "istenen hemen görünmeli");
  await s.gecisBitti();

  assert.equal(s.aktif, "a", "sağlıksız beyne geçildi");
  assert.equal(s.istenen, "a", "istenen geri dönmedi — panel yanlış beyni gösterir");
  assert.equal(s.gecis.tur, "reddedildi");
  assert.match(s.gecis.tur === "reddedildi" ? s.gecis.sebep : "", /hazır değil/);
});

test("KURULUM fırlatırsa geçilmez, aktif ayakta kalır", async () => {
  const s = new SecilebilirBeyin([
    { ad: "a", kur: () => sahte("A").b },
    { ad: "b", kur: () => { throw new Error("adres geçersiz"); } },
  ], "a");
  assert.equal(s.iste("b"), "");
  await s.gecisBitti();
  assert.equal(s.aktif, "a");
  assert.match(s.gecis.tur === "reddedildi" ? s.gecis.sebep : "", /adres geçersiz/);
});

test("ASILI sağlık kontrolü zaman aşımına düşer — dünya beklemez", async () => {
  const s = new SecilebilirBeyin([
    { ad: "a", kur: () => sahte("A").b },
    { ad: "b", kur: () => sahte("B", () => new Promise<boolean>(() => {})).b },
  ], "a", { saglikZamanAsimiMs: 30 });
  s.iste("b");
  await s.gecisBitti();
  assert.equal(s.aktif, "a");
  assert.match(s.gecis.tur === "reddedildi" ? s.gecis.sebep : "", /zaman aşımı/);
});

test("KONTROL sürerken ikinci istek REDDEDİLİR — yarım durum yok", async () => {
  let izin!: (v: boolean) => void;
  const s = new SecilebilirBeyin([
    { ad: "a", kur: () => sahte("A").b },
    { ad: "b", kur: () => sahte("B", () => new Promise<boolean>((r) => { izin = r; })).b },
    { ad: "c", kur: () => sahte("C").b },
  ], "a");

  assert.equal(s.iste("b"), "");
  assert.match(s.iste("c"), /geçiş sürüyor/);
  assert.equal(s.istenen, "b", "ikinci istek birincinin hedefini ezdi");
  izin(true);
  await s.gecisBitti();
  assert.equal(s.aktif, "b");
});

test("KONTROL sürerken düşünce ESKİ beyne gider", async () => {
  let izin!: (v: boolean) => void;
  const a = sahte("A");
  const s = new SecilebilirBeyin([
    { ad: "a", kur: () => a.b },
    { ad: "b", kur: () => sahte("B", () => new Promise<boolean>((r) => { izin = r; })).b },
  ], "a");
  s.iste("b");
  const d = s.dusun(GIRDI);
  a.bitir();
  assert.equal((await d).metin, "A dedi", "doğrulanmamış beyne düşünce gönderildi");
  izin(true);
  await s.gecisBitti();
});

test("TEMBEL: seçilmeyen beyin hiç KURULMAZ", () => {
  // Açılışta bütün beyinlere bağlantı açmak, kullanılmayan bir bulut
  // oturumu ya da yüklenmemiş bir yerel model için bedel ödemek demekti.
  const b = sayacli(sahte("B").b);
  new SecilebilirBeyin([{ ad: "a", kur: () => sahte("A").b }, { ad: "b", kur: b.kur }], "a");
  assert.equal(b.kac(), 0);
});

test("ÖNBELLEK: A→B→A'da A yeniden kurulmaz — oturum bağlamı korunur", async () => {
  // OpenCode beyni oturum geçmişini örnekte tutuyor. Geri dönüşte yeniden
  // kurmak, kullanıcının teyitte okuduğu "bağlam kaybı" uyarısını gereksiz
  // yere gerçeğe çevirirdi.
  const a = sayacli(sahte("A").b);
  const s = new SecilebilirBeyin([{ ad: "a", kur: a.kur }, { ad: "b", kur: () => sahte("B").b }], "a");
  s.iste("b"); await s.gecisBitti();
  s.iste("a"); await s.gecisBitti();
  assert.equal(s.aktif, "a");
  assert.equal(a.kac(), 1, "A iki kez kuruldu");
});

test("BİLİNMEYEN ad reddedilir, hiçbir şey değişmez", async () => {
  const s = new SecilebilirBeyin([{ ad: "a", kur: () => sahte("A").b }], "a");
  assert.match(s.iste("yok"), /böyle bir beyin yok/);
  assert.equal(s.istenen, "a");
  assert.equal(s.gecis.tur, "sakin");
});

test("ZATEN aktif olanı istemek işlemsiz kabul edilir", async () => {
  const s = new SecilebilirBeyin([{ ad: "a", kur: () => sahte("A").b }], "a");
  assert.equal(s.iste("a"), "");
  assert.equal(s.gecis.tur, "sakin", "gereksiz sağlık kontrolü başladı");
});

test("AD canlı: geçişten sonra `ad` yeni beynin adı", async () => {
  const s = new SecilebilirBeyin([
    { ad: "a", kur: () => sahte("opencode:x").b },
    { ad: "b", kur: () => sahte("qwen2.5:7b").b },
  ], "a");
  assert.equal(s.ad, "opencode:x");
  s.iste("b"); await s.gecisBitti();
  assert.equal(s.ad, "qwen2.5:7b");
  assert.equal(s.ic.ad, "qwen2.5:7b", "iç örnek (instanceof sorguları için) güncellenmedi");
});

test("BİLDİRİM: geçiş ve ret dışarı haber verilir", async () => {
  const olaylar: string[] = [];
  const s = new SecilebilirBeyin([
    { ad: "a", kur: () => sahte("A").b },
    { ad: "b", kur: () => sahte("B").b },
    { ad: "c", kur: () => sahte("C", false).b },
  ], "a", { bildir: (o) => olaylar.push(`${o.tur}:${o.hedef}`) });
  s.iste("b"); await s.gecisBitti();
  s.iste("c"); await s.gecisBitti();
  assert.deepEqual(olaylar, ["gecti:b", "reddedildi:c"]);
});

test("KURUCU bozuk listeyi reddeder", () => {
  const a = { ad: "a", kur: () => sahte("A").b };
  assert.throws(() => new SecilebilirBeyin([], "a"), /boş/);
  assert.throws(() => new SecilebilirBeyin([a, a], "a"), /iki kez/);
  assert.throws(() => new SecilebilirBeyin([a], "z"), /başlangıç/);
});

test("secenekAdlari panele sırayla verilir", () => {
  const s = new SecilebilirBeyin([
    { ad: "a", kur: () => sahte("A").b }, { ad: "b", kur: () => sahte("B").b },
  ], "a");
  assert.deepEqual(s.secenekAdlari(), ["a", "b"]);
});
