// bridge/kopruEylem.test.ts — Söylediğini yapsın (spec 13 Faz 1): eylem sırası, hareket
// zincirinde iç ses, yalnız gerçekte olanı taşıyan geçmiş, "dedi ama yapmadı" bekçisi.
//
// Vakalar 2026-10-02 ortak canlı testinden (docs/canli-test-2026-10-02.md).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi, AracCagrisi } from "./beyin.ts";
import type { Niyet, NiyetTur } from "../protocol/niyet.ts";
import { KARAR_ONEKI, KararKaydi, type UyanisSatiri } from "../mind/kararKaydi.ts";

/** Sahte beyin: ne döndüreceğini test belirler, ne gördüğünü test okur. */
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

const cagri = (ad: string, girdi: unknown = {}): AracCagrisi => ({ ad, girdi });
const cevap = (...cagrilar: AracCagrisi[]): BeyinCikti => ({ metin: "", cagrilar });
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

function kur(beyin: Beyin) {
  const uyanislar: UyanisSatiri[] = [];
  const kayit = new KararKaydi({
    yaz: (s) => { const x = JSON.parse(s.slice(KARAR_ONEKI.length + 1)); if (x.tur === "uyanis") uyanislar.push(x); },
    simdi: () => 1_000,
  });
  const niyetler: { n: Niyet; id: string }[] = [];
  const sozler: string[] = [];
  const icSesler: string[] = [];
  const ucurumlar: NiyetTur[][] = [];
  const k = new Kopru({ komutYetkisi: false,
    beyin,
    niyetGonder: (n, id) => niyetler.push({ n, id }),
    dunyaDurumu: () => "Oda: masa, tahta. Ozyn 2m uzakta.",
    toplamaMs: 20,
    simdi: () => 1_000,
    kararKaydi: kayit,
    hafizaGetirme: 0,
    refleksZamanAsimiMs: 200,
    icSesDinle: (m) => icSesler.push(m),
    sozEylemDinle: (eksik) => ucurumlar.push(eksik),
  });
  k.konusmaDinle((m) => sozler.push(m));
  const turler = () => niyetler.map((x) => x.n.tur);
  return { k, niyetler, turler, sozler, icSesler, ucurumlar, uyanislar };
}

const soyle = (k: Kopru, metin: string) => k.algi({ tur: "duydum", metin, kesin: true });

// ── Eylem sırası ────────────────────────────────────────────────────────────

test("tek turda git + yaz: yaz, git bitmeden gönderilmez", async () => {
  const { k, turler } = kur(new SahteBeyin(cevap(cagri("dunya_git", { hedef: { tip: "capa", ad: "tahta" } }), cagri("dunya_yaz", { metin: "merhaba" }))));
  soyle(k, "tahtaya merhaba yaz");
  await bekle(60);
  assert.deepEqual(turler(), ["git"]);
});

test("git bitince sıradaki yaz gönderilir", async () => {
  const { k, niyetler, turler } = kur(new SahteBeyin(cevap(cagri("dunya_git", { hedef: { tip: "capa", ad: "tahta" } }), cagri("dunya_yaz", { metin: "merhaba" }))));
  soyle(k, "tahtaya merhaba yaz");
  await bekle(60);
  k.sonuc({ niyet_id: niyetler[0]!.id, durum: "bitti" });
  assert.deepEqual(turler(), ["git", "yaz"]);
});

test("'basladi' sonucu sırayı ilerletmez", async () => {
  const { k, niyetler, turler } = kur(new SahteBeyin(cevap(cagri("dunya_git", { hedef: { tip: "capa", ad: "masa" } }), cagri("dunya_otur"))));
  soyle(k, "masaya git ve otur");
  await bekle(60);
  k.sonuc({ niyet_id: niyetler[0]!.id, durum: "basladi" });
  assert.deepEqual(turler(), ["git"]);
});

test("adım hata verirse kalan adımlar gönderilmez", async () => {
  const { k, niyetler, turler } = kur(new SahteBeyin(cevap(cagri("dunya_git", { hedef: { tip: "capa", ad: "tahta" } }), cagri("dunya_yaz", { metin: "x" }))));
  soyle(k, "tahtaya yaz");
  await bekle(60);
  k.sonuc({ niyet_id: niyetler[0]!.id, durum: "hata", not: "yol yok" });
  await bekle(60);
  assert.ok(!turler().includes("yaz"), `gönderilenler: ${turler()}`);
});

test("sonuç gelmezse zaman aşımında kalan adımlar düşer", async () => {
  const { k, niyetler, turler } = kur(new SahteBeyin(cevap(cagri("dunya_git", { hedef: { tip: "capa", ad: "masa" } }), cagri("dunya_otur"))));
  soyle(k, "masaya git ve otur");
  await bekle(260);   // zaman aşımı 200 ms
  k.sonuc({ niyet_id: niyetler[0]!.id, durum: "bitti" });
  assert.deepEqual(turler(), ["git"]);
});

test("tek beden niyeti hemen gider (bugünkü gibi)", async () => {
  const { k, turler } = kur(new SahteBeyin(cevap(cagri("dunya_otur"))));
  soyle(k, "otur");
  await bekle(60);
  assert.deepEqual(turler(), ["otur"]);
});

test("söz sıra beklemez: git + yaz + soyle → söz ve git hemen", async () => {
  const { k, turler, sozler } = kur(new SahteBeyin(cevap(
    cagri("dunya_git", { hedef: { tip: "capa", ad: "tahta" } }), cagri("dunya_yaz", { metin: "x" }), cagri("dunya_soyle", { metin: "Yazıyorum." }),
  )));
  soyle(k, "tahtaya yaz");
  await bekle(60);
  assert.deepEqual({ turler: turler().sort(), sozler }, { turler: ["git", "soyle"], sozler: ["Yazıyorum."] });
});

test("yeni turun beden niyeti süren sırayı keser", async () => {
  const b = new SahteBeyin(
    cevap(cagri("dunya_git", { hedef: { tip: "capa", ad: "tahta" } }), cagri("dunya_yaz", { metin: "x" })),
    cevap(cagri("dunya_dur")),
  );
  const { k, niyetler, turler } = kur(b);
  soyle(k, "tahtaya yaz");
  await bekle(60);
  soyle(k, "dur");
  await bekle(60);
  k.sonuc({ niyet_id: niyetler[0]!.id, durum: "bitti" });
  assert.deepEqual(turler(), ["git", "dur"]);
});

// ── Hareket zincirinde iç ses (kopru.hareket_sessiz) ────────────────────────

test("GERÇEK: hareket olayıyla uyanan turda 'Uzaklaştın Ozyn.' konuşulmaz", async () => {
  const { k, sozler, turler } = kur(new SahteBeyin(cevap(cagri("dunya_soyle", { metin: "Uzaklaştın Ozyn." }))));
  k.algi({ tur: "olay", ad: "ozyn_uzaklasti", ayrinti: { mesafe: 2.7 } });
  await bekle(60);
  assert.deepEqual({ sozler, turler: turler() }, { sozler: [], turler: [] });
});

test("susturulan söz iç seste görünür ve kayda susturan içgüdüyle yazılır", async () => {
  const { k, icSesler, uyanislar } = kur(new SahteBeyin(cevap(cagri("dunya_soyle", { metin: "Uzaklaştın Ozyn." }))));
  k.algi({ tur: "olay", ad: "ozyn_uzaklasti" });
  await bekle(60);
  const u = uyanislar[0]!;
  assert.deepEqual({ icSesler, icSes: u.icSes, susturan: u.susturan },
    { icSesler: ["Uzaklaştın Ozyn."], icSes: "Uzaklaştın Ozyn.", susturan: "kopru.hareket_sessiz" });
});

test("GERÇEK: hareket turunda araçsız düz metin de konuşulmaz", async () => {
  const { k, sozler, icSesler } = kur(new SahteBeyin({ metin: "Ozyn yaklaştı. Bekliyorum.", cagrilar: [] }));
  k.algi({ tur: "olay", ad: "ozyn_yaklasti" });
  await bekle(60);
  assert.deepEqual({ sozler, icSesler }, { sozler: [], icSesler: ["Ozyn yaklaştı. Bekliyorum."] });
});

test("GERÇEK (Ozyn'in testi): konuşma turunda araçsız İNGİLİZCE iç monolog sesli okunmaz, iç seste kalır", async () => {
  const metin = "I see the user is asking me to respond. The previous context shows I was just looking at the monitor.";
  const { k, sozler, icSesler } = kur(new SahteBeyin({ metin, cagrilar: [] }));
  soyle(k, "hello");
  await bekle(60);
  assert.deepEqual({ sozler, icSesler }, { sozler: [], icSesler: [metin] });
});

test("düşünen API modelinin akıl yürütmesi (bilgi.dusunce) iç seste görünür, sesli okunmaz", async () => {
  const { k, sozler, icSesler } = kur(new SahteBeyin({ metin: "", cagrilar: [cagri("dunya_otur")], bilgi: { dusunce: "Ozyn oturmamı istiyor." } }));
  soyle(k, "otur");
  await bekle(60);
  assert.deepEqual({ sozler, icSesler }, { sozler: [], icSesler: ["Ozyn oturmamı istiyor."] });
});

test("konuşma turunda araçsız TÜRKÇE cevap yine sesli okunur (kurtarma bozulmadı)", async () => {
  const { k, sozler } = kur(new SahteBeyin({ metin: "Buradayım Ozyn.", cagrilar: [] }));
  soyle(k, "orada mısın");
  await bekle(60);
  assert.deepEqual(sozler, ["Buradayım Ozyn."]);
});

test("hareket turunda beden niyeti yine gider (bakmak, el sallamak)", async () => {
  const { k, turler } = kur(new SahteBeyin(cevap(cagri("dunya_jest", { jest: "el_salliyor" }), cagri("dunya_soyle", { metin: "Merhaba." }))));
  k.algi({ tur: "olay", ad: "ozyn_yaklasti" });
  await bekle(60);
  assert.deepEqual(turler(), ["jest"]);
});

test("hareket dışı olay (odaya girdi) turunda söz konuşulur", async () => {
  const { k, sozler, uyanislar } = kur(new SahteBeyin(cevap(cagri("dunya_soyle", { metin: "Hoş geldin." }))));
  k.algi({ tur: "olay", ad: "oyuncu_odaya_girdi" });
  await bekle(60);
  assert.deepEqual({ sozler, susturan: uyanislar[0]?.susturan }, { sozler: ["Hoş geldin."], susturan: undefined });
});

test("Ozyn'in sözü hareketle aynı turda gelirse söz konuşulur", async () => {
  const { k, sozler } = kur(new SahteBeyin(cevap(cagri("dunya_soyle", { metin: "Buradayım." }))));
  k.algi({ tur: "olay", ad: "ozyn_yaklasti" });
  soyle(k, "orada mısın");
  await bekle(60);
  assert.deepEqual(sozler, ["Buradayım."]);
});

test("hareket zincirinin takip turu (bakış cevabı) sessizliği devralır", async () => {
  const b = new SahteBeyin(cevap(cagri("dunya_sor", { ne: "oyuncu" })), cevap(cagri("dunya_soyle", { metin: "Ozyn masada." })));
  const { k, sozler } = kur(b);
  k.algi({ tur: "olay", ad: "ozyn_sana_bakti" });
  await bekle(60);
  k.algi({ tur: "gordum", ne: "oyuncu", metin: "Ozyn masada" });
  await bekle(60);
  assert.deepEqual(sozler, []);
});

test("Ozyn konuşunca hareket zincirinin sessizliği biter", async () => {
  const b = new SahteBeyin(cevap(cagri("dunya_soyle", { metin: "Uzaklaştın." })), cevap(cagri("dunya_soyle", { metin: "Efendim?" })));
  const { k, sozler } = kur(b);
  k.algi({ tur: "olay", ad: "ozyn_uzaklasti" });
  await bekle(60);
  soyle(k, "Orion");
  await bekle(60);
  assert.deepEqual(sozler, ["Efendim?"]);
});

// ── Geçmiş yalnız gerçekte olanı taşır ──────────────────────────────────────

test("GERÇEK: araçla gelen düz metin geçmişe girmez", async () => {
  const b = new SahteBeyin(
    { metin: "ortalığı kontrol ediyorum. masaya git ve otur.", cagrilar: [cagri("dunya_otur")] },
    cevap(),
  );
  const { k } = kur(b);
  soyle(k, "masaya git ve otur");
  await bekle(60);
  soyle(k, "kalk");
  await bekle(60);
  const metinler = b.gordugu[1]!.gecmis.map((g) => g.metin);
  assert.ok(!metinler.some((m) => m.includes("ortalığı")), `geçmiş: ${JSON.stringify(metinler)}`);
});

test("beden niyeti geçmişe araç adı ve argümanıyla girer", async () => {
  const b = new SahteBeyin(cevap(cagri("dunya_git", { hedef: { tip: "oyuncu" }, mesafe: 1.2 })), cevap());
  const { k } = kur(b);
  soyle(k, "bana gel");
  await bekle(60);
  soyle(k, "teşekkürler");
  await bekle(60);
  const cagrilar = b.gordugu[1]!.gecmis.flatMap((g) => g.cagri ? [g.cagri] : []);
  assert.deepEqual(JSON.parse(JSON.stringify(cagrilar)), [{ ad: "dunya_git", girdi: { hedef: { tip: "oyuncu" }, mesafe: 1.2 } }]);
});

test("araçsız düz metin konuşulduysa geçmişe SÖZ olarak girer", async () => {
  const b = new SahteBeyin({ metin: "Buradayım Ozyn.", cagrilar: [] }, cevap());
  const { k } = kur(b);
  soyle(k, "orada mısın");
  await bekle(60);
  soyle(k, "iyi");
  await bekle(60);
  const orion = b.gordugu[1]!.gecmis.filter((g) => g.rol === "orion");
  assert.deepEqual(orion, [{ rol: "orion", metin: "Buradayım Ozyn.", arac: true }]);
});

// ── "Söyledi ama yapmadı" bekçisi (yalnız gözlem) ───────────────────────────

test("GERÇEK: 'Oturuyorum Ozyn.' dedi, otur yok → kayıtta ve dinleyicide", async () => {
  const { k, uyanislar, ucurumlar } = kur(new SahteBeyin(cevap(cagri("dunya_soyle", { metin: "Oturuyorum Ozyn." }))));
  soyle(k, "otur");
  await bekle(60);
  assert.deepEqual({ kayit: uyanislar[0]?.sozEylemUcurumu, dinleyici: ucurumlar }, { kayit: ["otur"], dinleyici: [["otur"]] });
});

test("bekçi davranışı değiştirmez: söz yine konuşulur, başka niyet uydurulmaz", async () => {
  const { k, sozler, turler } = kur(new SahteBeyin(cevap(cagri("dunya_soyle", { metin: "Geliyorum Ozyn." }))));
  soyle(k, "bana gel");
  await bekle(60);
  assert.deepEqual({ sozler, turler: turler() }, { sozler: ["Geliyorum Ozyn."], turler: ["soyle"] });
});

test("söylediğini yaptıysa uçurum alanı yazılmaz", async () => {
  const { k, uyanislar } = kur(new SahteBeyin(cevap(cagri("dunya_otur"), cagri("dunya_soyle", { metin: "Oturuyorum." }))));
  soyle(k, "otur");
  await bekle(60);
  assert.equal(uyanislar[0]?.sozEylemUcurumu, undefined);
});
