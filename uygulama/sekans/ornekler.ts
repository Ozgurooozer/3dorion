// uygulama/sekans/ornekler.ts — REPODAKİ ÖRNEK SEKANSLAR (spec 36): `assets/sekans/` (liste.json + <ad>.json), SALT OKUNUR. SAF (okuma dışarıdan).
//
// KARAR (tohumlama yerine salt-okunur örnek): ilk açılışta örnekleri kullanıcı klasörüne YAZMAK, Ozyn'in sildiği bir örneği her açılışta geri getirir ya
// da aynı adlı kendi sekansının yanına ikinci kopya doğururdu. Örnekler bu yüzden repoda kalır, Sekans sekmesinde ayrı şeritte görünür; düzenlemek
// için "Kopyasını al" kullanıcı klasörüne YENİ bir dosya yazar (var olan adın üstüne asla). Yükleyici klip kütüphanesiyle ORTAK
// (`listeliKlasoruYukle`): bozuk örnek NEDENİYLE düşer, sağlamlar yüklenir.
"use strict";
import type { Sonuc } from "../../protocol/dogrula.ts";
import { sekansAdiGecerli, type Sekans } from "../../protocol/sekans.ts";
import { listeliKlasoruYukle, type KlipHatasi } from "../../world/avatar/index.ts";
import { sekansMetniCoz } from "./sekansDeposu.ts";

/** `assets/` altındaki klasör (oyunda varlık yolu `sekans/…`). */
export const ORNEK_DIZINI = "sekans";

/** Bir örnek dosyanın metni: JSON → biçim → ad = dosya adı. */
export function ornekMetniCoz(dosya: string, metin: string): Sonuc<Sekans> {
  const r = sekansMetniCoz(metin);
  if (!r.ok) return r;
  const beklenen = dosya.replace(/\.json$/, "");
  return r.deger.ad === beklenen ? r : { ok: false, hata: `ad '${r.deger.ad}' dosya adıyla ('${beklenen}') aynı olmalı` };
}

export interface OrnekKutuphanesi {
  liste(): readonly Sekans[];
  al(ad: string): Sekans | null;
  hatalar(): readonly KlipHatasi[];
  doldur(l: readonly Sekans[], h: readonly KlipHatasi[]): void;
  dinle(f: () => void): () => void;
}

export function ornekKutuphanesiKur(): OrnekKutuphanesi {
  let liste: readonly Sekans[] = [];
  let hatalar: readonly KlipHatasi[] = [];
  const dinleyiciler = new Set<() => void>();
  return {
    liste: () => liste,
    al: (ad) => liste.find((s) => s.ad === ad) ?? null,
    hatalar: () => hatalar,
    doldur(l, h) { liste = [...l]; hatalar = [...h]; for (const f of [...dinleyiciler]) f(); },
    dinle(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
  };
}

export async function ornekleriYukle(oku: (yol: string) => Promise<string>, dizin = ORNEK_DIZINI): Promise<{ ornekler: Sekans[]; hatalar: KlipHatasi[] }> {
  const r = await listeliKlasoruYukle(oku, dizin, ornekMetniCoz, sekansAdiGecerli);
  return { ornekler: r.ogeler, hatalar: r.hatalar };
}
