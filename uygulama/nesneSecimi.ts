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
  altyazi: (metin: string, ms?: number) => void;
}

export function nesneSecimiKur(a: NesneSecimiAyari): { sok(): void } {
  const etkin = (): boolean => a.imlec.acik && !a.odakta();
  const vurulan = (e: FareOlayi): Nesne | null => {
    const i = a.isin(e.offsetX, e.offsetY);
    return nesneSec(i.kaynak, i.yon, a.nesneler())?.nesne ?? null;
  };

  let orionSecili = false;
  /** Orion seçim çerçevesini aç/kapa (yalnız durum değişince bildirir). Nesne seçiminden ÖNCE çağrılır: nesne çerçevesi sonradan gelip üstüne yazar. */
  const orionIsaretle = (secili: boolean): void => {
    if (orionSecili === secili) return;
    orionSecili = secili;
    a.orionSecimi?.(secili);
  };
  /** Orion bir nesnenin önünde/içinde durabilir (bankta otururken): en yakın isabet kazanır, eşitlikte Orion. */
  const orionKazandi = (nesne: { mesafe: number } | null, orion: number | null): boolean => orion !== null && (!nesne || orion <= nesne.mesafe);

  const solTik = (e: FareOlayi): void => {
    if (!etkin()) return;
    const i = a.isin(e.offsetX, e.offsetY);
    const nesne = nesneSec(i.kaynak, i.yon, a.nesneler());
    const orion = a.orionuVur?.(i.kaynak, i.yon) ?? null;
    if (orionKazandi(nesne, orion)) {
      a.secim.sec(null);
      orionIsaretle(true);
      a.altyazi("seçildi: Orion · sağ tık: menü", 1600);
      return;
    }
    orionIsaretle(false);
    const n = nesne?.nesne ?? null;
    a.secim.sec(n);
    a.altyazi(n ? `seçildi: ${n.ad} · sağ tık: menü` : "seçim kaldırıldı", 1600);
  };
  const sagTik = (e: FareOlayi): void => {
    if (!etkin()) return;
    e.preventDefault();   // tarayıcının kendi bağlam menüsü açılmasın
    // Üç olası hedef (nesne, Orion, boş zemin): en YAKIN isabet kazanır; Orion bir nesnenin önünde/üstünde (bankta otururken) durabilir, eşitlikte Orion.
    const i = a.isin(e.offsetX, e.offsetY);
    const nesne = nesneSec(i.kaynak, i.yon, a.nesneler());
    const orion = a.orionuVur?.(i.kaynak, i.yon) ?? null;
    if (orionKazandi(nesne, orion)) { a.orionMenusu?.(e.clientX, e.clientY); orionIsaretle(true); return; }
    orionIsaretle(false);
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
  };
}
