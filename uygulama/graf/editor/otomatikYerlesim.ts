// uygulama/graf/editor/otomatikYerlesim.ts — KONUMSUZ DÜĞÜMLERE OTOMATİK YERLEŞİM (spec 35 dilim 2b). SAF.
//
// Orion'un yazdığı (ya da elle JSON'la yazılmış) grafikte `konum` olmayabilir: biçimde isteğe bağlıdır, davranışı etkilemez. Editör onları üst üste
// (0,0)'a yığmaz: SOLDAN SAĞA AKIŞ SIRASIYLA dizer (Blueprint okunuşu). Kural: her düğümün sütunu, kendisine gelen bağların (akış ve veri) en uzun yolu;
// giriş düğümleri (Başla, olay, Fonksiyon girişi; gelen bağı olmayanlar) 0. sütun. Veri sağlayıcı (saf) düğüm, onu okuyan düğümün bir solunda durur
// (bağ zaten sağa akar). Satır sırası grafikteki sırayı korur (kararlı: aynı grafik her açılışta aynı görünür).
// KONUMU OLAN DÜĞÜME DOKUNULMAZ: Ozyn'in dizdiği yer onundur. Konumlu düğümler varsa yeni yerleşim onların ALTINA kaydırılır (çakışmasın).
// Döngülü (bozuk) grafikte sonsuz yol olmasın: yol uzunluğu düğüm sayısıyla tavanlı.
"use strict";
import type { Graf } from "../../../protocol/graf.ts";
import type { Nokta } from "../../duzenleyici/tuvalMatematigi.ts";

export const SUTUN_ARALIGI = 280;
export const SATIR_ARALIGI = 150;

/** Konumu olmayan düğümlerin yerleşim konumları (konumlular haritada yok). */
export function otomatikYerlesim(g: Graf): Map<string, Nokta> {
  const konumsuz = g.dugumler.filter((d) => !d.konum);
  const sonuc = new Map<string, Nokta>();
  if (!konumsuz.length) return sonuc;
  const idler = new Set(g.dugumler.map((d) => d.id));
  const gelen = new Map<string, string[]>();
  for (const b of g.baglar) {
    if (!idler.has(b.kaynak[0]) || !idler.has(b.hedef[0]) || b.kaynak[0] === b.hedef[0]) continue;
    (gelen.get(b.hedef[0]) ?? gelen.set(b.hedef[0], []).get(b.hedef[0])!).push(b.kaynak[0]);
  }
  // En uzun gelen yol (bellekli); ziyaret yığını döngüyü keser, tavan düğüm sayısı.
  const sutun = new Map<string, number>();
  const yolda = new Set<string>();
  const tavan = g.dugumler.length;
  const hesapla = (id: string): number => {
    const v = sutun.get(id);
    if (v !== undefined) return v;
    if (yolda.has(id)) return 0;
    yolda.add(id);
    let s = 0;
    for (const k of gelen.get(id) ?? []) s = Math.max(s, Math.min(tavan, hesapla(k) + 1));
    yolda.delete(id);
    sutun.set(id, s);
    return s;
  };
  for (const d of g.dugumler) hesapla(d.id);
  // Kaynak düğüm (gelen bağı yok: Başla, Ajan seç, Sayı…) okuyucularının en solundakinin bir soluna: yalnız derindeki bir düğüme veri veren "Sayı"
  // 0. sütunda, kullanıldığı yerden ekranlarca uzakta kalmasın. Okuyucunun sütunu en az kaynağınki + 1 olduğundan sıra bozulmaz.
  const giden = new Map<string, string[]>();
  for (const [h, ks] of gelen) for (const k of ks) (giden.get(k) ?? giden.set(k, []).get(k)!).push(h);
  for (const d of g.dugumler) {
    const okuyan = giden.get(d.id);
    if (gelen.has(d.id) || !okuyan?.length) continue;
    sutun.set(d.id, Math.max(0, Math.min(...okuyan.map((x) => sutun.get(x) ?? 1)) - 1));
  }
  // Konumlu düğüm varsa yerleşim onların altından başlar.
  const konumlu = g.dugumler.filter((d) => d.konum);
  const x0 = konumlu.length ? Math.min(...konumlu.map((d) => d.konum![0])) : 0;
  const y0 = konumlu.length ? Math.max(...konumlu.map((d) => d.konum![1])) + SATIR_ARALIGI + 60 : 0;
  const satir = new Map<number, number>();
  for (const d of konumsuz) {
    const s = sutun.get(d.id) ?? 0;
    const r = satir.get(s) ?? 0;
    satir.set(s, r + 1);
    sonuc.set(d.id, { x: x0 + s * SUTUN_ARALIGI, y: y0 + r * SATIR_ARALIGI });
  }
  return sonuc;
}
