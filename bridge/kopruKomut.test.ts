// bridge/kopruKomut.test.ts — Doğuştan komut programları köprüde (spec 13 Faz 2b, içgüdü `kopru.komut`).
//
// Söz bir programa tamamen uyuyorsa LLM uyanmaz; adımlar eylem sırasıyla yürür;
// kayıtta ayrı bir `program` satırı olur (refleks satırı DEĞİL: beceri hafızası ondan öğrenir).
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi } from "./beyin.ts";
import type { Niyet } from "../protocol/niyet.ts";
import { KARAR_ONEKI, KararKaydi, type KararSatiri } from "../mind/kararKaydi.ts";

class SahteBeyin implements Beyin {
  readonly ad = "sahte";
  gordugu: BeyinGirdisi[] = [];
  async hazirMi() { return true; }
  async dusun(g: BeyinGirdisi): Promise<BeyinCikti> {
    this.gordugu.push(structuredClone(g));
    return { metin: "", cagrilar: [] };
  }
}

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

function kur(ek: Record<string, unknown> = {}) {
  const beyin = new SahteBeyin();
  const satirlar: KararSatiri[] = [];
  const kayit = new KararKaydi({ yaz: (s) => satirlar.push(JSON.parse(s.slice(KARAR_ONEKI.length + 1))), simdi: () => 1_000 });
  const niyetler: { n: Niyet; id: string }[] = [];
  const k = new Kopru({
    beyin, niyetGonder: (n, id) => niyetler.push({ n, id }), dunyaDurumu: () => "Oda.",
    toplamaMs: 20, simdi: () => 1_000, kararKaydi: kayit, hafizaGetirme: 0, ...ek,
  });
  const turler = () => niyetler.map((x) => x.n.tur);
  const satir = (tur: string) => satirlar.filter((s) => s.tur === tur);
  return { k, beyin, niyetler, turler, satir };
}

const soyle = (k: Kopru, metin: string) => k.algi({ tur: "duydum", metin, kesin: true });

test("GERÇEK: 'otur' → LLM uyanmaz", async () => {
  const { k, beyin } = kur();
  soyle(k, "otur");
  await bekle(60);
  assert.equal(beyin.gordugu.length, 0);
});

test("'otur' → önce onay jesti, sonra otur", async () => {
  const { k, turler } = kur();
  soyle(k, "otur");
  await bekle(60);
  assert.deepEqual(turler(), ["jest", "otur"]);
});

test("GERÇEK: 'bana gel' → Ozyn'e 1,2 m kala", async () => {
  const { k, niyetler } = kur();
  soyle(k, "bana gel");
  await bekle(60);
  assert.deepEqual(JSON.parse(JSON.stringify(niyetler[1]?.n)), { tur: "git", hedef: { tip: "oyuncu" }, mesafe: 1.2 });
});

test("GERÇEK: 'tahtaya adını yaz' programa girmez → LLM uyanır", async () => {
  const { k, beyin } = kur();
  soyle(k, "tahtaya adını yaz");
  await bekle(60);
  assert.equal(beyin.gordugu.length, 1);
});

test("anahtar kapalıyken (komutYetkisi: false) 'otur' LLM'e gider — bu fazdan önceki gibi", async () => {
  const { k, beyin, turler } = kur({ komutYetkisi: false });
  soyle(k, "otur");
  await bekle(60);
  assert.deepEqual({ uyanis: beyin.gordugu.length, niyet: turler() }, { uyanis: 1, niyet: [] });
});

test("kesin olmayan söz programa girmez, bugünkü yoldan LLM'e gider", async () => {
  const { k, beyin, turler } = kur();
  k.algi({ tur: "duydum", metin: "otur", kesin: false });
  await bekle(60);
  assert.deepEqual({ uyanis: beyin.gordugu.length, niyet: turler() }, { uyanis: 1, niyet: [] });
});

test("kayıt: söz satırının kuralı kopru.komut, ayrı bir program satırı var", async () => {
  const { k, satir } = kur();
  soyle(k, "pencereye bak");
  await bekle(60);
  const algi = satir("algi")[0] as { kapi?: { kural: string } };
  const p = satir("program")[0] as { program?: string; niyetler?: { tur: string }[] };
  assert.deepEqual({ kural: algi.kapi?.kural, program: p?.program, adim: p?.niyetler?.map((n) => n.tur) },
    { kural: "kopru.komut", program: "komut:bak", adim: ["bak"] });
});

test("B9 bekçisi: program REFLEKS satırı yazmaz (beceri hafızası ondan öğrenir)", async () => {
  const { k, satir } = kur();
  soyle(k, "otur");
  soyle(k, "kalk");
  await bekle(60);
  assert.equal(satir("refleks").length, 0);
});

test("program uyanış satırı yazmaz: LLM uyanmadı", async () => {
  const { k, satir } = kur();
  soyle(k, "kalk");
  await bekle(60);
  assert.equal(satir("uyanis").length, 0);
});

test("sonraki LLM turu geçmişte 'otur' sözünü ve otur aracını görür", async () => {
  const { k, beyin } = kur();
  soyle(k, "otur");
  await bekle(60);
  soyle(k, "nasılsın");
  await bekle(60);
  const g = beyin.gordugu[0]!.gecmis;
  assert.deepEqual(JSON.parse(JSON.stringify(g.slice(0, 2))),
    [{ rol: "kullanici", metin: "otur" }, { rol: "orion", metin: "", arac: true, cagri: { ad: "dunya_otur", girdi: {} } }]);
});

test("adımın hatası beyni uyandırır: Orion yapamadığını öğrenir", async () => {
  const { k, beyin, niyetler } = kur();
  soyle(k, "pencereye git");
  await bekle(60);
  const git = niyetler.find((x) => x.n.tur === "git")!;
  k.sonuc({ niyet_id: git.id, durum: "hata", not: "yol yok" });
  await bekle(60);
  assert.equal(beyin.gordugu.length, 1);
});

test("sayaç: programla yürüyen söz sayılır", async () => {
  const { k } = kur();
  soyle(k, "otur");
  await bekle(60);
  assert.equal(k.sayac().komut, 1);
});
