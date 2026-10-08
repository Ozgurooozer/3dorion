// voice/nemotron.ts — Orion'un kulağı: bas-konuş mikrofon, Nemotron Speech (İngilizce) ile.
//
// `KonusmaKaynagi` arayüzünün (voice/tip.ts) üçüncü uygulaması: metin ve sahte-mikrofonla aynı
// hatta bağlanır, hattın geri kalanı değişmez. Ses burada işlenmez — mikrofonu ve modeli ana
// süreçteki kalıcı Python süreci (host/dinleme.js) tutar; buraya yalnız çözülmüş METİN gelir.
//
// BAS-KONUŞ, sürekli dinleme değil: yanlış uyanma yok, ve model sessizliğe kelime uydurmuyor
// (ölçüldü: kısık mikrofonda "Madhuba."). Tuşa basılınca `kayitBasla`, bırakılınca `kayitBitir`.
"use strict";
import type { KonusmaKaynagi, Tanima } from "./tip.ts";

/** Ana süreç olaylarının renderer'daki yapısal hâli (host/dinleme.d.ts; voice/ host'u import etmez). */
export type KulakOlayi =
  | { olay: "hazir"; mikrofon: string }
  | { olay: "tanima"; metin: string; ms: number; sure: number; tepe: number }
  | { olay: "bos"; neden: string }
  | { olay: "hata"; hata: string }
  | { olay: "kapandi"; kod: number | null };

/** `window.kopru`nun kulakla ilgili yüzü; testte sahtesi verilir. */
export interface KulakKopru {
  dinleKomut(komut: "baslat" | "kayit" | "dur" | "kapat"): Promise<boolean>;
  dinleDinle(cb: (o: KulakOlayi) => void): () => void;
}

/** Kullanıcıya gösterilecek durum: ne oluyor, neden sessiz. */
export type KulakDurumu =
  | { d: "yukleniyor" }
  | { d: "hazir"; mikrofon: string }
  | { d: "dinliyor" }
  | { d: "cozuyor" }
  | { d: "bos"; neden: string }
  | { d: "kapali" };

export class NemotronGirdi implements KonusmaKaynagi {
  readonly ad = "nemotron";
  private _kopru: KulakKopru | null;
  private _dinleyiciler = new Set<(t: Tanima) => void>();
  private _hataDinleyiciler = new Set<(h: string) => void>();
  private _durumDinleyiciler = new Set<(d: KulakDurumu) => void>();
  private _aboneligiBirak: (() => void) | null = null;
  private _hazir = false;
  private _kayitta = false;
  private _mikrofon = "";

  constructor(kopru: KulakKopru | null) { this._kopru = kopru; }

  kullanilabilir(): boolean { return this._kopru !== null; }
  get hazir(): boolean { return this._hazir; }
  get kayitta(): boolean { return this._kayitta; }

  async baslat(): Promise<void> {
    const k = this._kopru;
    if (!k || this._aboneligiBirak) return;
    this._aboneligiBirak = k.dinleDinle((o) => this._olay(o));
    this._durum({ d: "yukleniyor" });
    await k.dinleKomut("baslat");
  }

  durdur(): void {
    this._aboneligiBirak?.();
    this._aboneligiBirak = null;
    this._hazir = false;
    this._kayitta = false;
    void this._kopru?.dinleKomut("kapat");
    this._durum({ d: "kapali" });
  }

  dinle(cb: (t: Tanima) => void): () => void {
    this._dinleyiciler.add(cb);
    return () => { this._dinleyiciler.delete(cb); };
  }
  hataDinle(cb: (h: string) => void): () => void {
    this._hataDinleyiciler.add(cb);
    return () => { this._hataDinleyiciler.delete(cb); };
  }
  durumDinle(cb: (d: KulakDurumu) => void): () => void {
    this._durumDinleyiciler.add(cb);
    return () => { this._durumDinleyiciler.delete(cb); };
  }

  /** Tuşa basıldı. Model hazır değilse kaydetmez (yarım yüklü modele ses göndermek sessizce kaybolur). */
  kayitBasla(): void {
    if (!this._hazir || this._kayitta) return;
    this._kayitta = true;
    this._durum({ d: "dinliyor" });
    void this._kopru?.dinleKomut("kayit");
  }

  /** Tuş bırakıldı: sonuç `dinle` ya da durum olarak gelir. */
  kayitBitir(): void {
    if (!this._kayitta) return;
    this._kayitta = false;
    this._durum({ d: "cozuyor" });
    void this._kopru?.dinleKomut("dur");
  }

  private _olay(o: KulakOlayi): void {
    if (o.olay === "hazir") { this._hazir = true; this._mikrofon = o.mikrofon; this._durum({ d: "hazir", mikrofon: o.mikrofon }); }
    else if (o.olay === "tanima") {
      const metin = o.metin.trim();
      if (!metin) { this._durum({ d: "bos", neden: "anlasilmadi" }); return; }
      this._durum({ d: "hazir", mikrofon: this._mikrofon });
      for (const d of this._dinleyiciler) d({ metin, kesin: true });
    }
    else if (o.olay === "bos") this._durum({ d: "bos", neden: o.neden });
    else if (o.olay === "hata") { for (const h of this._hataDinleyiciler) h(o.hata); }
    else if (o.olay === "kapandi") {
      this._hazir = false;
      this._kayitta = false;
      this._durum({ d: "kapali" });
      for (const h of this._hataDinleyiciler) h(`kulak sureci kapandi (kod ${o.kod ?? "?"})`);
    }
  }

  private _durum(d: KulakDurumu): void {
    for (const cb of this._durumDinleyiciler) cb(d);
  }
}
