// uygulama/graf/grafTurDenetimi.ts — GRAFİĞİN ANLAM DENETİMİ (spec 35): biçimi `protocol/graf.ts` doğrular; burası kütüphaneye göre bakar.
//
// "Kontrol et" düğmesi ve Orion'un `dunya_oner`i bunu çağırır; hata listesi editörde ve modele döner (sessiz düşme yok). Kurallar (Blueprint ile aynı):
//   • her düğüm türü kayıtlı; ayarlar türüne ve aralığına uyar;
//   • bağ: kaynak bir ÇIKIŞ pini, hedef bir GİRİŞ pini, türler aynı (`herhangi` her veriyle bağlanır, `akis` yalnız `akis`la);
//   • bir veri girişine en çok bir bağ; bir akış çıkışından en çok bir bağ (dallanma Sıra düğümüyle);
//   • bağsız veri girişinin değeri ayarda ya da varsayılanda olmalı;
//   • akış DÖNGÜSÜ yok (tekrar için Tekrar düğümü: sonlanma garantisi), veri döngüsü yok;
//   • olay grafiğinde tam bir "▶ Başla"; fonksiyon (desen) grafiğinde tam bir "Fonksiyon girişi"; bir desen kendini doğrudan çağıramaz.
"use strict";
import type { Graf, GrafDegeri, PinTanimi } from "../../protocol/graf.ts";
import { secenekleriCoz, type DugumKaydi, type DugumPinleri, type DugumTanimi, type PinOrtami } from "./dugumKaydi.ts";

/** Olay/fonksiyon giriş-çıkış düğümlerinin türleri (yorumlayıcıyla ortak). */
export const BASLA_TIPI = "olay.basla";
export const FONKSIYON_GIRIS_TIPI = "fonksiyon.giris";
export const FONKSIYON_DONUS_TIPI = "fonksiyon.donus";
export const DESEN_CAGIR_TIPI = "desen.cagir";

export interface CozulmusDugum {
  tanim: DugumTanimi<unknown>;
  pinler: DugumPinleri;
  ayar: Readonly<Record<string, GrafDegeri>>;
}

const pinBul = (l: readonly PinTanimi[], ad: string) => l.find((p) => p.ad === ad) ?? null;
const uyumlu = (a: PinTanimi["tip"], b: PinTanimi["tip"]) =>
  a === b || (a !== "akis" && b !== "akis" && (a === "herhangi" || b === "herhangi"));

function ayarHatalari(id: string, t: DugumTanimi<unknown>, ayar: Readonly<Record<string, GrafDegeri>>, ortam: PinOrtami): string[] {
  const h: string[] = [];
  for (const a of t.ayarlar ?? []) {
    const d = ayar[a.ad];
    if (d === undefined || d === null) continue;
    if (a.tip === "sayi") {
      if (typeof d !== "number") { h.push(`${id}.${a.ad}: sayı olmalı`); continue; }
      if ((a.en !== undefined && d < a.en) || (a.cok !== undefined && d > a.cok)) h.push(`${id}.${a.ad}: ${d} aralık dışı (${a.en ?? "-∞"}–${a.cok ?? "∞"})`);
    } else if (a.tip === "bool") {
      if (typeof d !== "boolean") h.push(`${id}.${a.ad}: true/false olmalı`);
    } else {
      if (typeof d !== "string") { h.push(`${id}.${a.ad}: metin olmalı`); continue; }
      const secenekler = secenekleriCoz(a, ortam);
      if (secenekler && !secenekler.includes(d)) h.push(`${id}.${a.ad}: '${d}' geçersiz (seçenekler: ${secenekler.join(", ") || "yok"})`);
    }
  }
  return h;
}

/** Düğümleri kütüphaneyle çözer; çözülemeyenler hata olur (çözüm haritası yalnız çözülenleri taşır). */
export function dugumleriCoz(g: Graf, kayit: DugumKaydi<unknown>, ortam: PinOrtami): { cozum: Map<string, CozulmusDugum>; hatalar: string[] } {
  const cozum = new Map<string, CozulmusDugum>();
  const hatalar: string[] = [];
  const pinOrtami: PinOrtami = { ...ortam, buGraf: g };
  for (const d of g.dugumler) {
    const t = kayit.al(d.tip);
    if (!t) { hatalar.push(`${d.id}: bilinmeyen düğüm türü '${d.tip}'`); continue; }
    const ayar: Record<string, GrafDegeri> = {};
    for (const a of t.ayarlar ?? []) if (a.varsayilan !== undefined) ayar[a.ad] = a.varsayilan;
    Object.assign(ayar, d.ayar ?? {});
    let pinler: DugumPinleri;
    try { pinler = t.pinler(ayar, pinOrtami); }
    catch (err) { hatalar.push(`${d.id}: ${err instanceof Error ? err.message : String(err)}`); continue; }
    hatalar.push(...ayarHatalari(d.id, t, ayar, pinOrtami));
    cozum.set(d.id, { tanim: t, pinler, ayar });
  }
  return { cozum, hatalar };
}

function donguVarMi(dugumler: readonly string[], kenarlar: ReadonlyMap<string, readonly string[]>): string | null {
  const durum = new Map<string, 1 | 2>();
  const ziyaret = (n: string): string | null => {
    durum.set(n, 1);
    for (const m of kenarlar.get(n) ?? []) {
      const s = durum.get(m);
      if (s === 1) return m;
      if (s === undefined) { const r = ziyaret(m); if (r) return r; }
    }
    durum.set(n, 2);
    return null;
  };
  for (const n of dugumler) if (!durum.has(n)) { const r = ziyaret(n); if (r) return r; }
  return null;
}

/** Grafiğin anlam hataları; boş liste = çalıştırılabilir. */
export function grafTurDenetle(g: Graf, kayit: DugumKaydi<unknown>, ortam: PinOrtami): string[] {
  const { cozum, hatalar } = dugumleriCoz(g, kayit, ortam);
  const girisSayisi = new Map<string, number>();
  const akisCikisSayisi = new Map<string, number>();
  const akisKenari = new Map<string, string[]>();
  const veriKenari = new Map<string, string[]>();

  for (const [i, b] of g.baglar.entries()) {
    const k = cozum.get(b.kaynak[0]), h = cozum.get(b.hedef[0]);
    if (!k || !h) continue;   // düğüm çözülemedi: hatası zaten yazıldı
    const kp = pinBul(k.pinler.cikislar, b.kaynak[1]);
    const hp = pinBul(h.pinler.girisler, b.hedef[1]);
    if (!kp) { hatalar.push(`baglar[${i}]: '${b.kaynak[0]}' düğümünün '${b.kaynak[1]}' adlı ÇIKIŞ pini yok (çıkışlar: ${k.pinler.cikislar.map((p) => p.ad).join(", ") || "yok"})`); continue; }
    if (!hp) { hatalar.push(`baglar[${i}]: '${b.hedef[0]}' düğümünün '${b.hedef[1]}' adlı GİRİŞ pini yok (girişler: ${h.pinler.girisler.map((p) => p.ad).join(", ") || "yok"})`); continue; }
    if (!uyumlu(kp.tip, hp.tip)) { hatalar.push(`baglar[${i}]: tür uyuşmuyor (${b.kaynak.join(".")}: ${kp.tip} → ${b.hedef.join(".")}: ${hp.tip})`); continue; }
    if (kp.tip === "akis") {
      const anahtar = b.kaynak.join("\u0000");
      akisCikisSayisi.set(anahtar, (akisCikisSayisi.get(anahtar) ?? 0) + 1);
      (akisKenari.get(b.kaynak[0]) ?? akisKenari.set(b.kaynak[0], []).get(b.kaynak[0])!).push(b.hedef[0]);
    } else {
      const anahtar = b.hedef.join("\u0000");
      girisSayisi.set(anahtar, (girisSayisi.get(anahtar) ?? 0) + 1);
      (veriKenari.get(b.hedef[0]) ?? veriKenari.set(b.hedef[0], []).get(b.hedef[0])!).push(b.kaynak[0]);
    }
  }
  for (const [a, n] of girisSayisi) if (n > 1) hatalar.push(`${a.replace("\u0000", ".")}: veri girişine ${n} bağ var (en çok 1)`);
  for (const [a, n] of akisCikisSayisi) if (n > 1) hatalar.push(`${a.replace("\u0000", ".")}: akış çıkışından ${n} bağ var (en çok 1; dallanma için Sıra düğümü)`);

  // Bağsız veri girişinin değeri ayarda olmalı.
  for (const [id, c] of cozum) {
    for (const p of c.pinler.girisler) {
      if (p.tip === "akis" || girisSayisi.has(`${id}\u0000${p.ad}`)) continue;
      if (c.ayar[p.ad] === undefined) hatalar.push(`${id}.${p.ad}: bağlı değil ve ayarı yok (bir bağ ya da ayar.${p.ad} ver)`);
    }
  }

  const kimlikler = g.dugumler.map((d) => d.id);
  const akisDongusu = donguVarMi(kimlikler, akisKenari);
  if (akisDongusu) hatalar.push(`akış döngüsü var ('${akisDongusu}' üzerinden): tekrar için Tekrar düğümünü kullan`);
  const veriDongusu = donguVarMi(kimlikler, veriKenari);
  if (veriDongusu) hatalar.push(`veri döngüsü var ('${veriDongusu}' üzerinden)`);

  const say = (tip: string) => g.dugumler.filter((d) => d.tip === tip).length;
  if (g.tur === "olay") {
    if (say(BASLA_TIPI) !== 1) hatalar.push(`olay grafiğinde tam bir '▶ Başla' (${BASLA_TIPI}) olmalı (${say(BASLA_TIPI)} var)`);
    if (say(FONKSIYON_GIRIS_TIPI) || say(FONKSIYON_DONUS_TIPI)) hatalar.push("olay grafiğinde fonksiyon giriş/dönüş düğümü olmaz");
  } else {
    if (say(FONKSIYON_GIRIS_TIPI) !== 1) hatalar.push(`desen (fonksiyon) grafiğinde tam bir 'Fonksiyon girişi' (${FONKSIYON_GIRIS_TIPI}) olmalı (${say(FONKSIYON_GIRIS_TIPI)} var)`);
    if (say(BASLA_TIPI)) hatalar.push("desen grafiğinde '▶ Başla' olmaz (desen başka grafikten çağrılır)");
  }
  for (const d of g.dugumler) {
    if (d.tip === DESEN_CAGIR_TIPI && d.ayar?.["desen"] === g.ad) hatalar.push(`${d.id}: desen kendini çağıramaz ('${g.ad}')`);
  }
  return hatalar;
}
