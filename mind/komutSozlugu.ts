// mind/komutSozlugu.ts — Doğuştan komut programları (spec 13 Faz 2b, robot çekirdeği).
//
// ROBOT İLKESİ (Ozyn, 2026-10-02): "Orion bir robot, onu LLM olmadan da bir çok
// şeyi yapmaya programlayabiliriz." Bedenin yapabildiği basit işler için kesin
// bir söz, LLM'e sorulmadan niyet dizisine döner: 0 token, ~0 ms, zincir hatası yok.
//
// NEDEN (taban ölçüsü, spec 13 Faz 0–1): yerel 7–9B modeller "masaya git ve otur"
// ve "tahtaya yaz"ı zincirleyemedi (ornith 0/5), geçmişe duyarlı (qwen 0/40), bazen
// aracı düz metne yazıyor. Program bunların hiçbirini yapmaz.
//
// DAR VE KESİN (bilerek): sözün TAMAMI bir kalıba uymalı ("otur", "bana gel",
// "pencereye bak"). İçinde başka bir istek, soru ya da içerik olan söz LLM'e gider:
// "tahtaya adını yaz" ne yazılacağını bilmeyi ister, program bilmez. Yanlış eşleşme
// sessizlikten pahalıdır: Ozyn'in başka bir şey istediği anda Orion'un oturması.
// Ölçü: karar kaydındaki bütün gerçek sözlerde yanlış eşleşme 0 (tools/komut-tara.ts).
//
// Spec 10'daki beceri refleksi ÖĞRENİLEN programdır; bu DOĞUŞTAN olanı. İkisi de aynı
// yürütücüden geçer (bridge/kopru.ts, adımlar sırayla, başarısızlıkta söz LLM'e döner).
//
// Bağımlılık: protocol/. Saf.
"use strict";
import type { Niyet } from "../protocol/niyet.ts";
import { capaCoz, katla, type CapaAdi } from "../protocol/temel.ts";

export interface KomutEslesmesi {
  /** Programın adı, kayıt için: `komut:otur`, `komut:git`, … */
  program: string;
  /** Sırayla yürütülecek niyetler (doğrulayıcıdan geçmeye hazır). */
  adimlar: Niyet[];
}

/** "Bana gel"de Ozyn'in ne kadar yakınında durulur (m). Faz 1 talimatıyla aynı. */
export const GEL_MESAFESI = 1.2;

/**
 * Sözün karşılaştırma biçimi: katlanmış (Türkçe karaktersiz, küçük), noktalama yok,
 * tek boşluk; başta/sonda hitap ("orion") ve nezaket ("lütfen", "hadi") atılır.
 */
export function sozuNormalle(soz: string): string {
  let s = katla(soz).replace(/[.,!?;:'"’“”()…]/g, " ").replace(/\s+/g, " ").trim();
  for (;;) {
    const once = s;
    s = s.replace(/^(orion|lutfen|hadi|haydi) /, "").replace(/ (orion|lutfen|hadi|haydi)$/, "");
    if (s === once) return s;
  }
}

/** Çapa etiketleri dışında kullanılan adlar: "bilgisayar" monitördür. */
const ES_ANLAMLI: Readonly<Record<string, CapaAdi>> = {
  bilgisayar: "monitor", ekran: "monitor", terminal: "monitor", masa: "masa",
};

/**
 * Yönelme ekli bir yer adını çapaya çözer: "pencereye" → pencere, "kapiya" → kapi,
 * "beyaz tahtaya" → tahta, "odanin ortasina" → oda_ortasi, "bilgisayara" → monitor.
 */
export function yonelmeCapasi(kelime: string): CapaAdi | null {
  for (const ek of ["ya", "ye", "na", "ne", "a", "e"]) {
    if (!kelime.endsWith(ek) || kelime.length <= ek.length + 1) continue;
    const kok = kelime.slice(0, -ek.length);
    const c = capaCoz(kok) ?? ES_ANLAMLI[kok] ?? null;
    if (c) return c;
  }
  return null;
}

const OTUR = /^(otur|otursana|oturur musun|sandalyeye otur|masaya otur|masaya gec otur|masaya git otur|masaya git ve otur|masana otur|yerine otur)$/;
const KALK = /^(kalk|kalksana|ayaga kalk|kalkar misin)$/;
const GEL = /^(gel|gelsene|gel buraya|buraya gel|bana gel|bana gelsene|yanima gel|yanima gelsene|beri gel)$/;
const DUR = /^(dur|durdur|dur orada|orada dur)$/;
const BANA_BAK = /^(bana bak|bakar misin bana)$/;
/** "önündeki bilgisayarı aç", "bilgisayarı kullan", "terminali aç" → bilgisayar programı. */
const BILGISAYAR = /^(onundeki |masandaki )?(bilgisayari|bilgisayarini|monitoru|terminali|ekrani) (ac|kullan)$/;
/** "<yer>(y)a git / gel / geç" ve "<yer>(y)e bak". */
const GIT = /^(.+) (git|gec|gidip dur|yuru)$/;
const GIT_OTUR = /^(.+) (git|gec) (ve )?otur$/;
const BAK = /^(.+) bak$/;

/** Söz bir doğuştan programa TAMAMEN uyuyorsa onu döner; uymuyorsa null (söz LLM'e gider). */
export function komutCoz(soz: string): KomutEslesmesi | null {
  const s = sozuNormalle(soz);
  if (!s) return null;
  if (OTUR.test(s)) return { program: "komut:otur", adimlar: [{ tur: "otur" }] };
  if (KALK.test(s)) return { program: "komut:kalk", adimlar: [{ tur: "kalk" }] };
  if (GEL.test(s)) return { program: "komut:gel", adimlar: [{ tur: "git", hedef: { tip: "oyuncu" }, mesafe: GEL_MESAFESI }] };
  if (DUR.test(s)) return { program: "komut:dur", adimlar: [{ tur: "dur" }] };
  if (BANA_BAK.test(s)) return { program: "komut:bak", adimlar: [{ tur: "bak", hedef: { tip: "oyuncu" } }] };
  if (BILGISAYAR.test(s)) return { program: "komut:bilgisayar", adimlar: [{ tur: "odaklan", capa: "monitor" }] };

  // "<masa/bilgisayar/sandalye>(y)a git (ve) otur" (ortak test 3: "bilgisayara git otur"):
  // çapasız `otur` zaten masadaki sandalyeye yürür. Başka yerde oturulmaz → LLM'e kalır.
  const gitOtur = GIT_OTUR.exec(s);
  if (gitOtur) {
    const capa = yonelmeCapasi(gitOtur[1]!);
    if (capa === "masa" || capa === "monitor" || capa === "sandalye") return { program: "komut:otur", adimlar: [{ tur: "otur" }] };
    return null;
  }

  const git = GIT.exec(s);
  if (git) {
    const capa = yonelmeCapasi(git[1]!);
    if (capa) return { program: "komut:git", adimlar: [{ tur: "git", hedef: { tip: "capa", ad: capa } }] };
  }
  const bak = BAK.exec(s);
  if (bak) {
    const capa = yonelmeCapasi(bak[1]!);
    if (capa) return { program: "komut:bak", adimlar: [{ tur: "bak", hedef: { tip: "capa", ad: capa } }] };
  }
  return null;
}
