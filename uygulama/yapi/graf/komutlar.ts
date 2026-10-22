// uygulama/yapi/graf/komutlar.ts — KLAVYE KOMUTLARININ YÜRÜTÜCÜSÜ (spec 35 dilim 2b): kisayollar.ts'in komutu → oturum komutu (editorOturumu.ts).
// DOM katmanı (tuval ve palet ile konuşur). Pano bellekte ve editör başına: bir sekmede kopyalanan başka sekmeye yapıştırılır (yeni kimliklerle).
"use strict";
import { geriAl, kopyalaKomutu, silKomutu, yapistirKomutu, yinele, type EditorOturumu, type KomutSonucu } from "../../graf/editor/editorOturumu.ts";
import type { EditorKomutu } from "../../graf/editor/kisayollar.ts";
import type { Pano } from "../../graf/editor/grafIslemleri.ts";
import { dunyadanEkrana } from "../../graf/editor/tuvalMatematigi.ts";
import type { MesajTuru } from "./editorBaglami.ts";
import type { Tuval } from "./tuval.ts";
import type { PaletKutusu } from "./paletKutusu.ts";

export interface KomutBaglami {
  oturum(): EditorOturumu | null;
  sonuc(r: KomutSonucu): void;
  bildir(m: string, tur?: MesajTuru): void;
  tazele(): void;
  kaydet(): void;
  /** Esc zinciri (palet → ad kutusu → sürükleme → yardım → editörü gizle). */
  esc(): void;
  yardim(): void;
  tuval: Tuval;
  palet: PaletKutusu;
}

export function komutYurutucuKur(k: KomutBaglami): (komut: EditorKomutu) => void {
  let pano: Pano | null = null;
  return (komut) => {
    if (komut === "kapat") { k.esc(); return; }
    if (komut === "yardim") { k.yardim(); return; }
    const o = k.oturum();
    if (!o) return;
    switch (komut) {
      case "kaydet": k.kaydet(); return;
      case "geriAl": k.sonuc(geriAl(o)); return;
      case "yinele": k.sonuc(yinele(o)); return;
      case "sil": k.sonuc(silKomutu(o)); return;
      case "kopyala": case "kes": {
        const p = kopyalaKomutu(o);
        if (!p) { k.bildir("kopyalanacak seçim yok", "uyari"); return; }
        pano = p;
        if (komut === "kes") k.sonuc({ ...silKomutu(o), mesaj: `${p.dugumler.length} düğüm kesildi (Ctrl+V yapıştırır)` });
        else k.bildir(`${p.dugumler.length} düğüm kopyalandı (Ctrl+V: imlecin yerine)`);
        return;
      }
      case "yapistir": k.sonuc(yapistirKomutu(o, pano, k.tuval.imlecDunya())); return;
      case "cogalt": {
        const p = kopyalaKomutu(o);
        if (!p) { k.bildir("çoğaltılacak seçim yok", "uyari"); return; }
        const x = Math.min(...p.dugumler.map((d) => d.konum?.[0] ?? 0)), y = Math.min(...p.dugumler.map((d) => d.konum?.[1] ?? 0));
        k.sonuc(yapistirKomutu(o, p, { x: x + 40, y: y + 40 }));
        return;
      }
      case "tumunuSec": o.secim = new Set(o.graf().dugumler.map((d) => d.id)); k.tazele(); return;
      case "sigdir": k.tuval.sigdir(); return;
      case "palet": { const d = k.tuval.imlecDunya(); k.palet.ac(dunyadanEkrana(o.gorunum, d), d); return; }
      case "alandanCik": return;
    }
  };
}
