// uygulama/graf/grafDurumu.ts — GRAFİKLERİN DEĞİŞKENLERİ (spec 35 dilim 2): ziyaret sayacı, "parolayı bildi mi", son söz… SAF: DOM yok.
//
// NPC'nin durumu oyunlardaki gibi küçük bir "kara tahta"dır: grafik başına ad → değer (sayı, metin, doğru/yanlış). Kurallar:
//   • YALNIZ BELLEKTE. Diske, localStorage'a, host'a gitmez: uygulama kapanınca durum da gider (dinleme gibi; spec 35 §4c). NEDEN: kalıcı durum bir
//     sözleşmedir (sürüm, göç, bozuk dosya) ve bugün ihtiyaç yok; ziyaret sayacı oturum boyunca yeter. Kalıcılık gerekirse ayrı karar.
//   • AD ALANI = KÖK GRAFİĞİN ADI. ▶ ile ya da olayla çalışan aynı grafik aynı alanı görür (nöbetçinin sayacı ikisinde de artar); başka grafik göremez
//     (barmen nöbetçinin parolasını okuyamaz). Desen çağrısı çağıranın alanını kullanır (desen fonksiyondur; durumu onu çağıran programındır).
//   • TAVANLAR: grafik başına DEGISKEN_AZAMI ad, metin DEGISKEN_METIN_AZAMI karakter, sayı sonlu, en çok DURUM_ALANI_AZAMI grafiğin alanı. Aşılınca
//     yazma FIRLATIR (düğüm nedenle düşer): sessizce kesmek ya da en eskisini silmek NPC'nin hafızasını görünmeden bozardı.
"use strict";
import { grafAdiGecerli, type GrafDegeri } from "../../protocol/graf.ts";
import type { DegiskenAlani } from "./dugumKaydi.ts";

/** Grafik başına değişken sayısı. 32: bir NPC'nin durumu (sayaç, bayrak, son seçim) için bol; bozuk bir döngünün belleği şişirmesine yetmez. */
export const DEGISKEN_AZAMI = 32;
/** Metin değişkeninin uzunluğu (karakter). Diyalog metni bile 300'ü geçmez (diyalogDenetimi.ts); değişken kısa durum içindir. */
export const DEGISKEN_METIN_AZAMI = 200;
/** Durumu tutulan grafik sayısı (ad alanı). */
export const DURUM_ALANI_AZAMI = 64;

/** Değerin değişkene yazılabilir olup olmadığı; değilse nedeni. Saf (düğümler de denetimde aynı kuralı kullanır). */
export function degiskenDegeriHatasi(deger: unknown): string | null {
  if (typeof deger === "boolean") return null;
  if (typeof deger === "number") return Number.isFinite(deger) ? null : "sayı sonlu olmalı";
  if (typeof deger === "string") return deger.length <= DEGISKEN_METIN_AZAMI ? null : `metin en çok ${DEGISKEN_METIN_AZAMI} karakter (gelen: ${deger.length})`;
  return `değişkene yalnız sayı, metin ya da doğru/yanlış yazılır (gelen: ${deger === null ? "null" : typeof deger})`;
}

export class GrafDurumDeposu {
  private readonly _alanlar = new Map<string, Map<string, GrafDegeri>>();
  private readonly _dinleyiciler = new Set<(graf: string) => void>();

  /** Grafiğin değişken alanı. Alan ilk YAZIŞTA açılır (okumak alan açmaz: hiç yazmayan grafik tavana sayılmaz). */
  alan(graf: string): DegiskenAlani {
    return {
      oku: (ad) => this._alanlar.get(graf)?.get(ad),
      yaz: (ad, deger) => {
        if (!grafAdiGecerli(ad)) throw new Error(`değişken adı geçersiz: ${JSON.stringify(ad)} (harf, rakam, _ ve -)`);
        const h = degiskenDegeriHatasi(deger);
        if (h) throw new Error(`'${ad}': ${h}`);
        let m = this._alanlar.get(graf);
        if (!m) {
          if (this._alanlar.size >= DURUM_ALANI_AZAMI) throw new Error(`en çok ${DURUM_ALANI_AZAMI} grafiğin durumu tutulur (bir grafiğin durumunu sıfırla)`);
          m = new Map();
          this._alanlar.set(graf, m);
        }
        if (!m.has(ad) && m.size >= DEGISKEN_AZAMI) throw new Error(`'${graf}' en çok ${DEGISKEN_AZAMI} değişken tutar ('${ad}' yazılamadı)`);
        m.set(ad, deger);
        this._yay(graf);
      },
    };
  }

  /** Grafiğin değişkenleri (gösterim: Graf sekmesi). */
  ozet(graf: string): Readonly<Record<string, GrafDegeri>> {
    return Object.fromEntries(this._alanlar.get(graf) ?? []);
  }

  /** Grafiğin durumunu siler (Ozyn'in "Durumu sıfırla"sı). Yoksa false. */
  sifirla(graf: string): boolean {
    const vardi = this._alanlar.delete(graf);
    if (vardi) this._yay(graf);
    return vardi;
  }

  dinle(f: (graf: string) => void): () => void { this._dinleyiciler.add(f); return () => { this._dinleyiciler.delete(f); }; }

  private _yay(graf: string): void {
    for (const f of [...this._dinleyiciler]) {
      try { f(graf); } catch (err) { console.error("[graf] durum dinleyicisi hatası:", err); }
    }
  }
}
