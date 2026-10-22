// uygulama/graf/ajanDugumleri.ts — AJAN DÜĞÜMLERİ (spec 35 dilim 1): Git, Bak, Otur, Kalk, Söyle, Jest + Ajan seç, Nesne bul; dilim 2: Seçimli diyalog.
//
// Her eylem düğümü bir `kim` (tip `ajan`) alır, ham niyeti kurar, PROTOKOL DOĞRULAYICISINDAN (`niyetDogrula`) geçirir ve O AJANIN tek eylem yolundan yürütür
// (`GrafYetenegi.niyetYurut`: Orion'da `niyetiYurut`, Flash'ta kendi beden kapısı). Düğüm niyetin SONUCUNU BEKLER: `bitti` → sonraki düğüm; `hata` →
// düğüm hatası (ajanın nedeni aynen söylenir: "hedefe giden yol yok…"); `iptal` → düğüm hatası ("iş kesildi": başka bir niyet araya girdi). ■ beklemeyi
// keser ve ajana `dur` gider (`durdurulunca`). Grafikte OLMAYANLAR bilerek yok: `komut` (terminal), `hatirla`, `doktor`, `ortam`, `yaz`, `emret`.
//
// HEDEF (Git, Bak): `hedef` ayarı pinleri seçer — `ozyn` (pin yok; protokolün `oyuncu` hedefi), `konum` (konum pini: Konum düğümünden ya da bir ajan/Ozyn konumundan; protokolün `nokta` hedefi), `capa` (metin pini: çapa adı ya da etiketi; doğrulayıcı
// "beyaz tahta"yı `tahta`ya çevirir), `nesne` (nesne pini: Nesne bul'dan). NEDEN ayarla ve tek "hedef" pini değil: bağsız veri girişi ayar ister (denetim),
// yani "isteğe bağlı pin" yok; hedef türü sabit bir seçimdir, pin listesi ona göre değişir ("Sıra 3" üç çıkış gibi). Nesneye giden hedef etkileşim
// menüsüyle AYNI kuraldan (`world/yer/nesneEylemleri.ts` `nesneHedefleri`): çapalıysa çapa, değilse nokta + yarıçap.
"use strict";
import type { GrafDegeri, PinTanimi } from "../../protocol/graf.ts";
import { JESTLER, type Niyet } from "../../protocol/niyet.ts";
import type { Hedef } from "../../protocol/temel.ts";
import { niyetDogrula, type Sonuc } from "../../protocol/dogrula.ts";
import type { Nesne } from "../../world/level/nesneKaydi.ts";
import { NESNE_TURLERI } from "../../world/level/cekirdek/anlam.ts";
import { nesneHedefleri } from "../../world/yer/nesneEylemleri.ts";
import { AKIS_GIRIS, AKIS_SONRA, type AyarTanimi, type DugumCalismasi, type DugumSonucu, type DugumTanimi, type PinOrtami } from "./dugumKaydi.ts";
import type { GrafYetenegi } from "./grafYetenegi.ts";
import {
  DIYALOG_SECENEK_AZAMI, DIYALOG_SECENEK_ENAZ, DIYALOG_SURE_AZAMI_SN, DIYALOG_SURE_ENAZ_SN, DIYALOG_SURE_VARSAYILAN_SN, diyalogHatasi,
} from "./diyalogDenetimi.ts";
import { ajanCoz, benDenetle, benliAjanSecenekleri } from "./benAjani.ts";

/** Ajan seçeneklerinin kaynağı: pin ortamındaki ajan defteri (denetim anında; Flash sonradan gelir). */
const ajanSecenekleri = (o: PinOrtami): readonly string[] => o.ajanlar?.() ?? [];

export const KIM: PinTanimi = { ad: "kim", tip: "ajan" };
/** `kim` bağsızsa ayardan okunur; ayar varsa ajan defterinde olmalı (denetim). */
export const KIM_AYARI: AyarTanimi = { ad: "kim", tip: "metin", secenekler: ajanSecenekleri, aciklama: "ajan kimliği (bağ yoksa)" };

export const GIT_HEDEFLERI = ["ozyn", "capa", "nesne", "konum"] as const;
export const BAK_HEDEFLERI = [...GIT_HEDEFLERI, "serbest"] as const;
type HedefTuru = (typeof BAK_HEDEFLERI)[number];
/** Mesafe ayarının tavanı (m): ova ölçeği; 0 = hedefin kendi yakınlığı. */
export const MESAFE_AZAMI = 50;

const hedefPinleri = (h: GrafDegeri | undefined): PinTanimi[] =>
  h === "capa" ? [{ ad: "capa", tip: "metin" }] : h === "nesne" ? [{ ad: "nesne", tip: "nesne" }] : h === "konum" ? [{ ad: "konum", tip: "konum" }] : [];

/** Değer bir konum mu (`{ x, y, z }` sayıları; Konum / Ajan durumu / Ozyn durumu çıktısı). Yanlış bağlanan değer sessizce (0,0)'a yürütmesin. */
export function konumMu(v: unknown): v is { x: number; y: number; z: number } {
  if (typeof v !== "object" || v === null) return false;
  const k = v as { x?: unknown; y?: unknown; z?: unknown };
  return [k.x, k.y, k.z].every((x) => typeof x === "number" && Number.isFinite(x));
}

/** Değer bir nesne mi (Nesne bul'un çıktısı ya da desen girişi). Yapı denetimi: yanlış bağlanmış bir değer sessizce (0,0)'a yürütmesin. */
export function nesneMi(v: unknown): v is Nesne {
  if (typeof v !== "object" || v === null) return false;
  const n = v as Partial<Nesne>;
  const k = n.kutu as Partial<Nesne["kutu"]> | undefined;
  return typeof n.id === "string" && typeof n.ad === "string" && typeof k === "object" && k !== null
    && [k.x, k.y, k.z, k.g, k.d].every((x) => typeof x === "number" && Number.isFinite(x));
}

/** `kim` girişinin değeri: defterde olan bir ajan kimliği. Denetimden sonra defter değişmiş olabilir (ajan kapandı): çalışma anında da bakılır. */
export async function kimOku(c: DugumCalismasi<GrafYetenegi>): Promise<{ id: string; ad: string }> {
  const v = await c.giris("kim");
  if (typeof v !== "string" || !v) throw new Error(`kim: bir ajan olmalı (Ajan seç'e bağla ya da ayar.kim ver; gelen: ${JSON.stringify(v)})`);
  const ajanlar = c.yetenek.ajanlar();
  const a = ajanlar.find((x) => x.id === v);
  if (!a) throw new Error(`bilinmeyen ajan '${v}' (var: ${ajanlar.map((x) => x.id).join(", ") || "yok"})`);
  return a;
}

/** Hedef ayarına göre protokol hedefi (ham; doğrulayıcı sonra bakar). `nesne` için git/bak niyeti menüyle aynı kuraldan gelir. */
async function hedefOku(c: DugumCalismasi<GrafYetenegi>, tur: HedefTuru): Promise<{ hedef: Hedef | null; nesne?: Nesne }> {
  if (tur === "ozyn") return { hedef: { tip: "oyuncu" } };
  if (tur === "serbest") return { hedef: null };
  if (tur === "capa") {
    const ad = await c.giris("capa");
    if (typeof ad !== "string" || !ad.trim()) throw new Error(`capa: çapa adı olmalı (örn. "sandalye", "tahta"; gelen: ${JSON.stringify(ad)})`);
    return { hedef: { tip: "capa", ad: ad.trim() } };
  }
  if (tur === "konum") {
    const k = await c.giris("konum");
    if (!konumMu(k)) throw new Error("konum: bir konum olmalı (Konum, Ajan durumu ya da Ozyn durumu düğümüne bağla)");
    return { hedef: { tip: "nokta", x: k.x, y: k.y, z: k.z } };
  }
  const n = await c.giris("nesne");
  if (!nesneMi(n)) throw new Error("nesne: bir nesne olmalı (Nesne bul düğümüne bağla)");
  return { hedef: null, nesne: n };
}

/**
 * Niyeti doğrular, `kim`in kapısından yürütür ve SONUCU BEKLER. ■ beklerken gelirse çalışma 'durdu' olur ve ajana `dur` gider (iş kesilir).
 * Doğrulayıcının reddi düğüm hatasıdır (sessiz düşme yok); ajanın hatası nedeniyle döner.
 */
export async function yurut(c: DugumCalismasi<GrafYetenegi>, kim: { id: string; ad: string }, ham: unknown): Promise<DugumSonucu> {
  const r: Sonuc<Niyet> = niyetDogrula(ham);
  if (!r.ok) throw new Error(`niyet reddedildi: ${r.hata}`);
  const is = c.yetenek.niyetYurut(kim.id, r.deger);
  const birak = c.durdurulunca(() => is.kes());
  const s = await c.bekleVeyaDur(is.sonuc).finally(birak);
  if (s.durum === "bitti") return { sonra: "sonra" };
  if (s.durum === "iptal") throw new Error(`${kim.ad}: iş kesildi (${s.not ?? "başka bir niyet araya girdi"})`);
  throw new Error(`${kim.ad}: ${s.not ?? "yapamadı (neden söylenmedi)"}`);
}

/** Söylenecek değer: metin olduğu gibi; sayı/bool yazıya; nesne adıyla. Başka şey (bağ yanlış) hata. */
function metinle(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (nesneMi(v)) return v.ad;
  throw new Error(`söylenecek değer metin, sayı ya da nesne olmalı (gelen: ${v === null ? "null" : typeof v})`);
}

const norm = (s: string): string => s.trim().toLocaleLowerCase("tr");

/** Diyalog seçeneklerinin ayar adları (`secenek1`…): pin adları "1"…"4" tuşlarla aynı sayı, Ozyn'in gördüğü numara. */
const SECENEK_ADLARI = Array.from({ length: DIYALOG_SECENEK_AZAMI }, (_, i) => `secenek${i + 1}`);

/**
 * Diyalog seçenekleri, ayardaki sırayla. BOŞLUK YOK: secenek3 dolu ama secenek2 boşsa HATA — "3" çıkışına bağlanan dal ekranda 2. sırada görünür ve
 * Ozyn'in bastığı numara başka dalı yürütürdü. Sayı ve metin denetimi `diyalogHatasi`nda (ekranla aynı kural).
 */
function secenekleriOku(a: Readonly<Record<string, GrafDegeri>>): string[] {
  const l: string[] = [];
  let bosluk = 0;
  for (const [i, ad] of SECENEK_ADLARI.entries()) {
    const v = a[ad];
    if (v === undefined || v === null || v === "") { if (!bosluk) bosluk = i + 1; continue; }
    if (typeof v !== "string") throw new Error(`${ad}: metin olmalı`);
    if (bosluk) throw new Error(`seçenekler sırayla olmalı: secenek${bosluk} boş ama ${ad} dolu`);
    l.push(v);
  }
  const h = diyalogHatasi("x", l, DIYALOG_SURE_VARSAYILAN_SN * 1000);
  if (h) throw new Error(h);
  return l;
}

/**
 * NESNE BUL (saf): ad (ya da kimlik) ve isteğe bağlı türle. Önce TAM eşleşme (kimlik ya da ad), yoksa adın İÇİNDE geçen; tek aday kazanır.
 * Birden çok aday HATADIR, ilkini sessizce seçmek yanlış nesneye yürütürdü: adaylar sayılır ki Ozyn adı belirginleştirsin. Bulunamazsa var olanlardan
 * birkaçı söylenir.
 */
export function nesneBul(nesneler: readonly Nesne[], ad: string, tur: string): Sonuc<Nesne> {
  const adaylar = tur ? nesneler.filter((n) => n.tur === tur) : [...nesneler];
  const q = norm(ad);
  const ozet = (l: readonly Nesne[]) => l.slice(0, 8).map((n) => n.ad).join(", ") + (l.length > 8 ? ` … (+${l.length - 8})` : "");
  const tek = (l: readonly Nesne[], neden: string): Sonuc<Nesne> | null =>
    l.length === 1 ? { ok: true, deger: l[0]! } : l.length > 1 ? { ok: false, hata: `birden çok nesne ${neden}: ${ozet(l)} — adı belirginleştir` } : null;
  const turYazisi = tur ? ` (tür: ${tur})` : "";
  if (!q) return tek(adaylar, `var${turYazisi}`) ?? { ok: false, hata: `hiç nesne yok${turYazisi}` };
  return tek(adaylar.filter((n) => norm(n.id) === q || norm(n.ad) === q), `'${ad}' adında`)
    ?? tek(adaylar.filter((n) => norm(n.ad).includes(q) || norm(n.id).includes(q)), `'${ad}' içeren`)
    ?? { ok: false, hata: `'${ad}' adlı nesne bulunamadı${turYazisi}${adaylar.length ? ` (var: ${ozet(adaylar)})` : ""}` };
}

export function ajanDugumleri(): DugumTanimi<GrafYetenegi>[] {
  return [
    // ── seçici / veri (saf) ──
    {
      tip: "ajan.sec", ad: "Ajan seç", kategori: "veri", saf: true,
      aciklama: "Listeden bir ajan (Orion, Flash…) ya da @ben (bu grafiği çalıştıran NPC); çıkışı eylem düğümlerinin 'kim' girişine bağlanır. Liste ajan defterinden gelir.",
      ayarlar: [{ ad: "ajan", tip: "metin", secenekler: benliAjanSecenekleri, aciklama: "ajan kimliği (@ben: bu NPC)" }],
      pinler: (a, o) => {
        if (typeof a["ajan"] !== "string" || !a["ajan"]) throw new Error("ajan seçilmedi (ayar.ajan: örn. \"flash\" ya da \"@ben\")");
        benDenetle(a["ajan"], o, "ajan");
        return { girisler: [], cikislar: [{ ad: "ajan", tip: "ajan" }] };
      },
      calistir: (c) => {
        // `@ben` çalışma BAĞLAMINDAN çözülür (dilim 3): grafiğin metni "@ben" kalır, iki NPC aynı kopyayı çalıştırır.
        const id = ajanCoz(c.ayar["ajan"], c.ben) as string;
        const ajanlar = c.yetenek.ajanlar();
        if (!ajanlar.some((x) => x.id === id)) throw new Error(`bilinmeyen ajan '${id}' (var: ${ajanlar.map((x) => x.id).join(", ") || "yok"})`);
        return { cikti: { ajan: id } };
      },
    },
    {
      tip: "nesne.bul", ad: "Nesne bul", kategori: "veri", saf: true,
      aciklama: "Ozyn'in bulunduğu yerdeki bir nesneyi adıyla (ya da kimliğiyle; isteğe bağlı türle) bulur. Bulunamazsa ya da birden çok aday varsa HATA.",
      ayarlar: [
        { ad: "tur", tip: "metin", varsayilan: "", secenekler: ["", ...NESNE_TURLERI], aciklama: "tür süzgeci (boş: hepsi)" },
      ],
      pinler: () => ({ girisler: [{ ad: "ad", tip: "metin" }], cikislar: [{ ad: "nesne", tip: "nesne" }] }),
      calistir: async (c) => {
        const ad = await c.giris("ad");
        if (typeof ad !== "string") throw new Error(`ad: metin olmalı (gelen: ${typeof ad})`);
        const r = nesneBul(c.yetenek.nesneler(), ad, (c.ayar["tur"] as string | undefined) ?? "");
        if (!r.ok) throw new Error(r.hata);
        return { cikti: { nesne: r.deger } };
      },
    },

    // ── ajan eylemleri (akışlı; sonucu bekler) ──
    {
      tip: "ajan.git", ad: "Git", kategori: "ajan", saf: false,
      aciklama: "Ajan hedefe yürür; VARINCA devam eder. Hedef: Ozyn, çapa ya da nesne (ayar.hedef). Yol yoksa nedeniyle hata.",
      ayarlar: [
        { ad: "hedef", tip: "metin", varsayilan: "ozyn", secenekler: GIT_HEDEFLERI },
        { ad: "mesafe", tip: "sayi", varsayilan: 0, en: 0, cok: MESAFE_AZAMI, aciklama: "hedefin kaç metre yakınında durulur (0: hedefin kendi yakınlığı)" },
        KIM_AYARI,
      ],
      pinler: (a) => ({ girisler: [AKIS_GIRIS, KIM, ...hedefPinleri(a["hedef"])], cikislar: [AKIS_SONRA] }),
      calistir: async (c) => {
        const kim = await kimOku(c);
        const h = await hedefOku(c, c.ayar["hedef"] as HedefTuru);
        const mesafe = c.ayar["mesafe"];
        const m = typeof mesafe === "number" && mesafe > 0 ? { mesafe } : {};
        const ham = h.nesne ? { ...nesneHedefleri(h.nesne, c.yetenek.capalar()).git, ...m } : { tur: "git", hedef: h.hedef, ...m };
        return yurut(c, kim, ham);
      },
    },
    {
      tip: "ajan.bak", ad: "Bak", kategori: "ajan", saf: false,
      aciklama: "Ajan başını/gövdesini hedefe çevirir (Ozyn, çapa, nesne) ya da serbest bakışa döner.",
      ayarlar: [{ ad: "hedef", tip: "metin", varsayilan: "ozyn", secenekler: BAK_HEDEFLERI }, KIM_AYARI],
      pinler: (a) => ({ girisler: [AKIS_GIRIS, KIM, ...hedefPinleri(a["hedef"])], cikislar: [AKIS_SONRA] }),
      calistir: async (c) => {
        const kim = await kimOku(c);
        const h = await hedefOku(c, c.ayar["hedef"] as HedefTuru);
        return yurut(c, kim, h.nesne ? nesneHedefleri(h.nesne, c.yetenek.capalar()).bak : { tur: "bak", hedef: h.hedef });
      },
    },
    {
      tip: "ajan.otur", ad: "Otur", kategori: "ajan", saf: false,
      aciklama: "Ajan çapaya (varsayılan sandalye) yürür ve OTURUNCA devam eder. Koltuk doluysa ya da oturulmazsa nedeniyle hata.",
      ayarlar: [{ ad: "capa", tip: "metin", varsayilan: "sandalye", aciklama: "oturulacak çapa (sandalye, bank…)" }, KIM_AYARI],
      pinler: () => ({ girisler: [AKIS_GIRIS, KIM, { ad: "capa", tip: "metin" }], cikislar: [AKIS_SONRA] }),
      calistir: async (c) => {
        const kim = await kimOku(c);
        const capa = await c.giris("capa");
        if (typeof capa !== "string" || !capa.trim()) throw new Error(`capa: çapa adı olmalı (gelen: ${JSON.stringify(capa)})`);
        return yurut(c, kim, { tur: "otur", capa: capa.trim() });
      },
    },
    {
      tip: "ajan.kalk", ad: "Kalk", kategori: "ajan", saf: false,
      aciklama: "Oturan ajan kalkar; ayağa kalkınca devam eder (zaten ayaktaysa nedeniyle hata).",
      ayarlar: [KIM_AYARI],
      pinler: () => ({ girisler: [AKIS_GIRIS, KIM], cikislar: [AKIS_SONRA] }),
      calistir: async (c) => yurut(c, await kimOku(c), { tur: "kalk" }),
    },
    {
      tip: "ajan.soyle", ad: "Söyle", kategori: "ajan", saf: false,
      aciklama: "Ajan söyler (altyazı; Orion'da ses de). Söz bitince devam eder. Metin, sayı ya da nesne (adı) bağlanabilir.",
      ayarlar: [KIM_AYARI],
      pinler: () => ({ girisler: [AKIS_GIRIS, KIM, { ad: "metin", tip: "herhangi" }], cikislar: [AKIS_SONRA] }),
      calistir: async (c) => {
        const kim = await kimOku(c);
        return yurut(c, kim, { tur: "soyle", metin: metinle(await c.giris("metin")) });
      },
    },
    {
      tip: "diyalog.sec", ad: "Seçimli diyalog", kategori: "ajan", saf: false,
      aciklama: `Ajan Ozyn'e sorar ve ${DIYALOG_SECENEK_ENAZ}–${DIYALOG_SECENEK_AZAMI} seçenek gösterir (oyun NPC'si gibi): Ozyn tıklar ya da 1–${DIYALOG_SECENEK_AZAMI}'e basar, `
        + `o seçeneğin çıkışı ("1", "2"…) yürür. Süre dolarsa 'zamanAsimi'. Seçenekler ayar.secenek1…secenek${DIYALOG_SECENEK_AZAMI} (sırayla, boşluksuz).`,
      ayarlar: [
        ...SECENEK_ADLARI.map((ad): AyarTanimi => ({ ad, tip: "metin", aciklama: "seçenek metni" })),
        { ad: "sure", tip: "sayi", varsayilan: DIYALOG_SURE_VARSAYILAN_SN, en: DIYALOG_SURE_ENAZ_SN, cok: DIYALOG_SURE_AZAMI_SN, aciklama: "cevap bekleme süresi (sn)" },
        KIM_AYARI,
      ],
      pinler: (a) => {
        const s = secenekleriOku(a);
        return {
          girisler: [AKIS_GIRIS, KIM, { ad: "metin", tip: "herhangi" }],
          cikislar: [...s.map((_, i): PinTanimi => ({ ad: String(i + 1), tip: "akis" })), { ad: "zamanAsimi", tip: "akis" }, { ad: "secilen", tip: "sayi" }, { ad: "secilenMetin", tip: "metin" }],
        };
      },
      calistir: async (c) => {
        const kim = await kimOku(c);
        const metin = metinle(await c.giris("metin"));
        const secenekler = secenekleriOku(c.ayar);
        const sureMs = (c.ayar["sure"] as number) * 1000;
        const h = diyalogHatasi(metin, secenekler, sureMs);
        if (h) throw new Error(h);
        // Ekran BEKLEMEDEN önce açılır (başka diyalog açıksa burada nedenle düşer); ■ diyaloğu da kapatır — yoksa durmuş bir grafiğin sorusu ekranda kalırdı.
        const is = c.yetenek.diyalogAc({ ajan: kim, metin, secenekler, sureMs });
        const birak = c.durdurulunca(() => is.kapat());
        const s = await c.bekleVeyaDur(is.sonuc).finally(birak);
        if (s.tur === "kapandi") throw new Error("diyalog cevaplanmadan kapandı");
        // Zaman aşımında da çıktılar dolu: sonraki düğüm 'secilen'i okursa "henüz çalışmadı" yerine 0 görür.
        if (s.tur === "zamanAsimi") return { cikti: { secilen: 0, secilenMetin: "" }, sonra: "zamanAsimi" };
        return { cikti: { secilen: s.indeks + 1, secilenMetin: secenekler[s.indeks]! }, sonra: String(s.indeks + 1) };
      },
    },
    {
      tip: "ajan.jest", ad: "Jest", kategori: "ajan", saf: false,
      aciklama: "Ajan bir jest yapar (el sallama, baş sallama…). Jest anında biter: art arda jest için arasına Bekle koy.",
      ayarlar: [{ ad: "jest", tip: "metin", varsayilan: "el_salliyor", secenekler: JESTLER }, KIM_AYARI],
      pinler: () => ({ girisler: [AKIS_GIRIS, KIM], cikislar: [AKIS_SONRA] }),
      calistir: async (c) => yurut(c, await kimOku(c), { tur: "jest", jest: c.ayar["jest"] }),
    },
  ];
}
