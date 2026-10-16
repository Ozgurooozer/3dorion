// tools/kablo-haritasi.ts — kompozisyon kökündeki KABLO tablosu: hangi fabrika hangi canlı nesneye bağlı. Kodu DEĞİŞTİRMEZ, yalnız okur.
//
// `giris.ts` iş mantığı taşımaz, parçaları birbirine bağlar; ama bağlantı "kim kime neyle bağlı" tek yerde yazılı değil, 64 tembel getter (`() => orion`)
// ve 11 modül kapsamlı `let` olarak dağınık. Bu araç o tabloyu çıkarır (mimari raporu, 2026-10-16, "iletişim ağı" bulgusu).
//
// Bir KABLO: bir fabrika çağrısına (ya da `new X({...})`, ya da `const baglam = {...}` nesnesine) verilen bir alanın dayandığı ÜST DÜZEY canlı ad.
//   tembel   alan = `() => ad` ya da `get x() { return ad }`   (en saf kablo: tüketici çağrı anında okur; sonradan atananlar bu yolla gelir)
//   hesaplı  alan = işlev, gövdesi ad üzerinde iş yapıyor        (`() => kopru?.sayac() ?? {}`, `(n) => bedenAdimi(n)`)
//   değer    alan = doğrudan değer ya da ifade                   (`{ oyuncu }`, `acilis: varlikSinyali.acilis`) ve fabrikaya sıralı verilen bağımsız değişken
//
// Sınır (dürüstçe): yalnız ÜST DÜZEY `const`/`let` adları kaynak sayılır. `beyniBagla` gibi işlevlerin YEREL sabitleri (secim, duvar, panoKaydi …)
// haritada yoktur; blok yerelinin üst düzey adla çakışması ve alt-alt işlev gölgelemesi de ele alınmaz (yanlış alarm değil, eksik kablo olarak görünür).
//
// Kullanım: node --experimental-strip-types tools/kablo-haritasi.ts [dosya]   (varsayılan: uygulama/giris.ts)
"use strict";
import fs from "node:fs";
import path from "node:path";
import { parseAst } from "rolldown/parseAst";
import { dugumMu, liste, parantezsiz, desenAdlari, cocuklar, ustDuzey, type Dugum } from "./astGez.ts";

export type KabloTuru = "tembel" | "hesaplı" | "değer";
export interface Kablo { tuketici: string; anahtar: string; kaynak: string; tur: KabloTuru }

const TIP_SARMALAYICI = new Set(["TSAsExpression", "TSNonNullExpression", "TSSatisfiesExpression", "TSTypeAssertion", "TSInstantiationExpression"]);
const FONKSIYON = new Set(["ArrowFunctionExpression", "FunctionExpression"]);

const anahtarAdi = (p: Dugum): string | null =>
  p.computed ? null : dugumMu(p.key) && p.key.type === "Identifier" ? String(p.key.name) : dugumMu(p.key) && typeof p.key.value === "string" ? p.key.value : null;

/** Bir alt ağaçta anılan üst düzey adlar (üye adı, nesne anahtarı, tip konumu ve `gizli` yerelleri sayılmaz). */
function bagimliliklar(d: unknown, kaynaklar: ReadonlySet<string>, gizli: ReadonlySet<string>, cikti: Set<string>): void {
  if (!dugumMu(d)) return;
  if (d.type.startsWith("TS")) { if (TIP_SARMALAYICI.has(d.type)) bagimliliklar(d.expression, kaynaklar, gizli, cikti); return; }
  const ic = (x: unknown): void => bagimliliklar(x, kaynaklar, gizli, cikti);
  switch (d.type) {
    case "Identifier": { const ad = String(d.name); if (kaynaklar.has(ad) && !gizli.has(ad)) cikti.add(ad); return; }
    case "MemberExpression": ic(d.object); if (d.computed) ic(d.property); return;
    case "Property": case "PropertyDefinition": case "MethodDefinition": if (d.computed) ic(d.key); ic(d.value); return;
    case "VariableDeclarator": ic(d.init); return;
    default: for (const c of cocuklar(d)) ic(c);
  }
}

/** Kaynaktaki bütün kablolar; kaynak adı yalnız üst düzey `const`/`let` adlarındandır. */
export function kabloCikar(kaynakMetni: string): Kablo[] {
  const kok: unknown = parseAst(kaynakMetni, { lang: "ts" });
  const govde = dugumMu(kok) ? liste(kok.body) : [];
  const kaynaklar = new Set(ustDuzey(govde).sozluk.keys());
  const kablolar = new Map<string, Kablo>();
  const ekle = (k: Kablo): void => { kablolar.set(`${k.tuketici}|${k.anahtar}|${k.kaynak}|${k.tur}`, k); };

  const alanKablolari = (tuketici: string, anahtar: string, deger0: unknown): void => {
    const v = parantezsiz(deger0);
    if (!dugumMu(v)) return;
    if (FONKSIYON.has(v.type)) {
      const gizli = new Set(liste(v.params).flatMap(desenAdlari));
      const govdeIfadesi = dugumMu(v.body) && v.body.type === "BlockStatement" ? tekDonus(v.body) : v.body;
      const saf = parantezsiz(govdeIfadesi);
      if (liste(v.params).length === 0 && dugumMu(saf) && saf.type === "Identifier" && kaynaklar.has(String(saf.name))) {
        ekle({ tuketici, anahtar, kaynak: String(saf.name), tur: "tembel" });
        return;
      }
      const ad = new Set<string>(); bagimliliklar(v.body, kaynaklar, gizli, ad);
      for (const a of ad) ekle({ tuketici, anahtar, kaynak: a, tur: "hesaplı" });
      return;
    }
    const ad = new Set<string>(); bagimliliklar(v, kaynaklar, new Set(), ad);
    for (const a of ad) ekle({ tuketici, anahtar, kaynak: a, tur: "değer" });
  };

  /** `{ return ad; }` biçimli blok gövdesinin dönüş ifadesi (tek `return`), değilse null. */
  function tekDonus(blok: unknown): unknown {
    if (!dugumMu(blok)) return null;
    const g = liste(blok.body);
    const s = g.length === 1 ? g[0] : null;
    return dugumMu(s) && s.type === "ReturnStatement" ? s.argument : null;
  }

  const nesneAlanlari = (tuketici: string, nesne: Dugum): void => {
    for (const p of liste(nesne.properties)) {
      if (!dugumMu(p) || p.type !== "Property") continue;
      const a = anahtarAdi(p);
      if (a !== null) alanKablolari(tuketici, a, p.value);
    }
  };

  const yuru = (d: Dugum): void => {
    if (d.type === "CallExpression" || d.type === "NewExpression") {
      const c = parantezsiz(d.callee);
      const ad = dugumMu(c) && c.type === "Identifier" ? String(c.name) : null;
      if (ad !== null) {
        liste(d.arguments).forEach((a0, i) => {
          const a = parantezsiz(a0);
          if (!dugumMu(a)) return;
          if (a.type === "ObjectExpression") nesneAlanlari(ad, a);
          else if (a.type === "Identifier" || FONKSIYON.has(a.type)) alanKablolari(ad, `#${i + 1}`, a);   // sıralı bağımsız değişken: ad ya da işlev
        });
      }
    } else if (d.type === "VariableDeclarator" && dugumMu(d.id) && d.id.type === "Identifier") {
      const i = parantezsiz(d.init);
      if (dugumMu(i) && i.type === "ObjectExpression") nesneAlanlari(String(d.id.name), i);
    }
    for (const c of cocuklar(d)) yuru(c);
  };
  for (const s of govde) if (dugumMu(s)) yuru(s);
  return [...kablolar.values()];
}

/** Kaynak başına özet: kaç tüketici, hangi türde, hangi fabrikalar. */
export function kaynakOzeti(kablolar: readonly Kablo[]): { kaynak: string; tuketiciler: string[]; tur: Record<KabloTuru, number> }[] {
  const harita = new Map<string, { tuketiciler: Set<string>; tur: Record<KabloTuru, number> }>();
  for (const k of kablolar) {
    const o = harita.get(k.kaynak) ?? { tuketiciler: new Set<string>(), tur: { tembel: 0, hesaplı: 0, değer: 0 } };
    o.tuketiciler.add(k.tuketici); o.tur[k.tur]++;
    harita.set(k.kaynak, o);
  }
  return [...harita].map(([kaynak, o]) => ({ kaynak, tuketiciler: [...o.tuketiciler].sort(), tur: o.tur }))
    .sort((a, b) => b.tuketiciler.length - a.tuketiciler.length || a.kaynak.localeCompare(b.kaynak));
}

/** İnsan okuyacak tablo. */
export function tabloYaz(kablolar: readonly Kablo[]): string {
  const ozet = kaynakOzeti(kablolar);
  const kn = Math.max(...ozet.map((o) => o.kaynak.length), 6);
  const satirlar = [`KAYNAK → TÜKETİCİLER  (${kablolar.length} kablo, ${ozet.length} kaynak, ${new Set(kablolar.map((k) => k.tuketici)).size} tüketici)`, ""];
  for (const o of ozet) {
    const t = `tembel ${o.tur.tembel} · hesaplı ${o.tur.hesaplı} · değer ${o.tur.değer}`;
    satirlar.push(`${o.kaynak.padEnd(kn)}  ${String(o.tuketiciler.length).padStart(2)} tüketici  ${t.padEnd(34)}  ${o.tuketiciler.join(", ")}`);
  }
  const tuk = new Map<string, Set<string>>();
  for (const k of kablolar) (tuk.get(k.tuketici) ?? tuk.set(k.tuketici, new Set()).get(k.tuketici)!).add(k.kaynak);
  satirlar.push("", "TÜKETİCİ ← KAYNAKLAR");
  for (const [t, s] of [...tuk].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))) satirlar.push(`${t}  (${s.size}): ${[...s].sort().join(", ")}`);
  return satirlar.join("\n");
}

if (import.meta.main) {
  const dosya = process.argv[2] ?? path.join(import.meta.dirname, "..", "uygulama", "giris.ts");
  console.log(tabloYaz(kabloCikar(fs.readFileSync(dosya, "utf8"))));
}
