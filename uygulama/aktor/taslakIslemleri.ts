// uygulama/aktor/taslakIslemleri.ts — ORION TASLAĞINI OKU / ONAYLA / REDDET (spec 45 B8). Host erişimi ENJEKTE edilir (`TaslakDosyalari`): bu dosya DOM'suz, IPC'siz, test edilebilir.
// Onay diske yazar → çağıran panel bunu YALNIZ gerçek tıklamayla (`isTrusted`) çağırır; bu dosya o kuralı bilmez ama kendiliğinden hiçbir yerden çağrılmaz (bekçi: `taslakBekcisi.test.ts`).
// Onay ATOMİK davranır: önce graflar (`grafYeni` var olanın üstüne yazmaz), en son şablon; biri yazılamazsa o ana kadar yazılan graflar SİLİNİR (yarım taslak kalmaz).
"use strict";
import type { Graf } from "../../protocol/graf.ts";
import { kodlu } from "../../world/level/cekirdek/aktorHatalari.ts";
import { TASLAK_KLASORU, TASLAK_UZANTISI, taslakCoz, type Taslak, type TaslakSonucu } from "./taslakKapisi.ts";

export type HostSonucu<T> = { ok: true; deger: T } | { ok: false; kod: string; mesaj: string };

export interface TaslakDosyalari {
  /** `Content` altındaki bütün dosya adresleri (içerik gezgini listesi); taslaklar buradan süzülür. */
  adresler(): Promise<HostSonucu<string[]>>;
  oku(adres: string): Promise<HostSonucu<string>>;
  /** Taslağı `.silinenler`e taşır (geri alınabilir silme). */
  sil(adres: string): Promise<HostSonucu<string>>;
  sablonYaz(ad: string, metin: string): Promise<HostSonucu<string>>;
  grafYeni(ad: string, metin: string): Promise<HostSonucu<true>>;
  grafSil(ad: string): Promise<HostSonucu<true>>;
}

const adres = (ad: string): string => `${TASLAK_KLASORU}${ad}${TASLAK_UZANTISI}`;
const hostHatasi = (kod: "AKT-TSL-004" | "AKT-TSL-005", ne: string, r: { kod: string; mesaj: string }): { ok: false; neden: string } =>
  ({ ok: false, neden: kodlu(kod, `${ne}: host ${r.kod}: ${r.mesaj}`) });
/** Host çağrısı patlarsa kodlu nedene çevirir (IPC kopması gibi). */
async function guvenli<T>(kod: "AKT-TSL-004" | "AKT-TSL-005", ne: string, f: () => Promise<HostSonucu<T>>): Promise<TaslakSonucu<T>> {
  try {
    const r = await f();
    return r.ok ? { ok: true, deger: r.deger } : hostHatasi(kod, ne, r);
  } catch (e) { return { ok: false, neden: kodlu(kod, `${ne}: çağrı patladı: ${e instanceof Error ? e.message : String(e)}`) }; }
}

/** Taslak dosyasını okur ve kapıdan geçirir (bozuksa nedenle ret). */
export async function taslakOku(d: TaslakDosyalari, ad: string): Promise<TaslakSonucu<Taslak>> {
  const r = await guvenli("AKT-TSL-004", `taslak okunamadı (${ad})`, () => d.oku(adres(ad)));
  if (!r.ok) return r;
  const t = taslakCoz(r.deger);
  if (t.ok && t.deger.ad !== ad) return { ok: false, neden: kodlu("AKT-TSL-001", `dosya adı (${ad}) taslağın adıyla (${t.deger.ad}) aynı olmalı`) };
  return t;
}

/** Onay: graflar sonra şablon yazılır; hata olursa yazılan graflar geri alınır. Başarıda taslak dosyası silinir (silinememesi onayı bozmaz, `uyari` döner). */
export async function taslakOnayla(d: TaslakDosyalari, t: Taslak): Promise<TaslakSonucu<{ yazilan: string[]; uyari: string | null }>> {
  const yazilan: string[] = [];
  const geriAl = async (): Promise<void> => { for (const g of yazilan.splice(0).reverse()) { try { await d.grafSil(g); } catch { /* geri alma en iyi çaba */ } } };
  for (const g of t.graflar as readonly Graf[]) {
    const r = await guvenli("AKT-TSL-005", `graf yazılamadı (${g.ad})`, () => d.grafYeni(g.ad, JSON.stringify(g, null, 2)));
    if (!r.ok) { await geriAl(); return r; }
    yazilan.push(g.ad);
  }
  const s = await guvenli("AKT-TSL-005", `şablon yazılamadı (${t.ad})`, () => d.sablonYaz(t.ad, JSON.stringify(t.sablon, null, 2)));
  if (!s.ok) { await geriAl(); return s; }
  const sil = await guvenli("AKT-TSL-004", `onaylanan taslak silinemedi (${t.ad})`, () => d.sil(adres(t.ad)));
  return { ok: true, deger: { yazilan: [...yazilan.map((g) => `Content/Graphs/${g}.json`), s.deger], uyari: sil.ok ? null : sil.neden } };
}

/** Red: yalnız taslak dosyası silinir; başka hiçbir şeye dokunulmaz. */
export async function taslakReddet(d: TaslakDosyalari, ad: string): Promise<TaslakSonucu<string>> {
  return guvenli("AKT-TSL-004", `taslak silinemedi (${ad})`, () => d.sil(adres(ad)));
}
