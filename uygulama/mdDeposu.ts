// uygulama/mdDeposu.ts — ORION'UN MD DOSYALARI DEPOSU (Yapı çubuğu · Hafıza sekmesi, spec 32): host'taki dosyaların renderer tarafı önbelleği + bağlam kurucu.
//
// Üç iş: (1) liste/oku/yaz/yeni/aktif işlemlerini tek yerden sunar (arayüz ve düzenleyici buradan konuşur); (2) AKTİF dosyaların metnini bellekte tutar ki köprü
// talimatı SENKRON kurabilsin (`baglam()`); (3) anlık hafıza dosyasının otomatik bölümünü güncel tutar (`anlikGuncelle`).
// Kaynak iki türlü: Electron'da host dosyaları (IPC), `npm run dev`'de localStorage (dosya yok; kalıcı ama tarayıcıya bağlı). Arayüz farkı bilmez.
// Bütün yazan işlemler SIRAYLA çalışır (okuma-değiştirme-yazma yarışmasın); hata fırlatır (arayüz altyazıyla söyler), sessiz yutulmaz.
"use strict";
import type { MdBilgisi } from "../host/mdDosyalari.js";
import type { MdSonuc } from "../host/kopru.ts";
import { ANLIK_HAFIZA, MD_SINIRLARI, mdAdiGecerli, mdBaglaminiKur, type MdBaglami, type MdSinirlari } from "../mind/mdBaglami.ts";
import { bolumuGuncelle, kaydetBirlestir } from "../mind/anlikHafiza.ts";
import type { Depo } from "./yerlestirmeKaydi.ts";
import { kabukKoprusu } from "./kabuk.ts";
import { ipcAc } from "./ipcSonuc.ts";

export type { MdBilgisi };

/** md işlemi hatası: `kod` host'un kodudur (yok | var | gecersiz-ad | gecersiz-icerik | cok-buyuk | bozuk-ayar | hata). */
export class MdHatasi extends Error {
  readonly kod: string;
  constructor(kod: string, mesaj: string) { super(mesaj); this.name = "MdHatasi"; this.kod = kod; }
}

export interface MdKaynagi {
  liste(): Promise<MdBilgisi[]>;
  oku(ad: string): Promise<string>;
  yaz(ad: string, metin: string): Promise<void>;
  yeni(ad: string, metin: string): Promise<void>;
  aktifYap(ad: string, aktif: boolean): Promise<void>;
}

/** Host IPC'si (preload `window.kopru.md*`): `{ok, deger}` sonucunu açar, hatayı `MdHatasi`ne çevirir. */
export interface MdKopruYuzu {
  mdListe(): Promise<MdSonuc<MdBilgisi[]>>;
  mdOku(ad: string): Promise<MdSonuc<string>>;
  mdYaz(ad: string, metin: string): Promise<MdSonuc<true>>;
  mdYeni(ad: string, metin?: string): Promise<MdSonuc<true>>;
  mdAktif(ad: string, aktif: boolean): Promise<MdSonuc<true>>;
}
const ac = <T>(s: MdSonuc<T>): T => ipcAc(s, (kod, mesaj) => new MdHatasi(kod, mesaj));
export function ipcKaynagi(k: MdKopruYuzu): MdKaynagi {
  return {
    liste: async () => ac(await k.mdListe()),
    oku: async (ad) => ac(await k.mdOku(ad)),
    yaz: async (ad, metin) => { ac(await k.mdYaz(ad, metin)); },
    yeni: async (ad, metin) => { ac(await k.mdYeni(ad, metin)); },
    aktifYap: async (ad, aktif) => { ac(await k.mdAktif(ad, aktif)); },
  };
}

// ── localStorage kaynağı (Electron'suz geliştirme) ──
export const YEREL_MD_ANAHTARI = "orion.md.v1";
interface YerelDosya { metin: string; aktif: boolean; degisti: number }

export function yerelKaynak(depo: Depo, simdi: () => number = Date.now): MdKaynagi {
  const oku = (): Record<string, YerelDosya> => {
    const ham = depo.getItem(YEREL_MD_ANAHTARI);
    if (!ham) return {};
    const v: unknown = JSON.parse(ham);
    if (typeof v !== "object" || v === null || Array.isArray(v)) throw new MdHatasi("bozuk-ayar", "yerel md kaydı bozuk");
    return v as Record<string, YerelDosya>;
  };
  const yaz = (d: Record<string, YerelDosya>) => depo.setItem(YEREL_MD_ANAHTARI, JSON.stringify(d));
  const dene = (ad: string) => { if (!mdAdiGecerli(ad)) throw new MdHatasi("gecersiz-ad", `geçersiz md adı: ${JSON.stringify(ad)}`); };
  const var_ = (d: Record<string, YerelDosya>, ad: string): YerelDosya => { const x = d[ad]; if (!x) throw new MdHatasi("yok", `md dosyası yok: ${ad}`); return x; };
  return {
    async liste() {
      return Object.entries(oku()).map(([ad, x]) => ({ ad, boyut: new TextEncoder().encode(x.metin).length, degisti: x.degisti, aktif: x.aktif, sistem: ad === ANLIK_HAFIZA }))
        .sort((a, b) => Number(b.sistem) - Number(a.sistem) || a.ad.localeCompare(b.ad, "tr"));
    },
    async oku(ad) { dene(ad); return var_(oku(), ad).metin; },
    async yaz(ad, metin) { dene(ad); const d = oku(); const x = var_(d, ad); d[ad] = { ...x, metin, degisti: simdi() }; yaz(d); },
    async yeni(ad, metin) {
      dene(ad); const d = oku();
      if (d[ad]) throw new MdHatasi("var", `zaten var: ${ad}`);
      d[ad] = { metin, aktif: ad === ANLIK_HAFIZA, degisti: simdi() }; yaz(d);
    },
    async aktifYap(ad, aktif) { dene(ad); const d = oku(); d[ad] = { ...var_(d, ad), aktif }; yaz(d); },
  };
}

// ── depo ──
export type MdOlayi = { tur: "liste" } | { tur: "icerik"; ad: string };

export interface MdDeposu {
  /** Listeyi ve aktif dosyaların metnini yükler. Hata fırlatır (çağıran altyazıyla söyler; depo boş kalır). */
  baslat(): Promise<void>;
  /** Son bilinen liste (senkron). */
  liste(): readonly MdBilgisi[];
  /** Diskten taze metin. */
  oku(ad: string): Promise<string>;
  /** Kaydet (anlık hafızada otomatik bölüm diskteki hâliyle korunur). Kaydedilen metin döner. */
  yaz(ad: string, metin: string): Promise<string>;
  yeni(ad: string, metin?: string): Promise<void>;
  aktifYap(ad: string, aktif: boolean): Promise<void>;
  /** Beyne gidecek bağlam (senkron; aktif dosyaların bellekteki metninden). */
  baglam(): MdBaglami;
  /** Anlık hafızanın otomatik bölümünü `blok` yap. Dosya değiştiyse true. Dosya yoksa oluşturur. */
  anlikGuncelle(blok: string): Promise<boolean>;
  dinle(f: (o: MdOlayi) => void): () => void;
  /** Testler: bekleyen bütün yazma işleri bitene dek. */
  bitti(): Promise<void>;
}

const ANLIK_BASLANGICI = "# Anlık hafıza\n\n<!-- Otomatik bölüm sistem tarafından güncellenir; dışına istediğini yazabilirsin. -->\n";

/** `sinir`: bağlam bütçesi, çağrı ANINDA okunur (pano düğmesi değişince sonraki tur ve kart özeti aynı anda yeni sınırı görür). */
export function mdDeposuKur(kaynak: MdKaynagi, sinir: () => MdSinirlari = () => MD_SINIRLARI): MdDeposu {
  let liste: MdBilgisi[] = [];
  const metinler = new Map<string, string>();   // yalnız AKTİF dosyaların metni
  const dinleyiciler = new Set<(o: MdOlayi) => void>();
  let kuyruk: Promise<unknown> = Promise.resolve();
  const yay = (o: MdOlayi) => { for (const f of [...dinleyiciler]) f(o); };

  /** İşi sıraya al; önceki iş hata verse de sıra devam eder, bu işin hatası çağırana gider. */
  function sirala<T>(is: () => Promise<T>): Promise<T> {
    const s = kuyruk.then(is, is);
    kuyruk = s.catch(() => undefined);
    return s;
  }

  async function listeyiTazele(): Promise<void> {
    liste = await kaynak.liste();
    const aktifler = new Set(liste.filter((x) => x.aktif).map((x) => x.ad));
    for (const ad of [...metinler.keys()]) if (!aktifler.has(ad)) metinler.delete(ad);
    await Promise.all([...aktifler].filter((ad) => !metinler.has(ad)).map(async (ad) => { metinler.set(ad, await kaynak.oku(ad)); }));
    yay({ tur: "liste" });
  }

  return {
    baslat: () => sirala(listeyiTazele),
    liste: () => liste,
    oku: (ad) => kaynak.oku(ad),
    yaz: (ad, metin) => sirala(async () => {
      // Anlık hafızada otomatik bölüm sistemin: Ozyn düzenlerken sistem güncellediyse sistemin yazdığı korunur.
      const yazilacak = ad === ANLIK_HAFIZA ? kaydetBirlestir(metin, await kaynak.oku(ad).catch(() => "")) : metin;
      await kaynak.yaz(ad, yazilacak);
      if (metinler.has(ad)) metinler.set(ad, yazilacak);
      await listeyiTazele();
      yay({ tur: "icerik", ad });
      return yazilacak;
    }),
    yeni: (ad, metin = "") => sirala(async () => { await kaynak.yeni(ad, metin); await listeyiTazele(); }),
    aktifYap: (ad, aktif) => sirala(async () => { await kaynak.aktifYap(ad, aktif); await listeyiTazele(); }),
    baglam: () => mdBaglaminiKur(liste.filter((x) => x.aktif && metinler.has(x.ad)).map((x) => ({ ad: x.ad, metin: metinler.get(x.ad)!, aktif: true })), sinir()),
    anlikGuncelle: (blok) => sirala(async () => {
      let mevcut: string;
      try { mevcut = await kaynak.oku(ANLIK_HAFIZA); }
      catch (err) {
        if (!(err instanceof MdHatasi) || err.kod !== "yok") throw err;
        await kaynak.yeni(ANLIK_HAFIZA, bolumuGuncelle(ANLIK_BASLANGICI, blok));
        await listeyiTazele();
        yay({ tur: "icerik", ad: ANLIK_HAFIZA });
        return true;
      }
      const yeni = bolumuGuncelle(mevcut, blok);
      if (yeni === mevcut) return false;
      await kaynak.yaz(ANLIK_HAFIZA, yeni);
      if (metinler.has(ANLIK_HAFIZA)) metinler.set(ANLIK_HAFIZA, yeni);
      await listeyiTazele();   // boyut / değişme zamanı listede güncel kalsın
      yay({ tur: "icerik", ad: ANLIK_HAFIZA });
      return true;
    }),
    dinle(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
    bitti: async () => { await kuyruk; },
  };
}

/** Hiçbir md kaynağı yokken: her işlem nedenle HATA verir (depo boş kalır, arayüz nedeni söyler; sessiz boş liste değil). */
export function calismayanKaynak(neden: string): MdKaynagi {
  const hata = async (): Promise<never> => { throw new MdHatasi("hata", neden); };
  return { liste: async () => [], oku: hata, yaz: hata, yeni: hata, aktifYap: hata };
}

/** Çalışma ortamına göre kaynak: Electron'da host dosyaları (IPC), değilse (`npm run dev`) localStorage; ikisi de yoksa nedenli çalışmayan kaynak. */
export function mdKaynaginiSec(): { kaynak: MdKaynagi; hata: string | null } {
  const k = kabukKoprusu();
  if (k?.mdListe && k.mdOku && k.mdYaz && k.mdYeni && k.mdAktif) return { kaynak: ipcKaynagi(k as MdKopruYuzu), hata: null };
  let depo: Depo | null = null;
  try { depo = globalThis.localStorage ?? null; } catch { depo = null; }
  if (!depo) { const neden = "md dosyaları için ne kabuk ne localStorage var"; return { kaynak: calismayanKaynak(neden), hata: neden }; }
  console.warn("[MD] kabuk yok (npm run dev): md dosyaları tarayıcı deposunda tutulur");
  return { kaynak: yerelKaynak(depo), hata: null };
}
