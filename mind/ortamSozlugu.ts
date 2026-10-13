// mind/ortamSozlugu.ts — ÖĞRENEN ortam sözlüğü: LLM bir kez yaparsa, o söz sonraki sefer token'sız çalışır.
//
// Ozyn (2026-10-13): "LLM bir kere yapınca onu sadece sözlük olarak kaydetsin; saati ileri sar, 3pm yap, ışık ayarlarını
// değiştir gibi ön beyinde token harcamadan ama gerektiğinde LLM de kontrol edebilsin."
// Sıra: yerleşik sözlük (mind/ortamKomutlari.ts) → BU öğrenen sözlük → LLM. Yani LLM yalnız sözlüğün bilmediği sözde
// düşünür; bir kez doğru yaparsa bir daha düşünmez.
//
// NEDEN `beceriHafizasi`NDAN AYRI (spec 10 o işi genel yapar): orası yetki anahtarıyla KAPALI, bedensel adımlar ve çapa
// yuvaları için, silme/yasak yolu yok. Ortam komutları tek niyetli, geri alınabilir (sıfırla) ve zararsız; küçük, kendi
// güvenceleri olan bir sözlük yeter. Güvenceler:
//   - YALNIZ tam normalleşmiş söz eşleşir (sayı/kelime genellemesi YOK: "3pm yap" ile "4pm yap" ayrı kayıt, yerleşik
//     sözlük zaten ikisini de bilir). Yanlış genelleme olmaz.
//   - YALNIZ `ortam` niyetlerinden öğrenilir (bedensel/yaz/komut karışmış turdan öğrenilmez), yalnız BAŞARILI sonuçtan.
//   - Yerleşik sözlüğün zaten bildiği söz kaydedilmez (tekrar yok).
//   - Kullanımdan sonra 20 sn içinde "sıfırla" gelirse kayıt olumsuz sayılır; başarı payı %75'in altına inen kayıt
//     ASKIYA alınır (eşleşmez) ve Ozyn görüp silebilir (G penceresi "öğrendiklerim").
//   - Üst sınır 200 kayıt; en eskisi düşer.
// Saf: depo ve saat dışarıdan verilir.
"use strict";
import type { Niyet } from "../protocol/niyet.ts";
import { komutCoz, sozuNormalle, type KomutEslesmesi } from "./komutSozlugu.ts";

export type OrtamNiyeti = Extract<Niyet, { tur: "ortam" }>;

export interface OgrenilenKayit {
  /** Normalleşmiş söz (eşleşme anahtarı). */
  soz: string;
  /** Öğrenildiği ham söz (Ozyn'e gösterilir). */
  ham: string;
  komutlar: OrtamNiyeti[];
  basari: number;
  hata: number;
  /** Son öğrenme/kullanım zamanı (ms). */
  t: number;
}

export interface OgrenilenDeposu {
  oku(): OgrenilenKayit[];
  yaz(k: readonly OgrenilenKayit[]): void;
}

export const OGRENILEN_SINIRI = 200;
/** Kullanımdan sonra bu süre içinde gelen "sıfırla" o kaydı olumsuz sayar. */
export const GERI_ALMA_MS = 20_000;
/** Başarı payı bunun altına inen kayıt askıdadır. */
export const ASKI_PAYI = 0.75;
const SOZ_SINIRI = 80;
const KOMUT_SINIRI = 6;

export type OgrenmeSonucu = "yeni" | "guncellendi" | "reddedildi";

export class OrtamSozlugu {
  private _depo: OgrenilenDeposu;
  private _simdi: () => number;
  private _kayitlar: OgrenilenKayit[];
  private _sonKullanim: { soz: string; t: number } | null = null;

  constructor(ayar: { depo: OgrenilenDeposu; simdi?: () => number }) {
    this._depo = ayar.depo;
    this._simdi = ayar.simdi ?? Date.now;
    this._kayitlar = ayar.depo.oku();
  }

  /** Şu anki kayıtlar (kopya; G penceresi listeler). */
  liste(): OgrenilenKayit[] { return structuredClone(this._kayitlar); }

  /** Pay (başarı / toplam). */
  static pay(k: Pick<OgrenilenKayit, "basari" | "hata">): number {
    const t = k.basari + k.hata;
    return t === 0 ? 0 : k.basari / t;
  }
  static askidaMi(k: OgrenilenKayit): boolean { return OrtamSozlugu.pay(k) < ASKI_PAYI; }

  private _yaz(): void { this._depo.yaz(this._kayitlar); }

  /**
   * LLM'in BAŞARIYLA yaptığı ortam komutlarını söze bağlar. Çağıran koşulları doğrulamış olmalı (tek kesin söz, yalnız
   * ortam niyetleri, hepsi `bitti`); burada ek olarak söz/komut uygunluğuna bakılır.
   */
  ogren(ham: string, komutlar: readonly OrtamNiyeti[]): OgrenmeSonucu {
    const soz = sozuNormalle(ham);
    if (!soz || soz.length > SOZ_SINIRI) return "reddedildi";
    // `sifirla` öğrenilmez: kullanımı kendi olumsuz sinyalini (sifirlandi) tetiklerdi.
    if (komutlar.length === 0 || komutlar.length > KOMUT_SINIRI || komutlar.some((k) => k.tur !== "ortam" || k.ne === "sifirla")) return "reddedildi";
    if (komutCoz(ham)) return "reddedildi";   // yerleşik sözlük zaten biliyor (ya da beden komutu): tekrar yok
    const var_ = this._kayitlar.find((k) => k.soz === soz);
    const t = this._simdi();
    if (var_) {
      var_.komutlar = structuredClone([...komutlar]);
      var_.ham = ham;
      var_.basari++;
      var_.t = t;
      this._yaz();
      return "guncellendi";
    }
    this._kayitlar.push({ soz, ham, komutlar: structuredClone([...komutlar]), basari: 1, hata: 0, t });
    if (this._kayitlar.length > OGRENILEN_SINIRI) {
      this._kayitlar.sort((a, b) => a.t - b.t);
      this._kayitlar.splice(0, this._kayitlar.length - OGRENILEN_SINIRI);
    }
    this._yaz();
    return "yeni";
  }

  /** Söz öğrenilmiş ve askıda değilse programı döner (ve "az önce kullanıldı" diye işaretler); yoksa null. */
  esle(ham: string): KomutEslesmesi | null {
    const soz = sozuNormalle(ham);
    const k = soz ? this._kayitlar.find((x) => x.soz === soz) : undefined;
    if (!k || OrtamSozlugu.askidaMi(k)) return null;
    k.basari++;
    k.t = this._simdi();
    this._sonKullanim = { soz, t: k.t };
    this._yaz();
    return { program: "komut:ortam-ogrenilen", adimlar: structuredClone(k.komutlar) };
  }

  /**
   * "Sıfırla" geldi: son kullanımdan beri GERI_ALMA_MS geçmediyse o kayıt yanlış çıkmış sayılır (başarı payı düşer,
   * kullanımda eklenen başarı geri alınır). Başka zamanlarda sıfırlama kayda dokunmaz.
   */
  sifirlandi(): void {
    const s = this._sonKullanim;
    this._sonKullanim = null;
    if (!s || this._simdi() - s.t > GERI_ALMA_MS) return;
    const k = this._kayitlar.find((x) => x.soz === s.soz);
    if (!k) return;
    k.basari = Math.max(0, k.basari - 1);
    k.hata++;
    this._yaz();
  }

  /** Ozyn bir kaydı siler (normalleşmiş sözle). */
  sil(soz: string): boolean {
    const n = this._kayitlar.length;
    this._kayitlar = this._kayitlar.filter((k) => k.soz !== soz);
    if (this._kayitlar.length === n) return false;
    this._yaz();
    return true;
  }

  temizle(): void {
    this._kayitlar = [];
    this._sonKullanim = null;
    this._yaz();
  }
}
