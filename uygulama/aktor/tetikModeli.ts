// uygulama/aktor/tetikModeli.ts — TETİK BİLEŞENİ MANTIĞI (spec 45 B4). SAF: Babylon, DOM, zaman ve rastgelelik YOK.
//
// Bir aktörün `tetik` bileşeni (küre ya da eksene hizalı kutu) içine kim girip çıktığını söyler: `tetik.girdi` / `tetik.cikti`. Burada yalnız GEOMETRİ ve DURUM:
// kimin sayılacağı (`kim`), içeride mi, ve giriş/çıkış geçişleri. Çalışma zamanı (`aktorCalismaZamani.ts`) konumları verir, olayı yayınlar.
// HİSTEREZİS: içeride olan sınırın biraz dışına çıkana dek "çıkmadı" sayılır (`CIKIS_PAYI_M`): sınırda duran biri girdi/çıktı fırtınası üretmesin
// (`world/olayUretici.ts` ile aynı gerekçe; bu bileşenin kendi kuralı, olay yolu tavanı ikinci koruma).
// Kutu eksene hizalıdır (aktörün dönüşü yok sayılır): ölçülmedi, dönen aktörün kutusu şimdilik dünya ekseninde kalır (spec 45 §11).
"use strict";

export type Nokta = { readonly x: number; readonly y: number; readonly z: number };
export type Vec3t = readonly [number, number, number];

/** Çıkış histerezisi (m): içeride olan, sınırın bu kadar dışına çıkınca çıkmış sayılır. 0.15: yürüyen bir gövdenin kare başı adımından büyük, ölçülmedi. */
export const CIKIS_PAYI_M = 0.15;

export interface TetikAyari {
  readonly sekil: string;
  readonly yaricap: number;
  readonly boyut: Vec3t;
  /** Aktöre göre ofset (dünya ekseninde eklenir). */
  readonly konum: Vec3t;
  readonly kim: string;
}

/** Tetiği gözleyebilen biri: Ozyn, bir ajan (Orion ya da Flash) ya da hareketli bir aktör. */
export interface Gozlenen {
  readonly id: string;
  readonly tur: "ozyn" | "orion" | "ajan" | "aktor";
  readonly konum: Nokta;
}

/** `kim` ayarı bu gözleneni sayar mı. Bilinmeyen değer HİÇ KİMSEYİ saymaz (sessiz "herkes" olmasın). */
export function tetikKimMi(kim: string, g: Gozlenen): boolean {
  if (kim === "herkes") return true;
  if (kim === "ozyn") return g.tur === "ozyn";
  if (kim === "orion") return g.tur === "orion";
  if (kim === "aktor") return g.tur === "aktor";
  return false;
}

/** Nokta tetikin içinde mi (`pay` m: sınırı genişletir, histerezis için). `merkez` aktörün dünya konumu; ayarın `konum` ofseti buraya eklenir. */
export function tetikIcinde(ayar: TetikAyari, merkez: Nokta, nokta: Nokta, pay = 0): boolean {
  const cx = merkez.x + ayar.konum[0], cy = merkez.y + ayar.konum[1], cz = merkez.z + ayar.konum[2];
  const dx = nokta.x - cx, dy = nokta.y - cy, dz = nokta.z - cz;
  if (ayar.sekil === "kutu") {
    return Math.abs(dx) <= ayar.boyut[0] / 2 + pay && Math.abs(dy) <= ayar.boyut[1] / 2 + pay && Math.abs(dz) <= ayar.boyut[2] / 2 + pay;
  }
  const r = ayar.yaricap + pay;
  return dx * dx + dy * dy + dz * dz <= r * r;
}

export interface TetikGecisi { readonly girenler: readonly string[]; readonly cikanlar: readonly string[] }

export interface TetikDurumu {
  /** Bu karenin gözlenenleriyle durumu ilerletir; giriş/çıkış geçişlerini (kimliklerle) döner. Aynı kimlik aynı karede iki kez gelirse sonuncusu sayılır. */
  guncelle(ayar: TetikAyari, merkez: Nokta, gozlenenler: readonly Gozlenen[]): TetikGecisi;
  /** Şu an içeridekiler. */
  icerdekiler(): readonly string[];
  /** Durumu unutur (aktör silinince/bileşen değişince): içeridekiler için `cikti` ÜRETMEZ. */
  sifirla(): void;
}

export function tetikDurumuKur(): TetikDurumu {
  let icerde = new Set<string>();
  return {
    guncelle(ayar, merkez, gozlenenler) {
      const yeni = new Set<string>();
      const girenler: string[] = [];
      for (const g of gozlenenler) {
        if (!tetikKimMi(ayar.kim, g)) continue;
        const onceIceriydi = icerde.has(g.id);
        if (tetikIcinde(ayar, merkez, g.konum, onceIceriydi ? CIKIS_PAYI_M : 0)) {
          yeni.add(g.id);
          if (!onceIceriydi && !girenler.includes(g.id)) girenler.push(g.id);
        }
      }
      const cikanlar = [...icerde].filter((id) => !yeni.has(id));
      icerde = yeni;
      return { girenler, cikanlar };
    },
    icerdekiler: () => [...icerde],
    sifirla() { icerde = new Set(); },
  };
}
