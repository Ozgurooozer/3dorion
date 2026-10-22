// uygulama/sekans/editor/ayrintiAlanlari.ts — AYRINTILAR PANELİNİN MODELİ (spec 36 S2): seçili öğenin (anahtar, bölüm, iz, bağlama; seçim yoksa sekansın
// kendisi) düzenlenebilir alanları ve yazılanın uygulanması. SAF.
//
// Her alan anlamını ve birimini SÖYLER (kullanıcı kuralı: arayüz anlaşılır olmalı — "kare 45 = 1,5 sn", "°", "m"). Sayı kutusu graf editörünün kuralıyla
// (`uygulama/duzenleyici/sayiAlani.ts`): `Number`, ASLA eval — "1+1" REDDEDİLİR; Türkçe virgül kabul; kare alanları tamsayı. Değer, biçimin aralığında
// değilse yazılmaz (nedeni döner). Uygulama `sekansIslemleri.ts` üzerinden: kilitli iz ve çakışma kuralları orada.
"use strict";
import { KANALLAR, KLIP_SINIRLARI, UZUVLAR, YUMUSATMALAR, otelemeMi, type Kanal, type Uzuv, type Yumusatma } from "../../../protocol/animasyon.ts";
import type { Sonuc } from "../../../protocol/dogrula.ts";
import { BEN, SEKANS_SINIRLARI, type Sekans } from "../../../protocol/sekans.ts";
import { sayiMetniCoz, type SayiKurali } from "../../duzenleyici/sayiAlani.ts";
import { aciklamaAyarla, anahtarAyarla, aralikAyarla, baglamaAjani, bolumDuzenle, izBayrak, izUzuvKanal, sureAyarla } from "./sekansIslemleri.ts";
import type { Secim } from "./sekansOturumu.ts";
import { sureYazisi } from "./zamanEkseni.ts";

export interface AyrintiAlani {
  ad: string;
  etiket: string;
  tur: "sayi" | "secim" | "metin" | "bool";
  deger: string | boolean;
  secenekler?: readonly string[];
  /** Sayı alanının kuralı (aralık, tamsayı). */
  kural?: SayiKurali;
  /** Kutunun yanında: birim ve anlamı ("kare · 1,5 sn", "° (+ öne)"). */
  ipucu: string;
}

export interface Ayrinti { baslik: string; alanlar: AyrintiAlani[]; bilgi: string[] }

export interface AyrintiOrtami { klipler: readonly string[]; ajanlar: readonly string[]; klipKaresi(ad: string): number | null }

const kareAlani = (ad: string, etiket: string, k: number, en: number, cok: number, ek = ""): AyrintiAlani =>
  ({ ad, etiket, tur: "sayi", deger: String(k), kural: { tamsayi: true, en, cok }, ipucu: `kare (30 = 1 sn) · şimdi ${sureYazisi(k)}${ek}` });

export function ayrintiAlanlari(s: Sekans, secim: Secim, o: AyrintiOrtami): Ayrinti {
  if (secim.tur === "anahtar" && secim.refs.length === 1) {
    const r = secim.refs[0]!;
    const iz = s.izler.find((x) => x.id === r.iz);
    const a = iz?.tur === "uzuv" ? iz.anahtarlar.find((x) => x.kare === r.kare) : undefined;
    if (iz?.tur === "uzuv" && a) {
      const ot = otelemeMi(iz.kanal), sinir = ot ? KLIP_SINIRLARI.oteleme : KLIP_SINIRLARI.donme;
      return {
        baslik: `Anahtar · ${iz.uzuv}.${iz.kanal}`,
        alanlar: [
          kareAlani("kare", "kare", a.kare, 0, s.sure_kare),
          { ad: "deger", etiket: "değer", tur: "sayi", deger: String(a.deger), kural: { en: -sinir, cok: sinir }, ipucu: ot ? `metre (±${sinir})` : `derece (±${sinir}; ${kanalAnlami(iz.kanal)})` },
          { ad: "yumusatma", etiket: "geçiş", tur: "secim", deger: a.yumusatma, secenekler: YUMUSATMALAR, ipucu: "bu anahtardan SONRAKİNE: dogrusal sabit hız · yumusak yavaş başla/bitir · basamak sıçra" },
        ],
        bilgi: [`iz '${iz.id}'${iz.kilitli ? " · 🔒 kilitli (değiştirilemez)" : ""}`],
      };
    }
  }
  if (secim.tur === "anahtar") {
    return { baslik: `${secim.refs.length} anahtar seçili`, alanlar: [{ ad: "yumusatma_hepsi", etiket: "geçiş (hepsi)", tur: "secim", deger: "", secenekler: ["", ...YUMUSATMALAR], ipucu: "seçili bütün anahtarların geçişi" }],
      bilgi: ["Sürükle: hepsi birlikte kayar (Shift: tek eksen). Delete: hepsini sil."] };
  }
  if (secim.tur === "bolum") {
    const iz = s.izler.find((x) => x.id === secim.iz);
    const b = iz?.tur === "klip" ? iz.bolumler[secim.i] : undefined;
    if (b) {
      const kk = o.klipKaresi(b.klip);
      return {
        baslik: `Klip bölümü · ${b.klip}`,
        alanlar: [
          { ad: "klip", etiket: "klip", tur: "secim", deger: b.klip, secenekler: o.klipler.includes(b.klip) ? o.klipler : [b.klip, ...o.klipler], ipucu: "assets/animasyon/ klibi" },
          kareAlani("baslangic_kare", "başlangıç", b.baslangic_kare, 0, s.sure_kare - 1),
          kareAlani("uzunluk_kare", "uzunluk", b.uzunluk_kare, 1, s.sure_kare, kk !== null && b.uzunluk_kare > kk + b.ofset_kare ? " · klipten uzun: son değerinde durur" : ""),
          kareAlani("ofset_kare", "klip içi başlangıç", b.ofset_kare, 0, SEKANS_SINIRLARI.ofset_kare, " · kırpılan baş"),
        ],
        bilgi: [kk === null ? `✗ '${b.klip}' kütüphanede YOK: bu sekans oynatılamaz` : `klibin süresi: ${kk} kare (${sureYazisi(kk)})`],
      };
    }
  }
  if (secim.tur === "iz") {
    const iz = s.izler.find((x) => x.id === secim.iz);
    if (iz) {
      const bayraklar: AyrintiAlani[] = [
        { ad: "gizli", etiket: "gizli", tur: "bool", deger: iz.gizli, ipucu: "gizli iz oynatılmaz ve değerlendirilmez (mute)" },
        { ad: "kilitli", etiket: "kilitli", tur: "bool", deger: iz.kilitli, ipucu: "kilitli iz değiştirilemez" },
      ];
      if (iz.tur === "uzuv") return {
        baslik: `Uzuv izi · ${iz.id}`,
        alanlar: [
          { ad: "uzuv", etiket: "uzuv", tur: "secim", deger: iz.uzuv, secenekler: UZUVLAR, ipucu: "soyut uzuv (gövdeye eşleme: world/avatar/uzuvEslemesi.ts)" },
          { ad: "kanal", etiket: "kanal", tur: "secim", deger: iz.kanal, secenekler: iz.uzuv === "kok" ? KANALLAR : KANALLAR.filter((k) => !otelemeMi(k)), ipucu: kanalAnlami(iz.kanal) },
          ...bayraklar,
        ],
        bilgi: [`${iz.anahtarlar.length} anahtar · K: playhead'e anahtar ekle`],
      };
      return { baslik: `Klip izi · ${iz.id}`, alanlar: bayraklar, bilgi: [`${iz.bolumler.length} bölüm · satıra çift tık: playhead'e klip ekle`] };
    }
  }
  if (secim.tur === "baglama") {
    const b = s.baglamalar.find((x) => x.id === secim.id);
    if (b) return {
      baslik: `Bağlama · ${b.id}`,
      alanlar: [{ ad: "ajan", etiket: "ajan", tur: "secim", deger: b.ajan, secenekler: [...new Set([...o.ajanlar, BEN, b.ajan])], ipucu: "bu bağlamanın izlerini oynayacak ajan (izler kimliğe bağlı: ajan değişse de izler kalır)" }],
      bilgi: [`${s.izler.filter((x) => x.baglama === b.id).length} iz · ${BEN}: sekansı oynatan ajan (editörden ▶'de çözülemez)`],
    };
  }
  return {
    baslik: `Sekans · ${s.ad}`,
    alanlar: [
      { ad: "aciklama", etiket: "açıklama", tur: "metin", deger: s.aciklama ?? "", ipucu: `en çok ${SEKANS_SINIRLARI.aciklama} karakter` },
      kareAlani("sure_kare", "süre", s.sure_kare, 1, SEKANS_SINIRLARI.sure_kare, ` · en çok ${SEKANS_SINIRLARI.sure_kare} (60 sn)`),
      kareAlani("aralik_bas", "▶ başı (yeşil)", s.aralik.bas, 0, s.sure_kare - 1),
      kareAlani("aralik_bit", "▶ sonu (kırmızı)", s.aralik.bit, 1, s.sure_kare),
    ],
    bilgi: [`30 kare/sn · ${s.baglamalar.length} bağlama · ${s.izler.length} iz`],
  };
}

function kanalAnlami(k: Kanal): string {
  return ({ donme_x: "+ öne eğilir", donme_y: "+ sağa döner", donme_z: "+ sağ taraf kalkar", oteleme_x: "+ sağa (m)", oteleme_y: "+ yukarı (m)", oteleme_z: "+ öne (m)" } as const)[k];
}

/** Yazılanı uygular. Sayı alanı eval ETMEZ ("1+1" hatadır). Sonuç yeni sekans ve (kare değiştiyse) yeni seçim. */
export function ayrintiUygula(s: Sekans, secim: Secim, a: AyrintiAlani, ham: string | boolean): Sonuc<{ sekans: Sekans; secim?: Secim }> {
  let sayi: number | undefined;
  if (a.tur === "sayi") {
    const r = sayiMetniCoz(a.etiket, String(ham), a.kural);
    if (!r.ok) return r;
    if (r.deger === undefined) return { ok: false, hata: `${a.etiket}: boş bırakılamaz` };
    sayi = r.deger;
  }
  if (a.tur === "secim" && a.secenekler && !a.secenekler.includes(String(ham))) return { ok: false, hata: `${a.etiket}: '${String(ham)}' geçersiz (seçenekler: ${a.secenekler.join(", ")})` };
  const sar = (r: Sonuc<Sekans>, yeni?: Secim): Sonuc<{ sekans: Sekans; secim?: Secim }> => (r.ok ? { ok: true, deger: { sekans: r.deger, ...(yeni ? { secim: yeni } : {}) } } : r);
  if (secim.tur === "anahtar" && secim.refs.length === 1) {
    const alan = a.ad === "kare" ? { kare: sayi! } : a.ad === "deger" ? { deger: sayi! } : { yumusatma: ham as Yumusatma };
    const r = anahtarAyarla(s, secim.refs[0]!, alan);
    return r.ok ? { ok: true, deger: { sekans: r.deger.sekans, secim: { tur: "anahtar", refs: [r.deger.ref] } } } : r;
  }
  if (secim.tur === "anahtar") {
    if (!ham) return { ok: false, hata: "bir geçiş seç" };
    let x: Sonuc<Sekans> = { ok: true, deger: s };
    for (const r of secim.refs) { const y = anahtarAyarla(x.deger, r, { yumusatma: ham as Yumusatma }); if (!y.ok) return y; x = { ok: true, deger: y.deger.sekans }; }
    return sar(x);
  }
  if (secim.tur === "bolum") {
    return sar(bolumDuzenle(s, secim.iz, secim.i, (b) => (a.ad === "klip" ? { ...b, klip: String(ham) } : { ...b, [a.ad]: sayi! })));
  }
  if (secim.tur === "iz") {
    if (a.ad === "gizli" || a.ad === "kilitli") return sar(izBayrak(s, secim.iz, a.ad, ham === true));
    const iz = s.izler.find((x) => x.id === secim.iz);
    if (iz?.tur !== "uzuv") return { ok: false, hata: "uzuv izi değil" };
    return sar(izUzuvKanal(s, secim.iz, a.ad === "uzuv" ? (ham as Uzuv) : iz.uzuv, a.ad === "kanal" ? (ham as Kanal) : iz.kanal));
  }
  if (secim.tur === "baglama") return sar(baglamaAjani(s, secim.id, String(ham)));
  if (a.ad === "aciklama") return sar(aciklamaAyarla(s, String(ham)));
  if (a.ad === "sure_kare") return sar(sureAyarla(s, sayi!));
  return sar(aralikAyarla(s, a.ad === "aralik_bas" ? sayi! : s.aralik.bas, a.ad === "aralik_bit" ? sayi! : s.aralik.bit));
}
