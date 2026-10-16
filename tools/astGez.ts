// tools/astGez.ts — Bekçilerin ve araçların ORTAK AST yardımcıları (vite'ın rolldown ayrıştırıcısı; TS 7'de klasik `createSourceFile` yok).
//
// Kullanıcıları: `uygulama/girisSira.test.ts` (kuruluş sırası bekçisi) ve `tools/kablo-haritasi.ts` (kompozisyon kökündeki kablo tablosu).
// Bir `*.test.ts` değil: test dosyasını import etmek onun testlerini ikinci kez koşturur. Üretim kodu tools/'u import etmez.
"use strict";

export interface Dugum { readonly type: string; readonly start: number; readonly end: number; readonly [anahtar: string]: unknown }

export const dugumMu = (x: unknown): x is Dugum => typeof x === "object" && x !== null && typeof (x as { type?: unknown }).type === "string";
export const liste = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

export const parantezsiz = (x: unknown): unknown => { while (dugumMu(x) && x.type === "ParenthesizedExpression") x = x.expression; return x; };

export function* cocuklar(d: Dugum): Generator<Dugum> {
  for (const [anahtar, deger] of Object.entries(d)) {
    if (anahtar === "type") continue;
    for (const x of Array.isArray(deger) ? deger : [deger]) if (dugumMu(x)) yield x;
  }
}

/** Bir bildirim deseninin (id, parametre) getirdiği adlar. */
export function desenAdlari(p: unknown): string[] {
  if (!dugumMu(p)) return [];
  switch (p.type) {
    case "Identifier": return [String(p.name)];
    case "AssignmentPattern": return desenAdlari(p.left);
    case "RestElement": return desenAdlari(p.argument);
    case "ArrayPattern": return liste(p.elements).flatMap(desenAdlari);
    case "ObjectPattern": return liste(p.properties).flatMap((x) => (dugumMu(x) && x.type === "Property" ? desenAdlari(x.value) : desenAdlari(x)));
    default: return [];
  }
}

/** Üst düzey `const`/`let`/`class` bildirimleri (ad → [başlangıç, bitiş]) ve üst düzey `function` bildirimleri. */
export function ustDuzey(govde: unknown[]): { sozluk: Map<string, [number, number]>; islevler: Map<string, Dugum> } {
  const sozluk = new Map<string, [number, number]>();
  const islevler = new Map<string, Dugum>();
  for (const s0 of govde) {
    if (!dugumMu(s0)) continue;
    const s = s0.type === "ExportNamedDeclaration" && dugumMu(s0.declaration) ? s0.declaration : s0;
    if (s.type === "VariableDeclaration" && (s.kind === "const" || s.kind === "let")) {
      for (const d of liste(s.declarations)) if (dugumMu(d)) for (const ad of desenAdlari(d.id)) sozluk.set(ad, [d.start, d.end]);
    } else if (s.type === "ClassDeclaration" && dugumMu(s.id)) sozluk.set(String(s.id.name), [s.start, s.end]);
    else if (s.type === "FunctionDeclaration" && dugumMu(s.id)) islevler.set(String(s.id.name), s);
  }
  return { sozluk, islevler };
}
