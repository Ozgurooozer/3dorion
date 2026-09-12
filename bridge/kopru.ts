// bridge/kopru.ts — Beyin ile dünya arasındaki döngü.
//
// Köprü ne Babylon'u ne Electron'u ne de beynin kim olduğunu bilir. Dışarıdan
// iki şey alır: niyeti gönderecek bir fonksiyon ve bir `Beyin`. Bu yüzden
// tamamen sahte bir beyinle, sahnesiz test edilebilir.
//
// Akış:
//   algi() → Dikkat süzer → tampon → (tetik) → Beyin.dusun()
//     → araç çağrıları → protokol doğrulaması → niyetGonder()
//
// Tetikleme "her algıda düşün" DEĞİL: konuşma anında uyandırır, geri kalanı
// kısa bir sessizlik penceresiyle toplanır. Amaç, beyni gereksiz uyandırmamak.
"use strict";
import type { Algi } from "../protocol/algi.ts";
import { ozetle } from "../protocol/algi.ts";
import type { Niyet, NiyetSonucu } from "../protocol/niyet.ts";
import { kimlik } from "../protocol/temel.ts";
import { Dikkat, type DikkatAyari } from "../mind/dikkat.ts";
import { araclariUret, cagriyiNiyete } from "./araclar.ts";
import type { Beyin } from "./beyin.ts";

export interface KopruAyari {
  beyin: Beyin;
  /** Doğrulanmış niyeti dünyaya iletir. Dünya tipi BİLİNMEZ — sadece bu imza. */
  niyetGonder: (n: Niyet, id: string) => void;
  /** Dünyanın sıkıştırılmış durumunu ister (her düşünmede bir kez çağrılır). */
  dunyaDurumu: () => string;
  dikkat?: DikkatAyari;
  /** Konuşma dışı algılar bu kadar beklenip toplanır (ms). */
  toplamaMs?: number;
  /** Bellekte tutulacak konuşma turu sayısı. */
  gecmisSiniri?: number;
  simdi?: () => number;
}

export interface KopruSayaci {
  dusunme: number;
  niyet: number;
  reddedilenCagri: number;
  hata: number;
}

export class Kopru {
  private _ayar: KopruAyari;
  private _dikkat: Dikkat;
  private _tampon: string[] = [];
  private _gecmis: { rol: "kullanici" | "orion"; metin: string }[] = [];
  private _zamanlayici: ReturnType<typeof setTimeout> | null = null;
  private _dusunuyor = false;
  /** Düşünme sürerken yeni girdi geldiyse, bitince bir tur daha dön. */
  private _tekrarGerek = false;
  private _sayac: KopruSayaci = { dusunme: 0, niyet: 0, reddedilenCagri: 0, hata: 0 };
  /** Üst üste kaç tur yalnızca ret geri beslemesiyle döndük. Döngü kalkanı. */
  private _ardisikRet = 0;
  private _konusmaDinleyici: ((metin: string) => void) | null = null;
  private _durduruldu = false;

  constructor(ayar: KopruAyari) {
    this._ayar = ayar;
    this._dikkat = new Dikkat(ayar.dikkat);
  }

  /** Orion'un söylediği metni dinlemek isteyen (altyazı, TTS) buraya bağlanır. */
  konusmaDinle(cb: (metin: string) => void): void { this._konusmaDinleyici = cb; }

  /** Dünyadan gelen algı. Yüksek frekansla çağrılabilir; süzgeç burada. */
  algi(a: Algi): void {
    if (this._durduruldu) return;
    const k = this._dikkat.karar(a);
    if (!k.gecsin) return;

    const ozet = ozetle(a);
    if (!ozet) return;
    this._tampon.push(ozet);

    if (a.tur === "duydum") {
      // Kullanıcı konuştu: bekletme, hemen düşün.
      this._dikkat.sifirla();
      this._gecmis.push({ rol: "kullanici", metin: a.metin });
      this._kirp();
      this._hemenDusun();
    } else {
      this._gecikmeliDusun();
    }
  }

  /** Niyet sonucunu algı olarak geri besler — Orion yapamadığını öğrenir. */
  sonuc(s: NiyetSonucu): void { this.algi({ tur: "sonuc", sonuc: s }); }

  sayac(): KopruSayaci & { dikkat: ReturnType<Dikkat["sayac"]> } {
    return { ...this._sayac, dikkat: this._dikkat.sayac() };
  }

  /** Bekleyen işleri iptal eder. Kapanışta çağrılır. */
  durdur(): void {
    this._durduruldu = true;
    if (this._zamanlayici) { clearTimeout(this._zamanlayici); this._zamanlayici = null; }
  }

  private _gecikmeliDusun(): void {
    if (this._zamanlayici) return;
    this._zamanlayici = setTimeout(() => {
      this._zamanlayici = null;
      void this._dusun();
    }, this._ayar.toplamaMs ?? 1200);
  }

  private _hemenDusun(): void {
    if (this._zamanlayici) { clearTimeout(this._zamanlayici); this._zamanlayici = null; }
    void this._dusun();
  }

  private async _dusun(): Promise<void> {
    if (this._durduruldu) return;
    if (this._dusunuyor) { this._tekrarGerek = true; return; }
    if (this._tampon.length === 0) return;

    this._dusunuyor = true;
    const ozetler = this._tampon.splice(0);
    this._sayac.dusunme++;

    try {
      const cikti = await this._ayar.beyin.dusun({
        ozetler,
        dunya: this._ayar.dunyaDurumu(),
        gecmis: this._gecmis.slice(),
        araclar: araclariUret(),
      });

      // Düz metin DUYULMAZ — protokolde konuşmak bir eylemdir (dunya_soyle).
      // Yine de geçmişe yazılır: modelin kendi düşüncesi bağlamda kalsın.
      if (cikti.metin) { this._gecmis.push({ rol: "orion", metin: cikti.metin }); this._kirp(); }

      for (const c of cikti.cagrilar) {
        const d = cagriyiNiyete(c.ad, c.girdi);
        if (!d.ok) {
          this._sayac.reddedilenCagri++;
          // Reddi sessizce yutma: modele geri besle, kendini düzeltsin.
          this._tampon.push(`Araç reddedildi (${c.ad}): ${d.hata}`);
          console.warn(`[kopru] çağrı reddedildi: ${d.hata}`);
          continue;
        }
        this._ardisikRet = 0;  // geçerli çağrı geldi, düzeltme döngüsü kırıldı
        const id = kimlik("n");
        if (d.deger.tur === "soyle" && this._konusmaDinleyici) {
          this._konusmaDinleyici(d.deger.metin);
          this._gecmis.push({ rol: "orion", metin: d.deger.metin });
          this._kirp();
        }
        this._ayar.niyetGonder(d.deger, id);
        this._sayac.niyet++;
      }
    } catch (err) {
      this._sayac.hata++;
      // Beyin hatası dünyayı durdurmaz ama SESSİZ de kalmaz.
      console.error("[kopru] beyin hatası:", err instanceof Error ? err.message : err);
    } finally {
      this._dusunuyor = false;
      if (this._tekrarGerek) {
        this._tekrarGerek = false;
        this._gecikmeliDusun();
      } else if (this._tampon.length > 0) {
        // Ret geri beslemesi tampona yazıldıysa beyni uyandırmak GEREKİR;
        // yoksa model kendi hatasını asla öğrenmez ve sessizce yanlış kalır.
        //
        // Kalkan: model ısrarla geçersiz çağrı üretiyorsa sonsuza kadar
        // dönmeyiz. İki turdan sonra geri besleme düşürülür ve sessiz değil,
        // görünür biçimde bildirilir.
        if (++this._ardisikRet > 2) {
          const dusen = this._tampon.splice(0);
          this._ardisikRet = 0;
          console.warn(`[kopru] model üst üste geçersiz çağrı üretti, düzeltme döngüsü kesildi (${dusen.length} geri besleme düşürüldü)`);
        } else {
          this._gecikmeliDusun();
        }
      }
    }
  }

  private _kirp(): void {
    const sinir = this._ayar.gecmisSiniri ?? 12;
    if (this._gecmis.length > sinir) this._gecmis.splice(0, this._gecmis.length - sinir);
  }
}
