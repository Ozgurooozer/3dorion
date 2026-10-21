// host/mdDosyalari.js — Orion'un MD DOSYALARI (Yapı çubuğu · Hafıza sekmesi, spec 32): persona, anlık hafıza ve Ozyn'in kendi notları. Saf Node (fs + path).
//
// Bu klasör repoda DEĞİL, kullanıcı verisindedir (`<userData>/orion-md/`): hafıza ve notlar herkese açık repoya sızmasın. Dosya başına ayrı `.md`; hangilerinin
// Orion'un bağlamına girdiği (aktif/pasif) klasörde `_ayar.json`da durur (dosyalardan ayrı: md içeriği saf kalır, ayar yüzünden bozulmaz).
//
// KURALLAR (mdDosyalari.test.ts):
//   1. ATOMİK YAZIM: önce `.tmp`, sonra yeniden adlandırma (hafizaDosyasi.js ile aynı): yarıda kalan yazım hedefe dokunmaz.
//   2. YAZ var olanı günceller (yoksa 404: yanlış adla yeni dosya doğmasın); YENİ yalnız yoksa yazar (varsa 409: başkasının üstüne yazılmaz). Silme YOK.
//   3. AD kuralı: klasör gezme yok (yol ayracı, `..`, nokta ile başlama yasak), yalnız `.md`, harf/rakam/_/-/boşluk/nokta; en çok 64 karakter. Boyut sınırı 256 KB.
//   4. BOZUK AYAR ≠ BOŞ AYAR: `_ayar.json` bozuksa HATA (yoksa herkes sessizce "pasif" olur, bağlam bir şey söylemeden değişirdi); bozuk dosya yanına taşınır.
//   5. İlk açılış: klasör boşsa tohum dosyalar yazılır (persona: PASİF şablon, anlık hafıza: AKTİF, sistem dosyası).
import fs from "node:fs";
import path from "node:path";

export const MD_BOYUT_SINIRI = 256 * 1024;
/** Sistemin kendi güncellediği dosyalar: silinemez/adı değişmez, aktif olarak başlar. (Renderer tarafındaki `mind/mdBaglami.ts` ANLIK_HAFIZA ile aynı olmalı: test bekçisi.) */
export const SISTEM_DOSYALARI = ["anlik-hafiza.md"];
const AYAR_DOSYASI = "_ayar.json";

const hata = (kod, mesaj) => Object.assign(new Error(mesaj), { kod });

/** @param {string} ad */
export const mdAdiGecerli = (ad) =>
  typeof ad === "string" && ad.length <= 64 && /^[\p{L}\p{N}][\p{L}\p{N}_ .-]*\.md$/u.test(ad) && !ad.includes("..") && !/[\\/]/.test(ad);

/** Klasör yolu. Öncelik: `ORION_MD_DIZINI` > senaryo koşusu (`ORION_SMOKE=1`: geçici klasör) > gerçek klasör. */
export function mdDizini(env, kullaniciVerisi, gecici) {
  if (env.ORION_MD_DIZINI) return env.ORION_MD_DIZINI;
  if (env.ORION_SMOKE === "1") return path.join(gecici, "orion-md-deneme");
  return path.join(kullaniciVerisi, "orion-md");
}

function atomikYaz(hedef, metin) {
  const gecici = `${hedef}.tmp`;
  fs.writeFileSync(gecici, metin, "utf8");
  fs.renameSync(gecici, hedef);
}

function yol(dizin, ad) {
  if (!mdAdiGecerli(ad)) throw hata("gecersiz-ad", `geçersiz md adı: ${JSON.stringify(ad)}`);
  return path.join(dizin, ad);
}

/**
 * Ayar: `{ aktif: { "dosya.md": true }, tohumlandi: ["flash.md"] }`. Yoksa boş; bozuksa HATA ve dosya yanına taşınır.
 * `tohumlandi`: sistemin sonradan eklediği tohum dosyaların (EK_TOHUMLAR) bir kez yazıldığının kaydı; eski ayarda yoktur (boş sayılır).
 */
function ayarOku(dizin) {
  const p = path.join(dizin, AYAR_DOSYASI);
  if (!fs.existsSync(p)) return { aktif: {}, tohumlandi: [] };
  try {
    const v = JSON.parse(fs.readFileSync(p, "utf8"));
    if (typeof v !== "object" || v === null || typeof v.aktif !== "object" || v.aktif === null || Array.isArray(v.aktif)) throw new Error("beklenen biçimde değil");
    for (const [k, d] of Object.entries(v.aktif)) if (typeof d !== "boolean") throw new Error(`aktif["${k}"] bool değil`);
    if (v.tohumlandi !== undefined && (!Array.isArray(v.tohumlandi) || v.tohumlandi.some((x) => typeof x !== "string"))) throw new Error("tohumlandi metin listesi değil");
    return { aktif: v.aktif, tohumlandi: v.tohumlandi ?? [] };
  } catch (err) {
    const yedek = `${p}.bozuk-${Date.now()}`;
    try { fs.renameSync(p, yedek); } catch { /* taşınamadıysa hata yine de fırlar */ }
    throw hata("bozuk-ayar", `md ayarı bozuk (${err.message}); dosya ${path.basename(yedek)} olarak kenara taşındı`);
  }
}
const ayarYaz = (dizin, ayar) => atomikYaz(path.join(dizin, AYAR_DOSYASI), JSON.stringify(ayar, null, 2));

/** Aktiflik: ayarda yazılıysa o; yoksa sistem dosyası aktif, öteki pasif. */
const aktifMi = (ayar, ad) => (ad in ayar.aktif ? ayar.aktif[ad] : SISTEM_DOSYALARI.includes(ad));

/**
 * @typedef {{ ad: string, boyut: number, degisti: number, aktif: boolean, sistem: boolean }} MdBilgisi
 * Klasördeki md dosyaları (ada göre; sistem dosyaları önce).
 * @returns {MdBilgisi[]}
 */
export function mdListe(dizin) {
  fs.mkdirSync(dizin, { recursive: true });
  const ayar = ayarOku(dizin);
  return fs.readdirSync(dizin).filter(mdAdiGecerli).map((ad) => {
    const s = fs.statSync(path.join(dizin, ad));
    return { ad, boyut: s.size, degisti: Math.round(s.mtimeMs), aktif: aktifMi(ayar, ad), sistem: SISTEM_DOSYALARI.includes(ad) };
  }).sort((a, b) => Number(b.sistem) - Number(a.sistem) || a.ad.localeCompare(b.ad, "tr"));
}

export function mdOku(dizin, ad) {
  const p = yol(dizin, ad);
  if (!fs.existsSync(p)) throw hata("yok", `md dosyası yok: ${ad}`);
  return fs.readFileSync(p, "utf8");
}

function boyutDene(metin) {
  if (typeof metin !== "string") throw hata("gecersiz-icerik", "içerik metin olmalı");
  if (Buffer.byteLength(metin, "utf8") > MD_BOYUT_SINIRI) throw hata("cok-buyuk", `içerik ${MD_BOYUT_SINIRI / 1024} KB sınırını aşıyor`);
}

/** Var olan dosyayı günceller (yoksa 404). */
export function mdYaz(dizin, ad, metin) {
  const p = yol(dizin, ad);
  boyutDene(metin);
  if (!fs.existsSync(p)) throw hata("yok", `md dosyası yok: ${ad} (yeni dosya için YENİ)`);
  atomikYaz(p, metin);
}

/** Yeni dosya; varsa 409. Yeni dosya PASİF başlar (bağlama girmesi bilinçli bir adım). */
export function mdYeni(dizin, ad, metin = "") {
  const p = yol(dizin, ad);
  boyutDene(metin);
  fs.mkdirSync(dizin, { recursive: true });
  if (fs.existsSync(p)) throw hata("var", `zaten var: ${ad}`);
  atomikYaz(p, metin);
}

/** Aktif/pasif (dosya var olmalı). */
export function mdAktifYap(dizin, ad, aktif) {
  yol(dizin, ad);
  if (typeof aktif !== "boolean") throw hata("gecersiz-icerik", "aktif bool olmalı");
  if (!fs.existsSync(path.join(dizin, ad))) throw hata("yok", `md dosyası yok: ${ad}`);
  const ayar = ayarOku(dizin);
  ayar.aktif[ad] = aktif;
  ayarYaz(dizin, ayar);
}

// Şablonlardaki açıklamalar HTML YORUMU içinde: bağlama giren metinden ayıklanır (mind/mdBaglami.ts `temizle`), yani Orion yalnız Ozyn'in yazdığını okur, kullanım kılavuzunu değil.
const PERSONA_SABLONU = `# Persona

<!--
Bu dosya PASİF başlar: Hafıza sekmesinde sağ tık → "Bağlama ekle" dersen Orion her turda okur.
Orion'un temel kimliği kodda (bridge/talimat.ts) durur; buraya onun ÜSTÜNE eklemek istediklerini yaz.
Kısa tut: her satır her turda bağlama girer (token + dikkat maliyeti). Bu yorum Orion'a gitmez.
-->

## Üslup

## Ozyn hakkında
`;

const ANLIK_SABLONU = `# Anlık hafıza

<!--
Orion'un "şu an" bilgisi. İşaretli otomatik bölümü sistem sürekli günceller (konum, son iş, son konuşma);
içine yazdığın bir sonraki güncellemede ezilir. Bölümün DIŞINA istediğini yazabilirsin: o kalır ve bu dosya
(aktifken) Orion'un bağlamına TAM girer. Bu yorum Orion'a gitmez.
-->

<!-- orion:otomatik -->
(henüz güncellenmedi)
<!-- /orion:otomatik -->

## Benim notlarım
`;

// Orion'u Flash'tan haberdar eden not (spec 33). Orion'un koduna/dünya satırına DOKUNMADAN: Hafıza sekmesindeki bir dosya olarak girer, yani Ozyn onu görür,
// düzenler, "Bağlamdan çıkar" ile kapatır ve token maliyeti kartta yazar. Çerçeve İngilizce (spec 06 §6.8); açıklama HTML yorumunda (Orion'a gitmez).
const FLASH_NOTU = `# Flash

<!--
Bu not Orion'u odadaki ikinci karakter (Flash) hakkında bilgilendirir; AKTİF başlar. Kapatmak için Hafıza sekmesinde sağ tık → "Bağlamdan çıkar".
Her satır her turda bağlama girer (token + dikkat maliyeti): kısa tut. Bu yorum Orion'a gitmez.
-->

Flash, an NPC with no AI, shares the room (amber body). It only follows fixed commands (sit, stand, come, follow, look) and cannot chat or use tools. When Ozyn asks you to command it, use dunya_emret (kime: flash, soz: otur / kalk / bana gel / beni takip et / takibi bırak / pencereye bak); you are told it was delivered, not that it was done. It does not talk to you. If sitting fails because Flash holds the seat, pick another. Answer only for yourself; mention Flash only when it matters.
`;

/**
 * Sonradan eklenen tohum dosyalar: klasör DOLU olsa da (eski kullanıcı) BİR KEZ yazılır; yazıldığı ayara (`tohumlandi`) kaydedilir:
 * Ozyn notu düzenler ya da pasif yaparsa sistem sonraki açılışta onu geri yazmaz/aktif etmez. Aynı adlı dosya zaten varsa dokunulmaz (Ozyn'in kendi `flash.md`'si ezilmez, aktif de yapılmaz).
 * `aktif`: tohum aktif mi başlar (yeni kullanıcı dosyaları pasif başlar; bu not Ozyn'in açık isteğiyle aktif).
 */
const EK_TOHUMLAR = [{ ad: "flash.md", metin: FLASH_NOTU, aktif: true }];

/** Klasörde hiç md yoksa temel tohumları yazar; ardından (her açılışta) henüz yazılmamış ek tohumları. Yazılanların adları döner (genelde boş). */
export function mdTohumla(dizin) {
  fs.mkdirSync(dizin, { recursive: true });
  const yazilan = [];
  if (!fs.readdirSync(dizin).some(mdAdiGecerli)) {
    atomikYaz(path.join(dizin, "persona.md"), PERSONA_SABLONU);
    atomikYaz(path.join(dizin, "anlik-hafiza.md"), ANLIK_SABLONU);
    yazilan.push("persona.md", "anlik-hafiza.md");
  }
  const ayar = ayarOku(dizin);
  let degisti = false;
  for (const t of EK_TOHUMLAR) {
    if (ayar.tohumlandi.includes(t.ad)) continue;
    ayar.tohumlandi.push(t.ad);
    degisti = true;
    if (fs.existsSync(path.join(dizin, t.ad))) continue;
    atomikYaz(path.join(dizin, t.ad), t.metin);
    ayar.aktif[t.ad] = t.aktif;
    yazilan.push(t.ad);
  }
  if (degisti) ayarYaz(dizin, ayar);
  return yazilan;
}
