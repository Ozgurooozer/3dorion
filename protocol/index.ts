// protocol/index.ts — Dünya Protokolü tek giriş noktası.
"use strict";
export { SURUM, kimlik, zarfla } from "./temel.ts";
export type { Kanal, Hedef, CapaAdi, Vec3, Zarf } from "./temel.ts";
export { POZLAR, JESTLER, YAZAN_NIYETLER, SURELI_NIYETLER, okunurMu } from "./niyet.ts";
export type { Poz, Jest, Niyet, NiyetTur, NiyetSonucu } from "./niyet.ts";
export { VARSAYILAN_KANAL, ozetle } from "./algi.ts";
export type { Algi, AlgiTur, OrionDurumu, OyuncuDurumu, YakinNesne } from "./algi.ts";
export { niyetDogrula, METIN_SINIRI } from "./dogrula.ts";
export type { Sonuc } from "./dogrula.ts";
