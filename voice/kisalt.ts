// voice/kisalt.ts — Söylenen sözü iki cümleye indirir.
//
// NEDEN VAR (ölçümden): sistem talimatı "EN FAZLA İKİ CÜMLE" diyor ama
// qwen2.5:7b buna 3 koşudan 2'sinde uymuyor — 180 karakterlik tavanı aşan,
// odayı tarif eden monologlar üretiyor. Modele daha çok yalvarmak kırılgan
// bir çözümdür; kural belirleyici biçimde burada uygulanır.
//
// İKİ FAYDA: (1) kullanıcı monolog dinlemez, (2) TTS süresi metinle doğru
// orantılı olduğundan Orion'un cevabı daha çabuk biter.
//
// SAF: bağımlılık yok, yan etki yok, aynı girdi aynı çıktı.
"use strict";

/** Cümle sonu sayılan noktalama. Üç nokta tek cümle sonu sayılır. */
const CUMLE_SONU = /([.!?]+)(\s|$)/g;

export interface KisaltmaAyari {
  /** Kaç cümle korunur. */
  azamiCumle?: number;
  /** Kaç karakteri aşarsa cümle sınırından bağımsız kesilir. */
  azamiKarakter?: number;
}

/**
 * Metni en fazla `azamiCumle` cümleye indirir.
 *
 * Kesme CÜMLE SINIRINDA yapılır — cümlenin ortasından kesmek, yarım kalmış
 * bir söz duyurur ve sessizlikten beterdir. Hiç cümle sonu yoksa (model
 * noktalama koymadıysa) karakter tavanı uygulanır ve son boşluktan kesilir,
 * böylece kelime ortasında bitmez.
 */
export function ikiCumleyeKisalt(metin: string, ayar: KisaltmaAyari = {}): string {
  const azamiCumle = ayar.azamiCumle ?? 2;
  const azamiKarakter = ayar.azamiKarakter ?? 180;
  const temiz = metin.trim().replace(/\s+/g, " ");
  if (!temiz) return "";

  // Cümle sonlarını bul.
  const sonlar: number[] = [];
  CUMLE_SONU.lastIndex = 0;
  for (let m = CUMLE_SONU.exec(temiz); m; m = CUMLE_SONU.exec(temiz)) {
    sonlar.push(m.index + (m[1]?.length ?? 1));
    if (sonlar.length >= azamiCumle) break;
  }

  let sonuc = temiz;
  const kesim = sonlar[azamiCumle - 1];
  if (sonlar.length >= azamiCumle && kesim !== undefined) {
    sonuc = temiz.slice(0, kesim).trim();
  }

  if (sonuc.length <= azamiKarakter) return sonuc;

  // Hâlâ uzunsa: karakter tavanı, ama kelime ortasından kesme.
  const kesik = sonuc.slice(0, azamiKarakter);
  const bosluk = kesik.lastIndexOf(" ");
  const govde = (bosluk > azamiKarakter * 0.5 ? kesik.slice(0, bosluk) : kesik).trim();
  return /[.!?]$/.test(govde) ? govde : `${govde}…`;
}
