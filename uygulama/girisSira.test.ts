// uygulama/girisSira.test.ts — giris.ts KURULUM SIRASI bekçisi.
//
// Modül yüklenirken (kapanışın DIŞINDA) henüz bildirilmemiş bir `const`/`let`/`class` okunursa çalışma anında ReferenceError olur
// (geçici ölü bölge). Bugün giris.ts'te bu olmuyor çünkü sonradan kurulanlar (`kopru`, `sohbet`, `orionSesi` …) hep `() =>` ile
// okunuyor. Bu o sözleşmeyi yazıya döker: biri sırayı bozarsa test kırmızı olur, canlıda beyaz ekran olmaz.
//
// Kapsam ve sınır: ayrıştırıcı gerçek bir AST'dir (vite'ın rolldown'ı; TS 7'de klasik `createSourceFile` yok). Kapanışlar (ok/function/yöntem)
// gövdesi sonra çalışacağı için atlanır; hemen çağrılan kapanış (IIFE) ve üst düzey `function` bildirimine EAGER çağrı içeri girilir.
// Bilerek görmez: blok yerelinin (for-of değişkeni gibi) üst düzey adla aynı ada sahip olması, desen varsayılan değerleri, tip konumundaki adlar.
"use strict";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseAst } from "rolldown/parseAst";
import { dugumMu, liste, parantezsiz, desenAdlari, cocuklar, ustDuzey, type Dugum } from "../tools/astGez.ts";

export interface Okuma { ad: string; okumaSatiri: number; bildirimSatiri: number }

/** `x as T` / `x!` gibi tip sarmalayıcıları çalışma anında ifadenin kendisidir; geri kalan TS düğümleri (tipler) silinir. */
const TIP_SARMALAYICI = new Set(["TSAsExpression", "TSNonNullExpression", "TSSatisfiesExpression", "TSTypeAssertion", "TSInstantiationExpression"]);

/** Bir işlevin kendi yerel adları (parametre + içindeki her bildirim): üst düzey adı gölgeler, okuma sayılmaz. Fazla gölgeleme yalnız gözden kaçırır, yanlış alarm vermez. */
function yerelAdlar(f: Dugum): Set<string> {
  const ad = new Set<string>(liste(f.params).flatMap(desenAdlari));
  const gez = (d: unknown): void => {
    if (!dugumMu(d)) return;
    if (d.type === "VariableDeclarator") for (const a of desenAdlari(d.id)) ad.add(a);
    if (d.type === "FunctionDeclaration" && dugumMu(d.id)) ad.add(String(d.id.name));
    for (const c of cocuklar(d)) gez(c);
  };
  gez(f.body);
  return ad;
}

/** Kaynakta, bildirimi BİTMEDEN hemen (modül yüklenirken) okunan üst düzey adlar; `bildirilenler` taramanın boş geçmediğini kanıtlar. */
export function siraTara(kaynak: string): { okumalar: Okuma[]; bildirilenler: string[] } {
  const kok: unknown = parseAst(kaynak, { lang: "ts" });
  const govde = dugumMu(kok) ? liste(kok.body) : [];
  const { sozluk, islevler } = ustDuzey(govde);
  const satir = (konum: number): number => kaynak.slice(0, konum).split("\n").length;
  const okumalar: Okuma[] = [];

  /** `konum`: işlev gövdesine bir ÇAĞRI noktasından girildiyse o çağrının yeri (okuma, çağrı anında olur). */
  function yuru(d: unknown, gizli: ReadonlySet<string>, konum: number | null, ziyaret: ReadonlySet<string>): void {
    if (!dugumMu(d)) return;
    const ic = (x: unknown): void => yuru(x, gizli, konum, ziyaret);
    if (d.type.startsWith("TS")) { if (TIP_SARMALAYICI.has(d.type)) ic(d.expression); return; }
    switch (d.type) {
      case "ImportDeclaration":
      case "FunctionDeclaration": case "FunctionExpression": case "ArrowFunctionExpression":  // kapanış: gövde sonra çalışır
        return;
      case "ParenthesizedExpression": ic(d.expression); return;
      case "Identifier": {
        const ad = String(d.name);
        const b = sozluk.get(ad);
        if (gizli.has(ad) || b === undefined) return;
        const p = konum ?? d.start;
        if (p < b[1]) okumalar.push({ ad, okumaSatiri: satir(p), bildirimSatiri: satir(b[0]) });
        return;
      }
      case "MemberExpression": ic(d.object); if (d.computed) ic(d.property); return;
      case "Property": case "PropertyDefinition": case "MethodDefinition": if (d.computed) ic(d.key); ic(d.value); return;
      case "VariableDeclarator": ic(d.init); return;                       // id yalnız bildirim
      case "ClassDeclaration": case "ClassExpression": ic(d.superClass); ic(d.body); return;
      case "CatchClause": ic(d.body); return;
      case "LabeledStatement": ic(d.body); return;
      case "BreakStatement": case "ContinueStatement": return;
      case "CallExpression": {
        const c = parantezsiz(d.callee);
        for (const a of liste(d.arguments)) ic(a);
        if (dugumMu(c) && (c.type === "ArrowFunctionExpression" || c.type === "FunctionExpression")) {
          // IIFE: gövde hemen çalışır; dış kapsamı görür, kendi yerelleri gölgeler.
          yuru(c.body, new Set([...gizli, ...yerelAdlar(c)]), konum ?? d.start, ziyaret);
          return;
        }
        ic(c);
        const ad = dugumMu(c) && c.type === "Identifier" ? String(c.name) : null;
        const f = ad !== null && !gizli.has(ad) && !ziyaret.has(ad) ? islevler.get(ad) : undefined;
        // Üst düzey `function` bildirimi hemen çağrılıyorsa gövdesi de şimdi çalışır (bildirim yukarı çekilir, TDZ tuzağı burası).
        if (f && ad !== null) yuru(f.body, yerelAdlar(f), konum ?? d.start, new Set([...ziyaret, ad]));
        return;
      }
      default: for (const c of cocuklar(d)) ic(c);
    }
  }
  for (const s of govde) yuru(s, new Set(), null, new Set());
  return { okumalar, bildirilenler: [...sozluk.keys()] };
}

const GIRIS = fs.readFileSync(path.join(import.meta.dirname, "giris.ts"), "utf8");

test("giris.ts: bildirilmeden önce hemen okunan üst düzey ad yok (kuruluş sırası)", () => {
  assert.deepEqual(siraTara(GIRIS).okumalar, []);
});

test("giris.ts taraması boş geçmiyor: sonradan kurulanlar bildirilen adlar arasında", () => {
  const { bildirilenler } = siraTara(GIRIS);
  for (const ad of ["kopru", "sohbet", "orionSesi", "varlikSinyali", "odak", "gozlem"]) assert.ok(bildirilenler.includes(ad), `${ad} bulunamadı`);
});

test("giris.ts'e sokulan ihlal yakalanır: 'sohbet' (689. satır dolayında bildirilir) erken okununca doğru satır bildirilir", () => {
  const bozuk = GIRIS.replace("const saat = new Saat();", "const saat = new Saat();\nvoid sohbet;");
  assert.notEqual(bozuk, GIRIS, "yerleştirme noktası bulunamadı");
  const eklenen = bozuk.split("\n").findIndex((s) => s.trim() === "void sohbet;") + 1;
  const okumalar = siraTara(bozuk).okumalar;
  assert.equal(okumalar.length, 1);
  assert.equal(okumalar[0]!.ad, "sohbet");
  assert.equal(okumalar[0]!.okumaSatiri, eklenen);
});

test("hemen okuma: sonra bildirilen const'u başlatıcıda okumak yakalanır", () => {
  assert.deepEqual(siraTara("const a = b + 1;\nconst b = 2;").okumalar.map((o) => o.ad), ["b"]);
});

test("kapanış içinde okuma serbest: () => b bildirimden önce yazılabilir", () => {
  assert.deepEqual(siraTara("const f = () => b;\nconst b = 2;").okumalar, []);
});

test("sıra doğruysa okuma serbest: önce bildir, sonra oku", () => {
  assert.deepEqual(siraTara("const b = 2;\nconst a = b + 1;").okumalar, []);
});

test("hemen çağrılan kapanış (IIFE) eager sayılır: gövdedeki okuma yakalanır", () => {
  assert.deepEqual(siraTara("const x = (() => y)();\nconst y = 1;").okumalar.map((o) => o.ad), ["y"]);
});

test("IIFE'nin kendi yereli üst düzey adı gölgeler: yanlış alarm yok", () => {
  assert.deepEqual(siraTara("const x = (() => { const y = 1; return y; })();\nconst y = 2;").okumalar, []);
});

test("üst düzey function hemen çağrılırsa gövdesi de eager: sonra bildirilen const'u okuyorsa yakalanır", () => {
  assert.deepEqual(siraTara("function g() { return c; }\ng();\nconst c = 1;").okumalar.map((o) => o.ad), ["c"]);
});

test("üst düzey function bildirimden SONRA çağrılırsa serbest", () => {
  assert.deepEqual(siraTara("function g() { return c; }\nconst c = 1;\ng();").okumalar, []);
});

test("üst düzey function çağrılmadan yalnız tanımlanırsa serbest (gövdesi çalışmaz)", () => {
  assert.deepEqual(siraTara("function g() { return c; }\nconst c = 1;").okumalar, []);
});

test("nesne anahtarı ve üye adı okuma değildir: { kopru: 1 } ve o.kopru", () => {
  assert.deepEqual(siraTara("const o = { kopru: 1 };\nconst n = o.kopru;\nlet kopru = 0;").okumalar, []);
});

test("kısa yazımlı nesne alanı okumadır: { kopru } bildirimden önce yakalanır", () => {
  assert.deepEqual(siraTara("const o = { kopru };\nlet kopru = 0;").okumalar.map((o) => o.ad), ["kopru"]);
});

test("tip konumundaki ad okuma değildir: typeof x bir tipte", () => {
  assert.deepEqual(siraTara("let a: ReturnType<typeof f> | null = null;\nconst f = () => 1;").okumalar, []);
});
