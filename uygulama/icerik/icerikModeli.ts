// uygulama/icerik/icerikModeli.ts — İÇERİK GEZGİNİ MODELİ (spec 39 D4): host'un düz dosya listesi → klasör ağacı, kartlar, tür tanıma, arama/süzgeç, favoriler. SAF (DOM yok).
//
// Adres: `Content/Characters/Orion/Orion.karakter.json` (proje) | `Engine/orion-lowpoly.glb` (motor, salt okunur). Tür, adın ve bulunduğu klasörün dilidir:
//   `.level.json` → level · `.karakter.json` → karakter · glb/gltf/vrm → model · png/jpg/webp → görsel · Content/Sequences|Graphs|NPC|Animations altındaki `.json` → sekans|graf|npc|animasyon.
// PAKET KARTI (Unreal'daki gibi bir varlık = bir kart): `<x>/<x>.level.json` ya da `<x>/<x>.karakter.json` içeren klasör, kendi adlı dosyanın türüyle TEK kart olur
// (çift tık o dosyayı açar; klasörün içine girmek için sağ tık ▸ "Klasörü aç"). Başka klasörler klasör kartıdır, çift tık içine girer.
"use strict";

export type IcerikTuru = "klasor" | "level" | "karakter" | "sekans" | "graf" | "npc" | "animasyon" | "model" | "gorsel" | "json" | "diger";
export type IcerikKoku = "Content" | "Engine";

/** Host'tan gelen düz öğe (host/icerik.ts `IcerikOgesi` ile aynı). */
export interface Oge { adres: string; klasor: boolean; boyut: number; degisti: number }

export const TUR_BILGISI: Readonly<Record<IcerikTuru, { ad: string; ikon: string }>> = {
  klasor: { ad: "Klasör", ikon: "📁" }, level: { ad: "Level", ikon: "🗺" }, karakter: { ad: "Karakter", ikon: "🧍" }, sekans: { ad: "Sekans", ikon: "🎞" },
  graf: { ad: "Graf", ikon: "🧩" }, npc: { ad: "NPC", ikon: "🤖" }, animasyon: { ad: "Animasyon", ikon: "🏃" }, model: { ad: "Model", ikon: "📦" },
  gorsel: { ad: "Görsel", ikon: "🖼" }, json: { ad: "JSON", ikon: "📄" }, diger: { ad: "Diğer", ikon: "❔" },
};
/** Süzgeç düğmelerinin sırası (klasör süzgeç değildir). */
export const SUZGEC_TURLERI: readonly IcerikTuru[] = ["level", "karakter", "sekans", "graf", "npc", "animasyon", "model", "gorsel", "json"];

export const kokAdi = (adres: string): string => adres.split("/")[0] ?? "";
export const dosyaAdi = (adres: string): string => adres.split("/").at(-1) ?? "";
export const ustKlasor = (adres: string): string => adres.split("/").slice(0, -1).join("/");
/** Adın ilk noktaya kadar kısmı (`Orion.karakter.json` → `Orion`): sekans/graf/NPC/level'ın depodaki adı budur. */
export const govdeAdi = (adres: string): string => { const a = dosyaAdi(adres), i = a.indexOf("."); return i > 0 ? a.slice(0, i) : a; };

const UZANTILI = (ad: string, ...u: string[]): boolean => u.some((x) => ad.toLowerCase().endsWith(x));

/** Bir adresin türü. `klasor`: öğe klasör mü. */
export function turTani(adres: string, klasor: boolean): IcerikTuru {
  if (klasor) return "klasor";
  const ad = dosyaAdi(adres);
  if (UZANTILI(ad, ".level.json")) return "level";
  if (UZANTILI(ad, ".karakter.json")) return "karakter";
  if (UZANTILI(ad, ".glb", ".gltf", ".vrm")) return "model";
  if (UZANTILI(ad, ".png", ".jpg", ".jpeg", ".webp")) return "gorsel";
  if (UZANTILI(ad, ".json")) {
    const p = adres.split("/");
    if (p[0] === "Content" && p.length === 3) {
      const t = ({ Sequences: "sekans", Graphs: "graf", NPC: "npc", Animations: "animasyon" } as const)[p[1] as "Sequences"];
      if (t) return t;
    }
    return "json";
  }
  return "diger";
}

export interface AgacDugumu { ad: string; adres: string; cocuklar: AgacDugumu[] }

const sirala = (a: string, b: string): number => a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" });

/** Yalnız KLASÖRLERDEN ağaç (Unreal'ın sol klasör ağacı). Kök düğüm `kok`un kendisidir; öğeler ada göre. Üst klasörü listede olmayan öğe yoksayılmaz, ara klasörler üretilir. */
export function agacKur(ogeler: readonly Oge[], kok: IcerikKoku): AgacDugumu {
  const koke: AgacDugumu = { ad: kok, adres: kok, cocuklar: [] };
  const harita = new Map<string, AgacDugumu>([[kok, koke]]);
  const dugum = (adres: string): AgacDugumu => {
    const var_ = harita.get(adres);
    if (var_) return var_;
    const d: AgacDugumu = { ad: dosyaAdi(adres), adres, cocuklar: [] };
    harita.set(adres, d);
    dugum(ustKlasor(adres)).cocuklar.push(d);
    return d;
  };
  for (const o of ogeler) {
    if (kokAdi(o.adres) !== kok) continue;
    if (o.klasor) dugum(o.adres);
    else dugum(ustKlasor(o.adres));   // klasör satırı eksik gelse de dosyanın üst zinciri kurulur
  }
  const duzenle = (d: AgacDugumu): void => { d.cocuklar.sort((a, b) => sirala(a.ad, b.ad)); d.cocuklar.forEach(duzenle); };
  duzenle(koke);
  return koke;
}

export interface Kart {
  adres: string;
  ad: string;
  tur: IcerikTuru;
  /** Çift tıkta açılacak adres (paket kartında klasörün içindeki dosya; klasör kartında klasörün kendisi). */
  ac: string;
  /** Kartın kendisi klasör mü (paket kartı klasördür ama `tur` level/karakter olur). */
  klasor: boolean;
  boyut: number;
  degisti: number;
  /** Engine içeriği: yazan işlemler kapalı. */
  saltOkunur: boolean;
}

/** Projenin tür klasörleri (host/proje.js `ICERIK_KLASORLERI`); yeniden adlanmaz/silinmez. Ayrışırsa icerikModeli.test.ts kırılır. */
export const TUR_KLASORLERI: readonly string[] = ["Levels", "Characters", "Animations", "Sequences", "Graphs", "NPC", "Assets"];

const PAKET_TURLERI = [".level.json", ".karakter.json"] as const;

/** Klasör bir paket mi (`<x>/<x>.level.json` | `<x>/<x>.karakter.json`)? Evetse paketin dosya adresi, hayırsa null. */
export function paketDosyasi(klasorAdresi: string, cocuklar: ReadonlySet<string>): string | null {
  const ad = dosyaAdi(klasorAdresi);
  for (const u of PAKET_TURLERI) { const a = `${klasorAdresi}/${ad}${u}`; if (cocuklar.has(a)) return a; }
  return null;
}

export interface KartSecenek {
  /** Aranan metin (büyük/küçük harf ve Türkçe farkı gözetmez); doluysa seçili klasörün TÜM altı aranır, düz sonuç. */
  arama?: string;
  /** Boş/yoksa hepsi; doluysa yalnız bu türler (klasörler süzgeçte görünmez: tür seçilince içerik aranır). */
  turler?: ReadonlySet<IcerikTuru>;
}

const normal = (s: string): string => s.toLocaleLowerCase("tr").normalize("NFC");

/**
 * `klasor`ün kartları. Aramasız/süzgeçsiz: yalnız DOĞRUDAN çocuklar (klasörler önde, ada göre). Arama ya da süzgeç varsa: klasörün bütün altı, düz liste (klasör kartı yok).
 * Paket klasörlerinin içindeki dosyalar ayrı kart olmaz (paket tek kart); arama/süzgeçte de paketin kendisi görünür, içi görünmez.
 */
export function kartlar(ogeler: readonly Oge[], klasor: string, sec: KartSecenek = {}): Kart[] {
  const adresler = new Set(ogeler.map((o) => o.adres));
  const paketler = new Map<string, string>();   // paket klasörü → dosyası
  for (const o of ogeler) if (o.klasor) { const p = paketDosyasi(o.adres, adresler); if (p) paketler.set(o.adres, p); }
  // Paketin İÇİNE girilmişse (klasör paketin kendisi ya da altı) o paketin dosyaları görünür; yoksa paket tek karttır.
  const paketIci = (adres: string): boolean => {
    for (const k of paketler.keys()) if (adres.startsWith(`${k}/`) && klasor !== k && !klasor.startsWith(`${k}/`)) return true;
    return false;
  };
  const arama = sec.arama ? normal(sec.arama.trim()) : "";
  const turler = sec.turler && sec.turler.size ? sec.turler : null;
  const derin = arama !== "" || turler !== null;
  const sonuc: Kart[] = [];
  for (const o of ogeler) {
    const ust = ustKlasor(o.adres);
    if (derin ? !(o.adres.startsWith(`${klasor}/`)) : ust !== klasor) continue;
    if (paketIci(o.adres)) continue;
    const paket = o.klasor ? paketler.get(o.adres) : undefined;
    const tur: IcerikTuru = paket ? turTani(paket, false) : turTani(o.adres, o.klasor);
    if (derin && o.klasor && !paket) continue;
    if (turler && !turler.has(tur)) continue;
    const ad = dosyaAdi(o.adres);
    if (arama && !normal(ad).includes(arama)) continue;
    sonuc.push({ adres: o.adres, ad, tur, ac: paket ?? o.adres, klasor: o.klasor, boyut: o.boyut, degisti: o.degisti, saltOkunur: kokAdi(o.adres) === "Engine" });
  }
  return sonuc.sort((a, b) => Number(b.klasor && b.tur === "klasor") - Number(a.klasor && a.tur === "klasor") || sirala(a.ad, b.ad));
}

/** Kırıntı yolu: `Content/Characters/Orion` → [{ad:"Content",adres:"Content"}, {ad:"Characters",…}, …]. */
export function kirinti(adres: string): { ad: string; adres: string }[] {
  const p = adres.split("/");
  return p.map((ad, i) => ({ ad, adres: p.slice(0, i + 1).join("/") }));
}

/** Silinen/adlanan öğeden sonra seçili klasör hâlâ var mı; yoksa var olan en yakın üst klasör (kök hep vardır). */
export function gecerliKlasor(ogeler: readonly Oge[], istenen: string): string {
  const klasorler = new Set(ogeler.filter((o) => o.klasor).map((o) => o.adres));
  for (let a = istenen; a; a = ustKlasor(a)) { if (klasorler.has(a) || !a.includes("/")) return a; }
  return istenen.split("/")[0] ?? "Content";
}

/** Favori listesini değiştir: varsa çıkar, yoksa sona ekle (en çok 40). Aynı adres iki kez olmaz. */
export function favoriDegistir(liste: readonly string[], adres: string): string[] {
  if (liste.includes(adres)) return liste.filter((a) => a !== adres);
  return [...liste.filter((a) => a !== adres), adres].slice(-40);
}

/** Kayıttan okunan favori listesi: dizi değilse/yanlış tipse boş; yalnız bilinen köke ait metinler. */
export function favoriOku(ham: unknown): string[] {
  if (!Array.isArray(ham)) return [];
  const g: string[] = [];
  for (const a of ham) if (typeof a === "string" && /^(Content|Engine)(\/|$)/.test(a) && !g.includes(a)) g.push(a);
  return g.slice(-40);
}

/** Çift tıkta ne olur: panel bu karara göre ilgili editörü/pencereyi açar. */
export type AcmaEylemi = "gir" | "sekans" | "graf" | "level" | "onizleme" | "gorsel" | "yok";
export function acmaEylemi(tur: IcerikTuru): AcmaEylemi {
  switch (tur) {
    case "klasor": return "gir";
    case "sekans": return "sekans";
    case "graf": return "graf";
    case "level": return "level";
    case "karakter": case "model": return "onizleme";
    case "gorsel": return "gorsel";
    default: return "yok";
  }
}

/** Boyut metni (kartın altında). */
export function boyutMetni(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

/** Yazan işlemlerin (adlandır/çoğalt/sil/yeni klasör/içe aktar) bu kartta/klasörde açık olup olmadığı ve değilse nedeni. */
export function islemDurumu(adres: string): { yazilabilir: boolean; neden?: string; korumali: boolean } {
  const p = adres.split("/");
  if (p[0] === "Engine") return { yazilabilir: false, neden: "Engine içeriği salt okunur", korumali: true };
  const korumali = p.length === 1 || (p.length === 2 && TUR_KLASORLERI.includes(p[1]!));   // Content ve tür klasörleri (host/icerik.js KORUMALI ile aynı yedi ad)
  return { yazilabilir: true, korumali };
}

/**
 * Kartı klasöre sürükleyip bırakma: taşınabilir mi (host/icerik.js `tasi` ile AYNI kural; renderer'da erken ret ve bırakma hedefi vurgusu için).
 * Taşınabilirse null, değilse neden. "zaten orada" da bir nedendir (bırakma yok sayılır).
 */
export function tasimaKurali(kaynak: string, hedefKlasor: string, hedefKlasorMu = true): string | null {
  const k = kaynak.split("/"), h = hedefKlasor.split("/");
  if (k[0] !== "Content" || h[0] !== "Content") return "Engine içeriği salt okunur";
  if (!hedefKlasorMu) return "hedef klasör değil";
  if (islemDurumu(kaynak).korumali) return "korumalı klasör taşınamaz";
  if (h.length < 2) return "Content köküne taşınamaz";
  if (k[1] !== h[1]) return `yalnız aynı tür klasörü içinde taşınır (${k[1]} → ${h[1]})`;
  if (hedefKlasor === kaynak || hedefKlasor.startsWith(`${kaynak}/`)) return "klasör kendi içine taşınamaz";
  if (k.slice(0, -1).join("/") === hedefKlasor) return "zaten orada";
  if (k[1] === "Levels" && k.length === 4 && k[3]!.endsWith(".level.json")) return "level dosyası klasörüyle birlikte taşınır";
  if (h[1] === "Levels" && h.length > 2) return "level klasörleri Levels'ın altında düz durur";
  if (["Sequences", "Graphs", "NPC"].includes(h[1]!) && h.length > 2) return `${h[1]} düz bir klasördür`;
  return null;
}

/**
 * Bir içerik adresi biçimce geçerli mi (host/icerik.js `adresParcalari` ile AYNI kural; renderer'da erken ret için). Geçerliyse null, değilse neden.
 * Kök `Content` | `Engine`; parçalar boş, `.`, `..`, noktayla başlayan (gizli) ya da Windows'ta geçersiz karakterli olamaz.
 */
export function adresKurali(adres: string): string | null {
  if (typeof adres !== "string" || !adres) return "boş";
  const p = adres.split("/");
  if (p[0] !== "Content" && p[0] !== "Engine") return `bilinmeyen kök ${JSON.stringify(p[0])} (Content | Engine)`;
  for (const s of p.slice(1)) {
    if (!s) return "boş parça";
    if (s === "." || s === ".." || s.startsWith(".")) return `gizli/üst klasör parçası ${JSON.stringify(s)}`;
    if (/[\\:*?"<>|\u0000-\u001f]/.test(s)) return `geçersiz karakter ${JSON.stringify(s)}`;
  }
  return null;
}

/**
 * Kartta GÖRÜNEN ad: türün kendi uzantısı gürültüdür (`selamlasma_2.json` → `selamlasma_2`, `Orion.karakter.json` → `Orion`); tür etiketi zaten altta yazar.
 * Uzantısı anlamlı türlerde (model, görsel, json, diğer) ve klasörlerde ad olduğu gibi kalır. Adlandırma girdisi ve ipucu TAM adı kullanır.
 */
export function gorunenAd(k: { ad: string; tur: IcerikTuru; klasor: boolean }): string {
  if (k.klasor) return k.ad;
  const sonek = { sekans: ".json", graf: ".json", npc: ".json", animasyon: ".json", karakter: ".karakter.json", level: ".level.json" } as const;
  const s = (sonek as Record<string, string | undefined>)[k.tur];
  return s && k.ad.length > s.length && k.ad.endsWith(s) ? k.ad.slice(0, -s.length) : k.ad;
}

export type GezinmeTusu = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";
/**
 * Izgarada ok tuşuyla gezinme: `sayi` kart, `sutun` satır başına kart, `mevcut` seçili sıra (-1: seçim yok). Yeni sırayı verir; kenarda yerinde kalır
 * (sarmaz), seçim yokken ilk kart seçilir (End: sonuncu). Boş ızgarada -1.
 */
export function gezin(sayi: number, sutun: number, mevcut: number, tus: GezinmeTusu): number {
  if (!(sayi > 0)) return -1;
  const s = Math.max(1, Math.floor(sutun));
  if (tus === "Home") return 0;
  if (tus === "End") return sayi - 1;
  if (mevcut < 0 || mevcut >= sayi) return tus === "ArrowUp" || tus === "ArrowLeft" ? sayi - 1 : 0;
  const sonraki = tus === "ArrowRight" ? mevcut + 1 : tus === "ArrowLeft" ? mevcut - 1 : tus === "ArrowDown" ? mevcut + s : mevcut - s;
  return sonraki < 0 || sonraki >= sayi ? mevcut : sonraki;
}

/** Kart boyutu kaydırıcısı: geçerli aralığa (72–200 px) sıkıştırır; sayı değilse varsayılan 104. */
export function kartGenisligi(ham: unknown): number {
  const n = typeof ham === "number" ? ham : typeof ham === "string" && ham.trim() ? Number(ham) : Number.NaN;
  return Number.isFinite(n) ? Math.min(200, Math.max(72, Math.round(n))) : 104;
}
