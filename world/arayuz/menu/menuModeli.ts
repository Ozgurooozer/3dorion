// world/arayuz/menu/menuModeli.ts — BAĞLAM MENÜSÜ ÇEKİRDEĞİ (spec 29): hedef türünden bağımsız, kurallı, alt menülü sağ tık menüsü. SAF (DOM ve Babylon yok).
//
// Fikir: menüyü bir yazılı liste değil KATKILAR kurar. Her katkı "hangi hedeflerde, hangi koşulda, hangi YOLA ne eklerim" der (Unreal'in menü uzantı noktaları
// gibi). Yol `["Buraya", "Git"]` demektir: "Buraya ▸ Git". Aynı yol parçasını kullanan katkılar kendiliğinden BİRLEŞİR: iki ayrı kural da "Orion ▸" altına girebilir,
// çekirdek hangisinin hangi hedef için olduğunu bilmez. Yeni hedef (terminal, tahta, duvar…) = yeni `hedef.tur` adı + yeni katkı; bu dosya değişmez.
//
// Kurallar: koşulu tutmayan katkı HİÇ görünmez; koşulu tutup yapılamayan öğe GRİ ve NEDENLİ görünür (sessizce gizlenmez: Ozyn neden yapılamadığını görür). Bir düzeyde
// çok öğe varsa fazlası "Diğer ▸"e taşınır. Gruplar arasına ayraç konur. Aynı kimlik iki kez ya da aynı ad hem yaprak hem alt menü olursa HATA fırlar (sessiz ezme yok).
// Çalıştırma burada YOK: yaprağın `eylem` yükü olduğu gibi döner, kökte tek eylem yolundan (`niyetiYurut`) geçer.
"use strict";

/** Menünün bakacağı bağlam: en az hedefin türü; gerisi katkılara özgü (hedef verisi, oyuncu, yer…). */
export interface MenuBaglami { hedef: { tur: string } }

/** Bir katkının menüye koyduğu YAPRAK. `yol` son parçası görünen ad, öncekiler alt menü adlarıdır. */
export interface MenuOgesi<E> {
  yol: readonly string[];
  /** Kararlı kimlik (kayıt, ileride kısayol atama buna bağlanır); menüde TEKİL olmalı. */
  kimlik: string;
  /** Sağda soluk yazılan kısayol ipucu (yalnız gösterim). */
  kisayol?: string;
  /** Sıralama sayısı (küçük önce; varsayılan 100). Alt menünün sırası içindeki en küçük sıradır. */
  sira?: number;
  /** Ayraç grubu: ardışık öğelerin grubu değişince araya ayraç girer (varsayılan ""). */
  grup?: string;
  uygun: boolean;
  /** `uygun` false ise nedeni (menüde ipucu olarak görünür). */
  neden?: string;
  /** Çalıştırılınca dönecek yük (çekirdek yorumlamaz). */
  eylem: E;
}

export interface MenuKatkisi<B extends MenuBaglami, E> {
  kimlik: string;
  /** Hangi hedef türlerinde (`b.hedef.tur`) çalışır; "hepsi" = her hedef. */
  hedefler: readonly string[] | "hepsi";
  /** Hedef doğru türdeyken ek koşul; false ise katkı hiç görünmez. */
  kosul?: (b: B) => boolean;
  ogeler: (b: B) => readonly MenuOgesi<E>[];
}

export type MenuDugumu<E> =
  | { tur: "eylem"; kimlik: string; ad: string; kisayol: string | null; uygun: boolean; neden: string | null; eylem: E }
  | { tur: "alt"; ad: string; uygun: boolean; neden: string | null; ogeler: MenuDugumu<E>[] }
  | { tur: "ayrac" };

export interface MenuKurAyari {
  /** Bir düzeyde en çok kaç öğe görünür; fazlası "Diğer ▸"e gider (varsayılan 8). */
  azamiOge: number;
}

const VARSAYILAN: MenuKurAyari = { azamiOge: 8 };
const SIRA = 100;

/** Birleşme ağacının ara düğümü (yalnız `menuKur` içinde). */
interface Dal<E> {
  ad: string;
  sira: number;
  grup: string;
  yaprak: MenuOgesi<E> | null;
  cocuk: Map<string, Dal<E>>;
}

const dalAc = <E>(ad: string): Dal<E> => ({ ad, sira: Infinity, grup: "", yaprak: null, cocuk: new Map() });

/** Kurallı menü: katkıları hedefe göre süz, yolları birleştir, sırala, taşırı "Diğer"e al, ayraç koy. */
export function menuKur<B extends MenuBaglami, E>(b: B, katkilar: readonly MenuKatkisi<B, E>[], ayar: Partial<MenuKurAyari> = {}): MenuDugumu<E>[] {
  const azami = Math.max(2, ayar.azamiOge ?? VARSAYILAN.azamiOge);
  const kok = dalAc<E>("");
  const gorulen = new Set<string>();

  for (const k of katkilar) {
    if (k.hedefler !== "hepsi" && !k.hedefler.includes(b.hedef.tur)) continue;
    if (k.kosul && !k.kosul(b)) continue;
    for (const o of k.ogeler(b)) {
      if (o.yol.length === 0 || o.yol.some((p) => p.trim() === "")) throw new Error(`menü: boş yol (${o.kimlik})`);
      if (gorulen.has(o.kimlik)) throw new Error(`menü: kimlik iki kez katkılandı: ${o.kimlik}`);
      gorulen.add(o.kimlik);
      let dal = kok;
      for (const parca of o.yol) {
        if (dal.yaprak) throw new Error(`menü: "${dal.ad}" hem eylem hem alt menü (${o.kimlik})`);
        let alt = dal.cocuk.get(parca);
        if (!alt) { alt = dalAc<E>(parca); dal.cocuk.set(parca, alt); }
        dal = alt;
      }
      if (dal.cocuk.size > 0 || dal.yaprak) throw new Error(`menü: "${dal.ad}" hem eylem hem alt menü ya da aynı yol iki kez (${o.kimlik})`);
      dal.yaprak = o;
    }
  }
  siraHesapla(kok);
  return duzeyKur(kok, azami);
}

/** Her dalın sırası/grubu: yaprakta kendisininki, alt menüde EN KÜÇÜK sıralı çocuğunkiler. */
function siraHesapla<E>(d: Dal<E>): void {
  if (d.yaprak) { d.sira = d.yaprak.sira ?? SIRA; d.grup = d.yaprak.grup ?? ""; return; }
  let en: Dal<E> | null = null;
  for (const c of d.cocuk.values()) {
    siraHesapla(c);
    if (!en || c.sira < en.sira) en = c;
  }
  if (en) { d.sira = en.sira; d.grup = en.grup; }
}

const sirali = <E>(d: Dal<E>): Dal<E>[] =>
  [...d.cocuk.values()].sort((a, b) => a.sira - b.sira || a.ad.localeCompare(b.ad, "tr"));

function dugumOf<E>(d: Dal<E>, azami: number): MenuDugumu<E> {
  if (d.yaprak) {
    const o = d.yaprak;
    return { tur: "eylem", kimlik: o.kimlik, ad: d.ad, kisayol: o.kisayol ?? null, uygun: o.uygun, neden: o.uygun ? null : (o.neden ?? null), eylem: o.eylem };
  }
  const ogeler = duzeyKur(d, azami);
  const hicbiriUygunDegil = ogeler.every((x) => x.tur === "ayrac" || !x.uygun);
  return { tur: "alt", ad: d.ad, uygun: !hicbiriUygunDegil, neden: hicbiriUygunDegil ? "hiçbiri şu an yapılamaz" : null, ogeler };
}

/** Bir düzeyin düğümleri: sıralı, taşan "Diğer ▸"e, gruplar arası ayraçlı. */
function duzeyKur<E>(d: Dal<E>, azami: number): MenuDugumu<E>[] {
  const dallar = sirali(d);
  let gorunen = dallar;
  let diger: Dal<E> | null = null;
  if (dallar.length > azami) {
    gorunen = dallar.slice(0, azami - 1);
    diger = dalAc<E>("Diğer");
    for (const t of dallar.slice(azami - 1)) diger.cocuk.set(t.ad, t);
    diger.sira = Infinity; diger.grup = gorunen[gorunen.length - 1]!.grup;
    gorunen = [...gorunen, diger];
  }
  const cikti: MenuDugumu<E>[] = [];
  let onceki: Dal<E> | null = null;
  for (const dal of gorunen) {
    if (onceki && onceki.grup !== dal.grup) cikti.push({ tur: "ayrac" });
    cikti.push(dugumOf(dal, azami));
    onceki = dal;
  }
  return cikti;
}

/**
 * Klavyeyle gezinme (SAF): `dugumler` içinde `mevcut`tan (yoksa null) `yon` (+1 aşağı, −1 yukarı) yönünde bir sonraki ETKİLEŞİLEBİLİR (ayraç değil, gri değil)
 * satırın dizini; sona gelince başa sarar; hiç yoksa null.
 */
export function sonrakiSatir<E>(dugumler: readonly MenuDugumu<E>[], mevcut: number | null, yon: 1 | -1): number | null {
  const n = dugumler.length;
  if (n === 0) return null;
  let i = mevcut ?? (yon === 1 ? -1 : n);
  for (let adim = 0; adim < n; adim++) {
    i = (i + yon + n) % n;
    const d = dugumler[i]!;
    if (d.tur !== "ayrac" && d.uygun) return i;
  }
  return null;
}
