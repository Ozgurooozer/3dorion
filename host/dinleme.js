// host/dinleme.js — Orion'un kulağı: tools/nemotron-dinle.py kalıcı sürecinin istemcisi.
// YALNIZCA ana süreçte çalışır (child_process).
//
// Neden ayrı süreç: model Python (Transformers) ve her konuşmada yüklemek ~4 sn; kalıcı süreçte
// çözme yarım saniye. Mikrofonu da Python açar: ham ses ne IPC'den ne diskten geçer, renderer'a
// yalnız çözülmüş METİN gelir.
//
// Süreç tembel başlar (ilk `baslat`ta) — mikrofon kapalıyken RAM/CPU harcanmaz. Bulunamazsa ya da
// çökerse sessiz bozulma YOK: renderer'a `hata` olayı gider, üst katman kullanıcıya gösterir.
import { spawn as gercekSpawn } from "node:child_process";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath } from "node:url";

const BU_DIZIN = path.dirname(fileURLToPath(import.meta.url));
export const BETIK_YOLU = path.join(BU_DIZIN, "..", "tools", "nemotron-dinle.py");

/** Python'un yazdığı bir JSON satırını olaya çevirir; bozuk satır `null` (ör. kütüphane uyarısı). */
export function satirCoz(satir) {
  const s = String(satir).trim();
  if (!s.startsWith("{")) return null;
  try {
    const o = JSON.parse(s);
    return o && typeof o.olay === "string" ? o : null;
  } catch {
    return null;
  }
}

export class Dinleyici {
  /**
   * @param {(olay: object) => void} olayVer  renderer'a giden olay (hazir/tanima/bos/hata/kapandi)
   * @param {{ spawn?: Function, python?: string, betik?: string }} [ayar]
   */
  constructor(olayVer, ayar = {}) {
    this._olayVer = olayVer;
    this._spawn = ayar.spawn ?? gercekSpawn;
    this._python = ayar.python ?? process.env.ORION_PYTHON ?? "python";
    this._betik = ayar.betik ?? BETIK_YOLU;
    this._surec = null;
    this._tampon = "";
    this._cozucu = new StringDecoder("utf8");
  }

  get calisiyor() { return this._surec !== null; }

  /** Süreci başlatır (zaten açıksa bir şey yapmaz). Hazır olunca `hazir` olayı gelir. */
  baslat() {
    if (this._surec) return;
    let p;
    try {
      p = this._spawn(this._python, [this._betik], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true, env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    } catch (err) {
      this._olayVer({ olay: "hata", hata: `dinleme sureci acilamadi: ${err?.message ?? err}` });
      return;
    }
    this._surec = p;
    this._tampon = "";
    this._cozucu = new StringDecoder("utf8");   // çok baytlı harf parça sınırında bölünebilir
    p.stdout.on("data", (b) => this._oku(b));
    p.stderr.on("data", () => { /* Transformers uyarıları; gerçek hata stdout'a JSON olarak gelir */ });
    p.on("error", (err) => {
      this._surec = null;
      this._olayVer({ olay: "hata", hata: `dinleme sureci acilamadi: ${err?.message ?? err}` });
    });
    p.on("close", (kod) => {
      this._surec = null;
      this._olayVer({ olay: "kapandi", kod });
    });
  }

  _oku(bayt) {
    this._tampon += this._cozucu.write(bayt);
    let i;
    while ((i = this._tampon.indexOf("\n")) >= 0) {
      const o = satirCoz(this._tampon.slice(0, i));
      this._tampon = this._tampon.slice(i + 1);
      if (o) this._olayVer(o);
    }
  }

  _gonder(komut) {
    if (!this._surec) return false;
    try { this._surec.stdin.write(komut + "\n"); return true; } catch { return false; }
  }

  /** Bas-konuş: tuşa basılınca. */
  kayit() { return this._gonder("kayit"); }
  /** Tuş bırakılınca: kaydı bitirir, sonuç `tanima`/`bos` olarak gelir. */
  dur() { return this._gonder("dur"); }

  kapat() {
    const p = this._surec;
    this._surec = null;
    if (!p) return;
    try { p.stdin.write("cik\n"); p.stdin.end(); } catch { /* kapanışta önemsiz */ }
    try { p.kill(); } catch { /* kapanışta önemsiz */ }
  }
}
