// host/sesler.js — ORION'UN SESLERİ (spec 34): ses KATALOĞU, kurulu sesleri tarama, seçim kuralı, seçimin kalıcılığı ve yönetici. YALNIZ ana süreç (node:fs).
//
// Neden host'ta: sesi seçen de çalan da ana süreçteki kalıcı piper sürecidir (host/ses.js). Seçim renderer'da (localStorage) dursaydı açılış selamı
// renderer seçimi bildirmeden ÖNCE varsayılan sesle çıkardı (yarış); seçimi süreci açan taraf bilmeli. Bu yüzden userData'da küçük bir JSON
// (`ses-ayari.json`, atomik yazılır), senaryo koşusunda (`ORION_SMOKE=1`) geçici dizinde — gerçek ayara dokunulmaz (hafıza/durum dosyalarıyla aynı kural).
//
// ÖNCELİK (değişmez): `ORION_PIPER_MODEL` ortam değişkeni > paneldeki seçim > varsayılan (dfki) > kurulu ilk ses. Ortam değişkeni ölçüm ve deneme düzeneklerinin
// sesi KESİN bilmesi içindir; o verilmişken panel seçimi reddedilir ve nedeni panelde yazar (sessizce yok sayılmaz).
//
// KATALOG neden bu kadar kısa: rhasspy/piper-voices'ta (2026-10-21, voices.json + depo ağacı ile doğrulandı) Türkçe TEK ses var: dfki. `fahrettin` ve
// `fettah` 2025-12-30'da "Remove fahrettin and fettah voices at request of contributors" commit'iyle depodan kaldırıldı; eski `v1.0.0` etiketinde
// dosyalar hâlâ duruyor ama ses sahipleri kaldırılmasını İSTEDİ. Oradan indirmek o isteği çiğnemek olur: kataloğa EKLENMEZ (spec 34 §3).
// İngilizce lessac Ozyn'in makinesinde zaten kurulu (2026-10-08); katalogda durması "indirildi mi / silinebilir mi" kuralını tek yerden verir.
"use strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/** Hugging Face deposunun kökü (indirme `main` dalından; boyutlar 2026-10-21 HEAD isteğiyle doğrulandı). */
export const HF_KOK = "https://huggingface.co/rhasspy/piper-voices/resolve/main";
/** Varsayılan ses: piper kurulumundan beri Orion'un sesi (host/ses.js ölçümleri bununla). */
export const VARSAYILAN_SES = "tr_TR-dfki-medium";

/**
 * Seçilebilir/indirilebilir seslerin TEK listesi. Ad ve adres buradan TÜRER (`sesAdi`, `sesAdresi`); elle ikinci kez yazılmaz.
 * `boyut`: Content-Length (bayt) — indirmenin akıl kontrolü ve arayüzün "≈60 MB" yazısı. `dahili`: kurulumla gelen, panelden silinmez.
 */
export const SES_KATALOGU = Object.freeze([
  Object.freeze({ dil: "tr_TR", konusmaci: "dfki", kalite: "medium", baslik: "Türkçe · dfki", dahili: true, boyut: Object.freeze({ onnx: 63201294, json: 4960 }) }),
  Object.freeze({ dil: "en_US", konusmaci: "lessac", kalite: "medium", baslik: "English · lessac", dahili: false, boyut: Object.freeze({ onnx: 63201294, json: 4885 }) }),
]);

/** Katalog girdisinin dosya adı kökü: `tr_TR-dfki-medium`. */
export function sesAdi(g) { return `${g.dil}-${g.konusmaci}-${g.kalite}`; }

/** İndirme adresi. `uzanti`: "onnx" | "onnx.json". */
export function sesAdresi(g, uzanti, kok = HF_KOK) {
  return `${kok}/${g.dil.slice(0, 2)}/${g.dil}/${g.konusmaci}/${g.kalite}/${sesAdi(g)}.${uzanti}`;
}

export function katalogdaBul(ad) { return SES_KATALOGU.find((g) => sesAdi(g) === ad) ?? null; }

/** Ses adı yol parçası olarak güvenli mi (dizin dışına çıkamaz): harf, rakam, `_` `-` `.`; nokta ile başlamaz. */
export function sesAdiGecerli(ad) {
  return typeof ad === "string" && ad.length > 0 && ad.length <= 120 && /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(ad) && !ad.includes("..");
}

/** Seslerin dizini: `ORION_PIPER_SESLER` > `%LOCALAPPDATA%\piper\sesler` (piperBul'un baktığı yer). */
export function sesDizini(env, ev = os.homedir()) {
  return env.ORION_PIPER_SESLER || path.join(ev, "AppData", "Local", "piper", "sesler");
}

/** Seçim dosyasının yolu: `ORION_SES_AYARI` > senaryo (geçici dizin) > userData. */
export function sesAyariYolu(env, kullaniciVerisi, gecici) {
  if (env.ORION_SES_AYARI) return env.ORION_SES_AYARI;
  if (env.ORION_SMOKE === "1") return path.join(gecici, "orion-ses-ayari-senaryo.json");
  return path.join(kullaniciVerisi, "ses-ayari.json");
}

const hata = (kod, mesaj) => Object.assign(new Error(mesaj), { kod });

/**
 * Dizindeki kurulu sesler: `<ad>.onnx` + `<ad>.onnx.json` ÇİFTİ ve json gerçekten ayrıştırılıyorsa geçerli. Biri eksikse ya da json bozuksa
 * `bozuk` listesine nedenle düşer (sessizce yok sayılmaz; panel söyler). `.part` (yarım indirme) dosyaları hiç sayılmaz. Dizin yoksa boş.
 */
export function kuruluSesler(dizin) {
  let girdiler;
  try { girdiler = fs.readdirSync(dizin); } catch (e) { if (e?.code === "ENOENT") return { gecerli: [], bozuk: [] }; throw e; }
  const gecerli = [], bozuk = [];
  for (const dosya of girdiler.filter((d) => d.endsWith(".onnx")).sort()) {
    const ad = dosya.slice(0, -".onnx".length);
    if (!sesAdiGecerli(ad)) continue;
    const yol = path.join(dizin, dosya);
    const jsonYolu = `${yol}.json`;
    let boyut = 0;
    try { boyut = fs.statSync(yol).size; } catch { continue; }
    if (boyut === 0) { bozuk.push({ ad, neden: "model dosyası boş" }); continue; }
    let yapi;
    try { yapi = JSON.parse(fs.readFileSync(jsonYolu, "utf8")); }
    catch (e) { bozuk.push({ ad, neden: e?.code === "ENOENT" ? "eşi olan .onnx.json yok" : "ayar dosyası (.onnx.json) bozuk" }); continue; }
    if (typeof yapi !== "object" || yapi === null || Array.isArray(yapi)) { bozuk.push({ ad, neden: "ayar dosyası nesne değil" }); continue; }
    const dil = typeof yapi.language?.code === "string" ? yapi.language.code : ad.split("-")[0];
    gecerli.push({ ad, yol, boyut, dil });
  }
  return { gecerli, bozuk };
}

/**
 * Hangi ses çalacak. SAF: diske bakmaz (kurulu liste ve env dışarıdan). Dönüş: `{ ad, yol, kaynak, kilit, uyari }`;
 * `kaynak`: env | secim | varsayilan | ilk | yok. `kilit`: env varken panel seçiminin neden geçmediği (yoksa null).
 * Env yolu diskte yoksa (yanlış yazılmış) eski `piperBul` gibi varsayılana düşülür, ama uyarıyla.
 */
export function sesSecimiCoz({ envModel, envVarMi = (y) => fs.existsSync(y), secili, kurulu, varsayilan = VARSAYILAN_SES }) {
  if (envModel) {
    if (envVarMi(envModel)) {
      const ad = path.basename(envModel).replace(/\.onnx$/i, "");
      return { ad, yol: envModel, kaynak: "env", kilit: `ORION_PIPER_MODEL ortam değişkeni sesi zorluyor (${ad}); panel seçimi bu açılışta geçmez`, uyari: null };
    }
    const geri = sesSecimiCoz({ envModel: null, secili, kurulu, varsayilan });
    return { ...geri, uyari: `ORION_PIPER_MODEL bulunamadı (${envModel}); ${geri.ad ?? "ses yok"} kullanılıyor` };
  }
  const bul = (ad) => (ad ? kurulu.find((s) => s.ad === ad) ?? null : null);
  const s = bul(secili);
  if (s) return { ad: s.ad, yol: s.yol, kaynak: "secim", kilit: null, uyari: null };
  const uyari = secili ? `seçili ses (${secili}) kurulu değil; ` : "";
  const v = bul(varsayilan);
  if (v) return { ad: v.ad, yol: v.yol, kaynak: "varsayilan", kilit: null, uyari: uyari ? `${uyari}varsayılan ${v.ad} kullanılıyor` : null };
  const ilk = kurulu[0];
  if (ilk) return { ad: ilk.ad, yol: ilk.yol, kaynak: "ilk", kilit: null, uyari: `${uyari}varsayılan ses kurulu değil; ${ilk.ad} kullanılıyor` };
  return { ad: null, yol: null, kaynak: "yok", kilit: null, uyari: "hiç ses kurulu değil" };
}

// ── seçimin kalıcılığı ──
const BOS_AYAR = Object.freeze({ surum: 1, secili: null, indirilenler: Object.freeze([]) });

/** Ayar dosyasını oku. Yoksa boş ayar; bozuksa boş ayar + `uyari` (fırlatmaz: ses yine varsayılanla çalışır). */
export function sesAyariOku(yol) {
  let ham;
  try { ham = fs.readFileSync(yol, "utf8"); } catch (e) { return e?.code === "ENOENT" ? { ayar: BOS_AYAR, uyari: null } : { ayar: BOS_AYAR, uyari: `ses ayarı okunamadı: ${e?.message ?? e}` }; }
  try {
    const v = JSON.parse(ham);
    if (typeof v !== "object" || v === null || v.surum !== 1) throw new Error("sürüm/biçim tanınmadı");
    const secili = typeof v.secili === "string" && sesAdiGecerli(v.secili) ? v.secili : null;
    const indirilenler = Array.isArray(v.indirilenler) ? v.indirilenler.filter((x) => typeof x === "string" && sesAdiGecerli(x)) : [];
    return { ayar: { surum: 1, secili, indirilenler }, uyari: null };
  } catch (e) { return { ayar: BOS_AYAR, uyari: `ses ayarı bozuk, varsayılanla başlanıyor: ${e?.message ?? e}` }; }
}

export function sesAyariYaz(yol, ayar) {
  fs.mkdirSync(path.dirname(yol), { recursive: true });
  const gecici = `${yol}.tmp`;
  fs.writeFileSync(gecici, JSON.stringify({ surum: 1, secili: ayar.secili, indirilenler: ayar.indirilenler }, null, 2), "utf8");
  fs.renameSync(gecici, yol);
}

/**
 * Panelin göreceği durum. SAF. Her satır: kurulu mu, indirilebilir mi, silinebilir mi (değilse neden), seçili/etkin mi.
 * Silme kuralı: yalnız bu uygulamanın İNDİRDİĞİ ses (`indirilenler`), dahili değil, ve şu an çalan ses değil (önce başkasını seç).
 */
export function sesDurumu({ kurulu, bozuk = [], ayar, cozum, piperVar, indirilen = null }) {
  const adlar = [...new Set([...SES_KATALOGU.map(sesAdi), ...kurulu.map((s) => s.ad)])];
  const sesler = adlar.map((ad) => {
    const g = katalogdaBul(ad);
    const k = kurulu.find((s) => s.ad === ad) ?? null;
    const indirildi = ayar.indirilenler.includes(ad);
    const etkin = cozum.ad === ad;
    const silinemez = !k ? "kurulu değil"
      : g?.dahili ? "kurulumla gelen ses silinmez"
      : !indirildi ? "bu ses elle kurulmuş; yalnız panelden indirilenler silinir"
      : etkin ? "şu an bu ses çalıyor; önce başka ses seç"
      : null;
    return {
      ad, baslik: g?.baslik ?? ad, dil: k?.dil ?? g?.dil ?? ad.split("-")[0],
      kurulu: Boolean(k), boyut: k?.boyut ?? null, beklenenBoyut: g ? g.boyut.onnx + g.boyut.json : null,
      katalogda: Boolean(g), indirilebilir: Boolean(g) && !k, indiriliyor: indirilen === ad,
      indirildi, silinebilir: silinemez === null, silinemezNeden: silinemez,
      secili: ayar.secili === ad, etkin,
    };
  });
  return { sesler, bozuk, secili: ayar.secili, etkin: cozum.ad, kaynak: cozum.kaynak, kilit: cozum.kilit, uyari: cozum.uyari, piperVar };
}

/**
 * Ana sürecin ses yöneticisi: dört IPC işi (liste, seç, indir, sil) burada; main.js yalnız kablolar. Bağımlılıklar dışarıdan (test: geçici dizin,
 * sahte ses, sahte indirici). `ses`: `modelAyarla(yol)` ve `kullanilabilir()` (host/ses.js PiperSesi). Hepsi FIRLATIR, `kod` alanıyla
 * (yok | gecersiz-ad | kilitli | var | suruyor | silinemez | ag | boyut | bozuk | hata); main sonucu `{ok:false,kod,mesaj}`e çevirir.
 */
export function sesYoneticisiKur({ dizin, ayarYolu, env = {}, ses, indir, uyari = (m) => console.warn(m) }) {
  const okunan = sesAyariOku(ayarYolu);
  if (okunan.uyari) uyari(`[ses] ${okunan.uyari}`);
  let ayar = okunan.ayar;
  let indirilen = null;
  const tara = () => kuruluSesler(dizin);
  const coz = (kurulu) => sesSecimiCoz({ envModel: env.ORION_PIPER_MODEL || null, secili: ayar.secili, kurulu });
  const kaydet = (yeni) => { sesAyariYaz(ayarYolu, yeni); ayar = yeni; };
  const durum = () => {
    const t = tara();
    return sesDurumu({ kurulu: t.gecerli, bozuk: t.bozuk, ayar, cozum: coz(t.gecerli), piperVar: ses.kullanilabilir(), indirilen });
  };
  const gecerliAd = (ad) => { if (!sesAdiGecerli(ad)) throw hata("gecersiz-ad", `geçersiz ses adı: ${JSON.stringify(ad)}`); };

  return {
    /** Açılışta: çalacak sesi çöz ve sürece ver. Dönüş: çözüm (günlük satırı için). */
    baslat() { const c = coz(tara().gecerli); ses.modelAyarla(c.yol); if (c.uyari) uyari(`[ses] ${c.uyari}`); return c; },
    durum,
    sec(ad) {
      gecerliAd(ad);
      if (env.ORION_PIPER_MODEL) throw hata("kilitli", coz(tara().gecerli).kilit ?? "ORION_PIPER_MODEL ortam değişkeni sesi zorluyor");
      const k = tara().gecerli.find((s) => s.ad === ad);
      if (!k) throw hata("yok", `ses kurulu değil: ${ad}`);
      kaydet({ ...ayar, secili: ad });
      ses.modelAyarla(k.yol);   // bir SONRAKİ cümleden geçerli (host/ses.js: uçuştaki cümle eski süreçte biter)
      return durum();
    },
    async indir(ad, ilerleme = () => {}) {
      gecerliAd(ad);
      const g = katalogdaBul(ad);
      if (!g) throw hata("yok", `katalogda yok: ${ad}`);   // renderer adres veremez: yalnız katalogdakiler iner
      if (tara().gecerli.some((s) => s.ad === ad)) throw hata("var", `zaten kurulu: ${ad}`);
      if (indirilen) throw hata("suruyor", `başka bir indirme sürüyor: ${indirilen}`);
      indirilen = ad;
      try { await indir({ ses: g, ad, dizin, ilerleme }); }
      finally { indirilen = null; }
      if (!ayar.indirilenler.includes(ad)) kaydet({ ...ayar, indirilenler: [...ayar.indirilenler, ad] });
      return durum();
    },
    sil(ad) {
      gecerliAd(ad);
      const satir = durum().sesler.find((s) => s.ad === ad);
      if (!satir || !satir.kurulu) throw hata("yok", `ses kurulu değil: ${ad}`);
      if (!satir.silinebilir) throw hata("silinemez", satir.silinemezNeden ?? "silinemez");
      for (const yol of [path.join(dizin, `${ad}.onnx`), path.join(dizin, `${ad}.onnx.json`)]) fs.rmSync(yol, { force: true });
      kaydet({ ...ayar, indirilenler: ayar.indirilenler.filter((x) => x !== ad), secili: ayar.secili === ad ? null : ayar.secili });
      return durum();
    },
  };
}
