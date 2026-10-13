// world/level/stil/ortamKomutu.ts — Orion'un `ortam` niyetini level tanımına çeviren SAF çekirdek.
//
// NEDEN BURADA, DÜĞMELERDE DEĞİL: G penceresindeki stil/ışık/zaman düğmeleri (level/editor/arayuz/gorunum.ts) yalnız
// elle kullanılıyordu. Orion'un aynı şeyi yapması için dönüşüm tek, test edilebilir bir işlevde durur: `(tanim, komut)
// → yeni tanım`. Babylon yok, sahne yok; sonucu `Level.ayarla` uygular. Sözlük (token'sız), LLM aracı ve G penceresi
// AYNI işlevi çağırır — üç yerde üç ayrı "ışığı kıs" olmaz.
//
// MALİYET: ışık, ortam, stil, zaman ve shader değişimi `Level.ayarla`da UCUZDUR (katman yıkılmaz). Palet değişimi
// (`renk`) katmanları yıkıp kurar: sonuç notunda söylenir (`pahali`).
//
// Aralıklar burada SIKIŞTIRILIR (doğrulayıcı yalnız "sayı" der): model "pozlama 40" derse sahne beyaza dönmesin.
// Bilinmeyen değer FIRLATIR; hata metni geçerli seçenekleri söyler (reddi sessiz bırakmayan proje kuralı).
"use strict";
import type { Niyet, OrtamNe } from "../../../protocol/niyet.ts";
import { katla } from "../../../protocol/temel.ts";
import type { LevelTanimi } from "../cekirdek/levelTanimi.ts";
import {
  ONAYAR_ADLARI, ONAYARLAR, PALET_DUZENI_ADLARI, VARSAYILAN_STIL, onayarUygula, paletDuzeniUygula, stilTamamla, type SonStili,
} from "./stilTanimi.ts";
import { ZAMAN_VARSAYILAN } from "../shader/dunyaDurumu.ts";
import { DUNYA_ADLARI } from "../shader/paletler.ts";

export type OrtamKomutu = Extract<Niyet, { tur: "ortam" }>;

/** Komutun çalışma bağlamı: canlı saat (akan zamanda tanımdaki saat bayatlar) ve açılıştaki tanım (`sifirla`). */
export interface OrtamBaglami {
  /** Dünyanın şu anki saati (0–24); yoksa tanımdaki saat. */
  saat?: number;
  /** Level'ın ilk kurulduğu tanım: `sifirla` buna döner. */
  ilk?: LevelTanimi;
}

export interface OrtamSonucu {
  tanim: LevelTanimi;
  /** Orion'a/Ozyn'e dönen kısa açıklama ("saat 21:00 yapıldı"). */
  not: string;
  /** Katman yıkıp kuran (yavaş) değişiklik mi: palet düzeni. */
  pahali: boolean;
}

/** Işık sonrası efekt grupları (`SonStili` anahtarları; ton eşleme sayısal, açılıp kapanmaz). */
export const EFEKT_GRUPLARI = Object.keys(VARSAYILAN_STIL.son).filter((k) => k !== "tonlama") as Exclude<keyof SonStili, "tonlama">[];

/** Özel shader'lar (`shader/moduller/index.ts SHADERLAR` anahtarları; test ikisinin ayrışmasını yakalar). */
export const SHADER_ADLARI = ["gokZamani", "paletHaritasi", "zamanKirigi", "hataImzasi", "debugTarama", "firca", "elyazmasi", "atmosfer"] as const;

export const ISIK_YONLERI = ["kis", "ac", "sicak", "soguk"] as const;
export const ACIK_KAPALI = ["ac", "kapat"] as const;
export const SIS_DEGERLERI = ["ac", "kapat", "yogun", "hafif"] as const;

// Sınırlar: pozlama 0,25–3 (ACES'te 3'ün üstü yanık), sis 0,0005–0,05 (üstü ova'yı kapatır).
const POZLAMA_ARALIK = [0.25, 3] as const;
const POZLAMA_ADIM = 1.25;
const SIS_ARALIK = [0.0005, 0.05] as const;
const SIS_ADIM = 1.6;
const EGRI_ADIM = 20;
const SICAK_TON = 40, SOGUK_TON = 210;

const sinirla = (v: number, [a, b]: readonly [number, number]) => Math.min(b, Math.max(a, v));
const saatSar = (s: number) => ((s % 24) + 24) % 24;

/** "21:30" (saat 0–24, ondalık dakika). */
export function saatYazisi(s: number): string {
  const h = Math.floor(saatSar(s)), m = Math.round((saatSar(s) - h) * 60);
  return m === 60 ? `${String((h + 1) % 24).padStart(2, "0")}:00` : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function deger(k: OrtamKomutu, secenekler: readonly string[], ad = k.ne): string {
  const d = k.deger === undefined ? "" : katla(k.deger.trim());
  const e = secenekler.find((s) => katla(s) === d);
  if (!e) throw new Error(`ortam ${ad}: "${k.deger ?? ""}" geçersiz (geçerli: ${secenekler.join(", ")})`);
  return e;
}

function sayiGerekli(k: OrtamKomutu): number {
  if (k.sayi === undefined || !Number.isFinite(k.sayi)) throw new Error(`ortam ${k.ne}: sayi gerekli`);
  return k.sayi;
}

/**
 * Komutu tanıma uygular. Girdiyi DEĞİŞTİRMEZ (kopya döner). Bilinmeyen konu/değer fırlatır.
 * `isik`: pozlama çarpanı (kısmak/açmak) ya da renk eğrisinin parlak tonları (sıcak/soğuk); `sayi` = adım (varsayılan 1).
 */
export function ortamUygula(t: LevelTanimi, k: OrtamKomutu, b: OrtamBaglami = {}): OrtamSonucu {
  const yeni = structuredClone(t);
  const sonuc = (not: string, pahali = false): OrtamSonucu => ({ tanim: yeni, not, pahali });
  const ne: OrtamNe = k.ne;
  switch (ne) {
    case "stil": {
      const ad = deger(k, ONAYAR_ADLARI);
      return { tanim: onayarUygula(yeni, ad), not: `stil "${ad}" yapıldı (${ONAYARLAR[ad]!.aciklama})`, pahali: false };
    }
    case "renk": {
      const ad = deger(k, PALET_DUZENI_ADLARI);
      return { tanim: paletDuzeniUygula(yeni, ad), not: `renk düzeni "${ad}" yapıldı (kısa bir takılma olabilir)`, pahali: true };
    }
    case "saat": {
      const s = saatSar(sayiGerekli(k));
      yeni.zaman = { ...(yeni.zaman ?? ZAMAN_VARSAYILAN), saat: s, akiyor: false };
      return sonuc(`saat ${saatYazisi(s)} yapıldı`);
    }
    case "saat_kaydir": {
      const simdi = b.saat ?? yeni.zaman?.saat ?? ZAMAN_VARSAYILAN.saat;
      const s = saatSar(simdi + sayiGerekli(k));
      yeni.zaman = { ...(yeni.zaman ?? ZAMAN_VARSAYILAN), saat: s, akiyor: false };
      return sonuc(`saat ${saatYazisi(s)} yapıldı (${k.sayi! >= 0 ? "+" : ""}${k.sayi} saat)`);
    }
    case "akis": {
      const a = deger(k, ACIK_KAPALI) === "ac";
      yeni.zaman = { ...(yeni.zaman ?? ZAMAN_VARSAYILAN), akiyor: a, saat: b.saat ?? yeni.zaman?.saat ?? ZAMAN_VARSAYILAN.saat };
      return sonuc(a ? "zaman akıyor" : "zaman durdu");
    }
    case "dunya": {
      const i = k.sayi !== undefined ? Math.round(k.sayi) : DUNYA_ADLARI.indexOf(deger(k, DUNYA_ADLARI));
      if (!Number.isFinite(i) || i < 0 || i >= DUNYA_ADLARI.length) throw new Error(`ortam dunya: geçersiz (geçerli: ${DUNYA_ADLARI.join(", ")})`);
      yeni.zaman = { ...(yeni.zaman ?? ZAMAN_VARSAYILAN), dunya: i, saat: b.saat ?? yeni.zaman?.saat ?? ZAMAN_VARSAYILAN.saat };
      return sonuc(`dünya "${DUNYA_ADLARI[i]}" yapıldı`);
    }
    case "isik": {
      const yon = deger(k, ISIK_YONLERI);
      const adim = Math.max(1, Math.min(4, Math.round(k.sayi ?? 1)));
      if (yon === "kis" || yon === "ac") {
        const cik = yon === "kis" ? 1 / POZLAMA_ADIM ** adim : POZLAMA_ADIM ** adim;
        const once = yeni.ortam.tonlama.pozlama;
        yeni.ortam.tonlama.pozlama = Math.round(sinirla(once * cik, POZLAMA_ARALIK) * 1000) / 1000;
        return sonuc(`ışık ${yon === "kis" ? "kısıldı" : "açıldı"} (pozlama ${once.toFixed(2)} → ${yeni.ortam.tonlama.pozlama.toFixed(2)})`);
      }
      // Sıcak/soğuk = renk eğrisinin PARLAK tonları (zaman tanımlıyken ışık rengi paletten gelir; eğri her durumda çalışır).
      // Aynı yöne tekrar basmak yoğunluğu artırır, ters yöne basmak o yönde baştan başlatır.
      const stil = stilTamamla(yeni.stil);
      const ton = yon === "sicak" ? SICAK_TON : SOGUK_TON;
      const e = stil.son.egri;
      e.parlakYogunluk = Math.min(100, (e.acik && e.parlakTon === ton ? e.parlakYogunluk : 0) + EGRI_ADIM * adim);
      e.parlakTon = ton; e.acik = true;
      yeni.stil = stil;
      return sonuc(`ışık ${yon === "sicak" ? "sıcaklaştı" : "soğudu"} (parlak tonlar ${e.parlakYogunluk})`);
    }
    case "sis": {
      const d = deger(k, SIS_DEGERLERI);
      const s = yeni.ortam.sis;
      if (d === "kapat") s.acik = false;
      else { s.acik = true; if (d !== "ac") s.yogunluk = Math.round(sinirla(s.yogunluk * (d === "yogun" ? SIS_ADIM : 1 / SIS_ADIM), SIS_ARALIK) * 1e5) / 1e5; }
      return sonuc(s.acik ? `sis açık (yoğunluk ${s.yogunluk})` : "sis kapandı");
    }
    case "efekt": {
      const ham = (k.deger ?? "").split(":");
      const grup = EFEKT_GRUPLARI.find((g) => katla(g) === katla((ham[0] ?? "").trim()));
      if (!grup) throw new Error(`ortam efekt: "${k.deger ?? ""}" geçersiz (geçerli: ${EFEKT_GRUPLARI.join(", ")}, ör. "bloom:kapat")`);
      const acik = ham[1] === undefined ? true : deger({ ...k, deger: ham[1] }, ACIK_KAPALI, "efekt") === "ac";
      const stil = stilTamamla(yeni.stil);
      stil.son[grup].acik = acik;
      yeni.stil = stil;
      return sonuc(`${grup} ${acik ? "açıldı" : "kapandı"}`);
    }
    case "shader": {
      const ham = (k.deger ?? "").split(":");
      const ad = SHADER_ADLARI.find((s) => katla(s) === katla((ham[0] ?? "").trim()));
      if (!ad) throw new Error(`ortam shader: "${k.deger ?? ""}" geçersiz (geçerli: ${SHADER_ADLARI.join(", ")}, ör. "atmosfer:ac")`);
      const acik = ham[1] === undefined ? true : deger({ ...k, deger: ham[1] }, ACIK_KAPALI, "shader") === "ac";
      const liste = yeni.shaderlar ?? (yeni.shaderlar = []);
      const var_ = liste.find((s) => s.tur === ad);
      if (var_) var_.acik = acik; else liste.push({ tur: ad, acik, ayar: {} });
      return sonuc(`${ad} shader'ı ${acik ? "açıldı" : "kapandı"}`);
    }
    case "sifirla": {
      if (!b.ilk) throw new Error("ortam sifirla: açılış tanımı yok");
      return { tanim: structuredClone(b.ilk), not: "ova açılıştaki hâline döndü", pahali: true };
    }
  }
}
