// uygulama/aktor/bilesenIslemleri.ts — AKTÖR BİLEŞEN DÜZENLEME İŞLEMLERİ (spec 45 B7; Unreal Details'in "Add Component" / attach). SAF: Babylon, DOM, dosya YOK.
//
// Details'in Bileşenler bölümü ve Nesneler panelinin "üst/soket ata" kutusu yazmayı BURADAN yapar: her işlem level tanımını DEĞİŞTİRMEZ, yeni tanım döndürür ve sonucu
// `levelTanimiDogrula`dan geçirir (bileşen şeması, tavan, yinelenen soket adı, hiyerarşi döngüsü/derinliği orada). Reddedilen işlem eski hâlde bırakır; neden kodludur (AKT-BIL-NNN).
// Hiçbir işlev fırlatmaz. Level'a yazma kapısı (`level.ayarla`) çağırandadır; bu dosya yalnız "yeni tanım ne olurdu" der.
"use strict";
import { grafAdiGecerli } from "../../protocol/graf.ts";
import { aktorBul, alanDegeriHatasi, type AlanDegeri, type Sonuc } from "../../world/level/cekirdek/bilesen.ts";
import { BILESEN_TAVANI, bilesenAlani, bilesenTuru, type BilesenKaydi } from "../../world/level/cekirdek/bilesenKaydi.ts";
import { levelTanimiDogrula, type LevelTanimi } from "../../world/level/cekirdek/levelTanimi.ts";
import { yeniIdler } from "../../world/level/cekirdek/kimlik.ts";
import { kodlu } from "../../world/level/cekirdek/aktorHatalari.ts";

const hata = (neden: string): { ok: false; neden: string } => ({ ok: false, neden });

/** Aktörün kaydını değiştirip tanımı doğrulatır (nesne/ışık aynı yol). `f` kaydın KOPYASINI alır. */
function aktoruDegistir(t: LevelTanimi, id: string, f: (a: Record<string, unknown>) => string | null): Sonuc<LevelTanimi> {
  const y = aktorBul(t, id);
  if (!y) return hata(kodlu("AKT-BIL-001", `aktör yok: ${id}`));
  const dizi: unknown[] = [...(y.tur === "nesne" ? t.nesneler ?? [] : t.isiklar ?? [])];
  const kayit: Record<string, unknown> = { ...(dizi[y.sira] as Record<string, unknown>) };
  const ret = f(kayit);
  if (ret) return hata(ret);
  dizi[y.sira] = kayit;
  const d = levelTanimiDogrula({ ...t, ...(y.tur === "nesne" ? { nesneler: dizi } : { isiklar: dizi }) });
  return d.ok ? { ok: true, deger: d.deger } : hata(kodlu("AKT-BIL-004", d.hata));
}

const bilesenleri = (a: Record<string, unknown>): BilesenKaydi[] => (Array.isArray(a["bilesenler"]) ? (a["bilesenler"] as BilesenKaydi[]).map((b) => structuredClone(b)) : []);
/** Boş liste = alan kalkar (eski biçime döner: bileşensiz aktör level dosyasında `bilesenler` taşımaz). */
function bilesenleriYaz(a: Record<string, unknown>, liste: BilesenKaydi[]): void { if (liste.length) a["bilesenler"] = liste; else delete a["bilesenler"]; }

/**
 * Aktöre `tur` türünde bileşen ekler (ayar şema varsayılanı; `soket` için benzersiz ad üretilir). Dönüş: yeni tanım + bileşen kimliği.
 * Bilinmeyen/rezerve tür ve tavan nedenle reddedilir.
 */
export function bilesenEkle(t: LevelTanimi, aktorId: string, tur: string): Sonuc<{ tanim: LevelTanimi; bilesenId: string }> {
  const bt = bilesenTuru(tur);
  if (!bt) return hata(kodlu("AKT-BIL-002", `bilinmeyen bileşen türü "${tur}"`));
  if (bt.rezerve) return hata(kodlu("AKT-BIL-002", bt.rezerve));
  let bilesenId = "";
  const r = aktoruDegistir(t, aktorId, (a) => {
    const liste = bilesenleri(a);
    if (liste.length >= BILESEN_TAVANI) return kodlu("AKT-BIL-004", `en çok ${BILESEN_TAVANI} bileşen (${liste.length} var)`);
    bilesenId = yeniIdler(liste.map((b) => b.id), 1, "b")[0]!;
    const kayit: BilesenKaydi = { id: bilesenId, tur };
    if (bt.zorunlu?.includes("ad")) {
      // Soket adı varsayılan olamaz (iki soket aynı adı almasın): `<tür>1, <tür>2…` ilk boş olan.
      const alinmis = new Set(liste.flatMap((b) => (b.tur === tur && typeof b.ayar?.["ad"] === "string" ? [b.ayar["ad"]] : [])));
      let n = 1; while (alinmis.has(`${tur}${n}`)) n++;
      kayit.ayar = { ad: `${tur}${n}` };
    }
    liste.push(kayit);
    bilesenleriYaz(a, liste);
    return null;
  });
  return r.ok ? { ok: true, deger: { tanim: r.deger, bilesenId } } : r;
}

/**
 * Hazır bileşen kayıtlarını (örn. `glbdenSablon`un ürettiği `soket`ler) aktöre ekler; kimlikler yeniden verilir. Aynı soket adı aktörde zaten varsa o kayıt ATLANIR ve `atlanan`da söylenir
 * (glb yeniden okunduğunda yinelenen soket hatası yerine idempotent). Tavan aşımı bütün işlemi reddeder (yarım ekleme yok).
 */
export function bilesenleriEkle(t: LevelTanimi, aktorId: string, yeni: readonly BilesenKaydi[]): Sonuc<{ tanim: LevelTanimi; eklenen: number; atlanan: string[] }> {
  const atlanan: string[] = [];
  let eklenen = 0;
  const r = aktoruDegistir(t, aktorId, (a) => {
    const liste = bilesenleri(a);
    const soketAdlari = new Set(liste.flatMap((b) => (b.tur === "soket" && typeof b.ayar?.["ad"] === "string" ? [b.ayar["ad"]] : [])));
    for (const k of yeni) {
      const soketAdi = k.tur === "soket" && typeof k.ayar?.["ad"] === "string" ? k.ayar["ad"] : null;
      if (soketAdi !== null) { if (soketAdlari.has(soketAdi)) { atlanan.push(soketAdi); continue; } soketAdlari.add(soketAdi); }
      if (liste.length >= BILESEN_TAVANI) return kodlu("AKT-BIL-004", `en çok ${BILESEN_TAVANI} bileşen (${liste.length} var, ${yeni.length - eklenen - atlanan.length} eklenemedi)`);
      liste.push({ ...structuredClone(k), id: yeniIdler(liste.map((b) => b.id), 1, "b")[0]! });
      eklenen++;
    }
    bilesenleriYaz(a, liste);
    return null;
  });
  return r.ok ? { ok: true, deger: { tanim: r.deger, eklenen, atlanan } } : r;
}

export function bilesenSil(t: LevelTanimi, aktorId: string, bilesenId: string): Sonuc<LevelTanimi> {
  return aktoruDegistir(t, aktorId, (a) => {
    const liste = bilesenleri(a);
    const kalan = liste.filter((b) => b.id !== bilesenId);
    if (kalan.length === liste.length) return kodlu("AKT-BIL-003", `'${bilesenId}' bileşeni ${aktorId} aktöründe yok`);
    bilesenleriYaz(a, kalan);
    return null;
  });
}

/** Bileşenin tek alanını yazar (şema doğrulaması + tanım doğrulaması); bileşenin görünen adı için `alan` = null kullanılmaz (`bilesenAdiYaz`). */
export function bilesenAyarYaz(t: LevelTanimi, aktorId: string, bilesenId: string, alan: string, deger: AlanDegeri): Sonuc<LevelTanimi> {
  return aktoruDegistir(t, aktorId, (a) => {
    const liste = bilesenleri(a);
    const b = liste.find((x) => x.id === bilesenId);
    if (!b) return kodlu("AKT-BIL-003", `'${bilesenId}' bileşeni ${aktorId} aktöründe yok`);
    const s = bilesenAlani(b.tur, alan);
    if (!s) return kodlu("AKT-BIL-004", `'${alan}' ${b.tur} bileşeninde yok`);
    const h = alanDegeriHatasi(s, deger);
    if (h) return kodlu("AKT-BIL-004", `${alan}: ${h}`);
    b.ayar = { ...b.ayar, [alan]: Array.isArray(deger) ? ([...deger] as [number, number, number]) : deger };
    bilesenleriYaz(a, liste);
    return null;
  });
}

/** Bileşenin görünen adı (boş = ad kalkar, türün etiketine döner). */
export function bilesenAdiYaz(t: LevelTanimi, aktorId: string, bilesenId: string, ad: string): Sonuc<LevelTanimi> {
  return aktoruDegistir(t, aktorId, (a) => {
    const liste = bilesenleri(a);
    const b = liste.find((x) => x.id === bilesenId);
    if (!b) return kodlu("AKT-BIL-003", `'${bilesenId}' bileşeni ${aktorId} aktöründe yok`);
    if (ad.trim()) b.ad = ad.trim(); else delete b.ad;
    bilesenleriYaz(a, liste);
    return null;
  });
}

/**
 * Aktörün üstünü ve soketini atar (`ust` null = bağı çöz, soket de kalkar). Döngü/derinlik/olmayan üst `levelTanimiDogrula`da.
 * Soket adı verilip `ust` yoksa tanım doğrulaması reddeder (soket için önce üst).
 */
export function ustAta(t: LevelTanimi, aktorId: string, ust: string | null, soket: string | null = null): Sonuc<LevelTanimi> {
  if (soket !== null && !grafAdiGecerli(soket)) return hata(kodlu("AKT-BIL-004", "soket adı geçerli olmalı (harf, rakam, _ ve -)"));
  return aktoruDegistir(t, aktorId, (a) => {
    if (ust === null) { delete a["ust"]; delete a["soket"]; return null; }
    a["ust"] = ust;
    if (soket === null) delete a["soket"]; else a["soket"] = soket;
    return null;
  });
}
