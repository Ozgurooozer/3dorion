// uygulama/aktor/calisma/aktorGunlugu.ts — AKTÖR ALTYAPISININ GÜNLÜĞÜ + BAYRAKLARI (spec 45 §13). SAF: DOM, depolama, Babylon YOK; zaman dışarıdan.
//
// Üç iş: (1) halka belleğe YAPISAL kayıt (seviye, kategori, kod, aktör, tekrar) — "neyin çalıştığını, neyin hata verdiğini" sonradan okumak için;
// (2) AYNI hata tekrar tekrar gelince (kare başına) günlüğü SEL basmasın: ardışık aynı kayıt `tekrar` sayacını artırır, çıkışa yalnız ilk kez ve 10/100/1000… katlarında gider;
// (3) BAYRAKLAR: kategori başına AYRINTILI iz (bilgi/iyi kayıtlar ancak açıksa tutulur; uyarı/hata HER ZAMAN) ve bileşen başına KAPATMA (hata kaynağını ayırmak için:
// tetiği kapat, hareket sürsün). Bayrak dizgesi `olay,tetik,-hareket` (URL `?aktor=` ya da çalışırken `aktorDebug.bayrak`).
// Çıkış (`cikis`) enjekte edilir: konsol + Ozyn'in günlük paneli kompozisyon kökünde (giris.ts) bağlanır.
"use strict";
import { kodAciklamasi, kodOku, type AktorKodu } from "../../../world/level/cekirdek/aktorHatalari.ts";

export type GunlukSeviyesi = "bilgi" | "iyi" | "uyari" | "hata";
export const KATEGORILER = ["olay", "tetik", "hareket", "bag", "dugum", "zaman", "sablon"] as const;
export type GunlukKategorisi = (typeof KATEGORILER)[number];
/** Kapatılabilir bileşenler (hata kaynağını ayırmak için). */
export const KAPATILABILIRLER = ["tetik", "hareket", "bag"] as const;
export type Kapatilabilir = (typeof KAPATILABILIRLER)[number];

/** Halka belleğin boyu; dolunca en eski kayıt düşer. */
export const GUNLUK_KAPASITESI = 200;

export interface GunlukKaydi {
  readonly sira: number;
  /** Günlüğün saati (sn; çalışma zamanının biriken zamanı). */
  readonly t: number;
  readonly seviye: GunlukSeviyesi;
  readonly kategori: GunlukKategorisi;
  readonly kod: AktorKodu | null;
  readonly aktor: string | null;
  readonly metin: string;
  /** Ardışık aynı kayıt sayısı (ilk kayıt = 1). */
  tekrar: number;
}

export interface BayrakOkuma {
  readonly ayrintili: ReadonlySet<GunlukKategorisi>;
  readonly kapali: ReadonlySet<Kapatilabilir>;
  /** Tanınmayan adlar (çağıran AKT-BYR-001 ile bildirir). */
  readonly bilinmeyen: readonly string[];
}

/**
 * `olay,tetik,-hareket` → ayrıntılı: olay, tetik; kapalı: hareket. `hepsi` bütün kategorileri ayrıntılı yapar. Boşluklara ve büyük/küçük harfe bakılmaz.
 * `-ad` yalnız KAPATILABİLİR bileşenlerde geçerli (`-olay` anlamsız → bilinmeyen).
 */
export function bayraklariOku(metin: string | null | undefined): BayrakOkuma {
  const ayrintili = new Set<GunlukKategorisi>(), kapali = new Set<Kapatilabilir>(), bilinmeyen: string[] = [];
  for (const ham of (metin ?? "").split(",")) {
    const a = ham.trim().toLowerCase();
    if (!a) continue;
    if (a === "hepsi") { for (const k of KATEGORILER) ayrintili.add(k); continue; }
    if (a.startsWith("-")) {
      const b = a.slice(1) as Kapatilabilir;
      if (KAPATILABILIRLER.includes(b)) kapali.add(b); else bilinmeyen.push(a);
      continue;
    }
    if ((KATEGORILER as readonly string[]).includes(a)) ayrintili.add(a as GunlukKategorisi); else bilinmeyen.push(a);
  }
  return { ayrintili, kapali, bilinmeyen };
}

/**
 * Bayrak dizgesini günlüğe UYGULAR: önce bütün bayraklar sıfırlanır (eski `olay` açık kalmaz), sonra dizgedekiler kurulur. Tanınmayan adlar `AKT-BYR-001` uyarısıdır
 * (sessiz yutulmaz); döndürülen okuma çağıranın raporu içindir.
 */
export function bayraklariUygula(g: AktorGunlugu, metin: string): BayrakOkuma {
  const o = bayraklariOku(metin);
  for (const k of KATEGORILER) g.ayrintili(k, o.ayrintili.has(k));
  for (const b of KAPATILABILIRLER) g.kapat(b, o.kapali.has(b));
  for (const b of o.bilinmeyen) g.uyari("zaman", "AKT-BYR-001", `tanınmayan bayrak '${b}' (geçerli: ${GECERLI_BAYRAKLAR})`);
  return o;
}
/** Hata iletisinde gösterilen geçerli bayraklar (tek kaynak: kategoriler + kapatma + hepsi). */
export const GECERLI_BAYRAKLAR = `${[...KATEGORILER, "hepsi"].join(",")}; kapatma ${KAPATILABILIRLER.map((b) => `-${b}`).join("/")}`;

export interface GunlukAyari {
  /** Günlüğün saati (sn). Verilmezse 0 (testte sabit). */
  simdi?: () => number;
  /** Bir kayıt ÇIKIŞA gider (ilk kez ve 10/100/1000… tekrarda): konsol ve günlük paneli. */
  cikis?: (k: GunlukKaydi) => void;
  kapasite?: number;
  /** Başlangıç bayrakları (`bayraklariOku` çıktısı). */
  bayrak?: Pick<BayrakOkuma, "ayrintili" | "kapali">;
}

export interface AktorGunlugu {
  /**
   * Kayıt: uyarı/hata HER ZAMAN tutulur, bilgi/iyi yalnız kategorinin AYRINTILI bayrağı açıksa. Kod verilmezse metinden okunur.
   * `herZaman`: DURUM DEĞİŞİMİ kaydı (örn. "uyarı çözüldü", "bileşen yeniden açıldı") bayraktan bağımsız tutulur: seyrektir ve bir uyarının sonunu söyler.
   */
  yaz(seviye: GunlukSeviyesi, kategori: GunlukKategorisi, metin: string, ek?: { kod?: AktorKodu | null; aktor?: string; herZaman?: boolean }): void;
  /** Kodlu hata/uyarı kısayolu: kategori kodun alanından değil çağırandan; metin `[KOD] ayrıntı` biçiminde değilse kod başa eklenmez, kayıtta ayrı tutulur. */
  hata(kategori: GunlukKategorisi, kod: AktorKodu, ayrinti: string, aktor?: string): void;
  uyari(kategori: GunlukKategorisi, kod: AktorKodu, ayrinti: string, aktor?: string): void;
  /** Son n kayıt (eskiden yeniye); `seviye`/`kategori`/`kod` süzgeçleri isteğe bağlı. */
  son(n?: number, suzgec?: { seviye?: GunlukSeviyesi; kategori?: GunlukKategorisi; kod?: AktorKodu }): readonly GunlukKaydi[];
  /** Kod başına toplam (tekrarlar dahil) ve seviye başına toplam; halka belleğin dışına düşenler de sayılır. */
  sayim(): { kodlar: Readonly<Record<string, number>>; seviyeler: Readonly<Record<GunlukSeviyesi, number>> };
  /** Kategori için ayrıntılı iz aç/kapat. */
  ayrintili(kategori: GunlukKategorisi, acik: boolean): void;
  /** Bileşeni kapat/aç (hata kaynağını ayırmak için). */
  kapat(bilesen: Kapatilabilir, kapali: boolean): void;
  kapaliMi(bilesen: Kapatilabilir): boolean;
  bayraklar(): { ayrintili: readonly GunlukKategorisi[]; kapali: readonly Kapatilabilir[] };
  temizle(): void;
}

export function aktorGunluguKur(a: GunlukAyari = {}): AktorGunlugu {
  const simdi = a.simdi ?? (() => 0);
  const kapasite = a.kapasite ?? GUNLUK_KAPASITESI;
  const ayrinti = new Set<GunlukKategorisi>(a.bayrak?.ayrintili ?? []);
  const kapali = new Set<Kapatilabilir>(a.bayrak?.kapali ?? []);
  let kayitlar: GunlukKaydi[] = [];
  let sira = 0;
  const kodSayim: Record<string, number> = {};
  const seviyeSayim: Record<GunlukSeviyesi, number> = { bilgi: 0, iyi: 0, uyari: 0, hata: 0 };

  /** Tekrar sayısı çıkışa 1, 10, 100, 1000… kez gider (gerisi sessiz sayılır): her kareyi yazan sel olmasın. */
  const cikisaGider = (n: number): boolean => { for (let e = 1; e <= n; e *= 10) if (e === n) return true; return false; };

  function yaz(seviye: GunlukSeviyesi, kategori: GunlukKategorisi, metin: string, ek: { kod?: AktorKodu | null; aktor?: string; herZaman?: boolean } = {}): void {
    const onemli = seviye === "uyari" || seviye === "hata" || ek.herZaman === true;
    if (!onemli && !ayrinti.has(kategori)) return;
    const kod = ek.kod === undefined ? kodOku(metin) : ek.kod;
    const aktor = ek.aktor ?? null;
    seviyeSayim[seviye]++;
    if (kod) kodSayim[kod] = (kodSayim[kod] ?? 0) + 1;
    const son = kayitlar[kayitlar.length - 1];
    if (son && son.seviye === seviye && son.kategori === kategori && son.kod === kod && son.aktor === aktor && son.metin === metin) {
      son.tekrar++;
      if (a.cikis && cikisaGider(son.tekrar)) a.cikis(son);
      return;
    }
    const k: GunlukKaydi = { sira: ++sira, t: simdi(), seviye, kategori, kod, aktor, metin, tekrar: 1 };
    kayitlar.push(k);
    if (kayitlar.length > kapasite) kayitlar = kayitlar.slice(kayitlar.length - kapasite);
    a.cikis?.(k);
  }

  return {
    yaz,
    hata: (kategori, kod, ayr, aktor) => yaz("hata", kategori, `[${kod}] ${ayr}`, { kod, ...(aktor ? { aktor } : {}) }),
    uyari: (kategori, kod, ayr, aktor) => yaz("uyari", kategori, `[${kod}] ${ayr}`, { kod, ...(aktor ? { aktor } : {}) }),
    son(n = 50, s = {}) {
      const l = kayitlar.filter((k) => (!s.seviye || k.seviye === s.seviye) && (!s.kategori || k.kategori === s.kategori) && (!s.kod || k.kod === s.kod));
      return l.slice(Math.max(0, l.length - n));
    },
    sayim: () => ({ kodlar: { ...kodSayim }, seviyeler: { ...seviyeSayim } }),
    ayrintili(k, acik) { if (acik) ayrinti.add(k); else ayrinti.delete(k); },
    kapat(b, k) { if (k) kapali.add(b); else kapali.delete(b); },
    kapaliMi: (b) => kapali.has(b),
    bayraklar: () => ({ ayrintili: [...ayrinti], kapali: [...kapali] }),
    temizle() { kayitlar = []; for (const k of Object.keys(kodSayim)) delete kodSayim[k]; for (const s of Object.keys(seviyeSayim) as GunlukSeviyesi[]) seviyeSayim[s] = 0; },
  };
}

/** Bir kaydın tek satırlık okunur hâli (konsol ve günlük paneli): `[SEVİYE] kategori aktör (×N) metin` + hatalarda çözüm önerisi. */
export function gunlukSatiri(k: GunlukKaydi): string {
  const etiket = k.seviye === "hata" ? "HATA" : k.seviye === "uyari" ? "UYARI" : k.seviye === "iyi" ? "OK" : "bilgi";
  const tekrar = k.tekrar > 1 ? ` (×${k.tekrar})` : "";
  const cozum = k.kod && (k.seviye === "hata" || k.seviye === "uyari") && k.tekrar === 1 ? `\n    ↳ ${kodAciklamasi(k.kod)}` : "";
  return `${etiket} ${k.kategori}${k.aktor ? ` [${k.aktor}]` : ""}${tekrar} ${k.metin}${cozum}`;
}

