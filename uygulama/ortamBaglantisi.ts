// uygulama/ortamBaglantisi.ts — Orion'un `ortam` niyetini canlı ova'ya bağlar (kalıp: inisiyatifBaglantisi.ts).
//
// NEDEN AYRI: komutun ne yaptığı saf çekirdekte (`world/level/stil/ortamKomutu.ts`); burada yalnız ömür var: ova
// kurulunca level bağlanır, ofise dönünce bırakılır; level yokken komut AÇIK hata verir (sessizce yutulmaz, model
// "yaptım" sanmaz). `giris.ts` yalnız `ova(level)` / `uygula(komut)` çağırır, mantık orada durmaz.
//
// Açılış tanımı (`sifirla` için) level bağlandığı an alınır: ova her kuruluşta dosyadan taze okunur, yani "sıfırla"
// her zaman dosyadaki hâle döner (kalıcı ayarlar bunun ÜSTÜNE yeniden oynatılır; mind/ortamDeposu).
"use strict";
import type { LevelTanimi } from "../world/level/cekirdek/levelTanimi.ts";
import { ortamUygula, type OrtamKomutu, type OrtamSonucu } from "../world/level/stil/ortamKomutu.ts";

/** `Level`in bu bağlantının kullandığı kadarı (testte sahte geçer). */
export interface OrtamLevel {
  tanim(): LevelTanimi;
  ayarla(yeni: unknown): void;
  readonly dunya: { readonly saat: number };
}

export interface OrtamUygulama {
  ok: boolean;
  /** Orion'a/Ozyn'e dönen kısa metin (başarıda ne yapıldı, hatada neden). */
  not: string;
}

export interface OrtamBaglantisi {
  /** Ova kurulunca level, ofise dönünce null. */
  ova(level: OrtamLevel | null): void;
  kullanilabilirMi(): boolean;
  uygula(k: OrtamKomutu): OrtamUygulama;
  /** Başarıyla uygulanan her komut için çağrılır (kalıcılık günlüğü, öğrenen sözlük, G penceresi). */
  dinle(f: (k: OrtamKomutu, s: OrtamSonucu) => void): () => void;
}

export const OVADA_DEGILIM = "I am not outside: the world look can only be changed in the ova";

export function ortamBaglantisiKur(): OrtamBaglantisi {
  let level: OrtamLevel | null = null;
  let ilk: LevelTanimi | null = null;
  const dinleyiciler = new Set<(k: OrtamKomutu, s: OrtamSonucu) => void>();

  return {
    ova(l) {
      level = l;
      ilk = l ? structuredClone(l.tanim()) : null;
    },
    kullanilabilirMi: () => level !== null,
    uygula(k) {
      if (!level) return { ok: false, not: OVADA_DEGILIM };
      let s: OrtamSonucu;
      try {
        s = ortamUygula(level.tanim(), k, { saat: level.dunya.saat, ...(ilk ? { ilk } : {}) });
        level.ayarla(s.tanim);   // doğrulama/uygulama hatası fırlatır ve level eski hâlde kalır (levelKur `ayarla`)
      } catch (err) {
        return { ok: false, not: err instanceof Error ? err.message : String(err) };
      }
      for (const f of dinleyiciler) f(k, s);
      return { ok: true, not: s.not };
    },
    dinle(f) {
      dinleyiciler.add(f);
      return () => { dinleyiciler.delete(f); };
    },
  };
}
