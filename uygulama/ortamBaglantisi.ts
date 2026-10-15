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
  /**
   * `sessiz`: dinleyicileri çağırmaz (kalıcılık günlüğü, öğrenen sözlük, G penceresi) — Orion Doktor efektleri geçici açıp kapatırken Ozyn'in
   * ayarlarına/günlüğüne iz bırakmasın (`uygulama/doktor.ts`).
   */
  uygula(k: OrtamKomutu, secenek?: { sessiz?: boolean }): OrtamUygulama;
  /** Şu anki ova tanımının KOPYASI (geri yüklemek için); ova yoksa null. */
  anlik(): LevelTanimi | null;
  /** Anlık görüntüyü dinleyicisiz geri yükler (doktorun `finally`si). Level yoksa ya da ayarlanamazsa false. */
  geriYukle(t: LevelTanimi): boolean;
  /**
   * Günlüğü (kaydedilmiş komutlar) taze kurulmuş level'a TEK `ayarla` ile yeniden oynatır; dinleyicileri çağırmaz
   * (oynatılan komut yeniden günlüğe yazılmasın). Bozuk komut atlanır ve sayılır; level yoksa 0.
   */
  oynat(komutlar: readonly OrtamKomutu[]): { uygulanan: number; atlanan: string[] };
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
    anlik: () => (level ? structuredClone(level.tanim()) : null),
    geriYukle(t) {
      if (!level) return false;
      try { level.ayarla(t); return true; } catch { return false; }
    },
    uygula(k, secenek) {
      if (!level) return { ok: false, not: OVADA_DEGILIM };
      let s: OrtamSonucu;
      try {
        s = ortamUygula(level.tanim(), k, { saat: level.dunya.saat, ...(ilk ? { ilk } : {}) });
        level.ayarla(s.tanim);   // doğrulama/uygulama hatası fırlatır ve level eski hâlde kalır (levelKur `ayarla`)
      } catch (err) {
        return { ok: false, not: err instanceof Error ? err.message : String(err) };
      }
      if (!secenek?.sessiz) for (const f of dinleyiciler) f(k, s);
      return { ok: true, not: s.not };
    },
    oynat(komutlar) {
      const atlanan: string[] = [];
      if (!level || komutlar.length === 0) return { uygulanan: 0, atlanan };
      let t = level.tanim(), uygulanan = 0;
      for (const k of komutlar) {
        try { t = ortamUygula(t, k, { ...(ilk ? { ilk } : {}) }).tanim; uygulanan++; }
        catch (err) { atlanan.push(`${k.ne} ${k.deger ?? k.sayi ?? ""}: ${err instanceof Error ? err.message : String(err)}`); }
      }
      if (uygulanan === 0) return { uygulanan, atlanan };
      try { level.ayarla(t); } catch (err) { return { uygulanan: 0, atlanan: [...atlanan, `ayarla: ${err instanceof Error ? err.message : String(err)}`] }; }
      return { uygulanan, atlanan };
    },
    dinle(f) {
      dinleyiciler.add(f);
      return () => { dinleyiciler.delete(f); };
    },
  };
}
