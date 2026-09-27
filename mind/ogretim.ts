// mind/ogretim.ts — ÖĞRETİM: Ozyn'in düzeltmeleri karar kaydından kural hafızasına.
//
// Toplantı 2026-09-27:
//   K1 — öğretmen Ozyn. Bir kapı kararını "doğru" ya da "yanlış" diye işaretler;
//        işaret kayda bir öğretim satırı olarak yazılır.
//   K5 — kural hafızası ayrı bir dosyada durmaz: açılışta öğretim satırları
//        sırayla oynatılarak yeniden kurulur. Hafıza öğretimin saf fonksiyonudur;
//        brain-lab'deki defter ilkesiyle aynı (doğum + defter = canlı beyin).
//
// Bekçi (K5): öğretim satırı YAZILIRKEN kayıtta var olan, öğrenilebilir bir algıya
// bağlanır (`ogretimKur`). Satır kendi başına yeter (algının durum kodunu taşır):
// algı satırının dosyası sonradan silinse bile hafıza aynı kurulur.
//
// Bağımlılık: mind/kararKaydi.ts (tipler), mind/kuralHafizasi.ts. Dosya yok.
"use strict";
import type { AlgiSatiri, KararSatiri, OgretimSatiri } from "./kararKaydi.ts";
import { KuralHafizasi, type KapiYonu, type KuralHafizasiAyari } from "./kuralHafizasi.ts";

/** Öğretimin hafızadaki kanıt kimliği: hangi oturumun hangi algısı. */
export function deneyimKimligi(s: Pick<OgretimSatiri, "hedef">): string {
  return `${s.hedef.o}/${s.hedef.id}`;
}

/**
 * Bir öğretim SATIRININ kimliği. Aynı satır iki yoldan gelebilir (açılışta
 * kayıttan okunan ve dosya izleyicisinden gelen); ikinci kez uygulanmamalı.
 * Aynı algının farklı zamanda yeniden öğretilmesi ise ayrı bir satırdır.
 */
export function ogretimAnahtari(s: OgretimSatiri): string {
  return `${s.o}|${s.t}|${s.hedef.o}|${s.hedef.id}|${s.yon}`;
}

/**
 * Bir algı için öğretim satırı kurar. Algı öğrenilebilir değilse (durum kodu
 * yok: kararı ezilemez bir içgüdü verdi) hata döner — güvenlik içgüdüsü
 * öğretilemez.
 */
export function ogretimKur(algi: AlgiSatiri, yon: KapiYonu, oturum: string, t: number): OgretimSatiri | { hata: string } {
  if (!algi.isaret || algi.isaret.length === 0) {
    return { hata: `${algi.o}/${algi.id} öğrenilebilir değil: kararı ezilemez bir içgüdü verdi (${algi.kapi.kural})` };
  }
  return { tur: "ogretim", o: oturum, t, hedef: { o: algi.o, id: algi.id }, yon, kaynak: "ozyn", isaret: [...algi.isaret] };
}

export interface YenidenKurulum {
  hafiza: KuralHafizasi;
  /** Uygulanan öğretim sayısı. */
  uygulanan: number;
  /** Uygulanamayan satırlar ve sebepleri (bozuk ya da boş kodlu). */
  atlanan: { satir: unknown; sebep: string }[];
}

function gecerliMi(s: unknown): s is OgretimSatiri {
  const o = s as Partial<OgretimSatiri> | null;
  return !!o && o.tur === "ogretim"
    && (o.yon === "uyan" || o.yon === "sus")
    && !!o.hedef && typeof o.hedef.o === "string" && typeof o.hedef.id === "string"
    && Array.isArray(o.isaret) && o.isaret.every((x) => typeof x === "string")
    && typeof o.t === "number";
}

/**
 * Kural hafızasını öğretim satırlarından yeniden kurar. Sıra zamana göredir;
 * eşit zamanda kayıttaki sıra korunur (kararlı sıralama) — aynı kayıt, aynı hafıza.
 */
export function kuralHafizasiKur(satirlar: readonly (KararSatiri | unknown)[], ayar?: KuralHafizasiAyari): YenidenKurulum {
  const hafiza = new KuralHafizasi(ayar);
  const atlanan: YenidenKurulum["atlanan"] = [];
  const ogretimler: OgretimSatiri[] = [];
  for (const s of satirlar) {
    if ((s as { tur?: unknown })?.tur !== "ogretim") continue;
    if (!gecerliMi(s)) { atlanan.push({ satir: s, sebep: "bozuk öğretim satırı" }); continue; }
    if (s.isaret.length === 0) { atlanan.push({ satir: s, sebep: "boş durum kodu" }); continue; }
    ogretimler.push(s);
  }
  const sirali = ogretimler.map((s, i) => ({ s, i })).sort((a, b) => a.s.t - b.s.t || a.i - b.i);
  for (const { s } of sirali) hafiza.ogren(s.isaret, s.yon, deneyimKimligi(s));
  return { hafiza, uygulanan: sirali.length, atlanan };
}
