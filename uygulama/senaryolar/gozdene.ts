// uygulama/senaryolar/gozdene.ts — `3dorion.bat gozdene` (spec 25 V1, ön kayıt §7): görme ALGIYLA birleşiyor mu.
//
// GERÇEK yoldan: Orion pozuna konur, `niyetiYurut({ tur: "sor", ne: "gor" })` — niyet yürütücüsü algıyı (dunya +
// oyuncu) toplar, Orion'un gözünden kareyi çeker, görme modeline verir, `gordum` üretir. Senaryo yalnız sonucu okur
// (`sonGorme`). "Bulabiliyor mu" ölçülmez (V0'ın hatası): adlar algıdan gelir; ölçülen, betimin algıya bağlı, yerinde,
// kısa ve Türkçe olması. Bellek (B5) dışarıdan ölçülür (nvidia-smi), burada değil.
//
// Çıktı: poz başına `[GOZDENE] kayit {json}` (docs/olcum/goz-v1.jsonl'a çıkarılır) + ölçüt satırları.
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";
import type { Avatar } from "../../world/avatar/index.ts";
import type { GormeKaydi } from "../niyetYurutucu.ts";
import { tumCapalar } from "../../world/level/capalar.ts";
import { odaPozlari, ovaPozlari, type GozPozu } from "../gozPozlari.ts";

interface Kayit { poz: GozPozu; model: string; algi: string; metin: string; sureMs: number; hata?: string; cevapsiz?: boolean }

const kucuk = (s: string) => s.toLocaleLowerCase("tr");
/** Cümle sayısı: nokta / ünlem / soru / üç nokta ile biten parçalar. */
export const cumleSayisi = (s: string) => s.split(/[.!?…]+(?:\s|$)/).filter((x) => x.trim()).length;
const GUNDUZ = /güneş|gündüz|mavi gök/i;

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[GOZDENE] " + m);
  const ikiKare = () => new Promise<void>((r) => {
    let n = 0;
    const g = d.sahne.onAfterRenderObservable.add(() => { if (++n >= 2) { d.sahne.onAfterRenderObservable.remove(g); r(); } });
  });
  /** Gerçek yoldan bak; `gordum` gelene kadar bekle (en çok `ms`). */
  const bak = async (id: string, ms: number): Promise<GormeKaydi | null> => {
    d.niyetiYurut({ tur: "sor", ne: "gor" }, id);
    for (let t = 0; t < ms; t += 100) { const g = d.sonGorme(); if (g?.niyetId === id) return g; await bekle(100); }
    return null;
  };

  await bekle(2500);
  const o = d.orion as Avatar | null;
  if (!o) { log("KALDI Orion'un bedeni hazır değil"); return; }
  const model = d.gozModeli();
  log(`model ${model}`);

  const kayitlar: Kayit[] = [];
  const adlar: Record<"oda" | "ova", string[]> = { oda: [], ova: [] };
  const pozdaBak = async (p: GozPozu, i: number) => {
    o.isinla(p.x, p.z, p.yaw);
    await ikiKare();
    const g = await bak(`gozdene_${i}`, 60_000);
    const k: Kayit = g
      ? { poz: p, model, algi: g.algi, metin: g.metin, sureMs: g.sureMs, ...(g.hata ? { hata: g.hata } : {}) }
      : { poz: p, model, algi: "", metin: "", sureMs: 60_000, cevapsiz: true };
    kayitlar.push(k);
    log("kayit " + JSON.stringify(k));
  };

  // ── Oda (+ ısınma: sayılmaz, soğuk süresi yazılır) ──
  adlar.oda = [...new Set(d.yerler().orion.nesneler.map((n) => n.ad))];
  const odaP = odaPozlari(tumCapalar());
  o.isinla(odaP[0]!.x, odaP[0]!.z, odaP[0]!.yaw);
  await ikiKare();
  const isinma = await bak("gozdene_isinma", 90_000);
  log(`isinma ${isinma ? `${(isinma.sureMs / 1000).toFixed(1)} sn${isinma.hata ? ` HATA ${isinma.hata}` : ""}` : "CEVAPSIZ"}`);
  for (const [i, p] of odaP.entries()) await pozdaBak(p, i);

  // ── Ova ──
  if (!(await d.ovayaCik())) { log("KALDI ovaya çıkılamadı"); return; }
  await bekle(3000);
  adlar.ova = [...new Set(d.yerler().orion.nesneler.map((n) => n.ad))];
  const cikis = d.oyuncu.oyuncuDurumu().konum;
  for (const [i, p] of ovaPozlari(cikis).entries()) await pozdaBak(p, odaP.length + i);

  // ── Ölçütler (ön kayıt §7) ──
  // Hatalı (model çalışmadı) ya da cevapsız poz B1/B6'da BAŞARISIZ sayılır: yedek metin algıyı içerir, görme değildir.
  const gecerli = (k: Kayit) => !k.hata && !k.cevapsiz;
  const b1 = kayitlar.filter((k) => gecerli(k) && adlar[k.poz.yer].some((a) => kucuk(k.algi).includes(kucuk(a)) && kucuk(k.metin).includes(kucuk(a))));
  const uydurma = (k: Kayit) => {
    const bu = adlar[k.poz.yer].map(kucuk), obur = adlar[k.poz.yer === "oda" ? "ova" : "oda"].map(kucuk);
    return obur.filter((a) => !bu.some((b) => b.includes(a)) && kucuk(k.metin).includes(a));
  };
  const b2 = kayitlar.filter((k) => gecerli(k) && uydurma(k).length > 0);
  const ovaK = kayitlar.filter((k) => k.poz.yer === "ova");
  const b3 = ovaK.filter((k) => gecerli(k) && GUNDUZ.test(k.metin));
  const sureler = kayitlar.filter(gecerli).map((k) => k.sureMs).sort((a, b) => a - b);
  const ortanca = sureler.length ? (sureler[(sureler.length - 1) >> 1]! + sureler[sureler.length >> 1]!) / 2 : NaN;
  const b6 = kayitlar.filter((k) => gecerli(k) && /[çğıöşü]/i.test(k.metin) && cumleSayisi(k.metin) <= 3 && k.metin.length <= 350);
  const n = kayitlar.length;
  const oran = (x: number) => (x / n).toFixed(2);
  const sonuc = (ad: string, tuttu: boolean, detay: string) => log(`${tuttu ? "TUTTU" : "TUTMADI"} ${ad}: ${detay}`);

  log(`adlar oda=${adlar.oda.join("|")} ova=${adlar.ova.join("|")}`);
  for (const k of b2) log(`uydurma ${k.poz.ad}: ${uydurma(k).join(", ")}`);
  for (const k of b3) log(`gunduz sozu ${k.poz.ad}`);
  sonuc("B1 algıya bağlı (≥ 0,80)", b1.length / n >= 0.8, `${oran(b1.length)} (${b1.length}/${n})`);
  sonuc("B2 öbür yerin adı yok (ihlal ≤ 0,10)", b2.length / n <= 0.1, `${oran(b2.length)} (${b2.length}/${n})`);
  sonuc("B3 ova gecesiyle tutarlı (ihlal ≤ 1)", b3.length <= 1, `${b3.length}/${ovaK.length}`);
  sonuc("B4 ortanca ≤ 3,0 sn", ortanca <= 3000, `${(ortanca / 1000).toFixed(2)} sn (en çok ${((sureler.at(-1) ?? NaN) / 1000).toFixed(1)})`);
  sonuc("B6 Türkçe, ≤ 3 cümle, ≤ 350 krk (≥ 0,90)", b6.length / n >= 0.9, `${oran(b6.length)} (${b6.length}/${n})`);
  const hatali = kayitlar.filter((k) => k.hata).length, cevapsiz = kayitlar.filter((k) => k.cevapsiz).length;
  sonuc("her bakış gordum üretti (cevapsız = 0)", cevapsiz === 0, `cevapsız ${cevapsiz}, model hatası ${hatali}`);
  log(`ozet model=${model} n=${n} isinma=${isinma ? (isinma.sureMs / 1000).toFixed(1) : "-"}sn`);
}
