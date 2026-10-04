// world/level/nesneKaydi.ts — Odadaki ANLAMLI nesnelerin kaydı (spec 15 S1). Babylon YOK.
//
// NEDEN BURADA, NEDEN GLB'DEN DEĞİL. Oda Blender GLB'sinden yükleniyor ama mesh'ler
// malzeme adıyla adlandırılmış (`oda_neon_pembe`...): tek tek eşya değil. Odanın tek
// veri kaynağı `olculer.ts` — mesh, Blender betiği, çapa, çarpışma ve ışın kutuları
// hepsi oradan okur. Kayıt da oradan TÜRER; ikinci bir liste tutulmaz (spec 15 §6).
//
//   • Çapalı nesneler: `KATI_YUZEYLER`deki çapalı kutular, adı `CAPA_ETIKETLERI`nden.
//   • Çapasız eşyalar: aynı dosyadaki sabitlerden (raf, berjer, kutu yığını, lambalar).
//   • `oda_ortasi` bir YER, nesne değil (kutusu yok): kayıtta yok.
//
// Kabuk (duvar, zemin, tavan) bilerek yok: bağlamı doldurur, bilgi taşımaz. Kayıtta
// olmayan şey Orion için "bilinmiyor"dur, "yok" değil (spec 15 K2).
"use strict";
import { CAPA_ETIKETLERI, type CapaAdi } from "../../protocol/temel.ts";
import { BERJER, KATI_YUZEYLER, LAMBA, RAF, YIGIN, type Kutu } from "./olculer.ts";

/** `yuzey` = duvara/masaya bakan ekran-panel; `mobilya` = taşınabilir/oturulabilir; `aydinlatma` = lamba. */
export type NesneTuru = "yuzey" | "mobilya" | "aydinlatma";

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

const MOBILYA_CAPALARI: ReadonlySet<CapaAdi> = new Set(["masa", "sandalye"]);

/** Lamba noktası etrafında küçük bir kutu: ışını durdurmaz (yuzeylerde yok), yalnız görünürlük için. */
const LAMBA_BOYU = 0.3;
const lambaKutusu = (p: { x: number; y: number; z: number }): Kutu =>
  ({ x: p.x, y: p.y, z: p.z, g: LAMBA_BOYU, yuk: LAMBA_BOYU, d: LAMBA_BOYU });

/** `olculer.ts`teki çapasız kutuyu, sabitin konumundan bulur: kutu kopyalanmaz, türetilir. */
function yuzeydenKutu(x: number, z: number): Kutu {
  const y = KATI_YUZEYLER.find((s) => s.capa === null && s.kutu.x === x && s.kutu.z === z);
  if (!y) throw new Error(`nesneKaydi: KATI_YUZEYLER'de (${x}, ${z}) konumlu kutu yok`);
  return y.kutu;
}

const CAPALI: Nesne[] = KATI_YUZEYLER
  .filter((s): s is typeof s & { capa: CapaAdi } => s.capa !== null)
  .map((s) => ({
    id: s.capa,
    ad: CAPA_ETIKETLERI[s.capa],
    tur: MOBILYA_CAPALARI.has(s.capa) ? "mobilya" : "yuzey",
    capa: s.capa,
    kutu: s.kutu,
  }));

const CAPASIZ: Nesne[] = [
  { id: "raf", ad: "raf", tur: "mobilya", capa: null, kutu: RAF },
  { id: "berjer", ad: "kırmızı berjer", tur: "mobilya", capa: null, kutu: yuzeydenKutu(BERJER.x, BERJER.z) },
  { id: "yigin", ad: "kutu yığını", tur: "mobilya", capa: null, kutu: yuzeydenKutu(YIGIN.x, YIGIN.z) },
  { id: "banker_lamba", ad: "banker lambası", tur: "aydinlatma", capa: null, kutu: lambaKutusu(LAMBA.banker) },
  { id: "ayakli_lamba", ad: "ayaklı lamba", tur: "aydinlatma", capa: null, kutu: lambaKutusu(LAMBA.ayakli) },
];

/** Odadaki tüm anlamlı nesneler. Sıra anlamsız. */
export const NESNELER: readonly Nesne[] = [...CAPALI, ...CAPASIZ];
