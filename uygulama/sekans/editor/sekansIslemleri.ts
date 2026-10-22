// uygulama/sekans/editor/sekansIslemleri.ts — SEKANS ÜZERİNDE DÜZENLEME İŞLEMLERİ (spec 36 S2): iz/anahtar/bölüm/bağlama/süre. SAF ve DEĞİŞTİRİLEMEZ.
//
// Her işlem YENİ bir sekans döner (eski dokunulmaz: geri al yığını görüntüleri tutar) ve sonucu `sekansDogrula`dan geçer — editör biçimin dışına çıkamaz
// (çakışan bölüm, sınır dışı kare, tavan aşımı nedenle reddedilir, sessizce düzeltilmez). Reddin metni Ozyn'e gösterilir.
// KİLİTLİ İZ (🔒) değişmez: kilidi açmak dışında her işlem nedenle reddedilir.
"use strict";
import { KLIP_SINIRLARI, otelemeMi, type Kanal, type Uzuv, type Yumusatma } from "../../../protocol/animasyon.ts";
import type { Sonuc } from "../../../protocol/dogrula.ts";
import { sekansDogrula, type KlipBolumu, type Sekans, type SekansIzi } from "../../../protocol/sekans.ts";
import { uzuvIziDegeri } from "../degerlendir.ts";
import type { AnahtarRef } from "./izDuzeni.ts";

const hata = (m: string): { ok: false; hata: string } => ({ ok: false, hata: m });
const bitir = (s: Sekans): Sonuc<Sekans> => sekansDogrula(s);
const kopya = (s: Sekans): Sekans => structuredClone(s);

/** Okunur, tekil kimlik: `taban`, `taban_2`, … (en çok 32 karakter). */
function tekilKimlik(var_: readonly string[], taban: string): string {
  const t = taban.slice(0, 28);
  if (!var_.includes(t)) return t;
  for (let i = 2; ; i++) if (!var_.includes(`${t}_${i}`)) return `${t}_${i}`;
}

function izDegistir(s: Sekans, id: string, f: (iz: SekansIzi) => SekansIzi | string, kilitSerbest = false): Sonuc<Sekans> {
  const iz = s.izler.find((x) => x.id === id);
  if (!iz) return hata(`iz yok: '${id}'`);
  if (iz.kilitli && !kilitSerbest) return hata(`'${id}' izi kilitli (🔒): önce kilidi aç`);
  const y = f(structuredClone(iz));
  if (typeof y === "string") return hata(y);
  return bitir({ ...kopya(s), izler: s.izler.map((x) => (x.id === id ? y : structuredClone(x))) });
}

// ── izler ──

export function uzuvIziEkle(s: Sekans, baglama: string, uzuv: Uzuv, kanal: Kanal): Sonuc<{ sekans: Sekans; iz: string }> {
  const id = tekilKimlik(s.izler.map((x) => x.id), `${uzuv}_${kanal.replace("donme_", "d").replace("oteleme_", "o")}`);
  const r = bitir({ ...kopya(s), izler: [...kopya(s).izler, { id, baglama, tur: "uzuv", gizli: false, kilitli: false, uzuv, kanal, anahtarlar: [] }] });
  return r.ok ? { ok: true, deger: { sekans: r.deger, iz: id } } : r;
}

export function klipIziEkle(s: Sekans, baglama: string): Sonuc<{ sekans: Sekans; iz: string }> {
  const id = tekilKimlik(s.izler.map((x) => x.id), "klip");
  const r = bitir({ ...kopya(s), izler: [...kopya(s).izler, { id, baglama, tur: "klip", gizli: false, kilitli: false, bolumler: [] }] });
  return r.ok ? { ok: true, deger: { sekans: r.deger, iz: id } } : r;
}

export function izSil(s: Sekans, id: string): Sonuc<Sekans> {
  const iz = s.izler.find((x) => x.id === id);
  if (!iz) return hata(`iz yok: '${id}'`);
  if (iz.kilitli) return hata(`'${id}' izi kilitli (🔒): önce kilidi aç`);
  return bitir({ ...kopya(s), izler: kopya(s).izler.filter((x) => x.id !== id) });
}

/** Gizle (değerlendirilmez) / kilitle (değişmez). Kilit kendisi kilitliyken de açılabilir. */
export const izBayrak = (s: Sekans, id: string, bayrak: "gizli" | "kilitli", deger: boolean): Sonuc<Sekans> =>
  izDegistir(s, id, (iz) => ({ ...iz, [bayrak]: deger }), bayrak === "kilitli");

export const izUzuvKanal = (s: Sekans, id: string, uzuv: Uzuv, kanal: Kanal): Sonuc<Sekans> =>
  izDegistir(s, id, (iz) => (iz.tur !== "uzuv" ? "klip izinin uzvu yok" : { ...iz, uzuv, kanal }));

// ── anahtarlar ──

/** Karede anahtar: varsa değeri güncellenir; yoksa eklenir. `deger` verilmezse izin O KAREDEKİ değeri (eğri değişmez, yalnız nokta eklenir). */
export function anahtarEkle(s: Sekans, izId: string, kare: number, deger?: number): Sonuc<Sekans> {
  return izDegistir(s, izId, (iz) => {
    if (iz.tur !== "uzuv") return "anahtar yalnız uzuv izine eklenir (klip izine bölüm eklenir)";
    const d = deger ?? uzuvIziDegeri(iz, kare) ?? 0;
    const var_ = iz.anahtarlar.find((a) => a.kare === kare);
    const anahtarlar = var_ ? iz.anahtarlar.map((a) => (a.kare === kare ? { ...a, deger: d } : a))
      : [...iz.anahtarlar, { kare, deger: d, yumusatma: "dogrusal" as Yumusatma }].sort((a, b) => a.kare - b.kare);
    return { ...iz, anahtarlar };
  });
}

export function anahtarlariSil(s: Sekans, refs: readonly AnahtarRef[]): Sonuc<Sekans> {
  if (!refs.length) return hata("seçili anahtar yok");
  let x: Sonuc<Sekans> = { ok: true, deger: s };
  for (const id of new Set(refs.map((r) => r.iz))) {
    const kareler = new Set(refs.filter((r) => r.iz === id).map((r) => r.kare));
    x = izDegistir(x.deger, id, (iz) => (iz.tur !== "uzuv" ? "uzuv izi değil" : { ...iz, anahtarlar: iz.anahtarlar.filter((a) => !kareler.has(a.kare)) }));
    if (!x.ok) return x;
  }
  return x;
}

/**
 * Seçili anahtarları `dk` kare ve `dd` değer kaydırır (sürükleme; her iz kendi içinde). Değer kanalın tavanına KISILIR (sürüklerken sınıra dayanır);
 * kare sınır dışına çıkıyorsa ya da seçili olmayan bir anahtarın üstüne düşüyorsa nedenle reddedilir (sürükleme son geçerli yerde kalır).
 */
export function anahtarlariTasi(s: Sekans, refs: readonly AnahtarRef[], dk: number, dd: number): Sonuc<{ sekans: Sekans; refs: AnahtarRef[] }> {
  if (!refs.length) return hata("seçili anahtar yok");
  let x: Sonuc<Sekans> = { ok: true, deger: s };
  for (const id of new Set(refs.map((r) => r.iz))) {
    const secili = new Set(refs.filter((r) => r.iz === id).map((r) => r.kare));
    x = izDegistir(x.deger, id, (iz) => {
      if (iz.tur !== "uzuv") return "uzuv izi değil";
      const sinir = otelemeMi(iz.kanal) ? KLIP_SINIRLARI.oteleme : KLIP_SINIRLARI.donme;
      const yeni = iz.anahtarlar.map((a) => (secili.has(a.kare) ? { ...a, kare: a.kare + dk, deger: Math.max(-sinir, Math.min(sinir, a.deger + dd)) } : a));
      if (yeni.some((a) => a.kare < 0 || a.kare > s.sure_kare)) return `anahtar sekansın dışına çıkar (0–${s.sure_kare})`;
      const kareler = yeni.map((a) => a.kare);
      if (new Set(kareler).size !== kareler.length) return "anahtar başka bir anahtarın üstüne düşer";
      return { ...iz, anahtarlar: yeni.sort((a, b) => a.kare - b.kare) };
    });
    if (!x.ok) return x;
  }
  return { ok: true, deger: { sekans: x.deger, refs: refs.map((r) => ({ iz: r.iz, kare: r.kare + dk })) } };
}

/** Tek anahtarın alanları (Ayrıntılar): kare, değer, yumuşatma. Değer/kare aralık dışıysa biçim reddeder. */
export function anahtarAyarla(s: Sekans, ref: AnahtarRef, alan: { kare?: number; deger?: number; yumusatma?: Yumusatma }): Sonuc<{ sekans: Sekans; ref: AnahtarRef }> {
  const r = izDegistir(s, ref.iz, (iz) => {
    if (iz.tur !== "uzuv") return "uzuv izi değil";
    if (!iz.anahtarlar.some((a) => a.kare === ref.kare)) return `karede anahtar yok: ${ref.kare}`;
    if (alan.kare !== undefined && alan.kare !== ref.kare && iz.anahtarlar.some((a) => a.kare === alan.kare)) return `kare ${alan.kare}'de zaten anahtar var`;
    return { ...iz, anahtarlar: iz.anahtarlar.map((a) => (a.kare === ref.kare ? { ...a, ...alan } : a)).sort((a, b) => a.kare - b.kare) };
  });
  return r.ok ? { ok: true, deger: { sekans: r.deger, ref: { iz: ref.iz, kare: alan.kare ?? ref.kare } } } : r;
}

// ── klip bölümleri ──

/** `kare`den başlayan bölüm; uzunluk klibin süresi (sekansın sonuna sığmazsa kısaltılır). Çakışma nedenle reddedilir. */
export function bolumEkle(s: Sekans, izId: string, klip: string, kare: number, uzunluk: number): Sonuc<Sekans> {
  return izDegistir(s, izId, (iz) => {
    if (iz.tur !== "klip") return "bölüm yalnız klip izine eklenir";
    const u = Math.min(uzunluk, s.sure_kare - kare);
    if (u < 1) return "sekansın sonunda bölüme yer yok";
    return { ...iz, bolumler: [...iz.bolumler, { klip, baslangic_kare: kare, uzunluk_kare: u, ofset_kare: 0 }] };
  });
}

/** Bölümün alanlarını değiştirir (Ayrıntılar ve sürüklemenin ortak yolu). Bölümler sıralı ve ayrık kalır; sıra değişmez (çakışmadan geçilemez). */
export const bolumDuzenle = (s: Sekans, izId: string, i: number, f: (b: KlipBolumu) => KlipBolumu): Sonuc<Sekans> =>
  izDegistir(s, izId, (iz) => (iz.tur !== "klip" ? "klip izi değil" : !iz.bolumler[i] ? `bölüm yok: ${i}` : { ...iz, bolumler: iz.bolumler.map((b, j) => (j === i ? f(b) : b)) }));

/** Taşı: başlangıç `dk` kare (0'ın altına inmez). */
export const bolumTasi = (s: Sekans, izId: string, i: number, dk: number): Sonuc<Sekans> =>
  bolumDuzenle(s, izId, i, (b) => ({ ...b, baslangic_kare: Math.max(0, b.baslangic_kare + dk) }));

/** Sağ kenar: uzat/kısalt (en az 1 kare). Klibin süresinden uzun bölümde döngüsüz klip son değerinde durur. */
export const bolumUzat = (s: Sekans, izId: string, i: number, dk: number): Sonuc<Sekans> =>
  bolumDuzenle(s, izId, i, (b) => ({ ...b, uzunluk_kare: Math.max(1, b.uzunluk_kare + dk) }));

/** Sol kenar: KIRP — başlangıç, uzunluk ve klip içi ofset birlikte kayar (klibin içeriği zamanda yerinde kalır). Ofset 0'ın altına inmez, uzunluk 1'in. */
export const bolumKirp = (s: Sekans, izId: string, i: number, dk: number): Sonuc<Sekans> =>
  bolumDuzenle(s, izId, i, (b) => {
    const d = Math.max(-b.ofset_kare, Math.min(b.uzunluk_kare - 1, dk));
    return { ...b, baslangic_kare: b.baslangic_kare + d, uzunluk_kare: b.uzunluk_kare - d, ofset_kare: b.ofset_kare + d };
  });

export const bolumSil = (s: Sekans, izId: string, i: number): Sonuc<Sekans> =>
  izDegistir(s, izId, (iz) => (iz.tur !== "klip" ? "klip izi değil" : !iz.bolumler[i] ? `bölüm yok: ${i}` : { ...iz, bolumler: iz.bolumler.filter((_, j) => j !== i) }));

// ── sekans, aralık, bağlamalar ──

/** Süre: anahtar ya da bölüm yeni sürenin dışında kalacaksa nedenle reddedilir (sessiz kırpma yok); aralığın sonu süreye kısılır. */
export function sureAyarla(s: Sekans, kare: number): Sonuc<Sekans> {
  let enSon = 0;
  for (const iz of s.izler) {
    if (iz.tur === "uzuv") for (const a of iz.anahtarlar) enSon = Math.max(enSon, a.kare);
    else for (const b of iz.bolumler) enSon = Math.max(enSon, b.baslangic_kare + b.uzunluk_kare);
  }
  if (kare < enSon) return hata(`süre ${kare} kare olamaz: kare ${enSon}'e dek anahtar/bölüm var (önce onları taşı ya da sil)`);
  const bit = Math.min(s.aralik.bit === s.sure_kare ? kare : s.aralik.bit, kare);
  return bitir({ ...kopya(s), sure_kare: kare, aralik: { bas: Math.min(s.aralik.bas, bit - 1), bit } });
}

export const aralikAyarla = (s: Sekans, bas: number, bit: number): Sonuc<Sekans> => bitir({ ...kopya(s), aralik: { bas, bit } });

export function aciklamaAyarla(s: Sekans, metin: string): Sonuc<Sekans> {
  const { aciklama: _eski, ...geri } = kopya(s);
  return bitir(metin ? { ...geri, aciklama: metin } : geri);
}

export function baglamaEkle(s: Sekans, ajan: string): Sonuc<{ sekans: Sekans; id: string }> {
  const id = tekilKimlik(s.baglamalar.map((b) => b.id), `b${s.baglamalar.length + 1}`);
  const r = bitir({ ...kopya(s), baglamalar: [...kopya(s).baglamalar, { id, ajan }] });
  return r.ok ? { ok: true, deger: { sekans: r.deger, id } } : r;
}

/** Bağlamayı İZLERİYLE kaldırır (izsiz bağlama anlamsız; kaç izin gittiği söylenir). Kilitli izi olan bağlama silinmez. */
export function baglamaSil(s: Sekans, id: string): Sonuc<{ sekans: Sekans; iz: number }> {
  if (!s.baglamalar.some((b) => b.id === id)) return hata(`bağlama yok: '${id}'`);
  const izler = s.izler.filter((x) => x.baglama === id);
  if (izler.some((x) => x.kilitli)) return hata(`'${id}' bağlamasında kilitli iz var (🔒): önce kilidi aç`);
  const r = bitir({ ...kopya(s), baglamalar: kopya(s).baglamalar.filter((b) => b.id !== id), izler: kopya(s).izler.filter((x) => x.baglama !== id) });
  return r.ok ? { ok: true, deger: { sekans: r.deger, iz: izler.length } } : r;
}

export const baglamaAjani = (s: Sekans, id: string, ajan: string): Sonuc<Sekans> =>
  bitir({ ...kopya(s), baglamalar: s.baglamalar.map((b) => (b.id === id ? { id, ajan } : { ...b })) });
