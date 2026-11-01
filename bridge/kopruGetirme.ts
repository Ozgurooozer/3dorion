// bridge/kopruGetirme.ts — Bir düşünme turunun HAFIZA GETİRMESİ (kopru.ts `_turGirdisi`'nden ayrıldı, kalite turu 2026-11-02; mantık ve sıra AYNI).
// Üç yol: temiz sohbet (bağlama hiçbir şey girmez), yönlendirici (spec 16: yalnız istenen girer), eski ilgi getirmesi. Köprü durumunu DEĞİŞTİRMEZ; yalnız uyanış satırının
// `sohbetKipi`/`hafizaIstegi` alanlarını doldurur (öncekiyle aynı). Giriş/çıkış dar bir yüzdür: köprünün özel alanları dışarı çıkmaz.
"use strict";
import type { UyanisBilgisi } from "../mind/kararKaydi.ts";
import type { GetirSonucu, Hafiza } from "../mind/hafiza.ts";
import type { DurumDefteri } from "../mind/durumDefteri.ts";
import { yonlendir, type CekmeceIstegi } from "../mind/hafizaYonlendirici.ts";
import type { SohbetKipi } from "../mind/sohbetKipi.ts";
import type { BeyinGirdisi } from "./beyin.ts";
import type { KopruAyari } from "./kopruTurleri.ts";

/** Getirmenin köprüden gördüğü yüz (salt okunur). */
export interface GetirmeBaglami {
  readonly ayar: KopruAyari;
  readonly hafiza: Hafiza;
  readonly durum: DurumDefteri;
  readonly sohbetKipi: SohbetKipi;
  yakinPencere(simdi: number): BeyinGirdisi["gecmis"];
}

/** Turun getirmeye girdileri (köprü `_turGirdisi` başında toplar). */
export interface TurGetirmeGirdisi {
  istekler: string[];
  icerikler: string[];
  terminal: "basarili" | "hatali" | undefined;
  niyetHatasi: boolean;
  simdiMs: number;
  adet: number;
}

/** Yönlendiricinin istediği çekmecelerden anılar; aynı anı iki istekten gelirse bir kez. */
export function istenenAnilar(hafiza: Hafiza, istekler: readonly CekmeceIstegi[], haric: string[], icerikler: string[]): GetirSonucu[] {
  const sonuc: GetirSonucu[] = [];
  const gorulen = new Set<string>();
  for (const i of istekler) {
    const r = i.mod === "son"
      ? hafiza.sonlar(i.cekmeceler, i.adet, haric)
      : (icerikler.length ? hafiza.getir(icerikler.join(" "), i.adet, haric, i.cekmeceler) : []);
    for (const x of r) if (!gorulen.has(x.ani.metin)) { gorulen.add(x.ani.metin); sonuc.push(x); }
  }
  return sonuc;
}

/** Turun anıları ve durum satırları. Temiz sohbette ikisi de boş; yönlendiricide yalnız istenenler; yoksa eski ilgi getirmesi. */
export function turAnilariniGetir(g: GetirmeBaglami, tur: TurGetirmeGirdisi, uyanis: UyanisBilgisi): { getirilen: GetirSonucu[]; durumSatirlari: string[] } {
  let getirilen: GetirSonucu[];
  let durumSatirlari: string[] = [];
  if (g.sohbetKipi === "temiz") {
    // TEMİZ SOHBET (spec 16 F5b): hafıza ve durum defteri bağlama girmez — hangi hafıza kipi olursa.
    getirilen = [];
    uyanis.sohbetKipi = "temiz";
  } else if (g.ayar.hafizaKipi === "yonlendirici") {
    // SPEC 16: bağlama yalnız İSTENEN girer. Yönlendirici sözden karar verir; varsayılan boş.
    const istek = yonlendir({
      sozler: tur.istekler,
      ...(tur.terminal ? { terminal: tur.terminal } : {}),
      niyetHatasi: tur.niyetHatasi,
      yerAdlari: g.ayar.yerAdlari?.() ?? [],
    });
    uyanis.hafizaIstegi = istek.kurallar;
    // Yakın pencerede ZATEN görünen sözler çekmeceden tekrar gelmez: "ne konuşmuştuk" pencerenin
    // ÖNCESİNİ getirmeli (baglamdene 1. koşu: pencerenin kendisini tekrar getirdi, eski bilgi dışarıda kaldı).
    const penceredeki = g.yakinPencere(tur.simdiMs).map((g) => g.metin).filter(Boolean);
    getirilen = istenenAnilar(g.hafiza, istek.cekmece, [...tur.icerikler, ...penceredeki], tur.icerikler);
    durumSatirlari = g.durum.satirlar(istek.durum);
    if (istek.kurallar.length) console.log(`[HAFIZA] istek: ${istek.kurallar.join(", ")} · durum ${durumSatirlari.length} satır · anı ${getirilen.length}`);
  } else {
    getirilen = tur.adet > 0 && tur.icerikler.length
      // Bu turun içerikleri hafızaya az önce yazıldı; anı olarak geri
      // gelmeleri "hatırlamak" değil kendini tekrar etmektir.
      ? g.hafiza.getir(tur.icerikler.join(" "), tur.adet, tur.icerikler)
      : [];
  }
  return { getirilen, durumSatirlari };
}
