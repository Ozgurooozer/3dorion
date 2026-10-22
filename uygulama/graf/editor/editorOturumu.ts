// uygulama/graf/editor/editorOturumu.ts — BİR EDİTÖR SEKMESİNİN OTURUMU ve KOMUTLARI (spec 35 dilim 2b). SAF: DOM yok, depo yok.
//
// Sekme = bir grafik + geri al yığını + seçim + tuval görünümü. Komutlar (sil, kopyala/yapıştır, palette'ten ekle, bağ çek, ayar, taşı…) saf işlemleri
// (grafIslemleri.ts, pinBudama.ts, bagKurali.ts) BİRLEŞTİRİR ve her biri TEK geri al adımıdır: "palette'ten ekle + sürüklenen pine bağla" iki ayrı adım
// olsaydı Ctrl+Z yarım bir hâl bırakırdı. Her komut kullanıcıya söylenecek kısa sonucu döner (budanan/değişen bağ, red nedeni): DOM katmanı yalnız gösterir.
// Kaydetme, çalıştırma ve depo bu dosyada YOK (DOM katmanı mevcut grafDeposu / grafCalistirici ile konuşur).
"use strict";
import type { Graf, GrafBagi, GrafDegeri, PinTipi } from "../../../protocol/graf.ts";
import type { Sonuc } from "../../../protocol/dogrula.ts";
import type { DugumKaydi, PinOrtami } from "../dugumKaydi.ts";
import { dugumleriCozYapili, grafTurDenetleYapili, type CozulmusDugum, type DenetimHatasi } from "../grafTurDenetimi.ts";
import { gecmisKur, type Gecmis } from "./gecmis.ts";
import { BASLANGIC_GORUNUMU, type Gorunum, type Nokta } from "./tuvalMatematigi.ts";
import { bagEkle, bagKaldir, dugumEkle, dugumleriSil, dugumleriTasi, konumlariKoy, secimiKopyala, yapistir, type GrafBilgisi, type Pano } from "./grafIslemleri.ts";
import { ayarDegistirVeBuda, grafBilgisiVeBuda, type BudananBag } from "./pinBudama.ts";
import { bagDenetle, uyumluIlkPin, type PinRef } from "./bagKurali.ts";
import { otomatikYerlesim } from "./otomatikYerlesim.ts";

export interface KomutSonucu { ok: boolean; mesaj?: string }

export interface EditorOturumu {
  readonly gecmis: Gecmis<Graf>;
  secim: Set<string>;
  gorunum: Gorunum;
  /** Son denetimin hataları (DOM katmanı tavanlı sıklıkla `denetle` çağırır). */
  hatalar: DenetimHatasi[];
  /** Dosya diskte değişti ya da kalktı (editör dışında: JSON penceresi, Graf sekmesi). */
  dis: null | "degisti" | "silindi";
  graf(): Graf;
  /** Pin ortamı, `buGraf` şimdiki grafik. */
  ortam(): PinOrtami;
  /** Şimdiki grafiğin çözümü (grafik değişmedikçe önbellekten). */
  cozum(): ReadonlyMap<string, CozulmusDugum>;
  /**
   * Önbelleği unut: pinler grafiğin DIŞINDAN da gelir (Desen düğümünün pinleri desen dosyasından, ajan seçenekleri defterden). Başka bir dosya değişince
   * (desenin girişi eklendi) bu sekmenin grafiği aynı kalsa da çözüm bayatlardı.
   */
  cozumuUnut(): void;
  denetle(): DenetimHatasi[];
}

/** Oturum aç: konumu olmayan düğümler otomatik yerleşir (geri al adımı DEĞİL, kirli de değil: konum davranışı etkilemez). */
export function oturumKur(g: Graf, kayit: DugumKaydi<unknown>, ortam: () => PinOrtami): EditorOturumu {
  const yerlesim = otomatikYerlesim(g);
  const ilk = yerlesim.size ? konumlariKoy(g, yerlesim) : g;
  const gecmis = gecmisKur(ilk);
  let onbellek: { g: Graf; cozum: Map<string, CozulmusDugum> } | null = null;
  const o: EditorOturumu = {
    gecmis, secim: new Set(), gorunum: { ...BASLANGIC_GORUNUMU }, hatalar: [], dis: null,
    graf: () => gecmis.simdiki(),
    ortam: () => ({ ...ortam(), buGraf: gecmis.simdiki() }),
    cozum() {
      const g2 = gecmis.simdiki();
      if (onbellek?.g !== g2) onbellek = { g: g2, cozum: dugumleriCozYapili(g2, kayit, o.ortam()).cozum };
      return onbellek.cozum;
    },
    cozumuUnut() { onbellek = null; },
    denetle() { o.hatalar = grafTurDenetleYapili(gecmis.simdiki(), kayit, o.ortam()); return o.hatalar; },
  };
  return o;
}

/** Yeni hâli yığına koy ve seçimden artık olmayan düğümleri çıkar. */
function koy(o: EditorOturumu, g: Graf): void {
  o.gecmis.kaydet(g);
  const idler = new Set(g.dugumler.map((d) => d.id));
  for (const id of [...o.secim]) if (!idler.has(id)) o.secim.delete(id);
}

const budamaNotu = (b: readonly BudananBag[]): string =>
  b.length ? `${b.length} bağ kaldırıldı — ${b.map((x) => x.neden).join("; ")} (Ctrl+Z geri getirir)` : "";

/** Bir işlem sonucunu uygula: hata ise grafik DEĞİŞMEZ, neden döner; budanan bağ varsa söylenir (sessiz kayıp yok). */
export function uygula(o: EditorOturumu, r: Sonuc<{ graf: Graf; budanan?: readonly BudananBag[] }>, basari = ""): KomutSonucu {
  if (!r.ok) return { ok: false, mesaj: r.hata };
  koy(o, r.deger.graf);
  const not = budamaNotu(r.deger.budanan ?? []);
  return { ok: true, mesaj: [basari, not].filter(Boolean).join(" · ") };
}

export const geriAl = (o: EditorOturumu): KomutSonucu => { const g = o.gecmis.geriAl(); if (!g) return { ok: false, mesaj: "geri alınacak bir şey yok" }; koy(o, g); return { ok: true }; };
export const yinele = (o: EditorOturumu): KomutSonucu => { const g = o.gecmis.yinele(); if (!g) return { ok: false, mesaj: "yinelenecek bir şey yok" }; koy(o, g); return { ok: true }; };

/** Seçili düğümleri bağlarıyla sil. */
export function silKomutu(o: EditorOturumu): KomutSonucu {
  if (!o.secim.size) return { ok: false, mesaj: "silinecek seçim yok (düğüme tıkla; Shift ile çoklu)" };
  const n = o.secim.size;
  const r = dugumleriSil(o.graf(), o.secim);
  koy(o, r.graf);
  o.secim.clear();
  return { ok: true, mesaj: `${n} düğüm${r.silinenBag ? ` ve ${r.silinenBag} bağ` : ""} silindi (Ctrl+Z geri getirir)` };
}

export function kopyalaKomutu(o: EditorOturumu): Pano | null {
  return o.secim.size ? secimiKopyala(o.graf(), o.secim) : null;
}

/** Panoyu yapıştır (konum: parçanın sol üstü); yapıştırılanlar seçili olur. */
export function yapistirKomutu(o: EditorOturumu, pano: Pano | null, konum: Nokta): KomutSonucu {
  if (!pano) return { ok: false, mesaj: "pano boş (önce düğüm seç ve Ctrl+C)" };
  const r = yapistir(o.graf(), pano, konum);
  if (!r.ok) return { ok: false, mesaj: r.hata };
  koy(o, r.deger.graf);
  o.secim = new Set(r.deger.idler);
  return { ok: true, mesaj: `${r.deger.idler.length} düğüm yapıştırıldı` };
}

/**
 * Palette'ten (ya da kısayoldan) düğüm EKLE; `pin` verildiyse (boşluğa bırakılan bağ) yeni düğümün ilk uyumlu pinine bağla — ikisi TEK adım.
 * Bağ kurulamazsa düğüm yine eklenir ve neden söylenir (eklemek Ozyn'in isteğiydi; bağı elle çeker).
 */
export function dugumEkleKomutu(o: EditorOturumu, kayit: DugumKaydi<unknown>, oge: { tip: string; ayar: Record<string, GrafDegeri> }, konum: Nokta, pin: (PinRef & { tip: PinTipi }) | null = null): KomutSonucu & { id?: string } {
  const r = dugumEkle(o.graf(), { tip: oge.tip, ayar: oge.ayar, konum });
  if (!r.ok) return { ok: false, mesaj: r.hata };
  let g = r.deger.graf;
  const id = r.deger.id;
  let not = "";
  if (pin) {
    const cozum = dugumleriCozYapili(g, kayit, { ...o.ortam(), buGraf: g }).cozum;
    const yeni = cozum.get(id);
    const hedefPin = yeni ? uyumluIlkPin(yeni.pinler, pin) : null;
    const b = hedefPin ? bagDenetle(g, cozum, pin, { dugum: id, pin: hedefPin, yon: pin.yon === "cikis" ? "giris" : "cikis" }) : null;
    if (b?.ok) {
      const e = bagEkle(g, b.bag, b.degisen);
      if (e.ok) { g = e.deger.graf; if (b.degisen.length) not = `eski bağ değiştirildi (${b.degisen.map((x) => `${x.kaynak.join(".")} → ${x.hedef.join(".")}`).join(", ")})`; }
      else not = `bağlanamadı: ${e.hata}`;
    } else not = `bağlanamadı: ${b && !b.ok ? b.neden : "uyumlu pin yok"}`;
  }
  koy(o, g);
  o.secim = new Set([id]);
  return { ok: true, id, ...(not ? { mesaj: not } : {}) };
}

/** İki pin arasında bağ (sürükle-bırak). Tek-bağ kuralı eski bağı değiştirdiyse söylenir. */
export function bagKomutu(o: EditorOturumu, u1: PinRef, u2: PinRef): KomutSonucu {
  const b = bagDenetle(o.graf(), o.cozum(), u1, u2);
  if (!b.ok) return { ok: false, mesaj: b.neden };
  const r = bagEkle(o.graf(), b.bag, b.degisen);
  if (!r.ok) return { ok: false, mesaj: r.hata };
  koy(o, r.deger.graf);
  return { ok: true, mesaj: b.degisen.length ? `eski bağ değiştirildi: ${b.degisen.map((x) => `${x.kaynak.join(".")} → ${x.hedef.join(".")}`).join(", ")} (bu uçta tek bağ olur)` : "" };
}

export function bagKaldirKomutu(o: EditorOturumu, bag: GrafBagi): KomutSonucu {
  koy(o, bagKaldir(o.graf(), bag));
  return { ok: true, mesaj: `bağ kaldırıldı: ${bag.kaynak.join(".")} → ${bag.hedef.join(".")} (Ctrl+Z geri getirir)` };
}

export function tasiKomutu(o: EditorOturumu, idler: ReadonlySet<string>, dx: number, dy: number): KomutSonucu {
  if (!idler.size || (dx === 0 && dy === 0)) return { ok: false };
  koy(o, dugumleriTasi(o.graf(), idler, dx, dy));
  return { ok: true };
}

/** Ayar değiştir + o düğümün bağlarını buda (pin kalktıysa söylenir). */
export function ayarKomutu(o: EditorOturumu, kayit: DugumKaydi<unknown>, id: string, ad: string, deger: GrafDegeri | undefined): KomutSonucu {
  return uygula(o, ayarDegistirVeBuda(o.graf(), id, ad, deger, kayit, o.ortam()));
}

export function grafBilgisiKomutu(o: EditorOturumu, kayit: DugumKaydi<unknown>, b: GrafBilgisi): KomutSonucu {
  return uygula(o, grafBilgisiVeBuda(o.graf(), b, kayit, o.ortam()));
}
