// uygulama/aktor/aktorTetikleri.ts — TETİK BİLEŞENİ ÇALIŞMA ZAMANI (spec 45 B4): her karede tetik alanı gözlenenlere (Ozyn, ajanlar, hareketli aktörler) karşı sınanır (saf kural `tetikModeli.ts`),
// girenler `tetik.girdi`, çıkanlar `tetik.cikti` olayı olur. Durum bellekte; level tanımına yazılmaz.
"use strict";
import type { Node } from "@babylonjs/core/node";
import { bilesenAyari, type BilesenKaydi } from "../../world/level/cekirdek/bilesenKaydi.ts";
import { tetikDurumuKur, type Gozlenen, type TetikAyari, type TetikDurumu } from "./tetikModeli.ts";
import { bilesenBul, ucluOku, type Aktor, type CalismaBaglami } from "./calismaBaglami.ts";

export interface AktorTetikleri {
  sina(): void;
  /** Aktörü ya da tetik bileşeni artık olmayan kayıtları atar. */
  buda(): void;
  sifirla(): void;
  sayi(): number;
  dokum(): { aktor: string; bilesen: string; icerde: readonly string[] }[];
}

// Dünya matrisinin ötelemesi (ışıkta `getAbsolutePosition` render'a kadar bayat kalabilir; matris her düğümde güncel).
const konumu = (n: Node): { x: number; y: number; z: number } => { const p = n.computeWorldMatrix(true).getTranslation(); return { x: p.x, y: p.y, z: p.z }; };

const tetikAyari = (b: BilesenKaydi): TetikAyari => {
  const v = bilesenAyari(b);
  return { sekil: String(v["sekil"]), yaricap: v["yaricap"] as number, boyut: ucluOku(v["boyut"], [1, 1, 1]), konum: ucluOku(v["konum"], [0, 0, 0]), kim: String(v["kim"]) };
};

/** `disGozlenenler`: aktör OLMAYAN kişiler (Ozyn, ajan gövdeleri); çağrı karede en çok bir kez. */
export function aktorTetikleriKur(b: CalismaBaglami, disGozlenenler: (() => readonly Gozlenen[]) | undefined): AktorTetikleri {
  const tetikler = new Map<string, { durum: TetikDurumu; bilesen: string; aktor: string }>();

  /** Dış gözlenenler + hareket bileşenli aktörler (araba tetiğe girebilir). */
  const gozlenenleriTopla = (): Gozlenen[] => {
    const hepsi: Gozlenen[] = [...(disGozlenenler?.() ?? [])];
    for (const h of b.aktorler().values()) {
      if (!bilesenBul(h, "hareket")) continue;
      const hn = b.dugumu(h);
      if (hn) hepsi.push({ id: h.id, tur: "aktor", konum: konumu(hn) });
    }
    return hepsi;
  };

  const tetigiSina = (a: Aktor, bilesen: BilesenKaydi, n: Node, gozlenenler: readonly Gozlenen[]): void => {
    const anahtar = `${a.id}#${bilesen.id}`;
    let k = tetikler.get(anahtar);
    if (!k) { k = { durum: tetikDurumuKur(), bilesen: bilesen.id, aktor: a.id }; tetikler.set(anahtar, k); }
    // Tetiğin kendi sahibi kendini tetiklemez (araba kendi tetik alanına girmiş sayılmasın).
    const gecis = k.durum.guncelle(tetikAyari(bilesen), konumu(n), gozlenenler.filter((x) => x.id !== a.id));
    for (const kim of gecis.girenler) { b.gunluk.yaz("iyi", "tetik", `${kim} ${a.id}/${bilesen.id} alanına girdi`, { aktor: a.id }); b.olayYolla(a.id, "tetik.girdi", { kim, bilesen: bilesen.id }); }
    for (const kim of gecis.cikanlar) { b.gunluk.yaz("bilgi", "tetik", `${kim} ${a.id}/${bilesen.id} alanından çıktı`, { aktor: a.id }); b.olayYolla(a.id, "tetik.cikti", { kim, bilesen: bilesen.id }); }
  };

  return {
    sayi: () => tetikler.size,
    sifirla: () => tetikler.clear(),
    dokum: () => [...tetikler.values()].map((k) => ({ aktor: k.aktor, bilesen: k.bilesen, icerde: k.durum.icerdekiler() })),

    sina() {
      if (!b.level()) return;
      let gozlenenler: Gozlenen[] | null = null;   // ilk tetikli aktörde bir kez toplanır
      for (const a of b.aktorler().values()) {
        for (const bilesen of a.bilesenler) {
          if (bilesen.tur !== "tetik") continue;
          const n = b.dugumu(a);
          if (!n) continue;
          gozlenenler ??= gozlenenleriTopla();
          tetigiSina(a, bilesen, n, gozlenenler);
        }
      }
    },

    buda() {
      for (const [anahtar, k] of [...tetikler]) {
        const a = b.aktorler().get(k.aktor);
        if (!a || !a.bilesenler.some((x) => x.tur === "tetik" && x.id === k.bilesen)) tetikler.delete(anahtar);
      }
    },
  };
}
