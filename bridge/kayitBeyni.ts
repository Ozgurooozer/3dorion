// bridge/kayitBeyni.ts — Beyne giden GERÇEK girdiyi yakalar.
//
// NEDEN VAR: beyni Babylon'dan bağımsız denemek için önce gerçek girdiye
// ihtiyaç var. Elle uydurulmuş bir `BeyinGirdisi` yanıltır — canlıda talimat
// 1084 karakter, özetler süzgeçten geçmiş, geçmiş kırpılmış hâlde geliyor.
// Sahte veriyle iyi çalışan bir beyin, gerçekte sınıfta kalabilir.
//
// Bu sarmalayıcı HERHANGİ bir beynin etrafına geçer ve her turu JSON satırı
// olarak yayar. Dosyaya yazmaz: renderer'ın dosya erişimi yok ve bunun için
// yeni bir IPC yüzeyi açmak, kazancından çok maliyet getirirdi. Onun yerine
// konsola basar — Electron zaten renderer konsolunu ana sürece taşıyor, yani
// kayıt kendiliğinden günlüğe düşüyor.
//
// `tools/beyin-ayikla.mjs` o günlükten fixture üretir,
// `tools/beyin-tekrar.ts` fixture'ları istediğin beyne oynatır.
//
// Bağımlılık: yalnızca beyin.ts. Babylon yok, Electron yok, dosya sistemi yok.
"use strict";
import type { Beyin, BeyinGirdisi, BeyinCikti } from "./beyin.ts";

/** Kayıt satırlarının önekі — ayıklayıcı bunu arar. */
export const KAYIT_ONEK = "[BEYIN:KAYIT]";

export interface KayitAyari {
  /** Satırı nereye yazalım. Varsayılan: `console.log`. */
  yaz?: (satir: string) => void;
  /**
   * Tek satırın azami uzunluğu. Aşan kayıt ATILIR, kırpılmaz.
   *
   * Kırpmak bozuk JSON üretir ve ayıklayıcı onu sessizce düşürür — yani
   * "kayıt var sanıp aslında olmaması" durumu. Atıldığını SÖYLEMEK yeğdir.
   */
  azamiUzunluk?: number;
}

/**
 * Bir beyni sarmalar: davranışı değiştirmez, yalnızca izler.
 *
 * Hata durumunda da kayıt düşer — beynin patladığı girdi, en çok ihtiyaç
 * duyulan fixture'dır.
 */
export class KayitBeyni implements Beyin {
  private _ic: Beyin;
  private _yaz: (s: string) => void;
  private _azami: number;
  private _sira = 0;

  constructor(ic: Beyin, ayar: KayitAyari = {}) {
    this._ic = ic;
    this._yaz = ayar.yaz ?? ((s) => console.log(s));
    this._azami = ayar.azamiUzunluk ?? 120_000;
  }

  /**
   * İçteki beynin adı, HER OKUMADA. Kurulumda dondurulsaydı, çalışırken
   * değişen bir beynin (`SecilebilirBeyin`) etrafında kayıtlar geçişten
   * sonra da eski beynin adını taşırdı — fixture'lar yanlış beyne atfedilirdi.
   */
  get ad(): string { return this._ic.ad; }

  hazirMi(): Promise<boolean> { return this._ic.hazirMi(); }

  async dusun(girdi: BeyinGirdisi): Promise<BeyinCikti> {
    const sira = ++this._sira;
    try {
      const cikti = await this._ic.dusun(girdi);
      this._dus({ sira, beyin: this.ad, girdi, cikti });
      return cikti;
    } catch (err) {
      this._dus({ sira, beyin: this.ad, girdi,
        hata: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  private _dus(kayit: unknown): void {
    let satir: string;
    try {
      satir = JSON.stringify(kayit);
    } catch {
      // Döngüsel yapı ya da serileşmeyen alan: kayıt kaybı görünür olsun.
      this._yaz(`${KAYIT_ONEK} {"hata":"kayit serilestirilemedi"}`);
      return;
    }
    if (satir.length > this._azami) {
      this._yaz(`${KAYIT_ONEK} {"hata":"kayit cok uzun (${satir.length} krk), atildi"}`);
      return;
    }
    this._yaz(`${KAYIT_ONEK} ${satir}`);
  }
}
