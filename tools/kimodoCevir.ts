// tools/kimodoCevir.ts — KİMODO BVH → SEKANS ÇEVİRİCİSİ (spec 37). Kimodo'nun (NVIDIA, metinden insan hareketi) BVH'sini Orion'un sekansına çevirir:
// her soyut uzvun gövde uzayı dönme deltası (donme_x/y/z) + `kok` öteleme izleri, sadeleştirilmiş anahtarlarla. Üretilen dosya `protocol/sekans.ts`
// doğrulayıcısından geçer (geçmezse yazılmaz).
//
// Matematik: tools/kimodo/cevir.ts (yeniden hedefleme), tools/kimodo/sadelestir.ts (Euler, RDP, döngü). Girdi tabloları: tools/kimodo/somaTpoz.json (SOMA
// T-pozu, Kimodo deposundan), tools/kimodo/orionGovdesi.json (Orion'un dinlenme/boşta pozu, gerçek glb'den ölçüm). Eşleme: world/avatar/zincirler.ts.
//
// CLI:  node --experimental-strip-types tools/kimodoCevir.ts <giris.bvh> <cikis.json> [--yerinde | --yatay] [--dongu] [--ad ad] [--aciklama metin] [--tolerans 1.5]
//   --yerinde (varsayılan) yatay kök hareketi atılır · --yatay kok.oteleme_x/z yazılır (±0,5 m'ye kısılır) · --dongu adım döngüsü bulunur (yerinde zorunlu)
//   --ad sekans adı (varsayılan: dosya adı, `kimodo_` önekli) · --tolerans derece (öteleme: × 0,005 m).
"use strict";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { KLIP_SINIRLARI, otelemeMi, type Kanal, type Uzuv } from "../protocol/animasyon.ts";
import { SEKANS_SINIRLARI, sekansDogrula, type Sekans, type UzuvIzi } from "../protocol/sekans.ts";
import { bvhCevir, type SomaTpoz } from "./kimodo/cevir.ts";
import { donguBul, donguyuKapat, eulerDizisi, rdp, sayiDongusu } from "./kimodo/sadelestir.ts";
import type { OrionGovdesi } from "./kimodo/orionOlc.ts";

export interface CeviriAyari {
  ad: string;
  aciklama?: string;
  yerinde?: boolean;
  dongu?: boolean;
  /** Derece; öteleme için × OTELEME_ORANI metre. */
  tolerans?: number;
  izTavani?: number;
  anahtarTavani?: number;
  /** Döngünün en kısa boyu (kare). */
  donguEnAz?: number;
}

export const VARSAYILAN_TOLERANS = 1.5;
/** Öteleme toleransı = derece toleransı × bu (1,5° → 7,5 mm). */
export const OTELEME_ORANI = 0.005;
/** Döngü benzerliğinde kullanılan eklemler (uç etkileyiciler + orta eklemler + baş). */
export const DONGU_EKLEMLERI = ["RightHand", "LeftHand", "RightForeArm", "LeftForeArm", "RightFoot", "LeftFoot", "RightShin", "LeftShin", "Head"] as const;

export interface CeviriRaporu {
  kare: number; iz: number; anahtar: number;
  hareketsiz: string[];
  /** İz tavanı yüzünden atılan izler ve en büyük değerleri (atmanın getirdiği en büyük hata). */
  tavandanAtilan: { iz: string; enBuyuk: number }[];
  /** Anahtar tavanı yüzünden toleransı artırılan izler. */
  toleransArtan: { iz: string; tolerans: number }[];
  sarma: number; gimbal: number;
  dongu: { bas: number; bit: number; benzerlik_cm: number } | null;
  bacakOrani: number; ilkYon: number;
  kisilanOteleme: number;
  uyarilar: string[];
}

const KLASOR = new URL("./kimodo/", import.meta.url);
export const tablolariOku = (): { tpoz: SomaTpoz; orion: OrionGovdesi } => ({
  tpoz: JSON.parse(readFileSync(new URL("somaTpoz.json", KLASOR), "utf8")) as SomaTpoz,
  orion: JSON.parse(readFileSync(new URL("orionGovdesi.json", KLASOR), "utf8")) as OrionGovdesi,
});

interface Kanal1 { uzuv: Uzuv; kanal: Kanal; degerler: number[] }

export function kimodoCevir(bvhMetni: string, ayar: CeviriAyari, tablolar = tablolariOku()): { sekans: Sekans; rapor: CeviriRaporu } {
  const tol = ayar.tolerans ?? VARSAYILAN_TOLERANS;
  const izTavani = ayar.izTavani ?? SEKANS_SINIRLARI.iz, anahtarTavani = ayar.anahtarTavani ?? SEKANS_SINIRLARI.anahtar;
  const uyarilar: string[] = [];
  let yerinde = ayar.yerinde ?? true;
  if (ayar.dongu && !yerinde) { uyarilar.push("--dongu yatay kök hareketiyle döngü kuramaz (her turda ileri kayardı): --yerinde zorlandı"); yerinde = true; }
  const ham = bvhCevir(bvhMetni, tablolar.tpoz, tablolar.orion, { yerinde });
  if (ham.fps !== 30) throw new Error(`yalnız 30 kare/sn BVH (sekans sabit 30; gelen ${ham.fps})`);
  uyarilar.push(...ham.uyarilar);

  let donmeler = ham.donmeler, kok = ham.kok, dongu: CeviriRaporu["dongu"] = null;
  if (ayar.dongu) {
    const d = donguBul(DONGU_EKLEMLERI.map((a) => ham.kaynakKonumu(a)), ham.fps, ayar.donguEnAz ?? 20);
    if (!d) uyarilar.push("döngü bulunamadı (klip çok kısa): döngüsüz yazıldı");
    else {
      dongu = { bas: d.bas, bit: d.bit, benzerlik_cm: Number((d.benzerlik * 100).toFixed(2)) };
      donmeler = new Map([...donmeler].map(([u, l]) => [u, donguyuKapat(l, d.bas, d.bit)]));
      kok = { x: sayiDongusu(kok.x, d.bas, d.bit), y: sayiDongusu(kok.y, d.bas, d.bit), z: sayiDongusu(kok.z, d.bas, d.bit) };
    }
  }
  const kareSayisi = kok.y.length;
  let sarma = 0, gimbal = 0, kisilan = 0;
  const kanallar: Kanal1[] = [];
  for (const [uzuv, l] of donmeler) {
    const e = eulerDizisi(l);
    sarma += e.sarma; gimbal += e.gimbal;
    for (const x of ["x", "y", "z"] as const) kanallar.push({ uzuv, kanal: `donme_${x}`, degerler: e[x] });
  }
  const kis = (v: number) => { if (Math.abs(v) <= KLIP_SINIRLARI.oteleme) return v; kisilan++; return Math.sign(v) * KLIP_SINIRLARI.oteleme; };
  kanallar.push({ uzuv: "kok", kanal: "oteleme_y", degerler: kok.y.map(kis) });
  if (!yerinde) kanallar.push({ uzuv: "kok", kanal: "oteleme_x", degerler: kok.x.map(kis) }, { uzuv: "kok", kanal: "oteleme_z", degerler: kok.z.map(kis) });
  if (kisilan) uyarilar.push(`${kisilan} öteleme değeri ±${KLIP_SINIRLARI.oteleme} m'ye kısıldı (biçim tavanı)`);
  if (sarma) uyarilar.push(`${sarma} Euler değeri ±180°'yi aştı ve sarıldı: o karelerde kol bir kare boyunca tur atabilir`);

  // Önem: en büyük mutlak değer, derece cinsinden (öteleme toleransla aynı ölçeğe çevrilir).
  const onem = (k: Kanal1) => Math.max(...k.degerler.map(Math.abs)) / (otelemeMi(k.kanal) ? OTELEME_ORANI : 1);
  const adi = (k: Kanal1) => `${k.uzuv}.${k.kanal}`;
  const hareketsiz = kanallar.filter((k) => onem(k) <= tol);
  let kalan = kanallar.filter((k) => onem(k) > tol);
  const tavandanAtilan: CeviriRaporu["tavandanAtilan"] = [];
  if (kalan.length > izTavani) {
    const sirali = [...kalan].sort((a, b) => onem(b) - onem(a));
    for (const k of sirali.slice(izTavani)) tavandanAtilan.push({ iz: adi(k), enBuyuk: Number(onem(k).toFixed(2)) });
    kalan = kanallar.filter((k) => sirali.slice(0, izTavani).includes(k));
    uyarilar.push(`iz tavanı ${izTavani}: ${tavandanAtilan.length} iz atıldı (en büyüğü ${tavandanAtilan[0]!.iz} ${tavandanAtilan[0]!.enBuyuk}°)`);
  }
  const toleransArtan: CeviriRaporu["toleransArtan"] = [];
  const izler: UzuvIzi[] = kalan.map((k) => {
    const o = otelemeMi(k.kanal) ? OTELEME_ORANI : 1;
    let t = tol, kare = rdp(k.degerler, t * o);
    while (kare.length > anahtarTavani) { t *= 1.25; kare = rdp(k.degerler, t * o); }
    if (t !== tol) toleransArtan.push({ iz: adi(k), tolerans: Number(t.toFixed(3)) });
    const basamak = otelemeMi(k.kanal) ? 1e4 : 100;
    return {
      id: `${k.uzuv}_${otelemeMi(k.kanal) ? "o" : "d"}${k.kanal.slice(-1)}`, baglama: "b1", tur: "uzuv", gizli: false, kilitli: false, uzuv: k.uzuv, kanal: k.kanal,
      anahtarlar: kare.map((i) => ({ kare: i, deger: Math.round(k.degerler[i]! * basamak) / basamak, yumusatma: "dogrusal" as const })),
    };
  });
  if (toleransArtan.length) uyarilar.push(`anahtar tavanı ${anahtarTavani}: ${toleransArtan.length} izde tolerans artırıldı (${toleransArtan.map((x) => `${x.iz} ${x.tolerans}°`).join(", ")})`);
  const sure = Math.max(1, kareSayisi - 1);
  if (sure > SEKANS_SINIRLARI.sure_kare) throw new Error(`klip ${sure} kare: sekans tavanı ${SEKANS_SINIRLARI.sure_kare} (60 sn)`);
  const aciklama = (ayar.aciklama ?? `Kimodo çıktısı (${(sure / 30).toFixed(1)} sn)`) + (dongu ? " · döngülü: ⟳ ile oynat" : "");
  const ham2 = { surum: 1, ad: ayar.ad, aciklama: aciklama.slice(0, SEKANS_SINIRLARI.aciklama), fps: 30, sure_kare: sure, aralik: { bas: 0, bit: sure }, baglamalar: [{ id: "b1", ajan: "orion" }], izler };
  const r = sekansDogrula(ham2);
  if (!r.ok) throw new Error(`üretilen sekans doğrulayıcıdan geçmedi: ${r.hata}`);
  return {
    sekans: r.deger,
    rapor: {
      kare: kareSayisi, iz: izler.length, anahtar: izler.reduce((t, i) => t + i.anahtarlar.length, 0), hareketsiz: hareketsiz.map(adi), tavandanAtilan, toleransArtan,
      sarma, gimbal, dongu, bacakOrani: Number(ham.bacakOrani.toFixed(4)), ilkYon: Number(ham.ilkYon.toFixed(2)), kisilanOteleme: kisilan, uyarilar,
    },
  };
}

/** Kanonik metin: iz başına bir satır (sekans deposunun biçimi gibi okunur). */
export function sekansMetni(s: Sekans): string {
  const { izler, ...bas } = s;
  const ust = JSON.stringify(bas).slice(0, -1);
  return `${ust},\n"izler": [\n${izler.map((i) => JSON.stringify(i)).join(",\n")}\n]}\n`;
}

function cli(argv: string[]): void {
  const konum: string[] = [];
  const ayar: Partial<CeviriAyari> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--yerinde") ayar.yerinde = true;
    else if (a === "--yatay") ayar.yerinde = false;
    else if (a === "--dongu") ayar.dongu = true;
    else if (a === "--ad") ayar.ad = argv[++i];
    else if (a === "--aciklama") ayar.aciklama = argv[++i];
    else if (a === "--tolerans") ayar.tolerans = Number(argv[++i]);
    else if (a.startsWith("--")) throw new Error(`bilinmeyen seçenek: ${a}`);
    else konum.push(a);
  }
  const [giris, cikis] = konum;
  if (!giris || !cikis) throw new Error("kullanım: kimodoCevir.ts <giris.bvh> <cikis.json> [--yerinde|--yatay] [--dongu] [--ad ad] [--aciklama metin] [--tolerans 1.5]");
  if (ayar.tolerans !== undefined && !(ayar.tolerans > 0)) throw new Error("--tolerans pozitif sayı olmalı");
  const ad = ayar.ad ?? `kimodo_${basename(giris).replace(/\.bvh$/i, "")}`;
  const { sekans, rapor } = kimodoCevir(readFileSync(giris, "utf8"), { ...ayar, ad });
  writeFileSync(cikis, sekansMetni(sekans));
  process.stdout.write(`${cikis}: ${rapor.kare} kare, ${rapor.iz} iz, ${rapor.anahtar} anahtar${rapor.dongu ? `, döngü ${rapor.dongu.bas}–${rapor.dongu.bit} (benzerlik ${rapor.dongu.benzerlik_cm} cm)` : ""}\n`);
  for (const u of rapor.uyarilar) process.stdout.write(`  uyarı: ${u}\n`);
}

if (process.argv[1] && /kimodoCevir\.ts$/.test(process.argv[1])) {
  try { cli(process.argv.slice(2)); }
  catch (err) { process.stderr.write(`kimodoCevir: ${err instanceof Error ? err.message : String(err)}\n`); process.exit(1); }
}
