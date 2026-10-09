// world/level/shader/paletler.ts — Dünya paletleri (veri): gün içinde değişen renkler, katman başına.
//
// Kaynak: vault "Sistem Hatası" renk kartelası (forum/orion0fis/renk-swatch) — üç simülasyon katmanı, glitch paleti,
// Orion'un sabit paleti (LK2). "ova" bu repo'nun ilk level'i (gündüz karesi ova.level.json'un paletiyle aynı aile).
//
// Her dünya bir ZAMAN ÇİZELGESİ: saatlik kareler (shader/dunyaDurumu.ts `paletZamanda` ara değer alır). Ortak adlar:
//   gokZenit, gokUfuk — gök zamanı shader'ı (gece/şafak/akşam gökyüzü)
//   isik, dolgu       — güneş/ay ışığının ve gök dolgusunun rengi (ışık sistemi zaman akarken bunları kullanır)
//   r0…r4             — palet haritası rampası, koyudan açığa (kare bu rampaya doğru boyanır)
"use strict";
import type { PaletKaresi } from "./dunyaDurumu.ts";

export interface DunyaPaleti { ad: string; aciklama: string; kareler: PaletKaresi[] }

const kare = (saat: number, gokZenit: string, gokUfuk: string, isik: string, dolgu: string, rampa: [string, string, string, string, string]): PaletKaresi =>
  ({ saat, renkler: { gokZenit, gokUfuk, isik, dolgu, r0: rampa[0], r1: rampa[1], r2: rampa[2], r3: rampa[3], r4: rampa[4] } });

export const DUNYA_PALETLERI: readonly DunyaPaleti[] = [
  {
    ad: "ova", aciklama: "Ova: altın-yeşil gündüz, pembe-turuncu akşam, mavi gece.",
    kareler: [
      kare(0, "#050a1c", "#1c2a4e", "#9fb4ff", "#3a4f86", ["#0c1428", "#1f3260", "#3a5c94", "#7697cc", "#d6e2ff"]),
      kare(5.5, "#2a3166", "#d99aa4", "#ffb890", "#8a7cae", ["#1e1a32", "#4a4070", "#a47494", "#f0ae8e", "#ffe6c8"]),
      kare(12, "#2c63c9", "#b7d3ee", "#fff3cf", "#5d93e0", ["#1b2818", "#3e5a2a", "#7d9a34", "#cbc66c", "#fff6d8"]),
      kare(18.5, "#2c2f6e", "#ff9e64", "#ff9454", "#946c9c", ["#241428", "#57304a", "#b0584a", "#f4985a", "#ffdca8"]),
      kare(20.5, "#101638", "#3e3468", "#a8b4ff", "#45508a", ["#0e1226", "#252c56", "#45508a", "#808ac0", "#d8dcff"]),
    ],
  },
  {
    ad: "siberpunk", aciklama: "Katman 1 — Atlas: gece mavisi, beton, elektrik cyan, mor neon, asit yeşili.",
    kareler: [
      kare(0, "#050a14", "#1f1238", "#00d4ff", "#3a1a6e", ["#0d1b2a", "#2a1f4a", "#6b21a8", "#00a8cc", "#b8fbff"]),
      kare(12, "#4a5560", "#9aa3a8", "#e6f0f2", "#5a6670", ["#1a1d22", "#3d3d3d", "#5e6a72", "#8fa8b0", "#e0f4f8"]),
      kare(19, "#1a0f3a", "#8a2a8a", "#ff4fd8", "#3a1a6e", ["#0b0a1a", "#3a1450", "#6b21a8", "#00d4ff", "#39ff14"]),
    ],
  },
  {
    ad: "ortacag", aciklama: "Katman 2 — Aethel: krem taş, pas kahvesi, hasır sarısı, sönük yeşil, kan kırmızısı.",
    kareler: [
      kare(0, "#0b0a12", "#2a1a12", "#ff9a3c", "#3a2418", ["#0c0806", "#2e1a0e", "#8b4513", "#d4a853", "#ffe2a8"]),
      kare(12, "#6f8fb0", "#e8d8b8", "#fff0c8", "#c8a882", ["#2a2116", "#4a5e3a", "#8b4513", "#c8a882", "#f6ead2"]),
      kare(18, "#4a3a5a", "#e8a050", "#ffb050", "#8b5a3a", ["#1a0e08", "#4a1a0e", "#8b2a10", "#d4a853", "#ffe6b0"]),
    ],
  },
  {
    ad: "buyu", aciklama: "Katman 3 — Büyü: void siyahı, derin mor, eteryal mor, büyü ışıması, yanık altın.",
    kareler: [
      kare(0, "#050508", "#2a0a4a", "#7fffd4", "#4a0e6e", ["#050508", "#2a0a4a", "#4a0e6e", "#8b7ed8", "#7fffd4"]),
      kare(12, "#3a2a6e", "#8b7ed8", "#e8e0ff", "#6a4aa8", ["#0e0a1a", "#4a0e6e", "#8b7ed8", "#ffd700", "#e8fff8"]),
    ],
  },
];

/** Hata/glitch paleti (diegetic değil — yalnız hata anı): dijital mavi, magenta kayma, cyan kayma, statik beyaz. */
export const GLITCH = { dijitalMavi: "#5b8def", magenta: "#ff2079", cyan: "#0affef", statik: "#f5f5f5" } as const;
/** Orion'un sabit paleti (LK2): her katmanda değişmez. */
export const ORION = { obsidyen: "#1a1a2e", ormanYesili: "#1b4332", metalGri: "#6b7280", deri: "#7c5c47" } as const;

export const DUNYA_ADLARI = DUNYA_PALETLERI.map((d) => d.ad);
/** Dizin → dünya (taşarsa sarılır; ayarlarda seçim sayıyla — metin ayar = renk kuralı). */
export const dunyaPaleti = (i: number): DunyaPaleti => DUNYA_PALETLERI[((Math.round(i) % DUNYA_PALETLERI.length) + DUNYA_PALETLERI.length) % DUNYA_PALETLERI.length]!;
