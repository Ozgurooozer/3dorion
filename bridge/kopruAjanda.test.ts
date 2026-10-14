// bridge/kopruAjanda.test.ts — Ajandanın kıpırtısı beyne gitmez (içgüdü `kopru.ajanda`, docs/olcum/on-kayit-ajanda.md).
//
// Ajanda (mind/ajanda.ts) boşta bak/jest önerir; o niyetleri LLM vermedi. Başarısı kayda satır yazmamalı (kaydın üçte
// biriydi), hatası iz bırakmalı ama LLM'i uyandırmamalı. Kalibrasyon: aynı düzenekte LLM'in kendi niyetinin hatası uyandırır —
// "uyanmadı" sonucunun düzenekten değil kuraldan geldiği görünsün. Süzgeç canlıdaki kural refleksi.
"use strict";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { Kopru } from "./kopru.ts";
import type { Beyin, BeyinCikti, BeyinGirdisi } from "./beyin.ts";
import type { NiyetSonucu } from "../protocol/niyet.ts";
import { KARAR_ONEKI, KararKaydi, type AlgiSatiri, type KararSatiri } from "../mind/kararKaydi.ts";
import { KuralRefleksi, refleksGirdisi } from "../mind/refleks.ts";
import { AJANDA_ONEKI } from "../mind/ajanda.ts";

class SahteBeyin implements Beyin {
  readonly ad = "sahte";
  uyanis = 0;
  async hazirMi() { return true; }
  async dusun(_g: BeyinGirdisi): Promise<BeyinCikti> { this.uyanis++; return { metin: "", cagrilar: [] }; }
}

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
const kopruler: Kopru[] = [];
after(() => { for (const k of kopruler) k.durdur(); });

/** Bir köprüye sonuçları verir, toplama süresini bekler; kayda yazılan algı satırlarını ve beynin uyanışını döner. */
async function sonuclariVer(...sonuclar: NiyetSonucu[]) {
  const satirlar: KararSatiri[] = [];
  const beyin = new SahteBeyin();
  const refleks = new KuralRefleksi();
  let saat = 1_000_000;
  const k = new Kopru({ komutYetkisi: false,
    beyin,
    niyetGonder: () => {},
    dunyaDurumu: () => "Oda.",
    toplamaMs: 10,
    simdi: () => saat,
    dikkat: { simdi: () => (saat += 10_000) },
    suzgec: (a, ozet) => { const r = refleks.karar(refleksGirdisi(a, ozet)); return { gecsin: r.terfi, kural: r.kural, gerekce: r.gerekce }; },
    kararKaydi: new KararKaydi({ yaz: (s) => satirlar.push(JSON.parse(s.slice(KARAR_ONEKI.length + 1))), simdi: () => saat }),
  });
  kopruler.push(k);
  for (const s of sonuclar) k.sonuc(s);
  await bekle(60);
  const algilar = satirlar.filter((s): s is AlgiSatiri => s.tur === "algi");
  return { algilar, uyanis: beyin.uyanis, sayac: k.sayac() };
}

const AJANDA_BITTI: NiyetSonucu = { niyet_id: `${AJANDA_ONEKI}_mv7aa_2`, durum: "bitti" };
const AJANDA_HATA: NiyetSonucu = { niyet_id: `${AJANDA_ONEKI}_mv7aa_4`, durum: "hata", not: "bilinmeyen çapa/nesne: 'tahta'." };
const LLM_HATA: NiyetSonucu = { niyet_id: "n_mv7aa_3", durum: "hata", not: "bilinmeyen çapa/nesne: 'tahta'." };

test("ajandanın başarılı sonucu kayda satır yazmaz", async () => {
  const { algilar } = await sonuclariVer(AJANDA_BITTI, AJANDA_BITTI, AJANDA_BITTI);
  assert.equal(algilar.length, 0);
});

test("ajandanın başarılı sonucu köprünün ajanda sayacında görünür", async () => {
  const { sayac } = await sonuclariVer(AJANDA_BITTI, AJANDA_BITTI, AJANDA_BITTI);
  assert.equal(sayac.ajanda, 3);
});

test("ajandanın hatası kayda kopru.ajanda kuralıyla, kapıdan geçmemiş olarak yazılır", async () => {
  const { algilar } = await sonuclariVer(AJANDA_HATA);
  assert.deepEqual(algilar.map((s) => s.kapi), [{ gecti: false, kural: "kopru.ajanda" }]);
});

test("ajandanın hatası LLM'i uyandırmaz", async () => {
  const { uyanis } = await sonuclariVer(AJANDA_HATA);
  assert.equal(uyanis, 0);
});

test("kalibrasyon: LLM'in kendi niyetinin aynı hatası LLM'i uyandırır", async () => {
  const { uyanis } = await sonuclariVer(LLM_HATA);
  assert.equal(uyanis, 1);
});
