// bridge/mcpBeyin.test.ts — ajan ÇEKER (spec 05 §2): MCP ajanı bir Beyin olur.
//
// NAİF ÇÖZÜMDEN ÖNCE yazıldı. Hedeflenen çöküş biçimleri (spec 05 §3):
//   R1  ajan yok / öldü → köprü `dusun()`da SONSUZA KADAR bekler, Orion susar
//   R2  (burada değil — izin ayarı, canlı kapı)
//   R7  ajan tur DIŞINDA araç çağırır → köprünün korumaları (dogrula, onay
//       kapısı, zincir bütçesi, susma kapısı) atlanır
//   —   ajan turu hiç kapatmaz → köprü takılı kalır
//   —   talimat her turda yeniden gönderilir → bağlam şişer
//   —   `tik` ajana sızar (maliyet tavanı) — köprü üzerinden sınanır
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { McpBeyin } from "./mcpBeyin.ts";
import { Kopru } from "./kopru.ts";
import type { BeyinGirdisi } from "./beyin.ts";
import type { Niyet } from "../protocol/niyet.ts";

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

function girdi(ek: Partial<BeyinGirdisi> = {}): BeyinGirdisi {
  return { talimat: "TALIMAT_IZI", sabit: "SABIT_IZI", dunya: "DUNYA_IZI",
           anilar: [], ozetler: ["OZET_IZI"], gecmis: [], araclar: [], ...ek };
}

/** Kısa süreler: testler hızlı, ama davranış aynı. */
function kur() {
  return new McpBeyin({ temasZamanAsimiMs: 300, turZamanAsimiMs: 400 });
}

test("R1: ajan HİÇ bağlanmadıysa dusun() hemen döner — köprü takılmaz", async () => {
  const m = kur();
  const t0 = Date.now();
  const c = await m.dusun(girdi());
  assert.ok(Date.now() - t0 < 100, `ajan yokken ${Date.now() - t0} ms bekledi`);
  assert.deepEqual(c.cagrilar, []);
  assert.equal(await m.hazirMi(), false);
});

test("ÇEKME: ajan bekliyorken girdi gelir → bekle() girdiyi döndürür", async () => {
  const m = kur();
  const b = m.bekle(1000);
  await bekle(10);
  void m.dusun(girdi());
  const s = await b;
  assert.ok(!("sessiz" in s), "girdi varken sessiz dondu");
  assert.match("metin" in s ? s.metin : "", /DUNYA_IZI/);
  assert.match("metin" in s ? s.metin : "", /OZET_IZI/);
});

test("TUR: araç çağrıları toplanır, sonraki bekle() turu kapatır ve köprüye döner", async () => {
  const m = kur();
  void m.bekle(1000);                 // ajan bağlandı
  await bekle(10);
  const d = m.dusun(girdi());
  await bekle(10);
  assert.equal(m.cagri("dunya_soyle", { metin: "merhaba" }).ok, true);
  assert.equal(m.cagri("dunya_bak", { hedef: { tip: "oyuncu" } }).ok, true);
  void m.bekle(1000);                 // "turum bitti, sıradakini ver"
  const c = await d;
  assert.deepEqual(c.cagrilar.map((x) => x.ad), ["dunya_soyle", "dunya_bak"]);
});

test("R7: tur DIŞINDA araç çağrısı REDDEDİLİR — korumalar atlanamaz", () => {
  const m = kur();
  const r = m.cagri("dunya_komut", { metin: "rm -rf /", gerekce: "x" });
  assert.equal(r.ok, false, "tur disinda arac kabul edildi — kopru atlandi");
  assert.match(r.mesaj, /dunya_bekle/);
});

test("bekle() sessizlikte süre dolunca 'sessiz' döner — ajan döngüsü sürer", async () => {
  const m = kur();
  const s = await m.bekle(50);
  assert.ok("sessiz" in s && s.sessiz, "bos bekleme sessiz donmedi");
});

test("ajan turu HİÇ kapatmazsa köprü sonsuza kadar beklemez", async () => {
  const m = kur();
  void m.bekle(1000);
  await bekle(10);
  const d = m.dusun(girdi());
  await bekle(10);
  m.cagri("dunya_soyle", { metin: "yarim kaldi" });
  const t0 = Date.now();
  const c = await d;                  // ajan bir daha bekle() çağırmıyor
  assert.ok(Date.now() - t0 < 1000, "tur zaman asimi calismadi");
  assert.deepEqual(c.cagrilar.map((x) => x.ad), ["dunya_soyle"], "toplanan cagri kayboldu");
});

test("TALİMAT oturumda BİR KEZ gider — her turda bağlam şişmez", async () => {
  const m = kur();
  const b1 = m.bekle(1000); await bekle(10);
  const d1 = m.dusun(girdi()); const s1 = await b1;
  const b2 = m.bekle(1000); await d1; await bekle(10);
  void m.dusun(girdi({ ozetler: ["IKINCI_TUR"] })); const s2 = await b2;
  const m1 = "metin" in s1 ? s1.metin : "", m2 = "metin" in s2 ? s2.metin : "";
  assert.match(m1, /TALIMAT_IZI/, "ilk turda talimat yok");
  assert.doesNotMatch(m2, /TALIMAT_IZI/, "talimat her turda tekrar gonderildi");
  assert.match(m2, /IKINCI_TUR/);
});

test("R1: temas koparsa hazirMi() false, kesikSaniye > 0 — sağ lob devralabilsin", async () => {
  const m = kur();
  void m.bekle(10);
  await bekle(20);
  assert.equal(await m.hazirMi(), true);
  await bekle(350);                   // temasZamanAsimi (300) geçti
  assert.equal(await m.hazirMi(), false);
  assert.ok(m.kesikSaniye > 0);
});

test("ARAÇ LİSTESİ protokolden üretilir + dunya_bekle — ikinci liste yok", () => {
  const adlar = kur().araclar().map((a) => a.ad);
  for (const a of ["dunya_soyle", "dunya_komut", "dunya_sor", "dunya_git", "dunya_bekle"]) {
    assert.ok(adlar.includes(a), `${a} yok`);
  }
});

// ── Köprüyle BİRLİKTE: MCP yolu korumaların hiçbirini atlamaz ─────────────

/** Tek tur oynayan sahte ajan: bekle → araçları çağır → bekle. */
async function ajanTuru(m: McpBeyin, cagrilar: [string, unknown][]): Promise<string> {
  const s = await m.bekle(2000);
  if ("sessiz" in s) return "";
  for (const [ad, g] of cagrilar) m.cagri(ad, g);
  void m.bekle(2000);                 // turu kapat
  return s.metin;
}

test("KÖPRÜ: tik ajana ASLA ulaşmaz — maliyet tavanı MCP yolunda da geçerli", async () => {
  const m = kur();
  const k = new Kopru({ beyin: m, niyetGonder: () => {}, dunyaDurumu: () => "D", toplamaMs: 20 });
  const b = m.bekle(300);             // ajan dinliyor
  for (let i = 0; i < 40; i++) k.algi({ tur: "tik", t: i, dt: 0.05, orion: {} as never, oyuncu: {} as never });
  const s = await b;
  assert.ok("sessiz" in s, "tik ajana ulasti");
});

test("KÖPRÜ: dunya_komut ONAY yolundan geçer — ajan komut çalıştıramaz", async () => {
  const m = kur();
  const niyetler: Niyet[] = [];
  const k = new Kopru({ beyin: m, niyetGonder: (n) => niyetler.push(n), dunyaDurumu: () => "D", toplamaMs: 20 });
  const tur = ajanTuru(m, [["dunya_komut", { metin: "git status", gerekce: "yazim hatasi" }]]);
  await bekle(10);
  k.algi({ tur: "duydum", metin: "ne yapayım", kesin: true });
  await tur; await bekle(80);
  // Komut ÇALIŞMADI: yalnızca `komut` NİYETİ oldu — dünya onu onay kapısına verir.
  assert.deepEqual(niyetler.map((n) => n.tur), ["komut"]);
});

test("KÖPRÜ: geçersiz araç reddedilir ve gerekçesi ajana GERİ döner (R7)", async () => {
  const m = kur();
  const niyetler: Niyet[] = [];
  const k = new Kopru({ beyin: m, niyetGonder: (n) => niyetler.push(n), dunyaDurumu: () => "D", toplamaMs: 20 });
  const tur1 = ajanTuru(m, [["dunya_poz", { poz: "zıplıyor" }]]);
  await bekle(10);
  k.algi({ tur: "duydum", metin: "zıpla", kesin: true });
  await tur1;
  const ikinci = await m.bekle(2000);
  assert.equal(niyetler.length, 0, "gecersiz arac niyete donustu");
  assert.match("metin" in ikinci ? ikinci.metin : "", /reddedildi/, "ret gerekcesi ajana donmedi");
});

test("YENİ OTURUM talimatı yeniden alır — hızlı yeniden başlatma talimatsız kalmaz", async () => {
  // Canlıda bulundu: ajan oturumu bitti, denetleyici hemen yeniden başlattı.
  // Temas hiç kopmadığı için (60 sn dolmadı) yeni oturum talimatı ALMAYACAKTI.
  const m = kur();
  const b1 = m.bekle(1000); await bekle(10);
  const d1 = m.dusun(girdi()); await b1;
  const b2 = m.bekle(1000); await d1; await bekle(10);
  m.oturumBasladi();                  // MCP `initialize` — yeni ajan oturumu
  void m.dusun(girdi({ ozetler: ["YENI_OTURUM"] }));
  const s = await b2;
  assert.match("metin" in s ? s.metin : "", /TALIMAT_IZI/, "yeni oturum talimatsiz basladi");
});

// ── TEMAS = AÇIK BAĞLANTI (canlı ölçümden, 2026-09-19) ─────────────────────
// Ajan 25 sn "quiet" alınca oturumu BİTİRİYOR (spec 05 R5 varsayımı yanlış çıktı)
// ve her yeniden başlatma ~$0,025 — 25 sn'lik beklemeyle saatte ~$3,4 boşta.
// Bekleme uzamalı; o zaman temas, SÜREYLE değil açık bağlantıyla ölçülmeli.

test("UZUN BEKLEME: bekleyen ajan temas süresini aşsa da CANLI sayılır", async () => {
  const m = kur();                    // temasZamanAsimi 300 ms
  void m.bekle(2000);                 // ajan uzun bekliyor
  await bekle(400);                   // temas süresi geçti, bekleme sürüyor
  assert.equal(await m.hazirMi(), true, "bekleyen ajan kopuk sanildi");
  const d = m.dusun(girdi());
  await bekle(20);
  // R1 boş cevabı DEĞİL: girdi ajana teslim edilmeli (tur açık).
  assert.equal(m.cagri("dunya_soyle", { metin: "x" }).ok, true, "girdi bekleyen ajana teslim edilmedi");
  void m.bekle(2000);
  const c = await d;
  assert.equal(c.cagrilar.length, 1);
});

test("BAĞLANTI KOPTU: bekleIptal() → temas HEMEN kopar, köprü beklemez (R1)", async () => {
  const m = kur();
  void m.bekle(5000);
  await bekle(10);
  m.bekleIptal();                     // HTTP isteği kapandı: ajan öldü
  assert.equal(await m.hazirMi(), false, "olu ajan canli sanildi");
  const t0 = Date.now();
  const c = await m.dusun(girdi());
  assert.ok(Date.now() - t0 < 100, "olu ajana girdi teslim edilmeye calisildi");
  assert.deepEqual(c.cagrilar, []);
});

test("SATIR SÖZLEŞMESİ MCP ajanına GİTMEZ — ajan gerçek araç çağırır", async () => {
  // Canlıda bulundu: ajan durumu aldı ve HİÇ araç çağırmadan metinle bitirdi.
  // Sebep: bağlam, araçsız modeller için yazılmış satır sözleşmesini
  // ("cevabını cümleyle yaz, eylemi KOMUT: satırıyla belirt") taşıyordu.
  // Spec 05'in MCP'yi seçme sebebi tam da bu hileden kurtulmaktı.
  const m = kur();
  const b = m.bekle(1000); await bekle(10);
  void m.dusun(girdi());
  const s = await b;
  const metin = "metin" in s ? s.metin : "";
  assert.match(metin, /TALIMAT_IZI/, "talimat yok");
  assert.doesNotMatch(metin, /KOMUT: </, "satir sozlesmesi MCP ajanina gitti");
});
