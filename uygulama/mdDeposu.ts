// uygulama/mdDeposu.ts — ORION'UN MD DOSYALARI DEPOSU (Yapı çubuğu · Hafıza sekmesi, spec 32): host'taki dosyaların renderer tarafı önbelleği + bağlam kurucu.
//
// Üç iş: (1) liste/oku/yaz/yeni/aktif işlemlerini tek yerden sunar (arayüz ve düzenleyici buradan konuşur); (2) AKTİF dosyaların metnini bellekte tutar ki köprü
// talimatı SENKRON kurabilsin (`baglam()`); (3) anlık hafıza dosyasının otomatik bölümünü güncel tutar (`anlikGuncelle`).
// Kaynak iki türlü: Electron'da host dosyaları (IPC), `npm run dev`'de localStorage (dosya yok; kalıcı ama tarayıcıya bağlı). Arayüz farkı bilmez.
// Bütün yazan işlemler SIRAYLA çalışır (okuma-değiştirme-yazma yarışmasın); hata fırlatır (arayüz altyazıyla söyler), sessiz yutulmaz.
// Kaynakların ve sıranın gövdesi ortak çekirdekte (`dosyaDeposu.ts`): düğüm grafikleri (spec 35) aynısını kullanır; burada md'ye özgü olan (aktif/pasif, bağlam).
"use strict";
import type { MdBilgisi } from "../host/mdDosyalari.js";
import type { MdSonuc } from "../host/kopru.ts";
import { ANLIK_HAFIZA, MD_SINIRLARI, mdAdiGecerli, mdBaglaminiKur, type MdBaglami, type MdSinirlari } from "../mind/mdBaglami.ts";
import { bolumuGuncelle, kaydetBirlestir } from "../mind/anlikHafiza.ts";
import type { Depo } from "./yerlestirmeKaydi.ts";
import { kabukKoprusu } from "./kabuk.ts";
import { ipcAc } from "./ipcSonuc.ts";
import { DosyaHatasi, calismayanDosyaKaynagi, ipcDosyaKaynagi, isSirasi, tarayiciDeposu, yerelDosyaKaynagi, type DosyaKaynagi } from "./dosyaDeposu.ts";

export type { MdBilgisi };

/** md işlemi hatası: `kod` host'un kodudur (yok | var | gecersiz-ad | gecersiz-icerik | cok-buyuk | bozuk-ayar | hata). */
export class MdHatasi extends DosyaHatasi {
  constructor(kod: string, mesaj: string) { super(kod, mesaj); this.name = "MdHatasi"; }
}
const mdHatasi = (kod: string, mesaj: string): Error => new MdHatasi(kod, mesaj);

export interface MdKaynagi extends DosyaKaynagi<MdBilgisi> {
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
const ac = <T>(s: MdSonuc<T>): T => ipcAc(s, mdHatasi);
export function ipcKaynagi(k: MdKopruYuzu): MdKaynagi {
  return {
    ...ipcDosyaKaynagi<MdBilgisi>({ liste: () => k.mdListe(), oku: (ad) => k.mdOku(ad), yaz: (ad, metin) => k.mdYaz(ad, metin), yeni: (ad, metin) => k.mdYeni(ad, metin) }, mdHatasi),
    aktifYap: async (ad, aktif) => { ac(await k.mdAktif(ad, aktif)); },
  };
}

// ── localStorage kaynağı (Electron'suz geliştirme): ortak yerel kaynak + md'nin `aktif` bayrağı ──
export const YEREL_MD_ANAHTARI = "orion.md.v1";

export function yerelKaynak(depo: Depo, simdi: () => number = Date.now): MdKaynagi {
  const k = yerelDosyaKaynagi<{ aktif: boolean }>(depo, {
    anahtar: YEREL_MD_ANAHTARI, adGecerli: mdAdiGecerli, hata: mdHatasi, etiket: "md dosyası", adEtiketi: "md adı",
    yeniEk: (ad) => ({ aktif: ad === ANLIK_HAFIZA }), ekAl: (x) => ({ aktif: x.aktif }),
  }, simdi);
  return {
    async liste() {
      return (await k.liste()).map((x) => ({ ...x, sistem: x.ad === ANLIK_HAFIZA }))
        .sort((a, b) => Number(b.sistem) - Number(a.sistem) || a.ad.localeCompare(b.ad, "tr"));
    },
    oku: (ad) => k.oku(ad),
    yaz: (ad, metin) => k.yaz(ad, metin),
    yeni: (ad, metin) => k.yeni(ad, metin),
    aktifYap: (ad, aktif) => k.ekGuncelle(ad, { aktif }),
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
  const sira = isSirasi();
  const sirala = <T>(is: () => Promise<T>): Promise<T> => sira.sirala(is);
  const yay = (o: MdOlayi) => { for (const f of [...dinleyiciler]) f(o); };

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
    bitti: () => sira.bitti(),
  };
}

/** Hiçbir md kaynağı yokken: her işlem nedenle HATA verir (depo boş kalır, arayüz nedeni söyler; sessiz boş liste değil). */
export function calismayanKaynak(neden: string): MdKaynagi {
  return { ...calismayanDosyaKaynagi(neden, mdHatasi), aktifYap: async (): Promise<never> => { throw new MdHatasi("hata", neden); } };
}

/** Çalışma ortamına göre kaynak: Electron'da host dosyaları (IPC), değilse (`npm run dev`) localStorage; ikisi de yoksa nedenli çalışmayan kaynak. */
export function mdKaynaginiSec(): { kaynak: MdKaynagi; hata: string | null } {
  const k = kabukKoprusu();
  if (k?.mdListe && k.mdOku && k.mdYaz && k.mdYeni && k.mdAktif) return { kaynak: ipcKaynagi(k as MdKopruYuzu), hata: null };
  const depo = tarayiciDeposu();
  if (!depo) { const neden = "md dosyaları için ne kabuk ne localStorage var"; return { kaynak: calismayanKaynak(neden), hata: neden }; }
  console.warn("[MD] kabuk yok (npm run dev): md dosyaları tarayıcı deposunda tutulur");
  return { kaynak: yerelKaynak(depo), hata: null };
}
