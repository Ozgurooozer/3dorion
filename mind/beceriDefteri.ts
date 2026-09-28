// mind/beceriDefteri.ts — BECERİ DEFTERİ (spec 10, Faz C): beceri hafızası canlıda,
// kayıttan kurulur.
//
// Defter ilkesi (spec 09 K5): hafızanın ayrı bir durum dosyası yok; kayıttan kurulur.
// Canlıda iki kaynak:
//   geçmiş     — açılışta host'un okuduğu önceki oturumların görev satırları. Kapanmış
//                oturumun görevleri bir daha değişmez: bir kez göreve çevrilir, satırlar
//                tutulmaz. Bellek görev sayısıyla büyür, satır sayısıyla değil.
//   bu oturum  — köprünün kendi kaydından dinlenen satırlar (`KararKaydi.dinle`: diske
//                gidenin aynısı). Görev ancak sonuçları gelince biter; hafıza bu yüzden
//                yeni görev satırı geldikçe kirlenir, bir sonraki kararda yeniden kurulur.
//
// Oturumlar ayrı zincirlenebilir: zincir bağları (algı → uyanış → sonuç) oturum
// içindedir (mind/kararZinciri.ts), görev iki oturuma yayılmaz.
//
// Çevrimdışı araç (tools/beceri-deney.ts) canlı gölgeyi aynı sınıfla, aynı satır
// sırasıyla yeniden kurar: canlı = kayıt denetimi (B11) aynı koddan geçer.
//
// Bağımlılık: mind/ (gorev, beceriHafizasi, kararZinciri, kararKaydi tipleri). Saf:
// dosya, saat, dünya yok.
"use strict";
import { beceriHafizasiKur, type BeceriEslesmesi, type BeceriHafizasi } from "./beceriHafizasi.ts";
import { gorevler, gorevSatiriMi, type GorevOrnegi } from "./gorev.ts";
import type { BeceriGolgesi, KararSatiri } from "./kararKaydi.ts";
import { zincirKur } from "./kararZinciri.ts";

export class BeceriDefteri {
  private _gecmis: GorevOrnegi[];
  private _satirlar: KararSatiri[] = [];
  /** Kirliyse null: bir sonraki okumada yeniden kurulur. */
  private _hafiza: BeceriHafizasi | null = null;

  /** Geçmiş oturumların satırları. Bozuksa zincir kurulurken fırlatır; çağıran karar verir. */
  constructor(gecmis: readonly KararSatiri[] = []) {
    this._gecmis = gorevler(zincirKur(gecmis.filter(gorevSatiriMi)));
  }

  /** Bu oturumun bir satırı. Görev satırı değilse (terminal, olay, oturum…) yok sayılır. */
  ekle(s: KararSatiri): void {
    if (!gorevSatiriMi(s)) return;
    this._satirlar.push(s);
    this._hafiza = null;
  }

  /** Şu anki hafıza: geçmişin görevleri + bu oturumun şimdiye kadarki görevleri. */
  get hafiza(): BeceriHafizasi {
    return (this._hafiza ??= beceriHafizasiKur([...this._gecmis, ...gorevler(zincirKur(this._satirlar))]));
  }

  /** Bu söz için parametre içinde eşleşen beceri; yoksa null. */
  karar(soz: string): BeceriEslesmesi | null {
    return this.hafiza.karar(soz);
  }

  /**
   * Kararın kayıttaki hali (`beceriGolge`). Tek yerde: köprü bunu yazar, çevrimdışı
   * denetim (tools/beceri-deney.ts) aynı fonksiyonla yeniden hesaplayıp karşılaştırır.
   * Pay üç haneye yuvarlanır (kayıt okunur kalsın).
   */
  golge(soz: string): BeceriGolgesi | null {
    const e = this.karar(soz);
    return e && { beceri: e.beceri.id, pay: Number(e.pay.toFixed(3)), adimlar: e.adimlar };
  }
}
