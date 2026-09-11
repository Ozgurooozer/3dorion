// world/surfaces/hucre-boyaci.ts — xterm hücre ızgarasını 2D bağlama boyar.
//
// Neden kendi boyayıcı: @xterm/xterm 6 çekirdeği DOM renderer ile gelir,
// içinde kopyalanacak bir canvas YOKTUR (webgl/canvas renderer ayrı eklenti,
// kurulu değil). Bu yüzden "aday A" burada şu biçimi alır: xterm yalnızca VT
// durum makinesi olarak kullanılır, pikselleri biz doğrudan Babylon
// DynamicTexture bağlamına çizeriz. Ara kopya yok, çözünürlük bize ait —
// dolayısıyla aday A'nın klasik zaafı olan "doku bulanıklığı" ölçülebilir
// bir ayara indirgenir.
"use strict";
import type { IBufferCell, Terminal } from "@xterm/xterm";
import { TEMA, YAZI_TIPI } from "./terminal-cekirdek.ts";

export interface HucreOlcu {
  /** Doku pikselinde bir hücrenin genişliği. */
  w: number;
  /** Doku pikselinde bir hücrenin yüksekliği. */
  h: number;
  /** Yazı tipi boyutu (px). */
  font: number;
  /** Taban çizgisinin hücre üstünden uzaklığı. */
  tabanY: number;
}

/** 13x28 hücre / 21px yazı: 80x24 için 1040x672 doku. Ölçüm bu değerlerle yapıldı. */
export function olcuUret(hucreW = 13, hucreH = 28): HucreOlcu {
  // Monospace ilerleme genişliği ≈ 0.6 × font boyutu. Hücreyi taşırmamak için 0.62 payı.
  const font = Math.max(8, Math.round(hucreW / 0.62));
  return { w: hucreW, h: hucreH, font, tabanY: Math.round(hucreH * 0.5 + font * 0.36) };
}

const ADLI: readonly string[] = [
  TEMA.black, TEMA.red, TEMA.green, TEMA.yellow, TEMA.blue, TEMA.magenta, TEMA.cyan, TEMA.white,
  TEMA.brightBlack, TEMA.brightRed, TEMA.brightGreen, TEMA.brightYellow,
  TEMA.brightBlue, TEMA.brightMagenta, TEMA.brightCyan, TEMA.brightWhite,
];

/** 256 renk paleti: 0-15 tema, 16-231 6x6x6 küp, 232-255 gri basamak. */
const PALET: string[] = (() => {
  const p: string[] = ADLI.slice();
  const bas = [0, 95, 135, 175, 215, 255];
  for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++)
    p.push(`rgb(${bas[r]},${bas[g]},${bas[b]})`);
  for (let i = 0; i < 24; i++) { const v = 8 + i * 10; p.push(`rgb(${v},${v},${v})`); }
  return p;
})();

function rgbHex(n: number): string {
  return `#${(n & 0xffffff).toString(16).padStart(6, "0")}`;
}

function onRenk(h: IBufferCell): string {
  if (h.isFgRGB()) return rgbHex(h.getFgColor());
  if (h.isFgPalette()) {
    let i = h.getFgColor();
    if (h.isBold() && i < 8) i += 8;   // kalın + temel renk = parlak varyant
    return PALET[i] ?? TEMA.foreground;
  }
  return TEMA.foreground;
}

function arkaRenk(h: IBufferCell): string | null {
  if (h.isBgRGB()) return rgbHex(h.getBgColor());
  if (h.isBgPalette()) return PALET[h.getBgColor()] ?? null;
  return null;                          // varsayılan arka plan = zemini boyamaya gerek yok
}

export interface BoyaDurumu {
  /** Kursör çizilsin mi (odak yoksa içi boş çerçeve). */
  odakli: boolean;
  /** Yanıp sönme fazı için dünya zamanı (ms). */
  an: number;
}

/**
 * Görüntü alanını (viewport) bağlama boyar. Bağlamın ölçüsü
 * `cols*olcu.w × rows*olcu.h` olmalıdır.
 */
export function izgaraBoya(
  bag: CanvasRenderingContext2D,
  term: Terminal,
  olcu: HucreOlcu,
  durum: BoyaDurumu,
): void {
  const buf = term.buffer.active;
  const cols = term.cols, rows = term.rows;
  const W = cols * olcu.w, H = rows * olcu.h;

  bag.fillStyle = TEMA.background;
  bag.fillRect(0, 0, W, H);
  bag.textBaseline = "alphabetic";

  // 1. geçiş: arka plan blokları (yan yana aynı renkleri birleştirerek).
  for (let y = 0; y < rows; y++) {
    const satir = buf.getLine(buf.viewportY + y);
    if (!satir) continue;
    let x = 0;
    while (x < cols) {
      const h = satir.getCell(x);
      if (!h) { x++; continue; }
      const ters = h.isInverse() !== 0;
      const renk = ters ? onRenk(h) : arkaRenk(h);
      if (!renk) { x++; continue; }
      let bit = x + 1;
      while (bit < cols) {
        const h2 = satir.getCell(bit);
        if (!h2) break;
        const t2 = h2.isInverse() !== 0;
        const r2 = t2 ? onRenk(h2) : arkaRenk(h2);
        if (r2 !== renk) break;
        bit++;
      }
      bag.fillStyle = renk;
      bag.fillRect(x * olcu.w, y * olcu.h, (bit - x) * olcu.w, olcu.h);
      x = bit;
    }
  }

  // 2. geçiş: karakterler. Hücre hücre çizmek ızgarayı kaymaya karşı korur —
  // orantısal düşen bir glif bile komşusunu itemez.
  for (let y = 0; y < rows; y++) {
    const satir = buf.getLine(buf.viewportY + y);
    if (!satir) continue;
    const tabanY = y * olcu.h + olcu.tabanY;
    for (let x = 0; x < cols; x++) {
      const h = satir.getCell(x);
      if (!h) continue;
      const gen = h.getWidth();
      if (gen === 0) continue;                     // geniş karakterin devamı
      const ch = h.getChars();
      if (ch === "" || ch === " ") {
        if (h.isUnderline() === 0 && h.isStrikethrough() === 0) continue;
      }
      if (h.isInvisible() !== 0) continue;

      const ters = h.isInverse() !== 0;
      const on = ters ? (arkaRenk(h) ?? TEMA.background) : onRenk(h);
      const kalin = h.isBold() !== 0;
      bag.font = `${kalin ? "600 " : ""}${h.isItalic() !== 0 ? "italic " : ""}${olcu.font}px ${YAZI_TIPI}`;
      bag.fillStyle = on;
      bag.globalAlpha = h.isDim() !== 0 ? 0.55 : 1;
      if (ch !== "" && ch !== " ") bag.fillText(ch, x * olcu.w, tabanY);
      if (h.isUnderline() !== 0) bag.fillRect(x * olcu.w, tabanY + 2, olcu.w * gen, 1);
      if (h.isStrikethrough() !== 0) bag.fillRect(x * olcu.w, tabanY - olcu.font * 0.3, olcu.w * gen, 1);
      bag.globalAlpha = 1;
    }
  }

  // 3. geçiş: kursör. Görüntü alanı kaydıysa kursör ekranda olmayabilir.
  const ky = buf.cursorY;
  const kx = buf.cursorX;
  if (ky >= 0 && ky < rows && kx >= 0 && kx <= cols) {
    const px = Math.min(kx, cols - 1) * olcu.w, py = ky * olcu.h;
    if (durum.odakli) {
      const yanip = Math.floor(durum.an / 530) % 2 === 0;
      if (yanip) {
        bag.fillStyle = TEMA.cursor;
        bag.fillRect(px, py, olcu.w, olcu.h);
        const satir = buf.getLine(buf.viewportY + ky);
        const h = satir?.getCell(Math.min(kx, cols - 1));
        const ch = h?.getChars() ?? "";
        if (ch && ch !== " ") {
          bag.font = `${olcu.font}px ${YAZI_TIPI}`;
          bag.fillStyle = TEMA.cursorAccent;
          bag.fillText(ch, px, py + olcu.tabanY);
        }
      }
    } else {
      bag.strokeStyle = TEMA.cursor;
      bag.globalAlpha = 0.5;
      bag.lineWidth = 1;
      bag.strokeRect(px + 0.5, py + 0.5, olcu.w - 1, olcu.h - 1);
      bag.globalAlpha = 1;
    }
  }
}

/** Monitör kapalıyken görünen uyku yüzeyi: koyu cam + hafif parıltı, boş siyah değil. */
export function uykuBoya(bag: CanvasRenderingContext2D, W: number, H: number, an: number): void {
  bag.fillStyle = "#05060b";
  bag.fillRect(0, 0, W, H);

  // Merkezden dışa açılan soğuk parıltı — ekranın "bekleme"de olduğunu söyler.
  const g = bag.createRadialGradient(W * 0.5, H * 0.52, 0, W * 0.5, H * 0.52, W * 0.62);
  const nabiz = 0.06 + 0.025 * Math.sin(an / 1400);
  g.addColorStop(0, `rgba(80,150,200,${nabiz.toFixed(3)})`);
  g.addColorStop(1, "rgba(5,6,11,0)");
  bag.fillStyle = g;
  bag.fillRect(0, 0, W, H);

  // Tarama çizgileri: CRT hissi, aynı zamanda "yüzey canlı" işareti.
  bag.fillStyle = "rgba(120,180,220,0.035)";
  for (let y = 0; y < H; y += 4) bag.fillRect(0, y, W, 1);

  const f = Math.max(12, Math.round(H / 26));
  bag.font = `${f}px ${YAZI_TIPI}`;
  bag.textBaseline = "middle";
  bag.fillStyle = `rgba(125,227,255,${(0.22 + 0.12 * Math.sin(an / 900)).toFixed(3)})`;
  const yazi = "[ E ]";
  bag.fillText(yazi, W * 0.5 - bag.measureText(yazi).width / 2, H * 0.5);
  bag.fillStyle = "rgba(125,227,255,0.14)";
  bag.font = `${Math.round(f * 0.62)}px ${YAZI_TIPI}`;
  const alt = "uyku";
  bag.fillText(alt, W * 0.5 - bag.measureText(alt).width / 2, H * 0.5 + f * 1.5);
  bag.textBaseline = "alphabetic";
}
