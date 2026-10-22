// uygulama/graf/editor/calismaGorunumu.ts — EDİTÖRDE ÇALIŞMA GÖRÜNÜMÜ ve DENETİM SIKLIĞI (spec 35 dilim 2b). SAF.
//
// Editör çalışmayı BAŞLATMAZ (▶/⚡ düğmeleri mevcut `grafCalistirici.calistir` / `grafDinleyici.dinlemeyeAl`ı çağırır; ikinci bir çalıştırma yolu yok);
// burada yalnız çalıştırıcının ve dinleyicinin DURUMU sekmedeki grafiğe göre okunur: şu an hangi düğüm yürüyor (vurgu), son çalışma hangi düğümde
// düştü (kırmızı), grafik dinlemede mi (⚡ rozet). Desen içindeki düğüm, o desenin sekmesinde vurgulanır (`suan.graf`).
// Canlı satır metni çalıştırıcının (`canliSatir`/`sonucSatiri`) — Graf sekmesiyle AYNI cümle, kopya yok.
"use strict";
import { canliSatir, sonucSatiri, type CalistiriciDurumu, type SonCalisma } from "../grafCalistirici.ts";
import type { DinlemeSatiri } from "../grafDinleyici.ts";

export interface CalismaIsareti {
  /** Bu sekmede şu an yürüyen düğüm (yoksa null). */
  suan: string | null;
  /** Bu sekmenin grafiğinde son çalışmanın düştüğü düğüm ve mesajı. */
  hataDugumu: string | null;
  hataMesaji: string | null;
  /** Bu grafik (▶ ya da olayla) şu an çalışıyor mu. */
  calisiyor: boolean;
  dinlemede: boolean;
  /** Üst çubuktaki tek satır (çalışıyor / son sonuç / boş). */
  satir: string;
  satirTuru: "" | "calisiyor" | "bitti" | "durdu" | "hata";
}

/** Bir son çalışma bu grafikte mi düştü (desen içindeyse desenin sekmesi). */
function hataYeri(s: SonCalisma | null | undefined, graf: string): { id: string; mesaj: string } | null {
  if (!s || s.durum !== "hata" || !s.hataDugumu || s.hataDugumu.graf !== graf) return null;
  return { id: s.hataDugumu.id, mesaj: s.hata ?? "hata" };
}

export function calismaIsareti(c: CalistiriciDurumu, dinleme: readonly DinlemeSatiri[], graf: string, simdi: number): CalismaIsareti {
  const d = dinleme.find((x) => x.graf === graf) ?? null;
  const suren = c.calisiyor;
  const suan = suren?.suan && suren.suan.graf === graf ? suren.suan.id : null;
  // Önce ▶'nin son sonucu (bu grafikse ya da bu desen içinde düştüyse), sonra olay çalışmasının.
  const h = hataYeri(c.son, graf) ?? hataYeri(d?.son, graf);
  const satirTuru: CalismaIsareti["satirTuru"] = suren ? "calisiyor" : c.son ? c.son.durum : "";
  return {
    suan,
    hataDugumu: h?.id ?? null,
    hataMesaji: h?.mesaj ?? null,
    calisiyor: suren?.graf === graf || !!d?.calisiyor,
    dinlemede: !!d,
    satir: suren ? canliSatir(c, simdi) : c.son ? sonucSatiri(c.son) : "",
    satirTuru,
  };
}

/**
 * Tavanlı sıklık: `iste()` ne kadar sık çağrılırsa çağrılsın iş en çok `ms`de bir, SON istekten sonra mutlaka bir kez yürür (iş çağrıldığında grafiğin o
 * anki hâline bakar; arada kalan istekler kaybolmaz, birleşir). Her değişiklikte tür denetimi böyle çalışır: sürüklerken 60 kez değil, ~4 kez.
 */
export function sinirliSiklik(is: () => void, ms: number, zaman: { kur(f: () => void, ms: number): unknown; iptal(h: unknown): void } = {
  kur: (f, t) => setTimeout(f, t), iptal: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
}): { iste(): void; hemen(): void; iptal(): void } {
  let bekleyen: unknown = null;
  const yurut = () => { bekleyen = null; is(); };
  return {
    iste() { if (bekleyen === null) bekleyen = zaman.kur(yurut, ms); },
    hemen() { if (bekleyen !== null) { zaman.iptal(bekleyen); bekleyen = null; } is(); },
    iptal() { if (bekleyen !== null) { zaman.iptal(bekleyen); bekleyen = null; } },
  };
}
