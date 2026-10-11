// world/yer/odaYeri.ts — Orion'un ofisi bir `Yer` olarak (spec 24 C1). Babylon YOK.
//
// İkinci liste YOK: her alan odanın tek kaynağından (olculer / capalar / nesneKaydi) türer. Bekçi
// `odaYeri.test.ts` aynılığı sınar; varsayılan parametreler (yer verilmezse oda) bu nesneye denk olmalı.
"use strict";
import type { Yer } from "./yer.ts";
import { ENGELLER, KATI_YUZEYLER, SINIR } from "../level/olculer.ts";
import { tumCapalar } from "../level/capalar.ts";
import { NESNELER } from "../level/nesneKaydi.ts";

export const ODA_YERI: Yer = {
  ad: "oda",
  sinir: SINIR,
  engeller: ENGELLER,
  katiYuzeyler: KATI_YUZEYLER,
  capalar: tumCapalar(),
  nesneler: NESNELER,
  // Oda zemini düz (oyuncu.ts: "y her zaman 0").
  yukseklik: () => 0,
};
