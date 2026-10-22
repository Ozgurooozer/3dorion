// uygulama/graf/grafDurumu.ts — GRAFİKLERİN ve AJANLARIN DEĞİŞKENLERİ (spec 35 dilim 2 + dilim 3): ziyaret sayacı, "parolayı bildi mi", son söz… SAF: DOM yok.
//
// NPC'nin durumu oyunlardaki gibi küçük bir "kara tahta"dır: ad → değer (sayı, metin, doğru/yanlış). İKİ KAPSAM (dilim 3, Unreal karşılaştırması 35b):
//   • GRAFİK (varsayılan, dilim 2'nin davranışı; eski grafikler aynen çalışır): ad alanı = KÖK GRAFİĞİN ADI. ▶ ile ya da olayla çalışan aynı grafik aynı
//     alanı görür; başka grafik göremez. Desen çağıranın alanını kullanır. Aynı grafiği İKİ AJAN çalıştırırsa sayacı PAYLAŞIRLAR — 35b'nin bulduğu sorun.
//   • AJAN (`kapsam: "ajan"`, Unreal "üye değişkeni"): ad alanı = AJANIN KİMLİĞİ. O ajanın BÜTÜN grafikleri (nöbet + barmen + rutin) aynı alanı görür,
//     başka ajan göremez: aynı nöbetçi grafiği iki NPC'de iki ayrı sayaç tutar. Ad çakışması bilerek mümkündür (iki grafik aynı ajanın "ziyaret"ini
//     paylaşır: üye değişkeni budur); ayrı tutmak isteyen grafik kapsamını seçer.
// Kurallar (ikisinde aynı):
//   • YALNIZ BELLEKTE. Diske, localStorage'a, host'a gitmez: uygulama kapanınca durum da gider (dinleme gibi; spec 35 §4c). NEDEN: kalıcı durum bir
//     sözleşmedir (sürüm, göç, bozuk dosya) ve bugün ihtiyaç yok; ziyaret sayacı oturum boyunca yeter. Kalıcılık gerekirse ayrı karar (spec 35 dilim 3 açığı).
//   • TAVANLAR: alan başına DEGISKEN_AZAMI ad, metin DEGISKEN_METIN_AZAMI karakter, sayı sonlu; en çok DURUM_ALANI_AZAMI grafiğin ve AJAN_DURUMU_AZAMI
//     ajanın alanı. Aşılınca yazma FIRLATIR (düğüm nedenle düşer): sessizce kesmek ya da en eskisini silmek NPC'nin hafızasını görünmeden bozardı.
"use strict";
import { grafAdiGecerli, type GrafDegeri } from "../../protocol/graf.ts";
import type { DegiskenAlani } from "./dugumKaydi.ts";

/** Alan başına değişken sayısı. 32: bir NPC'nin durumu (sayaç, bayrak, son seçim) için bol; bozuk bir döngünün belleği şişirmesine yetmez. */
export const DEGISKEN_AZAMI = 32;
/** Metin değişkeninin uzunluğu (karakter). Diyalog metni bile 300'ü geçmez (diyalogDenetimi.ts); değişken kısa durum içindir. */
export const DEGISKEN_METIN_AZAMI = 200;
/** Durumu tutulan grafik sayısı (ad alanı). */
export const DURUM_ALANI_AZAMI = 64;
/** Durumu tutulan AJAN sayısı (dilim 3). 512: 300 NPC hedefi (spec 33) + pay; her alan en çok 32 küçük değer, bellekte küçük. Ölçülmedi. */
export const AJAN_DURUMU_AZAMI = 512;

export type DurumKapsami = "grafik" | "ajan";
/** Değişen alan: hangi kapsamda, kimin (grafiğin adı ya da ajanın kimliği). */
export interface DurumDegisimi { readonly kapsam: DurumKapsami; readonly ad: string }

/** Değerin değişkene yazılabilir olup olmadığı; değilse nedeni. Saf (düğümler de denetimde aynı kuralı kullanır). */
export function degiskenDegeriHatasi(deger: unknown): string | null {
  if (typeof deger === "boolean") return null;
  if (typeof deger === "number") return Number.isFinite(deger) ? null : "sayı sonlu olmalı";
  if (typeof deger === "string") return deger.length <= DEGISKEN_METIN_AZAMI ? null : `metin en çok ${DEGISKEN_METIN_AZAMI} karakter (gelen: ${deger.length})`;
  return `değişkene yalnız sayı, metin ya da doğru/yanlış yazılır (gelen: ${deger === null ? "null" : typeof deger})`;
}

const KAPSAM_ADI: Record<DurumKapsami, { tekil: string; azami: number; ipucu: string }> = {
  grafik: { tekil: "grafiğin", azami: DURUM_ALANI_AZAMI, ipucu: "bir grafiğin durumunu sıfırla" },
  ajan: { tekil: "ajanın", azami: AJAN_DURUMU_AZAMI, ipucu: "bir ajanın durumunu sıfırla" },
};

export class GrafDurumDeposu {
  private readonly _alanlar: Record<DurumKapsami, Map<string, Map<string, GrafDegeri>>> = { grafik: new Map(), ajan: new Map() };
  private readonly _dinleyiciler = new Set<(d: DurumDegisimi) => void>();

  /** Grafiğin değişken alanı. Alan ilk YAZIŞTA açılır (okumak alan açmaz: hiç yazmayan grafik tavana sayılmaz). */
  alan(graf: string): DegiskenAlani { return this._alan("grafik", graf); }

  /**
   * AJANIN değişken alanı (dilim 3): o ajanın bütün grafikleri paylaşır. Kimlik ad kuralına uymalı (yazımda denetlenir): çözülmemiş "@ben" ya da boş
   * kimlik bir alan AÇAMAZ — yanlış sahibe yazılan sayaç sessizce kaybolurdu. Kimliğin defterde olması düğümün işi (`ajanlar()`), depo defteri bilmez.
   */
  ajanAlani(ajan: string): DegiskenAlani { return this._alan("ajan", ajan); }

  /** Grafiğin değişkenleri (gösterim: Graf sekmesi). */
  ozet(graf: string): Readonly<Record<string, GrafDegeri>> { return Object.fromEntries(this._alanlar.grafik.get(graf) ?? []); }
  /** Ajanın değişkenleri (Graf sekmesi · NPC'ler). */
  ajanOzet(ajan: string): Readonly<Record<string, GrafDegeri>> { return Object.fromEntries(this._alanlar.ajan.get(ajan) ?? []); }
  /** Durumu olan ajanlar (kimlik sırasıyla). */
  durumluAjanlar(): string[] { return [...this._alanlar.ajan.keys()].sort(); }

  /** Grafiğin durumunu siler (Ozyn'in "Durumu sıfırla"sı). Yoksa false. Ajan alanlarına DOKUNMAZ (başka grafikler de paylaşıyor olabilir). */
  sifirla(graf: string): boolean { return this._sil("grafik", graf); }
  /** Ajanın durumunu siler (NPC kartındaki "Durumu sıfırla"). Yoksa false. */
  ajanSifirla(ajan: string): boolean { return this._sil("ajan", ajan); }

  dinle(f: (d: DurumDegisimi) => void): () => void { this._dinleyiciler.add(f); return () => { this._dinleyiciler.delete(f); }; }

  private _alan(kapsam: DurumKapsami, sahip: string): DegiskenAlani {
    const alanlar = this._alanlar[kapsam];
    const k = KAPSAM_ADI[kapsam];
    return {
      oku: (ad) => alanlar.get(sahip)?.get(ad),
      yaz: (ad, deger) => {
        if (!grafAdiGecerli(ad)) throw new Error(`değişken adı geçersiz: ${JSON.stringify(ad)} (harf, rakam, _ ve -)`);
        if (kapsam === "ajan" && !grafAdiGecerli(sahip)) throw new Error(`ajan kimliği geçersiz: ${JSON.stringify(sahip)} (ajan kapsamlı değişken yazılamadı)`);
        const h = degiskenDegeriHatasi(deger);
        if (h) throw new Error(`'${ad}': ${h}`);
        let m = alanlar.get(sahip);
        if (!m) {
          if (alanlar.size >= k.azami) throw new Error(`en çok ${k.azami} ${k.tekil} durumu tutulur (${k.ipucu})`);
          m = new Map();
          alanlar.set(sahip, m);
        }
        if (!m.has(ad) && m.size >= DEGISKEN_AZAMI) throw new Error(`'${sahip}' en çok ${DEGISKEN_AZAMI} değişken tutar ('${ad}' yazılamadı)`);
        m.set(ad, deger);
        this._yay({ kapsam, ad: sahip });
      },
    };
  }

  private _sil(kapsam: DurumKapsami, sahip: string): boolean {
    const vardi = this._alanlar[kapsam].delete(sahip);
    if (vardi) this._yay({ kapsam, ad: sahip });
    return vardi;
  }

  private _yay(d: DurumDegisimi): void {
    for (const f of [...this._dinleyiciler]) {
      try { f(d); } catch (err) { console.error("[graf] durum dinleyicisi hatası:", err); }
    }
  }
}
