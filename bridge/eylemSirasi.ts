// bridge/eylemSirasi.ts — EYLEM SIRASI: bir turdaki beden niyetleri sırayla yürür (spec 13 Faz 1;
// spec 14 R2'de bridge/kopru.ts'ten ayrıldı, davranış aynı).
//
// Taban ölçüsü (2026-10-02): "masaya git ve otur", "tahtaya yaz" hep yalnız `git` ile bitti.
// Varış sonucu rutin olduğu için beyni uyandırmaz (`refleks.sonuc.rutin`) ve ikinci adım hiç
// gelmez; aynı turda `git + yaz` gönderilse `yaz` varıştan önce yürüyüp "uzaktan yazamazsın"
// ile reddedilirdi. Beceri refleksinin adım yürütücüsüyle aynı desen:
//   - tek beden niyeti HEMEN gider (bugünkü gibi);
//   - birden çoğunda sıradaki adım öncekinin `bitti` sonucunu bekler;
//   - `hata` / `iptal` sırayı keser (hata yine beyne gider, kapıdan);
//   - zaman aşımı kalanı düşürür; yeni turun beden niyetleri süren sırayı keser.
// Gönderim dışarıdan verilir (köprünün tek çıkışı `_gonder`): sıra dünyayı bilmez.
"use strict";
import type { Niyet, NiyetSonucu } from "../protocol/niyet.ts";

export interface SiraAdimi { niyet: Niyet; id: string }

export interface EylemSirasiAyari {
  /** Niyeti dünyaya gönderir (köprünün tek çıkışı). */
  gonder: (n: Niyet, id: string) => void;
  /** Bir adımın sonucu en çok bu kadar beklenir (ms). Her adımda okunur. */
  zamanAsimiMs: () => number;
}

export class EylemSirasi {
  private _a: EylemSirasiAyari;
  private _kalan: SiraAdimi[] = [];
  private _bekleyen: string | null = null;
  private _zamanlayici: ReturnType<typeof setTimeout> | null = null;
  private _suruyor = false;

  constructor(a: EylemSirasiAyari) { this._a = a; }

  /** Sürüyor mu (sonucu beklenen adım ya da kalan var). */
  get suruyor(): boolean { return this._suruyor; }

  /** Yeni turun beden niyetleri: süren sırayı keser; tek niyet hemen, fazlası sırayla. */
  baslat(adimlar: readonly SiraAdimi[]): void {
    const [ilk, ...kalan] = adimlar;
    if (!ilk) return;
    this.kes("yeni tur");
    if (!kalan.length) { this._a.gonder(ilk.niyet, ilk.id); return; }
    console.log(`[kopru] eylem sirasi: ${adimlar.map((a) => a.niyet.tur).join(" → ")}`);
    this._kalan = kalan;
    this._suruyor = true;
    this._gonder(ilk);
  }

  /** Bekleyen adımın sonucu: `bitti` sırayı ilerletir, `hata`/`iptal` keser; `basladi` ve başkasınınki yok sayılır. */
  sonuc(s: NiyetSonucu): void {
    if (!this._suruyor || s.niyet_id !== this._bekleyen || s.durum === "basladi") return;
    this._saatiDurdur();
    this._bekleyen = null;
    if (s.durum !== "bitti") { this.kes(s.durum); return; }
    const sonraki = this._kalan.shift();
    if (!sonraki) { this._suruyor = false; return; }
    this._gonder(sonraki);
  }

  /** Süren sırayı bırakır; gönderilmeyen adımlar görünür biçimde söylenir. */
  kes(neden: string): void {
    if (!this._suruyor) return;
    this._suruyor = false;
    this._saatiDurdur();
    this._bekleyen = null;
    if (this._kalan.length) console.warn(`[kopru] eylem sirasi kesildi (${neden}): ${this._kalan.map((a) => a.niyet.tur).join(", ")} gonderilmedi`);
    this._kalan = [];
  }

  /** Beklenen kimlik ve zaman aşımı GÖNDERMEDEN ÖNCE kurulur: sonuç senkron gelse de yakalansın. */
  private _gonder(adim: SiraAdimi): void {
    this._bekleyen = adim.id;
    this._zamanlayici = setTimeout(() => this.kes("zaman aşımı"), this._a.zamanAsimiMs());
    this._a.gonder(adim.niyet, adim.id);
  }

  private _saatiDurdur(): void {
    if (this._zamanlayici) { clearTimeout(this._zamanlayici); this._zamanlayici = null; }
  }
}
