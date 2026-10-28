// uygulama/yapi/ortak/menuBirlestir.ts — ANA MENÜNÜN KATMANLARINI BİRLEŞTİRİR (spec 39 D2). SAF: DOM yok.
//
// Pencere tepesindeki tek menü şeridinin satırları birden çok kaynaktan gelir: uygulamanın kendisi (Dosya ▸ Yeni proje…, Pencere) ve o an açık editör
// (Sekans: Dosya, Düzen, Görünüm…). AYNI ADLI menüler tek menüde toplanır (editörün satırları önde, aralarında ayırıcı), ilk görülme sırası korunur,
// "Yardım" her zaman SON (Blender/Unreal gibi). Girdi değiştirilmez.
"use strict";
import { AYIRICI, type Menu, type MenuSatiri } from "./menuModeli.ts";

const SON_MENU = "Yardım";

/** Katmanlar öncelik sırasıyla (ilki en önde: açık editör), uygulamanın tabanı en sonda verilir. */
export function menuleriBirlestir(katmanlar: readonly (readonly Menu[])[]): Menu[] {
  const sira: string[] = [];
  const parca = new Map<string, MenuSatiri[][]>();
  for (const katman of katmanlar) {
    for (const m of katman) {
      if (!parca.has(m.ad)) { parca.set(m.ad, []); sira.push(m.ad); }
      parca.get(m.ad)!.push([...m.satirlar]);
    }
  }
  const ad = sira.filter((a) => a !== SON_MENU);
  if (parca.has(SON_MENU)) ad.push(SON_MENU);
  return ad.map((a) => {
    const satirlar: MenuSatiri[] = [];
    for (const p of parca.get(a)!) { if (satirlar.length && p.length) satirlar.push(AYIRICI); satirlar.push(...p); }
    return { ad: a, satirlar };
  });
}
