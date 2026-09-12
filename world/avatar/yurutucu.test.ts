// world/avatar/yurutucu.test.ts — Niyet yürütücüsünün düşman testleri.
//
// Koşum: node --experimental-strip-types --test world/avatar/yurutucu.test.ts
// Babylon YÜKLENMEZ. Yol bulma, varış, sıra yönetimi ve poz geçişleri burada
// motor olmadan ölçülür — T2'nin iki katman ayrımının kanıtı budur.
//
// Bu testler NAİF ÇÖZÜMDEN ÖNCE yazıldı. Her biri gerçek bir çöküş biçimini
// hedefler:
//   - ulaşılamaz hedefte sonsuz döngü / sessizce yerinde kalma
//   - `dur`un yutulması
//   - ikinci `git`in ne yaptığının belirsiz kalması
//   - oturur hâlde yürümeye kalkma (sandalyeyi sürükleyerek)
//   - yol bulmanın masayı görmezden gelip içinden geçmesi
//   - hedefin üstünde durup yine yürüme animasyonu tetiklemesi
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Yurutucu, ARA_NOKTA_TOLERANSI, BOYUN_PITCH_SINIRI, BOYUN_YAW_SINIRI, NOKTA_TOLERANSI, aciSar } from "./yurutucu.ts";
import { AVATAR_YARICAP, yolBul, yolUzunlugu } from "./yolBulma.ts";
import { capaBul, mesafeXZ } from "../level/capalar.ts";
import { bostaHesapla } from "./bosta.ts";
import { MASA, carpisiyorMu } from "../level/olculer.ts";
import type { Niyet, NiyetSonucu } from "../../protocol/niyet.ts";

const DT = 1 / 20; // 20 Hz — dünya saatiyle aynı adım

/** Test koşucusu: niyet gönder, N tik ilerlet, tüm sonuçları topla. */
class Kosucu {
  y: Yurutucu;
  sonuclar: NiyetSonucu[] = [];
  /** Her tikteki konum izi — çarpışma denetimi için. */
  iz: { x: number; z: number }[] = [];

  constructor(spawn = { x: 0, y: 0, z: 0 }, yaw = 0) {
    this.y = new Yurutucu({ spawn, yaw });
  }
  niyet(n: Niyet, id: string): this { this.y.niyet(n, id); return this; }
  tik(n = 1): this {
    for (let i = 0; i < n; i++) {
      this.sonuclar.push(...this.y.ilerle(DT));
      const d = this.y.durum();
      this.iz.push({ x: d.konum.x, z: d.konum.z });
    }
    return this;
  }
  /** Sonuç gelene kadar (azami `azami` tik) ilerlet. */
  bekle(id: string, durum: NiyetSonucu["durum"], azami = 600): NiyetSonucu | null {
    for (let i = 0; i < azami; i++) {
      this.tik();
      const s = this.sonuclar.find((r) => r.niyet_id === id && r.durum === durum);
      if (s) return s;
    }
    return null;
  }
  bul(id: string): NiyetSonucu[] { return this.sonuclar.filter((r) => r.niyet_id === id); }
  durumlar(id: string): string[] { return this.bul(id).map((r) => r.durum); }
}

// ── 1. Ulaşılamaz hedef → hata, sonsuz döngü YOK ──────────────────────────

test("masanın İÇİ ulaşılamaz: hata döner, iş açılmaz, tik sonsuza gitmez", () => {
  const k = new Kosucu();
  k.niyet({ tur: "git", hedef: { tip: "nokta", x: MASA.x, y: 0, z: MASA.z } }, "n1").tik();
  const s = k.bul("n1");
  assert.equal(s.length, 1, "tek sonuç beklenir");
  assert.equal(s[0]!.durum, "hata");
  assert.match(s[0]!.not ?? "", /ulaşıl/i);
  assert.equal(k.y.durum().mesgul, false, "başarısız git meşgul bırakmamalı");
  // 100 tik daha: yeni sonuç üretmiyor, dönmüyor, kımıldamıyor.
  const once = { ...k.y.durum().konum };
  k.tik(100);
  assert.equal(k.bul("n1").length, 1);
  assert.deepEqual(k.y.durum().konum, once);
});

test("masanın ARKASI (duvar ile masa arası) ulaşılamaz — yolBul null", () => {
  // masa z=-3.25, derinlik .85 → arka yüzü -3.675; arka duvar -4. Kalan boşluk
  // 0.325 m, avatar yarıçapı 0.34 → geçemez. Bu bir doğruluk testi:
  // "ulaşılamaz"ın gerçekten ulaşılamaz olduğunu odanın ölçüleri söylüyor.
  assert.equal(yolBul({ x: 0, z: 0 }, { x: 0, z: -3.85 }, AVATAR_YARICAP), null);
});

test("geçersiz sayı içeren nokta hedefi hata döner, çökmez", () => {
  const k = new Kosucu();
  k.niyet({ tur: "git", hedef: { tip: "nokta", x: NaN, y: 0, z: 0 } }, "n1").tik();
  assert.equal(k.bul("n1")[0]!.durum, "hata");
  k.niyet({ tur: "git", hedef: { tip: "capa", ad: "bulut" } }, "n2").tik();
  assert.equal(k.bul("n2")[0]!.durum, "hata");
  assert.match(k.bul("n2")[0]!.not ?? "", /bilinmeyen/i);
});

// ── 2. `git` sırasında `dur` → iptal ───────────────────────────────────────

test("git sırasında dur: git 'iptal', dur 'bitti', durum tutarlı", () => {
  const k = new Kosucu();
  k.niyet({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }, "g1").tik(10);
  assert.equal(k.y.durum().mesgul, true);
  assert.equal(k.y.durum().poz, "yürüyor");
  const yoldaki = { ...k.y.durum().konum };

  k.niyet({ tur: "dur" }, "d1").tik();
  assert.deepEqual(k.durumlar("g1"), ["basladi", "iptal"]);
  assert.deepEqual(k.durumlar("d1"), ["bitti"]);
  assert.equal(k.y.durum().mesgul, false);
  assert.equal(k.y.durum().poz, "duruyor");

  // Durdu demek DURDU demek: 40 tik sonra hâlâ aynı yerde.
  k.tik(40);
  assert.ok(mesafeXZ(k.y.durum().konum, yoldaki) < 1e-9, "dur sonrası kaymamalı");
  assert.equal(k.bul("g1").length, 2, "iptal edilen iş sonradan 'bitti' yaymamalı");
});

test("dur oynayan jesti de keser", () => {
  const k = new Kosucu();
  k.niyet({ tur: "jest", jest: "el_salliyor" }, "j1").tik(2);
  assert.equal(k.y.gorunum().jest, "el_salliyor");
  k.niyet({ tur: "dur" }, "d1").tik();
  assert.equal(k.y.gorunum().jest, null);
});

// ── 3. `git` sırasında ikinci `git` → EN SON EMİR KAZANIR ─────────────────

test("git sırasında ikinci git: birincisi iptal, ikincisi tamamlanır", () => {
  const k = new Kosucu();
  k.niyet({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }, "g1").tik(8);
  k.niyet({ tur: "git", hedef: { tip: "capa", ad: "kapi" } }, "g2").tik();

  assert.deepEqual(k.durumlar("g1"), ["basladi", "iptal"], "eski niyet SESSİZCE yutulamaz");
  assert.match(k.bul("g1")[1]!.not ?? "", /kesildi/);
  assert.equal(k.durumlar("g2")[0], "basladi");

  const bitti = k.bekle("g2", "bitti");
  assert.ok(bitti, "ikinci git tamamlanmalı");
  const kapi = capaBul("kapi")!;
  assert.ok(mesafeXZ(k.y.durum().konum, kapi.durak) <= NOKTA_TOLERANSI + 1e-6,
    `kapı durağına varmalı, kaldı: ${mesafeXZ(k.y.durum().konum, kapi.durak).toFixed(3)}`);
  // g1 ikinci kez sonuç yaymadı.
  assert.equal(k.bul("g1").length, 2);
});

// ── 4. `oturuyor` iken `git` → önce KALKAR ────────────────────────────────

test("oturuyor iken git: otomatik kalkar, sonra yürür, sonuçta kalkildi:true", () => {
  const k = new Kosucu();
  k.niyet({ tur: "otur" }, "o1");
  assert.ok(k.bekle("o1", "bitti"), "otur tamamlanmalı");
  assert.equal(k.y.durum().oturuyor_mu, true);
  assert.equal(k.y.durum().poz, "oturuyor");
  const oturmaY = k.y.durum().konum.y;
  assert.ok(oturmaY > 0.05, `oturunca y yükselmeli, ölçülen ${oturmaY}`);

  k.niyet({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }, "g1").tik();
  assert.equal(k.durumlar("g1")[0], "basladi");
  // Kalkma aşaması: poz artık oturuyor olamaz.
  assert.equal(k.y.durum().poz, "duruyor");

  const bitti = k.bekle("g1", "bitti");
  assert.ok(bitti, "git tamamlanmalı");
  assert.equal((bitti!.veri as Record<string, unknown>)["kalkildi"], true);
  assert.equal(k.y.durum().oturuyor_mu, false);
  assert.ok(Math.abs(k.y.durum().konum.y) < 1e-9, "ayakta y=0 olmalı");
  const tahta = capaBul("tahta")!;
  assert.ok(mesafeXZ(k.y.durum().konum, tahta.durak) <= NOKTA_TOLERANSI + 1e-6);
});

test("oturuyor iken ikinci otur → hata, `kalk` söyler", () => {
  const k = new Kosucu();
  k.niyet({ tur: "otur" }, "o1");
  assert.ok(k.bekle("o1", "bitti"));
  k.niyet({ tur: "otur" }, "o2").tik();
  assert.equal(k.bul("o2")[0]!.durum, "hata");
  assert.match(k.bul("o2")[0]!.not ?? "", /kalk/);
});

test("ayaktayken kalk → hata, sessiz no-op değil", () => {
  const k = new Kosucu();
  k.niyet({ tur: "kalk" }, "u1").tik();
  assert.equal(k.bul("u1")[0]!.durum, "hata");
});

test("otur → kalk turu: y sıfıra döner, poz duruyor", () => {
  const k = new Kosucu();
  k.niyet({ tur: "otur" }, "o1");
  assert.ok(k.bekle("o1", "bitti"));
  k.niyet({ tur: "kalk" }, "u1");
  assert.ok(k.bekle("u1", "bitti"));
  assert.equal(k.y.durum().oturuyor_mu, false);
  assert.equal(k.y.durum().poz, "duruyor");
  assert.ok(Math.abs(k.y.durum().konum.y) < 1e-9);
});

test("oturulamayan çapaya otur → hata, seçenekleri söyler", () => {
  const k = new Kosucu();
  k.niyet({ tur: "otur", capa: "tahta" }, "o1").tik();
  const s = k.bul("o1")[0]!;
  assert.equal(s.durum, "hata");
  assert.match(s.not ?? "", /sandalye/);
});

// ── 5. Geçersiz poz geçişi reddedilir ─────────────────────────────────────

test("poz niyeti: koşuyor/yürüyor/oturuyor doğrudan verilemez", () => {
  const k = new Kosucu();
  for (const [i, p] of (["koşuyor", "yürüyor", "oturuyor"] as const).entries()) {
    k.niyet({ tur: "poz", poz: p }, `p${i}`).tik();
    const s = k.bul(`p${i}`)[0]!;
    assert.equal(s.durum, "hata", p);
    assert.match(s.not ?? "", /git|otur/, p);
  }
  assert.equal(k.y.durum().poz, "duruyor", "reddedilen pozlar durumu bozmadı");
});

test("poz niyeti süreli iş sürerken reddedilir ve `dur` önerir", () => {
  const k = new Kosucu();
  k.niyet({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }, "g1").tik(5);
  k.niyet({ tur: "poz", poz: "eğiliyor" }, "p1").tik();
  const s = k.bul("p1")[0]!;
  assert.equal(s.durum, "hata");
  assert.match(s.not ?? "", /dur/);
  assert.equal(k.y.durum().poz, "yürüyor");
});

test("otururken eğilme pozu reddedilir (durum makinesi gerekçesiyle)", () => {
  const k = new Kosucu();
  k.niyet({ tur: "otur" }, "o1");
  assert.ok(k.bekle("o1", "bitti"));
  k.niyet({ tur: "poz", poz: "eğiliyor" }, "p1").tik();
  const s = k.bul("p1")[0]!;
  assert.equal(s.durum, "hata");
  assert.match(s.not ?? "", /kalk/);
  assert.equal(k.y.durum().poz, "oturuyor");
});

test("serbest poz niyeti kabul edilir", () => {
  const k = new Kosucu();
  k.niyet({ tur: "poz", poz: "eğiliyor" }, "p1").tik();
  assert.deepEqual(k.durumlar("p1"), ["bitti"]);
  assert.equal(k.y.durum().poz, "eğiliyor");
});

// ── 6. Engelden kaçınma: yol düz çizgiden UZUN olmalı ─────────────────────

test("masanın öbür yanına git: yol düz çizgiden uzun ve hiç çarpışma yok", () => {
  const bas = { x: 2.0, z: -3.3 };
  const son = { x: -2.0, z: -3.3 };
  const duz = mesafeXZ(bas, son);

  const yol = yolBul(bas, son);
  assert.ok(yol, "yol bulunmalı");
  const uz = yolUzunlugu(bas, yol!);
  assert.ok(uz > duz + 0.2,
    `yol düz çizgiden uzun olmalı (masayı dolaşmalı): yol=${uz.toFixed(2)} düz=${duz.toFixed(2)}`);
  assert.ok(yol!.length >= 2, "ara nokta olmalı, tek adımda gidilemez");

  // Canlı yürüyüş: her tikte çarpışma testi.
  const k = new Kosucu({ x: bas.x, y: 0, z: bas.z });
  k.niyet({ tur: "git", hedef: { tip: "nokta", x: son.x, y: 0, z: son.z } }, "g1");
  const bitti = k.bekle("g1", "bitti");
  assert.ok(bitti, "yürüyüş tamamlanmalı");
  for (const p of k.iz) {
    assert.ok(!carpisiyorMu(p.x, p.z, AVATAR_YARICAP),
      `çarpışma: (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
  }
  assert.ok(mesafeXZ(k.y.durum().konum, son) <= NOKTA_TOLERANSI + 1e-6);
  // Gerçekten dolaştı mı: iz masanın z aralığından kuzeye çıkmalı.
  const enBuyukZ = Math.max(...k.iz.map((p) => p.z));
  assert.ok(enBuyukZ > -2.6, `masayı dolaşmadı, en büyük z=${enBuyukZ.toFixed(2)}`);
});

test("tahtaya git: tahtanın ÖNÜNDE durur, duvarın içinde değil", () => {
  const k = new Kosucu();
  k.niyet({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }, "g1");
  const bitti = k.bekle("g1", "bitti");
  assert.ok(bitti);
  const tahta = capaBul("tahta")!;
  assert.ok(mesafeXZ(k.y.durum().konum, tahta.durak) <= NOKTA_TOLERANSI + 1e-6);
  assert.ok(!carpisiyorMu(k.y.durum().konum.x, k.y.durum().konum.z, AVATAR_YARICAP));
  // Varışta çapanın yönüne dönmüş olmalı (tahta sol duvarda → -X'e bakar).
  k.tik(20);
  const b = k.y.durum().bakis;
  assert.ok(b.x < -0.7, `tahtaya dönmeli, bakis.x=${b.x.toFixed(2)}`);
  assert.equal((bitti!.veri as Record<string, unknown>)["capa"], "tahta");
});

test("ara nokta toleransı köşe payından küçük — yol kesilerek engele girilemez", () => {
  // Bu sayı ilişkisi bozulursa avatar köşeleri kesip masaya omuz atar.
  assert.ok(ARA_NOKTA_TOLERANSI < 0.03, "ara nokta toleransı köşe payını aşmamalı");
});

// ── 7. Hedef zaten menzilde → ANINDA bitti, yürüme animasyonu YOK ─────────

test("hedef zaten menzildeyse anında bitti ve poz hiç 'yürüyor' olmaz", () => {
  const tahta = capaBul("tahta")!;
  const k = new Kosucu({ x: tahta.durak.x, y: 0, z: tahta.durak.z });
  const pozlar: string[] = [];
  k.niyet({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }, "g1").tik();
  pozlar.push(k.y.durum().poz);
  assert.deepEqual(k.durumlar("g1"), ["basladi", "bitti"], "aynı tikte bitmeli");
  assert.equal(k.y.durum().mesgul, false);
  k.tik(20);
  pozlar.push(k.y.durum().poz);
  assert.ok(pozlar.every((p) => p === "duruyor"), `yürüme tetiklendi: ${pozlar.join(",")}`);
});

test("yaklaşma yarıçapı içindeysek de anında bitti (menzil ≠ varış toleransı)", () => {
  const tahta = capaBul("tahta")!;
  // Durağın 1.2 m doğusu: yaklasmaYaricapi 1.5 içinde ama varış toleransı dışında.
  const k = new Kosucu({ x: tahta.durak.x + 1.2, y: 0, z: tahta.durak.z });
  k.niyet({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }, "g1").tik();
  assert.deepEqual(k.durumlar("g1"), ["basladi", "bitti"]);
  // Ama açık `mesafe` verilirse gerçekten yaklaşır.
  const k2 = new Kosucu({ x: tahta.durak.x + 1.2, y: 0, z: tahta.durak.z });
  k2.niyet({ tur: "git", hedef: { tip: "capa", ad: "tahta" }, mesafe: 0.3 }, "g2");
  assert.ok(k2.bekle("g2", "bitti"));
  assert.ok(mesafeXZ(k2.y.durum().konum, tahta.durak) <= 0.3 + 1e-6);
});

// ── bak: baş ve gövde ayrımı ──────────────────────────────────────────────

test("bak: boyun sınırı içindeyse gövde dönmez, yalnızca baş", () => {
  const k = new Kosucu({ x: 0, y: 0, z: 0 }, 0);
  // 45° sağ ön: boyun sınırı (80°) içinde.
  k.niyet({ tur: "bak", hedef: { tip: "nokta", x: 5, y: 1.55, z: 5 } }, "b1").tik(40);
  assert.deepEqual(k.durumlar("b1"), ["bitti"]);
  const g = k.y.gorunum();
  assert.ok(Math.abs(g.govdeYaw) < 1e-6, `gövde dönmemeli, yaw=${g.govdeYaw}`);
  assert.ok(Math.abs(g.basYaw - Math.PI / 4) < 0.02, `baş 45° dönmeli, ${g.basYaw}`);
});

test("bak: boyun sınırı aşılırsa GÖVDE de döner, baş sınırda kalır", () => {
  const k = new Kosucu({ x: 0, y: 0, z: 0 }, 0);
  const pencere = capaBul("pencere")!;
  k.niyet({ tur: "bak", hedef: { tip: "capa", ad: "pencere" } }, "b1");
  // Her tikte boyun sınırı denetlenir — bir kez bile aşılmamalı.
  for (let i = 0; i < 60; i++) {
    k.tik();
    assert.ok(Math.abs(k.y.gorunum().basYaw) <= BOYUN_YAW_SINIRI + 1e-6,
      `boyun sınırı aşıldı: ${k.y.gorunum().basYaw}`);
  }
  const g = k.y.gorunum();
  const istenen = Math.atan2(pencere.konum.x - 0, pencere.konum.z - 0);
  assert.ok(Math.abs(aciSar(g.govdeYaw - istenen)) < 0.05,
    `gövde hedefe dönmeli: ${g.govdeYaw.toFixed(3)} ≠ ${istenen.toFixed(3)}`);
  // Bakış vektörü gerçekten pencereye işaret ediyor mu?
  const b = k.y.durum().bakis;
  assert.ok(Math.abs(aciSar(Math.atan2(b.x, b.z) - istenen)) < 0.06);
});

test("bak: pitch insan sınırında kalır", () => {
  const k = new Kosucu();
  k.niyet({ tur: "bak", hedef: { tip: "nokta", x: 0, y: 3.1, z: 0.4 } }, "b1").tik(60);
  const p = k.y.gorunum().basPitch;
  assert.ok(p > 0, "yukarı bakmalı");
  assert.ok(p <= BOYUN_PITCH_SINIRI + 1e-6, `pitch sınırı aşıldı: ${p}`);
});

test("bak null → serbest bakışa döner", () => {
  const k = new Kosucu();
  k.niyet({ tur: "bak", hedef: { tip: "nokta", x: 5, y: 1.55, z: 5 } }, "b1").tik(30);
  assert.ok(Math.abs(k.y.gorunum().basYaw) > 0.5);
  k.niyet({ tur: "bak", hedef: null }, "b2").tik(30);
  assert.deepEqual(k.durumlar("b2"), ["bitti"]);
  assert.ok(Math.abs(k.y.gorunum().basYaw) < 0.02);
});

test("bak {tip:oyuncu} sağlayıcı yoksa hata — sessizce yanlış yere bakmaz", () => {
  const k = new Kosucu();
  k.niyet({ tur: "bak", hedef: { tip: "oyuncu" } }, "b1").tik();
  assert.equal(k.bul("b1")[0]!.durum, "hata");
  assert.match(k.bul("b1")[0]!.not ?? "", /oyuncu/);
});

test("bak {tip:oyuncu} sağlayıcı varsa oyuncuyu TAKİP eder", () => {
  let p = { x: 3, y: 1.6, z: 3 };
  const y = new Yurutucu({ spawn: { x: 0, y: 0, z: 0 }, oyuncuKonumu: () => p });
  y.niyet({ tur: "bak", hedef: { tip: "oyuncu" } }, "b1");
  for (let i = 0; i < 60; i++) y.ilerle(DT);
  const ilk = y.gorunum().govdeYaw + y.gorunum().basYaw;
  p = { x: -3, y: 1.6, z: 3 };
  for (let i = 0; i < 60; i++) y.ilerle(DT);
  const son = y.gorunum().govdeYaw + y.gorunum().basYaw;
  assert.ok(Math.abs(aciSar(son - ilk)) > 1.0, "oyuncu yer değiştirince bakış izlemeli");
});

// ── jest ──────────────────────────────────────────────────────────────────

test("jest anında biter ama animasyon süresince aktif kalır", () => {
  const k = new Kosucu();
  k.niyet({ tur: "jest", jest: "el_salliyor" }, "j1").tik();
  assert.deepEqual(k.durumlar("j1"), ["bitti"]);
  assert.equal(k.y.gorunum().jest, "el_salliyor");
  assert.ok(k.y.gorunum().jestIlerlemesi < 0.2);
  k.tik(30); // 1.5 sn > JEST_SURESI
  assert.equal(k.y.gorunum().jest, null);
});

test("jest yürümeyi kesmez — anlık niyet süreli işi iptal etmez", () => {
  const k = new Kosucu();
  k.niyet({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }, "g1").tik(5);
  k.niyet({ tur: "jest", jest: "el_salliyor" }, "j1").tik();
  assert.equal(k.y.durum().mesgul, true);
  assert.equal(k.y.durum().poz, "yürüyor");
  assert.ok(k.bekle("g1", "bitti"));
  assert.deepEqual(k.durumlar("g1"), ["basladi", "bitti"]);
});

// ── al / birak ────────────────────────────────────────────────────────────

test("al: uzaktan alınamaz, yakından alınır, iki kez alınamaz", () => {
  const k = new Kosucu({ x: 4, y: 0, z: 3 });
  k.niyet({ tur: "al", nesne: "masa" }, "a1").tik();
  assert.equal(k.bul("a1")[0]!.durum, "hata");
  assert.match(k.bul("a1")[0]!.not ?? "", /uzak/);

  k.niyet({ tur: "git", hedef: { tip: "capa", ad: "masa" } }, "g1");
  assert.ok(k.bekle("g1", "bitti"));
  k.niyet({ tur: "al", nesne: "masa" }, "a2").tik();
  assert.deepEqual(k.durumlar("a2"), ["bitti"]);
  assert.equal(k.y.durum().elinde, "masa");

  k.niyet({ tur: "al", nesne: "masa" }, "a3").tik();
  assert.equal(k.bul("a3")[0]!.durum, "hata");
  k.niyet({ tur: "birak" }, "r1").tik();
  assert.deepEqual(k.durumlar("r1"), ["bitti"]);
  assert.equal(k.y.durum().elinde, null);
  k.niyet({ tur: "birak" }, "r2").tik();
  assert.equal(k.bul("r2")[0]!.durum, "hata");
});

test("alınamayan nesne → hata, alınabilirleri söyler", () => {
  const k = new Kosucu();
  k.niyet({ tur: "al", nesne: "pencere" }, "a1").tik();
  assert.match(k.bul("a1")[0]!.not ?? "", /alınabil/i);
});

// ── Avatarın işi olmayan niyetler ─────────────────────────────────────────

test("soyle/yaz/odaklan/sor avatarda hata döner ve nereye ait olduğunu söyler", () => {
  const k = new Kosucu();
  const beklenen: [Niyet, string, RegExp][] = [
    [{ tur: "soyle", metin: "merhaba" }, "s1", /voice|ses/i],
    [{ tur: "yaz", metin: "x" }, "s2", /tahta|surfaces/i],
    [{ tur: "odaklan", capa: "monitor" }, "s3", /bak|kamera|köprü/i],
    [{ tur: "sor", ne: "dunya" }, "s4", /köprü|durum/i],
  ];
  for (const [n, id, re] of beklenen) {
    k.niyet(n, id).tik();
    const s = k.bul(id)[0]!;
    assert.equal(s.durum, "hata", id);
    assert.match(s.not ?? "", re, id);
  }
});

// ── Ağız kancası ──────────────────────────────────────────────────────────

test("agizAyarla 0..1 arasına kısılır, NaN yutulmaz", () => {
  const k = new Kosucu();
  k.y.agizAyarla(0.6); k.tik();
  assert.equal(k.y.gorunum().agiz, 0.6);
  k.y.agizAyarla(5); assert.equal(k.y.gorunum().agiz, 1);
  k.y.agizAyarla(-2); assert.equal(k.y.gorunum().agiz, 0);
  k.y.agizAyarla(NaN); assert.equal(k.y.gorunum().agiz, 0);
});

// ── Genel sağlamlık ───────────────────────────────────────────────────────

test("niyet işlenmesi TİKTE olur, niyet() çağrısında değil", () => {
  const k = new Kosucu();
  k.niyet({ tur: "jest", jest: "el_salliyor" }, "j1");
  assert.equal(k.sonuclar.length, 0, "niyet() sonuç üretmemeli");
  k.tik();
  assert.equal(k.sonuclar.length, 1);
});

test("uzun mesafede koşuyor pozuna geçer", () => {
  // Kapı (2.6, 2.9 civarı) → tahta (-3.84, -0.4): 7 m üstü.
  const kapi = capaBul("kapi")!;
  const k = new Kosucu({ x: kapi.durak.x, y: 0, z: kapi.durak.z });
  k.niyet({ tur: "git", hedef: { tip: "capa", ad: "tahta" } }, "g1").tik(3);
  assert.equal(k.y.durum().poz, "koşuyor");
  assert.ok(k.bekle("g1", "bitti"));
  assert.equal(k.y.durum().poz, "duruyor");
});

test("her çapaya gidilebilir ve hiçbiri çarpışmayla bitmez", () => {
  for (const ad of ["masa", "monitor", "sandalye", "tahta", "pencere", "kapi", "oda_ortasi"]) {
    const k = new Kosucu({ x: 3.4, y: 0, z: 2.6 });
    k.niyet({ tur: "git", hedef: { tip: "capa", ad }, mesafe: 0.3 }, "g1");
    const bitti = k.bekle("g1", "bitti", 400);
    assert.ok(bitti, `'${ad}' çapasına gidilemedi`);
    for (const p of k.iz) {
      assert.ok(!carpisiyorMu(p.x, p.z, AVATAR_YARICAP), `'${ad}' yolunda çarpışma`);
    }
  }
});

test("durum() protokol biçimini korur ve bakış birim vektör", () => {
  const k = new Kosucu();
  k.niyet({ tur: "bak", hedef: { tip: "capa", ad: "pencere" } }, "b1").tik(40);
  const d = k.y.durum();
  assert.deepEqual(Object.keys(d).sort(),
    ["bakis", "elinde", "konum", "mesgul", "oturuyor_mu", "poz"]);
  const boy = Math.hypot(d.bakis.x, d.bakis.y, d.bakis.z);
  assert.ok(Math.abs(boy - 1) < 1e-9, `bakış birim olmalı, ${boy}`);
});

// ── Boşta mikro-hareket (bosta.ts) ────────────────────────────────────────
// Ayrı test dosyası açılmadı: `bosta.ts` yürütücünün ürettiği duruma eklenen
// bir SUNUM katmanıdır ve aynı 20 Hz/çizim ayrımına tabidir. Buradaki testler
// onun determinist ve sınırlı kaldığını doğrular.

test("boşta hareket determinist: aynı t aynı sonucu verir", () => {
  for (const t of [0, 0.7, 3.4, 11.9, 60.25]) {
    assert.deepEqual(bostaHesapla(t, 0.37), bostaHesapla(t, 0.37));
  }
});

test("boşta hareket sınırlı: nefes/ağırlık -1..1, göz 0..1", () => {
  for (let t = 0; t < 40; t += 0.05) {
    const b = bostaHesapla(t, 0.37);
    assert.ok(b.nefes >= -1 && b.nefes <= 1, `nefes ${b.nefes}`);
    assert.ok(b.agirlik >= -1 && b.agirlik <= 1, `agirlik ${b.agirlik}`);
    assert.ok(b.gozKapali >= 0 && b.gozKapali <= 1, `goz ${b.gozKapali}`);
    assert.ok(b.basSalinimi >= -1 && b.basSalinimi <= 1, `bas ${b.basSalinimi}`);
  }
});

test("avatar DONMUŞ görünmez: 40 sn içinde nefes de göz kırpma da olur", () => {
  let kirpma = 0;
  let enBuyukNefes = 0;
  let oncekiKapali = 0;
  for (let t = 0; t < 40; t += 0.02) {
    const b = bostaHesapla(t, 0.37);
    enBuyukNefes = Math.max(enBuyukNefes, Math.abs(b.nefes));
    if (b.gozKapali > 0.5 && oncekiKapali <= 0.5) kirpma++;
    oncekiKapali = b.gozKapali;
  }
  assert.ok(enBuyukNefes > 0.9, "nefes genliği ölü");
  // 40 sn / 3.2 sn taban ≈ 12 kırpma; insanda 40 sn'de 8-16 normal.
  assert.ok(kirpma >= 8 && kirpma <= 16, `40 sn'de ${kirpma} kırpma — insan dışı`);
});
