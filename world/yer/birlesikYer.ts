// world/yer/birlesikYer.ts — TEK `Yer`: ofis ova'nın içinde (spec 27). Babylon YOK.
//
// Eskiden iki yer vardı (`ODA_YERI`, ova yeri) ve kapıdan geçince biri yıkılıp öbürü kuruluyordu; Ozyn (2026-10-14) tek level istedi.
// Artık her aktör (Ozyn, Orion) AYNI yeri görür; ofis ova'nın içinde bir binadır:
//   sinir         ova'nın yürünebilir karesi (ofisi kapsar)
//   engeller      ova engelleri + ofisin mobilyası + ofisin DUVARLARI (ön duvarda kapı boşluğu: her zaman yürünür)
//   katiYuzeyler  ova + ofisin ışın-geçirmez yüzeyleri (duvarlar dahil)
//   capalar       ofisin çapaları (tahta, masa, monitör, kapı…) + ova'nın adlandırılmış yerleri
//   nesneler      ofis + ova
//   yukseklik     ofisin İÇİ 0 (döşeme), dışı ova zemini (teras ofisin 5 cm altı: basamak yok denecek kadar küçük)
// Kapı kanadı çarpışmada YOK: kapı yakınlaşana otomatik açılır (`world/level/odaKapisi.ts`), boşluk her zaman yürünür; yol bulma
// "kapı kapalı, yol yok" demez.
//
// Bilinen sınır: ofisin içindeki ova yerleşimleri yok (plato + çim maskesi ofisin altını boş bırakır, `ofisYeri.ts`).
"use strict";
import { yerSabitBilgisi, yerOrtasiSozu, type Yer } from "./yer.ts";
import { ENGELLER, KATI_YUZEYLER, KAPI, ODA, type Kutu } from "../level/olculer.ts";
import { tumCapalar } from "../level/capalar.ts";
import { NESNELER } from "../level/nesneKaydi.ts";
import { OFIS_IZI } from "../level/ofisYeri.ts";

const G = ODA.genislik, D = ODA.derinlik, K = ODA.duvarKalinlik, Y = ODA.yukseklik;

/** Kapı boşluğunun serbest yarı genişliği (kasa iç yüzleri arası): 1,0 m kanat + kasa. */
export const KAPI_BOSLUGU_YARI = KAPI.genislik / 2;

/**
 * Ofis duvarları (XZ engeli): sol, sağ, arka (cam duvar dahil: camdan geçilmez) ve ön duvar İKİ parça, kapı boşluğu ortada.
 * Boyutlar `olculer.ts` kabuğuyla aynı: iç yüz tam SINIR'da, duvar dışa taşar.
 */
export const OFIS_DUVARLARI: readonly Kutu[] = [
  { x: -G / 2 - K / 2, y: Y / 2, z: 0, g: K, yuk: Y, d: D + 2 * K },                                   // sol
  { x: G / 2 + K / 2, y: Y / 2, z: 0, g: K, yuk: Y, d: D + 2 * K },                                    // sağ
  { x: 0, y: Y / 2, z: -D / 2 - K / 2, g: G, yuk: Y, d: K },                                          // arka (cam)
  ...((): Kutu[] => {
    // Ön duvar: x ∈ [−G/2, KAPI.x − yarı] ve [KAPI.x + yarı, G/2]; köşe sütunları sol/sağ duvarda.
    const solBit = KAPI.x - KAPI_BOSLUGU_YARI + G / 2, sagBit = G / 2 - (KAPI.x + KAPI_BOSLUGU_YARI);
    return [
      { x: -G / 2 + solBit / 2, y: Y / 2, z: D / 2 + K / 2, g: solBit, yuk: Y, d: K },
      { x: G / 2 - sagBit / 2, y: Y / 2, z: D / 2 + K / 2, g: sagBit, yuk: Y, d: K },
    ];
  })(),
];

/** (x, z) ofisin yer izinin (duvarlar dahil) içinde mi: yüksekliği 0 olan döşeme. */
export function ofisIcindeMi(x: number, z: number, pay = 0): boolean {
  return Math.abs(x) <= OFIS_IZI.yariX + pay && Math.abs(z) <= OFIS_IZI.yariZ + pay;
}

/**
 * Ova yeri + ofis → tek yer. `ova` `levelYeri`nin çıktısıdır (geçit/kapı içermez: `ofisiOvayaKur` geçidi kaldırdı).
 * Girdiyi değiştirmez; dizileri BİRLEŞTİRİR (kopyalar).
 */
export function birlesikYerKur(ova: Yer): Yer {
  const yuk = ova.yukseklik;
  return {
    ad: "ova",
    sinir: ova.sinir,
    engeller: [...ova.engeller, ...OFIS_DUVARLARI, ...ENGELLER],
    katiYuzeyler: [...ova.katiYuzeyler, ...KATI_YUZEYLER],
    capalar: [...tumCapalar(), ...ova.capalar],
    nesneler: [...NESNELER, ...ova.nesneler],
    yukseklik: (x, z) => (ofisIcindeMi(x, z) ? 0 : yuk(x, z)),
    ...(ova.algiMenzil !== undefined ? { algiMenzil: ova.algiMenzil } : {}),
  };
}

/**
 * Orion'un sistem mesajındaki DEĞİŞMEZ yer bilgisi, KONUMA göre: ofisin içindeyken ölçülmüş oda metniyle (`In the room: …`, istem
 * ölçümleri ve tools/ogretmen.ts ona dayanır) aynı başlar; dışarıdayken ova'da olduğunu ve ofisin yakınında bulunduğunu söyler.
 * Birleşik olmayan yer (`ad === "oda"`) eski metni alır.
 */
export function konumluSabitBilgi(yer: Yer, x: number, z: number): string {
  if (yer.ad === "oda") return yerSabitBilgisi(yer);
  const odaSayisi = tumCapalar().length;
  if (ofisIcindeMi(x, z)) {
    const adlar = yer.capalar.slice(0, odaSayisi).map((c) => c.etiket).join(", ");
    return `In the room: ${adlar}. The room's door leads outside, to the ova.`;
  }
  const ova = yer.capalar.slice(odaSayisi).map((c) => c.etiket).join(", ");
  return `Outside, in the ova, near the room (its door is on the front of the building)${ova ? `: ${ova}` : " — an open grass field around it"}.`;
}

/** Durum defterinin konumu, hiçbir çapanın yanında değilken: ofisin içinde "odanın ortası", dışarıda "dışarıda (ova)". */
export function konumluYerOrtasi(yer: Yer, x: number, z: number): string {
  if (yer.ad === "oda") return yerOrtasiSozu(yer);
  return ofisIcindeMi(x, z) ? "odanın ortası" : "dışarıda (ova)";
}
