// uygulama/dogruDosyaDeposu.ts — DOĞRULANAN KAYIT DEPOSU: ortak çekirdek (spec 35 dilim 3'te grafik deposundan genelleştirildi). SAF (kaynak dışarıdan).
//
// İki kullanıcısı var: düğüm grafikleri (`graf/grafDeposu.ts`) ve NPC kayıtları (`graf/npcDeposu.ts`). Dosya kaynağı (`dosyaDeposu.ts`: IPC / localStorage /
// çalışmayan kaynak, iş sırası) ortaktı; bu dosya onun ÜSTÜNDEKİ kuralları ortaklar — ikinci depo kendi kopyasını yazsaydı "bozuk dosya listeden düşmez"
// ya da "ad = dosya adı" kuralı orada sessizce ayrışırdı (CLAUDE.md "kopya kod: kural değil bekçi"):
//   • YAZMADAN ÖNCE doğrula (`coz`: JSON + biçim): bozuk metin diske GİTMEZ, hata metni düzenleyicide görünür.
//   • Dosyanın adı kaydın ADIDIR: içerikteki `ad` dosya adından farklıysa kaydedilmez (başka adla kayıt = ＋ Yeni).
//   • Kanonik metin: kaydedilen metin temiz kopyanın okunur biçimidir (`metin`).
//   • Bellek önbelleği: başlangıçta hepsi okunur, her yazımdan sonra liste tazelenir. Bozuk dosya listeden DÜŞMEZ: hatasıyla görünür (sessiz kayıp yok),
//     ama `al` onu vermez (çalıştırılamaz/dinlenemez).
// Türe özgü olan kullanıcıda: grafiğin desen kuralları (yeniden adlandırma, kullananlar), NPC'nin alanları (`ek`).
"use strict";
import type { Sonuc } from "../protocol/dogrula.ts";
import { DosyaHatasi, isSirasi, type DosyaBilgisi, type DosyaKaynagi } from "./dosyaDeposu.ts";

/** Listedeki satır: dosya bilgisi + okunabildiyse türe özgü alanlar (`E`), bozuksa nedeni. */
export type DogruKayit<E> = { ad: string; hata: string | null; boyut: number; degisti: number } & E;

export type DepoOlayi = { tur: "liste" } | { tur: "icerik"; ad: string };

export interface DogruDepoAyari<T, E> {
  kaynak: DosyaKaynagi;
  /** Metin → temiz kopya (JSON + biçim hatası nedenle; "JSON okunamadı: …", "biçim: …"). */
  coz(metin: string): Sonuc<T>;
  adi(t: T): string;
  /** Diske yazılan kanonik metin. */
  metin(t: T): string;
  /** Listeye girecek türe özgü alanlar; içerik çözülemediyse null ile çağrılır. */
  ek(t: T | null): E;
  adGecerli(ad: string): boolean;
  /** Hata metinlerinde: "grafik" → "geçersiz grafik adı"; `adinSozu` "grafın adı" → "grafın adı ('x') dosyanın adıyla ('y') aynı olmalı". */
  etiket: string;
  adinSozu: string;
  /** Konsol öneki ("[graf]"). */
  gunluk: string;
}

export interface DogruDepo<T, E> {
  /** Listeyi ve bütün kayıtları yükler. Liste alınamazsa fırlatır. */
  baslat(): Promise<void>;
  liste(): readonly DogruKayit<E>[];
  /** Geçerli kayıt (bozuksa ya da yoksa null). */
  al(ad: string): T | null;
  /** Geçerli kayıtların hepsi (önbellek). */
  gecerliler(): T[];
  /** Diskten taze metin (düzenleyici). */
  oku(ad: string): Promise<string>;
  /** Doğrulayıp kaydeder; diske yazılan kanonik metni döner. Biçim hatası, ad uyuşmazlığı fırlatır (diske gitmez). */
  yaz(ad: string, metin: string): Promise<string>;
  /** Yeni kayıt (adı kaydın adı; varsa hata). */
  yeni(t: T): Promise<void>;
  /** KALDIRIR (host'ta `.silinenler/`e taşınır, kalıcı silme değil). Kaynak kaldırmayı bilmiyorsa nedenli hata. */
  sil(ad: string): Promise<void>;
  dinle(f: (o: DepoOlayi) => void): () => void;
  bitti(): Promise<void>;
  /** Türe özgü işlemler için (grafiğin yeniden adlandırması): aynı iş sırası, aynı doğrulama, tazeleme, önbellekten düşürme. */
  readonly ic: {
    sirala<R>(is: () => Promise<R>): Promise<R>;
    dogrula(ad: string, metin: string): T;
    tazele(): Promise<void>;
    unut(ad: string): void;
  };
}

export function dogruDepoKur<T, E>(a: DogruDepoAyari<T, E>): DogruDepo<T, E> {
  const { kaynak } = a;
  let liste: DogruKayit<E>[] = [];
  const onbellek = new Map<string, T>();
  const dinleyiciler = new Set<(o: DepoOlayi) => void>();
  const sira = isSirasi();
  const yay = (o: DepoOlayi) => { for (const f of [...dinleyiciler]) { try { f(o); } catch (err) { console.error(`${a.gunluk} depo dinleyicisi hatası:`, err); } } };
  const adHatasi = (ad: string) => new DosyaHatasi("gecersiz-ad", `geçersiz ${a.etiket} adı: ${JSON.stringify(ad)}`);

  /** Bir dosyayı oku ve önbelleğe al; kaydı döner (hatalıysa nedeniyle). */
  async function yukle(d: DosyaBilgisi): Promise<DogruKayit<E>> {
    const temel = { ad: d.ad, boyut: d.boyut, degisti: d.degisti };
    let metin: string;
    try { metin = await kaynak.oku(d.ad); }
    catch (err) { onbellek.delete(d.ad); return { ...temel, ...a.ek(null), hata: `okunamadı: ${err instanceof Error ? err.message : String(err)}` }; }
    const r = a.coz(metin);
    if (!r.ok) { onbellek.delete(d.ad); return { ...temel, ...a.ek(null), hata: r.hata }; }
    if (a.adi(r.deger) !== d.ad) { onbellek.delete(d.ad); return { ...temel, ...a.ek(r.deger), hata: `içerikteki ad '${a.adi(r.deger)}' dosya adıyla aynı değil` }; }
    onbellek.set(d.ad, r.deger);
    return { ...temel, ...a.ek(r.deger), hata: null };
  }

  async function tazele(): Promise<void> {
    const dosyalar = await kaynak.liste();
    const kayitlar = await Promise.all(dosyalar.map(yukle));
    const adlar = new Set(dosyalar.map((d) => d.ad));
    for (const ad of [...onbellek.keys()]) if (!adlar.has(ad)) onbellek.delete(ad);
    liste = kayitlar.sort((x, y) => x.ad.localeCompare(y.ad, "tr"));
    yay({ tur: "liste" });
  }

  function dogrula(ad: string, metin: string): T {
    if (!a.adGecerli(ad)) throw adHatasi(ad);
    const r = a.coz(metin);
    if (!r.ok) throw new DosyaHatasi("gecersiz-icerik", r.hata);
    if (a.adi(r.deger) !== ad) throw new DosyaHatasi("gecersiz-icerik", `${a.adinSozu} ('${a.adi(r.deger)}') dosyanın adıyla ('${ad}') aynı olmalı: başka adla kaydetmek için ＋ Yeni`);
    return r.deger;
  }

  return {
    baslat: () => sira.sirala(tazele),
    liste: () => liste,
    al: (ad) => onbellek.get(ad) ?? null,
    gecerliler: () => [...onbellek.values()],
    oku: (ad) => kaynak.oku(ad),
    yaz: (ad, metin) => sira.sirala(async () => {
      const yazilan = a.metin(dogrula(ad, metin));
      await kaynak.yaz(ad, yazilan);
      await tazele();
      yay({ tur: "icerik", ad });
      return yazilan;
    }),
    yeni: (t) => sira.sirala(async () => {
      const ad = a.adi(t);
      const yazilan = a.metin(dogrula(ad, JSON.stringify(t)));
      await kaynak.yeni(ad, yazilan);
      await tazele();
    }),
    sil: (ad) => sira.sirala(async () => {
      if (!a.adGecerli(ad)) throw adHatasi(ad);
      if (!kaynak.sil) throw new DosyaHatasi("hata", "bu kaynakta silme yok");
      await kaynak.sil(ad);
      onbellek.delete(ad);
      await tazele();
    }),
    dinle(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
    bitti: () => sira.bitti(),
    ic: { sirala: (is) => sira.sirala(is), dogrula, tazele, unut: (ad) => { onbellek.delete(ad); } },
  };
}
