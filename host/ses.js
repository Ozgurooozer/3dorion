// host/ses.js — Piper TTS istemcisi. YALNIZCA ana süreçte çalışır (child_process).
//
// Neden kalıcı süreç: her cümlede yeni piper.exe açmak ölçüldü — model yükleme
// 1.2 sn yiyor ve K3 (ses turu < 1.5 sn) tek başına buna gider. Kalıcı süreçte
// ölçüm: 72-125 ms/cümle (RTX 4060, tr_TR-dfki-medium, CPU onnxruntime, VRAM 0).
//
// Tasarım kararı — SERİLEŞTİRME: piper satır başına bir wav yolu basar, sıra
// korunur. Ama bir satır fonemleştirilemezse çıktı satırı GELMEZ ve kuyruk
// kayar (istek A'nın yanıtını istek B alır). Bu yüzden istekler seri işlenir;
// 100 ms'lik iş için boru hattı kazancı, kayma riskine değmez.
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const MODEL_YUKLEME_MS = 6000;   // ilk cümle model yüklemesini bekler
const CUMLE_ZAMAN_ASIMI_MS = 8000;
const BOSTA_KAPAT_MS = 5 * 60 * 1000; // 5 dk konuşulmazsa süreci bırak (RAM)

function ilkVarOlan(yollar) {
  for (const y of yollar) { if (y && fs.existsSync(y)) return y; }
  return null;
}

/** piper.exe ve ses modelini bul. Bulamazsa null — istisna atmaz. */
function piperBul() {
  const yerel = path.join(os.homedir(), "AppData", "Local", "piper");
  const exe = ilkVarOlan([
    process.env.ORION_PIPER_EXE,
    path.join(yerel, "piper", "piper.exe"),
    path.join(yerel, "piper.exe"),
  ]);
  const model = ilkVarOlan([
    process.env.ORION_PIPER_MODEL,
    path.join(yerel, "sesler", "tr_TR-dfki-medium.onnx"),
  ]);
  return { exe, model };
}

class PiperSesi {
  constructor(ciktiDizini) {
    this._cikti = ciktiDizini || path.join(os.homedir(), ".orion", "ses");
    this._surec = null;
    this._hazir = null;
    this._kuyruk = [];       // { metin, coz, red }
    this._isliyor = false;
    this._bekleyen = null;   // o an piper'dan yanıt beklenen istek
    this._bostaZamanlayici = null;
    this._tampon = "";
  }

  /** Kurulum var mı? UI bunu sorup ses düğmesini gri yapabilir. */
  kullanilabilir() {
    const { exe, model } = piperBul();
    return Boolean(exe && model);
  }

  async _surecBaslat() {
    if (this._hazir) return this._hazir;
    const { exe, model } = piperBul();
    if (!exe || !model) {
      const eksik = !exe ? "piper.exe" : "ses modeli (.onnx)";
      throw new Error(`Piper kurulu değil: ${eksik} bulunamadı`);
    }
    fs.mkdirSync(this._cikti, { recursive: true });

    this._hazir = new Promise((coz, red) => {
      const p = spawn(exe, ["--model", model, "--output_dir", this._cikti], {
        stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
      });
      this._surec = p;
      p.stdout.setEncoding("utf8");
      p.stdout.on("data", (parca) => this._ciktiOku(parca));
      p.stderr.setEncoding("utf8");
      p.stderr.on("data", (d) => { if (/error|fail/i.test(d)) console.warn("[ses] piper:", d.trim()); });
      p.on("error", (err) => { this._cokme(err); red(err); });
      p.on("exit", (kod) => {
        // Beklenmedik ölüm: bekleyen istek boşta kalmasın.
        this._cokme(new Error(`piper süreci kapandı (kod ${kod})`));
      });
      // Model yüklemesi sessizdir; hazır olduğunu ilk cümlenin yanıtı kanıtlar.
      setTimeout(() => coz(p), 250);
    });
    return this._hazir;
  }

  _cokme(err) {
    const b = this._bekleyen;
    this._bekleyen = null;
    this._surec = null;
    this._hazir = null;
    this._isliyor = false;
    if (b) b.red(err);
    for (const k of this._kuyruk.splice(0)) k.red(err);
  }

  _ciktiOku(parca) {
    this._tampon += parca;
    let i;
    while ((i = this._tampon.indexOf("\n")) >= 0) {
      const satir = this._tampon.slice(0, i).trim();
      this._tampon = this._tampon.slice(i + 1);
      if (!satir) continue;
      const b = this._bekleyen;
      this._bekleyen = null;
      if (b) { clearTimeout(b.saat); b.coz(satir); }
      this._isliyor = false;
      this._siraIsle();
    }
  }

  _siraIsle() {
    if (this._isliyor || this._bekleyen || this._kuyruk.length === 0) return;
    const istek = this._kuyruk.shift();
    this._isliyor = true;
    const ilkKez = !this._surecBasladi;
    this._surecBasladi = true;
    istek.saat = setTimeout(() => {
      this._bekleyen = null;
      this._isliyor = false;
      istek.red(new Error("piper yanıt vermedi (zaman aşımı)"));
      this._siraIsle();
    }, ilkKez ? MODEL_YUKLEME_MS : CUMLE_ZAMAN_ASIMI_MS);
    this._bekleyen = istek;
    try {
      // Satır sonu ayırıcıdır: metindeki satır başları boşluğa çevrilmeli.
      this._surec.stdin.write(istek.metin.replace(/[\r\n]+/g, " ") + "\n");
    } catch (err) {
      clearTimeout(istek.saat);
      this._bekleyen = null;
      this._isliyor = false;
      istek.red(err);
    }
  }

  _bostaSayacSifirla() {
    if (this._bostaZamanlayici) clearTimeout(this._bostaZamanlayici);
    this._bostaZamanlayici = setTimeout(() => this.kapat(), BOSTA_KAPAT_MS);
    this._bostaZamanlayici.unref?.();
  }

  /**
   * Metni sese çevir. Sonuç: { ok, yol } veya { ok:false, hata }.
   * Asla istisna atmaz — çağıran taraf ses yokken de çalışmaya devam eder.
   */
  async uret(metin) {
    if (typeof metin !== "string" || !metin.trim()) return { ok: false, hata: "metin boş" };
    if (metin.length > 1200) return { ok: false, hata: `metin çok uzun (${metin.length} > 1200)` };
    try {
      await this._surecBaslat();
      const yol = await new Promise((coz, red) => {
        this._kuyruk.push({ metin: metin.trim(), coz, red });
        this._siraIsle();
      });
      this._bostaSayacSifirla();
      if (!fs.existsSync(yol)) return { ok: false, hata: `piper wav üretmedi: ${yol}` };
      return { ok: true, yol };
    } catch (err) {
      return { ok: false, hata: err?.message ?? String(err) };
    }
  }

  kapat() {
    if (this._bostaZamanlayici) { clearTimeout(this._bostaZamanlayici); this._bostaZamanlayici = null; }
    const p = this._surec;
    this._surec = null; this._hazir = null; this._surecBasladi = false;
    if (!p) return;
    try { p.stdin.end(); p.kill(); } catch { /* kapanışta önemsiz */ }
  }
}

export { PiperSesi, piperBul };
