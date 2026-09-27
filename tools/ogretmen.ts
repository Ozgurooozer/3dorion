// tools/ogretmen.ts — ÖĞRETMEN: bir algıyı Orion'un GERÇEK köprüsünden LLM'e verir
// ve LLM'in bir şey yapıp yapmadığını karar kaydından okur.
//
// NEDEN VAR (brain-lab/BUYUK-RESIM.md, KT2). Öğrenen kapının öğretmeni LLM'in
// kendisi: "bu algıyla uyandırılsaydın bir şey yapar mıydın?" Talimat susmaya
// açıkça izin veriyor ("If there is nothing to do, stay silent"; rutin başarılı
// çıktıda susmak doğru davranış). LLM susuyorsa o uyandırma boşaydı.
//
// KOPYA DEĞİL, KÖPRÜNÜN KENDİSİ: her soru için yeni bir `Kopru` kurulur —
// süzgeçsiz (içgüdünün içerik yargısı öğretmeni etkilemesin), hafızası ve
// geçmişi boş. Algı verilir, uyanış satırı karar kaydından okunur. Böylece
// öğretmenin gördüğü girdi (talimat, örnekler, dünya, araçlar) canlıdakinin
// aynısıdır; köprü değişirse öğretmen de değişir.
//
// Dikkatin güvenlik içgüdüleri (kanal, tik) yine çalışır: yerel kanaldaki
// algıya öğretmen sorulamaz. Zaten öğrenen kapı o içgüdüleri ezemez.
//
// Kullanım:
//   node --experimental-strip-types tools/ogretmen.ts kalibre [--tekrar=3] [--model=qwen2.5:7b] [--cikti=dosya.jsonl]
"use strict";
import fs from "node:fs";
import { Kopru } from "../bridge/kopru.ts";
import { OllamaBeyni } from "../bridge/ollama.ts";
import type { Beyin } from "../bridge/beyin.ts";
import { KARAR_ONEKI, KararKaydi, type AlgiSatiri, type KapiKarari, type KararSatiri, type UyanisSatiri } from "../mind/kararKaydi.ts";
import { uyanisEyleme } from "../mind/kararZinciri.ts";
import { KUME, type Durum } from "../mind/refleksKumesi.ts";
import type { Algi } from "../protocol/algi.ts";
import type { NiyetSonucu } from "../protocol/niyet.ts";
import { tumCapalar } from "../world/level/capalar.ts";

/** Odanın değişmeyen bilgisi — canlıda kompozisyon kökünün yazdığı satırın aynısı. */
export const SABIT = `In the room: ${tumCapalar().map((c) => c.etiket).join(", ")}.`;

/**
 * Bağlam: beynin zemini (dünya durumu). Biçim canlı `dunyaDurumuMetni`nden.
 * "masada": Ozyn monitörde çalışıyor — terminal çıktısının doğal bağlamı.
 */
export const BAGLAMLAR = {
  masada: "You: duruyor, position 0.9,-1.2. Ozyn is 1.1m away. Ozyn is working on your monitor. It is afternoon, 15:20. You have been in this room for 2 hours.",
  uzakta: "You: duruyor, position 0.9,-1.2. Ozyn is 4.6m away, looking at you. It is morning, 9:15. You have just arrived in this room.",
} as const;

export interface OgretmenCevabi {
  /** Dikkat algıyı geçirdi mi. Geçirmediyse öğretmen sorulamadı. */
  gecti: boolean;
  /** LLM bir şey yaptı mı (niyet ya da konuşulan metin). Sorulamadıysa null. */
  eylem: boolean | null;
  kapi: KapiKarari;
  uyanis?: UyanisSatiri;
}

/** Bir algıyı gerçek köprüden LLM'e verir; LLM'in ne yaptığını döner. */
export async function ogretmenSor(beyin: Beyin, algi: Algi, dunya: string, zamanAsimiMs = 120_000): Promise<OgretmenCevabi> {
  const satirlar: KararSatiri[] = [];
  const kayit = new KararKaydi({ yaz: (s) => satirlar.push(JSON.parse(s.slice(KARAR_ONEKI.length + 1)) as KararSatiri) });
  const k = new Kopru({
    beyin,
    niyetGonder: () => {},
    dunyaDurumu: () => dunya,
    sabitBilgi: () => SABIT,
    toplamaMs: 10,
    kararKaydi: kayit,
  });
  // Canlıda altyazı/ses dinleyicisi hep var: araçsız temiz metin konuşmaya
  // çevrilir. Öğretmende de öyle olmalı, yoksa o metin "susma" sayılırdı.
  k.konusmaDinle(() => {});
  k.algi(algi);
  const bitis = Date.now() + zamanAsimiMs;
  try {
    for (;;) {
      const a = satirlar.find((s): s is AlgiSatiri => s.tur === "algi");
      if (a && !a.kapi.gecti) return { gecti: false, eylem: null, kapi: a.kapi };
      const u = satirlar.find((s): s is UyanisSatiri => s.tur === "uyanis");
      if (a && u) return { gecti: true, eylem: u.hata ? null : uyanisEyleme(u), kapi: a.kapi, uyanis: u };
      if (Date.now() > bitis) throw new Error(`öğretmen ${zamanAsimiMs} ms içinde cevap vermedi`);
      await new Promise((r) => setTimeout(r, 50));
    }
  } finally {
    k.durdur();
  }
}

/**
 * Etiketli kümedeki bir durumu algıya çevirir. Küme eski (Türkçe) ve yeni
 * (İngilizce) önekleri karışık taşıyor; tür `grup`tan gelir, gövde önekten
 * sonrasıdır. Görüntü (anlık liste) durumları sorulamaz: canlıda onları yalnız
 * beyin kendisi ister; kendiliğinden geleni içgüdü süzer.
 */
export function durumdanAlgi(d: Durum): Algi | null {
  const govde = (s: string) => { const i = s.indexOf("\n"); return i === -1 ? "" : s.slice(i + 1); };
  switch (d.grup) {
    case "terminal":
    case "dusman":
      return { tur: "terminal", kuyruk: govde(d.ozet), kesildi: false };
    case "olay": {
      const ad = d.ozet.replace(/^(Olay|Event):\s*/, "").trim();
      return { tur: "olay", ad };
    }
    case "konusma": {
      const m = /"(.*)"/.exec(d.ozet);
      return m ? { tur: "duydum", metin: m[1]!, kesin: true } : null;
    }
    case "sonuc": {
      const m = /^(?:Niyet|Intent)\s+(\S+)\s+→\s+(\w+)(?:\s+\((.*)\))?$/.exec(d.ozet);
      if (!m) return null;
      const sonuc: NiyetSonucu = { niyet_id: m[1]!, durum: m[2] as NiyetSonucu["durum"] };
      if (m[3]) sonuc.not = m[3];
      return { tur: "sonuc", sonuc };
    }
    case "goruntu":
      return null;
  }
}

/** Oylamanın çoğunluğu; eşitlikte null (kararsız). */
export function cogunluk(oylar: boolean[]): boolean | null {
  const evet = oylar.filter(Boolean).length;
  const hayir = oylar.length - evet;
  return evet === hayir ? null : evet > hayir;
}

export interface KalibrasyonSatiri {
  sira: number;
  grup: Durum["grup"];
  beklenen: boolean;
  ozet: string;
  oylar: (boolean | null)[];
  cogunluk: boolean | null;
  niyetTurleri: string[];
  sureMs: number[];
}

export interface KalibrasyonOzeti {
  sorulan: number;
  /** Öğretmenin çoğunluk kararı insan etiketiyle aynı olan durum. */
  uyusan: number;
  /** İnsan "uyandır" dedi, öğretmen sustu. */
  kacirilan: number;
  /** İnsan "uyandırma" dedi, öğretmen bir şey yaptı. */
  bosa: number;
  /** Tekrarların hepsi aynı kararı verdi. */
  oybirligi: number;
  kararsiz: number;
}

/** Kalibrasyon sayıları. Konuşma ayrıca sayılmaz: onu içgüdü her zaman geçirir. */
export function kalibrasyonOzeti(satirlar: KalibrasyonSatiri[]): KalibrasyonOzeti {
  const o: KalibrasyonOzeti = { sorulan: 0, uyusan: 0, kacirilan: 0, bosa: 0, oybirligi: 0, kararsiz: 0 };
  for (const s of satirlar) {
    if (s.grup === "konusma") continue;
    o.sorulan++;
    const gecerli = s.oylar.filter((x): x is boolean => x !== null);
    if (gecerli.length === s.oylar.length && gecerli.every((x) => x === gecerli[0])) o.oybirligi++;
    if (s.cogunluk === null) { o.kararsiz++; continue; }
    if (s.cogunluk === s.beklenen) o.uyusan++;
    else if (s.beklenen) o.kacirilan++;
    else o.bosa++;
  }
  return o;
}

function arg(ad: string, varsayilan: string): string {
  const p = process.argv.find((a) => a.startsWith(`--${ad}=`));
  return p ? p.slice(ad.length + 3) : varsayilan;
}

async function kalibre(): Promise<void> {
  const tekrar = Number(arg("tekrar", "3"));
  const model = arg("model", "qwen2.5:7b");
  const cikti = arg("cikti", "");
  const beyin = new OllamaBeyni({ model, zamanAsimiMs: 120_000 });
  if (!(await beyin.hazirMi())) { console.error(`beyin ayakta değil: ${model}`); process.exit(1); }
  console.log(`öğretmen kalibrasyonu — ${model}, her durum ${tekrar} kez, bağlam "masada"`);
  const satirlar: KalibrasyonSatiri[] = [];
  for (const [sira, d] of KUME.entries()) {
    const algi = durumdanAlgi(d);
    if (!algi) { console.log(`#${sira} ${d.grup}: sorulamaz, atlandı`); continue; }
    const oylar: (boolean | null)[] = [];
    const niyetTurleri: string[] = [];
    const sureMs: number[] = [];
    for (let i = 0; i < tekrar; i++) {
      const c = await ogretmenSor(beyin, algi, BAGLAMLAR.masada);
      oylar.push(c.eylem);
      if (c.uyanis) { sureMs.push(c.uyanis.sureMs); niyetTurleri.push(c.uyanis.niyetler.map((n) => n.tur).join("+") || (c.uyanis.konusulanMetin ? "metin" : "sus")); }
      else niyetTurleri.push(c.gecti ? "hata" : `dustu:${c.kapi.kural}`);
    }
    const s: KalibrasyonSatiri = {
      sira, grup: d.grup, beklenen: d.beklenen, ozet: d.ozet.replace(/\n/g, " ⏎ ").slice(0, 70),
      oylar, cogunluk: cogunluk(oylar.filter((x): x is boolean => x !== null)), niyetTurleri, sureMs,
    };
    satirlar.push(s);
    console.log(`#${sira} ${d.grup.padEnd(8)} insan=${d.beklenen ? "UYAN" : "sus "} öğretmen=${s.cogunluk === null ? "?" : s.cogunluk ? "UYAN" : "sus "} [${niyetTurleri.join(", ")}] ${s.ozet}`);
    if (cikti) fs.appendFileSync(cikti, `${JSON.stringify(s)}\n`);
  }
  const o = kalibrasyonOzeti(satirlar);
  console.log(`\nsorulan ${o.sorulan} (konuşma hariç) · uyuşan ${o.uyusan} (%${Math.round((100 * o.uyusan) / Math.max(1, o.sorulan))}) · kaçırılan ${o.kacirilan} · boşa ${o.bosa} · kararsız ${o.kararsiz} · oybirliği ${o.oybirligi}`);
  console.log("done");
}

if (import.meta.main) {
  const komut = process.argv[2];
  if (komut === "kalibre") await kalibre();
  else { console.error("kullanım: ogretmen.ts kalibre [--tekrar=3] [--model=qwen2.5:7b] [--cikti=dosya.jsonl]"); process.exit(2); }
}
