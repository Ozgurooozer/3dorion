// world/level/editor/cekirdek/durum.ts — Editör durumu: tanım, seçim, araç, ayarlar, geçmiş, kirli işareti. Saf.
//
// TEK DOĞRULUK KAYNAĞI level tanımıdır; bu nesne onu değiştirmenin TEK yoludur: her kalıcı düzenleme
// `degistir(f, mesaj)` → uygulayıcı (`level.ayarla`; hata fırlatırsa hiçbir şey değişmez) → geçmiş → olay.
// Arayüz parçaları (araç çubuğu, sahne ağacı, özellikler, panel) birbirini bilmez; yalnız buna abone olur.
//
// Geçmiş tanımla BİRLİKTE seçimi de saklar: silmeyi geri alınca silinen nesneler yeniden seçili gelir.
// Sürükleme gibi canlı önizlemeler `onizle` ile uygulanır (geçmişe girmez); bırakınca `degistir` ve
// `onceki` verilir (geri al sürüklemenin başına döner).
"use strict";
import type { LevelTanimi } from "../../cekirdek/levelTanimi.ts";
import { gecmisKur } from "./gecmis.ts";
import { secimiTemizle } from "./secim.ts";
import { YASLAMA_VARSAYILAN, type YaslamaAyari } from "./yaslama.ts";

export type AracAdi = "sec" | "tasi" | "dondur" | "olcek" | "kutu" | "firca" | "arazi";
export const ARACLAR: readonly AracAdi[] = ["sec", "tasi", "dondur", "olcek", "kutu", "firca", "arazi"];

export interface EditorAyarlari {
  /** Gizmo ekseni: dünya ya da nesnenin kendi ekseni. */
  uzay: "dunya" | "yerel";
  yaslama: YaslamaAyari;
  /** Sağ tık uçuş hızı (m/kare çarpanı). */
  kameraHizi: number;
  izgara: boolean;
}

export const AYAR_VARSAYILAN: EditorAyarlari = { uzay: "dunya", yaslama: YASLAMA_VARSAYILAN, kameraHizi: 1, izgara: true };

/** Geri al ile saklanan hâl. */
export interface Hal { tanim: LevelTanimi; secim: string[] }

export type OlayAdi = "tanim" | "secim" | "arac" | "ayarlar" | "kirli" | "mesaj" | "gecmis" | "kip";

/** Editör: fare serbest, araçlar, arayüz açık. Uçuş: fare kilitli serbest uçuş, arayüz gizli (Tab). */
export type Kip = "editor" | "ucus";

export interface Uygulayici {
  /** Kurulu tanım (normalleştirilmiş: kimlikler dolu). */
  oku(): LevelTanimi;
  /** Tanımı sahneye uygular; geçersizse FIRLATIR ve eskisi kalır (levelKur `ayarla`). */
  uygula(t: LevelTanimi): void;
}

export interface DegisiklikSecenegi {
  /** Aynı anahtarlı ardışık değişiklikler tek geri al adımı (gecmis.ts). */
  anahtar?: string;
  /** Değişiklikten sonra seçim (yeni eklenenler gibi). Verilmezse eski seçim (temizlenmiş). */
  secim?: readonly string[];
  /** Geçmişe "önceki" olarak bu yazılır (canlı önizlemeden sonra: sürüklemenin başı). */
  onceki?: Hal;
}

export interface EditorDurumu {
  tanim(): LevelTanimi;
  /** Kalıcı değişiklik. Değişiklik yoksa ya da uygulanamazsa false (hata `mesaj` olayıyla bildirilir). */
  degistir(f: (t: LevelTanimi) => LevelTanimi, mesaj: string, s?: DegisiklikSecenegi): boolean;
  /** Geçmişe girmeyen canlı uygulama (sürgü sürüklerken). */
  onizle(t: LevelTanimi): boolean;
  /** Şu anki hâl (seçimle) — canlı önizleme başlarken saklanır. */
  hal(): Hal;
  geriAl(): boolean;
  ileriAl(): boolean;
  gecmisSayisi(): { geri: number; ileri: number; mesajlar: string[] };
  secim(): readonly string[];
  secimAyarla(idler: readonly string[]): void;
  arac(): AracAdi;
  aracSec(a: AracAdi): void;
  kip(): Kip;
  kipAyarla(k: Kip): void;
  ayarlar(): EditorAyarlari;
  ayarDegistir(f: (a: EditorAyarlari) => EditorAyarlari): void;
  kirli(): boolean;
  /** Kayıt başarılı: şu anki tanım "kaydedilmiş" olur. */
  kaydedildi(): void;
  /** Durum çubuğu mesajı (hata ise kırmızı). */
  bildir(metin: string, hata?: boolean): void;
  sonMesaj(): { metin: string; hata: boolean };
  abone(olay: OlayAdi, f: () => void): () => void;
  /** Dosyadan yükleme gibi dış değişiklikten sonra: tanımı uygulayıcıdan yeniden oku. */
  yenidenOku(): void;
}

const imza = (t: LevelTanimi) => JSON.stringify(t);

export function editorDurumuKur(u: Uygulayici, ayar: EditorAyarlari = AYAR_VARSAYILAN, gecmisSiniri = 200): EditorDurumu {
  let tanim = u.oku();
  let secim: string[] = [];
  let arac: AracAdi = "sec";
  let kip: Kip = "editor";
  let ayarlar = ayar;
  let kayitli = imza(tanim);
  let kirliMi = false;
  let mesaj = { metin: "", hata: false };
  const gecmis = gecmisKur<Hal>(gecmisSiniri);
  const dinleyiciler = new Map<OlayAdi, Set<() => void>>();

  const yay = (...olaylar: OlayAdi[]) => { for (const o of olaylar) for (const f of dinleyiciler.get(o) ?? []) f(); };
  const kirliGuncelle = () => {
    const k = imza(tanim) !== kayitli;
    if (k !== kirliMi) { kirliMi = k; yay("kirli"); }
  };
  const bildir = (metin: string, hata = false) => { mesaj = { metin, hata }; yay("mesaj"); };
  const secimDegistir = (yeni: readonly string[]) => {
    const temiz = secimiTemizle(tanim, yeni);
    if (temiz.length === secim.length && temiz.every((id, i) => id === secim[i])) return false;
    secim = temiz;
    return true;
  };
  /** Uygular; başarılıysa tanımı kurulu hâlden okur. */
  const uygula = (t: LevelTanimi): boolean => {
    try { u.uygula(t); } catch (err) { bildir(err instanceof Error ? err.message : String(err), true); return false; }
    tanim = u.oku();
    return true;
  };
  const haleDon = (h: Hal, mesajMetni: string) => {
    if (!uygula(h.tanim)) return false;
    const secimOynadi = secimDegistir(h.secim);
    yay("tanim", "gecmis");
    if (secimOynadi) yay("secim");
    kirliGuncelle();
    bildir(mesajMetni);
    return true;
  };

  return {
    tanim: () => tanim,
    degistir(f, mesajMetni, s = {}) {
      const once: Hal = s.onceki ?? { tanim, secim: [...secim] };
      let yeni: LevelTanimi;
      try { yeni = f(tanim); } catch (err) { bildir(err instanceof Error ? err.message : String(err), true); return false; }
      if (yeni === tanim && !s.onceki) return false;
      if (!s.onceki && imza(yeni) === imza(tanim)) return false;
      if (s.onceki && imza(yeni) === imza(s.onceki.tanim)) {
        // Önizleme başladığı yere döndü (sürüklenip geri bırakıldı): sahne eski hâle, geçmişe adım yok.
        if (imza(yeni) !== imza(tanim) && uygula(yeni)) { yay("tanim"); kirliGuncelle(); }
        return false;
      }
      if (!uygula(yeni)) return false;
      gecmis.ekle(once, mesajMetni, s.anahtar ? { anahtar: s.anahtar } : {});
      const secimOynadi = secimDegistir(s.secim ?? secim);
      yay("tanim", "gecmis");
      if (secimOynadi) yay("secim");
      kirliGuncelle();
      bildir(mesajMetni);
      return true;
    },
    onizle(t) {
      if (!uygula(t)) return false;
      yay("tanim");
      kirliGuncelle();
      return true;
    },
    hal: () => ({ tanim, secim: [...secim] }),
    geriAl() {
      const a = gecmis.geriAl({ tanim, secim: [...secim] });
      if (!a) { bildir("geri alınacak adım yok"); return false; }
      return haleDon(a.hal, `geri alındı: ${a.mesaj}`);
    },
    ileriAl() {
      const a = gecmis.ileriAl({ tanim, secim: [...secim] });
      if (!a) { bildir("ileri alınacak adım yok"); return false; }
      return haleDon(a.hal, `ileri alındı: ${a.mesaj}`);
    },
    gecmisSayisi: () => ({ geri: gecmis.geriSayisi(), ileri: gecmis.ileriSayisi(), mesajlar: gecmis.mesajlar() }),
    secim: () => secim,
    secimAyarla(idler) { if (secimDegistir(idler)) yay("secim"); },
    arac: () => arac,
    aracSec(a) { if (a !== arac) { arac = a; yay("arac"); } },
    kip: () => kip,
    kipAyarla(k) { if (k !== kip) { kip = k; yay("kip"); } },
    ayarlar: () => ayarlar,
    ayarDegistir(f) { ayarlar = f(ayarlar); yay("ayarlar"); },
    kirli: () => kirliMi,
    kaydedildi() { kayitli = imza(tanim); kirliGuncelle(); },
    bildir,
    sonMesaj: () => mesaj,
    abone(olay, f) {
      let s = dinleyiciler.get(olay);
      if (!s) { s = new Set(); dinleyiciler.set(olay, s); }
      s.add(f);
      return () => { s.delete(f); };
    },
    yenidenOku() {
      tanim = u.oku();
      const secimOynadi = secimDegistir(secim);
      yay("tanim");
      if (secimOynadi) yay("secim");
      kirliGuncelle();
    },
  };
}
