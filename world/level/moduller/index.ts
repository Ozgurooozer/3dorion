// world/level/moduller/index.ts — Modül kaydı: level tanımındaki `tur` → modül.
//
// Yeni katman türü = yeni modül dosyası + buraya bir satır. Tanımda kayıtta olmayan tür HATA verir
// (sessizce atlanmaz).
"use strict";
import type { LevelModulu } from "../cekirdek/modul.ts";
import type { ModulKaydi } from "../cekirdek/levelKur.ts";
import { gokModulu } from "./gok.ts";
import { gunesDiskiModulu } from "./gunesDiski.ts";
import { bulutModulu } from "./bulut.ts";
import { zeminModulu } from "./zemin.ts";
import { kayaModulu } from "./kaya.ts";
import { uzakAraziModulu } from "./uzakArazi.ts";
import { cimModulu } from "./cim.ts";

const liste: LevelModulu[] = [gokModulu, gunesDiskiModulu, bulutModulu, zeminModulu, kayaModulu, cimModulu, uzakAraziModulu];

export const MODULLER: ModulKaydi = new Map(liste.map((m) => [m.tur, m]));
