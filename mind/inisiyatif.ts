// mind/inisiyatif.ts — Orion'un KENDİ gündemi: güç bütçesi + fayda kararı.
//
// NEYİ ÇÖZÜYOR. Orion bugüne kadar yalnızca TEPKİ veriyordu: Ozyn konuşunca,
// terminal hata verince, bir olay olunca düşünüyordu. Boşta ise `ajanda.ts`
// zamanlayıcıyla rastgele bir yere bakıyordu — heykel gibi durmasın diye,
// hiçbir duruma bakmadan. "Kendi gündemi" yoktu (spec 06 K1: önce sadakat).
//
// İŞ BÖLÜMÜ — bilinçli:
//   Bu dosya NE ZAMAN'a karar verir: beyne kendiliğinden düşünme fırsatı
//     verilmeli mi? (oyun yapay zekâsındaki fayda puanlaması / utility AI)
//   NE yapılacağına BEYİN karar verir: konuşmak, bakmak, tahtaya yazmak ya da
//     susmak. Eylem seçimini yine sadakati ölçülmüş olan yapıyor.
//
// BİLEREK YOK — "merak" (boştayken `sor(onumde)` ile bakma): `sor`'un cevabı
// `gordum` olarak döner ve refleks onu HER ZAMAN beyne terfi ettirir ("beyin
// cevabı kendisi istedi"). Yani "ucuz yerel bakış" her seferinde bir LLM
// çağrısı olurdu. Doğru çözüm protokole bir köken alanı eklemek — ayrı iş.
//
// MALİYET TAVANI. `tik` yasağının inisiyatif karşılığı test ediliyor:
// 1 saat boşta en fazla 4 uyanma. Bir eşik hatası sessizce saatte binlerce
// LLM çağrısına dönüşebilirdi.
//
// SAF: bağımlılık yalnızca protokol künyesi.
"use strict";
import { BEDEN } from "../protocol/bedenTanimi.ts";
import type { Algi } from "../protocol/algi.ts";

/** Hareket de düşünce de aynı bataryadan harcar (künye: `BEDEN.guc`). */
export class GucButcesi {
  private _seviye = 1;

  /**
   * Her tik. `hiz` (m/s) gövdenin GERÇEK hızı — Faz 2'den beri komut
   * edilen değil, gerçekleşen. Hareket halindeyken dolmaz.
   */
  tikle(dt: number, hiz: number): void {
    if (hiz > 0.05) this._seviye -= hiz * dt * BEDEN.guc.hareketMaliyeti;
    else this._seviye += dt * BEDEN.guc.dinlenmeHizi;
    this._kis();
  }

  /** Bir beyin turu tamamlandı. */
  dusundu(): void {
    this._seviye -= BEDEN.guc.dusunceMaliyeti;
    this._kis();
  }

  get seviye(): number { return this._seviye; }

  private _kis(): void {
    if (this._seviye < 0) this._seviye = 0;
    else if (this._seviye > 1) this._seviye = 1;
  }
}

/** Kararın okuduğu anlık durum. Tamamı çağıranın elinde — saf ve test edilebilir. */
export interface InisiyatifDurumu {
  simdiMs: number;
  /** Beyin düşünüyor ya da gövde bir iş yürütüyor. */
  mesgul: boolean;
  /** Ozyn monitörde çalışıyor — odak işi, bölünmez. */
  ozynMonitorde: boolean;
  ozynOdada: boolean;
  /** Ozyn en son ne kadar önce konuştu (hiç konuşmadıysa açılıştan beri). */
  sessizlikMs: number;
  /** Güç seviyesi 0..1. */
  guc: number;
  /**
   * Ozyn'in SON GİRDİSİNİN (tuş, fare, söz, terminal) yaşı. VARLIK budur, mesafe değil (Orion Beyin Ofisi T2-K2):
   * karakter odada dururken Ozyn saatlerce yoktu ve 12 Ekim'de 70 uyanışın 69'u böyle geçti. Verilmezse varlık
   * denetlenmez (eski davranış, yalnız geriye dönük testler için).
   */
  girdiYasiMs?: number;
  /** Ozyn'in göremediği, hatırlatılmaya değer bir iş (zaman aşımına uğrayan öneri). Yoksa null. */
  acikIs?: { ozet: string; yasMs: number; anahtar: string } | null;
}

/** Varlık penceresi: son girdi bundan eskiyse Ozyn "burada" sayılmaz ve kendiliğinden uyanılmaz. */
export const VARLIK_MS = 10 * 60_000;
/** Açık iş en az bu kadar bekledikten sonra hatırlatılır (Ozyn karar vermedi; yaş = zaman aşımından beri). */
export const ACIK_IS_BEKLEME_MS = 2 * 60_000;

export interface InisiyatifAyari {
  /** Bu kadar sessizlik olmadan söze girilmez. Tel de olabilir. */
  sessizlikEsigiMs?: number | (() => number);
  /** Bir kez söze girdikten sonra bu süre geçmeden bir daha girilmez. */
  refrakterMs?: number | (() => number);
  /** Güç bunun altındaysa söze girilmez. */
  gucEsigi?: number;
  /** Harcama tavanları ve devre kesici (varsayılanlar `UyanisButcesi`). */
  butce?: ButceAyari;
}

export type UyanmaNedeni = "acik_is" | "sessizlik";

export interface InisiyatifKarari {
  tur: "soze_gir";
  /** Neden uyanılıyor: bir açık iş ya da (ikincil) uzun sessizlik. */
  neden: UyanmaNedeni;
  /** Sessizlik, tam dakika — beyne bu söylenir. */
  dakika: number;
  /** 0..1 — günlük ve zihin duvarı için. Eşik kararı yukarıda verildi. */
  fayda: number;
  /** `acik_is` için: hatırlatılacak işin özeti ve anahtarı (aynı iş bir kez hatırlatılır). */
  acikIs?: { ozet: string; yasMs: number; anahtar: string };
}

/** Kendiliğinden uyanışların harcama tavanı. BİRİM: uyanış sayısı değil model-saniye ve token (T2-K5). */
export interface ButceAyari {
  saatlikUyanma?: number;
  saatlikModelMs?: number;
  saatlikToken?: number;
  gunlukToken?: number;
  /** Üst üste bu kadar BOŞ uyanıştan sonra devre kesilir. */
  devreBosSayisi?: number;
  devreMs?: number;
}

/**
 * Kendiliğinden uyanışların bütçesi ve devre kesicisi. SAF: zaman dışarıdan. Başarısız çağrı da düşer (hata
 * alan bir model sonsuz yeniden denemeye dönüşmesin). Pencere kayan: son 60 dk ve son 24 saat.
 */
export class UyanisButcesi {
  private _kayit: { t: number; sureMs: number; token: number }[] = [];
  private _bos = 0;
  private _kesikBitis = -Infinity;
  private _a: Required<ButceAyari>;

  constructor(ayar: ButceAyari = {}) {
    this._a = {
      saatlikUyanma: ayar.saatlikUyanma ?? 4, saatlikModelMs: ayar.saatlikModelMs ?? 20_000,
      saatlikToken: ayar.saatlikToken ?? 12_000, gunlukToken: ayar.gunlukToken ?? 60_000,
      devreBosSayisi: ayar.devreBosSayisi ?? 2, devreMs: ayar.devreMs ?? 30 * 60_000,
    };
  }

  /** Bir kendiliğinden uyanış BİTTİ: gerçek süre ve token (bilinmiyorsa 0), eylem/söz üretti mi. */
  sonuc(t: number, sureMs: number, token: number | undefined, eylemli: boolean): void {
    this._kayit.push({ t, sureMs, token: token ?? 0 });
    this._kayit = this._kayit.filter((k) => t - k.t <= 24 * 3600_000);
    this._bos = eylemli ? 0 : this._bos + 1;
    if (this._bos >= this._a.devreBosSayisi) { this._kesikBitis = t + this._a.devreMs; this._bos = 0; }
  }

  /** Panel için salt-okur özet: son 60 dk uyanış ve token, son 24 saat token, şu anki izin. */
  ozet(t: number): { saatlikUyanma: number; saatlikToken: number; gunlukToken: number; izin: ReturnType<UyanisButcesi["izin"]> } {
    const saat = this._kayit.filter((k) => t - k.t <= 3600_000);
    return {
      saatlikUyanma: saat.length,
      saatlikToken: saat.reduce((s, k) => s + k.token, 0),
      gunlukToken: this._kayit.filter((k) => t - k.t <= 24 * 3600_000).reduce((s, k) => s + k.token, 0),
      izin: this.izin(t),
    };
  }

  /** Şimdi bir kendiliğinden uyanışa izin var mı; yoksa nedeni (günlük/panel için). */
  izin(t: number): { acik: true } | { acik: false; sebep: string } {
    if (t < this._kesikBitis) return { acik: false, sebep: "devre_kesici" };
    const saat = this._kayit.filter((k) => t - k.t <= 3600_000);
    if (saat.length >= this._a.saatlikUyanma) return { acik: false, sebep: "saatlik_uyanma" };
    if (saat.reduce((s, k) => s + k.sureMs, 0) >= this._a.saatlikModelMs) return { acik: false, sebep: "saatlik_model_suresi" };
    if (saat.reduce((s, k) => s + k.token, 0) >= this._a.saatlikToken) return { acik: false, sebep: "saatlik_token" };
    if (this._kayit.reduce((s, k) => s + k.token, 0) >= this._a.gunlukToken) return { acik: false, sebep: "gunluk_token" };
    return { acik: true };
  }
}

/** Zihin duvarının canlı satırı için kısa metin; son bir saatte uyanış yoksa ve kapı açıksa null (gürültü olmasın). */
export function butceSatiri(o: ReturnType<UyanisButcesi["ozet"]>): string | null {
  if (!o.izin.acik) return `kendiliğinden kapalı (${o.izin.sebep.replace(/_/g, " ")})`;
  if (o.saatlikUyanma === 0) return null;
  return `kendiliğinden ${o.saatlikUyanma}/sa · ${(o.saatlikToken / 1000).toFixed(1).replace(".", ",")}k token`;
}

/**
 * Kararın beyne giden OLAY algısı — metnin TEK kaynağı (ölçüm aracı `tools/f0-olc.ts` de buradan türetir).
 *
 * Köken ve neden YAPISAL alanda (`ayrinti.kaynak`, `neden`, `derinlik`): köprü özerk turu ve susma ilanını buna göre
 * kurar; metinden tahmin etmek önek eşleştirmesinin kaymasıyla aynı hata olurdu. Çerçeve İngilizce (spec 06 §6.8).
 *
 * Metinde "emin değilsen bak" ya da "hâlâ önemliyse" gibi KAÇIŞ KAPISI yok: H3'ün ilk koşusunda Haiku bunlarla 0/4
 * kaldı (vault kanit/h3-ozerk.json). "Susacağını söyleme" diye uzatmak ölçümde bir şey değiştirmedi (3/10 → 3/10).
 */
export function inisiyatifOlayi(k: Pick<InisiyatifKarari, "neden" | "dakika" | "acikIs">, sessizlikMs: number): Extract<Algi, { tur: "olay" }> {
  const sure = k.dakika >= 1 ? `${k.dakika} minutes` : `${Math.round(sessizlikMs / 1000)} seconds`;
  const is = k.neden === "acik_is" ? k.acikIs : undefined;
  const ad = is
    ? `you proposed ${is.ozet} ${Math.max(1, Math.round(is.yasMs / 60_000))} minutes ago and Ozyn did not decide in time — `
      + "this is your own initiative: remind Ozyn once, in one short sentence"
    : `nobody has spoken for ${sure} — this is your own initiative: say something only if it is useful, otherwise stay silent`;
  return { tur: "olay", ad, ayrinti: { kaynak: "inisiyatif", neden: k.neden, derinlik: 0 } };
}

/**
 * Kapı. "Bu açık iş hatırlatıldı mı" bilgisini TUTMAZ: listenin sahibi köprü (`Kopru.acikIs/acikIsAnildi`). İki
 * kopya ayrışınca köprü en eski işi vermeye devam eder, kapı onu reddeder ve daha yeni işler hiç hatırlatılamazdı.
 */
export class Inisiyatif {
  private _esik: () => number;
  private _refrakter: () => number;
  private _gucEsigi: number;
  private _sonKararMs = -Infinity;
  /** Kendiliğinden uyanışların bütçesi: köprü her uyanış bitince `butce.sonuc` ile besler. */
  readonly butce: UyanisButcesi;

  constructor(ayar: InisiyatifAyari = {}) {
    this.butce = new UyanisButcesi(ayar.butce);
    const tel = (a: number | (() => number) | undefined, v: number) =>
      a === undefined ? () => v : typeof a === "function" ? a : () => a;
    this._esik = tel(ayar.sessizlikEsigiMs, 10 * 60_000);
    this._refrakter = tel(ayar.refrakterMs, 15 * 60_000);
    this._gucEsigi = ayar.gucEsigi ?? 0.5;
  }

  karar(d: InisiyatifDurumu): InisiyatifKarari | null {
    // KAPILAR — biri kapalıysa fayda hesaplanmaz bile.
    if (d.mesgul) return null;                 // ikinci tur yok
    if (d.ozynMonitorde) return null;          // odak işi bölünmez
    if (!d.ozynOdada) return null;             // kime konuşsun
    if (d.guc < this._gucEsigi) return null;   // bütçe süs değil
    // VARLIK: son girdi yaşı (T2-K2). Girdi yoksa Ozyn burada değildir: kendiliğinden uyanma YOK (0 token).
    if (d.girdiYasiMs !== undefined && d.girdiYasiMs > VARLIK_MS) return null;
    if (d.simdiMs - this._sonKararMs < this._refrakter()) return null;
    if (!this.butce.izin(d.simdiMs).acik) return null;   // model-saniye / token / devre kesici

    // NEDEN 1 — açık iş: Ozyn'in göremediği bir öneri (bir kez hatırlatılması köprünün listesinde tutulur).
    const is = d.acikIs;
    if (is && is.yasMs >= ACIK_IS_BEKLEME_MS) {
      this._sonKararMs = d.simdiMs;
      return { tur: "soze_gir", neden: "acik_is", dakika: Math.floor(is.yasMs / 60_000), fayda: d.guc, acikIs: is };
    }

    // NEDEN 2 — uzun sessizlik (ikincil; yalnız varlık varken).
    const esik = this._esik();
    if (d.sessizlikMs < esik) return null;

    // FAYDA: sessizlik uzadıkça artar (eşiğin iki katında doyar), güçle ölçeklenir.
    const fayda = Math.min(1, d.sessizlikMs / (2 * esik)) * d.guc;
    this._sonKararMs = d.simdiMs;
    return { tur: "soze_gir", neden: "sessizlik", dakika: Math.floor(d.sessizlikMs / 60_000), fayda };
  }

  /** Zihin duvarı / günlük için. */
  get sessizlikEsigiMs(): number { return this._esik(); }
  get refrakterMs(): number { return this._refrakter(); }
}
