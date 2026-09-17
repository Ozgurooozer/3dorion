// bridge/secilebilirBeyin.ts — çalışırken beyin değiştirme.
//
// `KayitBeyni` ile aynı kalıp: bir `Beyin` gibi davranır, işi içindekine
// devreder. Köprü hiçbir şey bilmez; kayıt sarmalayıcısıyla da üst üste
// takılabilir.
//
// ── İSTENEN / AKTİF AYRIMI ──────────────────────────────────────────────
//
// Beyin değiştirmek ASENKRON: önce hedefin ayakta olduğu doğrulanmalı. Devre
// panosunun yazma yolu ise SENKRON (`Dugme.yaz` hemen okunup doğrulanır).
// Panoyu async'e çevirmek protokolü ve bütün pano testlerini değiştirirdi.
//
// Çözüm kokpitlerdeki "seçilen irtifa / gerçek irtifa" ayrımı:
//   istenen — kullanıcının en son seçtiği; ANINDA değişir
//   aktif   — gerçekten düşünen; ancak sağlık kontrolü geçince değişir
// Kontrol geçemezse istenen aktife GERİ DÖNER ve sebep `gecis`te okunur.
// "Seçildi ama henüz geçmedi" böylece gizli bir ara durum değil, panelde
// görünen birinci sınıf bir durum olur.
//
// Bağımlılık: yalnızca beyin.ts.
"use strict";
import type { Beyin, BeyinGirdisi, BeyinCikti } from "./beyin.ts";

export interface BeyinSecenegi {
  /** Panelde görünen, benzersiz anahtar. */
  ad: string;
  /**
   * Beyni kurar. TEMBEL: seçilene kadar çağrılmaz, sonra önbelleklenir.
   *
   * Tembel, çünkü açılışta her beyne bağlantı açmak kullanılmayan bir bulut
   * oturumu ya da yüklenmemiş bir yerel model için bedel ödemektir.
   * Önbellekli, çünkü OpenCode beyni oturum geçmişini örnekte tutuyor:
   * A→B→A dönüşünde A'yı yeniden kurmak o geçmişi gereksiz yere çöpe atardı.
   */
  kur: () => Beyin;
}

export type GecisDurumu =
  | { tur: "sakin" }
  | { tur: "kontrol"; hedef: string }
  | { tur: "reddedildi"; hedef: string; sebep: string };

export interface GecisOlayi {
  tur: "gecti" | "reddedildi";
  hedef: string;
  sebep?: string;
}

export interface SecilebilirAyar {
  /** Sağlık kontrolü bu süreyi aşarsa geçiş reddedilir. */
  saglikZamanAsimiMs?: number;
  /** Geçiş sonuçlandığında çağrılır (panel notu, günlük). */
  bildir?: (olay: GecisOlayi) => void;
}

export class SecilebilirBeyin implements Beyin {
  private _secenekler: Map<string, BeyinSecenegi>;
  private _kurulu = new Map<string, Beyin>();
  private _aktif: string;
  private _istenen: string;
  private _gecis: GecisDurumu = { tur: "sakin" };
  private _suren: Promise<void> = Promise.resolve();
  private _zamanAsimi: number;
  private _bildir: (o: GecisOlayi) => void;

  constructor(secenekler: readonly BeyinSecenegi[], baslangic: string, ayar: SecilebilirAyar = {}) {
    // Kurulum hataları FIRLATIR: burası kompozisyon kökü, kare döngüsü değil.
    // Bozuk bir liste açılışta yığın iziyle durmalı.
    if (!secenekler.length) throw new Error("beyin seçenek listesi boş");
    this._secenekler = new Map();
    for (const s of secenekler) {
      if (this._secenekler.has(s.ad)) throw new Error(`beyin seçeneği iki kez tanımlı: ${s.ad}`);
      this._secenekler.set(s.ad, s);
    }
    if (!this._secenekler.has(baslangic)) {
      throw new Error(`başlangıç beyni listede yok: ${baslangic}`);
    }
    this._aktif = this._istenen = baslangic;
    this._zamanAsimi = ayar.saglikZamanAsimiMs ?? 5000;
    this._bildir = ayar.bildir ?? (() => {});
    // Başlangıç beyni ŞİMDİ kurulur: `ad` ilk okumada gerçek adı vermeli.
    this._ornek(baslangic);
  }

  /** Aktif beynin adı — köprü ve panel bunu okur, geçişte kendiliğinden değişir. */
  get ad(): string { return this.ic.ad; }
  get aktif(): string { return this._aktif; }
  get istenen(): string { return this._istenen; }
  get gecis(): GecisDurumu { return this._gecis; }
  /**
   * Aktif örnek. `instanceof OpenCodeBeyni` gibi uygulamaya özgü sorgular
   * için; devre kesici arayüzde değil, yalnızca OpenCode beyninde var.
   */
  get ic(): Beyin { return this._ornek(this._aktif); }

  secenekAdlari(): readonly string[] { return [...this._secenekler.keys()]; }

  /**
   * Geçiş iste. Dönüş: `""` = kabul (kontrol başladı ya da zaten aktif),
   * aksi hâlde red sebebi. FIRLATMAZ — panel tıklamasından çağrılıyor.
   */
  iste(ad: string): string {
    if (!this._secenekler.has(ad)) return `böyle bir beyin yok: ${ad}`;
    if (this._gecis.tur === "kontrol") {
      // İkinci isteği kabul etmek, birincinin hedefini ezip yarım durum
      // bırakırdı. Onay kapısıyla aynı kural: bekleyen ezilemez.
      return `geçiş sürüyor (${this._gecis.hedef})`;
    }
    if (ad === this._aktif) {
      this._istenen = ad;
      this._gecis = { tur: "sakin" };
      return "";
    }
    this._istenen = ad;
    this._gecis = { tur: "kontrol", hedef: ad };
    this._suren = this._dene(ad);
    return "";
  }

  /** Süren geçiş sonuçlanana kadar bekler. Testler ve senaryolar içindir. */
  gecisBitti(): Promise<void> { return this._suren; }

  hazirMi(): Promise<boolean> { return this.ic.hazirMi(); }

  dusun(girdi: BeyinGirdisi): Promise<BeyinCikti> {
    // Örnek ŞİMDİ yakalanır. Düşünce sürerken geçiş olursa bu çağrı eski
    // beyinde biter; yarım akıl yürütmeyi başka beyin devralamaz.
    return this.ic.dusun(girdi);
  }

  private _ornek(ad: string): Beyin {
    let b = this._kurulu.get(ad);
    if (!b) {
      b = this._secenekler.get(ad)!.kur();
      this._kurulu.set(ad, b);
    }
    return b;
  }

  private async _dene(hedef: string): Promise<void> {
    let sebep = "";
    try {
      const b = this._ornek(hedef);
      const hazir = await zamanAsimli(b.hazirMi(), this._zamanAsimi);
      if (hazir === "zaman_asimi") sebep = `sağlık kontrolü zaman aşımı (${this._zamanAsimi} ms)`;
      else if (!hazir) sebep = `${b.ad} hazır değil`;
    } catch (e) {
      sebep = e instanceof Error ? e.message : String(e);
    }

    if (sebep) {
      // Geri dönüş GÖRÜNÜR: panel bir an "b" gösterip sonra "a"ya dönecek;
      // nedenini `gecis` ve günlük söyler.
      this._istenen = this._aktif;
      this._gecis = { tur: "reddedildi", hedef, sebep };
      console.warn(`[BEYIN] ${hedef} beynine geçilemedi: ${sebep}`);
      this._bildir({ tur: "reddedildi", hedef, sebep });
      return;
    }
    this._aktif = hedef;
    this._gecis = { tur: "sakin" };
    console.log(`[BEYIN] geçildi: ${hedef} (${this.ad})`);
    this._bildir({ tur: "gecti", hedef });
  }
}

async function zamanAsimli<T>(p: Promise<T>, ms: number): Promise<T | "zaman_asimi"> {
  let saat: ReturnType<typeof setTimeout> | undefined;
  const sure = new Promise<"zaman_asimi">((r) => { saat = setTimeout(() => r("zaman_asimi"), ms); });
  try { return await Promise.race([p, sure]); }
  finally { clearTimeout(saat); }
}
