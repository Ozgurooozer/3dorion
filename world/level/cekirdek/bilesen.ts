// world/level/cekirdek/bilesen.ts — AKTÖR BİLEŞEN ŞEMASI (spec 43 A1; Unreal Component + Details). SAF: Babylon ve DOM yok.
//
// Bir aktörün (level nesnesi ya da ışığı) düzenlenebilir alanları BİR KEZ, burada şemayla söylenir: ad, etiket, tür, varsayılan, aralık. Details paneli bu şemadan çizilir,
// graf düğümleri (`aktor.oku/yaz`) aynı şemadan okur/yazar, doğrulama aynı şemadan yapılır — alan başına üç ayrı yerde üç ayrı kural olmasın.
// Şema bir GÖRÜNÜMDÜR: level dosyasının biçimi değişmez (`nesneler`/`isiklar` olduğu gibi kalır; eski level bire bir aynı). Alan yoksa/şemada yoksa nedenli hata, sessiz düzeltme yok.
//
// İşlemler tanımı DEĞİŞTİRMEZ, yenisini döner (yazma sonucu `levelTanimiDogrula`dan geçer: tavan, renk, kimlik kuralları aynı). Hiçbiri fırlatmaz.
"use strict";
import { AKTOR_DEGISKEN_SINIRI, levelTanimiDogrula, type AktorDegiskeni, type IsikAktoru, type LevelTanimi, type NesneYeri, type Vec3 } from "./levelTanimi.ts";
import { grafAdiGecerli } from "../../../protocol/graf.ts";
import { donusVec, olcekVec } from "./donusum.ts";
import { alanDegeriHatasi, type AlanDegeri, type AlanSemasi, type AlanTipi } from "./alanSemasi.ts";
import { ISIK_ALANLARI } from "./bilesenKaydi.ts";

// Alan şeması tipleri ve değer denetimi `alanSemasi.ts`te (tanım doğrulaması da kullanır: import döngüsü olmasın); burada aynı adlarla yeniden dışa verilir.
export { alanDegeriHatasi };
export type { AlanDegeri, AlanSemasi, AlanTipi };
export type AktorTuru = "isik" | "nesne";

export interface BilesenSemasi {
  tur: AktorTuru;
  etiket: string;
  alanlar: readonly AlanSemasi[];
}

export const ISIK_BILESENI: BilesenSemasi = { tur: "isik", etiket: "Nokta ışık", alanlar: ISIK_ALANLARI };

export const NESNE_BILESENI: BilesenSemasi = {
  tur: "nesne", etiket: "Nesne",
  alanlar: [
    { ad: "konum", etiket: "Konum", tip: "vec3", varsayilan: [0, 0, 0], adim: 0.1, birim: "m" },
    { ad: "donus", etiket: "Dönüş", tip: "vec3", varsayilan: [0, 0, 0], adim: 5, birim: "°" },
    { ad: "olcek", etiket: "Ölçek", tip: "vec3", varsayilan: [1, 1, 1], en: 0.01, adim: 0.05 },
    { ad: "gizli", etiket: "Gizli", tip: "bool", varsayilan: false, grafta: true },
    { ad: "kilitli", etiket: "Kilitli", tip: "bool", varsayilan: false },
  ],
};

export const BILESEN_SEMALARI: Readonly<Record<AktorTuru, BilesenSemasi>> = { isik: ISIK_BILESENI, nesne: NESNE_BILESENI };

export type Sonuc<T> = { ok: true; deger: T } | { ok: false; neden: string };
const hata = (neden: string): { ok: false; neden: string } => ({ ok: false, neden });

/** Aktörün tanımdaki yeri: tür ve dizideki sıra. Kimlik hem nesne hem ışık için tektir (`levelTanimiDogrula`). */
export function aktorBul(t: LevelTanimi, id: string): { tur: AktorTuru; sira: number } | null {
  const n = (t.nesneler ?? []).findIndex((x) => x.id === id);
  if (n >= 0) return { tur: "nesne", sira: n };
  const i = (t.isiklar ?? []).findIndex((x) => x.id === id);
  return i >= 0 ? { tur: "isik", sira: i } : null;
}

/** Tanımdaki bütün aktör kimlikleri (nesneler önce, sonra ışıklar). Kimliği olmayan atlanır (`levelKur` doldurur). */
export function aktorKimlikleri(t: LevelTanimi): string[] {
  return [...(t.nesneler ?? []).map((n) => n.id), ...(t.isiklar ?? []).map((i) => i.id)].filter((x): x is string => typeof x === "string");
}

/** Şemadaki alan; yoksa null. */
export const alanSemasi = (tur: AktorTuru, ad: string): AlanSemasi | null => BILESEN_SEMALARI[tur].alanlar.find((a) => a.ad === ad) ?? null;

/** Alanın değeri tanımdan (eksik isteğe bağlı alan = şemanın varsayılanı; nesnenin sayı dönüş/ölçeği vec3'e açılır). */
function ham(tur: AktorTuru, veri: IsikAktoru | NesneYeri, ad: string): AlanDegeri | undefined {
  if (tur === "nesne") {
    const n = veri as NesneYeri;
    if (ad === "donus") return donusVec(n.donus);
    if (ad === "olcek") return olcekVec(n.olcek);
  }
  const v: unknown = Object.entries(veri).find(([k]) => k === ad)?.[1];
  return v as AlanDegeri | undefined;
}

export function alanOku(t: LevelTanimi, id: string, ad: string): Sonuc<AlanDegeri> {
  const y = aktorBul(t, id);
  if (!y) return hata(`aktör yok: ${id}`);
  const s = alanSemasi(y.tur, ad);
  if (!s) return hata(`'${ad}' ${BILESEN_SEMALARI[y.tur].etiket} bileşeninde yok (alanlar: ${BILESEN_SEMALARI[y.tur].alanlar.map((a) => a.ad).join(", ")})`);
  const veri = y.tur === "nesne" ? t.nesneler![y.sira]! : t.isiklar![y.sira]!;
  return { ok: true, deger: ham(y.tur, veri, ad) ?? s.varsayilan };
}

const dogrula = (t: unknown): Sonuc<LevelTanimi> => { const d = levelTanimiDogrula(t); return d.ok ? { ok: true, deger: d.deger } : hata(d.hata); };

/** Alanı yazar (şema + tanım doğrulaması); kaynak tanım bozulmaz. */
export function alanYaz(t: LevelTanimi, id: string, ad: string, deger: unknown): Sonuc<LevelTanimi> {
  const y = aktorBul(t, id);
  if (!y) return hata(`aktör yok: ${id}`);
  const s = alanSemasi(y.tur, ad);
  if (!s) return hata(`'${ad}' ${BILESEN_SEMALARI[y.tur].etiket} bileşeninde yok (alanlar: ${BILESEN_SEMALARI[y.tur].alanlar.map((a) => a.ad).join(", ")})`);
  const h = alanDegeriHatasi(s, deger);
  if (h) return hata(h);
  const yazilacak = Array.isArray(deger) ? [...deger] : deger;
  if (y.tur === "nesne") {
    const l = [...(t.nesneler ?? [])];
    l[y.sira] = { ...l[y.sira]!, [ad]: yazilacak } as NesneYeri;
    return dogrula({ ...t, nesneler: l });
  }
  const l = [...(t.isiklar ?? [])];
  l[y.sira] = { ...l[y.sira]!, [ad]: yazilacak } as IsikAktoru;
  return dogrula({ ...t, isiklar: l });
}

function aktoruDegistir(t: LevelTanimi, id: string, f: (a: Record<string, unknown>) => Record<string, unknown>): Sonuc<LevelTanimi> {
  const y = aktorBul(t, id);
  if (!y) return hata(`aktör yok: ${id}`);
  if (y.tur === "nesne") {
    // Yeni kayıt `dogrula`dan (levelTanimiDogrula: unknown alır) geçmeden tipli sayılmaz: bu yüzden dizi `unknown[]`.
    const l: unknown[] = [...(t.nesneler ?? [])];
    l[y.sira] = f({ ...t.nesneler![y.sira]! });
    return dogrula({ ...t, nesneler: l });
  }
  const l: unknown[] = [...(t.isiklar ?? [])];
  l[y.sira] = f({ ...t.isiklar![y.sira]! });
  return dogrula({ ...t, isiklar: l });
}

/** Aktörün grafını atar (null = kaldır; alan silinir, eski biçime döner). Grafın depoda olması çalışma anında denetlenir. */
export function grafAta(t: LevelTanimi, id: string, graf: string | null): Sonuc<LevelTanimi> {
  if (graf !== null && !grafAdiGecerli(graf)) return hata("geçerli graf adı olmalı (harf, rakam, _ ve -)");
  return aktoruDegistir(t, id, (a) => { if (graf === null) delete a["graf"]; else a["graf"] = graf; return a; });
}

export function degiskenOku(t: LevelTanimi, id: string, ad: string): Sonuc<AktorDegiskeni | undefined> {
  const y = aktorBul(t, id);
  if (!y) return hata(`aktör yok: ${id}`);
  const veri = y.tur === "nesne" ? t.nesneler![y.sira]! : t.isiklar![y.sira]!;
  return { ok: true, deger: veri.degiskenler?.[ad] };
}

/** Değişken yazar (`undefined` = sil; hiç kalmayınca alan kalkar). Ad, tür ve tavan kuralları tanım doğrulamasında. */
export function degiskenYaz(t: LevelTanimi, id: string, ad: string, deger: AktorDegiskeni | undefined): Sonuc<LevelTanimi> {
  if (!grafAdiGecerli(ad)) return hata("değişken adı geçersiz (harf, rakam, _ ve -)");
  return aktoruDegistir(t, id, (a) => {
    const d: Record<string, AktorDegiskeni> = { ...(a["degiskenler"] as Record<string, AktorDegiskeni> | undefined) };
    if (deger === undefined) delete d[ad]; else d[ad] = deger;
    if (Object.keys(d).length) a["degiskenler"] = d; else delete a["degiskenler"];
    return a;
  });
}

/** Tavan: eklenebilecek değişken sayısı (Details'te "+ değişken" pasifliği için). */
export const degiskenSayisiDoluMu = (t: LevelTanimi, id: string): boolean => {
  const y = aktorBul(t, id);
  if (!y) return true;
  const veri = y.tur === "nesne" ? t.nesneler![y.sira]! : t.isiklar![y.sira]!;
  return Object.keys(veri.degiskenler ?? {}).length >= AKTOR_DEGISKEN_SINIRI.adet;
};
