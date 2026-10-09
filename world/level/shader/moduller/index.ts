// world/level/shader/moduller/index.ts — Özel shader kaydı: `tanim.shaderlar[].tur` → modül (spec 20).
// Yeni shader = yeni modül dosyası + buraya bir satır.
"use strict";
import type { ShaderModulu } from "../modul.ts";
import type { ShaderKaydi } from "../shaderSistemi.ts";
import { gokZamaniModulu } from "./gokZamani.ts";
import { paletHaritasiModulu } from "./paletHaritasi.ts";
import { zamanKirigiModulu } from "./zamanKirigi.ts";
import { hataImzasiModulu } from "./hataImzasi.ts";
import { debugTaramaModulu } from "./debugTarama.ts";
import { fircaModulu } from "./firca.ts";
import { elyazmasiModulu } from "./elyazmasi.ts";

const liste: ShaderModulu[] = [gokZamaniModulu, paletHaritasiModulu, zamanKirigiModulu, hataImzasiModulu, debugTaramaModulu, fircaModulu, elyazmasiModulu];

export const SHADERLAR: ShaderKaydi = new Map(liste.map((m) => [m.tur, m]));
