// world/avatar/klipOrnekleyici.ts — Klip ÖRNEKLEYİCİ (spec 35 Dilim 5a): t anında her izin değeri. SAF: Babylon yok, zaman dışarıdan gelir.
//
// İki tüketici, tek kural: `yurutucu.ts` (KARAR, 20 Hz) yalnız "bitti mi" diye sorar; `beden.ts` (SUNUM, çizim karesi) değerleri ister ve iskelete
// verir. Zaman kuralı tek yerde olsun diye ikisi de buradan okur — yürütücü "bitti" derken beden hâlâ oynatıyor olmasın.
//
// ZAMAN: `gecen` klip başından beri geçen süre (sn, sarılmamış). Döngüsüz klipte [0, süre]'ye kısılır (bitince SON değer); döngülüde süreye göre
// sarılır. Anahtarların dışında değer sabittir: ilk anahtardan önce ilk değer, sondan sonra son değer.
"use strict";
import type { AnimasyonKlibi, Kanal, KlipIzi, Uzuv, Yumusatma } from "../../protocol/animasyon.ts";

export interface UzuvDegeri {
  uzuv: Uzuv;
  kanal: Kanal;
  /** Derece (dönme) ya da metre (öteleme). */
  deger: number;
}

/** Klibin `gecen` anındaki yerel zamanı (sn). */
export function klipZamani(k: Pick<AnimasyonKlibi, "sure" | "dongu">, gecen: number): number {
  const g = Number.isFinite(gecen) && gecen > 0 ? gecen : 0;
  if (!k.dongu) return Math.min(g, k.sure);
  const t = g % k.sure;
  return t < 0 ? t + k.sure : t;
}

/** Döngüsüz klip süresini doldurdu mu. Döngülü klip ASLA kendiliğinden bitmez (`dur` ya da yeni jest keser). */
export function klipBittiMi(k: Pick<AnimasyonKlibi, "sure" | "dongu">, gecen: number): boolean {
  return !k.dongu && gecen >= k.sure;
}

/** Segment içi ilerleme `u` (0..1) → yumuşatılmış oran. */
export function yumusat(tur: Yumusatma, u: number): number {
  const x = u <= 0 ? 0 : u >= 1 ? 1 : u;
  switch (tur) {
    case "dogrusal": return x;
    // smoothstep: uçlarda hız 0 — kol bir yere "çarpıp" durmaz.
    case "yumusak": return x * x * (3 - 2 * x);
    // Bir sonraki anahtara dek değer SABİT; anahtar anında atlar.
    case "basamak": return x >= 1 ? 1 : 0;
  }
}

/** Bir izin t anındaki değeri. Yumuşatma segmentin BAŞINDAKİ anahtardan (CSS keyframe kuralı; protocol/animasyon.ts). */
export function izDegeri(iz: Pick<KlipIzi, "anahtarlar">, t: number): number {
  const a = iz.anahtarlar;
  const ilk = a[0];
  if (!ilk) return 0;
  if (t <= ilk.t) return ilk.deger;
  for (let i = 0; i + 1 < a.length; i++) {
    const p = a[i]!, s = a[i + 1]!;
    if (t < s.t) return p.deger + (s.deger - p.deger) * yumusat(p.yumusatma, (t - p.t) / (s.t - p.t));
  }
  return a[a.length - 1]!.deger;
}

/** Klibin `gecen` anındaki bütün iz değerleri (iz sırasıyla). */
export function klipOrnekle(k: AnimasyonKlibi, gecen: number): UzuvDegeri[] {
  const t = klipZamani(k, gecen);
  return k.izler.map((iz) => ({ uzuv: iz.uzuv, kanal: iz.kanal, deger: izDegeri(iz, t) }));
}

/** Bir uzvun bütün kanalları tek pozda: dönme (derece, gövde uzayı) ve öteleme (metre; yalnız `kok`). Yazılmayan kanal 0. */
export interface UzuvPozu {
  donme: { x: number; y: number; z: number };
  oteleme: { x: number; y: number; z: number };
}

/** Değerleri uzva göre toplar (sürücü her uzvu bir kez döndürsün). */
export function uzuvPozlari(degerler: readonly UzuvDegeri[]): Map<Uzuv, UzuvPozu> {
  const m = new Map<Uzuv, UzuvPozu>();
  for (const d of degerler) {
    let p = m.get(d.uzuv);
    if (!p) { p = { donme: { x: 0, y: 0, z: 0 }, oteleme: { x: 0, y: 0, z: 0 } }; m.set(d.uzuv, p); }
    const eksen = d.kanal.slice(-1) as "x" | "y" | "z";
    if (d.kanal.startsWith("donme_")) p.donme[eksen] = d.deger; else p.oteleme[eksen] = d.deger;
  }
  return m;
}

/**
 * Klibin bu gövdede UYGULANAMAYAN izleri ("sag_on_kol.donme_z"): gövdenin uzuv kümesinde olmayan uzvun izleri. SESSİZ YUTMA YOK — çağıran
 * (avatar) bunları günlüğe yazar ve niyetin `basladi` sonucunda taşır; kullanıcıya hata değildir (klip uygulanabilen kısmıyla oynar).
 */
export function atlananIzler(k: Pick<AnimasyonKlibi, "izler">, uzuvlar: ReadonlySet<Uzuv>): string[] {
  return k.izler.filter((iz) => !uzuvlar.has(iz.uzuv)).map((iz) => `${iz.uzuv}.${iz.kanal}`);
}
