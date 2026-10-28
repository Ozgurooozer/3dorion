// host/proje.js — PROJE (spec 39 D1): MOTOR ile PROJE ayrı (Unreal gibi). Saf Node (fs + path).
//
// MOTOR = repo/kurulum (kod, shader, editör, başlangıç içeriği `assets/`, şablon level'lar). PROJE = Ozyn'in içeriği, Belgeler'de:
//   Belgeler/3dorion Projeleri/<Ad>/<Ad>.orionproj · Content/{Levels,Characters,Animations,Sequences,Graphs,NPC,Assets} · Saved/
// ORION MOTORDADIR (Ozyn 2026-10-27): hafıza, md notları, karar kaydı, ses/beyin ayarı userData'da kalır; projeye yalnız içerik girer.
//
// KURALLAR (proje.test.ts):
//   1. `.orionproj` EN SON yazılır (atomik): yarıda kalan oluşturma listede proje gibi görünmez.
//   2. OLUŞTUR yalnız yoksa (`var`); şablon ve göç KOPYALAR, kaynağa dokunmaz, var olan dosyanın üstüne yazmaz (repodaki `ova.level.json` şablondur,
//      projeye kopyası gider; eski `<userData>/orion-sekans|graf|npc` silinmez).
//   3. AD: harf/rakam ile başlar; harf, rakam, boşluk, _ ve -; en çok 48; Windows'un ayrılmış adları (CON, NUL…) yasak — klasör adıdır.
//   4. Kök: `ORION_PROJELER_KOKU` > senaryo koşusu (`ORION_SMOKE=1`: geçici kök, gerçek projeye yazılmaz) > Belgeler/3dorion Projeleri.
//   5. Seçim: `ORION_PROJE` > son açılan (hâlâ varsa) > listedeki ilk > yok (çağıran ilk projeyi oluşturur).
import fs from "node:fs";
import path from "node:path";
import { atomikYaz, kodluHata } from "./dosyaKlasoru.js";

export const PROJE_UZANTISI = ".orionproj";
export const PROJE_SURUMU = 1;
export const PROJELER_KLASORU = "3dorion Projeleri";
export const ICERIK = "Content";
export const KAYITLI = "Saved";
/** İçerik türü → Content altındaki klasör (Unreal adları: Content Browser'da Ozyn bunları görür). */
export const ICERIK_KLASORLERI = Object.freeze({
  level: "Levels", karakter: "Characters", animasyon: "Animations", sekans: "Sequences", graf: "Graphs", npc: "NPC", asset: "Assets",
});
const SON_TAVAN = 10;
const AYRILMIS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export const projeAdiGecerli = (ad) =>
  typeof ad === "string" && /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,47}$/u.test(ad) && !/ $/.test(ad) && !AYRILMIS.test(ad);

/** Projeler kökü (kural 4). */
export function projelerKoku(env, belgeler, gecici) {
  if (env.ORION_PROJELER_KOKU) return env.ORION_PROJELER_KOKU;
  if (env.ORION_SMOKE === "1") return path.join(gecici, "3dorion-projeler-deneme");
  return path.join(belgeler, PROJELER_KLASORU);
}

/** `.orionproj` içeriği doğru mu; yanlışsa neden (metin), doğruysa null. */
export function projeTanimiHatasi(t) {
  if (!t || typeof t !== "object" || Array.isArray(t)) return "nesne değil";
  if (t.surum !== PROJE_SURUMU) return `bilinmeyen sürüm: ${JSON.stringify(t.surum)}`;
  if (!projeAdiGecerli(t.ad)) return `geçersiz ad: ${JSON.stringify(t.ad)}`;
  if (typeof t.varsayilanLevel !== "string" || !t.varsayilanLevel) return "varsayilanLevel yok";
  if (typeof t.olusturuldu !== "number") return "olusturuldu yok";
  return null;
}

const tanimYolu = (dizin, ad) => path.join(dizin, `${ad}${PROJE_UZANTISI}`);

/** Açık projenin bilgisi (renderer'a da bu gider). */
function bilgi(dizin, tanim) {
  return { ad: tanim.ad, dizin, icerik: path.join(dizin, ICERIK), kayitli: path.join(dizin, KAYITLI), varsayilanLevel: tanim.varsayilanLevel, tanim };
}

/** Kökteki projeler: `<ad>/<ad>.orionproj` olan klasörler, ada göre. Bozuk tanım listede `hata` ile görünür (sessizce kaybolmaz). */
export function projeListe(kok) {
  if (!fs.existsSync(kok)) return [];
  const sonuc = [];
  for (const d of fs.readdirSync(kok, { withFileTypes: true })) {
    if (!d.isDirectory() || !projeAdiGecerli(d.name)) continue;
    const dizin = path.join(kok, d.name), y = tanimYolu(dizin, d.name);
    if (!fs.existsSync(y)) continue;
    const degisti = Math.round(fs.statSync(y).mtimeMs);
    try {
      const t = JSON.parse(fs.readFileSync(y, "utf8"));
      const h = projeTanimiHatasi(t) ?? (t.ad !== d.name ? `ad klasörle uyuşmuyor: ${t.ad}` : null);
      sonuc.push(h ? { ad: d.name, dizin, degisti, hata: h } : { ad: d.name, dizin, degisti });
    } catch (e) { sonuc.push({ ad: d.name, dizin, degisti, hata: `okunamadı: ${e.message}` }); }
  }
  return sonuc.sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
}

/** Projeyi açar (tanımı okur, doğrular). Yoksa `yok`, bozuksa `bozuk`. */
export function projeAc(kok, ad) {
  if (!projeAdiGecerli(ad)) throw kodluHata("gecersiz-ad", `geçersiz proje adı: ${JSON.stringify(ad)}`);
  const dizin = path.join(kok, ad), y = tanimYolu(dizin, ad);
  if (!fs.existsSync(y)) throw kodluHata("yok", `proje yok: ${ad}`);
  let t;
  try { t = JSON.parse(fs.readFileSync(y, "utf8")); } catch (e) { throw kodluHata("bozuk", `proje tanımı okunamadı: ${e.message}`); }
  const h = projeTanimiHatasi(t);
  if (h) throw kodluHata("bozuk", `proje tanımı bozuk: ${h}`);
  return bilgi(dizin, t);
}

/** Bir içerik türünün klasörü (bilinmeyen tür hatadır: yazım yanlışı sessiz yeni klasör doğurmasın). */
export function icerikDizini(proje, tur) {
  const k = ICERIK_KLASORLERI[tur];
  if (!k) throw kodluHata("gecersiz-tur", `bilinmeyen içerik türü: ${tur}`);
  return path.join(proje.icerik, k);
}

/**
 * Klasörü/dosyayı kopyalar; VAR OLANIN ÜSTÜNE YAZMAZ, `.silinenler` ve `.tmp` atlanır. Kopyalanan dosya sayısını döner.
 * Kaynak yoksa 0 (göç kaynağı olmayabilir: ilk kurulum).
 */
export function kopyala(kaynak, hedef) {
  if (!fs.existsSync(kaynak)) return 0;
  const s = fs.statSync(kaynak);
  if (s.isFile()) {
    if (fs.existsSync(hedef)) return 0;
    fs.mkdirSync(path.dirname(hedef), { recursive: true });
    fs.copyFileSync(kaynak, hedef, fs.constants.COPYFILE_EXCL);
    return 1;
  }
  let n = 0;
  for (const ad of fs.readdirSync(kaynak)) {
    if (ad === ".silinenler" || ad.endsWith(".tmp")) continue;
    n += kopyala(path.join(kaynak, ad), path.join(hedef, ad));
  }
  return n;
}

/**
 * Yeni proje. `sablon`: `{ varsayilanLevel, kopyalar: [{ kaynak, hedef }], yazilacaklar: [{ hedef, metin }] }` — hedefler Content'e göre.
 * `goc`: aynı biçimde ek kopyalar (eski userData klasörleri). Varsa `var`.
 */
export function projeOlustur(kok, ad, sablon, { goc = [], simdi = Date.now, motorSurumu = "" } = {}) {
  if (!projeAdiGecerli(ad)) throw kodluHata("gecersiz-ad", `geçersiz proje adı: ${JSON.stringify(ad)} (harf, rakam, boşluk, _ ve -; en çok 48)`);
  const dizin = path.join(kok, ad);
  if (fs.existsSync(dizin)) throw kodluHata("var", `zaten var: ${ad}`);
  const icerik = path.join(dizin, ICERIK);
  for (const k of Object.values(ICERIK_KLASORLERI)) fs.mkdirSync(path.join(icerik, k), { recursive: true });
  fs.mkdirSync(path.join(dizin, KAYITLI), { recursive: true });
  let kopyalanan = 0;
  for (const k of [...(sablon.kopyalar ?? []), ...goc]) kopyalanan += kopyala(k.kaynak, path.join(icerik, k.hedef));
  for (const y of sablon.yazilacaklar ?? []) {
    const h = path.join(icerik, y.hedef);
    if (fs.existsSync(h)) continue;
    fs.mkdirSync(path.dirname(h), { recursive: true });
    atomikYaz(h, y.metin);
  }
  const tanim = { surum: PROJE_SURUMU, ad, motorSurumu, varsayilanLevel: sablon.varsayilanLevel, olusturuldu: simdi() };
  atomikYaz(tanimYolu(dizin, ad), `${JSON.stringify(tanim, null, 2)}\n`);   // EN SON (kural 1)
  return { ...bilgi(dizin, tanim), kopyalanan };
}

/** `<userData>/projeler.json`: son açılanlar. Bozuk/yok dosya boş liste (açılışı durdurmaz). */
export function sonProjelerOku(yol) {
  try {
    const v = JSON.parse(fs.readFileSync(yol, "utf8"));
    const gecmis = Array.isArray(v?.gecmis) ? v.gecmis.filter(projeAdiGecerli).slice(0, SON_TAVAN) : [];
    return { gecmis };
  } catch { return { gecmis: [] }; }
}

/** Açılan projeyi listenin başına alır (tekrar yok, en çok 10). */
export function sonProjeYaz(yol, ad) {
  const { gecmis } = sonProjelerOku(yol);
  const yeni = [ad, ...gecmis.filter((x) => x !== ad)].slice(0, SON_TAVAN);
  fs.mkdirSync(path.dirname(yol), { recursive: true });
  atomikYaz(yol, `${JSON.stringify({ gecmis: yeni }, null, 2)}\n`);
  return yeni;
}

/** Açılacak projenin adı (kural 5) ya da null. Bozuk projeler seçilmez. */
export function projeSec(env, kok, sonYolu) {
  const saglam = projeListe(kok).filter((p) => !p.hata).map((p) => p.ad);
  if (env.ORION_PROJE) {
    if (!saglam.includes(env.ORION_PROJE)) throw kodluHata("yok", `ORION_PROJE bulunamadı ya da bozuk: ${env.ORION_PROJE} (kök: ${kok})`);
    return env.ORION_PROJE;
  }
  return sonProjelerOku(sonYolu).gecmis.find((a) => saglam.includes(a)) ?? saglam[0] ?? null;
}

/**
 * Açılışta projeyi hazırlar: seçer; hiç yoksa `ilkAd` adıyla şablondan (+ göç) OLUŞTURUR. Son açılanlara yazar.
 * Dönüş: proje bilgisi + `olusturuldu` (bu açılışta mı doğdu) + `kopyalanan`.
 */
export function projeHazirla({ env, kok, sonYolu, ilkAd, sablon, goc, simdi, motorSurumu }) {
  const ad = projeSec(env, kok, sonYolu);
  let p;
  if (ad) p = { ...projeAc(kok, ad), olusturuldu: false, kopyalanan: 0 };
  else p = { ...projeOlustur(kok, ilkAd, sablon, { goc, simdi, motorSurumu }), olusturuldu: true };
  sonProjeYaz(sonYolu, p.ad);
  return p;
}

// ── ŞABLONLAR ve DURUM (spec 39 D2) ─────────────────────────────────────────────

/** Yeni proje şablonları: `ofis` = ofis + Ozyn'in ovası (varsayılan), `bos` = ofis + boş ova. İkisinde de Orion'un beden tanımı gelir. */
export const SABLON_ADLARI = Object.freeze(["ofis", "bos"]);

const ORION_KARAKTERI = () => ({
  hedef: path.join("Characters", "Orion", "Orion.karakter.json"),
  // Beden motorun `assets/`indedir ("Engine/"): ikinci kopya iki bedeni ayrıştırırdı.
  metin: `${JSON.stringify({ tur: "karakter", ad: "Orion", beden: "Engine/orion-lowpoly.glb", iskelet: "kanonik" }, null, 2)}\n`,
});

/**
 * Şablon tanımı. `motorKoku` repo/kurulum kökü: level şablonları oradan KOPYALANIR (motorun dosyasına dokunulmaz).
 * Bilinmeyen şablon `gecersiz-sablon` (yazım yanlışı sessizce başka şablon açmasın).
 */
export function projeSablonu(ad, motorKoku) {
  const level = (varsayilan, dosya) => ({ kaynak: path.join(motorKoku, "world", "level", ...dosya), hedef: path.join("Levels", varsayilan, `${varsayilan}.level.json`) });
  if (ad === "ofis") return { varsayilanLevel: "ova", kopyalar: [level("ova", ["ova", "ova.level.json"])], yazilacaklar: [ORION_KARAKTERI()] };
  if (ad === "bos") return { varsayilanLevel: "bos", kopyalar: [level("bos", ["sablon", "bos.level.json"])], yazilacaklar: [ORION_KARAKTERI()] };
  throw kodluHata("gecersiz-sablon", `bilinmeyen şablon: ${JSON.stringify(ad)} (${SABLON_ADLARI.join(", ")})`);
}

/**
 * Proje tarayıcısının gördüğü durum: açık proje, kök, projeler (son açılanlar ÖNDE, sonra ada göre; bozuklar `hata` ile görünür).
 * `sirali[i].son` = son açılanlar listesindeki sıra (0 = en son), yoksa null.
 */
export function projeDurumu(kok, sonYolu, acikAd) {
  const gecmis = sonProjelerOku(sonYolu).gecmis;
  const projeler = projeListe(kok).map((p) => ({ ...p, son: gecmis.includes(p.ad) ? gecmis.indexOf(p.ad) : null, acik: p.ad === acikAd }));
  projeler.sort((a, b) => (a.son ?? 1e9) - (b.son ?? 1e9) || a.ad.localeCompare(b.ad, "tr"));
  return { kok, acik: acikAd ?? null, projeler };
}
