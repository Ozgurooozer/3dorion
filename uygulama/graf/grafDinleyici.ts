// uygulama/graf/grafDinleyici.ts — ⚡ DİNLEME ("KUR / silahlandır", spec 35 dilim 2): olay tetikli grafik çalışması. SAF: DOM, depolama yok.
//
// DEĞİŞMEZ KURAL: grafiği ÇALIŞTIRMA yalnız Ozyn'in gerçek tıklamasıdır. Olay tetikli çalışma bunu AŞMAZ, şöyle:
//   • Ozyn Graf sekmesinde bir grafiği gerçek tıklamayla (▶ gibi `isTrusted`) DİNLEMEYE ALIR (`dinlemeyeAl`; bekçi: grafDinleyici.test.ts — üretimde
//     yalnız uygulama/yapi/grafSekmesi.ts çağırır ve çağıran tıklama işleyicisi `isTrusted`a bakar). Olay, YALNIZ dinlemedeki grafiği yürütür; dinlemede
//     olmayan grafiğin olay düğümü hiçbir şey yapmaz. Kurmak bir izin, olay yalnız o iznin tetiği.
//   • Dinlemeye alınan, O ANDAKİ grafiktir (kopya, ▶ gibi): sonradan dosya değişse (Ozyn ya da ileride Orion'un önerisi) dinlenen program DEĞİŞMEZ —
//     Ozyn'in onayladığı şey çalışır, onaylamadığı değil. Yeni hâl için yeniden kur.
//   • Bırakmak her zaman serbest (`birak`, `hepsiniBirak`, ■ `durdur`): durdurmak güvenlik yönüdür, `isTrusted` istemez.
//   • YALNIZ BELLEKTE: dinleme listesi diske/localStorage'a yazılmaz; uygulama kapanınca dinleme KALMAZ, bir sonraki açılışta Ozyn yeniden kurar
//     (bekçi: bu dosyada depolama/IPC adı geçmez).
// TAVANLAR: aynı grafik aynı anda TEK çalışma (çakışan olay kuyruğa girmez: ATLANIR ve sayılır — kuyruk, Ozyn uzaklaştıktan sonra eski bir "yaklaştı"yı
// oynatırdı); olay düğümü başına SOĞUMA (`OLAY_SOGUMA_MS`; olay üreticisinin kendi 4 sn soğumasına ek, grafik başına); toplam dinleyen grafik sayısı
// (`DINLEME_AZAMI`). ▶ ile aynı grafik çalışırken gelen olay da atlanır (`disMesgul`).
// Olay kaynağı: ajanın gözü (`uygulama/ajanlar/ajanAlgisi.ts` abonesi; olayı köprüye de verir, kopya üretici yok). Orion'un olayları bilerek AÇIK DEĞİL:
// Orion'un kendi LLM'i aynı olaya zaten tepki verir; grafik de aynı bedeni sürseydi iki karar verici yarışırdı (spec 35 §4c).
"use strict";
import type { Graf } from "../../protocol/graf.ts";
import { DESEN_CAGIR_TIPI, grafTurDenetle } from "./grafTurDenetimi.ts";
import { calismaBaslat, sonucSatiri, type BaslamisCalisma, type CalismaTabani, type SonCalisma } from "./grafCalistirici.ts";
import { olayTetikleri } from "./olayDugumleri.ts";

/** Aynı anda dinleyen grafik sayısı. 8: bir odadaki NPC'ler (nöbetçi, barmen, satıcı…) için bol; her biri bir abonelik ve olası bir çalışma. */
export const DINLEME_AZAMI = 8;
/** Aynı grafiğin aynı olay düğümü bu süre dolmadan yeniden tetiklenmez (ms). 5 sn: olay üreticisinin 4 sn'sinin biraz üstü. Ölçülmedi. */
export const OLAY_SOGUMA_MS = 5000;

/** Dünya olayı (`world/olayUretici.ts` biçimi). */
export interface DunyaOlayi { readonly ad: string; readonly ayrinti?: Readonly<Record<string, unknown>> }

/** Olayları grafiğe açık ajanlar ve onların olay akışı. */
export interface OlayKaynagi {
  ajanlar(): readonly string[];
  dinle(ajan: string, cb: (o: DunyaOlayi) => void): () => void;
}

/** Kompozisyon kökünün olay yolu: ajanın gözü `yay`ar, dinleyici `dinle`r. Gözü olmayan ajan `ajanEkle` edilmez → onun olayı dinlenemez (nedenle). */
export interface OlayYolu extends OlayKaynagi {
  ajanEkle(id: string): void;
  yay(ajan: string, o: DunyaOlayi): void;
}

export function olayYoluKur(): OlayYolu {
  const acik = new Set<string>();
  const aboneler = new Map<string, Set<(o: DunyaOlayi) => void>>();
  return {
    ajanlar: () => [...acik],
    ajanEkle: (id) => { acik.add(id); },
    dinle(ajan, cb) {
      const s = aboneler.get(ajan) ?? aboneler.set(ajan, new Set()).get(ajan)!;
      s.add(cb);
      return () => { s.delete(cb); };
    },
    yay(ajan, o) {
      // Yalnız O AJANIN aboneleri: "Ozyn Orion'a yaklaştı" Flash'ın nöbetçisini tetiklemez.
      for (const cb of [...(aboneler.get(ajan) ?? [])]) {
        try { cb(o); } catch (err) { console.error("[graf] olay abonesi hatası:", err); }
      }
    },
  };
}

export interface DinlemeSatiri {
  graf: string;
  /** Dinlenen olaylar ("flash: ozyn_yaklasti"). */
  tetikler: readonly { dugum: string; ajan: string; olay: string }[];
  /** Olayla başlayan çalışma sayısı. */
  tetik: number;
  /** Atlanan olaylar: grafik zaten çalışıyordu / soğumadaydı. */
  atlanan: { calisiyor: number; soguma: number };
  calisiyor: boolean;
  son: SonCalisma | null;
}

export interface GrafDinleyiciAyari<Y> extends CalismaTabani<Y> {
  kaynak: OlayKaynagi;
  /** Grafik ▶ ile çalışıyorsa true: o sırada gelen olay atlanır (aynı grafik tek çalışma). */
  disMesgul?: (ad: string) => boolean;
  sogumaMs?: number;
  azami?: number;
}

export interface GrafDinleyici {
  /** ⚡ Dinlemeye al: YALNIZ Ozyn'in gerçek tıklamasından (Graf sekmesi). Kurulamazsa nedeni. */
  dinlemeyeAl(ad: string): { ok: true } | { ok: false; neden: string };
  /** Dinlemeyi bırakır; süren çalışmasını da durdurur. Dinlemede değilse false. */
  birak(ad: string): boolean;
  hepsiniBirak(): number;
  /** ■: süren olay çalışmalarını durdurur (ad verilirse yalnız onu); dinleme SÜRER. Durdurulan sayısı. */
  durdur(ad?: string): number;
  dinlemedeMi(ad: string): boolean;
  calisiyorMu(ad: string): boolean;
  liste(): readonly DinlemeSatiri[];
  dinle(f: () => void): () => void;
  /** Süren bütün olay çalışmaları bitene dek (testler). */
  bitti(): Promise<void>;
}

/**
 * Dinlemeye alınan grafiğin (doğrudan ya da iç içe) çağırdığı DESENLERİN kopyası. Grafiğin kendisi kopyalanıyordu ama desenleri her tetikte
 * depodan okunuyordu: dinleme kurulduktan sonra bir desen dosyası değişirse, Ozyn'in onayladığı program onaysız değişmiş olurdu (spec 35 §4c açığı).
 * Bulunamayan ad atlanır (tür denetimi zaten reddetmiştir); döngü ziyaret kümesiyle kesilir.
 */
export function desenleriDondur(g: Graf, desen: (ad: string) => Graf | null): Map<string, Graf> {
  const kopya = new Map<string, Graf>();
  const kuyruk: Graf[] = [g];
  while (kuyruk.length) {
    const bu = kuyruk.pop()!;
    for (const d of bu.dugumler) {
      if (d.tip !== DESEN_CAGIR_TIPI) continue;
      const ad = d.ayar?.["desen"];
      if (typeof ad !== "string" || kopya.has(ad)) continue;
      const x = desen(ad);
      if (!x) continue;
      const c = structuredClone(x);
      kopya.set(ad, c);
      kuyruk.push(c);
    }
  }
  return kopya;
}

interface Kayit {
  satir: DinlemeSatiri;
  /** Dinlemeye alındığı andaki desen kopyaları: tetikler depoyu değil bunları kullanır. */
  desenler: Map<string, Graf>;
  birakicilar: (() => void)[];
  /** Son kabul edilen tetik anı, olay düğümü başına. */
  sonTetik: Map<string, number>;
  suren: BaslamisCalisma | null;
}

export function grafDinleyiciKur<Y>(a: GrafDinleyiciAyari<Y>): GrafDinleyici {
  const simdi = a.simdi ?? (() => Date.now());
  const soguma = a.sogumaMs ?? OLAY_SOGUMA_MS;
  const azami = a.azami ?? DINLEME_AZAMI;
  const kayitlar = new Map<string, Kayit>();
  const dinleyiciler = new Set<() => void>();
  const surenler = new Set<Promise<void>>();

  const yay = (): void => {
    for (const f of [...dinleyiciler]) {
      try { f(); } catch (err) { console.error("[graf] dinleyici abonesi hatası:", err); }
    }
  };

  function tetiklendi(g: Graf, k: Kayit, t: { dugum: string; ajan: string; olay: string }, o: DunyaOlayi): void {
    // Bırakılmış bir kaydın geç gelen olayı (abonelik kapanırken aynı tikte) hiçbir şey başlatmaz.
    if (kayitlar.get(g.ad) !== k) return;
    if (k.suren || a.disMesgul?.(g.ad)) { k.satir.atlanan.calisiyor++; yay(); return; }
    const an = simdi();
    const onceki = k.sonTetik.get(t.dugum);
    if (onceki !== undefined && an - onceki < soguma) { k.satir.atlanan.soguma++; yay(); return; }
    k.sonTetik.set(t.dugum, an);
    k.satir.tetik++;
    k.satir.calisiyor = true;
    a.gunluk?.("bilgi", `⚡ ${g.ad}: ${t.ajan} · ${t.olay} → çalışıyor`);
    // Her tetik dinlemeye alınan KOPYAYI yürütür (dosyanın şimdiki hâlini değil).
    const b = calismaBaslat(structuredClone(g), { ...a, depo: { al: (x) => a.depo.al(x), desen: (x) => { const d = k.desenler.get(x); return d ? structuredClone(d) : null; } } }, { giris: { dugum: t.dugum, veri: o.ayrinti ?? {} } });
    k.suren = b;
    yay();
    const p = b.bitis.then((s) => {
      k.suren = null;
      k.satir.calisiyor = false;
      k.satir.son = s;
      a.gunluk?.(s.durum === "bitti" ? "iyi" : s.durum === "durdu" ? "uyari" : "hata", `⚡ ${sonucSatiri(s)}`);
      yay();
    });
    surenler.add(p);
    void p.finally(() => surenler.delete(p));
  }

  function birak(ad: string): boolean {
    const k = kayitlar.get(ad);
    if (!k) return false;
    kayitlar.delete(ad);
    for (const f of k.birakicilar) f();
    k.suren?.calisma.durdur();
    a.gunluk?.("bilgi", `⚡ ${ad} dinlemeden çıktı (${k.satir.tetik} tetik, ${k.satir.atlanan.calisiyor + k.satir.atlanan.soguma} atlanan)`);
    yay();
    return true;
  }

  return {
    dinlemeyeAl(ad) {
      if (kayitlar.has(ad)) return { ok: false, neden: `'${ad}' zaten dinlemede` };
      if (kayitlar.size >= azami) return { ok: false, neden: `en çok ${azami} grafik aynı anda dinler (önce birini bırak)` };
      const kaynak = a.depo.al(ad);
      if (!kaynak) return { ok: false, neden: `'${ad}' yüklenemedi ya da bozuk (Kontrol et)` };
      if (kaynak.tur !== "olay") return { ok: false, neden: `'${ad}' bir desen: dinlemez, bir grafikte 'Desen' düğümüyle çağrılır` };
      const g: Graf = structuredClone(kaynak);
      const hatalar = grafTurDenetle(g, a.kayit, { desen: (x) => a.depo.desen(x), buGraf: null, ajanlar: a.ajanlar });
      if (hatalar.length) return { ok: false, neden: `Kontrol et: ${hatalar[0]}${hatalar.length > 1 ? ` (+${hatalar.length - 1} sorun)` : ""}` };
      const tetikler = olayTetikleri(g);
      if (!tetikler.length) return { ok: false, neden: `'${ad}' hiçbir olayı dinlemiyor (olay düğümü yok: ▶ ile çalışır)` };
      const acik = a.kaynak.ajanlar();
      const kapali = tetikler.find((t) => !acik.includes(t.ajan));
      if (kapali) return { ok: false, neden: `'${kapali.ajan}' ajanının olayları grafiğe açık değil (açık: ${acik.join(", ") || "yok"}; Orion'un olaylarını kendi LLM'i dinler)` };
      const k: Kayit = {
        satir: { graf: ad, tetikler, tetik: 0, atlanan: { calisiyor: 0, soguma: 0 }, calisiyor: false, son: null },
        desenler: desenleriDondur(g, (x) => a.depo.desen(x)),
        birakicilar: [], sonTetik: new Map(), suren: null,
      };
      kayitlar.set(ad, k);
      for (const t of tetikler) k.birakicilar.push(a.kaynak.dinle(t.ajan, (o) => { if (o.ad === t.olay) tetiklendi(g, k, t, o); }));
      a.gunluk?.("bilgi", `⚡ ${ad} dinlemede: ${tetikler.map((t) => `${t.ajan} · ${t.olay}`).join(", ")}`);
      yay();
      return { ok: true };
    },
    birak,
    hepsiniBirak() { const l = [...kayitlar.keys()]; for (const ad of l) birak(ad); return l.length; },
    durdur(ad) {
      let n = 0;
      for (const [x, k] of kayitlar) if ((ad === undefined || x === ad) && k.suren) { k.suren.calisma.durdur(); n++; }
      return n;
    },
    dinlemedeMi: (ad) => kayitlar.has(ad),
    calisiyorMu: (ad) => kayitlar.get(ad)?.suren != null,
    liste: () => [...kayitlar.values()].map((k) => ({ ...k.satir, atlanan: { ...k.satir.atlanan } })),
    dinle(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
    bitti: async () => { while (surenler.size) await Promise.all([...surenler]); },
  };
}
