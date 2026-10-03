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
 * tek boşluk; DOLGU sözcükleri (hitap, nezaket, zarf) HER YERDEN atılır.
 *
 * NEDEN HER YERDEN (Tur 6, docs/olcum-soz-siniflandirma.md): önceden yalnız baştaki/sondaki
 * "orion/lütfen/hadi" atılıyordu; "tahtaya bi bak", "hemen otur", "şimdi masaya bak",
 * "stand up please" yüzünden kalıba uymayıp LLM'e düşüyordu. Dolgu içerik taşımaz: atmak anlamı
 * değiştirmez ve kalıplar yine TÜM sözü kapsar. Olumsuzluk ve soru ekleri (-ma, -ebilir misin)
 * dolgu DEĞİL: onlar atılmaz, o yüzden "oturma" ve "oturabilir misin" hâlâ LLM'e gider.
 */
const DOLGU_OBEKLERI = ["zahmet olmazsa", "rica ederim", "bi zahmet", "right now", "for me", "su an"];
const DOLGU: ReadonlySet<string> = new Set([
  "orion", "lutfen", "hadi", "haydi", "hemen", "simdi", "bi", "biraz", "bakalim", "dostum",
  "hey", "hi", "ok", "okay", "please", "pls", "now", "immediately",
]);

export function sozuNormalle(soz: string): string {
  let s = ` ${katla(soz).replace(/[.,!?;:'"’“”()…]/g, " ").replace(/\s+/g, " ").trim()} `;
  for (const obek of DOLGU_OBEKLERI) s = s.split(` ${obek} `).join(" ");
  return s.split(" ").filter((k) => k !== "" && !DOLGU.has(k)).join(" ");
}

/** Çapa etiketleri dışında kullanılan adlar: "bilgisayar" monitördür, "koltuk" sandalyedir. */
const ES_ANLAMLI: Readonly<Record<string, CapaAdi>> = {
  bilgisayar: "monitor", ekran: "monitor", terminal: "monitor", masa: "masa", koltuk: "sandalye",
};

/**
 * Yer adının kökünü çapaya çözer. Ünsüz yumuşaması: "koltuğa" katlanınca "koltuga" olur, eki atınca
 * kök "koltug" kalır ama sözlükte "koltuk" yazar; kök "g" ile bitiyorsa "k" ile de denenir.
 */
function kokCapasi(kok: string): CapaAdi | null {
  const dene = (k: string): CapaAdi | null => capaCoz(k) ?? ES_ANLAMLI[k] ?? null;
  return dene(kok) ?? (kok.endsWith("g") ? dene(`${kok.slice(0, -1)}k`) : null);
}

/**
 * Yönelme ekli bir yer adını çapaya çözer: "pencereye" → pencere, "kapiya" → kapi,
 * "beyaz tahtaya" → tahta, "odanin ortasina" → oda_ortasi, "bilgisayara" → monitor.
 */
export function yonelmeCapasi(kelime: string): CapaAdi | null {
  for (const ek of ["ya", "ye", "na", "ne", "a", "e"]) {
    if (!kelime.endsWith(ek) || kelime.length <= ek.length + 1) continue;
    const c = kokCapasi(kelime.slice(0, -ek.length));
    if (c) return c;
  }
  return null;
}

/**
 * Tamlayan (iyelik) ekli yer adını çapaya çözer: "masanin" → masa, "sandalyenin" → sandalye,
 * "bilgisayarin" → monitor, "koltugun" → sandalye. "<yer>nin yanina/onune/basina git" kalıbı içindir.
 */
export function iyelikCapasi(kelime: string): CapaAdi | null {
  for (const ek of ["nin", "nun", "in", "un"]) {
    if (!kelime.endsWith(ek) || kelime.length <= ek.length + 1) continue;
    const c = kokCapasi(kelime.slice(0, -ek.length));
    if (c) return c;
  }
  return null;
}

const OTUR = /^(otur|otursana|oturur musun|sandalyeye otur|masaya otur|masaya gec otur|masaya git otur|masaya git ve otur|masana otur|yerine otur)$/;
const KALK = /^(kalk|kalksana|ayaga kalk|kalk ayaga|kalkar misin)$/;
const GEL = /^(gel|gelsene|gel buraya|buraya gel|bana gel|bana gelsene|yanima gel|yanima gelsene|beri gel|yaklas|(bana|yanima|benim yanima)( dogru)? (gel|gelsene|yuru|yaklas)|gel (bana|yanima))$/;
/** "kıpırdama" olumsuz ekli ama "dur" demektir; ZIT anlamlı "durma" (devam et) bilerek YOK. */
const DUR = /^(dur|durdur|dur orada|orada dur|kipirdama|hareket etme)$/;
const BANA_BAK = /^(bana bak|bakar misin bana)$/;
/** "önündeki bilgisayarı aç", "bilgisayarı kullan", "terminali aç" → bilgisayar programı. */
const BILGISAYAR = /^(onundeki |masandaki )?(bilgisayari|bilgisayarini|monitoru|terminali|ekrani) (ac|kullan)$/;
/** "<yer>(y)a git / gel / geç / yürü / yaklaş" ve "<yer>(y)e bak". */
const GIT = /^(.+) (git|gec|gel|gidip dur|yuru)$/;
const GIT_OTUR = /^(.+) (git|gec) (ve )?otur$/;
/** "<yer>(n)in yanina/onune/basina/karsisina git·geç·gel·yürü": çapanın YANINA/ÖNÜNE gitmek, çapaya gitmektir. */
const GIT_YAKIN = /^(.+) (yanina|onune|basina|karsisina|yakinina|arkasina) (git|gec|gel|yuru)$/;
/** "<yer>(y)e doğru git·yürü". */
const GIT_DOGRU = /^(.+) dogru (git|gec|gel|yuru)$/;
const YAKLAS = /^(.+) yaklas$/;
const OTUR_YER = /^(.+) otur$/;
/** "<bilgisayar/ekran/monitör>(e) odaklan". Başka yüzeye odaklanma ("tahtaya odaklan") belirsiz: LLM'e. */
const ODAKLAN = /^(.+) odaklan$/;
const BAK = /^(.+) bak$/;
const PENCEREDEN_BAK = /^pencereden disari bak$/;
/** Oturulabilecek yerler: "tahtaya otur" anlamsız, programa girmez. */
const OTURULAN: ReadonlySet<CapaAdi> = new Set<CapaAdi>(["sandalye", "masa", "monitor"]);

const otur = (): KomutEslesmesi => ({ program: "komut:otur", adimlar: [{ tur: "otur" }] });
const kalk = (): KomutEslesmesi => ({ program: "komut:kalk", adimlar: [{ tur: "kalk" }] });
const gel = (): KomutEslesmesi => ({ program: "komut:gel", adimlar: [{ tur: "git", hedef: { tip: "oyuncu" }, mesafe: GEL_MESAFESI }] });
const dur = (): KomutEslesmesi => ({ program: "komut:dur", adimlar: [{ tur: "dur" }] });
const banaBak = (): KomutEslesmesi => ({ program: "komut:bak", adimlar: [{ tur: "bak", hedef: { tip: "oyuncu" } }] });
const bilgisayar = (): KomutEslesmesi => ({ program: "komut:bilgisayar", adimlar: [{ tur: "odaklan", capa: "monitor" }] });
const gitCapa = (capa: CapaAdi): KomutEslesmesi => ({ program: "komut:git", adimlar: [{ tur: "git", hedef: { tip: "capa", ad: capa } }] });
const bakCapa = (capa: CapaAdi): KomutEslesmesi => ({ program: "komut:bak", adimlar: [{ tur: "bak", hedef: { tip: "capa", ad: capa } }] });

// ── İngilizce paketi (Tur 6) ────────────────────────────────────────────────
// Ozyn "İngilizce de sorun değil" dedi; ölçüm: sözlükte hiç İngilizce kalıp yoktu (kör sette %0). Aynı ilke:
// sözün TAMAMI bir kalıba uymalı, yer çapaya çözülmeli. Soru biçimi ("can you", "could you", "will you") ve
// olumsuz ("don't sit") BİLEREK yok: LLM'e gider. Apostrof boşluğa dönüşür ("don't" → "don t").

const EN_ART = "(?:the |your |my )?";
/** İngilizce yer adı → çapa. "desk": çalışma masası (CAPA_ETIKETLERI.masa) İngilizcede work desk/table. */
const EN_YER: ReadonlyArray<readonly [RegExp, CapaAdi]> = [
  [new RegExp(`^${EN_ART}(?:work |working )?(?:table|desk)$`), "masa"],
  [new RegExp(`^${EN_ART}(?:white ?board|board)$`), "tahta"],
  [new RegExp(`^${EN_ART}window$`), "pencere"],
  [new RegExp(`^${EN_ART}(?:chair|seat|armchair)$`), "sandalye"],
  [new RegExp(`^${EN_ART}door$`), "kapi"],
  [new RegExp(`^${EN_ART}(?:computer|monitor|screen|pc|terminal)$`), "monitor"],
  [new RegExp(`^${EN_ART}(?:middle|center|centre) of the room$`), "oda_ortasi"],
];

function enYer(ifade: string): CapaAdi | null {
  for (const [desen, capa] of EN_YER) if (desen.test(ifade)) return capa;
  return null;
}

const EN_OTUR = /^(sit|sit down|take a seat|have a seat)$/;
const EN_OTUR_YER = /^sit(?: down)? (?:on|in|at) (.+)$/;
const EN_KALK = /^(stand up|get up|stand|rise|get on your feet)$/;
const EN_DUR = /^(stop|freeze|halt|stop moving|stay still|hold still|don t move|do not move)$/;
const EN_GEL = /^(come|come here|come over|come over here|come closer|come this way|come to me|come to my side|come toward me|come towards me|walk to me|walk toward me|walk towards me)$/;
const EN_BANA_BAK = /^(look at me|look this way|face me)$/;
const EN_BILGISAYAR = /^(?:open|turn on|switch on|start|boot up|power on|fire up|use) (.+)$/;
const EN_ODAKLAN = /^focus(?: on)? (.+)$/;
const EN_GIT_OTUR = /^go (?:to )?(.+?)(?: and)? sit(?: down)?$/;
const EN_GIT = /^(?:go|walk|head|move|run)(?: over)? (?:to|toward|towards|next to|near|by|up to|in front of|over to) (.+)$/;
const EN_DUR_YANINDA = /^(?:go )?stand (?:in|at|by|near|next to) (.+)$/;
const EN_BAK = /^(?:look|gaze|turn) (?:at|toward|towards) (.+)$/;
const EN_PENCERE_BAK = /^look (?:out of|out|through) (.+)$/;

function komutCozIng(s: string): KomutEslesmesi | null {
  if (EN_OTUR.test(s)) return otur();
  const oturYer = EN_OTUR_YER.exec(s);
  if (oturYer) {
    const c = enYer(oturYer[1]!);
    if (c && OTURULAN.has(c)) return otur();
    return null;
  }
  if (EN_KALK.test(s)) return kalk();
  if (EN_DUR.test(s)) return dur();
  if (EN_GEL.test(s)) return gel();
  if (EN_BANA_BAK.test(s)) return banaBak();
  const bil = EN_BILGISAYAR.exec(s);
  if (bil && enYer(bil[1]!) === "monitor") return bilgisayar();
  const odak = EN_ODAKLAN.exec(s);
  if (odak && enYer(odak[1]!) === "monitor") return bilgisayar();
  const gitOtur = EN_GIT_OTUR.exec(s);
  if (gitOtur) {
    const c = enYer(gitOtur[1]!);
    return c && OTURULAN.has(c) ? otur() : null;
  }
  const git = EN_GIT.exec(s) ?? EN_DUR_YANINDA.exec(s);
  if (git) {
    const c = enYer(git[1]!);
    if (c) return gitCapa(c);
  }
  const bak = EN_BAK.exec(s);
  if (bak) {
    const c = enYer(bak[1]!);
    if (c) return bakCapa(c);
  }
  const disari = EN_PENCERE_BAK.exec(s);
  if (disari && enYer(disari[1]!) === "pencere") return bakCapa("pencere");
  return null;
}

/** Söz bir doğuştan programa TAMAMEN uyuyorsa onu döner; uymuyorsa null (söz LLM'e gider). */
export function komutCoz(soz: string): KomutEslesmesi | null {
  const s = sozuNormalle(soz);
  if (!s) return null;
  if (OTUR.test(s)) return otur();
  if (KALK.test(s)) return kalk();
  if (GEL.test(s)) return gel();
  if (DUR.test(s)) return dur();
  if (BANA_BAK.test(s)) return banaBak();
  if (BILGISAYAR.test(s)) return bilgisayar();

  // "<masa/bilgisayar/sandalye>(y)a git (ve) otur" (ortak test 3: "bilgisayara git otur"):
  // çapasız `otur` zaten masadaki sandalyeye yürür. Başka yerde oturulmaz → LLM'e kalır.
  const gitOtur = GIT_OTUR.exec(s);
  if (gitOtur) {
    const capa = yonelmeCapasi(gitOtur[1]!);
    if (capa === "masa" || capa === "monitor" || capa === "sandalye") return otur();
    return null;
  }

  // "koltuğa otur", "sandalyeye otur", "masaya otur": oturulabilen yer. "tahtaya otur" → LLM'e.
  const oturYer = OTUR_YER.exec(s);
  if (oturYer) {
    const capa = yonelmeCapasi(oturYer[1]!);
    if (capa && OTURULAN.has(capa)) return otur();
  }
  const odaklan = ODAKLAN.exec(s);
  if (odaklan && yonelmeCapasi(odaklan[1]!) === "monitor") return bilgisayar();

  const yakin = GIT_YAKIN.exec(s);
  if (yakin) {
    const capa = iyelikCapasi(yakin[1]!);
    if (capa) return gitCapa(capa);
  }
  const dogru = GIT_DOGRU.exec(s) ?? YAKLAS.exec(s);
  if (dogru) {
    const capa = yonelmeCapasi(dogru[1]!);
    if (capa) return gitCapa(capa);
  }
  const git = GIT.exec(s);
  if (git) {
    const capa = yonelmeCapasi(git[1]!);
    if (capa) return gitCapa(capa);
  }
  const bak = BAK.exec(s);
  if (bak) {
    const capa = yonelmeCapasi(bak[1]!);
    if (capa) return bakCapa(capa);
  }
  if (PENCEREDEN_BAK.test(s)) return bakCapa("pencere");
  return komutCozIng(s);
}
