// uygulama/sekans/oynatici.ts — SEKANS OYNATICISI (spec 36): sekansı gerçek zamanda bedenlere oynatır, ■ ile HEMEN keser. SAF (DOM yok; saat ve kapılar dışarıdan).
//
// BEDENE TEK YOL (tasarım kararı, spec 36 §3): oynatıcı bedenin kemiğine/sürücüsüne DOKUNMAZ. ▶'de sekans bağlama başına tek bir klibe derlenir
// (`derleyici.ts`), klip geçici katmana konur (`geciciKlipler.ts`) ve ajanın KENDİ kapısından mevcut niyetle istenir: `{ tur: "jest", klip }` →
// `niyetDogrula` → `AjanKapisi.niyet` (Orion: `niyetiYurut`; Flash: kendi bedeni). Sonuç bedenin `sonucDinle`sinden: `basladi` → oynuyor, `bitti` →
// o bağlama bitti; hepsi bitince sekans BİTTİ. Kimlik öneki `elle` (Ozyn'in eli: hata Orion'un LLM'ini uyandırmaz).
//
// ■ DURDUR her an, beklemeden: abonelikler kalkar, her bağlamanın ajanına AYNI kapıdan `dur` gider (klip `iptal` olur, kol iner; yürüyorsa durur),
// geçici klipler kaldırılır. `dur` iş bitmiş olsa da gönderilir (graf ■'ünün kuralı: zararsızdır, "bitti mi" sorusu yarış doğurur).
// BAŞKA BİR NİYET klibi keserse (Orion'un kendi kararı, Flash'ın boşta kıpırtısı) sekans "kesildi" diye DURUR ve öteki bağlamalar da durdurulur
// (yarım sekans sessizce sürmesin). Bilinmeyen klip, bilinmeyen/bedensiz ajan, çözülemeyen `@ben`, hareketsiz sekans → hiç başlamadan NEDENLE ret.
// TEK OYNATMA: aynı anda bir sekans; ikinci ▶ nedenle reddedilir. Döngüsüz oynatmanın tavanı süre + 5 sn: aşılırsa (beden `bitti` demedi) durdurulur.
//
// GÜVENLİK: `sekansiOynat` üretimde YALNIZ editörün ▶ düğmesinden (gerçek tık, `isTrusted`) ve `sekansdene` senaryosunun yüzünden çağrılır — bekçi
// `uygulama/yapi/sekans/sekansBekci.test.ts`. Orion'un araç yüzeyinde (`bridge/araclar.ts`) sekans yoktur.
"use strict";
import { niyetDogrula } from "../../protocol/dogrula.ts";
import type { NiyetSonucu } from "../../protocol/niyet.ts";
import { BEN, SEKANS_FPS, type OynatmaAraligi, type Sekans } from "../../protocol/sekans.ts";
import { kimlik } from "../../protocol/temel.ts";
import { ELLE_NIYET_ONEKI, type AjanKapisi } from "../ajanlar/ajanKapisi.ts";
import { sekansiDerle, type OynatmaPlani } from "./derleyici.ts";
import { GECICI_ONEK, type GeciciKlipKatmani } from "./geciciKlipler.ts";

export type SekansKapisi = Pick<AjanKapisi, "id" | "ad" | "niyet" | "sonucDinle">;

export interface SekansOynaticiAyari {
  katman: GeciciKlipKatmani;
  /** Ajanın kapısı; bedeni yoksa null (çağrı ANINDA okunur). */
  kapi(id: string): SekansKapisi | null;
  /** Ajan defterindeki kimlikler. */
  ajanlar(): readonly string[];
  /** ms (varsayılan `performance.now`); testte sahte saat. */
  simdi?: () => number;
  gunluk?: (seviye: "bilgi" | "iyi" | "uyari" | "hata", metin: string) => void;
  /** Döngüsüz oynatmada beden `bitti` demezse süreye eklenen bekleme (ms); varsayılan `BITIS_PAYI_MS` (testte kısa). */
  bitisPayiMs?: number;
}

export interface OynatmaIstegi {
  /** Playhead'in karesi (oradan başlar; aralık dışındaysa aralığın başından). */
  baslangic: number;
  dongu: boolean;
  /** `@ben` bağlamasının ajanı (editörden oynatırken yok: `@ben` nedenle reddedilir). */
  ben?: string | null;
}

export interface SuruyorBilgisi { sekans: string; plan: OynatmaPlani; aralik: OynatmaAraligi; t0: number; ajanlar: string[] }
export interface OynatmaSonucu { sekans: string; durum: "bitti" | "durdu" | "hata"; neden?: string; kare: number }
export interface OynatmaDurumu { calisiyor: SuruyorBilgisi | null; son: OynatmaSonucu | null }

export interface SekansOynatici {
  sekansiOynat(s: Sekans, istek: OynatmaIstegi): { ok: true } | { ok: false; neden: string };
  /** ■: her an, hemen. Oynayan yoksa hiçbir şey yapmaz. */
  durdur(): void;
  durum(): OynatmaDurumu;
  /** Oynarken şu anki kare (saatle kestirilir; bedenin saatiyle en çok bir tik fark eder), yoksa null. */
  kare(): number | null;
  dinle(f: (d: OynatmaDurumu) => void): () => void;
}

/** Döngüsüz oynatmanın beden `bitti` demezse bekleme payı. */
export const BITIS_PAYI_MS = 5000;

export function sekansOynaticiKur(a: SekansOynaticiAyari): SekansOynatici {
  const simdi = a.simdi ?? (() => performance.now());
  const dinleyiciler = new Set<(d: OynatmaDurumu) => void>();
  let calisiyor: SuruyorBilgisi | null = null;
  let son: OynatmaSonucu | null = null;
  let sayac = 0;
  /** Süren oynatmanın temizlik bilgisi. */
  let is: { abonelikler: (() => void)[]; kapilar: SekansKapisi[]; klipAdlari: string[]; bekleyen: Set<string>; saat: ReturnType<typeof setTimeout> | undefined } | null = null;
  const durum = (): OynatmaDurumu => ({ calisiyor, son });
  const yay = () => { const d = durum(); for (const f of [...dinleyiciler]) { try { f(d); } catch (err) { console.error("[SEKANS] dinleyici hatası:", err); } } };

  function kare(): number | null {
    if (!calisiyor) return null;
    const { plan, t0 } = calisiyor;
    const i = Math.max(0, Math.floor(((simdi() - t0) / 1000) * SEKANS_FPS));
    if (!plan.dongu) return plan.kareler[Math.min(i, plan.kareler.length - 1)]!;
    return plan.kareler[i % (plan.kareler.length - 1)]!;
  }

  /** Süren oynatmayı kapatır. `dur`: bedenlere `dur` gönderilsin mi (■ ve hata/kesilme: evet; temiz bitiş: hayır). */
  function bitir(sonuc: Omit<OynatmaSonucu, "kare">, dur: boolean): void {
    const x = is, c = calisiyor;
    if (!x || !c) return;
    const k = kare() ?? c.aralik.bas;
    is = null; calisiyor = null;
    for (const f of x.abonelikler) f();
    clearTimeout(x.saat);
    if (dur) for (const kp of x.kapilar) kp.niyet({ tur: "dur" }, kimlik(ELLE_NIYET_ONEKI));
    for (const ad of x.klipAdlari) a.katman.kaldir(ad);
    son = { ...sonuc, kare: k };
    a.gunluk?.(sonuc.durum === "bitti" ? "iyi" : sonuc.durum === "durdu" ? "bilgi" : "hata", `${sonuc.sekans}: ${sonuc.durum}${sonuc.neden ? ` — ${sonuc.neden}` : ""}`);
    yay();
  }

  function sekansiOynat(s: Sekans, istek: OynatmaIstegi): { ok: true } | { ok: false; neden: string } {
    if (calisiyor) return { ok: false, neden: `zaten '${calisiyor.sekans}' oynuyor (■ ile durdur)` };
    // 1. Bağlamalar çözülür (ajan defterde mi, bedeni var mı, @ben). Hata varsa HİÇBİR bedene niyet gitmez.
    const defter = a.ajanlar();
    const kapilar = new Map<string, SekansKapisi>();
    for (const b of s.baglamalar) {
      const ajan = b.ajan === BEN ? istek.ben ?? null : b.ajan;
      if (ajan === null) return { ok: false, neden: `bağlama '${b.id}': '${BEN}' çözülemez — editörden oynatırken @ben yok (bağlamanın ajanını orion/flash yap)` };
      if (!defter.includes(ajan)) return { ok: false, neden: `bağlama '${b.id}': ajan '${ajan}' defterde yok (var: ${defter.join(", ") || "yok"})` };
      const kp = a.kapi(ajan);
      if (!kp) return { ok: false, neden: `bağlama '${b.id}': ${ajan} bedeni hazır değil (henüz yüklenmedi ya da bedensiz ajan)` };
      if ([...kapilar.values()].some((x) => x.id === kp.id)) return { ok: false, neden: `bağlama '${b.id}': ${ajan} başka bir bağlamada da (@ben aynı ajana çözüldü)` };
      kapilar.set(b.id, kp);
    }
    // 2. Derle. Eksik klip varsa oynatılmaz (bölüm sessizce boş geçmesin).
    const no = ++sayac;
    const d = sekansiDerle(s, a.katman, istek.baslangic, istek.dongu, (b) => `${GECICI_ONEK}${no}_${b}`);
    if (d.eksikKlipler.length) return { ok: false, neden: `bilinmeyen klip: ${d.eksikKlipler.join(", ")} (yüklü: ${a.katman.adlar().join(", ") || "yok"})` };
    if (!d.klipler.length) return { ok: false, neden: "oynatılacak hareket yok (bütün izler boş ya da gizli)" };
    for (const b of d.bos) a.gunluk?.("uyari", `${s.ad}: bağlama '${b}' hiç hareket etmiyor (niyet gönderilmedi)`);
    // 3. Geçici klipler katmana; her bağlamaya AYNI niyet yolundan klipli jest. Dinleyici GÖNDERMEDEN önce kurulur (beden senkron cevap verebilir).
    const yeni = { abonelikler: [] as (() => void)[], kapilar: [...kapilar.values()], klipAdlari: [] as string[], bekleyen: new Set<string>(), saat: undefined as ReturnType<typeof setTimeout> | undefined };
    for (const { klip } of d.klipler) {
      const r = a.katman.ekle(klip);
      if (!r.ok) { for (const ad of yeni.klipAdlari) a.katman.kaldir(ad); return { ok: false, neden: r.neden }; }
      yeni.klipAdlari.push(klip.ad);
    }
    is = yeni;
    calisiyor = { sekans: s.ad, plan: d.plan, aralik: { ...s.aralik }, t0: simdi(), ajanlar: s.baglamalar.map((b) => kapilar.get(b.id)!.id) };
    const ad = s.ad;
    for (const { baglama, klip } of d.klipler) {
      const kp = kapilar.get(baglama)!;
      const n = niyetDogrula({ tur: "jest", jest: klip.jest, klip: klip.ad });
      if (!n.ok) { bitir({ sekans: ad, durum: "hata", neden: `niyet reddedildi: ${n.hata}` }, true); return { ok: false, neden: `niyet reddedildi: ${n.hata}` }; }
      const id = kimlik(ELLE_NIYET_ONEKI);
      yeni.bekleyen.add(id);
      yeni.abonelikler.push(kp.sonucDinle((x: NiyetSonucu) => {
        if (x.niyet_id !== id || is !== yeni) return;
        if (x.durum === "basladi") {
          const atl = (x.veri as { atlanan?: unknown } | undefined)?.atlanan;
          if (Array.isArray(atl) && atl.length) a.gunluk?.("uyari", `${ad}: ${kp.ad} gövdesinde uygulanamayan izler (o uzuv yok): ${atl.join(", ")}`);
          return;
        }
        if (x.durum === "bitti") { yeni.bekleyen.delete(id); if (!yeni.bekleyen.size) bitir({ sekans: ad, durum: "bitti" }, false); return; }
        const neden = x.durum === "iptal" ? `${kp.ad}: kesildi (${x.not ?? "başka bir niyet araya girdi"})` : `${kp.ad}: ${x.not ?? "oynatamadı (neden söylenmedi)"}`;
        bitir({ sekans: ad, durum: "hata", neden }, true);
      }));
      kp.niyet(n.deger, id);
      if (is !== yeni) return son?.durum === "hata" ? { ok: false, neden: son.neden ?? "başlamadı" } : { ok: true };
    }
    const pay = a.bitisPayiMs ?? BITIS_PAYI_MS;
    if (!d.plan.dongu) yeni.saat = setTimeout(() => { if (is === yeni) bitir({ sekans: ad, durum: "hata", neden: `zaman aşımı: beden ${(d.plan.sure + pay / 1000).toFixed(1)} sn içinde 'bitti' demedi` }, true); }, d.plan.sure * 1000 + pay);
    a.gunluk?.("bilgi", `${ad}: ▶ ${d.plan.dongu ? "döngüde" : "bir kez"} · ${d.klipler.length} bağlama · kare ${d.plan.kareler[0]} → ${s.aralik.bit}`);
    yay();
    return { ok: true };
  }

  return {
    sekansiOynat,
    durdur: () => { if (calisiyor) bitir({ sekans: calisiyor.sekans, durum: "durdu" }, true); },
    durum,
    kare,
    dinle(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
  };
}
