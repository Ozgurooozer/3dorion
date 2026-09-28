// mind/durumKodu.ts — DURUM KODU: bir algıyı öğrenen kapının okuyacağı işaretlere çevirir.
//
// Doğuştandır ve öğrenmeyle değişmez: sinekte koku alıcıları gibi. Öğrenilen
// şey hangi işaret kümesinin hangi karara götürdüğüdür (mind/kuralHafizasi.ts);
// işaretlerin kendisi değil. Öğrenen kapı bir algıyı YALNIZCA bu kodla görür.
//
// İşaret = "ad:değer" biçiminde kısa bir dizgi. Kümedir: sıra ve tekrar yok.
//   tur:<algı türü>          her algıda
//   icgudu:<kimlik>          kapıda kararı veren içgüdü (mind/icgudu.ts). Öğrenilen
//                            kural çoğu zaman bir içgüdünün İSTİSNASIDIR; hangi
//                            içgüdünün istisnası olduğu kodun içinde durmalı.
//   kod:yok|0|hata, kod=<n>  terminal: çıkış kodu
//   kesik                    terminal: çıktı kesildi
//   komut:<ad>, komut:<ad> <alt>   terminal: çıktıyı üreten son komut (istemden)
//   olay:<ad>, kaynak:<k>, yuzey:<y>, mesafe:yakin|orta|uzak   olay
//   durum:<d>, niyet_kaynagi:<önek>   sonuç: niyeti kim verdi (n = LLM, elle, ajanda…)
//   k:<kelime>               metnin içerik kelimeleri (en çok KELIME_SINIRI)
//   ozyn:yakin|orta|uzak, ozyn:bakiyor, ozyn_yuzey:<y>   BAĞLAM: algı anında Ozyn nerede,
//                            Orion'a bakıyor mu, hangi yüzeyde çalışıyor (toplantı 2026-09-27 K4)
//
// NEDEN BAĞLAM: aynı hata çıktısı, Ozyn ekranın başındayken ve odanın öbür
// ucundayken farklı değerde olabilir. T0c'de hakemlerin kararını bağlam çevirdi.
// Olayın kendi ayrıntısındaki `mesafe:` ile karışmasın diye önek `ozyn`.
//
// NEDEN niyet_kaynagi: gerçek kayıtta (2026-09-27) elle verilen `kalk`
// niyetlerinin hatası LLM'i üç kez uyandırdı; LLM o niyetleri hiç vermemişti.
// "Hatayı kim yaptı" kapının göremediği ama bilmesi gereken bir şey.
//
// Konuşma ve bakış cevabı kodlanmaz: onları güvenlik içgüdüleri her zaman
// geçirir, öğrenen kapı ezemez (icgudu.ts `ezilebilir: false`).
//
// Bağımlılık: protocol/ ve mind/icgudu.ts. Saf fonksiyon.
"use strict";
import type { Algi } from "../protocol/algi.ts";
import type { IcguduKimligi } from "./icgudu.ts";

/** Bir algıdan alınan en çok içerik kelimesi. */
export const KELIME_SINIRI = 16;

/**
 * Anlam taşımayan sık kelimeler. Kısa tutuldu: amaç gürültüyü azaltmak, dili
 * modellemek değil. Terminal çıktısı çoğunlukla İngilizce, niyet notları Türkçe.
 */
const DOLGU = new Set([
  "the", "and", "for", "with", "from", "this", "that", "are", "was", "were", "you", "your", "not", "but", "has",
  "have", "had", "its", "into", "than", "then", "there", "their", "them", "will", "would", "can", "all", "any",
  "bir", "ve", "ile", "için", "bu", "şu", "da", "de", "ki", "mi", "ne", "gibi", "daha", "çok", "var", "yok",
]);

/**
 * Ayıklamanın ayarı. Varsayılanlar kapının durum kodu içindir ve DEĞİŞMEZ: değişirse
 * öğrenilmiş kuralların işaretleri kayar. Başka bir tüketici (spec 10 söz anahtarı)
 * ikinci bir ayıklayıcı yazmak yerine ayarı verir.
 */
export interface KelimeAyari {
  /** En kısa kelime (harf). Varsayılan 3: terminal çıktısındaki "ok", "ab" gibi kırıntılar atılsın. */
  enKisa?: number;
  /** En çok kaç kelime. Varsayılan KELIME_SINIRI. */
  sinir?: number;
}

/**
 * Metnin içerik kelimeleri: küçük harf, harf dizileri, 3–24 karakter, dolgu atılır, tekrar
 * yok, ilk KELIME_SINIRI tanesi. En kısa uzunluk ve sınır `ayar`la değişir; gerisi değişmez.
 */
export function kelimeler(metin: string, ayar: KelimeAyari = {}): string[] {
  const enKisa = ayar.enKisa ?? 3;
  const sinir = ayar.sinir ?? KELIME_SINIRI;
  const out: string[] = [];
  const gorulen = new Set<string>();
  for (const m of metin.toLocaleLowerCase("tr-TR").matchAll(/\p{L}+/gu)) {
    const w = m[0];
    if (w.length < enKisa || w.length > 24 || DOLGU.has(w) || gorulen.has(w)) continue;
    gorulen.add(w);
    out.push(w);
    if (out.length >= sinir) break;
  }
  return out;
}

/** İstem satırları: PowerShell (`PS C:\…>`), sh (`$`), cmd (`C:\…>`). */
const ISTEM = /^\s*(?:PS [^>]*>|\$|[A-Za-z]:\\[^>]*>)\s*(.*)$/;

/** Terminal kuyruğundaki SON komut satırı ve istem dışı çıktı satırları. */
export function terminalAyristir(kuyruk: string): { komut: string | null; cikti: string } {
  let komut: string | null = null;
  const cikti: string[] = [];
  for (const satir of kuyruk.split(/\r?\n/)) {
    const m = ISTEM.exec(satir);
    if (m) { if (m[1]!.trim()) komut = m[1]!.trim(); }
    else cikti.push(satir);
  }
  return { komut, cikti: cikti.join("\n") };
}

/** Niyet kimliğinin öneki: `n_…` → "n", `elle_…` → "elle", `ajanda_…` → "ajanda". */
export function niyetKaynagi(niyetId: string): string {
  const i = niyetId.indexOf("_");
  return i > 0 ? niyetId.slice(0, i) : niyetId;
}

function mesafeKovasi(m: number): "yakin" | "orta" | "uzak" {
  return m < 1.5 ? "yakin" : m < 3.5 ? "orta" : "uzak";
}

/**
 * Algı anının bağlamı: Ozyn'in durumu (world/player → `OyuncuDurumu`'ndan).
 * Hepsi isteğe bağlı: bilinmeyen alan kodlanmaz.
 */
export interface KapiBaglami {
  mesafe?: number;
  bakiyor?: boolean;
  /** Ozyn'in etkileşimde olduğu yüzey ("monitor", "tahta"…); yoksa null. */
  yuzey?: string | null;
}

/**
 * Algının durum kodu. Konuşma ve bakış cevabı için boş küme: öğrenen kapı
 * onlara karar veremez.
 */
export function durumKodu(a: Algi, icgudu: IcguduKimligi, baglam?: KapiBaglami): string[] {
  if (a.tur === "duydum" || a.tur === "gordum" || a.tur === "tik") return [];
  const k = new Set<string>([`tur:${a.tur}`, `icgudu:${icgudu}`]);
  if (baglam) {
    if (typeof baglam.mesafe === "number" && Number.isFinite(baglam.mesafe)) k.add(`ozyn:${mesafeKovasi(baglam.mesafe)}`);
    if (baglam.bakiyor === true) k.add("ozyn:bakiyor");
    if (typeof baglam.yuzey === "string" && baglam.yuzey) k.add(`ozyn_yuzey:${baglam.yuzey}`);
  }
  const ekle = (w: string[]) => { for (const x of w) k.add(`k:${x}`); };
  switch (a.tur) {
    case "terminal": {
      k.add(a.kod === undefined ? "kod:yok" : a.kod === 0 ? "kod:0" : "kod:hata");
      if (a.kod !== undefined && a.kod !== 0) k.add(`kod=${a.kod}`);
      if (a.kesildi) k.add("kesik");
      const { komut, cikti } = terminalAyristir(a.kuyruk);
      if (komut) {
        const [ad, alt] = komut.split(/\s+/);
        if (ad) k.add(`komut:${ad.toLocaleLowerCase("tr-TR")}`);
        if (ad && alt && /^[\p{L}-]+$/u.test(alt)) k.add(`komut:${ad.toLocaleLowerCase("tr-TR")} ${alt.toLocaleLowerCase("tr-TR")}`);
      }
      ekle(kelimeler(cikti));
      break;
    }
    case "olay": {
      const kaynak = a.ayrinti?.kaynak;
      // İnisiyatif olayının adı bir cümle: adı değil kaynağı kodlanır, cümle kelimelere ayrılır.
      if (typeof kaynak === "string") { k.add(`kaynak:${kaynak}`); ekle(kelimeler(a.ad)); }
      else k.add(`olay:${a.ad}`);
      const yuzey = a.ayrinti?.yuzey;
      if (typeof yuzey === "string") k.add(`yuzey:${yuzey}`);
      const mesafe = a.ayrinti?.mesafe;
      if (typeof mesafe === "number") k.add(`mesafe:${mesafeKovasi(mesafe)}`);
      break;
    }
    case "sonuc":
      k.add(`durum:${a.sonuc.durum}`);
      k.add(`niyet_kaynagi:${niyetKaynagi(a.sonuc.niyet_id)}`);
      if (a.sonuc.not) ekle(kelimeler(a.sonuc.not));
      break;
    case "dunya":
    case "yakin":
      break;
  }
  return [...k].sort();
}
