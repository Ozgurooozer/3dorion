// mind/ortamKomutlari.ts — Doğuştan ORTAM komutları: "gece yap", "saat 21", "ışığı kıs", "toon yap" (token'sız).
//
// `komutSozlugu.ts`in ailesi (aynı ilke: sözün TAMAMI bir kalıba uymalı; yanlış eşleşme sessizlikten pahalıdır),
// yeni bir niyet için: `ortam` (protocol/niyet.ts). Orion'un LLM aracıyla (`dunya_ortam`) AYNI niyeti üretir, yani
// dünya tarafı farkı bilmez; fark yalnız maliyet: burada 0 token, ~0 ms.
//
// Girdi `sozuNormalle` çıktısıdır (katlanmış, noktalamasız, dolgusuz: "Işığı biraz kıs" → "isigi kis"). Burada
// katlama/dolgu tekrar yapılmaz. Saf: protocol/ dışında bağımlılık yok.
//
// BİLEREK EŞLEŞMEYENLER (LLM'e gider): belirsiz sözler ("hava güzel", "çok karanlık", "kış" tek başına), soru ("saat
// kaç?"), olumsuz/koşullu ("ışığı kısma"), birden çok istek ("gece yap ve ışığı kıs"). Çıplak "kıs"/"aç" yok: "kış"
// (katlanınca "kis") ve "aç" (aç/ac) yüzünden ışık sözcüğü ya da "daha" şart. "gündüz yap" ZAMAN, "gündüz renkleri" RENK.
"use strict";
import type { Niyet, OrtamNe } from "../protocol/niyet.ts";
import type { KomutEslesmesi } from "./komutSozlugu.ts";

const ortam = (ne: OrtamNe, deger?: string, sayi?: number): KomutEslesmesi => ({
  program: "komut:ortam",
  adimlar: [{ tur: "ortam", ne, ...(deger !== undefined ? { deger } : {}), ...(sayi !== undefined ? { sayi } : {}) } as Niyet],
});

/** Saat/dakika → 0–24 ondalık; geçersizse null (söz LLM'e gider). */
function saatSayisi(h: number, m = 0): number | null {
  return Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h <= 24 && m >= 0 && m < 60 ? h + m / 60 : null;
}
/** 12 saatlik: 12 am = 0, 12 pm = 12. */
function saat12(h: number, m: number, ek: string): number | null {
  if (h < 1 || h > 12) return null;
  return saatSayisi((h % 12) + (ek === "pm" ? 12 : 0), m);
}

// ── Zaman ──────────────────────────────────────────────────────────────────

/** Günün adı → saat. Ova'nın palet kareleri: 0 gece · 5,5 şafak · 12 öğle · 18,5 gün batımı · 20,5 alacakaranlık. */
const GUN_ADI_SAATI: Readonly<Record<string, number>> = {
  "gece yarisi": 0, gece: 0, "gun dogumu": 5.5, sabah: 8, ogle: 12, gunduz: 13, "ogleden sonra": 15,
  "gun batimi": 18.5, aksam: 19.5,
};
const TR_GUN_ADI = "gece yarisi|gun batimi|gun dogumu|ogleden sonra|gunduz|gece|aksam|sabah|ogle";
/** "gece yap", "geceye cevir", "aksama getir", "sabah olsun" (ek: ye/ya/e/a). */
const GUN_ADI_YAP = new RegExp(`^(${TR_GUN_ADI})(?:ye|ya|e|a)? (?:yap|yapsana|olsun|olsana|ol|cevir|cevirsene|getir|getirsene)$`);
const EN_GUN_ADI_SAATI: Readonly<Record<string, number>> = {
  night: 0, nighttime: 0, midnight: 0, dawn: 5.5, sunrise: 5.5, morning: 8, noon: 12, day: 13, daytime: 13,
  afternoon: 15, sunset: 18.5, evening: 19.5, dusk: 20.5,
};
const EN_GUN_ADI = new RegExp(`^(?:make it|set it to|turn it into|turn it to|change it to|set the time to|make it be) (${Object.keys(EN_GUN_ADI_SAATI).join("|")})$`);

/** "saat 21", "saat 21 30", "saati 9 yap", "saati 21 ayarla", "saat 9 olsun" */
const SAAT_TR = /^saati? (\d{1,2})(?: (\d{2}))?(?: (?:yap|yapsana|olsun|olsana|ayarla|ayarlasana|olarak ayarla))?$/;
/** "21 30 yap" ("21:30 yap"). Yalnız yap/olsun ile: çıplak "21 30" bir saat mi sayı mı belli değil. */
const SAAT_ILE_YAP = /^(\d{1,2}) (\d{2}) (?:yap|yapsana|olsun)$/;
/** "3pm yap", "3 pm", "saati 3 pm yap", "9 30 am olsun" */
const SAAT_12 = /^(?:saati? )?(\d{1,2})(?: (\d{2}))? ?(am|pm)(?: (?:yap|yapsana|olsun|olsana|ayarla))?$/;
const EN_SAAT = /^(?:set (?:the )?(?:time|clock) to|change (?:the )?time to|time to) (\d{1,2})(?: (\d{2}))?(?: ?(am|pm))?$|^(?:make it|set it to) (\d{1,2})(?: (\d{2}))? ?(am|pm)$/;
/** "saati 2 saat ileri al", "saati ileri al" (1), "3 saat geri al", "zamani ileri sar" */
const KAYDIR_TR = /^(?:saati|zamani) (?:(\d{1,2}) saat )?(ileri|geri) (?:al|sar|at|cek|kaydir|alsana|sarsana)$/;
/** "2 saat ileri al" (çıplak "geri al" geri-al/undo anlamına gelir: sayı ya da "saati" şart). */
const KAYDIR_TR_SAYILI = /^(\d{1,2}) saat (ileri|geri) (?:al|sar|at|cek|kaydir)$/;
const KAYDIR_EN_ILERI = /^(?:skip|advance|fast forward|jump|move time forward|move the time forward)(?: time| the time| the clock)?(?: ahead| forward)?(?: by)? (\d{1,2}) hours?$/;
const KAYDIR_EN_GERI = /^(?:go back|rewind|move time back|move the time back|turn back time|go backwards?)(?: time| the time| the clock)?(?: by)? (\d{1,2}) hours?$/;
const AKIS_AC = /^(?:zamani |zaman )(?:akit|baslat|akitsana|aksin|aksana|akmaya birak)$/;
const AKIS_KAPAT = /^(?:zamani |zaman )(?:durdur|dondur|durdursana|dursun|dursana|sabitle)$/;
const EN_AKIS = /^(let time flow|start time|resume time|unfreeze time)$/;
const EN_AKIS_DUR = /^(stop time|freeze time|pause time|stop the clock)$/;

// ── Işık ───────────────────────────────────────────────────────────────────

const ISIK_KIS = /^(?:isigi|isiklari|isik|ortami|ortamin isigini|dunyanin isigini) (?:kis|azalt|alcalt|dusur|karart|bastir|kissana|azaltsana)$/;
const DAHA_KIS = /^daha (?:kis|kisik|az isik|karanlik|karanlik yap|karanlik olsun)$/;
const ISIK_AC = /^(?:isigi|isiklari|isik|ortami|ortamin isigini|dunyanin isigini) (?:ac|arttir|yukselt|artir|acsana|aydinlat|parlat)$/;
const DAHA_AC = /^daha (?:aydinlik|aydinlik yap|aydinlik olsun|cok isik|parlak|parlak yap)$/;
const ORTAMI_KARART = /^(?:ortami|dunyayi|her yeri) (?:karart|karartsana)$/;
const ORTAMI_AYDINLAT = /^(?:ortami|dunyayi|her yeri) (?:aydinlat|aydinlatsana)$/;
// Çıplak "soguk"/"sicak" bir tespittir ("soğuk."), komut değil: "daha" ya da "yap/olsun" ya da "tonlar/renkler" şart.
const SICAK_SOGUK = /^(?:(?:isigi|renkleri|ortami|tonlari|gorunumu) )?daha (sicak|soguk)(?: tonlar| renkler| renkleri| tonlari)?(?: yap| olsun| yapsana| olsana)?$|^(?:(?:isigi|renkleri|ortami|tonlari|gorunumu) )?(sicak|soguk)(?: tonlar| renkler| renkleri| tonlari)? (?:yap|olsun|yapsana|olsana)$|^(sicak|soguk) (?:tonlar|renkler|renkleri|tonlari)$/;
const SICAKLASTIR = /^(?:isigi|renkleri|ortami|tonlari|gorunumu) (sicaklastir|isit|sogut|soguklastir)$/;
const EN_KIS = /^(?:dim (?:the )?(?:lights?|light|world|room)|make it darker|darker|lights down|turn (?:the )?lights? down|lower (?:the )?lights?|less light|reduce (?:the )?light)$/;
const EN_AC = /^(?:brighten(?: it| the (?:light|world|room))?|make it brighter|brighter|lights up|turn (?:the )?lights? up|raise (?:the )?lights?|more light|increase (?:the )?light)$/;
const EN_SICAK_SOGUK = /^(?:make (?:it|the (?:light|lights|world|colors|colours))|set it) (warmer|cooler|colder)$/;

// ── Stil, renk, sıfırlama ──────────────────────────────────────────────────

/** Stil adı + takma adlar (katlanmış): "anime 90" → anime90, "normal" → standart. */
const STIL_ADLARI: Readonly<Record<string, string>> = {
  standart: "standart", normal: "standart", cel: "cel", toon: "toon", anime90: "anime90", "anime 90": "anime90",
  moebius: "moebius", piksel: "piksel", pixel: "piksel", "piksel sanat": "piksel",
};
const STIL_ALT = Object.keys(STIL_ADLARI).sort((a, b) => b.length - a.length).join("|");
const STIL_A = new RegExp(`^(?:stili?|gorunumu|tarzi) (${STIL_ALT})(?: yap| yapsana| olsun| olsana)?$`);
const STIL_B = new RegExp(`^(${STIL_ALT}) (?:stili|stil|tarzi|gorunumu)$`);
const STIL_C = new RegExp(`^(${STIL_ALT})(?: stili| stil| tarzi| gorunumu)? (?:yap|yapsana|olsun|olsana)$`);
const EN_STIL = new RegExp(`^(?:set (?:the )?style to|use (?:the )?|switch to (?:the )?|make it|change (?:the )?style to) ?(${STIL_ALT})(?: style| look)?$|^(${STIL_ALT}) (?:style|look)$`);
const STIL_SIFIRLA = /^(?:stili|stil|gorunumu) (?:sifirla|eski haline getir|normale dondur|normale cevir)$/;
/** "pastel yap", "renkleri pastel yap", "pastel renkler", "gunduz renkleri" (renk düzeni; "gunduz yap" ZAMANDIR). */
const RENK_YAP = /^(?:renkleri |renk duzenini |gok rengini |gogu )?pastel(?: renkler| renkleri| renk duzeni)? (?:yap|yapsana|olsun|olsana)$|^pastel (?:renkler|renkleri|renk duzeni)$/;
const RENK_GUNDUZ = /^(?:renkleri |renk duzenini )?gunduz (?:renkleri|renkler|renk duzeni)(?: yap| olsun)?$|^(?:renkleri|renk duzenini) gunduz (?:yap|olsun|yapsana)$/;
const EN_RENK = /^(?:make it |use (?:the )?|set (?:the )?colou?rs to )?(pastel|daytime|day) (?:colou?rs|palette)$/;
const SIFIRLA = /^(?:ortami|dunyayi|ovayi|gorunumu|her seyi|isigi ve stili|isik ve stili) (?:sifirla|eski haline getir|varsayilana dondur|varsayilana al|eskisi gibi yap|ilk haline getir)$|^(?:varsayilana don|eski haline don)$/;
const EN_SIFIRLA = /^(?:reset (?:the )?(?:world|look|style|lighting|light|environment|scene)(?: and style)?|restore (?:the )?(?:world|look|defaults?)|back to default|go back to default)$/;

// ── Sis ────────────────────────────────────────────────────────────────────

const SIS_AC = /^(?:sis|sisi|sis i) (?:ac|koy|ekle|baslat|olsun|acsana)$/;
const SIS_KAPAT = /^(?:sis|sisi|sis i) (?:kapat|kaldir|sil|yok et|durdur|kapatsana)$|^sis yok$/;
const SIS_YOGUN = /^(?:sisi |sis i )?(?:yogunlastir|arttir|artir|kalinlastir)$|^daha (?:cok|fazla) sis$|^sisi (?:yogunlastir|arttir|artir)$/;
const SIS_HAFIF = /^(?:sisi |sis i )?(?:azalt|hafiflet|inceltsin|inceltsene|seyrelt)$|^daha az sis$|^sisi (?:azalt|hafiflet|seyrelt)$/;
const EN_SIS_AC = /^(?:turn on (?:the )?fog|fog on|add (?:some )?fog|enable (?:the )?fog|make it foggy)$/;
const EN_SIS_KAPAT = /^(?:turn off (?:the )?fog|fog off|remove (?:the )?fog|disable (?:the )?fog|no fog)$/;
const EN_SIS_YOGUN = /^(?:more fog|thicker fog|increase (?:the )?fog|denser fog)$/;
const EN_SIS_HAFIF = /^(?:less fog|thinner fog|reduce (?:the )?fog|lighter fog)$/;

// ── Efekt ve shader (aç/kapat) ─────────────────────────────────────────────

/** Efekt adı → [yazılışlar]; hal ekleri ("bloomu", "huzmeyi") ek olarak ayrı kelime gelir ("bloom u"). */
const EFEKTLER: Readonly<Record<string, readonly string[]>> = {
  bloom: ["bloom", "blum"],
  huzme: ["huzme", "isik huzmesi", "isik huzmeleri"],
  parilti: ["parilti", "parlama"],
  vinyet: ["vinyet", "vignette"],
  gren: ["gren", "film greni", "grain"],
  sapma: ["sapma", "renk sapmasi"],
  // "derinliği"/"keskinliği": hal eki ünsüz yumuşatır (k → g), kök + EK ile yakalanmaz.
  keskinlik: ["keskinlik", "keskinligi"],
  derinlik: ["derinlik", "derinligi", "alan derinligi", "bulaniklik", "bulanikligi"],
  ao: ["ao", "ambient occlusion"],
  gi: ["gi", "global isik"],
  egri: ["renk egrisi", "egri"],
};
const SHADERLAR: Readonly<Record<string, readonly string[]>> = {
  atmosfer: ["atmosfer"], gokZamani: ["gok zamani", "gok zaman"], paletHaritasi: ["palet haritasi"], zamanKirigi: ["zaman kirigi"],
  hataImzasi: ["hata imzasi"], debugTarama: ["debug tarama"], firca: ["firca", "firca darbesi"], elyazmasi: ["el yazmasi", "elyazmasi"],
};
/** Hal eki kelime olarak ayrılmış ("bloom u", "atmosfer i"): isteğe bağlı. */
const EK = "(?: ?(?:u|yu|i|yi|nu|ni|si|sini|ini))?";
const ACKAPA_TR = "(ac|kapat|ekle|kaldir|durdur|baslat|devre disi birak|etkinlestir|ac sana|kapatsana|acsana)";
const AC_FIILLER = new Set(["ac", "ekle", "baslat", "etkinlestir", "ac sana", "acsana"]);
const ACKAPA_EN = "(on|off)";

function adDesenleri(harita: Readonly<Record<string, readonly string[]>>): [string, RegExp][] {
  return Object.entries(harita).map(([ad, yazilislar]) => {
    const alt = yazilislar.join("|");
    return [ad, new RegExp(`^(?:${alt})${EK}(?: efektini| efekti| shaderini| shader)? ${ACKAPA_TR}$`)] as [string, RegExp];
  });
}
const EFEKT_DESENLERI = adDesenleri(EFEKTLER);
const SHADER_DESENLERI = adDesenleri(SHADERLAR);
const EN_EFEKT = (harita: Readonly<Record<string, readonly string[]>>): [string, RegExp][] => Object.entries(harita).map(([ad, y]) => [ad, new RegExp(
  `^(?:(turn on|turn off|enable|disable) (?:the )?(?:${y.join("|")})(?: effect| shader)?|(?:${y.join("|")})(?: effect| shader)? ${ACKAPA_EN})$`)] as [string, RegExp]);
const EN_EFEKT_DESENLERI = EN_EFEKT(EFEKTLER);
const EN_SHADER_DESENLERI = EN_EFEKT(SHADERLAR);

// ── Dünya (palet seti) ─────────────────────────────────────────────────────

const DUNYA_ADLARI: Readonly<Record<string, string>> = { ova: "ova", siberpunk: "siberpunk", cyberpunk: "siberpunk", ortacag: "ortacag", buyu: "buyu", "buyulu": "buyu" };
const DUNYA_ALT = Object.keys(DUNYA_ADLARI).join("|");
const DUNYA_A = new RegExp(`^(?:dunyayi|dunya|ortami) (${DUNYA_ALT})(?: yap| olsun| yapsana)$`);
const DUNYA_B = new RegExp(`^(${DUNYA_ALT}) (?:dunyasi|dunya|dunyasina gec|dunyasini ac|dunyasi olsun)$`);
const EN_DUNYA = new RegExp(`^(?:switch to|go to|make it|set (?:the )?world to) (${DUNYA_ALT}) (?:world|mode)$|^(${DUNYA_ALT}) world$`);

const adim = (m: RegExpExecArray, g = 1): number => Number(m[g]);

/** Normalleştirilmiş söz bir doğuştan ORTAM komutuna TAMAMEN uyuyorsa onu döner; yoksa null. */
export function ortamCoz(s: string): KomutEslesmesi | null {
  // ── zaman ──
  const gunAdi = GUN_ADI_YAP.exec(s);
  if (gunAdi) return ortam("saat", undefined, GUN_ADI_SAATI[gunAdi[1]!]!);
  const enGunAdi = EN_GUN_ADI.exec(s);
  if (enGunAdi) return ortam("saat", undefined, EN_GUN_ADI_SAATI[enGunAdi[1]!]!);

  const saatTr = SAAT_TR.exec(s) ?? SAAT_ILE_YAP.exec(s);
  if (saatTr) {
    const v = saatSayisi(adim(saatTr), saatTr[2] ? adim(saatTr, 2) : 0);
    return v === null ? null : ortam("saat", undefined, v);
  }
  const s12 = SAAT_12.exec(s);
  const enSaat = EN_SAAT.exec(s);
  const sg = s12 ?? enSaat;
  if (sg) {
    // EN_SAAT'ın iki kolu var: gruplar (1-3) ya da (4-6).
    const [h, d, ek] = s12 ? [sg[1], sg[2], sg[3]] : sg[1] !== undefined ? [sg[1], sg[2], sg[3]] : [sg[4], sg[5], sg[6]];
    const m = d ? Number(d) : 0;
    const v = ek ? saat12(Number(h), m, ek) : saatSayisi(Number(h), m);
    return v === null ? null : ortam("saat", undefined, v);
  }
  const kaydir = KAYDIR_TR.exec(s);
  if (kaydir) return ortam("saat_kaydir", undefined, (kaydir[1] ? adim(kaydir) : 1) * (kaydir[2] === "geri" ? -1 : 1));
  const kaydirSayili = KAYDIR_TR_SAYILI.exec(s);
  if (kaydirSayili) return ortam("saat_kaydir", undefined, adim(kaydirSayili) * (kaydirSayili[2] === "geri" ? -1 : 1));
  const enIleri = KAYDIR_EN_ILERI.exec(s);
  if (enIleri) return ortam("saat_kaydir", undefined, adim(enIleri));
  const enGeri = KAYDIR_EN_GERI.exec(s);
  if (enGeri) return ortam("saat_kaydir", undefined, -adim(enGeri));
  if (AKIS_AC.test(s) || EN_AKIS.test(s)) return ortam("akis", "ac");
  if (AKIS_KAPAT.test(s) || EN_AKIS_DUR.test(s)) return ortam("akis", "kapat");

  // ── ışık ──
  if (ISIK_KIS.test(s) || DAHA_KIS.test(s) || ORTAMI_KARART.test(s) || EN_KIS.test(s)) return ortam("isik", "kis");
  if (ISIK_AC.test(s) || DAHA_AC.test(s) || ORTAMI_AYDINLAT.test(s) || EN_AC.test(s)) return ortam("isik", "ac");
  const sicak = SICAK_SOGUK.exec(s);
  if (sicak) return ortam("isik", (sicak[1] ?? sicak[2] ?? sicak[3]) === "sicak" ? "sicak" : "soguk");
  const enSicak = EN_SICAK_SOGUK.exec(s);
  if (enSicak) return ortam("isik", enSicak[1] === "warmer" ? "sicak" : "soguk");
  const sicaklastir = SICAKLASTIR.exec(s);
  if (sicaklastir) return ortam("isik", sicaklastir[1] === "sicaklastir" || sicaklastir[1] === "isit" ? "sicak" : "soguk");

  // ── stil, renk, sıfırla ──
  if (SIFIRLA.test(s) || EN_SIFIRLA.test(s)) return ortam("sifirla");
  if (STIL_SIFIRLA.test(s)) return ortam("stil", "standart");
  const stil = STIL_A.exec(s) ?? STIL_B.exec(s) ?? STIL_C.exec(s) ?? EN_STIL.exec(s);
  if (stil) return ortam("stil", STIL_ADLARI[(stil[1] ?? stil[2])!]!);
  if (RENK_GUNDUZ.test(s) || EN_RENK.exec(s)?.[1] === "daytime" || EN_RENK.exec(s)?.[1] === "day") return ortam("renk", "gunduz");
  if (RENK_YAP.test(s) || EN_RENK.exec(s)?.[1] === "pastel") return ortam("renk", "pastel");

  // ── sis ──
  if (SIS_YOGUN.test(s) || EN_SIS_YOGUN.test(s)) return ortam("sis", "yogun");
  if (SIS_HAFIF.test(s) || EN_SIS_HAFIF.test(s)) return ortam("sis", "hafif");
  if (SIS_AC.test(s) || EN_SIS_AC.test(s)) return ortam("sis", "ac");
  if (SIS_KAPAT.test(s) || EN_SIS_KAPAT.test(s)) return ortam("sis", "kapat");

  // ── efekt / shader (aç, kapat) ──
  for (const [ad, d] of EFEKT_DESENLERI) {
    const m = d.exec(s);
    if (m) return ortam("efekt", `${ad}:${AC_FIILLER.has(m[1]!) ? "ac" : "kapat"}`);
  }
  for (const [ad, d] of SHADER_DESENLERI) {
    const m = d.exec(s);
    if (m) return ortam("shader", `${ad}:${AC_FIILLER.has(m[1]!) ? "ac" : "kapat"}`);
  }
  for (const [ad, d] of EN_EFEKT_DESENLERI) {
    const m = d.exec(s);
    if (m) return ortam("efekt", `${ad}:${(m[1] ?? "").startsWith("turn on") || m[1] === "enable" || m[2] === "on" ? "ac" : "kapat"}`);
  }
  for (const [ad, d] of EN_SHADER_DESENLERI) {
    const m = d.exec(s);
    if (m) return ortam("shader", `${ad}:${(m[1] ?? "").startsWith("turn on") || m[1] === "enable" || m[2] === "on" ? "ac" : "kapat"}`);
  }

  // ── dünya ──
  const dunya = DUNYA_A.exec(s) ?? DUNYA_B.exec(s) ?? EN_DUNYA.exec(s);
  if (dunya) return ortam("dunya", DUNYA_ADLARI[(dunya[1] ?? dunya[2])!]!);
  return null;
}
