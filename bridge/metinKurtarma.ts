// bridge/metinKurtarma.ts — Model araç çağrısını METİN olarak yazdıysa ne olur?
//
// GERÇEK HATA (ekran görüntüsüyle belgelendi, 2026-09-13): Orion'un altyazısı
// ve SESİ şuydu:
//
//   orld {"name": "dunya_bak", "arguments": {"hedef": {"tip": "oyuncu"}}} orld
//   {"name": "dunya_jest", "arguments": {"jest": "gülümsüyor", ...}}
//
// Yani model araç çağrılarını düz metin olarak yazdı (adları da bozuk: `orld`),
// ve "düz metin kurtarma" özelliğim onu OLDUĞU GİBİ seslendirdi. Kullanıcı
// JSON dinledi. Kurtarma iyi bir fikirdi ama korumasızdı.
//
// İKİ KATMANLI ÇÖZÜM:
//   1. Metin içinde araç çağrısı varsa ONU KURTAR — niyete çevir. Hatayı
//      eyleme dönüştürmek, sesli okumaktan iyidir.
//   2. Kurtarılamayan araç-benzeri çöp ASLA konuşulmaz. Sessizlik, JSON
//      okumaktan iyidir.
//
// SAF: bağımlılık yok, yan etki yok.
"use strict";

export interface KurtarilanCagri {
  ad: string;
  girdi: Record<string, unknown>;
}

export interface KurtarmaSonucu {
  /** Metinden çıkarılan araç çağrıları. */
  cagrilar: KurtarilanCagri[];
  /** Araç çöpünden arındırılmış, KONUŞULABİLİR metin. Boş olabilir. */
  konusulabilir: string;
}

/** Bilinen araç adı önekleri — bozuk yazımlar buna göre onarılır. */
const ARAC_ONEK = "dunya_";

/**
 * Bozuk araç adını onarır: `orlda_komut`, `world_komut`, `dnya_soyle` gibi
 * sapmalarda ad kısmı genelde sağlamdır. Bilinen adlar listesine göre eşler.
 */
export function adOnar(ham: string, bilinenAdlar: readonly string[]): string | null {
  const t = ham.trim();
  if (bilinenAdlar.includes(t)) return t;
  // Sondan eşleme: "orlda_komut" -> "komut" -> "dunya_komut"
  const alt = t.includes("_") ? t.slice(t.lastIndexOf("_") + 1) : t;
  const aday = ARAC_ONEK + alt;
  return bilinenAdlar.includes(aday) ? aday : null;
}

/** Metinde dengeli süslü parantez bloklarını bulur (iç içe olanlar dahil). */
function jsonBloklari(metin: string): string[] {
  const cikti: string[] = [];
  let derinlik = 0, bas = -1;
  for (let i = 0; i < metin.length; i++) {
    const c = metin[i];
    if (c === "{") { if (derinlik === 0) bas = i; derinlik++; }
    else if (c === "}") {
      derinlik--;
      if (derinlik === 0 && bas >= 0) { cikti.push(metin.slice(bas, i + 1)); bas = -1; }
      if (derinlik < 0) derinlik = 0;
    }
  }
  return cikti;
}

/**
 * Biçim 3 (gemma4 kendi şablonu, kayıtta 2026-10): `dunya_soyle{metin:<|"|>Merhaba<|"|>,ses:true}` — ad süslü
 * parantezin ÖNÜNDE, dizgi ayracı `<|"|>`, anahtarlar tırnaksız. Kurtarıcı tanımıyordu ve kalan
 * `poz:<| |>duruyor<| |>` sesli söyleniyordu (kayıtta gemma'nın 11 böyle uyanışının 9'u).
 * JSON'a çevirir: ayraç → `"`, DİZGİ DIŞINDAKİ çıplak anahtar tırnaklanır (cümle içindeki "saat: 5" bozulmasın).
 */
function sablonJsonu(blok: string): string {
  const s = blok.replace(/<\|"\|>/g, '"');
  let out = "", dizgide = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '"' && s[i - 1] !== "\\") { dizgide = !dizgide; out += c; continue; }
    if (!dizgide && /[A-Za-z_]/.test(c) && /[{,]\s*$/.test(out)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*(?=\s*:)/.exec(s.slice(i));
      if (m) { out += `"${m[0]}"`; i += m[0].length - 1; continue; }
    }
    out += c;
  }
  return out;
}

/** `ad{...}` biçimindeki çağrılar: adın hemen ardından gelen dengeli blok. */
function sablonCagrilari(metin: string): { ham: string; ad: string; blok: string }[] {
  const out: { ham: string; ad: string; blok: string }[] = [];
  const re = /(\w*dunya_[a-z]+)\s*\{/gi;
  for (let m = re.exec(metin); m; m = re.exec(metin)) {
    const bas = m.index + m[0].length - 1;
    let derinlik = 0;
    for (let i = bas; i < metin.length; i++) {
      if (metin[i] === "{") derinlik++;
      else if (metin[i] === "}" && --derinlik === 0) {
        out.push({ ham: metin.slice(m.index, i + 1), ad: m[1]!, blok: metin.slice(bas, i + 1) });
        re.lastIndex = i + 1;
        break;
      }
    }
  }
  return out;
}

/**
 * Modelin düz metninden araç çağrılarını kurtarır ve kalanı temizler.
 *
 * `bilinenAdlar` doğrulama içindir: uydurma bir ada asla dönüşmez.
 */
export function metinKurtar(metin: string, bilinenAdlar: readonly string[]): KurtarmaSonucu {
  const cagrilar: KurtarilanCagri[] = [];
  let kalan = metin;

  for (const c of sablonCagrilari(metin)) {
    const ad = adOnar(c.ad, bilinenAdlar);
    try {
      const arg: unknown = JSON.parse(sablonJsonu(c.blok));
      if (ad && arg && typeof arg === "object" && !Array.isArray(arg)) cagrilar.push({ ad, girdi: arg as Record<string, unknown> });
    } catch { /* çözülemeyen blok da konuşulmaz */ }
    kalan = kalan.replace(c.ham, " ");
  }

  for (const blok of jsonBloklari(kalan)) {
    let j: unknown;
    try { j = JSON.parse(blok); } catch { continue; }
    if (!j || typeof j !== "object") continue;
    const o = j as Record<string, unknown>;

    // Biçim 1: {"name": "...", "arguments": {...}}
    // Biçim 2: {"function": {"name": "...", "arguments": {...}}}
    const ic = (o.function && typeof o.function === "object" ? o.function : o) as Record<string, unknown>;
    const hamAd = typeof ic.name === "string" ? ic.name : null;
    if (!hamAd) continue;

    const ad = adOnar(hamAd, bilinenAdlar);
    const arg = ic.arguments ?? ic.args ?? {};
    if (ad && arg && typeof arg === "object" && !Array.isArray(arg)) {
      cagrilar.push({ ad, girdi: arg as Record<string, unknown> });
    }
    // Kurtarılsın ya da kurtarılmasın, bu blok KONUŞULMAZ.
    kalan = kalan.replace(blok, " ");
  }

  // Araç adı kırıntıları ve bozuk önekler ("orld", "dunya_bak" gibi) temizlenir.
  let konusulabilir = kalan
    .replace(/<\|[^|]*\|>/g, " ")
    .replace(/\b\w*dunya_[a-zçğıöşü]+\b/gi, " ")
    .replace(/\borld\b|\bworld\b/gi, " ")
    .replace(/["{}\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Geriye anlamlı bir cümle kalmadıysa KONUŞMA. Sessizlik JSON'dan iyidir.
  if (konusulabilir.length < 8 || !/[a-zçğıöşüA-ZÇĞİÖŞÜ]{3}/.test(konusulabilir)) {
    konusulabilir = "";
  }
  return { cagrilar, konusulabilir };
}

/**
 * Bu metin araç çöpü mü? (kurtarma denemeden önce hızlı kontrol)
 * Konuşma yolunda son savunma: doğru bir cümle gibi görünmeyen şey duyulmaz.
 */
export function aracCopuMu(metin: string): boolean {
  return /\{\s*"(name|function|arguments)"/.test(metin) || /\bdunya_[a-z]+\s*\(/i.test(metin);
}
