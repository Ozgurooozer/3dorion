// world/level/cekirdek/nesneTipi.ts — Orion'un nesne kaydının TİPLERİ (`Nesne`, `Kutu`): Level'in tipi, ofis (Sahne) buradan alır.
//
// Neden burada (mimari düzenleme B5'in tip yarısı, Ozyn 2026-10-15): level çekirdeği (`cekirdek/anlam.ts`) ofisin nesne kaydından (`world/level/nesneKaydi.ts`,
// Sahne) tip alıyordu: YANLIŞ YÖN. Tip Level'e taşındı; ofis dosyaları (`nesneKaydi.ts`, `olculer.ts`) aynı tipleri BURADAN yeniden dışa verir, yani
// bildirimi iki yerde yazmaz (kopya yok) ve mevcut import yolları değişmez. Saf tip dosyası (çalışma zamanı kodu yok).
"use strict";
import type { CapaAdi } from "../../../protocol/temel.ts";
import type { NesneTuru } from "./anlam.ts";

/** Bir eksen hizalı kutu (AABB). Çarpışma ve mesh üretimi aynı veriyi okur. */
export interface Kutu {
  /** Merkez. */
  x: number; y: number; z: number;
  /** Tam boyutlar (yarım değil). */
  g: number; yuk: number; d: number;
}

export interface Nesne {
  /** Kararlı kimlik: çapalıysa çapa adı, değilse kısa ad. */
  id: string;
  /** Odadaki Türkçe ad (Orion'un sesi bunu aynen kullanır). */
  ad: string;
  tur: NesneTuru;
  /** Bu nesneye bakmak hangi çapayı önerir; çapasız eşya için null. */
  capa: CapaAdi | null;
  /** Işın ve görünürlük testinin kullandığı kutu. */
  kutu: Kutu;
}
