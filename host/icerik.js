// host/icerik.js — İÇERİK GEZGİNİ (spec 39 D4): Content Browser'ın dosya işlemleri. Saf Node (fs + path).
//
// ADRES: Unreal'ın `/Game/…`i gibi tek biçim: `Content/Characters/Orion/Orion.karakter.json` (açık projenin içeriği, YAZILABİLİR) ve
// `Engine/orion-lowpoly.glb` (motorun `assets/`i, SALT OKUNUR). Renderer dosya sistemi görmez; yalnız adres verir, tam yolu burası çözer.
//
// KURALLAR (icerik.test.ts):
//   1. ADRES kaçamaz: ilk parça bilinen kök; parçalar boş/`.`/`..`/noktayla başlayan (gizli, `.silinenler`)/Windows'ta geçersiz olamaz.
//   2. ENGINE salt okunur: yazan her işlem `salt-okunur` ile reddedilir (motorun dosyası Ozyn'in içeriği değildir).
//   3. KORUMALI klasörler (Levels, Characters, Animations, Sequences, Graphs, NPC, Assets, Content'in kendisi): yeniden adlandırılamaz/silinemez; host bunları
//      tür klasörü olarak arar (`icerikDizini`), yanlış tıklama projeyi kırmasın.
//   4. SİLME = `Content/.silinenler/<zaman>-<ad>`e TAŞIMA (kalıcı silme yok). Hiçbir işlem var olanın üstüne yazmaz (`var`).
//   5. TÜRÜN KENDİ AD KURALI geçerlidir: level klasörü küçük harf/rakam/tire ve içindeki `<ad>.level.json` klasörle BİRLİKTE adlanır; Sequences/Graphs/NPC düz
//      klasörlerdir, dosya `<ad>.json` ve ad `grafAdiGecerli`dir (depolar yalnız öyle okur). Başka klasörlerde genel kural.
//   6. İÇE AKTARMA yalnız glb/png/jpg/jpeg/webp, en çok 128 MB, Content'e (Assets altında); ad geçersizse temizlenir, çakışırsa " 2" eklenir.
import fs from "node:fs";
import path from "node:path";
import { kodluHata } from "./dosyaKlasoru.js";
import { grafAdiGecerli } from "./grafDosyalari.js";
import { levelAdiGecerli, LEVEL_UZANTISI } from "./levelDosyasi.js";
import { ICERIK_KLASORLERI, kopyala } from "./proje.js";

export const KOKLER = Object.freeze(["Content", "Engine"]);
export const SILINENLER = ".silinenler";
export const IKILI_TAVAN = 48 * 1024 * 1024;
export const ICE_AKTAR_TAVAN = 128 * 1024 * 1024;
export const ICE_AKTAR_UZANTILARI = Object.freeze([".glb", ".png", ".jpg", ".jpeg", ".webp"]);
const LISTE_TAVANI = 6000;
const DERINLIK_TAVANI = 10;
const AYRILMIS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const DUZ_KLASORLER = Object.freeze(["Sequences", "Graphs", "NPC"]);
const KORUMALI = new Set(Object.values(ICERIK_KLASORLERI));

/** Tek bir dosya/klasör adı geçerli mi (yol ayracı, gizli, Windows'ta geçersiz karakter, ayrılmış ad yok). */
export function adGecerli(ad) {
  if (typeof ad !== "string" || !ad || ad.length > 96) return false;
  if (ad === "." || ad === ".." || ad.startsWith(".") || /[\\/:*?"<>|\u0000-\u001f]/.test(ad)) return false;
  if (/[ .]$/.test(ad)) return false;
  return !AYRILMIS.test(ad.split(".")[0]);
}

/** Adres parçalarına ayır; geçersizse neden fırlat. `Content` tek başına geçerlidir (kök). */
export function adresParcalari(adres) {
  if (typeof adres !== "string" || !adres) throw kodluHata("gecersiz-adres", `geçersiz adres: ${JSON.stringify(adres)}`);
  const p = adres.split("/");
  if (!KOKLER.includes(p[0])) throw kodluHata("gecersiz-adres", `bilinmeyen kök: ${JSON.stringify(p[0])} (${KOKLER.join(", ")})`);
  for (const s of p.slice(1)) if (!adGecerli(s)) throw kodluHata("gecersiz-adres", `adresin parçası geçersiz: ${JSON.stringify(s)}`);
  return p;
}

/** Adresi tam yola çözer. `yazma` ise Engine reddedilir. */
export function adresCoz(kokler, adres, { yazma = false } = {}) {
  const p = adresParcalari(adres);
  if (yazma && p[0] === "Engine") throw kodluHata("salt-okunur", "Engine içeriği salt okunur (motorun dosyası)");
  const kok = kokler[p[0]];
  if (!kok) throw kodluHata("kok-yok", `${p[0]} kökü bu oturumda yok`);
  const tam = path.join(kok, ...p.slice(1));
  const goreli = path.relative(kok, tam);
  if (goreli.startsWith("..") || path.isAbsolute(goreli)) throw kodluHata("gecersiz-adres", "adres köke sığmıyor");
  return { kok: p[0], parcalar: p, tam, adres: p.join("/") };
}

const korumaliMi = (parcalar) => parcalar.length === 1 || (parcalar[0] === "Content" && parcalar.length === 2 && KORUMALI.has(parcalar[1]));

/** Bir adresin üst klasörü: adresin son parçası atılır. */
export const ustAdres = (adres) => adres.split("/").slice(0, -1).join("/");

/**
 * Bir kökün bütün ağacı DÜZ liste (klasör ve dosya): `[{ adres, klasor, boyut, degisti }]`, klasörler önde değil ada göre (sıralama modelin işi).
 * Gizli (`.` ile başlayan) ve `.tmp` atlanır. Tavan aşılırsa `kesildi: true` (sessiz kırpma yok).
 */
export function icerikListe(kokler, kok) {
  if (!KOKLER.includes(kok)) throw kodluHata("gecersiz-adres", `bilinmeyen kök: ${JSON.stringify(kok)}`);
  const dizin = kokler[kok];
  const ogeler = [];
  let kesildi = false;
  const gez = (tam, adres, derinlik) => {
    if (derinlik > DERINLIK_TAVANI) { kesildi = true; return; }
    let ad;
    try { ad = fs.readdirSync(tam, { withFileTypes: true }); } catch { return; }
    ad.sort((a, b) => a.name.localeCompare(b.name, "tr"));
    for (const d of ad) {
      if (d.name.startsWith(".") || d.name.endsWith(".tmp")) continue;
      if (ogeler.length >= LISTE_TAVANI) { kesildi = true; return; }
      const a = `${adres}/${d.name}`, t = path.join(tam, d.name);
      let s;
      try { s = fs.statSync(t); } catch { continue; }
      if (d.isDirectory()) { ogeler.push({ adres: a, klasor: true, boyut: 0, degisti: Math.round(s.mtimeMs) }); gez(t, a, derinlik + 1); }
      else if (d.isFile()) ogeler.push({ adres: a, klasor: false, boyut: s.size, degisti: Math.round(s.mtimeMs) });
    }
  };
  if (dizin && fs.existsSync(dizin)) gez(dizin, kok, 1);
  return { kok, ogeler, kesildi };
}

/** Bir dosyanın ikili içeriği (base64; önizleme ve glb yükleme için). Klasör ya da tavandan büyük reddedilir. */
export function icerikIkili(kokler, adres) {
  const c = adresCoz(kokler, adres);
  let s;
  try { s = fs.statSync(c.tam); } catch { throw kodluHata("yok", `yok: ${adres}`); }
  if (!s.isFile()) throw kodluHata("klasor", `klasör okunamaz: ${adres}`);
  if (s.size > IKILI_TAVAN) throw kodluHata("cok-buyuk", `${Math.round(s.size / 1048576)} MB, sınır ${IKILI_TAVAN / 1048576} MB`);
  return { adres, boyut: s.size, base64: fs.readFileSync(c.tam).toString("base64") };
}

/** Metin dosyası (karakter tanımı, sekans… 1 MB sınırı). */
export function icerikMetin(kokler, adres) {
  const c = adresCoz(kokler, adres);
  let s;
  try { s = fs.statSync(c.tam); } catch { throw kodluHata("yok", `yok: ${adres}`); }
  if (!s.isFile()) throw kodluHata("klasor", `klasör okunamaz: ${adres}`);
  if (s.size > 1024 * 1024) throw kodluHata("cok-buyuk", "metin dosyası 1 MB sınırını aşıyor");
  return fs.readFileSync(c.tam, "utf8");
}

/** Bir Content adresinin bağlı olduğu tür klasörü (`Levels`…) ya da null. */
const turKlasoru = (parcalar) => (parcalar[0] === "Content" && parcalar.length >= 2 ? parcalar[1] : null);

/** Yeni ad `parcalar` altına konacak bir öğe için TÜRÜN kuralına uyuyor mu; uymuyorsa neden fırlat. `klasor`: öğe klasör mü. */
function adKuraliniDene(ustParcalar, ad, klasor) {
  if (!adGecerli(ad)) throw kodluHata("gecersiz-ad", `geçersiz ad: ${JSON.stringify(ad)} (yol ayracı, ':*?"<>|', baştaki nokta ve sondaki boşluk/nokta olmaz; en çok 96)`);
  const tur = turKlasoru(ustParcalar);
  if (tur === "Levels") {
    if (ustParcalar.length === 2) {
      if (!klasor) throw kodluHata("gecersiz-ad", "Levels'a yalnız level klasörü girer");
      if (!levelAdiGecerli(ad)) throw kodluHata("gecersiz-ad", `level adı küçük harf, rakam ve tire olmalı: ${JSON.stringify(ad)}`);
    }
  } else if (DUZ_KLASORLER.includes(tur ?? "")) {
    if (ustParcalar.length !== 2 || klasor) throw kodluHata("gecersiz-ad", `${tur} düz bir klasördür (alt klasör açılmaz)`);
    if (!ad.endsWith(".json") || !grafAdiGecerli(ad.slice(0, -5))) throw kodluHata("gecersiz-ad", `${tur} dosyası '<ad>.json' olmalı (harf, rakam, _ ve -; en çok 48): ${JSON.stringify(ad)}`);
  }
}

const yoksaOlustur = (tam) => { if (fs.existsSync(tam)) throw kodluHata("var", `zaten var: ${path.basename(tam)}`); };

export function yeniKlasor(kokler, adres) {
  const c = adresCoz(kokler, adres, { yazma: true });
  if (c.parcalar.length < 2) throw kodluHata("gecersiz-adres", "kök klasör açılamaz");
  const ust = c.parcalar.slice(0, -1);
  adKuraliniDene(ust, c.parcalar.at(-1), true);
  const ustTam = path.dirname(c.tam);
  if (!fs.existsSync(ustTam) || !fs.statSync(ustTam).isDirectory()) throw kodluHata("yok", `üst klasör yok: ${ust.join("/")}`);
  yoksaOlustur(c.tam);
  fs.mkdirSync(c.tam);
  return c.adres;
}

/** Level klasörünün içindeki `<eski>.level.json`u yeni adla uydur (klasör adı = level adı kuralı). */
function levelDosyasiniUydur(klasorTam, eski, yeni) {
  const e = path.join(klasorTam, `${eski}${LEVEL_UZANTISI}`);
  if (fs.existsSync(e)) fs.renameSync(e, path.join(klasorTam, `${yeni}${LEVEL_UZANTISI}`));
}
/**
 * Düz türlerde (Sequences/Graphs/NPC) depolar dosyayı İÇERİDEKİ `ad` alanıyla tanır; dosya adı değişince içteki ad eskiyse aynı kalan iki dosya çakışır
 * ve yenisi açılmaz. İçteki ad dosya adına eşitse (eskiGovde) yeni adla değiştirilir; bozuk/başka adlı dosyaya dokunulmaz.
 */
export function icAdiUydur(tam, eskiGovde, yeniGovde) {
  try {
    const o = JSON.parse(fs.readFileSync(tam, "utf8"));
    if (!o || typeof o !== "object" || Array.isArray(o) || o.ad !== eskiGovde) return false;
    o.ad = yeniGovde;
    const gecici = `${tam}.tmp`;
    fs.writeFileSync(gecici, `${JSON.stringify(o, null, 2)}\n`);
    fs.renameSync(gecici, tam);
    return true;
  } catch { return false; }
}
const duzDosyaMi = (parcalar, klasor) => !klasor && parcalar.length === 3 && DUZ_KLASORLER.includes(turKlasoru(parcalar) ?? "") && parcalar[2].endsWith(".json");
const govdeJson = (ad) => ad.slice(0, -5);
const levelKlasoruMu = (parcalar) => parcalar[0] === "Content" && parcalar[1] === "Levels" && parcalar.length === 3;

export function adlandir(kokler, adres, yeniAd) {
  const c = adresCoz(kokler, adres, { yazma: true });
  if (korumaliMi(c.parcalar)) throw kodluHata("korumali", `korumalı klasör adlandırılamaz: ${c.adres}`);
  if (!fs.existsSync(c.tam)) throw kodluHata("yok", `yok: ${adres}`);
  const klasor = fs.statSync(c.tam).isDirectory();
  const ust = c.parcalar.slice(0, -1);
  // Level klasörünün içindeki `<ad>.level.json` tek başına adlanmaz: klasörle birlikte.
  if (ust.length === 3 && levelKlasoruMu(ust) && c.parcalar.at(-1).endsWith(LEVEL_UZANTISI)) throw kodluHata("korumali", "level dosyası klasörüyle birlikte adlandırılır (klasörü adlandır)");
  adKuraliniDene(ust, yeniAd, klasor);
  if (yeniAd === c.parcalar.at(-1)) return c.adres;
  const hedef = path.join(path.dirname(c.tam), yeniAd);
  yoksaOlustur(hedef);
  fs.renameSync(c.tam, hedef);
  if (klasor && levelKlasoruMu(c.parcalar)) levelDosyasiniUydur(hedef, c.parcalar.at(-1), yeniAd);
  if (duzDosyaMi(c.parcalar, klasor)) icAdiUydur(hedef, govdeJson(c.parcalar.at(-1)), govdeJson(yeniAd));
  return [...ust, yeniAd].join("/");
}

/**
 * Taşı (kartı klasöre sürükle): aynı tür klasörünün içinde, var olanın üstüne yazmadan. Engine'den/Engine'e yok; korumalı klasör ve level dosyası (klasörüyle gider)
 * taşınmaz; klasör kendi içine/altına taşınmaz; hedefte türün ad kuralı geçerlidir (ör. Levels'ın altına alt klasör, Sequences'a klasör girmez).
 * Dönüş: yeni adres.
 */
export function tasi(kokler, adres, hedefKlasor) {
  const k = adresCoz(kokler, adres, { yazma: true });
  const h = adresCoz(kokler, hedefKlasor, { yazma: true });
  if (korumaliMi(k.parcalar)) throw kodluHata("korumali", `korumalı klasör taşınamaz: ${k.adres}`);
  if (!fs.existsSync(k.tam)) throw kodluHata("yok", `yok: ${adres}`);
  if (!fs.existsSync(h.tam) || !fs.statSync(h.tam).isDirectory()) throw kodluHata("yok", `hedef klasör yok: ${hedefKlasor}`);
  const klasor = fs.statSync(k.tam).isDirectory();
  const ad = k.parcalar.at(-1);
  const ust = k.parcalar.slice(0, -1);
  if (ust.length === 3 && levelKlasoruMu(ust) && ad.endsWith(LEVEL_UZANTISI)) throw kodluHata("korumali", "level dosyası klasörüyle birlikte taşınır (klasörü taşı)");
  if (turKlasoru(k.parcalar) !== turKlasoru(h.parcalar) || h.parcalar.length < 2) throw kodluHata("gecersiz-adres", `yalnız aynı tür klasörü içinde taşınır (${turKlasoru(k.parcalar)} → ${turKlasoru(h.parcalar) ?? "kök"})`);
  if (klasor && (h.adres === k.adres || h.adres.startsWith(`${k.adres}/`))) throw kodluHata("gecersiz-adres", "klasör kendi içine taşınamaz");
  if (ust.join("/") === h.adres) return k.adres;   // zaten orada: sessiz başarı
  adKuraliniDene(h.parcalar, ad, klasor);
  const hedef = path.join(h.tam, ad);
  yoksaOlustur(hedef);
  fs.renameSync(k.tam, hedef);
  return [...h.parcalar, ad].join("/");
}

/** `ad` için çakışmayan kopya adı: dosyada `<ad> kopya[ n].<uzantı>` (uzantı ilk noktadan: `Orion.karakter.json`), klasörde `<ad> kopya[ n]`. */
function kopyaAdi(dizin, ad, klasor, duz) {
  const i = klasor ? -1 : ad.indexOf(".");
  const govde = i > 0 ? ad.slice(0, i) : ad, uzanti = i > 0 ? ad.slice(i) : "";
  const ayrac = duz ? "_" : " ";
  for (let n = 1; n < 100; n++) {
    const aday = `${govde}${ayrac}kopya${n > 1 ? `${ayrac}${n}` : ""}${uzanti}`;
    if (!fs.existsSync(path.join(dizin, aday))) return aday;
  }
  throw kodluHata("var", `kopya adı bulunamadı: ${ad}`);
}

export function cogalt(kokler, adres) {
  const c = adresCoz(kokler, adres);   // Engine'den okuyup Content'e çoğaltmak yok: hedef kaynağın yanıdır, Engine'de yazılamaz
  if (c.kok === "Engine") throw kodluHata("salt-okunur", "Engine içeriği çoğaltılamaz (Content'e içe aktar ya da karakter tanımı oluştur)");
  if (korumaliMi(c.parcalar)) throw kodluHata("korumali", `korumalı klasör çoğaltılamaz: ${c.adres}`);
  if (!fs.existsSync(c.tam)) throw kodluHata("yok", `yok: ${adres}`);
  const klasor = fs.statSync(c.tam).isDirectory();
  const ust = c.parcalar.slice(0, -1);
  const dizin = path.dirname(c.tam), ad = c.parcalar.at(-1);
  // Level klasörleri küçük harf/tire ister, düz klasörler harf/rakam/_/-: kopya adı kuralına uyan ayraçla kurulur.
  const levelMi = levelKlasoruMu(c.parcalar);
  const duz = levelMi || DUZ_KLASORLER.includes(turKlasoru(c.parcalar) ?? "");
  const yeni = levelMi ? kopyaAdiLevel(dizin, ad) : kopyaAdi(dizin, ad, klasor, duz);
  adKuraliniDene(ust, yeni, klasor);
  const hedef = path.join(dizin, yeni);
  const n = kopyala(c.tam, hedef);
  if (!n && !klasor) throw kodluHata("var", `kopyalanamadı: ${yeni}`);
  if (klasor && levelMi) levelDosyasiniUydur(hedef, ad, yeni);
  if (duzDosyaMi(c.parcalar, klasor)) icAdiUydur(hedef, govdeJson(ad), govdeJson(yeni));
  return [...ust, yeni].join("/");
}
/** Level kopya adı: `<ad>-kopya[-n]` (level adı yalnız küçük harf/rakam/tire). */
function kopyaAdiLevel(dizin, ad) {
  for (let n = 1; n < 100; n++) {
    const aday = `${ad}-kopya${n > 1 ? `-${n}` : ""}`;
    if (aday.length <= 48 && !fs.existsSync(path.join(dizin, aday))) return aday;
  }
  throw kodluHata("var", `kopya adı bulunamadı: ${ad}`);
}

/** Sil = `Content/.silinenler/<zaman>-<ad>`e taşı. Dönüş: taşındığı yer (gösterim için). */
export function sil(kokler, adres, simdi = Date.now) {
  const c = adresCoz(kokler, adres, { yazma: true });
  if (korumaliMi(c.parcalar)) throw kodluHata("korumali", `korumalı klasör silinemez: ${c.adres}`);
  if (!fs.existsSync(c.tam)) throw kodluHata("yok", `yok: ${adres}`);
  const cop = path.join(kokler.Content, SILINENLER);
  fs.mkdirSync(cop, { recursive: true });
  let hedef = path.join(cop, `${simdi()}-${c.parcalar.at(-1)}`);
  for (let n = 2; fs.existsSync(hedef); n++) hedef = path.join(cop, `${simdi()}-${n}-${c.parcalar.at(-1)}`);
  fs.renameSync(c.tam, hedef);
  return path.relative(kokler.Content, hedef).split(path.sep).join("/");
}

/** İçe aktarmada ad temizliği: geçersiz karakterler `_`, baştaki noktalar atılır, uzunluk kısalır (uzantı korunur). */
export function icAktarAdi(ad) {
  const dosya = ad.split(/[\\/]/).pop() ?? "";   // path.basename Windows'ta 'a:b'yi sürücü sayar
  const nokta = dosya.lastIndexOf(".");
  const uz = nokta > 0 ? dosya.slice(nokta).toLowerCase() : "";
  let govde = (nokta > 0 ? dosya.slice(0, nokta) : dosya).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/^\.+/, "").replace(/[ .]+$/, "");
  if (!govde) govde = "varlik";
  if (AYRILMIS.test(govde)) govde = `_${govde}`;
  return `${govde.slice(0, 80)}${uz}`;
}

/** Dışarıdan dosyaları `hedefAdres` klasörüne KOPYALAR (kural 6). Dönüş: `{ eklenen: adres[], atlanan: [{ ad, neden }] }`. */
export function iceAktar(kokler, hedefAdres, kaynaklar) {
  const c = adresCoz(kokler, hedefAdres, { yazma: true });
  if (!fs.existsSync(c.tam) || !fs.statSync(c.tam).isDirectory()) throw kodluHata("yok", `hedef klasör yok: ${hedefAdres}`);
  if (c.kok !== "Content" || c.parcalar[1] !== ICERIK_KLASORLERI.asset) throw kodluHata("gecersiz-adres", "içe aktarma yalnız Content/Assets altına yapılır");
  const eklenen = [], atlanan = [];
  for (const k of kaynaklar) {
    const ad = path.basename(String(k));
    const uz = path.extname(ad).toLowerCase();
    if (!ICE_AKTAR_UZANTILARI.includes(uz)) { atlanan.push({ ad, neden: `desteklenmeyen tür (${ICE_AKTAR_UZANTILARI.join(", ")})` }); continue; }
    let s;
    try { s = fs.statSync(k); } catch { atlanan.push({ ad, neden: "okunamadı" }); continue; }
    if (!s.isFile()) { atlanan.push({ ad, neden: "dosya değil" }); continue; }
    if (s.size > ICE_AKTAR_TAVAN) { atlanan.push({ ad, neden: `çok büyük (${Math.round(s.size / 1048576)} MB, sınır ${ICE_AKTAR_TAVAN / 1048576})` }); continue; }
    const temiz = icAktarAdi(ad);
    let yeni = temiz;
    const govde = path.basename(temiz, path.extname(temiz));
    for (let n = 2; fs.existsSync(path.join(c.tam, yeni)); n++) yeni = `${govde} ${n}${path.extname(temiz)}`;
    fs.copyFileSync(k, path.join(c.tam, yeni), fs.constants.COPYFILE_EXCL);
    eklenen.push(`${c.adres}/${yeni}`);
  }
  return { eklenen, atlanan };
}
