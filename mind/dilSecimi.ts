// mind/dilSecimi.ts — Bu metin Türkçe bir söz mü, yoksa İngilizce bir iç düşünce mi? (spec 13 Faz 5)
//
// NEDEN (Ozyn'in testi, 2026-10-02 08:39): düşünen bir model (lfm25-tb) "hi" sözüne araç
// çağırmadan İngilizce iç monolog döndürdü — "I see the user is asking me to respond.
// The previous context shows…" — ve köprünün düz metin kurtarması bunu SESLİ okudu.
// Orion'un sesi Türkçedir (talimat DİL bölümü); İngilizce düz metin her zaman çerçevenin
// dilidir, yani iç düşüncedir: iç seste kalmalı.
//
// Kaba ama yeterli: Türkçe harf ya da sık Türkçe kelime yoksa ve sık İngilizce kelimeler
// varsa İngilizcedir. Kısa ve kararsız metin Türkçe sayılır (yanlışlıkla susturmak,
// yanlışlıkla İngilizce konuşmaktan kötü: Ozyn cevapsız kalır).
//
// Saf.
"use strict";

const TURKCE_HARF = /[çğıöşüÇĞİÖŞÜ]/;
const TURKCE_KELIME = /\b(ve|bir|bu|ben|sen|ne|evet|hayır|tamam|merhaba|için|gibi|daha|şimdi|burada|değil|var|yok|mi|mı|mu|mü)\b/i;
const INGILIZCE_KELIME = /\b(the|i|is|are|you|and|to|of|it|that|this|what|me|my|be|have|let|see|now|user|i'm|i'll)\b/gi;

/** Metin İngilizce mi (sesli okunmamalı)? */
export function ingilizceMi(metin: string): boolean {
  const m = metin.trim();
  if (!m || TURKCE_HARF.test(m) || TURKCE_KELIME.test(m)) return false;
  return (m.match(INGILIZCE_KELIME)?.length ?? 0) >= 3;
}
