// world/level/cekirdek/levelTanimi.ts — Bir level'in VERİ tanımı ve doğrulaması (spec 17 düzeni). Saf.
//
// LEVEL = VERİ. Işık, ortam, palet ve katmanlar (gök, zemin, bulut, çim…) bir JSON dosyasında durur
// (ör. world/level/ova/ova.level.json). Kod yalnız modülleri tanır (world/level/moduller/); hangi modülün
// hangi ayarla, hangi sırayla kurulacağı tanımdadır. Level paneli bu tanımı canlı düzenler ve dosyaya geri
// yazar — elle kod düzenlemek gerekmez.
//
// Ortak çekirdek: ova bugün kullanıyor; Orion'un odası ileride aynı tanıma taşınacak (ayrı adım).
"use strict";
import { hex } from "./renk.ts";
import { grafAdiGecerli } from "../../../protocol/graf.ts";
import { anlamHatasi, type Anlam } from "./anlam.ts";
import { bilesenlerHatasi, hiyerarsiHatasi, ustHatasi, type BilesenKaydi } from "./bilesenKaydi.ts";
import { stilHatasi, type StilAyari } from "../stil/stilTanimi.ts";
import type { ZamanAyari } from "../shader/dunyaDurumu.ts";
import type { ShaderTanimi } from "../shader/shaderSistemi.ts";

export const LEVEL_SURUMU = 1;

export type Vec3 = [number, number, number];

export interface GolgeAyari {
  acik: boolean;
  /** Gölge haritası çözünürlüğü (kare kenarı, piksel). */
  boyut: number;
  /** Kademeli gölge haritası kademe sayısı (1–4). */
  kademe: number;
  /** Gölgenin çizildiği en uzak mesafe (m). */
  uzaklik: number;
  /** 0 = sert kenar; büyüdükçe yumuşar (PCF). */
  yumusaklik: number;
  /** Gölgenin koyuluğu (0 = siyah, 1 = görünmez). */
  koyuluk: number;
  /**
   * Kademeleri kameranın GÖRDÜĞÜ derinliğe sıkıştır (Babylon autoCalcDepthBounds): boş gökyüzüne/uzağa harita
   * harcanmaz, gölge belirgin keskinleşir. Eski dosyalarda yoksa açık (levelKur doldurur).
   */
  otomatikSinir?: boolean;
  /** 0 = PCF (sert/yumuşak kenar `yumusaklik`tan) · 1 = PCSS: temasta sert, uzaklaştıkça yumuşayan gölge. */
  kip?: number;
  /** Kademe geçişinde karışım payı (0–0,5): geçiş çizgisi görünmesin. */
  karisim?: number;
}

export interface IsikAyari {
  gunes: { yon: Vec3; renk: string; siddet: number; golge: GolgeAyari };
  /** Gökten gelen dolgu: üstten `ust`, alttan `alt`. Güneşin belirgin altında kalmalı (gölge yıkanmasın). */
  dolgu: { ust: string; alt: string; siddet: number };
}

export interface OrtamAyari {
  arkaPlan: string;
  sis: { acik: boolean; renk: string; yogunluk: number };
  /** Görüntü işleme: ton eşleme (ACES), pozlama, kontrast. */
  tonlama: { acik: boolean; pozlama: number; kontrast: number };
  kamera: { uzak: number };
  /**
   * Piksel kipi: iç çözünürlük 1/piksel, en-yakın komşuyla büyütülür (1 = kapalı, 2–8). Piksel-sanat
   * gölgelendiricisinin ucuz önizlemesi. Eski dosyalarda yoksa 1 sayılır (levelKur `normallestir` doldurur).
   */
  piksel?: number;
}

/** Bir katman = bir modül örneği. `tur` modül kaydındaki ad (world/level/moduller/). */
export interface KatmanTanimi {
  tur: string;
  /** Aynı türden birden çok katman olursa ayırt etmek için. */
  ad: string;
  acik: boolean;
  ayar: Record<string, unknown>;
}

/**
 * Elle yerleştirilmiş bir varlık (level editörü, spec 22): katalogdaki adı, taban ortası konumu, dönüş, ölçek.
 * Eski biçim (yalnız Y dönüşü + tek ölçek sayısı) aynen geçerli; editör ancak gerekince diziye genişletir
 * (cekirdek/donusum.ts) — dosya küçük kalır.
 */
export interface NesneYeri extends AktorOzellikleri {
  /** Kararlı kimlik (seçim, sahne düğümü, geri al). Yoksa levelKur doldurur (cekirdek/kimlik.ts); benzersiz. */
  id?: string;
  varlik: string;
  /** Sahne ağacında görünen ad; yoksa varlığın kısa adı. */
  ad?: string;
  konum: Vec3;
  /** Derece. Sayı = yalnız Y (eski biçim); [x, y, z] = Babylon Euler (yaw-pitch-roll sırası). */
  donus: number | Vec3;
  /** Sayı = eşit ölçek; [x, y, z] = eksen başına. Hepsi > 0. */
  olcek: number | Vec3;
  /** Bağlı olduğu grubun kimliği (`gruplar`). */
  grup?: string;
  /** Sahnede görünmez (kaydedilir; oyunda da yok). */
  gizli?: boolean;
  /** Editörde seçilemez/taşınamaz (yanlışlıkla oynatılmasın). */
  kilitli?: boolean;
  /**
   * Orion için anlam (spec 23 B): tür, eylemler, algılanır mı, not. Verilmeyen alan varlığın/kategorinin
   * sözlükteki anlamından gelir (cekirdek/anlam.ts `etkinAnlam`). `ad` burada değil, yukarıda (tek ad).
   */
  anlam?: Omit<Anlam, "ad">;
}

/** Aktör değişkeninin değeri (spec 43; Unreal "Instance Editable"): düz değer, grafın değişken türleriyle aynı üçü. */
export type AktorDegiskeni = number | string | boolean;
/** Aktör değişkeni tavanları (veri koruması): adet ve metin uzunluğu (graf değişkenleriyle aynı ölçek: `uygulama/graf/grafDurumu.ts`). */
export const AKTOR_DEGISKEN_SINIRI = { adet: 16, metin: 200 } as const;

/**
 * Her aktörün (nesne, ışık) ORTAK, isteğe bağlı alanları (spec 43): bağlı graf ve örnek başına değişkenler. Alan yoksa hiçbir şey değişmez (eski level bire bir aynı).
 * `graf` grafik deposundaki ad (var olduğu çalışma anında denetlenir: level dosyası depoyu bilmez). Değişkenler BAŞLANGIÇ değeridir; graf çalışırken yazdığı bellekte kalır.
 */
export interface AktorOzellikleri {
  graf?: string;
  degiskenler?: Record<string, AktorDegiskeni>;
  /** Bileşenler (spec 45): tür + ayar listesi (`bilesenKaydi.ts`). Yoksa boş; eski level bire bir aynı. */
  bilesenler?: BilesenKaydi[];
  /** Üst aktörün kimliği (ya da `beden:<ad>`): varken `konum`/`donus` üste göre yereldir (spec 45 §3). */
  ust?: string;
  /** Üstteki soketin adı (`ust` aktörün `soket` bileşeni ya da bedenin soketi). */
  soket?: string;
}

/** Işık aktörü türleri (spec 42). MVP yalnız `nokta`; spot ve yönlü (ek güneş) sonra eklenir (alan eklemek kırıcı değil). */
export const ISIK_TURLERI = ["nokta"] as const;
export type IsikTuru = (typeof ISIK_TURLERI)[number];
/** Bir level'daki ışık aktörü sayısı üst sınırı (veri koruması; çizim bütçesi ölçümü spec 42 Y3, sınır ölçümle ayarlanır). */
export const ISIK_TAVANI = 8;

/**
 * Level'a yerleştirilen ışık kaynağı (spec 42; Unreal'da Place Actors ▸ Lights): güneş+dolgudan AYRI, istenildiği kadar (tavana dek).
 * `menzil` m (ışığın etkilediği uzaklık), `siddet` ≥ 0, `renk` palet adı ya da "#rrggbb". Kimlik `i<sayı>` (nesneler `n<sayı>`'dan ayrı ad alanı).
 */
export interface IsikAktoru extends AktorOzellikleri {
  /** Kararlı kimlik; yoksa levelKur doldurur ("i1", "i2"…). Nesne kimlikleriyle de çakışmaz. */
  id?: string;
  ad?: string;
  tur: IsikTuru;
  konum: Vec3;
  renk: string;
  siddet: number;
  menzil: number;
  /** Sahnede kapalı (kaydedilir). */
  gizli?: boolean;
  /** Editörde taşınamaz. */
  kilitli?: boolean;
  /** Sahne ağacındaki grup (`gruplar`). */
  grup?: string;
}

/** Sahne ağacındaki klasör. İç içe olabilir (`ust`); gizli/kilitli içindekilere geçer. */
export interface GrupTanimi {
  id: string;
  ad: string;
  ust?: string;
  gizli?: boolean;
  kilitli?: boolean;
}

/**
 * Kamera yer imi: level'la birlikte kaydedilir. `ad` serbest metin (sayfa `?aci=<ad>` ile açar); `yuva` 1–9 ise
 * editörde Shift+rakam. Eski biçim (ad "3", yuva yok) geçerli: yuva addan okunur (`yerImiYuvasi`).
 * `zemineGore`: konumun y'si ZEMİNDEN yükseklik (arazi düzenlenince göz yüksekliği korunur, yere gömülmez).
 */
export interface KameraYeri {
  ad: string;
  konum: Vec3;
  hedef: Vec3;
  yuva?: number;
  zemineGore?: boolean;
}

/** Yer iminin yuvası: açıkça verilmişse o, yoksa ad tek rakamsa (eski biçim) o, değilse null. */
export const yerImiYuvasi = (y: KameraYeri): number | null => y.yuva ?? (/^[1-9]$/.test(y.ad) ? Number(y.ad) : null);

/** Bir geçidin öbür yanı. Bugün yalnız Orion'un ofisi (spec 24); level'lar arası ağ sonra. */
export const GECIT_HEDEFLERI = ["oda"] as const;
export type GecitHedefi = (typeof GECIT_HEDEFLERI)[number];

/**
 * Geçit (spec 24): level'dan başka bir YERE açılan kapı — ova'da Orion'un ofisinin kapısı. Kapının ortası
 * `konum` (x, z; y zeminden okunur), `yon` kapıdan DIŞARI bakış (derece, Babylon yaw: 0 = +Z, 90 = +X).
 * Orion için çapası `kapi` olur (durak kapının önünde); ofisten çıkan kapının önünde, dışarı bakarak belirir.
 */
export interface Gecit {
  ad: string;
  konum: [number, number];
  yon: number;
  hedef: GecitHedefi;
  /** Görünen ad (Orion'un ve altyazının kullandığı); yoksa "kapı". */
  etiket?: string;
}

export interface LevelTanimi {
  surum: number;
  ad: string;
  /** Ad → "#rrggbb". Modüller renkleri adla ister. */
  palet: Record<string, string>;
  isik: IsikAyari;
  ortam: OrtamAyari;
  /** Görsel stil (toon, cel, çizgi, piksel… — stil/stilTanimi.ts). Yoksa "standart" (levelKur doldurur). */
  stil?: StilAyari;
  katmanlar: KatmanTanimi[];
  /** Asset tarayıcısıyla yerleştirilen nesneler (cekirdek/nesneSistemi.ts). Yoksa boş. */
  nesneler?: NesneYeri[];
  /** Işık aktörleri (spec 42): nokta ışıklar. Yoksa boş; güneş ve dolgu `isik`te kalır. */
  isiklar?: IsikAktoru[];
  /** Nesne grupları (sahne ağacı klasörleri). Yoksa boş. */
  gruplar?: GrupTanimi[];
  /** Kamera yer imleri. Yoksa boş. */
  kameraYerleri?: KameraYeri[];
  /** Başka yerlere açılan kapılar (spec 24). Yoksa boş. */
  gecitler?: Gecit[];
  /** Orion'un bu level'daki algısı: alan yarıçapı (m). Yoksa künyeden (`BEDEN.duyu.algiMenzil`). */
  algi?: { menzil: number };
  /** Gün/gece (spec 20): varsa güneş yönü ve ışık rengi SAATTEN gelir (isik.gunes.yon yok sayılır). */
  zaman?: ZamanAyari;
  /** Özel shader'lar (spec 20; shader/moduller/): sıra = ekran zinciri sırası. */
  shaderlar?: ShaderTanimi[];
}

export type Dogrulama = { ok: true; deger: LevelTanimi } | { ok: false; hata: string };

const nesneMi = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const sayiMi = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const metinMi = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const vec3Mu = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(sayiMi);
/** Seçimli mantıksal alanlardan ilk bozuğun adı (yoksa null). */
const secimliHata = (n: Record<string, unknown>, alanlar: readonly string[]): string | null =>
  alanlar.find((a) => n[a] !== undefined && typeof n[a] !== "boolean") ?? null;

/**
 * Tanımı doğrular. Bozuk tanım SESSİZCE düzeltilmez: hata yolu ve nedeniyle döner (panel kaydetmeyi reddeder,
 * sayfa hatayı gösterir). Katman ayarlarının içi modülün işidir (modül varsayılanla birleştirir).
 */
export function levelTanimiDogrula(v: unknown): Dogrulama {
  return levelMi(v) ? { ok: true, deger: v } : { ok: false, hata: hataBul(v) ?? "bilinmeyen" };
}

/** Tip koruyucu: tanım geçerli mi. */
export function levelMi(v: unknown): v is LevelTanimi { return hataBul(v) === null; }

/**
 * Tek yerleşimin hatası (alan + neden; geçerliyse null). `grupIdleri` verilmezse grup bağı denetlenmez (pano ve
 * hazır yapı dosyası: grubu yapıştırırken çözülür). Kimlik benzersizliği listenin işi (çağıran denetler).
 */
export function nesneHatasi(n: unknown, grupIdleri?: ReadonlySet<string>): { alan: string; neden: string } | null {
  const k = nesneMi(n) ? n["konum"] : null;
  if (!nesneMi(n) || typeof n["varlik"] !== "string" || !n["varlik"] || !vec3Mu(k)) return { alan: "", neden: "varlik (ad) + konum [x,y,z] gerekli" };
  if (!sayiMi(n["donus"]) && !vec3Mu(n["donus"])) return { alan: "donus", neden: "sayı ya da [x,y,z] olmalı" };
  const o = n["olcek"];
  if (!(sayiMi(o) && o > 0) && !(vec3Mu(o) && o.every((x) => x > 0))) return { alan: "olcek", neden: "> 0 sayı ya da [x,y,z] (> 0) olmalı" };
  if (n["id"] !== undefined && !metinMi(n["id"])) return { alan: "id", neden: "boş olmayan metin olmalı" };
  if (n["ad"] !== undefined && typeof n["ad"] !== "string") return { alan: "ad", neden: "metin olmalı" };
  const g = n["grup"];
  if (g !== undefined && (typeof g !== "string" || (grupIdleri && !grupIdleri.has(g)))) return { alan: "grup", neden: `olmayan grup "${String(g)}"` };
  const e = secimliHata(n, ["gizli", "kilitli"]);
  if (e) return { alan: e, neden: "mantıksal olmalı" };
  const ao = aktorOzellikleriHatasi(n);
  if (ao) return ao;
  if (n["anlam"] !== undefined) {
    if (typeof n["anlam"] === "object" && n["anlam"] !== null && "ad" in n["anlam"]) return { alan: "anlam.ad", neden: "ad yerleşimin kendisinde (nesneler[].ad)" };
    const h = anlamHatasi(n["anlam"]);
    if (h) return { alan: `anlam${h.alan ? `.${h.alan}` : ""}`, neden: h.neden };
  }
  return null;
}

/** Aktörün ortak alanlarının (`graf`, `degiskenler`, `bilesenler`, `ust`/`soket`) hatası; geçerliyse null. Nesne ve ışık aynı kuralı kullanır (kopya yok). */
export function aktorOzellikleriHatasi(a: Record<string, unknown>): { alan: string; neden: string } | null {
  if (a["graf"] !== undefined && !grafAdiGecerli(a["graf"])) return { alan: "graf", neden: "geçerli graf adı olmalı (harf, rakam, _ ve -)" };
  const bh = bilesenlerHatasi(a["bilesenler"]);
  if (bh) return bh;
  const uh = ustHatasi(a);
  if (uh) return uh;
  const d = a["degiskenler"];
  if (d === undefined) return null;
  if (!nesneMi(d)) return { alan: "degiskenler", neden: "nesne olmalı" };
  const adlar = Object.keys(d);
  if (adlar.length > AKTOR_DEGISKEN_SINIRI.adet) return { alan: "degiskenler", neden: `en çok ${AKTOR_DEGISKEN_SINIRI.adet} değişken (${adlar.length} var)` };
  for (const ad of adlar) {
    if (!grafAdiGecerli(ad)) return { alan: `degiskenler.${ad}`, neden: "değişken adı geçersiz (harf, rakam, _ ve -)" };
    const v = d[ad];
    if (typeof v === "number" ? !Number.isFinite(v) : typeof v === "string" ? v.length > AKTOR_DEGISKEN_SINIRI.metin : typeof v !== "boolean") {
      return { alan: `degiskenler.${ad}`, neden: `sayı, ${AKTOR_DEGISKEN_SINIRI.metin} karakteri aşmayan metin ya da mantıksal olmalı` };
    }
  }
  return null;
}

/**
 * Tek ışık aktörünün hatası (alan + neden; geçerliyse null). `renkMi` palet/hex denetimidir (level paletine bağlı), `grupIdleri` verilirse grup bağı denetlenir.
 */
export function isikAktoruHatasi(i: unknown, renkMi: (r: unknown) => boolean, grupIdleri?: ReadonlySet<string>): { alan: string; neden: string } | null {
  if (!nesneMi(i)) return { alan: "", neden: "nesne olmalı" };
  if (!(ISIK_TURLERI as readonly unknown[]).includes(i["tur"])) return { alan: "tur", neden: `bilinmeyen tür (bilinenler: ${ISIK_TURLERI.join(", ")})` };
  if (!vec3Mu(i["konum"])) return { alan: "konum", neden: "[x,y,z] (3 sayı) olmalı" };
  if (!renkMi(i["renk"])) return { alan: "renk", neden: "renk ya da palet adı değil" };
  if (!sayiMi(i["siddet"]) || i["siddet"] < 0) return { alan: "siddet", neden: "≥ 0 sayı olmalı" };
  if (!sayiMi(i["menzil"]) || i["menzil"] <= 0) return { alan: "menzil", neden: "> 0 sayı (m) olmalı" };
  if (i["id"] !== undefined && !metinMi(i["id"])) return { alan: "id", neden: "boş olmayan metin olmalı" };
  if (i["ad"] !== undefined && typeof i["ad"] !== "string") return { alan: "ad", neden: "metin olmalı" };
  const g = i["grup"];
  if (g !== undefined && (typeof g !== "string" || (grupIdleri && !grupIdleri.has(g)))) return { alan: "grup", neden: `olmayan grup "${String(g)}"` };
  const e = secimliHata(i, ["gizli", "kilitli"]);
  if (e) return { alan: e, neden: "mantıksal olmalı" };
  return aktorOzellikleriHatasi(i);
}

/** İlk hatanın yolu ve nedeni; geçerliyse `null`. */
function hataBul(v: unknown): string | null {
  const h = (yol: string, neden: string): string => `${yol}: ${neden}`;
  if (!nesneMi(v)) return h("kök", "nesne değil");
  if (v["surum"] !== LEVEL_SURUMU) return h("surum", `${LEVEL_SURUMU} olmalı`);
  if (typeof v["ad"] !== "string" || !v["ad"]) return h("ad", "boş");
  const palet = v["palet"];
  if (!nesneMi(palet)) return h("palet", "nesne değil");
  for (const [ad, r] of Object.entries(palet)) {
    if (typeof r !== "string") return h(`palet.${ad}`, "metin değil");
    try { hex(r); } catch { return h(`palet.${ad}`, `"#rrggbb" değil: ${r}`); }
  }
  const renkMi = (r: unknown) => typeof r === "string" && (r.startsWith("#") ? /^#[0-9a-fA-F]{6}$/.test(r) : r in palet);
  const isik = v["isik"], ortam = v["ortam"];
  if (!nesneMi(isik) || !nesneMi(isik["gunes"]) || !nesneMi(isik["dolgu"])) return h("isik", "gunes ve dolgu gerekli");
  const g = isik["gunes"], d = isik["dolgu"];
  if (!Array.isArray(g["yon"]) || g["yon"].length !== 3 || !g["yon"].every(sayiMi)) return h("isik.gunes.yon", "3 sayı olmalı");
  if (!renkMi(g["renk"])) return h("isik.gunes.renk", "renk ya da palet adı değil");
  if (!sayiMi(g["siddet"]) || g["siddet"] < 0) return h("isik.gunes.siddet", "≥ 0 sayı olmalı");
  const go = g["golge"];
  if (!nesneMi(go) || typeof go["acik"] !== "boolean" || !["boyut", "kademe", "uzaklik", "yumusaklik", "koyuluk"].every((k) => sayiMi(go[k]))) {
    return h("isik.gunes.golge", "acik + boyut/kademe/uzaklik/yumusaklik/koyuluk gerekli");
  }
  if (!Number.isInteger(go["kademe"]) || (go["kademe"] as number) < 1 || (go["kademe"] as number) > 4) return h("isik.gunes.golge.kademe", "1–4 tamsayı");
  if (!renkMi(d["ust"]) || !renkMi(d["alt"]) || !sayiMi(d["siddet"])) return h("isik.dolgu", "ust/alt renk + siddet gerekli");
  if (!nesneMi(ortam) || !renkMi(ortam["arkaPlan"])) return h("ortam.arkaPlan", "renk gerekli");
  const sis = ortam["sis"], ton = ortam["tonlama"], kam = ortam["kamera"];
  if (!nesneMi(sis) || typeof sis["acik"] !== "boolean" || !renkMi(sis["renk"]) || !sayiMi(sis["yogunluk"])) return h("ortam.sis", "acik/renk/yogunluk gerekli");
  if (!nesneMi(ton) || typeof ton["acik"] !== "boolean" || !sayiMi(ton["pozlama"]) || !sayiMi(ton["kontrast"])) return h("ortam.tonlama", "acik/pozlama/kontrast gerekli");
  if (!nesneMi(kam) || !sayiMi(kam["uzak"]) || kam["uzak"] <= 0) return h("ortam.kamera.uzak", "> 0 sayı");
  const pk = ortam["piksel"];
  if (pk !== undefined && (!Number.isInteger(pk) || (pk as number) < 1 || (pk as number) > 8)) return h("ortam.piksel", "1–8 tamsayı");
  if (v["stil"] !== undefined) { const s = stilHatasi(v["stil"], renkMi); if (s) return h("stil", s); }
  const z = v["zaman"];
  if (z !== undefined && (!nesneMi(z) || !["saat", "hiz", "egim", "dunya"].every((k) => sayiMi(z[k])) || typeof z["akiyor"] !== "boolean")) {
    return h("zaman", "saat, hiz, egim, dunya (sayı) + akiyor (mantıksal) gerekli");
  }
  const sl = v["shaderlar"];
  if (sl !== undefined) {
    if (!Array.isArray(sl)) return h("shaderlar", "dizi değil");
    for (const [i, s] of sl.entries()) {
      if (!nesneMi(s) || typeof s["tur"] !== "string" || typeof s["acik"] !== "boolean" || !nesneMi(s["ayar"])) return h(`shaderlar[${i}]`, "tur/acik/ayar gerekli");
    }
  }
  const gruplar = v["gruplar"];
  const grupIdleri = new Set<string>();
  if (gruplar !== undefined) {
    if (!Array.isArray(gruplar)) return h("gruplar", "dizi değil");
    for (const [i, g] of gruplar.entries()) {
      if (!nesneMi(g) || !metinMi(g["id"]) || typeof g["ad"] !== "string") return h(`gruplar[${i}]`, "id + ad gerekli");
      if (grupIdleri.has(g["id"])) return h(`gruplar[${i}].id`, `yinelenen kimlik "${g["id"]}"`);
      grupIdleri.add(g["id"]);
      const e = secimliHata(g, ["gizli", "kilitli"]);
      if (e) return h(`gruplar[${i}].${e}`, "mantıksal olmalı");
    }
    const ustu = new Map(gruplar.map((g) => [(g as Record<string, unknown>)["id"] as string, (g as Record<string, unknown>)["ust"]]));
    for (const [id, ust] of ustu) {
      if (ust === undefined) continue;
      if (typeof ust !== "string" || !grupIdleri.has(ust)) return h(`gruplar(${id}).ust`, `olmayan grup "${String(ust)}"`);
      // Döngü: üst zinciri kendine dönmemeli.
      const gorulen = new Set([id]);
      for (let u: unknown = ust; typeof u === "string"; u = ustu.get(u)) {
        if (gorulen.has(u)) return h(`gruplar(${id}).ust`, "döngü");
        gorulen.add(u);
      }
    }
  }
  const nesneler = v["nesneler"];
  if (nesneler !== undefined) {
    if (!Array.isArray(nesneler)) return h("nesneler", "dizi değil");
    const idler = new Set<string>();
    for (const [i, n] of nesneler.entries()) {
      const e = nesneHatasi(n, grupIdleri);
      if (e) return h(`nesneler[${i}]${e.alan ? `.${e.alan}` : ""}`, e.neden);
      const id = (n as Record<string, unknown>)["id"];
      if (typeof id === "string") {
        if (idler.has(id)) return h(`nesneler[${i}].id`, `yinelenen kimlik "${id}"`);
        idler.add(id);
      }
    }
  }
  const isiklar = v["isiklar"];
  if (isiklar !== undefined) {
    if (!Array.isArray(isiklar)) return h("isiklar", "dizi değil");
    if (isiklar.length > ISIK_TAVANI) return h("isiklar", `en çok ${ISIK_TAVANI} ışık (${isiklar.length} var)`);
    const idler = new Set<string>(Array.isArray(nesneler) ? nesneler.flatMap((n) => (nesneMi(n) && typeof n["id"] === "string" ? [n["id"]] : [])) : []);
    for (const [i, x] of isiklar.entries()) {
      const e = isikAktoruHatasi(x, renkMi, grupIdleri);
      if (e) return h(`isiklar[${i}]${e.alan ? `.${e.alan}` : ""}`, e.neden);
      const id = (x as Record<string, unknown>)["id"];
      if (typeof id === "string") {
        if (idler.has(id)) return h(`isiklar[${i}].id`, `yinelenen kimlik "${id}" (nesne ya da ışık)`);
        idler.add(id);
      }
    }
  }
  // Aktör hiyerarşisi (spec 45): nesne ve ışık TEK kimlik uzayında; üst var mı, döngü, derinlik.
  const tumAktorler = [...(Array.isArray(nesneler) ? nesneler : []), ...(Array.isArray(isiklar) ? isiklar : [])].filter(nesneMi);
  const hi = hiyerarsiHatasi(tumAktorler);
  if (hi) return h(`aktör "${hi.id}".ust`, hi.neden);
  const yerler = v["kameraYerleri"];
  if (yerler !== undefined) {
    if (!Array.isArray(yerler)) return h("kameraYerleri", "dizi değil");
    for (const [i, y] of yerler.entries()) {
      if (!nesneMi(y) || typeof y["ad"] !== "string" || !vec3Mu(y["konum"]) || !vec3Mu(y["hedef"])) return h(`kameraYerleri[${i}]`, "ad + konum + hedef [x,y,z] gerekli");
      const yv = y["yuva"];
      if (yv !== undefined && (!Number.isInteger(yv) || (yv as number) < 1 || (yv as number) > 9)) return h(`kameraYerleri[${i}].yuva`, "1–9 tamsayı");
      if (y["zemineGore"] !== undefined && typeof y["zemineGore"] !== "boolean") return h(`kameraYerleri[${i}].zemineGore`, "mantıksal olmalı");
    }
    const yuvalar = yerler.map((y) => yerImiYuvasi(y as KameraYeri)).filter((y): y is number => y !== null);
    if (new Set(yuvalar).size !== yuvalar.length) return h("kameraYerleri", "aynı yuvaya iki yer imi");
    const adlar = yerler.map((y) => (y as KameraYeri).ad);
    if (new Set(adlar).size !== adlar.length) return h("kameraYerleri", "yinelenen yer imi adı");
  }
  const algi = v["algi"];
  if (algi !== undefined) {
    if (!nesneMi(algi) || !sayiMi(algi["menzil"]) || algi["menzil"] <= 0) return h("algi.menzil", "pozitif sayı (m) gerekli");
  }
  const gecitler = v["gecitler"];
  if (gecitler !== undefined) {
    if (!Array.isArray(gecitler)) return h("gecitler", "dizi değil");
    for (const [i, g] of gecitler.entries()) {
      const yol = `gecitler[${i}]`;
      if (!nesneMi(g) || !metinMi(g["ad"])) return h(yol, "ad gerekli");
      const k = g["konum"];
      if (!Array.isArray(k) || k.length !== 2 || !k.every(sayiMi)) return h(`${yol}.konum`, "[x, z] gerekli (y zeminden)");
      if (!sayiMi(g["yon"])) return h(`${yol}.yon`, "derece (sayı) gerekli");
      if (!(GECIT_HEDEFLERI as readonly unknown[]).includes(g["hedef"])) return h(`${yol}.hedef`, `bilinmeyen hedef (bilinenler: ${GECIT_HEDEFLERI.join(", ")})`);
      if (g["etiket"] !== undefined && !metinMi(g["etiket"])) return h(`${yol}.etiket`, "boş olmayan metin olmalı");
    }
    const adlar = gecitler.map((g) => (g as Gecit).ad);
    if (new Set(adlar).size !== adlar.length) return h("gecitler", "yinelenen geçit adı");
    // Geçidin Orion için çapası `kapi` (protokolün çapa adı): aynı hedefe iki kapı iki `kapi` olurdu.
    const hedefler = gecitler.map((g) => (g as Gecit).hedef);
    if (new Set(hedefler).size !== hedefler.length) return h("gecitler", "aynı hedefe iki geçit");
  }
  const katmanlar = v["katmanlar"];
  if (!Array.isArray(katmanlar)) return h("katmanlar", "dizi değil");
  const adlar = new Set<string>();
  for (const [i, k] of katmanlar.entries()) {
    if (!nesneMi(k) || typeof k["tur"] !== "string" || typeof k["ad"] !== "string" || typeof k["acik"] !== "boolean" || !nesneMi(k["ayar"])) {
      return h(`katmanlar[${i}]`, "tur/ad/acik/ayar gerekli");
    }
    if (adlar.has(k["ad"])) return h(`katmanlar[${i}].ad`, `yinelenen ad "${k["ad"]}"`);
    adlar.add(k["ad"]);
  }
  return null;
}
