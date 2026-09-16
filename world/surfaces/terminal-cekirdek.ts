// world/surfaces/terminal-cekirdek.ts — xterm + pty ortak çekirdeği.
//
// Neden ayrı dosya: iki aday (doku kopyalama / CSS bindirme) aynı VT
// durum makinesini ve aynı pty bağlantısını paylaşır. Aday farkı yalnızca
// "pikseller nasıl 3D'ye taşınır" sorusunda; ANSI ayrıştırma, geçmiş,
// boyutlandırma ve pty yaşam döngüsü ikisinde de aynıdır.
//
// Bağımlılık sınırı: yalnızca @xterm/*, protocol/, host/kopru.ts (tip).
"use strict";
import { Terminal } from "@xterm/xterm";
import { KabukIsaretAyiklayici, type KabukIsareti } from "./kabukIsaret.ts";
import type { IDisposable, ITerminalOptions } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { PtyBitti, PtyCikti } from "../../host/kopru.ts";

/** Terminal yazı tipi yığını — monospace garantisi olmadan hücre ızgarası kayar. */
export const YAZI_TIPI = "'Cascadia Mono', 'Cascadia Code', Consolas, 'Courier New', monospace";

export interface CekirdekAyari {
  /** xterm DOM'unun yaşayacağı kap. Aday A'da ekran dışı, aday B'de görünür. */
  kap: HTMLElement;
  cwd?: string;
  cols?: number;
  rows?: number;
  fontSize?: number;
  /** Ek xterm seçenekleri (aday bazlı: allowTransparency vs). */
  ek?: Partial<ITerminalOptions>;
}

/** 3dorion terminal teması. Uyku hâli parıltısıyla aynı ton ailesinde. */
export const TEMA = {
  background: "#080810",
  foreground: "#cfd6ef",
  cursor: "#7de3ff",
  cursorAccent: "#080810",
  selectionBackground: "rgba(125,227,255,0.22)",
  black: "#11131f", brightBlack: "#3b4160",
  red: "#ff6b78", brightRed: "#ff97a1",
  green: "#71dc9a", brightGreen: "#9bf0bb",
  yellow: "#ffd479", brightYellow: "#ffe6ad",
  blue: "#7aa2ff", brightBlue: "#a5c0ff",
  magenta: "#c38cff", brightMagenta: "#dcb6ff",
  cyan: "#7de3ff", brightCyan: "#adf0ff",
  white: "#cfd6ef", brightWhite: "#ffffff",
} as const;

/** Enter tusu: pty'ye giden satir sonu. Komut suresi bundan olculur. */
const CR = String.fromCharCode(13);

export class TerminalCekirdek {
  readonly term: Terminal;
  private readonly _ayar: CekirdekAyari;
  private _ptyId: string | null = null;
  /** OSC 133 ayiklayici: isaretler xterm'e ULASMADAN once cikarilir. */
  private _isaretci = new KabukIsaretAyiklayici();
  private _isaretDinleyici: ((i: KabukIsareti) => void) | null = null;
  /** Kullanicinin Enter'a bastigi an — komut suresi buradan olculur. */
  private _komutBasladi = 0;
  private _cozuculer: Array<() => void> = [];
  private _atilanlar: IDisposable[] = [];
  private _kirli = true;
  private _oldu = false;
  /** Son veri geldiği an — gecikme ölçümü bunu okur. */
  private _sonVeriAn = 0;

  constructor(ayar: CekirdekAyari) {
    this._ayar = ayar;
    this.term = new Terminal({
      cols: ayar.cols ?? 80,
      rows: ayar.rows ?? 24,
      fontFamily: YAZI_TIPI,
      fontSize: ayar.fontSize ?? 14,
      lineHeight: 1.0,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: "block",
      convertEol: false,
      scrollback: 4000,
      allowProposedApi: true,
      theme: { ...TEMA },
      ...ayar.ek,
    });
    this.term.open(ayar.kap);

    // Kirlilik izi: yeniden boyamayı yalnızca gerçek değişimde yaparız.
    this._atilanlar.push(this.term.onWriteParsed(() => { this._kirli = true; }));
    this._atilanlar.push(this.term.onCursorMove(() => { this._kirli = true; }));
    this._atilanlar.push(this.term.onScroll(() => { this._kirli = true; }));
    this._atilanlar.push(this.term.onResize(() => { this._kirli = true; }));
  }

  get kirli(): boolean { return this._kirli; }
  temizle(): void { this._kirli = false; }
  kirlet(): void { this._kirli = true; }
  get sonVeriAn(): number { return this._sonVeriAn; }
  get ptyId(): string | null { return this._ptyId; }
  get acikMi(): boolean { return this._ptyId !== null; }

  /** pty aç ve iki yönü bağla. İkinci çağrı yok sayılır. */
  async ptyBagla(): Promise<string> {
    if (this._ptyId) return this._ptyId;
    const kopru = window.kopru;
    if (!kopru) throw new Error("window.kopru yok — terminal yalnızca Electron kabuğunda açılır");

    const id = await kopru.ptyAc({
      cwd: this._ayar.cwd,
      cols: this.term.cols,
      rows: this.term.rows,
    });
    if (this._oldu) { kopru.ptyKapat(id); throw new Error("çekirdek yok edildi"); }
    this._ptyId = id;

    // ptyDinle abonelikten çıkma fonksiyonu döndürür — sızıntı önlemi, kullanılır.
    this._cozuculer.push(kopru.ptyDinle((c: PtyCikti) => {
      if (c.id !== this._ptyId) return;
      this._sonVeriAn = performance.now();
      // Kabuk isaretleri ekrana YAZILMAZ: once ayiklanir, sonra kalan metin
      // xterm'e gider. Yoksa istem satirinda gorunur cop olusur.
      const { metin, isaretler } = this._isaretci.isle(c.veri);
      for (const i of isaretler) {
        if (i.tur === "bitti" && this._komutBasladi > 0) {
          i.sureMs = Math.round(performance.now() - this._komutBasladi);
          this._komutBasladi = 0;
        }
        this._isaretDinleyici?.(i);
      }
      if (metin) this.term.write(metin);
    }));
    this._cozuculer.push(kopru.ptyBittiDinle((b: PtyBitti) => {
      if (b.id !== this._ptyId) return;
      this._ptyId = null;
      this.term.write(`\r\n\x1b[38;5;244m[pty kapandı, kod ${b.kod}]\x1b[0m\r\n`);
      this._kirli = true;
    }));
    this._atilanlar.push(this.term.onData((d) => {
      if (!this._ptyId) return;
      // Enter = komut basladi. Sure olcumu buradan baslar; OSC 133 `B`
      // istem gosterilince gelir ve YAZMA suresini de icerir.
      if (d.includes(CR)) this._komutBasladi = performance.now();
      kopru.ptyYaz(this._ptyId, d);
    }));
    this._atilanlar.push(this.term.onBinary((d) => { if (this._ptyId) kopru.ptyYaz(this._ptyId, d); }));
    return id;
  }

  /** Kabuk isaretlerini (OSC 133) dinle: komut basi/sonu ve cikis kodu. */
  isaretDinle(cb: (i: KabukIsareti) => void): void { this._isaretDinleyici = cb; }

  /** Terminale doğrudan yaz (pty'ye gider). Ölçüm ve `E` etkileşimi kullanır. */
  yaz(veri: string): void {
    if (!this._ptyId) return;
    if (veri.includes(CR)) this._komutBasladi = performance.now();
    window.kopru.ptyYaz(this._ptyId, veri);
  }

  boyutBildir(cols: number, rows: number): void {
    if (cols === this.term.cols && rows === this.term.rows) return;
    this.term.resize(cols, rows);
    if (this._ptyId) window.kopru.ptyBoyut(this._ptyId, cols, rows);
  }

  /** pty'yi gerçekten öldür; dinleyicileri çöz. Terminal nesnesi yaşamaya devam eder. */
  ptyKes(): void {
    const id = this._ptyId;
    this._ptyId = null;
    if (id) window.kopru.ptyKapat(id);
    for (const c of this._cozuculer) { try { c(); } catch { /* kapanışta önemsiz */ } }
    this._cozuculer = [];
  }

  /**
   * Son N satırlık düz metin. ANSI kaçışları yoktur: xterm zaten ayrıştırdı,
   * biz hücre ızgarasından okuyoruz. T4 bunu LLM'e verecek.
   */
  kuyruk(satir = 40): string {
    const buf = this.term.buffer.active;
    // Son yazılmış satır kursörün bulunduğu satırdır. `baseY + rows` demek
    // ekranın ALTINI okumaktır ve içerik kısayken boş dize döndürür.
    const son = Math.min(buf.baseY + buf.cursorY + 1, buf.length);
    const bas = Math.max(0, son - satir);
    const cikti: string[] = [];
    for (let i = bas; i < son; i++) {
      const l = buf.getLine(i);
      cikti.push(l ? l.translateToString(true) : "");
    }
    // Sondaki boş satırları at — LLM'e boşluk göndermenin anlamı yok.
    while (cikti.length > 0 && cikti[cikti.length - 1] === "") cikti.pop();
    return cikti.join("\n");
  }

  yokEt(): void {
    this._oldu = true;
    this.ptyKes();
    for (const a of this._atilanlar) { try { a.dispose(); } catch { /* önemsiz */ } }
    this._atilanlar = [];
    try { this.term.dispose(); } catch { /* önemsiz */ }
  }
}
