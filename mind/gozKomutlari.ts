// mind/gozKomutlari.ts — Doğuştan GÖZ komutları: "gözünle bak", "gözlerinle bak" (token'sız karar; cevabı yine beyin söyler).
//
// `komutSozlugu.ts`in ailesi (aynı ilke: sözün TAMAMI bir kalıba uymalı; yanlış eşleşme sessizlikten pahalıdır). Niyet: `sor gor` (protocol/niyet.ts) — Orion'un
// LLM aracıyla (`dunya_sor`, ne: gor) AYNI niyet. Fark yalnız maliyet: "bak" kararını beyne vermek yerine söz yolu doğrudan bakışı başlatır; bakış bitince
// `gordum` algısı beyni UYANDIRIR ve beyin gördüğünü söyler (yani karar turu token harcamaz, yalnız cevap turu harcar).
// Bakış göz muayenesi yolundan gider (uygulama/gozlem.ts): düz Türkçe görme sorgusu, iki yönlü sıra, panelde önizleme + cevap.
//
// Girdi `sozuNormalle` çıktısıdır (katlanmış, noktalamasız, dolgusuz: "Gözünle bi bak!" → "gozunle bak"). Saf.
// BİLEREK EŞLEŞMEYENLER (LLM'e gider): soru ("gözünle neyi görüyorsun"), olumsuz ("gözünle bakma"), birden çok istek, çıplak "bak" (yön/hedef ister).
"use strict";
import type { Niyet } from "../protocol/niyet.ts";
import type { KomutEslesmesi } from "./komutSozlugu.ts";

const GOZ = /^(kendi )?(gozunle|gozlerinle)( bir)? (bak|bakar misin|bakarsan|gor|goruver)$|^bak (gozunle|gozlerinle)$/;

export function gozCoz(s: string): KomutEslesmesi | null {
  if (!GOZ.test(s)) return null;
  return { program: "komut:goz", adimlar: [{ tur: "sor", ne: "gor" } as Niyet] };
}
