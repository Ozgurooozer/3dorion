// uygulama/graf/grafDinleyici.ts — ⚡ DİNLEME ("KUR / silahlandır", spec 35 dilim 2): olay tetikli grafik çalışması. SAF: DOM, depolama yok.
//
// DEĞİŞMEZ KURAL: grafiği ÇALIŞTIRMA yalnız Ozyn'in gerçek tıklamasıdır. Olay tetikli çalışma bunu AŞMAZ, şöyle:
//   • Ozyn Graf sekmesinde bir grafiği gerçek tıklamayla (▶ gibi `isTrusted`) DİNLEMEYE ALIR (`dinlemeyeAl`; bekçi: npcDavranisi.test.ts — üretimde
//     yalnız BİLİNÇLİ İZİN LİSTESİNDEKİ dosyalar çağırır ve her çağıran tıklama işleyicisi `isTrusted`a bakar). Olay, YALNIZ dinlemedeki grafiği yürütür;
//     dinlemede olmayan grafiğin olay düğümü hiçbir şey yapmaz. Kurmak bir izin, olay yalnız o iznin tetiği.
//   • Dinlemeye alınan, O ANDAKİ grafiktir (kopya, ▶ gibi): sonradan dosya değişse (Ozyn ya da ileride Orion'un önerisi) dinlenen program DEĞİŞMEZ —
//     Ozyn'in onayladığı şey çalışır, onaylamadığı değil. Yeni hâl için yeniden kur.
//   • Bırakmak her zaman serbest (`birak`, `npcBirak`, `hepsiniBirak`, ■ `durdur`): durdurmak güvenlik yönüdür, `isTrusted` istemez.
//   • YALNIZ BELLEKTE: dinleme listesi diske/localStorage'a yazılmaz; uygulama kapanınca dinleme KALMAZ, bir sonraki açılışta Ozyn yeniden kurar
//     (bekçi: bu dosyada depolama/IPC adı geçmez).
// NPC SINIFI (dilim 3): "NPC'yi dinlemeye al" AYNI GİRİŞTİR (`dinlemeyeAl(npc)`; ikinci bir çalıştırma yolu yok): NPC kaydının (`protocol/npc.ts`) her
// grafiği, o NPC'nin ajanı için ayrı bir kayıt olur (anahtar `<graf>@<ajan>`). `@ben` kaydın BAĞLAMINDA çözülür (grafiğin kopyası değişmez); NPC'nin
// parametreleri de o anın kopyasıdır. Kurulum ATOMİKTİR: grafiklerden biri kurulamazsa hiçbiri kurulmaz (yarım NPC yok), neden grafiğin adıyla döner.
// TAVANLAR: aynı KAYIT aynı anda TEK çalışma (çakışan olay kuyruğa girmez: ATLANIR ve sayılır — kuyruk, Ozyn uzaklaştıktan sonra eski bir "yaklaştı"yı
// oynatırdı); olay düğümü başına SOĞUMA (`OLAY_SOGUMA_MS`; olay üreticisinin kendi 4 sn soğumasına ek, kayıt başına); toplam dinleme kaydı
// (`DINLEME_AZAMI`, NPC'lerin grafikleri dahil TOPLAM). Aynı grafik AYNI ajan için iki kez dinlenmez (iki program aynı bedeni sürerdi); iki AYRI ajan için
// iki kayıt serbesttir (iki nöbetçi). ▶ ile aynı grafik çalışırken gelen olay da atlanır (`disMesgul`).
// Olay kaynağı: ajanın gözü (`uygulama/ajanlar/ajanAlgisi.ts` abonesi; olayı köprüye de verir, kopya üretici yok). Orion'un olayları bilerek AÇIK DEĞİL:
// Orion'un kendi LLM'i aynı olaya zaten tepki verir; grafik de aynı bedeni sürseydi iki karar verici yarışırdı (spec 35 §4c).
"use strict";
import type { Graf } from "../../protocol/graf.ts";
import { npcDogrula, type Npc } from "../../protocol/npc.ts";
import { DESEN_CAGIR_TIPI, grafTurDenetle } from "./grafTurDenetimi.ts";
import { calismaBaslat, sonucSatiri, type BaslamisCalisma, type CalismaTabani, type SonCalisma } from "./grafCalistirici.ts";
import { olayTetikleri } from "./olayDugumleri.ts";
import type { NpcBaglami } from "./dugumKaydi.ts";

/** Aynı anda dinleme kaydı sayısı (NPC grafikleri dahil). 8: bir odadaki NPC'ler (nöbetçi, barmen, satıcı…) için bol; her biri bir abonelik ve olası bir çalışma. */
export const DINLEME_AZAMI = 8;
/** Aynı kaydın aynı olay düğümü bu süre dolmadan yeniden tetiklenmez (ms). 5 sn: olay üreticisinin 4 sn'sinin biraz üstü. Ölçülmedi. */
export const OLAY_SOGUMA_MS = 5000;

/** Dinleme kaydının anahtarı: grafik tek başına `<graf>`, bir NPC'nin dinlemesi `<graf>@<ajan>` (`@` adlarda geçemez: çakışmaz). */
export const dinlemeAnahtari = (graf: string, ajan: string | null = null): string => (ajan ? `${graf}@${ajan}` : graf);

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
  /** Kaydın anahtarı (`birak` bununla): `<graf>` ya da NPC'de `<graf>@<ajan>`. */
  anahtar: string;
  graf: string;
  /** NPC'nin dinlemesiyse NPC'nin adı ve ajanı (`@ben`); grafik tek başına dinliyorsa null. */
  npc: { ad: string; ajan: string } | null;
  /** Dinlenen olaylar ("flash: ozyn_yaklasti"; `@ben` çözülmüş). */
  tetikler: readonly { dugum: string; ajan: string; olay: string }[];
  /** Olayla başlayan çalışma sayısı. */
  tetik: number;
  /** Atlanan olaylar: kayıt zaten çalışıyordu / soğumadaydı. */
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
  /**
   * ⚡ Dinlemeye al: YALNIZ Ozyn'in gerçek tıklamasından (Graf sekmesi, görsel editör, NPC şeridi). Grafik adı → grafik tek başına; NPC kaydı → kaydın
   * BÜTÜN grafikleri o NPC'nin ajanı için (atomik). Kurulamazsa nedeni.
   */
  dinlemeyeAl(hedef: string | Npc): { ok: true } | { ok: false; neden: string };
  /** Kaydı (anahtarıyla) bırakır; süren çalışmasını da durdurur. Dinlemede değilse false. */
  birak(anahtar: string): boolean;
  /** NPC'nin bütün kayıtlarını bırakır; bırakılan kayıt sayısı. */
  npcBirak(npc: string): number;
  hepsiniBirak(): number;
  /** ■: süren olay çalışmalarını durdurur (grafik adı verilirse yalnız o grafiğin kayıtlarını); dinleme SÜRER. Durdurulan sayısı. */
  durdur(graf?: string): number;
  /** Bu ANAHTARLA kayıt var mı (grafik tek başına: anahtar = grafiğin adı). */
  dinlemedeMi(anahtar: string): boolean;
  /** NPC'nin kaydı var mı. */
  npcDinlemede(npc: string): boolean;
  /** Grafiğin HERHANGİ bir kaydı (tek başına ya da bir NPC'nin) şu an çalışıyor mu. */
  calisiyorMu(graf: string): boolean;
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
  /** Dinlemeye alındığı andaki grafik (kopya): her tetik bunun kopyasını yürütür. */
  g: Graf;
  /** Dinlemeye alındığı andaki desen kopyaları: tetikler depoyu değil bunları kullanır. */
  desenler: Map<string, Graf>;
  /** Kaydın NPC'si (`@ben` + parametreler, kopya); grafik tek başına dinliyorsa null. */
  ben: NpcBaglami | null;
  birakicilar: (() => void)[];
  /** Son kabul edilen tetik anı, olay düğümü başına. */
  sonTetik: Map<string, number>;
  suren: BaslamisCalisma | null;
}

type Hazir = { ok: true; k: Kayit } | { ok: false; neden: string };

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
  const etiket = (k: Kayit): string => (k.satir.npc ? `${k.satir.anahtar} (NPC ${k.satir.npc.ad})` : k.satir.graf);

  function tetiklendi(k: Kayit, t: { dugum: string; ajan: string; olay: string }, o: DunyaOlayi): void {
    // Bırakılmış bir kaydın geç gelen olayı (abonelik kapanırken aynı tikte) hiçbir şey başlatmaz.
    if (kayitlar.get(k.satir.anahtar) !== k) return;
    if (k.suren || a.disMesgul?.(k.satir.graf)) { k.satir.atlanan.calisiyor++; yay(); return; }
    const an = simdi();
    const onceki = k.sonTetik.get(t.dugum);
    if (onceki !== undefined && an - onceki < soguma) { k.satir.atlanan.soguma++; yay(); return; }
    k.sonTetik.set(t.dugum, an);
    k.satir.tetik++;
    k.satir.calisiyor = true;
    a.gunluk?.("bilgi", `⚡ ${etiket(k)}: ${t.ajan} · ${t.olay} → çalışıyor`);
    // Her tetik dinlemeye alınan KOPYAYI yürütür (dosyanın şimdiki hâlini değil); `@ben` kaydın bağlamından (grafik metni değişmez).
    const b = calismaBaslat(structuredClone(k.g), { ...a, depo: { al: (x) => a.depo.al(x), desen: (x) => { const d = k.desenler.get(x); return d ? structuredClone(d) : null; } } },
      { giris: { dugum: t.dugum, veri: o.ayrinti ?? {} }, ben: k.ben });
    k.suren = b;
    yay();
    const p = b.bitis.then((s) => {
      k.suren = null;
      k.satir.calisiyor = false;
      k.satir.son = s;
      a.gunluk?.(s.durum === "bitti" ? "iyi" : s.durum === "durdu" ? "uyari" : "hata", `⚡ ${k.satir.npc ? `[NPC ${k.satir.npc.ad}] ` : ""}${sonucSatiri(s)}`);
      yay();
    });
    surenler.add(p);
    void p.finally(() => surenler.delete(p));
  }

  /**
   * Bir grafiği dinlemeye HAZIRLAR (yan etkisiz): yükle, kopyala, denetle (`ben` bağlamıyla), tetikleri çöz, kuralları sına. Kurmak ayrı adımdır ki NPC'nin
   * grafiklerinden biri reddedilirse hiçbiri kurulmamış olsun. `bekleyen`: aynı kurulumda hazırlanan öteki kayıtlar (çakışma onlara da bakılır).
   */
  function hazirla(ad: string, ben: NpcBaglami | null, bekleyen: readonly Kayit[]): Hazir {
    const anahtar = dinlemeAnahtari(ad, ben?.ajan ?? null);
    if (kayitlar.has(anahtar)) return { ok: false, neden: `'${anahtar}' zaten dinlemede` };
    const kaynak = a.depo.al(ad);
    if (!kaynak) return { ok: false, neden: `'${ad}' yüklenemedi ya da bozuk (Kontrol et)` };
    if (kaynak.tur !== "olay") return { ok: false, neden: `'${ad}' bir desen: dinlemez, bir grafikte 'Desen' düğümüyle çağrılır` };
    const g: Graf = structuredClone(kaynak);
    // `ben` HER ZAMAN tanımlı (NPC ya da null): NPC'siz dinleme `@ben`li grafiği nedenle reddeder (Kontrol et'in "sınıf" serbestliği burada yok).
    const hatalar = grafTurDenetle(g, a.kayit, { desen: (x) => a.depo.desen(x), buGraf: null, ajanlar: a.ajanlar, ben });
    if (hatalar.length) return { ok: false, neden: `Kontrol et: ${hatalar[0]}${hatalar.length > 1 ? ` (+${hatalar.length - 1} sorun)` : ""}` };
    const tetikler = olayTetikleri(g, ben?.ajan ?? null);
    if (!tetikler.length) return { ok: false, neden: `'${ad}' hiçbir olayı dinlemiyor (olay düğümü yok: ▶ ile çalışır)` };
    const acik = a.kaynak.ajanlar();
    const kapali = tetikler.find((t) => !acik.includes(t.ajan));
    if (kapali) return { ok: false, neden: `'${kapali.ajan}' ajanının olayları grafiğe açık değil (açık: ${acik.join(", ") || "yok"}; Orion'un olaylarını kendi LLM'i dinler)` };
    // Aynı grafik AYNI ajanın olayını iki kayıtta dinlemez: iki program aynı bedeni aynı anda sürer, sayaç iki kez artardı. Ayrı ajanlar serbest.
    const ajanlari = new Set(tetikler.map((t) => t.ajan));
    const cakisan = [...kayitlar.values(), ...bekleyen].find((k) => k.satir.graf === ad && k.satir.tetikler.some((t) => ajanlari.has(t.ajan)));
    if (cakisan) return { ok: false, neden: `'${ad}' zaten ${[...ajanlari].filter((x) => cakisan.satir.tetikler.some((t) => t.ajan === x)).join(", ")} için dinlemede ('${cakisan.satir.anahtar}'; aynı grafik aynı ajanda tek kayıt)` };
    return {
      ok: true,
      k: {
        satir: { anahtar, graf: ad, npc: ben ? { ad: ben.ad, ajan: ben.ajan } : null, tetikler, tetik: 0, atlanan: { calisiyor: 0, soguma: 0 }, calisiyor: false, son: null },
        g, desenler: desenleriDondur(g, (x) => a.depo.desen(x)), ben, birakicilar: [], sonTetik: new Map(), suren: null,
      },
    };
  }

  function kur(k: Kayit): void {
    kayitlar.set(k.satir.anahtar, k);
    for (const t of k.satir.tetikler) k.birakicilar.push(a.kaynak.dinle(t.ajan, (o) => { if (o.ad === t.olay) tetiklendi(k, t, o); }));
    a.gunluk?.("bilgi", `⚡ ${etiket(k)} dinlemede: ${k.satir.tetikler.map((t) => `${t.ajan} · ${t.olay}`).join(", ")}`);
  }

  function birak(anahtar: string): boolean {
    const k = kayitlar.get(anahtar);
    if (!k) return false;
    kayitlar.delete(anahtar);
    for (const f of k.birakicilar) f();
    k.suren?.calisma.durdur();
    a.gunluk?.("bilgi", `⚡ ${etiket(k)} dinlemeden çıktı (${k.satir.tetik} tetik, ${k.satir.atlanan.calisiyor + k.satir.atlanan.soguma} atlanan)`);
    yay();
    return true;
  }

  /** NPC kaydını dinlemeye alır: her grafiği o NPC'nin ajanı için. ATOMİK: önce hepsi hazırlanır, biri reddedilirse hiçbiri kurulmaz. */
  function npcDinlemeyeAl(ham: Npc): { ok: true } | { ok: false; neden: string } {
    const r = npcDogrula(ham);
    if (!r.ok) return { ok: false, neden: `NPC kaydı bozuk: ${r.hata}` };
    const npc = r.deger;
    if ([...kayitlar.values()].some((k) => k.satir.npc?.ad === npc.ad)) return { ok: false, neden: `'${npc.ad}' NPC'si zaten dinlemede (önce bırak)` };
    // Kaydın ajanı DEFTERDE olmalı (kayıtta değil burada denetlenir: defter çalışma anının bilgisi, Flash sonradan gelir).
    const defter = a.ajanlar();
    if (!defter.includes(npc.ajan)) return { ok: false, neden: `'${npc.ad}': ajan '${npc.ajan}' ajan defterinde yok (var: ${defter.join(", ") || "yok"})` };
    if (kayitlar.size + npc.graflar.length > azami) return { ok: false, neden: `en çok ${azami} dinleme kaydı (şu an ${kayitlar.size}; '${npc.ad}' ${npc.graflar.length} grafik ister — önce birini bırak)` };
    // Parametreler o ANIN kopyası: kayıt dosyası sonradan değişse de dinlenen NPC değişmez (grafik gibi; yeni hâl için bırak + yeniden kur).
    const ben: NpcBaglami = { ad: npc.ad, ajan: npc.ajan, parametreler: Object.freeze({ ...npc.parametreler }) };
    const hazir: Kayit[] = [];
    for (const g of npc.graflar) {
      const h = hazirla(g, ben, hazir);
      if (!h.ok) return { ok: false, neden: `'${npc.ad}' · ${g}: ${h.neden}` };
      hazir.push(h.k);
    }
    for (const k of hazir) kur(k);
    yay();
    return { ok: true };
  }

  return {
    dinlemeyeAl(hedef) {
      if (typeof hedef !== "string") return npcDinlemeyeAl(hedef);
      if (kayitlar.has(hedef)) return { ok: false, neden: `'${hedef}' zaten dinlemede` };
      if (kayitlar.size >= azami) return { ok: false, neden: `en çok ${azami} dinleme kaydı aynı anda (önce birini bırak)` };
      const h = hazirla(hedef, null, []);
      if (!h.ok) return h;
      kur(h.k);
      yay();
      return { ok: true };
    },
    birak,
    npcBirak(npc) {
      const l = [...kayitlar.values()].filter((k) => k.satir.npc?.ad === npc).map((k) => k.satir.anahtar);
      for (const x of l) birak(x);
      return l.length;
    },
    hepsiniBirak() { const l = [...kayitlar.keys()]; for (const x of l) birak(x); return l.length; },
    durdur(graf) {
      let n = 0;
      for (const k of kayitlar.values()) if ((graf === undefined || k.satir.graf === graf) && k.suren) { k.suren.calisma.durdur(); n++; }
      return n;
    },
    dinlemedeMi: (anahtar) => kayitlar.has(anahtar),
    npcDinlemede: (npc) => [...kayitlar.values()].some((k) => k.satir.npc?.ad === npc),
    calisiyorMu: (graf) => [...kayitlar.values()].some((k) => k.satir.graf === graf && k.suren != null),
    liste: () => [...kayitlar.values()].map((k) => ({ ...k.satir, atlanan: { ...k.satir.atlanan } })),
    dinle(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
    bitti: async () => { while (surenler.size) await Promise.all([...surenler]); },
  };
}
