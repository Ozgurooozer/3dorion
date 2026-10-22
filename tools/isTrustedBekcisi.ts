// tools/isTrustedBekcisi.ts — "ÇALIŞTIRMA YALNIZ GERÇEK TIKLAMA" bekçilerinin ORTAK yoklaması (spec 35 §4c–4g; spec 36).
//
// Graf (▶ / ⚡, `uygulama/graf/npcDavranisi.test.ts`) ve sekans (▶, `uygulama/yapi/sekans/sekansBekci.test.ts`) bekçileri aynı kuralı sınar: çağrı bir
// tıklama işleyicisinin içinde, işleyici olay parametresini `(e)` alıyor ve çağrıdan ÖNCE `if (!e.isTrusted…) return;` var (yalnız günlüğe yazan
// "denetim" geçmez). Önce graf testinin içindeydi; sekans bekçisi ikinci kopyayı yazmasın diye buraya alındı. Test dosyası değil (import edilince testleri
// ikinci kez koşmasın).
"use strict";

/** Bir çağrının (kaynaktaki konumu `cagri`) tıklama işleyicisi önce `isTrusted`a bakıyor mu; sorun varsa nedeni, yoksa null. */
export function isTrustedYoklamasi(kaynak: string, cagri: number): string | null {
  const bas = kaynak.lastIndexOf('addEventListener("click"', cagri);
  if (bas < 0) return "tıklama işleyicisinin içinde değil";
  if (!kaynak.startsWith('addEventListener("click", (e) =>', bas)) return "işleyici olay parametresini (e) almıyor";
  if (!/if \(!e\.isTrusted[^)]*\)\s*return;/.test(kaynak.slice(bas, cagri))) return "çağrıdan önce `if (!e.isTrusted…) return;` yok";
  return null;
}
