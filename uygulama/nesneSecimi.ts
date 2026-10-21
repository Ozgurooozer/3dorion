// uygulama/nesneSecimi.ts — FARE → NESNE SEÇİMİ (spec 28): imleç kipinde sol tık nesneyi SEÇER, sağ tık seçer ve MENÜYÜ açar. Kompozisyon: saf parçaları bağlar.
//
// Kural: yalnız imleç kipi açıkken VE bir yüzeye odaklanılmamışken çalışır. Odakta (terminal/panel) tıklama mevcut davranışta kalır (`uygulama/odak.ts`: içeriğe
// tıklama, geçiş); imleç kipi kapalıyken tıklama kamerayı ele alır (`world/engine/fareKipi.ts`). Böylece mevcut hiçbir tıklama davranışı değişmez.
// Işın dünyadan gelir (`isin`: piksel → ışın, Babylon `world/engine/fareIsini.ts`); hangi nesneye isabet olduğu saf `nesneSec`te (`world/player/nesneSecici.ts`).
"use strict";
import { nesneSec } from "../world/player/nesneSecici.ts";
import type { Nokta3 } from "../world/player/isinTarama.ts";
import type { Nesne } from "../world/level/nesneKaydi.ts";
import type { SecimDurumu } from "./secimDurumu.ts";

/** Fare olayından yalnız kullanılan alanlar (test sahteleri bunu taşır). */
export interface FareOlayi { offsetX: number; offsetY: number; clientX: number; clientY: number; preventDefault(): void }

export interface NesneSecimiAyari {
  /** Olayların bağlanacağı tuval. */
  tuval: { addEventListener(tur: string, f: (e: FareOlayi) => void): void; removeEventListener(tur: string, f: (e: FareOlayi) => void): void };
  imlec: { readonly acik: boolean };
  /** Bir yüzeye (terminal/panel) odaklanıldı mı: odakta seçim KAPALI. */
  odakta: () => boolean;
  nesneler: () => readonly Nesne[];
  /** Ekran pikseli → dünya ışını (yön birim). */
  isin: (x: number, y: number) => { kaynak: Nokta3; yon: Nokta3 };
  secim: SecimDurumu;
  /** Sağ tık: seçilen nesnenin menüsünü ekranın (x, y) noktasında aç. */
  menuAc: (n: Nesne, x: number, y: number) => void;
  /** Işının Orion'un gövdesine isabet mesafesi (m); vurmadıysa null. Verilmezse Orion menüsü yok. */
  orionuVur?: (kaynak: Nokta3, yon: Nokta3) => number | null;
  /** Sağ tık Orion'a: Orion'un kendi menüsünü aç. */
  orionMenusu?: (x: number, y: number) => void;
  /** Sağ tık boş zemine: ışının zemini kestiği nokta (yoksa null) ile zemin menüsünü aç; zemin bulunamazsa (gökyüzü) menü açılmaz. */
  zeminMenusu?: (kaynak: Nokta3, yon: Nokta3, x: number, y: number) => void;
  /** Orion seçildi / seçimi kalktı (çerçeve gösterimi için). Orion `Yer.nesneler`de değildir: `secim`e girmez, brain'e "seçili nesne" olarak da gitmez. */
  orionSecimi?: (secili: boolean) => void;
  /**
   * Orion DIŞINDaki seçilebilir bedenler (Flash, spec 33; ileride her ajan). Çağrı ANINDA okunur: Flash sonradan yüklenir. Orion'la aynı kurallar:
   * `Yer.nesneler`de değiller, `secim`e girmezler; en yakın isabet kazanır (nesneye karşı eşitlikte beden, bedenler arasında eşitlikte listede önde olan).
   */
  aktorler?: () => readonly SecilebilirAktor[];
  altyazi: (metin: string, ms?: number) => void;
}

/** Fareyle seçilebilen bir beden: ışın isabeti, kendi menüsü, çerçeve açma/kapama. */
export interface SecilebilirAktor {
  readonly id: string;
  readonly ad: string;
  /** Işının gövdesine isabet mesafesi (m); vurmadıysa null. */
  vur(kaynak: Nokta3, yon: Nokta3): number | null;
  menu(x: number, y: number): void;
  /** Çerçeve gösterimi: seçildi / seçimi kalktı. */
  secimi(secili: boolean): void;
}

export function nesneSecimiKur(a: NesneSecimiAyari): { sok(): void; bedenSeciminiBirak(): void } {
  const etkin = (): boolean => a.imlec.acik && !a.odakta();
  const vurulan = (e: FareOlayi): Nesne | null => {
    const i = a.isin(e.offsetX, e.offsetY);
    return nesneSec(i.kaynak, i.yon, a.nesneler())?.nesne ?? null;
  };

  /** Orion'un eski kancaları (`orionuVur`/`orionMenusu`/`orionSecimi`) bir aktör olarak; listede HEP ilk (bedenler arası eşitlikte Orion). */
  const orionAktoru = (): SecilebilirAktor | null => a.orionuVur
    ? { id: "orion", ad: "Orion", vur: a.orionuVur, menu: (x, y) => { a.orionMenusu?.(x, y); }, secimi: (s) => { a.orionSecimi?.(s); } }
    : null;
  const aktorler = (): readonly SecilebilirAktor[] => { const o = orionAktoru(); return [...(o ? [o] : []), ...(a.aktorler?.() ?? [])]; };
  /** Işının vurduğu en yakın beden (yoksa null). Kesin eşitlikte listede önde olan kalır. */
  const enYakinAktor = (kaynak: Nokta3, yon: Nokta3): { aktor: SecilebilirAktor; mesafe: number } | null => {
    let en: { aktor: SecilebilirAktor; mesafe: number } | null = null;
    for (const ak of aktorler()) {
      const t = ak.vur(kaynak, yon);
      if (t !== null && (!en || t < en.mesafe)) en = { aktor: ak, mesafe: t };
    }
    return en;
  };
  /** Beden bir nesnenin önünde/içinde durabilir (bankta otururken): en yakın isabet kazanır, eşitlikte beden. */
  const aktorKazandi = (nesne: { mesafe: number } | null, ak: { mesafe: number } | null): boolean => ak !== null && (!nesne || ak.mesafe <= nesne.mesafe);

  /** Çerçevesi açık tek beden (aynı anda en çok biri seçili). Değişince eskinin çerçevesi ÖNCE kapanır: nesne/beden çerçevesi sonradan gelip üstüne yazar. */
  let seciliAktor: SecilebilirAktor | null = null;
  const aktorIsaretle = (yeni: SecilebilirAktor | null): void => {
    if ((yeni?.id ?? null) === (seciliAktor?.id ?? null)) return;
    const eski = seciliAktor;
    seciliAktor = yeni;
    eski?.secimi(false);
    yeni?.secimi(true);
  };

  const solTik = (e: FareOlayi): void => {
    if (!etkin()) return;
    const i = a.isin(e.offsetX, e.offsetY);
    const nesne = nesneSec(i.kaynak, i.yon, a.nesneler());
    const ak = enYakinAktor(i.kaynak, i.yon);
    if (ak && aktorKazandi(nesne, ak)) {
      a.secim.sec(null);
      aktorIsaretle(ak.aktor);
      a.altyazi(`seçildi: ${ak.aktor.ad} · sağ tık: menü`, 1600);
      return;
    }
    aktorIsaretle(null);
    const n = nesne?.nesne ?? null;
    a.secim.sec(n);
    a.altyazi(n ? `seçildi: ${n.ad} · sağ tık: menü` : "seçim kaldırıldı", 1600);
  };
  const sagTik = (e: FareOlayi): void => {
    if (!etkin()) return;
    e.preventDefault();   // tarayıcının kendi bağlam menüsü açılmasın
    // Üç olası hedef (nesne, beden, boş zemin): en YAKIN isabet kazanır; beden bir nesnenin önünde/üstünde (bankta otururken) durabilir, eşitlikte beden.
    const i = a.isin(e.offsetX, e.offsetY);
    const nesne = nesneSec(i.kaynak, i.yon, a.nesneler());
    const ak = enYakinAktor(i.kaynak, i.yon);
    if (ak && aktorKazandi(nesne, ak)) { ak.aktor.menu(e.clientX, e.clientY); aktorIsaretle(ak.aktor); return; }
    aktorIsaretle(null);
    if (nesne) { a.secim.sec(nesne.nesne); a.menuAc(nesne.nesne, e.clientX, e.clientY); return; }
    a.zeminMenusu?.(i.kaynak, i.yon, e.clientX, e.clientY);
  };

  a.tuval.addEventListener("click", solTik);
  a.tuval.addEventListener("contextmenu", sagTik);
  return {
    sok() {
      a.tuval.removeEventListener("click", solTik);
      a.tuval.removeEventListener("contextmenu", sagTik);
    },
    /**
     * Seçili bedeni (Orion/Flash) dışarıdan bırak: ayar panelinin ✕/Esc'i (spec 34). Bırakılmazsa aynı bedene tekrar tık "zaten seçili" sayılır ve
     * kapatılmış panel geri açılmazdı. Çerçeve kapanır (`secimi(false)`); nesne seçimine dokunulmaz.
     */
    bedenSeciminiBirak() { aktorIsaretle(null); },
  };
}
